"""单品上传 / 搜索 / 详情 / 删除测试。FRD v4 / API-002、API-003 + 详情删除。

覆盖：
- 上传成功（三类）+ 字段契约 + UUID 文件名
- 上传失败：错误扩展名 / MIME 不匹配 / 超过大小上限
- 上传 AI 关闭 → 503 ai_tagging_disabled
- 搜索：q / category / 新标签字段过滤，列表瘦身形态
- 详情：200 / 404
- 删除：204 空体 / 物理文件清理 / 404
"""
from __future__ import annotations

import io
from pathlib import Path

import pytest

from app import config


# ---------------- 上传成功 ----------------

@pytest.mark.parametrize("category", ["top", "bottom", "shoes"])
def test_upload_success(client, upload_item, upload_dir, category):
    r = upload_item(category)
    assert r.status_code == 201, r.text
    body = r.json()
    # 核心字段齐全
    assert {"id", "name", "category", "original_image", "processed_image", "created_at"} <= set(body)
    assert body["category"] == category
    # 默认 AI 标签注入
    assert body["color_base"] == "白色"
    assert body["style"] == "休闲"
    assert body["tagging_status"] == "ai"
    # URL 以 /uploads/ 开头
    assert body["original_image"].startswith("/uploads/original/")
    assert body["processed_image"].startswith("/uploads/processed/")
    orig_name = body["original_image"].rsplit("/", 1)[-1]
    proc_name = body["processed_image"].rsplit("/", 1)[-1]
    assert orig_name != "top.png"            # UUID，非用户原名
    assert orig_name.endswith(".png")        # 样图是 PNG
    assert Path(orig_name).stem == Path(proc_name).stem
    assert (upload_dir / "processed" / proc_name).exists()


def test_upload_default_category_top(client, monkeypatch, sample_images):
    """AI 返回非法 category 时，降级 category=top、其余 unknown，仍 201。"""
    monkeypatch.setattr(config, "AI_TAGGING_ENABLED", True)
    from app.services import ai_tagging_service
    # AI 返回一个 category 不合法的对象 → ai_tagging 抛 AIInvalidResponseError → 降级
    monkeypatch.setattr(
        ai_tagging_service, "tag_with_ai",
        lambda image_bytes, content_type="image/jpeg": (_ for _ in ()).throw(
            ai_tagging_service.AIInvalidResponseError("bad")
        ),
    )
    fname, data, ctype = sample_images["top"]
    files = {"file": (fname, data, ctype)}
    r = client.post("/api/clothes/upload", files=files)
    assert r.status_code == 201
    body = r.json()
    assert body["category"] == "top"
    assert body["color_base"] == "unknown"
    assert body["style"] == "unknown"
    assert body["tagging_status"] == "ai_failed"


def test_upload_ai_disabled_rejected(client, sample_images, monkeypatch):
    """AI_TAGGING_ENABLED=false → 503 ai_tagging_disabled。"""
    monkeypatch.setattr(config, "AI_TAGGING_ENABLED", False)
    fname, data, ctype = sample_images["top"]
    files = {"file": (fname, data, ctype)}
    r = client.post("/api/clothes/upload", files=files)
    assert r.status_code == 503
    assert r.json()["error"] == "ai_tagging_disabled"


# ---------------- 上传失败 ----------------

def test_upload_bad_extension(client, sample_images, monkeypatch):
    """扩展名不在白名单 → 400。"""
    monkeypatch.setattr(config, "AI_TAGGING_ENABLED", True)
    _, data, ctype = sample_images["top"]
    files = {"file": ("evil.gif", data, "image/png")}
    r = client.post("/api/clothes/upload", files=files)
    assert r.status_code == 400


def test_upload_bad_mime(client, sample_images, monkeypatch):
    """扩展名合法但 MIME 不匹配 → 400。"""
    monkeypatch.setattr(config, "AI_TAGGING_ENABLED", True)
    fname, data, _ = sample_images["top"]
    files = {"file": (fname, data, "image/gif")}
    r = client.post("/api/clothes/upload", files=files)
    assert r.status_code == 400


def test_upload_too_large(client, upload_item, monkeypatch):
    """超过大小上限 → 400。动态调小上限避免真造 8MB。"""
    monkeypatch.setattr(config, "MAX_UPLOAD_BYTES", 10)
    r = upload_item("top")
    assert r.status_code == 400


# ---------------- 搜索 ----------------

def test_list_filters_and_shape(client, upload_item):
    """上传若干后，验证 q / category / 新标签字段过滤 + 列表瘦身形态。"""
    a = upload_item("top", ai_tags={
        "category": "top", "subtype": "T恤", "color_base": "白色",
        "color_tone": "浅色系", "pattern": "纯色", "style": "休闲",
        "fit": "常规", "season": "春秋", "formality": "日常", "material": "棉",
        "sleeve_length": "短袖", "top_length": "常规", "neckline": "圆领",
    }, filename="a_top.png").json()
    b = upload_item("bottom", ai_tags={
        "category": "bottom", "color_base": "黑色", "style": "通勤",
    }, filename="a_bottom.png").json()
    c = upload_item("shoes", ai_tags={
        "category": "shoes", "color_base": "蓝色", "style": "休闲",
    }, filename="a_shoes.png").json()

    # 列表项是瘦身形态：不含 original_image / created_at / material / 专属字段
    items = client.get("/api/clothes").json()
    assert len(items) == 3
    assert "original_image" not in items[0]
    assert "created_at" not in items[0]
    assert "material" not in items[0]
    assert "sleeve_length" not in items[0]
    assert set(items[0]) == {
        "id", "name", "category", "subtype", "color_base", "color_tone",
        "pattern", "style", "fit", "season", "formality", "processed_image",
    }

    ids = {it["id"] for it in items}
    assert ids == {a["id"], b["id"], c["id"]}

    # category 过滤
    top = client.get("/api/clothes", params={"category": "top"}).json()
    assert {it["id"] for it in top} == {a["id"]}

    # color_base 过滤
    white = client.get("/api/clothes", params={"color_base": "白色"}).json()
    assert {it["id"] for it in white} == {a["id"]}

    # style 过滤（休闲 同时命中 top 与 shoes）
    casual = client.get("/api/clothes", params={"style": "休闲"}).json()
    assert {it["id"] for it in casual} == {a["id"], c["id"]}

    # formality 过滤
    daily = client.get("/api/clothes", params={"formality": "日常"}).json()
    assert {it["id"] for it in daily} == {a["id"]}

    # q 命中 color_base
    black = client.get("/api/clothes", params={"q": "黑色"}).json()
    assert {it["id"] for it in black} == {b["id"]}

    # q 命中 name（a 的 name 由 color_base + subtype 拼成 "白色T恤"）
    by_name = client.get("/api/clothes", params={"q": "白色T恤"}).json()
    assert {it["id"] for it in by_name} == {a["id"]}

    # 组合过滤
    combo = client.get(
        "/api/clothes", params={"category": "shoes", "style": "休闲"}
    ).json()
    assert {it["id"] for it in combo} == {c["id"]}

    # 无匹配
    empty = client.get(
        "/api/clothes", params={"category": "top", "color_base": "蓝色"}
    ).json()
    assert empty == []


# ---------------- 详情 / 删除 ----------------

def test_get_detail_ok_and_404(client, upload_item):
    item = upload_item("top").json()
    r = client.get(f"/api/clothes/{item['id']}")
    assert r.status_code == 200
    body = r.json()
    assert body["id"] == item["id"]
    assert "original_image" in body
    assert "created_at" in body
    assert "material" in body       # 详情含全字段
    assert "sleeve_length" in body

    r404 = client.get("/api/clothes/99999")
    assert r404.status_code == 404


def test_delete_cleanup_and_404(client, upload_item, upload_dir):
    """DELETE 返回 204 空体，物理文件被清理，再 GET/DELETE → 404。"""
    item = upload_item("top").json()
    orig_name = item["original_image"].rsplit("/", 1)[-1]
    proc_name = item["processed_image"].rsplit("/", 1)[-1]

    assert (upload_dir / "original" / orig_name).exists()
    assert (upload_dir / "processed" / proc_name).exists()

    r = client.delete(f"/api/clothes/{item['id']}")
    assert r.status_code == 204
    assert r.content == b""

    assert not (upload_dir / "original" / orig_name).exists()
    assert not (upload_dir / "processed" / proc_name).exists()

    assert client.get(f"/api/clothes/{item['id']}").status_code == 404
    assert client.delete(f"/api/clothes/{item['id']}").status_code == 404
