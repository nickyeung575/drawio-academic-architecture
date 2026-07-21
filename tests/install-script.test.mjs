import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdtemp, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

const installer = fileURLToPath(new URL("../scripts/install.ps1", import.meta.url));

async function fixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), "drawio-skill-install-"));
  const source = path.join(root, "source", "drawio-academic-architecture");
  const destinationRoot = path.join(root, "codex-skills");
  await mkdir(path.join(source, "references"), { recursive: true });
  await writeFile(path.join(source, "SKILL.md"), "---\nname: drawio-academic-architecture\n---\n", "utf8");
  await writeFile(path.join(source, "references", "style.md"), "restrained\n", "utf8");
  await writeFile(path.join(root, "source", "do-not-copy.txt"), "outside skill\n", "utf8");
  return { root, source, destinationRoot, destination: path.join(destinationRoot, "drawio-academic-architecture") };
}

async function runInstaller(args) {
  return await new Promise((resolve) => {
    const child = spawn("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", installer, ...args], { windowsHide: true });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8").on("data", (chunk) => { stdout += chunk; });
    child.stderr.setEncoding("utf8").on("data", (chunk) => { stderr += chunk; });
    child.on("close", (code) => resolve({ code, stdout, stderr }));
  });
}

async function hashTree(root, current = root) {
  const entries = await readdir(current, { withFileTypes: true });
  const rows = [];
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const fullPath = path.join(current, entry.name);
    if (entry.isDirectory()) rows.push(...await hashTree(root, fullPath));
    else {
      const relativePath = path.relative(root, fullPath).replaceAll("\\", "/");
      const digest = createHash("sha256").update(await readFile(fullPath)).digest("hex");
      rows.push(`${relativePath}:${digest}`);
    }
  }
  return rows.sort();
}

test("copies only the named Skill tree", async () => {
  assert.equal(existsSync(installer), true, "installer must exist");
  const item = await fixture();
  const result = await runInstaller(["-SourceRoot", item.source, "-DestinationRoot", item.destinationRoot]);
  assert.equal(result.code, 0, result.stderr || result.stdout);
  assert.equal(await readFile(path.join(item.destination, "SKILL.md"), "utf8"), "---\nname: drawio-academic-architecture\n---\n");
  assert.equal(existsSync(path.join(item.destinationRoot, "do-not-copy.txt")), false);
  assert.deepEqual(await hashTree(item.destination), await hashTree(item.source));
});

test("resolves the repository Skill when SourceRoot is omitted", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "drawio-skill-default-source-"));
  const destinationRoot = path.join(root, "codex-skills");
  const result = await runInstaller(["-DestinationRoot", destinationRoot]);
  assert.equal(result.code, 0, result.stderr || result.stdout);
  assert.equal(existsSync(path.join(destinationRoot, "drawio-academic-architecture", "SKILL.md")), true);
});

test("refuses a non-matching existing destination without Force", async () => {
  const item = await fixture();
  await mkdir(item.destination, { recursive: true });
  const sentinel = path.join(item.destination, "private-local-file.txt");
  await writeFile(sentinel, "keep\n", "utf8");
  const result = await runInstaller(["-SourceRoot", item.source, "-DestinationRoot", item.destinationRoot]);
  assert.notEqual(result.code, 0);
  assert.equal(await readFile(sentinel, "utf8"), "keep\n");
});

test("Force replaces a non-matching destination with an identical Skill tree", async () => {
  const item = await fixture();
  await mkdir(item.destination, { recursive: true });
  const sentinel = path.join(item.destination, "obsolete.txt");
  await writeFile(sentinel, "remove\n", "utf8");
  const result = await runInstaller(["-SourceRoot", item.source, "-DestinationRoot", item.destinationRoot, "-Force"]);
  assert.equal(result.code, 0, result.stderr || result.stdout);
  assert.equal(existsSync(sentinel), false);
  assert.deepEqual(await hashTree(item.destination), await hashTree(item.source));
});
