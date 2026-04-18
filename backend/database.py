"""
database.py — SQLite connection + schema bootstrap

Why SQLite for now?
  Zero configuration, single file, perfect for solo/small-team use.
  When you're ready to scale, swap the DATABASE_URL to PostgreSQL
  and everything else stays identical (SQLAlchemy handles the diff).
"""

import os
from pathlib import Path
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, DeclarativeBase

BASE_DIR = Path(__file__).resolve().parent
DB_PATH = os.environ.get("DATABASE_URL", f"sqlite:///{BASE_DIR}/ava.db")

# connect_args only needed for SQLite (allows multi-thread access)
engine = create_engine(
    DB_PATH,
    connect_args={"check_same_thread": False} if "sqlite" in DB_PATH else {},
    echo=False,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

class Base(DeclarativeBase):
    pass

def init_db():
    """Create all tables if they don't exist. Called once at startup."""
    from models import Conversation, Message  # noqa: F401 — import triggers table registration
    Base.metadata.create_all(bind=engine)

def get_db():
    """FastAPI dependency — yields a DB session and closes it after the request."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()