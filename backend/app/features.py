"""
Feature engineering for Dhanova fraud detection.
All features are "as-of" — computed only from data up to a given timestamp.
"""

import pandas as pd
import numpy as np
from typing import Optional
from datetime import datetime, timedelta

# Canonical feature list — MUST match training and serving
FEATURE_COLUMNS = [
    # Behavior features
    'in_count', 'out_count', 'fan_in', 'fan_out',
    'pass_through_ratio', 'median_dwell_minutes', 'max_txn_10min',
    'amount_cv', 'new_counterparty_ratio', 'night_txn_ratio',
    'near_threshold_ratio', 'account_age_days', 'device_count',
    'max_accounts_per_device',
    # Graph features (added after graph_engine is built)
    'in_degree', 'out_degree', 'pagerank', 'clustering_coef',
    'community_size', 'community_internal_flow_ratio', 'community_density',
    'in_short_cycle',
]


def build_features(
    transactions: pd.DataFrame,
    accounts: pd.DataFrame,
    account_devices: pd.DataFrame,
    as_of: Optional[datetime] = None,
    graph_features: Optional[pd.DataFrame] = None,
) -> pd.DataFrame:
    """
    Build features for all accounts using only data up to as_of timestamp.

    Args:
        transactions: DataFrame with columns [txn_id, sender_account_id,
                      receiver_account_id, amount, channel, device_id, timestamp]
        accounts: DataFrame with columns [account_id, account_age_days, ...]
        account_devices: DataFrame with columns [account_id, device_id]
        as_of: Cutoff timestamp (None = use all data)
        graph_features: Optional pre-computed graph features (from graph_engine)

    Returns:
        DataFrame indexed by account_id with FEATURE_COLUMNS
    """

    # Normalize timestamps before applying the point-in-time cutoff. This keeps
    # naive database exports and aware API timestamps comparable in UTC.
    tx = transactions.copy()
    tx['timestamp'] = pd.to_datetime(tx['timestamp'], utc=True)
    if as_of is not None:
        cutoff = pd.Timestamp(as_of)
        cutoff = cutoff.tz_localize('UTC') if cutoff.tzinfo is None else cutoff.tz_convert('UTC')
        tx = tx[tx['timestamp'] <= cutoff].copy()

    # Get all account IDs before any early return so dormant accounts remain
    # scoreable for an as-of cutoff with no observed activity.
    all_accounts = accounts['account_id'].unique()
    if len(tx) == 0:
        return pd.DataFrame(0.0, index=pd.Index(all_accounts, name='account_id'), columns=FEATURE_COLUMNS)

    # Get all account IDs
    all_accounts = accounts['account_id'].unique()

    # === Behavior Features ===

    # In/out transaction counts
    in_counts = tx.groupby('receiver_account_id').size().rename('in_count')
    out_counts = tx.groupby('sender_account_id').size().rename('out_count')

    # Fan-in / fan-out (unique counterparties)
    fan_in = tx.groupby('receiver_account_id')['sender_account_id'].nunique().rename('fan_in')
    fan_out = tx.groupby('sender_account_id')['receiver_account_id'].nunique().rename('fan_out')

    # Amounts
    in_amounts = tx.groupby('receiver_account_id')['amount'].sum().rename('in_amount')
    out_amounts = tx.groupby('sender_account_id')['amount'].sum().rename('out_amount')

    # Pass-through ratio (out_amount / in_amount)
    pass_through = pd.DataFrame({
        'in_amount': in_amounts,
        'out_amount': out_amounts,
    }).fillna(0)
    pass_through['pass_through_ratio'] = np.where(
        pass_through['in_amount'] > 0,
        pass_through['out_amount'] / pass_through['in_amount'],
        0
    )

    # Median dwell time (time between receiving and next send)
    tx_sorted = tx.sort_values('timestamp')
    in_tx = tx_sorted[['receiver_account_id', 'timestamp']].rename(
        columns={'receiver_account_id': 'account_id', 'timestamp': 'in_time'}
    )
    out_tx = tx_sorted[['sender_account_id', 'timestamp']].rename(
        columns={'sender_account_id': 'account_id', 'timestamp': 'out_time'}
    )

    # Merge on account to find dwell times
    dwell_list = []
    for acc_id in all_accounts:
        acc_in = in_tx[in_tx['account_id'] == acc_id]['in_time'].values
        acc_out = out_tx[out_tx['account_id'] == acc_id]['out_time'].values

        if len(acc_in) > 0 and len(acc_out) > 0:
            dwells = []
            for in_time in acc_in:
                # Find next out_time after this in_time
                later_outs = acc_out[acc_out > in_time]
                if len(later_outs) > 0:
                    dwell_minutes = (later_outs[0] - in_time) / np.timedelta64(1, 'm')
                    dwells.append(dwell_minutes)

            if dwells:
                dwell_list.append({
                    'account_id': acc_id,
                    'median_dwell_minutes': np.median(dwells)
                })

    if dwell_list:
        median_dwell = pd.DataFrame(dwell_list).set_index('account_id')['median_dwell_minutes']
    else:
        median_dwell = pd.Series(dtype=float, name='median_dwell_minutes')

    # Max transactions in any 10-minute window
    tx['timestamp_10min'] = tx['timestamp'].dt.floor('10min')

    max_txn_10min_in = tx.groupby(['receiver_account_id', 'timestamp_10min']).size()\
        .groupby('receiver_account_id').max().rename('max_txn_10min_in')
    max_txn_10min_out = tx.groupby(['sender_account_id', 'timestamp_10min']).size()\
        .groupby('sender_account_id').max().rename('max_txn_10min_out')

    max_txn_10min = pd.DataFrame({
        'in': max_txn_10min_in,
        'out': max_txn_10min_out,
    }).fillna(0).max(axis=1).rename('max_txn_10min')

    # Amount coefficient of variation
    amount_cv_in = tx.groupby('receiver_account_id')['amount'].agg(
        lambda x: x.std() / x.mean() if x.mean() > 0 else 0
    ).rename('amount_cv_in')
    amount_cv_out = tx.groupby('sender_account_id')['amount'].agg(
        lambda x: x.std() / x.mean() if x.mean() > 0 else 0
    ).rename('amount_cv_out')

    amount_cv = pd.DataFrame({
        'in': amount_cv_in,
        'out': amount_cv_out,
    }).fillna(0).mean(axis=1).rename('amount_cv')

    # New counterparty ratio (first-time senders/receivers)
    def new_counterparty_ratio_calc(group, acc_col, counterparty_col):
        group = group.sort_values('timestamp')
        seen = set()
        new_count = 0
        for cp in group[counterparty_col]:
            if cp not in seen:
                new_count += 1
                seen.add(cp)
        return new_count / len(group) if len(group) > 0 else 0

    new_cp_in = tx.groupby('receiver_account_id').apply(
        lambda g: new_counterparty_ratio_calc(g, 'receiver_account_id', 'sender_account_id')
    ).rename('new_counterparty_ratio_in')

    new_cp_out = tx.groupby('sender_account_id').apply(
        lambda g: new_counterparty_ratio_calc(g, 'sender_account_id', 'receiver_account_id')
    ).rename('new_counterparty_ratio_out')

    new_cp_ratio = pd.DataFrame({
        'in': new_cp_in,
        'out': new_cp_out,
    }).fillna(0).mean(axis=1).rename('new_counterparty_ratio')

    # Night transaction ratio (12am-5am)
    tx['hour'] = tx['timestamp'].dt.hour
    tx['is_night'] = (tx['hour'] >= 0) & (tx['hour'] < 5)

    night_in = tx.groupby('receiver_account_id')['is_night'].mean().rename('night_txn_ratio_in')
    night_out = tx.groupby('sender_account_id')['is_night'].mean().rename('night_txn_ratio_out')

    night_ratio = pd.DataFrame({
        'in': night_in,
        'out': night_out,
    }).fillna(0).mean(axis=1).rename('night_txn_ratio')

    # Near-threshold ratio (₹9000-9999, structuring detection)
    tx['near_threshold'] = (tx['amount'] >= 9000) & (tx['amount'] <= 9999)

    near_thresh_in = tx.groupby('receiver_account_id')['near_threshold'].mean().rename('near_thresh_in')
    near_thresh_out = tx.groupby('sender_account_id')['near_threshold'].mean().rename('near_thresh_out')

    near_threshold_ratio = pd.DataFrame({
        'in': near_thresh_in,
        'out': near_thresh_out,
    }).fillna(0).mean(axis=1).rename('near_threshold_ratio')

    # Account age
    account_age = accounts.set_index('account_id')['account_age_days']

    # Device features
    device_count = account_devices.groupby('account_id')['device_id'].nunique().rename('device_count')

    # Max accounts per device (device sharing)
    accounts_per_device = account_devices.groupby('device_id')['account_id'].nunique()
    max_accounts_per_device = account_devices.set_index('account_id')['device_id'].map(
        accounts_per_device
    ).groupby('account_id').max().rename('max_accounts_per_device')

    # === Combine all behavior features ===
    behavior_features = pd.DataFrame(index=all_accounts)
    behavior_features['in_count'] = in_counts
    behavior_features['out_count'] = out_counts
    behavior_features['fan_in'] = fan_in
    behavior_features['fan_out'] = fan_out
    behavior_features['pass_through_ratio'] = pass_through['pass_through_ratio']
    behavior_features['median_dwell_minutes'] = median_dwell
    behavior_features['max_txn_10min'] = max_txn_10min
    behavior_features['amount_cv'] = amount_cv
    behavior_features['new_counterparty_ratio'] = new_cp_ratio
    behavior_features['night_txn_ratio'] = night_ratio
    behavior_features['near_threshold_ratio'] = near_threshold_ratio
    behavior_features['account_age_days'] = account_age
    behavior_features['device_count'] = device_count
    behavior_features['max_accounts_per_device'] = max_accounts_per_device

    # Fill NaN with 0 for accounts with no transactions
    behavior_features = behavior_features.fillna(0)

    # === Add graph features if provided ===
    if graph_features is not None:
        for col in ['in_degree', 'out_degree', 'pagerank', 'clustering_coef',
                    'community_size', 'community_internal_flow_ratio',
                    'community_density', 'in_short_cycle']:
            if col in graph_features.columns:
                behavior_features[col] = graph_features[col].reindex(behavior_features.index).fillna(0)
            else:
                behavior_features[col] = 0
    else:
        # Initialize graph features with 0
        for col in ['in_degree', 'out_degree', 'pagerank', 'clustering_coef',
                    'community_size', 'community_internal_flow_ratio',
                    'community_density', 'in_short_cycle']:
            behavior_features[col] = 0

    # Ensure column order matches FEATURE_COLUMNS
    features_final = behavior_features[FEATURE_COLUMNS].copy()

    return features_final


if __name__ == '__main__':
    # Test with generated data
    import os

    if os.path.exists('data/transactions.parquet'):
        print("Testing feature engineering...")

        tx = pd.read_parquet('data/transactions.parquet')
        accounts = pd.read_parquet('data/accounts.parquet')
        account_devices = pd.read_parquet('data/account_devices.parquet')

        features = build_features(tx, accounts, account_devices)

        print(f"\n✓ Features built: {features.shape}")
        print(f"  Columns: {list(features.columns)}")
        print(f"\nSample (first 5 accounts):")
        print(features.head())
        print(f"\nFeature statistics:")
        print(features.describe())
    else:
        print("Run data_gen.py first to generate test data")
