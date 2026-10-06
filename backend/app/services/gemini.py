"""Bounded Gemini execution with deterministic fallback behavior."""

from __future__ import annotations

import logging
from typing import Any, Protocol

from app.core.config import settings
from app.middleware import counters

logger = logging.getLogger(__name__)
MAX_PROMPT_LENGTH = 12000
MAX_RESPONSE_LENGTH = 4000
MAX_OUTPUT_TOKENS = 600
PROVIDER_TIMEOUT_SECONDS = 10
GEMINI_MODEL = "gemini-2.0-flash"
FALLBACK_EXPLANATION = (
    "A deterministic risk explanation is available; "
    "the language service is temporarily unavailable."
)


class TextProvider(Protocol):
    """Small provider contract that keeps SDK details out of route code."""

    def generate(self, prompt: str, *, max_output_tokens: int, temperature: float) -> str:
        ...


class GeminiProvider:
    """Adapter for the maintained ``google-genai`` SDK."""

    def __init__(self, api_key: str, timeout_seconds: int = PROVIDER_TIMEOUT_SECONDS) -> None:
        from google import genai
        from google.genai import types

        self._client = genai.Client(
            api_key=api_key,
            http_options=types.HttpOptions(timeout=timeout_seconds * 1000),
        )
        self._types = types

    def generate(self, prompt: str, *, max_output_tokens: int, temperature: float) -> str:
        response = self._client.models.generate_content(
            model=GEMINI_MODEL,
            contents=prompt,
            config=self._types.GenerateContentConfig(
                max_output_tokens=max_output_tokens,
                temperature=temperature,
            ),
        )
        return (getattr(response, "text", "") or "").strip()


def _provider() -> TextProvider:
    return GeminiProvider(settings.GEMINI_API_KEY)


def generate_explanation(prompt_text: str, provider: TextProvider | None = None) -> str:
    """Execute a bounded provider call, returning a safe fallback on failure."""
    if not prompt_text or len(prompt_text) > MAX_PROMPT_LENGTH:
        logger.warning("Gemini prompt rejected due to length")
        counters.record_gemini_fallback()
        return FALLBACK_EXPLANATION
    if not settings.GEMINI_API_KEY and provider is None:
        counters.record_gemini_fallback()
        return FALLBACK_EXPLANATION

    try:
        text = (provider or _provider()).generate(
            prompt_text,
            max_output_tokens=MAX_OUTPUT_TOKENS,
            temperature=0.1,
        )
        text = (text or "").strip()
        if not text:
            counters.record_gemini_fallback()
            return FALLBACK_EXPLANATION
        return text[:MAX_RESPONSE_LENGTH]
    except Exception:
        logger.exception("Gemini explanation provider failed")
        counters.record_gemini_fallback()
        return FALLBACK_EXPLANATION

