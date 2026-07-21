# Restrained 3D Academic Diagram Style

Use this system for editable architecture figures that need clear hierarchy, quiet color, and a shallow sense of depth. Color supports meaning; it never carries meaning alone.

## Core color tokens

| Token | Hex | Use |
|---|---:|---|
| `canvas` | `#FAFBFC` | Page background |
| `surface` | `#FFFFFF` | Labels, callouts, and inset panels |
| `text-primary` | `#263238` | Titles, module labels, and body text |
| `text-secondary` | `#5F6B73` | Subtitles and annotations |
| `text-muted` | `#7A858D` | Tertiary notes only |
| `rule-light` | `#D9DFE3` | Dividers and non-semantic boundaries |
| `shadow` | `#263238` | Optional shadow at 6% opacity |

Use one accent family per semantic role. Keep body text at `text-primary` or `text-secondary`; do not set paragraphs in an accent color.

| Family | Muted fill | Line | Mechanism | Typical role |
|---|---:|---:|---:|---|
| `neutral` | `#F3F5F6` | `#88939B` | `#59656D` | Context or supporting structure |
| `slate` | `#E9EEF2` | `#6E7F8D` | `#425563` | Routing or system structure |
| `teal` | `#E3F1EF` | `#5C918A` | `#276B64` | Data or observation |
| `sage` | `#EAF1E6` | `#7F9A71` | `#55734B` | Evaluation or accepted state |
| `clay` | `#F3E8E2` | `#A97C68` | `#805442` | Action or transformation |
| `khaki` | `#F3EEDA` | `#A49558` | `#756A37` | Constraint or caution |
| `plum` | `#F0E7EE` | `#92758B` | `#684E63` | Model or fusion |

Do not introduce new accent hex values within a figure. Reuse a family consistently, and add a text label, icon, line pattern, or shape cue wherever color distinguishes states.

## Typography

Use `Arial, Helvetica, sans-serif` for portable rendering. Use sentence case, never all caps for prose, and avoid italic text below 11 px.

| Element | Size / line height | Weight | Color |
|---|---:|---:|---:|
| Figure title | 20 / 26 px | 600 | `text-primary` |
| Region heading | 14 / 19 px | 600 | `text-primary` |
| Module label | 13 / 17 px | 600 | `text-primary` |
| Module subtitle | 10 / 14 px | 400 | `text-secondary` |
| Mechanism line | 9 / 13 px | 400 | `text-primary` |
| Connector label | 9 / 12 px | 500 | `text-secondary` |

Keep titles and module labels to one line. Prefer short noun phrases. Align text left inside modules; center text only in small terminal or junction shapes.

## Grid, spacing, and density

- Base grid: `4 px`; place and size every major object on this grid.
- Canvas margin: `32 px`; region-to-region gap: `24 px`.
- Module gap: `24 px` along the main flow and `16 px` between parallel peers.
- Module padding: `12 px`; micro-mechanism-to-text gap: `8 px`; internal row gap: `4 px`.
- Minimum module front face: `144 x 88 px`; preferred maximum: `216 x 128 px`.
- Use one label, zero or one subtitle, one semantic micro-mechanism, and one to three mechanism lines per module.
- Keep each mechanism line to one visual line, normally two to six words. Never exceed three lines.
- Reserve roughly 25% of the canvas as uninterrupted whitespace. If a region needs more than seven peers, split it into labeled subregions.
- Keep at least `8 px` between a connector and an unrelated object, and at least `12 px` between connector labels.

## Selective 3D module construction

Classify modules before drawing them. A **supporting module** is a flat front card: it has no fake top face, side face, detached diagonal, or depth outline. Inputs, encoders, observers, monitors, annotations, junctions, and small status shapes normally stay flat. Their hierarchy comes from layout, typography, and the semantic micro-mechanism.

A **core module** may use shallow 3D when it performs a decisive transformation, fusion, gate, constraint, safety filter, or action-producing operation. Build it as an editable group containing a front rectangle, explicit top and right faces, semantic micro-mechanism, and text. For a front face at `(x, y)` with width `w` and height `h`, use the fixed depth vector `(+16, -12) px`:

- Top face points: `(x,y)`, `(x+16,y-12)`, `(x+w+16,y-12)`, `(x+w,y)`.
- Right face points: `(x+w,y)`, `(x+w+16,y-12)`, `(x+w+16,y+h-12)`, `(x+w,y+h)`.
- Front face: family muted fill at 100% opacity, family line at approximately `1.2 px`, and `8 px` corner radius.
- Top face: an explicit same-family color roughly 4-8% lighter than the front, at 100% opacity.
- Right face: an explicit same-family color roughly 10-14% darker than the front, at 100% opacity.
- Face seams: fully opaque family line at `0.8-1 px`; no gradients, bevels, gloss, or perspective distortion.
- Draw order: top face, right face, front face, then semantic micro-mechanism and text. Group all parts without flattening.

Use explicit polygons or native draw.io parallelograms with fixed skew: top `fixedSize=1;size=16`, right `direction=south;flipH=1;fixedSize=1;size=12`. Never use the default proportional parallelogram; its skew changes with module size and produces inconsistent or detached depth.

All faces must share their boundary coordinates exactly. The top/front seam uses the same two endpoints, as does the right/front seam; the top and right meet at the same upper-right edge. After export, the four rendered right-face endpoints must match the right-face points listed above within exporter rounding tolerance; an opposite-corner or mirrored join is invalid even when its skew and thickness are numerically correct. Do not approximate shared edges with duplicate strokes, detached diagonals, or decorative tails. Verify the exported SVG paths, not only the editable canvas appearance.

Depth is a selective hierarchy cue, not a universal decoration. Borders use the selected family line. Disable shadows by default. If a core solid cannot separate from the canvas, use one shadow only: `shadow` at 6% opacity, offset `1 x 2 px`, blur `4 px`; never stack shadows.

## Semantic micro-mechanisms

A semantic micro-mechanism is a compact explanation of what happens inside a module, not a decorative icon. Build it from editable native vectors and make the depicted relationship legible: input-to-output transformation, convergence, threshold, constraint, state change, or diagnostic comparison. Use a `52-72 px` dominant dimension, consistent `1-1.5 px` strokes, round joins, and colors from the module's existing family.

| Concept | Preferred mechanism | Avoid |
|---|---|---|
| Data | Stacked records, sampled planes, waveform slices, or sensor marks | Vendor logos or photorealistic media |
| Model / encoder | Layered tensor blocks narrowing toward a compact representation | Brain clip art or dense network meshes |
| Safety / confidence | Threshold plane with visibly accepted and rejected paths | A shield or checkmark with no mechanism |
| Routing | Labeled fork, merge, switch, or waypoint path | Decorative road or map art |
| Fusion | Multiple incoming bands converging into one joined state | Unexplained sparkle symbols |
| Constraint | Boundaries or limit slabs defining a feasible region | A generic lock with no relationship |
| Evaluation | Diagnostic curve, comparison ticks, bars, or gauge with a reference | Unlabelled trophies or rankings |
| Action | State-to-command sequence, editable lever, actuator, or output pulse | Device-specific silhouette alone |

The mechanism supplements the label but does not replace it. Use multiple interacting parts when the concept is relational; a lone generic symbol is insufficient. Avoid emoji and raster images. Simplify the mechanism before reducing text below the minimum size.

## Connectors

Route connectors orthogonally with rounded bends of `6 px`. Enter and leave modules at deliberate ports, prefer horizontal main flow, and never run a line through an unrelated module. Use one arrowhead at the target unless the relation is explicitly bidirectional.

| Role | Stroke | Pattern | Target marker | Use |
|---|---:|---|---|---|
| `flow` | `#4C5963`, 1.75 px | Solid | Filled block arrow, 8 px | Primary progression |
| `feedback` | `#5C7E8C`, 1.5 px | `6 px / 4 px` dash | Open arrow, 8 px | Return or recurrent path |
| `constraint` | `#8C6556`, 1.5 px | `2 px / 3 px` dash | Filled diamond, 7 px | Gate, limit, or condition |
| `reference` | `#7B7F84`, 1.25 px | `1 px / 3 px` dot | Open arrow, 7 px | Context or non-flow relation |

Place labels near the middle of a clear segment, never on a bend or arrowhead. Give every connector label a `surface` background, `3 px` horizontal and `2 px` vertical padding, no border, and at least `4 px` clearance from the line.

When four or more parallel connectors share a direction, use an aligned routing lane or labeled bus. Do not merge lines if doing so hides individual endpoints or semantic roles.

## Quick reference

| Property | Standard |
|---|---|
| Background | `canvas` (`#FAFBFC`) |
| Text | `text-primary` (`#263238`) |
| Grid / margins | `4 px` / `32 px` |
| Module padding / gap | `12 px` / `24 px` |
| Depth treatment | Supporting modules flat; core modules `(+16, -12) px` only |
| Front border / radius | `1.25 px` / `8 px` |
| Semantic micro-mechanism | `52-72 px`, editable native vectors |
| Internal details | One to three lines |
| Connector clearance | `8 px` from unrelated objects |
| Shadow | Off; optional 6% single shadow |

## QA checklist

- [ ] No text, icon, face, or arrow is clipped at the intended export size.
- [ ] No connector, label, or shadow overlaps unrelated content.
- [ ] Labels remain readable without relying on accent color alone.
- [ ] Every edge connects the intended endpoints and uses the correct role.
- [ ] Arrowheads point in the stated direction; feedback paths are unmistakable.
- [ ] Supporting modules are flat; only core modules use the fixed `16 x 12 px` extrusion.
- [ ] Core top/right faces are opaque, lighter/darker respectively, and share exact edges without tails.
- [ ] Each module has at most three mechanism lines and one readable semantic micro-mechanism.
- [ ] Accent families are reused semantically; no unlisted accent colors appear.
- [ ] Whitespace separates regions and the main reading order is obvious.
- [ ] At 100% view, the figure reads clearly in color and grayscale.
