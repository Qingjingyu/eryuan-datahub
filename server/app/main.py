from contextlib import asynccontextmanager
from pathlib import Path
import os

from fastapi import FastAPI
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session

from .database import Base, SessionLocal, engine, ensure_schema_upgrades, get_db
from .models import BusinessLine, Entity, Relationship, User
from .services.storage import get_storage
from .utils import hash_password, needs_rehash, verify_password
from .routers import agent, assets, auth, bi, business, graph, jobs, lifecycle, meta, search


API_PREFIXES = ["/api/v1", "/api"]


def seed_database() -> None:
    Base.metadata.create_all(bind=engine)
    ensure_schema_upgrades()
    get_storage().ensure()
    db = SessionLocal()
    try:
        if not db.query(User).count():
            db.add(User(
                username="admin",
                password_hash=hash_password(os.environ["DATAHUB_ADMIN_PASSWORD"]),
                display_name="管理员",
                role="admin",
                business_line="general",
            ))
        else:
            admin = db.query(User).filter(User.username == "admin").first()
            admin_password = os.getenv("DATAHUB_ADMIN_PASSWORD", "")
            if admin and admin_password and (needs_rehash(admin.password_hash) or not verify_password(admin_password, admin.password_hash)):
                admin.password_hash = hash_password(admin_password)
        for name, slug in [("妆舟", "zhuangzhou"), ("二元空间", "eryuan"), ("通用", "general")]:
            if not db.query(BusinessLine).filter(BusinessLine.slug == slug).first():
                db.add(BusinessLine(name=name, slug=slug, description=f"{name} 业务线"))
        if not db.query(Entity).count():
            entities = [
                ("ENT-BL-001", "妆舟", "业务线", "zhuangzhou"),
                ("ENT-MOD-001", "全渠道分销", "模块", "zhuangzhou"),
                ("ENT-PRO-001", "草沐知摇摇水", "产品", "zhuangzhou"),
                ("ENT-PROC-001", "内容生产流程", "流程", "zhuangzhou"),
                ("ENT-RISK-001", "功效表述风险", "风险", "zhuangzhou"),
            ]
            for entity_id, name, entity_type, business_line in entities:
                db.add(Entity(entity_id=entity_id, name=name, entity_type=entity_type, business_line=business_line, description="验收演示数据"))
            relations = [
                ("REL-001", "ENT-BL-001", "包含", "ENT-MOD-001"),
                ("REL-002", "ENT-MOD-001", "依赖", "ENT-PROC-001"),
                ("REL-003", "ENT-MOD-001", "禁止", "ENT-RISK-001"),
                ("REL-004", "ENT-BL-001", "拥有", "ENT-PRO-001"),
            ]
            for relation_id, source, relation, target in relations:
                db.add(Relationship(
                    relation_id=relation_id,
                    source_entity=source,
                    relation_type=relation,
                    target_entity=target,
                    confidence=0.9,
                    status="confirmed",
                ))
        db.commit()
    finally:
        db.close()


@asynccontextmanager
async def lifespan(app: FastAPI):
    if os.getenv("DATAHUB_ENV", "development").lower() == "production":
        weak_values = {"datahub-admin", "please-change-this-password", "change-me", "admin123", "password"}
        if len(os.getenv("DATAHUB_SECRET", "")) < 32:
            raise RuntimeError("生产环境 DATAHUB_SECRET 必须至少 32 位")
        admin_password = os.getenv("DATAHUB_ADMIN_PASSWORD", "")
        if len(admin_password) < 12 or admin_password.lower() in weak_values:
            raise RuntimeError("生产环境 DATAHUB_ADMIN_PASSWORD 必须至少 12 位且不能使用示例值")
    seed_database()
    yield


app = FastAPI(title="二元空间 DataHub Core API", version="2.0.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

for prefix in API_PREFIXES:
    app.include_router(auth.router, prefix=prefix)
    app.include_router(meta.router, prefix=prefix)
    app.include_router(assets.router, prefix=prefix)
    app.include_router(jobs.router, prefix=prefix)
    app.include_router(search.router, prefix=prefix)
    app.include_router(agent.router, prefix=prefix)
    app.include_router(graph.router, prefix=prefix)
    app.include_router(bi.router, prefix=prefix)
    app.include_router(lifecycle.router, prefix=prefix)
    app.include_router(business.router, prefix=prefix)


@app.get("/api/health")
def health():
    from datetime import datetime, timezone
    return {"status": "ok", "service": "datahub-core", "version": "2.0.0", "time": datetime.now(timezone.utc).isoformat()}


@app.get("/api/health/live")
def live():
    return health()


@app.get("/api/health/ready")
def ready():
    get_storage().health()
    from sqlalchemy import text
    with SessionLocal() as db:
        db.execute(text("SELECT 1"))
    return {"status": "ready", "database": "ok", "storage": "ok"}


@app.get("/api/v1/health")
def health_v1():
    return health()


@app.get("/{full_path:path}", include_in_schema=False)
def spa_fallback(full_path: str):
    from pathlib import Path
    from fastapi import HTTPException
    if full_path.startswith("api/"):
        raise HTTPException(status_code=404, detail="接口不存在")
    static_dir = Path(__file__).parent.parent / "static"
    candidate = (static_dir / full_path).resolve()
    if "." in Path(full_path).name:
        if candidate.exists() and candidate.is_file() and static_dir.resolve() in candidate.parents:
            return FileResponse(candidate)
        raise HTTPException(status_code=404, detail="前端资源不存在")
    index_file = static_dir / "index.html"
    if index_file.exists():
        return FileResponse(index_file)
    raise HTTPException(status_code=404, detail="前端资源不存在")


app.mount("/", StaticFiles(directory=Path(__file__).parent.parent / "static", html=True), name="static")
