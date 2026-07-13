"""应用配置：路径常量与可调参数。

所有运行时目录在 import 时即创建，确保服务启动即可用。
"""
from __future__ import annotations

import os
from pathlib import Path

# 从 backend/.env 加载本地环境变量（如 AI_API_KEY 等）。
# 已存在的真实进程 ENV 优先；.env 仅补缺。无 .env 文件时静默跳过。
from dotenv import load_dotenv

_BASE_DIR = Path(__file__).resolve().parent.parent
_env_path = _BASE_DIR / ".env"
if _env_path.exists():
    load_dotenv(_env_path)

# backend/
BASE_DIR: Path = _BASE_DIR

# 静态上传目录
UPLOAD_DIR: Path = BASE_DIR / "uploads"
UPLOAD_SUBDIRS = ("original", "processed", "favorites")

# SQLite 数据目录与连接串
DATA_DIR: Path = BASE_DIR / "app" / "data"
DB_PATH: Path = DATA_DIR / "closet.db"
DB_URL: str = f"sqlite:///{DB_PATH.as_posix()}"

# 开发期允许的前端来源，可用环境变量 CORS_ORIGINS（逗号分隔）扩展
_default_origins = (
    "http://localhost:5173,http://127.0.0.1:5173,"
    "http://localhost:5174,http://127.0.0.1:5174"
)
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

# --- AI 推荐（OpenAI-compatible /chat/completions，FRD-NF-004 可替换 AI）---
# provider: openai_compatible（默认，调真实模型）/ rule（本地规则，调试/离线用）
# 默认走真实 AI；AI 调用失败时返回明确错误，不静默回退规则。
AI_RECOMMENDATION_PROVIDER: str = os.getenv(
    "AI_RECOMMENDATION_PROVIDER", "openai_compatible"
).lower()
# AI_* 优先于 OPENAI_*（兼容旧名）
AI_API_BASE_URL: str | None = os.getenv("AI_API_BASE_URL") or os.getenv("OPENAI_BASE_URL")
AI_API_KEY: str | None = os.getenv("AI_API_KEY") or os.getenv("OPENAI_API_KEY")
AI_MODEL: str | None = os.getenv("AI_MODEL") or os.getenv("OPENAI_MODEL")
AI_TIMEOUT_SECONDS: float = float(os.getenv("AI_TIMEOUT_SECONDS", "60"))

# --- AI 识图打标签（复用 AI_* 凭据，独立开关）---
# True：上传时若用户未填全 category/color/style，自动调模型识图补缺；
# AI 失败时降级到规则，不阻断上传。False：完全走用户输入 + 规则归一化。
AI_TAGGING_ENABLED: bool = os.getenv("AI_TAGGING_ENABLED", "true").lower() == "true"


def ensure_runtime_dirs() -> None:
    """创建数据库目录与上传子目录。幂等。"""
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    for sub in UPLOAD_SUBDIRS:
        (UPLOAD_DIR / sub).mkdir(parents=True, exist_ok=True)


# import 时立即建目录，保证 uvicorn 启动即可用
ensure_runtime_dirs()
