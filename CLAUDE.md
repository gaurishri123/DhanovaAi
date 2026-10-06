# Dhanova — Project Context

**Hackathon:** MPOnline Idea & Innovation Hackathon 2026, Theme 5 — AI Innovation for Public Services

**What:** Graph-based AI system detecting mule accounts and fraud rings in India's digital payment network. Explainable risk scores + RBI 2026-compliant hold/release workflow.

## ML <-> Backend Integration Contracts (PRD Addenda)
- **Model State**: The FastAPI backend is responsible for gracefully loading and persisting the `RiskModel` (`.joblib` files) in memory upon application startup via `RiskModel.load('models')`.
- **Data Handoff Format**: All database queries must be cast to Pandas DataFrames explicitly matching the schemas/columns defined by ML (`['account_id', ...]`, `['txn_id', ...]`, `['account_id', 'device_id']`) before passing to `score_account` or `build_features`.
- **Temporal Bounds**: The backend must track and pass `as_of` timestamps to all ML functions for point-in-time accuracy to prevent future data leakage.
- **LLM Prompting Responsibility**: The ML layer owns the creation of the exact explanation prompt text (via `gemini_explanation_prompt` and SHAP). The Backend layer owns securely executing this string against the Gemini API and handling network failures.
- **Performance**: Due to the scaling limitations of `networkx` graph computation, the backend will enqueue graph feature calculations asynchronously (or batch them) rather than blocking real-time transaction ingestion APIs.

## Data Model (from PRD Section 8)
- **accounts** — account_id PK, holder_name, bank_name, account_age_days, kyc_level, status (clear/flagged/on_hold)
- **devices** — device_id PK, device_fingerprint; junction: account_devices(account_id, device_id)
- **transactions** — txn_id PK, sender_account_id FK, receiver_account_id FK, amount, channel, device_id FK, timestamp
- **risk_scores** — account_id FK, score 0-100, top_features jsonb, explanation_text, ring_id FK, computed_at
- **fraud_rings** — ring_id PK, member_account_ids array, total_flow_amount, detection_method, detected_at
- **hold_actions** — action_id PK, account_id FK, officer_id, reason, hold_start, hold_expiry (+60 days), status

## ML Rules
- Python 3.13, type hints, small pure functions, deterministic seeds
- No data leakage — labels are a separate table, never in features
- One shared features.py for training AND serving
- FEATURE_COLUMNS is the canonical ordered list
- Group split by ring_id for train/test (never random row split)
- SHAP explanations grounded in model output, not free-form LLM

## Tech Stack
Backend: FastAPI + Python | Frontend: Next.js 15 + shadcn/ui | DB: Supabase | ML: XGBoost + networkx + SHAP
