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
    exact_pairs = 40
    for i in range(exact_pairs):
        img = scene(i, 128, 96)
        name = f"IMG_{1000 + i:04d}.JPG"
        write_jpeg(img, out / "exact" / "a" / name)
        write_jpeg(img, out / "exact" / "b" / name)
        n += 2

    # 60 near-dup pairs: original + brightness or crop
    near_pairs = 60
    for i in range(near_pairs):
        base = scene(200 + i, 128, 128)
        write_jpeg(base, out / "near" / f"NEAR_{i:04d}_A.jpg")
        variant = slight_crop(base) if i % 2 == 0 else slightly_brighter(base)
        write_jpeg(variant, out / "near" / f"NEAR_{i:04d}_B.jpg")
        n += 2

    # 80 blurry shots
    blur_count = 80
    for i in range(blur_count):
        write_jpeg(blurry(scene(400 + i, 160, 120)), out / "blurry" / f"BLUR_{i:04d}.jpg", quality=55)
        n += 1

    # 40 screenshot-sized PNGs (names start with Screenshot so the scanner groups them)
    shot_count = 40
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
