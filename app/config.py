from __future__ import annotations

import os
from pathlib import Path

# Runtime
API_HOST = os.getenv("TECHPULSE_API_HOST", "127.0.0.1")
API_PORT = int(os.getenv("TECHPULSE_API_PORT", "8765"))
API_VERSION = "0.1.0"

# Paths (Windows defaults per architecture; overridable for dev/tests)
_LOCALAPPDATA = os.getenv("LOCALAPPDATA") or str(Path.home() / "AppData" / "Local")
_DEFAULT_DATA = Path(_LOCALAPPDATA) / "TechPulse" / "data"
DATA_DIR = Path(os.getenv("TECHPULSE_DATA_DIR", str(_DEFAULT_DATA)))
DB_PATH = Path(os.getenv("TECHPULSE_DB_PATH", str(DATA_DIR / "techpulse.db")))
LOG_DIR = Path(os.getenv("TECHPULSE_LOG_DIR", str(Path(_LOCALAPPDATA) / "TechPulse" / "logs")))

# Secrets (never returned by API)
GITHUB_TOKEN = os.getenv("TECHPULSE_GITHUB_TOKEN")

# GitHub
GITHUB_API_BASE = "https://api.github.com"
GITHUB_TIMEOUT_SECONDS = int(os.getenv("TECHPULSE_GITHUB_TIMEOUT", "15"))
GITHUB_SEARCH_CACHE_MINUTES = 30
GITHUB_MAX_QUERIES_PER_CYCLE = 6
GITHUB_PER_PAGE = 50
GITHUB_MAX_PAGES = 2

# RSS
RSS_TIMEOUT_SECONDS = int(os.getenv("TECHPULSE_RSS_TIMEOUT", "15"))
RSS_MAX_ITEMS_PER_FEED = 100
RSS_USER_AGENT = "TechPulse/0.1 (+local; tech news aggregator)"

# Worker
WORKER_POLL_SECONDS = float(os.getenv("TECHPULSE_WORKER_POLL", "2"))
WORKER_HEARTBEAT_SECONDS = int(os.getenv("TECHPULSE_WORKER_HEARTBEAT", "10"))
WORKER_STALE_AFTER_SECONDS = int(os.getenv("TECHPULSE_WORKER_STALE_AFTER", "30"))
WORKER_MAX_CONCURRENT = int(os.getenv("TECHPULSE_WORKER_MAX_CONCURRENT", "2"))

# Embeddings (optional sidecar; no model download in F2)
EMBEDDINGS_ENABLED = os.getenv("TECHPULSE_EMBEDDINGS_ENABLED", "true").lower() == "true"
EMBEDDINGS_SIDECAR_URL = os.getenv("TECHPULSE_EMBEDDINGS_URL", "http://127.0.0.1:8766")
EMBEDDINGS_MODEL = "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"
EMBEDDINGS_MIN_SIMILARITY = 0.25

# CORS (architecture §11)
CORS_ORIGINS = [
    "http://localhost:1420",
    "http://127.0.0.1:1420",
    "tauri://localhost",
    "http://tauri.localhost",
]

DEFAULT_SETTINGS: dict[str, object] = {
    "scheduler.enabled": True,
    "scheduler.max_concurrent_jobs": 2,
    "worker.heartbeat_seconds": WORKER_HEARTBEAT_SECONDS,
    "worker.stale_after_seconds": WORKER_STALE_AFTER_SECONDS,
    "http.timeout_seconds": 15,
    "http.max_concurrent": 4,
    "retention.source_runs_days": 90,
    "retention.snapshots_days": 400,
    "retention.news_days": 365,
    "links.verify_interval_days": 7,
    "ideas.auto_generate": True,
    "ideas.min_new_repos": 10,
    "ideas.max_per_run": 5,
    "ui.theme": "dark",
    "llm.enabled": False,
    "llm.provider": None,
    "llm.model": None,
    "embeddings.enabled": EMBEDDINGS_ENABLED,
    "embeddings.model": EMBEDDINGS_MODEL,
    "embeddings.batch_size": 32,
    "embeddings.max_repos_per_run": 200,
    "embeddings.interval_minutes": 360,
    "embeddings.auto_download": False,
    "embeddings.min_similarity": EMBEDDINGS_MIN_SIMILARITY,
    "embeddings.sidecar_url": EMBEDDINGS_SIDECAR_URL,
    "ranking.weights": {
        "growth": 0.30,
        "activity": 0.20,
        "maintenance": 0.20,
        "relevance": 0.15,
        "popularity": 0.15,
        "interest": 0.00,
        "quality": 0.00,
    },
    "github.discovered_count": 0,  # Cumulative unique repos ever found by worker
}


def ensure_dirs() -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    LOG_DIR.mkdir(parents=True, exist_ok=True)
