"""
services/groq_service.py  (Step 2 — Tool Calling)

The core orchestration loop. Previously this just streamed tokens.
Now it handles the full agentic cycle:

  LOOP:
    1. Send messages + tool schemas to LLM
    2. LLM responds with EITHER:
       a) A text response  →  stream tokens, we're done
       b) A tool_call      →  execute the tool, append result, go back to step 1

  Why a loop and not a single call?
    After a tool executes, the LLM needs to SEE the result and formulate
    a natural language answer. That requires a second (or third) LLM call.
    The loop continues until the LLM stops emitting tool calls.

  Yielded event types (parsed by the router and forwarded as SSE):
    {"type": "token",       "content": "The weather in..."}
    {"type": "tool_start",  "name": "get_weather", "args": {"city": "Thrissur"}}
    {"type": "tool_result", "name": "get_weather", "result": "{...}"}
    {"type": "error",       "content": "Something went wrong"}
"""

import os
import json
from groq import AsyncGroq
from typing import AsyncGenerator
from services.tool_registry import TOOL_SCHEMAS, TOOL_HANDLERS

client: AsyncGroq | None = None


def get_groq_client() -> AsyncGroq:
    """
    Lazily create the Groq client so app startup doesn't crash during import.

    This keeps `/healthz` and other non-chat routes available even if the API key
    is missing, and surfaces a clearer error only when chat is actually used.
    """
    global client

    if client is not None:
        return client

    api_key = os.environ.get("GROQ_API_KEY")
    if not api_key:
        raise RuntimeError(
            "Missing GROQ_API_KEY. Add it to backend/.env.local, backend/.env, "
            "or your shell environment before using /chat/stream."
        )

    client = AsyncGroq(api_key=api_key)
    return client

AVA_SYSTEM_PROMPT = """You are Ava, an AGI-level personal assistant created by Nirmal.

You are intelligent, warm, and precise. You help with complex reasoning, creative tasks,
research, planning, and code. You have a calm confidence and never pretend to know
something you don't.

TOOL USAGE STRICT RULES:
- ONLY invoke a tool if it is strictly necessary to fulfill the user's specific request.
- NEVER append a tool call to a general knowledge or conversational response just for the sake of it.
- If asked about time or dates, use get_current_time.
- If asked about weather, use get_weather.
- If arithmetic is required, use calculate.

After using a tool, synthesize the result into a natural, helpful response.
Never just repeat the raw tool output — interpret it for the user.

Your responses are thoughtful — never verbose for the sake of it."""


async def stream_chat(messages: list[dict]) -> AsyncGenerator[dict, None]:
    """
    The main agentic loop. Yields event dicts that the router serializes to SSE.

    Note: we yield dicts (not strings) here. The router handles JSON serialization.
    This keeps the service layer clean and testable.
    """
    working_messages = [
        {"role": "system", "content": AVA_SYSTEM_PROMPT},
        *messages,
    ]
    groq_client = get_groq_client()

    # Safety valve: max 5 tool calls per turn to prevent infinite loops.
    # In practice, most queries need 0-2 tool calls.
    max_iterations = 5

    for iteration in range(max_iterations):
        # ── LLM Call ──────────────────────────────────────────────────────
        # stream=False here because tool calls arrive as a complete structured
        # response — we need the full JSON before we can execute anything.
        response = await groq_client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=working_messages,
            tools=TOOL_SCHEMAS,
            tool_choice="auto",   # LLM decides whether to call a tool or respond directly
            max_tokens=1024,
            temperature=0.7,
            stream=False,
        )

        message = response.choices[0].message
        finish_reason = response.choices[0].finish_reason

        # ── Case 1: Tool Call ──────────────────────────────────────────────
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

                # Signal to UI: "Ava is about to use this tool"
                yield {"type": "tool_start", "name": name, "args": args}

                handler = TOOL_HANDLERS.get(name)
                if handler:
                    result = await handler(**args)
                else:
                    result = json.dumps({"error": f"Tool '{name}' not found."})

                # Signal to UI: "Tool finished"
                yield {"type": "tool_result", "name": name, "result": result}

                working_messages.append({
                    "role": "tool",
                    "tool_call_id": tool_call.id,
                    "content": result,
                })

            continue  # loop again — LLM will now read tool results and respond

        # ── Case 2: Final text response — stream it token by token ─────────
        else:
            stream = await groq_client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                messages=working_messages,
                max_tokens=1024,
                temperature=0.7,
                stream=True,
            )

            async for chunk in stream:
                token = chunk.choices[0].delta.content
                if token is not None:
                    yield {"type": "token", "content": token}

            return

    yield {
        "type": "error",
        "content": "I got stuck in a loop trying to answer that. Could you rephrase?",
    }
