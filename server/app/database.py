from sqlalchemy import create_engine, text
from sqlalchemy.orm import declarative_base, sessionmaker
import os

DB_PATH = os.getenv("DATAHUB_DB", "sqlite:///./storage/datahub.db")
engine = create_engine(DB_PATH, connect_args={"check_same_thread": False} if DB_PATH.startswith("sqlite") else {})
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def ensure_schema_upgrades() -> None:
    """Add backward-compatible columns for databases created by the first prototype."""
    additions = {
        "assets": {"raw_uri": "VARCHAR(600) DEFAULT ''"},
        "processing_jobs": {"created_by": "VARCHAR(120) DEFAULT ''", "updated_at": "TIMESTAMP NULL"},
        "entities": {"source_asset_id": "VARCHAR(60) NULL"},
        "assets": {
            "business_domain": "VARCHAR(60) DEFAULT ''",
            "business_entity": "VARCHAR(160) DEFAULT ''",
            "business_metrics": "JSON NULL",
            "lifecycle_bucket": "VARCHAR(40) DEFAULT 'raw'",
        },
    }
    with engine.begin() as connection:
        if DB_PATH.startswith("sqlite"):
            connection.execute(text("PRAGMA foreign_keys=ON"))
        for table, columns in additions.items():
            for column, definition in columns.items():
                try:
                    connection.execute(text(f'ALTER TABLE {table} ADD COLUMN {column} {definition}'))
                except Exception:
                    # create_all creates the table for new databases; an existing identical column is safe.
                    pass
