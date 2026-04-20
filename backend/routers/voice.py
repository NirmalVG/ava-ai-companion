"""
routers/voice.py — Speech to text via Groq Whisper

Accepts a raw audio blob (webm/wav), sends it to Groq's
Whisper endpoint, returns the transcript as JSON.

Why Groq Whisper instead of Web Speech API?
  - Works in all browsers (Firefox, Safari, Chrome)
  - No Google dependency — audio goes to Groq, not Google
  - Works offline-friendly (no third-party JS)
  - Same Groq API key already in use
"""

import os
import tempfile
from fastapi import APIRouter, UploadFile, File, HTTPException
from groq import AsyncGroq

router = APIRouter()


@router.post("/transcribe")
async def transcribe_audio(file: UploadFile = File(...)):
    """
    Accepts audio file upload, returns transcript.
    Frontend sends audio/webm blob from MediaRecorder.
    """
    api_key = os.environ.get("GROQ_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="GROQ_API_KEY not set")

    client = AsyncGroq(api_key=api_key)

    # Read audio bytes
    audio_bytes = await file.read()
    if not audio_bytes:
        raise HTTPException(status_code=400, detail="Empty audio file")

    # Write to temp file — Groq SDK needs a file path
    suffix = ".webm" if "webm" in (file.content_type or "") else ".wav"
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
        tmp.write(audio_bytes)
        tmp_path = tmp.name

    try:
        with open(tmp_path, "rb") as audio_file:
            transcription = await client.audio.transcriptions.create(
                model="whisper-large-v3-turbo",
                file=(file.filename or f"audio{suffix}", audio_file),
                response_format="text",
            )
        return {"transcript": transcription.strip()}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        os.unlink(tmp_path)