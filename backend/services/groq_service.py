"""
services/groq_service.py

The core orchestration loop with multi-model fallback cascade.

Model priority:
  1. qwen/qwen3-32b        — best quality, tool calling
  2. llama-3.3-70b-versatile — strong fallback, high TPM
  3. llama3-70b-8192        — reliable fallback
  4. llama-3.1-8b-instant   — fast, high TPM, last resort

If a model hits rate limits (429) or token limits (413),
the next model in the cascade is tried automatically.
"""

import os
import json
import asyncio
from groq import AsyncGroq
from groq import RateLimitError, BadRequestError
from typing import AsyncGenerator
from services.tool_registry import TOOL_SCHEMAS, TOOL_HANDLERS
from services.plugin_registry import PLUGIN_TOOL_SCHEMAS, PLUGIN_HANDLERS

client: AsyncGroq | None = None

# ── Model cascade ─────────────────────────────────────────────────
# Each entry: (model_id, max_tokens_tools, max_tokens_stream)
# Ordered from best quality to fastest/highest-limit fallback
MODEL_CASCADE = [
    ("qwen/qwen3-32b",           3000, 1500),
    ("llama-3.3-70b-versatile",  3000, 1500),
    ("llama3-70b-8192",          2048, 1024),
    ("llama-3.1-8b-instant",     2048, 1024),
]

# Errors that should trigger a fallback to the next model
FALLBACK_ERRORS = (RateLimitError, BadRequestError)

MAX_MSGS_WITH_TOOLS = 4
MAX_MSGS_NO_TOOLS = 8


def get_groq_client() -> AsyncGroq:
    global client
    if client is not None:
        return client
    api_key = os.environ.get("GROQ_API_KEY")
    if not api_key:
        raise RuntimeError(
            "Missing GROQ_API_KEY. Add it to backend/.env.local or backend/.env."
        )
    client = AsyncGroq(api_key=api_key)
    return client


AVA_SYSTEM_PROMPT = """You are Ava, an AGI-level assistant by Nirmal.
You are a world-class expert across all domains. Give detailed, well-researched,
structured answers with examples, analogies, and depth. Never be shallow.
Anticipate follow-up questions and address them proactively.

TOOL RULES:
- Never use emoji. Never use XML function tags.
- Only call tools when explicitly needed.
- get_current_time: only if user asks time/date.
- get_weather: only if user asks weather.
- calculate: only if user asks for calculation.
- web_search: only for current/unknown info.
- execute_code: run code to verify fixes work.
- read_file/write_file: for file operations.
- Acknowledge personal info without calling tools.

CODE FIXING: read file → analyze → fix → execute_code to verify → explain what changed."""


TONE_INSTRUCTIONS = {
    "casual":       "Friendly expert tone. Plain language, full depth.",
    "balanced":     "Warm and professional. Structured, thorough.",
    "professional": "Formal, precise, exhaustive. Cover edge cases.",
    "concise":      "Direct. Lead with answer. No filler, full detail.",
    "research":     "Senior researcher style. Full coverage, headers, examples.",
}


# ── Model selector helper ─────────────────────────────────────────
def supports_reasoning_format(model: str) -> bool:
    """Only qwen3 models support reasoning_format=hidden."""
    return "qwen3" in model or "qwen/qwen3" in model


def build_extra_body(model: str) -> dict:
    if supports_reasoning_format(model):
        return {"reasoning_format": "hidden"}
    return {}


async def try_tool_call(
    groq_client: AsyncGroq,
    model: str,
    max_tokens: int,
    working_messages: list,
    all_tool_schemas: list,
) -> tuple:
    """
    Attempt a non-streaming tool detection call.
    Returns (message, finish_reason) or raises on failure.
    """
    response = await groq_client.chat.completions.create(
        model=model,
        messages=working_messages,
        tools=all_tool_schemas,
        tool_choice="auto",
        parallel_tool_calls=False,
        max_tokens=max_tokens,
        temperature=0.2,
        stream=False,
        extra_body=build_extra_body(model),
    )
    return response.choices[0].message, response.choices[0].finish_reason


async def try_stream(
    groq_client: AsyncGroq,
    model: str,
    max_tokens: int,
    working_messages: list,
):
    """
    Attempt a streaming call.
    Returns the stream object or raises on failure.
    """
    return await groq_client.chat.completions.create(
        model=model,
        messages=working_messages,
        max_tokens=max_tokens,
        temperature=0.7,
        stream=True,
        extra_body=build_extra_body(model),
    )


async def stream_chat(
    messages: list[dict],
    user_id: str = "operator_01",
    installed_plugins: list[str] | None = None,
    tone: str = "balanced",
) -> AsyncGenerator[dict, None]:
    """
    The main agentic loop with multi-model fallback cascade.
    """

    # ── Build tool list ───────────────────────────────────────────
    active_plugin_schemas = [
        PLUGIN_TOOL_SCHEMAS[name]
        for name in (installed_plugins or [])
        if name in PLUGIN_TOOL_SCHEMAS
    ]
    all_tool_schemas = TOOL_SCHEMAS + active_plugin_schemas

    all_handlers = {
        **TOOL_HANDLERS,
        **{
            name: PLUGIN_HANDLERS[name]
            for name in (installed_plugins or [])
            if name in PLUGIN_HANDLERS
        },
    }

    # ── Trim history ──────────────────────────────────────────────
    max_msgs = MAX_MSGS_WITH_TOOLS if all_tool_schemas else MAX_MSGS_NO_TOOLS
    if len(messages) > max_msgs:
        messages = messages[-max_msgs:]

    # ── Build system prompt ───────────────────────────────────────
    tone_note = TONE_INSTRUCTIONS.get(tone, TONE_INSTRUCTIONS["balanced"])
    system_prompt = f"{AVA_SYSTEM_PROMPT}\n\nTONE: {tone_note}"

    working_messages = [
        {"role": "system", "content": system_prompt},
        *messages,
    ]

    groq_client = get_groq_client()
    max_iterations = 5

    # Track which model we're currently using across iterations
    # so fallback persists for the whole conversation turn
    current_model_idx = 0

    for iteration in range(max_iterations):

        # ── Tool detection call with cascade ──────────────────────
        message = None
        finish_reason = None

        for model_idx in range(current_model_idx, len(MODEL_CASCADE)):
            model, max_tokens_tools, max_tokens_stream = MODEL_CASCADE[model_idx]
            try:
                message, finish_reason = await try_tool_call(
                    groq_client, model, max_tokens_tools,
                    working_messages, all_tool_schemas,
                )
                # Success — lock to this model for the rest of this turn
                current_model_idx = model_idx
                if model_idx > 0:
                    # Let the frontend know we fell back
                    yield {
                        "type": "token",
                        "content": f"_[Using fallback model: {model}]_\n\n",
                    }
                break
            except FALLBACK_ERRORS as e:
                error_str = str(e)
                is_rate_limit = "429" in error_str or "rate_limit" in error_str
                is_too_large = "413" in error_str or "too large" in error_str.lower()

                if is_rate_limit or is_too_large:
                    if model_idx < len(MODEL_CASCADE) - 1:
                        next_model = MODEL_CASCADE[model_idx + 1][0]
                        print(
                            f"[Cascade] {model} failed "
                            f"({'rate limit' if is_rate_limit else 'too large'}), "
                            f"trying {next_model}"
                        )
                        continue
                    else:
                        yield {
                            "type": "error",
                            "content": "All models are currently rate limited. Please try again in a moment.",
                        }
                        return
                else:
                    # Non-rate-limit error — surface it directly
                    yield {"type": "error", "content": error_str}
                    return
            except Exception as e:
                yield {"type": "error", "content": str(e)}
                return

        if message is None:
            yield {
                "type": "error",
                "content": "Could not get a response from any model.",
            }
            return

        _, max_tokens_tools, max_tokens_stream = MODEL_CASCADE[current_model_idx]
        current_model = MODEL_CASCADE[current_model_idx][0]

        # ── Case 1: Tool Call ─────────────────────────────────────
        if finish_reason == "tool_calls" and message.tool_calls:
            working_messages.append({
                "role": "assistant",
                "content": message.content or "",
                "tool_calls": [
                    {
                        "id": tc.id,
                        "type": "function",
                        "function": {
                            "name": tc.function.name,
                            "arguments": tc.function.arguments,
                        },
                    }
                    for tc in message.tool_calls
                ],
            })

            for tool_call in message.tool_calls:
                name = tool_call.function.name
                try:
                    args = json.loads(tool_call.function.arguments)
                except json.JSONDecodeError:
                    args = {}

                yield {"type": "tool_start", "name": name, "args": args}

                handler = all_handlers.get(name)
                if handler:
                    result = await handler(**args)
                else:
                    result = json.dumps({"error": f"Tool '{name}' not found."})

                yield {"type": "tool_result", "name": name, "result": result}

                working_messages.append({
                    "role": "tool",
                    "tool_call_id": tool_call.id,
                    "content": result,
                })

            continue

        # ── Case 2: Malformed XML tag ─────────────────────────────
        elif message.content and "<function=" in message.content:
            yield {
                "type": "error",
                "content": "Formatting issue encountered. Please try rephrasing.",
            }
            return

        # ── Case 3: Final streamed response with cascade ──────────
        else:
            stream = None
            for model_idx in range(current_model_idx, len(MODEL_CASCADE)):
                model, _, max_tokens_stream = MODEL_CASCADE[model_idx]
                try:
                    stream = await try_stream(
                        groq_client, model,
                        max_tokens_stream, working_messages,
                    )
                    break
                except FALLBACK_ERRORS as e:
                    error_str = str(e)
                    is_rate_limit = "429" in error_str or "rate_limit" in error_str
                    is_too_large = "413" in error_str or "too large" in error_str.lower()

                    if (is_rate_limit or is_too_large) and model_idx < len(MODEL_CASCADE) - 1:
                        print(f"[Cascade] Stream fallback: {model} → {MODEL_CASCADE[model_idx+1][0]}")
                        continue
                    else:
                        yield {"type": "error", "content": str(e)}
                        return
                except Exception as e:
                    yield {"type": "error", "content": str(e)}
                    return

            if stream is None:
                yield {
                    "type": "error",
                    "content": "All models are currently unavailable. Please try again shortly.",
                }
                return

            buffer = ""
            in_think = False

            async for chunk in stream:
                token = chunk.choices[0].delta.content
                if token is None:
                    continue

                buffer += token

                while True:
                    if in_think:
                        end = buffer.find("</think>")
                        if end != -1:
                            buffer = buffer[end + 8:]
                            in_think = False
                        else:
                            buffer = ""
                            break
                    else:
                        start = buffer.find("<think>")
                        if start != -1:
                            if buffer[:start]:
                                yield {"type": "token", "content": buffer[:start]}
                            buffer = buffer[start + 7:]
                            in_think = True
                        else:
                            if len(buffer) > 7:
                                yield {"type": "token", "content": buffer[:-7]}
                                buffer = buffer[-7:]
                            break

            if buffer and not in_think:
                yield {"type": "token", "content": buffer}

            return

    yield {
        "type": "error",
        "content": "I got stuck in a loop trying to answer that. Could you rephrase?",
    }