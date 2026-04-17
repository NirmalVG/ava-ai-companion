"""
services/tool_registry.py

The Tool Registry — a central catalogue of everything Ava can DO.

Architecture concept — two-part tool definition:
  1. SCHEMA  → what you send to the LLM so it knows the tool exists,
               what it does, and what arguments to provide.
  2. HANDLER → the actual Python function that executes when the LLM
               decides to call the tool.

Why separate schema from handler?
  The LLM never runs code. It reads the schema, decides "I should call
  get_weather with city='Thrissur'", and emits that as structured JSON.
  WE then look up the handler in this registry and execute it.
  This separation means you can add a tool by adding ONE entry here —
  the orchestration layer (groq_service.py) never needs to change.

Adding a new tool (e.g., create_calendar_event):
  1. Write the async handler function below
  2. Add its schema to TOOL_SCHEMAS
  3. Register it in TOOL_HANDLERS
  That's it. The LLM will automatically discover it on the next request.
"""

import json
import math
import httpx
from datetime import datetime
from zoneinfo import ZoneInfo


# ─── Handlers ────────────────────────────────────────────────────────────────
# Each handler is an async function that takes keyword args matching the
# tool's parameter schema and returns a plain string (the "tool result").
# The string goes back to the LLM as context for its final answer.

async def handle_get_current_time(timezone: str = "Asia/Kolkata") -> str:
    """
    Returns the current date and time in the requested timezone.

    Why timezone as a parameter?
      Ava has users across the world. The LLM infers timezone from context
      (e.g., user says "I'm in London") and passes it here.
      Default is IST since Ava's creator is in Kerala. 🌴
    """
    try:
        tz = ZoneInfo(timezone)
        now = datetime.now(tz)
        return json.dumps({
            "datetime": now.strftime("%A, %d %B %Y at %I:%M %p"),
            "timezone": timezone,
            "iso": now.isoformat(),
        })
    except Exception:
        # Fallback to UTC if timezone is invalid
        now = datetime.utcnow()
        return json.dumps({
            "datetime": now.strftime("%A, %d %B %Y at %I:%M %p UTC"),
            "timezone": "UTC",
            "iso": now.isoformat(),
        })


async def handle_get_weather(city: str) -> str:
    """
    Fetches current weather for a city using wttr.in — completely free, no API key.

    wttr.in is a weather service that returns JSON.
    We extract the essentials and return a clean summary for the LLM to narrate.
    """
    try:
        url = f"https://wttr.in/{city}?format=j1"
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(url)
            resp.raise_for_status()
            data = resp.json()

        current = data["current_condition"][0]
        area = data["nearest_area"][0]
        area_name = area["areaName"][0]["value"]
        country = area["country"][0]["value"]

        return json.dumps({
            "location": f"{area_name}, {country}",
            "temperature_c": current["temp_C"],
            "feels_like_c": current["FeelsLikeC"],
            "description": current["weatherDesc"][0]["value"],
            "humidity_pct": current["humidity"],
            "wind_kmph": current["windspeedKmph"],
        })
    except httpx.TimeoutException:
        return json.dumps({"error": "Weather service timed out. Try again in a moment."})
    except Exception as e:
        return json.dumps({"error": f"Could not fetch weather for '{city}': {str(e)}"})


async def handle_calculate(expression: str) -> str:
    """
    Safely evaluates a mathematical expression.

    Why not just use eval()?
      eval() is a massive security hole — a user could pass
      "__import__('os').system('rm -rf /')" and it would execute.

    Safe approach: whitelist only math operations using a restricted
    namespace. Only math module functions + basic operators are allowed.
    Anything else raises a NameError, which we catch and report.
    """
    # Restricted namespace: only math functions + constants
    safe_globals = {
        "__builtins__": {},  # no built-ins at all
        **{name: getattr(math, name) for name in dir(math) if not name.startswith("_")},
        "abs": abs,
        "round": round,
        "min": min,
        "max": max,
    }

    try:
        result = eval(expression, safe_globals)  # noqa: S307 — intentionally restricted
        return json.dumps({
            "expression": expression,
            "result": result,
        })
    except ZeroDivisionError:
        return json.dumps({"error": "Division by zero."})
    except Exception as e:
        return json.dumps({"error": f"Could not evaluate '{expression}': {str(e)}"})
    
async def handle_web_search(query: str) -> str:
    """
    Search the web using DuckDuckGo Instant Answer API.
    Free, no API key required.
    """
    try:
        url = "https://api.duckduckgo.com/"
        params = {
            "q": query,
            "format": "json",
            "no_redirect": "1",
            "no_html": "1",
            "skip_disambig": "1",
        }
        async with httpx.AsyncClient(timeout=8.0) as client:
            resp = await client.get(url, params=params)
            resp.raise_for_status()
            data = resp.json()

        # DuckDuckGo returns different result shapes depending on query type
        abstract = data.get("AbstractText", "")
        answer = data.get("Answer", "")
        related = [r.get("Text", "") for r in data.get("RelatedTopics", [])[:3] if r.get("Text")]

        result = {
            "query": query,
            "answer": answer or abstract or "No direct answer found.",
            "related": related,
            "source": data.get("AbstractSource", ""),
        }
        return json.dumps(result)
    except Exception as e:
        return json.dumps({"error": f"Search failed: {str(e)}"})


# ─── Tool Schemas ─────────────────────────────────────────────────────────────
# These are sent to the LLM on every request in the `tools` parameter.
# Groq/OpenAI tool schema format: type, function name, description, parameters.
# The description is CRITICAL — it's how the LLM decides when to use the tool.

TOOL_SCHEMAS = [
    {
        "type": "function",
        "function": {
            "name": "get_current_time",
            "description": (
                "Returns the current date and time. Use this whenever the user asks "
                "about the current time, date, day of the week, or anything time-related. "
                "Infer the timezone from context (e.g., if user mentions their city). "
                "Default to Asia/Kolkata (IST) if unknown."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "timezone": {
                        "type": "string",
                        "description": (
                            "IANA timezone string, e.g. 'Asia/Kolkata', 'Europe/London', "
                            "'America/New_York'. Default: 'Asia/Kolkata'."
                        ),
                    }
                },
                "required": [],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_weather",
            "description": (
                "Returns the current weather conditions for a given city. "
                "Use this when the user asks about weather, temperature, rain, "
                "or conditions in any location."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "city": {
                        "type": "string",
                        "description": "The city name, e.g. 'Thrissur', 'London', 'Tokyo'.",
                    }
                },
                "required": ["city"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "calculate",
            "description": (
                "Evaluates a mathematical expression and returns the result. "
                "Use this for arithmetic, trigonometry, logarithms, or any calculation "
                "where precision matters. Do NOT attempt to calculate in your head."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "expression": {
                        "type": "string",
                        "description": (
                            "A valid Python math expression, e.g. '2 ** 32', "
                            "'sqrt(144)', 'sin(pi / 6) * 100'. "
                            "Use math module functions directly (sqrt, sin, cos, log, etc.)."
                        ),
                    }
                },
                "required": ["expression"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "web_search",
            "description": (
                "Search the web for current information, news, facts, or anything "
                "that requires up-to-date knowledge. Use this when the user asks about "
                "recent events, specific facts you're uncertain about, or anything "
                "time-sensitive."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "A concise search query, e.g. 'latest iPhone model 2026'",
                    }
                },
                "required": ["query"],
            },
        },
    },
]


# ─── Handler Registry ─────────────────────────────────────────────────────────
# Maps tool name → async handler function.
# groq_service.py looks up the handler here after the LLM emits a tool call.

TOOL_HANDLERS: dict[str, callable] = {
    "get_current_time": handle_get_current_time,
    "get_weather": handle_get_weather,
    "calculate": handle_calculate,
    "web_search": handle_web_search,
}