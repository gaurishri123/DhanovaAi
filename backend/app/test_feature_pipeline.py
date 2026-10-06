"""Tests for shared point-in-time serving feature assembly."""

import pandas as pd

from app.features import FEATURE_COLUMNS
from app.services.feature_pipeline import build_scoring_features


def _accounts():
    return pd.DataFrame([
        {"account_id": "A", "holder_name": "A", "bank_name": "B", "account_age_days": 100, "kyc_level": "full", "status": "clear"},
        {"account_id": "B", "holder_name": "B", "bank_name": "B", "account_age_days": 100, "kyc_level": "full", "status": "clear"},
        {"account_id": "C", "holder_name": "C", "bank_name": "B", "account_age_days": 100, "kyc_level": "full", "status": "clear"},
    ])


def _transactions():
    return pd.DataFrame([
        {"txn_id": "t1", "sender_account_id": "A", "receiver_account_id": "B", "amount": 10000, "channel": "upi", "device_id": "d1", "timestamp": "2026-01-01T10:00:00Z"},
        {"txn_id": "t2", "sender_account_id": "B", "receiver_account_id": "C", "amount": 10000, "channel": "upi", "device_id": "d1", "timestamp": "2026-01-01T10:10:00Z"},
        {"txn_id": "t3", "sender_account_id": "C", "receiver_account_id": "A", "amount": 10000, "channel": "upi", "device_id": "d1", "timestamp": "2026-01-01T10:20:00Z"},
        {"txn_id": "future", "sender_account_id": "A", "receiver_account_id": "C", "amount": 500000, "channel": "upi", "device_id": "d1", "timestamp": "2026-01-02T10:00:00Z"},
    ])


def test_pipeline_uses_canonical_columns_and_cycle_features():
    features = build_scoring_features(
        _accounts(),
        _transactions(),
        pd.DataFrame([{"account_id": account, "device_id": "d1"} for account in ["A", "B", "C"]]),
        as_of="2026-01-01T23:59:59Z",
    )
    assert list(features.columns) == FEATURE_COLUMNS
    assert (features["in_short_cycle"] > 0).all()


def test_pipeline_excludes_future_transactions():
    before = build_scoring_features(
        _accounts(), _transactions(), pd.DataFrame(columns=["account_id", "device_id"]),
        as_of="2026-01-01T23:59:59Z",
        target_account_id="A",
    )
    after = build_scoring_features(
        _accounts(), _transactions(), pd.DataFrame(columns=["account_id", "device_id"]),
        as_of="2026-01-02T23:59:59Z",
        target_account_id="A",
    )
    assert before.loc["A", "out_count"] < after.loc["A", "out_count"]
