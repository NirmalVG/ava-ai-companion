"""
routers/chat.py
"""

import json
from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db
from services.groq_service import stream_chat
from models import Plugin, UserSettings
from services.plugin_registry import BUILTIN_HANDLERS, get_dynamic_plugins

router = APIRouter()

USER_ID = "operator_01"


class Message(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    messages: list[Message]


@router.post("/stream")
async def chat_stream(req: ChatRequest, db: Session = Depends(get_db)):
    messages = [m.model_dump() for m in req.messages]

    # Load installed built-in plugins
    installed_builtin_plugins = [
        p.tool_name
        for p in db.query(Plugin)
        .filter(
            Plugin.user_id == USER_ID,
            Plugin.enabled == "true",
        )
        .all()
    ]


    # Load dynamic (uploaded/GitHub) skills
    dynamic_handlers, dynamic_schemas = get_dynamic_plugins(db, USER_ID)

    # Load tone
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
                installed_plugins=installed_builtin_plugins,
                tone=tone,
                dynamic_handlers=dynamic_handlers,
                dynamic_schemas=dynamic_schemas,
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