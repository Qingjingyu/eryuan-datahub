#!/usr/bin/env python3
from __future__ import annotations
import random
from sqlalchemy import func
from datetime import datetime, timedelta, timezone
from uuid import uuid4

from app.database import Base, SessionLocal, engine, ensure_schema_upgrades
from app.models import (
    Asset, AssetEvent, AssetVersion, Entity, GraphAssetLink,
    ProcessingJob, Relationship, ReviewLog, User,
)

random.seed(20260924)
BASE = datetime.now(timezone.utc) - timedelta(days=45)
HOSTS = ["林晚晴", "陈子昂", "苏芮", "赵一鸣", "周可", "吴悠", "郑星河", "孙悦", "何清让", "高小满", "罗言", "唐宁"]
CATEGORIES = ["护肤", "洗护", "身体护理", "彩妆", "健康食品"]
CAMPAIGNS = ["新品首发", "超级品牌日", "会员回购", "大促预热", "达人专场", "品牌自播", "渠道返场", "夏日晒单", "秋润补水", "双十一种草"]
CHANNELS = ["抖音", "天猫", "京东", "私域小程序", "小红书", "视频号"]
STATUSES = (
    ["raw"] * 15 + ["parsed"] * 12 + ["cleaned"] * 12 + ["waiting_review"] * 20 +
    ["approved"] * 20 + ["indexed"] * 15 + ["serving"] * 20 + ["rejected"] * 5 + ["archived"] * 11
)

OWNERS = ["苏白", "林清和", "周可", "陈子昂", "苏芮", "运营组", "投放组", "内容组"]


def dt(index: int, offset_days: int = 0):
    return BASE + timedelta(days=index % 45 + offset_days, hours=(index * 3) % 24, minutes=(index * 17) % 60)


def make_asset(session, *, index, title, domain, entity, asset_type, status, summary, metrics, tags, owner, source_text):
    asset_id = f"ZZ-OPS-{index:04d}"
    if session.query(Asset).filter(Asset.asset_id == asset_id).first():
        return session.query(Asset).filter(Asset.asset_id == asset_id).first()
    created = dt(index)
    updated = created + timedelta(days=(index % 18), hours=(index * 5) % 24)
    asset = Asset(
        asset_id=asset_id,
        title=title,
        asset_type=asset_type,
        business_line="zhuangzhou",
        owner=owner,
        status=status,
        review_status="approved" if status in {"approved", "indexed", "serving"} else ("rejected" if status == "rejected" else "pending"),
        index_status="indexed" if status in {"indexed", "serving"} else "not_indexed",
        graph_status="generated" if domain in {"host", "live", "campaign", "product"} else "not_generated",
        visibility="business",
        source_type="seed",
        source_system="zhuangzhou-operations",
        source_uri=f"zhuangzhou://{domain}/{asset_id}",
        raw_uri=f"zhuangzhou://{domain}/{asset_id}/source",
        description=summary,
        summary=summary,
        processed_markdown=f"# {title}\n\n{summary}\n\n## 关键指标\n\n" + "\n".join(f"- {key}: {value}" for key, value in metrics.items()),
        source_text=source_text,
        tags=list(dict.fromkeys(["妆舟", domain, entity, *tags])),
        version=f"v{1 + index % 3}",
        checksum=f"ops-{index:06d}-{uuid4().hex[:10]}",
        progress=100 if status != "raw" else 10 + index % 60,
        chunk_count=max(1, len(summary) // 80),
        call_count=(index * 7) % 31,
        parsed_at=created + timedelta(hours=3),
        approved_at=created + timedelta(days=2) if status in {"approved", "indexed", "serving"} else None,
        indexed_at=created + timedelta(days=3) if status in {"indexed", "serving"} else None,
        created_by="seed-zhuangzhou",
        created_at=created,
        updated_by="seed-zhuangzhou",
        updated_at=updated,
        business_domain=domain,
        business_entity=entity,
        business_metrics=metrics,
        lifecycle_bucket=status,
    )
    session.add(asset)
    session.flush()

    session.add(AssetVersion(
        version_id=f"VER-{asset_id}-v1",
        asset_id=asset_id,
        version=asset.version,
        title=title,
        source_text=source_text,
        processed_markdown=asset.processed_markdown,
        checksum=asset.checksum,
        change_summary="妆舟业务数据初始化",
        created_by="seed-zhuangzhou",
    ))
    session.add(AssetEvent(
        event_id=f"EVT-{asset_id}-{uuid4().hex[:8]}",
        asset_id=asset_id,
        event_type="created",
        title="业务数据登记",
        detail=summary,
        actor="seed-zhuangzhou",
        status_to="raw",
        event_data={"domain": domain, "entity": entity},
        occurred_at=created,
    ))
    if status != "raw":
        session.add(AssetEvent(
            event_id=f"EVT-{asset_id}-{uuid4().hex[:8]}",
            asset_id=asset_id,
            event_type="parsed",
            title="解析完成",
            detail="已生成结构化摘要和知识片段",
            actor="datahub-worker",
            status_from="raw",
            status_to="waiting_review",
            event_data={"chunks": asset.chunk_count},
            occurred_at=created + timedelta(hours=3),
        ))
    if status in {"approved", "indexed", "serving"}:
        session.add(AssetEvent(
            event_id=f"EVT-{asset_id}-{uuid4().hex[:8]}",
            asset_id=asset_id,
            event_type="approved",
            title="审核通过",
            detail="业务负责人确认数据可信",
            actor=owner,
            status_from="waiting_review",
            status_to="approved",
            occurred_at=created + timedelta(days=2),
        ))
    if status in {"indexed", "serving"}:
        session.add(AssetEvent(
            event_id=f"EVT-{asset_id}-{uuid4().hex[:8]}",
            asset_id=asset_id,
            event_type="indexed",
            title="知识索引完成",
            detail="已写入检索服务",
            actor="datahub-worker",
            status_from="approved",
            status_to="indexed",
            occurred_at=created + timedelta(days=3),
        ))
    session.add(ProcessingJob(
        job_id=f"JOB-OPS-{asset_id}",
        asset_id=asset_id,
        asset_title=title,
        job_type="parse",
        status="success" if status != "raw" else "queued",
        progress=100 if status != "raw" else 20,
        input_uri=asset.source_uri,
        output_uri=f"zhuangzhou://{domain}/{asset_id}/processed.md",
        started_at=created + timedelta(hours=2),
        finished_at=created + timedelta(hours=3) if status != "raw" else None,
        created_by="seed-zhuangzhou",
    ))
    if status in {"approved", "indexed", "serving"}:
        session.add(ReviewLog(
            asset_id=asset_id,
            asset_title=title,
            reviewer=owner,
            action="approve",
            comment="业务数据人工确认",
            before_status="waiting_review",
            after_status="approved",
        ))
    session.commit()
    session.refresh(asset)
    return asset


def seed_assets(session):
    index = 130
    owner = OWNERS[index % len(OWNERS)]

    for i, host in enumerate(HOSTS):
        index += 1
        status = STATUSES[index % len(STATUSES)]
        metrics = {"followers": 12000 + i * 3821, "lives": 12 + i * 3, "gmv": 185000 + i * 42000, "orders": 850 + i * 132}
        make_asset(session, index=index, title=f"妆舟主播档案 · {host}", domain="host", entity=host,
                   asset_type="document", status=status,
                   summary=f"{host}是妆舟核心主播，擅长{CATEGORIES[i % len(CATEGORIES)]}类目直播，主打信任型讲解和场景化试用。",
                   metrics=metrics, tags=["主播档案", "直播运营"], owner=OWNERS[i % len(OWNERS)],
                   source_text=f"主播：{host}\n类目：{CATEGORIES[i % len(CATEGORIES)]}\n直播风格：场景化讲解 + 限时机制\n目标人群：25-40 岁精致护肤与洗护人群")

    for i in range(36):
        index += 1
        host = HOSTS[i % len(HOSTS)]
        campaign = CAMPAIGNS[i % len(CAMPAIGNS)]
        status = STATUSES[index % len(STATUSES)]
        gmv = 42000 + i * 18700
        spend = 9000 + i * 2600
        orders = 180 + i * 47
        metrics = {"gmv": gmv, "spend": spend, "orders": orders, "roi": round(gmv / spend, 2), "viewers": 12000 + i * 810}
        make_asset(session, index=index, title=f"妆舟直播场次 · {host} · {campaign} #{i + 1:02d}", domain="live",
                   entity=host, asset_type="spreadsheet", status=status,
                   summary=f"本场直播围绕{campaign}展开，主推{CATEGORIES[(i + 1) % len(CATEGORIES)]}产品，成交 GMV {gmv} 元。",
                   metrics=metrics, tags=["直播场次", campaign], owner="投放组" if i % 2 else "运营组",
                   source_text=f"直播主题：{campaign}\n主播：{host}\nGMV：{gmv}\n投流：{spend}\n订单：{orders}")

    for i in range(18):
        index += 1
        campaign = CAMPAIGNS[i % len(CAMPAIGNS)]
        channel = CHANNELS[i % len(CHANNELS)]
        status = STATUSES[index % len(STATUSES)]
        spend = 24000 + i * 5200
        gmv = spend * (1.8 + (i % 5) * 0.42)
        metrics = {"spend": spend, "gmv": round(gmv, 2), "roi": round(gmv / spend, 2), "clicks": 12000 + i * 930, "orders": 260 + i * 38}
        make_asset(session, index=index, title=f"妆舟投流计划 · {campaign} · {channel}", domain="campaign",
                   entity=campaign, asset_type="spreadsheet", status=status,
                   summary=f"投放渠道为{channel}，核心目标是新品拉新和直播间成交，总消耗 {spend} 元。",
                   metrics=metrics, tags=["投流", channel], owner="投放组",
                   source_text=f"渠道：{channel}\n消耗：{spend}\nGMV：{gmv}\nROI：{gmv / spend:.2f}")

    for i in range(24):
        index += 1
        product = ["平衡精华水", "修护面霜", "蓬松洗发水", "舒缓身体乳", "轻透防晒乳"][i % 5]
        channel = CHANNELS[i % len(CHANNELS)]
        status = STATUSES[index % len(STATUSES)]
        orders = 80 + i * 26
        gmv = orders * (159 + (i % 4) * 40)
        metrics = {"orders": orders, "gmv": gmv, "refund_rate": round(1.2 + (i % 5) * 0.35, 2), "channel": channel}
        make_asset(session, index=index, title=f"妆舟订单台账 · {product} · 批次 {i + 1:02d}", domain="order",
                   entity=product, asset_type="spreadsheet", status=status,
                   summary=f"记录 {channel} 渠道 {product} 的订单、支付、发货和退款情况。",
                   metrics=metrics, tags=["订单台账", channel], owner="运营组",
                   source_text=f"产品：{product}\n渠道：{channel}\n订单：{orders}\nGMV：{gmv}")

    for i in range(12):
        index += 1
        status = STATUSES[index % len(STATUSES)]
        make_asset(session, index=index, title=f"妆舟售后记录 · 批次 {i + 1:02d}", domain="after_sales",
                   entity=["物流破损", "肤感不适", "发货延迟", "包装漏液", "效果预期"][i % 5], asset_type="spreadsheet",
                   status=status, summary="记录售后问题类型、处理时效、退款金额和客户满意度。",
                   metrics={"tickets": 18 + i * 7, "refund": 2400 + i * 610, "satisfaction": round(4.2 + (i % 5) * 0.12, 1)},
                   tags=["售后", "客户体验"], owner="客户成功组",
                   source_text="问题类型、处理人、处理时长、退款金额、客户满意度。")

    for i in range(18):
        index += 1
        status = STATUSES[index % len(STATUSES)]
        make_asset(session, index=index, title=f"妆舟内容素材 · 短视频脚本 {i + 1:02d}", domain="content",
                   entity=CATEGORIES[i % len(CATEGORIES)], asset_type="document", status=status,
                   summary="包含开头钩子、场景痛点、产品讲解、促单机制和评论区引导。",
                   metrics={"duration_seconds": 38 + (i % 6) * 7, "plays": 18000 + i * 4200, "ctr": round(3.1 + (i % 6) * 0.38, 2)},
                   tags=["内容素材", "短视频"], owner="内容组",
                   source_text="开头钩子、痛点、产品展示、机制、行动号召。")

    for i in range(10):
        index += 1
        status = STATUSES[index % len(STATUSES)]
        make_asset(session, index=index, title=f"妆舟供应商档案 · 供应商 {i + 1:02d}", domain="supplier",
                   entity=f"供应商 {i + 1:02d}", asset_type="document", status=status,
                   summary="记录供应商资质、产能、交期、质检和合作评级。",
                   metrics={"capacity": 20000 + i * 4200, "on_time_rate": round(90 + (i % 8) * 0.7, 1), "defect_rate": round(0.4 + (i % 4) * 0.12, 2)},
                   tags=["供应商", "供应链"], owner="供应链组",
                   source_text="供应商资质、产能、质检、交期、合作评级。")

    for i in range(10):
        index += 1
        status = STATUSES[index % len(STATUSES)]
        make_asset(session, index=index, title=f"妆舟运营 SOP · {['直播开场', '产品讲解', '投流调整', '订单处理', '售后响应'][i % 5]}", domain="sop",
                   entity="运营 SOP", asset_type="document", status=status,
                   summary="标准化动作、责任人、检查点和异常处理方式。",
                   metrics={"steps": 6 + i % 5, "owner_count": 2 + i % 3, "review_cycle_days": 30},
                   tags=["SOP", "运营"], owner="运营组",
                   source_text="目标、动作、责任人、检查点、异常处理。")

    risks = ["功效绝对化", "临床依据不足", "价格误导", "成分宣传夸大", " before/after 对比风险", "用户体验表述不当"]
    for i, risk in enumerate(risks * 2):
        index += 1
        status = STATUSES[index % len(STATUSES)]
        make_asset(session, index=index, title=f"妆舟合规风险 · {risk} #{i + 1:02d}", domain="risk",
                   entity=risk, asset_type="document", status=status,
                   summary="记录风险描述、适用平台、违规后果、整改方案和责任岗位。",
                   metrics={"severity": 1 + i % 5, "occurrences": 1 + i % 4, "review_cycle_days": 14},
                   tags=["合规", "风险"], owner="合规组",
                   source_text=f"风险：{risk}\n整改方案：修改文案、补充依据、复核平台规则。")

    for i in range(12):
        index += 1
        status = STATUSES[index % len(STATUSES)]
        make_asset(session, index=index, title=f"妆舟运营复盘 · 月份 {i + 1:02d}", domain="report",
                   entity="妆舟运营复盘", asset_type="document", status=status,
                   summary="复盘 GMV、投流效率、内容表现、主播表现、售后与合规问题。",
                   metrics={"gmv": 320000 + i * 48000, "spend": 78000 + i * 9200, "orders": 1200 + i * 140},
                   tags=["复盘", "经营分析"], owner="苏白",
                   source_text="经营结果、关键动作、问题、下月策略。")


def seed_graph(session):
    hosts = session.query(Asset).filter(Asset.business_domain == "host").all()
    for host_asset in hosts:
        host = host_asset.business_entity
        if not host:
            continue
        entity_id = f"ENT-HOST-{abs(hash(host)) % 100000:05d}"
        if not session.query(Entity).filter(Entity.entity_id == entity_id).first():
            entity = Entity(entity_id=entity_id, name=host, entity_type="主播", business_line="zhuangzhou", description="妆舟业务主播")
            entity.source_asset_id = host_asset.asset_id
            session.add(entity)
            session.flush()
        session.add(GraphAssetLink(entity_id=entity_id, asset_id=host_asset.asset_id, evidence_text=host_asset.summary, score=0.95))
        session.commit()
        session.refresh(host_asset)

    lives = session.query(Asset).filter(Asset.business_domain == "live").all()
    host_entities = {entity.name: entity.entity_id for entity in session.query(Entity).filter(Entity.entity_type == "主播").all()}
    for live in lives:
        host = live.business_entity
        host_id = host_entities.get(host)
        if not host_id or not live.business_entity:
            continue
        live_id = f"ENT-LIVE-{live.asset_id[-6:]}"
        if not session.query(Entity).filter(Entity.entity_id == live_id).first():
            entity = Entity(entity_id=live_id, name=live.title, entity_type="直播场次", business_line="zhuangzhou", description=live.summary)
            entity.source_asset_id = live.asset_id
            session.add(entity)
            session.flush()
        session.add(GraphAssetLink(entity_id=live_id, asset_id=live.asset_id, evidence_text=live.summary, score=0.94))
        relation_id = f"REL-{abs(hash((host_id, live_id))) % 100000:05d}"
        if not session.query(Relationship).filter(Relationship.relation_id == relation_id).first():
            session.add(Relationship(relation_id=relation_id, source_entity=host_id, relation_type="直播", target_entity=live_id, asset_id=live.asset_id, confidence=0.94))
            session.add(GraphAssetLink(relation_id=relation_id, asset_id=live.asset_id, evidence_text=live.summary, score=0.94))
        session.commit()


def seed_graph_bridges(session):
    """把主播 -> 直播场次的小集群接回妆舟业务主图。"""
    business_id = "ENT-BL-001"
    product_id = "ENT-PRO-001"
    hosts = session.query(Entity).filter(Entity.entity_type == "主播").all()
    host_assets = {
        asset.business_entity: asset
        for asset in session.query(Asset).filter(Asset.business_domain == "host").all()
    }

    for host in hosts:
        host_asset = host_assets.get(host.name)
        evidence_asset_id = host_asset.asset_id if host_asset else (host.source_asset_id or "")
        evidence = host_asset.summary if host_asset else "主播签约与业务归属"

        relation_id = f"REL-BRIDGE-BL-HOST-{abs(hash(host.entity_id)) % 100000:05d}"
        if not session.query(Relationship).filter(Relationship.relation_id == relation_id).first():
            session.add(Relationship(
                relation_id=relation_id,
                source_entity=business_id,
                relation_type="签约",
                target_entity=host.entity_id,
                asset_id=evidence_asset_id,
                confidence=0.96,
                status="confirmed",
            ))
            session.add(GraphAssetLink(
                relation_id=relation_id,
                asset_id=evidence_asset_id,
                evidence_text="主播签约妆舟业务线",
                score=0.96,
            ))

        relation_id = f"REL-BRIDGE-HOST-PRODUCT-{abs(hash(host.entity_id + product_id)) % 100000:05d}"
        if not session.query(Relationship).filter(Relationship.relation_id == relation_id).first():
            session.add(Relationship(
                relation_id=relation_id,
                source_entity=host.entity_id,
                relation_type="主推",
                target_entity=product_id,
                asset_id=evidence_asset_id,
                confidence=0.9,
                status="confirmed",
            ))
            session.add(GraphAssetLink(
                relation_id=relation_id,
                asset_id=evidence_asset_id,
                evidence_text="主播主推妆舟核心产品",
                score=0.9,
            ))

    session.commit()


def main():
    Base.metadata.create_all(bind=engine)
    ensure_schema_upgrades()
    session = SessionLocal()
    try:
        before = session.query(Asset).count()
        seed_assets(session)
        seed_graph(session)
        seed_graph_bridges(session)
        after = session.query(Asset).count()
        print(f"assets before={before}, after={after}, seeded={after-before}")
        print(f"business domains={dict(session.query(Asset.business_domain, func.count(Asset.id)).group_by(Asset.business_domain).all())}")
        print(f"graph entities={session.query(Entity).count()}, relationships={session.query(Relationship).count()}")
    finally:
        session.close()


if __name__ == "__main__":
    main()
