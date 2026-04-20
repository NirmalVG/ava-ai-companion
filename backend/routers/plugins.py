"""
routers/plugins.py — Plugin installation and listing

Endpoints:
  GET  /plugins/{user_id}          — list all available plugins + install status
  POST /plugins/{user_id}/install  — install a plugin
  DELETE /plugins/{user_id}/{tool_name} — uninstall a plugin
"""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from pydantic import BaseModel

from database import get_db
from models import Plugin
from services.plugin_registry import PLUGIN_SCHEMAS

router = APIRouter()


class PluginOut(BaseModel):
    tool_name: str
    name: str
    description: str
    installed: bool
    enabled: bool


class InstallRequest(BaseModel):
    tool_name: str


@router.get("/{user_id}", response_model=list[PluginOut])
def list_plugins(user_id: str, db: Session = Depends(get_db)):
    """
    Returns all available plugins with their install status for this user.
    """
    installed = {
        p.tool_name: p
        for p in db.query(Plugin).filter(Plugin.user_id == user_id).all()
    }

    result = []
    for plugin in PLUGIN_SCHEMAS:
        db_entry = installed.get(plugin["tool_name"])
        result.append(PluginOut(
            tool_name=plugin["tool_name"],
            name=plugin["name"],
            description=plugin["description"],
            installed=db_entry is not None,
            enabled=db_entry.enabled == "true" if db_entry else False,
        ))
    return result


@router.post("/{user_id}/install", status_code=201)
def install_plugin(
    user_id: str,
    req: InstallRequest,
    db: Session = Depends(get_db),
):
    """Install a plugin for this user."""
    # Check it's a valid plugin
    valid = {p["tool_name"] for p in PLUGIN_SCHEMAS}
    if req.tool_name not in valid:
        return {"error": f"Unknown plugin: {req.tool_name}"}

    # Don't double-install
    existing = (
        db.query(Plugin)
        .filter(Plugin.user_id == user_id, Plugin.tool_name == req.tool_name)
        .first()
    )
    if existing:
        existing.enabled = "true"
        db.commit()
        return {"status": "already installed, re-enabled"}

    plugin_meta = next(p for p in PLUGIN_SCHEMAS if p["tool_name"] == req.tool_name)
    db.add(Plugin(
        user_id=user_id,
        name=plugin_meta["name"],
        description=plugin_meta["description"],
        tool_name=req.tool_name,
        base_url="built-in",
        enabled="true",
    ))
    db.commit()
    return {"status": "installed"}


@router.delete("/{user_id}/{tool_name}", status_code=200)
def uninstall_plugin(
    user_id: str,
    tool_name: str,
    db: Session = Depends(get_db),
):
    """Uninstall a plugin for this user."""
    plugin = (
        db.query(Plugin)
        .filter(Plugin.user_id == user_id, Plugin.tool_name == tool_name)
        .first()
    )
    if plugin:
        db.delete(plugin)
        db.commit()
    return {"status": "uninstalled"}


@router.get("/{user_id}/active-tools", response_model=list[str])
def get_active_tool_names(user_id: str, db: Session = Depends(get_db)):
    """Returns list of enabled tool_names for this user — used by groq_service."""
    return [
        p.tool_name
        for p in db.query(Plugin)
        .filter(Plugin.user_id == user_id, Plugin.enabled == "true")
        .all()
    ]