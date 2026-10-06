"""Small deterministic tests for ML training contracts."""

import pandas as pd
import pytest

from app.features import FEATURE_COLUMNS, build_features


def test_as_of_snapshot_ignores_future_transactions():
    accounts = pd.DataFrame([{
        "account_id": "A", "account_age_days": 1,
        "holder_name": "A", "bank_name": "B", "kyc_level": "full", "status": "clear",
    }])
    tx = pd.DataFrame([
        {"txn_id": "before", "sender_account_id": "A", "receiver_account_id": "B", "amount": 10, "channel": "upi", "device_id": None, "timestamp": "2026-01-01T00:00:00Z"},
        {"txn_id": "after", "sender_account_id": "A", "receiver_account_id": "B", "amount": 10, "channel": "upi", "device_id": None, "timestamp": "2026-01-03T00:00:00Z"},
    ])
    tx["timestamp"] = pd.to_datetime(tx["timestamp"], utc=True)
    empty_devices = pd.DataFrame(columns=["account_id", "device_id"])
    early = build_features(tx, accounts, empty_devices, as_of="2026-01-02T00:00:00Z")
    late = build_features(tx, accounts, empty_devices, as_of="2026-01-04T00:00:00Z")
    assert list(early.columns) == FEATURE_COLUMNS
    assert early.loc["A", "out_count"] < late.loc["A", "out_count"]
