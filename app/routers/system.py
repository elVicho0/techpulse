from __future__ import annotations

from fastapi import APIRouter

from app.config import API_VERSION, EMBEDDINGS_ENABLED, EMBEDDINGS_MODEL, EMBEDDINGS_SIDECAR_URL, GITHUB_TOKEN
from app.db.connection import connect
from app.services.worker_service import get_worker_status
from app.utils.time import utc_now_iso

router = APIRouter(tags=["system"])


@router.get("/health")
def health():
    db_ok = "ok"
    try:
        conn = connect()
        conn.execute("SELECT 1").fetchone()
        conn.close()
    except Exception:
        db_ok = "error"
    worker = get_worker_status()
    status = "ok" if db_ok == "ok" else "error"
    return {
        "status": status,
        "version": API_VERSION,
        "database": db_ok,
        "worker": {"state": worker["state"], "heartbeat_at": worker["heartbeat_at"]},
        "time": utc_now_iso(),
    }


@router.get("/worker/status")
def worker_status():
    return get_worker_status()


@router.get("/capabilities")
def capabilities():
    conn = connect()
    try:
        emb_indexed = conn.execute("SELECT COUNT(*) c FROM repository_embeddings").fetchone()["c"]
        repo_count = conn.execute("SELECT COUNT(*) c FROM repositories").fetchone()["c"]
        pending = max(0, repo_count - emb_indexed)
    finally:
        conn.close()
    return {
        "github_token_configured": bool(GITHUB_TOKEN),
        "agent_reach": {
            "installed": False,
            "version": None,
            "last_checked_at": None,
            "channels": [],
        },
        "llm": {"enabled": False, "configured": False},
        "embeddings": {
            "enabled": EMBEDDINGS_ENABLED,
            "sidecar_state": "offline",
            "model": EMBEDDINGS_MODEL,
            "dimensions": 384,
            "indexed": emb_indexed,
            "pending": pending,
        },
    }


@router.post("/capabilities/agent-reach/refresh")
def agent_reach_refresh():
    # F2: Agent Reach not implemented as a connector channel manager beyond policy; return capabilities.
    return capabilities()


@router.get("/embeddings/status")
def embeddings_status():
    conn = connect()
    try:
        indexed = conn.execute("SELECT COUNT(*) c FROM repository_embeddings").fetchone()["c"]
        repos = conn.execute("SELECT COUNT(*) c FROM repositories").fetchone()["c"]
        last = conn.execute("SELECT MAX(updated_at) m FROM repository_embeddings").fetchone()["m"]
    finally:
        conn.close()
    return {
        "enabled": EMBEDDINGS_ENABLED,
        "sidecar": {
            "state": "offline",
            "url": EMBEDDINGS_SIDECAR_URL,
            "model": EMBEDDINGS_MODEL,
            "dimensions": 384,
            "device": "cpu",
            "version": API_VERSION,
            "last_checked_at": utc_now_iso(),
        },
        "model": {
            "name": EMBEDDINGS_MODEL,
            "downloaded": False,
            "download_required": True,
        },
        "index": {
            "indexed": indexed,
            "pending": max(0, repos - indexed),
            "last_indexed_at": last,
            "active_model": EMBEDDINGS_MODEL,
        },
    }


@router.post("/embeddings/reindex")
def embeddings_reindex(body: dict | None = None):
    from fastapi import HTTPException
    raise HTTPException(status_code=503, detail={"code": "EMBEDDINGS_UNAVAILABLE", "message": "Embeddings sidecar is not available in F2."})
