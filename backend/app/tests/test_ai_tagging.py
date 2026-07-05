"""AI 识图打标签测试。FRD v4 / UP-004 / NF-004。

通过 monkeypatch 替换 ai_tagging_service.tag_with_ai（或 ai_client.chat_completion）
注入桩，不发真实网络请求。测试体内打开 AI_TAGGING_ENABLED。

覆盖：
- 上传 → AI 打全标签，tagging_status=ai
- AI 不可用/返回非法 → 上传降级 201，category 默认、其余 unknown
- auto-tag 端点成功 → 更新全部标签字段
- auto-tag 端点 AI 不可用 → 503
- auto-tag 端点非法响应 → 502
- auto-tag 端点不存在 ID → 404
"""
from __future__ import annotations

import json

from app import config
from app.services import ai_client, ai_tagging_service, tagging_service


# ---------------- 桩工具 ----------------


def _stub_tag(monkeypatch, payload: dict):
    """把 ai_tagging_service.tag_with_ai 替换为返回归一化 TagOutput 的桩。"""
    expected = tagging_service.generate_tags(**payload)
    monkeypatch.setattr(
        ai_tagging_service, "tag_with_ai",
        lambda image_bytes, content_type="image/jpeg": expected,
    )


def _stub_chat(monkeypatch, return_value: str, *, calls: list | None = None):
    """把 ai_client.chat_completion 替换为返回固定文本的桩；记录调用。"""

    def _fake(messages, *, model=None, temperature=0.6):
        if calls is not None:
            calls.append(messages)
        return return_value

    monkeypatch.setattr(ai_client, "chat_completion", _fake)


def _stub_raise(monkeypatch, exc):
    """把 ai_tagging_service.tag_with_ai 替换为抛指定异常的桩。"""
    monkeypatch.setattr(
        ai_tagging_service, "tag_with_ai",
        lambda image_bytes, content_type="image/jpeg": (_ for _ in ()).throw(exc),
    )


def _enable_ai(monkeypatch):
    monkeypatch.setattr(config, "AI_TAGGING_ENABLED", True)


def _full_payload(category: str = "top") -> dict:
    return {
        "category": category,
        "subtype": {"top": "T恤", "bottom": "牛仔裤", "shoes": "运动鞋"}[category],
        "color_base": "红色",
        "color_tone": "亮色系",
        "pattern": "纯色",
        "style": "休闲",
        "fit": "常规",
        "season": "春秋",
        "formality": "日常",
        "material": "棉",
    }


def _upload_raw(client, sample_images):
    """直接 POST 上传，仅 file。"""
    fname, data, ctype = sample_images["top"]
    files = {"file": (fname, data, ctype)}
    return client.post("/api/clothes/upload", files=files)


# ---------------- 上传自动打标签 ----------------


def test_upload_ai_tags_full(client, sample_images, monkeypatch):
    """上传 → AI 打全标签，tagging_status=ai。"""
    _enable_ai(monkeypatch)
    _stub_tag(monkeypatch, _full_payload("top"))

    r = _upload_raw(client, sample_images)
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["category"] == "top"
    assert body["color_base"] == "红色"
    assert body["style"] == "休闲"
    assert body["material"] == "棉"
    assert body["tagging_status"] == "ai"
    # name 由 color_base + subtype 拼出，不再是文件名
    assert body["name"] == "红色T恤"


def test_upload_ai_unavailable_degrades(client, sample_images, monkeypatch):
    """AI 不可用 → 上传仍 201，降级 category=top、其余 unknown。"""
    _enable_ai(monkeypatch)
    _stub_raise(monkeypatch, ai_client.AIUnavailableError("timeout"))

    r = _upload_raw(client, sample_images)
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["category"] == "top"
    assert body["color_base"] == "unknown"
    assert body["style"] == "unknown"
    assert body["material"] == "unknown"
    assert body["tagging_status"] == "ai_failed"
    # 降级时无颜色 + subtype，回退品类默认名，不再暴露文件名
    assert body["name"] == "上衣"


def test_upload_ai_invalid_json_degrades(client, sample_images, monkeypatch):
    """AI 返回非 JSON → 上传降级 201，tagging_status=ai_failed。"""
    _enable_ai(monkeypatch)
    _stub_chat(monkeypatch, "这不是JSON")

    r = _upload_raw(client, sample_images)
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["category"] == "top"  # 降级默认
    assert body["tagging_status"] == "ai_failed"


# ---------------- auto-tag 端点 ----------------


def test_auto_tag_success(client, sample_images, monkeypatch):
    """POST /api/clothes/{id}/auto-tag 成功 → 更新全部标签字段。"""
    _enable_ai(monkeypatch)
    # 先用一套标签上传
    _stub_tag(monkeypatch, _full_payload("top"))
    created = _upload_raw(client, sample_images).json()
    item_id = created["id"]
    assert created["name"] == "红色T恤"

    # 重打标签：换一套不同值
    new_payload = {
        "category": "bottom", "subtype": "牛仔裤", "color_base": "黑色",
        "color_tone": "深色系", "pattern": "纯色", "style": "通勤",
        "fit": "修身", "season": "冬季", "formality": "通勤", "material": "牛仔",
        "pants_length": "长裤", "waist": "高腰", "pants_shape": "直筒",
    }
    _stub_tag(monkeypatch, new_payload)

    r = client.post(f"/api/clothes/{item_id}/auto-tag")
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["category"] == "bottom"
    assert body["color_base"] == "黑色"
    assert body["style"] == "通勤"
    assert body["pants_shape"] == "直筒"
    # 上衣专属字段被清空（category 现在是 bottom）
    assert body["sleeve_length"] is None
    assert body["tagging_status"] == "ai"
    # name 同步刷新为新标签的 color_base + subtype
    assert body["name"] == "黑色牛仔裤"

    detail = client.get(f"/api/clothes/{item_id}").json()
    assert detail["category"] == "bottom"
    assert detail["color_base"] == "黑色"
    assert detail["name"] == "黑色牛仔裤"


def test_auto_tag_unavailable(client, sample_images, monkeypatch):
    """auto-tag AI 不可用 → 503 ai_unavailable。"""
    _enable_ai(monkeypatch)
    _stub_tag(monkeypatch, _full_payload("top"))
    created = _upload_raw(client, sample_images).json()
    _stub_raise(monkeypatch, ai_client.AIUnavailableError("timeout"))

    r = client.post(f"/api/clothes/{created['id']}/auto-tag")
    assert r.status_code == 503
    assert r.json()["error"] == "ai_unavailable"


def test_auto_tag_invalid_response(client, sample_images, monkeypatch):
    """auto-tag AI 返回非 JSON → 502 ai_invalid_response。"""
    _enable_ai(monkeypatch)
    _stub_tag(monkeypatch, _full_payload("top"))
    created = _upload_raw(client, sample_images).json()
    # 重打时让 tag_with_ai 抛 AIInvalidResponseError（模拟非 JSON 响应）
    monkeypatch.setattr(
        ai_tagging_service, "tag_with_ai",
        lambda image_bytes, content_type="image/jpeg": (_ for _ in ()).throw(
            ai_tagging_service.AIInvalidResponseError("not json")
        ),
    )

    r = client.post(f"/api/clothes/{created['id']}/auto-tag")
    assert r.status_code == 502
    assert r.json()["error"] == "ai_invalid_response"


def test_auto_tag_not_found(client):
    """auto-tag 不存在 ID → 404。"""
    r = client.post("/api/clothes/9999/auto-tag")
    assert r.status_code == 404
