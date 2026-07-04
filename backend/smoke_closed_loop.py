"""Phase 5 手动闭环：推荐 -> 保存穿搭 -> 保存收藏截图 -> 收藏列表 -> 收藏详情。"""
import sys, io, time, os, json
sys.stdout.reconfigure(encoding="utf-8")
import httpx
from PIL import Image

BASE = "http://127.0.0.1:8000"

def show(label, r):
    print(f"\n--- {label} ---  HTTP {r.status_code}")
    try:
        print(json.dumps(r.json(), ensure_ascii=False, indent=2)[:800])
    except Exception:
        print(r.text[:500])

with httpx.Client(base_url=BASE, timeout=60) as c:
    # 1. AI 推荐
    t = time.time()
    r = c.post("/api/recommendations/outfit", json={"text": "夏天去公园，清爽休闲"})
    print(f"[1] AI 推荐  dt={time.time()-t:.1f}s")
    show("recommend", r)
    assert r.status_code == 200, r.text
    rec = r.json()
    top_id, bottom_id, shoes_id = rec["top_id"], rec["bottom_id"], rec["shoes_id"]
    print(f"选出: top={top_id} bottom={bottom_id} shoes={shoes_id}  理由={rec['reason']}")

    # 2. 保存穿搭
    r = c.post("/api/outfits", json={
        "top_id": top_id, "bottom_id": bottom_id, "shoes_id": shoes_id,
        "source": "ai", "prompt": "夏天去公园，清爽休闲", "reason": rec["reason"],
    })
    show("[2] 保存穿搭", r)
    assert r.status_code == 201, r.text
    outfit_id = r.json()["id"]

    # 3. 保存收藏截图（生成一张 mock 截图 PNG）
    buf = io.BytesIO()
    Image.new("RGB", (360, 640), (245, 230, 211)).save(buf, format="PNG")
    shot = buf.getvalue()
    r = c.post(
        "/api/favorites",
        data={"outfit_id": str(outfit_id)},
        files={"screenshot": ("outfit.png", shot, "image/png")},
    )
    show("[3] 保存收藏截图", r)
    assert r.status_code == 201, r.text
    fav_id = r.json()["id"]
    screenshot_path = r.json()["screenshot_path"]

    # 4. 收藏列表
    r = c.get("/api/favorites")
    show("[4] 收藏列表", r)
    assert r.status_code == 200
    assert any(f["id"] == fav_id for f in r.json()), "新收藏不在列表里"

    # 5. 收藏详情
    r = c.get(f"/api/favorites/{fav_id}")
    show("[5] 收藏详情", r)
    assert r.status_code == 200
    detail = r.json()
    assert detail["outfit"]["id"] == outfit_id
    assert detail["outfit"]["top_id"] == top_id

    # 6. 回填校验：outfit 的 screenshot_path 应被回填
    # 通过详情里的 outfit 摘要看不出 screenshot_path（OutfitBrief 不含），直接查盘
    fav_file = os.path.join(r"D:\AllProject\ai衣柜\backend\uploads\favorites",
                            screenshot_path.rsplit("/", 1)[-1])
    print(f"\n[6] 截图落盘: {fav_file}  exists={os.path.exists(fav_file)}  size={os.path.getsize(fav_file) if os.path.exists(fav_file) else 0}")

print("\n=== Phase 5 手动闭环全部通过 ===")
