"""Tests for ring metric edge cases and schema."""

import pandas as pd

from app.graph_engine import evaluate_rings


def test_empty_ring_evaluation_has_complete_metric_schema():
    labels = pd.DataFrame([
        {"account_id": "A", "is_mule": True, "ring_id": "R1", "ring_archetype": "fan_out"},
    ])
    metrics = evaluate_rings(pd.DataFrame(), labels)
    assert metrics["candidate_sources"] == {}
    assert metrics["per_archetype"]["fan_out"]["precision"] == 0.0
    assert metrics["per_archetype"]["fan_out"]["f1"] == 0.0
