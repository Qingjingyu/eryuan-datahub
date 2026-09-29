import base64
import csv
import hashlib
import hmac
import io
import json
import os
import re
import secrets
import time
import zipfile
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from pathlib import Path

SECRET = os.getenv("DATAHUB_SECRET", "")
STORAGE = Path(os.getenv("DATAHUB_STORAGE", "./storage"))
TOKEN_TTL_SECONDS = int(os.getenv("DATAHUB_TOKEN_TTL_SECONDS", "28800"))
_PBKDF2_ITERATIONS = 390_000


def utcnow():
    return datetime.now(timezone.utc)


def hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), _PBKDF2_ITERATIONS)
    return f"pbkdf2_sha256${_PBKDF2_ITERATIONS}${salt}${digest.hex()}"


def _legacy_hash(password: str) -> str:
    return hashlib.sha256(("datahub-static-salt" + password).encode()).hexdigest()


def verify_password(password: str, password_hash: str) -> bool:
    try:
        algorithm, iterations, salt, expected = password_hash.split("$", 3)
        if algorithm != "pbkdf2_sha256":
            return False
        digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), int(iterations))
        return hmac.compare_digest(digest.hex(), expected)
    except Exception:
        # Backward compatibility for databases created by the local prototype.
        return hmac.compare_digest(password_hash, _legacy_hash(password))


def needs_rehash(password_hash: str) -> bool:
    return not password_hash.startswith("pbkdf2_sha256$")


def _mac(payload: bytes) -> str:
    return hmac.new(SECRET.encode(), payload, hashlib.sha256).hexdigest()


def sign(username: str, ttl_seconds: int | None = None) -> str:
    issued = int(time.time())
    expires = issued + int(ttl_seconds or TOKEN_TTL_SECONDS)
    payload = f"{username}|{issued}|{expires}"
    return base64.urlsafe_b64encode(f"{payload}|{_mac(payload.encode())}".encode()).decode()


def verify_token(token: str) -> str | None:
    try:
        raw = base64.urlsafe_b64decode(token.encode()).decode()
        username, issued, expires, signature = raw.split("|", 3)
        payload = f"{username}|{issued}|{expires}"
        if not hmac.compare_digest(signature, _mac(payload.encode())):
            return None
        if int(expires) < int(time.time()):
            return None
        return username
    except Exception:
        return None


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def sha256_text(text: str) -> str:
    return sha256_bytes(text.encode())


def safe_name(name: str) -> str:
    value = re.sub(r"[^\w.\-一-龥]+", "_", name).strip("_")
    return value[:180] or "file"


def ensure_dirs():
    for folder in ["01_raw", "02_staging", "03_curated", "04_index_input", "05_agent_output", "90_archive"]:
        (STORAGE / folder).mkdir(parents=True, exist_ok=True)


def normalize_text(text: str) -> str:
    return re.sub(r"\r\n?", "\n", text or "").strip()


def csv_to_markdown(text: str) -> str:
    rows = list(csv.reader(io.StringIO(text.strip())))
    if not rows:
        return ""
    head = [value.strip() for value in rows[0]]
    lines = ["| " + " | ".join(head) + " |", "| " + " | ".join(["---"] * len(head)) + " |"]
    for row in rows[1:]:
        lines.append("| " + " | ".join([(value or "").strip() for value in row]) + " |")
    return "\n".join(lines)


def docx_to_text(path: Path) -> str:
    with zipfile.ZipFile(path) as archive:
        xml = archive.read("word/document.xml")
    root = ET.fromstring(xml)
    ns = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}
    lines = []
    for paragraph in root.findall(".//w:p", ns):
        values = [node.text or "" for node in paragraph.findall(".//w:t", ns)]
        if values:
            lines.append("".join(values))
    return "\n\n".join(lines)


def parse_file(path: Path, content_type: str = "") -> tuple[str, str]:
    ext = path.suffix.lower()
    if ext in [".md", ".markdown", ".txt"]:
        text = normalize_text(path.read_text(errors="ignore"))
        return text, text
    if ext == ".csv":
        raw = path.read_text(errors="ignore")
        return raw, csv_to_markdown(raw)
    if ext == ".pdf":
        try:
            from pypdf import PdfReader
            reader = PdfReader(str(path))
            text = "\n\n".join((page.extract_text() or "") for page in reader.pages)
            return normalize_text(text), normalize_text(text)
        except Exception as exc:
            raise ValueError(f"PDF 解析失败: {exc}")
    if ext == ".docx":
        try:
            return docx_to_text(path), normalize_text(docx_to_text(path))
        except Exception as exc:
            raise ValueError(f"DOCX 解析失败: {exc}")
    if ext in [".xlsx", ".xlsm"]:
        try:
            from openpyxl import load_workbook
            workbook = load_workbook(path, read_only=True, data_only=True)
            blocks = []
            for sheet in workbook.worksheets:
                rows = list(sheet.iter_rows(values_only=True))
                if not rows:
                    continue
                head = [str(value or "") for value in rows[0]]
                lines = [f"## {sheet.title}", "| " + " | ".join(head) + " |", "| " + " | ".join(["---"] * len(head)) + " |"]
                for row in rows[1:200]:
                    lines.append("| " + " | ".join([str(value or "") for value in row]) + " |")
                blocks.append("\n".join(lines))
            text = "\n\n".join(blocks)
            return text, text
        except Exception as exc:
            raise ValueError(f"XLSX 解析失败: {exc}")
    raise ValueError(f"暂不支持该文件类型：{ext or content_type or 'unknown'}")


def chunk_text(text: str, max_chars: int = 1200) -> list[str]:
    text = normalize_text(text)
    if not text:
        return []
    paragraphs = [value.strip() for value in re.split(r"\n\s*\n", text) if value.strip()]
    chunks = []
    buffer = ""
    for paragraph in paragraphs:
        if len(buffer) + len(paragraph) + 2 <= max_chars:
            buffer = f"{buffer}\n\n{paragraph}".strip()
            continue
        if buffer:
            chunks.append(buffer)
        if len(paragraph) <= max_chars:
            buffer = paragraph
            continue
        chunks.extend(paragraph[index:index + max_chars] for index in range(0, len(paragraph), max_chars))
        buffer = ""
    if buffer:
        chunks.append(buffer)
    return chunks


def score_text(text: str, tokens: list[str]) -> int:
    lowered = (text or "").lower()
    return sum(lowered.count(token.lower()) for token in tokens if token)


def tokens_for_query(query: str) -> list[str]:
    base = re.findall(r"[\w\u4e00-\u9fff]+", query.lower())
    output = []
    for token in base:
        output.append(token)
        if len(token) > 2:
            output.extend(token[index:index + 2] for index in range(len(token) - 1))
            output.extend(token[index:index + 3] for index in range(len(token) - 2))
    return list(dict.fromkeys(value for value in output if value))
