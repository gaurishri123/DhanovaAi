"""
ML Integration Bridge - Clean abstraction layer between Backend and ML components.

This module is the ONLY backend code that imports ML functions directly.
All routes must call functions here instead of importing ML modules.

Responsibilities:
- Query Supabase and convert to Pandas DataFrames
- Call ML functions with correct schemas/types
- Return backend-friendly dict/JSON responses
- Handle ML errors gracefully

The ML team can change their implementation without affecting routes.
"""
import pandas as pd
from datetime import datetime, timezone
from typing import Dict, Any, Optional
import hashlib
import json
import logging
import time

from app.middleware import counters

logger = logging.getLogger(__name__)

# ========================================
# Internal helpers (not exposed to routes)
# ========================================

def _fetch_ml_dataframes() -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    """
    Internal: Fetches raw DB data and casts to ML-contract DataFrames.
    """
    from app.db.supabase import get_db
    db = get_db()

    # 1. Accounts
    acc_res = db.table('accounts').select('*').execute()
    accounts_df = pd.DataFrame(acc_res.data) if acc_res.data else pd.DataFrame(columns=[
        'account_id', 'holder_name', 'bank_name', 'account_age_days', 'kyc_level', 'status'
    ])

    # 2. Transactions
    txn_res = db.table('transactions').select('*').execute()
    transactions_df = pd.DataFrame(txn_res.data) if txn_res.data else pd.DataFrame(columns=[
        'txn_id', 'sender_account_id', 'receiver_account_id', 'amount', 'channel', 'device_id', 'timestamp'
    ])
    if not transactions_df.empty:
        transactions_df['timestamp'] = pd.to_datetime(
            transactions_df['timestamp'], utc=True
        )

    # 3. Account Devices
    devices_res = db.table('account_devices').select('*').execute()
    account_devices_df = pd.DataFrame(devices_res.data) if devices_res.data else pd.DataFrame(columns=[
        'account_id', 'device_id'
    ])

    return accounts_df, transactions_df, account_devices_df


# ========================================
# Public API (routes call these)
# ========================================

def score_account_with_explanation(
    account_id: str,
    model,  # RiskModel instance from main.py
    as_of: Optional[datetime] = None
) -> Dict[str, Any]:
    """
    Score an account and generate explanation.

    Returns:
        {
            'account_id': str,
            'score': int (0-100),
            'band': str ('low', 'medium', 'high'),
            'explanation': str (human-readable),
            'top_features': list of dicts with SHAP contributions
        }
    """
    if as_of is None:
        as_of = datetime.now(timezone.utc)

    as_of_ts = pd.Timestamp(as_of)
    if as_of_ts.tzinfo is None:
        as_of_ts = as_of_ts.tz_localize("UTC")
    else:
        as_of_ts = as_of_ts.tz_convert("UTC")

    # Fetch data
    accounts_df, transactions_df, account_devices_df = _fetch_ml_dataframes()

    if account_id not in accounts_df['account_id'].values:
        raise ValueError(f"Account {account_id} not found in database.")

    # Import ML functions (only here, not in routes)
    from app.scorer import score_accounts
    from app.services.feature_pipeline import build_scoring_features
    from app.explainer import explain, gemini_explanation_prompt
    from app.services.gemini import generate_explanation

    start_time = time.monotonic()

    # Build one point-in-time frame for both score and explanation.
    features_df = build_scoring_features(
        accounts=accounts_df,
        transactions=transactions_df,
        account_devices=account_devices_df,
        as_of=as_of_ts,
        target_account_id=account_id,
    )
    score_result = score_accounts(features_df, model).iloc[0].to_dict()

    # SHAP sees the exact ordered row used for the calibrated score.
    expl_result = explain(
        account_id,
        features_df,
        model.model,
        top_k=5,
        scored_score=int(score_result["score"]),
    )

    duration = time.monotonic() - start_time
    counters.record_scoring(duration)

    # Generate human explanation via LLM
    prompt = gemini_explanation_prompt(expl_result)
    llm_explanation = generate_explanation(prompt)

    # Return unified result
    return {
        'account_id': account_id,
        'score': score_result['score'],
        'band': score_result['band'],
        'explanation': llm_explanation,
        'top_features': expl_result['top_reasons'],
        'shap_base_value': expl_result.get('base_value'),
        'model_version': model.version,
        'as_of': as_of_ts.isoformat(),
        'computed_at': datetime.now(timezone.utc).isoformat(),
        'feature_schema_hash': hashlib.sha256(
            json.dumps(list(features_df.columns), separators=(",", ":")).encode()
        ).hexdigest(),
    }


def get_account_features(
    account_id: str,
    as_of: Optional[datetime] = None
) -> Dict[str, float]:
    """
    Get computed features for an account (for debugging/inspection).

    Returns:
        Dict mapping feature names to values
    """
    if as_of is None:
        as_of = datetime.now(timezone.utc)

    as_of_ts = pd.Timestamp(as_of)
    if as_of_ts.tzinfo is None:
        as_of_ts = as_of_ts.tz_localize("UTC")
    else:
        as_of_ts = as_of_ts.tz_convert("UTC")

    accounts_df, transactions_df, account_devices_df = _fetch_ml_dataframes()

    if account_id not in accounts_df['account_id'].values:
        raise ValueError(f"Account {account_id} not found.")

    from app.features import build_features

    features_df = build_features(transactions_df, accounts_df, account_devices_df, as_of=as_of_ts)

    if account_id not in features_df.index:
        return {}

    return features_df.loc[account_id].to_dict()
