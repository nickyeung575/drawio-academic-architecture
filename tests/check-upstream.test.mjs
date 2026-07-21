import assert from "node:assert/strict";
import { execFile, spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";

const fixtureServer = fileURLToPath(new URL("./fixtures/fake-mcp-server.mjs", import.meta.url));
const moduleUrl = new URL("../skill/drawio-academic-architecture/scripts/check-upstream.mjs", import.meta.url);
const execFileAsync = promisify(execFile);

const required = {
  "drawio-live": ["drawio_live_status", "drawio_live_inspect", "drawio_live_update_cell"],
  "drawio-file-utils": ["drawio_validate", "drawio_export"],
};

async function loadApi() {
  let loaded;
  try {
    loaded = await import(`${pathToFileURL(fileURLToPath(moduleUrl)).href}?t=${Date.now()}`);
  } catch {
    loaded = undefined;
  }
  assert.equal(typeof loaded?.checkUpstream, "function", "upstream preflight API must exist");
  return loaded;
}

async function writeFixturePlugin({ version = "1.0.0", tools = required, modes = {}, pidPaths = {}, nested = false } = {}) {
  const repositoryRoot = await mkdtemp(path.join(os.tmpdir(), "drawio-upstream-fixture-"));
  const root = nested
    ? path.join(repositoryRoot, "plugins", "drawio-scientific-illustrator")
    : repositoryRoot;
  const logPath = path.join(root, "methods.log");
  await mkdir(path.join(root, ".codex-plugin"), { recursive: true });
  await writeFile(path.join(root, ".codex-plugin", "plugin.json"), JSON.stringify({ name: "fixture", version }), "utf8");
  const mcpServers = Object.fromEntries(Object.entries(tools).map(([name, names]) => [name, {
    command: process.execPath,
    args: [fixtureServer, JSON.stringify(names), logPath, name, modes[name] || "normal", pidPaths[name] || ""],
    cwd: ".",
  }]));
  await writeFile(path.join(root, ".mcp.json"), JSON.stringify({ mcpServers }), "utf8");
  return { root, repositoryRoot, logPath };
}

async function makeGitRepo(root) {
  await execFileAsync("git", ["init"], { cwd: root });
  await execFileAsync("git", ["config", "user.name", "Fixture Author"], { cwd: root });
  const fixtureEmail = ["1+fixture", "users.noreply.github.com"].join("@");
  await execFileAsync("git", ["config", "user.email", fixtureEmail], { cwd: root });
  await execFileAsync("git", ["add", "."], { cwd: root });
  await execFileAsync("git", ["commit", "-m", "fixture"], { cwd: root });
  return (await execFileAsync("git", ["rev-parse", "HEAD"], { cwd: root })).stdout.trim();
}

async function runCli(args) {
  return await new Promise((resolve) => {
    const child = spawn(process.execPath, [fileURLToPath(moduleUrl), ...args], { windowsHide: true });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8").on("data", (chunk) => { stdout += chunk; });
    child.stderr.setEncoding("utf8").on("data", (chunk) => { stderr += chunk; });
    child.on("close", (code) => resolve({ code, stdout, stderr }));
  });
}

async function waitForProcessExit(pid, timeoutMs = 5000) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    try {
      process.kill(pid, 0);
    } catch (error) {
      if (error?.code === "ESRCH") return;
      throw error;
    }
    if (Date.now() >= deadline) throw new Error(`fixture process ${pid} did not terminate`);
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
}

test("discovers every required tool from both declared MCP servers", async () => {
  const api = await loadApi();
  const plugin = await writeFixturePlugin();
  const result = await api.checkUpstream({ pluginRoot: plugin.root, expectedVersion: "1.0.0" });
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.deepEqual(result.missingTools, []);
  const methods = (await readFile(plugin.logPath, "utf8")).trim().split(/\r?\n/);
  assert.deepEqual([...new Set(methods)].sort(), ["initialize", "tools/list"]);
});

test("reports every missing required tool at once", async () => {
  const api = await loadApi();
  const plugin = await writeFixturePlugin({
    tools: { "drawio-live": ["drawio_live_status"], "drawio-file-utils": [] },
  });
  const result = await api.checkUpstream({ pluginRoot: plugin.root });
  assert.equal(result.ok, false);
  assert.deepEqual(result.missingTools.sort(), [
    "drawio-file-utils:drawio_export",
    "drawio-file-utils:drawio_validate",
    "drawio-live:drawio_live_inspect",
    "drawio-live:drawio_live_update_cell",
  ]);
});

test("requires the exact plugin version", async () => {
  const api = await loadApi();
  const plugin = await writeFixturePlugin({ version: "1.0.1" });
  const result = await api.checkUpstream({ pluginRoot: plugin.root, expectedVersion: "1.0.0" });
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /expected plugin version 1\.0\.0/i);
});

test("strict revision requires the pinned commit using local safe.directory", async () => {
  const api = await loadApi();
  const plugin = await writeFixturePlugin();
  const revision = await makeGitRepo(plugin.root);
  const exact = await api.checkUpstream({
    pluginRoot: plugin.root,
    expectedRevision: revision,
    strictRevision: true,
  });
  assert.equal(exact.ok, true, JSON.stringify(exact));
  assert.equal(exact.revision, revision);

  const mismatch = await api.checkUpstream({
    pluginRoot: plugin.root,
    expectedRevision: "0".repeat(40),
    strictRevision: true,
  });
  assert.equal(mismatch.ok, false);
  assert.match(mismatch.errors.join("\n"), /revision mismatch/i);
});

test("strict revision fails when Git metadata is absent", async () => {
  const api = await loadApi();
  const plugin = await writeFixturePlugin();
  const result = await api.checkUpstream({
    pluginRoot: plugin.root,
    expectedRevision: "0".repeat(40),
    strictRevision: true,
  });
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /git metadata/i);
});

test("strict revision mismatch refuses to launch MCP servers", async () => {
  const api = await loadApi();
  const plugin = await writeFixturePlugin();
  await makeGitRepo(plugin.root);

  const result = await api.checkUpstream({
    pluginRoot: plugin.root,
    expectedRevision: "0".repeat(40),
    strictRevision: true,
  });

  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /revision mismatch/i);
  assert.equal(existsSync(plugin.logPath), false, "unverified MCP command must not run");
});

test("strict revision refuses a dirty checkout before launching MCP servers", async () => {
  const api = await loadApi();
  const plugin = await writeFixturePlugin();
  const revision = await makeGitRepo(plugin.root);
  const configPath = path.join(plugin.root, ".mcp.json");
  const config = JSON.parse(await readFile(configPath, "utf8"));
  config.tampered = true;
  await writeFile(configPath, JSON.stringify(config), "utf8");

  const result = await api.checkUpstream({
    pluginRoot: plugin.root,
    expectedRevision: revision,
    strictRevision: true,
  });

  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /working tree.*clean|dirty checkout/i);
  assert.equal(existsSync(plugin.logPath), false, "dirty MCP command must not run");
});

test("strict revision ignores unrelated changes outside the plugin root", async () => {
  const api = await loadApi();
  const plugin = await writeFixturePlugin({ nested: true });
  const revision = await makeGitRepo(plugin.repositoryRoot);
  await writeFile(path.join(plugin.repositoryRoot, "unrelated-local-note.txt"), "outside plugin\n", "utf8");

  const result = await api.checkUpstream({
    pluginRoot: plugin.root,
    expectedRevision: revision,
    strictRevision: true,
  });

  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(existsSync(plugin.logPath), true);
});

test("CLI emits compact JSON and exits zero or one", async () => {
  const plugin = await writeFixturePlugin();
  const pass = await runCli(["--plugin-root", plugin.root, "--expected-version", "1.0.0"]);
  assert.equal(pass.code, 0, pass.stderr || pass.stdout);
  assert.equal(JSON.parse(pass.stdout).ok, true);
  assert.equal(pass.stdout.trim().split(/\r?\n/).length, 1);

  const fail = await runCli(["--plugin-root", plugin.root, "--expected-version", "9.9.9"]);
  assert.equal(fail.code, 1, fail.stderr || fail.stdout);
  assert.equal(JSON.parse(fail.stdout).ok, false);
});

test("sanitizes timeout errors and terminates both MCP children", async () => {
  const api = await loadApi();
  const scratch = await mkdtemp(path.join(os.tmpdir(), "drawio-upstream-pids-"));
  const pidPaths = {
    "drawio-live": path.join(scratch, "live.pid"),
    "drawio-file-utils": path.join(scratch, "file.pid"),
  };
  const plugin = await writeFixturePlugin({
    modes: { "drawio-live": "hang", "drawio-file-utils": "hang" },
    pidPaths,
  });
  const result = await api.checkUpstream({ pluginRoot: plugin.root, timeoutMs: 2000 });
  assert.equal(result.ok, false);
  const output = JSON.stringify(result);
  assert.equal(output.includes(plugin.root), false);
  assert.equal(output.includes(scratch), false);

  for (const pidPath of Object.values(pidPaths)) {
    const pid = Number(await readFile(pidPath, "utf8"));
    await waitForProcessExit(pid);
  }
});
