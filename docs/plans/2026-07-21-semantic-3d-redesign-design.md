# Semantic 3D Redesign

## Context

The two public synthetic examples currently simulate depth with an extremely thin
top parallelogram and right parallelogram. At the export scale, those faces read
as duplicated outlines and detached spikes instead of joined solid faces. The
problem is structural: the default parallelogram skew is proportional to the
shape dimensions, face opacity also weakens the seams, and the fixed `8 x 6 px`
depth is too small for a `280 x 176 px` module.

This redesign replaces decorative pseudo-depth with semantic 3D. Volume will
explain tensors, fusion, constraints, and action paths. Only important compute
or decision modules receive an extruded outer shell; supporting modules remain
quiet and mostly flat.

## Goals

- Make every extruded face read as a joined solid at 100% preview scale.
- Use 3D to communicate internal mechanisms rather than decorate every card.
- Preserve editable native draw.io vectors, stable IDs, semantic connectors,
  restrained color, and publication-safe synthetic examples.
- Keep the diagrams legible in grayscale and at normal paper-column scale.
- Add tests that fail on detached faces, default proportional skew, transparent
  seams, and missing semantic micro-visuals.

## Non-goals

- Photorealistic rendering, gradients, glossy bevels, or dramatic perspective.
- Reproducing any user-provided paper figure, labels, topology, or artwork.
- Converting the examples to raster illustrations or embedding raster icons.
- Making every module equally three-dimensional.

## Visual hierarchy

Modules use one of two depth treatments:

1. **Supporting module** — a clean front card with the existing muted family,
   one semantic micro-visual, title, subtitle, and concise mechanism lines.
2. **Core module** — the same front card plus an explicit top face and right
   face with a fixed `(+16, -12) px` extrusion. Core modules are fusion, gates,
   safety filters, constraint engines, and action-producing modules.

The core treatment must remain selective. In the multimodal example, temporal
fusion, confidence gate, and task head are core. In the safe-control example,
nominal controller, safety filter, constraint library, and command actuator are
core. Inputs, encoders, observers, and monitors stay visually lighter while
their internal micro-visuals carry semantic depth.

## Face geometry and color

For a core front face located at `(0, 12)` with width `w` and height `h`, use
these exact local points:

- Top: `(0,12)`, `(16,0)`, `(w+16,0)`, `(w,12)`.
- Right: `(w,12)`, `(w+16,0)`, `(w+16,h)`, `(w,h+12)`.
- Front: `(0,12)`, width `w`, height `h`.

The top and right faces must be explicit fixed-skew polygons, or a native draw.io
shape whose exported path is proven to match those points. Do not rely on the
default parallelogram skew.

- Front uses the existing muted family fill.
- Top is 4–6% lighter than the front.
- Right is 10–14% darker than the front.
- Faces and seams are fully opaque.
- Outer contour is approximately `1.2 px`; internal seams are `0.8–1 px`.
- Faces share exact endpoints. No duplicate outline, detached diagonal, or tail
  may extend beyond the solid.
- Shadows are off by default. A single `1 x 2 px`, 6% shadow is allowed only if
  the solid cannot separate from the region background without it.

Supporting cards use no fake top or side outline. Their hierarchy comes from
spacing, typography, and the semantic micro-visual.

## Semantic micro-visuals

Micro-visuals occupy approximately `52–72 px` and remain editable native vectors.

| Concept | Mechanism visual |
| --- | --- |
| Wave or observation input | Three to five offset signal slices or sampled planes |
| Image input | Offset feature-map tiles with one emphasized active plane |
| Token input | Stacked token slabs with short segment marks |
| Encoder | Three tensor blocks that narrow toward a compact latent block |
| Fusion | Three incoming bands converging into a small joined volume |
| Confidence or safety gate | Threshold plane plus accepted and rejected paths |
| Controller | State block, policy transform, and action block in sequence |
| Constraint library | Two bounded planes or limit slabs defining a feasible band |
| Actuator | Command block connected to an editable lever or output pulse |
| Monitor | Flat diagnostic screen with a curve, ticks, or comparison marks |

Color is inherited from the semantic family. Layered micro-visuals may use
lighter and darker values from the same family, but may not introduce a new
accent family or gradient.

## Layout and data flow

The existing synthetic topology and stable module and edge IDs remain unchanged.
The generator may adjust module padding and motif placement to make room for the
larger mechanisms, but connector endpoints and semantic roles stay intact.
Connectors remain orthogonal and must route outside unrelated objects. Core
module extrusion may not overlap a connector or connector label.

The examples remain deterministic build products generated from their existing
synthetic `spec.json` files. Regeneration is intentional for these public build
artifacts and is not a precedent for clearing or rebuilding private revisions.

## Generator architecture

Refactor the example builder around two responsibilities:

- `buildDepthFaces(module, family, treatment)` creates a front face and, for
  core modules, the joined top and right faces with fixed geometry.
- `buildSemanticMotif(module, family)` creates concept-specific layered vectors.

The treatment map belongs to the public layout configuration, not the public
architecture schema, because depth is a presentation decision for these examples.
Every generated part keeps a stable ID beneath the module group.

If the upstream draw.io file utility cannot express exact polygons through its
high-level payload, use the smallest supported native shape/style combination
that exports the required fixed path, and prove it with an SVG integration test.
Do not accept a visually approximate default parallelogram.

## Validation and testing

Development follows red-green-refactor:

1. Add failing unit tests for core/supporting treatments, `16 x 12 px` depth,
   fully opaque seams, fixed skew, common face endpoints, and semantic motif IDs.
2. Add an export-level assertion against the generated SVG geometry so a valid
   payload cannot hide a wrong rendered path.
3. Implement the minimum face and motif builders that make those tests pass.
4. Regenerate both `.drawio`, PNG, SVG, and review records.
5. Inspect both PNGs at at least 2000 px width and at 100% view.
6. Extend review records with `facesJoined`, `depthVisibleAt100Percent`,
   `noDuplicateContour`, and `semanticMechanismsReadable`.
7. Run the full test suite, official Skill validation, draw.io structural
   validation, and full-history privacy scan before publishing.

Visual acceptance requires joined solids, visible face contrast, no protruding
tails, readable mechanisms, unambiguous connectors, and a restrained palette.

## Release boundary

Only the two existing fully synthetic examples are regenerated. No source image,
private label, private topology, temporary path, or user-specific artifact may be
added to the repository. The final repository history must pass the configured
local denylist scan before the updated branch is pushed.
