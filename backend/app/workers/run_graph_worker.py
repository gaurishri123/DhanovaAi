"""Run the durable graph worker against Supabase."""

from app.db.supabase import get_db
from app.workers.graph_worker import GraphWorker, SupabaseGraphJobStore, worker_id_from_env


def process_job(job: dict) -> None:
    """Placeholder for the domain graph recomputation callback.

    Job claiming, leases, retries, and terminal state transitions are durable.
    Deployments should replace this callback with the graph recomputation service
    that reads the transaction snapshot identified by ``job['txn_id']``.
    """
    raise NotImplementedError("graph recomputation callback is not configured")


def main() -> None:
    worker = GraphWorker(
        SupabaseGraphJobStore(get_db()),
        process_job,
        worker_id=worker_id_from_env(),
    )
    worker.run_forever()


if __name__ == "__main__":
    main()
