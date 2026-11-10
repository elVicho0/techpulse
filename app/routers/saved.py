from __future__ import annotations

from fastapi import APIRouter, Response

from app.services.saved_service import list_saved, save_item, unsave_item

router = APIRouter(tags=["saved"])


@router.get("/saved")
def get_saved(type: str | None = None, page: int = 1, page_size: int = 20):
    return list_saved(item_type=type, page=page, page_size=page_size)


@router.post("/saved", status_code=201)
def post_saved(body: dict):
    return save_item(body.get("item_type"), int(body.get("item_id")), body.get("notes"))


@router.delete("/saved/{item_type}/{item_id}", status_code=204)
def delete_saved(item_type: str, item_id: int):
    unsave_item(item_type, item_id)
    return Response(status_code=204)
