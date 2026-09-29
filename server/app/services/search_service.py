from __future__ import annotations

import math
import os
import time
from datetime import datetime
from typing import Any

import httpx
from sqlalchemy import and_, or_
from sqlalchemy.orm import Session

from ..deps import can_read
from ..models import AgentLog, Asset, User
from .parsing import best_snippet, score_text, tokens_for_query

RETRIEVAL_STATUSES = {"approved", "indexed", "serving"}


def visible_search_assets(
    db: Session,
    user: User,
    business_line: str = "",
    asset_type: str = "",
) -> list[Asset]:
    """Apply permission, review, archive and soft-delete gates before ranking."""
    query = db.query(Asset).filter(
        Asset.status.in_(sorted(RETRIEVAL_STATUSES)),
        Asset.review_status == "approved",
        Asset.deleted_at.is_(None),
    )
    if user.role != "admin":
        query = query.filter(or_(
            Asset.visibility == "public",
            Asset.owner.in_([user.username, user.display_name]),
            and_(Asset.visibility == "business", Asset.business_line == user.business_line),
        ))
    if business_line:
        query = query.filter(Asset.business_line == business_line)
    if asset_type:
        query = query.filter(Asset.asset_type == asset_type)
    return query.limit(500).all()


def citation(asset: Asset, snippet: str, score: float | None = None) -> dict[str, Any]:
    item: dict[str, Any] = {
        "asset_id": asset.asset_id,
        "title": asset.title,
        "snippet": snippet,
        "version": asset.version,
        "updated_at": asset.updated_at.isoformat() if asset.updated_at else None,
    }
    if score is not None:
        item["score"] = round(float(score), 6)
    return item


def _embedding_config() -> tuple[str | None, str, str]:
    return (
        os.getenv("DATAHUB_EMBEDDING_API_KEY"),
        os.getenv("DATAHUB_EMBEDDING_BASE_URL", "https://api.openai.com/v1").rstrip("/"),
        os.getenv("DATAHUB_EMBEDDING_MODEL", "text-embedding-3-small"),
    )


def _embed_texts(texts: list[str]) -> list[list[float]]:
    api_key, base_url, model = _embedding_config()
    if not api_key:
        return []
    response = httpx.post(
        f"{base_url}/embeddings",
        headers={"Authorization": f"Bearer {api_key}"},
        json={"model": model, "input": texts},
        timeout=30,
    )
    response.raise_for_status()
    return [item["embedding"] for item in response.json()["data"]]


def _cosine(left: list[float], right: list[float]) -> float:
    if not left or not right:
        return 0.0
    dot = sum(a * b for a, b in zip(left, right))
    left_norm = math.sqrt(sum(a * a for a in left))
    right_norm = math.sqrt(sum(a * a for a in right))
    if not left_norm or not right_norm:
        return 0.0
    return max(0.0, min(1.0, dot / (left_norm * right_norm)))


def _semantic_scores(query: str, snippets: list[str]) -> list[float]:
    if not os.getenv("DATAHUB_EMBEDDING_API_KEY") or not snippets:
        return [0.0] * len(snippets)
    try:
        vectors = _embed_texts([query, *snippets])
        query_vector = vectors[0]
        return [_cosine(query_vector, vector) for vector in vectors[1:]]
    except Exception:
        # Retrieval remains available if the optional semantic provider fails.
        return [0.0] * len(snippets)


def search_assets(
    db: Session,
    user: User,
    query: str,
    top_k: int = 10,
    business_line: str = "",
    asset_type: str = "",
    log_event: bool = True,
) -> dict[str, Any]:
    query = (query or "").strip()
    top_k = max(1, min(int(top_k or 10), 50))
    tokens = tokens_for_query(query)
    if not tokens:
        return {"query": query, "results": [], "rerank": "none", "semantic": False}

    candidates: list[tuple[float, Asset, str]] = []
    for asset in visible_search_assets(db, user, business_line, asset_type):
        content = asset.processed_markdown or asset.summary or asset.source_text or ""
        lexical = float(
            score_text(f"{asset.title}\n{asset.summary}\n{asset.processed_markdown}\n{asset.source_text}", tokens) * 2
            + score_text(asset.title, tokens) * 3
        )
        if lexical > 0:
            candidates.append((lexical, asset, best_snippet(content, tokens)))

    max_lexical = max((item[0] for item in candidates), default=0.0)
    semantic_enabled = bool(os.getenv("DATAHUB_EMBEDDING_API_KEY"))
    semantic_values = _semantic_scores(query, [item[2] for item in candidates]) if semantic_enabled else []
    ranked: list[tuple[float, float, float, Asset, str]] = []
    for index, (raw_score, asset, snippet) in enumerate(candidates):
        lexical = raw_score / max_lexical if max_lexical else 0.0
        semantic = semantic_values[index] if index < len(semantic_values) else 0.0
        final_score = lexical * 0.72 + semantic * 0.28
        ranked.append((final_score, lexical, semantic, asset, snippet))

    ranked.sort(key=lambda item: (item[0], item[1], item[3].updated_at or item[3].created_at), reverse=True)
    results = []
    for final_score, _, _, asset, snippet in ranked[:top_k]:
        result = citation(asset, snippet, final_score)
        result.update({
            "owner": asset.owner,
            "tags": asset.tags,
            "status": asset.status,
            "asset_type": asset.asset_type,
            "business_line": asset.business_line,
        })
        results.append(result)
    payload = {
        "query": query,
        "results": results,
        # A convenience alias for clients that expect search citations to have
        # exactly the same shape as /ask citations.
        "citations": results,
        "rerank": "hybrid" if semantic_enabled else "lexical",
        "semantic": semantic_enabled,
    }
    if log_event:
        db.add(AgentLog(
            agent_id="search-api",
            user=user.username,
            tool="search",
            query=query,
            filters={"top_k": top_k, "business_line": business_line, "asset_type": asset_type},
            asset_ids=[item["asset_id"] for item in results],
            answer="",
            status="success",
        ))
        db.commit()
    return payload


def answer_question(db: Session, user: User, query: str, top_k: int = 5) -> dict[str, Any]:
    started = time.time()
    query = (query or "").strip()
    top_k = max(1, min(int(top_k or 5), 20))
    search_result = search_assets(db, user, query, top_k=top_k, log_event=False)
    hits = search_result["results"]

    if not hits:
        answer = "当前知识库中没有找到已审核且与问题相关的资产。请先上传、处理并审核相关资料。"
    else:
        contexts = "\n\n".join(
            f"[{index + 1}] {item['title']}\n{item['snippet']}" for index, item in enumerate(hits)
        )
        answer = _generate_answer(query, contexts, hits)

    latency_ms = int((time.time() - started) * 1000)
    asset_ids = [item["asset_id"] for item in hits]
    db.add(AgentLog(
        agent_id="ask-api",
        user=user.username,
        tool="ask",
        query=query,
        filters={"top_k": top_k},
        asset_ids=asset_ids,
        answer=answer,
        status="success",
        latency_ms=latency_ms,
    ))
    if hits:
        asset = db.query(Asset).filter(Asset.asset_id == asset_ids[0]).first()
        if asset:
            asset.call_count = (asset.call_count or 0) + 1
    db.commit()
    return {"answer": answer, "citations": hits, "latency_ms": latency_ms}


def _generate_answer(query: str, context: str, hits: list[dict[str, Any]]) -> str:
    api_key = os.getenv("DEEPSEEK_API_KEY")
    if api_key:
        try:
            response = httpx.post(
                "https://api.deepseek.com/chat/completions",
                headers={"Authorization": f"Bearer {api_key}"},
                json={
                    "model": os.getenv("DEEPSEEK_MODEL", "deepseek-chat"),
                    "messages": [
                        {"role": "system", "content": "你是企业知识库助手。只根据给定资料回答，不要编造。回答最后必须列出引用编号。"},
                        {"role": "user", "content": f"问题：{query}\n\n资料：\n{context}"},
                    ],
                    "temperature": 0.2,
                },
                timeout=30,
            )
            response.raise_for_status()
            return response.json()["choices"][0]["message"]["content"]
        except Exception:
            pass
    answer = f"根据当前已审核资产，最相关资料是《{hits[0]['title']}》。关键内容：\n\n{hits[0]['snippet']}"
    for item in hits[1:3]:
        answer += f"\n\n相关参考：《{item['title']}》\n{item['snippet']}"
    return answer
