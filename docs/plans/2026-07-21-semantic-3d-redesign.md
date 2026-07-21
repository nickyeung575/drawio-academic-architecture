# Semantic 3D Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the two examples' detached pseudo-3D outlines with selective joined solids and editable semantic 3D mechanisms, then publish the verified update.

**Architecture:** Keep the existing synthetic specs, layouts, stable IDs, and connector topology. Refactor `buildModule()` into a selective outer-depth builder and a semantic motif builder; use native draw.io styles with fixed-size skew, then verify the actual exported SVG geometry before accepting an export.

**Tech Stack:** Node.js 22 ESM, `node:test`, PowerShell installer, draw.io uncompressed XML/SVG/PNG, pinned `drawio-scientific-illustrator` v1.0.0.

---

### Task 1: Lock the selective depth contract with failing tests

**Files:**
- Modify: `tests/build-examples.test.mjs`
- Read: `scripts/build-examples.mjs`
- Read: `docs/plans/2026-07-21-semantic-3d-redesign-design.md`

**Step 1: Add a style-token helper and failing depth-treatment test**

Add this helper near `loadSpec()`:

```js
function styleValue(style, name) {
  const match = new RegExp(`(?:^|;)${name}=([^;]+)`).exec(style ?? "");
  return match?.[1];
}
```

Add a test with these exact core-module sets:

```js
test("core modules use fixed joined depth while supporting modules stay flat", async () => {
  const { buildPayloadForSpec } = await import(builderUrl);
  const coreBySlug = {
    "multimodal-ml-pipeline": new Set(["temporal-fusion", "confidence-gate", "task-head"]),
    "generic-safe-control-loop": new Set(["nominal-controller", "safety-filter", "constraint-library", "command-actuator"]),
  };

  for (const [slug, coreIds] of Object.entries(coreBySlug)) {
    const spec = await loadSpec(slug);
    const payload = buildPayloadForSpec(spec);
    for (const module of spec.layers.flatMap((layer) => layer.modules)) {
      const group = payload.vertices.find(({ id }) => id === module.id);
      const front = payload.vertices.find(({ id }) => id === `${module.id}--front`);
      const top = payload.vertices.find(({ id }) => id === `${module.id}--top`);
      const right = payload.vertices.find(({ id }) => id === `${module.id}--right`);

      if (!coreIds.has(module.id)) {
        assert.equal(group.width, 280);
        assert.equal(group.height, 176);
        assert.equal(front.y, 0);
        assert.equal(top, undefined);
        assert.equal(right, undefined);
        continue;
      }

      assert.equal(group.width, 296);
      assert.equal(group.height, 188);
      assert.equal(front.y, 12);
      assert.equal(top.height, 12);
      assert.equal(right.width, 16);
      assert.equal(styleValue(top.style, "fixedSize"), "1");
      assert.equal(styleValue(top.style, "size"), "16");
      assert.equal(styleValue(right.style, "fixedSize"), "1");
      assert.equal(styleValue(right.style, "size"), "12");
      assert.equal(styleValue(right.style, "direction"), "south");
      assert.equal(styleValue(top.style, "opacity"), undefined);
      assert.equal(styleValue(right.style, "opacity"), undefined);
      assert.notEqual(styleValue(top.style, "fillColor"), styleValue(front.style, "fillColor"));
      assert.notEqual(styleValue(right.style, "fillColor"), styleValue(front.style, "fillColor"));
    }
  }
});
```

Update the older deterministic-vector test so it requires the front face for all modules but no longer requires top/right faces for supporting modules.

**Step 2: Run the focused test and verify RED**

Run:

```powershell
node --test --test-name-pattern="core modules use fixed joined depth" tests/build-examples.test.mjs
```

Expected: FAIL because every current module has top/right faces, depth is `8 x 6`, and the styles use proportional skew and opacity.

**Step 3: Commit the failing test**

```powershell
git add tests/build-examples.test.mjs
git commit -m "test: define selective semantic depth contract"
```

---

### Task 2: Implement fixed-size joined outer faces

**Files:**
- Modify: `scripts/build-examples.mjs`
- Test: `tests/build-examples.test.mjs`

**Step 1: Extend the family tokens with explicit opaque face colors**

Replace `DEPTH_X = 8` and `DEPTH_Y = 6` with `16` and `12`. Extend each family with `top` and `right` tokens. Use these values:

```js
neutral: { fill: "#F3F5F6", top: "#FAFBFB", right: "#DDE3E6", line: "#88939B", icon: "#59656D" },
slate:   { fill: "#E9EEF2", top: "#F5F7F9", right: "#CED9E1", line: "#6E7F8D", icon: "#425563" },
teal:    { fill: "#E3F1EF", top: "#F1F8F7", right: "#C5DDD9", line: "#5C918A", icon: "#276B64" },
sage:    { fill: "#EAF1E6", top: "#F5F8F3", right: "#CFDCC8", line: "#7F9A71", icon: "#55734B" },
clay:    { fill: "#F3E8E2", top: "#FAF4F1", right: "#DDC8BD", line: "#A97C68", icon: "#805442" },
khaki:   { fill: "#F3EEDA", top: "#FAF7EC", right: "#DDD4AC", line: "#A49558", icon: "#756A37" },
plum:    { fill: "#F0E7EE", top: "#F8F3F7", right: "#D8C7D4", line: "#92758B", icon: "#684E63" },
```

**Step 2: Mark core modules in the presentation layouts**

Add `coreModules` arrays to both `LAYOUTS` entries using the IDs from Task 1. This remains presentation metadata and does not alter the portable public spec.

**Step 3: Extract the face builder**

Implement this API:

```js
export function buildDepthFaces(module, family, treatment = "supporting") {
  const frontY = treatment === "core" ? DEPTH_Y : 0;
  const faces = [];
  if (treatment === "core") {
    faces.push(
      {
        id: `${module.id}--top`,
        shape: "parallelogram",
        parent: module.id,
        x: 0,
        y: 0,
        width: MODULE_WIDTH + DEPTH_X,
        height: DEPTH_Y,
        style: `shape=parallelogram;perimeter=parallelogramPerimeter;fixedSize=1;size=${DEPTH_X};fillColor=${family.top};strokeColor=${family.line};strokeWidth=1;shadow=0;`,
      },
      {
        id: `${module.id}--right`,
        shape: "parallelogram",
        parent: module.id,
        x: MODULE_WIDTH,
        y: 0,
        width: DEPTH_X,
        height: MODULE_HEIGHT + DEPTH_Y,
        style: `shape=parallelogram;perimeter=parallelogramPerimeter;direction=south;fixedSize=1;size=${DEPTH_Y};fillColor=${family.right};strokeColor=${family.line};strokeWidth=1;shadow=0;`,
      },
    );
  }
  faces.push({
    id: `${module.id}--front`,
    shape: "rounded",
    parent: module.id,
    x: 0,
    y: frontY,
    width: MODULE_WIDTH,
    height: MODULE_HEIGHT,
    style: `rounded=1;absoluteArcSize=1;arcSize=8;whiteSpace=wrap;html=0;fillColor=${family.fill};strokeColor=${family.line};strokeWidth=1.25;shadow=0;`,
  });
  return faces;
}
```

Update `buildModule(module, x, y, treatment)` to size the group to `296 x 188` only for core modules, use `buildDepthFaces()`, and add `frontY` to every motif/text/detail Y coordinate for core modules. `buildPayloadForSpec()` passes `"core"` when `layout.coreModules` includes the module ID.

**Step 4: Run the focused test and verify GREEN**

Run:

```powershell
node --test --test-name-pattern="builder creates|core modules use fixed joined depth" tests/build-examples.test.mjs
```

Expected: PASS.

**Step 5: Run all builder tests**

Run:

```powershell
node --test tests/build-examples.test.mjs
```

Expected: all builder tests PASS.

**Step 6: Commit**

```powershell
git add scripts/build-examples.mjs tests/build-examples.test.mjs
git commit -m "fix: build joined selective depth faces"
```

---

### Task 3: Lock semantic mechanism motifs with failing tests

**Files:**
- Modify: `tests/build-examples.test.mjs`
- Read: `examples/multimodal-ml-pipeline/spec.json`
- Read: `examples/generic-safe-control-loop/spec.json`

**Step 1: Add a failing semantic-motif contract test**

Add a table that maps each motif kind to required stable suffix stems:

```js
const semanticMotifParts = {
  waveform: ["slice-back", "slice-middle", "slice-front"],
  "estimate-wave": ["slice-back", "slice-middle", "slice-front"],
  "image-grid": ["plane-back", "plane-middle", "plane-front"],
  "token-stack": ["token-back", "token-middle", "token-front"],
  "layer-stack": ["tensor-wide", "tensor-middle", "tensor-compact"],
  "stacked-blocks": ["tensor-wide", "tensor-middle", "tensor-compact"],
  "feature-grid": ["tensor-wide", "tensor-middle", "tensor-compact"],
  "converging-nodes": ["stream-a", "stream-b", "stream-c", "fusion-core"],
  "guarded-diamond": ["threshold-plane", "accept-path", "reject-path"],
  "shield-check": ["threshold-plane", "accept-path", "reject-path"],
  "policy-nodes": ["state-block", "policy-transform", "action-block"],
  "boundary-shield": ["bound-upper", "feasible-band", "bound-lower"],
  "actuator-arm": ["command-block", "lever", "output-pulse"],
  "trend-gauge": ["screen", "trend", "check"],
  "gauge-check": ["screen", "trend", "check"],
};
```

For every module whose motif appears in the table, build the payload and assert that an ID `${module.id}--motif-${stem}` exists for every required stem. For motifs not in the table, retain the existing requirement of at least three editable vector parts.

**Step 2: Run and verify RED**

Run:

```powershell
node --test --test-name-pattern="semantic mechanism motifs" tests/build-examples.test.mjs
```

Expected: FAIL on the first old flat motif ID.

**Step 3: Commit the failing test**

```powershell
git add tests/build-examples.test.mjs
git commit -m "test: define semantic mechanism motifs"
```

---

### Task 4: Implement layered semantic micro-visuals

**Files:**
- Modify: `scripts/build-examples.mjs`
- Test: `tests/build-examples.test.mjs`

**Step 1: Rename and expand the motif builder**

Rename `motifVertices()` to `buildSemanticMotif()` and keep every generated cell under the module group. Add a `frontY` parameter so core-module mechanisms move with the front face.

Use a shared offset-slab helper rather than duplicating geometry:

```js
const slab = (suffix, x, y, width, height, depth = 5, fill = SURFACE) => {
  box(`${suffix}-front`, x, y + depth, width, height, fill, false);
  add(`${suffix}-top`, "parallelogram", x, y, width + depth, depth,
    `shape=parallelogram;fixedSize=1;size=${depth};fillColor=${family.top};strokeColor=${icon};strokeWidth=1;shadow=0;`);
  add(`${suffix}-right`, "parallelogram", x + width, y, depth, height + depth,
    `shape=parallelogram;direction=south;fixedSize=1;size=${depth};fillColor=${family.right};strokeColor=${icon};strokeWidth=1;shadow=0;`);
};
```

The helper may return IDs with `-front/-top/-right`; the contract stems from Task 3 must remain present as a primary cell ID or group marker.

**Step 2: Implement the mechanism families**

- Waveform/observation: three offset slice planes with a waveform on the front plane.
- Image: three offset feature-map planes with a four-cell grid on the front plane.
- Tokens: three stacked token slabs with short segment ticks.
- Encoder: wide, middle, and compact tensor slabs connected left-to-right.
- Fusion: three incoming bands converging into a small extruded fusion core.
- Gate/safety: a threshold plane, solid accepted path, and dashed rejected path.
- Controller: state block, policy transform, and action block in sequence.
- Constraint library: upper and lower bounds enclosing a feasible band.
- Actuator: command block, lever, and output pulse.
- Monitor: flat screen, trend line, and check marker.

Use only family colors, `SURFACE`, and the existing text colors. Do not add gradients, raster images, or emoji.

**Step 3: Run the focused test and verify GREEN**

Run:

```powershell
node --test --test-name-pattern="semantic mechanism motifs" tests/build-examples.test.mjs
```

Expected: PASS.

**Step 4: Run all builder tests and refactor only while green**

Run:

```powershell
node --test tests/build-examples.test.mjs
```

Expected: all builder tests PASS with deterministic IDs and no raster/image vertices.

**Step 5: Commit**

```powershell
git add scripts/build-examples.mjs tests/build-examples.test.mjs
git commit -m "feat: add semantic 3D mechanism motifs"
```

---

### Task 5: Verify actual SVG face geometry during export

**Files:**
- Modify: `scripts/build-examples.mjs`
- Modify: `tests/build-examples.test.mjs`

**Step 1: Add a failing parser test**

Export a pure helper named `inspectDepthFaceSvg(svg, cellId)` that returns the path points, optional rotation, fill, stroke, fill opacity, and stroke opacity for one `data-cell-id`. Test it against a small inline SVG fragment representing the old bad top face. Add `assertRenderedDepthGeometry(svg, coreModules)` and assert that the old fragment throws because its first skew is `57.6`, not `16`, and its stroke opacity is `0.55`.

**Step 2: Run and verify RED**

```powershell
node --test --test-name-pattern="rendered depth geometry" tests/build-examples.test.mjs
```

Expected: FAIL because the exported helpers do not exist.

**Step 3: Implement the SVG geometry guard**

For each core module:

- Extract the top face path and require four points.
- Require top skew `16` and vertical depth `12`, within `0.1 px`.
- Extract the right face path and require fixed pre-rotation skew `12`, face thickness `16`, and a 90-degree rotation.
- Reject `fill-opacity` or `stroke-opacity` below `1`.
- Reject missing face IDs or paths.

Call the guard in `buildOne()` after SVG sanitization and before writing the final SVG. This makes real regeneration fail closed if draw.io ignores the fixed-size style.

**Step 4: Run and verify GREEN**

```powershell
node --test --test-name-pattern="rendered depth geometry" tests/build-examples.test.mjs
```

Expected: PASS.

**Step 5: Run all tests and commit**

```powershell
cmd /c npm test
git add scripts/build-examples.mjs tests/build-examples.test.mjs
git commit -m "test: verify exported 3D face geometry"
```

Expected: all tests PASS.

---

### Task 6: Update the installable style guidance

**Files:**
- Modify: `skill/drawio-academic-architecture/references/restrained-3d-style.md`
- Modify: `skill/drawio-academic-architecture/SKILL.md`

**Step 1: Update the documented construction rules**

Replace the universal `8 x 6 px` rule with the two treatments from the approved design. Document fixed-size skew, fully opaque seams, explicit lighter top/darker right colors, exact shared endpoints, and the ban on default proportional parallelograms. Add semantic mechanisms and the `52–72 px` motif range.

**Step 2: Update the Skill quick checks**

Change the visual-language quick check to require selective `16 x 12 px` core depth, flat supporting modules, and readable semantic micro-visuals.

**Step 3: Run Skill validation**

```powershell
python "<skill-creator-root>\scripts\quick_validate.py" "<repo-root>\skill\drawio-academic-architecture"
```

Expected: `Skill is valid!`

**Step 4: Commit**

```powershell
git add skill/drawio-academic-architecture/SKILL.md skill/drawio-academic-architecture/references/restrained-3d-style.md
git commit -m "docs: require semantic selective 3D"
```

---

### Task 7: Regenerate and visually review both synthetic examples

**Files:**
- Modify: `examples/multimodal-ml-pipeline/diagram.drawio`
- Modify: `examples/multimodal-ml-pipeline/preview.png`
- Modify: `examples/multimodal-ml-pipeline/preview.svg`
- Modify: `examples/multimodal-ml-pipeline/review.json`
- Modify: `examples/generic-safe-control-loop/diagram.drawio`
- Modify: `examples/generic-safe-control-loop/preview.png`
- Modify: `examples/generic-safe-control-loop/preview.svg`
- Modify: `examples/generic-safe-control-loop/review.json`
- Possibly modify: `scripts/build-examples.mjs`
- Test: `tests/build-examples.test.mjs`

**Step 1: Verify the pinned upstream dependency**

```powershell
node skill/drawio-academic-architecture/scripts/check-upstream.mjs --plugin-root $env:DRAWIO_SCIENTIFIC_PLUGIN_ROOT --expected-version 1.0.0 --expected-revision dd248168295bbcac34c9d74a8bd9efac3c2fbf99 --strict-revision
```

Expected: compact JSON with `ok: true` and all required tools.

**Step 2: Regenerate both examples**

```powershell
node scripts/build-examples.mjs --plugin-root $env:DRAWIO_SCIENTIFIC_PLUGIN_ROOT
```

Expected: `ok: true`, both diagram validations have zero errors/warnings, PNG widths are at least 2000, SVGs are metadata-free, and the SVG depth guard passes.

**Step 3: Inspect both PNGs at original resolution**

Open both previews. Require:

- joined top/right/front faces on core modules;
- no side spike, duplicate contour, or transparent seam;
- visibly layered tensor/fusion/gate/control mechanisms;
- no connector overlap introduced by the larger depth;
- readable labels and restrained colors at 100% view.

If a visual defect appears, add or strengthen a failing test before changing generator behavior, rerun RED/GREEN, regenerate, and inspect again.

**Step 4: Update both review records**

Use the actual validation page counts, export dimensions, and byte counts. Add these true-only-after-inspection fields:

```json
"facesJoined": true,
"depthVisibleAt100Percent": true,
"noDuplicateContour": true,
"semanticMechanismsReadable": true
```

Replace the old notes with an accurate description of the selective core depth and semantic mechanisms.

**Step 5: Run repository tests and privacy scan**

```powershell
cmd /c npm test
node skill/drawio-academic-architecture/scripts/scan-public-tree.mjs --root .
```

Expected: all tests PASS and `{"valid":true,"findings":[]}`.

**Step 6: Commit generated artifacts**

```powershell
git add scripts/build-examples.mjs tests/build-examples.test.mjs examples
git commit -m "feat: regenerate examples with semantic 3D"
```

---

### Task 8: Final verification, installation, and publication

**Files:**
- Verify: entire repository and Git history
- Install from: `skill/drawio-academic-architecture/`

**Step 1: Run fresh complete verification**

```powershell
cmd /c npm test
python "<skill-creator-root>\scripts\quick_validate.py" "<repo-root>\skill\drawio-academic-architecture"
git diff --check main...HEAD
git status --short
```

Expected: all tests PASS, Skill valid, no whitespace errors, and a clean worktree.

**Step 2: Run the private full-history publication scan**

Set `PUBLIC_SCAN_EXTRA_TERMS` from the local non-committed denylist and run:

```powershell
node skill/drawio-academic-architecture/scripts/scan-public-tree.mjs --root . --history --require-extra-terms
```

Expected: `{"valid":true,"findings":[]}`. Never commit or print the denylist.

**Step 3: Request independent specification and code-quality reviews**

Require no unresolved P1/P2 findings and explicitly check exported visuals, privacy boundaries, deterministic IDs, and the SVG geometry guard.

**Step 4: Finish the feature branch**

Use `superpowers:finishing-a-development-branch`. Merge the reviewed feature branch into `main` without rewriting public history, then rerun the full verification on `main`.

**Step 5: Install the final Skill**

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/install.ps1 -Force
```

Expected: installed source and repository Skill trees have identical hashes and official Skill validation passes.

**Step 6: Push and verify GitHub Actions**

```powershell
git push origin main
```

Verify the remote `main` SHA equals local `HEAD`, GitHub Actions succeeds for that SHA, and key remote blobs match local files.
