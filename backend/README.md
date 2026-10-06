# Dhanova Backend

FastAPI backend for the Dhanova fraud detection system.

## Setup

1. Install dependencies:
```bash
pip install -r requirements.txt
```

2. Configure environment:
```bash
cp .env.example .env
# Edit .env with your Supabase and Gemini API credentials
```

3. Ensure ML model artifacts are available:
```bash
# By default, artifacts are loaded from the repository-level models/ directory.
# Override with MODEL_DIR in .env when deploying elsewhere.
# Required files: risk_model.joblib, calibrator.joblib,
#                 feature_columns.json, model_version.txt
```

The `.joblib` files are intentionally ignored by Git. For a fresh clone, fetch a
versioned model bundle from your CI release artifact or object storage, place it
in `models/` (or set `MODEL_DIR`), and verify `/health/ready` before serving
traffic. Never commit model binaries or credentials to the repository.

4. Run the server:
```bash
cd backend
uvicorn app.main:app --reload --port 8000
```

## API Endpoints

### Health Check
- `GET /health` - Legacy API and model status
- `GET /health/live` - Liveness probe (process is running)
- `GET /health/ready` - Readiness probe (validated model is loaded)

### Transactions
- `POST /transactions/` - Ingest a new transaction

### UPI Check (Citizen)
- `GET /upi/check/{account_id}` - Check risk score for an account

### Officer Actions
- `POST /actions/hold` - Place 60-day hold on account
- `POST /actions/release/{action_id}` - Release a hold
- `GET /actions/holds/expired` - Process expired holds

### Chat
- `POST /chat/` - Ask questions about an account

## Database migrations and seed data

Apply `backend/migrations/001_initial_schema.sql` with the Supabase CLI or SQL
editor using a migration/service role. It creates the eight backend tables,
foreign keys, numeric money columns, UTC timestamps, indexes, idempotency
constraints, RLS enablement, atomic hold RPCs, and durable graph-job RPCs.

To validate generated Parquet data without writing to Supabase:
```bash
python scripts/import_parquet_to_supabase.py --data-dir data --dry-run
```

For a real import, configure the backend environment and run the same command
without `--dry-run`. The importer writes accounts, devices, mappings, and
transactions in FK-safe batches; it intentionally does not import `labels.parquet`
into production feature tables.

## Deployment

The repository includes a `Dockerfile` for production-style Uvicorn startup.
The image expects the versioned model bundle under `/app/models`; because model
binaries are ignored by Git, the deployment pipeline must download the exact
release artifact before building or mount it at `MODEL_DIR`. Set `MODEL_DIR`,
Supabase credentials, `GEMINI_API_KEY`, `CORS_ORIGINS`, and `AUTH_REQUIRED=true`
in the deployment environment. Gate traffic on `/health/ready`.

The CI workflow runs compilation, importer dry-run, tests, migration-contract
checks, and a basic committed-secret check. It does not connect to production
Supabase or Gemini.

## Testing

```bash
pytest app/test_api.py -v
```

## Worker and operations

The durable graph worker claims `graph_jobs` through leased Supabase RPCs and
retries failures with bounded exponential backoff. Run the worker separately:

```bash
python -m app.workers.run_graph_worker
```

The callback is intentionally deployment-specific: wire it to the as-of graph
recomputation service before enabling production graph result updates. Ingestion
persists the job and remains non-blocking.

When `AUTH_REQUIRED=true`, Supabase JWTs are required and officer routes accept
only officer, supervisor, or admin roles. Local development uses an explicit
admin bypass only when `AUTH_REQUIRED=false`.

## Architecture

- **ML Integration**: Shared point-in-time features, calibrated XGBoost, SHAP, and graph candidates
- **Database**: Supabase PostgreSQL with eight tables and atomic/RPC workflows
- **LLM**: Maintained `google-genai` adapter with deterministic fallback
- **Async**: Durable leased graph jobs, not an in-process background-task queue
- **Frontend**: No frontend source is included in this repository; see `docs/FRONTEND_SCOPE.md`

## Notes

- ML model training is handled separately by the ML team
- This backend only integrates and serves the trained model
- Synthetic evaluation metrics are not production accuracy estimates
