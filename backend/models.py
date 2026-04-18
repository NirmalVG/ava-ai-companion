"""
models.py — SQLAlchemy ORM models

Three tables:
  conversations  — one row per chat session (keyed by user_id)
  messages       — one row per message, linked to a conversation
  memory_entries — facts/preferences/events extracted from conversations
"""

from datetime import datetime, timezone
from sqlalchemy import Column, String, Text, DateTime, ForeignKey, Integer
from sqlalchemy.orm import relationship
from database import Base


class Conversation(Base):
    __tablename__ = "conversations"

    id = Column(String, primary_key=True)
    user_id = Column(String, index=True, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc),
                        onupdate=lambda: datetime.now(timezone.utc))

    messages = relationship(
        "Message",
        back_populates="conversation",
        order_by="Message.position",
        cascade="all, delete-orphan",
    )


class Message(Base):
    __tablename__ = "messages"

    id = Column(Integer, primary_key=True, autoincrement=True)
    conversation_id = Column(String, ForeignKey("conversations.id"), nullable=False)
    role = Column(String, nullable=False)       # "user" | "assistant"
    content = Column(Text, nullable=False)
    position = Column(Integer, nullable=False)  # order within conversation
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    conversation = relationship("Conversation", back_populates="messages")


class MemoryEntry(Base):
    __tablename__ = "memory_entries"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String, index=True, nullable=False)
    type = Column(String, nullable=False)        # "preference" | "event" | "fact"
    title = Column(String, nullable=False)
    description = Column(Text, nullable=False)
    confidence = Column(Integer, default=90)     # 0-100
    tags = Column(String, default="")            # comma-separated e.g. "tech,work"
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc),
                        onupdate=lambda: datetime.now(timezone.utc))