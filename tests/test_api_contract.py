def test_health(client):
    r = client.get("/api/v1/health")
    assert r.status_code == 200
    b = r.json()
    for k in ["status", "version", "database", "worker", "time"]:
        assert k in b
    assert b["database"] == "ok"


def test_worker_capabilities_settings(client):
    assert client.get("/api/v1/worker/status").status_code == 200
    cap = client.get("/api/v1/capabilities").json()
    assert "github_token_configured" in cap
    assert "embeddings" in cap
    s = client.get("/api/v1/settings").json()["settings"]
    assert "ranking.weights" in s
    assert s["embeddings.auto_download"] is False


def test_sources_and_jobs(client):
    src = client.get("/api/v1/sources").json()
    assert src["items"]
    sid = src["items"][0]["id"]
    r = client.post(f"/api/v1/sources/{sid}/run")
    assert r.status_code == 202
    b = r.json()
    assert b["request_id"] > 0
    assert b["status"] == "pending"
    assert "worker_state" in b
    jobs = client.get("/api/v1/jobs").json()
    assert "items" in jobs and "has_next" in jobs


def test_repositories_news_pagination_shape(client):
    for path in ["/api/v1/repositories", "/api/v1/news", "/api/v1/runs", "/api/v1/jobs"]:
        r = client.get(path)
        assert r.status_code == 200
        b = r.json()
        for k in ["items", "page", "page_size", "total", "has_next"]:
            assert k in b


def test_embeddings_semantic_unavailable(client):
    r = client.get("/api/v1/search?q=agent&mode=semantic")
    assert r.status_code == 503
    assert r.json()["error"]["code"] == "EMBEDDINGS_UNAVAILABLE"


def test_overview(client):
    r = client.get("/api/v1/overview")
    assert r.status_code == 200
    b = r.json()
    assert "counts" in b and "summary_text" in b
