"""
Generate the equipment icon set and regenerate the equipmentIcons.ts manifest.

This is OFFLINE TOOLING — it is never run by the app. It only touches frontend
assets; nothing here talks to the backend database. The backend's
`app/data/equipment_seed.json` is read purely as the source of truth for which
equipment slugs exist.

The icon set is currently being sourced as a licensed pack rather than
generated, so `manifest` is the command you want. `generate` remains for
filling one-off gaps the pack doesn't cover.

See assets/equipment/README.md for the style spec the two paths share.

Usage
-----
    # 1. Generate a PNG for every equipment slug that doesn't have one yet.
    #    Requires OPENAI_API_KEY. Safe to re-run: existing files are skipped
    #    unless --force is passed.
    python scripts/generate_equipment_icons.py generate

    # Preview what would be generated, without spending anything:
    python scripts/generate_equipment_icons.py generate --dry-run

    # Redo a single icon you're unhappy with:
    python scripts/generate_equipment_icons.py generate --only dumbbells --force

    # 2. Rewrite constants/equipment/equipmentIcons.ts from the seed file plus
    #    whichever PNGs actually exist on disk. Slugs without a file are emitted
    #    as commented-out lines so the gaps stay visible.
    python scripts/generate_equipment_icons.py manifest

`manifest` is the only step needed after dropping in hand-made or licensed
icons — it never calls an image API, so run it freely.
"""
import argparse
import base64
import json
import os
import sys
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent
ASSETS_DIR = ROOT_DIR / "assets" / "equipment"
MANIFEST_PATH = ROOT_DIR / "constants" / "equipment" / "equipmentIcons.ts"
DEFAULT_SEED_PATH = (
    ROOT_DIR.parent / "primerep-backend" / "app" / "data" / "equipment_seed.json"
)

DEFAULT_IMAGE_MODEL = "gpt-image-1"

# Ordering and headings mirror the hand-written manifest this script replaces,
# so diffs stay readable and the groupings remain useful for manual edits.
CATEGORY_LABELS = [
    ("machine", "MACHINES"),
    ("plateLoaded", "PLATE-LOADED"),
    ("benchRack", "BENCHES & RACKS"),
    ("cable", "CABLES"),
    ("freeWeight", "FREE WEIGHTS"),
    ("functional", "FUNCTIONAL"),
    ("bandAccessory", "BANDS & ACCESSORIES"),
    ("cardio", "CARDIO"),
]

# One fixed style prompt for the whole set. Consistency across 97 icons matters
# more than any individual icon being clever, so only the subject varies.
STYLE_PROMPT = (
    "A flat vector icon of a {name}, gym equipment. "
    "Single solid color #6A4FF5 on a fully transparent background. "
    "Clean uniform stroke weight, minimal geometric line-art style, "
    "front-facing three-quarter view, centered, generous even padding, "
    "no text, no labels, no shadows, no gradients, no background shapes."
)


def _load_seed(seed_path: Path) -> list[dict]:
    if not seed_path.exists():
        raise SystemExit(
            f"Equipment seed not found: {seed_path}\n"
            "Pass --seed if the backend repo lives somewhere else."
        )
    with open(seed_path) as f:
        rows = json.load(f)

    unknown = {r["category"] for r in rows} - {c for c, _ in CATEGORY_LABELS}
    if unknown:
        raise SystemExit(
            f"Seed contains categories with no heading mapping: {sorted(unknown)}. "
            "Add them to CATEGORY_LABELS."
        )
    return rows


def _icon_path(slug: str) -> Path:
    return ASSETS_DIR / f"{slug}.png"


def _downscale(path: Path, size: int) -> None:
    """Shrink a generated icon in place. Skipped when Pillow isn't installed —
    the icon is still usable, just larger than it needs to be."""
    try:
        from PIL import Image
    except ImportError:
        print("  (Pillow not installed — keeping full-size PNG)")
        return

    with Image.open(path) as img:
        img = img.convert("RGBA")
        img.thumbnail((size, size), Image.LANCZOS)
        img.save(path, "PNG", optimize=True)


def cmd_generate(args: argparse.Namespace) -> None:
    rows = _load_seed(Path(args.seed))

    if args.only:
        wanted = set(args.only)
        rows = [r for r in rows if r["id"] in wanted]
        missing_slugs = wanted - {r["id"] for r in rows}
        if missing_slugs:
            raise SystemExit(f"Unknown equipment slug(s): {sorted(missing_slugs)}")

    pending = [r for r in rows if args.force or not _icon_path(r["id"]).exists()]

    if not pending:
        print("Every requested icon already exists. Nothing to generate.")
        return

    print(f"{len(pending)} icon(s) to generate (of {len(rows)} requested).")
    if args.dry_run:
        for row in pending:
            print(f"  would generate {row['id']}.png — {row['name']}")
        return

    api_key = os.getenv("OPENAI_API_KEY", "")
    if not api_key:
        raise SystemExit("OPENAI_API_KEY must be set to generate icons.")

    from openai import OpenAI

    client = OpenAI(api_key=api_key)
    model = os.getenv("EQUIPMENT_ICON_MODEL", DEFAULT_IMAGE_MODEL)
    ASSETS_DIR.mkdir(parents=True, exist_ok=True)

    generated, failed = 0, []
    for row in pending:
        slug, name = row["id"], row["name"]
        print(f"Generating {slug}.png — {name}...")
        try:
            response = client.images.generate(
                model=model,
                prompt=STYLE_PROMPT.format(name=name),
                size="1024x1024",
                background="transparent",
                output_format="png",
                n=1,
            )
            image_bytes = base64.b64decode(response.data[0].b64_json)
            destination = _icon_path(slug)
            destination.write_bytes(image_bytes)
            _downscale(destination, args.size)
            generated += 1
        except Exception as exc:  # one bad icon shouldn't abort the batch
            print(f"  FAILED: {exc}")
            failed.append(slug)

    print(f"\nGenerated {generated} icon(s) into {ASSETS_DIR}")
    if failed:
        print(f"Failed {len(failed)}: {', '.join(failed)}")
        print("Re-run to retry only the failures (existing files are skipped).")
    print("Now run: python scripts/generate_equipment_icons.py manifest")


def cmd_manifest(args: argparse.Namespace) -> None:
    rows = _load_seed(Path(args.seed))
    by_category: dict[str, list[dict]] = {}
    for row in rows:
        by_category.setdefault(row["category"], []).append(row)

    lines = [
        "// constants/equipment/equipmentIcons.ts",
        "//",
        "// GENERATED FILE — do not edit entries by hand. Regenerate with:",
        "//   python scripts/generate_equipment_icons.py manifest",
        "//",
        "// Slugs come from the backend equipment seed; a slug is only active if",
        "// assets/equipment/<slug>.png exists. Missing icons stay commented out so",
        "// the remaining gaps are visible at a glance.",
        'import type { ImageSourcePropType } from "react-native";',
        "",
        "export const equipmentIcons: Record<string, ImageSourcePropType> = {",
    ]

    active = 0
    missing = 0
    for category, label in CATEGORY_LABELS:
        entries = by_category.get(category, [])
        if not entries:
            continue

        lines.append(f"  // {label}")
        for row in entries:
            slug = row["id"]
            entry = f'{slug}: require("@/assets/equipment/{slug}.png"),'
            if _icon_path(slug).exists():
                lines.append(f"  {entry}")
                active += 1
            else:
                lines.append(f"  // {entry}")
                missing += 1
        lines.append("")

    lines.append("};")
    contents = "\n".join(lines) + "\n"

    if args.dry_run:
        print(contents)
    else:
        MANIFEST_PATH.write_text(contents)
        print(f"Wrote {MANIFEST_PATH}")

    print(f"{active} active entr(ies), {missing} still missing an icon file.")
    if missing:
        print("Run the 'generate' command (or drop in PNGs manually) to fill the gaps.")


def main() -> None:
    parser = argparse.ArgumentParser(
        description=__doc__,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument(
        "--seed",
        default=str(DEFAULT_SEED_PATH),
        help="Path to equipment_seed.json (default: sibling primerep-backend repo)",
    )
    subparsers = parser.add_subparsers(dest="command", required=True)

    generate_parser = subparsers.add_parser(
        "generate", help="Create PNGs for equipment slugs with no icon (needs OPENAI_API_KEY)"
    )
    generate_parser.add_argument(
        "--only", nargs="+", metavar="SLUG", help="Limit generation to these slugs"
    )
    generate_parser.add_argument(
        "--force", action="store_true", help="Regenerate even if the PNG already exists"
    )
    generate_parser.add_argument(
        "--size", type=int, default=512, help="Max edge length after downscale (default: 512)"
    )
    generate_parser.add_argument(
        "--dry-run", action="store_true", help="List what would be generated and exit"
    )
    generate_parser.set_defaults(func=cmd_generate)

    manifest_parser = subparsers.add_parser(
        "manifest", help="Rewrite equipmentIcons.ts from the seed + existing PNGs"
    )
    manifest_parser.add_argument(
        "--dry-run", action="store_true", help="Print the manifest instead of writing it"
    )
    manifest_parser.set_defaults(func=cmd_manifest)

    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    sys.exit(main())
