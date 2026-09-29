from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_user
from ..models import Asset, AssetEvent, User
from ..schemas import AssetEventCreate
from ..services.asset_service import get_asset_or_404, visible_assets
from ..services.lifecycle_service import asset_timeline, lifecycle_summary

router = APIRouter(tags=["lifecycle"])


@router.get("/catalog/lifecycle")
def lifecycle(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    assets = visible_assets(db, user).all()
    return lifecycle_summary(assets)


@router.get("/assets/{asset_id}/timeline")
def timeline(asset_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    asset = get_asset_or_404(db, asset_id, user)
    return {"asset_id": asset_id, "timeline": asset_timeline(db, asset)}


@router.get("/assets/{asset_id}/events")
def events(asset_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    asset = get_asset_or_404(db, asset_id, user)
    rows = db.query(AssetEvent).filter(AssetEvent.asset_id == asset.asset_id).order_by(AssetEvent.occurred_at.desc()).all()
    return [{
        "event_id": row.event_id,
        "asset_id": row.asset_id,
        "event_type": row.event_type,
        "title": row.title,
        "detail": row.detail,
        "actor": row.actor,
        "status_from": row.status_from,
        "status_to": row.status_to,
        "event_data": row.event_data,
        "occurred_at": row.occurred_at,
    } for row in rows]


@router.post("/assets/{asset_id}/events")
def create_event(asset_id: str, req: AssetEventCreate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    asset = get_asset_or_404(db, asset_id, user)
    event = AssetEvent(
        event_id=f"EVT-{uuid.uuid4().hex[:16]}",
        asset_id=asset.asset_id,
        event_type=req.event_type,
        title=req.title,
        detail=req.detail,
        actor=user.username,
        status_from=req.status_from,
        status_to=req.status_to,
        event_data=req.event_data,
    )
    db.add(event)
    db.commit()
    db.refresh(event)
    return {"event_id": event.event_id}
