from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import API_VERSION, CORS_ORIGINS
from app.db.migrations import apply_migrations
from app.db.seed import seed_defaults
from app.errors import register_error_handlers
from app.routers import ideas, news, overview, repositories, saved, search, settings, sources, system


@asynccontextmanager
async def lifespan(_app: FastAPI):
    apply_migrations()
    seed_defaults()
    yield


app = FastAPI(title="TechPulse API", version=API_VERSION, lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
register_error_handlers(app)

api = FastAPI(title="TechPulse API v1")
register_error_handlers(api)
for r in (system.router, settings.router, sources.router, repositories.router, news.router, ideas.router, saved.router, overview.router, search.router):
    api.include_router(r)

app.mount("/api/v1", api)


@app.get("/")
def root():
    return {"name": "TechPulse API", "version": API_VERSION, "api": "/api/v1"}
