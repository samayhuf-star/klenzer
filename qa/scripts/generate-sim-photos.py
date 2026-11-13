#!/usr/bin/env python3
"""Generate >= 2000 small fixture photos for the iOS simulator QA workflow.

Creates:
  - exact duplicates (identical JPEG bytes, same original filename in two folders)
  - near-duplicates (same scene, slight crop or brightness change)
  - blurry shots (box-blurred)
  - screenshot-sized PNGs whose names start with "Screenshot"

Does not commit binaries; run in CI (or locally) into an output directory.
Requires Pillow:  pip install pillow
"""
from __future__ import annotations

import argparse
import math
import os
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageEnhance, ImageFilter, ImageFont


def solid(w: int, h: int, color: tuple[int, int, int]) -> Image.Image:
    return Image.new("RGB", (w, h), color)


def scene(seed: int, w: int = 96, h: int = 96) -> Image.Image:
    """A cheap but unique-enough scene so dHash can tell near-dups from others."""
    r = (seed * 37) % 200 + 40
    g = (seed * 73) % 200 + 40
    b = (seed * 91) % 200 + 40
    img = solid(w, h, (r, g, b))
    draw = ImageDraw.Draw(img)
    # a few geometric marks that survive a 32 px thumb
    draw.rectangle((8, 8, w // 2, h // 2), fill=((r + 80) % 256, g, b))
    draw.ellipse((w // 3, h // 3, w - 10, h - 10), fill=(r, (g + 80) % 256, b))
    draw.line((0, seed % h, w, (seed * 3) % h), fill=(255, 255, 255), width=3)
    try:
        font = ImageFont.load_default()
        draw.text((4, h - 14), f"{seed:04d}", fill=(0, 0, 0), font=font)
    except Exception:
        pass
    return img


def burst_scene(seed: int, w: int = 240, h: int = 180) -> Image.Image:
    """Smooth gradient plus hard-edged marks: sharp (not Blurry) and with stable dHash bits, so tiny
    edits of the same shot stay within a few bits of each other (a Similar group)."""
    img = Image.new("RGB", (w, h))
    px = img.load()
    fx = 1.5 + (seed % 5) * 0.7
    fy = 1.0 + (seed % 3) * 0.9
    ph = seed * 0.37
    for y in range(h):
        for x in range(w):
            v = 128 + 60 * math.sin(fx * x / w * 6.283 + ph) + 50 * math.cos(fy * y / h * 6.283 + ph * 0.5)
            px[x, y] = (int(max(0, min(255, v))), int(max(0, min(255, v * 0.8 + 30))), int(max(0, min(255, 255 - v))))
    draw = ImageDraw.Draw(img)
    for k in range(6):
        x0 = (seed * 13 + k * 37) % (w - 40)
        y0 = (seed * 7 + k * 29) % (h - 30)
        fill = (15, 15, 20) if k % 2 == 0 else (245, 245, 240)
        draw.rectangle((x0, y0, x0 + 30 + (k * 5) % 20, y0 + 20 + (k * 3) % 15), fill=fill)
    for k in range(4):
        draw.line((0, (seed * 5 + k * 45) % h, w, (seed * 11 + k * 45 + 30) % h), fill=(255, 255, 255) if k % 2 else (0, 0, 0), width=4)
    return img


def write_jpeg(img: Image.Image, path: Path, quality: int = 70) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    img.save(path, "JPEG", quality=quality, optimize=True)


def write_png(img: Image.Image, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    img.save(path, "PNG", optimize=True)


def blurry(img: Image.Image) -> Image.Image:
    return img.filter(ImageFilter.BoxBlur(6)).filter(ImageFilter.GaussianBlur(4))


def slightly_brighter(img: Image.Image) -> Image.Image:
    return ImageEnhance.Brightness(img).enhance(1.12)


def slight_crop(img: Image.Image) -> Image.Image:
    w, h = img.size
    cropped = img.crop((3, 2, w - 1, h - 2))
    return cropped.resize((w, h), Image.Resampling.BILINEAR)


def screenshot(seed: int) -> Image.Image:
    # iPhone 15-ish logical size so MediaLibrary classifies as a screenshot
    w, h = 390, 844
    img = solid(w, h, (245, 246, 250))
    draw = ImageDraw.Draw(img)
    draw.rectangle((0, 0, w, 54), fill=(20, 22, 28))
    draw.rectangle((0, h - 48, w, h), fill=(20, 22, 28))
    draw.rounded_rectangle((24, 80, w - 24, 200), radius=16, fill=(255, 255, 255))
    draw.rounded_rectangle((24, 220, w - 24, 520), radius=16, fill=(230, 236, 255))
    try:
        font = ImageFont.load_default()
        draw.text((36, 100), f"Screenshot fixture {seed}", fill=(20, 22, 28), font=font)
    except Exception:
        pass
    return img


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", default="qa/fixtures/photos", help="output directory")
    parser.add_argument("--count", type=int, default=2000, help="minimum photo count")
    parser.add_argument("--exact-pairs", type=int, default=40)
    parser.add_argument("--near-pairs", type=int, default=60)
    parser.add_argument("--blurry", type=int, default=80)
    parser.add_argument("--screenshots", type=int, default=40)
    parser.add_argument("--similar-bursts", type=int, default=0, help="bursts of 3 near-identical shots (Similar)")
    args = parser.parse_args()

    out = Path(args.out)
    if out.exists():
        # leave leftover files from a previous run? wipe the tree we own
        for p in out.rglob("*"):
            if p.is_file():
                p.unlink()
    out.mkdir(parents=True, exist_ok=True)

    n = 0
    # 40 exact-dup pairs (80 files, 40 unique names duplicated across a/ and b/)
    exact_pairs = args.exact_pairs
    for i in range(exact_pairs):
        img = scene(i, 128, 96)
        name = f"IMG_{1000 + i:04d}.JPG"
        write_jpeg(img, out / "exact" / "a" / name)
        write_jpeg(img, out / "exact" / "b" / name)
        n += 2

    # 60 near-dup pairs: original + brightness or crop
    near_pairs = args.near_pairs
    for i in range(near_pairs):
        base = scene(200 + i, 128, 128)
        write_jpeg(base, out / "near" / f"NEAR_{i:04d}_A.jpg")
        variant = slight_crop(base) if i % 2 == 0 else slightly_brighter(base)
        write_jpeg(variant, out / "near" / f"NEAR_{i:04d}_B.jpg")
        n += 2

    # 80 blurry shots
    blur_count = args.blurry
    for i in range(blur_count):
        write_jpeg(blurry(scene(400 + i, 160, 120)), out / "blurry" / f"BLUR_{i:04d}.jpg", quality=55)
        n += 1

    # Similar bursts: 3 shots of the same scene (re-encoded, +4% brightness, +4% contrast)
    for i in range(args.similar_bursts):
        base = burst_scene(700 + i * 11)
        write_jpeg(base, out / "similar" / f"SIM_{i:03d}_A.jpg", quality=85)
        write_jpeg(ImageEnhance.Brightness(base).enhance(1.04), out / "similar" / f"SIM_{i:03d}_B.jpg", quality=80)
        write_jpeg(ImageEnhance.Contrast(base).enhance(1.04), out / "similar" / f"SIM_{i:03d}_C.jpg", quality=75)
        n += 3

    # 40 screenshot-sized PNGs (names start with Screenshot so the scanner groups them)
    shot_count = args.screenshots
    for i in range(shot_count):
        name = f"Screenshot 2026-01-01 at 12.{i // 60:02d}.{i % 60:02d}.png"
        write_png(screenshot(i), out / "screenshots" / name)
        n += 1

    # Fill the rest with unique stills so we hit --count
    filler = 0
    while n < args.count:
        write_jpeg(scene(1000 + filler, 96, 96), out / "filler" / f"FILL_{filler:05d}.jpg")
        n += 1
        filler += 1

    files = [p for p in out.rglob("*") if p.is_file()]
    print(f"generated {len(files)} photos under {out}")
    return 0 if len(files) >= args.count else 1


if __name__ == "__main__":
    sys.exit(main())
