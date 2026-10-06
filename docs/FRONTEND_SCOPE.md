# Frontend Integration Scope

This repository does **not** include a frontend application. The scope of this backend repository is strictly mapping API boundaries, graph calculation, risk modeling, and officer tracking. Any future frontend connects to this backend entirely via stateless HTTP requests with JSON payloads.

## Responsibility Boundaries

### The Frontend is Responsible For:
- Presenting a secure UI with appropriate session management and tokens tracking authentic identities.
- Passing the authenticated officer's identity to backend endpoints holding RBAC responsibilities.
- Formatting raw transaction timelines.
- Providing visual indicators for ML model output (risk band colors, explanations).
- Invoking the `/health/ready` check before assuming service up-time.

### The Frontend must NEVER:
- Fetch database records directly from Supabase (bypassing the backend API).
- Load ML artifacts (`.joblib` binaries) or attempt to calculate features or risk locally.
- Determine if a hold is placed based solely on inference—it must interact with the explicit `/officer/holds` endpoint, which is the source of truth for holds and expiration.
- Parse or handle graph edge structures directly. It receives plain lists of ring member accounts.

## Expected API Handoff

The frontend will primarily orchestrate action across four route domains available on the backend:

1. **Ingest APIs (`/transactions`)**
   - Single and batch transaction creation.
   - Idempotency checks.
2. **Synchronous Checks (`/upi/check`)**
   - Instant, fast-path scoring requests for simulated payment initiation.
   - PII-minimal responses (score, band, and a fallback generative explanation).
3. **Officer/Admin Workflows (`/officer`)**
   - Real-time active hold placements (`POST /officer/hold`).
   - Manual release workflows.
   - Fraud ring details (`GET /officer/ring/{ring_id}`).
4. **Chat Interface (`/chat`)**
   - Natural language investigation workflows relying on Gemini LLM completions through `POST /chat/message`.

## Deployment Handshake

When a frontend is deployed alongside this repository, it needs only two variables pointing back to this system:
1. `NEXT_PUBLIC_API_URL` (or equivalent, pointing to `http://localhost:8000` or production URI).
2. The relevant Cognito/Auth0 configuration for identity that aligns with what the configured FastAPI application validates on `/officer` routes.