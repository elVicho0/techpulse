from __future__ import annotations

from fastapi import APIRouter, Response

from app.services.news_service import get_news, list_news
from app.services.saved_service import save_item, unsave_item

router = APIRouter(tags=["news"])


@router.get("/news")
def news(page: int = 1, page_size: int = 20, q: str | None = None, period: str = "7d", category: str | None = None,
         importance: str | None = None, source_id: int | None = None, saved: bool | None = None, sort: str = "published", order: str = "desc"):
    return list_news(page=page, page_size=page_size, q=q, period=period, category=category, importance=importance, source_id=source_id, saved=saved, sort=sort, order=order)


@router.get("/news/{news_id}")
def news_detail(news_id: int):
    return get_news(news_id)


@router.post("/news/{news_id}/save", status_code=201)
def save_news(news_id: int):
    return save_item("news", news_id)


@router.delete("/news/{news_id}/save", status_code=204)
def unsave_news(news_id: int):
    unsave_item("news", news_id)
    return Response(status_code=204)
