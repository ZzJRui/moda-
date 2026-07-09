# ===== Stage 1: 构建前端 =====
FROM node:20-alpine AS frontend

# 国内构建慢：换淘宝 npm 镜像源
RUN npm config set registry https://registry.npmmirror.com

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
# 国内构建慢：换清华 pypi 镜像源，且按 REMBG_ENABLED 决定是否装 rembg（onnxruntime 很大）
COPY backend/requirements.txt /app/backend/requirements.txt
ARG REMBG_ENABLED=false
RUN if [ "$REMBG_ENABLED" = "true" ]; then \
      sed -i 's/^# rembg\[cpu\]/rembg[cpu]/' /app/backend/requirements.txt; \
    fi && \
    pip install --no-cache-dir -i https://pypi.tuna.tsinghua.edu.cn/simple \
      -r /app/backend/requirements.txt

# 拷贝后端代码
COPY backend/ /app/backend/

# 把前端构建产物放到 backend 期望的位置：<repo>/frontend/dist
# main.py 里 _FRONTEND_DIST = BASE_DIR.parent / "frontend" / "dist"
COPY --from=frontend /build/dist /app/frontend/dist

WORKDIR /app/backend

EXPOSE 8000

# 生产直接用 uvicorn 起单进程；并发上来后可改 gunicorn -k uvicorn.workers.UvicornWorker
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
