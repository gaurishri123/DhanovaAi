
import time
import logging
import pandas as pd
from dataclasses import dataclass
from typing import Callable, Any, Optional

from app.db.supabase import supabase_client
from app.graph_engine import build_graph, detect_communities, find_short_cycles

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("graph_worker")

@dataclass
class WorkerConfig:
    retry_base_seconds: int = 30

class GraphWorker:
    def __init__(
        self,
        store: Any = supabase_client,
        processor: Optional[Callable] = None,
        config: WorkerConfig = WorkerConfig(),
    ):
        self.store = store
        self.processor = processor or self._default_processor
        self.config = config

    def _default_processor(self, job: dict):
        job_id = job["job_id"]
        txn_id = job["txn_id"]

        # 1. Fetch transaction metadata
        txn_res = self.store.table("transactions").select("*").eq("txn_id", txn_id).execute()
        if not txn_res.data:
            raise ValueError(f"Txn {txn_id} not found")

        txn = pd.DataFrame(txn_res.data)
        as_of = pd.Timestamp(txn.iloc[0]["timestamp"])

        # 2. Build graph
        graph = build_graph(txn, as_of=as_of)
        detect_communities(graph)
        find_short_cycles(graph)

    def run_once(self) -> bool:
        # Assuming store has claim_graph_job RPC
        job_res = self.store.rpc("claim_graph_job", {"p_worker_id": "graph_worker_v1"}).execute()

        if not job_res.data:
            return False

        job = job_res.data
        try:
            self.processor(job)
            self.store.rpc("complete_graph_job", {"p_job_id": job["job_id"]}).execute()
        except Exception as e:
            logger.error(f"Job {job['job_id']} failed: {e}")
            # Simplified exponential backoff logic (doubling base)
            delay = self.config.retry_base_seconds * (2 ** (job.get("attempts", 0) - 1))
            self.store.rpc("fail_graph_job", {
                "p_job_id": job["job_id"],
                "p_error": str(e),
                "p_retry_delay_seconds": delay
            }).execute()

        return True

def run_worker():
    worker = GraphWorker()
    logger.info("Graph worker started")
    while True:
        try:
            if not worker.run_once():
                time.sleep(10)
        except Exception as e:
            logger.error(f"Worker loop error: {e}")
            time.sleep(30)

if __name__ == "__main__":
    run_worker()
