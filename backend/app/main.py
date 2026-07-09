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

# 前端 SPA：把 frontend/dist 挂到根路径，供 cpolar 单隧道对外用。
# 未构建（dist 不存在）时静默跳过，本地开发仍可用 vite dev 5173。
from pathlib import Path as _P
from fastapi.responses import FileResponse as _FileResponse
from starlette.exceptions import HTTPException as _StarletteHTTPException

_FRONTEND_DIST = _P(config.BASE_DIR).parent / "frontend" / "dist"
if _FRONTEND_DIST.exists():
    app.mount(
        "/assets",
        StaticFiles(directory=str(_FRONTEND_DIST / "assets")),
        name="frontend-assets",
    )

    _INDEX_HTML = _FRONTEND_DIST / "index.html"

    @app.get("/", include_in_schema=False)
    async def _spa_root():  # noqa: D401
        return _FileResponse(_INDEX_HTML)

    # SPA 深链兜底：非 /api、/uploads、/health、/docs、/openapi.json 的 GET 请求，
    # 先尝试从 dist/ 静态文件命中（logo.png / favicon.svg / images/... 等），
    # 命不中再返回 index.html，让 react-router 接管前端路由。
    @app.exception_handler(404)
    async def _spa_fallback(request, exc):  # noqa: D401
        path = request.url.path
        if request.method == "GET" and not path.startswith(
            ("/api", "/uploads", "/health", "/docs", "/openapi", "/redoc")
        ):
            candidate = (_FRONTEND_DIST / path.lstrip("/")).resolve()
            try:
                candidate.relative_to(_FRONTEND_DIST.resolve())
            except ValueError:
                candidate = None  # 路径穿越，拒绝
            if candidate and candidate.is_file():
                return _FileResponse(candidate)
            return _FileResponse(_INDEX_HTML)
        # 保留 FastAPI 默认 JSON 404
        from fastapi.responses import JSONResponse as _JSONResponse
        detail = exc.detail if isinstance(exc, _StarletteHTTPException) else "Not Found"
        return _JSONResponse({"detail": detail}, status_code=404)
