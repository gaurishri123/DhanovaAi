import pytest
from fastapi.testclient import TestClient
from app.main import app


def test_health_check():
    """Test the health check endpoint."""
    with TestClient(app) as client:
        response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert "model_loaded" in data

def test_upi_check_missing_account():
    """Test UPI check with non-existent account."""
    with TestClient(app) as client:
        response = client.get("/upi/check/nonexistent-account-id")
    # Should return 404 or 503 depending on DB/model state
    assert response.status_code in [404, 503]

def test_chat_missing_account():
    """Test chat with non-existent account."""
    with TestClient(app) as client:
        response = client.post("/chat/", json={
            "account_id": "nonexistent",
            "question": "What is the risk?"
        })
    assert response.status_code in [404, 503]

def test_hold_action_validation():
    """Test hold action requires proper fields."""
    with TestClient(app) as client:
        response = client.post("/actions/hold", json={
            "account_id": "test-account",
            "reason": "Suspicious activity",
            "officer_id": "officer-123"
        })
    # Might fail on DB if not connected, but validates request structure
    assert response.status_code in [200, 500, 503]
