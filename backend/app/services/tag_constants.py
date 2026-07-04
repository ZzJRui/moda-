"""标签候选值与归一化辅助（v4 标签体系）。

单一来源：所有模块从这里取候选值与字段定义，不各自硬编码。
- 通用字段 + 上衣/下装/鞋子专属字段
- 单选字段未确定一律存 ``"unknown"``；多选字段逗号分隔存储，空亦存 ``"unknown"``
- ``subtype`` 为软枚举：候选仅作建议，表外值原样保留，不转 ``"unknown"``
- 非该品类的专属字段存 ``None``（不适用，区别于 "unknown"）
"""
from __future__ import annotations

# --- 品类 ---
VALID_CATEGORIES: tuple[str, ...] = ("top", "bottom", "shoes")
DEFAULT_CATEGORY: str = "top"
UNKNOWN: str = "unknown"

# --- 通用单选候选 ---
COLOR_BASES: tuple[str, ...] = ("黑色", "白色", "灰色", "蓝色", "红色", "棕色", "米色")
COLOR_TONES: tuple[str, ...] = ("浅色系", "深色系", "中性色", "亮色系", "低饱和色")
PATTERNS: tuple[str, ...] = ("纯色", "拼色", "条纹", "格纹", "印花", "大图案", "渐变")
FITS: tuple[str, ...] = ("修身", "常规", "宽松", "oversize")
FORMALITIES: tuple[str, ...] = ("居家", "日常", "通勤", "半正式", "正式")
MATERIALS: tuple[str, ...] = ("棉", "牛仔", "针织", "皮革", "帆布", "网面", "西装面料")

# --- 通用多选候选 ---
STYLES: tuple[str, ...] = ("休闲", "运动", "通勤", "街头", "甜酷", "简约", "韩系", "美式")
SEASONS: tuple[str, ...] = ("春秋", "夏季", "冬季", "四季")

# --- subtype 软枚举建议（按品类） ---
SUBTYPES_TOP: tuple[str, ...] = (
    "T恤", "衬衫", "卫衣", "毛衣", "针织衫", "背心",
    "外套", "夹克", "大衣", "西装外套", "风衣",
)
SUBTYPES_BOTTOM: tuple[str, ...] = (
    "牛仔裤", "休闲裤", "西装裤", "运动裤", "阔腿裤",
    "短裤", "半裙", "长裙", "连衣裙",
)
SUBTYPES_SHOES: tuple[str, ...] = (
    "运动鞋", "休闲鞋", "板鞋", "老爹鞋",
    "皮鞋", "靴子", "凉鞋", "高跟鞋",
)

# --- 上衣专属 ---
SLEEVE_LENGTHS: tuple[str, ...] = ("无袖", "短袖", "五分袖", "长袖")
TOP_LENGTHS: tuple[str, ...] = ("短款", "常规", "长款", "露脐")
NECKLINES: tuple[str, ...] = ("圆领", "V领", "翻领", "高领", "连帽", "方领")

# --- 下装专属 ---
PANTS_LENGTHS: tuple[str, ...] = ("短裤", "五分裤", "九分裤", "长裤")
WAISTS: tuple[str, ...] = ("低腰", "中腰", "高腰")
PANTS_SHAPES: tuple[str, ...] = ("修身", "直筒", "宽松", "阔腿", "束脚", "喇叭")

# --- 鞋子专属 ---
SHOE_CUTS: tuple[str, ...] = ("低帮", "中帮", "高帮")
SHOE_TYPES: tuple[str, ...] = (
    "运动鞋", "休闲鞋", "皮鞋", "靴子", "凉鞋", "板鞋", "老爹鞋"
)
SOLES: tuple[str, ...] = ("平底", "厚底", "运动缓震")
CLOSURES: tuple[str, ...] = ("系带", "魔术贴", "一脚蹬", "拉链")

# subtype 候选按品类（仅用于 AI prompt 建议）
SUBTYPES: dict[str, tuple[str, ...]] = {
    "top": SUBTYPES_TOP,
    "bottom": SUBTYPES_BOTTOM,
    "shoes": SUBTYPES_SHOES,
}

# 字段 → 候选；subtype → () 表示软枚举（候选仅建议，不强制）
FIELD_CANDIDATES: dict[str, tuple[str, ...]] = {
    "subtype": (),
    "color_base": COLOR_BASES,
    "color_tone": COLOR_TONES,
    "pattern": PATTERNS,
    "style": STYLES,
    "fit": FITS,
    "season": SEASONS,
    "formality": FORMALITIES,
    "material": MATERIALS,
    "sleeve_length": SLEEVE_LENGTHS,
    "top_length": TOP_LENGTHS,
    "neckline": NECKLINES,
    "pants_length": PANTS_LENGTHS,
    "waist": WAISTS,
    "pants_shape": PANTS_SHAPES,
    "shoe_cut": SHOE_CUTS,
    "shoe_type": SHOE_TYPES,
    "sole": SOLES,
    "closure": CLOSURES,
}

# 品类 → 专属字段
CATEGORY_SPECIFIC_FIELDS: dict[str, tuple[str, ...]] = {
    "top": ("sleeve_length", "top_length", "neckline"),
    "bottom": ("pants_length", "waist", "pants_shape"),
    "shoes": ("shoe_cut", "shoe_type", "sole", "closure"),
}

# 除 category 外全部标签字段（有序，供 prompt 构造与回写复用）
ALL_TAG_FIELDS: tuple[str, ...] = tuple(FIELD_CANDIDATES.keys())

MULTI_SELECT_FIELDS: tuple[str, ...] = ("style", "season")
SINGLE_SELECT_FIELDS: tuple[str, ...] = tuple(
    f for f in ALL_TAG_FIELDS if f not in MULTI_SELECT_FIELDS
)

# 品类专属字段并集（用于判断某字段是否品类绑定）
_CATEGORY_SPECIFIC_ALL: frozenset[str] = frozenset().union(*CATEGORY_SPECIFIC_FIELDS.values())


def normalize_single(
    value: str | None, candidates: tuple[str, ...], *, soft: bool = False
) -> str | None:
    """归一化单选字段。

    - 空 / None → ``"unknown"``（不区分未提供与看不清）
    - 在候选内 → 值
    - 不在候选 → ``"unknown"``；``soft=True`` 时保留原值（软枚举）
    """
    if value is None:
        return UNKNOWN
    v = value.strip() if isinstance(value, str) else str(value).strip()
    if not v:
        return UNKNOWN
    if soft:
        return v
    return v if v in candidates else UNKNOWN


def normalize_multi(value: str | None, candidates: tuple[str, ...]) -> str:
    """归一化多选字段（逗号分隔存储）。

    - 按逗号分割、strip、按出现序去重、过滤候选外值
    - ``"unknown"`` 原样保留
    - 结果空 → ``"unknown"``
    """
    if value is None:
        return UNKNOWN
    v = value if isinstance(value, str) else str(value)
    parts: list[str] = []
    seen: set[str] = set()
    for p in v.split(","):
        p = p.strip()
        if not p or p in seen:
            continue
        if p == UNKNOWN or p in candidates:
            parts.append(p)
            seen.add(p)
    return ",".join(parts) if parts else UNKNOWN


def clear_category_specific(category: str, payload: dict[str, str | None]) -> dict[str, str | None]:
    """把非匹配品类的专属字段置 None（就地修改并返回）。"""
    for cat, fields in CATEGORY_SPECIFIC_FIELDS.items():
        if cat == category:
            continue
        for f in fields:
            payload[f] = None
    return payload


def is_category_specific(field: str) -> bool:
    """字段是否绑定某个品类。"""
    return field in _CATEGORY_SPECIFIC_ALL
