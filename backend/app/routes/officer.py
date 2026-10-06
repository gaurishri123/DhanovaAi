from fastapi import APIRouter, Depends, HTTPException
from app.schemas.domain import HoldActionRequest, HoldActionResponse
from app.db.supabase import get_db, Client
from datetime import datetime, timedelta, timezone
import uuid
import logging
from app.auth import require_officer

router = APIRouter(prefix="/actions", tags=["Officer Actions"])
logger = logging.getLogger(__name__)

@router.post("/hold", response_model=HoldActionResponse)
def place_hold(
    payload: HoldActionRequest,
    db: Client = Depends(get_db),
    user: dict = Depends(require_officer),
):
    """
    RBI-compliant 60-day hold action.
    Places account on hold and automatically calculates expiry (+60 days).
    """
    action_id = str(uuid.uuid4())
    hold_start = datetime.now(timezone.utc)
    hold_expiry = hold_start + timedelta(days=60)
    officer_id = payload.officer_id if user.get("sub") == "local-development" else str(user["sub"])

    hold_data = {
        "action_id": action_id,
        "account_id": payload.account_id,
        "officer_id": officer_id,
        "reason": payload.reason,
        "hold_start": hold_start.isoformat(),
        "hold_expiry": hold_expiry.isoformat(),
        "status": "active"
    }

    try:
        # The RPC locks the account, rejects an existing active hold, inserts
        # the action, and updates account status in one database transaction.
        result = db.rpc("place_hold_atomic", {
            "p_account_id": payload.account_id,
            "p_officer_id": officer_id,
            "p_reason": payload.reason,
            "p_action_id": action_id,
            "p_hold_start": hold_start.isoformat(),
            "p_hold_expiry": hold_expiry.isoformat(),
            "p_idempotency_key": payload.idempotency_key,
        }).execute()
        if not result.data:
            raise HTTPException(status_code=502, detail="Hold transaction returned no result")
        return HoldActionResponse(**(result.data[0] if isinstance(result.data, list) else result.data))
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to place hold on account {payload.account_id}: {e}")
        detail = str(e).lower()
        if "active_hold_exists" in detail:
            raise HTTPException(status_code=409, detail="An active hold already exists.")
        if "account_not_found" in detail:
            raise HTTPException(status_code=404, detail="Account not found.")
        if "idempotency_conflict" in detail:
            raise HTTPException(status_code=409, detail="Idempotency key is already used for another hold.")
        raise HTTPException(status_code=503, detail="Failed to place hold.")

@router.post("/release/{action_id}")
def release_hold(
    action_id: str,
    db: Client = Depends(get_db),
    user: dict = Depends(require_officer),
):
    """
    Releases a hold before the 60-day expiry.
    """
    try:
        result = db.rpc("release_hold_atomic", {"p_action_id": action_id}).execute()
        if not result.data:
            raise HTTPException(status_code=404, detail="Hold action not found.")
        row = result.data[0] if isinstance(result.data, list) else result.data
        return {"message": f"Hold {action_id} released successfully.", "account_id": row["account_id"]}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to release hold {action_id}: {e}")
        raise HTTPException(status_code=503, detail="Failed to release hold.")

@router.get("/holds/expired")
def check_expired_holds(
    db: Client = Depends(get_db),
    user: dict = Depends(require_officer),
):
    """
    Maintenance endpoint to check and auto-expire holds past their 60-day window.
    """
    try:
        now = datetime.now(timezone.utc).isoformat()

        # Find expired holds
        res = db.table("hold_actions")\
            .select("*")\
            .eq("status", "active")\
            .lt("hold_expiry", now)\
            .execute()

        expired_count = 0
        for hold in res.data:
            # The RPC conditionally expires the action and only clears an
            # account when no newer active hold remains.
            result = db.rpc("expire_hold_atomic", {"p_action_id": hold["action_id"]}).execute()
            if result.data:
                expired_count += 1

        return {"message": f"Processed {expired_count} expired holds."}
    except Exception as e:
        logger.error(f"Failed to process expired holds: {e}")
        raise HTTPException(status_code=503, detail="Failed to process expired holds.")
