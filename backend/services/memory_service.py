"""
services/memory_service.py

After every assistant response, we run a lightweight LLM call to extract
any new facts, preferences, or events from the conversation.

Why a separate LLM call and not a tool?
  Memory extraction is a background concern — it shouldn't slow down
  the main chat response. We fire it asynchronously after streaming ends.

Extracted memory types:
  preference  — things the user likes/dislikes/prefers
  event       — meetings, tasks, things that happened
  fact        — objective facts about the user or their world
"""

import json
import os
from groq import AsyncGroq
from sqlalchemy.orm import Session
from models import MemoryEntry

EXTRACTION_PROMPT = """You are a memory extraction system. Given a conversation exchange,
extract any new facts, preferences, or events about the user worth remembering.

Return ONLY a JSON array. Each item must have:
  - type: "preference" | "event" | "fact"
  - title: short title (max 5 words)
  - description: one sentence explanation
  - confidence: integer 0-100
  - tags: array of 1-3 lowercase tag strings

If nothing worth remembering was said, return an empty array [].

Examples of things worth extracting:
  - User mentions their city, job, preferences, habits
  - A meeting or event was scheduled
  - User expresses a strong like or dislike
  - A fact about their tech stack, family, routine

Examples of things NOT worth extracting:
  - General knowledge questions
  - Calculator or weather queries with no personal context
  - Greetings or small talk

Return ONLY valid JSON, no markdown, no explanation."""


async def extract_and_save_memories(
    user_id: str,
    user_message: str,
    assistant_message: str,
    db: Session,
) -> None:
    """
    Fire-and-forget memory extraction.
    Called after each assistant response completes.
    """
    api_key = os.environ.get("GROQ_API_KEY")
    if not api_key:
        return

    client = AsyncGroq(api_key=api_key)

    try:
        response = await client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {"role": "system", "content": EXTRACTION_PROMPT},
                {
                    "role": "user",
                    "content": (
                        f"User said: {user_message}\n\n"
                        f"Assistant replied: {assistant_message}"
                    ),
                },
            ],
            max_tokens=1024,
            temperature=0.2,   # low temp for consistent structured output
            stream=False,
        )

        raw = response.choices[0].message.content.strip()

        # Strip markdown fences if model wraps output anyway
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        raw = raw.strip()

        entries = json.loads(raw)
        if not isinstance(entries, list):
            return

        for entry in entries:
            # Skip if we already have a very similar title for this user
            existing = (
                db.query(MemoryEntry)
                .filter(
                    MemoryEntry.user_id == user_id,
                    MemoryEntry.title == entry.get("title", ""),
                )
                .first()
            )
            if existing:
                # Update description + confidence instead of duplicating
                existing.description = entry.get("description", existing.description)
                existing.confidence = entry.get("confidence", existing.confidence)
                db.commit()
                continue

            mem = MemoryEntry(
                user_id=user_id,
                type=entry.get("type", "fact"),
                title=entry.get("title", "Untitled"),
                description=entry.get("description", ""),
                confidence=int(entry.get("confidence", 90)),
                tags=",".join(entry.get("tags", [])),
            )
            db.add(mem)

        db.commit()

    except Exception:
        # Memory extraction is best-effort — never crash the main flow
        pass