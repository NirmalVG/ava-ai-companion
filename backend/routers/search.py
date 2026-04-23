"""
routers/search.py — Unified search across all data

Searches:
  - Conversation messages (content match)
  - Memory entries (title + description match)
  - Plugins (name + description match)
  - Skills (name + description match)

Returns categorized results with type, title, snippet, and metadata.
"""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from pydantic import BaseModel

from database import get_db
from models import Conversation, MemoryEntry, Plugin

router = APIRouter()

USER_ID = "operator_01"


class SearchResult(BaseModel):
    type: str           # "message" | "memory" | "plugin" | "skill"
    title: str
    snippet: str
    metadata: dict = {}
    score: int = 0      # simple relevance score


@router.get("/{user_id}")
def search(
    user_id: str,
    q: str = "",
    db: Session = Depends(get_db),
):
    """
    Unified search across messages, memories, plugins and skills.
    Returns categorized results sorted by relevance.
    """
    if not q or len(q.strip()) < 2:
        return {"query": q, "results": [], "total": 0}

    query = q.strip().lower()
    results = []

    # ── Search messages ───────────────────────────────────────────
    conv = (
        db.query(Conversation)
        .filter(Conversation.user_id == user_id)
        .order_by(Conversation.created_at.desc())
        .first()
    )
    if conv:
        for msg in conv.messages:
            if query in msg.content.lower():
                # Find the surrounding context
                idx = msg.content.lower().find(query)
                start = max(0, idx - 40)
                end = min(len(msg.content), idx + len(query) + 60)
                snippet = msg.content[start:end].strip()
                if start > 0:
                    snippet = "..." + snippet
                if end < len(msg.content):
                    snippet = snippet + "..."

                # Count occurrences for scoring
                count = msg.content.lower().count(query)

                results.append(SearchResult(
                    type="message",
                    title=f"{msg.role.upper()} message",
                    snippet=snippet,
                    metadata={
                        "role": msg.role,
                        "position": msg.position,
                        "conversation_id": conv.id,
                    },
                    score=count * 2,
                ))

    # ── Search memories ───────────────────────────────────────────
    memories = (
        db.query(MemoryEntry)
        .filter(MemoryEntry.user_id == user_id)
        .all()
    )
    for mem in memories:
        score = 0
        title_match = query in mem.title.lower()
        desc_match = query in mem.description.lower()
        tag_match = query in mem.tags.lower()

        if title_match:
            score += 5
        if desc_match:
            score += 3
        if tag_match:
            score += 2

        if score > 0:
            results.append(SearchResult(
                type="memory",
                title=mem.title,
                snippet=mem.description[:120] + (
                    "..." if len(mem.description) > 120 else ""
                ),
                metadata={
                    "memory_type": mem.type,
                    "confidence": mem.confidence,
                    "tags": mem.tags.split(",") if mem.tags else [],
                    "created_at": mem.created_at.strftime("%b %d, %Y"),
                },
                score=score,
            ))

    # ── Search plugins and skills ─────────────────────────────────
    plugins = (
        db.query(Plugin)
        .filter(Plugin.user_id == user_id)
        .all()
    )
    for plugin in plugins:
        score = 0
        name_match = query in plugin.name.lower()
        desc_match = query in plugin.description.lower()
        tool_match = query in plugin.tool_name.lower()

        if name_match:
            score += 5
        if desc_match:
            score += 3
        if tool_match:
            score += 4

        if score > 0:
            source = plugin.base_url or "builtin"
            result_type = (
                "skill" if source in ("uploaded", "created")
                or (source.startswith("http"))
                else "plugin"
            )
            results.append(SearchResult(
                type=result_type,
                title=plugin.name,
                snippet=plugin.description[:120] + (
                    "..." if len(plugin.description) > 120 else ""
                ),
                metadata={
                    "tool_name": plugin.tool_name,
                    "enabled": plugin.enabled == "true",
                    "source": source,
                },
                score=score,
            ))

    # Sort by score descending
    results.sort(key=lambda r: r.score, reverse=True)

    return {
        "query": q,
        "results": [r.model_dump() for r in results[:30]],
        "total": len(results),
        "breakdown": {
            "messages": sum(1 for r in results if r.type == "message"),
            "memories": sum(1 for r in results if r.type == "memory"),
            "plugins": sum(1 for r in results if r.type == "plugin"),
            "skills": sum(1 for r in results if r.type == "skill"),
        },
    }