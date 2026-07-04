"""FastAPI 应用入口。

- 注册路由（/health，后续 /api/... 在各 router 内加 prefix）
- 挂载 /uploads 静态目录
- 启动时建表
- 开发期 CORS
"""
from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app import config
from app.database import init_db
from app.routers import clothes, favorites, health, outfits, recommendations


@asynccontextmanager
async def lifespan(app: FastAPI):
    # 启动：确保运行时目录存在并建表
    config.ensure_runtime_dirs()
    init_db()
    yield


app = FastAPI(title="AI Closet Stylist API", lifespan=lifespan)

# CORS：开发期放行前端来源
app.add_middleware(
    CORSMiddleware,
    allow_origins=config.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 路由
app.include_router(health.router)
app.include_router(clothes.router)
app.include_router(recommendations.router)
app.include_router(outfits.router)
app.include_router(favorites.router)

# 静态文件：/uploads/... -> backend/uploads/...
app.mount(
    "/uploads",
    StaticFiles(directory=str(config.UPLOAD_DIR)),
    name="uploads",
)
