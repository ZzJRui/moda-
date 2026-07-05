"""tag_constants 归一化辅助 + tagging_service.generate_tags 边界单测。FRD v4。"""
from __future__ import annotations

from app.services import tagging_service
from app.services.tag_constants import (
    clear_category_specific,
    normalize_multi,
    normalize_single,
)


# ---------------- normalize_single ----------------

def test_normalize_single_known():
    assert normalize_single("白色", ("白色", "黑色")) == "白色"


def test_normalize_single_unknown_value():
    assert normalize_single("粉色", ("白色", "黑色")) == "unknown"


def test_normalize_single_empty():
    assert normalize_single("", ("白色",)) == "unknown"
    assert normalize_single(None, ("白色",)) == "unknown"
    assert normalize_single("   ", ("白色",)) == "unknown"


def test_normalize_single_soft_keeps_value():
    # subtype 软枚举：表外值保留
    assert normalize_single("卫衣", (), soft=True) == "卫衣"


def test_normalize_single_soft_empty_to_unknown():
    assert normalize_single(None, (), soft=True) == "unknown"
    assert normalize_single("", (), soft=True) == "unknown"


# ---------------- normalize_multi ----------------

def test_normalize_multi_basic():
    assert normalize_multi("休闲,运动", ("休闲", "运动", "通勤")) == "休闲,运动"


def test_normalize_multi_dedup_and_filter():
    assert normalize_multi("休闲,休闲,粉色,运动", ("休闲", "运动")) == "休闲,运动"


def test_normalize_multi_empty():
    assert normalize_multi(None, ("休闲",)) == "unknown"
    assert normalize_multi("", ("休闲",)) == "unknown"
    assert normalize_multi("粉色", ("休闲",)) == "unknown"  # 全过滤后空


def test_normalize_multi_preserves_unknown_token():
    assert normalize_multi("unknown", ("休闲",)) == "unknown"


def test_normalize_multi_order_stable():
    assert normalize_multi("运动,休闲", ("休闲", "运动")) == "运动,休闲"


# ---------------- clear_category_specific ----------------

def test_clear_category_specific_top():
    payload = {
        "sleeve_length": "短袖", "top_length": "常规", "neckline": "圆领",
        "pants_length": "长裤", "waist": "中腰", "pants_shape": "直筒",
        "shoe_cut": "低帮",
        "color_base": "白色",
    }
    clear_category_specific("top", payload)
    assert payload["sleeve_length"] == "短袖"  # 保留
    assert payload["color_base"] == "白色"     # 通用保留
    assert payload["pants_length"] is None     # bottom 专属清空
    assert payload["shoe_cut"] is None          # shoes 专属清空


# ---------------- generate_tags ----------------

def test_generate_tags_invalid_category_defaults():
    out = tagging_service.generate_tags(category="hat", color_base="白色")
    assert out.category == "top"
    assert out.color_base == "白色"


def test_generate_tags_normalizes_all_fields():
    out = tagging_service.generate_tags(
        category="top",
        subtype="T恤",
        color_base="白色",
        color_tone="浅色系",
        pattern="纯色",
        style="休闲,运动",
        fit="常规",
        season="春秋,夏季",
        formality="日常",
        material="棉",
        sleeve_length="短袖",
    )
    assert out.category == "top"
    assert out.style == "休闲,运动"
    assert out.season == "春秋,夏季"
    assert out.sleeve_length == "短袖"
    # bottom/shoes 专属应被清空
    assert out.pants_length is None
    assert out.shoe_cut is None


def test_generate_tags_unknown_for_unsupplied():
    out = tagging_service.generate_tags(category="top")
    assert out.color_base == "unknown"
    assert out.style == "unknown"
    assert out.sleeve_length == "unknown"
    # 非 top 品类专属仍是 None
    assert out.pants_length is None
    assert out.shoe_cut is None


def test_generate_tags_soft_subtype_outside_candidates():
    out = tagging_service.generate_tags(category="top", subtype="卫衣")
    # 卫衣不在 SUBTYPES_TOP 候选里，软枚举保留原值
    assert out.subtype == "卫衣"


def test_generate_tags_clears_specific_on_category_switch():
    out = tagging_service.generate_tags(
        category="shoes",
        sleeve_length="短袖",  # 上衣专属，应被清空
        shoe_cut="低帮",
    )
    assert out.category == "shoes"
    assert out.sleeve_length is None
    assert out.shoe_cut == "低帮"


# ---------------- compose_display_name ----------------

def test_compose_display_name_full():
    tags = tagging_service.generate_tags(
        category="top", subtype="T恤", color_base="白色"
    )
    assert tagging_service.compose_display_name(tags) == "白色T恤"


def test_compose_display_name_only_color():
    # subtype 未识别（unknown）时只用颜色
    tags = tagging_service.generate_tags(category="bottom", color_base="黑色")
    assert tagging_service.compose_display_name(tags) == "黑色"


def test_compose_display_name_only_subtype():
    # 颜色未识别时只用 subtype
    tags = tagging_service.generate_tags(category="shoes", subtype="运动鞋")
    assert tagging_service.compose_display_name(tags) == "运动鞋"


def test_compose_display_name_fallback_by_category():
    # 颜色和 subtype 都 unknown → 品类默认名
    assert (
        tagging_service.compose_display_name(
            tagging_service.generate_tags(category="top")
        )
        == "上衣"
    )
    assert (
        tagging_service.compose_display_name(
            tagging_service.generate_tags(category="bottom")
        )
        == "下装"
    )
    assert (
        tagging_service.compose_display_name(
            tagging_service.generate_tags(category="shoes")
        )
        == "鞋子"
    )


def test_compose_display_name_soft_subtype_kept():
    # subtype 软枚举：表外值直接拼入名称
    tags = tagging_service.generate_tags(
        category="top", subtype="汉服", color_base="红色"
    )
    assert tagging_service.compose_display_name(tags) == "红色汉服"
