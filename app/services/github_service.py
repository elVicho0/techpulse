from __future__ import annotations

import json
import os
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

import httpx
from fastapi import HTTPException

from app.config import (
    GITHUB_API_BASE,
    GITHUB_TIMEOUT_SECONDS,
    GITHUB_MAX_QUERIES_PER_CYCLE,
    GITHUB_SEARCH_CACHE_MINUTES,
    DEFAULT_SETTINGS,
)
from app.db.connection import connect
from app.services.ranking_service import recalculate_repo_scores
from app.utils.time import utc_now_iso


# GitHub search API public queries (15 queries). Rotated by worker.
# Endpoint público: GET /search/repositories - no requiere token obligatorio
GITHUB_QUERIES = [
    {"q": "topic:ai stars:>500 pushed:>__DATE_30__", "category": "ai", "subcategory": "agents"},
    {"q": "topic:llm-agents stars:>100", "category": "ai", "subcategory": "agents"},
    {"q": "topic:agent-framework stars:>100", "category": "ai", "subcategory": "agent_framework"},
    {"q": "topic:mcp stars:>50", "category": "ai", "subcategory": "mcp"},
    {"q": "topic:rag stars:>100", "category": "ai", "subcategory": "rag"},
    {"q": "topic:data-engineering stars:>300", "category": "data_engineering", "subcategory": "etl"},
    {"q": "topic:airflow stars:>300", "category": "data_engineering", "subcategory": "orchestration"},
    {"q": "topic:kafka stars:>500", "category": "data_engineering", "subcategory": "streaming"},
    {"q": "topic:dbt stars:>300", "category": "data_engineering", "subcategory": "etl"},
    {"q": "topic:spark stars:>500", "category": "data_engineering", "subcategory": "streaming"},
    {"q": "topic:machine-learning stars:>500", "category": "machine_learning", "subcategory": "models"},
    {"q": "topic:data-science stars:>300", "category": "data_science", "subcategory": None},
    {"q": "language:Python stars:>1000 created:>__DATE_30__", "category": "dev_tools", "subcategory": "framework"},
    {"q": "topic:automation stars:>200", "category": "ai", "subcategory": "automation"},
    {"q": "topic:llm stars:>300", "category": "ai", "subcategory": "llm"},
]


class GitHubRateLimiter:
    """Rate limiter basado en cabeceras X-RateLimit-* de GitHub.
    
    Límite público: 10 requests/minuto sin token.
    Con token: 5000 requests/hora aproximadamente.
    """
    
    def __init__(self):
        self.remaining = 10  # límite público por defecto
        self.reset_at = float('inf')  # Initialize far in future to allow queries
        self.has_token = False
    
    def update_from_headers(self, headers: dict[str, str | bytes | None]) -> None:
        """Actualizar límite desde cabeceras de respuesta HTTP."""
        try:
            if "x-ratelimit-remaining" in headers:
                self.remaining = int(headers["x-ratelimit-remaining"])
            if "x-ratelimit-reset" in headers:
                reset_ts = int(headers["x-ratelimit-reset"])
                # Always keep reset_at at least 1 second in the future
                self.reset_at = max(
                    self.reset_at, 
                    datetime.fromtimestamp(reset_ts, tz=timezone.utc).timestamp() + 1
                )
            if "authorization" in headers:
                self.has_token = bool(headers["authorization"])
        except (ValueError, TypeError):
            pass
    
    def can_make_query(self) -> bool:
        """Verificar si podemos hacer una query lógica."""
        now = datetime.now(timezone.utc).timestamp()
        return self.remaining > 0 and now < self.reset_at
    
    def check_limit(self) -> bool:
        """Verificar si podemos continuar."""
        return self.can_make_query()


github_rate_limiter = GitHubRateLimiter()


def _normalize_query(q: str) -> str:
    """Normalizar query reemplazando __DATE_30__ por fecha real."""
    now = datetime.now(timezone.utc)
    thirty_days_ago = (now - timedelta(days=30)).strftime("%Y-%m-%dT%H:%M:%SZ")
    return q.replace("__DATE_30__", thirty_days_ago)


def _execute_github_search(query: str, per_page: int = 50, max_pages: int = 2) -> dict[str, Any]:
    """Ejecutar búsqueda contra la GitHub Search API (público o con token).
    
    Uses GET /search/repositories for public searches.
    With token: improves limits.
    
    Returns parsed JSON response or raises HTTPException.
    """
    github_token = os.getenv("TECHPULSE_GITHUB_TOKEN")
    
    url = f"{GITHUB_API_BASE}/search/repositories"
    headers = {
        "Accept": "application/vnd.github+json",
        "User-Agent": "TechPulse/0.1 (+local; tech repositories dashboard)",
    }
    
    if github_token:
        headers["Authorization"] = f"Bearer {github_token}"
    
    params = {
        "q": query,
        "per_page": per_page,
        "page": 1,
    }
    
    with httpx.Client(timeout=GITHUB_TIMEOUT_SECONDS) as client:
        try:
            response = client.get(url, params=params, headers=headers)
            github_rate_limiter.update_from_headers(response.headers)
            
            if response.status_code == 403:
                reset_header = response.headers.get("x-ratelimit-reset", "")
                raise HTTPException(
                    status_code=429,
                    detail={
                        "code": "RATE_LIMIT_EXCEEDED",
                        "message": "GitHub rate limit exceeded",
                        "details": {"reset_at": reset_header},
                        "has_token": github_rate_limiter.has_token,
                    },
                )
            
            if response.status_code == 404:
                return {"items": [], "total_count": 0}
            
            if response.status_code != 200:
                raise HTTPException(
                    status_code=response.status_code,
                    detail={"code": "GITHUB_API_ERROR", "message": f"GitHub API error: {response.status_code}"},
                )
            
            return response.json()
        
        except httpx.TimeoutException:
            raise HTTPException(
                status_code=408,
                detail={"code": "GITHUB_TIMEOUT", "message": "Timeout en consulta GitHub"},
            )
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=503, detail={"code": "GITHUB_CONNECTION_ERROR", "message": str(e)})


def _parse_github_search_results(data: dict[str, Any]) -> list[dict[str, Any]]:
    """Parsear resultados de search de repositorios GitHub.
    
    GitHub /search/repositories puede retornar items con los campos del repositorio
    directamente (top-level) o con un nested 'repository' key. Maneja ambos casos.
    """
    items = data.get("items", [])
    repositories = []
    
    for item in items:
        # Case 1: nested 'repository' key (legacy/code search style)
        repo = item.get("repository")
        if repo and isinstance(repo, dict):
            pass  # Usar repository anidado
        # Case 2: fields are top-level in the item (search repos style)
        else:
            # Usar el item mismo como repo dict
            repo = item
        
        if not repo or not isinstance(repo, dict):
            continue
        
        # Extraer datos del repo (pueden estar anidados o top-level)
        # Priority: nested repository > top-level item
        owner = repo.get("owner") or repo.get("owner_login", "")
        if isinstance(owner, dict):
            owner_login = owner.get("login", "")
        else:
            owner_login = owner or ""
        
        full_name = repo.get("full_name") or f"{owner_login}/{repo.get('name', '')}"
        topics = repo.get("topics") or []
        if not isinstance(topics, list):
            topics = []
        
        normalized = {
            "id": repo.get("id") or repo.get("node_id"),
            "full_name": full_name,
            "owner_login": owner_login,
            "name": repo.get("name") or repo.get("full_name", "").split("/")[-1] if "/" in full_name else "",
            "description": repo.get("description"),
            "html_url": repo.get("html_url") or repo.get("url"),
            "homepage": repo.get("homepage"),
            "language": repo.get("language"),
            "stargazers_count": repo.get("stargazers_count") or 0,
            "forks_count": repo.get("forks_count") or 0,
            "open_issues_count": repo.get("open_issues_count") or 0,
            "watchers_count": repo.get("watchers_count") or 0,
            "created_at": repo.get("created_at"),
            "updated_at": repo.get("updated_at"),
            "pushed_at": repo.get("pushed_at"),
            "license_spdx": (repo.get("license") or {}).get("spdx_id") if isinstance(repo.get("license"), dict) else None,
            "license_name": (repo.get("license") or {}).get("name") if isinstance(repo.get("license"), dict) else None,
            "archived": repo.get("archived", False),
            "disabled": repo.get("disabled", False),
            "fork": repo.get("fork", False),
            "topics": topics,
            "score_explanation_json": json.dumps({
                "popularity": 0.5, "growth": 0.3, "activity": 0.5,
                "maintenance": 0.5, "relevance": 0.5, "interest": 0.5, "quality": 0.5,
            }),
        }
        repositories.append(normalized)
    
    return repositories


def run_github_search_cycle(
    db_path: str | Path | None = None,
    cycle_queries: int | None = None,
) -> dict[str, Any]:
    """Ejecutar un ciclo de búsqueda GitHub.
    
    Key Feature: Funciona SIN token (búsqueda pública de repositorios).
    Opcional: Con token TECHPULSE_GITHUB_TOKEN, mejora los límites.
    
    Returns dict con estadísticas del ciclo.
    """
    conn = connect(db_path)
    try:
        now = utc_now_iso()
        max_queries = cycle_queries or GITHUB_MAX_QUERIES_PER_CYCLE
        
        rotation_index = 0
        try:
            settings = DEFAULT_SETTINGS
            rotation_index = settings.get("github.rotation_index", 0)
        except Exception:
            pass
        
        rotated_queries = GITHUB_QUERIES[rotation_index : rotation_index + max_queries]
        if len(rotated_queries) < max_queries:
            wrapped = GITHUB_QUERIES[rotation_index :] + GITHUB_QUERIES[: (max_queries - len(rotated_queries))]
            rotated_queries = wrapped
        
        total_repos = 0
        repos_new = 0
        repos_updated = 0
        queries_executed = 0
        
        for query_config in rotated_queries:
            if not github_rate_limiter.can_make_query():
                break
            
            try:
                normalized_query = _normalize_query(query_config["q"])
                result = _execute_github_search(normalized_query)
                queries_executed += 1
                github_rate_limiter.update_from_headers(result.headers if hasattr(result, 'headers') else {})
                
                repos = _parse_github_search_results(result)
                
                category = query_config.get("category", "other")
                subcategory = query_config.get("subcategory", None)
                
                for repo_data in repos:
                    total_repos += 1
                    
                    from app.services.repo_service import upsert_repository
                    
                    source_id = 1
                    repo_id, is_new = upsert_repository(repo_data, source_id, db_path)
                    
                    if is_new:
                        repos_new += 1
                    else:
                        repos_updated += 1
                
                time.sleep(0.3)
                
            except HTTPException as e:
                break
            except Exception as e:
                break
        
        try:
            new_index = (rotation_index + queries_executed) % 15
            conn.execute(
                "INSERT INTO settings(key, value_json, updated_at) VALUES (?, ?, ?) "
                "ON CONFLICT(key) DO UPDATE SET value_json=excluded.value_json, updated_at=excluded.updated_at",
                ("github.rotation_index", json.dumps(new_index), now),
            )
            # Update discovered_count: accumulate new repos found across cycles
            try:
                current_discovered = settings.get("github.discovered_count", 0) or 0
                new_discovered = current_discovered + result["repos_new"]
                conn.execute(
                    "INSERT INTO settings(key, value_json, updated_at) VALUES (?, ?, ?) "
                    "ON CONFLICT(key) DO UPDATE SET value_json=excluded.value_json, updated_at=excluded.updated_at",
                    ("github.discovered_count", json.dumps(new_discovered), now),
                )
            except Exception:
                pass
            conn.commit()
        except Exception:
            pass
        
        return {
            "queries_executed": queries_executed,
            "repos_found": total_repos,
            "repos_new": repos_new,
            "repos_updated": repos_updated,
            "cycle_completed_at": now,
            "has_token": github_rate_limiter.has_token,
        }
    
    finally:
        conn.close()