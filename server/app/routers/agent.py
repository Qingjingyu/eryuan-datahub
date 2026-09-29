import json
import time
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import can_read, get_current_user
from ..models import AgentLog, Asset, User
from ..schemas import SearchRequest
from ..services.asset_service import get_asset_or_404, jsonable
from ..services.search_service import citation, search_assets

router = APIRouter(tags=["agent"])
READ_STATUSES = {"approved", "indexed", "serving"}


def _log(
    db: Session,
    user: User,
    *,
    tool: str,
    query: str,
    answer: str,
    asset_ids: list[str],
    started: float,
    filters: dict[str, Any] | None = None,
    status: str = "success",
) -> None:
    db.add(AgentLog(
        agent_id="datahub-agent",
        user=user.username,
        tool=tool,
        query=query,
        filters=filters or {},
        asset_ids=asset_ids,
        answer=answer,
        status=status,
        latency_ms=int((time.time() - started) * 1000),
    ))
    db.commit()


def _search(db: Session, user: User, request: SearchRequest) -> dict[str, Any]:
    return search_assets(
        db,
        user,
        request.query,
        top_k=request.top_k,
        business_line=request.business_line,
        asset_type=request.asset_type,
    )


@router.post("/agent/search")
def agent_search(request: SearchRequest, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    started = time.time()
    try:
        result = _search(db, user, request)
        citations = result["results"]
        answer = json.dumps(citations, ensure_ascii=False, default=jsonable)
        asset_ids = [item["asset_id"] for item in citations]
        _log(db, user, tool="search_assets", query=request.query, answer=answer, asset_ids=asset_ids,
             started=started, filters=request.model_dump())
        return {"answer": answer, "asset_ids": asset_ids, "citations": citations, "results": citations}
    except Exception as exc:
        _log(db, user, tool="search_assets", query=request.query, answer=f"调用失败：{exc}", asset_ids=[],
             started=started, filters=request.model_dump(), status="failed")
        raise


@router.post("/agent/read")
def agent_read(
    request: dict | None = None,
    asset_id: str = Query(default=""),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    started = time.time()
    asset_id = asset_id or (request or {}).get("asset_id") or ""
    try:
        if not asset_id:
            raise HTTPException(status_code=422, detail="asset_id 不能为空")
        asset = db.query(Asset).filter(Asset.asset_id == asset_id, Asset.deleted_at.is_(None)).first()
        if not asset:
            raise HTTPException(status_code=404, detail="资产不存在")
        if not can_read(user, asset):
            raise HTTPException(status_code=403, detail="无权读取该资产")
        if asset.review_status != "approved" or asset.status not in READ_STATUSES:
            raise HTTPException(status_code=403, detail="Agent 只能读取已审核且可服务资产")
        content = asset.processed_markdown or asset.summary or asset.source_text or ""
        snippet = citation(asset, content[:280])["snippet"]
        asset_ids = [asset.asset_id]
        response = {
            "asset_id": asset.asset_id,
            "title": asset.title,
            "version": asset.version,
            "content": content,
            "citations": [citation(asset, snippet)],
        }
        _log(db, user, tool="read_asset", query="", answer=content, asset_ids=asset_ids,
             started=started, filters={"asset_id": asset_id})
        return response
    except HTTPException as exc:
        _log(db, user, tool="read_asset", query="", answer=f"调用失败：{exc.detail}", asset_ids=[],
             started=started, filters={"asset_id": asset_id}, status="failed")
        raise

@router.post("/agent/report")
def agent_report(request: SearchRequest, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    started = time.time()
    try:
        result = _search(db, user, request)
        hits = result["results"]
        if hits:
            answer = "根据当前知识库，整理结果如下：\n\n" + "\n\n".join(
                f"## [{index + 1}] {item['title']}\n{item['snippet']}" for index, item in enumerate(hits)
            )
        else:
            answer = "没有找到足够资料。"
        asset_ids = [item["asset_id"] for item in hits]
        _log(db, user, tool="generate_report", query=request.query, answer=answer, asset_ids=asset_ids,
             started=started, filters=request.model_dump())
        return {"answer": answer, "citations": hits}
    except Exception as exc:
        _log(db, user, tool="generate_report", query=request.query, answer=f"调用失败：{exc}", asset_ids=[],
             started=started, filters=request.model_dump(), status="failed")
        raise


@router.post("/agent/execute")
def execute(request: dict, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    tool = request.get("tool")
    top_k = max(1, min(int(request.get("top_k", 5) or 5), 50))
    if tool == "search_assets":
        return agent_search(SearchRequest(query=request.get("query", ""), top_k=top_k), db, user)
    if tool == "read_asset":
        return agent_read({"asset_id": request.get("asset_id")}, db, user)
    if tool == "generate_report":
        return agent_report(SearchRequest(query=request.get("query", ""), top_k=top_k), db, user)
    started = time.time()
    _log(db, user, tool=str(tool or ""), query=request.get("query", ""), answer="调用失败：不支持的 Agent 工具",
         asset_ids=[], started=started, filters=request, status="failed")
    raise HTTPException(status_code=400, detail="不支持的 Agent 工具")


@router.get("/agent/logs")
def logs(limit: int = 100, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    query = db.query(AgentLog).order_by(AgentLog.id.desc())
    if user.role != "admin":
        query = query.filter(AgentLog.user == user.username)
    rows = query.limit(max(1, min(limit, 500))).all()
    return [jsonable(row.__dict__) for row in rows]
