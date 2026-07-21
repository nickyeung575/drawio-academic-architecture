---
name: drawio-academic-architecture
description: Use when creating or revising editable draw.io architecture, model-pipeline, control-loop, system, or scientific-workflow figures, especially when enriching an existing .drawio file without flattening it.
---

# Draw.io Academic Architecture

Build quiet, information-rich academic figures on top of the external `drawio-scientific-illustrator` plugin. Preserve editability, inspect revisions by stable ID, and keep confidential sources out of public examples.

## Prerequisite

Require `drawio-scientific-illustrator` version `1.0.0` at commit `dd248168295bbcac34c9d74a8bd9efac3c2fbf99`, with both `drawio-live` and `drawio-file-utils` enabled. Run:

```powershell
node scripts/check-upstream.mjs --plugin-root $env:DRAWIO_SCIENTIFIC_PLUGIN_ROOT --expected-version 1.0.0 --expected-revision dd248168295bbcac34c9d74a8bd9efac3c2fbf99 --strict-revision
```

Stop if preflight fails. Do not install, launch, or mutate the upstream plugin automatically.

## Workflow

1. Classify the request as a new figure, private revision, or public example. A public example must use a newly written synthetic brief; never copy private labels, topology, data, screenshots, or distinctive motifs.
2. Read [architecture-spec.md](references/architecture-spec.md) and [restrained-3d-style.md](references/restrained-3d-style.md). Convert the brief into a versioned JSON spec with stable module/edge IDs, one semantic micro-mechanism, and one-to-three mechanism lines per module. Validate it with `node scripts/validate-spec.mjs <spec.json>`.
3. For revision, make a versioned copy first. Use `drawio_live_inspect` to inventory stable IDs. Never call `drawio_live_clear` on a revision.
4. Use `drawio-live` for visible construction and refinement: launch, inspect, add shapes/edges, update cells, fit, and save a snapshot. Keep supporting modules flat; reserve the reference's fixed `16 x 12 px` editable depth for core modules. Use no raster image as structural content.
5. Use `drawio-file-utils` after saving: run `drawio_validate`, inspect endpoints/counts, and export non-embedded PNG plus SVG. Keep public `.drawio` XML uncompressed.
6. Inspect a PNG at least 2000 px wide. Fix clipping, overlap, low contrast, ambiguous arrows, inconsistent depth, or unreadable mechanism lines, then validate and export again.
7. For public output, run `node scripts/scan-public-tree.mjs --root <public-root>`. For a release, also use `--history --require-extra-terms` with a non-committed local denylist.

## Tool boundary

- `drawio-live`: visible canvas state and cell-level edits.
- `drawio-file-utils`: saved-file validation, inspection, and export.
- Local scripts: spec validation, dependency preflight, and publication privacy checks.

## Quick checks

| Check | Requirement |
|---|---|
| Source safety | Copy first; no clear during revisions |
| Module density | Label, optional subtitle, semantic micro-mechanism, 1-3 mechanism lines |
| Visual language | Flat supporting modules; selective `16 x 12 px` core depth; readable semantic micro-mechanisms |
| Connectivity | Stable IDs; every endpoint resolves |
| Deliverables | Editable `.drawio`, PNG, SVG, review record |
| Publication | Synthetic content; clean working/index/history scan |

## Common mistakes

- Do not rebuild an existing figure without inspecting it.
- Do not apply 3D depth universally or substitute decorative icons for semantic micro-mechanisms.
- Do not hide vague module logic behind a single broad label.
- Do not claim export quality before opening the rendered preview.
- Do not publish a source-derived example merely because names were changed.
