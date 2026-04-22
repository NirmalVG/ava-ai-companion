"""
routers/context.py — Live context panel data
"""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from database import get_db
from models import MemoryEntry, Plugin, Conversation
from services.tool_registry import TOOL_HANDLERS
from services.plugin_registry import BUILTIN_PLUGIN_SCHEMAS

router = APIRouter()

USER_ID = "operator_01"


@router.get("/{user_id}")
def get_context(user_id: str, db: Session = Depends(get_db)):

    # ── Core tools ────────────────────────────────────────────────
    core_tools = [
        {"name": name, "type": "core", "status": "ready"}
        for name in TOOL_HANDLERS.keys()
    ]

    # ── ALL installed plugins from DB (built-in + dynamic) ────────
    installed_db = (
        db.query(Plugin)
        .filter(Plugin.user_id == user_id, Plugin.enabled == "true")
        .all()
    )

    installed_plugins = [
        {
            "name": p.name,
            "tool_name": p.tool_name,
            "type": "plugin",
            "status": "active",
            "source": p.base_url,
        }
        for p in installed_db
    ]

    all_tools = core_tools + [
        {"name": p["tool_name"], "type": "plugin", "status": "active"}
        for p in installed_plugins
    ]

    # ── Recent memories ───────────────────────────────────────────
    recent_memories = (
        db.query(MemoryEntry)
        .filter(MemoryEntry.user_id == user_id)
        .order_by(MemoryEntry.created_at.desc())
        .limit(4)
        .all()
    )

    memories = [
        {
            "id": m.id,
            "type": m.type,
            "title": m.title,
            "description": m.description,
            "confidence": m.confidence,
            "tags": m.tags.split(",") if m.tags else [],
        }
        for m in recent_memories
    ]

    # ── Conversation stats ────────────────────────────────────────
    conv = (
        db.query(Conversation)
        .filter(Conversation.user_id == user_id)
        .order_by(Conversation.created_at.desc())
        .first()
    )
    message_count = len(conv.messages) if conv else 0
    last_active = (
        conv.updated_at.strftime("%H:%M:%S")
        if conv and conv.updated_at
        else "—"
    )

    # ── Memory counts ─────────────────────────────────────────────
    total_memories = (
        db.query(MemoryEntry).filter(MemoryEntry.user_id == user_id).count()
    )
    preference_count = (
        db.query(MemoryEntry)
        .filter(MemoryEntry.user_id == user_id, MemoryEntry.type == "preference")
        .count()
    )
    fact_count = (
        db.query(MemoryEntry)
        .filter(MemoryEntry.user_id == user_id, MemoryEntry.type == "fact")
        .count()
    )
    event_count = (
        db.query(MemoryEntry)
        .filter(MemoryEntry.user_id == user_id, MemoryEntry.type == "event")
        .count()
    )

    # ── Available plugin catalogue ────────────────────────────────
    # Built-ins + any dynamic skills registered in DB
    builtin_names = {p["tool_name"] for p in BUILTIN_PLUGIN_SCHEMAS}
    dynamic_skills = [
        {
            "tool_name": p.tool_name,
            "name": p.name,
            "description": p.description,
        }
        for p in installed_db
        if p.tool_name not in builtin_names
    ]

    available_plugins = [
        {
            "tool_name": p["tool_name"],
            "name": p["name"],
            "description": p["description"],
        }
        for p in BUILTIN_PLUGIN_SCHEMAS
    ] + dynamic_skills

    return {
        "tools": all_tools,
        "memories": memories,
        "installed_plugins": installed_plugins,
        "available_plugins": available_plugins,
        "stats": {
            "message_count": message_count,
            "last_active": last_active,
            "total_memories": total_memories,
            "preference_count": preference_count,
            "fact_count": fact_count,
            "event_count": event_count,
            "active_tools": len(all_tools),
            "installed_plugins": len(installed_plugins),
        },
    }