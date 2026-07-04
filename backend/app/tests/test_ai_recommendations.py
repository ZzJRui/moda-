"""AI 推荐路径测试。FRD-ST-005 / FRD-NF-004 / FRD-API-004。

默认 provider=openai_compatible。通过 monkeypatch 替换 ai_client.chat_completion
注入桩，不发真实网络请求。

覆盖：
- ENV 未配置 → ai_not_configured
- 超时/网络错误 → ai_unavailable
- 鉴权失败 → ai_auth_failed
- 非 JSON → ai_invalid_response
- ID 不存在/品类错 → ai_invalid_response
- 合法 JSON → 200 + 四键
- 缺品类 → 422 missing_category，且不调模型
- provider=rule → 走规则路径
"""
from __future__ import annotations

from datetime import datetime

import pytest

from app import config
from app.models import ClothingItem
from app.services import ai_client, ai_recommendation_service, recommendation_service


# ---------------- 桩工具 ----------------


def _make_items():
    """构造三品类各一件的 ClothingItem 列表（id 1/2/3）。"""
    ts = datetime(2026, 7, 1, 10, 0, 0)
    return [
        ClothingItem(id=1, name="白色上衣", category="top", color="白色", style="休闲",
                     original_image="a", processed_image="b", created_at=ts),
        ClothingItem(id=2, name="黑色下装", category="bottom", color="黑色", style="通勤",
                     original_image="a", processed_image="b", created_at=ts),
        ClothingItem(id=3, name="蓝色鞋子", category="shoes", color="蓝色", style="休闲",
                     original_image="a", processed_image="b", created_at=ts),
    ]


def _stub_chat(monkeypatch, return_value: str, *, calls: list | None = None):
    """把 ai_client.chat_completion 替换为返回固定文本的桩；记录调用次数。"""

    def _fake(messages, *, model=None, temperature=0.6):
        if calls is not None:
            calls.append(messages)
        return return_value

    monkeypatch.setattr(ai_client, "chat_completion", _fake)


# ---------------- HTTP 层 ----------------


def test_ai_not_configured(client, upload_item, monkeypatch):
    """provider=openai_compatible 且配置缺失 → 500 ai_not_configured。"""
    upload_item("top")
    upload_item("bottom")
    upload_item("shoes")
    monkeypatch.setattr(config, "AI_API_BASE_URL", None)
    monkeypatch.setattr(config, "AI_API_KEY", None)
    monkeypatch.setattr(config, "AI_MODEL", None)

    r = client.post("/api/recommendations/outfit", json={"text": "搭一套"})
    assert r.status_code == 500
    body = r.json()
    assert body["error"] == "ai_not_configured"
    assert "message" in body and body["message"]


def test_ai_unavailable(client, upload_item, monkeypatch):
    """模型超时/网络错误 → 503 ai_unavailable。"""
    upload_item("top")
    upload_item("bottom")
    upload_item("shoes")

    def _raise(*a, **kw):
        raise ai_client.AIUnavailableError("timeout")

    monkeypatch.setattr(ai_client, "chat_completion", _raise)

    r = client.post("/api/recommendations/outfit", json={"text": "搭一套"})
    assert r.status_code == 503
    assert r.json()["error"] == "ai_unavailable"


def test_ai_auth_failed(client, upload_item, monkeypatch):
    """模型 401/403 → 401 ai_auth_failed。"""
    upload_item("top")
    upload_item("bottom")
    upload_item("shoes")

    def _raise(*a, **kw):
        raise ai_client.AIAuthFailedError("401")

    monkeypatch.setattr(ai_client, "chat_completion", _raise)

    r = client.post("/api/recommendations/outfit", json={"text": "搭一套"})
    assert r.status_code == 401
    assert r.json()["error"] == "ai_auth_failed"


def test_ai_invalid_json(client, upload_item, monkeypatch):
    """模型返回非 JSON → 502 ai_invalid_response。"""
    upload_item("top")
    upload_item("bottom")
    upload_item("shoes")
    _stub_chat(monkeypatch, "这不是JSON")

    r = client.post("/api/recommendations/outfit", json={"text": "搭一套"})
    assert r.status_code == 502
    assert r.json()["error"] == "ai_invalid_response"


def test_ai_invalid_id(client, upload_item, monkeypatch):
    """模型返回合法 JSON 但 ID 不存在 → 502 ai_invalid_response。"""
    a = upload_item("top").json()
    b = upload_item("bottom").json()
    c = upload_item("shoes").json()
    # top_id 用一个不存在的 id
    bad = {"top_id": 9999, "bottom_id": b["id"], "shoes_id": c["id"], "reason": "随便"}
    _stub_chat(monkeypatch, __import__("json").dumps(bad))

    r = client.post("/api/recommendations/outfit", json={"text": "搭一套"})
    assert r.status_code == 502
    assert r.json()["error"] == "ai_invalid_response"


def test_ai_success(client, upload_item, monkeypatch):
    """模型返回合法 JSON → 200 + 四键，ID 指向上传单品。"""
    a = upload_item("top").json()
    b = upload_item("bottom").json()
    c = upload_item("shoes").json()
    good = {
        "top_id": a["id"],
        "bottom_id": b["id"],
        "shoes_id": c["id"],
        "reason": "这套偏休闲，适合公园。",
    }
    _stub_chat(monkeypatch, __import__("json").dumps(good))

    r = client.post("/api/recommendations/outfit", json={"text": "去公园"})
    assert r.status_code == 200
    body = r.json()
    assert set(body) == {"top_id", "bottom_id", "shoes_id", "reason"}
    assert body["top_id"] == a["id"]
    assert body["bottom_id"] == b["id"]
    assert body["shoes_id"] == c["id"]
    assert body["reason"]


def test_ai_missing_category_skips_model(client, upload_item, monkeypatch):
    """缺品类 → 422 missing_category，且不调用模型。"""
    upload_item("top")
    upload_item("bottom")
    calls: list = []
    _stub_chat(monkeypatch, "should-not-be-called", calls=calls)

    r = client.post("/api/recommendations/outfit", json={"text": "搭一套"})
    assert r.status_code == 422
    body = r.json()
    assert body["error"] == "missing_category"
    assert body["missing_categories"] == ["shoes"]
    assert calls == [], "缺品类时不应调用 AI 模型"


def test_ai_provider_rule_uses_rule(client, upload_item, monkeypatch):
    """provider=rule 时走规则路径，不调 AI。"""
    monkeypatch.setattr(config, "AI_RECOMMENDATION_PROVIDER", "rule")
    a = upload_item("top", color="白色", style="休闲").json()
    b = upload_item("bottom", color="黑色", style="通勤").json()
    c = upload_item("shoes", color="蓝色", style="休闲").json()
    calls: list = []
    _stub_chat(monkeypatch, "should-not-be-called", calls=calls)

    r = client.post("/api/recommendations/outfit", json={"text": "去公园"})
    assert r.status_code == 200
    assert r.json()["top_id"] == a["id"]
    assert calls == [], "provider=rule 时不应调用 AI 模型"


# ---------------- 服务层单测（不经 HTTP） ----------------


def test_ai_service_success(monkeypatch):
    """recommend_with_ai 解析合法 JSON，返回正确 RecommendationOut。"""
    items = _make_items()
    good = '{"top_id": 1, "bottom_id": 2, "shoes_id": 3, "reason": "休闲搭配"}'
    _stub_chat(monkeypatch, good)

    out = ai_recommendation_service.recommend_with_ai(items, "去公园")
    assert out.top_id == 1
    assert out.bottom_id == 2
    assert out.shoes_id == 3
    assert out.reason == "休闲搭配"


def test_ai_service_json_fence(monkeypatch):
    """模型用 ```json 围栏包裹也应能解析。"""
    items = _make_items()
    fenced = '```json\n{"top_id": 1, "bottom_id": 2, "shoes_id": 3, "reason": "清爽"}\n```'
    _stub_chat(monkeypatch, fenced)

    out = ai_recommendation_service.recommend_with_ai(items, "搭一套")
    assert out.top_id == 1
    assert out.reason == "清爽"


def test_ai_service_missing_category_skips_model(monkeypatch):
    """缺品类抛 MissingCategoryError，不调模型。"""
    items = _make_items()[:1]  # 只有 top
    calls: list = []
    _stub_chat(monkeypatch, "x", calls=calls)

    with pytest.raises(recommendation_service.MissingCategoryError) as exc:
        ai_recommendation_service.recommend_with_ai(items, "搭一套")
    assert exc.value.missing_categories == ["bottom", "shoes"]
    assert calls == []


def test_ai_service_wrong_category_id(monkeypatch):
    """ID 存在但品类错（用鞋子 id 当 top_id）→ AIInvalidResponseError。"""
    items = _make_items()
    bad = '{"top_id": 3, "bottom_id": 2, "shoes_id": 3, "reason": "错配"}'
    _stub_chat(monkeypatch, bad)

    with pytest.raises(ai_recommendation_service.AIInvalidResponseError):
        ai_recommendation_service.recommend_with_ai(items, "搭一套")


def test_ai_service_empty_reason(monkeypatch):
    """reason 为空字符串 → AIInvalidResponseError。"""
    items = _make_items()
    bad = '{"top_id": 1, "bottom_id": 2, "shoes_id": 3, "reason": ""}'
    _stub_chat(monkeypatch, bad)

    with pytest.raises(ai_recommendation_service.AIInvalidResponseError):
        ai_recommendation_service.recommend_with_ai(items, "搭一套")


def test_ai_service_prompt_contains_items(monkeypatch):
    """prompt 应包含每件单品的 id 与品类。"""
    items = _make_items()
    captured: list = []
    _stub_chat(monkeypatch, '{"top_id":1,"bottom_id":2,"shoes_id":3,"reason":"ok"}',
               calls=captured)

    ai_recommendation_service.recommend_with_ai(items, "去公园")
    assert captured, "应调用 chat_completion"
    user_msg = captured[0][-1]["content"]
    assert "id=1" in user_msg and "category=top" in user_msg
    assert "id=2" in user_msg and "category=bottom" in user_msg
    assert "id=3" in user_msg and "category=shoes" in user_msg
    assert "去公园" in user_msg
