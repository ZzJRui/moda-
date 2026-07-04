"""u2net_cloth_seg 后处理：拆 3 段堆叠 mask 取并集，合白底。测上衣/裤子/鞋子。"""
import sys, os, io
sys.stdout.reconfigure(encoding="utf-8")
import numpy as np
from PIL import Image
from rembg import remove, new_session

SRC_ROOT = r"D:\AllProject\ai衣柜\衣橱\衣橱\女"
OUT = r"D:\AllProject\ai衣柜\backend\uploads\processed"
SAMPLES = [
    ("上衣", r"上衣\0d912fbb680452bf94d245c707166982.jpg"),
    ("裤子", r"裤子\07897d284876ae2efa217b4ccf3c28fe.jpg"),
    ("鞋子", r"鞋子\10419cf8a17cd529cc5986da8dd836d5.jpg"),
]
sess = new_session("u2net_cloth_seg")

def cloth_mask(data):
    """u2net_cloth_seg 输出是 N×(3H) 堆叠的 3 类 mask，拆 3 段取 alpha 并集。"""
    out = remove(data, session=sess)
    img = Image.open(io.BytesIO(out)).convert("RGBA")
    w, h = img.size
    assert h % 3 == 0, f"cloth_seg 输出高度 {h} 不是 3 的倍数"
    band = h // 3
    alpha_full = np.zeros((band, w), dtype=np.uint8)
    for i in range(3):
        seg = img.crop((0, i*band, w, (i+1)*band))
        a = np.array(seg.split()[-1])
        alpha_full = np.maximum(alpha_full, a)
    return Image.fromarray(alpha_full, "L"), (w, band)

for label, rel in SAMPLES:
    src = os.path.join(SRC_ROOT, rel)
    with open(src, "rb") as f:
        data = f.read()
    orig = Image.open(src).convert("RGB")
    ow, oh = orig.size
    mask, (mw, mh) = cloth_mask(data)
    # 前景占比
    arr = np.array(mask)
    fg = (arr > 16).mean()
    # 头部带（上 1/4）前景占比：若只抠衣服，头部带应接近 0
    head = (arr[:oh//4] > 16).mean()
    # 合白底
    rgba = Image.new("RGBA", (mw, mh), (0,0,0,0))
    rgba.putalpha(mask)
    white = Image.new("RGB", (mw, mh), (255,255,255))
    white.paste(orig.resize((mw, mh)), (0,0), mask)  # 用原图像素 + mask 贴到白底
    path = os.path.join(OUT, f"cloth_only_{label}.jpg")
    # 等比缩到最长边 1200
    white = white.resize((min(mw,1200), min(mh,1200))) if max(mw,mh)>1200 else white
    white.save(path, format="JPEG", quality=90)
    print(f"[{label}] 原图{ow}x{oh} mask{mw}x{mh} 前景{fg:.3f} 头部带{head:.3f} -> {path}")
print("\n头部带接近 0 = 没把脸/头发抠进来。前景占比合理 = 衣服区域。")
