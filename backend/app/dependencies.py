"""Shared FastAPI dependencies."""

from fastapi import HTTPException, Request


def get_model(request: Request):
    """Return the validated runtime model or a readiness error."""
    model = getattr(request.app.state, "model", None)
    if model is None:
        detail = getattr(request.app.state, "model_error", None) or "ML model not loaded"
        raise HTTPException(status_code=503, detail=detail)
    return model
