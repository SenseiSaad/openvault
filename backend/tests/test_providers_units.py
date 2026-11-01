"""Provider-layer unit tests without network: resolution precedence, message
merging, Bedrock key parsing, stream parsing, and the fake provider."""
import json
import urllib.error as urllib_error
from io import BytesIO

import pytest

from core import providers

pytestmark = pytest.mark.django_db


class _FakeResponse:
    def __init__(self, lines):
        self._lines = lines

    def __iter__(self):
        return iter(self._lines)

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False


# ------------------------------------------------------------- resolution
def test_resolve_prefers_company_row_over_platform(monkeypatch):
    from core.models import Company, LLMConfig
    company = Company.objects.create(name="P Co", slug="p-co")
    LLMConfig.objects.create(company=company, provider="openai",
                             chat_model="gpt-4o-mini", api_key="sk-company")
    monkeypatch.setattr(providers, "shared_bedrock_key", lambda: "shared")
    monkeypatch.setenv("LLM_PROVIDER", "bedrock")

    resolved = providers._resolve(company)
    assert resolved["key_source"] == "company"
    assert resolved["api_key"] == "sk-company"


def test_resolve_platform_env_bedrock_wins_over_stale_row(monkeypatch):
    from core.models import LLMConfig
    LLMConfig.objects.create(provider="gemini", chat_model="gemini-2.5-flash",
                             api_key="stale-gemini")
    monkeypatch.setattr(providers, "shared_bedrock_key", lambda: "shared-key")
    monkeypatch.setenv("LLM_PROVIDER", "bedrock")
    monkeypatch.setenv("BEDROCK_MODEL", "in.anthropic.claude-haiku-4-5-20251001-v1:0")

    resolved = providers._resolve(None)
    assert resolved["provider"] == "bedrock"
    assert resolved["api_key"] == "shared-key"
    assert resolved["key_source"] == "platform_env"


def test_get_chat_provider_default_falls_back_to_bedrock(monkeypatch):
    monkeypatch.setenv("LLM_PROVIDER", "gemini")  # stale platform provider
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    prov = providers.get_chat_provider()
    assert prov.label in ("bedrock", "ollama")  # two-mode product: no gemini leak


def test_get_chat_provider_mode_online_maps_unknown_to_bedrock(monkeypatch):
    monkeypatch.setenv("LLM_PROVIDER", "fake")
    prov = providers.get_chat_provider(mode="online", provider_override="weird")
    assert prov.label == "bedrock"


# ------------------------------------------------- bedrock key pair parsing
def test_bedrock_key_pair_detection():
    prov = providers.BedrockProvider("AKIAIOSFODNN7EXAMPLE:wJalrXUtnFEMI", "ap-south-1", "")
    assert prov._aws_access_key_pair() == ("AKIAIOSFODNN7EXAMPLE", "wJalrXUtnFEMI")
    prov2 = providers.BedrockProvider("not-a-key-pair", "ap-south-1", "")
    assert prov2._aws_access_key_pair() is None
    prov3 = providers.BedrockProvider("", "ap-south-1", "")
    assert prov3._aws_access_key_pair() is None


def test_bedrock_availability_cache(monkeypatch):
    providers._BEDROCK_AVAIL_CACHE.update(ts=0.0, key=None, ok=False)
    prov = providers.BedrockProvider("bearer-token-value-123456", "ap-south-1", "")
    assert prov.available() is True
    assert providers._BEDROCK_AVAIL_CACHE["ok"] is True
    # cached: flips even the underlying check would fail now
    short = providers.BedrockProvider("short", "ap-south-1", "")
    assert short.available() is False  # different key -> recheck -> len<20


# --------------------------------------------------------- sse/ndjson parse
def test_sse_lines_strips_prefixes():
    lines = list(providers._sse_lines(_FakeResponse([
        b'data: {"tok": "a"}\n', b"", b'{"tok": "b"}\n', b"data: [DONE]"])))
    assert lines == ['{"tok": "a"}', '{"tok": "b"}', "[DONE]"]


def test_openai_stream_yields_deltas(monkeypatch):
    payloads = [
        b'data: {"choices": [{"delta": {"content": "Hel"}}]}\n',
        b'data: {"choices": [{"delta": {"content": "lo"}}]}\n',
        b'data: [DONE]\n',
    ]
    monkeypatch.setattr(providers, "_open", lambda *a, **k: _FakeResponse(payloads))
    prov = providers.OpenAIProvider("sk-x", "https://api.openai.com/v1", "gpt-4o-mini")
    assert "".join(prov.stream_chat([{"role": "user", "content": "hi"}])) == "Hello"


def test_anthropic_stream_yields_text(monkeypatch):
    payloads = [
        b'data: {"type": "content_block_delta", "delta": {"text": "Hi"}}\n',
        b'data: {"type": "message_stop"}\n',
    ]
    monkeypatch.setattr(providers, "_open", lambda *a, **k: _FakeResponse(payloads))
    prov = providers.AnthropicProvider("sk-x", "claude-3-5-haiku-latest")
    assert "".join(prov.stream_chat([{"role": "user", "content": "hi"}])) == "Hi"


def test_ollama_stream_yields_message_content(monkeypatch):
    payloads = [
        b'{"message": {"content": "Ol"}}\n',
        b'{"message": {"content": "a"}, "done": true}\n',
    ]
    monkeypatch.setattr(providers, "_open", lambda *a, **k: _FakeResponse(payloads))
    prov = providers.OllamaProvider("http://localhost:11434", "qwen2.5:1.5b", "nomic")
    assert "".join(prov.stream_chat([{"role": "user", "content": "hi"}])) == "Ola"


# ------------------------------------------------------------ gemini merge
def _gemini_sse(obj) -> bytes:
    return ("data: " + json.dumps(obj) + "\n").encode()


def test_gemini_merges_consecutive_roles(monkeypatch):
    payloads = [_gemini_sse({"candidates": [{"content": {"parts": [{"text": "ok"}]}}]})]
    captured = {}

    def fake_open(url, payload=None, headers=None, method=None, timeout=None):
        captured["payload"] = payload
        return _FakeResponse(payloads)

    monkeypatch.setattr(providers, "_open", fake_open)
    prov = providers.GeminiProvider("key", "gemini-2.5-flash")
    out = "".join(prov.stream_chat([
        {"role": "system", "content": "SYS"},
        {"role": "user", "content": "one"},
        {"role": "user", "content": "two"},
        {"role": "assistant", "content": "reply"},
    ]))
    assert out == "ok"
    contents = captured["payload"]["contents"]
    assert [c["role"] for c in contents] == ["user", "model"]
    assert contents[0]["parts"][0]["text"] == "one\ntwo"
    assert captured["payload"]["systemInstruction"]["parts"][0]["text"] == "SYS"


def test_gemini_retries_without_thinking_config(monkeypatch):
    class Err(urllib_error.HTTPError):
        def __init__(self):
            super().__init__("url", 400, "bad", None, BytesIO(
                b'{"error": {"message": "unknown field thinkingConfig"}}'))

    calls = {"n": 0}

    def flaky_open(url, payload=None, headers=None, method=None, timeout=None):
        calls["n"] += 1
        if calls["n"] == 1:
            raise Err()
        return _FakeResponse([_gemini_sse(
            {"candidates": [{"content": {"parts": [{"text": "ok"}]}}]})])

    monkeypatch.setattr(providers, "_open", flaky_open)
    prov = providers.GeminiProvider("key", "gemini-2.5-flash")
    assert "".join(prov.stream_chat([{"role": "user", "content": "hi"}])) == "ok"
    assert calls["n"] == 2


# ------------------------------------------------------------- fake provider
def test_fake_provider_streams_and_is_available():
    prov = providers.FakeProvider()
    assert prov.available() is True
    tokens = list(prov.stream_chat([{"role": "user", "content": "hi"}]))
    assert len(tokens) > 50  # a real stream, not one blob
    assert all(t.strip() for t in tokens)


def test_get_chat_provider_returns_fake_when_configured(monkeypatch):
    monkeypatch.setenv("LLM_PROVIDER", "fake")
    prov = providers.get_chat_provider()
    assert prov.label == "fake"


# ----------------------------------------------------------- embed provider
def test_get_embed_provider_company_byo_key(monkeypatch):
    from core.models import Company, LLMConfig
    monkeypatch.setenv("EMBED_PROVIDER", "openai")
    company = Company.objects.create(name="B", slug="b-embed")
    LLMConfig.objects.create(company=company, provider="openai", api_key="sk-byo")
    prov = providers.get_embed_provider(company=company)
    assert prov.api_key == "sk-byo"
    assert prov.embed_model_name == "text-embedding-3-small"


def test_get_embed_provider_platform_bedrock(monkeypatch):
    monkeypatch.setenv("EMBED_PROVIDER", "bedrock")
    monkeypatch.setattr(providers, "shared_bedrock_key", lambda: "shared")
    prov = providers.get_embed_provider()
    assert prov.label == "bedrock"
    assert prov.embed_model_name == "amazon.titan-embed-text-v2:0"
