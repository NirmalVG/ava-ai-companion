"""
routers/vision.py — Image understanding via LLM vision

Accepts an image upload + optional user prompt.
Sends the image as base64 to the LLM with vision capability.
Returns a streaming analysis response.

Why base64 and not a URL?
  Images are uploaded directly from the user's device — they don't
  have a public URL. Base64 encoding lets us embed the image bytes
  directly in the LLM API request.
"""

import os
import base64
import json
from fastapi import APIRouter, UploadFile, File, Form
from fastapi.responses import StreamingResponse
from groq import AsyncGroq

router = APIRouter()

SUPPORTED_TYPES = {
    "image/jpeg", "image/jpg", "image/png",
    "image/gif", "image/webp",
}

MAX_IMAGE_SIZE = 10 * 1024 * 1024  # 10MB


@router.post("/analyze")
async def analyze_image(
    file: UploadFile = File(...),
    prompt: str = Form(default="Describe this image in detail."),
):
    """
    Analyze an image using LLM vision.
    Returns a streaming text response.
    """
    api_key = os.environ.get("GROQ_API_KEY")
    if not api_key:
        async def err():
            yield f"data: {json.dumps({'type': 'error', 'content': 'GROQ_API_KEY not set'})}\n\n"
            yield "data: [DONE]\n\n"
        return StreamingResponse(err(), media_type="text/event-stream")

    # Validate file type
    content_type = file.content_type or ""
    if content_type not in SUPPORTED_TYPES:
        async def err():
            yield f"data: {json.dumps({'type': 'error', 'content': f'Unsupported file type: {content_type}. Use JPEG, PNG, GIF, or WebP.'})}\n\n"
            yield "data: [DONE]\n\n"
        return StreamingResponse(err(), media_type="text/event-stream")

    # Read and validate size
    image_bytes = await file.read()
    if len(image_bytes) > MAX_IMAGE_SIZE:
        async def err():
            yield f"data: {json.dumps({'type': 'error', 'content': 'Image too large. Maximum size is 10MB.'})}\n\n"
            yield "data: [DONE]\n\n"
        return StreamingResponse(err(), media_type="text/event-stream")

    # Encode to base64
    image_b64 = base64.b64encode(image_bytes).decode("utf-8")
    media_type = content_type if content_type != "image/jpg" else "image/jpeg"

    client = AsyncGroq(api_key=api_key)

    async def event_generator():
        try:
            stream = await client.chat.completions.create(
                model="meta-llama/llama-4-scout-17b-16e-instruct",
                messages=[
                    {
                        "role": "user",
                        "content": [
                            {
                                "type": "image_url",
                                "image_url": {
                                    "url": f"data:{media_type};base64,{image_b64}",
                                },
                            },
                            {
                                "type": "text",
                                "text": prompt,
                            },
                        ],
                    }
                ],
                max_tokens=1024,
                temperature=0.7,
                stream=True,
            )

            async for chunk in stream:
                token = chunk.choices[0].delta.content
                if token is not None:
                    yield f"data: {json.dumps({'type': 'token', 'content': token})}\n\n"

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