from __future__ import annotations

import hashlib
import os
import shutil
import uuid
from dataclasses import dataclass
from pathlib import Path
from typing import BinaryIO


ZONES = {
    "raw": "01_raw",
    "staging": "02_staging",
    "curated": "03_curated",
    "index_input": "04_index_input",
    "agent_output": "05_agent_output",
    "archive": "90_archive",
}


@dataclass(frozen=True)
class StoredObject:
    zone: str
    file_name: str
    storage_path: str
    file_size: int
    checksum: str


class ObjectStorage:
    """Stable storage facade shared by local disk and S3-compatible providers."""

    def ensure(self) -> None:
        raise NotImplementedError

    def save(self, zone: str, file_name: str, stream: BinaryIO) -> StoredObject:
        raise NotImplementedError

    def write_text(self, zone: str, file_name: str, text: str) -> StoredObject:
        raise NotImplementedError

    def resolve(self, storage_path: str) -> Path:
        raise NotImplementedError

    def remove(self, storage_path: str) -> None:
        raise NotImplementedError

    def health(self) -> bool:
        raise NotImplementedError


class LocalObjectStorage(ObjectStorage):
    def __init__(self, root: str | Path):
        self.root = Path(root).expanduser().resolve()

    def ensure(self) -> None:
        self.root.mkdir(parents=True, exist_ok=True)
        for zone in ZONES.values():
            (self.root / zone).mkdir(parents=True, exist_ok=True)
            (self.root / zone / ".gitkeep").touch(exist_ok=True)

    def _prepare(self, zone: str, file_name: str) -> tuple[Path, Path]:
        self.ensure()
        zone_name = ZONES.get(zone, zone)
        safe = Path(file_name).name
        if not safe or safe in {".", ".."}:
            raise ValueError("文件名不合法")
        destination_dir = (self.root / zone_name).resolve()
        destination_dir.mkdir(parents=True, exist_ok=True)
        destination = destination_dir / safe
        if destination_dir not in destination.resolve().parents:
            raise ValueError("存储路径越界")
        return destination_dir, destination

    def save(self, zone: str, file_name: str, stream: BinaryIO) -> StoredObject:
        destination_dir, destination = self._prepare(zone, file_name)
        suffix = destination.suffix
        destination = destination_dir / f"{destination.stem}_{uuid.uuid4().hex[:8]}{suffix}"
        digest = hashlib.sha256()
        size = 0
        with destination.open("wb") as output:
            while chunk := stream.read(1024 * 1024):
                size += len(chunk)
                digest.update(chunk)
                output.write(chunk)
        return StoredObject(ZONES.get(zone, zone), destination.name, str(destination), size, digest.hexdigest())

    def write_text(self, zone: str, file_name: str, text: str) -> StoredObject:
        destination_dir, destination = self._prepare(zone, file_name)
        destination = destination_dir / destination.name
        if destination.exists():
            destination = destination_dir / f"{destination.stem}_{uuid.uuid4().hex[:8]}{destination.suffix}"
        data = text.encode("utf-8")
        destination.write_bytes(data)
        return StoredObject(ZONES.get(zone, zone), destination.name, str(destination), len(data), hashlib.sha256(data).hexdigest())

    def resolve(self, storage_path: str) -> Path:
        path = Path(storage_path)
        return path if path.is_absolute() else self.root / path

    def remove(self, storage_path: str) -> None:
        path = self.resolve(storage_path)
        try:
            path.unlink(missing_ok=True)
        except OSError:
            pass

    def health(self) -> bool:
        self.ensure()
        return True


class RemoteObjectStorage(ObjectStorage):
    """MinIO / OSS / COS adapter using their common S3-compatible API."""

    def __init__(self):
        self.root = Path(os.getenv("DATAHUB_STORAGE", "./storage")).expanduser().resolve()
        self.endpoint = os.getenv("DATAHUB_S3_ENDPOINT", "").rstrip("/") or None
        self.bucket = os.getenv("DATAHUB_S3_BUCKET", "datahub")
        self.access_key = os.getenv("DATAHUB_S3_ACCESS_KEY", "")
        self.secret_key = os.getenv("DATAHUB_S3_SECRET_KEY", "")
        self.region = os.getenv("DATAHUB_S3_REGION", "us-east-1")
        self.prefix = os.getenv("DATAHUB_S3_PREFIX", "datahub").strip("/")
        if not self.access_key or not self.secret_key:
            raise ValueError("远程存储必须设置 DATAHUB_S3_ACCESS_KEY 和 DATAHUB_S3_SECRET_KEY")
        self.local = LocalObjectStorage(self.root)

    def client(self):
        import boto3
        return boto3.client(
            "s3",
            endpoint_url=self.endpoint,
            aws_access_key_id=self.access_key,
            aws_secret_access_key=self.secret_key,
            region_name=self.region,
        )

    def ensure(self) -> None:
        self.local.ensure()
        try:
            self.client().head_bucket(Bucket=self.bucket)
        except Exception:
            if os.getenv("DATAHUB_S3_AUTO_CREATE_BUCKET", "false").lower() not in {"1", "true", "yes"}:
                raise
            self.client().create_bucket(Bucket=self.bucket)

    def _key(self, zone: str, file_name: str) -> str:
        zone_name = ZONES.get(zone, zone)
        return f"{self.prefix}/{zone_name}/{Path(file_name).name}"

    def save(self, zone: str, file_name: str, stream: BinaryIO) -> StoredObject:
        self.ensure()
        key = self._key(zone, file_name)
        digest = hashlib.sha256()
        size = 0
        with self.local._prepare(zone, Path(key).name)[1].open("wb") as cache:
            while chunk := stream.read(1024 * 1024):
                size += len(chunk)
                digest.update(chunk)
                cache.write(chunk)
        with self.local._prepare(zone, Path(key).name)[1].open("rb") as upload:
            self.client().upload_fileobj(upload, self.bucket, key)
        return StoredObject(ZONES.get(zone, zone), Path(key).name, f"s3://{self.bucket}/{key}", size, digest.hexdigest())

    def write_text(self, zone: str, file_name: str, text: str) -> StoredObject:
        import io
        stream = io.BytesIO(text.encode("utf-8"))
        stored = self.save(zone, file_name, stream)
        return StoredObject(stored.zone, stored.file_name, stored.storage_path, stored.file_size, hashlib.sha256(text.encode("utf-8")).hexdigest())

    def _cache_path(self, key: str) -> Path:
        relative = key.removeprefix(f"{self.prefix}/")
        return self.root / "cache" / relative

    def resolve(self, storage_path: str) -> Path:
        if not storage_path.startswith("s3://"):
            return self.local.resolve(storage_path)
        key = storage_path.removeprefix(f"s3://{self.bucket}/")
        target = self._cache_path(key)
        target.parent.mkdir(parents=True, exist_ok=True)
        if not target.exists():
            self.client().download_file(self.bucket, key, str(target))
        return target

    def remove(self, storage_path: str) -> None:
        if storage_path.startswith("s3://"):
            key = storage_path.removeprefix(f"s3://{self.bucket}/")
            try:
                self.client().delete_object(Bucket=self.bucket, Key=key)
            except OSError:
                pass
        self.local.remove(storage_path)

    def health(self) -> bool:
        self.ensure()
        return True


_storage: ObjectStorage | None = None


def get_storage() -> ObjectStorage:
    global _storage
    if _storage is None:
        backend = os.getenv("DATAHUB_STORAGE_BACKEND", "local").lower()
        if backend not in {"local", "s3", "minio", "oss", "cos"}:
            raise ValueError("不支持的存储后端")
        if backend == "local":
            _storage = LocalObjectStorage(os.getenv("DATAHUB_STORAGE", "./storage"))
        else:
            _storage = RemoteObjectStorage()
    return _storage
