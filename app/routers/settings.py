from __future__ import annotations

from fastapi import APIRouter, Body

from app.services.settings_service import get_all_settings, update_settings, get_ranking_weights, update_ranking_weights

router = APIRouter(tags=["settings"])


@router.get("/settings")
def read_settings():
    return {"settings": get_all_settings()}


@router.put("/settings")
def write_settings(body: dict):
    return {"settings": update_settings(body)}


@router.get("/settings/weights")
def read_ranking_weights():
    """Devolver los weights de ranking activos (personal si existen, sino por defecto)."""
    return {"weights": get_ranking_weights()}


@router.put("/settings/weights")
def update_ranking_weights_endpoint(
    weights: dict[str, float] = Body(...),
) -> dict[str, float]:
    """Actualizar weights de ranking con normalización automática a suma 1.0."""
    return {"weights": update_ranking_weights(weights)}
