---
name: drawio-academic-architecture
description: Create or revise editable draw.io architecture and scientific workflow figures with restrained color, shallow 3D modules, meaningful vector motifs, explicit internal mechanisms, and publication-quality PNG/SVG exports. Use for architecture briefs, model pipelines, control loops, system diagrams, or requests to enrich an existing .drawio figure without flattening it.
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
2. Read [architecture-spec.md](references/architecture-spec.md) and [restrained-3d-style.md](references/restrained-3d-style.md). Convert the brief into a versioned JSON spec with stable module/edge IDs, one motif, and one-to-three mechanism lines per module. Validate it with `node scripts/validate-spec.mjs <spec.json>`.
3. For revision, make a versioned copy first. Use `drawio_live_inspect` to inventory stable IDs. Never call `drawio_live_clear` on a revision.
4. Use `drawio-live` for visible construction and refinement: launch, inspect, add shapes/edges, update cells, fit, and save a snapshot. Build shallow editable depth from native faces; use no raster icon as structural content.
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
| Module density | Label, optional subtitle, motif, 1-3 mechanisms |
| Visual language | Listed muted tokens; one fixed 8 x 6 px depth |
| Connectivity | Stable IDs; every endpoint resolves |
| Deliverables | Editable `.drawio`, PNG, SVG, review record |
| Publication | Synthetic content; clean working/index/history scan |

## Common mistakes

- Do not rebuild an existing figure without inspecting it.
- Do not use color, icons, or 3D depth as decoration without semantic purpose.
- Do not hide vague module logic behind a single broad label.
- Do not claim export quality before opening the rendered preview.
- Do not publish a source-derived example merely because names were changed.
