"""LLM provider settings: plan gate, key never leaks, key encrypted at rest."""
import pytest
from django.db import connection

from core import providers
from core.models import LLMConfig, Plan

pytestmark = pytest.mark.django_db


def _custom_llm_plan():
    return Plan.objects.create(name="BYO LLM", price_usd=0, max_members=5,
                               allow_custom_llm=True, is_default=False)


def test_custom_llm_is_plan_gated(auth_client, make_company, make_user):
    company = make_company(plan=Plan.objects.create(name="Free-ish", is_default=False,
                                                    allow_custom_llm=False))
    admin = make_user(company, email="a@acme.test", role="admin")
    resp = auth_client(admin).put("/api/admin/llm-config",
                                  {"provider": "openai", "chat_model": "gpt-4o-mini"},
                                  format="json")
    assert resp.status_code == 402


def test_api_key_is_write_only_and_encrypted(auth_client, make_company, make_user):
    company = make_company(plan=_custom_llm_plan())
    admin = make_user(company, email="a@acme.test", role="admin")
    client = auth_client(admin)

    resp = client.put("/api/admin/llm-config",
                      {"provider": "openai", "chat_model": "gpt-4o-mini",
                       "api_key": "sk-super-secret-value"},
                      format="json")
    assert resp.status_code == 200
    body = resp.json()
    assert "api_key" not in body
    assert body["has_api_key"] is True

    # The plaintext key must not exist anywhere in the database.
    with connection.cursor() as cursor:
        cursor.execute("SELECT api_key FROM core_llmconfig WHERE company_id = %s",
                       [company.id])
        raw = cursor.fetchone()[0]
    assert "sk-super-secret-value" not in raw
    assert raw.startswith("enc:v1:")

    # ...but the application decrypts it for provider calls.
    row = LLMConfig.objects.get(company=company)
    row.refresh_from_db()
    assert row.api_key == "sk-super-secret-value"

    # A GET still only reports whether a key is set.
    got = client.get("/api/admin/llm-config").json()
    assert "api_key" not in got
    assert got["has_api_key"] is True


def test_resolution_prefers_company_override(make_company):
    company = make_company(plan=_custom_llm_plan())
    LLMConfig.objects.create(company=company, provider="openai",
                             chat_model="gpt-4o-mini", api_key="sk-company-key")
    resolved = providers._resolve(company)
    assert resolved["provider"] == "openai"
    assert resolved["api_key"] == "sk-company-key"
    assert resolved["model"] == "gpt-4o-mini"


def test_online_mode_uses_bedrock_instead_of_a_legacy_gemini_config(monkeypatch):
    LLMConfig.objects.create(
        company=None,
        provider="gemini",
        chat_model="gemini-2.5-flash",
        api_key="old-gemini-key",
    )
    monkeypatch.setenv("LLM_PROVIDER", "bedrock")
    monkeypatch.setenv("BEDROCK_MODEL", "in.anthropic.claude-haiku-4-5-20251001-v1:0")
    monkeypatch.setenv("BEDROCK_REGION", "ap-south-1")
    monkeypatch.setenv("BEDROCK_API_KEY", "bedrock-test-key-long-enough-123456")

    provider = providers.get_chat_provider(mode="online")

    assert provider.label == "bedrock"
    assert provider.chat_model == "in.anthropic.claude-haiku-4-5-20251001-v1:0"
    assert provider.api_key == "bedrock-test-key-long-enough-123456"
    assert providers._resolve()["key_source"] == "platform_env"


def test_render_bedrock_key_beats_a_stale_platform_bedrock_row(monkeypatch):
    """A saved platform row must not pin an old key/model for every user."""
    LLMConfig.objects.create(
        company=None,
        provider="bedrock",
        chat_model="in.anthropic.claude-3-5-sonnet-20240620-v1:0",
        api_key="stale-platform-key-123456",
        base_url="us-east-1",
    )
    monkeypatch.setenv("LLM_PROVIDER", "bedrock")
    monkeypatch.setenv("BEDROCK_MODEL", "in.anthropic.claude-haiku-4-5-20251001-v1:0")
    monkeypatch.setenv("BEDROCK_REGION", "ap-south-1")
    monkeypatch.setenv("BEDROCK_API_KEY", "render-shared-key-long-enough-123456")

    resolved = providers._resolve()
    assert resolved["provider"] == "bedrock"
    assert resolved["model"] == "in.anthropic.claude-haiku-4-5-20251001-v1:0"
    assert resolved["api_key"] == "render-shared-key-long-enough-123456"
    assert resolved["base_url"] == "ap-south-1"
    assert resolved["key_source"] == "platform_env"

    online = providers.get_chat_provider(mode="online")
    assert online.api_key == "render-shared-key-long-enough-123456"
    assert online.chat_model == "in.anthropic.claude-haiku-4-5-20251001-v1:0"


def test_embedding_uses_the_render_bedrock_key(monkeypatch):
    LLMConfig.objects.create(
        company=None, provider="bedrock",
        api_key="stale-embedding-key-123456",
        chat_model="in.anthropic.claude-haiku-4-5-20251001-v1:0",
    )
    monkeypatch.setenv("EMBED_PROVIDER", "bedrock")
    monkeypatch.setenv("LLM_PROVIDER", "bedrock")
    monkeypatch.setenv("BEDROCK_REGION", "ap-south-1")
    monkeypatch.setenv("BEDROCK_API_KEY", "render-shared-key-long-enough-123456")

    provider = providers.get_embed_provider()
    assert isinstance(provider, providers.BedrockProvider)
    assert provider.api_key == "render-shared-key-long-enough-123456"
    assert provider.region == "ap-south-1"


def test_llm_config_read_reports_platform_key_without_leaking_it(auth_client, monkeypatch):
    from core.models import User

    caller = User.objects.create_user(
        email="platform@example.com", password="Valid!Pass99", company=None,
        role="admin", is_platform_admin=True, email_verified=True,
    )
    LLMConfig.objects.create(
        company=None, provider="gemini", chat_model="gemini-2.5-flash",
        api_key="old-gemini-key",
    )
    monkeypatch.setenv("LLM_PROVIDER", "bedrock")
    monkeypatch.setenv("BEDROCK_MODEL", "in.anthropic.claude-haiku-4-5-20251001-v1:0")
    monkeypatch.setenv("BEDROCK_REGION", "ap-south-1")
    monkeypatch.setenv("BEDROCK_API_KEY", "render-shared-key-long-enough-123456")

    resp = auth_client(caller).get("/api/admin/llm-config")
    assert resp.status_code == 200
    body = resp.json()
    assert body["provider"] == "bedrock"
    assert body["chat_model"] == "in.anthropic.claude-haiku-4-5-20251001-v1:0"
    assert body["key_source"] == "platform_env"
    assert body["platform_key_in_use"] is True
    assert body["has_api_key"] is True
    assert "api_key" not in body
    assert "render-shared-key" not in str(body)


def test_local_mode_uses_ollama_when_bedrock_is_the_default(monkeypatch):
    monkeypatch.setenv("LLM_PROVIDER", "bedrock")
    monkeypatch.setenv("LLM_URL", "http://ollama.internal:11434")
    monkeypatch.setenv("LLM_MODEL", "qwen2.5:1.5b")

    provider = providers.get_chat_provider(mode="local")

    assert provider.label == "ollama"
    assert provider.base == "http://ollama.internal:11434"
    assert provider.chat_model == "qwen2.5:1.5b"


def test_bedrock_api_key_uses_bearer_auth_without_network():
    provider = providers.BedrockProvider(
        "test-bedrock-bearer-token-1234567890", "ap-south-1", "in.example-model"
    )
    client = provider._client()
    captured = {}

    def capture_and_stop(request, **kwargs):
        captured["authorization"] = request.headers.get("Authorization", b"")
        captured["sigv4_date"] = request.headers.get("X-Amz-Date")
        raise RuntimeError("stop before network")

    client.meta.events.register("before-send.bedrock-runtime.Converse", capture_and_stop)
    with pytest.raises(RuntimeError, match="stop before network"):
        client.converse(
            modelId="in.example-model",
            messages=[{"role": "user", "content": [{"text": "test"}]}],
        )

    assert captured["authorization"].startswith(b"Bearer ")
    assert captured["sigv4_date"] is None


def test_bedrock_access_key_pair_keeps_sigv4():
    provider = providers.BedrockProvider(
        "TESTACCESSKEYID12345:example-secret-access-key", "ap-south-1", "in.example-model"
    )
    client = provider._client()
    captured = {}

    def capture_and_stop(request, **kwargs):
        captured["authorization"] = request.headers.get("Authorization", b"")
        raise RuntimeError("stop before network")

    client.meta.events.register("before-send.bedrock-runtime.Converse", capture_and_stop)
    with pytest.raises(RuntimeError, match="stop before network"):
        client.converse(
            modelId="in.example-model",
            messages=[{"role": "user", "content": [{"text": "test"}]}],
        )

    assert captured["authorization"].startswith(b"AWS4-HMAC-SHA256 ")
