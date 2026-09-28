"""Cut Kumabee out of the LINE stamp images for the app.

Keeps only the largest opaque blob (the embroidered patch), which drops the
caption text and small decorations, then shrinks it to fit in 240x240.

Usage:
  python tools/make_kuma_images.py KUMABEE_DIR FAMILY_DIR [--out img/kuma] [--sheet PREVIEW.png]

KUMABEE_DIR holds the 16 Kumabee stamps; sorted by file name they become k01..k16.
FAMILY_DIR holds stamp_01.png..stamp_24.png; they become y01..y24.
Only the images the app uses (USED) are written.
Needs Pillow, numpy and scipy.
"""
import argparse
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage

USED = ["k01", "k02", "k06", "k07", "k08", "k09", "k10", "k12", "k14", "k15", "k16",
        "y01", "y02", "y03", "y04", "y08", "y09", "y15", "y18", "y19", "y22", "y24"]
SIZE = 240
ALPHA_MIN = 40


def sources(kumabee_dir: Path, family_dir: Path) -> dict[str, Path]:
    kumabee = sorted(kumabee_dir.glob("*.png"))
    if len(kumabee) != 16:
        raise SystemExit(f"expected 16 Kumabee stamps in {kumabee_dir}, found {len(kumabee)}")
    out = {f"k{i:02d}": p for i, p in enumerate(kumabee, 1)}
    for i in range(1, 25):
        p = family_dir / f"stamp_{i:02d}.png"
        if not p.exists():
            raise SystemExit(f"missing {p}")
        out[f"y{i:02d}"] = p
    return out


def cut_out(img: Image.Image) -> Image.Image:
    rgba = np.array(img.convert("RGBA"))
    opaque = rgba[:, :, 3] > ALPHA_MIN
    labels, count = ndimage.label(opaque)
    if count == 0:
        raise ValueError("image is fully transparent")
    sizes = ndimage.sum(opaque, labels, range(1, count + 1))
    keep = labels == int(np.argmax(sizes)) + 1
    rgba[~keep] = 0
    ys, xs = np.nonzero(keep)
    cropped = Image.fromarray(rgba).crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1))
    cropped.thumbnail((SIZE, SIZE), Image.LANCZOS)
    return cropped


def contact_sheet(pairs, path: Path) -> None:
    """Original and cut-out side by side, 4 pairs per row, for a visual check."""
    cell = 200
    rows = (len(pairs) + 3) // 4
    sheet = Image.new("RGB", (cell * 2 * 4, cell * rows), "white")
    draw = ImageDraw.Draw(sheet)
    for i, (key, original, cut) in enumerate(pairs):
        x, y = (i % 4) * cell * 2, (i // 4) * cell
        for j, im in enumerate((original, cut)):
            thumb = im.copy()
            thumb.thumbnail((cell - 20, cell - 30))
            sheet.paste(thumb, (x + j * cell + 10, y + 25), thumb)
        draw.text((x + 10, y + 5), key, fill="black")
    sheet.save(path)


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("kumabee_dir", type=Path)
    ap.add_argument("family_dir", type=Path)
    ap.add_argument("--out", type=Path, default=Path(__file__).resolve().parent.parent / "img" / "kuma")
    ap.add_argument("--sheet", type=Path, help="also write a before/after preview PNG here")
    args = ap.parse_args()

    src = sources(args.kumabee_dir, args.family_dir)
    args.out.mkdir(parents=True, exist_ok=True)
    pairs = []
    for key in USED:
        original = Image.open(src[key]).convert("RGBA")
        cut = cut_out(original)
        cut.save(args.out / f"{key}.png", optimize=True)
        pairs.append((key, original, cut))
        print(f"{key}: {src[key].name} -> {cut.size[0]}x{cut.size[1]}")
    if args.sheet:
        contact_sheet(pairs, args.sheet)
        print(f"preview: {args.sheet}")


if __name__ == "__main__":
    main()
