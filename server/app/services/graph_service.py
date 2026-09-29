"""Knowledge graph domain rules and serialization.

The service layer is intentionally storage-shape aware: legacy Relationship rows
keep the first source in ``asset_id`` while new multi-source evidence is stored
in ``graph_asset_links``.
"""
from __future__ import annotations

from collections import defaultdict
from typing import Any, Iterable, Sequence
from uuid import uuid4

from fastapi import HTTPException
from sqlalchemy.orm import Session

from ..models import Asset, Entity, GraphAssetLink, Relationship

ENTITY_STATUSES = {"confirmed", "candidate", "rejected", "archived"}
RELATIONSHIP_STATUSES = {"confirmed", "candidate", "rejected", "archived"}


def clean_ids(values: Sequence[str] | None) -> list[str]:
    return list(dict.fromkeys(v.strip() for v in (values or []) if v and v.strip()))


def validate_confidence(value: Any) -> float:
    try:
        confidence = round(float(value), 4)
    except (TypeError, ValueError) as exc:
        raise HTTPException(status_code=400, detail="confidence 必须是 0 到 1 之间的数字") from exc
    if not 0 <= confidence <= 1:
        raise HTTPException(status_code=400, detail="confidence 必须在 0 到 1 之间")
    return confidence


def validate_assets(db: Session, asset_ids: Sequence[str]) -> list[str]:
    ids = clean_ids(asset_ids)
    if not ids:
        return []
    found = {
        row[0]
        for row in db.query(Asset.asset_id)
        .filter(Asset.asset_id.in_(ids), Asset.deleted_at.is_(None))
        .all()
    }
    missing = [asset_id for asset_id in ids if asset_id not in found]
    if missing:
        raise HTTPException(status_code=400, detail=f"来源资产不存在: {','.join(missing)}")
    return ids


def _link_map(
    db: Session,
    entity_ids: Iterable[str] = (),
    relation_ids: Iterable[str] = (),
) -> tuple[dict[str, list[GraphAssetLink]], dict[str, list[GraphAssetLink]]]:
    entity_ids = [v for v in entity_ids if v]
    relation_ids = [v for v in relation_ids if v]
    query = db.query(GraphAssetLink)
    conditions = []
    if entity_ids:
        conditions.append(GraphAssetLink.entity_id.in_(entity_ids))
    if relation_ids:
        conditions.append(GraphAssetLink.relation_id.in_(relation_ids))
    if conditions:
        from sqlalchemy import or_

        query = query.filter(or_(*conditions))
    entity_map: dict[str, list[GraphAssetLink]] = defaultdict(list)
    relation_map: dict[str, list[GraphAssetLink]] = defaultdict(list)
    for link in query.all():
        if link.entity_id:
            entity_map[link.entity_id].append(link)
        if link.relation_id:
            relation_map[link.relation_id].append(link)
    return entity_map, relation_map


def replace_links(
    db: Session,
    *,
    entity_id: str | None = None,
    relation_id: str | None = None,
    asset_ids: Sequence[str],
    replace: bool = True,
) -> None:
    owner_id = entity_id or relation_id
    if not owner_id:
        raise ValueError("entity_id or relation_id is required")
    query = db.query(GraphAssetLink).filter(
        GraphAssetLink.entity_id == entity_id if entity_id else GraphAssetLink.relation_id == relation_id
    )
    if replace:
        query.delete(synchronize_session=False)
    existing = set()
    if not replace:
        existing = {row[0] for row in query.with_entities(GraphAssetLink.asset_id).all()}
    for index, asset_id in enumerate(clean_ids(asset_ids)):
        if asset_id in existing:
            continue
        db.add(
            GraphAssetLink(
                entity_id=entity_id,
                relation_id=relation_id,
                asset_id=asset_id,
                position=index,
            )
        )


def create_entity(
    db: Session,
    *,
    name: str,
    entity_type: str,
    business_line: str = "general",
    description: str = "",
    status: str = "confirmed",
    asset_ids: Sequence[str] | None = None,
) -> Entity:
    if not name.strip() or not entity_type.strip():
        raise HTTPException(status_code=400, detail="实体名称和类型不能为空")
    if status not in ENTITY_STATUSES:
        raise HTTPException(status_code=400, detail="不支持的实体状态")
    ids = validate_assets(db, asset_ids)
    entity = Entity(
        entity_id=f"ENT-{uuid4().hex[:12]}",
        name=name.strip(),
        entity_type=entity_type.strip(),
        business_line=business_line.strip() or "general",
        description=description,
        status=status,
    )
    db.add(entity)
    db.flush()
    entity.source_asset_id = ids[0] if ids else None
    replace_links(db, entity_id=entity.entity_id, asset_ids=ids)
    return entity


def update_entity(db: Session, entity: Entity, changes: dict[str, Any]) -> Entity:
    if "name" in changes and not str(changes["name"]).strip():
        raise HTTPException(status_code=400, detail="实体名称不能为空")
    if "status" in changes and changes["status"] not in ENTITY_STATUSES:
        raise HTTPException(status_code=400, detail="不支持的实体状态")
    for key in ("name", "entity_type", "business_line", "description", "status"):
        if key in changes and changes[key] is not None:
            setattr(entity, key, str(changes[key]).strip() if key in {"name", "entity_type", "business_line"} else changes[key])
    if "asset_ids" in changes:
        ids = validate_assets(db, changes["asset_ids"])
        entity.source_asset_id = ids[0] if ids else None
        replace_links(db, entity_id=entity.entity_id, asset_ids=ids)
    return entity


def create_relationship(
    db: Session,
    *,
    source_entity: str,
    relation_type: str,
    target_entity: str,
    status: str = "confirmed",
    confidence: float = 1,
    asset_ids: Sequence[str] | None = None,
    evidence: str = "",
) -> Relationship:
    if source_entity == target_entity:
        raise HTTPException(status_code=400, detail="关系的起点和终点不能相同")
    if not relation_type.strip():
        raise HTTPException(status_code=400, detail="关系类型不能为空")
    if status not in RELATIONSHIP_STATUSES:
        raise HTTPException(status_code=400, detail="不支持的关系状态")
    source = db.query(Entity).filter(Entity.entity_id == source_entity).first()
    target = db.query(Entity).filter(Entity.entity_id == target_entity).first()
    if not source or not target:
        raise HTTPException(status_code=400, detail="关系实体不存在")
    ids = validate_assets(db, asset_ids)
    relation = Relationship(
        relation_id=f"REL-{uuid4().hex[:12]}",
        source_entity=source.entity_id,
        relation_type=relation_type.strip(),
        target_entity=target.entity_id,
        asset_id=ids[0] if ids else "",
        confidence=validate_confidence(confidence),
        status=status,
    )
    db.add(relation)
    db.flush()
    replace_links(db, relation_id=relation.relation_id, asset_ids=ids)
    return relation


def update_relationship(db: Session, relation: Relationship, changes: dict[str, Any]) -> Relationship:
    if "status" in changes and changes["status"] not in RELATIONSHIP_STATUSES:
        raise HTTPException(status_code=400, detail="不支持的关系状态")
    if "confidence" in changes:
        relation.confidence = validate_confidence(changes["confidence"])
    if "status" in changes:
        relation.status = changes["status"]
    if "asset_ids" in changes:
        ids = validate_assets(db, changes["asset_ids"])
        replace_links(db, relation_id=relation.relation_id, asset_ids=ids)
        relation.asset_id = ids[0] if ids else ""
    return relation


def links_for_entity(db: Session, entity_id: str) -> list[GraphAssetLink]:
    return (
        db.query(GraphAssetLink)
        .filter(GraphAssetLink.entity_id == entity_id)
        .order_by(GraphAssetLink.position, GraphAssetLink.id)
        .all()
    )


def links_for_relationship(db: Session, relation_id: str) -> list[GraphAssetLink]:
    return (
        db.query(GraphAssetLink)
        .filter(GraphAssetLink.relation_id == relation_id)
        .order_by(GraphAssetLink.position, GraphAssetLink.id)
        .all()
    )


def entity_json(entity: Entity, links: Sequence[GraphAssetLink]) -> dict[str, Any]:
    asset_ids = [link.asset_id for link in links]
    if not asset_ids and entity.source_asset_id:
        asset_ids = [entity.source_asset_id]
    sources = [
        {
            "asset_id": link.asset_id,
            "evidence": link.evidence_text,
            "score": link.score,
            "created_at": link.created_at.isoformat() if link.created_at else None,
        }
        for link in links
    ]
    if not sources and entity.source_asset_id:
        sources = [{
            "asset_id": entity.source_asset_id,
            "evidence": "",
            "score": 0,
            "created_at": entity.created_at.isoformat() if entity.created_at else None,
        }]
    return {
        "entity_id": entity.entity_id,
        "name": entity.name,
        "entity_type": entity.entity_type,
        "business_line": entity.business_line,
        "description": entity.description,
        "status": entity.status,
        "source_asset_id": entity.source_asset_id,
        "asset_ids": asset_ids,
        "sources": sources,
        "created_at": entity.created_at.isoformat() if entity.created_at else None,
    }


def relationship_json(relation: Relationship, links: Sequence[GraphAssetLink]) -> dict[str, Any]:
    asset_ids = [link.asset_id for link in links]
    if not asset_ids and relation.asset_id:
        asset_ids = [relation.asset_id]
    return {
        "relation_id": relation.relation_id,
        "source_entity": relation.source_entity,
        "relation_type": relation.relation_type,
        "target_entity": relation.target_entity,
        "asset_id": asset_ids[0] if asset_ids else relation.asset_id,
        "asset_ids": asset_ids,
        "confidence": relation.confidence,
        "status": relation.status,
        "sources": [
            {
                "asset_id": link.asset_id,
                "evidence": link.evidence_text,
                "score": link.score,
                "created_at": link.created_at.isoformat() if link.created_at else None,
            }
            for link in links
        ] or ([{
            "asset_id": relation.asset_id,
            "evidence": "",
            "score": 0,
            "created_at": relation.created_at.isoformat() if relation.created_at else None,
        }] if relation.asset_id else []),
        "created_at": relation.created_at.isoformat() if relation.created_at else None,
    }


def query_graph(
    db: Session,
    *,
    business_line: str = "",
    entity_type: str = "",
    relation_type: str = "",
    entity_id: str = "",
    entity_status: str = "",
    relation_status: str = "",
    asset_id: str = "",
    include_related: bool = True,
) -> dict[str, Any]:
    entity_query = db.query(Entity)
    if business_line:
        entity_query = entity_query.filter(Entity.business_line == business_line)
    if entity_type:
        entity_query = entity_query.filter(Entity.entity_type == entity_type)
    if entity_status:
        entity_query = entity_query.filter(Entity.status == entity_status)
    if entity_id:
        entity_query = entity_query.filter(Entity.entity_id == entity_id)
    entities = entity_query.order_by(Entity.entity_id).all()
    entity_by_id = {entity.entity_id: entity for entity in entities}

    relation_query = db.query(Relationship)
    if relation_type:
        relation_query = relation_query.filter(Relationship.relation_type == relation_type)
    if relation_status:
        relation_query = relation_query.filter(Relationship.status == relation_status)
    relations = [row for row in relation_query.order_by(Relationship.relation_id).all()]
    if asset_id:
        linked_relation_ids = {
            row[0]
            for row in db.query(GraphAssetLink.relation_id)
            .filter(GraphAssetLink.asset_id == asset_id, GraphAssetLink.relation_id.isnot(None))
            .all()
        }
        relations = [row for row in relations if row.asset_id == asset_id or row.relation_id in linked_relation_ids]

    if asset_id:
        incident_ids = {row.source_entity for row in relations} | {row.target_entity for row in relations}
        entity_by_id = {key: value for key, value in entity_by_id.items() if key in incident_ids}

    visible_ids = set(entity_by_id)
    node_filters_active = any([business_line, entity_type, entity_id, entity_status])
    if not node_filters_active or include_related:
        relations = [row for row in relations if row.source_entity in visible_ids or row.target_entity in visible_ids]
    else:
        relations = [row for row in relations if row.source_entity in visible_ids and row.target_entity in visible_ids]
    neighbor_ids = {row.source_entity for row in relations} | {row.target_entity for row in relations}
    missing = neighbor_ids - visible_ids
    if missing:
        neighbors = db.query(Entity).filter(Entity.entity_id.in_(missing)).all()
        for entity in neighbors:
            entity_by_id[entity.entity_id] = entity

    entity_ids = list(entity_by_id)
    relation_ids = [row.relation_id for row in relations]
    entity_links, relation_links = _link_map(db, entity_ids, relation_ids)
    # Multi-source filtering includes legacy asset_id rows.
    if asset_id:
        relations = [
            row
            for row in relations
            if asset_id in {link.asset_id for link in relation_links.get(row.relation_id, [])} or row.asset_id == asset_id
        ]

    if asset_id:
        linked_entity_ids = {
            row[0]
            for row in db.query(GraphAssetLink.entity_id)
            .filter(GraphAssetLink.asset_id == asset_id, GraphAssetLink.entity_id.isnot(None))
            .all()
        }
        source_entity_ids = {
            row[0]
            for row in db.query(Entity.entity_id)
            .filter(Entity.source_asset_id == asset_id, Entity.entity_id.in_(list(entity_by_id)))
            .all()
        }
        endpoint_ids = {row.source_entity for row in relations} | {row.target_entity for row in relations}
        keep_ids = linked_entity_ids | source_entity_ids | endpoint_ids
        entity_by_id = {key: value for key, value in entity_by_id.items() if key in keep_ids}

    return {
        "nodes": [entity_json(entity_by_id[key], entity_links.get(key, [])) for key in sorted(entity_by_id)],
        "edges": [relationship_json(row, relation_links.get(row.relation_id, [])) for row in relations],
        "total": {"nodes": len(entity_by_id), "edges": len(relations)},
    }
