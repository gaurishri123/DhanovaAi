"""Unit tests for graph worker state-transition orchestration."""

from app.workers.graph_worker import GraphWorker, WorkerConfig


class Store:
    def __init__(self, job):
        self.job = job
        self.completed = []
        self.failed = []

    def claim_graph_job(self, worker_id, lease_seconds):
        job, self.job = self.job, None
        # Wrap in expected response structure
        return type('Response', (), {'data': job})()

    def rpc(self, name, params):
        if name == "claim_graph_job":
            return type('Response', (), {'execute': lambda *args, **kwargs: self.claim_graph_job(params['p_worker_id'], 120)})()
        elif name == "complete_graph_job":
            return type('Response', (), {'execute': lambda *args, **kwargs: self.complete_graph_job(params['p_job_id'])})()
        elif name == "fail_graph_job":
            return type('Response', (), {'execute': lambda *args, **kwargs: self.fail_graph_job(params['p_job_id'], params['p_error'], params['p_retry_delay_seconds'])})()
        raise ValueError(f"Unknown RPC {name}")

    def complete_graph_job(self, job_id):
        self.completed.append(job_id)

    def fail_graph_job(self, job_id, error, retry_delay_seconds):
        self.failed.append((job_id, error, retry_delay_seconds))


def test_worker_completes_successful_job():
    store = Store({"job_id": "j1", "attempts": 1})
    seen = []
    worker = GraphWorker(store, lambda job: seen.append(job["job_id"]))
    assert worker.run_once() is True
    assert seen == ["j1"]
    assert store.completed == ["j1"]
    assert store.failed == []


def test_worker_retries_failed_job_with_bounded_backoff():
    store = Store({"job_id": "j2", "attempts": 2})
    worker = GraphWorker(
        store,
        lambda job: (_ for _ in ()).throw(RuntimeError("boom")),
        WorkerConfig(retry_base_seconds=10),
    )
    assert worker.run_once() is True
    assert store.completed == []
    assert store.failed == [("j2", "boom", 20)]


def test_worker_is_idle_when_no_job_exists():
    store = Store(None)
    worker = GraphWorker(store, lambda job: None)
    assert worker.run_once() is False
