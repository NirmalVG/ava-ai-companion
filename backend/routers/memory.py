"""
routers/memory.py — Conversation persistence + Memory Vault endpoints
"""

import uuid
import asyncio
from fastapi import APIRouter, Depends, BackgroundTasks
from sqlalchemy.orm import Session
from pydantic import BaseModel
from sqlalchemy import func

from database import get_db
from models import Conversation, Message, MemoryEntry
from services.memory_service import extract_and_save_memories

router = APIRouter()

USER_ID = "operator_01"
MAX_HISTORY = 40


# ── Schemas ──────────────────────────────────────────────────────
class MessageIn(BaseModel):
    role: str
    content: str


class MessageOut(BaseModel):
    role: str
    content: str

    class Config:
        from_attributes = True


class MemoryEntryOut(BaseModel):
    id: int
    type: str
    title: str
    description: str
    confidence: int
    tags: list[str]
    created_at: str

    class Config:
        from_attributes = True

class ConversationSummary(BaseModel):
    id: str
    message_count: int
    first_message: str
    last_message: str
    created_at: str
    updated_at: str


# ── Helpers ──────────────────────────────────────────────────────
def get_or_create_conversation(user_id: str, db: Session) -> Conversation:
    conv = (
        db.query(Conversation)
        .filter(Conversation.user_id == user_id)
        .order_by(Conversation.created_at.desc())
        .first()
    )
    if not conv:
        conv = Conversation(id=str(uuid.uuid4()), user_id=user_id)
        db.add(conv)
        db.commit()
        db.refresh(conv)
    return conv


# ── Conversation routes ───────────────────────────────────────────
@router.get("/conversation/{user_id}", response_model=list[MessageOut])
def load_conversation(user_id: str, db: Session = Depends(get_db)):
    conv = (
        db.query(Conversation)
        .filter(Conversation.user_id == user_id)
        .order_by(Conversation.created_at.desc())
        .first()
    )
    if not conv:
        return []
    messages = conv.messages[-MAX_HISTORY:]
    return [MessageOut(role=m.role, content=m.content) for m in messages]


@router.post("/conversation/{user_id}", status_code=201)
async def save_message(
    user_id: str,
    msg: MessageIn,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    conv = get_or_create_conversation(user_id, db)
    position = len(conv.messages)
    new_msg = Message(
        conversation_id=conv.id,
        role=msg.role,
        content=msg.content,
        position=position,
    )
    db.add(new_msg)
    db.commit()

    # Trigger memory extraction when assistant message is saved
    if msg.role == "assistant":
        # Find the last user message to pair with this response
        user_msgs = [m for m in conv.messages if m.role == "user"]
        last_user_content = user_msgs[-1].content if user_msgs else ""

        background_tasks.add_task(
            extract_and_save_memories,
            user_id,
            last_user_content,
            msg.content,
            db,
        )

    return {"status": "saved", "position": position}


@router.delete("/conversation/{user_id}", status_code=200)
def clear_conversation(user_id: str, db: Session = Depends(get_db)):
    conv = (
        db.query(Conversation)
        .filter(Conversation.user_id == user_id)
        .first()
    )
    if conv:
        db.delete(conv)
        db.commit()
    return {"status": "cleared"}

@router.post("/conversation/{user_id}/new", status_code=201)
def start_new_conversation(user_id: str, db: Session = Depends(get_db)):
    """
    Creates a brand new conversation session.
    Called when user explicitly starts a new chat.
    """
    conv = Conversation(id=str(uuid.uuid4()), user_id=user_id)
    db.add(conv)
    db.commit()
    db.refresh(conv)
    return {"id": conv.id, "status": "created"}


# ── Memory Vault routes ───────────────────────────────────────────
@router.get("/vault/{user_id}", response_model=list[MemoryEntryOut])
def get_memory_vault(
    user_id: str,
    type_filter: str = "all",
    db: Session = Depends(get_db),
):
    query = db.query(MemoryEntry).filter(MemoryEntry.user_id == user_id)

    if type_filter != "all":
        query = query.filter(MemoryEntry.type == type_filter)

    entries = query.order_by(MemoryEntry.created_at.desc()).all()

    return [
        MemoryEntryOut(
            id=e.id,
            type=e.type,
            title=e.title,
            description=e.description,
            confidence=e.confidence,
            tags=e.tags.split(",") if e.tags else [],
            created_at=e.created_at.strftime("%b %d, %Y // %H:%M"),
        )
        for e in entries
    ]


@router.delete("/vault/{user_id}/{entry_id}", status_code=200)
def delete_memory_entry(
    user_id: str,
    entry_id: int,
    db: Session = Depends(get_db),
):
    entry = (
        db.query(MemoryEntry)
        .filter(MemoryEntry.user_id == user_id, MemoryEntry.id == entry_id)
        .first()
    )
    if entry:
        db.delete(entry)
        db.commit()
    return {"status": "deleted"}

@router.get("/archive/{user_id}", response_model=list[ConversationSummary])
def list_archived_conversations(user_id: str, db: Session = Depends(get_db)):
    """
    Returns all past conversation sessions for this user,
    ordered by most recent first.
    """
    conversations = (
        db.query(Conversation)
        .filter(Conversation.user_id == user_id)
        .order_by(Conversation.created_at.desc())
        .all()
    )

    result = []
    for conv in conversations:
        if not conv.messages:
            continue

        first_user = next(
            (m.content for m in conv.messages if m.role == "user"), ""
        )
        last_msg = conv.messages[-1].content if conv.messages else ""

        result.append(ConversationSummary(
            id=conv.id,
            message_count=len(conv.messages),
            first_message=first_user[:80] + ("..." if len(first_user) > 80 else ""),
            last_message=last_msg[:80] + ("..." if len(last_msg) > 80 else ""),
            created_at=conv.created_at.strftime("%b %d, %Y // %H:%M"),
            updated_at=conv.updated_at.strftime("%b %d, %Y // %H:%M") if conv.updated_at else "",
        ))

    return result


@router.get("/archive/{user_id}/{conversation_id}", response_model=list[MessageOut])
def get_archived_conversation(
    user_id: str,
    conversation_id: str,
    db: Session = Depends(get_db),
):
    """Load full messages for a specific archived conversation."""
    conv = (
        db.query(Conversation)
        .filter(
            Conversation.user_id == user_id,
            Conversation.id == conversation_id,
        )
        .first()
    )
    if not conv:
        return []
    return [MessageOut(role=m.role, content=m.content) for m in conv.messages]


@router.delete("/archive/{user_id}/{conversation_id}", status_code=200)
def delete_archived_conversation(
    user_id: str,
    conversation_id: str,
    db: Session = Depends(get_db),
):
    """Delete a specific archived conversation."""
    conv = (
        db.query(Conversation)
        .filter(
            Conversation.user_id == user_id,
            Conversation.id == conversation_id,
        )
        .first()
    )
    if conv:
        db.delete(conv)
        db.commit()
    return {"status": "deleted"}