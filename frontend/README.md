# Dhanova Frontend — AI Mule & Fraud Ring Intelligence Platform

Built for the **MPOnline Idea & Innovation Hackathon 2026** (Theme 5 — AI Innovation for Public Services).

Dhanova provides graph-based AI detection of mule accounts and fraud rings in India's digital payment ecosystem. It combines point-in-time XGBoost inference, TreeSHAP feature attributions, and an RBI 2026-compliant 60-day statutory hold workflow.

---

## Tech Stack

- **Framework**: Next.js 15 (App Router, Turbopack)
- **Styling**: Tailwind CSS v4 (Glassmorphism, dark-mode cyber crime defense palette)
- **Components**: shadcn/ui-inspired primitives (Button, Badge, Card, Modal, Input)
- **Icons**: Lucide React
- **Language**: TypeScript (strict types matching backend domain schemas)

---

## Architectural & Design Decisions

1. **FastAPI Proxy / Zero CORS Configuration**:
   - Next.js rewrites in `next.config.ts` forward all `/api/backend/*` requests directly to `http://127.0.0.1:8000/*`.
   - No backend modifications or CORS headers required.

2. **Graceful Hybrid API Layer (`src/lib/api.ts`)**:
   - The frontend communicates with live backend endpoints when available (`GET /upi/check/{id}`, `POST /actions/hold`, `POST /actions/release/{id}`, `GET /actions/holds/expired`, `POST /chat/`, `GET /health`).
   - For missing endpoints or when the backend is offline/unseeded, requests transparently fall back to `src/lib/mockData.ts`, matching identical schemas defined in `backend/app/schemas/domain.py` and `docs/SIM_SPEC.md`.
   - Officer state changes (placing a hold, early release, running expiry maintenance) persist across all views during the session via local storage sync.

3. **Officer Identity Management**:
   - Instead of complex auth, a dedicated **Officer Switcher** is embedded in the navbar.
   - Defaults to `OFF_MP_2026` (Inspector Vikram Sharma, MP Cyber Crime Cell, Bhopal).
   - Quick presets for Delhi Police IFSO (`OFF_DEL_2026`), Maharashtra Cyber (`OFF_MH_2026`), CBI Financial Fraud (`OFF_CBI_2026`), and custom ID input.
   - Automatically attributes all statutory hold and release actions to the active officer.

4. **Pages & Capabilities**:
   - **(a) Citizen UPI Check** (`/upi/check` and `/upi/check/[account_id]`):
     - Real-time mule assessment for citizens before sending money.
     - Large risk badge (Safe, Caution, High Risk / Mule Suspect).
     - Plain-language AI rationale explaining fraud signals in non-technical terms.
     - Direct emergency callout card for **National Cyber Crime Helpline 1930** and link to `cybercrime.gov.in`.
   - **(b) Officer Command Dashboard** (`/dashboard` and `/`):
     - Key metrics: Monitored Accounts, Flagged Mules, Active 60-day Holds, Detected Rings.
     - Filterable account register: search, status filter (`clear`, `flagged`, `on_hold`), risk tier (`high`, `medium`, `low`), bank filter, and sorting.
     - Quick "Hold" action button launching the statutory hold modal directly from table rows.
   - **(c) Account Forensic Dossier** (`/accounts/[id]`):
     - Interactive **0-100 Risk Gauge** with animated needle and dynamic glow.
     - **SHAP Feature Contribution Chart** visualizing exact TreeSHAP values (positive risk factors in red vs mitigating factors in green) using human-readable descriptions from `explainer.py`.
     - Recent transaction table highlighting structuring (< ₹10,000), dwell time, and nocturnal burst tags.
     - RBI 60-day hold and early release modals.
     - **Gemini Case Chat Drawer**: slide-over AI assistant loaded with case context for interactive Q&A.
   - **(d) Fraud Ring Graph Intelligence** (`/rings`):
     - Interactive SVG canvas with zoom, pan, and node inspection.
     - Archetype filter pills:
       - **Fan-out Dispersal** (Operation Garuda): 1 funnel source rapidly dispersing to multiple mules.
       - **Circular Layering** (Operation Chakra): Multi-hop cyclic loop (A→B→C→D→A).
       - **Device Farm** (Operation Vyuh): Multiple accounts bound to a single physical device.
       - **Burst Mule**: Rapid sub-₹10,000 structuring bursts within 2 hours.
       - **Fan-in Collector**: Inbound victim payments consolidating into a central cashout hub.
   - **(e) RBI 60-Day Hold Management** (`/holds`):
     - Active hold monitoring with live countdown timers and progress meters.
     - Early release order modal.
     - Maintenance action triggering `GET /actions/holds/expired` to automatically process and unfreeze lapsed holds.

---

## Getting Started

### Prerequisites

- Node.js 18+ (tested on Node v24)
- npm 9+

### Installation & Run

1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. (Optional) Start the FastAPI backend on port 8000:
   ```bash
   # In a separate terminal from repo root:
   cd backend
   uvicorn app.main:app --reload --port 8000
   ```

4. Start the Next.js development server:
   ```bash
   npm run dev
   ```

5. Open your browser at [http://localhost:3000](http://localhost:3000).

### Production Build

To verify type safety and build optimized static assets:
```bash
npm run build
npm start
```

---

## Environment Variables

See `.env.example` in `frontend/`:
```env
BACKEND_URL=http://127.0.0.1:8000
NEXT_PUBLIC_API_URL=/api/backend
```
