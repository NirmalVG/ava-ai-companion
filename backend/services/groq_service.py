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
from services.plugin_registry import PLUGIN_TOOL_SCHEMAS, PLUGIN_HANDLERS

client: AsyncGroq | None = None

MAX_HISTORY_MESSAGES = 10
MAX_TOKENS_TOOLS = 4096     # tool calls need room for code generation
MAX_TOKENS_STREAM = 2048    # final streamed response stays within TPM


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

You are a world-class expert across all domains — science, engineering, philosophy,
medicine, law, finance, history, mathematics, and creative arts. You think deeply
before responding, consider multiple angles, and deliver responses that are genuinely
useful, accurate, and insightful.

RESPONSE QUALITY STANDARDS:
- Give detailed, well-researched answers that demonstrate deep domain knowledge.
- Structure complex answers with clear sections, examples, and analogies.
- When explaining technical concepts, go beyond surface level — include the why,
  not just the what.
- Cite relevant principles, frameworks, or real-world context where applicable.
- If a question has nuance or competing perspectives, acknowledge and explore them.
- Never give a lazy one-liner when the question deserves depth.
- Proactively include information the user would want to know even if they did not
  explicitly ask — anticipate follow-up questions and address them.
- Use code examples, comparisons, and structured breakdowns when they aid clarity.
- If you are uncertain about something, say so clearly rather than guessing.

CRITICAL TOOL RULES:
- Never use emoji in responses.
- NEVER use XML-style function tags like <function=name {...}>. Strictly forbidden.
- Tools are called via the structured tool_calls API only — never inline in text.
- ONLY call a tool when the user is EXPLICITLY asking for that specific information.
- NEVER call get_current_time unless the user directly asks for the time or date.
- NEVER call get_weather unless the user directly asks for weather.
- NEVER call calculate unless the user asks you to compute something.
- NEVER call web_search unless the user needs current information you do not have.
- If the user shares personal info (location, preferences), just acknowledge — no tools.

CODE FIXING WORKFLOW — follow this exactly when asked to fix code:
  1. If the user provides a file path, use read_file to read the actual file.
  2. Analyze the code carefully — identify the root cause, not just the symptom.
  3. Write the complete fixed code.
  4. Use execute_code to RUN the fix and verify it works before presenting it.
  5. If execution fails, iterate — fix the error and run again (up to 3 times).
  6. Once verified working, present the fix with a clear explanation of:
     - What was wrong and why
     - What you changed and why
     - How you confirmed it works (show the execution output)
  7. If the user wants the fix saved, use write_file to write it to disk.

After using a tool, synthesize the result into a thorough, insightful response.
Never just repeat raw tool output — interpret, contextualize, and expand on it."""


TONE_INSTRUCTIONS = {
    "casual": (
        "Speak in a friendly, conversational tone like a brilliant friend who happens "
        "to be an expert. Use plain language but do not sacrifice depth or accuracy. "
        "Feel free to use contractions and be direct."
    ),
    "balanced": (
        "Speak naturally — warm, clear, and professional. Provide thorough explanations "
        "with good structure. Use headers and bullet points for complex topics. "
        "Be comprehensive but not padded."
    ),
    "professional": (
        "Speak formally and with precision. Structure responses with clear sections. "
        "Use domain-appropriate terminology. Be exhaustive — cover edge cases, "
        "trade-offs, and nuances. Suitable for professional or academic contexts."
    ),
    "concise": (
        "Be direct and efficient. Lead with the answer, then provide essential context. "
        "Skip preamble and filler. Still include critical details — brevity means "
        "no padding, not shallowness."
    ),
    "research": (
        "Respond like a senior researcher writing a detailed technical brief. "
        "Provide exhaustive coverage — background, current state, key concepts, "
        "trade-offs, open questions, and practical implications. Use structured "
        "headers, numbered points, and examples. Leave no important angle unexplored."
    ),
}


async def stream_chat(
    messages: list[dict],
    user_id: str = "operator_01",
    installed_plugins: list[str] | None = None,
    tone: str = "balanced",
) -> AsyncGenerator[dict, None]:
    """
    The main agentic loop. Yields event dicts that the router serializes to SSE.

    Parameters:
      messages:           conversation history
      user_id:            current user
      installed_plugins:  list of tool_names the user has installed
      tone:               response tone preference
    """

    # ── Build tool list: core tools + installed plugins ───────────
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
    # Be aggressive when tools are active — tool call JSON is expensive
    # on the free tier TPM limit
    max_msgs = 6 if all_tool_schemas else MAX_HISTORY_MESSAGES
    if len(messages) > max_msgs:
        messages = messages[-max_msgs:]

    # ── Build system prompt with tone ─────────────────────────────
    tone_note = TONE_INSTRUCTIONS.get(tone, TONE_INSTRUCTIONS["balanced"])
    system_prompt = f"{AVA_SYSTEM_PROMPT}\n\nTONE: {tone_note}"

    working_messages = [
        {"role": "system", "content": system_prompt},
        *messages,
    ]

    groq_client = get_groq_client()
    max_iterations = 5

    for iteration in range(max_iterations):

        # ── Tool detection call (non-streaming) ───────────────────
        # Lower temperature for reliable structured JSON output.
        # Higher max_tokens so code generation doesn't truncate mid-JSON.
        response = await groq_client.chat.completions.create(
            model="qwen/qwen3-32b",
            messages=working_messages,
            tools=all_tool_schemas,
            tool_choice="auto",
            parallel_tool_calls=False,
            max_tokens=MAX_TOKENS_TOOLS,
            temperature=0.2,
            stream=False,
            extra_body={"reasoning_format": "hidden"},
        )

        message = response.choices[0].message
        finish_reason = response.choices[0].finish_reason

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

            continue  # loop — LLM reads tool results and responds

        # ── Case 2: Malformed XML function tag ────────────────────
        elif message.content and "<function=" in message.content:
            yield {
                "type": "error",
                "content": "I encountered a formatting issue. Please try rephrasing.",
            }
            return

        # ── Case 3: Final text response — stream token by token ───
        # Higher temperature for natural language. Lower max_tokens
        # to stay within free tier TPM on the streaming call.
        else:
            stream = await groq_client.chat.completions.create(
                model="qwen/qwen3-32b",
                messages=working_messages,
                max_tokens=MAX_TOKENS_STREAM,
                temperature=0.7,
                stream=True,
                extra_body={"reasoning_format": "hidden"},
            )

            buffer = ""
            in_think = False

            async for chunk in stream:
                token = chunk.choices[0].delta.content
                if token is None:
                    continue

                buffer += token

                # Strip <think>...</think> blocks from reasoning models.
                # reasoning_format=hidden should prevent these but we
                # keep the fallback stripper for safety.
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
                            # Hold back 7 chars in case <think> is split
                            # across chunk boundaries
                            if len(buffer) > 7:
                                yield {"type": "token", "content": buffer[:-7]}
                                buffer = buffer[-7:]
                            break

            # Flush remaining buffer after stream ends
            if buffer and not in_think:
                yield {"type": "token", "content": buffer}

            return

    yield {
        "type": "error",
        "content": "I got stuck in a loop trying to answer that. Could you rephrase?",
    }