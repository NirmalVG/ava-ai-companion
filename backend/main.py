"""
Ava Backend — main.py
Entry point for the FastAPI application.

Why load_dotenv() here?
  It reads the .env file and injects vars into os.environ BEFORE
  any other module imports them. Order matters.

Why CORS middleware?
  The browser blocks requests from localhost:3000 → localhost:8000
  unless the server explicitly says "that origin is allowed".
  In production you'll replace allow_origins with your real domain.
"""

from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

# 1. LOAD ENVIRONMENT VARIABLES FIRST
# This must happen before importing any internal modules that require these variables.
BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env.local")
load_dotenv(BASE_DIR / ".env")

# 2. IMPORT INTERNAL MODULES
from routers import chat

app = FastAPI(
    title="Ava API",
    description="AGI-level personal assistant backend",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000", 
        "http://127.0.0.1:3000",
        "https://ava-ai-companion.vercel.app/" 
    ],  
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers — each router owns its slice of the API.
# Later we'll add: memory, tools, plugins, privacy
app.include_router(chat.router, prefix="/chat", tags=["chat"])


@app.get("/healthz", tags=["ops"])
def health_check():
    """Liveness probe. Kubernetes (and you) can ping this to confirm the server is up."""
    return {"status": "ok", "version": "0.1.0"}
