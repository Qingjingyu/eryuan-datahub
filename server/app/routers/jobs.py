import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import audit, get_current_user, require_roles
from ..models import Asset, ProcessingJob, ReviewLog, AuditLog, User
from ..services.asset_service import asset_json, jsonable, process_asset

router = APIRouter(tags=["operations"])


@router.get("/jobs")
def list_jobs(limit: int = 100, status: str = "", asset_id: str = "", db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    query = db.query(ProcessingJob)
    if status:
        query = query.filter(ProcessingJob.status == status)
    if asset_id:
        query = query.filter(ProcessingJob.asset_id == asset_id)
    return [jsonable(row.__dict__) | {} for row in query.order_by(ProcessingJob.id.desc()).limit(max(1, min(limit, 500))).all()]


@router.post("/jobs/{job_id}/retry")
def retry(job_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    job = db.query(ProcessingJob).filter(ProcessingJob.job_id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="任务不存在")
    if job.status not in {"failed", "cancelled"}:
        raise HTTPException(status_code=400, detail="只有失败任务可以重试")
    asset = db.query(Asset).filter(Asset.asset_id == job.asset_id).first()
    if not asset:
        raise HTTPException(status_code=404, detail="任务对应资产不存在")
    return asset_json(process_asset(db, job.asset_id, user))


@router.get("/reviews")
def reviews(limit: int = 100, action: str = "", reviewer: str = "", db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    query = db.query(ReviewLog)
    if action:
        query = query.filter(ReviewLog.action == action)
    if reviewer:
        query = query.filter(ReviewLog.reviewer.ilike(f"%{reviewer}%"))
    return [jsonable(row.__dict__) for row in query.order_by(ReviewLog.id.desc()).limit(max(1, min(limit, 500))).all()]


@router.get("/audit-logs")
def audit_logs(limit: int = 100, action: str = "", asset_id: str = "", db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    require_roles(user, "reviewer")
    query = db.query(AuditLog)
    if action:
        query = query.filter(AuditLog.action == action)
    if asset_id:
        query = query.filter(AuditLog.asset_id == asset_id)
    return [jsonable(row.__dict__) for row in query.order_by(AuditLog.id.desc()).limit(max(1, min(limit, 500))).all()]
