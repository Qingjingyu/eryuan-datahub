#!/usr/bin/env python3
import os, sys
from sqlalchemy import create_engine, inspect, text
from app.database import Base
from app import models  # noqa: F401  # 注册所有模型

SOURCE = os.getenv("SOURCE_DB", "sqlite:///./storage/datahub.db")
TARGET = os.getenv("TARGET_DB", "")
if not TARGET:
    raise SystemExit("必须通过 TARGET_DB 提供目标数据库连接串，例如 postgresql+psycopg2://user:password@host:5432/database")

src = create_engine(SOURCE)
dst = create_engine(TARGET)
insp = inspect(src)
if not insp.get_table_names():
    raise SystemExit("SQLite 没有可迁移数据")

Base.metadata.create_all(bind=dst)
print("target ready:", TARGET)

with src.connect() as sc, dst.begin() as dc:
    total_rows = 0
    for table in Base.metadata.sorted_tables:
        if table.name not in insp.get_table_names():
            continue
        rows = [dict(r._mapping) for r in sc.execute(table.select())]
        if rows:
            dc.execute(table.insert(), rows)
            total_rows += len(rows)
        print(f"{table.name}: {len(rows)}")
    print("total rows:", total_rows)

with dst.begin() as conn:
    for table in Base.metadata.sorted_tables:
        idcol = table.columns.get("id")
        if idcol is not None and idcol.primary_key:
            conn.execute(text(f"SELECT setval(pg_get_serial_sequence('{table.name}','id'), COALESCE((SELECT MAX(id) FROM {table.name}), 1), true)"))
print("migration complete")
