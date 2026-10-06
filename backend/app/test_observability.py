import json
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.middleware import counters

client = TestClient(app)

def test_metrics_endpoint_unauthenticated():
    # In a full deployment this could be protected, but right now it's internal
    response = client.get("/metrics")
    assert response.status_code == 200
    data = response.json()
    assert "http_requests_total" in data
    assert "http_errors_total" in data
    assert "gemini_fallback_total" in data
    assert "scoring_requests_total" in data


def test_request_id_injected_and_returned():
    response = client.get("/health/live")
    assert response.status_code == 200
    assert "x-request-id" in response.headers
    assert response.headers["x-request-id"]

def test_request_id_propagated_when_provided():
    custom_id = "test-custom-id-1234"
    response = client.get("/health/live", headers={"X-Request-ID": custom_id})
    assert response.status_code == 200
    assert response.headers["x-request-id"] == custom_id

def test_counter_increments():
    # Take baseline
    response1 = client.get("/metrics")
    baseline = response1.json()
    initial_reqs = baseline["http_requests_total"]

    # Trigger endpoint
    client.get("/health/live")

    # Verify increment
    response2 = client.get("/metrics")
    current = response2.json()
    assert current["http_requests_total"] > initial_reqs
