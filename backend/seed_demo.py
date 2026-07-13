"""开发用：从仓库根 `衣橱/` 样例图种子化衣柜数据，便于前端视觉联调。

用法：venv\Scripts\python.exe seed_demo.py
可重复执行：已有同名单品时跳过。
"""
from __future__ import annotations

import shutil
import uuid
from pathlib import Path

from app.config import ensure_runtime_dirs, UPLOAD_DIR
from app.database import SessionLocal, init_db
from app.models import ClothingItem

REPO_ROOT = Path(__file__).resolve().parent.parent
CLOSET_DIR = REPO_ROOT / "衣橱" / "衣橱" / "女"

# (子目录, category, 中文名前缀, 标签)
SOURCES = [
    ("上衣", "top", "上衣", dict(subtype="t_shirt", color_base="white", color_tone="light",
                                pattern="solid", style="casual", fit="regular",
                                season="spring,summer", formality="casual", material="cotton")),
    ("裤子", "bottom", "裤子", dict(subtype="jeans", color_base="blue", color_tone="medium",
                                  pattern="solid", style="casual", fit="regular",
                                  season="spring,autumn", formality="casual", material="denim")),
    ("鞋子", "shoes", "鞋子", dict(subtype="sneakers", color_base="white", color_tone="light",
                                  pattern="solid", style="sporty", fit="regular",
                                  season="spring,summer,autumn", formality="casual", material="canvas")),
]

PER_CATEGORY = 4


def main() -> None:
    ensure_runtime_dirs()
    init_db()
    db = SessionLocal()
    added = 0
    try:
        for subdir, category, prefix, tags in SOURCES:
            images = sorted((CLOSET_DIR / subdir).glob("*.jpg"))[:PER_CATEGORY]
            for i, src in enumerate(images, 1):
                name = f"{prefix}{i}"
                exists = db.query(ClothingItem).filter_by(name=name, category=category).first()
                if exists:
                    continue
                filename = f"{uuid.uuid4().hex}.jpg"
                for sub in ("original", "processed"):
                    dst = UPLOAD_DIR / sub / filename
                    shutil.copyfile(src, dst)
                item = ClothingItem(
                    name=name,
                    category=category,
                    original_image=f"/uploads/original/{filename}",
                    processed_image=f"/uploads/processed/{filename}",
                    **tags,
                )
                db.add(item)
                added += 1
        db.commit()
        print(f"seeded {added} items")
    finally:
        db.close()


if __name__ == "__main__":
    main()
