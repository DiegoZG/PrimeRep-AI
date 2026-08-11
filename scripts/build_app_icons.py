"""
Build the app icon files that app.json references but that aren't checked in.

Only the artwork itself is AI-generated (the two mark layers, produced once and
kept in assets/images/). Everything this script does is deterministic image
maths — solid fills, centering, scaling — so re-running it always yields the
same output and never costs anything.

Usage
-----
    .venv/bin/python scripts/build_app_icons.py

Inputs (must already exist in assets/images/):
    icon.png                     - master app icon, used to derive the favicon
    android-icon-foreground.png  - the mark on a transparent background
    android-icon-monochrome.png  - flat white silhouette of the mark

Outputs (written to assets/images/):
    android-icon-foreground.png  - rescaled into the adaptive-icon safe zone
    android-icon-monochrome.png  - rescaled into the adaptive-icon safe zone
    android-icon-background.png  - solid fill matching app.json backgroundColor
    favicon.png                  - small square icon for web

Android masks adaptive icons to arbitrary shapes and only guarantees the middle
66% of each layer is visible, so both mark layers get scaled down into that
circle rather than being shipped edge to edge.
"""
import sys
from pathlib import Path

from PIL import Image

ROOT_DIR = Path(__file__).resolve().parent.parent
IMAGES_DIR = ROOT_DIR / "assets" / "images"

# Expo's own templates ship 1024x1024 adaptive layers; the Android spec minimum
# is 432x432. Larger sources give prebuild better material to downsample from.
ADAPTIVE_SIZE = 1024
SAFE_ZONE_RATIO = 0.66

# Must stay in sync with expo.android.adaptiveIcon.backgroundColor in app.json.
BACKGROUND_COLOR = "#E6F4FE"

FAVICON_SIZE = 48


def _fit_to_safe_zone(path: Path) -> None:
    """Scale a transparent mark down so its visible content fits the safe zone,
    then recentre it on a full-size transparent canvas."""
    with Image.open(path) as source:
        mark = source.convert("RGBA")

    bbox = mark.getbbox()
    if bbox is None:
        raise SystemExit(f"{path.name} is fully transparent — nothing to place.")

    cropped = mark.crop(bbox)
    target = int(ADAPTIVE_SIZE * SAFE_ZONE_RATIO)
    cropped.thumbnail((target, target), Image.LANCZOS)

    canvas = Image.new("RGBA", (ADAPTIVE_SIZE, ADAPTIVE_SIZE), (0, 0, 0, 0))
    canvas.paste(
        cropped,
        (
            (ADAPTIVE_SIZE - cropped.width) // 2,
            (ADAPTIVE_SIZE - cropped.height) // 2,
        ),
    )
    canvas.save(path, "PNG", optimize=True)
    print(f"  {path.name}: mark fitted to {cropped.width}x{cropped.height} in {ADAPTIVE_SIZE}px canvas")


def _write_background() -> None:
    path = IMAGES_DIR / "android-icon-background.png"
    Image.new("RGBA", (ADAPTIVE_SIZE, ADAPTIVE_SIZE), BACKGROUND_COLOR).save(
        path, "PNG", optimize=True
    )
    print(f"  {path.name}: solid {BACKGROUND_COLOR}")


def _write_favicon() -> None:
    source_path = IMAGES_DIR / "icon.png"
    if not source_path.exists():
        raise SystemExit(f"Missing {source_path} — cannot derive the favicon.")

    with Image.open(source_path) as source:
        icon = source.convert("RGBA")

    icon = icon.resize((FAVICON_SIZE, FAVICON_SIZE), Image.LANCZOS)
    path = IMAGES_DIR / "favicon.png"
    icon.save(path, "PNG", optimize=True)
    print(f"  {path.name}: {FAVICON_SIZE}x{FAVICON_SIZE} derived from icon.png")


def main() -> None:
    print(f"Writing app icons into {IMAGES_DIR}")

    for name in ("android-icon-foreground.png", "android-icon-monochrome.png"):
        path = IMAGES_DIR / name
        if not path.exists():
            raise SystemExit(
                f"Missing {path}.\n"
                "Both mark layers must be present before running this script."
            )
        _fit_to_safe_zone(path)

    _write_background()
    _write_favicon()
    print("Done.")


if __name__ == "__main__":
    sys.exit(main())
