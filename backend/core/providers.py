"""LLM provider interface.

One small class per backend. Every provider implements the SAME three methods,
so the rest of the app (rag.py) never has to care which one is switched on:

    available()                 -> bool        (reachable / has a key?)
    embed(texts)                -> list | None (vectors, or None = keyword search)
    stream_chat(messages, ...)  -> yields answer text piece by piece

Switch the active provider from the Settings page (saved in the LLMConfig row)
or from .env. Only the Python standard library is used here — nothing to install.

Providers:
    ollama     - a model on THIS machine (or your EC2) via Ollama. DEFAULT.
    openai     - OpenAI, or ANY OpenAI-compatible endpoint (vLLM, LM Studio,
                 Groq, Together, OpenRouter, even Ollama's own /v1 route).
    anthropic  - Claude (claude-... models). No embeddings API -> keyword search.
    gemini     - Google Gemini (gemini-... models).
"""
import json
import os
import urllib.error
import urllib.request

from django.conf import settings

try:
    import numpy as np
except ImportError:  # numpy only needed for embedding similarity
    np = None


# ---------------------------------------------------------------- http helpers
def _open(url, payload=None, headers=None, method=None, timeout=30.0):
    """Fire an HTTP request. GET when there's no payload, else POST JSON."""
    data = json.dumps(payload).encode() if payload is not None else None
    h = {"Content-Type": "application/json"} if data else {}
    if headers:
        h.update(headers)
    req = urllib.request.Request(
        url, data=data, headers=h, method=method or ("POST" if data else "GET")
    )
    return urllib.request.urlopen(req, timeout=timeout)


def _json(url, payload=None, headers=None, method=None, timeout=30.0):
    with _open(url, payload, headers, method, timeout) as r:
        return json.loads(r.read().decode())
def _sse_lines(resp):
    """Yield 'data:' payloads from a streaming SSE / NDJSON response."""
    for raw in resp:
        line = raw.decode("utf-8", "ignore").strip()
        if not line:
            continue
        if line.startswith("data:"):
            line = line[5:].strip()
        yield line


def _split_system(messages):
    """Split a message list into (system_text, [user/assistant messages])."""
    system, rest = "", []
    for m in messages:
        if m["role"] == "system":
            system = m["content"]
        else:
            rest.append(m)
    return system, rest


# ------------------------------------------------------------------- providers
class BaseProvider:
    label = "base"
    chat_model = ""
    temperature = 0.2
    max_tokens = 512

    def available(self):
        return False

    def embed(self, texts):
        return None  # no embeddings -> caller falls back to keyword search

    def stream_chat(self, messages, temperature=0.2, max_tokens=512):
        raise NotImplementedError
class OllamaProvider(BaseProvider):
    """A model running locally (or on your EC2) through Ollama."""
    label = "ollama"

    def __init__(self, base_url, chat_model, embed_model):
        self.base = (base_url or "http://localhost:11434").rstrip("/")
        self.chat_model = chat_model or "qwen2.5:1.5b"
        self.embed_model = embed_model or "nomic-embed-text"

    def available(self):
        try:
            _json(f"{self.base}/api/tags", timeout=2.0)
            return True
        except Exception:
            return False

    def embed(self, texts):
        if np is None:
            return None
        try:
            vecs = []
            for t in texts:
                r = _json(f"{self.base}/api/embeddings",
                          {"model": self.embed_model, "prompt": t})
                vecs.append(np.asarray(r["embedding"], dtype=np.float32))
            return vecs
        except Exception:
            return None

    def stream_chat(self, messages, temperature=0.2, max_tokens=512):
        payload = {"model": self.chat_model, "messages": messages, "stream": True,
                   "options": {"temperature": temperature, "num_predict": max_tokens}}
        with _open(f"{self.base}/api/chat", payload, timeout=None) as r:
            for line in _sse_lines(r):
                try:
                    data = json.loads(line)
                except json.JSONDecodeError:
                    continue
                tok = data.get("message", {}).get("content", "")
                if tok:
                    yield tok
                if data.get("done"):
                    break
class OpenAIProvider(BaseProvider):
    """OpenAI OR any OpenAI-compatible server (set base_url to point at it)."""
    label = "openai"

    def __init__(self, api_key, base_url, chat_model, embed_model=""):
        self.api_key = api_key or ""
        self.base = (base_url or "https://api.openai.com/v1").rstrip("/")
        self.chat_model = chat_model or "gpt-4o-mini"
        self.embed_model = embed_model or "text-embedding-3-small"

    def _headers(self):
        return {"Authorization": f"Bearer {self.api_key}"} if self.api_key else {}

    def available(self):
        if self.api_key:
            return True
        try:  # a local compatible server (LM Studio, vLLM) may need no key
            _json(f"{self.base}/models", headers=self._headers(), timeout=2.0)
            return True
        except Exception:
            return False

    def embed(self, texts):
        if np is None:
            return None
        try:
            r = _json(f"{self.base}/embeddings",
                      {"model": self.embed_model, "input": texts}, headers=self._headers())
            return [np.asarray(d["embedding"], dtype=np.float32) for d in r["data"]]
        except Exception:
            return None

    def stream_chat(self, messages, temperature=0.2, max_tokens=512):
        payload = {"model": self.chat_model, "messages": messages, "stream": True,
                   "temperature": temperature, "max_tokens": max_tokens}
        with _open(f"{self.base}/chat/completions", payload,
                   headers=self._headers(), timeout=None) as r:
            for line in _sse_lines(r):
                if line == "[DONE]":
                    break
                try:
                    data = json.loads(line)
                except json.JSONDecodeError:
                    continue
                tok = data.get("choices", [{}])[0].get("delta", {}).get("content") or ""
                if tok:
                    yield tok
class AnthropicProvider(BaseProvider):
    """Claude. Anthropic has no embeddings API, so embed() stays None
    (retrieval falls back to keyword search, which is fine)."""
    label = "anthropic"

    def __init__(self, api_key, chat_model, base_url=""):
        self.api_key = api_key or ""
        self.base = (base_url or "https://api.anthropic.com").rstrip("/")
        self.chat_model = chat_model or "claude-3-5-haiku-latest"

    def _headers(self):
        return {"x-api-key": self.api_key, "anthropic-version": "2023-06-01"}

    def available(self):
        return bool(self.api_key)

    def stream_chat(self, messages, temperature=0.2, max_tokens=512):
        system, rest = _split_system(messages)
        payload = {"model": self.chat_model, "max_tokens": max_tokens,
                   "temperature": temperature, "system": system,
                   "messages": rest, "stream": True}
        with _open(f"{self.base}/v1/messages", payload,
                   headers=self._headers(), timeout=None) as r:
            for line in _sse_lines(r):
                try:
                    data = json.loads(line)
                except json.JSONDecodeError:
                    continue
                if data.get("type") == "content_block_delta":
                    tok = data.get("delta", {}).get("text", "")
                    if tok:
                        yield tok
                elif data.get("type") == "message_stop":
                    break


class GeminiProvider(BaseProvider):
    """Google Gemini."""
    label = "gemini"

    def __init__(self, api_key, chat_model, embed_model=""):
        self.api_key = api_key or ""
        self.base = "https://generativelanguage.googleapis.com/v1beta"
        self.chat_model = chat_model or "gemini-1.5-flash"
        self.embed_model = embed_model or "text-embedding-004"

    def available(self):
        return bool(self.api_key)

    def embed(self, texts):
        if np is None or not self.api_key:
            return None
        try:
            url = f"{self.base}/models/{self.embed_model}:embedContent?key={self.api_key}"
            return [np.asarray(_json(url, {"content": {"parts": [{"text": t}]}})
                    ["embedding"]["values"], dtype=np.float32) for t in texts]
        except Exception:
            return None

    def stream_chat(self, messages, temperature=0.2, max_tokens=512):
        system, rest = _split_system(messages)
        contents = [{"role": "model" if m["role"] == "assistant" else "user",
                     "parts": [{"text": m["content"]}]} for m in rest]
        payload = {"contents": contents,
                   "generationConfig": {"temperature": temperature,
                                        "maxOutputTokens": max_tokens}}
        if system:
            payload["systemInstruction"] = {"parts": [{"text": system}]}
        url = (f"{self.base}/models/{self.chat_model}:streamGenerateContent"
               f"?alt=sse&key={self.api_key}")
        with _open(url, payload, timeout=None) as r:
            for line in _sse_lines(r):
                try:
                    data = json.loads(line)
                except json.JSONDecodeError:
                    continue
                for cand in data.get("candidates", []):
                    for part in cand.get("content", {}).get("parts", []):
                        if part.get("text"):
                            yield part["text"]
# ------------------------------------------------------- pick the live provider
DEFAULT_MODELS = {
    "ollama": "qwen2.5:1.5b",
    "openai": "gpt-4o-mini",
    "anthropic": "claude-3-5-haiku-latest",
    "gemini": "gemini-1.5-flash",
}


def _env_model(provider):
    if provider == "ollama":
        return os.getenv("LLM_MODEL", DEFAULT_MODELS["ollama"])
    return os.getenv(f"{provider.upper()}_MODEL", DEFAULT_MODELS.get(provider, ""))


def _env_key(provider):
    return os.getenv(f"{provider.upper()}_API_KEY", "")


def _env_base(provider):
    if provider == "ollama":
        return os.getenv("LLM_URL", "http://localhost:11434")
    if provider == "openai":
        return os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1")
    return ""


def _resolve():
    """Merge the runtime LLMConfig row (if any) over the .env defaults."""
    from .models import LLMConfig
    row = LLMConfig.load()
    provider = (row.provider or os.getenv("LLM_PROVIDER", "ollama")).strip().lower()
    if provider not in DEFAULT_MODELS:
        provider = "ollama"
    return {
        "provider": provider,
        "model": (row.chat_model or "").strip() or _env_model(provider),
        "api_key": (row.api_key or "").strip() or _env_key(provider),
        "base_url": (row.base_url or "").strip() or _env_base(provider),
        "temperature": row.temperature,
        "max_tokens": row.max_tokens,
    }


def get_chat_provider():
    """The provider used to ANSWER questions (swap this from the Settings page)."""
    c = _resolve()
    p, model, key, base = c["provider"], c["model"], c["api_key"], c["base_url"]
    if p == "openai":
        prov = OpenAIProvider(key, base, model)
    elif p == "anthropic":
        prov = AnthropicProvider(key, model, base)
    elif p == "gemini":
        prov = GeminiProvider(key, model)
    else:
        prov = OllamaProvider(base, model, os.getenv("EMBED_MODEL", "nomic-embed-text"))
    prov.temperature = c["temperature"]
    prov.max_tokens = c["max_tokens"]
    return prov


def get_embed_provider():
    """The provider used to INDEX/SEARCH documents. Kept separate from chat and
    defaults to local Ollama, so switching the chat model never breaks the
    vectors already stored (mismatched dimensions). Set EMBED_PROVIDER to change."""
    p = os.getenv("EMBED_PROVIDER", "ollama").strip().lower()
    if p == "openai":
        return OpenAIProvider(os.getenv("OPENAI_API_KEY", ""),
                              os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1"),
                              "", os.getenv("OPENAI_EMBED_MODEL", "text-embedding-3-small"))
    if p == "gemini":
        return GeminiProvider(os.getenv("GEMINI_API_KEY", ""), "",
                              os.getenv("GEMINI_EMBED_MODEL", "text-embedding-004"))
    return OllamaProvider(os.getenv("LLM_URL", "http://localhost:11434"),
                          "", os.getenv("EMBED_MODEL", "nomic-embed-text"))





