"""
services/tool_registry.py

Central catalogue of core tools Ava can use.
"""

import json
import math
import httpx
import subprocess
import tempfile
import os
import sys
from datetime import datetime
from zoneinfo import ZoneInfo


# ─── Handlers ────────────────────────────────────────────────────

async def handle_get_current_time(timezone: str = "Asia/Kolkata") -> str:
    try:
        tz = ZoneInfo(timezone)
        now = datetime.now(tz)
        return json.dumps({
            "datetime": now.strftime("%A, %d %B %Y at %I:%M %p"),
            "timezone": timezone,
            "iso": now.isoformat(),
        })
    except Exception:
        now = datetime.utcnow()
        return json.dumps({
            "datetime": now.strftime("%A, %d %B %Y at %I:%M %p UTC"),
            "timezone": "UTC",
            "iso": now.isoformat(),
        })


async def handle_get_weather(city: str) -> str:
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
        return json.dumps({"error": "Weather service timed out."})
    except Exception as e:
        return json.dumps({"error": f"Could not fetch weather: {str(e)}"})


async def handle_calculate(expression: str) -> str:
    safe_globals = {
        "__builtins__": {},
        **{name: getattr(math, name) for name in dir(math) if not name.startswith("_")},
        "abs": abs,
        "round": round,
        "min": min,
        "max": max,
    }
    try:
        result = eval(expression, safe_globals)  # noqa: S307
        return json.dumps({"expression": expression, "result": result})
    except ZeroDivisionError:
        return json.dumps({"error": "Division by zero."})
    except Exception as e:
        return json.dumps({"error": f"Could not evaluate '{expression}': {str(e)}"})


async def handle_web_search(query: str) -> str:
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

        abstract = data.get("AbstractText", "")
        answer = data.get("Answer", "")
        related = [
            r.get("Text", "")
            for r in data.get("RelatedTopics", [])[:3]
            if isinstance(r, dict) and r.get("Text")
        ]

        return json.dumps({
            "query": query,
            "answer": answer or abstract or "No direct answer found.",
            "related": related,
            "source": data.get("AbstractSource", ""),
        })
    except httpx.TimeoutException:
        return json.dumps({"error": "Search timed out."})
    except Exception as e:
        return json.dumps({"error": f"Search failed: {str(e)}"})


async def handle_execute_code(
    code: str,
    language: str = "python",
) -> str:
    """
    Execute code in a subprocess and return stdout, stderr, and exit code.

    Security model:
      - Runs in a temp file, deleted after execution
      - 10 second timeout hard limit
      - Only Python supported locally (safe, already on server)
      - No network calls from executed code (no additional restrictions
        needed since this is a personal local assistant)

    Why subprocess and not exec()?
      exec() runs in the same process — a crash or infinite loop kills
      the FastAPI server. subprocess isolates the execution completely.
    """
    if language.lower() not in ("python", "py"):
        return json.dumps({
            "error": f"Language '{language}' not supported for local execution. "
                     f"Only Python is supported currently.",
            "stdout": "",
            "stderr": "",
            "exit_code": 1,
        })

    # Write code to a temp file
    with tempfile.NamedTemporaryFile(
        mode="w",
        suffix=".py",
        delete=False,
        encoding="utf-8",
    ) as tmp:
        tmp.write(code)
        tmp_path = tmp.name

    try:
        result = subprocess.run(
            [sys.executable, tmp_path],
            capture_output=True,
            text=True,
            timeout=10,
            cwd=tempfile.gettempdir(),
        )
        return json.dumps({
            "stdout": result.stdout.strip(),
            "stderr": result.stderr.strip(),
            "exit_code": result.returncode,
            "success": result.returncode == 0,
        })
    except subprocess.TimeoutExpired:
        return json.dumps({
            "error": "Code execution timed out after 10 seconds.",
            "stdout": "",
            "stderr": "",
            "exit_code": 124,
            "success": False,
        })
    except Exception as e:
        return json.dumps({
            "error": f"Execution failed: {str(e)}",
            "stdout": "",
            "stderr": "",
            "exit_code": 1,
            "success": False,
        })
    finally:
        try:
            os.unlink(tmp_path)
        except OSError:
            pass


async def handle_read_file(filepath: str) -> str:
    """
    Read a local file and return its contents.
    Used for code fixing — Ava can read the actual file, not just
    what the user pastes.

    Restricted to text files under 50KB for safety.
    """
    try:
        path = os.path.abspath(filepath)

        if not os.path.exists(path):
            return json.dumps({"error": f"File not found: {filepath}"})

        size = os.path.getsize(path)
        if size > 50_000:
            return json.dumps({
                "error": f"File too large ({size} bytes). Max 50KB for reading."
            })

        with open(path, "r", encoding="utf-8", errors="replace") as f:
            content = f.read()

        return json.dumps({
            "filepath": path,
            "content": content,
            "lines": content.count("\n") + 1,
            "size_bytes": size,
        })
    except PermissionError:
        return json.dumps({"error": f"Permission denied reading: {filepath}"})
    except Exception as e:
        return json.dumps({"error": str(e)})


async def handle_write_file(filepath: str, content: str) -> str:
    """
    Write content to a local file.
    Used when Ava fixes code — she can write the corrected version directly.

    Creates parent directories if they don't exist.
    """
    try:
        path = os.path.abspath(filepath)
        os.makedirs(os.path.dirname(path), exist_ok=True)

        with open(path, "w", encoding="utf-8") as f:
            f.write(content)

        return json.dumps({
            "success": True,
            "filepath": path,
            "bytes_written": len(content.encode("utf-8")),
        })
    except PermissionError:
        return json.dumps({"error": f"Permission denied writing to: {filepath}"})
    except Exception as e:
        return json.dumps({"error": str(e)})


# ─── Tool Schemas ─────────────────────────────────────────────────

TOOL_SCHEMAS = [
    {
        "type": "function",
        "function": {
            "name": "get_current_time",
            "description": (
                "Returns the current date and time. Use this whenever the user asks "
                "about the current time, date, or day of the week. "
                "Default timezone: Asia/Kolkata (IST)."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "timezone": {
                        "type": "string",
                        "description": "IANA timezone string e.g. 'Asia/Kolkata', 'Europe/London'.",
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
                "Returns current weather for a city. Use when the user asks about "
                "weather, temperature, rain, or conditions in any location."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "city": {
                        "type": "string",
                        "description": "City name e.g. 'Thrissur', 'London', 'Tokyo'.",
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
                "Evaluates a mathematical expression. Use for arithmetic, "
                "trigonometry, logarithms, or any calculation where precision matters. "
                "Do NOT attempt to calculate in your head."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "expression": {
                        "type": "string",
                        "description": (
                            "A valid Python math expression e.g. '2 ** 32', "
                            "'sqrt(144)', 'sin(pi / 6) * 100'."
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
                "Search the web for current information, recent news, or facts. "
                "Use when the user needs up-to-date knowledge beyond training data."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "A concise search query e.g. 'latest Python release 2026'.",
                    }
                },
                "required": ["query"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "execute_code",
            "description": (
                "Execute Python code and return the output, errors, and exit code. "
                "Use this to: verify a code fix works, test a function, debug an error, "
                "run a calculation too complex for the calculator, or demonstrate "
                "that a solution is correct. Always execute code after writing a fix "
                "to confirm it works before presenting it to the user."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "code": {
                        "type": "string",
                        "description": "Valid Python code to execute.",
                    },
                    "language": {
                        "type": "string",
                        "description": "Programming language. Currently only 'python' is supported.",
                        "enum": ["python"],
                    },
                },
                "required": ["code"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "read_file",
            "description": (
                "Read the contents of a local file. Use when the user asks you to "
                "fix, review, or analyze a specific file on their system. "
                "Provide the full or relative file path."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "filepath": {
                        "type": "string",
                        "description": "Full or relative path to the file e.g. 'backend/main.py'.",
                    }
                },
                "required": ["filepath"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "write_file",
            "description": (
                "Write content to a local file. Use after fixing code to save "
                "the corrected version directly to disk. Always confirm the fix "
                "works by running execute_code before writing."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "filepath": {
                        "type": "string",
                        "description": "Full or relative path to write to.",
                    },
                    "content": {
                        "type": "string",
                        "description": "The complete file content to write.",
                    },
                },
                "required": ["filepath", "content"],
            },
        },
    },
]


# ─── Handler Registry ─────────────────────────────────────────────

TOOL_HANDLERS: dict[str, callable] = {
    "get_current_time": handle_get_current_time,
    "get_weather": handle_get_weather,
    "calculate": handle_calculate,
    "web_search": handle_web_search,
    "execute_code": handle_execute_code,
    "read_file": handle_read_file,
    "write_file": handle_write_file,
}