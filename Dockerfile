# ===== Stage 1: 构建前端 =====
FROM node:20-alpine AS frontend

WORKDIR /build
# 先拷依赖清单，利用 Docker 层缓存
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

# 再拷源码并构建，产物在 /build/dist
COPY frontend/ ./
RUN npm run build


# ===== Stage 2: 后端运行时 =====
FROM python:3.12-slim AS backend

# 避免交互式安装卡住，输出更干净
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

# 先装依赖（利用缓存：requirements.txt 不变则跳过）
COPY backend/requirements.txt /app/backend/requirements.txt
RUN pip install --no-cache-dir -r /app/backend/requirements.txt

# 拷贝后端代码
COPY backend/ /app/backend/

# 把前端构建产物放到 backend 期望的位置：<repo>/frontend/dist
# main.py 里 _FRONTEND_DIST = BASE_DIR.parent / "frontend" / "dist"
COPY --from=frontend /build/dist /app/frontend/dist

WORKDIR /app/backend

EXPOSE 8000

# 生产直接用 uvicorn 起单进程；并发上来后可改 gunicorn -k uvicorn.workers.UvicornWorker
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
