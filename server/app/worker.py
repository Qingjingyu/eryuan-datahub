"""Background maintenance worker for retryable parse jobs.

The API keeps synchronous parsing for small/demo workloads. In production this
service retries interrupted/failed jobs so a single large document cannot block
request handling. Queue-based parsing is a later replacement, not required for
the current acceptance boundary.
"""
from __future__ import annotations

import os
import time
from pathlib import Path

from .database import Base, SessionLocal, engine
from .models import Asset, ProcessingJob, User
from .services.asset_service import process_asset

HEARTBEAT = Path(os.getenv("DATAHUB_WORKER_HEARTBEAT", "/tmp/datahub-workerhealthy"))
POLL_SECONDS = float(os.getenv("DATAHUB_WORKER_POLL_SECONDS", "5"))


def _worker_user(db):
    user = db.query(User).filter(User.username == "datahub-worker").first()
    if not user:
        user = User(username="datahub-worker", password_hash="worker-no-login", display_name="后台解析 Worker", role="reviewer", business_line="general")
        db.add(user)
        db.commit()
        db.refresh(user)
    return user


def run_once() -> int:
    db = SessionLocal()
    try:
        failed = db.query(ProcessingJob.id).filter(ProcessingJob.job_type.in_(["parse", "parse_clean"]), ProcessingJob.status == "failed").order_by(ProcessingJob.id.asc()).all()
        asset_ids = []
        for (job_id,) in failed:
            job = db.query(ProcessingJob).get(job_id)
            if job and not db.query(ProcessingJob).filter(ProcessingJob.asset_id == job.asset_id, ProcessingJob.status == "running").first():
                asset_ids.append(job.asset_id)
        if not asset_ids:
            return 0
        user = _worker_user(db)
        processed = 0
        for asset_id in asset_ids:
            asset = db.query(Asset).filter(Asset.asset_id == asset_id, Asset.deleted_at.is_(None)).first()
            if not asset:
                continue
            try:
                process_asset(db, asset_id, user)
                processed += 1
            except Exception:
                db.rollback()
        return processed
    finally:
        db.close()


def main() -> None:
    Base.metadata.create_all(bind=engine)
    HEARTBEAT.parent.mkdir(parents=True, exist_ok=True)
    while True:
        HEARTBEAT.write_text(str(int(time.time())))
        if not run_once():
            time.sleep(POLL_SECONDS)


if __name__ == "__main__":
    main()
