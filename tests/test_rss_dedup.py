from app.connectors.rss import run_rss_source
from app.db.connection import connect
from app.services.news_service import upsert_news_item


def _rss_source(test_db):
    conn = connect(test_db)
    r = conn.execute("SELECT * FROM sources WHERE kind='rss' LIMIT 1").fetchone()
    src = dict(r)
    import json; src["config"] = json.loads(src["config_json"])
    conn.close(); return src


def test_news_dedup_by_url_hash(test_db):
    src = _rss_source(test_db)
    n1, new1 = upsert_news_item({"title":"A","url":"https://example.com/a?utm_source=x","summary":"s","external_id":"1"}, src["id"], db_path=test_db)
    n2, new2 = upsert_news_item({"title":"A2","url":"https://EXAMPLE.com/a/","summary":"s2","external_id":"2"}, src["id"], db_path=test_db)
    assert n1 == n2
    assert new1 is True and new2 is False
    conn = connect(test_db)
    assert conn.execute("SELECT COUNT(*) c FROM news_items").fetchone()["c"] == 1
    assert conn.execute("SELECT COUNT(*) c FROM news_item_sources WHERE news_id=?", (n1,)).fetchone()["c"] == 1
    conn.close()


def test_16_rss_feeds_seeded(test_db):
    conn = connect(test_db)
    rows = conn.execute("SELECT key, config_json FROM sources WHERE kind='rss' ORDER BY key").fetchall()
    assert len(rows) == 16
    for r in rows:
        assert "feed_url" in r["config_json"]
    conn.close()


def test_rss_conditional_not_modified(test_db, monkeypatch):
    import httpx
    class FakeClient:
        def __init__(self, *a, **k): pass
        def get(self, url, headers=None):
            if headers and headers.get("If-None-Match") == "etag1":
                return httpx.Response(304, headers={"ETag": "etag1"})
            return httpx.Response(200, content=b"""<?xml version='1.0'?><rss><channel>
                <item><title>T</title><link>https://example.com/t</link><guid>g1</guid></item>
            </channel></rss>""", headers={"ETag": "etag1"})
        def close(self): pass
    src = _rss_source(test_db)
    src["config"]["feed_url"] = "https://feed.example/rss"
    s1 = run_rss_source(src, test_db, client=FakeClient())
    assert s1["items_fetched"] == 1
    s2 = run_rss_source(src, test_db, client=FakeClient())
    assert s2["not_modified"] is True
