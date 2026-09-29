from tests.test_api import client, login


def test_lifecycle_history_and_business_metrics():
    headers = login()
    created = client.post("/api/assets", headers=headers, json={
        "title": "妆舟主播档案 · 测试主播",
        "business_line": "zhuangzhou",
        "source_text": "主播测试，包含直播和投流数据。",
        "tags": ["主播档案", "直播运营"],
    })
    assert created.status_code == 200, created.text
    asset_id = created.json()["asset_id"]

    processed = client.post(f"/api/assets/{asset_id}/process", headers=headers)
    assert processed.status_code == 200
    approved = client.post(f"/api/assets/{asset_id}/approve", headers=headers, json={"comment": "测试通过"})
    assert approved.status_code == 200

    patched = client.patch(f"/api/assets/{asset_id}", headers=headers, json={
        "business_domain": "host",
        "business_entity": "测试主播",
        "business_metrics": {"gmv": 10000, "orders": 80},
    })
    assert patched.status_code == 200

    timeline = client.get(f"/api/v1/assets/{asset_id}/timeline", headers=headers)
    assert timeline.status_code == 200
    events = timeline.json()["timeline"]
    assert any(item["event_type"] == "created" for item in events)
    assert any(item["event_type"] == "parsed" for item in events)
    assert any(item["event_type"] == "review_approve" for item in events)

    lifecycle = client.get("/api/v1/catalog/lifecycle", headers=headers)
    assert lifecycle.status_code == 200
    assert lifecycle.json()["total"] >= 1
    assert "stages" in lifecycle.json()

    business_items = client.get("/api/v1/business/items", headers=headers, params={"domain": "host"})
    assert business_items.status_code == 200
    assert any(item["asset_id"] == asset_id for item in business_items.json())

    business_overview = client.get("/api/v1/business/overview", headers=headers)
    assert business_overview.status_code == 200
    assert business_overview.json()["total_items"] >= 1
