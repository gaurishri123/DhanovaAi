from fastapi import APIRouter, Depends, HTTPException
from app.schemas.domain import RiskScoreResponse
from app.db.supabase import get_db, Client
from app.services.ml_bridge import score_account_with_explanation
from app.dependencies import get_model
from app.scorer import RiskModel
from datetime import datetime, timezone
import logging

router = APIRouter(prefix="/upi", tags=["Citizen UPI Check"])
logger = logging.getLogger(__name__)

@router.get("/check/{account_id}", response_model=RiskScoreResponse)
def check_upi_account(
    account_id: str,
    db: Client = Depends(get_db),
    model: RiskModel = Depends(get_model)
):
    """
    Citizen-facing Check-UPI API.
    Verifies the risk score of a given account in real-time.

    Note: This route does NOT import ML functions directly.
    All ML integration happens through ml_bridge.py facade.
    """

    try:
        # Fetch existing risk score from DB if recent
        risk_res = db.table("risk_scores")\
            .select("*")\
            .eq("account_id", account_id)\
            .order("computed_at", desc=True)\
            .limit(1)\
            .execute()

        # If score exists and is recent (< 1 hour), return cached
        if risk_res.data:
            score_record = risk_res.data[0]
            computed_at = datetime.fromisoformat(score_record['computed_at'])
            if computed_at.tzinfo is None:
                computed_at = computed_at.replace(tzinfo=timezone.utc)
            age_minutes = (
                datetime.now(timezone.utc) - computed_at
            ).total_seconds() / 60

            if age_minutes < 60:
                return RiskScoreResponse(**score_record)

        # Else recompute via ML bridge (clean abstraction)
        result = score_account_with_explanation(
            account_id, model, as_of=datetime.now(timezone.utc)
        )

        # Persist to DB
        risk_data = {
            "account_id": account_id,
            "score": result['score'],
            "top_features": {
                "band": result['band'],
                "shap": result['top_features']
            },
            "explanation_text": result['explanation'],
            "ring_id": result.get("ring_id"),
            "model_version": result.get("model_version"),
            "as_of": result.get("as_of"),
            "feature_schema_hash": result.get("feature_schema_hash"),
            "computed_at": result.get("computed_at")
        }

        db.table("risk_scores").insert(risk_data).execute()

        return RiskScoreResponse(**risk_data)

    except ValueError as ve:
        raise HTTPException(status_code=404, detail=str(ve))
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error scoring account {account_id}: {e}")
        raise HTTPException(status_code=503, detail="Risk scoring service unavailable.")
