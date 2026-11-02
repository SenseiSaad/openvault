"""Observability contract: JSON usage fields and provider token accounting."""
import json
import logging

import pytest

from config.settings import JsonLogFormatter


def test_json_formatter_emits_usage_fields_without_prompt_text():
    record = logging.LogRecord(
        "openvault.llm_usage", logging.INFO, __file__, 1, "llm usage", (), None
    )
    record.event = "llm_usage"
    record.company_id = 7
    record.model = "in.anthropic.claude-haiku-4-5-20251001-v1:0"
    record.provider = "bedrock"
    record.input_tokens = 1200
    record.output_tokens = 300
    record.total_tokens = 1500

    payload = json.loads(JsonLogFormatter().format(record))
    assert payload["event"] == "llm_usage"
    assert payload["company_id"] == 7
    assert payload["input_tokens"] == 1200
    assert payload["output_tokens"] == 300
    assert payload["total_tokens"] == 1500
    assert "prompt" not in payload


@pytest.mark.django_db
def test_log_llm_usage_emits_aggregatable_line(make_company, caplog):
    from core.rag import log_llm_usage

    company = make_company()
    with caplog.at_level(logging.INFO, logger="openvault.llm_usage"):
        log_llm_usage(company, "claude-test", "bedrock", 100, 25)

    record = caplog.records[-1]
    assert record.event == "llm_usage"
    assert record.company_id == company.id
    assert record.input_tokens == 100
    assert record.output_tokens == 25
    assert record.total_tokens == 125


def test_bedrock_stream_captures_usage_event():
    from core.providers import BedrockProvider

    class FakeClient:
        def converse_stream(self, **kwargs):
            return {
                "stream": [
                    {"contentBlockDelta": {"delta": {"text": "hello"}}},
                    {"metadata": {"usage": {"inputTokens": 11, "outputTokens": 3}}},
                ]
            }

    provider = BedrockProvider("", "ap-south-1", "in.test-model")
    provider._client = lambda: FakeClient()
    text = "".join(provider.stream_chat([{"role": "user", "content": "hi"}]))
    assert text == "hello"
    assert provider.last_usage == {"input_tokens": 11, "output_tokens": 3}
