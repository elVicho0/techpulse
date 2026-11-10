"""Compatibility shim. Use app.db.connection/app.db.migrations instead."""
from app.db.connection import connect, db_session, get_connection  # noqa: F401
from app.db.migrations import apply_migrations  # noqa: F401


def init_db():
    apply_migrations()
