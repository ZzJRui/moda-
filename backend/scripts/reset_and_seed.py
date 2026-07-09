"""一次性脚本：清空 DB + uploads 孤儿文件，再从样本图库批量上传 12 张。

用法（在 backend/ 目录下）：
    .\venv\Scripts\python.exe scripts\reset_and_seed.py

依赖运行中的 uvicorn @ http://127.0.0.1:8000（AI 打标签需要）。
"""
from __future__ import annotations

import sys
from pathlib import Path

# 确保能 import app.*（脚本可能在任意 CWD 下执行）
BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))

import httpx

from app import config
from app.database import SessionLocal
from app.models import ClothingItem, Favorite, Outfit

SAMPLE_ROOT = Path(r"D:\AllProject\ai衣柜\衣橱\衣橱\男")
# 子文件夹 -> 期望入库的 category（人类可读日志用，实际由 AI 识图判定）
SUBDIRS = (
    ("上衣", "top"),
    ("裤子", "bottom"),
    ("鞋子", "shoes"),
)
PICK_PER_SUBDIR = 4
API_URL = "http://127.0.0.1:8000/api/clothes/upload"


def clear_database() -> tuple[int, int, int]:
    """清空 favorites / outfits / clothing_items 三张表，返回删除条数。"""
    with SessionLocal() as db:
        fav_n = db.query(Favorite).delete()
        out_n = db.query(Outfit).delete()
        clo_n = db.query(ClothingItem).delete()
        db.commit()
    return fav_n, out_n, clo_n


def clear_uploads() -> tuple[int, int]:
    """删掉 uploads/original 与 uploads/processed 下所有文件（保留目录）。"""
    orig_n = _wipe(config.UPLOAD_DIR / "original")
    proc_n = _wipe(config.UPLOAD_DIR / "processed")
    return orig_n, proc_n


def _wipe(directory: Path) -> int:
    n = 0
    if not directory.exists():
        return 0
    for p in directory.iterdir():
        if p.is_file():
            p.unlink()
            n += 1
    return n


def upload_samples() -> None:
    """三个子文件夹各按文件名升序取前 N 张，串行 POST 到上传接口。"""
    with httpx.Client(timeout=90.0) as client:
        for subdir, hint_category in SUBDIRS:
            src = SAMPLE_ROOT / subdir
            files = sorted(p for p in src.iterdir() if p.suffix.lower() in (".jpg", ".jpeg", ".png", ".webp"))
            picked = files[:PICK_PER_SUBDIR]
            print(f"\n=== {subdir} (期望 {hint_category})，选取 {len(picked)} 张 ===")
            for img in picked:
                _upload_one(client, img)


def _upload_one(client: httpx.Client, img: Path) -> None:
    with img.open("rb") as f:
        try:
            resp = client.post(API_URL, files={"file": (img.name, f, "image/jpeg")})
        except httpx.HTTPError as e:
            print(f"  [ERR] {img.name}: {e}")
            return
    if resp.status_code != 201:
        print(f"  [ERR {resp.status_code}] {img.name}: {resp.text[:200]}")
        return
    data = resp.json()
    print(
        f"  ok id={data['id']:>3} category={data['category']:<6} "
        f"subtype={data.get('subtype') or '-':<10} "
        f"color={data.get('color_base') or '-':<8} "
        f"tagging_status={data.get('tagging_status')}  <- {img.name}"
    )


def main() -> None:
    print(">>> 清空数据库表")
    fav_n, out_n, clo_n = clear_database()
    print(f"cleared: favorites={fav_n}, outfits={out_n}, clothes={clo_n}")

    print("\n>>> 清空 uploads 孤儿文件")
    orig_n, proc_n = clear_uploads()
    print(f"wiped uploads: original={orig_n}, processed={proc_n}")

    print("\n>>> 批量上传样本")
    upload_samples()

    print("\n>>> 完成")


if __name__ == "__main__":
    main()
