import assert from "node:assert/strict";
import { link, mkdtemp, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const builderUrl = pathToFileURL(path.join(repoRoot, "scripts", "build-examples.mjs")).href;

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

async function loadSpec(slug) {
  const source = await readFile(path.join(repoRoot, "examples", slug, "spec.json"), "utf8");
  return JSON.parse(source);
}

function styleValue(style, name) {
  const prefix = `${name}=`;
  const token = (style ?? "").split(";").find((entry) => entry.startsWith(prefix));
  return token?.slice(prefix.length);
}

function visibleFrontCenterX(payload, moduleId) {
  const group = payload.vertices.find(({ id }) => id === moduleId);
  const front = payload.vertices.find(({ id }) => id === `${moduleId}--front`);
  assert.ok(group, `missing group ${moduleId}`);
  assert.ok(front, `missing front face ${moduleId}--front`);
  return group.x + front.x + front.width / 2;
}

function absolutePortX(payload, moduleId, normalizedX) {
  const group = payload.vertices.find(({ id }) => id === moduleId);
  assert.ok(group, `missing group ${moduleId}`);
  assert.equal(typeof normalizedX, "number", `${moduleId} port must define a normalized x`);
  return group.x + normalizedX * group.width;
}

function renderedDepthFixture() {
  return `<svg xmlns="http://www.w3.org/2000/svg">
    <g transform="translate(10,20)">
      <g transform="translate(-5 3)">
        <g class="cell" data-cell-id="core--front">
          <g transform="translate(0.5,0.5)">
            <rect stroke="#6e7f8d" width="280" x="94.5" fill="#e9eef2" height="176" y="88.5"/>
          </g>
        </g>
        <g data-cell-id="core--top" class="cell">
          <g transform="translate(0.5,0.5)">
            <path stroke="#6e7f8d" pointer-events="all" d="M 94.5 88.5 L 110.5 76.5 L 390.5 76.5 L 374.5 88.5 Z" fill="#f5f7f9"/>
          </g>
        </g>
        <g class="cell" data-cell-id="core--right">
          <g transform="translate(0.5,0.5)">
            <path fill="#ced9e1" transform="rotate(90,382.5,170.5)" d="M 300.5 178.5 L 288.5 162.5 L 464.5 162.5 L 476.5 178.5 Z" stroke="#6e7f8d"/>
          </g>
        </g>
      </g>
    </g>
  </svg>`;
}

const DRAWIO_FLIPPED_RIGHT_TRANSFORM = "translate(0,414)scale(1,-1)translate(0,-414)rotate(-90,1292,414)";

function renderedFlippedDepthFixture(transform = DRAWIO_FLIPPED_RIGHT_TRANSFORM) {
  return `<svg xmlns="http://www.w3.org/2000/svg">
    <g data-cell-id="core--front">
      <rect x="1004" y="332" width="280" height="176" fill="#e9eef2" stroke="#6e7f8d"/>
    </g>
    <g data-cell-id="core--top">
      <path d="M 1004 332 L 1020 320 L 1300 320 L 1284 332 Z" fill="#f5f7f9" stroke="#6e7f8d"/>
    </g>
    <g data-cell-id="core--right">
      <path d="M 1198 422 L 1210 406 L 1386 406 L 1374 422 Z" transform="${transform}" fill="#ced9e1" stroke="#6e7f8d"/>
    </g>
  </svg>`;
}

test("builder creates deterministic editable vectors with stable module ids", async () => {
  const { buildPayloadForSpec } = await import(builderUrl);

  for (const slug of ["multimodal-ml-pipeline", "generic-safe-control-loop"]) {
    const spec = await loadSpec(slug);
    const first = buildPayloadForSpec(spec);
    const second = buildPayloadForSpec(spec);
    assert.deepEqual(first, second, `${slug} payload must be deterministic`);
    assert.equal(first.canvas.background, "#FAFBFC");

    const ids = [...first.vertices, ...first.edges].map(({ id }) => id);
    assert.equal(new Set(ids).size, ids.length, `${slug} must not contain duplicate ids`);
    assert.ok(first.vertices.every((vertex) => vertex.shape !== "image" && !vertex.image_path));
    assert.ok(
      [...first.vertices, ...first.edges].every((cell) => !cell.style?.includes("html=1")),
      `${slug} must use native text so SVG exports do not contain raster fallbacks`,
    );

    for (const module of spec.layers.flatMap((layer) => layer.modules)) {
      const group = first.vertices.find(({ id }) => id === module.id);
      assert.equal(group?.shape, "group", `${module.id} must remain an editable group`);
      const front = first.vertices.find(({ id }) => id === `${module.id}--front`);
      assert.equal(front?.parent, module.id, `${module.id} front face must stay grouped`);

      const motifIds = ids.filter((id) => id.startsWith(`${module.id}--motif-`));
      assert.ok(motifIds.length >= 3, `${module.id} needs an editable micro-visual`);
      assert.equal(
        first.vertices.filter(({ id }) => id.startsWith(`${module.id}--detail-`)).length,
        module.details.length,
        `${module.id} must show every mechanism line`,
      );
    }
  }
});

test("builder creates semantic mechanism motifs", async () => {
  const { buildPayloadForSpec } = await import(builderUrl);
  const observedMappedMotifs = new Set();

  for (const slug of ["multimodal-ml-pipeline", "generic-safe-control-loop"]) {
    const spec = await loadSpec(slug);
    const payload = buildPayloadForSpec(spec);
    const vertexById = new Map(payload.vertices.map((vertex) => [vertex.id, vertex]));

    for (const module of spec.layers.flatMap((layer) => layer.modules)) {
      const editableParts = payload.vertices.filter(({ id }) => id.startsWith(`${module.id}--motif-`));
      assert.ok(
        editableParts.length >= 3,
        `${slug} module ${module.id} (${module.motif}) must retain at least three editable motif parts`,
      );
      for (const part of editableParts) {
        assert.equal(
          part.parent,
          module.id,
          `${slug} module ${module.id} (${module.motif}) motif part ${part.id} must stay directly grouped under ${module.id}`,
        );
      }

      const requiredStems = semanticMotifParts[module.motif];
      if (requiredStems) {
        observedMappedMotifs.add(module.motif);
        for (const stem of requiredStems) {
          const expectedId = `${module.id}--motif-${stem}`;
          const semanticPart = vertexById.get(expectedId);
          assert.ok(
            semanticPart,
            `${slug} module ${module.id} (${module.motif}) must expose editable semantic part ${stem} as vertex ${expectedId}`,
          );
        }
      }
    }
  }

  for (const motif of Object.keys(semanticMotifParts)) {
    assert.ok(observedMappedMotifs.has(motif), `semantic motif contract ${motif} must apply to an example module`);
  }
});

test("encoder tensor motifs narrow from left to right", async () => {
  const { buildPayloadForSpec } = await import(builderUrl);
  const spec = await loadSpec("multimodal-ml-pipeline");
  const payload = buildPayloadForSpec(spec);
  const vertexById = new Map(payload.vertices.map((vertex) => [vertex.id, vertex]));
  const encoderKinds = new Set(["layer-stack", "stacked-blocks", "feature-grid"]);

  for (const module of spec.layers.flatMap((layer) => layer.modules).filter(({ motif }) => encoderKinds.has(motif))) {
    const wide = vertexById.get(`${module.id}--motif-tensor-wide`);
    const middle = vertexById.get(`${module.id}--motif-tensor-middle`);
    const compact = vertexById.get(`${module.id}--motif-tensor-compact`);
    const wideToMiddle = vertexById.get(`${module.id}--motif-tensor-wide-to-middle`);
    const middleToCompact = vertexById.get(`${module.id}--motif-tensor-middle-to-compact`);
    const stages = [wide, middle, compact];
    const links = [wideToMiddle, middleToCompact];

    assert.deepEqual(
      {
        stagesPresent: stages.every(Boolean),
        stageParents: stages.map((stage) => stage?.parent),
        xIncreases: wide?.x < middle?.x && middle?.x < compact?.x,
        widthDecreases: wide?.width > middle?.width && middle?.width > compact?.width,
        centerlinesAlign: stages.every((stage) => stage && stage.y + stage.height / 2 === wide.y + wide.height / 2),
        linksPresent: links.map(Boolean),
        linkParents: links.map((link) => link?.parent),
        linksSpanGaps: [
          wideToMiddle && wide && middle && wideToMiddle.x >= wide.x + wide.width && wideToMiddle.x + wideToMiddle.width <= middle.x,
          middleToCompact && middle && compact && middleToCompact.x >= middle.x + middle.width && middleToCompact.x + middleToCompact.width <= compact.x,
        ],
      },
      {
        stagesPresent: true,
        stageParents: [module.id, module.id, module.id],
        xIncreases: true,
        widthDecreases: true,
        centerlinesAlign: true,
        linksPresent: [true, true],
        linkParents: [module.id, module.id],
        linksSpanGaps: [true, true],
      },
      `${module.id} must show a connected left-to-right tensor compression pipeline`,
    );
  }
});

test("core modules use fixed joined depth while supporting modules stay flat", async () => {
  const { buildPayloadForSpec } = await import(builderUrl);
  const expectedFaceColors = {
    neutral: { top: "#FAFBFB", right: "#DDE3E6" },
    slate: { top: "#F5F7F9", right: "#CED9E1" },
    teal: { top: "#F1F8F7", right: "#C5DDD9" },
    sage: { top: "#F5F8F3", right: "#CFDCC8" },
    clay: { top: "#FAF4F1", right: "#DDC8BD" },
    khaki: { top: "#FAF7EC", right: "#DDD4AC" },
    plum: { top: "#F8F3F7", right: "#D8C7D4" },
  };
  const coreModules = {
    "multimodal-ml-pipeline": new Set(["temporal-fusion", "confidence-gate", "task-head"]),
    "generic-safe-control-loop": new Set([
      "nominal-controller",
      "safety-filter",
      "constraint-library",
      "command-actuator",
    ]),
  };

  for (const slug of Object.keys(coreModules)) {
    const spec = await loadSpec(slug);
    const payload = buildPayloadForSpec(spec);
    const modules = spec.layers.flatMap((layer) => layer.modules);
    const moduleIds = new Set(modules.map(({ id }) => id));
    for (const coreId of coreModules[slug]) {
      assert.ok(moduleIds.has(coreId), `${slug} must define core module ${coreId}`);
    }

    for (const module of modules) {
      const group = payload.vertices.find(({ id }) => id === module.id);
      const front = payload.vertices.find(({ id }) => id === `${module.id}--front`);
      const top = payload.vertices.find(({ id }) => id === `${module.id}--top`);
      const right = payload.vertices.find(({ id }) => id === `${module.id}--right`);

      if (!coreModules[slug].has(module.id)) {
        assert.equal(group?.width, 280, `${module.id} supporting group must stay flat`);
        assert.equal(group?.height, 176, `${module.id} supporting group must stay flat`);
        assert.equal(front?.parent, module.id, `${module.id} supporting front must stay grouped`);
        assert.equal(front?.x, 0, `${module.id} supporting front must start at x=0`);
        assert.equal(front?.y, 0, `${module.id} supporting front must start at y=0`);
        assert.equal(front?.width, 280, `${module.id} supporting front must keep module width`);
        assert.equal(front?.height, 176, `${module.id} supporting front must keep module height`);
        assert.equal(top, undefined, `${module.id} supporting module must not have a top face`);
        assert.equal(right, undefined, `${module.id} supporting module must not have a right face`);
        continue;
      }

      assert.equal(group?.width, 296, `${module.id} core group must include fixed x-depth`);
      assert.equal(group?.height, 188, `${module.id} core group must include fixed y-depth`);
      assert.equal(front?.parent, module.id, `${module.id} core front must stay grouped`);
      assert.equal(front?.x, 0, `${module.id} front must start at x=0`);
      assert.equal(front?.y, 12, `${module.id} front must join below the top face`);
      assert.equal(front?.width, 280, `${module.id} front must keep module width`);
      assert.equal(front?.height, 176, `${module.id} front must keep module height`);
      assert.equal(top?.parent, module.id, `${module.id} top face must stay grouped`);
      assert.equal(top?.shape, "parallelogram", `${module.id} top face must be a parallelogram`);
      assert.equal(top?.x, 0, `${module.id} top face must start at x=0`);
      assert.equal(top?.y, 0, `${module.id} top face must start at y=0`);
      assert.equal(top?.width, 296, `${module.id} top face must span the core group width`);
      assert.equal(top?.height, 12, `${module.id} top face must use fixed y-depth`);
      assert.equal(right?.parent, module.id, `${module.id} right face must stay grouped`);
      assert.equal(right?.shape, "parallelogram", `${module.id} right face must be a parallelogram`);
      assert.equal(right?.x, 280, `${module.id} right face must join the front edge`);
      assert.equal(right?.y, 0, `${module.id} right face must start at y=0`);
      assert.equal(right?.width, 16, `${module.id} right face must use fixed x-depth`);
      assert.equal(right?.height, 188, `${module.id} right face must span the core group height`);
      assert.equal(styleValue(top?.style, "fixedSize"), "1", `${module.id} top must have fixed size`);
      assert.equal(styleValue(top?.style, "size"), "16", `${module.id} top must use x-depth as skew size`);
      assert.equal(styleValue(right?.style, "fixedSize"), "1", `${module.id} right must have fixed size`);
      assert.equal(styleValue(right?.style, "size"), "12", `${module.id} right must use y-depth as skew size`);
      assert.equal(styleValue(right?.style, "direction"), "south", `${module.id} right face must point south`);
      assert.equal(styleValue(top?.style, "opacity"), undefined, `${module.id} top face must be opaque`);
      assert.equal(styleValue(right?.style, "opacity"), undefined, `${module.id} right face must be opaque`);
      const frontFill = styleValue(front?.style, "fillColor");
      const topFill = styleValue(top?.style, "fillColor");
      const rightFill = styleValue(right?.style, "fillColor");
      assert.notEqual(frontFill, undefined, `${module.id} front face must define a fill color`);
      assert.notEqual(topFill, undefined, `${module.id} top face must define a fill color`);
      assert.notEqual(rightFill, undefined, `${module.id} right face must define a fill color`);
      assert.equal(topFill, expectedFaceColors[module.colorRole].top, `${module.id} top face must use its family token`);
      assert.equal(rightFill, expectedFaceColors[module.colorRole].right, `${module.id} right face must use its family token`);
      assert.notEqual(topFill, frontFill, `${module.id} top face must have distinct shading`);
      assert.notEqual(rightFill, frontFill, `${module.id} right face must have distinct shading`);
      assert.notEqual(topFill, rightFill, `${module.id} top and right faces must have distinct shading`);
    }
  }
});

test("vertical routes align to visible front-face centers", async () => {
  const { buildPayloadForSpec } = await import(builderUrl);
  const routeCases = {
    "multimodal-ml-pipeline": {
      direct: ["fusion-to-gate", "head-to-monitor"],
      waypointAligned: [],
    },
    "generic-safe-control-loop": {
      direct: ["actuator-to-monitor"],
      waypointAligned: ["constraints-to-filter", "environment-to-monitor"],
    },
  };

  for (const [slug, cases] of Object.entries(routeCases)) {
    const spec = await loadSpec(slug);
    const payload = buildPayloadForSpec(spec);

    for (const edgeId of cases.direct) {
      const edge = payload.edges.find(({ id }) => id === edgeId);
      assert.ok(edge, `missing route ${edgeId}`);
      assert.equal(edge.source_center_x, undefined, `${edgeId} must not leak source route descriptors`);
      assert.equal(edge.target_center_x, undefined, `${edgeId} must not leak target route descriptors`);
      const sourceCenter = visibleFrontCenterX(payload, edge.source);
      const targetCenter = visibleFrontCenterX(payload, edge.target);
      assert.equal(absolutePortX(payload, edge.source, edge.exit_x), sourceCenter, `${edgeId} source port must use the visible front center`);
      assert.equal(absolutePortX(payload, edge.target, edge.entry_x), targetCenter, `${edgeId} target port must use the visible front center`);
      assert.equal(sourceCenter, targetCenter, `${edgeId} visible front centers must share one vertical axis`);
    }

    for (const edgeId of cases.waypointAligned) {
      const edge = payload.edges.find(({ id }) => id === edgeId);
      assert.ok(edge, `missing route ${edgeId}`);
      assert.equal(edge.source_center_x, undefined, `${edgeId} must not leak source route descriptors`);
      assert.equal(edge.target_center_x, undefined, `${edgeId} must not leak target route descriptors`);
      assert.ok(edge.waypoints?.length >= 2, `${edgeId} must retain its waypoint route`);
      assert.ok(
        edge.waypoints.every((waypoint) => waypoint.source_center_x === undefined && waypoint.target_center_x === undefined),
        `${edgeId} must not leak waypoint route descriptors`,
      );
      const sourceCenter = visibleFrontCenterX(payload, edge.source);
      const targetCenter = visibleFrontCenterX(payload, edge.target);
      assert.equal(absolutePortX(payload, edge.source, edge.exit_x), sourceCenter, `${edgeId} source port must use the visible front center`);
      assert.equal(absolutePortX(payload, edge.target, edge.entry_x), targetCenter, `${edgeId} target port must use the visible front center`);
      assert.equal(edge.waypoints[0].x, sourceCenter, `${edgeId} first waypoint must align with the source front center`);
      assert.equal(edge.waypoints.at(-1).x, targetCenter, `${edgeId} last waypoint must align with the target front center`);
    }
  }
});

test("feedback and return routes use separate obstacle-free gutters", async () => {
  const { buildPayloadForSpec } = await import(builderUrl);
  const multimodal = buildPayloadForSpec(await loadSpec("multimodal-ml-pipeline"));
  const feedback = multimodal.edges.find(({ id }) => id === "monitor-to-fusion");
  assert.ok(feedback);
  assert.deepEqual(
    {
      exit_x: feedback.exit_x,
      exit_y: feedback.exit_y,
      entry_x: feedback.entry_x,
      entry_y: feedback.entry_y,
      waypoints: feedback.waypoints,
    },
    {
      exit_x: 0,
      exit_y: 0.75,
      entry_x: 1,
      entry_y: 0.75,
      waypoints: [{ x: 1400, y: 752 }, { x: 1400, y: 461 }],
    },
    "multimodal feedback must use the region gutter instead of crossing the confidence gate",
  );

  const safeControl = buildPayloadForSpec(await loadSpec("generic-safe-control-loop"));
  const commandReturn = safeControl.edges.find(({ id }) => id === "actuator-to-environment");
  const stateReference = safeControl.edges.find(({ id }) => id === "environment-to-monitor");
  const uncertaintyFeedback = safeControl.edges.find(({ id }) => id === "monitor-to-observer");
  assert.ok(commandReturn);
  assert.ok(stateReference);
  assert.ok(uncertaintyFeedback);
  assert.deepEqual(
    commandReturn.waypoints,
    [{ x: 2480, y: 330 }, { x: 2480, y: 850 }, { x: 40, y: 850 }, { x: 40, y: 318 }],
    "the command return must descend once in the actuator gutter without a right-side hairpin",
  );
  assert.deepEqual(
    {
      exit_x: uncertaintyFeedback.exit_x,
      exit_y: uncertaintyFeedback.exit_y,
      entry_x: uncertaintyFeedback.entry_x,
      entry_y: uncertaintyFeedback.entry_y,
      waypoints: uncertaintyFeedback.waypoints,
    },
    {
      exit_x: 0,
      exit_y: 0.75,
      entry_x: 1,
      entry_y: 0.625,
      waypoints: [
        { x: 2085, y: 652 },
        { x: 2085, y: 740 },
        { x: 1145, y: 740 },
        { x: 1145, y: 340 },
      ],
    },
    "observer feedback must return above both bottom lanes through clear region gutters",
  );
  const referenceLane = stateReference.waypoints[0].y;
  const commandLane = commandReturn.waypoints[1].y;
  const feedbackLane = uncertaintyFeedback.waypoints[1].y;
  assert.ok(feedbackLane < referenceLane && referenceLane < commandLane, "feedback, reference, and command lanes must remain vertically separated");
});

test("right depth faces mirror south-facing parallelograms into joined seams", async () => {
  const { buildDepthFaces, buildSemanticMotif } = await import(builderUrl);
  const family = {
    fill: "#E9EEF2",
    top: "#F5F7F9",
    right: "#CED9E1",
    line: "#6E7F8D",
    icon: "#3D5363",
  };
  const coreFaces = buildDepthFaces({ id: "core" }, family, "core");
  const motifFaces = buildSemanticMotif({ id: "module", motif: "waveform" }, family);
  const rightFaces = [
    coreFaces.find(({ id }) => id === "core--right"),
    ...motifFaces.filter(({ id }) => id.endsWith("-right")),
  ];

  assert.ok(rightFaces.length > 1, "fixture must cover core and motif slab right faces");
  for (const right of rightFaces) {
    assert.equal(right?.shape, "parallelogram", `${right?.id} must remain a parallelogram`);
    assert.equal(styleValue(right?.style, "direction"), "south", `${right?.id} must point south`);
    assert.equal(styleValue(right?.style, "flipH"), "1", `${right?.id} must mirror into its joined seams`);
  }
  for (const top of [...coreFaces, ...motifFaces].filter(({ id }) => id.endsWith("-top"))) {
    assert.equal(styleValue(top.style, "flipH"), undefined, `${top.id} must keep its existing skew`);
  }
});

test("builder preserves semantic connector roles and endpoints", async () => {
  const { buildPayloadForSpec } = await import(builderUrl);
  const expectedStyles = {
    flow: ["strokeColor=#4C5963", "strokeWidth=1.75", "endArrow=block", "endFill=1"],
    feedback: ["strokeColor=#5C7E8C", "dashed=1", "dashPattern=6 4", "endArrow=open"],
    constraint: ["strokeColor=#8C6556", "dashed=1", "dashPattern=2 3", "endArrow=diamond"],
    reference: ["strokeColor=#7B7F84", "dashed=1", "dashPattern=1 3", "endArrow=open"],
  };

  for (const slug of ["multimodal-ml-pipeline", "generic-safe-control-loop"]) {
    const spec = await loadSpec(slug);
    const payload = buildPayloadForSpec(spec);
    for (const edge of spec.edges) {
      const rendered = payload.edges.find(({ id }) => id === edge.id);
      assert.equal(rendered?.source, edge.source);
      assert.equal(rendered?.target, edge.target);
      assert.match(rendered?.style ?? "", /labelBackgroundColor=#FFFFFF/);
      for (const token of expectedStyles[edge.role]) {
        assert.ok(rendered.style.includes(token), `${edge.id} must include ${token}`);
      }
    }
  }
});

test("SVG sanitizer removes exporter fallbacks without deleting vector text", async () => {
  const { sanitizeSvg } = await import(builderUrl);
  const dirty = `<svg xmlns="http://www.w3.org/2000/svg" content="&lt;mxfile&gt;source&lt;/mxfile&gt;"><metadata>source</metadata><switch><foreignObject><div>Readable label</div></foreignObject><image x="0" y="0" xlink:href="data:image/png;base64,AAAA"/></switch></svg>`;
  const clean = sanitizeSvg(dirty);

  assert.doesNotMatch(clean, /<metadata\b/i);
  assert.doesNotMatch(clean, /data:image\//i);
  assert.doesNotMatch(clean, /\bcontent=/i);
  assert.match(clean, /<foreignObject>/);
  assert.match(clean, /Readable label/);
});

test("SVG sanitizer strips only the canonical draw.io SVG 1.1 PUBLIC doctype", async () => {
  const { sanitizeSvg, assertRenderedDepthGeometry } = await import(builderUrl);
  const svg = renderedDepthFixture();
  const exported = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">
${svg}`;
  const clean = sanitizeSvg(exported);

  assert.match(clean, /^<\?xml version="1\.0" encoding="UTF-8"\?>/);
  assert.doesNotMatch(clean, /<!DOCTYPE/i);
  assert.doesNotThrow(() => assertRenderedDepthGeometry(clean, ["core"]));

  const whitespaceVariant = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE\n  svg\tPUBLIC\n  "-//W3C//DTD SVG 1.1//EN"\t"http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd"   >
${svg}`;
  const whitespaceClean = sanitizeSvg(whitespaceVariant);
  assert.doesNotMatch(whitespaceClean, /<!DOCTYPE/i);
  assert.doesNotThrow(() => assertRenderedDepthGeometry(whitespaceClean, ["core"]));

  const rejectedDeclarations = [
    '<!DOCTYPE svg SYSTEM "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">',
    '<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "https://example.invalid/svg11.dtd">',
    '<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd" [<!ENTITY active "javascript:run()">]>',
    '<!ENTITY active "javascript:run()">',
  ];
  for (const declaration of rejectedDeclarations) {
    const unsafe = sanitizeSvg(`<?xml version="1.0" encoding="UTF-8"?>\n${declaration}\n${svg}`);
    assert.match(unsafe, /<!\s*(?:DOCTYPE|ENTITY)\b/i);
    assert.throws(
      () => assertRenderedDepthGeometry(unsafe, ["core"]),
      /SVG.*(?:DOCTYPE|ENTITY)/i,
    );
  }
});

test("rendered depth geometry rejects proportional skew and transparent seams", async () => {
  const { inspectDepthFaceSvg, assertRenderedDepthGeometry } = await import(builderUrl);
  const goodSvg = renderedDepthFixture();

  assert.deepEqual(inspectDepthFaceSvg(goodSvg, "core--top"), {
    points: [
      { x: 94.5, y: 88.5 },
      { x: 110.5, y: 76.5 },
      { x: 390.5, y: 76.5 },
      { x: 374.5, y: 88.5 },
    ],
    rotation: undefined,
    fill: "#f5f7f9",
    stroke: "#6e7f8d",
    fillOpacity: 1,
    strokeOpacity: 1,
  });
  assert.deepEqual(inspectDepthFaceSvg(goodSvg, "core--right"), {
    points: [
      { x: 300.5, y: 178.5 },
      { x: 288.5, y: 162.5 },
      { x: 464.5, y: 162.5 },
      { x: 476.5, y: 178.5 },
    ],
    rotation: 90,
    fill: "#ced9e1",
    stroke: "#6e7f8d",
    fillOpacity: 1,
    strokeOpacity: 1,
  });
  assert.doesNotThrow(() => assertRenderedDepthGeometry(goodSvg, ["core"]));
  for (const acceptedRotation of [90.05, 89.9, 90.1]) {
    const roundedRotationSvg = goodSvg.replace("rotate(90,", `rotate(${acceptedRotation},`);
    assert.doesNotThrow(
      () => assertRenderedDepthGeometry(roundedRotationSvg, ["core"]),
      `${acceptedRotation} degrees must remain within exporter tolerance`,
    );
  }
  for (const rejectedRotation of [90.11, 90.2]) {
    const rotatedSvg = goodSvg.replace("rotate(90,", `rotate(${rejectedRotation},`);
    assert.throws(
      () => assertRenderedDepthGeometry(rotatedSvg, ["core"]),
      /core--right.*rotation/i,
    );
  }

  const rightTransform = 'transform="rotate(90,382.5,170.5)"';
  for (const invalidTransform of [
    'transform="rotate(90garbage)"',
    'transform="rotate(90,0,0) scale(4)"',
    'transform="rotate(90,382.5,170.5) nonsense"',
    'transform="rotate(90,0,0)"',
    'transform="translate(1,2) rotate(90,382.5,170.5)"',
    'transform="rotate(90,Infinity,170.5)"',
  ]) {
    const invalidTransformSvg = goodSvg.replace(rightTransform, invalidTransform);
    assert.throws(
      () => assertRenderedDepthGeometry(invalidTransformSvg, ["core"]),
      /core--right.*(?:transform|rotation|geometry)/i,
    );
  }

  const transformedTopSvg = goodSvg.replace(
    '<path stroke="#6e7f8d" pointer-events="all"',
    '<path transform="translate(1,2)" stroke="#6e7f8d" pointer-events="all"',
  );
  assert.throws(() => assertRenderedDepthGeometry(transformedTopSvg, ["core"]), /core--top.*transform/i);

  const transformedFrontSvg = goodSvg.replace(
    '<rect stroke="#6e7f8d"',
    '<rect transform="translate(1,2)" stroke="#6e7f8d"',
  );
  assert.throws(() => assertRenderedDepthGeometry(transformedFrontSvg, ["core"]), /core--front.*transform/i);

  for (const ancestorTransform of ['transform="scale(1)"', 'transform="matrix(1,0,0,1,0,0)"', 'transform="translate(NaN,3)"']) {
    const invalidAncestorSvg = goodSvg.replace('transform="translate(-5 3)"', ancestorTransform);
    assert.throws(
      () => assertRenderedDepthGeometry(invalidAncestorSvg, ["core"]),
      /core--(?:front|top|right).*ancestor transform/i,
    );
  }

  const bowTieSvg = goodSvg.replace(
    'd="M 94.5 88.5 L 110.5 76.5 L 390.5 76.5 L 374.5 88.5 Z"',
    'd="M 94.5 88.5 L 110.5 76.5 L 374.5 88.5 L 390.5 76.5 Z"',
  );
  assert.throws(() => assertRenderedDepthGeometry(bowTieSvg, ["core"]), /core--top.*(?:convex|intersect|ordering)/i);

  const missingRotationSvg = goodSvg.replace(` ${rightTransform}`, "");
  assert.throws(
    () => assertRenderedDepthGeometry(missingRotationSvg, ["core"]),
    (error) => {
      assert.match(error.message, /core--right.*rotation/i);
      assert.doesNotMatch(error.message, /<svg|<path/i);
      return true;
    },
  );

  const rightGroupStart = goodSvg.indexOf('        <g class="cell" data-cell-id="core--right">');
  assert.notEqual(rightGroupStart, -1, "fixture must contain the right face group");
  const missingRightGroupSvg = `${goodSvg.slice(0, rightGroupStart)}      </g>\n    </g>\n  </svg>`;
  assert.throws(
    () => assertRenderedDepthGeometry(missingRightGroupSvg, ["core"]),
    (error) => {
      assert.match(error.message, /core--right.*group/i);
      assert.doesNotMatch(error.message, /<svg|<path/i);
      return true;
    },
  );

  const malformedGroupSvg = goodSvg.replace('    </g>\n  </svg>', '  </svg>');
  assert.throws(
    () => assertRenderedDepthGeometry(malformedGroupSvg, ["core"]),
    (error) => {
      assert.match(error.message, /core--front.*(?:group|element stack).*malformed/i);
      assert.doesNotMatch(error.message, /<svg|<path|<rect/i);
      return true;
    },
  );

  const assertVisibilityError = (svg, cellId, property) => {
    assert.throws(
      () => assertRenderedDepthGeometry(svg, ["core"]),
      (error) => {
        assert.match(error.message, new RegExp(`${cellId}.*${property}`, "i"));
        assert.doesNotMatch(error.message, /<svg|<path|<rect/i);
        return true;
      },
    );
  };

  const dimmedAncestorSvg = goodSvg.replace(
    '<g transform="translate(10,20)">',
    '<g opacity="0.2" transform="translate(10,20)">',
  );
  assertVisibilityError(dimmedAncestorSvg, "core--front", "opacity");

  for (const property of ["opacity", "fill-opacity", "stroke-opacity"]) {
    const styledAncestorSvg = goodSvg.replace(
      '<g transform="translate(10,20)">',
      `<g style="${property}: 0.2" transform="translate(10,20)">`,
    );
    assertVisibilityError(styledAncestorSvg, "core--front", property);

    const styledPathSvg = goodSvg.replace(
      '<path stroke="#6e7f8d" pointer-events="all"',
      `<path style="${property}: 0.2" stroke="#6e7f8d" pointer-events="all"`,
    );
    assertVisibilityError(styledPathSvg, "core--top", property);
  }

  const dimmedPathSvg = goodSvg.replace(
    '<path stroke="#6e7f8d" pointer-events="all"',
    '<path opacity="0.2" stroke="#6e7f8d" pointer-events="all"',
  );
  assertVisibilityError(dimmedPathSvg, "core--top", "opacity");

  for (const [attribute, replacement, property] of [
    [' fill="#f5f7f9"', "", "fill"],
    ['stroke="#6e7f8d" pointer-events="all"', 'pointer-events="all"', "stroke"],
    ['fill="#f5f7f9"', 'fill="none"', "fill"],
    ['stroke="#6e7f8d" pointer-events="all"', 'stroke="transparent" pointer-events="all"', "stroke"],
  ]) {
    const invisiblePaintSvg = goodSvg.replace(attribute, replacement);
    assertVisibilityError(invisiblePaintSvg, "core--top", property);
  }

  const pathStylePrioritySvg = goodSvg.replace(
    'fill="#f5f7f9"/>',
    'fill="none" opacity="0.2" fill-opacity="0.2" stroke-opacity="0.2" style="fill: #f5f7f9; stroke: #6e7f8d; opacity: 1; fill-opacity: 1; stroke-opacity: 1"/>',
  );
  assert.doesNotThrow(() => assertRenderedDepthGeometry(pathStylePrioritySvg, ["core"]));

  const ancestorStylePrioritySvg = goodSvg.replace(
    '<g transform="translate(10,20)">',
    '<g opacity="0.2" fill-opacity="0.2" stroke-opacity="0.2" style="opacity: 1; fill-opacity: 1; stroke-opacity: 1" transform="translate(10,20)">',
  );
  assert.doesNotThrow(() => assertRenderedDepthGeometry(ancestorStylePrioritySvg, ["core"]));

  const oldProportionalSvg = goodSvg.replace(
    'd="M 94.5 88.5 L 110.5 76.5 L 390.5 76.5 L 374.5 88.5 Z" fill="#f5f7f9"',
    'd="M 94.5 88.5 L 152.1 76.5 L 390.5 76.5 L 332.9 88.5 Z" fill-opacity="0.55" stroke-opacity="0.55" fill="#f5f7f9"',
  );
  const proportionalSkewSvg = oldProportionalSvg.replace(' fill-opacity="0.55" stroke-opacity="0.55"', "");
  assert.throws(
    () => assertRenderedDepthGeometry(proportionalSkewSvg, ["core"]),
    /core--top.*skew/i,
  );
  assert.throws(
    () => assertRenderedDepthGeometry(oldProportionalSvg, ["core"]),
    /core--top.*(?:skew|opacity)/i,
  );

  const transparentSeamSvg = goodSvg.replace(
    'fill="#f5f7f9"/>',
    'fill-opacity="0.55" stroke-opacity="0.55" fill="#f5f7f9"/>',
  );
  assert.throws(
    () => assertRenderedDepthGeometry(transparentSeamSvg, ["core"]),
    /core--top.*opacity/i,
  );
});

test("draw.io transform lists preserve joined right-face endpoints", async () => {
  const { assertRenderedDepthGeometry } = await import(builderUrl);

  assert.doesNotThrow(
    () => assertRenderedDepthGeometry(renderedFlippedDepthFixture(), ["core"]),
    "the exported right face must meet (1284,332), (1300,320), (1300,496), and (1284,508)",
  );
  assert.doesNotThrow(() => assertRenderedDepthGeometry(
    renderedFlippedDepthFixture(`translate(0) scale(1) rotate(0) ${DRAWIO_FLIPPED_RIGHT_TRANSFORM}`),
    ["core"],
  ));

  const rejectedTransforms = [
    "matrix(1,0,0,1,0,0)",
    `${DRAWIO_FLIPPED_RIGHT_TRANSFORM} trailing`,
    "translate(1e309,0) rotate(90,1292,414)",
    "translate(0,414,1) rotate(90,1292,414)",
    "scale(1,-1,1) rotate(90,1292,414)",
    "rotate(90,1292)",
    "translate(0,,414) rotate(90,1292,414)",
    "translate(0,414),,rotate(90,1292,414)",
  ];
  for (const transform of rejectedTransforms) {
    assert.throws(
      () => assertRenderedDepthGeometry(renderedFlippedDepthFixture(transform), ["core"]),
      /core--right.*transform/i,
    );
  }
});

test("SVG guard validates the complete ancestor chain", async () => {
  const { assertRenderedDepthGeometry } = await import(builderUrl);
  const goodSvg = renderedDepthFixture();
  const assertAncestorError = (svg, property) => {
    assert.throws(
      () => assertRenderedDepthGeometry(svg, ["core"]),
      (error) => {
        assert.match(error.message, new RegExp(`core--front.*${property}`, "i"));
        assert.doesNotMatch(error.message, /<svg|<script|<path|<rect/i);
        return true;
      },
    );
  };

  const dimmedRootSvg = goodSvg.replace(
    '<svg xmlns="http://www.w3.org/2000/svg">',
    '<svg opacity="0.2" xmlns="http://www.w3.org/2000/svg">',
  );
  assertAncestorError(dimmedRootSvg, "opacity");

  const linkedContainerSvg = goodSvg
    .replace('<g transform="translate(10,20)">', '<a transform="scale(0.5)"><g transform="translate(10,20)">')
    .replace('    </g>\n  </svg>', '    </g></a>\n  </svg>');
  assertAncestorError(linkedContainerSvg, "ancestor");

  const scaledGroupSvg = goodSvg.replace(
    '<g transform="translate(10,20)">',
    '<g transform="scale(0.5)"><g transform="translate(10,20)">',
  ).replace('    </g>\n  </svg>', '    </g></g>\n  </svg>');
  assertAncestorError(scaledGroupSvg, "ancestor transform");

  const scriptedSvg = goodSvg.replace(
    '<svg xmlns="http://www.w3.org/2000/svg">',
    '<svg xmlns="http://www.w3.org/2000/svg"><script/>',
  );
  assert.throws(
    () => assertRenderedDepthGeometry(scriptedSvg, ["core"]),
    (error) => {
      assert.match(error.message, /SVG.*script/i);
      assert.doesNotMatch(error.message, /<svg|<script|<path|<rect/i);
      return true;
    },
  );

  const commentedSvg = goodSvg.replace(
    '<svg xmlns="http://www.w3.org/2000/svg">',
    '<svg xmlns="http://www.w3.org/2000/svg"><!-- ignored <script><g transform="scale(4)"> -->',
  );
  assert.doesNotThrow(() => assertRenderedDepthGeometry(commentedSvg, ["core"]));

  const mismatchedSvg = linkedContainerSvg.replace('    </g></a>\n  </svg>', '    </a></g>\n  </svg>');
  assertAncestorError(mismatchedSvg, "stack.*malformed");
});

test("SVG guard requires provably visible exporter paint", async () => {
  const { assertRenderedDepthGeometry } = await import(builderUrl);
  const goodSvg = renderedDepthFixture();
  const assertPaintError = (svg, cellId, property) => {
    assert.throws(
      () => assertRenderedDepthGeometry(svg, ["core"]),
      (error) => {
        assert.match(error.message, new RegExp(`${cellId}.*${property}`, "i"));
        assert.doesNotMatch(error.message, /<svg|<path|<rect/i);
        return true;
      },
    );
  };

  assertPaintError(
    goodSvg.replace('<svg xmlns="http://www.w3.org/2000/svg">', '<svg display="none" xmlns="http://www.w3.org/2000/svg">'),
    "core--front",
    "display",
  );
  assertPaintError(
    goodSvg.replace('<g transform="translate(10,20)">', '<g visibility="hidden" transform="translate(10,20)">'),
    "core--front",
    "visibility",
  );
  assertPaintError(
    goodSvg.replace(
      '<path stroke="#6e7f8d" pointer-events="all"',
      '<path style="visibility: collapse" stroke="#6e7f8d" pointer-events="all"',
    ),
    "core--top",
    "visibility",
  );
  assertPaintError(
    goodSvg.replace(
      '<path stroke="#6e7f8d" pointer-events="all"',
      '<path stroke-width="0" stroke="#6e7f8d" pointer-events="all"',
    ),
    "core--top",
    "stroke-width",
  );
  assertPaintError(
    goodSvg.replace('<g transform="translate(10,20)">', '<g style="stroke-width: 0" transform="translate(10,20)">'),
    "core--front",
    "stroke-width",
  );

  for (const property of ["mask", "clip-path", "filter"]) {
    assertPaintError(
      goodSvg.replace(
        '<path stroke="#6e7f8d" pointer-events="all"',
        `<path ${property}="url(#effect)" stroke="#6e7f8d" pointer-events="all"`,
      ),
      "core--top",
      property,
    );
    assertPaintError(
      goodSvg.replace(
        '<g transform="translate(10,20)">',
        `<g style="${property}: url(#effect)" transform="translate(10,20)">`,
      ),
      "core--front",
      property,
    );
  }

  for (const [attribute, replacement, property] of [
    ['fill="#f5f7f9"', 'fill="#11223300"', "fill"],
    ['fill="#f5f7f9"', 'fill="rgb(1 2 3 / 0)"', "fill"],
    ['fill="#f5f7f9"', 'fill="var(--face)"', "fill"],
    ['stroke="#6e7f8d" pointer-events="all"', 'stroke="rgba(1, 2, 3, 0)" pointer-events="all"', "stroke"],
  ]) {
    assertPaintError(goodSvg.replace(attribute, replacement), "core--top", property);
  }

  const stylePrioritySvg = goodSvg.replace(
    '<path stroke="#6e7f8d" pointer-events="all"',
    '<path display="none" visibility="hidden" stroke-width="0" style="display: inline; visibility: visible; stroke-width: 1; fill: #f5f7f9; stroke: #6e7f8d" stroke="#6e7f8d" pointer-events="all"',
  );
  assert.doesNotThrow(() => assertRenderedDepthGeometry(stylePrioritySvg, ["core"]));

  const opaquePaintSvg = goodSvg.replace(
    '<path stroke="#6e7f8d" pointer-events="all"',
    '<path style="fill: light-dark(rgb(1, 2, 3), rgb(4 5 6)); stroke: rgb(7, 8, 9); stroke-width: 1" stroke="#112233FF" pointer-events="all"',
  );
  assert.doesNotThrow(() => assertRenderedDepthGeometry(opaquePaintSvg, ["core"]));
});

test("SVG guard rejects hidden rendering contexts and structural dashes", async () => {
  const { assertRenderedDepthGeometry } = await import(builderUrl);
  const goodSvg = renderedDepthFixture();
  const assertHiddenContext = (svg, cellOrSvg, property) => {
    assert.throws(
      () => assertRenderedDepthGeometry(svg, ["core"]),
      (error) => {
        assert.match(error.message, new RegExp(`${cellOrSvg}.*${property}`, "i"));
        assert.doesNotMatch(error.message, /<svg|<style|<animate|<path/i);
        return true;
      },
    );
  };

  const defsWrappedSvg = goodSvg
    .replace('<g transform="translate(10,20)">', '<defs><g transform="translate(10,20)">')
    .replace('    </g>\n  </svg>', '    </g></defs>\n  </svg>');
  assertHiddenContext(defsWrappedSvg, "core--front", "ancestor");

  const nestedTopSvg = goodSvg
    .replace('<g data-cell-id="core--top" class="cell">', '<svg x="100" y="0"><g data-cell-id="core--top" class="cell">')
    .replace(
      '        </g>\n        <g class="cell" data-cell-id="core--right">',
      '        </g></svg>\n        <g class="cell" data-cell-id="core--right">',
    );
  assertHiddenContext(nestedTopSvg, "core--top", "ancestor");

  const styledSvg = goodSvg.replace(
    '<svg xmlns="http://www.w3.org/2000/svg">',
    '<svg xmlns="http://www.w3.org/2000/svg"><style>[data-cell-id="core--top"] path{display:none}</style>',
  );
  assertHiddenContext(styledSvg, "SVG", "style");

  for (const animationElement of ["animate", "animateTransform", "set"]) {
    const animatedSvg = goodSvg.replace(
      '<svg xmlns="http://www.w3.org/2000/svg">',
      `<svg xmlns="http://www.w3.org/2000/svg"><${animationElement} attributeName="opacity" to="0"/>`,
    );
    assertHiddenContext(animatedSvg, "SVG", "animation");
  }

  const stylesheetSvg = `<?xml-stylesheet type="text/css" href="hidden.css"?>${goodSvg}`;
  assertHiddenContext(stylesheetSvg, "SVG", "stylesheet");

  const dashedAttributeSvg = goodSvg.replace(
    '<path stroke="#6e7f8d" pointer-events="all"',
    '<path stroke-dasharray="0 10000" stroke="#6e7f8d" pointer-events="all"',
  );
  assertHiddenContext(dashedAttributeSvg, "core--top", "stroke-dasharray");

  const dashedStyleSvg = goodSvg.replace(
    '<path stroke="#6e7f8d" pointer-events="all"',
    '<path style="stroke-dasharray: 0 10000" stroke="#6e7f8d" pointer-events="all"',
  );
  assertHiddenContext(dashedStyleSvg, "core--top", "stroke-dasharray");

  const dashStylePrioritySvg = goodSvg.replace(
    '<path stroke="#6e7f8d" pointer-events="all"',
    '<path stroke-dasharray="0 10000" style="stroke-dasharray: none" stroke="#6e7f8d" pointer-events="all"',
  );
  assert.doesNotThrow(() => assertRenderedDepthGeometry(dashStylePrioritySvg, ["core"]));
});

test("SVG guard rejects active behavior by element and attribute local name", async () => {
  const { assertRenderedDepthGeometry } = await import(builderUrl);
  const goodSvg = renderedDepthFixture();
  const withRootContent = (content) => goodSvg.replace(
    '<svg xmlns="http://www.w3.org/2000/svg">',
    `<svg xmlns="http://www.w3.org/2000/svg">${content}`,
  );
  const assertActiveBehavior = (svg, property) => {
    assert.throws(
      () => assertRenderedDepthGeometry(svg, ["core"]),
      (error) => {
        assert.match(error.message, new RegExp(`SVG.*${property}`, "i"));
        assert.doesNotMatch(error.message, /<svg|<script|<style|<animate|<discard|javascript:|data:/i);
        return true;
      },
    );
  };

  for (const [activeElement, property] of [
    ['<animateMotion attributeName="opacity" to="0"/>', "animation"],
    ['<discard begin="0s"/>', "active element"],
    ['<svg:script/>', "script"],
    ['<svg:style>path{display:none}</svg:style>', "style"],
    ['<svg:animate attributeName="opacity" to="0"/>', "animation"],
  ]) {
    assertActiveBehavior(withRootContent(activeElement), property);
  }

  const eventHandlerSvg = goodSvg.replace(
    '<svg xmlns="http://www.w3.org/2000/svg">',
    '<svg onload="run()" xmlns="http://www.w3.org/2000/svg">',
  );
  assertActiveBehavior(eventHandlerSvg, "event handler");

  for (const activeReference of [
    '<image href="javascript:run()"/>',
    '<a xlink:href="data:text/html,active"/>',
    '<image href="data:image/svg+xml,active"/>',
  ]) {
    assertActiveBehavior(withRootContent(activeReference), "active href");
  }

  assert.doesNotThrow(() => assertRenderedDepthGeometry(
    withRootContent('<image xlink:href="https://example.invalid/icon.svg"/>'),
    ["core"],
  ));
});

test("SVG guard uses one strict attribute parser without quoted-value shadowing", async () => {
  const { assertRenderedDepthGeometry } = await import(builderUrl);
  const goodSvg = renderedDepthFixture();
  const topPath = '<path stroke="#6e7f8d" pointer-events="all" d="M 94.5 88.5 L 110.5 76.5 L 390.5 76.5 L 374.5 88.5 Z" fill="#f5f7f9"/>';
  const shadowedPath = `<path data-note=' fill="#f5f7f9" stroke="#6e7f8d" d="M 94.5 88.5 L 110.5 76.5 L 390.5 76.5 L 374.5 88.5 Z"' fill="none" stroke="none" d="M 0 0"/>`;
  const shadowedSvg = goodSvg.replace(topPath, shadowedPath);
  assert.notEqual(shadowedSvg, goodSvg, "fixture replacement must target the top face");
  assert.throws(
    () => assertRenderedDepthGeometry(shadowedSvg, ["core"]),
    /core--top.*(?:path|fill|stroke)/i,
  );

  const duplicateAttributeSvg = goodSvg.replace(
    '<path stroke="#6e7f8d" pointer-events="all"',
    '<path stroke="#6e7f8d" STROKE="#6e7f8d" pointer-events="all"',
  );
  assert.throws(
    () => assertRenderedDepthGeometry(duplicateAttributeSvg, ["core"]),
    (error) => {
      assert.match(error.message, /SVG.*duplicate attribute/i);
      assert.doesNotMatch(error.message, /STROKE|<path/i);
      return true;
    },
  );
});

test("SVG guard rejects DTD declarations and unresolved href entities", async () => {
  const { assertRenderedDepthGeometry } = await import(builderUrl);
  const goodSvg = renderedDepthFixture();
  const withRootContent = (content) => goodSvg.replace(
    '<svg xmlns="http://www.w3.org/2000/svg">',
    `<svg xmlns="http://www.w3.org/2000/svg">${content}`,
  );

  const entitySvg = `<!DOCTYPE svg [<!ENTITY active "javascript:run()">]>${withRootContent('<image href="&active;"/>')}`;
  assert.throws(
    () => assertRenderedDepthGeometry(entitySvg, ["core"]),
    /SVG.*(?:DOCTYPE|ENTITY)/i,
  );

  const unresolvedEntitySvg = withRootContent('<image href="&unresolved;"/>');
  assert.throws(
    () => assertRenderedDepthGeometry(unresolvedEntitySvg, ["core"]),
    /SVG.*href.*(?:entity|reference)/i,
  );

  assert.doesNotThrow(() => assertRenderedDepthGeometry(
    withRootContent('<image href="https://example.invalid/icon.svg?a=1&amp;b=2"/>'),
    ["core"],
  ));
});

test("SVG finalization preserves the last-known-good preview and cleans temporary exports", async (context) => {
  const { finalizeSvgExport, assertRenderedDepthGeometry } = await import(builderUrl);
  const directory = await mkdtemp(path.join(tmpdir(), "drawio-svg-finalize-"));
  context.after(() => rm(directory, { recursive: true, force: true }));
  const finalPath = path.join(directory, "preview.svg");
  const sentinel = renderedDepthFixture();
  await writeFile(finalPath, sentinel, "utf8");

  const aliasedPath = path.join(directory, "aliased.svg");
  await writeFile(aliasedPath, sentinel, "utf8");
  await assert.rejects(
    () => finalizeSvgExport(aliasedPath, aliasedPath, ["core"]),
    (error) => {
      assert.match(error.message, /raw and final.*(?:distinct|same file|file identity)/i);
      assert.doesNotMatch(error.message, /aliased\.svg/i);
      return true;
    },
  );
  assert.equal(await readFile(aliasedPath, "utf8"), sentinel, "aliased paths must not delete the valid preview");
  await rm(aliasedPath);

  const invalidRawPath = path.join(directory, "invalid.raw.svg");
  const invalidRaw = renderedDepthFixture()
    .replace(
      'd="M 94.5 88.5 L 110.5 76.5 L 390.5 76.5 L 374.5 88.5 Z"',
      'd="M 94.5 88.5 L 152.1 76.5 L 390.5 76.5 L 332.9 88.5 Z"',
    )
    .replace(
      '<svg xmlns="http://www.w3.org/2000/svg">',
      '<svg xmlns="http://www.w3.org/2000/svg" content="&lt;mxfile&gt;private&lt;/mxfile&gt;"><metadata>private source</metadata><image href="data:image/png;base64,AAAA"/>',
    );
  await writeFile(invalidRawPath, invalidRaw, "utf8");
  await assert.rejects(
    () => finalizeSvgExport(invalidRawPath, finalPath, ["core"]),
    (error) => {
      assert.match(error.message, /core--top.*(?:skew|geometry)/i);
      assert.doesNotMatch(error.message, /<svg|<path|private source/i);
      return true;
    },
  );
  assert.equal(await readFile(finalPath, "utf8"), sentinel, "invalid export must not replace the prior preview");
  assert.deepEqual(await readdir(directory), ["preview.svg"], "invalid raw and staging files must be removed");

  const validRawPath = path.join(directory, "valid.raw.svg");
  const validRaw = renderedDepthFixture().replace(
    '<svg xmlns="http://www.w3.org/2000/svg">',
    '<svg xmlns="http://www.w3.org/2000/svg" content="&lt;mxfile&gt;private&lt;/mxfile&gt;"><metadata>private source</metadata><image href="data:image/png;base64,AAAA"/>',
  );
  await writeFile(validRawPath, validRaw, "utf8");
  const finalized = await finalizeSvgExport(validRawPath, finalPath, ["core"]);
  const published = await readFile(finalPath, "utf8");
  assert.equal(finalized.output_path, finalPath);
  assert.equal(finalized.bytes, Buffer.byteLength(published, "utf8"));
  assert.doesNotMatch(published, /<metadata\b|data:image\/|\bcontent\s*=/i);
  assert.doesNotThrow(() => assertRenderedDepthGeometry(published, ["core"]));
  assert.deepEqual(await readdir(directory), ["preview.svg"], "valid raw and staging files must be removed");
});

test("SVG finalization rejects file identity aliases before cleanup", async (context) => {
  const { finalizeSvgExport } = await import(builderUrl);
  const directory = await mkdtemp(path.join(tmpdir(), "drawio-svg-alias-"));
  context.after(() => rm(directory, { recursive: true, force: true }));
  const finalPath = path.join(directory, "preview.svg");
  const rawAliasPath = path.join(directory, "preview-hardlink.svg");
  const sentinel = renderedDepthFixture();
  await writeFile(finalPath, sentinel, "utf8");
  await link(finalPath, rawAliasPath);

  const assertIdentityRejection = async (rawPath) => {
    await assert.rejects(
      () => finalizeSvgExport(rawPath, finalPath, ["core"]),
      (error) => {
        assert.match(error.message, /raw and final.*same file|file identity/i);
        assert.doesNotMatch(error.message, /preview|drawio-svg-alias/i);
        return true;
      },
    );
  };

  await assertIdentityRejection(rawAliasPath);
  assert.equal(await readFile(finalPath, "utf8"), sentinel);
  assert.equal(await readFile(rawAliasPath, "utf8"), sentinel);
  const finalIdentity = await stat(finalPath, { bigint: true });
  const rawIdentity = await stat(rawAliasPath, { bigint: true });
  assert.equal(finalIdentity.dev, rawIdentity.dev);
  assert.equal(finalIdentity.ino, rawIdentity.ino);

  if (process.platform === "win32") {
    const extendedPath = `\\\\?\\${path.resolve(finalPath)}`;
    let extendedPathSupported = true;
    try {
      await stat(extendedPath);
    } catch {
      extendedPathSupported = false;
    }
    if (extendedPathSupported) {
      await assertIdentityRejection(extendedPath);
      assert.equal(await readFile(finalPath, "utf8"), sentinel);
    }
  }

  assert.deepEqual(
    (await readdir(directory)).sort(),
    ["preview-hardlink.svg", "preview.svg"],
    "identity rejection must not remove aliases or leave staging files",
  );
});
