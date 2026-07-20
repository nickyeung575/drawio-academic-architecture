#!/usr/bin/env node

import { spawn } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
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
const DEPTH_X = 8;
const DEPTH_Y = 6;

const FAMILIES = {
  neutral: { fill: "#F3F5F6", line: "#88939B", icon: "#59656D" },
  slate: { fill: "#E9EEF2", line: "#6E7F8D", icon: "#425563" },
  teal: { fill: "#E3F1EF", line: "#5C918A", icon: "#276B64" },
  sage: { fill: "#EAF1E6", line: "#7F9A71", icon: "#55734B" },
  clay: { fill: "#F3E8E2", line: "#A97C68", icon: "#805442" },
  khaki: { fill: "#F3EEDA", line: "#A49558", icon: "#756A37" },
  plum: { fill: "#F0E7EE", line: "#92758B", icon: "#684E63" },
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
      "fusion-to-gate": { exit_x: 0.5, exit_y: 1, entry_x: 0.5, entry_y: 0 },
      "gate-to-head": { exit_x: 1, exit_y: 0.5, entry_x: 0, entry_y: 0.7, waypoints: [{ x: 1448, y: 711 }, { x: 1448, y: 447 }] },
      "head-to-monitor": { exit_x: 0.5, exit_y: 1, entry_x: 0.5, entry_y: 0 },
      "monitor-to-fusion": { exit_x: 0.5, exit_y: 1, entry_x: 0.5, entry_y: 1, waypoints: [{ x: 1668, y: 952 }, { x: 1168, y: 952 }] },
    },
  },
  "generic-safe-control-loop": {
    canvas: { width: 2640, height: 1180 },
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
      "constraints-to-filter": { exit_x: 0.5, exit_y: 0, entry_x: 0.5, entry_y: 1, waypoints: [{ x: 1544, y: 476 }, { x: 1754, y: 476 }] },
      "filter-to-actuator": { exit_x: 1, exit_y: 0.5, entry_x: 0, entry_y: 0.5 },
      "actuator-to-environment": { exit_x: 1, exit_y: 0.5, entry_x: 0, entry_y: 0.5, waypoints: [{ x: 2570, y: 842 }, { x: 40, y: 842 }, { x: 40, y: 321 }] },
      "environment-to-monitor": { exit_x: 0.5, exit_y: 1, entry_x: 0.5, entry_y: 1, waypoints: [{ x: 224, y: 780 }, { x: 2294, y: 780 }] },
      "actuator-to-monitor": { exit_x: 0.5, exit_y: 1, entry_x: 0.5, entry_y: 0 },
      "monitor-to-observer": { exit_x: 0.5, exit_y: 1, entry_x: 0.5, entry_y: 1, waypoints: [{ x: 2294, y: 930 }, { x: 924, y: 930 }] },
    },
  },
};

function textStyle({ size = 11, bold = false, color = TEXT_PRIMARY, align = "left", vertical = "middle" } = {}) {
  return `text;strokeColor=none;fillColor=none;whiteSpace=wrap;html=0;align=${align};verticalAlign=${vertical};fontFamily=Arial;fontSize=${size};fontStyle=${bold ? 1 : 0};fontColor=${color};spacing=0;overflow=hidden;`;
}

function flatStyle({ fill = "none", stroke = "none", width = 1, rounded = false, opacity = 100 } = {}) {
  return `rounded=${rounded ? 1 : 0};whiteSpace=wrap;html=0;fillColor=${fill};strokeColor=${stroke};strokeWidth=${width};opacity=${opacity};shadow=0;`;
}

function motifVertices(module, icon) {
  const parent = module.id;
  const base = `${module.id}--motif`;
  const vertices = [];
  const add = (suffix, shape, x, y, width, height, style, rotation) => {
    vertices.push({ id: `${base}-${suffix}`, shape, parent, x, y, width, height, style, ...(rotation === undefined ? {} : { rotation }) });
  };
  const line = (suffix, x, y, width, height = 2, rotation = 0) => add(suffix, "rectangle", x, y, width, height, flatStyle({ fill: icon }), rotation);
  const dot = (suffix, x, y, size = 7, fill = SURFACE) => add(suffix, "ellipse", x, y, size, size, flatStyle({ fill, stroke: icon, width: 1.5 }));
  const box = (suffix, x, y, width, height, fill = SURFACE, rounded = true) => add(suffix, rounded ? "rounded" : "rectangle", x, y, width, height, flatStyle({ fill, stroke: icon, width: 1.5, rounded }));
  const kind = module.motif;

  if (["waveform", "estimate-wave"].includes(kind)) {
    [12, 24, 36, 22, 10].forEach((height, index) => line(`bar-${index + 1}`, 20 + index * 8, 56 - height / 2, 3, height));
  } else if (["image-grid", "feature-grid"].includes(kind)) {
    [[20, 37], [40, 37], [20, 55], [40, 55]].forEach(([x, y], index) => box(`cell-${index + 1}`, x, y, 15, 13, index === 3 ? icon : SURFACE, false));
  } else if (["token-stack", "layer-stack", "stacked-blocks"].includes(kind)) {
    [[20, 38], [25, 48], [30, 58]].forEach(([x, y], index) => box(`layer-${index + 1}`, x, y, 34, 12, index === 2 ? icon : SURFACE, true));
  } else if (["converging-nodes", "policy-nodes"].includes(kind)) {
    dot("node-a", 20, 37, 8);
    dot("node-b", 20, 61, 8);
    dot("node-c", 54, 49, 9, icon);
    line("join-a", 28, 44, 30, 2, 18);
    line("join-b", 28, 62, 30, 2, -18);
  } else if (["boundary-shield", "shield-check", "guarded-diamond"].includes(kind)) {
    add("guard", "diamond", 22, 36, 38, 38, flatStyle({ fill: SURFACE, stroke: icon, width: 1.5 }));
    line("check-a", 31, 56, 12, 3, 40);
    line("check-b", 40, 51, 18, 3, -42);
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
    dot("pivot", 20, 56, 10, icon);
    line("arm-a", 29, 55, 28, 4, -28);
    line("arm-b", 51, 42, 15, 4, 28);
    dot("tip", 61, 46, 7, SURFACE);
  } else if (["trend-gauge", "gauge-check"].includes(kind)) {
    add("dial", "ellipse", 20, 36, 42, 34, flatStyle({ fill: SURFACE, stroke: icon, width: 1.5 }));
    line("needle", 39, 53, 20, 3, -35);
    dot("hub", 37, 51, 7, icon);
    line("tick", 25, 64, 31, 2);
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

function buildModule(module, x, y) {
  const family = FAMILIES[module.colorRole];
  if (!family) throw new Error(`Unknown color role '${module.colorRole}' for ${module.id}.`);
  const groupWidth = MODULE_WIDTH + DEPTH_X;
  const groupHeight = MODULE_HEIGHT + DEPTH_Y;
  const vertices = [
    { id: module.id, shape: "group", parent: "architecture-layer", x, y, width: groupWidth, height: groupHeight, custom_style: "connectable=1;" },
    { id: `${module.id}--top`, shape: "parallelogram", parent: module.id, x: 0, y: 0, width: groupWidth, height: DEPTH_Y, style: `shape=parallelogram;perimeter=parallelogramPerimeter;fillColor=${family.fill};strokeColor=${family.line};strokeWidth=1;opacity=55;shadow=0;` },
    { id: `${module.id}--right`, shape: "parallelogram", parent: module.id, x: MODULE_WIDTH, y: 0, width: DEPTH_X, height: groupHeight, style: `shape=parallelogram;perimeter=parallelogramPerimeter;direction=south;fillColor=${family.fill};strokeColor=${family.line};strokeWidth=1;opacity=78;shadow=0;` },
    { id: `${module.id}--front`, shape: "rounded", parent: module.id, x: 0, y: DEPTH_Y, width: MODULE_WIDTH, height: MODULE_HEIGHT, style: `rounded=1;arcSize=8;whiteSpace=wrap;html=0;fillColor=${family.fill};strokeColor=${family.line};strokeWidth=1.25;shadow=0;` },
    ...motifVertices(module, family.icon),
    { id: `${module.id}--label`, label: module.label, shape: "text", parent: module.id, x: 76, y: 20, width: 186, height: 22, style: textStyle({ size: 13, bold: true }) },
    { id: `${module.id}--subtitle`, label: module.subtitle, shape: "text", parent: module.id, x: 76, y: 45, width: 186, height: 18, style: textStyle({ size: 10, color: TEXT_SECONDARY }) },
    { id: `${module.id}--divider`, shape: "rectangle", parent: module.id, x: 20, y: 84, width: 240, height: 1, style: flatStyle({ fill: RULE_LIGHT }) },
  ];
  module.details.forEach((detail, index) => {
    const lineY = 96 + index * 22;
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
    vertices.push(...buildModule(module, ...position));
  }
  vertices.push(...legendVertices(layout.canvas.width, layout.canvas.height));
  const edges = spec.edges.map((edge) => buildSpecEdge(edge, layout.routes[edge.id] || {}));
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

export function sanitizeSvg(svg) {
  return svg
    .replace(/<metadata\b[^>]*>[\s\S]*?<\/metadata>/gi, "")
    .replace(/<image\b(?=[^>]*(?:xlink:href|href)\s*=\s*["']data:image\/)[^>]*\/?\s*>/gi, "")
    .replace(/<svg\b[^>]*>/i, (openingTag) => openingTag.replace(/\scontent\s*=\s*(?:"[^"]*"|'[^']*')/i, ""));
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
  const svgExport = await client.callTool("drawio_export", { input_path: diagramPath, output_path: svgPath, format: "svg", embed: false, border: 20, overwrite: true });

  const drawioXml = await readFile(diagramPath, "utf8");
  if (!drawioXml.includes("<mxGraphModel") || /<diagram[^>]*>\s*[A-Za-z0-9+/=]{40,}\s*<\/diagram>/s.test(drawioXml)) throw new Error(`${slug} source is not uncompressed XML.`);
  if (/data:image\//i.test(drawioXml)) throw new Error(`${slug} source contains embedded raster data.`);
  const pngSize = pngDimensions(await readFile(pngPath));
  if (pngSize.width < 2000) throw new Error(`${slug} preview width is only ${pngSize.width}px.`);
  const rawSvg = await readFile(svgPath, "utf8");
  const svg = sanitizeSvg(rawSvg);
  await writeFile(svgPath, svg, "utf8");
  const svgMetadataFree = !/<metadata\b/i.test(svg) && !/data:image\//i.test(svg) && !/\bcontent\s*=\s*["'][^"']*mxfile/i.test(svg);
  if (!svgMetadataFree) throw new Error(`${slug} SVG contains embedded source metadata or raster content.`);

  return {
    slug,
    diagram: { ...created, titlePatch, uncompressed: true, embeddedRaster: false },
    validation,
    png: { ...pngExport, ...pngSize },
    svg: { ...svgExport, exporterBytes: svgExport.bytes, bytes: Buffer.byteLength(svg, "utf8"), fallbackImagesRemoved: (rawSvg.match(/data:image\//gi) || []).length, metadataFree: true, embeddedRaster: false },
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
