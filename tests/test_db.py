from app.db.connection import connect


def test_migrations_and_wal(test_db):
    conn = connect(test_db)
    try:
        mode = conn.execute("PRAGMA journal_mode").fetchone()[0]
        fk = conn.execute("PRAGMA foreign_keys").fetchone()[0]
        assert str(mode).lower() == "wal"
        assert fk == 1
        tables = {r[0] for r in conn.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()}
        for t in ["sources", "repositories", "repository_snapshots", "news_items", "settings", "source_runs", "job_requests"]:
            assert t in tables
        settings = conn.execute("SELECT COUNT(*) c FROM settings").fetchone()["c"]
        assert settings > 0
        rss = conn.execute("SELECT COUNT(*) c FROM sources WHERE kind='rss'").fetchone()["c"]
        assert rss == 16
    finally:
        conn.close()
