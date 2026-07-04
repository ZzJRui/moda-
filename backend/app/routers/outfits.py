"""穿搭路由。FRD-API-005 + todo v3 §7.1。

- POST /api/outfits  保存穿搭组合（AI 推荐 / 手动搭配）

校验：
- 三个单品 ID 必须存在
- 三个单品的品类必须分别匹配 top/bottom/shoes 槽位
  （验收「不允许用鞋子 ID 冒充上衣」）
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import ClothingItem, Outfit
from app.schemas import OutfitCreate, OutfitOut
from app.services.tagging_service import VALID_CATEGORIES

router = APIRouter(prefix="/api/outfits", tags=["outfits"])

# 槽位 → 期望品类；用于校验「不允许用鞋子 ID 冒充上衣」
_SLOT_CATEGORY = {
    "top_id": "top",
    "bottom_id": "bottom",
    "shoes_id": "shoes",
}

# 槽位 → 中文标签（错误消息用）
_SLOT_LABEL = {
    "top_id": "上衣",
    "bottom_id": "下装",
    "shoes_id": "鞋子",
}


@router.post("", response_model=OutfitOut, status_code=status.HTTP_201_CREATED)
def create_outfit(payload: OutfitCreate, db: Session = Depends(get_db)) -> OutfitOut:
    # 1. 校验三个单品存在 + 品类匹配槽位
    items: dict[str, ClothingItem] = {}
    for slot, expected_cat in _SLOT_CATEGORY.items():
        item_id = getattr(payload, slot)
        item = db.get(ClothingItem, item_id)
        if item is None:
            raise HTTPException(status_code=404, detail="单品不存在")
        if item.category not in VALID_CATEGORIES or item.category != expected_cat:
            raise HTTPException(
                status_code=400,
                detail=f"{_SLOT_LABEL[slot]} ID 品类不正确",
            )
        items[slot] = item

    # 2. 写库（screenshot_path 由收藏接口回填，此处留空）
    outfit = Outfit(
        top_id=payload.top_id,
        bottom_id=payload.bottom_id,
        shoes_id=payload.shoes_id,
        source=payload.source,
        prompt=payload.prompt,
        reason=payload.reason,
    )
    try:
        db.add(outfit)
        db.commit()
        db.refresh(outfit)
    except Exception:
        db.rollback()
        raise HTTPException(status_code=500, detail="数据库写入失败")

    return OutfitOut.model_validate(outfit)
