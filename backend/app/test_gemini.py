"""Provider adapter tests that never call the Gemini service."""

from unittest.mock import patch

from app.services.gemini import (
    FALLBACK_EXPLANATION,
    MAX_RESPONSE_LENGTH,
    generate_explanation,
)


class FakeProvider:
    def __init__(self, text: str = "safe answer", error: Exception | None = None):
        self.text = text
        self.error = error
        self.calls = []

    def generate(self, prompt, *, max_output_tokens, temperature):
        self.calls.append((prompt, max_output_tokens, temperature))
        if self.error:
            raise self.error
        return self.text


def test_provider_success_is_bounded_and_configured():
    provider = FakeProvider("answer")
    assert generate_explanation("question", provider=provider) == "answer"
    assert provider.calls == [("question", 600, 0.1)]


def test_provider_failure_returns_fallback():
    provider = FakeProvider(error=TimeoutError("timed out"))
    assert generate_explanation("question", provider=provider) == FALLBACK_EXPLANATION


def test_empty_provider_response_returns_fallback():
    assert generate_explanation("question", provider=FakeProvider("   ")) == FALLBACK_EXPLANATION


def test_response_is_truncated():
    result = generate_explanation("question", provider=FakeProvider("x" * 5000))
    assert len(result) == MAX_RESPONSE_LENGTH


def test_invalid_prompt_and_missing_key_do_not_call_provider():
    provider = FakeProvider("unexpected")
    assert generate_explanation("x" * 12001, provider=provider) == FALLBACK_EXPLANATION
    with patch("app.services.gemini.settings.GEMINI_API_KEY", ""):
        assert generate_explanation("question") == FALLBACK_EXPLANATION
