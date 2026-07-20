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
| `shadow` | `#263238` | Optional shadow at 8% opacity |

Use one accent family per semantic role. Keep body text at `text-primary` or `text-secondary`; do not set paragraphs in an accent color.

| Family | Muted fill | Line | Icon | Typical role |
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
- Module padding: `12 px`; icon-to-text gap: `8 px`; internal row gap: `4 px`.
- Minimum module front face: `144 x 88 px`; preferred maximum: `216 x 128 px`.
- Use one label, zero or one subtitle, one motif, and one to three mechanism lines per module.
- Keep each mechanism line to one visual line, normally two to six words. Never exceed three lines.
- Reserve roughly 25% of the canvas as uninterrupted whitespace. If a region needs more than seven peers, split it into labeled subregions.
- Keep at least `8 px` between a connector and an unrelated object, and at least `12 px` between connector labels.

## Shallow 3D module construction

Build each module as an editable group of a front rectangle, top face, right face, motif, and text. Use a front face at `(x, y)` with width `w` and height `h`, and a fixed depth vector of `(+8, -6) px`:

- Top face points: `(x,y)`, `(x+8,y-6)`, `(x+w+8,y-6)`, `(x+w,y)`.
- Right face points: `(x+w,y)`, `(x+w+8,y-6)`, `(x+w+8,y+h-6)`, `(x+w,y+h)`.
- Front face: family muted fill at 100% opacity, family line at `1.25 px`, and `8 px` corner radius.
- Top face: the same muted fill at 55% opacity; right face: the same muted fill at 78% opacity.
- Face seams: family line at `1 px`; no gradients, bevels, gloss, or perspective distortion.
- Draw order: top face, right face, front face, then motif and text. Group all parts without flattening.

Depth is a hierarchy cue, not decoration. Use the same `8 x 6 px` depth everywhere. Flat shapes are preferable for annotations, junctions, and small status markers.

Borders use the selected family line. Disable shadows by default. If separation from the canvas is insufficient, use one shadow only: `shadow` at 8% opacity, offset `1 x 2 px`, blur `4 px`; never stack shadows.

## Motifs and icons

Use simple editable vectors with a `1.5 px` stroke, round joins, no fill unless noted, and the selected family icon color. Fit the motif in a `24 x 24 px` box; a micro-visual may use up to `44 x 24 px`. Use one primary motif per module.

| Concept | Preferred motif | Avoid |
|---|---|---|
| Data | Stacked records, table cells, waveform, or sensor marks | Vendor logos or photorealistic media |
| Model | Layered blocks, nodes and edges, or parameter sliders | Brain clip art or dense network meshes |
| Safety | Shield, boundary, check, or guarded gate | Alarm imagery without a state label |
| Routing | Fork, merge, switch, or waypoint arrows | Decorative road or map art |
| Fusion | Converging bands, joined circles, or merge node | Unexplained sparkle symbols |
| Evaluation | Bars, gauge, checklist, or comparison ticks | Unlabelled trophies or rankings |
| Action | Command arrow, lever, actuator, or output pulse | Device-specific silhouettes |

Icons reinforce labels and must never replace them. Keep stroke widths consistent, avoid emoji and raster images, and omit a motif when it would force text below the minimum size.

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
| Depth vector | `(+8, -6) px` |
| Front border / radius | `1.25 px` / `8 px` |
| Icon | `24 x 24 px`, `1.5 px` stroke |
| Internal details | One to three lines |
| Connector clearance | `8 px` from unrelated objects |
| Shadow | Off; optional 8% single shadow |

## QA checklist

- [ ] No text, icon, face, or arrow is clipped at the intended export size.
- [ ] No connector, label, or shadow overlaps unrelated content.
- [ ] Labels remain readable without relying on accent color alone.
- [ ] Every edge connects the intended endpoints and uses the correct role.
- [ ] Arrowheads point in the stated direction; feedback paths are unmistakable.
- [ ] Module depth, corners, borders, spacing, and icon strokes are consistent.
- [ ] Each module has at most three mechanism lines and one primary motif.
- [ ] Accent families are reused semantically; no unlisted accent colors appear.
- [ ] Whitespace separates regions and the main reading order is obvious.
- [ ] At 100% view, the figure reads clearly in color and grayscale.
