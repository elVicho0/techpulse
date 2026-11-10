import os
import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))


@pytest.fixture()
def test_db(tmp_path, monkeypatch):
    db = tmp_path / "techpulse.db"
    monkeypatch.setenv("TECHPULSE_DB_PATH", str(db))
    # reload config/db modules that read env at import? config reads at import; easier to patch module attr
    import app.config as cfg
    monkeypatch.setattr(cfg, "DB_PATH", db)
    monkeypatch.setattr(cfg, "DATA_DIR", tmp_path)
    from app.db.migrations import apply_migrations
    from app.db.seed import seed_defaults
    apply_migrations(db)
    seed_defaults(db)
    return db


@pytest.fixture()
def client(test_db, monkeypatch):
    import app.config as cfg
    monkeypatch.setattr(cfg, "DB_PATH", test_db)
    from app.main import app
    with TestClient(app) as c:
        yield c
