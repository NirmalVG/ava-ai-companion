"""
Ava Backend — main.py
"""

from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

# 1. LOAD ENVIRONMENT VARIABLES FIRST
BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env.local")
load_dotenv(BASE_DIR / ".env")

# 2. IMPORT INTERNAL MODULES
from database import init_db
from routers import chat, memory, plugins, settings, voice, vision, context, skills, search

app = FastAPI(
    title="Ava API",
    description="Advanced personal assistant backend",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "https://ava-ai-companion.vercel.app"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 3. INITIALIZE DATABASE
init_db()

# 4. REGISTER ROUTERS
app.include_router(chat.router,     prefix="/chat",     tags=["chat"])
app.include_router(memory.router,   prefix="/memory",   tags=["memory"])
app.include_router(plugins.router,  prefix="/plugins",  tags=["plugins"])
app.include_router(settings.router, prefix="/settings", tags=["settings"])
app.include_router(voice.router,    prefix="/voice",    tags=["voice"])
app.include_router(vision.router,   prefix="/vision",   tags=["vision"])
app.include_router(context.router,  prefix="/context",  tags=["context"])
app.include_router(skills.router,   prefix="/skills",   tags=["skills"])
app.include_router(search.router,   prefix="/search",   tags=["search"])


@app.get("/healthz", tags=["ops"])
def health_check():
    return {"status": "ok", "version": "0.1.0"}


@app.get("/", tags=["ops"])
def read_root():
    return {"message": "Ava API is online."}