"""Phase 5 测试公共 fixtures。

隔离策略：
- 数据库：会话级 in-memory SQLite + StaticPool，通过 app.dependency_overrides[get_db]
  注入每测试一个 session，不改生产代码。
- 上传文件：monkeypatch config.UPLOAD_DIR 到 pytest tmp_path，并建好三个子目录。
  storage_service / image_service 均在调用时动态读 config.UPLOAD_DIR，故无需改源码。
- 样图：用 Pillow 即时生成 3 张 64×64 纯色 PNG，不落盘、不提交二进制文件。
- AI 识图：上传路径需 AI_TAGGING_ENABLED=true；upload_item fixture 默认 monkeypatch
  ai_tagging_service.tag_with_ai 返回一套合法全标签，不发真实网络请求。
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
from app.services import ai_tagging_service, tagging_service

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


def default_ai_tags(category: str) -> dict:
    """返回某品类一套合法全标签（用于 stub ai_tagging_service.tag_with_ai）。"""
    subtype = {"top": "T恤", "bottom": "牛仔裤", "shoes": "运动鞋"}[category]
    tags: dict = {
        "category": category,
        "subtype": subtype,
        "color_base": "白色",
        "color_tone": "浅色系",
        "pattern": "纯色",
        "style": "休闲",
        "fit": "常规",
        "season": "春秋",
        "formality": "日常",
        "material": "棉",
    }
    if category == "top":
        tags.update(sleeve_length="短袖", top_length="常规", neckline="圆领")
    elif category == "bottom":
        tags.update(pants_length="长裤", waist="中腰", pants_shape="直筒")
    elif category == "shoes":
        tags.update(shoe_cut="低帮", shoe_type="运动鞋", sole="运动缓震", closure="系带")
    return tags


@pytest.fixture
def upload_item(client, sample_images, monkeypatch):
    """封装 POST /api/clothes/upload，返回响应对象。

    上传纯 AI 打标签：fixture 默认 stub ai_tagging_service.tag_with_ai 返回
    default_ai_tags(category)；用 ai_tags=... 可覆盖。上传只发 file，不再有表单字段。

    用法：
        upload_item("top")
        upload_item("top", ai_tags={"category":"top","color_base":"黑色","style":"通勤"})
    """
    monkeypatch.setattr(config, "AI_TAGGING_ENABLED", True)

    def _upload(category, *, ai_tags=None, filename=None):
        raw = ai_tags if ai_tags is not None else default_ai_tags(category)
        # stub 直接返回归一化后的 TagOutput（router 会再过一次 generate_tags，幂等）
        expected = tagging_service.generate_tags(**raw)
        monkeypatch.setattr(
            ai_tagging_service,
            "tag_with_ai",
            lambda image_bytes, content_type="image/jpeg": expected,
        )
        fname, data, ctype = sample_images[category]
        files = {"file": (filename or fname, data, ctype)}
        return client.post("/api/clothes/upload", files=files)

    return _upload
