"""应用配置：路径常量与可调参数。

所有运行时目录在 import 时即创建，确保服务启动即可用。
"""
from __future__ import annotations

import os
from pathlib import Path

# backend/
BASE_DIR: Path = Path(__file__).resolve().parent.parent

# 静态上传目录
UPLOAD_DIR: Path = BASE_DIR / "uploads"
UPLOAD_SUBDIRS = ("original", "processed", "favorites")

# SQLite 数据目录与连接串
DATA_DIR: Path = BASE_DIR / "app" / "data"
DB_PATH: Path = DATA_DIR / "closet.db"
DB_URL: str = f"sqlite:///{DB_PATH.as_posix()}"

# 开发期允许的前端来源，可用环境变量 CORS_ORIGINS（逗号分隔）扩展
_default_origins = "http://localhost:5173,http://127.0.0.1:5173"
CORS_ORIGINS: list[str] = [
    o.strip() for o in os.getenv("CORS_ORIGINS", _default_origins).split(",") if o.strip()
]

# 单张上传图片大小上限（字节），8MB，与 FRD-UP-002 一致
MAX_UPLOAD_BYTES: int = 8 * 1024 * 1024

# 允许的图片扩展名与 MIME，FRD-UP-002
ALLOWED_IMAGE_EXTS: tuple[str, ...] = ("jpg", "jpeg", "png", "webp")

# 穿搭来源枚举，FRD-OF-002 / FRD §10.2
ALLOWED_SOURCES: tuple[str, ...] = ("ai", "manual")

# --- 图片处理（Phase 2.2：rembg 抠图 + Pillow 白底合成）---
# 总开关：False 时 process_image 退化为原图拷贝（Phase 2 行为）。
# 调试/CI/离线环境可设环境变量 IMAGE_PROCESSING_ENABLED=false 关掉，避免下模型。
IMAGE_PROCESSING_ENABLED: bool = os.getenv("IMAGE_PROCESSING_ENABLED", "true").lower() == "true"
# 白底输出 jpg 质量
PROCESSED_JPEG_QUALITY: int = 90
# 白底输出最长边上限（超出按比例缩放，控制 rembg 输入尺寸与产物体积）
PROCESSED_MAX_SIDE: int = 1200


def ensure_runtime_dirs() -> None:
    """创建数据库目录与上传子目录。幂等。"""
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    for sub in UPLOAD_SUBDIRS:
        (UPLOAD_DIR / sub).mkdir(parents=True, exist_ok=True)


# import 时立即建目录，保证 uvicorn 启动即可用
ensure_runtime_dirs()
