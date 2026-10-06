# Dhanova ML Handoff

## Scope

The ML package owns synthetic data generation, shared feature engineering, graph analysis, risk scoring, and SHAP/template explanations. The dataset is synthetic and all reported metrics must be described as validation results on generated data, not real-world accuracy.

## Backend contracts

### Features

```python
build_features(
    transactions,
    accounts,
    account_devices,
    as_of=None,
    graph_features=None,
) -> pandas.DataFrame
```

The returned DataFrame is indexed by `account_id` and contains the ordered `FEATURE_COLUMNS` list from `backend/app/features.py`. Training and serving must call this same function.

### Scoring

```python
model = RiskModel.load('models')
score_accounts(features_df, model)
score_account(account_id, as_of, transactions, accounts, account_devices, model)
```

Scores are integers from 0 to 100. Bands are low (0–40), medium (40–70), and high (70–100). The model artifact and feature metadata are loaded from `models/`.

### Explanations

```python
explain(account_id, features, model.model, top_k=5)
```

The output contains the account ID, score, SHAP-ranked reasons, direction, contribution, base value, and a template explanation. The template is the safe fallback when Gemini is unavailable.

`gemini_explanation_prompt(payload)` accepts only the structured SHAP payload. The backend owns the actual Gemini API call, credentials, rate limiting, and audit logging. Never send raw transaction data or labels to the LLM.

## Recommended serving architecture

1. Ingest transactions in timestamp order.
2. Store raw transactions and account/device mappings in Supabase.
3. Batch-compute `account_features` using `features.py`.
4. Recompute only changed accounts and their graph neighbors after new activity.
5. Run `score_accounts` and persist `risk_scores` with `computed_at`, model version, top reasons, and ring ID.
6. Expose account detail and ring endpoints to the frontend.

For a demo replay, process transactions in timestamp order and rescore after each batch of N events. Record the batch timestamp and model version so results are reproducible.

## Ring detection

`graph_engine.py` combines seeded Louvain features with temporal hub, cycle, and shared-device candidate generation. Ring-level metrics are separate from account-level classifier metrics. Report precision, recall, detected count, and per-archetype recall together.

## Operational requirements

- Keep labels in a separate table and never pass them into features.
- Pin model feature order with `feature_columns.json`.
- Reject missing feature columns before serving.
- Keep a model version and training seed in every score batch.
- Log scoring latency; the target for a precomputed single-account row is under 200 ms.
- Do not claim synthetic validation represents production accuracy.

## Integration sequence

1. Backend loads the model during application startup.
2. Backend validates the model feature metadata.
3. Backend adds ingest and batch-score jobs.
4. Backend persists scores and explanations.
5. Frontend consumes scores, explanations, and ring members.
6. Officers approve hold/release actions; the ML package does not directly place holds.
