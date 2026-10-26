"""Render 'where to look' locator cards from art bundled in this repository.

Each card combines a real Terraria biome background, the real game sprite of
the chest/creature/object and a neutral locator overlay. Cards are explicitly
labelled as guides in the UI: they show *where* something is found, they are
not fake screenshots of a world. Fully offline and deterministic.
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter, ImageEnhance
import json
import random

ROOT = Path(__file__).resolve().parent.parent
BIOMES = ROOT / "public" / "images" / "biomes"
OUT = ROOT / "public" / "images" / "places"
OUT.mkdir(parents=True, exist_ok=True)
W, H = 960, 540

catalog = json.loads((ROOT / "src" / "data" / "catalog.json").read_text())
icons = catalog["sprites"]["icons"]
sheets = catalog["sprites"]["sheets"]


def sheet(index):
    return Image.open(
        ROOT / "public" / "images" / Path(sheets[index]["file"]).name
    ).convert("RGBA")


def sprite(name, scale=4):
    s, x, y, w, h = icons[name]
    return sheet(s).crop((x, y, x + w, y + h)).resize(
        (w * scale, h * scale), Image.Resampling.NEAREST
    )


def background(name, brightness=0.72, blur=2.4, saturation=0.9):
    im = Image.open(BIOMES / f"{name}.webp").convert("RGB").resize((W, H))
    im = im.filter(ImageFilter.GaussianBlur(blur))
    im = ImageEnhance.Brightness(im).enhance(brightness)
    im = ImageEnhance.Color(im).enhance(saturation)
    return im.convert("RGBA")


def locator(im, cx, cy, color, rings=(210, 150, 92)):
    """Concentric rings and tick marks: a deliberate locator graphic, not terrain."""
    layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    for r, alpha in zip(rings, (54, 68, 84)):
        d.ellipse((cx - r, cy - r, cx + r, cy + r), outline=(*color, alpha), width=2)
    # Four radial ticks around the marker.
    for dx, dy in ((0, -1), (0, 1), (-1, 0), (1, 0)):
        d.line(
            (cx + dx * rings[0], cy + dy * rings[0],
             cx + dx * (rings[0] + 16), cy + dy * (rings[0] + 16)),
            fill=(*color, 120), width=3,
        )
    im.alpha_composite(layer.filter(ImageFilter.GaussianBlur(0.4)))


def glow(im, cx, cy, color, radius=190, strength=(30, 42, 58)):
    layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    for r, a in zip((radius, radius * 0.6, radius * 0.32), strength):
        d.ellipse((cx - r, cy - r, cx + r, cy + r), fill=(*color, a))
    im.alpha_composite(layer.filter(ImageFilter.GaussianBlur(30)))


def pedestal(im, cx, cy, width, color="#1a2426"):
    """A soft slab and a shadow under the object, so it does not float."""
    layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    d.ellipse((cx - width * 0.7, cy - 18, cx + width * 0.7, cy + 30),
              fill=(*Image.new("RGB", (1, 1), color).getpixel((0, 0)), 200))
    d.ellipse((cx - width * 0.52, cy - 12, cx + width * 0.52, cy + 18),
              fill=(60, 78, 72, 180))
    im.alpha_composite(layer.filter(ImageFilter.GaussianBlur(10)))


def overlay(im, seed, dust=26, tint=(6, 12, 16)):
    im = im.convert("RGB")
    # Edge vignette keeps the centre readable in the modal and in thumbnails.
    mask = Image.new("L", (W, H), 0)
    ImageDraw.Draw(mask).ellipse((-W * 0.18, -H * 0.42, W * 1.18, H * 1.42), fill=255)
    mask = mask.filter(ImageFilter.GaussianBlur(120))
    dark = Image.new("RGB", (W, H), tint_colour(tint))
    im = Image.composite(im, Image.blend(im, dark, 0.72), mask)
    # Faint scan grid for the "guide" feel.
    g = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    gd = ImageDraw.Draw(g)
    for x in range(0, W, 48):
        gd.line((x, 0, x, H), fill=(190, 220, 200, 8))
    for y in range(0, H, 48):
        gd.line((0, y, W, y), fill=(190, 220, 200, 8))
    im = Image.alpha_composite(im.convert("RGBA"), g).convert("RGB")
    if dust:
        rng = random.Random(seed)
        d = ImageDraw.Draw(im)
        for _ in range(dust):
            x, y = rng.randint(40, W - 40), rng.randint(40, H - 40)
            d.rectangle((x, y, x + 2, y + 2), fill="#c9e3d6")
    return im


def tint_colour(rgb):
    return "#%02x%02x%02x" % rgb


def save(im, name, seed, dust=26):
    im = overlay(im, seed, dust)
    im.save(OUT / f"{name}.webp", quality=88, method=6)
    print(name, (OUT / f"{name}.webp").stat().st_size)


def card(name, biome, sprite_name, color, brightness=0.72, scale=4, seed=1):
    im = background(biome, brightness)
    cx, cy = W // 2, H // 2 + 24
    glow(im, cx, cy - 40, color)
    locator(im, cx, cy - 40, color)
    pedestal(im, cx, cy + 66, 150)
    spr = sprite(sprite_name, scale)
    im.alpha_composite(spr, (cx - spr.width // 2, cy - spr.height // 2))
    save(im, name, seed)


# Containers, crates and creatures that represent each location.
card("underground", "forest", "Golden_Chest.png", (150, 210, 190), 0.6, 4, 3)
card("dungeon", "dungeon", "Blue_Dungeon_Chest.png", (130, 170, 230), 0.8, 4, 9)
card("jungle", "jungle", "Nature%27s_Gift.png", (160, 220, 130), 0.62, 5, 12)
card("hallow", "celestial", "Hallowed_Chest.png", (212, 184, 255), 0.6, 4, 15)
card("crimson", "corruption", "Crimson_Chest.png", (240, 145, 150), 0.62, 4, 18)
card("corruption", "corruption", "Ebonwood_Chest.png", (190, 155, 235), 0.68, 4, 21)
card("underworld", "underworld", "Hellstone_Crate.png", (255, 150, 90), 0.82, 4, 24)
card("spider", "dungeon", "Web_Covered_Chest.png", (180, 195, 215), 0.64, 4, 27)
card("temple", "temple", "Lihzahrd_Chest.png", (235, 190, 110), 0.6, 4, 30)

# Surface locations: no pedestal, the object sits low in the frame.
def surface_card(name, biome, sprite_name, color, brightness=0.74, scale=3, seed=0, tint=None):
    im = background(biome, brightness, 1.8, 1.0)
    if tint:
        im = Image.alpha_composite(im, Image.new("RGBA", (W, H), (*tint, 90)))
    cx, cy = W // 2, H // 2 + 40
    glow(im, cx, cy - 26, color)
    locator(im, cx, cy - 20, color, (200, 142, 86))
    spr = sprite(sprite_name, scale)
    im.alpha_composite(spr, (cx - spr.width // 2, cy - spr.height))
    save(im, name, seed)


surface_card("forest", "forest", "Work_Bench.png", (190, 220, 160), 0.72, 3, 33)
# Desert uses its own bundle background if present; the snow skyline would be a lie.
if (BIOMES / "desert.webp").exists():
    surface_card("desert", "desert", "Desert_Chest.png", (235, 200, 120), 0.96, 3, 36)
else:
    surface_card("desert", "snow", "Desert_Chest.png", (235, 200, 120), 0.9, 3, 36, (188, 146, 84))
surface_card("snow", "snow", "Ice_Chest.png" if "Ice_Chest.png" in icons else "Frozen_Chest.png", (200, 230, 255), 0.86, 3, 39)
surface_card("ocean", "meadow", "Water_Chest.png", (140, 200, 220), 0.74, 3, 42, (36, 96, 128))
surface_card("mushroom", "forest", "Mushroom_Chest.png", (170, 210, 230), 0.72, 3, 45, (26, 74, 90))
surface_card("graveyard", "moonforest", "Tombstone.png", (190, 185, 210), 0.7, 3, 48, (58, 46, 70))
surface_card("space", "celestial", "Skyware_Chest.png", (205, 215, 245), 1.05, 3, 51)

# ---- Enchanted Sword Shrine ------------------------------------------------------
# The sword is shown embedded in a stone plinth, with a light shaft from above.
im = background("forest", 0.64, 2.4)
cx, cy = W // 2, H // 2 + 34
# A neutral slab plus the real sword sprite: a diagram, not a false map.
glow(im, cx, cy - 60, (150, 220, 255), 220)
locator(im, cx, cy - 40, (150, 220, 255), (235, 165, 104))
beam = Image.new("RGBA", (W, H), (0, 0, 0, 0))
bd = ImageDraw.Draw(beam)
bd.polygon([(cx - 42, 0), (cx + 42, 0), (cx + 120, cy + 60), (cx - 120, cy + 60)],
           fill=(206, 238, 244, 22))
im.alpha_composite(beam.filter(ImageFilter.GaussianBlur(18)))
pedestal(im, cx, cy + 74, 120)
slab = Image.new("RGBA", (240, 84), (0, 0, 0, 0))
dd = ImageDraw.Draw(slab)
dd.rectangle((0, 0, 239, 83), fill=(60, 68, 62, 255))
dd.rectangle((0, 0, 239, 83), outline=(22, 27, 24, 255), width=4)
for x in range(0, 240, 40):
    dd.line((x, 0, x, 83), fill=(40, 47, 42, 255), width=3)
for y in range(0, 84, 28):
    dd.line((0, y, 240, y), fill=(40, 47, 42, 255), width=3)
im.alpha_composite(slab, (cx - 120, cy + 48))
sword = sprite("Enchanted_Sword.png", 5)
im.alpha_composite(sword, (cx - sword.width // 2, cy + 40 - sword.height))
save(im, "shrine", 61, 34)
