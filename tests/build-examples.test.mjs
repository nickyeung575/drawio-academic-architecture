import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const builderUrl = pathToFileURL(path.join(repoRoot, "scripts", "build-examples.mjs")).href;

async function loadSpec(slug) {
  const source = await readFile(path.join(repoRoot, "examples", slug, "spec.json"), "utf8");
  return JSON.parse(source);
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
      for (const face of ["front", "top", "right"]) {
        const vertex = first.vertices.find(({ id }) => id === `${module.id}--${face}`);
        assert.equal(vertex?.parent, module.id, `${module.id} ${face} face must stay grouped`);
      }
      assert.equal(first.vertices.find(({ id }) => id === `${module.id}--top`)?.height, 6);
      assert.equal(first.vertices.find(({ id }) => id === `${module.id}--right`)?.width, 8);

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
