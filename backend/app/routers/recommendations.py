"""推荐路由。FRD-API-004。

- POST /api/recommendations/outfit  根据文字推荐穿搭
"""
from __future__ import annotations

from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import ClothingItem
from app.schemas import RecommendationOut, RecommendationRequest
from app.services import recommendation_service

router = APIRouter(prefix="/api/recommendations", tags=["recommendations"])


@router.post("/outfit", response_model=RecommendationOut)
def recommend_outfit(
    req: RecommendationRequest,
    db: Session = Depends(get_db),
) -> RecommendationOut:
    """根据用户文本从衣柜中挑选 top/bottom/shoes 各一件。"""
    items = db.query(ClothingItem).all()
    try:
        return recommendation_service.recommend(items, req.text)
    except recommendation_service.MissingCategoryError as e:
        # FRD-API-004 要求顶层 error/message/missing_categories，
        # 不走 HTTPException 的 detail 包裹，直接返回 JSONResponse。
        return JSONResponse(
            status_code=422,
            content={
                "error": "missing_category",
                "message": e.message,
                "missing_categories": e.missing_categories,
            },
        )
