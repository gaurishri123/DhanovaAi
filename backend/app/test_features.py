"""Small deterministic tests for the shared feature contract."""

import pandas as pd

from backend.app.features import FEATURE_COLUMNS, build_features


def _fixtures():
    tx = pd.DataFrame([
        {'txn_id': 't1', 'sender_account_id': 'A', 'receiver_account_id': 'B', 'amount': 100, 'channel': 'UPI', 'device_id': 'D1', 'timestamp': '2026-01-01 10:00'},
        {'txn_id': 't2', 'sender_account_id': 'B', 'receiver_account_id': 'C', 'amount': 80, 'channel': 'UPI', 'device_id': 'D1', 'timestamp': '2026-01-01 10:05'},
        {'txn_id': 't3', 'sender_account_id': 'X', 'receiver_account_id': 'B', 'amount': 50, 'channel': 'UPI', 'device_id': 'D2', 'timestamp': '2026-01-01 10:10'},
        {'txn_id': 't4', 'sender_account_id': 'B', 'receiver_account_id': 'C', 'amount': 9500, 'channel': 'UPI', 'device_id': 'D1', 'timestamp': '2026-01-01 10:20'},
    ])
    tx['timestamp'] = pd.to_datetime(tx['timestamp'])
    accounts = pd.DataFrame([
        {'account_id': 'A', 'account_age_days': 100},
        {'account_id': 'B', 'account_age_days': 20},
        {'account_id': 'C', 'account_age_days': 200},
        {'account_id': 'Z', 'account_age_days': 1},
    ])
    account_devices = pd.DataFrame([
        {'account_id': 'A', 'device_id': 'D1'},
        {'account_id': 'B', 'device_id': 'D1'},
        {'account_id': 'C', 'device_id': 'D2'},
        {'account_id': 'Z', 'device_id': 'D3'},
    ])
    return tx, accounts, account_devices


def test_behavior_features_and_order():
    tx, accounts, devices = _fixtures()
    features = build_features(tx, accounts, devices)
    assert list(features.columns) == FEATURE_COLUMNS
    assert features.loc['B', 'in_count'] == 2
    assert features.loc['B', 'out_count'] == 2
    assert features.loc['B', 'fan_in'] == 2
    assert features.loc['B', 'fan_out'] == 1
    assert features.loc['Z', 'in_count'] == 0
    assert features.loc['B', 'near_threshold_ratio'] > 0


def test_as_of_cutoff_excludes_future_transactions():
    tx, accounts, devices = _fixtures()
    features = build_features(tx, accounts, devices, as_of=pd.Timestamp('2026-01-01 10:06'))
    assert features.loc['B', 'in_count'] == 1
    assert features.loc['B', 'out_count'] == 1
    assert features.loc['B', 'near_threshold_ratio'] == 0


def test_empty_as_of_returns_zero_rows_for_all_accounts():
    tx, accounts, devices = _fixtures()
    features = build_features(tx, accounts, devices, as_of=pd.Timestamp('2025-12-31'))
    assert list(features.index) == ['A', 'B', 'C', 'Z']
    assert (features == 0).all().all()
