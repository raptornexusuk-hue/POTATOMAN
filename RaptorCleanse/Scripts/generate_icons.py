#!/usr/bin/env python3
"""Regenerate the app icon set and the in-app brand mark from Artwork/App-Icon-Master.png.

Python 3 with Pillow. Run from anywhere:

    python3 Scripts/generate_icons.py

The master artwork is the Raptor mark drawn on a white field. Shipping that
directly as a macOS app icon produced a flat white square in the Dock with no
icon shape and no margin, and the same white square appeared behind the sidebar
mark in dark mode. This script:

  * lifts the mark off its white background into a real alpha channel,
  * composes it on the macOS icon grid — an 824x824 rounded shape inside a
    1024x1024 canvas, leaving the 100px margin macOS expects,
  * uses a graphite base so the silver of the mark has something to read
    against in both the light and the dark Dock — the base stays plain, because
    a coloured rim only added noise at 1024 and was invisible by 128,
  * and writes the in-app BrandIcon at 1x and 2x with a transparent background.

The corner shape is a superellipse rather than a circular-corner rounded
rectangle, which is much closer to the shape macOS uses for its own icons.
"""
from pathlib import Path
import math

from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
MASTER = ROOT / "Artwork" / "App-Icon-Master.png"
ICON_SET = ROOT / "RaptorCleanse" / "Assets.xcassets" / "AppIcon.appiconset"
BRAND_SET = ROOT / "RaptorCleanse" / "Assets.xcassets" / "BrandIcon.imageset"
ARTWORK = ROOT / "Artwork"

CANVAS = 1024
# Apple's macOS icon grid: the icon shape is 824pt inside a 1024pt canvas.
SHAPE = 824
SUPERELLIPSE_EXPONENT = 5.0
SUPERSAMPLE = 4

# Graphite base, top to bottom. Dark enough for brushed silver to separate from
# it, neutral enough not to compete with the emerald ring.
BASE_TOP = (48, 54, 57)
BASE_BOTTOM = (19, 22, 24)


def superellipse_mask(size: int, exponent: float = SUPERELLIPSE_EXPONENT) -> Image.Image:
    """An antialiased filled superellipse, drawn oversized and downsampled."""
    big = size * SUPERSAMPLE
    mask = Image.new("L", (big, big), 0)
    radius = big / 2
    points = []
    for step in range(2048):
        angle = 2 * math.pi * step / 2048
        cos_t, sin_t = math.cos(angle), math.sin(angle)
        x = math.copysign(abs(cos_t) ** (2 / exponent), cos_t)
        y = math.copysign(abs(sin_t) ** (2 / exponent), sin_t)
        points.append((radius + x * radius, radius + y * radius))
    ImageDraw.Draw(mask).polygon(points, fill=255)
    return mask.resize((size, size), Image.LANCZOS)


def vertical_gradient(size: int, top: tuple, bottom: tuple) -> Image.Image:
    """A smooth top-to-bottom gradient, built one row tall and stretched."""
    strip = Image.new("RGB", (1, size))
    for y in range(size):
        ratio = y / max(1, size - 1)
        strip.putpixel((0, y), tuple(round(top[i] + (bottom[i] - top[i]) * ratio) for i in range(3)))
    return strip.resize((size, size), Image.BICUBIC)


def cut_out_mark(path: Path) -> Image.Image:
    """Lift the mark off its white field, cropped to its own bounds.

    The background is found by flooding inward from the border rather than by
    thresholding brightness, so the mark's own bright silver highlights are kept
    instead of being punched into holes.
    """
    source = Image.open(path).convert("RGB")
    width, height = source.size
    flood = source.convert("L")
    seeds = [(0, 0), (width - 1, 0), (0, height - 1), (width - 1, height - 1),
             (width // 2, 0), (width // 2, height - 1), (0, height // 2), (width - 1, height // 2)]
    for seed in seeds:
        # Threshold 8 is inside the stable band: 4 through 14 all select the same
        # background, and 24 starts eating into the mark.
        ImageDraw.floodfill(flood, seed, 0, thresh=8)
    alpha = flood.point(lambda value: 0 if value == 0 else 255)
    # One pixel of feathering so the edge is not stair-stepped once scaled down.
    alpha = alpha.filter(ImageFilter.GaussianBlur(1.1))
    mark = source.convert("RGBA")
    mark.putalpha(alpha)
    return mark.crop(mark.getbbox())


def compose_icon(mark: Image.Image, *, detailed: bool) -> Image.Image:
    """Place the mark on the graphite icon shape at full 1024 resolution."""
    shape = superellipse_mask(SHAPE)
    base = vertical_gradient(SHAPE, BASE_TOP, BASE_BOTTOM).convert("RGBA")
    base.putalpha(shape)

    if detailed:
        # A soft specular sweep across the top, clipped to the icon shape.
        sheen = Image.new("L", (SHAPE, SHAPE), 0)
        draw = ImageDraw.Draw(sheen)
        draw.ellipse((-SHAPE * 0.35, -SHAPE * 0.95, SHAPE * 1.35, SHAPE * 0.42), fill=38)
        sheen = sheen.filter(ImageFilter.GaussianBlur(SHAPE * 0.05))
        highlight = Image.new("RGBA", (SHAPE, SHAPE), (255, 255, 255, 0))
        highlight.putalpha(Image.composite(sheen, Image.new("L", (SHAPE, SHAPE), 0), shape))
        base = Image.alpha_composite(base, highlight)

    # Small renders lose the mark entirely if it sits at the same scale, so it is
    # given more of the shape when the artwork will be seen at 16 or 32 points.
    fill = 0.70 if detailed else 0.80
    target = SHAPE * fill
    scale = target / max(mark.width, mark.height)
    placed = mark.resize((max(1, round(mark.width * scale)), max(1, round(mark.height * scale))), Image.LANCZOS)

    layer = Image.new("RGBA", (SHAPE, SHAPE), (0, 0, 0, 0))
    left = (SHAPE - placed.width) // 2
    # Nudged up a little: the mark's visual mass sits low because of the ring.
    top = (SHAPE - placed.height) // 2 - round(SHAPE * 0.012)

    if detailed:
        shadow = Image.new("RGBA", (SHAPE, SHAPE), (0, 0, 0, 0))
        shadow.paste((0, 0, 0, 150), (left, top + round(SHAPE * 0.018)), placed.split()[3])
        shadow = shadow.filter(ImageFilter.GaussianBlur(SHAPE * 0.018))
        layer = Image.alpha_composite(layer, shadow)

    layer.paste(placed, (left, top), placed)
    layer.putalpha(Image.composite(layer.split()[3], Image.new("L", (SHAPE, SHAPE), 0), shape))
    base = Image.alpha_composite(base, layer)

    canvas = Image.new("RGBA", (CANVAS, CANVAS), (0, 0, 0, 0))
    offset = (CANVAS - SHAPE) // 2
    canvas.paste(base, (offset, offset), base)
    return canvas


def main() -> None:
    mark = cut_out_mark(MASTER)
    detailed = compose_icon(mark, detailed=True)
    simple = compose_icon(mark, detailed=False)

    # (filename, pixel size) for every entry in AppIcon.appiconset/Contents.json.
    icons = [
        ("icon_16x16@1x.png", 16), ("icon_16x16@2x.png", 32),
        ("icon_32x32@1x.png", 32), ("icon_32x32@2x.png", 64),
        ("icon_128x128@1x.png", 128), ("icon_128x128@2x.png", 256),
        ("icon_256x256@1x.png", 256), ("icon_256x256@2x.png", 512),
        ("icon_512x512@1x.png", 512), ("icon_512x512@2x.png", 1024),
    ]
    ICON_SET.mkdir(parents=True, exist_ok=True)
    for name, size in icons:
        source = simple if size <= 32 else detailed
        source.resize((size, size), Image.LANCZOS).save(ICON_SET / name, "PNG")

    # The in-app mark keeps a transparent background so it sits on the sidebar in
    # either appearance instead of showing a white tile in dark mode.
    padded = Image.new("RGBA", (round(mark.width * 1.06), round(mark.height * 1.06)), (0, 0, 0, 0))
    padded.paste(mark, ((padded.width - mark.width) // 2, (padded.height - mark.height) // 2), mark)
    square = max(padded.size)
    centred = Image.new("RGBA", (square, square), (0, 0, 0, 0))
    centred.paste(padded, ((square - padded.width) // 2, (square - padded.height) // 2), padded)

    BRAND_SET.mkdir(parents=True, exist_ok=True)
    centred.resize((128, 128), Image.LANCZOS).save(BRAND_SET / "BrandIcon.png", "PNG")
    centred.resize((256, 256), Image.LANCZOS).save(BRAND_SET / "BrandIcon@2x.png", "PNG")

    ARTWORK.mkdir(parents=True, exist_ok=True)
    detailed.save(ARTWORK / "App-Icon-1024.png", "PNG")
    centred.resize((1024, 1024), Image.LANCZOS).save(ARTWORK / "Brand-Mark.png", "PNG")

    print(f"Wrote {len(icons)} app icon sizes, BrandIcon 1x/2x, and 2 artwork references.")


if __name__ == "__main__":
    main()
