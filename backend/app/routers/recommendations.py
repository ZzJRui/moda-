"""推荐路由。FRD-API-004 / FRD-NF-004。

- POST /api/recommendations/outfit  根据文字推荐穿搭

默认走真实 AI（OpenAI-compatible）；AI 失败返回明确错误，不静默回退规则。
AI_RECOMMENDATION_PROVIDER=rule 时走本地规则推荐（调试/离线）。
"""
from __future__ import annotations

from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from app import config
from app.database import get_db
from app.models import ClothingItem
from app.schemas import RecommendationOut, RecommendationRequest
from app.services import ai_client, ai_recommendation_service, recommendation_service

router = APIRouter(prefix="/api/recommendations", tags=["recommendations"])


@router.post("/outfit", response_model=RecommendationOut)
def recommend_outfit(
    req: RecommendationRequest,
    db: Session = Depends(get_db),
) -> RecommendationOut:
    """根据用户文本从衣柜中挑选 top/bottom/shoes 各一件。"""
    items = db.query(ClothingItem).all()
    try:
        if config.AI_RECOMMENDATION_PROVIDER == "rule":
            out = recommendation_service.recommend(items, req.text)
        else:
            out = ai_recommendation_service.recommend_with_ai(items, req.text)
        return out
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
    except ai_client.AINotConfiguredError:
        return JSONResponse(
            status_code=500,
            content={
                "error": "ai_not_configured",
                "message": "AI 推荐未配置，请检查 AI_API_BASE_URL、AI_API_KEY、AI_MODEL。",
            },
        )
    except ai_client.AIAuthFailedError:
        return JSONResponse(
            status_code=401,
            content={
                "error": "ai_auth_failed",
                "message": "AI 鉴权失败，请检查 API Key。",
            },
        )
    except ai_client.AIUnavailableError:
        return JSONResponse(
            status_code=503,
            content={
                "error": "ai_unavailable",
                "message": "AI 推荐暂时不可用，请检查模型接口、API Key 或稍后再试。",
            },
        )
    except ai_recommendation_service.AIInvalidResponseError:
        return JSONResponse(
            status_code=502,
            content={
                "error": "ai_invalid_response",
                "message": "AI 返回结果无法用于当前衣柜，请重试。",
            },
        )
