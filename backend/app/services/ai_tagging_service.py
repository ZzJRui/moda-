"""AI 识图打标签业务层（FRD v4 / UP-004 / NF-004 可替换 AI）。

职责：
- 接收已落盘单品的原图字节
- base64 编码为 data URL，构造 vision 多模态 messages
- 调 ai_client.chat_completion（temperature=0.2，分类任务需稳定）
- 解析 JSON：category ∈ {top,bottom,shoes}（非法抛 AIInvalidResponseError），
  其余字段交 tagging_service.generate_tags 归一（DRY，不在本模块重复校验）
- 返回归一化后的 TagOutput

不持有 DB 会话、不读盘文件（字节由调用方传入），纯函数风格，便于测试。
网络/鉴权/配置错误由 ai_client 抛，router 映射。
"""
from __future__ import annotations

import base64
import json
import re

from app.schemas import TagOutput
from app.services import ai_client, tagging_service
from app.services.tag_constants import (
    ALL_TAG_FIELDS,
    CATEGORY_SPECIFIC_FIELDS,
    FIELD_CANDIDATES,
    MULTI_SELECT_FIELDS,
    SUBTYPES,
    UNKNOWN,
    VALID_CATEGORIES,
)


class AIInvalidResponseError(Exception):
    """AI 返回结果无法用作标签（非 JSON / 缺 category / 品类非法）。"""


# 支持的图片 MIME（与 ALLOWED_IMAGE_EXTS 对齐）
_MIME_FOR_EXT: dict[str, str] = {
    "jpg": "image/jpeg",
    "jpeg": "image/jpeg",
    "png": "image/png",
    "webp": "image/webp",
}


def _build_system_prompt() -> str:
    """从 tag_constants 动态生成 system prompt，避免候选清单漂移。"""
    # 通用字段说明
    general_lines: list[str] = []
    spec_lines: list[str] = []
    for field in ALL_TAG_FIELDS:
        candidates = FIELD_CANDIDATES[field]
        is_multi = field in MULTI_SELECT_FIELDS
        if field == "subtype":
            # subtype 软枚举：列三品类建议，允许超出
            sug = "；".join(
                f"{cat}：{'/'.join(SUBTYPES[cat])}" for cat in VALID_CATEGORIES
            )
            general_lines.append(
                f"- subtype（单选，软枚举，可超出建议）：细分类。建议：{sug}"
            )
            continue
        cand = "/".join(candidates)
        kind = "多选，逗号分隔" if is_multi else "单选"
        if field in CATEGORY_SPECIFIC_FIELDS.get("top", ()):
            spec_lines.append(f"  - 上衣：{field}（{kind}）：{cand}")
        elif field in CATEGORY_SPECIFIC_FIELDS.get("bottom", ()):
            spec_lines.append(f"  - 下装：{field}（{kind}）：{cand}")
        elif field in CATEGORY_SPECIFIC_FIELDS.get("shoes", ()):
            spec_lines.append(f"  - 鞋子：{field}（{kind}）：{cand}")
        else:
            general_lines.append(f"- {field}（{kind}）：{cand}")

    # 输出字段顺序：category + 通用 + 全部专属（模型按品类填专属，其余给 null）
    field_names = ["category"] + list(ALL_TAG_FIELDS)
    sample = json.dumps({f: "..." for f in field_names}, ensure_ascii=False)

    return (
        "你是服装识别助手。看图识别这件单品并打标签。只能从下列候选值中选择，"
        f"看不清的字段填 \"{UNKNOWN}\"。\n"
        "通用字段：\n" + "\n".join(general_lines) + "\n"
        "品类专属字段（只填与 category 匹配的品类，其余给 null）：\n"
        + "\n".join(spec_lines) + "\n"
        "规则：\n"
        f"- category 只能是 top/bottom/shoes 三选一\n"
        f"- 多选字段用逗号分隔（如 style=\"休闲,运动\"）\n"
        f"- subtype 可超出建议候选，保留模型识别出的具体类目\n"
        "- 必须只返回一个 JSON 对象，不要任何解释或多余文本，格式为：\n"
        f"{sample}"
    )


def tag_with_ai(image_bytes: bytes, content_type: str = "image/jpeg") -> TagOutput:
    """AI 识图打标签主入口。

    - image_bytes：原图字节（由调用方从 original_fs_path 读取）
    - content_type：图片 MIME，用于拼 data URL；默认 image/jpeg
    - 返回归一化后的 TagOutput
    - 网络/鉴权/配置错误由 ai_client 抛；结果非法抛 AIInvalidResponseError
    """
    # 1. base64 编码为 data URL
    b64 = base64.b64encode(image_bytes).decode("ascii")
    data_url = f"data:{content_type};base64,{b64}"

    # 2. 构造多模态 messages（user content 为分片数组）
    messages = [
        {"role": "system", "content": _build_system_prompt()},
        {
            "role": "user",
            "content": [
                {"type": "text", "text": "识别这张图中单品并按候选值打全标签。"},
                {"type": "image_url", "image_url": {"url": data_url}},
            ],
        },
    ]

    # 3. 调模型（分类任务用低温度）
    raw = ai_client.chat_completion(messages, temperature=0.2)

    # 4. 解析 JSON（容忍 ```json``` 围栏）
    data = _parse_json(raw)

    # 5. 校验 category；其余字段交 generate_tags 归一
    if not isinstance(data, dict):
        raise AIInvalidResponseError("AI 返回不是 JSON 对象")
    category = data.get("category")
    if not isinstance(category, str) or category.strip().lower() not in VALID_CATEGORIES:
        raise AIInvalidResponseError(f"AI 返回 category 非法：{category!r}")

    # 只取已知标签字段，忽略模型多余键
    fields = {f: data.get(f) for f in ALL_TAG_FIELDS}
    return tagging_service.generate_tags(category=category.strip().lower(), **fields)


def _parse_json(raw: str) -> object:
    """从模型文本中提取 JSON 对象。

    容忍 ```json ... ``` 围栏和前后空白；解析失败抛 AIInvalidResponseError。
    与 ai_recommendation_service._parse_json 同形，保持模块解耦不抽取。
    """
    if not isinstance(raw, str) or not raw.strip():
        raise AIInvalidResponseError("AI 返回为空")
    text = raw.strip()
    fence = re.match(r"^```(?:json)?\s*(.*?)\s*```$", text, re.DOTALL)
    if fence:
        text = fence.group(1).strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError as e:
        raise AIInvalidResponseError(f"AI 返回不是合法 JSON：{e.msg}") from e
