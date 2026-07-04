"""标签归一化服务（FRD v4 / UP-004）。

- 校验 category ∈ {top,bottom,shoes}，缺失/非法则取默认 top
- 单选字段未确定一律存 "unknown"；多选字段逗号分隔，空亦存 "unknown"
- subtype 软枚举：表外值保留，不转 "unknown"
- 非该品类的专属字段置 None
- 返回结构稳定，便于后续替换真实模型（FRD-NF-004）

所有写入路径（上传 AI 成功 / 上传 AI 失败降级 / auto-tag）都过这里，
单一归一化瓶颈点。
"""
from __future__ import annotations

from app.schemas import TagOutput
from app.services.tag_constants import (
    ALL_TAG_FIELDS,
    CATEGORY_SPECIFIC_FIELDS,
    DEFAULT_CATEGORY,
    FIELD_CANDIDATES,
    MULTI_SELECT_FIELDS,
    UNKNOWN,
    VALID_CATEGORIES,
    clear_category_specific,
    normalize_multi,
    normalize_single,
)

# 兼容旧 import：ai_tagging_service / ai_recommendation_service / recommendation_service
# 仍从本模块取 VALID_CATEGORIES / DEFAULT_CATEGORY。
__all__ = ["VALID_CATEGORIES", "DEFAULT_CATEGORY", "UNKNOWN", "generate_tags"]


def generate_tags(category: str | None = None, **fields) -> TagOutput:
    """归一化并返回 TagOutput。

    入参为 category + 任意标签字段关键字（见 tag_constants.ALL_TAG_FIELDS），
    未传入的字段按 "未确定" 处理。

    - category 去首尾空白小写，非法则 DEFAULT_CATEGORY
    - 单选走 normalize_single（subtype 软枚举）
    - 多选（style/season）走 normalize_multi
    - 非匹配品类的专属字段置 None
    """
    cat = (category or "").strip().lower()
    if cat not in VALID_CATEGORIES:
        cat = DEFAULT_CATEGORY

    normalized: dict[str, str | None] = {"category": cat}
    for field in ALL_TAG_FIELDS:
        candidates = FIELD_CANDIDATES[field]
        raw = fields.get(field)
        if field in MULTI_SELECT_FIELDS:
            normalized[field] = normalize_multi(raw, candidates)
        else:
            normalized[field] = normalize_single(
                raw, candidates, soft=(field == "subtype")
            )

    # 非匹配品类的专属字段置 None
    clear_category_specific(cat, normalized)

    return TagOutput(**normalized)
