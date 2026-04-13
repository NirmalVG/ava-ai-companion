"""
routers/chat.py  (Step 2 — Tool Calling)

The router now handles 3 SSE event types from groq_service:
  - token       → stream text to the UI character by character
  - tool_start  → notify UI that a tool is being invoked
  - tool_result → notify UI that a tool has returned
  - error       → surface errors gracefully

The frontend uses the "type" field to decide how to render each event.
Token events build up the response text. Tool events show thinking steps.
"""

import json
from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from services.groq_service import stream_chat

router = APIRouter()


class Message(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    messages: list[Message]


@router.post("/stream")
async def chat_stream(req: ChatRequest):
    """
    Streams Ava's response as Server-Sent Events.
    Each event is a JSON object with a "type" field:

      data: {"type": "token", "content": "Hello"}\n\n
      data: {"type": "tool_start", "name": "get_weather", "args": {...}}\n\n
      data: {"type": "tool_result", "name": "get_weather", "result": "..."}\n\n
      data: [DONE]\n\n
    """
    messages = [m.model_dump() for m in req.messages]

    async def event_generator():
        try:
            async for event in stream_chat(messages):
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