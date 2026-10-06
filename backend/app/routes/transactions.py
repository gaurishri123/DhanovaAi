from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from app.schemas.domain import TransactionCreate, TransactionResponse
from app.db.supabase import get_db, Client
import uuid
import logging

router = APIRouter(prefix="/transactions", tags=["Transactions"])
logger = logging.getLogger(__name__)

def trigger_graph_recalculation(txn_id: str):
    """Best-effort local dispatcher for a persisted graph job.

    The durable source of truth is ``graph_jobs``. A production worker can
    claim pending rows with a lease; this hook only keeps local development
    observable without blocking ingestion.
    """
    logger.info("Graph recalculation queued for transaction %s", txn_id)

@router.post("/", response_model=TransactionResponse)
def create_transaction(
    payload: TransactionCreate,
    background_tasks: BackgroundTasks,
    db: Client = Depends(get_db)
):
    """
    Real-time ingestion for a single transaction.
    """
    txn_id = str(uuid.uuid4())
    insert_data = {
        "txn_id": txn_id,
        "sender_account_id": payload.sender_account_id,
        "receiver_account_id": payload.receiver_account_id,
        "amount": str(payload.amount),
        "channel": payload.channel,
        "device_id": payload.device_id,
        "timestamp": payload.timestamp.isoformat(),
        "idempotency_key": payload.idempotency_key,
    }

    try:
        if payload.idempotency_key:
            existing = (
                db.table("transactions")
                .select("*")
                .eq("idempotency_key", payload.idempotency_key)
                .limit(1)
                .execute()
            )
            if existing.data:
                return existing.data[0]

        try:
            res = db.table("transactions").insert(insert_data).execute()
        except Exception as insert_error:
            if payload.idempotency_key and "duplicate" in str(insert_error).lower():
                existing = (
                    db.table("transactions")
                    .select("*")
                    .eq("idempotency_key", payload.idempotency_key)
                    .limit(1)
                    .execute()
                )
                if existing.data:
                    return existing.data[0]
            raise
        if not res.data:
            raise HTTPException(status_code=502, detail="Database did not return the transaction.")

        # Persist a deduplicated job before dispatching the best-effort local
        # worker. Production deployments can consume graph_jobs via a queue.
        try:
            db.table("graph_jobs").upsert({
                "txn_id": txn_id,
                "dedupe_key": f"transaction:{txn_id}",
                "status": "pending",
            }).execute()
        except Exception:
            logger.exception("Transaction committed but graph job enqueue failed")
        background_tasks.add_task(trigger_graph_recalculation, txn_id)

        return res.data[0]
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to insert transaction: {e}")
        raise HTTPException(status_code=503, detail="Database insertion failed.")
