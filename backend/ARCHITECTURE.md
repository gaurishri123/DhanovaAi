# Dhanova Backend Architecture

## ML/Backend Boundary Design

### Principle
The backend ONLY integrates with ML models. It does NOT create, train, or modify them.

### Integration Layer: `app/services/ml_bridge.py`

This is the **ONLY** backend module that imports ML functions directly:
- `from app.scorer import score_account, RiskModel`
- `from app.features import build_features`
- `from app.explainer import explain, gemini_explanation_prompt`

**All API routes** call `ml_bridge.py` functions instead of importing ML modules.

### Clean API Provided by ml_bridge.py

#### `score_account_with_explanation(account_id, model, as_of) -> Dict`
- Fetches data from Supabase
- Converts to Pandas DataFrames matching ML contract
- Calls ML scoring, feature building, and explanation
- Executes LLM prompt generation
- Returns unified dict with score, explanation, features

#### `get_account_features(account_id, as_of) -> Dict`
- Returns computed features for debugging
- Does not expose ML implementation details

### Model Loading (main.py)

**Exception**: `main.py` imports `RiskModel` to load artifacts at startup:
```python
from app.scorer import RiskModel
ml_model = RiskModel.load('models/')
```

This is acceptable because:
- It only loads pre-trained artifacts
- Does not train or modify models
- Happens once at startup, not per-request

### Route Layer (Clean Separation)

✅ **Correct**:
```python
from app.services.ml_bridge import score_account_with_explanation
result = score_account_with_explanation(account_id, ml_model)
```

❌ **Incorrect**:
```python
from app.features import build_features  # DON'T DO THIS IN ROUTES
from app.scorer import score_account     # DON'T DO THIS IN ROUTES
```

## File Organization

```
backend/app/
├── core/              - Configuration (env vars)
├── db/                - Supabase client
├── schemas/           - Pydantic models (validation)
├── services/
│   ├── ml_bridge.py   - ML integration facade ⚠️ ONLY place to import ML
│   └── gemini.py      - LLM execution
├── routes/            - API endpoints (never import ML directly)
│   ├── transactions.py
│   ├── upi_check.py
│   ├── officer.py
│   └── chat.py
├── main.py            - FastAPI app (loads RiskModel at startup)
│
└── [ML TEAM OWNS - DO NOT MODIFY]
    ├── features.py    - Feature engineering
    ├── scorer.py      - Model wrapper
    ├── explainer.py   - SHAP explanations
    └── graph_engine.py - Graph algorithms
```

## Data Flow

```
1. API Request → Route Handler
2. Route validates with Pydantic schemas
3. Route calls ml_bridge.score_account_with_explanation()
4. ml_bridge queries Supabase → Pandas DataFrames
5. ml_bridge calls ML functions (features, scorer, explainer)
6. ml_bridge calls Gemini API for human explanation
7. ml_bridge returns unified dict
8. Route persists to risk_scores table
9. Route returns response to client
```

## Why This Design?

1. **Modularity**: ML team can change implementation without breaking API contracts
2. **Testability**: Routes can mock ml_bridge without importing ML code
3. **Clarity**: Single source of truth for ML integration
4. **Safety**: Prevents accidental modification of ML logic from backend code

## What Backend Owns

- ✅ Loading model artifacts from the configured `MODEL_DIR` (repository default: `models/`)
- ✅ API routing and validation
- ✅ Supabase queries
- ✅ Converting SQL results to Pandas DataFrames
- ✅ Calling ML functions with correct schemas
- ✅ LLM API execution
- ✅ Error handling and logging
- ✅ Persisting results to database

## What ML Team Owns

- ❌ Training models
- ❌ Feature engineering logic
- ❌ Model hyperparameters
- ❌ SHAP calculation
- ❌ Graph algorithms
- ❌ Creating model artifacts (.joblib files)
- ❌ Defining FEATURE_COLUMNS schema
