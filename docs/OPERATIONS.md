# Dhanova Operations

## Startup and readiness

1. Provide `SUPABASE_URL`, `SUPABASE_KEY`, and `GEMINI_API_KEY` through the secret store.
2. Set `AUTH_REQUIRED=true` and a narrow `CORS_ORIGINS` list in deployed environments.
3. Download the exact model bundle into `MODEL_DIR` and verify its manifest before startup.
4. Start the API and graph worker as separate processes.
5. Route traffic only after `GET /health/ready` returns 200; use `/health/live` for process liveness.

## Graph jobs

Transactions enqueue a deduplicated `graph_jobs` row. The worker claims rows with a lease,
processes them, completes successful jobs, and retries failures with bounded backoff. Monitor
pending backlog, running leases, retry attempts, and terminal `failed` rows. A stuck lease is
reclaimed by the next claim operation after `locked_until` expires.

## Failure handling

- `503`: dependency, model, or provider unavailable; retry according to the caller's policy.
- `409`: duplicate active hold or idempotency conflict; do not blindly retry with the same key.
- Gemini fallback text is deterministic and safe to display when the provider is unavailable.
- Never log bearer tokens, API keys, full prompts, account holder names, or raw transaction payloads.

## External verification

CI runs without production credentials and cannot prove Supabase RPC deployment or Gemini access.
Run those checks against a disposable environment before enabling production traffic.
