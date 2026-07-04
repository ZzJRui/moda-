"""单品路由。FRD-API-002 / FRD-API-003 + 详情/删除。

- POST   /api/clothes/upload   上传单品
- GET    /api/clothes          衣柜列表与搜索
- GET    /api/clothes/{id}     单品详情
- DELETE /api/clothes/{id}     删除单品
"""
from __future__ import annotations

import re
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import ClothingItem
from app.schemas import ClothingItemList, ClothingItemOut
from app.services import image_service, storage_service, tagging_service

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

    # 3. 生成标签
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

    return ClothingItemOut.model_validate(item)


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
