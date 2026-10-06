"""Tests for graph construction, candidate detection, and ring evaluation."""

import pandas as pd

from backend.app.graph_engine import (
    build_graph,
    detect_communities,
    evaluate_rings,
    find_short_cycles,
    graph_features,
    ring_candidates,
)


def _transactions(rows):
    return pd.DataFrame(rows, columns=[
        'txn_id', 'sender_account_id', 'receiver_account_id', 'amount', 'timestamp'
    ]).assign(timestamp=lambda frame: pd.to_datetime(frame['timestamp']))


def test_build_graph_aggregates_edges():
    tx = _transactions([
        ('t1', 'A', 'B', 10, '2026-01-01 10:00'),
        ('t2', 'A', 'B', 20, '2026-01-01 10:05'),
    ])
    graph = build_graph(tx)
    assert graph['A']['B']['weight'] == 30
    assert graph['A']['B']['count'] == 2


def test_cycle_and_graph_features():
    tx = _transactions([
        ('t1', 'A', 'B', 100, '2026-01-01 10:00'),
        ('t2', 'B', 'C', 90, '2026-01-01 10:20'),
        ('t3', 'C', 'A', 80, '2026-01-01 10:40'),
    ])
    graph = build_graph(tx)
    cycles = find_short_cycles(graph, ['A', 'B', 'C'], max_len=4)
    features = graph_features(graph, detect_communities(graph), cycles)
    assert cycles
    assert features.loc['A', 'in_short_cycle'] == 1


def test_temporal_candidate_matches_ring():
    tx = _transactions([
        ('t1', 'A', 'B', 10000, '2026-01-01 10:00'),
        ('t2', 'B', 'C', 10000, '2026-01-01 10:10'),
        ('t3', 'C', 'A', 10000, '2026-01-01 10:20'),
        ('t4', 'X', 'Y', 20, '2026-01-01 10:00'),
    ])
    graph = build_graph(tx)
    rings = ring_candidates(graph, detect_communities(graph), transactions=tx)
    assert any(set(members) == {'A', 'B', 'C'} for members in rings['members'])

    labels = pd.DataFrame([
        {'account_id': 'A', 'is_mule': True, 'ring_id': 'R1', 'ring_archetype': 'circular_layering'},
        {'account_id': 'B', 'is_mule': True, 'ring_id': 'R1', 'ring_archetype': 'circular_layering'},
        {'account_id': 'C', 'is_mule': True, 'ring_id': 'R1', 'ring_archetype': 'circular_layering'},
        {'account_id': 'X', 'is_mule': False, 'ring_id': None, 'ring_archetype': None},
        {'account_id': 'Y', 'is_mule': False, 'ring_id': None, 'ring_archetype': None},
    ])
    metrics = evaluate_rings(rings, labels)
    assert metrics['ring_recall'] == 1.0
    assert metrics['true_positive_count'] == 1
