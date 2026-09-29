from __future__ import annotations

import csv
import hashlib
import hmac
import io
import os
import re
import xml.etree.ElementTree as ET
import zipfile
from pathlib import Path


SECRET = os.getenv("DATAHUB_SECRET", "datahub-dev-secret-change-me")


def utcnow_string() -> str:
    from datetime import datetime, timezone
    return datetime.now(timezone.utc).isoformat()


def hash_password(password: str, salt: str = "datahub-static-salt") -> str:
    return hashlib.sha256((salt + password).encode()).hexdigest()


def sign(username: str) -> str:
    import base64
    raw = f"{username}|{hashlib.sha256(SECRET.encode()+username.encode()).hexdigest()}"
    return base64.urlsafe_b64encode(raw.encode()).decode()


def verify_token(token: str) -> str | None:
    import base64
    try:
        raw = base64.urlsafe_b64decode(token.encode()).decode()
        username, signature = raw.split("|", 1)
        expected = hashlib.sha256(SECRET.encode()+username.encode()).hexdigest()
        return username if hmac.compare_digest(signature, expected) else None
    except Exception:
        return None


def sha256_text(data: str | bytes) -> str:
    raw = data.encode() if isinstance(data, str) else data
    return hashlib.sha256(raw).hexdigest()


def normalize_text(text: str) -> str:
    return re.sub(r"\r\n?", "\n", text or "").strip()


def csv_to_markdown(text: str) -> str:
    rows = list(csv.reader(io.StringIO(text.strip())))
    if not rows:
        return ""
    headers = [cell.strip() for cell in rows[0]]
    output = ["| " + " | ".join(headers) + " |", "| " + " | ".join(["---"] * len(headers)) + " |"]
    for row in rows[1:]:
        output.append("| " + " | ".join([(cell or "").strip() for cell in row]) + " |")
    return "\n".join(output)


def docx_to_text(path: Path) -> str:
    with zipfile.ZipFile(path) as archive:
        root = ET.fromstring(archive.read("word/document.xml"))
    namespace = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}
    lines = []
    for paragraph in root.findall(".//w:p", namespace):
        values = [node.text or "" for node in paragraph.findall(".//w:t", namespace)]
        if values:
            lines.append("".join(values))
    return "\n\n".join(lines)


def parse_file(path: Path, content_type: str = "") -> tuple[str, str]:
    suffix = path.suffix.lower()
    if suffix in {".md", ".markdown", ".txt"}:
        text = normalize_text(path.read_text(errors="ignore"))
        return text, text
    if suffix == ".csv":
        raw = path.read_text(errors="ignore")
        return raw, csv_to_markdown(raw)
    if suffix == ".pdf":
        try:
            from pypdf import PdfReader
            reader = PdfReader(str(path))
            return normalize_text("\n\n".join((page.extract_text() or "") for page in reader.pages)), ""
        except Exception as exc:
            raise ValueError(f"PDF 解析失败: {exc}") from exc
    if suffix == ".docx":
        try:
            text = normalize_text(docx_to_text(path))
            return text, text
        except Exception as exc:
            raise ValueError(f"DOCX 解析失败: {exc}") from exc
    if suffix in {".xlsx", ".xlsm"}:
        try:
            from openpyxl import load_workbook
            workbook = load_workbook(path, read_only=True, data_only=True)
            blocks = []
            for worksheet in workbook.worksheets:
                rows = list(worksheet.iter_rows(values_only=True))
                if not rows:
                    continue
                headers = [str(cell or "") for cell in rows[0]]
                lines = [f"## {worksheet.title}", "| " + " | ".join(headers) + " |", "| " + " | ".join(["---"] * len(headers)) + " |"]
                for row in rows[1:200]:
                    lines.append("| " + " | ".join([str(cell or "") for cell in row]) + " |")
                blocks.append("\n".join(lines))
            text = normalize_text("\n\n".join(blocks))
            return text, text
        except Exception as exc:
            raise ValueError(f"XLSX 解析失败: {exc}") from exc
    raise ValueError(f"暂不支持该文件类型：{suffix or content_type or 'unknown'}")


def chunk_text(text: str, max_chars: int = 1200) -> list[str]:
    text = normalize_text(text)
    if not text:
        return []
    paragraphs = [item.strip() for item in re.split(r"\n\s*\n", text) if item.strip()]
    chunks: list[str] = []
    buffer = ""
    for paragraph in paragraphs:
        if len(buffer) + len(paragraph) + 2 <= max_chars:
            buffer = f"{buffer}\n\n{paragraph}".strip()
            continue
        if buffer:
            chunks.append(buffer)
        if len(paragraph) <= max_chars:
            buffer = paragraph
        else:
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


def best_snippet(text: str, tokens: list[str]) -> str:
    paragraphs = [item for item in (text or "").split("\n\n") if item.strip()]
    if not paragraphs:
        return ""
    paragraphs.sort(key=lambda item: score_text(item, tokens), reverse=True)
    return re.sub(r"\s+", " ", paragraphs[0])[:500]
