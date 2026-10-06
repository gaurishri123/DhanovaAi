from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import logging
import json

from app.core.config import settings
from app.scorer import RiskModel
from app.features import FEATURE_COLUMNS
from app.middleware import ObservabilityMiddleware, counters

logger = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Initializing Dhanova Backend...")

    # Initialize app state
    app.state.model = None
    app.state.model_version = None
    app.state.model_error = None

    # ML Contract: Backend is responsible for loading the model state into memory.
    model_dir = settings.MODEL_DIR
    logger.info(f"Loading model from: {model_dir}")

    try:
        # Validate all required files exist
        required_files = [
            "risk_model.joblib",
            "calibrator.joblib",
            "feature_columns.json",
            "model_version.txt"
        ]

        missing = [f for f in required_files if not (model_dir / f).exists()]
        if missing:
            raise FileNotFoundError(f"Missing model artifacts: {missing}")

        # Load and validate feature columns
        with open(model_dir / "feature_columns.json") as f:
            saved_features = json.load(f)

        if saved_features != FEATURE_COLUMNS:
            raise ValueError(
                f"Feature column mismatch. Expected {len(FEATURE_COLUMNS)} features "
                f"in canonical order, got {len(saved_features)}."
            )

        # Load model version
        with open(model_dir / "model_version.txt") as f:
            model_version = f.read().strip()

        # Load the model
        model = RiskModel.load(str(model_dir))

        # Validate with a tiny prediction
        import pandas as pd
        import numpy as np
        test_features = pd.DataFrame(
            np.zeros((1, len(FEATURE_COLUMNS))),
            columns=FEATURE_COLUMNS
        )
        _ = model.predict_proba(test_features)

        # Store in app state
        app.state.model = model
        app.state.model_version = model_version

        logger.info(
            f"✓ Loaded RiskModel v{model_version} with {len(FEATURE_COLUMNS)} features"
        )

    except Exception as e:
        logger.error(f"Failed to load ML RiskModel: {e}")
        app.state.model_error = str(e)
        # Continue starting the app so liveness probe works

    yield

    logger.info("Shutting down Dhanova Backend...")
    app.state.model = None


app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    lifespan=lifespan
)

_cors_origins = [origin.strip() for origin in settings.CORS_ORIGINS.split(",") if origin.strip()]
if _cors_origins:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=_cors_origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type", "Idempotency-Key"],
    )

# Observability: request IDs, structured logs, latency counters
app.add_middleware(ObservabilityMiddleware)

# Import and include routers
from app.routes import transactions, upi_check, officer, chat

app.include_router(transactions.router)
app.include_router(upi_check.router)
app.include_router(officer.router)
app.include_router(chat.router)

@app.get("/health/live")
def liveness_check():
    """Liveness probe - process is running."""
    return {"status": "ok"}

@app.get("/health/ready")
def readiness_check():
    """Readiness probe - model and dependencies are available."""
    model = getattr(app.state, "model", None)
    if model is None:
        error_detail = getattr(app.state, "model_error", None) or "ML model not loaded"
        raise HTTPException(status_code=503, detail=error_detail)

    return {
        "status": "ready",
        "model_version": getattr(app.state, "model_version", None),
        "feature_count": len(FEATURE_COLUMNS)
    }

@app.get("/health")
def health_check():
    """Legacy health endpoint."""
    return {
        "status": "ok",
        "model_loaded": getattr(app.state, "model", None) is not None
    }


@app.get("/metrics")
def metrics():
    """Internal metrics endpoint (do not expose to public ingress)."""
    return counters.snapshot()
