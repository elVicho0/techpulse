from __future__ import annotations

from fastapi import APIRouter, Response

from app.services.job_service import enqueue_job, list_jobs, list_runs, get_run
from app.services.source_service import get_source, list_sources, update_source

router = APIRouter(tags=["sources"])


@router.get("/sources")
def get_sources():
    return {"items": list_sources()}


@router.patch("/sources/{source_id}")
def patch_source(source_id: int, body: dict):
    return update_source(source_id, body)


@router.post("/sources/{source_id}/run", status_code=202)
def run_source(source_id: int):
    get_source(source_id)  # 404 if missing
    return enqueue_job(source_id)


@router.post("/jobs/run-all", status_code=202)
def run_all():
    res = enqueue_job(None)
    return {"request_id": res["request_id"], "status": "pending", "worker_state": res["worker_state"]}


@router.get("/jobs")
def jobs(status: str | None = None, source_id: int | None = None, page: int = 1, page_size: int = 20):
    return list_jobs(status=status, source_id=source_id, page=page, page_size=page_size)


@router.get("/runs")
def runs(source_id: int | None = None, status: str | None = None, page: int = 1, page_size: int = 20, order: str = "desc"):
    return list_runs(source_id=source_id, status=status, page=page, page_size=page_size, order=order)


@router.get("/runs/{run_id}")
def run_detail(run_id: int):
    return get_run(run_id)
