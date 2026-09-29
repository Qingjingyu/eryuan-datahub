from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any

from sqlalchemy.orm import Session

from ..models import Asset, AssetEvent, AuditLog, ProcessingJob, ReviewLog, User

LIFECYCLE_BUCKETS = [
    {"key": "raw", "label": "原始数据", "statuses": ["raw"]},
    {"key": "parsed", "label": "解析完成", "statuses": ["parsed"]},
    {"key": "cleaned", "label": "清洗完成", "statuses": ["cleaned"]},
    {"key": "waiting_review", "label": "待审核", "statuses": ["waiting_review"]},
    {"key": "approved", "label": "已审核", "statuses": ["approved"]},
    {"key": "indexed", "label": "已索引", "statuses": ["indexed"]},
    {"key": "serving", "label": "服务中", "statuses": ["serving"]},
    {"key": "failed", "label": "处理失败", "statuses": ["failed"]},
    {"key": "archived", "label": "归档 / 失效", "statuses": ["rejected", "archived"]},
]


def utcnow():
    return datetime.now(timezone.utc)


def add_event(
    db: Session,
    *,
    asset: Asset,
    event_type: str,
    title: str,
    detail: str = "",
    actor: User | str = "system",
    status_from: str = "",
    status_to: str = "",
    event_data: dict[str, Any] | None = None,
    occurred_at: datetime | None = None,
) -> AssetEvent:
    event = AssetEvent(
        event_id=f"EVT-{uuid.uuid4().hex[:16]}",
        asset_id=asset.asset_id,
        event_type=event_type,
        title=title,
        detail=detail,
        actor=actor.username if isinstance(actor, User) else actor,
        status_from=status_from,
        status_to=status_to,
        event_data=event_data or {},
        occurred_at=occurred_at or utcnow(),
    )
    db.add(event)
    return event


def lifecycle_summary(assets: list[Asset]) -> dict[str, Any]:
    stages = []
    for item in LIFECYCLE_BUCKETS:
        values = [asset for asset in assets if asset.status in item["statuses"]]
        owners = list({asset.owner for asset in values if asset.owner})
        stages.append({
            **item,
            "count": len(values),
            "owners": owners,
            "latest_updated_at": max((asset.updated_at for asset in values), default=None),
            "failed_jobs": sum(asset.status == "failed" for asset in values),
        })
    processed = sum(stage["count"] for stage in stages if stage["key"] in {"parsed", "cleaned", "approved", "indexed", "serving"})
    total = len(assets)
    return {
        "total": total,
        "processed": processed,
        "pending": sum(stage["count"] for stage in stages if stage["key"] in {"raw", "parsed", "cleaned", "waiting_review"}),
        "failed": next((stage["count"] for stage in stages if stage["key"] == "failed"), 0),
        "serving": next((stage["count"] for stage in stages if stage["key"] == "serving"), 0),
        "archived": next((stage["count"] for stage in stages if stage["key"] == "archived"), 0),
        "processed_rate": round(processed / total * 100, 2) if total else 0,
        "stages": stages,
    }


def asset_timeline(db: Session, asset: Asset) -> list[dict[str, Any]]:
    events: list[dict[str, Any]] = []
    for row in db.query(AssetEvent).filter(AssetEvent.asset_id == asset.asset_id).all():
        events.append({
            "source": "asset_event", "time": row.occurred_at, "event_type": row.event_type,
            "title": row.title, "detail": row.detail, "actor": row.actor,
            "status_from": row.status_from, "status_to": row.status_to, "data": row.event_data,
        })
    for row in db.query(ProcessingJob).filter(ProcessingJob.asset_id == asset.asset_id).all():
        events.append({
            "source": "processing_job", "time": row.finished_at or row.started_at or row.created_at,
            "event_type": row.job_type, "title": f"处理任务 {row.job_type}",
            "detail": row.error_message or f"进度 {row.progress}%", "actor": "system",
            "status_from": "running", "status_to": row.status, "data": {"job_id": row.job_id},
        })
    for row in db.query(ReviewLog).filter(ReviewLog.asset_id == asset.asset_id).all():
        events.append({
            "source": "review_log", "time": row.created_at, "event_type": row.action,
            "title": f"审核{row.action}", "detail": row.comment, "actor": row.reviewer,
            "status_from": row.before_status, "status_to": row.after_status, "data": {},
        })
    for row in db.query(AuditLog).filter(AuditLog.asset_id == asset.asset_id, AuditLog.action.in_(["create_asset", "update_asset", "delete_asset"])).all():
        events.append({
            "source": "audit_log", "time": row.created_at, "event_type": row.action,
            "title": row.action.replace("_", " "), "detail": row.reason, "actor": row.actor,
            "status_from": "", "status_to": "", "data": row.after_state or {},
        })
    events.sort(key=lambda row: row["time"] or utcnow(), reverse=True)
    return [jsonable(row) for row in events]


def jsonable(value: Any):
    if isinstance(value, dict):
        return {key: jsonable(item) for key, item in value.items()}
    if isinstance(value, list):
        return [jsonable(item) for item in value]
    if isinstance(value, datetime):
        return value.isoformat()
    return value
