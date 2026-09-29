from pydantic import BaseModel, Field
from typing import Optional


class LoginRequest(BaseModel):
    username: str
    password: str


class AssetCreate(BaseModel):
    title: str
    business_line: str = "general"
    asset_type: str = "document"
    owner: str = ""
    visibility: str = "business"
    source_system: str = "manual"
    source_uri: str = ""
    description: str = ""
    summary: str = ""
    source_text: str = ""
    tags: list[str] = Field(default_factory=list)
    version: str = "v1"
    checksum: str = ""


class AssetUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    summary: Optional[str] = None
    business_line: Optional[str] = None
    asset_type: Optional[str] = None
    owner: Optional[str] = None
    tags: Optional[list[str]] = None
    visibility: Optional[str] = None
    version: Optional[str] = None
    source_uri: Optional[str] = None
    source_text: Optional[str] = None
    business_domain: Optional[str] = None
    business_entity: Optional[str] = None
    business_metrics: Optional[dict] = None


class ReviewRequest(BaseModel):
    comment: str = ""


class SearchRequest(BaseModel):
    query: str = Field(default="", alias="q")
    top_k: int = Field(default=10, ge=1, le=50)
    business_line: str = ""
    asset_type: str = ""

    model_config = {"populate_by_name": True}


class AskRequest(BaseModel):
    query: str = Field(default="", alias="q")
    top_k: int = Field(default=5, ge=1, le=20)

    model_config = {"populate_by_name": True}


class EntityCreate(BaseModel):
    name: str
    entity_type: str
    business_line: str = "general"
    description: str = ""
    asset_ids: list[str] = Field(default_factory=list)


class RelationshipCreate(BaseModel):
    source_entity: str
    relation_type: str
    target_entity: str
    asset_id: str = ""
    asset_ids: list[str] = Field(default_factory=list)
    confidence: float = Field(default=1.0, ge=0, le=1)
    status: str = "confirmed"


class RelationshipUpdate(BaseModel):
    relation_type: Optional[str] = None
    status: Optional[str] = None
    confidence: Optional[float] = Field(default=None, ge=0, le=1)
    asset_ids: Optional[list[str]] = None


class EntityUpdate(BaseModel):
    name: Optional[str] = None
    entity_type: Optional[str] = None
    business_line: Optional[str] = None
    description: Optional[str] = None
    asset_ids: Optional[list[str]] = None


class AssetEventCreate(BaseModel):
    event_type: str
    title: str
    detail: str = ""
    status_from: str = ""
    status_to: str = ""
    event_data: dict = Field(default_factory=dict)
