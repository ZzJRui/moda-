"""端到端冒烟：从 女装 上传 3 上衣 + 3 裤子 + 3 鞋子，校验 AI 识图/抠图白底/打标签。"""
import sys, io, time, os
sys.stdout.reconfigure(encoding="utf-8")
import httpx
from PIL import Image

BASE = "http://127.0.0.1:8000"
SRC = r"D:\AllProject\ai衣柜\衣橱\衣橱\女"
GROUPS = [("上衣", "top"), ("裤子", "bottom"), ("鞋子", "shoes")]

def first3(sub):
    d = os.path.join(SRC, sub)
    files = sorted(f for f in os.listdir(d) if f.lower().endswith((".jpg", ".jpeg", ".png", ".webp")))
    return [os.path.join(d, f) for f in files[:3]]

results = []
t0 = time.time()
with httpx.Client(timeout=120) as c:
    for sub, expect_cat in GROUPS:
        for path in first3(sub):
            fn = os.path.basename(path)
            with open(path, "rb") as fh:
                data = fh.read()
            mime = "image/jpeg"
            t1 = time.time()
            r = c.post(
                f"{BASE}/api/clothes/upload",
                files={"file": (fn, data, mime)},
                data={},  # 不传 category/color/style → AI 全自动
            )
            dt = time.time() - t1
            ok = r.status_code == 201
            body = r.json() if ok else {"error": r.text[:200]}
            line = {
                "file": fn,
                "group": sub,
                "expect": expect_cat,
                "status": r.status_code,
                "dt_s": round(dt, 1),
                "id": body.get("id"),
                "category": body.get("category"),
                "color": body.get("color"),
                "style": body.get("style"),
                "tagging_status": body.get("tagging_status"),
                "processed_image": body.get("processed_image"),
            }
            print(line)
            results.append(line)
print("total", round(time.time() - t0, 1), "s")

# 校验 processed 白底图：读盘，Pillow 打开，查四角是否接近白
print("=== 白底校验 ===")
proc_dir = r"D:\AllProject\ai衣柜\backend\uploads\processed"
for r in results:
    if not r.get("processed_image"):
        print(r["file"], "无 processed_image"); continue
    name = r["processed_image"].rsplit("/", 1)[-1]
    p = os.path.join(proc_dir, name)
    if not os.path.exists(p):
        print(r["file"], "processed 文件不存在", p); continue
    try:
        img = Image.open(p).convert("RGB")
        w, h = img.size
        corners = [img.getpixel((0, 0)), img.getpixel((w-1, 0)),
                   img.getpixel((0, h-1)), img.getpixel((w-1, h-1))]
        whiteish = all(min(c) > 235 for c in corners)
        print(f"{r['file']:40s} {w}x{h} corners={corners[0]} white_bg={whiteish}")
    except Exception as e:
        print(r["file"], "Pillow 打开失败", e)

# 汇总
print("=== 汇总 ===")
ai = sum(1 for r in results if r["tagging_status"] == "ai")
failed = sum(1 for r in results if r["tagging_status"] == "ai_failed")
cat_ok = sum(1 for r in results if r["category"] == r["expect"])
print(f"上传成功 {len(results)}/9  AI成功 {ai}  AI失败降级 {failed}  品类识别正确 {cat_ok}/9")
