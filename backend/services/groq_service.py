"""
services/groq_service.py

The core orchestration loop. Handles the full agentic cycle:

  LOOP:
    1. Send messages + tool schemas to LLM
    2. LLM responds with EITHER:
       a) A text response  →  stream tokens, we're done
       b) A tool_call      →  execute the tool, append result, go back to step 1

  Yielded event types:
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
    global client
    if client is not None:
        return client
    api_key = os.environ.get("GROQ_API_KEY")
    if not api_key:
        raise RuntimeError(
            "Missing GROQ_API_KEY. Add it to backend/.env.local or backend/.env "
            "before using /chat/stream."
        )
    client = AsyncGroq(api_key=api_key)
    return client


AVA_SYSTEM_PROMPT = """You are Ava, an AGI-level personal assistant created by Nirmal.

You are intelligent, warm, and precise. You help with complex reasoning, creative tasks,
research, planning, and code. You have calm confidence and never pretend to know
something you don't.

CRITICAL TOOL USAGE RULES:
- NEVER use XML-style function tags like <function=name {...}>. This is strictly forbidden.
- Tools are called via the structured tool_calls API only — never inline in text.
- ONLY call a tool when the user is EXPLICITLY asking for that specific information.
- NEVER call get_current_time unless the user directly asks for the time or date.
- NEVER call get_weather unless the user directly asks for weather.
- NEVER call calculate unless the user asks you to compute something.
- NEVER call web_search unless the user needs current information you don't have.
- If the user shares personal info (location, preferences), just acknowledge it — no tools.

After using a tool, synthesize the result naturally. Never repeat raw tool output.
Your responses are thoughtful — never verbose for the sake of it."""


async def stream_chat(messages: list[dict]) -> AsyncGenerator[dict, None]:
    """
    The main agentic loop. Yields event dicts that the router serializes to SSE.
    """
    working_messages = [
        {"role": "system", "content": AVA_SYSTEM_PROMPT},
        *messages,
    ]
    groq_client = get_groq_client()

    # Safety valve: max 5 tool calls per turn to prevent infinite loops
    max_iterations = 5

    for iteration in range(max_iterations):
        # ── LLM Call ──────────────────────────────────────────────────────
        response = await groq_client.chat.completions.create(
            model="qwen/qwen3-32b",
            messages=working_messages,
            tools=TOOL_SCHEMAS,
            tool_choice="auto",
            parallel_tool_calls=False,  # prevents malformed multi-tool output
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

                # Signal to UI: tool is starting
                yield {"type": "tool_start", "name": name, "args": args}

                handler = TOOL_HANDLERS.get(name)
                if handler:
                    result = await handler(**args)
                else:
                    result = json.dumps({"error": f"Tool '{name}' not found."})

                # Signal to UI: tool finished
                yield {"type": "tool_result", "name": name, "result": result}

                working_messages.append({
                    "role": "tool",
                    "tool_call_id": tool_call.id,
                    "content": result,
                })

            continue  # loop again — LLM reads tool results and responds

        # ── Case 2: Model tried to use XML function tags (old format) ──────
        # Catch the case where finish_reason is "stop" but content contains
        # a malformed <function=...> tag and surface a clean error instead
        elif message.content and "<function=" in message.content:
            yield {
                "type": "error",
                "content": "I encountered a formatting issue. Please try rephrasing your request.",
            }
            return

        # ── Case 3: Final text response — stream it token by token ─────────
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