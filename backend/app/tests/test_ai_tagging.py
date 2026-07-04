"""AI 识图打标签测试。FRD-UP-004 / FRD-NF-004。

通过 monkeypatch 替换 ai_client.chat_completion 注入桩，不发真实网络请求。
conftest 的 autouse fixture 默认关闭 AI_TAGGING_ENABLED，本文件用例在体内重新打开。

覆盖：
- 上传缺品类 → AI 补全，tagging_status=ai
- 上传全填 → 不调 AI，tagging_status=manual
- AI 失败 → 上传降级 201，tagging_status=ai_failed
- AI 返回非法 JSON → 上传降级 201
- auto-tag 端点成功 → 更新 DB
- auto-tag 端点 AI 不可用 → 503
- auto-tag 端点非法响应 → 502
- auto-tag 端点不存在 ID → 404
"""
from __future__ import annotations

import json

from app import config
from app.services import ai_client


# ---------------- 桩工具 ----------------


def _stub_chat(monkeypatch, return_value: str, *, calls: list | None = None):
    """把 ai_client.chat_completion 替换为返回固定文本的桩；记录调用。"""

    def _fake(messages, *, model=None, temperature=0.6):
        if calls is not None:
            calls.append(messages)
        return return_value

    monkeypatch.setattr(ai_client, "chat_completion", _fake)


def _stub_raise(monkeypatch, exc):
    """把 ai_client.chat_completion 替换为抛指定异常的桩。"""

    def _raise(*a, **kw):
        raise exc

    monkeypatch.setattr(ai_client, "chat_completion", _raise)


def _enable_ai(monkeypatch):
    """打开 AI 识图打标签（覆盖 conftest 的默认关闭）。"""
    monkeypatch.setattr(config, "AI_TAGGING_ENABLED", True)


def _upload_raw(client, sample_images, *, category=None, color=None, style=None):
    """直接 POST 上传，不强制 category（fixture upload_item 会强制）。"""
    fname, data, ctype = sample_images["top"]
    files = {"file": (fname, data, ctype)}
    form: dict[str, str] = {}
    if category is not None:
        form["category"] = category
    if color is not None:
        form["color"] = color
    if style is not None:
        form["style"] = style
    return client.post("/api/clothes/upload", files=files, data=form)


# ---------------- 上传自动补缺 ----------------


def test_upload_ai_fills_missing(client, sample_images, monkeypatch):
    """用户未填字段 → AI 补全，tagging_status=ai。"""
    _enable_ai(monkeypatch)
    good = json.dumps({"category": "top", "color": "红色", "style": "休闲"})
    calls: list = []
    _stub_chat(monkeypatch, good, calls=calls)

    r = _upload_raw(client, sample_images)  # 全空
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["category"] == "top"
    assert body["color"] == "红色"
    assert body["style"] == "休闲"
    assert body["tagging_status"] == "ai"
    assert len(calls) == 1, "应调用 AI 一次"


def test_upload_all_filled_skips_ai(client, sample_images, monkeypatch):
    """用户三字段都填 → 不调 AI，tagging_status=manual。"""
    _enable_ai(monkeypatch)
    # 桩若被调用即失败
    def _fail(*a, **kw):
        raise AssertionError("全填时不应调用 AI")

    monkeypatch.setattr(ai_client, "chat_completion", _fail)

    r = _upload_raw(
        client, sample_images, category="top", color="黑色", style="正式"
    )
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["category"] == "top"
    assert body["color"] == "黑色"
    assert body["style"] == "正式"
    assert body["tagging_status"] == "manual"


def test_upload_ai_failure_degrades(client, sample_images, monkeypatch):
    """AI 不可用 → 上传仍 201，降级到规则，tagging_status=ai_failed。"""
    _enable_ai(monkeypatch)
    _stub_raise(monkeypatch, ai_client.AIUnavailableError("timeout"))

    r = _upload_raw(client, sample_images)  # 全空 → 规则兜底 category=top
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["category"] == "top"  # generate_tags 默认
    assert body["color"] is None
    assert body["style"] is None
    assert body["tagging_status"] == "ai_failed"


def test_upload_ai_invalid_json_degrades(client, sample_images, monkeypatch):
    """AI 返回非 JSON → 上传降级 201，tagging_status=ai_failed。"""
    _enable_ai(monkeypatch)
    _stub_chat(monkeypatch, "这不是JSON")

    r = _upload_raw(client, sample_images, category="bottom")
    assert r.status_code == 201, r.text
    body = r.json()
    # 用户填了 category=bottom，降级走规则保留
    assert body["category"] == "bottom"
    assert body["tagging_status"] == "ai_failed"


# ---------------- auto-tag 端点 ----------------


def test_auto_tag_success(client, sample_images, monkeypatch):
    """POST /api/clothes/{id}/auto-tag 成功 → 更新 DB，tagging_status=ai。"""
    _enable_ai(monkeypatch)
    # 先上传一件（全填，不调 AI）
    created = _upload_raw(
        client, sample_images, category="top", color="白色", style="休闲"
    ).json()
    item_id = created["id"]

    # 重打标签：桩返回不同值
    _stub_chat(
        monkeypatch,
        json.dumps({"category": "bottom", "color": "黑色", "style": "通勤"}),
    )

    r = client.post(f"/api/clothes/{item_id}/auto-tag")
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["category"] == "bottom"
    assert body["color"] == "黑色"
    assert body["style"] == "通勤"
    assert body["tagging_status"] == "ai"

    # DB 确实更新（GET 详情反映新值）
    detail = client.get(f"/api/clothes/{item_id}").json()
    assert detail["category"] == "bottom"
    assert detail["color"] == "黑色"


def test_auto_tag_unavailable(client, sample_images, monkeypatch):
    """auto-tag AI 不可用 → 503 ai_unavailable。"""
    _enable_ai(monkeypatch)
    created = _upload_raw(
        client, sample_images, category="top", color="白色", style="休闲"
    ).json()
    _stub_raise(monkeypatch, ai_client.AIUnavailableError("timeout"))

    r = client.post(f"/api/clothes/{created['id']}/auto-tag")
    assert r.status_code == 503
    assert r.json()["error"] == "ai_unavailable"


def test_auto_tag_invalid_response(client, sample_images, monkeypatch):
    """auto-tag AI 返回非 JSON → 502 ai_invalid_response。"""
    _enable_ai(monkeypatch)
    created = _upload_raw(
        client, sample_images, category="top", color="白色", style="休闲"
    ).json()
    _stub_chat(monkeypatch, "不是json")

    r = client.post(f"/api/clothes/{created['id']}/auto-tag")
    assert r.status_code == 502
    assert r.json()["error"] == "ai_invalid_response"


def test_auto_tag_not_found(client):
    """auto-tag 不存在 ID → 404。"""
    r = client.post("/api/clothes/9999/auto-tag")
    assert r.status_code == 404
