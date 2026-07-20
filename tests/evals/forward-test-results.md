# MCP Forward Test

Date: 2026-07-20

The installed-by-path Skill was exercised against the separately installed `drawio-scientific-illustrator` plugin version `1.0.0` at revision `dd248168295bbcac34c9d74a8bd9efac3c2fbf99`.

## Live canvas path

- Started a new synthetic draw.io canvas through `drawio-live` without calling `drawio_live_clear`.
- Added one editable title, two editable modules, and one directed connector with stable IDs.
- `drawio_live_inspect` returned four cells with `truncated: false`.
- Updated `forward-filter` in place by stable ID and confirmed the ID remained present.
- Saved an uncompressed throwaway snapshot through `drawio_live_save_snapshot`.

## Saved-file path

- Validated the live snapshot through `drawio-file-utils`.
- Result: `valid: true`, zero errors, zero warnings.
- Inventory: one page, six cells, three vertices, one edge.

## Public example path

- Created, validated, and exported both repository examples through `drawio-file-utils` over stdio.
- Both PNG previews are 2400 pixels wide.
- Both SVG exports are metadata-free and contain no embedded raster payload.
- Original-resolution visual review found no clipping, unintended overlap, unreadable labels, or ambiguous arrow directions.

All live-test files and the temporary draw.io profile remained outside the repository and were removed after the assertions were recorded.
