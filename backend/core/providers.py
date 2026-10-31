"""LLM provider interface.

One small class per backend. Every provider implements the SAME three methods,
so the rest of the app (rag.py) never has to care which one is switched on:

    available()                 -> bool        (reachable / has a key?)
    embed(texts)                -> list | None (vectors, or None = keyword search)
    stream_chat(messages, ...)  -> yields answer text piece by piece

Switch the active provider from the Settings page (saved in the LLMConfig row)
or from .env. Everything uses the standard library except Bedrock, which needs
boto3 (see requirements.txt) and imports it lazily.

Providers:
    ollama     - a model on THIS machine (or your EC2) via Ollama. DEFAULT.
    openai     - OpenAI, or ANY OpenAI-compatible endpoint (vLLM, LM Studio,
                 Groq, Together, OpenRouter, even Ollama's own /v1 route).
    anthropic  - Claude (claude-... models). No embeddings API -> keyword search.
    gemini     - Google Gemini (gemini-... models).
    bedrock    - AWS Bedrock via the India geographic inference profile
                 (in.anthropic.claude-*). Needs boto3 from requirements.txt.
"""
import json
import os
import time
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
    # The only urlopen in the codebase. The only URL reaching it from tenant
    # input is LLMConfig.base_url, validated as https-to-public-host in
    # core.netguard before use — hence the nosec with justification.
    return urllib.request.urlopen(req, timeout=timeout)  # nosec B310


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


# Socket timeouts for provider calls. For streaming responses urllib applies
# the timeout per read, so this caps the silence between tokens — not total
# generation time — while guaranteeing a wedged endpoint can never pin a
# gunicorn thread forever.
_STREAM_TIMEOUT = float(os.getenv("LLM_STREAM_TIMEOUT", "300"))
_CONNECT_TIMEOUT = float(os.getenv("LLM_CONNECT_TIMEOUT", "15"))
_BOTOCORE_CONFIG_KWARGS = {
    "retries": {"max_attempts": 3, "mode": "standard"},
    "connect_timeout": _CONNECT_TIMEOUT,
    "read_timeout": _STREAM_TIMEOUT,
}


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
        with _open(f"{self.base}/api/chat", payload, timeout=_STREAM_TIMEOUT) as r:
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
                   headers=self._headers(), timeout=_STREAM_TIMEOUT) as r:
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
                   headers=self._headers(), timeout=_STREAM_TIMEOUT) as r:
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
        model = (chat_model or "gemini-2.5-flash").strip()
        if model.startswith("models/"):
            model = model[len("models/"):]
        self.chat_model = model or "gemini-2.5-flash"
        em = (embed_model or "gemini-embedding-001").strip()
        if em.startswith("models/"):
            em = em[len("models/"):]
        self.embed_model = em or "gemini-embedding-001"

    def available(self):
        return bool(self.api_key)

    def embed(self, texts):
        if not self.api_key or not texts:
            return None
        # Try batch embed first
        hdr = {"x-goog-api-key": self.api_key}
        url = f"{self.base}/models/{self.embed_model}:batchEmbedContents"
        try:
            reqs = [{"model": f"models/{self.embed_model}", "content": {"parts": [{"text": t}]}} for t in texts]
            res = _json(url, {"requests": reqs}, headers=hdr, timeout=6.0)
            embs = res.get("embeddings", [])
            if embs and len(embs) == len(texts):
                if np is not None:
                    return [np.asarray(e["values"], dtype=np.float32) for e in embs]
                return [e["values"] for e in embs]
        except Exception:
            pass
        # Fallback to single requests
        try:
            out = []
            for t in texts:
                u = f"{self.base}/models/{self.embed_model}:embedContent"
                r = _json(u, {"model": f"models/{self.embed_model}", "content": {"parts": [{"text": t}]}}, headers=hdr, timeout=6.0)
                vals = r["embedding"]["values"]
                if np is not None:
                    out.append(np.asarray(vals, dtype=np.float32))
                else:
                    out.append(vals)
            return out
        except Exception:
            return None

    def stream_chat(self, messages, temperature=0.2, max_tokens=512):
        system, rest = _split_system(messages)
        # Merge consecutive messages with the same role so Gemini does not error on turns
        merged_rest = []
        for m in rest:
            role = "model" if m.get("role") == "assistant" else "user"
            text = m.get("content", "")
            if merged_rest and merged_rest[-1]["role"] == role:
                merged_rest[-1]["parts"][0]["text"] += "\n" + text
            else:
                merged_rest.append({"role": role, "parts": [{"text": text}]})

        if not merged_rest:
            merged_rest = [{"role": "user", "parts": [{"text": "Hello"}]}]

        # For fastest response and to prevent thinking tokens from consuming the
        # entire maxOutputTokens budget on short replies, disable thinking budget
        gen_config = {
            "temperature": temperature,
            "maxOutputTokens": max(max_tokens, 64),
            "thinkingConfig": {"thinkingBudget": 0},
        }

        payload = {
            "contents": merged_rest,
            "generationConfig": gen_config,
        }
        if system:
            payload["systemInstruction"] = {"parts": [{"text": system}]}

        models_to_try = [self.chat_model]
        if self.chat_model != "gemini-2.5-flash-lite":
            models_to_try.append("gemini-2.5-flash-lite")

        last_error = None
        for model_name in models_to_try:
            url = (
                f"{self.base}/models/{model_name}:streamGenerateContent"
                f"?alt=sse"
            )
            for attempt in range(2):
                try:
                    with _open(url, payload, headers={"x-goog-api-key": self.api_key}, timeout=60.0) as r:
                        for line in _sse_lines(r):
                            try:
                                data = json.loads(line)
                            except json.JSONDecodeError:
                                continue
                            if data.get("error"):
                                err_msg = data["error"].get("message", "Unknown Gemini error")
                                raise RuntimeError(f"Gemini API error: {err_msg}")
                            for cand in data.get("candidates", []):
                                for part in cand.get("content", {}).get("parts", []):
                                    if part.get("text"):
                                        yield part["text"]
                    return
                except urllib.error.HTTPError as e:
                    body = e.read().decode("utf-8", "ignore")
                    try:
                        err_data = json.loads(body)
                        err_msg = err_data.get("error", {}).get("message", body)
                    except Exception:
                        err_msg = body or e.reason
                    last_error = RuntimeError(f"Gemini API error ({e.code}): {err_msg}")
                    # If thinkingConfig was rejected by an older model, retry without it
                    if "thinkingConfig" in err_msg and "thinkingConfig" in gen_config:
                        del gen_config["thinkingConfig"]
                        payload["generationConfig"] = gen_config
                        continue
                    # Transient capacity spikes (503 / 429): wait briefly and retry or fall back
                    if e.code in (503, 429) and attempt == 0:
                        time.sleep(1.0)
                        continue
                    break
                except Exception as e:
                    last_error = RuntimeError(f"Gemini request failed: {e}")
                    break

        if last_error:
            raise last_error


# Cached result of BedrockProvider.available() so /api/ask does not re-run the
# credential-chain lookup on every question.
_BEDROCK_AVAIL_CACHE = {"ts": 0.0, "key": None, "ok": False}


class _StaticBedrockToken:
    """Give one boto3 session a single Bedrock API key (bearer token).

    Botocore normally reads AWS_BEARER_TOKEN_BEDROCK from the process
    environment. That is unsafe for multi-tenant BYO keys: two companies'
    keys would overwrite each other. Inserting a token provider into the
    session keeps the credential scoped to that client.
    """

    METHOD = "openvault-bedrock-key"

    def __init__(self, token):
        self._token = token

    def load_token(self, **kwargs):
        if kwargs.get("signing_name") not in (None, "bedrock"):
            return None
        from botocore.tokens import FrozenAuthToken
        return FrozenAuthToken(self._token)


class BedrockProvider(BaseProvider):
    """AWS Bedrock, pinned to the INDIA geographic cross-region inference
    profile (in.anthropic.claude-* prefix) so prompts and answers are only
    processed in India AWS infrastructure (ap-south-1 / ap-south-2) — never
    the global profile. AWS Bedrock's service terms state that prompts and
    completions are not used to train the base models.

    Auth, in order of preference:
      1. An IAM role attached to the running service (blank key). This is the
         production path; no long-lived credential is stored anywhere.
      2. A Bedrock API key (bearer token), stored in LLMConfig.api_key or
         BEDROCK_API_KEY. boto3 sends the request with bearer authentication
         instead of SigV4.
      3. A tenant AWS access-key pair, stored in LLMConfig.api_key as
         "ACCESS_KEY_ID:SECRET_ACCESS_KEY" and signed with SigV4.
    `region` is the LLMConfig.base_url field or BEDROCK_REGION (default
    ap-south-1).
    Embeddings: amazon.titan-embed-text-v2 (1024 dims) via InvokeModel.
    """
    label = "bedrock"

    def __init__(self, api_key, region, chat_model, embed_model=""):
        self.api_key = (api_key or "").strip()
        self.region = (region or "").strip() or "ap-south-1"
        self.chat_model = chat_model or DEFAULT_MODELS["bedrock"]
        self.embed_model = embed_model or "amazon.titan-embed-text-v2:0"

    def _aws_access_key_pair(self):
        access_key, separator, secret_key = self.api_key.partition(":")
        is_key_id = (
            len(access_key) == 20
            and access_key.isascii()
            and access_key.isalnum()
            and access_key.isupper()
        )
        return (access_key, secret_key) if separator and secret_key and is_key_id else None

    def _client(self):
        import boto3
        from botocore.config import Config

        key_pair = self._aws_access_key_pair()
        if key_pair:
            access_key, secret_key = key_pair
            return boto3.client(
                "bedrock-runtime", region_name=self.region,
                aws_access_key_id=access_key.strip(),
                aws_secret_access_key=secret_key.strip(),
                config=Config(**_BOTOCORE_CONFIG_KWARGS),
            )
        if self.api_key:
            # Bedrock API keys are bearer tokens, not SigV4 credentials. Give
            # this boto3 session its own token provider so one tenant's key
            # never leaks into another tenant's client.
            session = boto3.Session(region_name=self.region)
            token_provider = session._session.get_component("token_provider")
            token_provider.insert_before("env", _StaticBedrockToken(self.api_key))
            return session.client(
                "bedrock-runtime",
                config=Config(
                    retries={"max_attempts": 3, "mode": "standard"},
                    auth_scheme_preference="httpBearerAuth",
                ),
            )
        # Blank key -> boto3 default credential chain (IAM role on EC2/ECS).
        return boto3.client(
            "bedrock-runtime", region_name=self.region,
            config=Config(**_BOTOCORE_CONFIG_KWARGS),
        )

    def available(self):
        """Cheap credentials check, cached for 60s. An inference probe here
        would add latency and token cost to every /api/ask; the Settings
        page's Test Connectivity (llm-test) makes the real end-to-end call."""
        now = time.time()
        c = _BEDROCK_AVAIL_CACHE
        if c["key"] == self.api_key and now - c["ts"] < 60:
            return c["ok"]
        try:
            if self.api_key:
                # Either an access-key pair or a bearer API key. Both are long
                # enough to be real; a short accidental paste is not.
                ok = len(self.api_key) >= 20
            elif os.getenv("AWS_BEARER_TOKEN_BEDROCK"):
                ok = True
            else:
                import botocore.session
                s = botocore.session.get_session()
                # Keep the EC2 metadata probe short when running off-cloud.
                s.set_config_variable("metadata_service_timeout", 1)
                s.set_config_variable("metadata_service_num_attempts", 1)
                ok = s.get_credentials() is not None
        except Exception:
            ok = False
        c.update(ts=now, key=self.api_key, ok=ok)
        return ok

    def embed(self, texts):
        if np is None or not texts:
            return None
        try:
            client = self._client()
            vecs = []
            for t in texts:
                body = {"inputText": t[:8000]}
                # Only Titan V2 understands the dimensions parameter.
                if "titan-embed-text-v2" in self.embed_model:
                    body["dimensions"] = 1024
                    body["normalize"] = True
                r = client.invoke_model(modelId=self.embed_model,
                                        body=json.dumps(body))
                data = json.loads(r["body"].read())
                vecs.append(np.asarray(data["embedding"], dtype=np.float32))
            return vecs
        except Exception:
            return None

    def stream_chat(self, messages, temperature=0.2, max_tokens=512):
        system, rest = _split_system(messages)
        convo = [{"role": m["role"], "content": [{"text": m.get("content", "")}]}
                 for m in rest]
        if not convo:
            convo = [{"role": "user", "content": [{"text": "Hello"}]}]
        payload = {
            "modelId": self.chat_model,
            "messages": convo,
            "inferenceConfig": {
                "maxTokens": max(int(max_tokens), 64),
                "temperature": float(temperature),
            },
        }
        if system:
            payload["system"] = [{"text": system}]
        resp = self._client().converse_stream(**payload)
        for event in resp.get("stream", []):
            tok = event.get("contentBlockDelta", {}).get("delta", {}).get("text", "")
            if tok:
                yield tok


# ------------------------------------------------------- pick the live provider
DEFAULT_MODELS = {
    "ollama": "qwen2.5:1.5b",
    "openai": "gpt-4o-mini",
    "anthropic": "claude-3-5-haiku-latest",
    "gemini": "gemini-2.5-flash",
    # India geographic inference profile — NOT the global one.
    "bedrock": "in.anthropic.claude-haiku-4-5-20251001-v1:0",
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
    if provider == "bedrock":
        # For Bedrock the base_url field carries the AWS region.
        return os.getenv("BEDROCK_REGION", "ap-south-1")
    return ""


def _safe_tenant_base_url(raw, company_row):
    """SSRF gate for tenant-supplied base_url values.

    Environment and platform-row values come from the operator and pass
    through unchanged (that is what keeps "Ollama on this host" working).
    A COMPANY row's URL must be https to a public host — private/loopback/
    metadata addresses are refused and the override silently falls back to
    the platform default, so a bad URL can never be used as a network pivot.
    """
    raw = (raw or "").strip()
    if not raw or company_row is None:
        return raw
    if not raw.lower().startswith(("http://", "https://")):
        return raw  # non-URL values (e.g. a Bedrock region) are not fetchable
    from .netguard import UnsafeURLError, validate_public_url
    try:
        return validate_public_url(raw, allow_http=False)
    except UnsafeURLError:
        import logging
        logging.getLogger(__name__).warning(
            "Rejected unsafe LLMConfig.base_url for company %s", company_row.company_id
        )
        return ""


def shared_bedrock_key():
    """The platform-wide Bedrock bearer token from the Render environment.

    Returns an empty string unless Bedrock is the configured platform provider
    (or LLM_PROVIDER is unset). This is deliberately separate from a company's
    optional BYO key: it is the key every ordinary signed-in user shares.
    """
    provider = os.getenv("LLM_PROVIDER", "").strip().lower()
    if provider not in ("", "bedrock"):
        return ""
    return os.getenv("BEDROCK_API_KEY", "").strip()


def _resolve(company=None):
    """Merge LLM settings over the .env defaults.

    Precedence:
      1. A company's explicit override row (per-tenant BYO key).
      2. For the platform default, the Render environment's Bedrock key/model
         wins over a stale platform LLMConfig row. This is what makes every
         ordinary signed-in user share the same Bedrock key and Claude 4.5
         default without needing to paste a key.
      3. The platform row, then .env.
    """
    from .models import LLMConfig
    company_row = LLMConfig.for_company(company)
    row = company_row or LLMConfig.load()
    shared_key = shared_bedrock_key()
    env_provider = os.getenv("LLM_PROVIDER", "").strip().lower()

    # A platform-wide Bedrock key in Render is authoritative for the shared
    # default. Ignore an older platform row that may still say Gemini/OpenAI or
    # carry a different Bedrock key/model.
    if company_row is None and shared_key and env_provider in ("", "bedrock"):
        provider = "bedrock"
        model = _env_model("bedrock")
        api_key = shared_key
        base_url = _env_base("bedrock")
        key_source = "platform_env"
    else:
        provider = (row.provider or os.getenv("LLM_PROVIDER", "ollama")).strip().lower()
        if provider not in DEFAULT_MODELS:
            provider = "ollama"
        model = (row.chat_model or "").strip() or _env_model(provider)
        api_key = (row.api_key or "").strip() or _env_key(provider)
        base_url = _safe_tenant_base_url(row.base_url, company_row) or _env_base(provider)
        if company_row is not None and (company_row.api_key or "").strip():
            key_source = "company"
        elif shared_key and provider == "bedrock":
            key_source = "platform_env"
        elif (row.api_key or "").strip():
            key_source = "row"
        elif provider == "bedrock":
            key_source = "iam"
        else:
            key_source = "none"

    return {
        "provider": provider,
        "model": model,
        "api_key": api_key,
        "base_url": base_url,
        "temperature": row.temperature,
        "max_tokens": row.max_tokens,
        "key_source": key_source,
    }


def get_chat_provider(mode: str = None, provider_override: str = None, company=None):
    """The provider used to ANSWER questions.

    Bedrock is the supported online provider; Ollama is the local/server-hosted
    option. Legacy provider overrides fall back to Bedrock so a stale
    Gemini/OpenAI row cannot bypass the two-mode product configuration.
    """
    c = _resolve(company)

    target_provider = (provider_override or "").strip().lower()
    if mode == "local":
        target_provider = "ollama"
    elif mode == "online" and target_provider not in ("bedrock", "ollama"):
        target_provider = "bedrock"
    if not target_provider:
        target_provider = c["provider"] if c["provider"] in ("bedrock", "ollama") else "bedrock"
    if target_provider not in ("bedrock", "ollama", "gemini", "openai", "anthropic"):
        target_provider = "bedrock"

    if target_provider == "gemini":
        key = c["api_key"] if c["provider"] == "gemini" else _env_key("gemini")
        model = c["model"] if c["provider"] == "gemini" else _env_model("gemini")
        prov = GeminiProvider(key, model)
    elif target_provider == "openai":
        key = c["api_key"] if c["provider"] == "openai" else _env_key("openai")
        model = c["model"] if c["provider"] == "openai" else _env_model("openai")
        base = c["base_url"] if c["provider"] == "openai" else _env_base("openai")
        prov = OpenAIProvider(key, base, model)
    elif target_provider == "anthropic":
        key = c["api_key"] if c["provider"] == "anthropic" else _env_key("anthropic")
        model = c["model"] if c["provider"] == "anthropic" else _env_model("anthropic")
        prov = AnthropicProvider(key, model)
    elif target_provider == "bedrock":
        # Blank key = boto3 default credential chain (IAM role on EC2).
        key = c["api_key"] if c["provider"] == "bedrock" else _env_key("bedrock")
        region = c["base_url"] if c["provider"] == "bedrock" else _env_base("bedrock")
        model = c["model"] if c["provider"] == "bedrock" else _env_model("bedrock")
        prov = BedrockProvider(key, region, model)
    else:
        # ollama / local
        base = c["base_url"] if c["provider"] == "ollama" else _env_base("ollama")
        model = c["model"] if c["provider"] == "ollama" else _env_model("ollama")
        prov = OllamaProvider(base, model, os.getenv("EMBED_MODEL", "nomic-embed-text"))

    prov.temperature = c["temperature"]
    prov.max_tokens = c["max_tokens"]
    return prov


def get_embed_provider(company=None):
    """The provider used to INDEX/SEARCH documents.

    Embeddings must stay consistent with what's stored, so the company override
    is only honoured when it selects the same provider family as before a
    company could override anything; otherwise it falls back to the platform
    resolution. Resolution: platform (env/row) unless the company explicitly
    configured its own.
    """
    from .models import LLMConfig
    cfg = LLMConfig.for_company(company)
    p = os.getenv("EMBED_PROVIDER", "").strip().lower()
    if not p:
        platform_cfg = LLMConfig.load()
        if platform_cfg.provider == "gemini" and (platform_cfg.api_key or _env_key("gemini")):
            p = "gemini"
        elif platform_cfg.provider == "openai" and (platform_cfg.api_key or _env_key("openai")):
            p = "openai"
        elif platform_cfg.provider == "bedrock":
            p = "bedrock"
        else:
            p = "ollama"

    # A company row with its own key wins so tenants with BYO keys embed with
    # their own account; model choice comes from env so stored vectors stay stable.
    if cfg and cfg.provider == p and cfg.api_key:
        if p == "openai":
            return OpenAIProvider(cfg.api_key, os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1"),
                                  "", os.getenv("OPENAI_EMBED_MODEL", "text-embedding-3-small"))
        if p == "gemini":
            return GeminiProvider(cfg.api_key, "", os.getenv("GEMINI_EMBED_MODEL", "gemini-embedding-001"))

    if p == "openai":
        key = (platform_key("openai")) or _env_key("openai")
        return OpenAIProvider(key, os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1"),
                              "", os.getenv("OPENAI_EMBED_MODEL", "text-embedding-3-small"))
    if p == "gemini":
        key = platform_key("gemini") or _env_key("gemini")
        return GeminiProvider(key, "", os.getenv("GEMINI_EMBED_MODEL", "gemini-embedding-001"))
    if p == "bedrock":
        # NOTE: titan-embed-text-v2 vectors are 1024-wide; switching the
        # embedding model requires `manage.py reindex_embeddings` first.
        key = platform_key("bedrock") or _env_key("bedrock")
        region = os.getenv("BEDROCK_REGION", "ap-south-1")
        if cfg and cfg.provider == "bedrock":
            key = cfg.api_key or key
            region = (cfg.base_url or "").strip() or region
        return BedrockProvider(key, region, "",
                               os.getenv("BEDROCK_EMBED_MODEL", "amazon.titan-embed-text-v2:0"))
    return OllamaProvider(os.getenv("LLM_URL", "http://localhost:11434"),
                          "", os.getenv("EMBED_MODEL", "nomic-embed-text"))


def platform_key(provider):
    """The platform key for `provider`, preferring the Render Bedrock secret.

    A stale platform row must not pin an old Bedrock key for embeddings either;
    the shared Render key is the single key ordinary users should use.
    """
    from .models import LLMConfig
    if provider == "bedrock":
        env_key = shared_bedrock_key()
        if env_key:
            return env_key
    cfg = LLMConfig.load()
    return cfg.api_key if cfg.provider == provider else ""

