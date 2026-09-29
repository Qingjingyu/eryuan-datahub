import os, tempfile
from pathlib import Path
from fastapi.testclient import TestClient

tmp = tempfile.TemporaryDirectory()
os.environ["DATAHUB_DB"] = f"sqlite:///{tmp.name}/test.db"
os.environ["DATAHUB_STORAGE"] = tmp.name
os.environ["DATAHUB_ADMIN_PASSWORD"] = "datahub-admin"
from app.main import app  # noqa: E402
from app.database import Base, SessionLocal, engine  # noqa: E402
from app.models import BusinessLine, User  # noqa: E402
from app.utils import hash_password  # noqa: E402

Base.metadata.create_all(bind=engine)
db = SessionLocal()
for name, slug in (("妆舟", "zhuangzhou"), ("二元空间", "eryuan"), ("通用", "general")):
    if not db.query(BusinessLine).filter(BusinessLine.slug == slug).first():
        db.add(BusinessLine(name=name, slug=slug))
if not db.query(User).filter(User.username == "admin").first():
    db.add(User(username="admin", password_hash=hash_password("datahub-admin"), display_name="管理员", role="admin", business_line="general"))
    db.commit()
db.close()
client = TestClient(app)

def login():
    r = client.post("/api/auth/login", json={"username":"admin","password":"datahub-admin"})
    assert r.status_code == 200
    return {"Authorization": "Bearer " + r.json()["token"]}

def test_health():
    r = client.get("/api/health")
    assert r.status_code == 200 and r.json()["status"] == "ok"

def test_full_lifecycle():
    h = login()
    r = client.post("/api/assets", headers=h, json={"title":"测试资料","business_line":"zhuangzhou","source_text":"妆舟渠道分销规则：订单先人工导入。"})
    assert r.status_code == 200, r.text
    asset_id = r.json()["asset_id"]
    p = Path(tmp.name)/"sample.md"; p.write_text("# 测试\n\n妆舟渠道分销规则：订单先人工导入。")
    with p.open("rb") as f:
        r = client.post(f"/api/assets/{asset_id}/files", headers=h, files={"file":("sample.md",f,"text/markdown")})
    assert r.status_code == 200
    r = client.post(f"/api/assets/{asset_id}/process", headers=h)
    assert r.status_code == 200 and r.json()["status"] == "waiting_review"
    r = client.post(f"/api/assets/{asset_id}/approve", headers=h, json={"comment":"通过"})
    assert r.status_code == 200 and r.json()["status"] == "approved"
    r = client.post(f"/api/assets/{asset_id}/index", headers=h)
    assert r.status_code == 200
    r = client.get("/api/search", headers=h, params={"q":"妆舟 渠道 分销"})
    assert r.status_code == 200 and r.json()["results"]
    r = client.post("/api/ask", headers=h, json={"query":"妆舟渠道分销怎么处理订单？"})
    assert r.status_code == 200 and r.json()["citations"]
    assert r.json()["citations"][0]["asset_id"] == asset_id
    r = client.post("/api/agent/execute", headers=h, json={"tool":"search_assets","query":"妆舟 渠道 分销"})
    assert r.status_code == 200 and r.json()["asset_ids"]
    r = client.get("/api/bi/metrics", headers=h)
    assert r.status_code == 200 and r.json()["total_assets"] >= 1

def test_health_ready():
    r = client.get("/api/health/ready")
    assert r.status_code == 200
    assert r.json()["database"] == "ok"
    assert r.json()["storage"] == "ok"


def test_login_rejects_bad_credentials():
    for password in ("wrong-password", ""):
        r = client.post("/api/auth/login", json={"username": "admin", "password": password})
        assert r.status_code == 401


def test_permission_denial_and_business_isolation():
    from app.database import SessionLocal
    from app.models import User
    from app.utils import hash_password

    admin = login()
    created = client.post(
        "/api/assets",
        headers=admin,
        json={
            "title": "妆舟权限隔离资料",
            "business_line": "zhuangzhou",
            "visibility": "business",
            "owner": "admin",
            "source_text": "妆舟隔离特殊标记",
        },
    )
    assert created.status_code == 200
    asset_id = created.json()["asset_id"]

    db = SessionLocal()
    try:
        if not db.query(User).filter(User.username == "limited-member").first():
            db.add(User(
                username="limited-member",
                password_hash=hash_password("limited-password-2026"),
                display_name="limited-member",
                role="member",
                business_line="beauty",
            ))
        db.commit()
    finally:
        db.close()

    login_response = client.post(
        "/api/auth/login",
        json={"username": "limited-member", "password": "limited-password-2026"},
    )
    assert login_response.status_code == 200
    member = {"Authorization": "Bearer " + login_response.json()["token"]}

    # Different business line + business visibility means the resource is hidden.
    assert client.get(f"/api/assets/{asset_id}", headers=member).status_code == 404
    assert client.post(f"/api/assets/{asset_id}/files", headers=member, files={"file": ("x.txt", b"no", "text/plain")}).status_code == 404
    assert client.post(f"/api/assets/{asset_id}/process", headers=member).status_code == 404
    assert client.post(f"/api/assets/{asset_id}/approve", headers=member, json={"comment": "no"}).status_code == 403

    # Reviewer/admin-only governance APIs reject member role.
    assert client.get("/api/admin/users", headers=member).status_code == 403
    assert client.get("/api/audit-logs", headers=member).status_code == 403
    assert client.get("/api/v1/audit-logs", headers=member).status_code == 403
