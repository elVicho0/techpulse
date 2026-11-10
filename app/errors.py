from __future__ import annotations

import uuid
from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse


def _err(code: str, message: str, status: int, details=None):
    return JSONResponse(
        status_code=status,
        content={"error": {"code": code, "message": message, "details": details, "request_id": f"req_{uuid.uuid4().hex[:12]}"}},
    )


def register_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(HTTPException)
    async def http_exc(_request: Request, exc: HTTPException):
        detail = exc.detail
        if isinstance(detail, dict) and "code" in detail:
            code = detail.get("code", "ERROR")
            msg = detail.get("message", str(detail))
            det = detail.get("details")
            return _err(code, msg, exc.status_code, det)
        code_map = {404: "NOT_FOUND", 409: "CONFLICT", 422: "VALIDATION_ERROR", 503: "SOURCE_UNAVAILABLE"}
        return _err(code_map.get(exc.status_code, "ERROR"), str(detail), exc.status_code)

    @app.exception_handler(RequestValidationError)
    async def val_exc(_request: Request, exc: RequestValidationError):
        return _err("VALIDATION_ERROR", "Request validation failed", 422, {"errors": exc.errors()})

    @app.exception_handler(Exception)
    async def unhandled(_request: Request, exc: Exception):
        return _err("INTERNAL_ERROR", "Internal server error", 500)
