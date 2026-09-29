from datetime import datetime, timezone

from fastapi.testclient import TestClient

from app.main import app
from app.database import Base, SessionLocal, engine
from app.models import Asset, User
from app.utils import sign

Base.metadata.create_all(bind=engine)
client = TestClient(app)


def login(username: str = "admin"):
    # The task under test is authorization for retrieval/agent APIs, not the
    # shared login endpoint, so tests mint tokens with the production signer.
    return {"Authorization": "Bearer " + sign(username)}


def seed():
    db = SessionLocal()
    try:
        for username, business_line in (("retrieval-zh", "zhuangzhou"), ("retrieval-other", "beauty")):
            if not db.query(User).filter(User.username == username).first():
                db.add(User(username=username, password_hash="none", display_name=username, role="member", business_line=business_line))
        marker = "ZhuRetrievalSpecialRule"
        fixtures = [
            ("retrieval-zh-approved", "妆舟检索专用资产", "zhuangzhou", "approved", "approved", f"{marker}：订单必须人工复核。"),
            ("retrieval-other-approved", "其他线检索专用资产", "beauty", "approved", "approved", f"{marker}：其他业务线内容。"),
            ("retrieval-zh-pending", "未审核检索专用资产", "zhuangzhou", "approved", "pending", f"{marker}：这条不能被检索。"),
            ("retrieval-zh-archived", "已归档检索专用资产", "zhuangzhou", "archived", "approved", f"{marker}：这条不能被检索。"),
        ]
        for asset_id, title, business_line, status, review_status, text in fixtures:
            row = db.query(Asset).filter(Asset.asset_id == asset_id).first()
            if not row:
                row = Asset(asset_id=asset_id, title=title)
                db.add(row)
            row.business_line = business_line
            row.owner = "admin"
            row.visibility = "business"
            row.status = status
            row.review_status = review_status
            row.index_status = "indexed"
            row.source_text = text
            row.processed_markdown = text
            row.version = "v1"
        db.commit()
    finally:
        db.close()


def test_v1_search_permissions_and_citation_integrity():
    seed()
    zh_headers = login("retrieval-zh")
    other_headers = login("retrieval-other")

    response = client.post("/api/v1/search", headers=zh_headers, json={"query": "ZhuRetrievalSpecialRule", "top_k": 10})
    assert response.status_code == 200
    payload = response.json()
    ids = [item["asset_id"] for item in payload["results"]]
    assert "retrieval-zh-approved" in ids
    assert "retrieval-other-approved" not in ids
    assert "retrieval-zh-pending" not in ids
    assert "retrieval-zh-archived" not in ids
    citation = payload["citations"][0]
    for key in ("asset_id", "title", "snippet", "version", "updated_at"):
        assert key in citation and citation[key]

    response = client.post("/api/v1/search", headers=other_headers, json={"query": "ZhuRetrievalSpecialRule", "top_k": 10})
    ids = [item["asset_id"] for item in response.json()["results"]]
    assert "retrieval-other-approved" in ids
    assert "retrieval-zh-approved" not in ids


def test_v1_ask_requires_complete_citations():
    headers = login("retrieval-zh")
    response = client.post("/api/v1/ask", headers=headers, json={"query": "ZhuRetrievalSpecialRule 怎么处理订单？"})
    assert response.status_code == 200
    payload = response.json()
    assert payload["citations"]
    required = {"asset_id", "title", "snippet", "version", "updated_at"}
    assert all(required.issubset(item) for item in payload["citations"])
    assert all(item["asset_id"] not in {"retrieval-zh-pending", "retrieval-zh-archived"} for item in payload["citations"])


def test_agent_read_filters_unapproved_and_unauthorized_assets():
    zh_headers = login("retrieval-zh")
    other_headers = login("retrieval-other")

    response = client.post("/api/v1/agent/read", headers=zh_headers, json={"asset_id": "retrieval-zh-approved"})
    assert response.status_code == 200
    assert response.json()["citations"][0]["asset_id"] == "retrieval-zh-approved"

    response = client.post("/api/v1/agent/read", headers=other_headers, json={"asset_id": "retrieval-zh-approved"})
    assert response.status_code == 403

    response = client.post("/api/v1/agent/read", headers=zh_headers, json={"asset_id": "retrieval-zh-pending"})
    assert response.status_code == 403

    response = client.get("/api/v1/agent/logs", headers=zh_headers)
    assert response.status_code == 200
    assert response.json()
