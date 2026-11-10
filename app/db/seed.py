from __future__ import annotations

import json
from pathlib import Path

from app.config import DEFAULT_SETTINGS
from app.db.connection import connect
from app.utils.time import utc_now_iso

# GitHub query templates from docs/source-policy.md §3.4 (15 queries). Rotated by worker.
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

# 16 approved RSS feeds (initial defaults; public syndication feeds). Config-driven, adjustable.
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
    {"key": "rss_ars_technica", "name": "Ars Technica", "url": "https://feeds.arstechnica.com/arstechnica/index", "category": "dev", "priority": "medium", "interval": 120},
    {"key": "rss_techcrunch_ai", "name": "TechCrunch AI", "url": "https://techcrunch.com/category/artificial-intelligence/feed/", "category": "ai", "priority": "high", "interval": 60},
    {"key": "rss_mit_tech_review", "name": "MIT Technology Review", "url": "https://www.technologyreview.com/feed/", "category": "product", "priority": "medium", "interval": 120},
    {"key": "rss_stackoverflow_blog", "name": "Stack Overflow Blog", "url": "https://stackoverflow.blog/feed/", "category": "dev", "priority": "low", "interval": 180},
    {"key": "rss_python_insider", "name": "Python Insider", "url": "https://blog.python.org/feeds/posts/default?alt=rss", "category": "dev", "priority": "low", "interval": 180},
]


def seed_defaults(db_path: str | Path | None = None) -> None:
    now = utc_now_iso()
    conn = connect(db_path)
    try:
        # Settings
        for key, value in DEFAULT_SETTINGS.items():
            conn.execute(
                "INSERT OR IGNORE INTO settings(key, value_json, updated_at) VALUES (?, ?, ?)",
                (key, json.dumps(value), now),
            )

        # GitHub search source
        conn.execute(
            """
            INSERT OR IGNORE INTO sources(key, name, kind, category, enabled, interval_minutes, config_json, created_at, updated_at)
            VALUES (?, ?, 'github_api', 'github', 1, 240, ?, ?, ?)
            """,
            (
                "github_search_trending",
                "GitHub Trending Search",
                json.dumps({"queries": GITHUB_QUERIES, "per_page": 50, "max_pages": 2, "rotation_index": 0}),
                now,
                now,
            ),
        )
        conn.execute(
            """
            INSERT OR IGNORE INTO sources(key, name, kind, category, enabled, interval_minutes, config_json, created_at, updated_at)
            VALUES (?, ?, 'github_api', 'github', 1, 720, ?, ?, ?)
            """,
            (
                "github_repo_details",
                "GitHub Repo Details",
                json.dumps({"refresh_limit": 50, "include_readme": True}),
                now,
                now,
            ),
        )
        # Internal jobs
        for key, name, interval, cfg in [
            ("internal_score_recompute", "Score Recompute", 1440, {"job_type": "score_recompute"}),
            ("internal_link_verification", "Link Verification", 10080, {"job_type": "link_verification", "batch_size": 100}),
            ("internal_retention_cleanup", "Retention Cleanup", 1440, {"job_type": "retention_cleanup"}),
            ("internal_ideas_auto", "Ideas Auto Generation", 360, {"job_type": "ideas_auto"}),
        ]:
            conn.execute(
                """
                INSERT OR IGNORE INTO sources(key, name, kind, category, enabled, interval_minutes, config_json, created_at, updated_at)
                VALUES (?, ?, 'internal', 'other', 1, ?, ?, ?, ?)
                """,
                (key, name, interval, json.dumps(cfg), now, now),
            )

        # RSS feeds (16 approved defaults)
        for feed in RSS_FEEDS:
            conn.execute(
                """
                INSERT OR IGNORE INTO sources(key, name, kind, category, enabled, interval_minutes, config_json, created_at, updated_at)
                VALUES (?, ?, 'rss', 'news', 1, ?, ?, ?, ?)
                """,
                (
                    feed["key"],
                    feed["name"],
                    feed["interval"],
                    json.dumps(
                        {
                            "feed_url": feed["url"],
                            "category": feed["category"],
                            "priority": feed["priority"],
                            "max_items": 100,
                        }
                    ),
                    now,
                    now,
                ),
            )
        conn.commit()
    finally:
        conn.close()
