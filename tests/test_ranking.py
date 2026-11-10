from app.db.connection import connect
from app.services.ranking_service import recalculate_repo_scores
from app.services.repo_service import upsert_repository


def _seed_repo(test_db):
    rid, _ = upsert_repository({
        "id": 999001, "full_name": "acme/test-repo", "name": "test-repo",
        "owner": {"login": "acme", "type": "Organization"},
        "description": "AI agent framework", "html_url": "https://github.com/acme/test-repo",
        "homepage": None, "language": "Python", "license": {"spdx_id": "MIT", "name": "MIT License"},
        "topics": ["ai", "agents"], "stargazers_count": 1200, "forks_count": 80, "open_issues_count": 10,
        "created_at": "2025-01-01T00:00:00Z", "updated_at": "2026-11-01T00:00:00Z", "pushed_at": "2026-11-08T00:00:00Z",
    }, None, test_db)
    return rid


def test_growth_null_without_snapshots_history(test_db):
    rid = _seed_repo(test_db)
    # keep only 1 snapshot to force unknown growth
    conn = connect(test_db)
    conn.execute("DELETE FROM repository_snapshots WHERE repository_id=?", (rid,))
    conn.execute("INSERT INTO repository_snapshots(repository_id,captured_at,stars,forks,open_issues) VALUES (?,?,?,?,?)",
                 (rid, "2026-11-09T00:00:00Z", 1200, 80, 10))
    conn.commit(); conn.close()
    recalculate_repo_scores(rid, test_db)
    conn = connect(test_db)
    row = conn.execute("SELECT growth_score, interest_score, score_explanation_json FROM repositories WHERE id=?", (rid,)).fetchone()
    conn.close()
    assert row["growth_score"] is None  # must NOT be 0
    assert row["interest_score"] is not None
    assert "growth" in row["score_explanation_json"]


def test_growth_computed_with_two_snapshots(test_db):
    rid = _seed_repo(test_db)
    conn = connect(test_db)
    conn.execute("DELETE FROM repository_snapshots WHERE repository_id=?", (rid,))
    conn.execute("INSERT INTO repository_snapshots(repository_id,captured_at,stars,forks,open_issues) VALUES (?,?,?,?,?)",
                 (rid, "2026-11-01T00:00:00Z", 900, 70, 10))
    conn.execute("INSERT INTO repository_snapshots(repository_id,captured_at,stars,forks,open_issues) VALUES (?,?,?,?,?)",
                 (rid, "2026-11-09T00:00:00Z", 1200, 80, 10))
    conn.commit(); conn.close()
    recalculate_repo_scores(rid, test_db)
    conn = connect(test_db)
    row = conn.execute("SELECT growth_score FROM repositories WHERE id=?", (rid,)).fetchone()
    conn.close()
    assert row["growth_score"] is not None
    assert row["growth_score"] > 0


def test_configurable_weights(test_db, monkeypatch):
    rid = _seed_repo(test_db)
    from app.services import settings_service
    settings_service.update_settings({"ranking.weights": {"growth": 0.0, "activity": 0.0, "maintenance": 0.0, "relevance": 0.0, "popularity": 1.0}}, test_db)
    recalculate_repo_scores(rid, test_db)
    conn = connect(test_db)
    row = conn.execute("SELECT popularity_score, interest_score FROM repositories WHERE id=?", (rid,)).fetchone()
    conn.close()
    assert abs(row["interest_score"] - row["popularity_score"]) < 0.001
