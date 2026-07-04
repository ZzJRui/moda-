"""图片处理服务（Phase 2.2）。

两步流水线：
1. rembg 抠图 → 透明 PNG（保留为中间产物，便于将来换背景色）
2. Pillow 在透明图后合成纯白背景 → 白底 jpg（processed_image 返回它）

设计要点：
- process_image 调用签名不变（router 不感知内部实现），前端接口契约零改动。
- 任一步失败 → 回退到「原图拷贝」（等价 Phase 2 行为），上传永不因处理失败而失败。
- IMAGE_PROCESSING_ENABLED=False → 直接回退，避免 CI/离线环境下载模型。

产物落 uploads/processed/（均用原图 stem）：
- <stem>.png  透明背景（中间产物）
- <stem>.jpg  白底（processed_image 返回它）
失败回退时产物为 <stem>.<原扩展>（原图拷贝）。
"""
from __future__ import annotations

import logging
from pathlib import Path
from shutil import copyfile

from PIL import Image

from app import config
from app.services import storage_service

logger = logging.getLogger(__name__)


def _stem(filename: str) -> str:
    """取文件名（不含扩展名）部分。"""
    return Path(filename).stem


def process_image(original_filename: str) -> str:
    """两步流水线：rembg 抠透明 PNG → Pillow 合成白底 jpg。

    返回 processed_image 的相对 URL 路径。
    - IMAGE_PROCESSING_ENABLED=False → 回退原图拷贝
    - 抠图/白底任一步抛异常 → 回退原图拷贝，记 warning，不冒泡
    """
    if not config.IMAGE_PROCESSING_ENABLED:
        return _fallback_copy(original_filename)
    try:
        transparent = _remove_background(original_filename)      # → <stem>.png
        white_bg = _apply_white_background(transparent)           # → <stem>.jpg
        return storage_service.processed_url_for(white_bg)
    except BaseException as e:  # noqa: BLE001  回退需兜住 rembg 缺 onnxruntime 时的 SystemExit(1) 及任何处理异常
        # SystemExit 在 rembg 检测不到 onnxruntime 时会被抛出；不能让它杀掉进程，
        # 一律回退到原图拷贝，保证上传永不因图片处理失败而失败。
        if isinstance(e, (KeyboardInterrupt, GeneratorExit)):
            raise
        logger.warning("图片处理失败，回退原图拷贝: %s", e)
        return _fallback_copy(original_filename)


def _remove_background(original_filename: str) -> str:
    """rembg 抠图：读原图 → 透明 PNG 字节 → 落 processed/<stem>.png。

    返回透明 PNG 的文件名。首次调用会触发 u2net 模型下载到 ~/.rembg/。
    """
    # 延迟 import：避免模块加载即拉 onnxruntime，也让 IMAGE_PROCESSING_ENABLED=False
    # 的环境完全不需要 rembg。
    from rembg import remove

    src = storage_service.original_fs_path(original_filename)
    with open(src, "rb") as f:
        data = f.read()
    out_bytes = remove(data)

    png_name = f"{_stem(original_filename)}.png"
    dst = storage_service.processed_fs_path(png_name)
    with open(dst, "wb") as f:
        f.write(out_bytes)
    return png_name


def _apply_white_background(transparent_png: str) -> str:
    """Pillow 合成白底：透明 PNG → 纯白 RGB 画布 alpha_composite → jpg。

    - 按 PROCESSED_MAX_SIDE 等比缩放，控制产物体积
    - 输出 RGB jpg，质量 PROCESSED_JPEG_QUALITY
    返回白底 jpg 的文件名（<stem>.jpg）。
    """
    png_path = storage_service.processed_fs_path(transparent_png)
    with Image.open(png_path) as im:
        rgba = im.convert("RGBA")
        rgba = _resize_to_max_side(rgba, config.PROCESSED_MAX_SIDE)

        # 纯白画布同尺寸，alpha_composite 贴透明图
        white = Image.new("RGB", rgba.size, (255, 255, 255))
        white.paste(rgba, mask=rgba.split()[-1])  # 用 alpha 通道作蒙版贴上去

        jpg_name = f"{_stem(transparent_png)}.jpg"
        jpg_path = storage_service.processed_fs_path(jpg_name)
        white.save(jpg_path, format="JPEG", quality=config.PROCESSED_JPEG_QUALITY)
        return jpg_name


def _resize_to_max_side(im: Image.Image, max_side: int) -> Image.Image:
    """等比缩放使最长边 ≤ max_side；已小于则原样返回。"""
    w, h = im.size
    longest = max(w, h)
    if longest <= max_side:
        return im
    ratio = max_side / longest
    new_size = (max(1, int(w * ratio)), max(1, int(h * ratio)))
    return im.resize(new_size, Image.LANCZOS)


def _fallback_copy(original_filename: str) -> str:
    """回退：把原图拷贝为 processed/<原名>，返回 URL（等价 Phase 2 行为）。"""
    src = storage_service.original_fs_path(original_filename)
    dst = storage_service.processed_fs_path(original_filename)
    copyfile(src, dst)
    return storage_service.processed_url_for(original_filename)
