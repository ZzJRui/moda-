"""AI 推荐业务层（FRD-ST-005 / FRD-NF-004 可替换 AI）。

职责：
- 接收已查出的 ClothingItem 列表 + 用户文本
- 调用模型前先做缺品类检查（复用 recommendation_service.find_missing_categories）
- 构造 prompt（按品类列出单品 id/name/color/style），要求模型只返回 JSON
- 调 ai_client.chat_completion 获取模型文本
- 解析并校验 JSON：四键齐全、ID 存在、品类匹配、reason 非空
- 非法结果抛 AIInvalidResponseError，不凑合

不持有 DB 会话；纯函数风格，便于测试（monkeypatch ai_client.chat_completion）。
"""
from __future__ import annotations

import json
import re

from app.models import ClothingItem
from app.schemas import RecommendationOut
from app.services import ai_client, recommendation_service
from app.services.tagging_service import VALID_CATEGORIES


class AIInvalidResponseError(Exception):
    """AI 返回结果无法用于当前衣柜（非 JSON / 缺键 / ID 不存在 / 品类错）。"""


# 品类 → 槽位键
_SLOT_FOR_CATEGORY: dict[str, str] = {
    "top": "top_id",
    "bottom": "bottom_id",
    "shoes": "shoes_id",
}

# system prompt：约束模型只能从给定 ID 选、只回纯 JSON
_SYSTEM_PROMPT = (
    "你是穿搭师。只能从用户给出的衣柜单品 ID 中挑选，"
    "上衣(top)、下装(bottom)、鞋子(shoes)各选一件。"
    "必须只返回一个 JSON 对象，不要任何解释或多余文本，格式为："
    '{"top_id": int, "bottom_id": int, "shoes_id": int, "reason": str}。'
    "reason 用一句中文说明搭配理由。"
)


def recommend_with_ai(items: list[ClothingItem], text: str) -> RecommendationOut:
    """AI 推荐主入口。

    - 缺品类抛 recommendation_service.MissingCategoryError（不调模型）
    - 模型返回非法抛 AIInvalidResponseError
    - 网络/鉴权/配置错误由 ai_client 抛，router 映射
    """
    # 1. 调用模型前的品类齐全检查
    missing = recommendation_service.find_missing_categories(items)
    if missing:
        raise recommendation_service.MissingCategoryError(missing)

    # 2. 构造 user prompt：用户需求 + 衣柜清单
    by_cat: dict[str, list[ClothingItem]] = {c: [] for c in VALID_CATEGORIES}
    for it in items:
        if it.category in by_cat:
            by_cat[it.category].append(it)

    lines = [f"用户需求：{text or '随便搭一套'}", "衣柜单品："]
    for cat in VALID_CATEGORIES:
        for it in by_cat[cat]:
            color = it.color or "未标注"
            style = it.style or "未标注"
            lines.append(
                f"- id={it.id} category={cat} name={it.name} color={color} style={style}"
            )
    user_prompt = "\n".join(lines)

    messages = [
        {"role": "system", "content": _SYSTEM_PROMPT},
        {"role": "user", "content": user_prompt},
    ]

    # 3. 调模型
    raw = ai_client.chat_completion(messages)

    # 4. 解析 JSON（容忍 ```json``` 围栏）
    data = _parse_json(raw)

    # 5. 校验四键 + 类型 + reason 非空
    if not isinstance(data, dict):
        raise AIInvalidResponseError("AI 返回不是 JSON 对象")
    for slot in ("top_id", "bottom_id", "shoes_id"):
        val = data.get(slot)
        if not isinstance(val, int) or isinstance(val, bool):
            raise AIInvalidResponseError(f"AI 返回 {slot} 不是整数")
    reason = data.get("reason")
    if not isinstance(reason, str) or not reason.strip():
        raise AIInvalidResponseError("AI 返回 reason 为空")

    # 6. 校验 ID 存在 + 品类匹配槽位
    valid_ids: dict[str, set[int]] = {c: set() for c in VALID_CATEGORIES}
    for it in items:
        if it.category in valid_ids:
            valid_ids[it.category].add(it.id)

    picks = {
        "top_id": ("top", data["top_id"]),
        "bottom_id": ("bottom", data["bottom_id"]),
        "shoes_id": ("shoes", data["shoes_id"]),
    }
    for slot, (cat, item_id) in picks.items():
        if item_id not in valid_ids[cat]:
            raise AIInvalidResponseError(
                f"AI 返回 {slot}={item_id} 不在 {cat} 品类中"
            )

    return RecommendationOut(
        top_id=data["top_id"],
        bottom_id=data["bottom_id"],
        shoes_id=data["shoes_id"],
        reason=reason.strip(),
    )


def _parse_json(raw: str) -> object:
    """从模型文本中提取 JSON 对象。

    容忍 ```json ... ``` 围栏和前后空白；解析失败抛 AIInvalidResponseError。
    """
    if not isinstance(raw, str) or not raw.strip():
        raise AIInvalidResponseError("AI 返回为空")
    text = raw.strip()
    # 剥离 ```json ... ``` 或 ``` ... ``` 围栏
    fence = re.match(r"^```(?:json)?\s*(.*?)\s*```$", text, re.DOTALL)
    if fence:
        text = fence.group(1).strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError as e:
        raise AIInvalidResponseError(f"AI 返回不是合法 JSON：{e.msg}") from e
