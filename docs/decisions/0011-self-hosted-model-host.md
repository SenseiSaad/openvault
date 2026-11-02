# ADR 0011 — Bedrock default; self-hosted Ollama later via the model_host module

**Status:** accepted
**Decision:** Amazon Bedrock (Claude Haiku 4.5 via the India inference profile +
Titan Text Embeddings v2) is the launch default, authenticated by the ECS task
role only. `infra/modules/model_host` (OFF by default) provisions an Ollama EC2
host for a self-hosted open-source model later.
**Why:** Bedrock gives a managed, no-keys, India-region processing story for
Pakistani enterprise customers. The provider abstraction (`core/providers.py`)
already supports ollama | openai-compatible | gemini | bedrock by env — flipping
to a self-hosted model is a config change, not a code change. The small-model
path (qwen2.5:1.5b, <1 GB) exists for laptop demos; it is not accurate enough
for customers (documented limitations: grounding drift, over-answering).
**Consequences:** model access must be enabled per-region in the console
(readiness is visible via the `llm_error` log metric); Bedrock pricing/privacy
terms must be re-verified in AWS docs before marketing claims (UNVERIFIED here).
