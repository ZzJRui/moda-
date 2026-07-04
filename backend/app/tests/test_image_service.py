"""image_service 两步流水线测试（Phase 2.2）。

策略：测试默认跑「回退分支」与「白底合成纯函数」，不触发 rembg 模型下载，
保证 CI/离线环境零网络依赖即可全绿。
真正的 rembg 全流水线用例用 _needs_rembg 守护，仅在设环境变量
REMBG_AVAILABLE=1（且模型已就绪/可联网）时才跑。
"""
from __future__ import annotations

import io
import os
from pathlib import Path

import pytest
from PIL import Image

from app import config
from app.services import image_service


def _needs_rembg():
    """跳过需 rembg 模型/联网的用例。"""
    return pytest.mark.skipif(
        os.getenv("REMBG_AVAILABLE") != "1",
        reason="需 REMBG_AVAILABLE=1 且 rembg 模型就绪/可联网",
    )


# ---------------- 回退分支（无网络依赖，默认跑） ----------------

def test_process_image_disabled_fallback(tmp_path, monkeypatch):
    """IMAGE_PROCESSING_ENABLED=False → 原图拷贝回退，URL 含原扩展。"""
    monkeypatch.setattr(config, "UPLOAD_DIR", tmp_path)
    (tmp_path / "original").mkdir()
    (tmp_path / "processed").mkdir()
    monkeypatch.setattr(config, "IMAGE_PROCESSING_ENABLED", False)

    # 造一张原图
    orig = tmp_path / "original" / "abc.png"
    Image.new("RGB", (10, 10), (5, 6, 7)).save(orig, "PNG")

    url = image_service.process_image("abc.png")
    assert url == "/uploads/processed/abc.png"
    assert (tmp_path / "processed" / "abc.png").exists()
    # 不应产生 png/jpg 新产物（回退直接拷原名）
    assert not (tmp_path / "processed" / "abc.jpg").exists()


def test_process_image_rembg_error_fallback(tmp_path, monkeypatch):
    """_remove_background 抛异常 → 回退原图拷贝，不冒泡。"""
    monkeypatch.setattr(config, "UPLOAD_DIR", tmp_path)
    (tmp_path / "original").mkdir()
    (tmp_path / "processed").mkdir()
    monkeypatch.setattr(config, "IMAGE_PROCESSING_ENABLED", True)

    Image.new("RGB", (10, 10)).save(tmp_path / "original" / "abc.png", "PNG")

    def _boom(_filename):
        raise RuntimeError("rembg fake failure")

    monkeypatch.setattr(image_service, "_remove_background", _boom)

    url = image_service.process_image("abc.png")
    assert url == "/uploads/processed/abc.png"   # 回退
    assert (tmp_path / "processed" / "abc.png").exists()


# ---------------- 白底合成纯函数（无网络依赖） ----------------

def test_apply_white_background_pure_white(tmp_path, monkeypatch):
    """构造一个全不透明彩色 PNG，合成白底后四角应为纯白。"""
    monkeypatch.setattr(config, "UPLOAD_DIR", tmp_path)
    (tmp_path / "processed").mkdir()

    # 一张 20×20 完全不透明的红色 RGBA PNG
    png_name = "abc.png"
    Image.new("RGBA", (20, 20), (200, 30, 30, 255)).save(
        tmp_path / "processed" / png_name, "PNG"
    )

    jpg_name = image_service._apply_white_background(png_name)
    assert jpg_name == "abc.jpg"
    assert (tmp_path / "processed" / "abc.jpg").exists()

    with Image.open(tmp_path / "processed" / "abc.jpg") as im:
        assert im.mode == "RGB"
        # 全不透明红贴到白底，红完全覆盖白；JPEG 有损，给小容差。
        px = im.load()
        r0 = px[0, 0]
        c0 = px[10, 10]
        assert abs(r0[0] - 200) <= 8 and abs(r0[1] - 30) <= 8 and abs(r0[2] - 30) <= 8, r0
        assert abs(c0[0] - 200) <= 8 and abs(c0[1] - 30) <= 8 and abs(c0[2] - 30) <= 8, c0


def test_apply_white_background_transparent_corners_become_white(tmp_path, monkeypatch):
    """四角透明、中心不透明的图 → 合成后四角白、中心保留主体色。"""
    monkeypatch.setattr(config, "UPLOAD_DIR", tmp_path)
    (tmp_path / "processed").mkdir()

    # 20×20 全透明，中心 8×8 画不透明蓝
    img = Image.new("RGBA", (20, 20), (0, 0, 0, 0))
    for x in range(6, 14):
        for y in range(6, 14):
            img.putpixel((x, y), (30, 60, 200, 255))
    png_name = "t.png"
    img.save(tmp_path / "processed" / png_name, "PNG")

    jpg_name = image_service._apply_white_background(png_name)
    with Image.open(tmp_path / "processed" / jpg_name) as im:
        assert im.mode == "RGB"
        px = im.load()
        # 透明角 → 接近纯白（JPEG 有损压缩会引入极小偏差，容差 5）
        corner = px[0, 0]
        assert all(abs(c - 255) <= 5 for c in corner), corner
        # 中心主体色保留（蓝块）：蓝色通道为主，JPEG 压缩小图误差较大，给较宽容差
        center = px[10, 10]
        assert center[2] > 150 and abs(center[0] - 30) <= 15 and abs(center[1] - 60) <= 15, center


def test_resize_to_max_side():
    """_resize_to_max_side 等比缩放，最长边不超过上限。"""
    im = Image.new("RGB", (2000, 1000), (1, 2, 3))
    out = image_service._resize_to_max_side(im, 1200)
    assert out.size == (1200, 600)
    # 已小于上限原样返回
    small = Image.new("RGB", (100, 50))
    assert image_service._resize_to_max_side(small, 1200).size == (100, 50)


# ---------------- 真 rembg 全流水线（需模型/联网，默认跳过） ----------------

@_needs_rembg()
def test_process_image_full_pipeline(tmp_path, monkeypatch):
    """端到端：原图 → 透明 PNG + 白底 jpg，返回 URL 指向 jpg。"""
    monkeypatch.setattr(config, "UPLOAD_DIR", tmp_path)
    (tmp_path / "original").mkdir()
    (tmp_path / "processed").mkdir()
    monkeypatch.setattr(config, "IMAGE_PROCESSING_ENABLED", True)

    # 造一张带背景的小图：纯色背景 + 中心方块（伪"主体"）
    img = Image.new("RGB", (64, 64), (200, 200, 200))  # 灰背景
    for x in range(20, 44):
        for y in range(20, 44):
            img.putpixel((x, y), (40, 100, 180))        # 中心蓝块
    img.save(tmp_path / "original" / "abc.jpg", "JPEG")

    url = image_service.process_image("abc.jpg")
    assert url == "/uploads/processed/abc.jpg"
    assert (tmp_path / "processed" / "abc.png").exists()   # 透明中间产物
    assert (tmp_path / "processed" / "abc.jpg").exists()   # 白底产物
    with Image.open(tmp_path / "processed" / "abc.jpg") as im:
        assert im.mode == "RGB"
