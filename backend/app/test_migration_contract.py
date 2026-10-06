"""Static migration contract checks that do not require a live database."""

from pathlib import Path


MIGRATION = Path(__file__).parents[1] / "migrations" / "001_initial_schema.sql"


def test_schema_contains_required_tables_and_constraints():
    sql = MIGRATION.read_text(encoding="utf-8").lower()
    for table in (
        "accounts",
        "devices",
        "account_devices",
        "transactions",
        "fraud_rings",
        "risk_scores",
        "graph_jobs",
        "hold_actions",
    ):
        assert f"create table if not exists public.{table}" in sql
    assert "check (sender_account_id <> receiver_account_id)" in sql
    assert "idempotency_key text unique" in sql
    assert "one_active_hold_per_account" in sql


def test_schema_contains_atomic_hold_rpc_contracts():
    sql = MIGRATION.read_text(encoding="utf-8").lower()
    for function_name in (
        "place_hold_atomic",
        "release_hold_atomic",
        "expire_hold_atomic",
        "claim_graph_job",
        "complete_graph_job",
        "fail_graph_job",
    ):
        assert f"function public.{function_name}" in sql
    assert "security definer" in sql
