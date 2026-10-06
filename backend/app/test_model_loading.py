"""
Tests for model artifact loading and readiness checks.
"""

import pytest
from fastapi.testclient import TestClient
from pathlib import Path
import json
import tempfile
import shutil
from unittest.mock import patch

from app.main import app
from app.features import FEATURE_COLUMNS


def test_liveness_always_ok():
    """Liveness probe should always return 200."""
    with TestClient(app) as client:
        response = client.get("/health/live")
        assert response.status_code == 200
        assert response.json()["status"] == "ok"


def test_readiness_with_injected_model():
    """Readiness reports metadata when a validated model is present."""
    from app.main import readiness_check

    sentinel = object()
    app.state.model = sentinel
    app.state.model_version = "test"
    app.state.model_error = None
    try:
        response = readiness_check()
        assert response["status"] == "ready"
        assert response["model_version"] == "test"
        assert response["feature_count"] == len(FEATURE_COLUMNS)
    finally:
        app.state.model = None
        app.state.model_version = None


def test_readiness_without_model_returns_503():
    """Readiness fails closed when artifacts are unavailable."""
    from app.main import readiness_check
    from fastapi import HTTPException

    app.state.model = None
    app.state.model_error = "missing test artifacts"
    with pytest.raises(HTTPException) as error:
        readiness_check()
    assert error.value.status_code == 503


def test_legacy_health_endpoint():
    """Legacy /health endpoint should report model_loaded status."""
    with TestClient(app) as client:
        response = client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert "status" in data
        assert "model_loaded" in data
        assert isinstance(data["model_loaded"], bool)


def test_upi_check_requires_model():
    """UPI check should return 503 if model not loaded."""
    with TestClient(app) as client:
        # If model is not loaded, should get 503
        response = client.get("/upi/check/test-account-123")
        # Either 503 (no model), 404 (model loaded but account not found),
        # or 500/503 (DB not connected)
        assert response.status_code in [404, 500, 503]


def test_feature_column_validation():
    """Verify FEATURE_COLUMNS constant has expected structure."""
    assert len(FEATURE_COLUMNS) == 22
    assert "in_count" in FEATURE_COLUMNS
    assert "out_count" in FEATURE_COLUMNS
    assert "pagerank" in FEATURE_COLUMNS
    assert "in_short_cycle" in FEATURE_COLUMNS


@pytest.mark.skipif(
    not Path("models/risk_model.joblib").exists(),
    reason="Model artifacts not available"
)
def test_model_artifacts_exist():
    """Verify all required model artifacts are present."""
    model_dir = Path("models")
    required_files = [
        "risk_model.joblib",
        "calibrator.joblib",
        "feature_columns.json",
        "model_version.txt"
    ]

    for file in required_files:
        assert (model_dir / file).exists(), f"Missing {file}"

    # Verify feature_columns.json matches canonical list
    with open(model_dir / "feature_columns.json") as f:
        saved_features = json.load(f)

    assert saved_features == FEATURE_COLUMNS, "Feature column mismatch"


def test_get_model_dependency():
    """Test that get_model dependency raises 503 when model unavailable."""
    from app.dependencies import get_model

    from starlette.requests import Request

    # Create a test client that goes through lifespan
    with TestClient(app):
        request = Request({"type": "http", "app": app})
        try:
            model = get_model(request)
            # If we get here, model is loaded
            assert model is not None
            assert hasattr(model, 'predict_proba')
        except Exception as e:
            # Should be HTTPException with 503
            assert hasattr(e, 'status_code')
            assert e.status_code == 503
