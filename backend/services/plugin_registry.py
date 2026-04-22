"""
services/plugin_registry.py

Two-tier plugin system:
  1. Built-in plugins — hardcoded handlers + schemas (github_repo, dictionary, crypto_price)
  2. Dynamic skills   — registered via DB, handler generated at runtime

Dynamic skill handlers return a helpful message explaining the skill
was registered but needs a custom handler implementation.
For skills loaded from GitHub, the skill definition guides the LLM
on what the tool does — the LLM synthesizes a response using its
own knowledge when no live API is available.
"""

import json
import httpx
from sqlalchemy.orm import Session


# ── Built-in handlers ─────────────────────────────────────────────

async def handle_github_repo(repo: str) -> str:
    try:
        url = f"https://api.github.com/repos/{repo}"
        async with httpx.AsyncClient(timeout=8.0) as client:
            resp = await client.get(
                url,
                headers={"Accept": "application/vnd.github.v3+json"},
            )
            if resp.status_code == 404:
                return json.dumps({"error": f"Repository '{repo}' not found."})
            resp.raise_for_status()
            data = resp.json()
        return json.dumps({
            "name": data.get("full_name"),
            "description": data.get("description"),
            "stars": data.get("stargazers_count"),
            "forks": data.get("forks_count"),
            "language": data.get("language"),
            "open_issues": data.get("open_issues_count"),
            "last_updated": data.get("updated_at", "")[:10],
            "url": data.get("html_url"),
        })
    except httpx.TimeoutException:
        return json.dumps({"error": "GitHub API timed out."})
    except Exception as e:
        return json.dumps({"error": str(e)})


async def handle_dictionary(word: str) -> str:
    try:
        url = f"https://api.dictionaryapi.dev/api/v2/entries/en/{word}"
        async with httpx.AsyncClient(timeout=8.0) as client:
            resp = await client.get(url)
            if resp.status_code == 404:
                return json.dumps({"error": f"No definition found for '{word}'."})
            resp.raise_for_status()
            data = resp.json()
        entry = data[0]
        meanings = entry.get("meanings", [])
        results = []
        for meaning in meanings[:2]:
            defs = meaning.get("definitions", [])
            if defs:
                results.append({
                    "part_of_speech": meaning.get("partOfSpeech", ""),
                    "definition": defs[0].get("definition", ""),
                    "example": defs[0].get("example", ""),
                })
        return json.dumps({
            "word": entry.get("word"),
            "phonetic": entry.get("phonetic", ""),
            "meanings": results,
        })
    except httpx.TimeoutException:
        return json.dumps({"error": "Dictionary API timed out."})
    except Exception as e:
        return json.dumps({"error": str(e)})

async def handle_weather(location: str) -> str:
    try:
        # wttr.in supports JSON output via the format=j1 parameter
        url = f"https://wttr.in/{location}?format=j1"
        async with httpx.AsyncClient(timeout=8.0) as client:
            resp = await client.get(url)
            if resp.status_code == 404:
                return json.dumps({"error": f"Weather data for '{location}' not found."})
            resp.raise_for_status()
            data = resp.json()
            
        current = data.get("current_condition", [{}])[0]
        return json.dumps({
            "location": location,
            "temperature_c": current.get("temp_C"),
            "temperature_f": current.get("temp_F"),
            "condition": current.get("weatherDesc", [{}])[0].get("value"),
            "humidity": current.get("humidity"),
            "wind_kmh": current.get("windspeedKmph"),
        })
    except httpx.TimeoutException:
        return json.dumps({"error": "wttr.in API timed out."})
    except Exception as e:
        return json.dumps({"error": str(e)})

async def handle_notion(query: str) -> str:
    """Mock handler for Notion integration."""
    return json.dumps({
        "status": "success",
        "simulated_results": [f"Page matching '{query}'", "Project Roadmap", "Meeting Notes"]
    })

async def handle_github_issues(repo: str) -> str:
    """Mock handler for GitHub Issues."""
    return json.dumps({
        "repo": repo,
        "open_issues": ["Issue #12: Update documentation", "Issue #15: Fix layout bug"]
    })

async def handle_stripe(action: str) -> str:
    """Mock handler for Stripe."""
    return json.dumps({
        "account_balance": "$4,250.00",
        "recent_transactions": 3,
        "status": "Authentication pending real API keys"
    })

async def handle_calendar(date: str) -> str:
    """Mock handler for Google Calendar."""
    return json.dumps({
        "date_queried": date,
        "events": ["10:00 AM - Daily Standup", "2:00 PM - Architecture Review"]
    })

async def handle_supabase(table: str) -> str:
    """Mock handler for Supabase."""
    return json.dumps({
        "queried_table": table,
        "rows_returned": 5,
        "status": "success"
    })


async def handle_crypto_price(coin: str) -> str:
    try:
        url = "https://api.coingecko.com/api/v3/simple/price"
        params = {
            "ids": coin.lower(),
            "vs_currencies": "usd",
            "include_24hr_change": "true",
        }
        async with httpx.AsyncClient(timeout=8.0) as client:
            resp = await client.get(url, params=params)
            resp.raise_for_status()
            data = resp.json()
        if coin.lower() not in data:
            return json.dumps({
                "error": f"Coin '{coin}' not found. Try 'bitcoin', 'ethereum', 'solana'."
            })
        coin_data = data[coin.lower()]
        return json.dumps({
            "coin": coin,
            "price_usd": coin_data.get("usd"),
            "change_24h_pct": round(coin_data.get("usd_24h_change", 0), 2),
        })
    except httpx.TimeoutException:
        return json.dumps({"error": "CoinGecko API timed out."})
    except Exception as e:
        return json.dumps({"error": str(e)})


# ── Built-in plugin catalogue ─────────────────────────────────────

BUILTIN_PLUGIN_SCHEMAS = [
    {
        "tool_name": "github_repo",
        "name": "GitHub Repo",
        "description": "Fetch public stats for any GitHub repository",
        "schema": {
            "type": "function",
            "function": {
                "name": "github_repo",
                "description": (
                    "Fetch public information about a GitHub repository — stars, forks, "
                    "language, open issues, last updated. Use when user asks about a "
                    "GitHub repo or wants repo stats."
                ),
                "parameters": {
                    "type": "object",
                    "properties": {
                        "repo": {
                            "type": "string",
                            "description": "Repository in 'owner/repo' format e.g. 'vercel/next.js'",
                        }
                    },
                    "required": ["repo"],
                },
            },
        },
        "handler": handle_github_repo,
    },
    {
        "tool_name": "dictionary",
        "name": "Dictionary",
        "description": "Look up definitions and examples for any English word",
        "schema": {
            "type": "function",
            "function": {
                "name": "dictionary",
                "description": (
                    "Look up the definition, part of speech, and example usage of an "
                    "English word. Use when the user asks what a word means."
                ),
                "parameters": {
                    "type": "object",
                    "properties": {
                        "word": {
                            "type": "string",
                            "description": "The English word to look up",
                        }
                    },
                    "required": ["word"],
                },
            },
        },
        "handler": handle_dictionary,
    },
    {
        "tool_name": "crypto_price",
        "name": "Crypto Price",
        "description": "Get live cryptocurrency prices from CoinGecko",
        "schema": {
            "type": "function",
            "function": {
                "name": "crypto_price",
                "description": (
                    "Get the current USD price and 24h change for a cryptocurrency. "
                    "Use when the user asks about crypto prices."
                ),
                "parameters": {
                    "type": "object",
                    "properties": {
                        "coin": {
                            "type": "string",
                            "description": "CoinGecko coin id e.g. 'bitcoin', 'ethereum', 'solana'",
                        }
                    },
                    "required": ["coin"],
                },
            },
        },
        "handler": handle_crypto_price,
    },
    {
        "tool_name": "weather",
        "name": "Weather",
        "description": "Get current weather data from wttr.in",
        "schema": {
            "type": "function",
            "function": {
                "name": "weather",
                "description": (
                    "Get the current weather conditions for a specific city or location. "
                    "Use when the user asks about the weather."
                ),
                "parameters": {
                    "type": "object",
                    "properties": {
                        "location": {
                            "type": "string",
                            "description": "The city name, e.g., 'Kochi', 'London', 'Tokyo'",
                        }
                    },
                    "required": ["location"],
                },
            },
        },
        "handler": handle_weather,
    },
    {
        "tool_name": "notion",
        "name": "Notion",
        "description": "Search and read Notion workspace pages",
        "schema": {
            "type": "function",
            "function": {
                "name": "notion",
                "description": "Search the user's Notion workspace for notes and documents.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "query": {
                            "type": "string",
                            "description": "The search term to look for in Notion.",
                        }
                    },
                    "required": ["query"],
                },
            },
        },
        "handler": handle_notion,
    },
    {
        "tool_name": "github",
        "name": "GitHub Issues",
        "description": "Read and manage GitHub repository issues",
        "schema": {
            "type": "function",
            "function": {
                "name": "github",
                "description": "Fetch open issues for a specific GitHub repository.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "repo": {
                            "type": "string",
                            "description": "The repository name, e.g., 'owner/repo'.",
                        }
                    },
                    "required": ["repo"],
                },
            },
        },
        "handler": handle_github_issues,
    },
    {
        "tool_name": "stripe",
        "name": "Stripe",
        "description": "Access Stripe financial data and webhooks",
        "schema": {
            "type": "function",
            "function": {
                "name": "stripe",
                "description": "Check financial metrics and recent transactions via Stripe.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "action": {
                            "type": "string",
                            "description": "The action to perform, e.g., 'balance' or 'recent_charges'.",
                        }
                    },
                    "required": ["action"],
                },
            },
        },
        "handler": handle_stripe,
    },
    {
        "tool_name": "calendar",
        "name": "Google Calendar",
        "description": "Read and write Google Calendar events",
        "schema": {
            "type": "function",
            "function": {
                "name": "calendar",
                "description": "Check the user's schedule or look for upcoming calendar events.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "date": {
                            "type": "string",
                            "description": "The date to check, e.g., 'today', 'tomorrow', or 'YYYY-MM-DD'.",
                        }
                    },
                    "required": ["date"],
                },
            },
        },
        "handler": handle_calendar,
    },
    {
        "tool_name": "supabase",
        "name": "Supabase",
        "description": "Query Supabase database tables directly",
        "schema": {
            "type": "function",
            "function": {
                "name": "supabase",
                "description": "Query data from a specific Supabase database table.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "table": {
                            "type": "string",
                            "description": "The name of the database table to query.",
                        }
                    },
                    "required": ["table"],
                },
            },
        },
        "handler": handle_supabase,
    },
]

# Static lookups for built-ins
BUILTIN_HANDLERS: dict[str, callable] = {
    p["tool_name"]: p["handler"] for p in BUILTIN_PLUGIN_SCHEMAS
}

BUILTIN_TOOL_SCHEMAS: dict[str, dict] = {
    p["tool_name"]: p["schema"] for p in BUILTIN_PLUGIN_SCHEMAS
}

# Keep PLUGIN_SCHEMAS as alias for context/plugins routers
PLUGIN_SCHEMAS = BUILTIN_PLUGIN_SCHEMAS


# ── Dynamic skill loader ──────────────────────────────────────────

def make_dynamic_handler(tool_name: str, description: str):
    """
    Generate a stub async handler for a dynamically registered skill.

    When the LLM calls this tool, it returns a structured context object
    that tells the LLM what the tool is for, so it can synthesize a
    useful response using its own knowledge.
    """
    async def handler(**kwargs) -> str:
        return json.dumps({
            "tool": tool_name,
            "description": description,
            "input": kwargs,
            "note": (
                f"This is a custom registered skill: {description}. "
                f"Use your knowledge to fulfill this request based on the provided input. "
                f"Provide a detailed, helpful response."
            ),
        })
    handler.__name__ = tool_name
    return handler


def build_dynamic_schema(tool_name: str, name: str, description: str) -> dict:
    """Build a tool schema for a dynamically registered skill."""
    return {
        "type": "function",
        "function": {
            "name": tool_name,
            "description": description,
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": f"Input query for {name}",
                    }
                },
                "required": ["query"],
            },
        },
    }


def get_dynamic_plugins(db: Session, user_id: str) -> tuple[dict, dict]:
    """
    Load all DB-registered plugins for a user that are NOT built-ins.
    Returns (handlers_dict, schemas_dict)
    """
    from models import Plugin

    builtin_names = set(BUILTIN_HANDLERS.keys())

    plugins = (
        db.query(Plugin)
        .filter(
            Plugin.user_id == user_id,
            Plugin.enabled == "true",
        )
        .all()
    )

    handlers = {}
    schemas = {}

    for plugin in plugins:
        if plugin.tool_name in builtin_names:
            # Built-ins are handled separately
            continue

        handlers[plugin.tool_name] = make_dynamic_handler(
            plugin.tool_name,
            plugin.description,
        )
        schemas[plugin.tool_name] = build_dynamic_schema(
            plugin.tool_name,
            plugin.name,
            plugin.description,
        )

    return handlers, schemas


# ── Public API used by groq_service.py ───────────────────────────
# These remain for backward compatibility

PLUGIN_TOOL_SCHEMAS = BUILTIN_TOOL_SCHEMAS
PLUGIN_HANDLERS = BUILTIN_HANDLERS