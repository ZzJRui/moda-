"""单品路由。FRD-API-002 / FRD-API-003 + 详情/删除 + AI 重打标签。

- POST   /api/clothes/upload           上传单品（可选 AI 识图补缺标签）
- GET    /api/clothes                  衣柜列表与搜索
- GET    /api/clothes/{id}             单品详情
- DELETE /api/clothes/{id}             删除单品
- POST   /api/clothes/{id}/auto-tag    对已存单品重新 AI 识图打标签
"""
from __future__ import annotations

import mimetypes
import re
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from fastapi.responses import JSONResponse
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app import config
from app.database import get_db
from app.models import ClothingItem
from app.schemas import ClothingItemList, ClothingItemOut
from app.services import (
    ai_client,
    ai_tagging_service,
    image_service,
    storage_service,
    tagging_service,
)

router = APIRouter(prefix="/api/clothes", tags=["clothes"])

# 名称安全字符：字母数字下划线短横 + CJK
_NAME_SAFE = re.compile(r"[^\w一-龥-]+")


def _generate_name(original_filename: str) -> str:
    """从原始文件名 stem 派生可读名称；不可用时回退 '未命名单品'。"""
    stem = Path(original_filename).stem
    stem = _NAME_SAFE.sub("_", stem).strip("_")
    if not stem:
        return "未命名单品"
    return stem[:60]


@router.post(
    "/upload",
    response_model=ClothingItemOut,
    status_code=status.HTTP_201_CREATED,
)
def upload_clothing(
    db: Session = Depends(get_db),
    file: UploadFile = File(...),
    category: str | None = Form(None),
    color: str | None = Form(None),
    style: str | None = Form(None),
) -> ClothingItemOut:
    # 1. 校验扩展名 / MIME / 大小
    try:
        ext = storage_service.validate_extension(file.filename or "")
        storage_service.validate_mime(file)
        data = file.file.read()
        storage_service.validate_size(len(data))
        file.file.seek(0)
    except storage_service.InvalidUploadError as e:
        raise HTTPException(status_code=400, detail=str(e))

    # 2. 落盘 original + 生成 processed
    filename = storage_service.generate_filename(ext)
    try:
        original_url = storage_service.save_original(file, filename)
        processed_url = image_service.process_image(filename)
    except Exception:
        storage_service.delete_files(filename)
        raise HTTPException(status_code=500, detail="图片处理失败")

    # 3. 生成标签：用户全填则走规则；否则 AI 识图补缺，失败降级到规则
    user_tags = {"category": category, "color": color, "style": style}
    all_filled = all(v and v.strip() for v in user_tags.values())

    tagging_status = "manual"
    if config.AI_TAGGING_ENABLED and not all_filled:
        try:
            image_bytes = storage_service.original_fs_path(filename).read_bytes()
            ai_out = ai_tagging_service.tag_with_ai(image_bytes)
            # 合并：用户填的字段优先，AI 补缺
            merged = {
                "category": user_tags["category"] or ai_out.category,
                "color": user_tags["color"] or ai_out.color,
                "style": user_tags["style"] or ai_out.style,
            }
            tags = tagging_service.generate_tags(**merged)
            tagging_status = "ai"
        except (ai_client.AIClientError, ai_tagging_service.AIInvalidResponseError):
            # 降级：不阻断上传，走原规则归一化
            tags = tagging_service.generate_tags(category, color, style)
            tagging_status = "ai_failed"
    else:
        tags = tagging_service.generate_tags(category, color, style)

    # 4. 写库
    item = ClothingItem(
        name=_generate_name(file.filename or ""),
        category=tags.category,
        color=tags.color,
        style=tags.style,
        original_image=original_url,
        processed_image=processed_url,
    )
    try:
        db.add(item)
        db.commit()
        db.refresh(item)
    except Exception:
        db.rollback()
        storage_service.delete_files(filename)
        raise HTTPException(status_code=500, detail="数据库写入失败")

    return ClothingItemOut.model_validate(item).model_copy(
        update={"tagging_status": tagging_status}
    )


@router.get("", response_model=list[ClothingItemList])
def list_clothes(
    db: Session = Depends(get_db),
    q: str | None = None,
    category: str | None = None,
    color: str | None = None,
    style: str | None = None,
) -> list[ClothingItemList]:
    query = db.query(ClothingItem)
    if category:
        query = query.filter(ClothingItem.category == category)
    if color:
        query = query.filter(ClothingItem.color == color)
    if style:
        query = query.filter(ClothingItem.style == style)
    if q:
        kw = f"%{q}%"
        query = query.filter(
            or_(
                ClothingItem.name.ilike(kw),
                ClothingItem.color.ilike(kw),
                ClothingItem.style.ilike(kw),
            )
        )
    query = query.order_by(ClothingItem.created_at.desc())
    return [ClothingItemList.model_validate(i) for i in query.all()]


@router.get("/{item_id}", response_model=ClothingItemOut)
def get_clothing(item_id: int, db: Session = Depends(get_db)) -> ClothingItemOut:
    item = db.get(ClothingItem, item_id)
    if item is None:
        raise HTTPException(status_code=404, detail="单品不存在")
    return ClothingItemOut.model_validate(item)


@router.delete("/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_clothing(item_id: int, db: Session = Depends(get_db)) -> None:
    item = db.get(ClothingItem, item_id)
    if item is None:
        raise HTTPException(status_code=404, detail="单品不存在")
    # 从 URL 路径反解文件名
    orig_name = item.original_image.rsplit("/", 1)[-1]
    proc_name = item.processed_image.rsplit("/", 1)[-1]
    db.delete(item)
    db.commit()
    storage_service.delete_files(orig_name, proc_name)
    return None


@router.post("/{item_id}/auto-tag", response_model=ClothingItemOut)
def auto_tag_clothing(item_id: int, db: Session = Depends(get_db)) -> ClothingItemOut:
    """对已存单品重新 AI 识图打标签。

    显式触发，失败不降级，直接返回顶层 error/message（与推荐接口同款）。
    """
    item = db.get(ClothingItem, item_id)
    if item is None:
        raise HTTPException(status_code=404, detail="单品不存在")

    # 从 original_image URL 反解文件名，读原图字节
    filename = item.original_image.rsplit("/", 1)[-1]
    try:
        image_bytes = storage_service.original_fs_path(filename).read_bytes()
    except OSError:
        raise HTTPException(status_code=500, detail="原图文件读取失败")

    # 推断 MIME（data URL 需要）
    content_type = mimetypes.guess_type(filename)[0] or "image/jpeg"

    try:
        ai_out = ai_tagging_service.tag_with_ai(image_bytes, content_type=content_type)
    except ai_client.AINotConfiguredError:
        return JSONResponse(
            status_code=500,
            content={
                "error": "ai_not_configured",
                "message": "AI 打标签未配置，请检查 AI_API_BASE_URL、AI_API_KEY、AI_MODEL。",
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
                "message": "AI 打标签暂时不可用，请稍后再试。",
            },
        )
    except ai_tagging_service.AIInvalidResponseError:
        return JSONResponse(
            status_code=502,
            content={
                "error": "ai_invalid_response",
                "message": "AI 返回结果无法用于打标签，请重试。",
            },
        )

    # 归一化后写回
    tags = tagging_service.generate_tags(
        ai_out.category, ai_out.color, ai_out.style
    )
    item.category = tags.category
    item.color = tags.color
    item.style = tags.style
    db.commit()
    db.refresh(item)
    return ClothingItemOut.model_validate(item).model_copy(
        update={"tagging_status": "ai"}
    )
