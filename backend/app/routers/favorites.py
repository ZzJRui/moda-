"""收藏路由。FRD-API-006~008 + todo v3 §7.2/§7.3。

- POST   /api/favorites       保存收藏截图（multipart：outfit_id + screenshot）
- GET    /api/favorites       收藏列表（按 created_at 倒序，FRD-FV-002）
- GET    /api/favorites/{id}  收藏详情（嵌套穿搭摘要，FRD-API-008）
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Favorite, Outfit
from app.schemas import FavoriteDetail, FavoriteOut, OutfitBrief
from app.services import storage_service

router = APIRouter(prefix="/api/favorites", tags=["favorites"])


@router.post("", response_model=FavoriteOut, status_code=status.HTTP_201_CREATED)
def create_favorite(
    db: Session = Depends(get_db),
    outfit_id: int = Form(...),
    screenshot: UploadFile = File(...),
) -> FavoriteOut:
    # 1. 校验穿搭存在
    outfit = db.get(Outfit, outfit_id)
    if outfit is None:
        raise HTTPException(status_code=404, detail="穿搭不存在")

    # 2. 校验截图扩展名 / MIME / 大小
    try:
        ext = storage_service.validate_extension(screenshot.filename or "")
        storage_service.validate_mime(screenshot)
        data = screenshot.file.read()
        storage_service.validate_size(len(data))
        screenshot.file.seek(0)
    except storage_service.InvalidUploadError as e:
        raise HTTPException(status_code=400, detail=str(e))

    # 3. 落盘到 uploads/favorites/
    filename = storage_service.generate_filename(ext)
    try:
        screenshot_url = storage_service.save_favorite(screenshot, filename)
    except Exception:
        storage_service.delete_favorite_files(filename)
        raise HTTPException(status_code=500, detail="截图保存失败")

    # 4. 创建 favorite 记录 + 回填 outfit.screenshot_path（todo §7.2）
    favorite = Favorite(outfit_id=outfit_id, screenshot_path=screenshot_url)
    outfit.screenshot_path = screenshot_url
    try:
        db.add(favorite)
        db.commit()
        db.refresh(favorite)
    except Exception:
        db.rollback()
        storage_service.delete_favorite_files(filename)
        raise HTTPException(status_code=500, detail="数据库写入失败")

    return FavoriteOut.model_validate(favorite)


@router.get("", response_model=list[FavoriteOut])
def list_favorites(db: Session = Depends(get_db)) -> list[FavoriteOut]:
    # 按保存时间倒序，最新在前（FRD-FV-002）
    query = db.query(Favorite).order_by(Favorite.created_at.desc())
    return [FavoriteOut.model_validate(f) for f in query.all()]


@router.get("/{favorite_id}", response_model=FavoriteDetail)
def get_favorite(favorite_id: int, db: Session = Depends(get_db)) -> FavoriteDetail:
    favorite = db.get(Favorite, favorite_id)
    if favorite is None:
        raise HTTPException(status_code=404, detail="收藏不存在")

    outfit = db.get(Outfit, favorite.outfit_id)
    if outfit is None:
        # 无外键约束的防御性兜底：穿搭被删时收藏成为孤儿
        raise HTTPException(status_code=404, detail="穿搭不存在")

    return FavoriteDetail(
        id=favorite.id,
        screenshot_path=favorite.screenshot_path,
        created_at=favorite.created_at,
        outfit=OutfitBrief.model_validate(outfit),
    )
