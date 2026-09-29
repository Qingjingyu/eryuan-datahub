from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone
from pathlib import Path
from sqlalchemy import and_, func, or_, String
from sqlalchemy.orm import Session
from fastapi import HTTPException

from ..deps import audit, can_mutate, can_read, require_roles
from ..models import (
    Asset, AssetFile, AssetVersion, BusinessLine, Chunk, IndexRecord,
    ProcessingJob, ReviewLog, User,
)
from ..schemas import AssetCreate, AssetUpdate
from .parsing import chunk_text, normalize_text, parse_file, sha256_text
from .storage import get_storage
from .lifecycle_service import add_event


STATUSES = ["raw", "parsed", "cleaned", "waiting_review", "approved", "indexed", "serving", "rejected", "archived"]
ASSET_TYPES = ["document", "spreadsheet", "image", "audio", "video", "other"]
VISIBILITIES = {"public", "business", "private"}


def utcnow():
    return datetime.now(timezone.utc)


def jsonable(value):
    if isinstance(value, dict):
        return {key: jsonable(item) for key, item in value.items()}
    if isinstance(value, list):
        return [jsonable(item) for item in value]
    if isinstance(value, datetime):
        return value.isoformat()
    return value


def asset_json(asset: Asset, include_source: bool = False):
    data = {column.name: getattr(asset, column.name) for column in asset.__table__.columns if column.name != "source_text"}
    if include_source:
        data["source_text"] = asset.source_text
    return jsonable(data)


def get_asset_or_404(db: Session, asset_id: str, user: User | None = None, allow_deleted: bool = False) -> Asset:
    query = db.query(Asset).filter(Asset.asset_id == asset_id)
    if not allow_deleted:
        query = query.filter(Asset.deleted_at.is_(None))
    asset = query.first()
    if not asset or (user is not None and not can_read(user, asset)):
        raise HTTPException(status_code=404, detail="资产不存在或无权访问")
    return asset


def visible_assets(db: Session, user: User):
    query = db.query(Asset).filter(Asset.deleted_at.is_(None))
    if user.role != "admin":
        query = query.filter(or_(
            Asset.visibility == "public",
            Asset.owner.in_([user.username, user.display_name]),
            and_(Asset.visibility == "business", Asset.business_line == user.business_line),
        ))
    return query


def _validate_metadata(db: Session, business_line: str, asset_type: str, visibility: str):
    if business_line != "general" and not db.query(BusinessLine).filter(BusinessLine.slug == business_line).first():
        raise HTTPException(status_code=400, detail="业务线不存在")
    if asset_type not in ASSET_TYPES:
        raise HTTPException(status_code=400, detail="不支持的资产类型")
    if visibility not in VISIBILITIES:
        raise HTTPException(status_code=400, detail="visibility 只能是 public / business / private")


def create_asset(db: Session, request: AssetCreate, user: User) -> Asset:
    _validate_metadata(db, request.business_line, request.asset_type, request.visibility)
    total = db.query(func.count(Asset.id)).scalar() or 0
    prefix = {"zhuangzhou": "ZZ", "eryuan": "EY", "general": "GEN"}.get(request.business_line, "DH")
    while True:
        asset_id = f"{prefix}-DOC-{total + 1:06d}"
        if not db.query(Asset).filter(Asset.asset_id == asset_id).first():
            break
        total += 1
    asset = Asset(
        asset_id=asset_id,
        title=request.title,
        asset_type=request.asset_type,
        business_line=request.business_line,
        owner=request.owner or user.display_name or user.username,
        status="raw",
        review_status="pending",
        visibility=request.visibility,
        source_system=request.source_system,
        source_uri=request.source_uri,
        description=request.description,
        summary=request.summary,
        source_text=normalize_text(request.source_text),
        tags=list(dict.fromkeys(request.tags)),
        version=request.version,
        checksum=request.checksum or sha256_text(request.source_text)[:32],
        created_by=user.username,
        updated_by=user.username,
    )
    db.add(asset)
    db.flush()
    save_version(db, asset, request.source_text, "", user.username, "初始登记")
    audit(db, user, "create_asset", "asset", asset.asset_id, {}, asset_json(asset))
    asset.lifecycle_bucket = asset.status
    add_event(db, asset=asset, event_type="created", title="资产登记", detail=request.description or "资料进入 Raw 分区", actor=user, status_to="raw")
    return asset


def save_version(db: Session, asset: Asset, source_text: str, processed_markdown: str, username: str, change_summary: str) -> AssetVersion:
    record = db.query(AssetVersion).filter(AssetVersion.asset_id == asset.asset_id, AssetVersion.version == asset.version).first()
    if not record:
        record = AssetVersion(
            version_id=f"VER-{asset.asset_id}-{asset.version}-{uuid.uuid4().hex[:6]}",
            asset_id=asset.asset_id,
            version=asset.version,
        )
        db.add(record)
    record.title = asset.title
    record.source_text = source_text
    record.processed_markdown = processed_markdown
    record.checksum = sha256_text(processed_markdown or source_text)[:32]
    record.change_summary = change_summary
    record.created_by = username
    return record


def update_asset(db: Session, asset_id: str, request: AssetUpdate, user: User) -> Asset:
    asset = get_asset_or_404(db, asset_id, user)
    if not can_mutate(user, asset):
        raise HTTPException(status_code=403, detail="无权修改")
    before = asset_json(asset)
    values = request.model_dump(exclude_unset=True)
    if {"business_line", "asset_type", "visibility"} & set(values):
        _validate_metadata(
            db,
            values.get("business_line", asset.business_line),
            values.get("asset_type", asset.asset_type),
            values.get("visibility", asset.visibility),
        )
    for key, value in values.items():
        setattr(asset, key, list(dict.fromkeys(value)) if key == "tags" and value is not None else value)
    asset.updated_by = user.username
    if request.source_text is not None:
        asset.source_text = normalize_text(request.source_text)
        asset.checksum = sha256_text(asset.source_text)[:32]
        save_version(db, asset, asset.source_text, asset.processed_markdown, user.username, "登记信息更新")
    if "business_domain" in values or "business_entity" in values or "business_metrics" in values:
        add_event(
            db,
            asset=asset,
            event_type="business_metadata_updated",
            title="业务元数据更新",
            detail="更新业务域、业务对象或关键指标",
            actor=user,
            event_data={key: values.get(key) for key in ["business_domain", "business_entity", "business_metrics"] if key in values},
        )
    db.flush()
    audit(db, user, "update_asset", "asset", asset.asset_id, before, asset_json(asset))
    return asset


def soft_delete_asset(db: Session, asset_id: str, user: User) -> None:
    asset = get_asset_or_404(db, asset_id, user, allow_deleted=True)
    require_roles(user, "reviewer")
    if asset.deleted_at:
        raise HTTPException(status_code=400, detail="资产已删除")
    before = asset_json(asset)
    asset.deleted_at = utcnow()
    asset.status = "archived"
    audit(db, user, "delete_asset", "asset", asset.asset_id, before, asset_json(asset))


def save_upload(db: Session, asset_id: str, file_name: str, stream, user: User) -> AssetFile:
    asset = get_asset_or_404(db, asset_id, user)
    if not can_mutate(user, asset):
        raise HTTPException(status_code=403, detail="无权上传文件")
    stored = get_storage().save("raw", f"{asset_id}_{Path(file_name).name}", stream)
    row = AssetFile(
        asset_id=asset_id,
        file_name=Path(file_name).name,
        file_type=Path(file_name).suffix.lower(),
        file_size=stored.file_size,
        zone=stored.zone,
        storage_path=stored.storage_path,
        checksum=stored.checksum,
        uploaded_by=user.username,
    )
    asset.source_uri = stored.storage_path
    asset.raw_uri = stored.storage_path
    asset.checksum = stored.checksum
    db.add(row)
    db.flush()
    audit(db, user, "upload_file", "asset_file", asset_id, {}, {
        "file_name": row.file_name,
        "size": row.file_size,
        "checksum": row.checksum,
        "zone": row.zone,
    })
    return row


def process_asset(db: Session, asset_id: str, user: User) -> Asset:
    asset = get_asset_or_404(db, asset_id, user)
    if not can_mutate(user, asset):
        raise HTTPException(status_code=403, detail="无权处理资产")
    if asset.status not in {"raw", "parsed", "cleaned", "rejected"}:
        raise HTTPException(status_code=400, detail="当前状态不可解析")
    source_file = db.query(AssetFile).filter(AssetFile.asset_id == asset_id).order_by(AssetFile.id.desc()).first()
    job = ProcessingJob(
        job_id=f"JOB-{uuid.uuid4().hex[:12]}",
        asset_id=asset_id,
        asset_title=asset.title,
        job_type="parse_clean",
        status="running",
        progress=20,
        input_uri=source_file.storage_path if source_file else asset.source_uri,
        started_at=utcnow(),
        created_by=user.username,
    )
    db.add(job)
    before = {"status": asset.status}
    db.commit()
    try:
        if source_file and get_storage().resolve(source_file.storage_path).exists():
            source_text, processed = parse_file(get_storage().resolve(source_file.storage_path), source_file.file_type)
        elif asset.source_text:
            source_text = processed = normalize_text(asset.source_text)
        else:
            raise ValueError("没有可解析的文件或文本内容")
        if not processed:
            processed = source_text
        chunks = chunk_text(processed)
        db.query(Chunk).filter(Chunk.asset_id == asset_id).delete()
        for index, text in enumerate(chunks):
            db.add(Chunk(asset_id=asset_id, chunk_index=index, text=text, summary=text[:180], token_count=max(1, len(text) // 2), status="parsed"))
        asset.source_text = source_text
        asset.processed_markdown = processed
        asset.status = "waiting_review"
        asset.review_status = "pending"
        asset.progress = 100
        asset.chunk_count = len(chunks)
        asset.parsed_at = utcnow()
        asset.updated_by = user.username
        asset.lifecycle_bucket = asset.status
        output = get_storage().write_text("staging", f"{asset_id}.md", processed)
        job.status = "success"
        job.progress = 100
        job.output_uri = output.storage_path
        job.finished_at = utcnow()
        save_version(db, asset, source_text, processed, user.username, "解析清洗版本")
        audit(db, user, "parse_asset", "asset", asset_id, before, {"status": asset.status, "chunks": len(chunks)})
        add_event(db, asset=asset, event_type="parsed", title="解析清洗完成", detail=f"生成 {len(chunks)} 个知识片段", actor=user, status_from=before.get("status","raw"), status_to=asset.status, event_data={"chunks":len(chunks)})
        db.commit()
        db.refresh(asset)
        return asset
    except Exception as exc:
        db.rollback()
        asset = db.query(Asset).filter(Asset.asset_id == asset_id).first()
        job = db.query(ProcessingJob).filter(ProcessingJob.job_id == job.job_id).first()
        if asset:
            asset.status = before.get("status", asset.status)
        if job:
            job.status = "failed"
            job.error_message = str(exc)
            job.finished_at = utcnow()
        audit(db, user, "parse_asset_failed", "asset", asset_id, before, {"error": str(exc)})
        db.commit()
        raise HTTPException(status_code=400, detail=str(exc)) from exc


REVIEW_TRANSITIONS = {
    "approve": ("waiting_review", "approved"),
    "reject": ("waiting_review", "rejected"),
    "archive": ("approved", "archived"),
}


def review_asset(db: Session, asset_id: str, action: str, comment: str, user: User) -> Asset:
    require_roles(user, "reviewer")
    asset = get_asset_or_404(db, asset_id, user)
    if action not in REVIEW_TRANSITIONS:
        raise HTTPException(status_code=400, detail="不支持的审核动作")
    expected, next_status = REVIEW_TRANSITIONS[action]
    before_status = asset.status
    if before_status != expected and user.role != "admin":
        raise HTTPException(status_code=400, detail=f"当前状态不可执行 {action}")
    asset.status = next_status
    asset.review_status = {"approve": "approved", "reject": "rejected"}.get(action, action)
    asset.updated_by = user.username
    if action == "approve":
        asset.approved_at = utcnow()
    asset.lifecycle_bucket = next_status
    add_event(db, asset=asset, event_type=f"review_{action}", title={"approve":"审核通过","reject":"审核驳回","archive":"资产归档"}.get(action,action), detail=comment, actor=user, status_from=before_status, status_to=next_status)
    db.add(ReviewLog(
        asset_id=asset_id,
        asset_title=asset.title,
        reviewer=user.username,
        action=action,
        comment=comment,
        before_status=before_status,
        after_status=next_status,
    ))
    audit(db, user, f"review_{action}", "asset", asset_id, {"status": before_status}, {"status": next_status}, comment)
    db.commit()
    db.refresh(asset)
    return asset


def index_asset(db: Session, asset_id: str, user: User) -> Asset:
    require_roles(user, "reviewer")
    asset = get_asset_or_404(db, asset_id, user)
    if asset.status not in {"approved", "indexed", "serving"}:
        raise HTTPException(status_code=400, detail="只有 Approved 资产可索引")
    chunks = db.query(Chunk).filter(Chunk.asset_id == asset_id).all()
    if not chunks:
        raise HTTPException(status_code=400, detail="资产没有可索引的解析结果")
    for chunk in chunks:
        chunk.status = "indexed"
    asset.status = "indexed"
    asset.index_status = "indexed"
    asset.indexed_at = utcnow()
    asset.updated_by = user.username
    record = db.query(IndexRecord).filter(IndexRecord.asset_id == asset_id).first()
    if not record:
        record = IndexRecord(asset_id=asset_id)
        db.add(record)
    record.status = "indexed"
    record.chunk_count = len(chunks)
    record.last_synced_at = utcnow()
    record.external_doc_id = f"dh-{asset_id}"
    record.error_message = ""
    asset.lifecycle_bucket = asset.status
    add_event(db, asset=asset, event_type="indexed", title="知识索引完成", detail=f"写入 {len(chunks)} 个 Chunk", actor=user, status_from="approved", status_to="indexed", event_data={"chunks":len(chunks)})
    audit(db, user, "index_asset", "asset", asset_id, {}, {"chunks": len(chunks)})
    db.commit()
    db.refresh(asset)
    return asset


def serve_asset(db: Session, asset_id: str, user: User) -> Asset:
    require_roles(user, "reviewer")
    asset = get_asset_or_404(db, asset_id, user)
    if asset.status not in {"indexed", "serving"}:
        raise HTTPException(status_code=400, detail="只有已索引资产可服务")
    asset.status = "serving"
    asset.lifecycle_bucket = asset.status
    asset.updated_by = user.username
    add_event(db, asset=asset, event_type="serving", title="进入知识服务", detail="资产已授权给检索、问答和 Agent", actor=user, status_from="indexed", status_to="serving")
    audit(db, user, "serve_asset", "asset", asset_id, {}, {"enabled": True})
    db.commit()
    db.refresh(asset)
    return asset
