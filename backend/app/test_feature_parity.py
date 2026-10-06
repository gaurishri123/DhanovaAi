import pandas as pd
import pytest
from datetime import datetime, timezone
import numpy as np
from app.services.feature_pipeline import build_scoring_features

def test_feature_parity():
    # Setup mock data
    accounts = pd.DataFrame({'account_id': ['A1', 'A2', 'A3'], 'account_age_days': [10, 20, 30]})
    transactions = pd.DataFrame({
        'txn_id': [1, 2, 3],
        'sender_account_id': ['A1', 'A2', 'A1'],
        'receiver_account_id': ['A2', 'A3', 'A3'],
        'amount': [1000, 2000, 500],
        'channel': ['upi', 'upi', 'upi'],
        'device_id': ['D1', 'D1', 'D2'],
        'timestamp': [
            datetime(2026, 9, 20, tzinfo=timezone.utc),
            datetime(2026, 9, 21, tzinfo=timezone.utc),
            datetime(2026, 9, 22, tzinfo=timezone.utc),
        ]
    })
    account_devices = pd.DataFrame({'account_id': ['A1', 'A2', 'A3'], 'device_id': ['D1', 'D1', 'D2']})

    as_of = datetime(2026, 9, 25, tzinfo=timezone.utc)

    # Build features for scoring
    features = build_scoring_features(accounts, transactions, account_devices, as_of=as_of)

    assert features.shape[0] == 3
    assert 'in_short_cycle' in features.columns
    assert features.loc['A1', 'out_count'] == 2
    assert features.loc['A2', 'in_count'] == 1
    assert features.loc['A3', 'in_count'] == 2

def test_future_transactions_excluded():
    accounts = pd.DataFrame({'account_id': ['A1', 'A2'], 'account_age_days': [10, 20]})
    transactions = pd.DataFrame({
        'txn_id': [1, 2],
        'sender_account_id': ['A1', 'A1'],
        'receiver_account_id': ['A2', 'A2'],
        'amount': [1000, 2000],
        'channel': ['upi', 'upi'],
        'device_id': ['D1', 'D1'],
        'timestamp': [
            datetime(2026, 9, 20, tzinfo=timezone.utc),
            datetime(2026, 9, 30, tzinfo=timezone.utc),
        ]
    })
    account_devices = pd.DataFrame({'account_id': ['A1', 'A2'], 'device_id': ['D1', 'D2']})

    as_of = datetime(2026, 9, 21, tzinfo=timezone.utc)

    # Build features
    features = build_scoring_features(accounts, transactions, account_devices, as_of=as_of)

    # A1 should only have the first transaction
    assert features.loc['A1', 'out_count'] == 1

    as_of_future = datetime(2026, 10, 1, tzinfo=timezone.utc)
    features_future = build_scoring_features(accounts, transactions, account_devices, as_of=as_of_future)
    assert features_future.loc['A1', 'out_count'] == 2

def test_in_short_cycle():
    # Construct a cycle A->B->C->A
    accounts = pd.DataFrame({'account_id': ['A1', 'A2', 'A3'], 'account_age_days': [10, 10, 10]})
    transactions = pd.DataFrame({
        'txn_id': [1, 2, 3],
        'sender_account_id': ['A1', 'A2', 'A3'],
        'receiver_account_id': ['A2', 'A3', 'A1'],
        'amount': [10000, 10000, 10000],
        'channel': ['upi', 'upi', 'upi'],
        'device_id': ['D1', 'D1', 'D1'],
        'timestamp': [
            datetime(2026, 9, 20, tzinfo=timezone.utc),
            datetime(2026, 9, 20, tzinfo=timezone.utc),
            datetime(2026, 9, 20, tzinfo=timezone.utc),
        ]
    })
    account_devices = pd.DataFrame({'account_id': ['A1', 'A2', 'A3'], 'device_id': ['D1', 'D1', 'D1']})

    as_of = datetime(2026, 9, 25, tzinfo=timezone.utc)

    features = build_scoring_features(accounts, transactions, account_devices, as_of=as_of)
    assert features.loc['A1', 'in_short_cycle'] == 1
    assert features.loc['A2', 'in_short_cycle'] == 1
    assert features.loc['A3', 'in_short_cycle'] == 1
