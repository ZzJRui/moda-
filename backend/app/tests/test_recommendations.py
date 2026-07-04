"""推荐接口测试。FRD-API-004 / FRD-ST-005。

默认 provider=openai_compatible，本文件用 monkeypatch 临时切到 rule，
验证规则路径：三品类齐全 → 200 + 四键；缺品类 → 422 顶层三字段；
服务层 recommend(..., seed=) 确定性返回。AI 路径见 test_ai_recommendations.py。
"""
from __future__ import annotations

from datetime import datetime

import pytest

from app import config
from app.models import ClothingItem
from app.services import recommendation_service


# ---------------- HTTP 层（强制 rule 路径） ----------------


@pytest.fixture(autouse=True)
def _force_rule_provider(monkeypatch):
    """本文件所有 HTTP 测试走规则推荐，避免触发真实 AI 调用。"""
    monkeypatch.setattr(config, "AI_RECOMMENDATION_PROVIDER", "rule")


def test_recommend_success(client, upload_item):
    a = upload_item("top", color="白色", style="休闲").json()
    b = upload_item("bottom", color="黑色", style="通勤").json()
    c = upload_item("shoes", color="蓝色", style="休闲").json()

    r = client.post(
        "/api/recommendations/outfit", json={"text": "今天想去公园，舒服一点"}
    )
    assert r.status_code == 200
    body = r.json()
    assert set(body) == {"top_id", "bottom_id", "shoes_id", "reason"}
    assert body["top_id"] == a["id"]
    assert body["bottom_id"] == b["id"]
    assert body["shoes_id"] == c["id"]
    assert isinstance(body["reason"], str) and body["reason"]


def test_recommend_missing_category(client, upload_item):
    """只上传 top+bottom，缺 shoes → 422 缺品类结构。"""
    upload_item("top")
    upload_item("bottom")

    r = client.post(
        "/api/recommendations/outfit", json={"text": "随便搭一套"}
    )
    assert r.status_code == 422
    body = r.json()
    # 顶层字段，不是 detail 包裹
    assert body["error"] == "missing_category"
    assert "message" in body and body["message"]
    assert body["missing_categories"] == ["shoes"]


def test_recommend_missing_two_categories(client, upload_item):
    """只上传 top → 缺 bottom+shoes，顺序按 VALID_CATEGORIES。"""
    upload_item("top")
    r = client.post("/api/recommendations/outfit", json={"text": "搭一套"})
    assert r.status_code == 422
    assert r.json()["missing_categories"] == ["bottom", "shoes"]


# ---------------- 服务层单测（不经 HTTP） ----------------

def test_recommend_service_deterministic():
    """recommend 是纯函数，seed 固定下结果可复现。"""
    ts = datetime(2026, 7, 1, 10, 0, 0)
    items = [
        ClothingItem(id=1, name="白色上衣", category="top", color="白色", style="休闲",
                     original_image="a", processed_image="b", created_at=ts),
        ClothingItem(id=2, name="黑色下装", category="bottom", color="黑色", style="通勤",
                     original_image="a", processed_image="b", created_at=ts),
        ClothingItem(id=3, name="蓝色鞋子", category="shoes", color="蓝色", style="休闲",
                     original_image="a", processed_image="b", created_at=ts),
    ]
    out = recommendation_service.recommend(items, "今天想去公园，舒服一点", seed=0)
    # 休闲风格命中 top(shoes 也休闲)，颜色"白"命中 top
    assert out.top_id == 1
    assert out.bottom_id == 2
    assert out.shoes_id == 3
    # reason 含场景或风格词
    assert ("休闲" in out.reason) or ("公园" in out.reason)

    # 同输入同 seed → 同输出
    out2 = recommendation_service.recommend(items, "今天想去公园，舒服一点", seed=0)
    assert out2 == out


def test_recommend_service_missing_raises():
    items = [
        ClothingItem(id=1, name="上衣", category="top", color="白色", style="休闲",
                     original_image="a", processed_image="b", created_at=datetime(2026, 7, 1)),
    ]
    with pytest.raises(recommendation_service.MissingCategoryError) as exc:
        recommendation_service.recommend(items, "搭一套", seed=0)
    assert exc.value.missing_categories == ["bottom", "shoes"]
