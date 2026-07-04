"""数据库模型，字段对齐 FRD v4 第 10 节（扩展标签体系）。

外键约束本阶段未加，保持最小结构；Phase 2/4 视需要补充。

迁移：本阶段无 Alembic，新增列靠 dev 删 ``backend/app/data/closet.db`` 后
``init_db()`` 的 ``create_all`` 重建。已有库不会自动加列。
"""
from __future__ import annotations

from datetime import datetime

from sqlalchemy import Column, DateTime, Integer, String

from app.database import Base


class ClothingItem(Base):
    """单品。FRD v4 10.1。

    标签体系（详见 services/tag_constants.py）：
    - 通用：subtype / color_base / color_tone / pattern / style(多选) /
            fit / season(多选) / formality / material
    - 上衣专属：sleeve_length / top_length / neckline
    - 下装专属：pants_length / waist / pants_shape
    - 鞋子专属：shoe_cut / shoe_type / sole / closure
    - 单选未确定存 "unknown"；多选逗号分隔；非该品类专属字段存 None
    """

    __tablename__ = "clothing_items"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    # top / bottom / shoes
    category = Column(String, nullable=False, index=True)
    # 通用标签
    subtype = Column(String, nullable=True)
    color_base = Column(String, nullable=True)
    color_tone = Column(String, nullable=True)
    pattern = Column(String, nullable=True)
    # 多选，逗号分隔
    style = Column(String, nullable=True)
    fit = Column(String, nullable=True)
    # 多选，逗号分隔
    season = Column(String, nullable=True)
    formality = Column(String, nullable=True)
    material = Column(String, nullable=True)
    # 上衣专属
    sleeve_length = Column(String, nullable=True)
    top_length = Column(String, nullable=True)
    neckline = Column(String, nullable=True)
    # 下装专属
    pants_length = Column(String, nullable=True)
    waist = Column(String, nullable=True)
    pants_shape = Column(String, nullable=True)
    # 鞋子专属
    shoe_cut = Column(String, nullable=True)
    shoe_type = Column(String, nullable=True)
    sole = Column(String, nullable=True)
    closure = Column(String, nullable=True)
    # 图片
    original_image = Column(String, nullable=False)
    processed_image = Column(String, nullable=False)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)


class Outfit(Base):
    """穿搭组合。FRD 10.2。"""

    __tablename__ = "outfits"

    id = Column(Integer, primary_key=True, index=True)
    top_id = Column(Integer, nullable=False, index=True)
    bottom_id = Column(Integer, nullable=False, index=True)
    shoes_id = Column(Integer, nullable=False, index=True)
    # ai / manual
    source = Column(String, nullable=False)
    prompt = Column(String, nullable=True)
    reason = Column(String, nullable=True)
    screenshot_path = Column(String, nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)


class Favorite(Base):
    """收藏截图。FRD 10.3。"""

    __tablename__ = "favorites"

    id = Column(Integer, primary_key=True, index=True)
    outfit_id = Column(Integer, nullable=False, index=True)
    screenshot_path = Column(String, nullable=False)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
