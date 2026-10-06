"""Pytest path setup for tests that import the backend ``app`` package."""

from pathlib import Path
import os
import sys


# API tests import the FastAPI app during collection. Provide harmless test
# defaults when a developer has not configured production credentials locally.
os.environ.setdefault("SUPABASE_URL", "https://example.supabase.co")
os.environ.setdefault("SUPABASE_KEY", "test-anon-key")
os.environ.setdefault("GEMINI_API_KEY", "test-gemini-key")

BACKEND_DIR = Path(__file__).resolve().parent / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))
