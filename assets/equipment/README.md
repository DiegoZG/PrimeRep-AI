# Equipment icons

One PNG per equipment slug. The slug list is owned by the backend seed file,
`primerep-backend/app/data/equipment_seed.json` (97 entries) — filenames must
match those `id` values exactly, e.g. `squat_rack.png`.

## Target style

Icons render at roughly 72px inside `EquipmentCard`, on both light and dark
backgrounds, so the set is specified as:

| Property | Value |
|---|---|
| Format | PNG, transparent background |
| Size | 512×512 (plenty for a ~72px render) |
| Colour | Single flat `#6A4FF5` — one colour works on both themes; a black or white set would disappear in one of them |
| Style | Minimal geometric line art, uniform stroke weight, centered with even padding |

Avoid photographic or 3D-rendered icons: they turn to mush at this size, and a
full set of them runs into hundreds of megabytes.

## Adding icons

Drop the PNGs in this directory, then regenerate the manifest:

```bash
.venv/bin/python scripts/generate_equipment_icons.py manifest
```

That rewrites `constants/equipment/equipmentIcons.ts` from the seed list plus
whichever files actually exist here. Slugs with no file stay commented out, so
`equipmentIcons.ts` doubles as the checklist of what's still missing.
`EquipmentCard` falls back to the equipment's first letter for those.

## Current state

`abductor_machine.png` predates this spec — it's a 3D render, not line art, and
should be replaced when the rest of the set lands.
