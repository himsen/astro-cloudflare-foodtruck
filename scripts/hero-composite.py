"""Compose a dramatic hero from the owner's own photos.

usage: python scripts/hero-composite.py (needs Pillow: pip install Pillow) <raw_pictures dir> <out.png>
Truck (fb4) on the right with a feathered edge, spit chickens (fb3) in front
of its left half, a warm dark grade, a fire-like glow under the chickens and a
dark left third for the headline.
"""
import sys
from PIL import Image, ImageDraw, ImageEnhance, ImageFilter, ImageChops

raw, out = sys.argv[1], sys.argv[2]
W, H = 2400, 1000
DARK = (31, 14, 8)


def hgrad(w, h, x0, x1):
    """L mask: 0 left of x0, ramps to 255 at x1, 255 to the right."""
    row = Image.new("L", (w, 1))
    for x in range(w):
        t = 0 if x <= x0 else 255 if x >= x1 else round(255 * (x - x0) / (x1 - x0))
        row.putpixel((x, 0), t)
    return row.resize((w, h))


canvas = Image.new("RGB", (W, H), DARK)

# Truck, right side, feathered into the dark on its left.
truck = Image.open(f"{raw}/fb4.jpg").convert("RGB")
tw = round(truck.width * H / truck.height)
truck = truck.resize((tw, H), Image.LANCZOS)
truck = ImageEnhance.Brightness(truck).enhance(0.8)
truck = ImageEnhance.Contrast(truck).enhance(1.15)
tx = W - tw
canvas.paste(truck, (tx, 0), hgrad(tw, H, 0, 420))

# Chickens, lower middle, soft oval mask.
ck = Image.open(f"{raw}/fb3.jpg").convert("RGB")
cw = 900
ch = round(ck.height * cw / ck.width)
ck = ck.resize((cw, ch), Image.LANCZOS)
ck = ImageEnhance.Contrast(ck).enhance(1.15)
ck = ImageEnhance.Color(ck).enhance(1.2)
m = Image.new("L", (cw, ch), 0)
ImageDraw.Draw(m).ellipse((cw * 0.1, ch * 0.12, cw * 0.86, ch * 1.3), fill=255)
m = m.filter(ImageFilter.GaussianBlur(55))
canvas.paste(ck, (780, H - ch + 60), m)

# Fire glow under the chickens.
glow = Image.new("RGB", (W, H), (0, 0, 0))
ImageDraw.Draw(glow).ellipse((760, H - 90, 1800, H + 300), fill=(255, 105, 15))
glow = glow.filter(ImageFilter.GaussianBlur(110))
canvas = ImageChops.screen(canvas, ImageEnhance.Brightness(glow).enhance(0.55))

# Warm grade.
canvas = Image.blend(canvas, ImageChops.multiply(canvas, Image.new("RGB", (W, H), (255, 160, 90))), 0.3)

# Dark left for the text: solid to x=700, fading out by x=1250.
canvas = Image.composite(canvas, Image.new("RGB", (W, H), DARK), hgrad(W, H, 650, 1250))

canvas.save(out)
