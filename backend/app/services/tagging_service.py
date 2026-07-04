"""标签归一化服务（FRD-UP-004）。

- 校验 category ∈ {top,bottom,shoes}，缺失/非法则取默认 top
- color/style 可选，缺失或空串视为 None
- 返回结构稳定，便于后续替换真实模型（FRD-NF-004）
"""
from __future__ import annotations

from app.schemas import TagOutput

VALID_CATEGORIES: tuple[str, ...] = ("top", "bottom", "shoes")
DEFAULT_CATEGORY: str = "top"


def generate_tags(
    category: str | None,
    color: str | None,
    style: str | None,
) -> TagOutput:
    """归一化并返回 TagOutput。

    - category 去首尾空白小写，非法则 DEFAULT_CATEGORY
    - color/style 去首尾空白，空串视为 None
    """
    cat = (category or "").strip().lower()
    if cat not in VALID_CATEGORIES:
        cat = DEFAULT_CATEGORY
    col = (color or "").strip() or None
    sty = (style or "").strip() or None
    return TagOutput(category=cat, color=col, style=sty)
