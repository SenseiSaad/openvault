"""Deterministic fakes shared by the isolation and eval tests."""
import json


class StubChatProvider:
    """A chat provider that echoes nothing but proves the wiring: it records
    the exact prompt context it was handed and streams a fixed answer plus a
    well-formed intent block, so tests can assert on what the model WOULD see.
    """

    label = "stub"
    chat_model = "stub-1"
    temperature = 0.2
    max_tokens = 512
    embed_model_name = ""

    def __init__(self, capture=None):
        self._capture = capture if capture is not None else []

    @property
    def captured_contexts(self):
        return self._capture

    def available(self):
        return True

    def stream_chat(self, messages, temperature=0.2, max_tokens=512):
        self._capture.append(messages[-1]["content"])
        yield "ANSWER-OK "
        yield "<<<INTENT_JSON>>>" + json.dumps({"intent": "none", "data": {}}) + "<<<END_INTENT_JSON>>>"


class StubEmbedder:
    """Deterministic hash-based embedder (no network, stable across runs)."""

    def embed(self, texts):
        try:
            import numpy as np
        except ImportError:
            return None
        out = []
        for t in texts:
            v = np.zeros(8, dtype=np.float32)
            for w in set(t.lower().split()):
                v[hash(w) % 8] += 1.0
            out.append(v / (np.linalg.norm(v) + 1e-8))
        return out
