#!/usr/bin/env python3
"""
Generates the extension icons, the Chrome Web Store promo tile and a placeholder
screenshot. Original artwork only: a rounded orange square with a white tick and a
single white "pixel" square. No third party logos or trademarks.

Run: python3 tools/make-assets.py
"""

import os
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
ICONS = os.path.join(ROOT, "icons")
STORE = os.path.join(ROOT, "store")

ACCENT = (228, 87, 46, 255)
ACCENT_DARK = (185, 63, 29, 255)
INK = (28, 27, 26, 255)
INK_SOFT = (87, 83, 78, 255)
PAPER = (255, 255, 255, 255)
PAPER_SOFT = (250, 248, 246, 255)
LINE = (229, 225, 220, 255)
PASS = (31, 122, 77, 255)
WARN = (181, 115, 11, 255)
FAIL = (192, 57, 43, 255)

FONT_DIRS = [
    "/usr/share/fonts/truetype/liberation",
    "/usr/share/fonts/truetype/dejavu",
]


def font(name_options, size):
    for directory in FONT_DIRS:
        for name in name_options:
            path = os.path.join(directory, name)
            if os.path.exists(path):
                return ImageFont.truetype(path, size)
    return ImageFont.load_default()


def bold(size):
    return font(["LiberationSans-Bold.ttf", "DejaVuSans-Bold.ttf"], size)


def regular(size):
    return font(["LiberationSans-Regular.ttf", "DejaVuSans.ttf"], size)


def mono(size):
    return font(["LiberationMono-Regular.ttf", "DejaVuSansMono.ttf"], size)


def draw_mark(size, supersample=8):
    """Rounded orange square, white tick, one white pixel square top right."""
    s = size * supersample
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    radius = int(s * 0.22)
    d.rounded_rectangle([0, 0, s - 1, s - 1], radius=radius, fill=ACCENT)

    # the "pixel": a small white square, top left
    px = int(s * 0.145)
    d.rectangle(
        [int(s * 0.19), int(s * 0.17), int(s * 0.19) + px, int(s * 0.17) + px],
        fill=PAPER,
    )

    # the tick
    width = max(1, int(s * 0.115))
    start = (int(s * 0.25), int(s * 0.60))
    end = (int(s * 0.79), int(s * 0.40))
    d.line(
        [start, (int(s * 0.43), int(s * 0.76)), end],
        fill=PAPER,
        width=width,
        joint="curve",
    )
    # rounded stroke ends
    r = width // 2
    for point in [start, end]:
        d.ellipse([point[0] - r, point[1] - r, point[0] + r, point[1] + r], fill=PAPER)

    return img.resize((size, size), Image.LANCZOS)


def make_icons():
    os.makedirs(ICONS, exist_ok=True)
    for size in (16, 32, 48, 128):
        img = draw_mark(size)
        img.save(os.path.join(ICONS, "icon-%d.png" % size))
        print("icons/icon-%d.png" % size)


def make_promo_tile():
    os.makedirs(STORE, exist_ok=True)
    w, h = 440, 280
    img = Image.new("RGBA", (w, h), PAPER)
    d = ImageDraw.Draw(img)

    d.rectangle([0, 0, w, 6], fill=ACCENT)

    mark = draw_mark(56)
    img.paste(mark, (32, 40), mark)

    d.text((100, 44), "Click ID Checker", font=bold(24), fill=INK)
    d.text((100, 76), "for Google & Microsoft Ads", font=regular(15), fill=INK_SOFT)

    rows = [
        (PASS, "gclid stored in _gcl_aw"),
        (FAIL, "Form captures no click ID"),
        (WARN, "Consent Mode denies ad_storage"),
    ]
    y = 136
    for colour, label in rows:
        d.ellipse([34, y + 5, 44, y + 15], fill=colour)
        d.text((56, y), label, font=regular(14), fill=INK)
        y += 28

    d.text((34, 236), "One click. Nothing leaves the browser.", font=regular(13), fill=INK_SOFT)
    d.text((34, 254), "firepixel.co.uk", font=bold(13), fill=ACCENT_DARK)

    path = os.path.join(STORE, "promo-tile-440x280.png")
    img.convert("RGB").save(path)
    print("store/promo-tile-440x280.png")


POPUP_MOCK = [
    ("h", "Click ID Checker  |  FIRE PIXEL"),
    ("", ""),
    ("v", "Not attributable as-is"),
    ("s", "2 blocking problems found. A lead from this page would"),
    ("s", "not be matched back to the ad click."),
    ("s", "https://example.co.uk/plumbers-london/?gclid=TEST123"),
    ("", ""),
    ("t", "[ 2 fail ]  [ 3 warn ]  [ 1 pass ]  [ 4 info ]"),
    ("", ""),
    ("d", "DETECTED: Google tag (AW-123456789) - GTM-ABCD123 -"),
    ("d", "Consent banner: CookieYes"),
    ("", ""),
    ("i", "info    Click ID found in the URL"),
    ("f", "FAIL    gclid was not written to _gcl_aw"),
    ("b", "        The Google tag is on the page but _gcl_aw is"),
    ("b", "        missing. Common causes: Consent Mode denies"),
    ("b", "        ad_storage, the tag fires after consent only,"),
    ("b", "        or the conversion linker is switched off."),
    ("w", "warn    Consent Mode denies ad_storage"),
    ("f", "FAIL    #contact collects an email address but"),
    ("f", "        captures no click ID"),
    ("b", "        HOW TO FIX: Contact Form 7 does not populate"),
    ("b", "        hidden fields on its own. Add the hidden field"),
    ("b", "        and fill it from the query string."),
    ("p", "pass    Consent Mode v2 signals present"),
    ("i", "info    No same origin redirects recorded"),
    ("", ""),
    ("c", "[ Scan this page ]  [ Copy report ]"),
    ("", ""),
    ("s", "Free Google Ads Signal Plan scan  -  Privacy"),
]


def make_screenshot_placeholder():
    os.makedirs(STORE, exist_ok=True)
    w, h = 1280, 800
    img = Image.new("RGBA", (w, h), PAPER_SOFT)
    d = ImageDraw.Draw(img)

    d.rectangle([0, 0, w, 8], fill=ACCENT)
    d.text((48, 40), "PLACEHOLDER", font=bold(34), fill=FAIL)
    d.text((48, 84), "Replace with a real 1280x800 screenshot of the popup before submitting to the Chrome Web Store.",
           font=regular(18), fill=INK_SOFT)

    # popup mock panel
    panel = [48, 132, 48 + 620, 132 + 620]
    d.rounded_rectangle(panel, radius=12, fill=PAPER, outline=LINE, width=2)

    colours = {
        "h": (INK, bold(17)),
        "v": (FAIL, bold(20)),
        "s": (INK_SOFT, regular(13)),
        "t": (INK, mono(13)),
        "d": (INK_SOFT, mono(12)),
        "i": (INK_SOFT, mono(13)),
        "p": (PASS, mono(13)),
        "w": (WARN, mono(13)),
        "f": (FAIL, mono(13)),
        "b": (INK_SOFT, mono(12)),
        "c": (ACCENT_DARK, mono(14)),
    }

    y = 156
    for kind, text in POPUP_MOCK:
        if not text:
            y += 10
            continue
        colour, fnt = colours[kind]
        d.text((72, y), text, font=fnt, fill=colour)
        y += 21

    # notes column
    nx = 720
    d.text((nx, 140), "What this screenshot should show", font=bold(20), fill=INK)
    notes = [
        "1. The popup open on a real landing page.",
        "2. The verdict line at the top.",
        "3. At least one FAIL with its fix text expanded.",
        "4. The detected tags line.",
        "5. The footer links.",
        "",
        "Capture at 1280x800 with the popup at 2x so the",
        "text is legible in the store gallery. Do not include",
        "a client site, a real account number or any",
        "personal data in the frame.",
    ]
    ny = 180
    for line in notes:
        d.text((nx, ny), line, font=regular(15), fill=INK_SOFT)
        ny += 26

    d.text((48, 756), "Fire Pixel  -  firepixel.co.uk  -  CopperChunk Limited", font=regular(14), fill=INK_SOFT)

    path = os.path.join(STORE, "screenshot-1280x800-PLACEHOLDER.png")
    img.convert("RGB").save(path)
    print("store/screenshot-1280x800-PLACEHOLDER.png")


if __name__ == "__main__":
    make_icons()
    make_promo_tile()
    make_screenshot_placeholder()
