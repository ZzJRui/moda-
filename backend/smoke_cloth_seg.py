"""实测 rembg u2net vs u2net_cloth_seg：是否只抠衣服不含人。"""
import sys, os
sys.stdout.reconfigure(encoding="utf-8")
from PIL import Image
from rembg import remove, new_session

SRC = r"D:\AllProject\ai衣柜\衣橱\衣橱\女\上衣\0d912fbb680452bf94d245c707166982.jpg"
OUT = r"D:\AllProject\ai衣柜\backend\uploads\processed"
os.makedirs(OUT, exist_ok=True)

with open(SRC, "rb") as f:
    data = f.read()

orig = Image.open(SRC).convert("RGB")
W, H = orig.size
print(f"原图 {W}x{H}")

def run(label, model_name=None):
    if model_name:
        sess = new_session(model_name)
        out = remove(data, session=sess)
    else:
        out = remove(data)
    img = Image.open(__import__("io").BytesIO(out))
    print(f"\n[{label}] output mode={img.mode} size={img.size}")
    rgba = img.convert("RGBA")
    alpha = rgba.split()[-1]
    # 统计不透明像素
    import numpy as np
    arr = np.array(alpha)
    opaque = (arr > 16).sum()   # 近似前景
    total = arr.size
    ratio = opaque / total
    # 上下中三带的前景占比，看是否整人 vs 只衣服
    h = arr.shape[0]
    top_band = (arr[:h//4] > 16).mean()
    mid_band = (arr[h//4:3*h//4] > 16).mean()
    bot_band = (arr[3*h//4:] > 16).mean()
    print(f"  前景占比 {ratio:.3f}  上{top_band:.3f} 中{mid_band:.3f} 下{bot_band:.3f}")
    # 合白底存盘
    white = Image.new("RGB", rgba.size, (255, 255, 255))
    white.paste(rgba, mask=alpha)
    path = os.path.join(OUT, f"cmp_{label}.jpg")
    white.save(path, format="JPEG", quality=90)
    print(f"  saved {path}")
    return ratio

r_default = run("u2net_default", None)
r_cloth = run("u2net_cloth_seg", "u2net_cloth_seg")

print(f"\n前景占比: default={r_default:.3f}  cloth_seg={r_cloth:.3f}")
print("若 cloth_seg 明显更小且上带(头部)占比骤降 → 只抠衣服成功")
