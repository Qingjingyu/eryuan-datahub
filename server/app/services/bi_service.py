"""Read-model metrics for DataHub dashboards.

All values are derived from operational tables. There are no hardcoded demo
numbers, so an empty deployment correctly returns zero and ``null`` rates.
"""
from __future__ import annotations

from collections import Counter, defaultdict
from datetime import timedelta
from typing import Any, Sequence

from sqlalchemy import func
from sqlalchemy.orm import Session

from ..models import AgentLog, Asset, AuditLog, IndexRecord, ProcessingJob, ReviewLog

ASSET_STATUSES = ["raw", "parsed", "cleaned", "waiting_review", "approved", "indexed", "serving", "rejected", "archived"]
UNAUTHORIZED_ACTIONS = {"unauthorized_access", "permission_denied", "access_denied"}
SEARCH_TOOLS = {"search", "search_assets"}


def _pct(numerator: int, denominator: int) -> float | None:
    return round(numerator / denominator * 100, 1) if denominator else None


def _asset_query(db: Session, business_line: str = ""):
    query = db.query(Asset).filter(Asset.deleted_at.is_(None))
    if business_line:
        query = query.filter(Asset.business_line == business_line)
    return query


def _safe_json_ids(value: Any) -> list[str]:
    if isinstance(value, list):
        return [str(v) for v in value if v]
    return []


def asset_trend(db: Session, days: int = 30, business_line: str = "") -> dict[str, Any]:
    days = max(1, min(int(days or 30), 365))
    assets = _asset_query(db, business_line).all()
    counts: Counter[str] = Counter()
    for asset in assets:
        if asset.created_at:
            counts[asset.created_at.date().isoformat()] += 1
    today = max([asset.created_at.date() for asset in assets if asset.created_at], default=None)
    from datetime import date as date_cls

    today = today or date_cls.today()
    cumulative = 0
    items = []
    for offset in range(days - 1, -1, -1):
        day = (today - timedelta(days=offset)).isoformat()
        count = counts.get(day, 0)
        cumulative += count
        items.append({"date": day, "count": count, "cumulative": cumulative})
    return {"days": days, "business_line": business_line, "items": items, "total_assets": len(assets)}


def distributions(db: Session, business_line: str = "") -> dict[str, Any]:
    status_rows = (
        _asset_query(db, business_line)
        .with_entities(Asset.status, func.count(Asset.id))
        .group_by(Asset.status)
        .all()
    )
    status_map = {status: 0 for status in ASSET_STATUSES}
    status_map.update({row[0]: row[1] for row in status_rows})
    business_rows = (
        _asset_query(db)
        .with_entities(Asset.business_line, func.count(Asset.id))
        .group_by(Asset.business_line)
        .all()
    )
    return {
        "status_distribution": status_map,
        "business_line_distribution": [{"business_line": row[0], "count": row[1]} for row in business_rows],
    }


def processing_metrics(db: Session, business_line: str = "") -> dict[str, Any]:
    query = db.query(ProcessingJob)
    if business_line:
        query = query.join(Asset, Asset.asset_id == ProcessingJob.asset_id).filter(Asset.business_line == business_line)
    jobs = query.all()
    total = len(jobs)
    success = sum(job.status == "success" for job in jobs)
    failed = sum(job.status == "failed" for job in jobs)
    durations = [
        (job.finished_at - job.started_at).total_seconds()
        for job in jobs
        if job.started_at and job.finished_at and job.finished_at >= job.started_at
    ]
    status_counts = Counter(job.status for job in jobs)
    return {
        "total_jobs": total,
        "success": success,
        "failed": failed,
        "status_distribution": dict(status_counts),
        "success_rate": _pct(success, total),
        "failure_rate": _pct(failed, total),
        "parse_success_rate": _pct(success, total),
        "avg_duration_seconds": round(sum(durations) / len(durations), 2) if durations else None,
    }


def review_metrics(db: Session, business_line: str = "") -> dict[str, Any]:
    logs = db.query(ReviewLog).all()
    counts = Counter(log.action for log in logs)
    approved_assets = _asset_query(db, business_line).filter(Asset.approved_at.isnot(None)).all()
    durations = [
        max(0.0, (asset.approved_at - asset.created_at).total_seconds() / 3600)
        for asset in approved_assets
        if asset.approved_at and asset.created_at
    ]
    pending = _asset_query(db, business_line).filter(Asset.status == "waiting_review").count()
    approvals = counts.get("approve", 0)
    rejected = counts.get("reject", 0)
    return {
        "pending": pending,
        "approved_assets": len(approved_assets),
        "approvals": approvals,
        "rejections": rejected,
        "approval_rate": _pct(approvals, approvals + rejected),
        "avg_review_hours": round(sum(durations) / len(durations), 2) if durations else None,
        "action_distribution": dict(counts),
    }


def index_metrics(db: Session, business_line: str = "") -> dict[str, Any]:
    query = db.query(IndexRecord)
    if business_line:
        query = query.join(Asset, Asset.asset_id == IndexRecord.asset_id).filter(Asset.business_line == business_line)
    records = query.all()
    total = len(records)
    failed = sum(record.status == "failed" for record in records)
    status_counts = Counter(record.status for record in records)
    total_chunks = sum(record.chunk_count or 0 for record in records)
    return {
        "total_records": total,
        "failed": failed,
        "status_distribution": dict(status_counts),
        "failure_rate": _pct(failed, total),
        "index_failure_rate": _pct(failed, total),
        "total_chunks": total_chunks,
    }


def _usage_rows(db: Session) -> list[AgentLog]:
    return db.query(AgentLog).all()


def search_metrics(db: Session, business_line: str = "") -> dict[str, Any]:
    rows = _usage_rows(db)
    searches = [row for row in rows if row.tool in SEARCH_TOOLS]
    hits = [row for row in searches if _safe_json_ids(row.asset_ids)]
    asks = [row for row in rows if row.tool == "ask"]
    cited = [row for row in asks if _safe_json_ids(row.asset_ids)]
    unauthorized = db.query(AuditLog).filter(AuditLog.action.in_(UNAUTHORIZED_ACTIONS)).count()
    return {
        "search_count": len(searches),
        "search_hits": len(hits),
        "hit_rate": _pct(len(hits), len(searches)),
        "search_hit_rate": _pct(len(hits), len(searches)),
        "ask_count": len(asks),
        "cited_answers": len(cited),
        "citation_coverage": _pct(len(cited), len(asks)),
        "unauthorized_access_count": unauthorized,
    }


def agent_metrics(db: Session, business_line: str = "") -> dict[str, Any]:
    rows = _usage_rows(db)
    total = len(rows)
    success = sum(row.status == "success" for row in rows)
    failed = sum(row.status == "failed" for row in rows)
    latencies = [row.latency_ms for row in rows if row.latency_ms and row.latency_ms >= 0]
    by_tool = Counter(row.tool for row in rows)
    by_user = Counter(row.user for row in rows if row.user)
    return {
        "agent_usage_count": total,
        "calls": total,
        "success": success,
        "failed": failed,
        "success_rate": _pct(success, total),
        "failure_rate": _pct(failed, total),
        "avg_latency_ms": round(sum(latencies) / len(latencies), 1) if latencies else None,
        "unique_users": len(by_user),
        "usage_by_tool": [{"tool": key, "count": value} for key, value in sorted(by_tool.items())],
        "usage_by_user": [{"user": key, "count": value} for key, value in sorted(by_user.items())],
    }


def overview(db: Session, days: int = 30, business_line: str = "") -> dict[str, Any]:
    assets = _asset_query(db, business_line).count()
    total_chunks = _asset_query(db, business_line).with_entities(func.coalesce(func.sum(Asset.chunk_count), 0)).scalar()
    total_calls = _asset_query(db, business_line).with_entities(func.coalesce(func.sum(Asset.call_count), 0)).scalar()
    return {
        "total_assets": assets,
        "total_chunks": int(total_chunks or 0),
        "total_asset_calls": int(total_calls or 0),
        "asset_trend": asset_trend(db, days, business_line),
        "distributions": distributions(db, business_line),
        "processing": processing_metrics(db, business_line),
        "review": review_metrics(db, business_line),
        "index": index_metrics(db, business_line),
        "search": search_metrics(db, business_line),
        "agent": agent_metrics(db, business_line),
    }
