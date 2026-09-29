from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import audit, get_current_user, require_roles
from ..models import Entity, Relationship, User
from ..services import graph_service as gs

router = APIRouter(prefix="/graph", tags=["graph"])


class EntityCreate(BaseModel):
    name: str
    entity_type: str
    business_line: str = "general"
    description: str = ""
    status: str = "confirmed"
    asset_id: str = ""
    asset_ids: list[str] = Field(default_factory=list)


class EntityUpdate(BaseModel):
    name: str | None = None
    entity_type: str | None = None
    business_line: str | None = None
    description: str | None = None
    status: str | None = None
    asset_ids: list[str] | None = None


class RelationshipCreate(BaseModel):
    source_entity: str
    relation_type: str
    target_entity: str
    status: str = "confirmed"
    confidence: float = Field(default=1, ge=0, le=1)
    asset_id: str = ""
    asset_ids: list[str] = Field(default_factory=list)


class RelationshipUpdate(BaseModel):
    status: str | None = None
    confidence: float | None = Field(default=None, ge=0, le=1)
    asset_ids: list[str] | None = None


@router.get("")
def graph(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return gs.query_graph(db)


@router.get("/query")
def query_graph(
    business_line: str = "",
    entity_type: str = "",
    relation_type: str = "",
    entity_id: str = "",
    entity_status: str = "",
    relation_status: str = "",
    asset_id: str = "",
    include_related: bool = True,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return gs.query_graph(
        db,
        business_line=business_line,
        entity_type=entity_type,
        relation_type=relation_type,
        entity_id=entity_id,
        entity_status=entity_status,
        relation_status=relation_status,
        asset_id=asset_id,
        include_related=include_related,
    )


@router.post("/entities")
def create_entity(req: EntityCreate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    require_roles(user, "reviewer")
    entity = gs.create_entity(
        db,
        name=req.name,
        entity_type=req.entity_type,
        business_line=req.business_line,
        description=req.description,
        status=req.status,
        asset_ids=gs.clean_ids([req.asset_id] + req.asset_ids),
    )
    db.flush()
    links = gs.links_for_entity(db, entity.entity_id)
    before = {}
    after = gs.entity_json(entity, links)
    audit(db, user, "create_entity", "graph_entity", entity.entity_id, before, after)
    db.commit()
    db.refresh(entity)
    return gs.entity_json(entity, gs.links_for_entity(db, entity.entity_id))


@router.get("/entities")
def list_entities(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return gs.query_graph(db)["nodes"]


@router.get("/entities/{entity_id}")
def get_entity(entity_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    result = gs.query_graph(db, entity_id=entity_id, include_related=False)
    if not result["nodes"]:
        raise HTTPException(status_code=404, detail="实体不存在")
    return result["nodes"][0]


@router.patch("/entities/{entity_id}")
def patch_entity(
    entity_id: str,
    req: EntityUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_roles(user, "reviewer")
    entity = db.query(Entity).filter(Entity.entity_id == entity_id).first()
    if not entity:
        raise HTTPException(status_code=404, detail="实体不存在")
    before = gs.query_graph(db, entity_id=entity_id, include_related=False)["nodes"][0]
    gs.update_entity(db, entity, req.model_dump(exclude_unset=True))
    db.flush()
    after = gs.query_graph(db, entity_id=entity_id, include_related=False)["nodes"][0]
    audit(db, user, "update_entity", "graph_entity", entity_id, before, after)
    db.commit()
    db.refresh(entity)
    return gs.entity_json(entity, gs.links_for_entity(db, entity.entity_id))


@router.post("/relationships")
def create_relationship(
    req: RelationshipCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_roles(user, "reviewer")
    relation = gs.create_relationship(
        db,
        source_entity=req.source_entity,
        relation_type=req.relation_type,
        target_entity=req.target_entity,
        status=req.status,
        confidence=req.confidence,
        asset_ids=gs.clean_ids([req.asset_id] + req.asset_ids),
    )
    db.flush()
    links = gs.links_for_relationship(db, relation.relation_id)
    audit(db, user, "create_relationship", "graph_relationship", relation.relation_id, {}, gs.relationship_json(relation, links))
    db.commit()
    db.refresh(relation)
    return gs.relationship_json(relation, gs.links_for_relationship(db, relation.relation_id))


@router.get("/relationships")
def list_relationships(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return gs.query_graph(db)["edges"]


@router.patch("/relationships/{relation_id}")
def patch_relationship(
    relation_id: str,
    req: RelationshipUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_roles(user, "reviewer")
    relation = db.query(Relationship).filter(Relationship.relation_id == relation_id).first()
    if not relation:
        raise HTTPException(status_code=404, detail="关系不存在")
    before_rows = gs.query_graph(db)["edges"]
    before = next((row for row in before_rows if row["relation_id"] == relation_id), {})
    relation = gs.update_relationship(db, relation, req.model_dump(exclude_unset=True))
    db.flush()
    after_rows = gs.query_graph(db)["edges"]
    after = next((row for row in after_rows if row["relation_id"] == relation_id), {})
    audit(db, user, "update_relationship", "graph_relationship", relation_id, before, after)
    db.commit()
    db.refresh(relation)
    return gs.relationship_json(relation, gs.links_for_relationship(db, relation.relation_id))
