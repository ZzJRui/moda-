"""单品上传 / 搜索 / 详情 / 删除测试。FRD-API-002、FRD-API-003 + 详情删除。

覆盖：
- 上传成功（三类）+ 字段契约 + UUID 文件名
- 上传失败：错误扩展名 / MIME 不匹配 / 超过大小上限
- 搜索：q / category / color / style 单独与组合，列表瘦身形态
- 详情：200 / 404
- 删除：204 空体 / 物理文件清理 / 404
"""
from __future__ import annotations

from pathlib import Path

import pytest

from app import config


# ---------------- 上传成功 ----------------

@pytest.mark.parametrize("category", ["top", "bottom", "shoes"])
def test_upload_success(client, upload_item, upload_dir, category):
    r = upload_item(category, color="白色", style="休闲")
    assert r.status_code == 201
    body = r.json()
    # 字段齐全
    assert set(body) >= {
        "id", "name", "category", "color", "style",
        "original_image", "processed_image", "created_at",
    }
    assert body["category"] == category
    assert body["color"] == "白色"
    assert body["style"] == "休闲"
    # URL 以 /uploads/ 开头
    assert body["original_image"].startswith("/uploads/original/")
    assert body["processed_image"].startswith("/uploads/processed/")
    orig_name = body["original_image"].rsplit("/", 1)[-1]
    proc_name = body["processed_image"].rsplit("/", 1)[-1]
    assert orig_name != "top.png"            # UUID，非用户原名
    assert orig_name.endswith(".png")        # 样图是 PNG
    # Phase 2.2：processed_image 是白底 jpg，与原图同 stem 不同扩展。
    # 处理失败回退时则为同名原图拷贝。两种情况下 stem 都应一致。
    assert Path(orig_name).stem == Path(proc_name).stem
    # processed 文件确实落盘（白底 jpg 或回退拷贝）
    assert (upload_dir / "processed" / proc_name).exists()


def test_upload_default_category(client):
    """不传 category 时归一化为默认 top（tagging_service）。"""
    import io
    from PIL import Image
    buf = io.BytesIO()
    Image.new("RGB", (8, 8), (1, 2, 3)).save(buf, format="PNG")
    files = {"file": ("x.png", buf.getvalue(), "image/png")}
    r = client.post("/api/clothes/upload", files=files, data={})
    assert r.status_code == 201
    assert r.json()["category"] == "top"


# ---------------- 上传失败 ----------------

def test_upload_bad_extension(client, sample_images):
    """扩展名不在白名单 → 400。"""
    _, data, ctype = sample_images["top"]
    files = {"file": ("evil.gif", data, "image/png")}
    r = client.post("/api/clothes/upload", files=files, data={"category": "top"})
    assert r.status_code == 400


def test_upload_bad_mime(client, sample_images):
    """扩展名合法但 MIME 不匹配 → 400。"""
    fname, data, _ = sample_images["top"]
    files = {"file": (fname, data, "image/gif")}
    r = client.post("/api/clothes/upload", files=files, data={"category": "top"})
    assert r.status_code == 400


def test_upload_too_large(client, upload_item, monkeypatch):
    """超过大小上限 → 400。动态调小上限避免真造 8MB。"""
    monkeypatch.setattr(config, "MAX_UPLOAD_BYTES", 10)
    r = upload_item("top")
    assert r.status_code == 400


# ---------------- 搜索 ----------------

def test_list_filters_and_shape(client, upload_item):
    """上传若干后，验证 q / category / color / style 过滤 + 列表瘦身形态。"""
    a = upload_item("top", color="白色", style="休闲", filename="a_top.png").json()
    b = upload_item("bottom", color="黑色", style="通勤", filename="a_bottom.png").json()
    c = upload_item("shoes", color="蓝色", style="休闲", filename="a_shoes.png").json()

    # 列表项是瘦身形态：不含 original_image / created_at
    items = client.get("/api/clothes").json()
    assert len(items) == 3
    assert "original_image" not in items[0]
    assert "created_at" not in items[0]
    assert set(items[0]) == {"id", "name", "category", "color", "style", "processed_image"}

    ids = {it["id"] for it in items}
    assert ids == {a["id"], b["id"], c["id"]}

    # category 过滤
    top = client.get("/api/clothes", params={"category": "top"}).json()
    assert {it["id"] for it in top} == {a["id"]}

    # color 过滤
    white = client.get("/api/clothes", params={"color": "白色"}).json()
    assert {it["id"] for it in white} == {a["id"]}

    # style 过滤（休闲 同时命中 top 与 shoes）
    casual = client.get("/api/clothes", params={"style": "休闲"}).json()
    assert {it["id"] for it in casual} == {a["id"], c["id"]}

    # q 命中 color
    black = client.get("/api/clothes", params={"q": "黑色"}).json()
    assert {it["id"] for it in black} == {b["id"]}

    # q 命中 name（a_top 的 name 为 a_top）
    by_name = client.get("/api/clothes", params={"q": "a_top"}).json()
    assert {it["id"] for it in by_name} == {a["id"]}

    # 组合过滤
    combo = client.get(
        "/api/clothes", params={"category": "shoes", "style": "休闲"}
    ).json()
    assert {it["id"] for it in combo} == {c["id"]}

    # 无匹配
    empty = client.get("/api/clothes", params={"category": "top", "color": "蓝色"}).json()
    assert empty == []


# ---------------- 详情 / 删除 ----------------

def test_get_detail_ok_and_404(client, upload_item):
    item = upload_item("top").json()
    r = client.get(f"/api/clothes/{item['id']}")
    assert r.status_code == 200
    body = r.json()
    assert body["id"] == item["id"]
    assert "original_image" in body  # 详情含完整字段
    assert "created_at" in body

    r404 = client.get("/api/clothes/99999")
    assert r404.status_code == 404


def test_delete_cleanup_and_404(client, upload_item, upload_dir):
    """DELETE 返回 204 空体，物理文件被清理，再 GET/DELETE → 404。"""
    item = upload_item("top").json()
    orig_name = item["original_image"].rsplit("/", 1)[-1]
    proc_name = item["processed_image"].rsplit("/", 1)[-1]

    # 文件已落盘到 tmp_path
    assert (upload_dir / "original" / orig_name).exists()
    assert (upload_dir / "processed" / proc_name).exists()

    r = client.delete(f"/api/clothes/{item['id']}")
    assert r.status_code == 204
    assert r.content == b""

    # 物理文件清理：原图与 processed 白底 jpg 被删
    # （注：delete_files 只删同名文件，透明 PNG 中间产物可能残留，本阶段不强制清理。）
    assert not (upload_dir / "original" / orig_name).exists()
    assert not (upload_dir / "processed" / proc_name).exists()

    # 再访问 → 404
    assert client.get(f"/api/clothes/{item['id']}").status_code == 404
    assert client.delete(f"/api/clothes/{item['id']}").status_code == 404
