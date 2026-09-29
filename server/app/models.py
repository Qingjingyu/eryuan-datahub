from sqlalchemy import (
    Column, Integer, String, Text, DateTime, Boolean, Float,
    ForeignKey, JSON, UniqueConstraint, Index,
)
from .database import Base
from datetime import datetime, timezone


def utcnow():
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True)
    username = Column(String(80), unique=True, nullable=False, index=True)
    password_hash = Column(String(128), nullable=False)
    display_name = Column(String(120), default="")
    role = Column(String(30), default="member", index=True)
    business_line = Column(String(80), default="general", index=True)
    active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=utcnow)


class BusinessLine(Base):
    __tablename__ = "business_lines"
    id = Column(Integer, primary_key=True)
    name = Column(String(120), unique=True, nullable=False)
    slug = Column(String(80), unique=True, nullable=False, index=True)
    description = Column(Text, default="")
    created_at = Column(DateTime, default=utcnow)


class Tag(Base):
    __tablename__ = "tags"
    id = Column(Integer, primary_key=True)
    name = Column(String(80), nullable=False, index=True)
    category = Column(String(60), default="general")
    description = Column(Text, default="")
    created_at = Column(DateTime, default=utcnow)
    __table_args__ = (UniqueConstraint("name", "category", name="uq_tag_name_category"),)


class Asset(Base):
    __tablename__ = "assets"
    id = Column(Integer, primary_key=True)
    asset_id = Column(String(60), unique=True, nullable=False, index=True)
    title = Column(String(250), nullable=False, index=True)
    asset_type = Column(String(40), default="document", index=True)
    business_line = Column(String(80), default="general", index=True)
    owner = Column(String(120), default="", index=True)
    status = Column(String(40), default="raw", index=True)
    review_status = Column(String(40), default="pending", index=True)
    index_status = Column(String(40), default="not_indexed", index=True)
    graph_status = Column(String(40), default="not_generated", index=True)
    business_domain = Column(String(60), default="", index=True)
    business_entity = Column(String(160), default="", index=True)
    business_metrics = Column(JSON, default=dict)
    lifecycle_bucket = Column(String(40), default="raw", index=True)
    visibility = Column(String(30), default="business", index=True)
    source_type = Column(String(40), default="upload")
    source_system = Column(String(80), default="manual")
    source_uri = Column(String(500), default="")
    raw_uri = Column(String(600), default="")
    description = Column(Text, default="")
    summary = Column(Text, default="")
    processed_markdown = Column(Text, default="")
    source_text = Column(Text, default="")
    tags = Column(JSON, default=list)
    version = Column(String(30), default="v1", index=True)
    checksum = Column(String(80), default="", index=True)
    progress = Column(Integer, default=0)
    chunk_count = Column(Integer, default=0)
    call_count = Column(Integer, default=0)
    parsed_at = Column(DateTime, nullable=True)
    approved_at = Column(DateTime, nullable=True)
    indexed_at = Column(DateTime, nullable=True)
    deleted_at = Column(DateTime, nullable=True)
    created_by = Column(String(120), default="")
    created_at = Column(DateTime, default=utcnow, index=True)
    updated_by = Column(String(120), default="")
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow, index=True)


class AssetEvent(Base):
    __tablename__ = "asset_events"
    id = Column(Integer, primary_key=True)
    event_id = Column(String(80), unique=True, nullable=False, index=True)
    asset_id = Column(String(60), ForeignKey("assets.asset_id", ondelete="CASCADE"), nullable=False, index=True)
    event_type = Column(String(60), nullable=False, index=True)
    title = Column(String(250), nullable=False)
    detail = Column(Text, default="")
    actor = Column(String(120), default="system", index=True)
    status_from = Column(String(40), default="")
    status_to = Column(String(40), default="")
    event_data = Column(JSON, default=dict)
    occurred_at = Column(DateTime, default=utcnow, index=True)
    created_at = Column(DateTime, default=utcnow)
    __table_args__ = (Index("ix_asset_events_asset_time", "asset_id", "occurred_at"),)


class ProcessingRun(Base):
    __tablename__ = "processing_runs"
    id = Column(Integer, primary_key=True)
    run_id = Column(String(80), unique=True, nullable=False, index=True)
    asset_id = Column(String(60), ForeignKey("assets.asset_id", ondelete="CASCADE"), nullable=False, index=True)
    run_type = Column(String(50), nullable=False, index=True)
    status = Column(String(40), default="success", index=True)
    input_summary = Column(Text, default="")
    output_summary = Column(Text, default="")
    metrics = Column(JSON, default=dict)
    error_message = Column(Text, default="")
    actor = Column(String(120), default="system")
    started_at = Column(DateTime, default=utcnow)
    finished_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=utcnow)


class AssetVersion(Base):
    __tablename__ = "asset_versions"
    id = Column(Integer, primary_key=True)
    version_id = Column(String(80), unique=True, nullable=False, index=True)
    asset_id = Column(String(60), ForeignKey("assets.asset_id", ondelete="CASCADE"), nullable=False, index=True)
    version = Column(String(30), nullable=False)
    title = Column(String(250), default="")
    source_text = Column(Text, default="")
    processed_markdown = Column(Text, default="")
    checksum = Column(String(80), default="", index=True)
    change_summary = Column(Text, default="")
    created_by = Column(String(120), default="")
    created_at = Column(DateTime, default=utcnow)
    __table_args__ = (UniqueConstraint("asset_id", "version", name="uq_asset_version"),)


class AssetFile(Base):
    __tablename__ = "asset_files"
    id = Column(Integer, primary_key=True)
    asset_id = Column(String(60), ForeignKey("assets.asset_id", ondelete="CASCADE"), nullable=False, index=True)
    file_name = Column(String(300), nullable=False)
    file_type = Column(String(80), default="")
    file_size = Column(Integer, default=0)
    zone = Column(String(40), default="01_raw", index=True)
    storage_path = Column(String(600), nullable=False)
    checksum = Column(String(80), default="", index=True)
    uploaded_by = Column(String(120), default="")
    created_at = Column(DateTime, default=utcnow)


class ProcessingJob(Base):
    __tablename__ = "processing_jobs"
    id = Column(Integer, primary_key=True)
    job_id = Column(String(80), unique=True, nullable=False, index=True)
    asset_id = Column(String(60), ForeignKey("assets.asset_id", ondelete="CASCADE"), nullable=False, index=True)
    asset_title = Column(String(250), default="")
    job_type = Column(String(40), default="parse", index=True)
    status = Column(String(30), default="queued", index=True)
    progress = Column(Integer, default=0)
    error_message = Column(Text, default="")
    input_uri = Column(String(600), default="")
    output_uri = Column(String(600), default="")
    started_at = Column(DateTime, nullable=True)
    finished_at = Column(DateTime, nullable=True)
    created_by = Column(String(120), default="")
    created_at = Column(DateTime, default=utcnow)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow)


class ReviewLog(Base):
    __tablename__ = "review_logs"
    id = Column(Integer, primary_key=True)
    asset_id = Column(String(60), ForeignKey("assets.asset_id", ondelete="CASCADE"), nullable=False, index=True)
    asset_title = Column(String(250), default="")
    reviewer = Column(String(120), default="", index=True)
    action = Column(String(40), nullable=False, index=True)
    comment = Column(Text, default="")
    before_status = Column(String(40), default="")
    after_status = Column(String(40), default="")
    created_at = Column(DateTime, default=utcnow)


class IndexRecord(Base):
    __tablename__ = "index_records"
    id = Column(Integer, primary_key=True)
    asset_id = Column(String(60), ForeignKey("assets.asset_id", ondelete="CASCADE"), nullable=False, unique=True, index=True)
    target = Column(String(40), default="builtin", index=True)
    external_doc_id = Column(String(120), default="")
    status = Column(String(30), default="queued", index=True)
    chunk_count = Column(Integer, default=0)
    last_synced_at = Column(DateTime, nullable=True)
    error_message = Column(Text, default="")
    created_at = Column(DateTime, default=utcnow)


class Chunk(Base):
    __tablename__ = "chunks"
    id = Column(Integer, primary_key=True)
    asset_id = Column(String(60), ForeignKey("assets.asset_id", ondelete="CASCADE"), nullable=False, index=True)
    chunk_index = Column(Integer, default=0)
    text = Column(Text, nullable=False)
    summary = Column(Text, default="")
    token_count = Column(Integer, default=0)
    status = Column(String(30), default="parsed", index=True)
    created_at = Column(DateTime, default=utcnow)
    __table_args__ = (UniqueConstraint("asset_id", "chunk_index", name="uq_chunk_asset_index"),)


class AuditLog(Base):
    __tablename__ = "audit_logs"
    id = Column(Integer, primary_key=True)
    actor = Column(String(120), default="", index=True)
    actor_type = Column(String(30), default="user", index=True)
    action = Column(String(80), nullable=False, index=True)
    resource = Column(String(120), default="", index=True)
    asset_id = Column(String(60), default="", index=True)
    before_state = Column(JSON, default=dict)
    after_state = Column(JSON, default=dict)
    reason = Column(Text, default="")
    created_at = Column(DateTime, default=utcnow, index=True)


class Entity(Base):
    __tablename__ = "entities"
    id = Column(Integer, primary_key=True)
    entity_id = Column(String(80), unique=True, nullable=False, index=True)
    name = Column(String(200), nullable=False, index=True)
    entity_type = Column(String(60), nullable=False, index=True)
    business_line = Column(String(80), default="general", index=True)
    description = Column(Text, default="")
    status = Column(String(30), default="confirmed", index=True)
    source_asset_id = Column(String(60), ForeignKey("assets.asset_id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime, default=utcnow)


class Relationship(Base):
    __tablename__ = "relationships"
    id = Column(Integer, primary_key=True)
    relation_id = Column(String(80), unique=True, nullable=False, index=True)
    source_entity = Column(String(80), nullable=False, index=True)
    relation_type = Column(String(80), nullable=False, index=True)
    target_entity = Column(String(80), nullable=False, index=True)
    asset_id = Column(String(60), default="", index=True)
    confidence = Column(Float, default=1)
    status = Column(String(30), default="confirmed", index=True)
    created_at = Column(DateTime, default=utcnow)


class GraphAssetLink(Base):
    """Provenance link between a graph node/edge and one source asset."""

    __tablename__ = "graph_asset_links"

    id = Column(Integer, primary_key=True)
    entity_id = Column(String(80), nullable=True, index=True)
    relation_id = Column(String(80), nullable=True, index=True)
    asset_id = Column(String(60), nullable=False, index=True)
    evidence_text = Column(Text, default="")
    score = Column(Float, default=0)
    position = Column(Integer, default=0)
    created_at = Column(DateTime, default=utcnow)

    __table_args__ = (
        Index("ix_graph_asset_entity_asset", "entity_id", "asset_id"),
        Index("ix_graph_asset_relation_asset", "relation_id", "asset_id"),
    )

class AgentLog(Base):
    __tablename__ = "agent_logs"
    id = Column(Integer, primary_key=True)
    agent_id = Column(String(80), default="datahub-agent")
    user = Column(String(120), default="")
    tool = Column(String(80), nullable=False, index=True)
    query = Column(Text, default="")
    filters = Column(JSON, default=dict)
    asset_ids = Column(JSON, default=list)
    answer = Column(Text, default="")
    status = Column(String(30), default="success", index=True)
    latency_ms = Column(Integer, default=0)
    created_at = Column(DateTime, default=utcnow, index=True)
