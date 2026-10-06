"""Shared point-in-time feature assembly for scoring and explanations."""

from __future__ import annotations

from datetime import datetime
from typing import Optional

import pandas as pd

from app.features import FEATURE_COLUMNS, build_features
from app.graph_engine import (
    build_graph,
    detect_communities,
    find_short_cycles,
    graph_features,
    ring_candidates,
)


def _utc_timestamp(value: Optional[datetime | pd.Timestamp]) -> pd.Timestamp:
    timestamp = pd.Timestamp.now(tz="UTC") if value is None else pd.Timestamp(value)
    if timestamp.tzinfo is None:
        return timestamp.tz_localize("UTC")
    return timestamp.tz_convert("UTC")


def _normalize_transactions(
    transactions: pd.DataFrame,
    as_of: pd.Timestamp,
) -> pd.DataFrame:
    normalized = transactions.copy()
    if "timestamp" not in normalized.columns:
        raise ValueError("Transactions must include a timestamp column")
    normalized["timestamp"] = pd.to_datetime(normalized["timestamp"], utc=True)
    return normalized[normalized["timestamp"] <= as_of].copy()


def build_scoring_features(
    accounts: pd.DataFrame,
    transactions: pd.DataFrame,
    account_devices: pd.DataFrame,
    as_of: Optional[datetime | pd.Timestamp] = None,
    target_account_id: Optional[str] = None,
) -> pd.DataFrame:
    """Build the exact feature frame used by both scoring and explanations.

    Every graph and behavior statistic is computed from transactions visible at
    ``as_of``. The returned columns always match ``FEATURE_COLUMNS`` exactly.
    """
    as_of_ts = _utc_timestamp(as_of)
    tx = _normalize_transactions(transactions, as_of_ts)

    graph = build_graph(tx, as_of=as_of_ts)
    communities = detect_communities(graph, seed=42)
    candidates = ring_candidates(
        graph,
        communities,
        transactions=tx,
        account_devices=account_devices,
    )

    suspicious_nodes: set[str] = set()
    if not candidates.empty:
        for members in candidates.head(50)["members"]:
            suspicious_nodes.update(members)
    cycles = find_short_cycles(graph, sorted(suspicious_nodes)[:200], max_len=4)
    graph_frame = graph_features(graph, communities, cycles)

    features = build_features(
        tx,
        accounts,
        account_devices,
        as_of=as_of_ts,
        graph_features=graph_frame,
    )
    features = features.reindex(columns=FEATURE_COLUMNS, fill_value=0).fillna(0.0)

    if target_account_id is not None:
        if target_account_id not in features.index:
            raise ValueError(f"Account {target_account_id} not found in feature set")
        return features.loc[[target_account_id]]
    return features
