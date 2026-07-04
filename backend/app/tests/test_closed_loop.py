"""端到端闭环集成测试。todo v3 §8 后端闭环验收链路。

上传上衣 → 上传下装 → 上传鞋子 → 搜索衣柜 → 请求推荐
→ 保存穿搭 → 上传收藏截图 → 获取收藏列表 → 获取收藏详情

只有这条链路通过后，再进入前端开发。
"""
from __future__ import annotations

import io

from PIL import Image


def _png_bytes() -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", (32, 32), (10, 20, 30)).save(buf, format="PNG")
    return buf.getvalue()


def test_closed_loop(client, upload_item):
    # 1. 上传上衣
    top = upload_item("top", color="白色", style="休闲").json()
    assert top["category"] == "top"

    # 2. 上传下装
    bottom = upload_item("bottom", color="黑色", style="通勤").json()
    assert bottom["category"] == "bottom"

    # 3. 上传鞋子
    shoes = upload_item("shoes", color="蓝色", style="休闲").json()
    assert shoes["category"] == "shoes"

    # 4. 搜索衣柜（按品类能搜到上衣）
    res = client.get("/api/clothes", params={"category": "top"}).json()
    assert any(it["id"] == top["id"] for it in res)

    # 5. 请求推荐 → 200，三 id 非空且指向已上传单品
    rec = client.post(
        "/api/recommendations/outfit", json={"text": "今天想去公园，舒服一点"}
    )
    assert rec.status_code == 200
    rec_body = rec.json()
    assert rec_body["top_id"] == top["id"]
    assert rec_body["bottom_id"] == bottom["id"]
    assert rec_body["shoes_id"] == shoes["id"]
    assert rec_body["reason"]

    # 6. 保存穿搭（用推荐结果的三 id，source=ai）
    outfit = client.post("/api/outfits", json={
        "top_id": rec_body["top_id"],
        "bottom_id": rec_body["bottom_id"],
        "shoes_id": rec_body["shoes_id"],
        "source": "ai",
        "prompt": "今天想去公园",
        "reason": rec_body["reason"],
    }).json()
    outfit_id = outfit["id"]
    assert outfit["screenshot_path"] is None

    # 7. 上传收藏截图
    files = {"screenshot": ("shot.png", _png_bytes(), "image/png")}
    fav = client.post(
        "/api/favorites", data={"outfit_id": outfit_id}, files=files
    ).json()
    assert fav["outfit_id"] == outfit_id
    assert fav["screenshot_path"].startswith("/uploads/favorites/")

    # 8. 获取收藏列表 → 含该条
    favs = client.get("/api/favorites").json()
    assert any(f["id"] == fav["id"] for f in favs)

    # 9. 获取收藏详情 → 嵌套 outfit
    detail = client.get(f"/api/favorites/{fav['id']}").json()
    assert detail["id"] == fav["id"]
    assert detail["outfit"]["id"] == outfit_id
    assert detail["outfit"]["top_id"] == top["id"]
    assert detail["outfit"]["source"] == "ai"
