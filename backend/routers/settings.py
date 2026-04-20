"""
routers/settings.py — User settings + data export

Endpoints:
  GET    /settings/{user_id}         — load settings
  POST   /settings/{user_id}         — save settings
  GET    /settings/{user_id}/export  — export full conversation as markdown
  DELETE /settings/{user_id}/data    — delete all user data (GDPR)
"""

from fastapi import APIRouter, Depends
from fastapi.responses import PlainTextResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel

from database import get_db
from models import UserSettings, Conversation, MemoryEntry, Plugin

router = APIRouter()


# ── Schemas ──────────────────────────────────────────────────────
class SettingsIn(BaseModel):
    tone: str = "balanced"
    language: str = "en"
    memory_enabled: str = "true"
    retention_days: int = 30


class SettingsOut(BaseModel):
    tone: str
    language: str
    memory_enabled: str
    retention_days: int

    class Config:
        from_attributes = True


# ── Routes ───────────────────────────────────────────────────────
@router.get("/{user_id}", response_model=SettingsOut)
def get_settings(user_id: str, db: Session = Depends(get_db)):
    settings = db.query(UserSettings).filter(
        UserSettings.user_id == user_id
    ).first()

    if not settings:
        # Return defaults without writing to DB yet
        return SettingsOut(
            tone="balanced",
            language="en",
            memory_enabled="true",
            retention_days=30,
        )
    return settings


@router.post("/{user_id}", response_model=SettingsOut)
def save_settings(
    user_id: str,
    data: SettingsIn,
    db: Session = Depends(get_db),
):
    settings = db.query(UserSettings).filter(
        UserSettings.user_id == user_id
    ).first()

    if settings:
        settings.tone = data.tone
        settings.language = data.language
        settings.memory_enabled = data.memory_enabled
        settings.retention_days = data.retention_days
    else:
        settings = UserSettings(
            user_id=user_id,
            tone=data.tone,
            language=data.language,
            memory_enabled=data.memory_enabled,
            retention_days=data.retention_days,
        )
        db.add(settings)

    db.commit()
    db.refresh(settings)
    return settings


@router.get("/{user_id}/export", response_class=PlainTextResponse)
def export_conversation(user_id: str, db: Session = Depends(get_db)):
    """Export full conversation history as a markdown file."""
    conv = (
        db.query(Conversation)
        .filter(Conversation.user_id == user_id)
        .order_by(Conversation.created_at.desc())
        .first()
    )

    lines = [
        "# AVA Conversation Export\n",
        f"**User:** {user_id}  ",
        f"**Exported:** {__import__('datetime').datetime.utcnow().strftime('%Y-%m-%d %H:%M UTC')}",
        "\n---\n",
    ]

    if not conv or not conv.messages:
        lines.append("_No conversation history found._")
    else:
        for msg in conv.messages:
            role_label = "**You**" if msg.role == "user" else "**Ava**"
            lines.append(f"{role_label}\n\n{msg.content}\n\n---\n")

    return PlainTextResponse(
        content="\n".join(lines),
        headers={
            "Content-Disposition": f"attachment; filename=ava-export-{user_id}.md"
        },
    )


@router.delete("/{user_id}/data", status_code=200)
def delete_all_data(user_id: str, db: Session = Depends(get_db)):
    """GDPR right to erasure — delete everything for this user."""
    db.query(Conversation).filter(Conversation.user_id == user_id).delete()
    db.query(MemoryEntry).filter(MemoryEntry.user_id == user_id).delete()
    db.query(Plugin).filter(Plugin.user_id == user_id).delete()
    db.query(UserSettings).filter(UserSettings.user_id == user_id).delete()
    db.commit()
    return {"status": "all data deleted"}