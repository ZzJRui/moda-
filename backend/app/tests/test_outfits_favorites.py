"""穿搭保存 + 收藏截图测试。FRD-API-005 / FRD-API-006 / FRD-API-007 / FRD-API-008。

覆盖：
- POST /api/outfits：ai / manual 两种 source、引用不存在单品 404、槽位品类不匹配 400
- POST /api/favorites：保存截图 + 回填 outfit.screenshot_path、outfit 不存在 404、坏截图 400
- GET /api/favorites：按 created_at 倒序
- GET /api/favorites/{id}：嵌套 outfit、404、孤儿 favorite 404（无外键约束防御分支）
"""
from __future__ import annotations

from datetime import datetime

from app.models import Favorite, Outfit


# ---------------- 穿搭保存 ----------------

def test_create_outfit_ai(client, upload_item):
    top = upload_item("top").json()
    bottom = upload_item("bottom").json()
    shoes = upload_item("shoes").json()
    payload = {
        "top_id": top["id"], "bottom_id": bottom["id"], "shoes_id": shoes["id"],
        "source": "ai", "prompt": "今天想去公园", "reason": "适合公园散步",
    }
    r = client.post("/api/outfits", json=payload)
    assert r.status_code == 201
    body = r.json()
    assert body["top_id"] == top["id"]
    assert body["bottom_id"] == bottom["id"]
    assert body["shoes_id"] == shoes["id"]
    assert body["source"] == "ai"
    assert body["prompt"] == "今天想去公园"
    assert body["reason"] == "适合公园散步"
    assert body["screenshot_path"] is None  # 收藏接口回填前为 null


def test_create_outfit_manual(client, upload_item):
    top = upload_item("top").json()
    bottom = upload_item("bottom").json()
    shoes = upload_item("shoes").json()
    payload = {
        "top_id": top["id"], "bottom_id": bottom["id"], "shoes_id": shoes["id"],
        "source": "manual",
    }
    r = client.post("/api/outfits", json=payload)
    assert r.status_code == 201
    body = r.json()
    assert body["source"] == "manual"
    assert body["prompt"] is None
    assert body["reason"] is None


def test_create_outfit_missing_item(client, upload_item):
    top = upload_item("top").json()
    bottom = upload_item("bottom").json()
    payload = {
        "top_id": top["id"], "bottom_id": bottom["id"], "shoes_id": 99999,
        "source": "manual",
    }
    r = client.post("/api/outfits", json=payload)
    assert r.status_code == 404


def test_create_outfit_slot_mismatch(client, upload_item):
    """top_id 指向 bottom 单品 → 槽位品类不匹配 400。"""
    bottom = upload_item("bottom").json()
    real_bottom_as_top = bottom
    top = upload_item("top").json()
    shoes = upload_item("shoes").json()
    payload = {
        "top_id": real_bottom_as_top["id"],  # 把下装当上衣
        "bottom_id": top["id"],
        "shoes_id": shoes["id"],
        "source": "manual",
    }
    r = client.post("/api/outfits", json=payload)
    assert r.status_code == 400


def test_create_outfit_bad_source(client, upload_item):
    """source 非枚举 → schema 层 422。"""
    top = upload_item("top").json()
    bottom = upload_item("bottom").json()
    shoes = upload_item("shoes").json()
    payload = {
        "top_id": top["id"], "bottom_id": bottom["id"], "shoes_id": shoes["id"],
        "source": "robot",
    }
    r = client.post("/api/outfits", json=payload)
    assert r.status_code == 422


# ---------------- 收藏截图 ----------------

def _make_outfit(client, upload_item) -> int:
    top = upload_item("top").json()
    bottom = upload_item("bottom").json()
    shoes = upload_item("shoes").json()
    r = client.post("/api/outfits", json={
        "top_id": top["id"], "bottom_id": bottom["id"], "shoes_id": shoes["id"],
        "source": "ai", "prompt": "公园", "reason": "休闲",
    })
    return r.json()["id"]


def _png_bytes() -> bytes:
    import io
    from PIL import Image
    buf = io.BytesIO()
    Image.new("RGB", (32, 32), (10, 20, 30)).save(buf, format="PNG")
    return buf.getvalue()


def test_create_favorite_success(client, upload_item, upload_dir):
    outfit_id = _make_outfit(client, upload_item)
    files = {"screenshot": ("shot.png", _png_bytes(), "image/png")}
    r = client.post("/api/favorites", data={"outfit_id": outfit_id}, files=files)
    assert r.status_code == 201
    body = r.json()
    assert set(body) == {"id", "outfit_id", "screenshot_path", "created_at"}
    assert body["outfit_id"] == outfit_id
    assert body["screenshot_path"].startswith("/uploads/favorites/")
    # 截图文件确实落盘到隔离的上传目录
    fname = body["screenshot_path"].rsplit("/", 1)[-1]
    assert (upload_dir / "favorites" / fname).exists()


def test_create_favorite_backfills_outfit(client, upload_item, db_session):
    """保存收藏后 outfit.screenshot_path 应被回填（todo §7.2）。"""
    outfit_id = _make_outfit(client, upload_item)
    files = {"screenshot": ("shot.png", _png_bytes(), "image/png")}
    r = client.post("/api/favorites", data={"outfit_id": outfit_id}, files=files)
    assert r.status_code == 201
    db_outfit = db_session.get(Outfit, outfit_id)
    assert db_outfit.screenshot_path == r.json()["screenshot_path"]


def test_create_favorite_outfit_not_found(client):
    files = {"screenshot": ("shot.png", _png_bytes(), "image/png")}
    r = client.post("/api/favorites", data={"outfit_id": 99999}, files=files)
    assert r.status_code == 404


def test_create_favorite_bad_screenshot(client, upload_item):
    outfit_id = _make_outfit(client, upload_item)
    files = {"screenshot": ("shot.gif", b"not an image", "image/gif")}
    r = client.post("/api/favorites", data={"outfit_id": outfit_id}, files=files)
    assert r.status_code == 400


# ---------------- 收藏列表（倒序） ----------------

def test_favorite_list_desc_by_created_at(client, db_session):
    """用 DB 直接造数据以精确控制 created_at，验证倒序。"""
    outfit = Outfit(top_id=1, bottom_id=2, shoes_id=3, source="manual", reason="手动搭配")
    db_session.add(outfit)
    db_session.commit()
    db_session.refresh(outfit)

    older = Favorite(
        outfit_id=outfit.id, screenshot_path="/uploads/favorites/old.png",
        created_at=datetime(2026, 7, 1, 10, 0, 0),
    )
    newer = Favorite(
        outfit_id=outfit.id, screenshot_path="/uploads/favorites/new.png",
        created_at=datetime(2026, 7, 2, 10, 0, 0),
    )
    db_session.add_all([older, newer])
    db_session.commit()

    items = client.get("/api/favorites").json()
    assert len(items) == 2
    assert items[0]["screenshot_path"].endswith("new.png")  # 最新在前
    assert items[1]["screenshot_path"].endswith("old.png")


# ---------------- 收藏详情 ----------------

def test_favorite_detail_nested_outfit(client, upload_item):
    outfit_id = _make_outfit(client, upload_item)
    files = {"screenshot": ("shot.png", _png_bytes(), "image/png")}
    fav = client.post("/api/favorites", data={"outfit_id": outfit_id}, files=files).json()

    r = client.get(f"/api/favorites/{fav['id']}")
    assert r.status_code == 200
    body = r.json()
    assert body["id"] == fav["id"]
    assert body["screenshot_path"] == fav["screenshot_path"]
    assert "outfit" in body
    outfit = body["outfit"]
    assert outfit["id"] == outfit_id
    assert set(outfit) == {"id", "source", "prompt", "reason", "top_id", "bottom_id", "shoes_id"}
    assert "screenshot_path" not in outfit  # OutfitBrief 不含该字段


def test_favorite_detail_not_found(client):
    assert client.get("/api/favorites/99999").status_code == 404


def test_favorite_detail_orphan_outfit(client, db_session):
    """穿搭被删后，收藏成为孤儿 → 详情 404（无外键约束的防御分支）。"""
    outfit = Outfit(top_id=1, bottom_id=2, shoes_id=3, source="manual", reason="手动搭配")
    db_session.add(outfit)
    db_session.commit()
    db_session.refresh(outfit)

    fav = Favorite(
        outfit_id=outfit.id, screenshot_path="/uploads/favorites/x.png",
        created_at=datetime(2026, 7, 1, 10, 0, 0),
    )
    db_session.add(fav)
    db_session.commit()
    db_session.refresh(fav)

    # 删穿搭制造孤儿
    db_session.delete(outfit)
    db_session.commit()

    assert client.get(f"/api/favorites/{fav.id}").status_code == 404
