"""规则推荐服务（FRD-ST-005 / FRD-API-004 / TODO Phase 3）。

- 从用户文本提取颜色/风格关键词，对已有衣柜单品评分挑选
- 三品类齐全返回 top/bottom/shoes + reason；缺品类抛 MissingCategoryError
- 纯函数风格：入参为已查出的 ClothingItem 列表与文本，不直接持有 DB 会话
- 结构稳定，便于后续替换真实模型（FRD-NF-004）
"""
from __future__ import annotations

import random
from dataclasses import dataclass

from app.models import ClothingItem
from app.schemas import RecommendationOut
from app.services.tagging_service import VALID_CATEGORIES

# 品类中文名，用于缺品类提示文案
CATEGORY_LABELS: dict[str, str] = {"top": "上衣", "bottom": "下装", "shoes": "鞋子"}

# 颜色关键词：命中后用于匹配 item.color 子串
COLOR_KEYWORDS: tuple[str, ...] = ("白色", "黑色", "蓝色")

# (关键词组, 风格标签, 场景短语)
#   关键词用于命中文本；风格标签用于匹配 item.style；场景短语拼进 reason
STYLE_GROUPS: tuple[tuple[tuple[str, ...], str, str], ...] = (
    (("休闲", "舒服", "公园", "运动"), "休闲", "公园散步"),
    (("通勤", "上班"), "通勤", "日常通勤"),
    (("甜酷", "约会", "晚上"), "甜酷", "晚上约会"),
)


class MissingCategoryError(Exception):
    """某品类衣柜为空，无法推荐。router 据此返回 FRD-API-004 缺品类结构。"""

    def __init__(self, missing_categories: list[str]) -> None:
        self.missing_categories = missing_categories
        names = "、".join(CATEGORY_LABELS[c] for c in missing_categories)
        # 与 FRD-ST-007 提示语保持一致口吻
        self.message = f"还缺少{names}，先上传再让 AI 搭配吧。"
        super().__init__(self.message)


@dataclass
class _Scored:
    """单品评分中间结构。"""

    item: ClothingItem
    score: int


def recommend(
    items: list[ClothingItem],
    text: str,
    *,
    seed: int | None = None,
) -> RecommendationOut:
    """规则推荐主入口。

    - items：router 查出的全部衣柜单品
    - text：用户搭配需求文本
    - seed：仅用于可测试的确定性随机；线上调用不传
    """
    # 1. 按品类分组（忽略非法 category）
    grouped: dict[str, list[ClothingItem]] = {c: [] for c in VALID_CATEGORIES}
    for it in items:
        if it.category in grouped:
            grouped[it.category].append(it)

    # 2. 缺品类 → 抛错（顺序按 VALID_CATEGORIES，稳定）
    missing = [c for c in VALID_CATEGORIES if not grouped[c]]
    if missing:
        raise MissingCategoryError(missing)

    # 3. 关键词提取
    detected_colors = [kw for kw in COLOR_KEYWORDS if kw in text]
    detected_style: str | None = None
    detected_scene: str | None = None
    for kws, style, scene in STYLE_GROUPS:
        if any(k in text for k in kws):
            detected_style = style
            detected_scene = scene
            break

    # 4. 每个品类挑一件：颜色命中 +2，风格命中 +2；同分按 created_at desc；仍并列随机
    rng = random.Random(seed)
    chosen: dict[str, ClothingItem] = {}
    for cat in VALID_CATEGORIES:
        chosen[cat] = _pick(grouped[cat], detected_colors, detected_style, rng)

    # 5. 拼 reason
    reason = _build_reason(chosen, detected_colors, detected_style, detected_scene)
    return RecommendationOut(
        top_id=chosen["top"].id,
        bottom_id=chosen["bottom"].id,
        shoes_id=chosen["shoes"].id,
        reason=reason,
    )


def _pick(
    candidates: list[ClothingItem],
    colors: list[str],
    style: str | None,
    rng: random.Random,
) -> ClothingItem:
    """对单品类候选单品评分挑选。

    - 颜色命中（item.color 含某颜色关键词）+2
    - 风格命中（item.style == style）+2
    - 取最高分；同分按 created_at 倒序；仍并列用 rng.choice
    """
    scored = [
        _Scored(item=it, score=_score(it, colors, style)) for it in candidates
    ]
    # 排序键：score desc → created_at desc；稳定可复现
    scored.sort(key=lambda s: (s.score, s.item.created_at), reverse=True)
    top_score = scored[0].score
    best = [s for s in scored if s.score == top_score]
    if len(best) == 1:
        return best[0].item
    return rng.choice(best).item


def _score(item: ClothingItem, colors: list[str], style: str | None) -> int:
    """单件单品评分。color/style 为可空自由字符串，做子串匹配。"""
    score = 0
    if colors and item.color:
        if any(c in item.color for c in colors):
            score += 2
    if style and item.style and item.style == style:
        score += 2
    return score


def _build_reason(
    chosen: dict[str, ClothingItem],
    colors: list[str],
    style: str | None,
    scene: str | None,
) -> str:
    """组装一句中文理由，引用颜色/风格/场景。

    无任何关键词命中时回退到稳定文案。
    """
    top = chosen["top"]
    # 颜色描述：优先用命中的颜色关键词，其次回退到单品自身 color
    top_color = next((c for c in colors if top.color and c in top.color), None) or (
        top.color or ""
    )
    bottom_color = chosen["bottom"].color or ""

    parts: list[str] = []
    if style:
        parts.append(f"这套偏{style}")
    if top_color or bottom_color:
        seg = "、".join(c for c in (top_color, bottom_color) if c)
        parts.append(f"{seg}比较清爽" if seg else "颜色清爽")
    if not parts:
        parts.append("这套搭配从衣柜里挑选")

    reason = "，".join(parts)
    if scene:
        reason = f"{reason}，适合{scene}。"
    else:
        reason = f"{reason}，先试试看效果。"
    return reason
