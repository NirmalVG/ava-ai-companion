"""
routers/chat.py

The router handles SSE streaming from the agentic loop.
Loads installed plugins and user tone settings before each request
and passes them into stream_chat.

SSE event types forwarded to the frontend:
  data: {"type": "token",       "content": "..."}
  data: {"type": "tool_start",  "name": "...", "args": {...}}
  data: {"type": "tool_result", "name": "...", "result": "..."}
  data: {"type": "error",       "content": "..."}
  data: [DONE]
"""

import json
from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db
from services.groq_service import stream_chat
from models import Plugin, UserSettings

router = APIRouter()

USER_ID = "operator_01"


# ── Schemas ──────────────────────────────────────────────────────
class Message(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    messages: list[Message]


# ── Route ────────────────────────────────────────────────────────
@router.post("/stream")
async def chat_stream(req: ChatRequest, db: Session = Depends(get_db)):
    """
    Streams Ava's response as Server-Sent Events.

    Before streaming, loads two things from the DB:
      1. installed_plugins — which tool_names this user has enabled
      2. tone              — the user's preferred response tone

    Both are passed into stream_chat so every request reflects
    the user's current settings without requiring a restart.
    """
    messages = [m.model_dump() for m in req.messages]

    # Load installed plugins for this user
    installed_plugins = [
        p.tool_name
        for p in db.query(Plugin)
        .filter(Plugin.user_id == USER_ID, Plugin.enabled == "true")
        .all()
    ]

    # Load tone preference (default to "balanced" if not set)
    user_settings = (
        db.query(UserSettings)
        .filter(UserSettings.user_id == USER_ID)
        .first()
    )
    tone = user_settings.tone if user_settings else "balanced"

    async def event_generator():
        try:
            async for event in stream_chat(
                messages,
                user_id=USER_ID,
                installed_plugins=installed_plugins,
                tone=tone,
            ):
                yield f"data: {json.dumps(event)}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'type': 'error', 'content': str(e)})}\n\n"
        finally:
            yield "data: [DONE]\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )