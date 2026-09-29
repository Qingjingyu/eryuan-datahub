from collections import defaultdict
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_user
from ..models import Asset, User
from ..services.asset_service import visible_assets

router = APIRouter(prefix="/business", tags=["business"])


def _domain_rows(db: Session, user: User, domain: str = ""):
    rows = visible_assets(db, user).filter(Asset.business_domain != "").all()
    if domain:
        rows = [row for row in rows if row.business_domain == domain]
    return rows


def _metrics(asset: Asset) -> dict:
    return asset.business_metrics or {}


@router.get("/overview")
def overview(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    rows = _domain_rows(db, user)
    by_domain = defaultdict(int)
    total_gmv = total_spend = total_orders = 0
    for row in rows:
        by_domain[row.business_domain] += 1
        metrics = _metrics(row)
        total_gmv += float(metrics.get("gmv", 0) or 0)
        total_spend += float(metrics.get("spend", 0) or 0)
        total_orders += int(metrics.get("orders", 0) or 0)
    return {
        "total_items": len(rows),
        "domain_distribution": dict(by_domain),
        "gmv": round(total_gmv, 2),
        "ad_spend": round(total_spend, 2),
        "roi": round(total_gmv / total_spend, 2) if total_spend else None,
        "orders": total_orders,
    }


@router.get("/items")
def items(
    domain: str = Query(default=""),
    business_line: str = Query(default="zhuangzhou"),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    rows = _domain_rows(db, user, domain)
    if business_line:
        rows = [row for row in rows if row.business_line == business_line]
    return [{
        "asset_id": row.asset_id,
        "title": row.title,
        "domain": row.business_domain,
        "entity": row.business_entity,
        "metrics": _metrics(row),
        "status": row.status,
        "owner": row.owner,
        "updated_at": row.updated_at,
    } for row in rows]


@router.get("/trends")
def trends(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    rows = _domain_rows(db, user)
    trend = defaultdict(lambda: {"gmv": 0.0, "spend": 0.0, "orders": 0})
    for row in rows:
        date = (row.updated_at or row.created_at).strftime("%Y-%m-%d")
        metrics = _metrics(row)
        trend[date]["gmv"] += float(metrics.get("gmv", 0) or 0)
        trend[date]["spend"] += float(metrics.get("spend", 0) or 0)
        trend[date]["orders"] += int(metrics.get("orders", 0) or 0)
    return [{"date": key, **value, "roi": round(value["gmv"] / value["spend"], 2) if value["spend"] else None} for key, value in sorted(trend.items())]


@router.get("/hosts")
def hosts(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    rows = [row for row in _domain_rows(db, user, "host") if row.business_entity]
    grouped = defaultdict(lambda: {"gmv": 0.0, "spend": 0.0, "orders": 0, "lives": 0})
    for row in rows:
        metrics = _metrics(row)
        key = row.business_entity
        grouped[key]["gmv"] += float(metrics.get("gmv", 0) or 0)
        grouped[key]["spend"] += float(metrics.get("spend", 0) or 0)
        grouped[key]["orders"] += int(metrics.get("orders", 0) or 0)
        grouped[key]["lives"] += 1
    return [{"host": key, **value, "roi": round(value["gmv"] / value["spend"], 2) if value["spend"] else None} for key, value in sorted(grouped.items(), key=lambda item: item[1]["gmv"], reverse=True)]
