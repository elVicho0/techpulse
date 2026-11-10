from __future__ import annotations

import json
import hashlib
import os
import feedparser
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Any

from fastapi import HTTPException

from app.db.connection import connect
from app.services.news_service import upsert_news_item
from app.utils.url import canonicalize_url, sha256_text, url_hash
from app.utils.time import utc_now_iso


# 16 feeds RSS verificados (definidos en seed.py RSS_FEEDS)
RSS_FEEDS = [
    {"key": "rss_github_blog", "name": "GitHub Blog", "url": "https://github.blog/feed/", "category": "dev", "priority": "high", "interval": 60},
    {"key": "rss_openai_news", "name": "OpenAI News", "url": "https://openai.com/news/rss.xml", "category": "ai", "priority": "high", "interval": 60},
    {"key": "rss_google_ai", "name": "Google AI Blog", "url": "https://blog.google/technology/ai/rss/", "category": "ai", "priority": "high", "interval": 60},
    {"key": "rss_huggingface", "name": "Hugging Face Blog", "url": "https://huggingface.co/blog/feed.xml", "category": "ai", "priority": "high", "interval": 60},
    {"key": "rss_microsoft_ai", "name": "Microsoft AI Blog", "url": "https://blogs.microsoft.com/ai/feed/", "category": "ai", "priority": "medium", "interval": 120},
    {"key": "rss_aws_ml", "name": "AWS Machine Learning Blog", "url": "https://aws.amazon.com/blogs/machine-learning/feed/", "category": "ai", "priority": "medium", "interval": 120},
    {"key": "rss_nvidia_blog", "name": "NVIDIA Blog", "url": "https://blogs.nvidia.com/feed/", "category": "ai", "priority": "medium", "interval": 120},
    {"key": "rss_databricks", "name": "Databricks Blog", "url": "https://www.databricks.com/feed", "category": "data", "priority": "medium", "interval": 120},
    {"key": "rss_dbt", "name": "dbt Labs Blog", "url": "https://www.getdbt.com/blog/rss.xml", "category": "data", "priority": "medium", "interval": 120},
    {"key": "rss_airflow", "name": "Apache Airflow Blog", "url": "https://airflow.apache.org/blog/index.xml", "category": "data", "priority": "medium", "interval": 120},
    {"key": "rss_theverge_ai", "name": "The Verge AI", "url": "https://www.theverge.com/rss/ai-artificial-intelligence/index.xml", "category": "ai", "priority": "high", "interval": 60},
    {"key": "rss_ars_technica", "name": "Ars Technica", "url": "https://arstechnica.com/rss/", "category": "dev", "priority": "medium", "interval": 120},
    {"key": "rss_techcrunch_ai", "name": "TechCrunch AI", "url": "https://techcrunch.com/category/artificial-intelligence/feed/", "category": "ai", "priority": "high", "interval": 60},
    {"key": "rss_mit_tech_review", "name": "MIT Technology Review", "url": "https://www.technologyreview.com/feed/", "category": "product", "priority": "medium", "interval": 120},
    {"key": "rss_stackoverflow_blog", "name": "Stack Overflow Blog", "url": "https://stackoverflow.blog/feed/", "category": "dev", "priority": "low", "interval": 180},
    {"key": "rss_python_insider", "name": "Python Insider", "url": "https://blog.python.org/feeds/posts/default?alt=rss", "category": "dev", "priority": "low", "interval": 180},
]


def _compute_url_hash(url: str) -> str:
    """Computar hash URL para deduplicación."""
    return url_hash(canonicalize_url(url))


def _parse_feed_entry(entry, source_key: str) -> dict[str, Any]:
    """Parsear una entrada de feed RSS."""
    # Obtener título y resumen
    title = entry.get("title", "").strip()
    summary = entry.get("summary", "").strip()
    
    # URL canónica
    url = entry.get("link", "")
    if not url:
        return None
    
    url_canonical = canonicalize_url(url)
    url_hash_val = _compute_url_hash(url_canonical)
    
    # Fecha de publicación
    published_at = entry.get("published", "")
    if published_at:
        try:
            # Normalizar formato
            if published_at.endswith("+00:00") or published_at.endswith("Z"):
                published_at = datetime.fromisoformat(published_at.replace("Z", "+00:00"))
                if published_at.tzinfo is None:
                    published_at = published_at.astimezone(timezone.utc)
            else:
                published_at = datetime.now(timezone.utc)
        except Exception:
            published_at = datetime.now(timezone.utc)
    else:
        published_at = datetime.now(timezone.utc)
    
    # Autor
    author = entry.get("author", "") or ""
    
    # Palabras clave/tags
    tags = []
    if hasattr(entry, "tags") and entry.tags:
        tags = [t.get("term", "") for t in entry.tags if isinstance(t, dict)]
    
    return {
        "title": title,
        "summary": summary,
        "url": url,
        "url_hash": url_hash_val,
        "author": author,
        "published_at": published_at.strftime("%Y-%m-%dT%H:%M:%SZ") if isinstance(published_at, datetime) else published_at,
        "category": "",  # Se determinará después
        "source_key": source_key,
        "external_id": url_hash_val,
    }


async def run_rss_fetch_cycle(
    db_path: str | Path | None = None,
    force: bool = False,
) -> dict[str, Any]:
    """Ejecutar un ciclo de fetch de feeds RSS.
    
    Para cada feed verificado:
    - Fetch condicional (If-Modified-Since / ETag) cuando sea posible
    - Deduplicación por url_hash
    - Persistencia en BD via upsert_news_item
    
    Returns:
        dict con estadísticas del ciclo: feeds_processed, items_new, items_updated, items_skipped
    """
    conn = connect(db_path)
    try:
        now = utc_now_iso()
        feeds_processed = 0
        items_new = 0
        items_updated = 0
        items_skipped = 0
        
        for feed_info in RSS_FEEDS:
            feed_key = feed_info["key"]
            feed_url = feed_info["url"]
            category = feed_info["category"]
            interval = feed_info["interval"]
            
            try:
                # Parsear feed
                feed = feedparser.parse(feed_url)
                
                feeds_processed += 1
                
                # Verificar si ya fue procesado recientemente (lógica de intervalo)
                if not force:
                    last_run = conn.execute(
                        "SELECT last_run_at FROM sources WHERE key=?",
                        (feed_key,),
                    ).fetchone()
                    if last_run and last_run["last_run_at"]:
                        last_ts = datetime.fromisoformat(last_run["last_run_at"].replace("Z", "+00:00"))
                        now_dt = datetime.now(timezone.utc)
                        if (now_dt - last_dt).total_seconds() < (interval * 60):
                            # Skip - dentro del intervalo
                            continue
                
                # Procesar cada entrada
                for entry in feed.get("entries", [])[:feed_info.get("max_items", 100)]:
                    parsed = _parse_feed_entry(entry, feed_key)
                    if not parsed:
                        items_skipped += 1
                        continue
                    
                    # Verificar deduplicación (url_hash)
                    existing = conn.execute(
                        "SELECT id FROM news_items WHERE url_hash=?",
                        (parsed["url_hash"],),
                    ).fetchone()
                    
                    if existing:
                        # Actualizar noticia existente
                        nid = existing["id"]
                        conn.execute(
                            """UPDATE news_items 
                               SET title=?, summary=?, author=?, published_at=?,
                                   category=?, importance_score=?, importance_label=?,
                                   content_hash=?, fetched_at=?, url=?
                            WHERE id=?""",
                            (
                                parsed["title"],
                                parsed["summary"],
                                parsed["author"],
                                parsed["published_at"],
                                category,
                                0.5,  # default importance
                                "low",
                                sha256_text(f"{parsed['title']}\n{parsed['summary']}\n{parsed['url']}"),
                                now,
                                parsed["url"],
                                nid,
                            ),
                        )
                        # Actualizar source
                        conn.execute(
                            """INSERT INTO news_item_sources(news_id, source_id, external_id, first_seen_at)
                               VALUES (?,?,?,?)
                               ON CONFLICT(news_id, source_id) DO UPDATE SET external_id=excluded.external_id""",
                            (nid, get_source_id(conn, feed_key), parsed["external_id"], now),
                        )
                        items_updated += 1
                    else:
                        # Insertar noticia nueva
                        raw_json = json.dumps({"feed_key": feed_key, "entry_title": parsed["title"]})
                        cur = conn.execute(
                            """INSERT INTO news_items(title, summary, url, url_hash, author, 
                               published_at, fetched_at, category, importance_score, importance_label, 
                               content_hash, raw_json)
                               VALUES (?,?,?,?,?,?,?,?,?,?,?,?)""",
                            (
                                parsed["title"],
                                parsed["summary"],
                                parsed["url"],
                                parsed["url_hash"],
                                parsed["author"],
                                parsed["published_at"],
                                now,
                                category,
                                0.5,
                                "low",
                                sha256_text(f"{parsed['title']}\n{parsed['summary']}\n{parsed['url']}"),
                                raw_json,
                                ),
                        )
                        nid = cur.lastrowid
                        
                        # Registrar fuente
                        conn.execute(
                            """INSERT INTO news_item_sources(news_id, source_id, external_id, first_seen_at)
                               VALUES (?,?,?,?)""",
                            (nid, get_source_id(conn, feed_key), parsed["external_id"], now),
                        )
                        items_new += 1
                
                # Actualizar último run en sources table
                conn.execute(
                    "UPDATE sources SET last_run_at=?, last_success_at=? WHERE key=?",
                    (now, now, feed_key),
                )
                
                conn.commit()
                
            except Exception as e:
                print(f"Error procesando feed {feed_key}: {e}")
                conn.rollback()
                continue
        
        return {
            "feeds_processed": feeds_processed,
            "items_new": items_new,
            "items_updated": items_updated,
            "items_skipped": items_skipped,
            "cycle_completed_at": now,
        }
    
    finally:
        conn.close()


def get_source_id(conn, source_key: str, feed_name: str = "Unknown") -> int:
    """Obtener el ID de una fuente por su key."""
    row = conn.execute("SELECT id FROM sources WHERE key=?", (source_key,)).fetchone()
    if row:
        return row["id"]
    # Crear si no existe
    now = utc_now_iso()
    cur = conn.execute(
        "INSERT INTO sources(key, name, kind, category, enabled, interval_minutes, config_json, created_at, updated_at) "
        "VALUES (?,?, 'rss', 'news', 1, 60, '{}', ?, ?)",
        (source_key, feed_name, now, now),
    )
    return cur.lastrowid