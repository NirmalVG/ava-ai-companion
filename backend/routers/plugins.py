"""
routers/plugins.py

Route conflict fix: the wildcard DELETE /{user_id}/{tool_name} was
swallowing POST /{user_id}/install.

Solution: move install to a path that cannot be confused with a tool_name.
New install path: POST /{user_id}/action/install
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel

from database import get_db
from models import Plugin
from services.plugin_registry import BUILTIN_PLUGIN_SCHEMAS

router = APIRouter()


class PluginOut(BaseModel):
    tool_name: str
    name: str
    description: str
    installed: bool
    enabled: bool
    source: str = "builtin"


class InstallRequest(BaseModel):
    tool_name: str


@router.get("/list/{user_id}", response_model=list[PluginOut])
def list_plugins(user_id: str, db: Session = Depends(get_db)):
    """List all plugins with install status from DB."""
    installed_rows = {
        p.tool_name: p
        for p in db.query(Plugin).filter(Plugin.user_id == user_id).all()
    }

    result = []

    for plugin in BUILTIN_PLUGIN_SCHEMAS:
        db_row = installed_rows.get(plugin["tool_name"])
        is_installed = db_row is not None and db_row.enabled == "true"
        result.append(PluginOut(
            tool_name=plugin["tool_name"],
            name=plugin["name"],
            description=plugin["description"],
            installed=is_installed,
            enabled=is_installed,
            source="builtin",
        ))

    builtin_names = {p["tool_name"] for p in BUILTIN_PLUGIN_SCHEMAS}
    for tool_name, db_row in installed_rows.items():
        if tool_name not in builtin_names and db_row.enabled == "true":
            result.append(PluginOut(
                tool_name=db_row.tool_name,
                name=db_row.name,
                description=db_row.description,
                installed=True,
                enabled=True,
                source=db_row.base_url or "custom",
            ))

    return result


@router.post("/install/{user_id}", status_code=201)
def install_plugin(
    user_id: str,
    req: InstallRequest,
    db: Session = Depends(get_db),
):
    """Install a plugin — creates or re-enables the DB row."""
    existing = (
        db.query(Plugin)
        .filter(Plugin.user_id == user_id, Plugin.tool_name == req.tool_name)
        .first()
    )

    if existing:
        existing.enabled = "true"
        db.commit()
        db.refresh(existing)
        return {
            "status": "enabled",
            "tool_name": existing.tool_name,
            "name": existing.name,
        }

    builtin_map = {p["tool_name"]: p for p in BUILTIN_PLUGIN_SCHEMAS}
    plugin_meta = builtin_map.get(req.tool_name)

    if not plugin_meta:
        raise HTTPException(
            status_code=404,
            detail=f"Plugin '{req.tool_name}' not found in registry.",
        )

    new_plugin = Plugin(
        user_id=user_id,
        name=plugin_meta["name"],
        description=plugin_meta["description"],
        tool_name=req.tool_name,
        base_url="builtin",
        enabled="true",
    )
    db.add(new_plugin)
    db.commit()
    db.refresh(new_plugin)

    return {
        "status": "installed",
        "tool_name": new_plugin.tool_name,
        "name": new_plugin.name,
    }


@router.delete("/uninstall/{user_id}/{tool_name}", status_code=200)
def uninstall_plugin(
    user_id: str,
    tool_name: str,
    db: Session = Depends(get_db),
):
    """Uninstall — sets enabled=false, preserves the DB row."""
    plugin = (
        db.query(Plugin)
        .filter(Plugin.user_id == user_id, Plugin.tool_name == tool_name)
        .first()
    )
    if plugin:
        plugin.enabled = "false"
        db.commit()
    return {"status": "uninstalled", "tool_name": tool_name}


@router.get("/active-tools/{user_id}", response_model=list[str])
def get_active_tool_names(user_id: str, db: Session = Depends(get_db)):
    """Returns list of enabled tool_names for this user."""
    return [
        p.tool_name
        for p in db.query(Plugin)
        .filter(Plugin.user_id == user_id, Plugin.enabled == "true")
        .all()
    ]