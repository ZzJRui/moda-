"""上传文件存储服务。

- 生成 UUID 文件名，杜绝路径穿越（用户原始文件名不进路径）
- 校验扩展名、MIME、大小（FRD-UP-002 / FRD-NF-003）
- 落盘到 uploads/original，返回相对 URL 路径
"""
from __future__ import annotations

import uuid
from pathlib import Path

from fastapi import UploadFile

from app import config

# 允许的 MIME（与 ALLOWED_IMAGE_EXTS 对齐）
ALLOWED_MIMES: tuple[str, ...] = ("image/jpeg", "image/png", "image/webp")

# 扩展名归一化：jpeg 统一为 jpg
_EXT_NORMALIZE: dict[str, str] = {
    "jpg": "jpg",
    "jpeg": "jpg",
    "png": "png",
    "webp": "webp",
}


class InvalidUploadError(ValueError):
    """上传文件不合法（扩展名 / MIME / 大小）。"""


def validate_extension(filename: str) -> str:
    """校验扩展名并返回规范化小写扩展名（不含点）。

    - 接受 jpg/jpeg/png/webp，jpeg 归一为 jpg
    - 非法或缺失抛 InvalidUploadError
    """
    if "." not in filename:
        raise InvalidUploadError("文件缺少扩展名")
    ext = filename.rsplit(".", 1)[-1].lower().strip()
    if ext not in _EXT_NORMALIZE:
        raise InvalidUploadError(f"不支持的图片格式：{ext}")
    return _EXT_NORMALIZE[ext]


def validate_mime(upload_file: UploadFile) -> None:
    """校验 content_type ∈ ALLOWED_MIMES。

    - content_type 为空或非法 → InvalidUploadError
    - Phase 2 不做 Pillow 嗅探，预留扩展点
    """
    raw = upload_file.content_type or ""
    ct = raw.split(";")[0].strip().lower()
    if ct not in ALLOWED_MIMES:
        raise InvalidUploadError(f"不支持的图片 MIME：{raw or '空'}")


def validate_size(file_size: int) -> None:
    """校验字节数 ≤ MAX_UPLOAD_BYTES（FRD-UP-002）。"""
    if file_size <= 0:
        raise InvalidUploadError("文件为空")
    if file_size > config.MAX_UPLOAD_BYTES:
        raise InvalidUploadError(
            f"文件过大：{file_size} 字节，上限 {config.MAX_UPLOAD_BYTES} 字节"
        )


def generate_filename(ext: str) -> str:
    """返回 f"{uuid4_hex}.{ext}"，ext 已规范化。"""
    return f"{uuid.uuid4().hex}.{ext}"


def original_fs_path(filename: str) -> Path:
    return config.UPLOAD_DIR / "original" / filename


def processed_fs_path(filename: str) -> Path:
    return config.UPLOAD_DIR / "processed" / filename


def original_url_for(filename: str) -> str:
    return f"/uploads/original/{filename}"


def processed_url_for(filename: str) -> str:
    return f"/uploads/processed/{filename}"


def save_original(upload_file: UploadFile, filename: str) -> str:
    """读取 upload_file 内容并落盘到 uploads/original/<filename>。

    - 分块写入，避免大文件一次性占内存
    - 返回相对 URL 路径 /uploads/original/<filename>
    - 调用方需先通过 validate_* 校验
    """
    dst = original_fs_path(filename)
    with open(dst, "wb") as out:
        while True:
            chunk = upload_file.file.read(1 << 20)  # 1 MiB
            if not chunk:
                break
            out.write(chunk)
    return original_url_for(filename)


def favorites_fs_path(filename: str) -> Path:
    return config.UPLOAD_DIR / "favorites" / filename


def favorites_url_for(filename: str) -> str:
    return f"/uploads/favorites/{filename}"


def save_favorite(upload_file: UploadFile, filename: str) -> str:
    """读取 upload_file 内容并落盘到 uploads/favorites/<filename>。

    - 分块写入，与 save_original 一致
    - 返回相对 URL 路径 /uploads/favorites/<filename>
    - 调用方需先通过 validate_* 校验
    """
    dst = favorites_fs_path(filename)
    with open(dst, "wb") as out:
        while True:
            chunk = upload_file.file.read(1 << 20)  # 1 MiB
            if not chunk:
                break
            out.write(chunk)
    return favorites_url_for(filename)


def delete_files(*filenames: str) -> None:
    """删除 original 与 processed 目录下同名文件（如果存在）。best-effort。"""
    for name in filenames:
        for fs_path in (original_fs_path(name), processed_fs_path(name)):
            try:
                fs_path.unlink(missing_ok=True)
            except OSError:
                # best-effort：清理失败不影响主流程
                pass


def delete_favorite_files(*filenames: str) -> None:
    """删除 favorites 目录下指定文件（如果存在）。best-effort。"""
    for name in filenames:
        try:
            favorites_fs_path(name).unlink(missing_ok=True)
        except OSError:
            # best-effort：清理失败不影响主流程
            pass
