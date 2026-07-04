"""数据库模型，字段对齐 FRD v3 第 10 节。

外键约束本阶段未加，保持与 FRD 一致的最小结构；Phase 2/4 视需要补充。
"""
from __future__ import annotations

from datetime import datetime

from sqlalchemy import Column, DateTime, Integer, String

from app.database import Base


class ClothingItem(Base):
    """单品。FRD 10.1。"""

    __tablename__ = "clothing_items"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    # top / bottom / shoes
    category = Column(String, nullable=False, index=True)
    color = Column(String, nullable=True)
    style = Column(String, nullable=True)
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
