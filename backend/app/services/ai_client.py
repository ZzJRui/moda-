"""AI 模型传输层（OpenAI-compatible /chat/completions）。

职责：
- 只负责调用第三方模型接口，返回模型文本内容
- 不关心业务（衣柜、品类、JSON 解析在 ai_recommendation_service）
- 不在日志/异常文本里打印 API Key

异常体系（router 捕获并映射为 HTTP）：
- AINotConfiguredError  → 500 ai_not_configured
- AIAuthFailedError     → 401 ai_auth_failed（HTTP 401/403）
- AIUnavailableError    → 503 ai_unavailable（超时/网络/其他非 2xx）
"""
from __future__ import annotations

from typing import Any

import httpx

from app import config


class AIClientError(Exception):
    """AI 客户端错误基类。"""


class AINotConfiguredError(AIClientError):
    """缺少 base_url / api_key / model，无法发起调用。"""


class AIAuthFailedError(AIClientError):
    """模型接口返回 401/403，鉴权失败。"""


class AIUnavailableError(AIClientError):
    """超时、网络错误或非 2xx（非鉴权）响应。"""


def chat_completion(
    messages: list[dict[str, Any]],
    *,
    model: str | None = None,
    temperature: float = 0.6,
) -> str:
    """调用 /chat/completions，返回 choices[0].message.content 文本。

    messages 既支持纯文本（content 为 str），也支持多模态分片
    （content 为 [{"type":"text",...},{"type":"image_url",...}] 列表），
    由调用方按需构造；本层只做透传。

    - 配置读取自 config.AI_API_BASE_URL / AI_API_KEY / AI_MODEL，缺任一抛 AINotConfiguredError
    - httpx 超时/连接错误 → AIUnavailableError
    - HTTP 401/403 → AIAuthFailedError
    - 其他非 2xx → AIUnavailableError
    """
    base_url = config.AI_API_BASE_URL
    api_key = config.AI_API_KEY
    use_model = model or config.AI_MODEL
    if not base_url or not api_key or not use_model:
        raise AINotConfiguredError(
            "AI 推荐未配置：缺少 AI_API_BASE_URL / AI_API_KEY / AI_MODEL"
        )

    url = (
        base_url
        if base_url.rstrip("/").endswith("/chat/completions")
        else f"{base_url.rstrip('/')}/chat/completions"
    )
    payload: dict[str, Any] = {
        "model": use_model,
        "messages": messages,
        "temperature": temperature,
    }

    try:
        with httpx.Client(timeout=config.AI_TIMEOUT_SECONDS) as client:
            resp = client.post(
                url,
                json=payload,
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
            )
    except httpx.TimeoutException as e:
        raise AIUnavailableError(f"AI 请求超时：{type(e).__name__}") from e
    except httpx.HTTPError as e:
        # 连接错误、解析错误等网络层异常
        raise AIUnavailableError(f"AI 请求失败：{type(e).__name__}") from e

    if resp.status_code in (401, 403):
        raise AIAuthFailedError(f"AI 鉴权失败：HTTP {resp.status_code}")
    if resp.status_code >= 400:
        raise AIUnavailableError(f"AI 接口异常：HTTP {resp.status_code}")

    data = resp.json()
    try:
        return data["choices"][0]["message"]["content"]
    except (KeyError, IndexError, TypeError) as e:
        raise AIUnavailableError("AI 响应结构异常：缺少 choices[0].message.content") from e
