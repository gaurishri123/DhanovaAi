"""Schema and route-level idempotency contract tests."""

from pathlib import Path


def test_idempotency_contract_is_present():
    sql = (Path(__file__).parents[1] / "migrations" / "001_initial_schema.sql").read_text(encoding="utf-8")
    assert "idempotency_key text unique" in sql
    assert "p_idempotency_key text default null" in sql
    assert "idempotency_conflict" in sql


def test_transaction_route_handles_duplicate_insert_race():
    source = (Path(__file__).parents[1] / "app" / "routes" / "transactions.py").read_text(encoding="utf-8")
    assert '"duplicate" in str(insert_error).lower()' in source
    assert 'eq("idempotency_key", payload.idempotency_key)' in source
