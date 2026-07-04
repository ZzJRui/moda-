"""Phase 5 测试公共 fixtures。

隔离策略（详见 plan）：
- 数据库：会话级 in-memory SQLite + StaticPool，通过 app.dependency_overrides[get_db]
  注入每测试一个 session，不改生产代码。
- 上传文件：monkeypatch config.UPLOAD_DIR 到 pytest tmp_path，并建好三个子目录。
  storage_service / image_service 均在调用时动态读 config.UPLOAD_DIR，故无需改源码。
- 样图：用 Pillow 即时生成 3 张 64×64 纯色 PNG，不落盘、不提交二进制文件。
"""
from __future__ import annotations

import io

import pytest
from PIL import Image
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app import config
from app.database import Base, get_db
from app.main import app

# 确保模型注册到 Base.metadata（main 已间接 import，这里显式再保险）
from app import models  # noqa: F401


@pytest.fixture(scope="session")
def test_engine():
    """会话级 in-memory SQLite。

    StaticPool 让所有 session 共享同一内存连接，否则 in-memory 库每个连接独立。
    """
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    yield engine
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def db_session(test_engine):
    """每测试一个 session，开始前清空所有表数据（保留表结构）。"""
    Session = sessionmaker(bind=test_engine)
    session = Session()
    # 清空数据，顺序按依赖反序（本阶段无外键，sorted_tables 已给出安全顺序）
    for table in reversed(Base.metadata.sorted_tables):
        session.execute(table.delete())
    session.commit()
    yield session
    session.close()


@pytest.fixture
def upload_dir(tmp_path, monkeypatch):
    """把 config.UPLOAD_DIR 重定向到 tmp_path 并建好子目录，隔离文件 I/O。"""
    monkeypatch.setattr(config, "UPLOAD_DIR", tmp_path)
    for sub in config.UPLOAD_SUBDIRS:
        (tmp_path / sub).mkdir(parents=True, exist_ok=True)
    return tmp_path


@pytest.fixture
def client(db_session, upload_dir):
    """TestClient，get_db 注入测试 session。"""
    def _override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = _override_get_db
    from fastapi.testclient import TestClient

    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture(scope="session")
def sample_images():
    """用 Pillow 即时生成 3 张 64×64 纯色 PNG（top/bottom/shoes 各一张）。

    返回 {category: (filename, bytes, content_type)}，供 httpx multipart 上传。
    """
    palette = {
        "top": (255, 200, 200),
        "bottom": (200, 200, 255),
        "shoes": (200, 255, 200),
    }
    images: dict[str, tuple[str, bytes, str]] = {}
    for cat, rgb in palette.items():
        buf = io.BytesIO()
        Image.new("RGB", (64, 64), rgb).save(buf, format="PNG")
        images[cat] = (f"{cat}.png", buf.getvalue(), "image/png")
    return images


@pytest.fixture
def upload_item(client, sample_images):
    """封装 POST /api/clothes/upload，返回响应对象。

    用法：upload_item("top", color="白色", style="休闲")
    """

    def _upload(category, color=None, style=None, filename=None):
        fname, data, ctype = sample_images[category]
        files = {"file": (filename or fname, data, ctype)}
        form: dict[str, str] = {"category": category}
        if color is not None:
            form["color"] = color
        if style is not None:
            form["style"] = style
        return client.post("/api/clothes/upload", files=files, data=form)

    return _upload
