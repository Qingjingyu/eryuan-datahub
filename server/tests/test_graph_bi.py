"""Graph and BI v1 acceptance tests."""


def test_graph_create_query_and_bi_metrics():
    from tests.test_api import client, login

    headers = login()

    first = client.post(
        "/api/assets",
        headers=headers,
        json={
            "title": "图谱来源 A",
            "business_line": "zhuangzhou",
            "source_text": "产品由妆舟渠道销售，内容由内容生产流程生成。",
        },
    )
    assert first.status_code == 200
    first_id = first.json()["asset_id"]

    second = client.post(
        "/api/assets",
        headers=headers,
        json={
            "title": "图谱来源 B",
            "business_line": "zhuangzhou",
            "source_text": "功效表述必须通过审核，避免违规风险。",
        },
    )
    assert second.status_code == 200
    second_id = second.json()["asset_id"]

    processed = client.post(f"/api/assets/{first_id}/process", headers=headers)
    assert processed.status_code == 200, processed.text
    assert processed.json()["status"] == "waiting_review"
    approved = client.post(f"/api/assets/{first_id}/approve", headers=headers, json={"comment": "通过"})
    assert approved.status_code == 200
    indexed = client.post(f"/api/assets/{first_id}/index", headers=headers)
    assert indexed.status_code == 200

    product = client.post(
        "/api/v1/graph/entities",
        headers=headers,
        json={
            "name": "平衡精华水",
            "entity_type": "产品",
            "business_line": "zhuangzhou",
            "asset_ids": [first_id, second_id],
        },
    )
    assert product.status_code == 200, product.text
    product_data = product.json()
    assert product_data["asset_ids"] == [first_id, second_id]
    assert product_data["sources"][0]["asset_id"] == first_id

    process = client.post(
        "/api/v1/graph/entities",
        headers=headers,
        json={
            "name": "内容生产流程",
            "entity_type": "流程",
            "business_line": "zhuangzhou",
            "asset_ids": [first_id],
        },
    )
    assert process.status_code == 200
    process_id = process.json()["entity_id"]
    product_id = product_data["entity_id"]

    relation = client.post(
        "/api/v1/graph/relationships",
        headers=headers,
        json={
            "source_entity": process_id,
            "relation_type": "生产",
            "target_entity": product_id,
            "confidence": 0.92,
            "asset_ids": [first_id, second_id],
        },
    )
    assert relation.status_code == 200, relation.text
    relation_data = relation.json()
    relation_id = relation_data["relation_id"]
    assert relation_data["asset_ids"] == [first_id, second_id]
    assert relation_data["confidence"] == 0.92

    patched = client.patch(
        f"/api/v1/graph/relationships/{relation_id}",
        headers=headers,
        json={"status": "candidate", "confidence": 0.75},
    )
    assert patched.status_code == 200, patched.text
    assert patched.json()["status"] == "candidate"
    assert patched.json()["confidence"] == 0.75

    by_asset = client.get(
        "/api/v1/graph/query",
        headers=headers,
        params={"asset_id": first_id, "relation_type": "生产"},
    )
    assert by_asset.status_code == 200, by_asset.text
    assert by_asset.json()["total"]["edges"] == 1
    assert {node["entity_id"] for node in by_asset.json()["nodes"]} == {process_id, product_id}

    by_filters = client.get(
        "/api/v1/graph/query",
        headers=headers,
        params={
            "business_line": "zhuangzhou",
            "entity_type": "流程",
            "relation_status": "candidate",
        },
    )
    assert by_filters.status_code == 200
    assert relation_id in {edge["relation_id"] for edge in by_filters.json()["edges"]}

    missing_source = client.post(
        "/api/v1/graph/entities",
        headers=headers,
        json={"name": "坏数据", "entity_type": "测试", "asset_ids": ["NOT-EXISTS"]},
    )
    assert missing_source.status_code == 400
    invalid_confidence = client.post(
        "/api/v1/graph/relationships",
        headers=headers,
        json={
            "source_entity": process_id,
            "relation_type": "测试",
            "target_entity": product_id,
            "confidence": 1.5,
        },
    )
    assert invalid_confidence.status_code == 422

    trend = client.get("/api/v1/bi/assets/trend", headers=headers)
    assert trend.status_code == 200 and trend.json()["total_assets"] >= 2
    distribution = client.get("/api/v1/bi/assets/distribution", headers=headers)
    assert distribution.status_code == 200
    assert "zhuangzhou" in {row["business_line"] for row in distribution.json()["business_line_distribution"]}

    for endpoint in ["processing", "review", "index", "search", "agent"]:
        response = client.get(f"/api/v1/bi/{endpoint}", headers=headers)
        assert response.status_code == 200, response.text

    ask = client.post("/api/ask", headers=headers, json={"query":"图谱来源 A 的内容是什么？"})
    assert ask.status_code == 200

    search_bi = client.get("/api/v1/bi/search", headers=headers)
    assert search_bi.status_code == 200
    assert search_bi.json()["ask_count"] >= 1
    assert search_bi.json()["unauthorized_access_count"] >= 0

    agent_bi = client.get("/api/v1/bi/agent", headers=headers)
    assert agent_bi.status_code == 200 and agent_bi.json()["calls"] >= 1

    overview = client.get("/api/v1/bi/overview", headers=headers, params={"days": 7})
    assert overview.status_code == 200
    body = overview.json()
    assert body["total_assets"] >= 2
    assert len(body["asset_trend"]["items"]) == 7
    assert body["processing"]["success_rate"] is not None
    assert body["index"]["index_failure_rate"] is not None
    assert body["search"]["citation_coverage"] is not None
    assert body["agent"]["usage_by_tool"]
