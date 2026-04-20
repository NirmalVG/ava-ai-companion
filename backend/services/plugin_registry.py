"""
services/plugin_registry.py

Dynamic plugin tool registry.

Built-in plugins are defined here directly — no external server needed.
Each plugin exposes:
  - A SCHEMA  → sent to the LLM so it knows the tool exists
  - A HANDLER → async function that executes when the LLM calls it

Built-in demo plugins:
  github_repo    → fetch public GitHub repo stats
  dictionary     → look up a word definition
  crypto_price   → fetch current crypto price
"""

import json
import httpx


# ── Handlers ─────────────────────────────────────────────────────

async def handle_github_repo(repo: str) -> str:
    """
    Fetch public stats for a GitHub repository.
    repo format: "owner/repo" e.g. "vercel/next.js"
    """
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
    """
    Look up definition of a word using the Free Dictionary API.
    No API key required.
    """
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
        for meaning in meanings[:2]:   # max 2 parts of speech
            part = meaning.get("partOfSpeech", "")
            defs = meaning.get("definitions", [])
            if defs:
                results.append({
                    "part_of_speech": part,
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


async def handle_crypto_price(coin: str) -> str:
    """
    Fetch current price of a cryptocurrency using CoinGecko API.
    No API key required for basic usage.
    coin: coin id e.g. "bitcoin", "ethereum", "solana"
    """
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
            return json.dumps({"error": f"Coin '{coin}' not found. Try 'bitcoin', 'ethereum', 'solana'."})

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


# ── Schemas ───────────────────────────────────────────────────────

PLUGIN_SCHEMAS = [
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
                            "description": "Repository in 'owner/repo' format, e.g. 'vercel/next.js'",
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
                            "description": "CoinGecko coin id, e.g. 'bitcoin', 'ethereum', 'solana'",
                        }
                    },
                    "required": ["coin"],
                },
            },
        },
        "handler": handle_crypto_price,
    },
]

# Map tool_name → handler for quick lookup
PLUGIN_HANDLERS: dict[str, callable] = {
    p["tool_name"]: p["handler"] for p in PLUGIN_SCHEMAS
}

# Map tool_name → schema for sending to LLM
PLUGIN_TOOL_SCHEMAS: dict[str, dict] = {
    p["tool_name"]: p["schema"] for p in PLUGIN_SCHEMAS
}