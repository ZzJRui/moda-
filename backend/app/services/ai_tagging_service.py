"""AI 识图打标签业务层（FRD-UP-004 / FRD-NF-004 可替换 AI）。

职责：
- 接收已落盘单品的原图字节
- base64 编码为 data URL，构造 vision 多模态 messages
- 调 ai_client.chat_completion（temperature=0.2，分类任务需稳定）
- 解析并校验 JSON：category ∈ {top,bottom,shoes}，color/style 空串转 None
- 非法结果抛 AIInvalidResponseError，不凑合

不持有 DB 会话、不读盘文件（字节由调用方传入），纯函数风格，便于测试。
网络/鉴权/配置错误由 ai_client 抛，router 映射。
"""
from __future__ import annotations

import base64
import json
import re

from app.schemas import TagOutput
from app.services import ai_client
from app.services.tagging_service import VALID_CATEGORIES


class AIInvalidResponseError(Exception):
    """AI 返回结果无法用作标签（非 JSON / 缺键 / 品类非法）。"""


# system prompt：约束模型只回纯 JSON，品类三选一
_SYSTEM_PROMPT = (
    "你是服装识别助手。看图识别这件单品的品类、主色、风格。"
    "category 只能是 top（上衣）、bottom（下装）、shoes（鞋子）三选一。"
    "color 用一个中文短词描述主色（如白色、黑色、蓝色），识别不出给空串。"
    "style 用一个中文短词描述风格（如休闲、通勤、运动），识别不出给空串。"
    "必须只返回一个 JSON 对象，不要任何解释或多余文本，格式为："
    '{"category": "top|bottom|shoes", "color": "...", "style": "..."}'
)

# 支持的图片 MIME（与 ALLOWED_IMAGE_EXTS 对齐）
_MIME_FOR_EXT: dict[str, str] = {
    "jpg": "image/jpeg",
    "jpeg": "image/jpeg",
    "png": "image/png",
    "webp": "image/webp",
}


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
        {"role": "system", "content": _SYSTEM_PROMPT},
        {
            "role": "user",
            "content": [
                {"type": "text", "text": "识别这张图中单品的品类、颜色、风格。"},
                {"type": "image_url", "image_url": {"url": data_url}},
            ],
        },
    ]

    # 3. 调模型（分类任务用低温度）
    raw = ai_client.chat_completion(messages, temperature=0.2)

    # 4. 解析 JSON（容忍 ```json``` 围栏）
    data = _parse_json(raw)

    # 5. 校验
    if not isinstance(data, dict):
        raise AIInvalidResponseError("AI 返回不是 JSON 对象")
    category = data.get("category")
    if not isinstance(category, str) or category.strip().lower() not in VALID_CATEGORIES:
        raise AIInvalidResponseError(
            f"AI 返回 category 非法：{category!r}"
        )
    color = data.get("color")
    style = data.get("style")
    color = color.strip() if isinstance(color, str) and color.strip() else None
    style = style.strip() if isinstance(style, str) and style.strip() else None

    return TagOutput(
        category=category.strip().lower(),
        color=color,
        style=style,
    )


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
