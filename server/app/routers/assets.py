from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_user
from ..models import AssetFile, AssetVersion, Chunk, User
from ..schemas import AssetCreate, AssetUpdate
from ..services.asset_service import (
    asset_json, create_asset, get_asset_or_404, index_asset, process_asset,
    review_asset, save_upload, serve_asset, soft_delete_asset, update_asset,
)
from ..services.storage import get_storage

router = APIRouter(tags=["assets"])


@router.get("/assets")
def list_assets(
    q: str = "",
    status: str = "",
    business_line: str = "",
    asset_type: str = "",
    owner: str = "",
    tag: str = "",
    page: int = 1,
    page_size: int = 100,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    from ..services.asset_service import visible_assets
    from sqlalchemy import String

    query = visible_assets(db, user)
    if q:
        query = query.filter(
            Asset.title.ilike(f"%{q}%") |
            Asset.asset_id.ilike(f"%{q}%") |
            Asset.owner.ilike(f"%{q}%") |
            Asset.description.ilike(f"%{q}%")
        )
    if status:
        query = query.filter(Asset.status == status)
    if business_line:
        query = query.filter(Asset.business_line == business_line)
    if asset_type:
        query = query.filter(Asset.asset_type == asset_type)
    if owner:
        query = query.filter(Asset.owner.ilike(f"%{owner}%"))
    if tag:
        query = query.filter(Asset.tags.cast(String).ilike(f"%{tag}%"))
    page = max(1, page)
    page_size = max(1, min(page_size, 500))
    rows = query.order_by(Asset.updated_at.desc()).offset((page - 1) * page_size).limit(page_size).all()
    return [asset_json(row) for row in rows]


@router.post("/assets")
def create(db: Session = Depends(get_db), user: User = Depends(get_current_user), request: AssetCreate = None):
    if request is None:
        raise HTTPException(status_code=422, detail="请求体不能为空")
    asset = create_asset(db, request, user)
    db.commit()
    db.refresh(asset)
    return asset_json(asset)


@router.get("/assets/{asset_id}")
def get(asset_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return asset_json(get_asset_or_404(db, asset_id, user), include_source=True)


@router.patch("/assets/{asset_id}")
def update(asset_id: str, request: AssetUpdate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    asset = update_asset(db, asset_id, request, user)
    db.commit()
    db.refresh(asset)
    return asset_json(asset)


@router.delete("/assets/{asset_id}")
def delete(asset_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    soft_delete_asset(db, asset_id, user)
    db.commit()
    return {"ok": True}


@router.post("/assets/{asset_id}/files")
async def upload(asset_id: str, file: UploadFile = File(...), db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    row = save_upload(db, asset_id, file.filename or "file", file.file, user)
    db.commit()
    db.refresh(row)
    return {
        "id": row.id,
        "asset_id": row.asset_id,
        "file_name": row.file_name,
        "file_type": row.file_type,
        "file_size": row.file_size,
        "zone": row.zone,
        "storage_path": row.storage_path,
        "checksum": row.checksum,
    }


@router.get("/assets/{asset_id}/files")
def files(asset_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    get_asset_or_404(db, asset_id, user)
    rows = db.query(AssetFile).filter(AssetFile.asset_id == asset_id).order_by(AssetFile.id.desc()).all()
    return [{
        "id": row.id,
        "asset_id": row.asset_id,
        "file_name": row.file_name,
        "file_type": row.file_type,
        "file_size": row.file_size,
        "zone": row.zone,
        "storage_path": row.storage_path,
        "checksum": row.checksum,
        "uploaded_by": row.uploaded_by,
        "created_at": row.created_at,
    } for row in rows]


@router.get("/assets/{asset_id}/files/{file_id}/download")
def download(asset_id: str, file_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    get_asset_or_404(db, asset_id, user)
    row = db.query(AssetFile).filter(AssetFile.id == file_id, AssetFile.asset_id == asset_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="文件不存在")
    path = get_storage().resolve(row.storage_path)
    if not path.exists():
        raise HTTPException(status_code=404, detail="文件内容不存在")
    return FileResponse(path, filename=row.file_name)


@router.get("/assets/{asset_id}/versions")
def versions(asset_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    get_asset_or_404(db, asset_id, user)
    rows = db.query(AssetVersion).filter(AssetVersion.asset_id == asset_id).order_by(AssetVersion.created_at.desc()).all()
    return [{
        "version_id": row.version_id,
        "asset_id": row.asset_id,
        "version": row.version,
        "title": row.title,
        "checksum": row.checksum,
        "change_summary": row.change_summary,
        "created_by": row.created_by,
        "created_at": row.created_at,
    } for row in rows]


@router.get("/assets/{asset_id}/chunks")
def chunks(asset_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    get_asset_or_404(db, asset_id, user)
    rows = db.query(Chunk).filter(Chunk.asset_id == asset_id).order_by(Chunk.chunk_index).all()
    return [{
        "id": row.id,
        "asset_id": row.asset_id,
        "chunk_index": row.chunk_index,
        "summary": row.summary,
        "token_count": row.token_count,
        "status": row.status,
    } for row in rows]


@router.post("/assets/{asset_id}/process")
def process(asset_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return asset_json(process_asset(db, asset_id, user))


@router.post("/assets/{asset_id}/approve")
def approve(asset_id: str, request: dict | None = None, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return asset_json(review_asset(db, asset_id, "approve", (request or {}).get("comment", ""), user))


@router.post("/assets/{asset_id}/reject")
def reject(asset_id: str, request: dict | None = None, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return asset_json(review_asset(db, asset_id, "reject", (request or {}).get("comment", ""), user))


@router.post("/assets/{asset_id}/archive")
def archive(asset_id: str, request: dict | None = None, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return asset_json(review_asset(db, asset_id, "archive", (request or {}).get("comment", ""), user))


@router.post("/assets/{asset_id}/index")
def index(asset_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return asset_json(index_asset(db, asset_id, user))


@router.post("/assets/{asset_id}/serve")
def serve(asset_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return asset_json(serve_asset(db, asset_id, user))


# Import late to keep the module readable without introducing a circular dependency.
from ..models import Asset  # noqa: E402
