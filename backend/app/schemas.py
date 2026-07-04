"""Pydantic 请求/响应模型，独立于 SQLAlchemy 模型。

- TagOutput：tagging_service 返回的归一化标签（服务层 DTO，非响应模型）
- ClothingItemOut：单品完整响应（upload 与 GET /{id} 共用）
- ClothingItemList：列表瘦身响应
- DeletedAck：DELETE 成功响应（当前走 204，此模型备用）
- OutfitCreate / OutfitOut：穿搭保存入参 / 响应（FRD-API-005）
- FavoriteOut / FavoriteDetail / OutfitBrief：收藏响应（FRD-API-006~008）
"""
from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, field_serializer


class TagOutput(BaseModel):
    """tagging_service 返回的归一化标签（v4 扩展标签体系）。

    通用 + 品类专属字段；单选未确定存 "unknown"，多选逗号分隔，
    非该品类专属字段为 None。详见 services/tag_constants.py。
    """

    category: str
    subtype: str | None = None
    color_base: str | None = None
    color_tone: str | None = None
    pattern: str | None = None
    style: str | None = None
    fit: str | None = None
    season: str | None = None
    formality: str | None = None
    material: str | None = None
    # 上衣专属
    sleeve_length: str | None = None
    top_length: str | None = None
    neckline: str | None = None
    # 下装专属
    pants_length: str | None = None
    waist: str | None = None
    pants_shape: str | None = None
    # 鞋子专属
    shoe_cut: str | None = None
    shoe_type: str | None = None
    sole: str | None = None
    closure: str | None = None


class ClothingItemOut(BaseModel):
    """单品完整响应（upload 与详情）。含全部标签字段。"""

    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    category: str
    subtype: str | None = None
    color_base: str | None = None
    color_tone: str | None = None
    pattern: str | None = None
    style: str | None = None
    fit: str | None = None
    season: str | None = None
    formality: str | None = None
    material: str | None = None
    sleeve_length: str | None = None
    top_length: str | None = None
    neckline: str | None = None
    pants_length: str | None = None
    waist: str | None = None
    pants_shape: str | None = None
    shoe_cut: str | None = None
    shoe_type: str | None = None
    sole: str | None = None
    closure: str | None = None
    original_image: str
    processed_image: str
    created_at: datetime
    # 标签来源提示（仅上传/auto-tag 响应里赋值，ORM 无此列，GET 详情时为 None）：
    # ai=AI 识图成功 / ai_failed=AI 失败降级（category 默认、其余 unknown）
    tagging_status: str | None = None

    @field_serializer("created_at")
    def _ser_created_at(self, v: datetime) -> str:
        return v.isoformat()


class ClothingItemList(BaseModel):
    """列表项：仅含卡片展示所需字段（省略 material、品类专属字段、原图与时间）。"""

    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    category: str
    subtype: str | None = None
    color_base: str | None = None
    color_tone: str | None = None
    pattern: str | None = None
    style: str | None = None
    fit: str | None = None
    season: str | None = None
    formality: str | None = None
    processed_image: str


class DeletedAck(BaseModel):
    """DELETE 成功响应体（当前 DELETE 走 204，此模型备用）。"""

    deleted: int


class RecommendationRequest(BaseModel):
    """推荐接口入参（FRD-API-004）。"""

    text: str


class RecommendationOut(BaseModel):
    """推荐接口成功响应（FRD-API-004）。四个键，ID 仅引用已存在单品。"""

    top_id: int
    bottom_id: int
    shoes_id: int
    reason: str


class MissingCategoryOut(BaseModel):
    """推荐接口缺品类响应（FRD-API-004）。

    注意：实际出口为 JSONResponse 顶层字段（不包 detail），此模型仅作
    OpenAPI 文档与内部复用。
    """

    error: str = "missing_category"
    message: str
    missing_categories: list[str]


class OutfitCreate(BaseModel):
    """穿搭保存入参（FRD-API-005）。

    - source 用 Literal 在 schema 层挡掉非法值（自动 422）
    - prompt / reason 可选：手动搭配可省略 prompt
    """

    top_id: int
    bottom_id: int
    shoes_id: int
    source: Literal["ai", "manual"]
    prompt: str | None = None
    reason: str | None = None


class OutfitOut(BaseModel):
    """穿搭响应（FRD-API-005）。screenshot_path 创建时为 null，后由收藏接口回填。"""

    model_config = ConfigDict(from_attributes=True)

    id: int
    top_id: int
    bottom_id: int
    shoes_id: int
    source: str
    prompt: str | None = None
    reason: str | None = None
    screenshot_path: str | None = None
    created_at: datetime

    @field_serializer("created_at")
    def _ser_created_at(self, v: datetime) -> str:
        return v.isoformat()


class OutfitBrief(BaseModel):
    """收藏详情内嵌的穿搭摘要（FRD-API-008 outfit 子对象，不含 screenshot_path）。"""

    model_config = ConfigDict(from_attributes=True)

    id: int
    source: str
    prompt: str | None = None
    reason: str | None = None
    top_id: int
    bottom_id: int
    shoes_id: int


class FavoriteOut(BaseModel):
    """收藏响应（FRD-API-006 返回 / 列表项）。"""

    model_config = ConfigDict(from_attributes=True)

    id: int
    outfit_id: int
    screenshot_path: str
    created_at: datetime

    @field_serializer("created_at")
    def _ser_created_at(self, v: datetime) -> str:
        return v.isoformat()


class FavoriteDetail(BaseModel):
    """收藏详情响应（FRD-API-008）。嵌套穿搭摘要。"""

    id: int
    screenshot_path: str
    created_at: datetime
    outfit: OutfitBrief

    @field_serializer("created_at")
    def _ser_created_at(self, v: datetime) -> str:
        return v.isoformat()
