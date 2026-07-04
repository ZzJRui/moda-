"""规则推荐服务（FRD v4 / ST-005 / API-004）。

- 从用户文本提取风格/正式度/季节/颜色关键词，对已有衣柜单品按新标签字段评分挑选
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

# 用户文本 → 标签匹配表（顺序对应优先级，先命中即停止）
TEXT_STYLE_KEYWORDS: tuple[tuple[tuple[str, ...], str, str], ...] = (
    (("运动", "跑步", "健身"), "运动", "运动健身"),
    (("通勤", "上班", "工作"), "通勤", "日常通勤"),
    (("街头", "潮", "嘻哈"), "街头", "街头出行"),
    (("甜酷", "约会", "晚上", "辣妹"), "甜酷", "约会聚会"),
    (("简约", "极简", "干净"), "简约", "简约出行"),
    (("韩系", "韩范"), "韩系", "韩系搭配"),
    (("美式", "美风"), "美式", "美式休闲"),
    (("休闲", "舒服", "公园", "日常"), "休闲", "日常休闲"),
)
TEXT_FORMALITY_KEYWORDS: tuple[tuple[tuple[str, ...], str, str], ...] = (
    (("正式", "重要", "会议", "商务"), "正式", "正式场合"),
    (("半正式", "见客户", "面试"), "半正式", "半正式场合"),
    (("通勤", "上班", "工作"), "通勤", "通勤场合"),
    (("居家", "在家", "睡衣"), "居家", "居家放松"),
    (("日常", "逛街", "出门", "聚会"), "日常", "日常出行"),
)
TEXT_SEASON_KEYWORDS: tuple[tuple[tuple[str, ...], str, str], ...] = (
    (("夏天", "夏季", "热", "凉快"), "夏季", "夏季"),
    (("冬天", "冬季", "冷", "暖和", "保暖"), "冬季", "冬季"),
    (("春", "秋", "春秋"), "春秋", "春秋季"),
)
TEXT_COLOR_TONE_KEYWORDS: tuple[tuple[tuple[str, ...], str, str], ...] = (
    (("亮色", "鲜艳", "跳", "鲜艳", "亮色"), "亮色系", "亮色系"),
    (("浅色", "淡", "素", "清爽"), "浅色系", "浅色系"),
    (("深色", "暗", "沉稳"), "深色系", "深色系"),
    (("低饱和", "莫兰迪", "灰调"), "低饱和色", "低饱和色"),
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


def _match_text(text: str, groups) -> tuple[str | None, str | None]:
    """从文本中匹配第一组关键词，返回 (标签值, 场景短语) 或 (None, None)。"""
    for kws, label, scene in groups:
        if any(k in text for k in kws):
            return label, scene
    return None, None


def find_missing_categories(items: list[ClothingItem]) -> list[str]:
    """返回缺品类的列表（顺序按 VALID_CATEGORIES，稳定）。

    规则与 AI 两条推荐路径共用：调用模型前先确认三品类齐全。
    """
    grouped: dict[str, list[ClothingItem]] = {c: [] for c in VALID_CATEGORIES}
    for it in items:
        if it.category in grouped:
            grouped[it.category].append(it)
    return [c for c in VALID_CATEGORIES if not grouped[c]]


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
    # 1. 按品类分组
    grouped: dict[str, list[ClothingItem]] = {c: [] for c in VALID_CATEGORIES}
    for it in items:
        if it.category in grouped:
            grouped[it.category].append(it)

    # 2. 缺品类 → 抛错
    missing = [c for c in VALID_CATEGORIES if not grouped[c]]
    if missing:
        raise MissingCategoryError(missing)

    # 3. 从用户文本提取偏好
    detected_style, style_scene = _match_text(text, TEXT_STYLE_KEYWORDS)
    detected_formality, formal_scene = _match_text(text, TEXT_FORMALITY_KEYWORDS)
    detected_season, season_scene = _match_text(text, TEXT_SEASON_KEYWORDS)
    detected_tone, tone_scene = _match_text(text, TEXT_COLOR_TONE_KEYWORDS)

    # 4. 每个品类挑一件
    rng = random.Random(seed)
    chosen: dict[str, ClothingItem] = {}
    for cat in VALID_CATEGORIES:
        chosen[cat] = _pick(
            grouped[cat],
            detected_style=detected_style,
            detected_formality=detected_formality,
            detected_season=detected_season,
            detected_tone=detected_tone,
            rng=rng,
        )

    # 5. 拼 reason
    reason = _build_reason(
        chosen, detected_style, style_scene,
        detected_formality, formal_scene,
        detected_season, season_scene,
        detected_tone, tone_scene,
    )
    return RecommendationOut(
        top_id=chosen["top"].id,
        bottom_id=chosen["bottom"].id,
        shoes_id=chosen["shoes"].id,
        reason=reason,
    )


def _pick(
    candidates: list[ClothingItem],
    detected_style: str | None,
    detected_formality: str | None,
    detected_season: str | None,
    detected_tone: str | None,
    rng: random.Random,
) -> ClothingItem:
    """对单品类候选单品评分挑选。

    打分规则：
    - style 多选重叠（任一命中） +3
    - formality 精确匹配 +2
    - season 多选重叠 +2
    - color_tone 匹配 +1
    取最高分；同分按 created_at 倒序；仍并列用 rng.choice
    """
    scored = [
        _Scored(
            item=it,
            score=_score(it, detected_style, detected_formality, detected_season, detected_tone),
        )
        for it in candidates
    ]
    scored.sort(key=lambda s: (s.score, s.item.created_at), reverse=True)
    top_score = scored[0].score
    best = [s for s in scored if s.score == top_score]
    return rng.choice(best).item if len(best) > 1 else best[0].item


def _score(
    item: ClothingItem,
    detected_style: str | None,
    detected_formality: str | None,
    detected_season: str | None,
    detected_tone: str | None,
) -> int:
    """单件单品评分。"""
    score = 0
    # style 多选重叠
    if detected_style and item.style:
        item_styles = {s.strip() for s in item.style.split(",")}
        if detected_style in item_styles:
            score += 3
    if detected_formality and item.formality:
        if item.formality == detected_formality:
            score += 2
    # season 多选重叠
    if detected_season and item.season:
        item_seasons = {s.strip() for s in item.season.split(",")}
        if detected_season in item_seasons:
            score += 2
    if detected_tone and item.color_tone:
        if item.color_tone == detected_tone:
            score += 1
    return score


def _build_reason(
    chosen: dict[str, ClothingItem],
    detected_style: str | None,
    style_scene: str | None,
    detected_formality: str | None,
    formal_scene: str | None,
    detected_season: str | None,
    season_scene: str | None,
    detected_tone: str | None,
    tone_scene: str | None,
) -> str:
    """组装一句中文理由。"""
    top = chosen["top"]
    top_color = top.color_base or ""
    bottom_color = chosen["bottom"].color_base or ""

    parts: list[str] = []
    if detected_style:
        parts.append(f"这套偏{detected_style}")
    if detected_formality:
        parts.append(f"适合{detected_formality}")
    if top_color or bottom_color:
        seg = "、".join(c for c in (top_color, bottom_color) if c)
        parts.append(f"{seg}色系协调" if seg else "")
    if not parts:
        parts.append("这套搭配从衣柜里挑选")

    reason = "，".join(p for p in parts if p)
    scene = formal_scene or style_scene or season_scene
    if scene:
        reason = f"{reason}，适合{scene}。"
    else:
        reason = f"{reason}，先试试看效果。"
    return reason
