"""Authentication hooks for protected backend operations.

Local development keeps AUTH_REQUIRED=false. Deployments should enable it and
provide a Supabase JWT in the Authorization header.
"""

from typing import Any

from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.core.config import settings

_bearer = HTTPBearer(auto_error=False)


def current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
) -> dict[str, Any]:
    if not settings.AUTH_REQUIRED:
        return {"sub": "local-development", "role": "admin"}
    if credentials is None:
        raise HTTPException(status_code=401, detail="Authorization required")

    from app.db.supabase import get_db

    try:
        user_response = get_db().auth.get_user(credentials.credentials)
        user = getattr(user_response, "user", None)
        if user is None:
            raise ValueError("invalid user")
        metadata = getattr(user, "user_metadata", {}) or {}
        return {"sub": getattr(user, "id", None), "role": metadata.get("role", "citizen")}
    except Exception as exc:
        raise HTTPException(status_code=401, detail="Invalid authorization token") from exc


def require_officer(user: dict[str, Any] = Depends(current_user)) -> dict[str, Any]:
    if user.get("role") not in {"officer", "supervisor", "admin"}:
        raise HTTPException(status_code=403, detail="Officer role required")
    return user
