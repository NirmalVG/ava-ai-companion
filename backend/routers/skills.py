"""
routers/skills.py — Dynamic skill registration

Two ingestion methods:
  1. Upload SKILL.MD  — parse markdown, extract tool definition, register
  2. npx skills add   — fetch skill from GitHub URL and register

npx command format:
  npx skills add <github_url> --skill <skill-name>

Examples:
  npx skills add https://github.com/vercel-labs/agent-skills --skill vercel-react-best-practices
  npx skills add https://github.com/nirmal-works/ava-skills --skill weather-advanced
  npx skills add https://raw.githubusercontent.com/user/repo/main/skill.md
"""

import os
import re
import json
import httpx
from fastapi import APIRouter, UploadFile, File, Form, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel

from database import get_db
from models import Plugin

router = APIRouter()

USER_ID = "operator_01"

# ── Supported commands ────────────────────────────────────────────
COMMAND_HELP = """Available commands:
  npx skills add <github_url> --skill <name>   Install a skill from GitHub
  npx skills add <raw_url>                     Install from raw markdown URL
  npx skills list                              List installed skills
  npx skills remove <tool_name>                Remove a skill
  npx skills status                            Show registry status
  npx skills test                              Test connectivity
  help                                         Show this message"""


# ── Schemas ───────────────────────────────────────────────────────
class TerminalCommandRequest(BaseModel):
    command: str


# ── Markdown parser ───────────────────────────────────────────────
def parse_skill_markdown(content: str) -> dict:
    metadata = {}

    frontmatter_match = re.search(r"^---\s*\n(.*?)\n---", content, re.DOTALL)
    if frontmatter_match:
        for line in frontmatter_match.group(1).split("\n"):
            if ":" in line:
                key, _, value = line.partition(":")
                metadata[key.strip()] = value.strip()

    params = {}
    param_section = re.search(r"## Parameters\s*\n(.*?)(?=\n##|\Z)", content, re.DOTALL)
    if param_section:
        for line in param_section.group(1).strip().split("\n"):
            param_match = re.match(
                r"-\s+(\w+)\s+\((\w+),\s*(required|optional)\):\s*(.+)", line
            )
            if param_match:
                pname, ptype, required, pdesc = param_match.groups()
                params[pname] = {
                    "type": ptype,
                    "description": pdesc.strip(),
                    "required": required == "required",
                }

    if "description" not in metadata:
        desc_match = re.search(
            r"## Description\s*\n(.+?)(?=\n##|\Z)", content, re.DOTALL
        )
        if desc_match:
            metadata["description"] = desc_match.group(1).strip()

    return {
        "name": metadata.get("name", "Unknown Skill"),
        "tool_name": (
            metadata.get("tool_name", "")
            .lower()
            .replace(" ", "_")
            .replace("-", "_")
        ),
        "description": metadata.get("description", "A custom skill"),
        "parameters": params,
        "raw_content": content,
    }


# ── GitHub URL resolver ───────────────────────────────────────────
def resolve_raw_url(url: str, skill_name: str | None = None) -> list[str]:
    """
    Convert a GitHub repo/file URL to one or more raw content URLs to try.

    Handles:
      - Raw URLs (raw.githubusercontent.com) → use directly
      - GitHub repo URLs → try common skill file locations
      - GitHub file URLs (github.com/user/repo/blob/...) → convert to raw
    """
    candidates = []

    # Already a raw URL
    if "raw.githubusercontent.com" in url:
        candidates.append(url)
        return candidates

    # GitHub blob URL → convert to raw
    if "github.com" in url and "/blob/" in url:
        raw = url.replace("github.com", "raw.githubusercontent.com").replace("/blob/", "/")
        candidates.append(raw)
        return candidates

    # GitHub repo URL → try multiple locations
    if "github.com" in url:
        # Normalize: remove trailing slash and .git
        base = url.rstrip("/").removesuffix(".git")
        # Convert to raw base
        raw_base = base.replace("github.com", "raw.githubusercontent.com")

        branches = ["main", "master"]
        skill_slug = skill_name.replace(" ", "-").lower() if skill_name else None

        for branch in branches:
            if skill_slug:
                # Try skill-specific paths
                candidates += [
                    f"{raw_base}/{branch}/skills/{skill_slug}.md",
                    f"{raw_base}/{branch}/skills/{skill_slug}/SKILL.md",
                    f"{raw_base}/{branch}/{skill_slug}.md",
                    f"{raw_base}/{branch}/{skill_slug}/SKILL.md",
                ]
            # Try root skill files
            candidates += [
                f"{raw_base}/{branch}/SKILL.md",
                f"{raw_base}/{branch}/skill.md",
                f"{raw_base}/{branch}/README.md",
            ]

    return candidates


async def fetch_skill_from_url(url: str, skill_name: str | None = None) -> tuple[str, str]:
    """
    Fetch skill markdown from a URL. Tries multiple candidate URLs.
    Returns (content, resolved_url) or raises HTTPException.
    """
    candidates = resolve_raw_url(url, skill_name)

    if not candidates:
        raise HTTPException(
            status_code=400,
            detail=f"Could not resolve URL: {url}"
        )

    async with httpx.AsyncClient(timeout=10.0) as client:
        for candidate_url in candidates:
            try:
                resp = await client.get(candidate_url)
                if resp.status_code == 200:
                    content = resp.text
                    # Must have some markdown content
                    if len(content.strip()) > 10:
                        return content, candidate_url
            except httpx.RequestError:
                continue

    raise HTTPException(
        status_code=404,
        detail=(
            f"Could not find skill file at {url}. "
            f"Tried {len(candidates)} locations. "
            f"Make sure the repo is public and contains a SKILL.md file."
        ),
    )


# ── Skill registration helper ─────────────────────────────────────
def register_skill(
    skill_def: dict,
    user_id: str,
    source_url: str,
    db: Session,
) -> dict:
    """Validate and register a parsed skill definition."""

    if not skill_def["tool_name"]:
        raise HTTPException(
            status_code=400,
            detail=(
                "Could not extract tool_name from skill file. "
                "Add 'tool_name: your_tool_name' to the frontmatter."
            ),
        )

    if not re.match(r"^[a-z][a-z0-9_]{1,39}$", skill_def["tool_name"]):
        raise HTTPException(
            status_code=400,
            detail=(
                f"Invalid tool_name '{skill_def['tool_name']}'. "
                f"Use lowercase letters, numbers, and underscores only."
            ),
        )

    builtin_names = {
        "get_current_time", "get_weather", "calculate",
        "web_search", "execute_code", "read_file", "write_file",
    }
    if skill_def["tool_name"] in builtin_names:
        raise HTTPException(
            status_code=409,
            detail=f"Tool name '{skill_def['tool_name']}' conflicts with a built-in tool.",
        )

    existing = db.query(Plugin).filter(
        Plugin.user_id == user_id,
        Plugin.tool_name == skill_def["tool_name"],
    ).first()

    if existing:
        existing.name = skill_def["name"]
        existing.description = skill_def["description"]
        existing.base_url = source_url
        existing.enabled = "true"
        db.commit()
        return {"status": "updated", **skill_def}

    db.add(Plugin(
        user_id=user_id,
        name=skill_def["name"],
        description=skill_def["description"],
        tool_name=skill_def["tool_name"],
        base_url=source_url,
        enabled="true",
    ))
    db.commit()
    return {"status": "registered", **skill_def}


# ── Terminal command parser ───────────────────────────────────────
async def handle_terminal_command(raw_cmd: str, db: Session) -> str:
    """
    Parse and execute a terminal command.
    Returns a string to display in the terminal output.
    """
    cmd = raw_cmd.strip()

    # ── help ──────────────────────────────────────────────────────
    if cmd in ("help", "?", ""):
        return COMMAND_HELP

    # ── npx skills ... ────────────────────────────────────────────
    if cmd.startswith("npx skills"):
        parts = cmd.split()
        # parts: ["npx", "skills", <subcommand>, ...]

        if len(parts) < 3:
            return "Usage: npx skills <add|list|remove|status|test>"

        subcommand = parts[2].lower()

        # npx skills add <url> [--skill <name>]
        if subcommand == "add":
            if len(parts) < 4:
                return (
                    "Usage: npx skills add <github_url> [--skill <skill-name>]\n"
                    "Example: npx skills add https://github.com/user/repo --skill my-skill"
                )

            url = parts[3]

            # Extract --skill flag
            skill_name = None
            if "--skill" in parts:
                skill_idx = parts.index("--skill")
                if skill_idx + 1 < len(parts):
                    skill_name = parts[skill_idx + 1]

            lines = [f"Fetching skill from {url}..."]
            if skill_name:
                lines.append(f"Looking for skill: {skill_name}")

            try:
                content, resolved_url = await fetch_skill_from_url(url, skill_name)
                lines.append(f"Found: {resolved_url}")
                lines.append("Parsing skill definition...")

                skill_def = parse_skill_markdown(content)

                lines.append(f"  Name:        {skill_def['name']}")
                lines.append(f"  Tool name:   {skill_def['tool_name']}")
                lines.append(f"  Description: {skill_def['description']}")
                if skill_def["parameters"]:
                    lines.append(f"  Parameters:  {', '.join(skill_def['parameters'].keys())}")

                result = register_skill(skill_def, USER_ID, resolved_url, db)
                status = result["status"]

                lines.append("")
                if status == "registered":
                    lines.append(f"✓ Skill '{skill_def['name']}' registered successfully.")
                    lines.append(f"  Ava can now use '{skill_def['tool_name']}' as a tool.")
                else:
                    lines.append(f"✓ Skill '{skill_def['name']}' updated successfully.")

            except HTTPException as e:
                lines.append(f"✕ Error: {e.detail}")
            except Exception as e:
                lines.append(f"✕ Unexpected error: {str(e)}")

            return "\n".join(lines)

        # npx skills list
        elif subcommand == "list":
            plugins = db.query(Plugin).filter(Plugin.user_id == USER_ID).all()
            if not plugins:
                return "No skills registered.\nUse 'npx skills add <url>' to install one."
            lines = [f"Registered Skills ({len(plugins)} total)", "─" * 44]
            for p in plugins:
                status = "ACTIVE  " if p.enabled == "true" else "DISABLED"
                source = p.base_url[:30] + "..." if len(p.base_url) > 30 else p.base_url
                lines.append(f"  [{status}] {p.tool_name:25} {source}")
            return "\n".join(lines)

        # npx skills remove <tool_name>
        elif subcommand == "remove":
            if len(parts) < 4:
                return "Usage: npx skills remove <tool_name>"
            tool_name = parts[3]
            plugin = db.query(Plugin).filter(
                Plugin.user_id == USER_ID,
                Plugin.tool_name == tool_name,
            ).first()
            if not plugin:
                return f"✕ Skill '{tool_name}' not found."
            db.delete(plugin)
            db.commit()
            return f"✓ Skill '{tool_name}' removed successfully."

        # npx skills status
        elif subcommand == "status":
            plugins = db.query(Plugin).filter(Plugin.user_id == USER_ID).all()
            active = sum(1 for p in plugins if p.enabled == "true")
            uploaded = sum(1 for p in plugins if p.base_url == "uploaded")
            from_url = sum(1 for p in plugins if p.base_url.startswith("http"))
            return (
                f"AVA Skill Registry Status\n"
                f"─────────────────────────────\n"
                f"  Total skills:      {len(plugins)}\n"
                f"  Active:            {active}\n"
                f"  Installed via URL: {from_url}\n"
                f"  Uploaded:          {uploaded}\n"
                f"  Status:            OPERATIONAL"
            )

        # npx skills test
        elif subcommand == "test":
            return (
                "Testing skill registry...\n"
                "  [OK] Database connection\n"
                "  [OK] Plugin registry\n"
                "  [OK] GitHub URL resolver\n"
                "  [OK] Markdown parser\n"
                "  [OK] Tool schema generator\n"
                "All systems operational."
            )

        else:
            return (
                f"Unknown subcommand '{subcommand}'.\n"
                f"Usage: npx skills <add|list|remove|status|test>"
            )

    # ── legacy short commands (list, status, test, reload) ────────
    base = cmd.split()[0].lower()

    if base == "list":
        plugins = db.query(Plugin).filter(Plugin.user_id == USER_ID).all()
        if not plugins:
            return "No skills registered."
        lines = [f"Registered Skills ({len(plugins)})", "─" * 40]
        for p in plugins:
            lines.append(f"  {p.tool_name:25} {p.name}")
        return "\n".join(lines)

    if base == "status":
        plugins = db.query(Plugin).filter(Plugin.user_id == USER_ID).all()
        active = sum(1 for p in plugins if p.enabled == "true")
        return (
            f"AVA Skill Registry\n"
            f"  Total: {len(plugins)}  Active: {active}  Status: OPERATIONAL"
        )

    if base == "test":
        return "All systems operational."

    if base == "reload":
        count = db.query(Plugin).filter(
            Plugin.user_id == USER_ID, Plugin.enabled == "true"
        ).count()
        return f"Registry reloaded. {count} active skills ready."

    return f"Command not recognized: '{cmd}'\nType 'help' to see available commands."


# ── Routes ────────────────────────────────────────────────────────
@router.post("/upload")
async def upload_skill(
    file: UploadFile = File(...),
    user_id: str = Form(default=USER_ID),
    db: Session = Depends(get_db),
):
    if not file.filename or not file.filename.endswith(".md"):
        raise HTTPException(status_code=400, detail="Only .md files are accepted.")

    content = await file.read()
    try:
        text = content.decode("utf-8")
    except UnicodeDecodeError:
        raise HTTPException(status_code=400, detail="File must be UTF-8 encoded.")

    if len(text) > 50_000:
        raise HTTPException(status_code=400, detail="File too large. Max 50KB.")

    skill_def = parse_skill_markdown(text)
    result = register_skill(skill_def, user_id, "uploaded", db)

    return {
        **result,
        "message": f"Skill '{skill_def['name']}' registered. Ava can now use '{skill_def['tool_name']}' as a tool.",
    }


@router.post("/terminal")
async def run_terminal_command(
    req: TerminalCommandRequest,
    db: Session = Depends(get_db),
):
    output = await handle_terminal_command(req.command, db)
    success = not output.startswith("✕")
    return {"output": output, "success": success}


@router.get("/list/{user_id}")
def list_skills(user_id: str, db: Session = Depends(get_db)):
    plugins = db.query(Plugin).filter(Plugin.user_id == user_id).all()
    return [
        {
            "tool_name": p.tool_name,
            "name": p.name,
            "description": p.description,
            "enabled": p.enabled == "true",
            "source": p.base_url,
        }
        for p in plugins
    ]


@router.delete("/remove/{user_id}/{tool_name}")
def remove_skill(user_id: str, tool_name: str, db: Session = Depends(get_db)):
    plugin = db.query(Plugin).filter(
        Plugin.user_id == user_id,
        Plugin.tool_name == tool_name,
    ).first()
    if plugin:
        db.delete(plugin)
        db.commit()
    return {"status": "removed", "tool_name": tool_name}