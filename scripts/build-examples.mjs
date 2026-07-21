#!/usr/bin/env node

import { spawn } from "node:child_process";
import { readFile, realpath, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { createInterface } from "node:readline";
import { fileURLToPath, pathToFileURL } from "node:url";

const CANVAS = "#FAFBFC";
const SURFACE = "#FFFFFF";
const TEXT_PRIMARY = "#263238";
const TEXT_SECONDARY = "#5F6B73";
const RULE_LIGHT = "#D9DFE3";
const MODULE_WIDTH = 280;
const MODULE_HEIGHT = 176;
const DEPTH_X = 16;
const DEPTH_Y = 12;

const FAMILIES = {
  neutral: { fill: "#F3F5F6", top: "#FAFBFB", right: "#DDE3E6", line: "#88939B", icon: "#59656D" },
  slate: { fill: "#E9EEF2", top: "#F5F7F9", right: "#CED9E1", line: "#6E7F8D", icon: "#425563" },
  teal: { fill: "#E3F1EF", top: "#F1F8F7", right: "#C5DDD9", line: "#5C918A", icon: "#276B64" },
  sage: { fill: "#EAF1E6", top: "#F5F8F3", right: "#CFDCC8", line: "#7F9A71", icon: "#55734B" },
  clay: { fill: "#F3E8E2", top: "#FAF4F1", right: "#DDC8BD", line: "#A97C68", icon: "#805442" },
  khaki: { fill: "#F3EEDA", top: "#FAF7EC", right: "#DDD4AC", line: "#A49558", icon: "#756A37" },
  plum: { fill: "#F0E7EE", top: "#F8F3F7", right: "#D8C7D4", line: "#92758B", icon: "#684E63" },
};

const EDGE_STYLES = {
  flow: "edgeStyle=orthogonalEdgeStyle;rounded=1;arcSize=6;orthogonalLoop=1;jettySize=auto;html=0;strokeColor=#4C5963;strokeWidth=1.75;endArrow=block;endFill=1;fontColor=#5F6B73;fontSize=11;fontStyle=1;fontFamily=Arial;labelBackgroundColor=#FFFFFF;spacing=3;",
  feedback: "edgeStyle=orthogonalEdgeStyle;rounded=1;arcSize=6;orthogonalLoop=1;jettySize=auto;html=0;strokeColor=#5C7E8C;strokeWidth=1.5;dashed=1;dashPattern=6 4;endArrow=open;endFill=0;fontColor=#5F6B73;fontSize=11;fontStyle=1;fontFamily=Arial;labelBackgroundColor=#FFFFFF;spacing=3;",
  constraint: "edgeStyle=orthogonalEdgeStyle;rounded=1;arcSize=6;orthogonalLoop=1;jettySize=auto;html=0;strokeColor=#8C6556;strokeWidth=1.5;dashed=1;dashPattern=2 3;endArrow=diamond;endFill=1;fontColor=#5F6B73;fontSize=11;fontStyle=1;fontFamily=Arial;labelBackgroundColor=#FFFFFF;spacing=3;",
  reference: "edgeStyle=orthogonalEdgeStyle;rounded=1;arcSize=6;orthogonalLoop=1;jettySize=auto;html=0;strokeColor=#7B7F84;strokeWidth=1.25;dashed=1;dashPattern=1 3;endArrow=open;endFill=0;fontColor=#5F6B73;fontSize=11;fontStyle=1;fontFamily=Arial;labelBackgroundColor=#FFFFFF;spacing=3;",
};

const LAYOUTS = {
  "multimodal-ml-pipeline": {
    canvas: { width: 1960, height: 1180 },
    coreModules: ["temporal-fusion", "confidence-gate", "task-head"],
    regions: [
      { id: "generated-inputs", label: "Generated inputs", x: 40, y: 120, width: 420, height: 880 },
      { id: "representation", label: "Representation", x: 500, y: 120, width: 420, height: 880 },
      { id: "reasoning", label: "Reasoning", x: 960, y: 120, width: 420, height: 880 },
      { id: "delivery", label: "Delivery", x: 1420, y: 120, width: 500, height: 880 },
    ],
    modules: {
      "acoustic-samples": [104, 200],
      "visual-frames": [104, 470],
      "context-tokens": [104, 740],
      "signal-encoder": [564, 200],
      "image-encoder": [564, 470],
      "text-encoder": [564, 740],
      "temporal-fusion": [1024, 320],
      "confidence-gate": [1024, 620],
      "task-head": [1524, 320],
      "quality-monitor": [1524, 620],
    },
    routes: {
      "acoustic-to-signal": { exit_x: 1, exit_y: 0.5, entry_x: 0, entry_y: 0.5 },
      "visual-to-image": { exit_x: 1, exit_y: 0.5, entry_x: 0, entry_y: 0.5 },
      "tokens-to-text": { exit_x: 1, exit_y: 0.5, entry_x: 0, entry_y: 0.5 },
      "signal-to-fusion": { exit_x: 1, exit_y: 0.5, entry_x: 0, entry_y: 0.3, waypoints: [{ x: 940, y: 291 }, { x: 940, y: 375 }] },
      "image-to-fusion": { exit_x: 1, exit_y: 0.5, entry_x: 0, entry_y: 0.5, waypoints: [{ x: 920, y: 561 }, { x: 920, y: 411 }] },
      "text-to-fusion": { exit_x: 1, exit_y: 0.5, entry_x: 0, entry_y: 0.7, waypoints: [{ x: 940, y: 831 }, { x: 940, y: 447 }] },
      "fusion-to-gate": { source_center_x: true, exit_y: 1, target_center_x: true, entry_y: 0 },
      "gate-to-head": { exit_x: 1, exit_y: 0.5, entry_x: 0, entry_y: 0.7, waypoints: [{ x: 1448, y: 711 }, { x: 1448, y: 447 }] },
      "head-to-monitor": { source_center_x: true, exit_y: 1, target_center_x: true, entry_y: 0 },
      "monitor-to-fusion": {
        exit_x: 0,
        exit_y: 0.75,
        entry_x: 1,
        entry_y: 0.75,
        waypoints: [{ x: 1400, y: 752 }, { x: 1400, y: 461 }],
      },
    },
  },
  "generic-safe-control-loop": {
    canvas: { width: 2640, height: 1180 },
    coreModules: ["nominal-controller", "safety-filter", "constraint-library", "command-actuator"],
    regions: [
      { id: "observation", label: "Observation", x: 40, y: 120, width: 1090, height: 640 },
      { id: "decision", label: "Decision", x: 1160, y: 120, width: 820, height: 640 },
      { id: "execution-feedback", label: "Execution and feedback", x: 2010, y: 120, width: 590, height: 640 },
    ],
    modules: {
      "synthetic-environment": [80, 230],
      "state-sensors": [430, 230],
      "state-observer": [780, 230],
      "nominal-controller": [1200, 230],
      "constraint-library": [1400, 520],
      "safety-filter": [1610, 230],
      "command-actuator": [2150, 230],
      "outcome-monitor": [2150, 520],
    },
    routes: {
      "environment-to-sensors": { exit_x: 1, exit_y: 0.5, entry_x: 0, entry_y: 0.5 },
      "sensors-to-observer": { exit_x: 1, exit_y: 0.5, entry_x: 0, entry_y: 0.5 },
      "observer-to-controller": { exit_x: 1, exit_y: 0.5, entry_x: 0, entry_y: 0.5 },
      "controller-to-filter": { exit_x: 1, exit_y: 0.5, entry_x: 0, entry_y: 0.5 },
      "constraints-to-filter": {
        source_center_x: true,
        exit_y: 0,
        target_center_x: true,
        entry_y: 1,
        waypoints: [{ source_center_x: true, y: 476 }, { target_center_x: true, y: 476 }],
      },
      "filter-to-actuator": { exit_x: 1, exit_y: 0.5, entry_x: 0, entry_y: 0.5 },
      "actuator-to-environment": {
        exit_x: 1,
        exit_y: 0.5,
        entry_x: 0,
        entry_y: 0.5,
        waypoints: [{ x: 2480, y: 330 }, { x: 2480, y: 850 }, { x: 40, y: 850 }, { x: 40, y: 318 }],
      },
      "environment-to-monitor": {
        source_center_x: true,
        exit_y: 1,
        target_center_x: true,
        entry_y: 1,
        waypoints: [{ source_center_x: true, y: 780 }, { target_center_x: true, y: 780 }],
      },
      "actuator-to-monitor": { source_center_x: true, exit_y: 1, target_center_x: true, entry_y: 0 },
      "monitor-to-observer": {
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
    },
  },
};

function moduleTreatment(layout, moduleId) {
  return layout.coreModules.includes(moduleId) ? "core" : "supporting";
}

function moduleGroupWidth(layout, moduleId) {
  return moduleTreatment(layout, moduleId) === "core" ? MODULE_WIDTH + DEPTH_X : MODULE_WIDTH;
}

function frontCenterX(layout, moduleId) {
  const position = layout.modules[moduleId];
  if (!position) throw new Error(`Missing layout position for '${moduleId}'.`);
  return position[0] + MODULE_WIDTH / 2;
}

function frontCenterPortX(layout, moduleId) {
  const position = layout.modules[moduleId];
  if (!position) throw new Error(`Missing layout position for '${moduleId}'.`);
  return (frontCenterX(layout, moduleId) - position[0]) / moduleGroupWidth(layout, moduleId);
}

function resolveRoute(layout, edge, route = {}) {
  const {
    source_center_x: sourceCenterX,
    target_center_x: targetCenterX,
    waypoints,
    ...resolved
  } = route;
  if (sourceCenterX) resolved.exit_x = frontCenterPortX(layout, edge.source);
  if (targetCenterX) resolved.entry_x = frontCenterPortX(layout, edge.target);
  if (waypoints) {
    resolved.waypoints = waypoints.map((waypoint) => {
      const {
        source_center_x: waypointSourceCenterX,
        target_center_x: waypointTargetCenterX,
        ...resolvedWaypoint
      } = waypoint;
      if (waypointSourceCenterX && waypointTargetCenterX) {
        throw new Error(`Waypoint for '${edge.id}' cannot align to both route endpoints.`);
      }
      if (waypointSourceCenterX) resolvedWaypoint.x = frontCenterX(layout, edge.source);
      if (waypointTargetCenterX) resolvedWaypoint.x = frontCenterX(layout, edge.target);
      return resolvedWaypoint;
    });
  }
  return resolved;
}

function textStyle({ size = 11, bold = false, color = TEXT_PRIMARY, align = "left", vertical = "middle" } = {}) {
  return `text;strokeColor=none;fillColor=none;whiteSpace=wrap;html=0;align=${align};verticalAlign=${vertical};fontFamily=Arial;fontSize=${size};fontStyle=${bold ? 1 : 0};fontColor=${color};spacing=0;overflow=hidden;`;
}

function flatStyle({ fill = "none", stroke = "none", width = 1, rounded = false, opacity = 100 } = {}) {
  return `rounded=${rounded ? 1 : 0};whiteSpace=wrap;html=0;fillColor=${fill};strokeColor=${stroke};strokeWidth=${width};opacity=${opacity};shadow=0;`;
}

export function buildSemanticMotif(module, family, frontY = 0) {
  const parent = module.id;
  const base = `${module.id}--motif`;
  const vertices = [];
  const icon = family.icon;
  const add = (suffix, shape, x, y, width, height, style, rotation) => {
    vertices.push({ id: `${base}-${suffix}`, shape, parent, x, y: y + frontY, width, height, style, ...(rotation === undefined ? {} : { rotation }) });
  };
  const line = (suffix, x, y, width, height = 2, rotation = 0, fill = icon) => add(suffix, "rectangle", x, y, width, height, flatStyle({ fill }), rotation);
  const dashedLine = (suffix, x, y, width, height = 3, rotation = 0) => add(
    suffix,
    "rectangle",
    x,
    y,
    width,
    height,
    `rounded=0;whiteSpace=wrap;html=0;fillColor=none;strokeColor=${icon};strokeWidth=1.5;dashed=1;dashPattern=3 2;opacity=100;shadow=0;`,
    rotation,
  );
  const dot = (suffix, x, y, size = 7, fill = SURFACE) => add(suffix, "ellipse", x, y, size, size, flatStyle({ fill, stroke: icon, width: 1.5 }));
  const box = (suffix, x, y, width, height, fill = SURFACE, rounded = true) => add(suffix, rounded ? "rounded" : "rectangle", x, y, width, height, flatStyle({ fill, stroke: icon, width: 1.5, rounded }));
  const slab = (suffix, x, y, width, height, { depthX = 4, depthY = 3, fill = SURFACE } = {}) => {
    add(
      `${suffix}-top`,
      "parallelogram",
      x,
      y,
      width + depthX,
      depthY,
      `shape=parallelogram;perimeter=parallelogramPerimeter;fixedSize=1;size=${depthX};fillColor=${family.top};strokeColor=${family.line};strokeWidth=1;opacity=100;shadow=0;`,
    );
    add(
      `${suffix}-right`,
      "parallelogram",
      x + width,
      y,
      depthX,
      height + depthY,
      `shape=parallelogram;perimeter=parallelogramPerimeter;direction=south;flipH=1;fixedSize=1;size=${depthY};fillColor=${family.right};strokeColor=${family.line};strokeWidth=1;opacity=100;shadow=0;`,
    );
    add(suffix, "rectangle", x, y + depthY, width, height, flatStyle({ fill, stroke: family.line, width: 1 }));
  };
  const kind = module.motif;

  if (["waveform", "estimate-wave"].includes(kind)) {
    slab("slice-back", 14, 29, 42, 20, { fill: family.fill });
    slab("slice-middle", 18, 35, 42, 20, { fill: family.top });
    slab("slice-front", 22, 41, 42, 20);
    [6, 12, 18, 12, 6].forEach((height, index) => line(`wave-${index + 1}`, 28 + index * 6, 54 - height / 2, 2, height));
  } else if (kind === "image-grid") {
    slab("plane-back", 14, 29, 42, 26, { fill: family.fill });
    slab("plane-middle", 18, 34, 42, 26, { fill: family.top });
    slab("plane-front", 22, 39, 42, 26);
    [[27, 45], [42, 45], [27, 55], [42, 55]].forEach(([x, y], index) => box(`tile-${index + 1}`, x, y, 11, 8, index === 3 ? family.icon : SURFACE, false));
  } else if (kind === "token-stack") {
    slab("token-back", 14, 31, 46, 10, { fill: family.fill });
    slab("token-middle", 17, 43, 46, 10, { fill: family.top });
    slab("token-front", 20, 55, 46, 10);
    [26, 35, 46, 55].forEach((x, index) => line(`token-tick-${index + 1}`, x, 59, 2, 6));
  } else if (["layer-stack", "stacked-blocks", "feature-grid"].includes(kind)) {
    line("tensor-wide-to-middle", 28, 50, 7, 2);
    line("tensor-middle-to-compact", 49, 50, 7, 2);
    slab("tensor-wide", 10, 37, 18, 22, { fill: family.fill });
    slab("tensor-middle", 35, 39, 14, 18, { fill: family.top });
    slab("tensor-compact", 56, 41, 10, 14);
  } else if (kind === "converging-nodes") {
    line("stream-a", 14, 31, 36, 5, 17, family.top);
    line("stream-b", 14, 48, 36, 5, 0, family.fill);
    line("stream-c", 14, 65, 36, 5, -17, family.right);
    slab("fusion-core", 49, 38, 15, 25, { depthX: 5, depthY: 4, fill: family.fill });
    line("fusion-spine", 55, 46, 3, 13);
  } else if (["guarded-diamond", "shield-check"].includes(kind)) {
    slab("threshold-plane", 20, 31, 22, 37, { depthX: 5, depthY: 4, fill: family.fill });
    line("accept-path", 39, 47, 27, 4, 0);
    dashedLine("reject-path", 39, 61, 27, 4, 0);
    line("accept-tip", 60, 44, 8, 3, 35);
    dashedLine("reject-tip", 60, 64, 8, 3, -35);
  } else if (kind === "policy-nodes") {
    slab("state-block", 12, 38, 14, 20, { fill: family.top });
    slab("policy-transform", 32, 35, 16, 26, { fill: family.fill });
    slab("action-block", 54, 38, 14, 20);
    line("state-to-policy", 25, 50, 8, 2);
    line("policy-to-action", 47, 50, 8, 2);
  } else if (kind === "boundary-shield") {
    line("bound-upper", 14, 34, 50, 4, -7);
    slab("feasible-band", 18, 43, 42, 16, { fill: family.fill });
    line("bound-lower", 14, 69, 50, 4, 7);
    line("feasible-axis", 29, 51, 20, 2);
  } else if (kind === "sensor-array") {
    [20, 36, 52].forEach((x, index) => {
      dot(`sensor-${index + 1}`, x, 43 + (index % 2) * 10, 8, index === 1 ? icon : SURFACE);
      line(`stem-${index + 1}`, x + 3, 55 + (index % 2) * 10, 2, 12);
    });
  } else if (kind === "state-orbit") {
    add("orbit-a", "ellipse", 20, 39, 42, 28, flatStyle({ fill: "none", stroke: icon, width: 1.5 }));
    add("orbit-b", "ellipse", 29, 33, 24, 40, flatStyle({ fill: "none", stroke: icon, width: 1.5 }));
    dot("state", 38, 49, 9, icon);
  } else if (kind === "actuator-arm") {
    slab("command-block", 13, 44, 18, 22, { fill: family.fill });
    line("lever", 29, 47, 32, 5, -24);
    line("output-pulse", 53, 37, 14, 3, 30);
    line("pulse-fall", 62, 41, 3, 13);
    dot("lever-pivot", 27, 51, 7, icon);
  } else if (["trend-gauge", "gauge-check"].includes(kind)) {
    box("screen", 14, 32, 54, 38, SURFACE, false);
    line("trend", 20, 58, 14, 3, -18);
    line("trend-rise", 32, 51, 14, 3, 28);
    line("trend-level", 43, 48, 16, 3, -8);
    line("check", 49, 60, 8, 3, 38);
    line("check-tail", 55, 56, 10, 3, -42);
  } else if (kind === "output-bars") {
    [12, 22, 32].forEach((height, index) => line(`bar-${index + 1}`, 22 + index * 13, 68 - height, 8, height));
    line("baseline", 18, 68, 48, 2);
  } else {
    dot("node-a", 20, 45, 8);
    dot("node-b", 52, 45, 8, icon);
    line("link", 28, 48, 24, 2);
  }
  return vertices;
}

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
        style: `shape=parallelogram;perimeter=parallelogramPerimeter;direction=south;flipH=1;fixedSize=1;size=${DEPTH_Y};fillColor=${family.right};strokeColor=${family.line};strokeWidth=1;shadow=0;`,
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

function buildModule(module, x, y, treatment = "supporting") {
  const family = FAMILIES[module.colorRole];
  if (!family) throw new Error(`Unknown color role '${module.colorRole}' for ${module.id}.`);
  const isCore = treatment === "core";
  const frontY = isCore ? DEPTH_Y : 0;
  const groupWidth = isCore ? MODULE_WIDTH + DEPTH_X : MODULE_WIDTH;
  const groupHeight = isCore ? MODULE_HEIGHT + DEPTH_Y : MODULE_HEIGHT;
  const vertices = [
    { id: module.id, shape: "group", parent: "architecture-layer", x, y, width: groupWidth, height: groupHeight, custom_style: "connectable=1;" },
    ...buildDepthFaces(module, family, treatment),
    ...buildSemanticMotif(module, family, frontY),
    { id: `${module.id}--label`, label: module.label, shape: "text", parent: module.id, x: 76, y: 20 + frontY, width: 186, height: 22, style: textStyle({ size: 13, bold: true }) },
    { id: `${module.id}--subtitle`, label: module.subtitle, shape: "text", parent: module.id, x: 76, y: 45 + frontY, width: 186, height: 18, style: textStyle({ size: 10, color: TEXT_SECONDARY }) },
    { id: `${module.id}--divider`, shape: "rectangle", parent: module.id, x: 20, y: 84 + frontY, width: 240, height: 1, style: flatStyle({ fill: RULE_LIGHT }) },
  ];
  module.details.forEach((detail, index) => {
    const lineY = 96 + frontY + index * 22;
    vertices.push({ id: `${module.id}--bullet-${index + 1}`, shape: "ellipse", parent: module.id, x: 22, y: lineY + 6, width: 5, height: 5, style: flatStyle({ fill: family.icon }) });
    vertices.push({ id: `${module.id}--detail-${index + 1}`, label: detail, shape: "text", parent: module.id, x: 34, y: lineY, width: 226, height: 17, style: textStyle({ size: 10 }) });
  });
  return vertices;
}

function regionVertex(region) {
  return {
    id: `region-${region.id}`,
    label: region.label,
    shape: "rounded",
    parent: "architecture-layer",
    x: region.x,
    y: region.y,
    width: region.width,
    height: region.height,
    style: `rounded=1;arcSize=8;whiteSpace=wrap;html=0;fillColor=#F7F9FA;strokeColor=${RULE_LIGHT};strokeWidth=1;align=left;verticalAlign=top;spacingLeft=16;spacingTop=14;fontFamily=Arial;fontSize=14;fontStyle=1;fontColor=${TEXT_PRIMARY};shadow=0;`,
  };
}

function legendVertices(canvasWidth, canvasHeight) {
  const y = canvasHeight - 138;
  const x = 40;
  const width = canvasWidth - 80;
  const vertices = [
    { id: "legend-panel", shape: "rounded", parent: "architecture-layer", x, y, width, height: 98, style: `rounded=1;arcSize=8;fillColor=${SURFACE};strokeColor=${RULE_LIGHT};strokeWidth=1;shadow=0;` },
    { id: "legend-title", label: "Connector semantics", shape: "text", parent: "architecture-layer", x: x + 18, y: y + 14, width: 160, height: 22, style: textStyle({ size: 12, bold: true }) },
  ];
  const roles = [
    ["flow", "Primary flow"],
    ["feedback", "Feedback"],
    ["constraint", "Constraint"],
    ["reference", "Reference"],
  ];
  const available = width - 210;
  const step = available / roles.length;
  roles.forEach(([role, label], index) => {
    const startX = x + 190 + step * index;
    vertices.push({ id: `legend-${role}-label`, label, shape: "text", parent: "architecture-layer", x: startX + 82, y: y + 48, width: Math.max(90, step - 96), height: 18, style: textStyle({ size: 10, color: TEXT_SECONDARY }) });
  });
  return vertices;
}

function legendEdges(canvasWidth, canvasHeight) {
  const y = canvasHeight - 138;
  const x = 40;
  const width = canvasWidth - 80;
  const available = width - 210;
  const step = available / 4;
  return ["flow", "feedback", "constraint", "reference"].map((role, index) => ({
    id: `legend-${role}-line`,
    parent: "architecture-layer",
    source_point: { x: x + 190 + step * index, y: y + 57 },
    target_point: { x: x + 190 + step * index + 68, y: y + 57 },
    style: EDGE_STYLES[role],
  }));
}

function buildSpecEdge(edge, route = {}) {
  return {
    id: edge.id,
    label: edge.label,
    source: edge.source,
    target: edge.target,
    parent: "architecture-layer",
    style: EDGE_STYLES[edge.role],
    ...route,
  };
}

export function buildPayloadForSpec(spec) {
  const layout = LAYOUTS[spec.slug];
  if (!layout) throw new Error(`No public synthetic layout is defined for '${spec.slug}'.`);
  const modules = spec.layers.flatMap((layer) => layer.modules);
  const vertices = [
    ...layout.regions.map(regionVertex),
    { id: "figure-subtitle", label: spec.subtitle, shape: "text", parent: "architecture-layer", x: 80, y: 72, width: layout.canvas.width - 160, height: 24, style: textStyle({ size: 12, color: TEXT_SECONDARY, align: "center" }) },
  ];
  for (const module of modules) {
    const position = layout.modules[module.id];
    if (!position) throw new Error(`Missing layout position for '${module.id}'.`);
    const treatment = moduleTreatment(layout, module.id);
    vertices.push(...buildModule(module, ...position, treatment));
  }
  vertices.push(...legendVertices(layout.canvas.width, layout.canvas.height));
  const edges = spec.edges.map((edge) => buildSpecEdge(edge, resolveRoute(layout, edge, layout.routes[edge.id])));
  edges.push(...legendEdges(layout.canvas.width, layout.canvas.height));
  return {
    title: spec.title,
    page_name: spec.title,
    canvas: { ...layout.canvas, background: CANVAS, grid: true },
    layers: [{ id: "architecture-layer", name: "Editable architecture" }],
    vertices,
    edges,
  };
}

const CANONICAL_DRAWIO_SVG_11_DOCTYPE =
  /^(\uFEFF?[ \t\r\n]*(?:<\?xml[ \t\r\n]+version="1\.0"[ \t\r\n]+encoding="UTF-8"[ \t\r\n]*\?>[ \t\r\n]*)?)<!DOCTYPE[ \t\r\n]+svg[ \t\r\n]+PUBLIC[ \t\r\n]+"-\/\/W3C\/\/DTD SVG 1\.1\/\/EN"[ \t\r\n]+"http:\/\/www\.w3\.org\/Graphics\/SVG\/1\.1\/DTD\/svg11\.dtd"[ \t\r\n]*>[ \t\r\n]*/;

export function sanitizeSvg(svg) {
  return svg
    .replace(CANONICAL_DRAWIO_SVG_11_DOCTYPE, "$1")
    .replace(/<metadata\b[^>]*>[\s\S]*?<\/metadata>/gi, "")
    .replace(/<image\b(?=[^>]*(?:xlink:href|href)\s*=\s*["']data:image\/)[^>]*\/?\s*>/gi, "")
    .replace(/<svg\b[^>]*>/i, (openingTag) => openingTag.replace(/\scontent\s*=\s*(?:"[^"]*"|'[^']*')/i, ""));
}

const SVG_ELEMENT_TOKENS = /<!--[\s\S]*?-->|<\/?[A-Za-z][A-Za-z0-9:_-]*\b[^>]*>/g;

function svgLocalName(qualifiedName) {
  return qualifiedName.toLowerCase().split(":").at(-1);
}

function svgTagAttributes(tag, errorContext) {
  const opening = tag.match(/^<\s*[A-Za-z][A-Za-z0-9:_-]*/)?.[0];
  if (opening === undefined) throw new Error(`${errorContext} element attributes are malformed.`);
  const attributes = new Map();
  let index = opening.length;
  const end = tag.length - 1;
  while (index < end) {
    while (index < end && /\s/.test(tag[index])) index += 1;
    if (index >= end) break;
    if (tag[index] === "/") {
      index += 1;
      while (index < end && /\s/.test(tag[index])) index += 1;
      if (index === end) break;
      throw new Error(`${errorContext} element attributes are malformed.`);
    }

    const nameMatch = tag.slice(index).match(/^([A-Za-z_][A-Za-z0-9:_.-]*)/);
    if (!nameMatch) throw new Error(`${errorContext} element attributes are malformed.`);
    const qualifiedName = nameMatch[1].toLowerCase();
    index += nameMatch[1].length;
    while (index < end && /\s/.test(tag[index])) index += 1;
    if (tag[index] !== "=") throw new Error(`${errorContext} element attributes are malformed.`);
    index += 1;
    while (index < end && /\s/.test(tag[index])) index += 1;
    const quote = tag[index];
    if (quote !== '"' && quote !== "'") throw new Error(`${errorContext} element attributes are malformed.`);
    index += 1;
    const valueEnd = tag.indexOf(quote, index);
    if (valueEnd < 0 || valueEnd >= end) throw new Error(`${errorContext} element attributes are malformed.`);
    if (attributes.has(qualifiedName)) throw new Error(`${errorContext} duplicate attribute names are unsupported.`);
    attributes.set(qualifiedName, tag.slice(index, valueEnd));
    index = valueEnd + 1;
  }
  return attributes;
}

function normalizedHrefValue(raw, errorContext) {
  const predefinedEntities = new Map([
    ["amp", "&"],
    ["lt", "<"],
    ["gt", ">"],
    ["quot", '"'],
    ["apos", "'"],
  ]);
  let decoded = "";
  let index = 0;
  while (index < raw.length) {
    const entityStart = raw.indexOf("&", index);
    if (entityStart < 0) {
      decoded += raw.slice(index);
      break;
    }
    decoded += raw.slice(index, entityStart);
    const entityEnd = raw.indexOf(";", entityStart + 1);
    if (entityEnd < 0) throw new Error(`${errorContext} href entity reference is malformed.`);
    const entity = raw.slice(entityStart + 1, entityEnd);
    if (predefinedEntities.has(entity)) {
      decoded += predefinedEntities.get(entity);
    } else {
      const hexadecimal = entity.match(/^#x([0-9a-f]+)$/i)?.[1];
      const decimal = entity.match(/^#([0-9]+)$/)?.[1];
      if (hexadecimal === undefined && decimal === undefined) {
        throw new Error(`${errorContext} href entity reference is unsupported.`);
      }
      const codePoint = Number.parseInt(hexadecimal ?? decimal, hexadecimal === undefined ? 10 : 16);
      if (
        !Number.isFinite(codePoint)
        || codePoint === 0
        || codePoint > 0x10ffff
        || (codePoint >= 0xd800 && codePoint <= 0xdfff)
      ) {
        throw new Error(`${errorContext} href entity reference is malformed.`);
      }
      decoded += String.fromCodePoint(codePoint);
    }
    index = entityEnd + 1;
  }
  return decoded.trim().replace(/[\u0000-\u0020\u007f]+/g, "").toLowerCase();
}

function assertSafeSvgOpeningTag(qualifiedName, attributes, errorContext) {
  const localName = svgLocalName(qualifiedName);
  if (localName === "script") throw new Error(`${errorContext} script elements are unsupported.`);
  if (localName === "style") throw new Error(`${errorContext} style elements are unsupported.`);
  if (localName.startsWith("animate") || localName === "set") {
    throw new Error(`${errorContext} animation elements are unsupported.`);
  }
  if (localName === "discard") throw new Error(`${errorContext} active elements are unsupported.`);

  for (const [attributeName, attributeValue] of attributes) {
    const attributeLocalName = svgLocalName(attributeName);
    if (attributeLocalName.startsWith("on")) {
      throw new Error(`${errorContext} event handler attributes are unsupported.`);
    }
    if (attributeLocalName === "href") {
      const href = normalizedHrefValue(attributeValue, errorContext);
      if (/^(?:javascript|vbscript):/.test(href) || /^data:(?:text\/html|image\/svg\+xml)(?:[;,]|$)/.test(href)) {
        throw new Error(`${errorContext} active href values are unsupported.`);
      }
    }
  }
}

function svgCellElement(svg, cellId, elementName) {
  const elements = [];
  let sawCell = false;
  let foundElement;
  for (const match of svg.matchAll(SVG_ELEMENT_TOKENS)) {
    const tag = match[0];
    if (tag.startsWith("<!--")) continue;
    const name = tag.match(/^<\/?\s*([A-Za-z][A-Za-z0-9:_-]*)/)?.[1]?.toLowerCase();
    const closing = /^<\//.test(tag);
    if (closing) {
      const active = elements.pop();
      if (!active || active.name !== name) throw new Error(`${cellId} element stack is malformed.`);
      continue;
    }

    const attributes = svgTagAttributes(tag, cellId);
    assertSafeSvgOpeningTag(name, attributes, cellId);

    const element = { name, attributes, cellId: attributes.get("data-cell-id") };
    if (element.cellId === cellId) sawCell = true;
    if (name === elementName) {
      const nearestCell = [...elements].reverse().find(({ cellId: activeCellId }) => activeCellId !== undefined)?.cellId;
      if (nearestCell === cellId && foundElement === undefined) {
        foundElement = {
          attributes,
          ancestors: elements.map(({ name: ancestorName, attributes: ancestorAttributes }) => ({
            name: ancestorName,
            attributes: ancestorAttributes,
          })),
        };
      }
    }
    if (!/\/\s*>$/.test(tag)) elements.push(element);
  }
  if (elements.length) throw new Error(`${cellId} element stack is malformed.`);
  if (foundElement) return foundElement;
  if (!sawCell) throw new Error(`${cellId} group is missing.`);
  throw new Error(`${cellId} ${elementName} is missing.`);
}

function assertSupportedFaceAncestors(ancestors, cellId) {
  if (ancestors.length === 0 || ancestors[0].name !== "svg") {
    throw new Error(`${cellId} ancestor chain must begin with the root svg.`);
  }
  if (ancestors.slice(1).some(({ name }) => name !== "g")) {
    throw new Error(`${cellId} ancestor context is unsupported.`);
  }
}

function assertNoGlobalSvgBehavior(svg) {
  const activeSvg = svg.replace(/<!--[\s\S]*?-->/g, "");
  if (/<!\s*(?:DOCTYPE|ENTITY)\b/i.test(activeSvg)) {
    throw new Error("SVG DOCTYPE or ENTITY declarations are unsupported.");
  }
  if (/<\?xml-stylesheet\b/i.test(activeSvg)) {
    throw new Error("SVG stylesheet processing instructions are unsupported.");
  }
  for (const match of svg.matchAll(SVG_ELEMENT_TOKENS)) {
    const tag = match[0];
    if (tag.startsWith("<!--") || /^<\//.test(tag)) continue;
    const name = tag.match(/^<\s*([A-Za-z][A-Za-z0-9:_-]*)/)?.[1];
    if (name === undefined) throw new Error("SVG element name is malformed.");
    const attributes = svgTagAttributes(tag, "SVG");
    assertSafeSvgOpeningTag(name, attributes, "SVG");
  }
}

const SVG_NUMBER = "[-+]?(?:\\d+(?:\\.\\d*)?|\\.\\d+)(?:[eE][-+]?\\d+)?";

function pathPoints(pathData, cellId) {
  const separator = "[\\s,]+";
  const pattern = new RegExp(
    `^\\s*M\\s*(${SVG_NUMBER})${separator}(${SVG_NUMBER})\\s*L\\s*(${SVG_NUMBER})${separator}(${SVG_NUMBER})\\s*L\\s*(${SVG_NUMBER})${separator}(${SVG_NUMBER})\\s*L\\s*(${SVG_NUMBER})${separator}(${SVG_NUMBER})\\s*Z\\s*$`,
    "i",
  );
  const match = pathData.match(pattern);
  if (!match) throw new Error(`${cellId} path must contain four M/L points.`);
  const values = match.slice(1).map(Number);
  if (!values.every(Number.isFinite)) throw new Error(`${cellId} path contains an invalid coordinate.`);
  return Array.from({ length: 4 }, (_, index) => ({ x: values[index * 2], y: values[index * 2 + 1] }));
}

function svgStyle(attributes) {
  const declarations = new Map();
  const style = attributes.get("style");
  if (style === undefined) return declarations;
  for (const declaration of style.split(";")) {
    const separator = declaration.indexOf(":");
    if (separator < 0) continue;
    const property = declaration.slice(0, separator).trim().toLowerCase();
    const value = declaration.slice(separator + 1).trim().replace(/\s*!important\s*$/i, "");
    if (property) declarations.set(property, value);
  }
  return declarations;
}

function presentationValue(attributes, name) {
  const styled = svgStyle(attributes);
  return styled.has(name) ? styled.get(name) : attributes.get(name);
}

function opacityValue(raw, cellId, property) {
  if (raw === undefined) return undefined;
  const opacity = Number(raw);
  if (!Number.isFinite(opacity)) throw new Error(`${cellId} ${property} is invalid.`);
  return opacity;
}

function isOpaqueRgb(paint) {
  const match = paint.match(/^rgb\(\s*([^()]*)\s*\)$/i);
  if (!match || match[1].includes("/")) return false;
  const components = match[1].includes(",")
    ? match[1].split(",").map((component) => component.trim())
    : match[1].trim().split(/\s+/);
  if (components.length !== 3) return false;
  return components.every((component) => {
    if (/^[-+]?(?:\d+(?:\.\d*)?|\.\d+)%$/.test(component)) {
      const percentage = Number(component.slice(0, -1));
      return Number.isFinite(percentage) && percentage >= 0 && percentage <= 100;
    }
    if (!/^[-+]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(component)) return false;
    const channel = Number(component);
    return Number.isFinite(channel) && channel >= 0 && channel <= 255;
  });
}

function isOpaqueExporterPaint(raw) {
  const paint = raw.trim();
  if (/^#[0-9a-f]{3}$/i.test(paint) || /^#[0-9a-f]{6}$/i.test(paint)) return true;
  if (/^#[0-9a-f]{8}$/i.test(paint)) return paint.slice(-2).toLowerCase() === "ff";
  if (isOpaqueRgb(paint)) return true;
  const lightDark = paint.match(/^light-dark\(\s*(rgb\([^()]*\))\s*,\s*(rgb\([^()]*\))\s*\)$/i);
  return Boolean(lightDark && isOpaqueRgb(lightDark[1]) && isOpaqueRgb(lightDark[2]));
}

function assertVisiblePaint(elementAttributes, ancestors, cellId) {
  const chain = [...ancestors.map(({ attributes }) => attributes), elementAttributes];
  for (const attributes of chain) {
    const display = presentationValue(attributes, "display")?.trim().toLowerCase();
    if (display !== undefined && !["inline", "block", "inline-block", "contents"].includes(display)) {
      throw new Error(`${cellId} display must be visible.`);
    }
    const visibility = presentationValue(attributes, "visibility")?.trim().toLowerCase();
    if (visibility !== undefined && visibility !== "visible") {
      throw new Error(`${cellId} visibility must be visible.`);
    }
    for (const property of ["mask", "clip-path", "filter"]) {
      const effect = presentationValue(attributes, property)?.trim().toLowerCase();
      if (effect !== undefined && effect !== "none") throw new Error(`${cellId} ${property} is unsupported.`);
    }
  }
  for (const attributes of chain) {
    const opacity = opacityValue(presentationValue(attributes, "opacity"), cellId, "opacity");
    if (opacity !== undefined && opacity < 1) throw new Error(`${cellId} opacity must be 1.`);
  }

  const inheritedOpacity = (property) => {
    let value;
    for (const attributes of chain) {
      const declared = presentationValue(attributes, property);
      if (declared !== undefined) value = declared;
    }
    return opacityValue(value, cellId, property) ?? 1;
  };
  const fillOpacity = inheritedOpacity("fill-opacity");
  const strokeOpacity = inheritedOpacity("stroke-opacity");
  if (fillOpacity < 1) throw new Error(`${cellId} fill-opacity must be 1.`);
  if (strokeOpacity < 1) throw new Error(`${cellId} stroke-opacity must be 1.`);

  let strokeWidthRaw;
  for (const attributes of chain) {
    const declared = presentationValue(attributes, "stroke-width");
    if (declared !== undefined) strokeWidthRaw = declared;
  }
  const strokeWidth = strokeWidthRaw === undefined ? 1 : Number(strokeWidthRaw);
  if (!Number.isFinite(strokeWidth) || strokeWidth <= 0) throw new Error(`${cellId} stroke-width must be positive.`);

  let strokeDasharray;
  for (const attributes of chain) {
    const declared = presentationValue(attributes, "stroke-dasharray");
    if (declared !== undefined) strokeDasharray = declared;
  }
  if (strokeDasharray !== undefined && strokeDasharray.trim().toLowerCase() !== "none") {
    throw new Error(`${cellId} stroke-dasharray must be absent or none.`);
  }

  const inheritedPaint = (property) => {
    let value;
    for (const attributes of chain) {
      const declared = presentationValue(attributes, property);
      if (declared !== undefined) value = declared;
    }
    return value;
  };
  const fill = inheritedPaint("fill");
  const stroke = inheritedPaint("stroke");
  if (fill === undefined || !isOpaqueExporterPaint(fill)) throw new Error(`${cellId} fill must use an opaque exporter paint.`);
  if (stroke === undefined || !isOpaqueExporterPaint(stroke)) throw new Error(`${cellId} stroke must use an opaque exporter paint.`);
  return { fill, stroke, fillOpacity, strokeOpacity };
}

function ancestorTranslation(ancestors, cellId) {
  const separator = "(?:\\s*,\\s*|\\s+)";
  const translatePattern = new RegExp(`^\\s*translate\\(\\s*(${SVG_NUMBER})${separator}(${SVG_NUMBER})\\s*\\)\\s*$`, "i");
  let x = 0;
  let y = 0;
  for (const ancestor of ancestors) {
    if (svgStyle(ancestor.attributes).has("transform")) throw new Error(`${cellId} ancestor transform is unsupported.`);
    const transform = ancestor.attributes.get("transform");
    if (transform === undefined) continue;
    if (ancestor.name !== "g") throw new Error(`${cellId} ancestor transform is unsupported.`);
    const match = transform.match(translatePattern);
    if (!match) throw new Error(`${cellId} ancestor transform is unsupported.`);
    const dx = Number(match[1]);
    const dy = Number(match[2]);
    if (!Number.isFinite(dx) || !Number.isFinite(dy)) throw new Error(`${cellId} ancestor transform is invalid.`);
    x += dx;
    y += dy;
  }
  return { x, y };
}

const SVG_TRANSFORM_SEPARATOR = "(?:[ \\t\\r\\n]*,[ \\t\\r\\n]*|[ \\t\\r\\n]+)";

function transformArguments(raw, type, cellId) {
  const oneOrTwo = new RegExp(
    `^[ \\t\\r\\n]*(${SVG_NUMBER})(?:${SVG_TRANSFORM_SEPARATOR}(${SVG_NUMBER}))?[ \\t\\r\\n]*$`,
  );
  const oneOrThree = new RegExp(
    `^[ \\t\\r\\n]*(${SVG_NUMBER})(?:${SVG_TRANSFORM_SEPARATOR}(${SVG_NUMBER})${SVG_TRANSFORM_SEPARATOR}(${SVG_NUMBER}))?[ \\t\\r\\n]*$`,
  );
  const match = raw.match(type === "rotate" ? oneOrThree : oneOrTwo);
  if (!match) throw new Error(`${cellId} transform ${type} arguments are malformed.`);
  const values = match.slice(1).filter((value) => value !== undefined).map(Number);
  if (!values.every(Number.isFinite)) throw new Error(`${cellId} transform ${type} arguments must be finite.`);
  return values;
}

function strictTransformList(transform, cellId) {
  if (transform === undefined || !transform.trim()) throw new Error(`${cellId} rotation transform is missing.`);
  const operations = [];
  let remaining = transform.trim();
  while (remaining) {
    const match = remaining.match(/^([A-Za-z]+)[ \t\r\n]*\(([^()]*)\)/);
    if (!match) throw new Error(`${cellId} transform list contains unsupported or residual syntax.`);
    const type = match[1].toLowerCase();
    if (!["translate", "scale", "rotate"].includes(type)) {
      throw new Error(`${cellId} transform function '${type}' is unsupported.`);
    }
    const values = transformArguments(match[2], type, cellId);
    if (type === "translate") operations.push({ type, x: values[0], y: values[1] ?? 0 });
    if (type === "scale") operations.push({ type, x: values[0], y: values[1] ?? values[0] });
    if (type === "rotate") operations.push({ type, angle: values[0], cx: values[1] ?? 0, cy: values[2] ?? 0 });
    remaining = remaining.slice(match[0].length);
    const separator = remaining.match(/^[ \t\r\n]*(?:,[ \t\r\n]*)?/)[0];
    remaining = remaining.slice(separator.length);
    if (separator.includes(",") && !remaining) {
      throw new Error(`${cellId} transform list contains a trailing separator.`);
    }
  }
  return operations;
}

function rotatePoint(point, rotation) {
  const radians = rotation.angle * Math.PI / 180;
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);
  const x = point.x - rotation.cx;
  const y = point.y - rotation.cy;
  return {
    x: rotation.cx + x * cosine - y * sine,
    y: rotation.cy + x * sine + y * cosine,
  };
}

function transformPoint(point, operations) {
  let transformed = point;
  for (let index = operations.length - 1; index >= 0; index -= 1) {
    const operation = operations[index];
    if (operation.type === "translate") transformed = translatedPoint(transformed, operation);
    if (operation.type === "scale") transformed = { x: transformed.x * operation.x, y: transformed.y * operation.y };
    if (operation.type === "rotate") transformed = rotatePoint(transformed, operation);
  }
  return transformed;
}

function translatedPoint(point, translation) {
  return { x: point.x + translation.x, y: point.y + translation.y };
}

function inspectDepthFace(svg, cellId) {
  const { attributes: pathAttributes, ancestors } = svgCellElement(svg, cellId, "path");
  assertSupportedFaceAncestors(ancestors, cellId);
  const pathData = pathAttributes.get("d");
  if (pathData === undefined) throw new Error(`${cellId} path data is missing.`);
  if (svgStyle(pathAttributes).has("transform")) throw new Error(`${cellId} transform is unsupported.`);
  const transform = pathAttributes.get("transform");
  const isRight = cellId.endsWith("--right");
  if (!isRight && transform !== undefined) throw new Error(`${cellId} transform is unsupported.`);
  const transforms = isRight ? strictTransformList(transform, cellId) : [];
  const rotations = transforms.filter(({ type }) => type === "rotate");
  const rotation = rotations.length === 1 ? rotations[0] : undefined;
  const points = pathPoints(pathData, cellId);
  const translation = ancestorTranslation(ancestors, cellId);
  const renderedPoints = points.map((point) => translatedPoint(transformPoint(point, transforms), translation));
  const visibility = assertVisiblePaint(pathAttributes, ancestors, cellId);
  return {
    points,
    renderedPoints,
    rotation,
    transforms,
    translation,
    ...visibility,
  };
}

export function inspectDepthFaceSvg(svg, cellId) {
  const face = inspectDepthFace(svg, cellId);
  return {
    points: face.points,
    rotation: face.rotation?.angle,
    fill: face.fill,
    stroke: face.stroke,
    fillOpacity: face.fillOpacity,
    strokeOpacity: face.strokeOpacity,
  };
}

function numericAttribute(attributes, name, cellId) {
  const raw = attributes.get(name);
  const value = raw === undefined ? Number.NaN : Number(raw);
  if (!Number.isFinite(value)) throw new Error(`${cellId} ${name} is invalid.`);
  return value;
}

function inspectFrontRect(svg, cellId) {
  const { attributes: rectAttributes, ancestors } = svgCellElement(svg, cellId, "rect");
  assertSupportedFaceAncestors(ancestors, cellId);
  if (svgStyle(rectAttributes).has("transform") || rectAttributes.has("transform")) {
    throw new Error(`${cellId} transform is unsupported.`);
  }
  assertVisiblePaint(rectAttributes, ancestors, cellId);
  const translation = ancestorTranslation(ancestors, cellId);
  const x = numericAttribute(rectAttributes, "x", cellId) + translation.x;
  const y = numericAttribute(rectAttributes, "y", cellId) + translation.y;
  const width = numericAttribute(rectAttributes, "width", cellId);
  const height = numericAttribute(rectAttributes, "height", cellId);
  if (width <= 0 || height <= 0) throw new Error(`${cellId} geometry must have positive dimensions.`);
  return { x, y, width, height };
}

function assertNear(actual, expected, cellId, property) {
  const tolerance = 0.1;
  const floatingEpsilon = Number.EPSILON * Math.max(1, Math.abs(actual), Math.abs(expected)) * 4;
  if (!Number.isFinite(actual) || !Number.isFinite(expected) || Math.abs(actual - expected) > tolerance + floatingEpsilon) {
    throw new Error(`${cellId} ${property} must be ${expected}.`);
  }
}

function faceSkews(points) {
  return [Math.abs(points[1].x - points[0].x), Math.abs(points[2].x - points[3].x)];
}

function faceThickness(points) {
  const ys = points.map(({ y }) => y);
  return Math.max(...ys) - Math.min(...ys);
}

function assertConvexPolygon(points, cellId) {
  const crosses = points.map((point, index) => {
    const next = points[(index + 1) % points.length];
    const after = points[(index + 2) % points.length];
    return (next.x - point.x) * (after.y - next.y) - (next.y - point.y) * (after.x - next.x);
  });
  const positive = crosses.every((cross) => cross > 0.1);
  const negative = crosses.every((cross) => cross < -0.1);
  if (!positive && !negative) throw new Error(`${cellId} polygon ordering must be convex and non-intersecting.`);
}

function pointsNear(first, second) {
  const epsilon = Number.EPSILON * Math.max(1, Math.abs(first.x), Math.abs(first.y), Math.abs(second.x), Math.abs(second.y)) * 4;
  return Math.abs(first.x - second.x) <= 0.1 + epsilon && Math.abs(first.y - second.y) <= 0.1 + epsilon;
}

function assertPointSet(actual, expected, cellId) {
  const remaining = [...actual];
  for (const expectedPoint of expected) {
    const matchIndex = remaining.findIndex((actualPoint) => pointsNear(actualPoint, expectedPoint));
    if (matchIndex < 0) throw new Error(`${cellId} geometry does not match the front extrusion.`);
    remaining.splice(matchIndex, 1);
  }
  if (remaining.length) throw new Error(`${cellId} geometry contains unexpected vertices.`);
}

function assertOpaque(face, cellId) {
  if (face.fillOpacity < 1) throw new Error(`${cellId} fill opacity must be 1.`);
  if (face.strokeOpacity < 1) throw new Error(`${cellId} stroke opacity must be 1.`);
}

export function assertRenderedDepthGeometry(svg, coreModuleIds) {
  assertNoGlobalSvgBehavior(svg);
  for (const moduleId of coreModuleIds) {
    const front = inspectFrontRect(svg, `${moduleId}--front`);
    const topId = `${moduleId}--top`;
    const top = inspectDepthFace(svg, topId);
    assertOpaque(top, topId);
    for (const skew of faceSkews(top.points)) assertNear(skew, DEPTH_X, topId, "skew");
    assertNear(faceThickness(top.points), DEPTH_Y, topId, "depth");
    assertConvexPolygon(top.renderedPoints, topId);
    assertPointSet(top.renderedPoints, [
      { x: front.x, y: front.y },
      { x: front.x + DEPTH_X, y: front.y - DEPTH_Y },
      { x: front.x + front.width + DEPTH_X, y: front.y - DEPTH_Y },
      { x: front.x + front.width, y: front.y },
    ], topId);

    const rightId = `${moduleId}--right`;
    const right = inspectDepthFace(svg, rightId);
    assertOpaque(right, rightId);
    for (const skew of faceSkews(right.points)) assertNear(skew, DEPTH_Y, rightId, "skew");
    assertNear(faceThickness(right.points), DEPTH_X, rightId, "thickness");
    const legacyRotation = right.transforms.length === 1 && right.transforms[0].type === "rotate"
      ? right.transforms[0]
      : undefined;
    if (legacyRotation) assertNear(legacyRotation.angle, 90, rightId, "rotation");
    const nominalRightPoints = legacyRotation
      ? right.points.map((point) => translatedPoint(
        rotatePoint(point, { ...legacyRotation, angle: 90 }),
        right.translation,
      ))
      : right.renderedPoints;
    assertConvexPolygon(nominalRightPoints, rightId);
    assertPointSet(nominalRightPoints, [
      { x: front.x + front.width, y: front.y },
      { x: front.x + front.width + DEPTH_X, y: front.y - DEPTH_Y },
      { x: front.x + front.width + DEPTH_X, y: front.y + front.height - DEPTH_Y },
      { x: front.x + front.width, y: front.y + front.height },
    ], rightId);
  }
}

let svgTemporarySequence = 0;

function siblingTemporarySvg(finalPath, role) {
  svgTemporarySequence += 1;
  return `${finalPath}.${process.pid}.${Date.now()}.${svgTemporarySequence}.${role}.svg`;
}

function comparableFilePath(filePath) {
  const resolved = path.normalize(path.resolve(filePath));
  return process.platform === "win32" ? resolved.toLowerCase() : resolved;
}

async function existingFileIdentity(filePath) {
  try {
    const [canonicalPath, details] = await Promise.all([
      realpath(filePath),
      stat(filePath, { bigint: true }),
    ]);
    return {
      canonicalPath: comparableFilePath(canonicalPath),
      device: details.dev,
      inode: details.ino,
    };
  } catch (error) {
    if (error?.code === "ENOENT") return undefined;
    throw new Error("Unable to establish SVG file identity.");
  }
}

async function assertDistinctSvgFiles(rawPath, finalPath) {
  if (comparableFilePath(rawPath) === comparableFilePath(finalPath)) {
    throw new Error("SVG raw and final paths resolve to the same file identity.");
  }
  const [rawIdentity, finalIdentity] = await Promise.all([
    existingFileIdentity(rawPath),
    existingFileIdentity(finalPath),
  ]);
  if (!rawIdentity || !finalIdentity) return;
  const sameCanonicalPath = rawIdentity.canonicalPath === finalIdentity.canonicalPath;
  const sameFileId = rawIdentity.device === finalIdentity.device && rawIdentity.inode === finalIdentity.inode;
  if (sameCanonicalPath || sameFileId) {
    throw new Error("SVG raw and final paths resolve to the same file identity.");
  }
}

export async function finalizeSvgExport(rawPath, finalPath, coreModuleIds) {
  await assertDistinctSvgFiles(rawPath, finalPath);
  const stagedPath = siblingTemporarySvg(finalPath, "staged");
  try {
    const rawSvg = await readFile(rawPath, "utf8");
    const svg = sanitizeSvg(rawSvg);
    assertRenderedDepthGeometry(svg, coreModuleIds);
    const metadataFree = !/<metadata\b/i.test(svg) && !/data:image\//i.test(svg) && !/\bcontent\s*=\s*["'][^"']*mxfile/i.test(svg);
    if (!metadataFree) throw new Error("SVG contains embedded source metadata or raster content.");
    await writeFile(stagedPath, svg, { encoding: "utf8", flag: "wx" });
    await rename(stagedPath, finalPath);
    return {
      output_path: finalPath,
      bytes: Buffer.byteLength(svg, "utf8"),
      rawBytes: Buffer.byteLength(rawSvg, "utf8"),
      fallbackImagesRemoved: (rawSvg.match(/data:image\//gi) || []).length,
      metadataFree: true,
      embeddedRaster: false,
    };
  } finally {
    await Promise.all([
      rm(rawPath, { force: true }),
      rm(stagedPath, { force: true }),
    ]);
  }
}

class StdioMcpClient {
  constructor(serverPath, cwd) {
    this.child = spawn(process.execPath, [serverPath], { cwd, stdio: ["pipe", "pipe", "pipe"], windowsHide: true });
    this.nextId = 1;
    this.pending = new Map();
    this.stderr = "";
    this.child.stderr.setEncoding("utf8");
    this.child.stderr.on("data", (chunk) => { this.stderr += chunk; });
    const lines = createInterface({ input: this.child.stdout, crlfDelay: Infinity });
    lines.on("line", (line) => {
      const message = JSON.parse(line);
      const pending = this.pending.get(message.id);
      if (!pending) return;
      this.pending.delete(message.id);
      if (message.error) pending.reject(new Error(message.error.message));
      else pending.resolve(message.result);
    });
    this.child.on("exit", (code) => {
      for (const { reject } of this.pending.values()) reject(new Error(`MCP server exited with code ${code}: ${this.stderr.trim()}`));
      this.pending.clear();
    });
  }

  request(method, params = {}) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id, method, params })}\n`);
    });
  }

  notify(method, params = {}) {
    this.child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", method, params })}\n`);
  }

  async initialize() {
    await this.request("initialize", {
      protocolVersion: "2025-06-18",
      capabilities: {},
      clientInfo: { name: "drawio-academic-example-builder", version: "1.0.0" },
    });
    this.notify("notifications/initialized", {});
  }

  async callTool(name, args) {
    const result = await this.request("tools/call", { name, arguments: args });
    if (result.isError) {
      const detail = result.structuredContent?.error || result.content?.[0]?.text || `Tool '${name}' failed.`;
      throw new Error(detail);
    }
    return result.structuredContent ?? JSON.parse(result.content[0].text);
  }

  close() {
    this.child.stdin.end();
  }
}

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) throw new Error(`Unexpected argument '${token}'.`);
    const key = token.slice(2);
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) throw new Error(`Missing value for '--${key}'.`);
    args[key] = value;
    index += 1;
  }
  if (!args["plugin-root"]) throw new Error("Pass --plugin-root for the pinned drawio-scientific-illustrator plugin.");
  return args;
}

function pngDimensions(data) {
  if (data.length < 24 || data.toString("ascii", 1, 4) !== "PNG") throw new Error("Export is not a valid PNG header.");
  return { width: data.readUInt32BE(16), height: data.readUInt32BE(20) };
}

async function buildOne(client, repoRoot, slug) {
  const exampleDir = path.join(repoRoot, "examples", slug);
  const spec = JSON.parse(await readFile(path.join(exampleDir, "spec.json"), "utf8"));
  const payload = buildPayloadForSpec(spec);
  const diagramPath = path.join(exampleDir, "diagram.drawio");
  const pngPath = path.join(exampleDir, "preview.png");
  const svgPath = path.join(exampleDir, "preview.svg");
  const rawSvgPath = siblingTemporarySvg(svgPath, "raw");

  const created = await client.callTool("drawio_create_diagram", { output_path: diagramPath, ...payload, overwrite: true });
  const titlePatch = await client.callTool("drawio_update_cells", {
    input_path: diagramPath,
    patches: [{ id: "__figure_title__", style_updates: { html: 0, fontFamily: "Arial", fontSize: 20, fontColor: TEXT_PRIMARY } }],
  });
  const validation = await client.callTool("drawio_validate", { input_path: diagramPath });
  if (!validation.valid || validation.errors.length || validation.warnings.length) {
    throw new Error(`${slug} validation failed: ${JSON.stringify(validation)}`);
  }
  const pngExport = await client.callTool("drawio_export", { input_path: diagramPath, output_path: pngPath, format: "png", embed: false, width: 2400, border: 20, overwrite: true });
  let svgExport;
  let finalizedSvg;
  let pngSize;
  try {
    svgExport = await client.callTool("drawio_export", { input_path: diagramPath, output_path: rawSvgPath, format: "svg", embed: false, border: 20, overwrite: true });
    const drawioXml = await readFile(diagramPath, "utf8");
    if (!drawioXml.includes("<mxGraphModel") || /<diagram[^>]*>\s*[A-Za-z0-9+/=]{40,}\s*<\/diagram>/s.test(drawioXml)) throw new Error(`${slug} source is not uncompressed XML.`);
    if (/data:image\//i.test(drawioXml)) throw new Error(`${slug} source contains embedded raster data.`);
    pngSize = pngDimensions(await readFile(pngPath));
    if (pngSize.width < 2000) throw new Error(`${slug} preview width is only ${pngSize.width}px.`);
    finalizedSvg = await finalizeSvgExport(rawSvgPath, svgPath, LAYOUTS[slug].coreModules);
  } finally {
    await rm(rawSvgPath, { force: true });
  }

  return {
    slug,
    diagram: { ...created, titlePatch, uncompressed: true, embeddedRaster: false },
    validation,
    png: { ...pngExport, ...pngSize },
    svg: { ...svgExport, ...finalizedSvg, output_path: svgPath, exporterBytes: svgExport.bytes },
    moduleCount: spec.layers.flatMap((layer) => layer.modules).length,
    connectorCount: spec.edges.length,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const repoRoot = path.resolve(args["repo-root"] || path.join(path.dirname(fileURLToPath(import.meta.url)), ".."));
  const pluginRoot = path.resolve(args["plugin-root"]);
  const serverPath = path.join(pluginRoot, "scripts", "server.mjs");
  const slugs = args.only ? [args.only] : Object.keys(LAYOUTS);
  const client = new StdioMcpClient(serverPath, pluginRoot);
  try {
    await client.initialize();
    const status = await client.callTool("drawio_status", {});
    if (!status.available) throw new Error(status.error || "draw.io desktop CLI is unavailable.");
    const results = [];
    for (const slug of slugs) results.push(await buildOne(client, repoRoot, slug));
    process.stdout.write(`${JSON.stringify({ ok: true, transport: "stdio", server: "drawio-file-utils", status, results }, null, 2)}\n`);
  } finally {
    client.close();
  }
}

const invokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : "";
if (import.meta.url === invokedPath) {
  main().catch((error) => {
    process.stderr.write(`${JSON.stringify({ ok: false, error: error.message })}\n`);
    process.exitCode = 1;
  });
}
