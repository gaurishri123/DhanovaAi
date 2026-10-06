"""Regression tests for UTC and as-of graph isolation."""

import pandas as pd

from app.graph_engine import build_graph, ring_candidates, detect_communities


def test_graph_excludes_future_edges_with_mixed_timestamp_formats():
    transactions = pd.DataFrame([
        {"sender_account_id": "A", "receiver_account_id": "B", "amount": 10, "timestamp": "2026-01-01T10:00:00Z"},
        {"sender_account_id": "B", "receiver_account_id": "C", "amount": 10, "timestamp": "2026-01-02 10:00:00"},
    ])
    graph = build_graph(transactions, as_of="2026-01-01T23:59:59Z")
    assert set(graph.edges()) == {("A", "B")}


def test_candidates_use_only_visible_transactions():
    transactions = pd.DataFrame([
        {"sender_account_id": "A", "receiver_account_id": "B", "amount": 10000, "timestamp": "2026-01-01T10:00:00Z"},
        {"sender_account_id": "B", "receiver_account_id": "C", "amount": 10000, "timestamp": "2026-01-01T10:10:00Z"},
        {"sender_account_id": "C", "receiver_account_id": "A", "amount": 10000, "timestamp": "2026-01-02T10:10:00Z"},
    ])
    visible = transactions[transactions["timestamp"] <= "2026-01-01T23:59:59Z"].copy()
    graph = build_graph(visible, as_of="2026-01-01T23:59:59Z")
    candidates = ring_candidates(graph, detect_communities(graph), transactions=visible)
    assert not any(set(row) == {"A", "B", "C"} for row in candidates.get("members", []))
