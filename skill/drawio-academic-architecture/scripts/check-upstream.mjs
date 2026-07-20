#!/usr/bin/env node

import { execFile, spawn } from "node:child_process";
import { readFile, realpath, stat } from "node:fs/promises";
import path from "node:path";
import { createInterface } from "node:readline";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export const REQUIRED_TOOLS = Object.freeze({
  "drawio-live": Object.freeze(["drawio_live_status", "drawio_live_inspect", "drawio_live_update_cell"]),
  "drawio-file-utils": Object.freeze(["drawio_validate", "drawio_export"]),
});

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function findGitTopLevel(startPath) {
  let current = await realpath(startPath);
  for (;;) {
    try {
      await stat(path.join(current, ".git"));
      return current;
    } catch {
      const parent = path.dirname(current);
      if (parent === current) return null;
      current = parent;
    }
  }
}

async function readRevision(pluginRoot) {
  const topLevel = await findGitTopLevel(pluginRoot);
  if (!topLevel) return null;
  const safePath = topLevel.replaceAll("\\", "/");
  const { stdout } = await execFileAsync("git", [
    "-c", `safe.directory=${safePath}`,
    "-C", topLevel,
    "rev-parse", "HEAD",
  ], { windowsHide: true });
  return stdout.trim();
}

function request(child, pending, id, method, params = {}) {
  const promise = new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
  child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id, method, params })}\n`);
  return promise;
}

async function listServerTools(serverName, declaration, pluginRoot, timeoutMs) {
  const cwd = path.resolve(pluginRoot, declaration.cwd || ".");
  const child = spawn(declaration.command, declaration.args || [], {
    cwd,
    env: { ...process.env, ...(declaration.env || {}) },
    stdio: ["pipe", "pipe", "pipe"],
    windowsHide: true,
  });
  const pending = new Map();
  const stderr = [];
  child.stderr.setEncoding("utf8");
  child.stderr.on("data", (chunk) => stderr.push(chunk));
  const rl = createInterface({ input: child.stdout, crlfDelay: Infinity });
  rl.on("line", (line) => {
    let message;
    try { message = JSON.parse(line); } catch { return; }
    const waiter = pending.get(message.id);
    if (!waiter) return;
    pending.delete(message.id);
    if (message.error) waiter.reject(new Error(message.error.message || "MCP error"));
    else waiter.resolve(message.result);
  });

  const timer = setTimeout(() => {
    for (const waiter of pending.values()) waiter.reject(new Error(`MCP timeout: ${serverName}`));
    pending.clear();
    child.kill();
  }, timeoutMs);

  try {
    await request(child, pending, 1, "initialize", {
      protocolVersion: "2025-06-18",
      capabilities: {},
      clientInfo: { name: "drawio-academic-architecture-preflight", version: "1.0.0" },
    });
    const listed = await request(child, pending, 2, "tools/list");
    return (listed?.tools || []).map((tool) => tool.name).filter(Boolean);
  } catch (error) {
    const detail = stderr.join("").trim();
    throw new Error(`${serverName} discovery failed${detail ? ": child process error" : ""}`, { cause: error });
  } finally {
    clearTimeout(timer);
    rl.close();
    child.kill();
  }
}

export async function checkUpstream({
  pluginRoot,
  expectedVersion = "1.0.0",
  expectedRevision,
  strictRevision = false,
  timeoutMs = 5000,
} = {}) {
  if (!pluginRoot) throw new Error("pluginRoot is required");
  const root = path.resolve(pluginRoot);
  const manifest = await readJson(path.join(root, ".codex-plugin", "plugin.json"));
  const mcpConfig = await readJson(path.join(root, ".mcp.json"));
  const errors = [];
  if (manifest.version !== expectedVersion) errors.push(`expected plugin version ${expectedVersion}`);

  let revision;
  if (strictRevision) {
    if (!expectedRevision) {
      errors.push("strict revision requires an expected revision");
    } else {
      try {
        revision = await readRevision(root);
        if (!revision) errors.push("Git metadata is required for strict revision verification");
        else if (revision !== expectedRevision) errors.push("upstream revision mismatch");
      } catch {
        errors.push("unable to verify upstream Git metadata");
      }
    }
  }

  const discovered = {};
  for (const serverName of Object.keys(REQUIRED_TOOLS)) {
    const declaration = mcpConfig?.mcpServers?.[serverName];
    if (!declaration) {
      errors.push(`missing MCP declaration: ${serverName}`);
      discovered[serverName] = [];
      continue;
    }
    try {
      discovered[serverName] = await listServerTools(serverName, declaration, root, timeoutMs);
    } catch (error) {
      errors.push(error.message);
      discovered[serverName] = [];
    }
  }

  const missingTools = Object.entries(REQUIRED_TOOLS).flatMap(([serverName, names]) =>
    names.filter((name) => !discovered[serverName]?.includes(name)).map((name) => `${serverName}:${name}`));
  if (missingTools.length) errors.push(`missing required tools: ${missingTools.join(", ")}`);

  return {
    ok: errors.length === 0,
    version: manifest.version,
    ...(revision ? { revision } : {}),
    servers: discovered,
    missingTools,
    errors,
  };
}

function parseArgs(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--strict-revision") options.strictRevision = true;
    else if (arg === "--plugin-root") options.pluginRoot = argv[++index];
    else if (arg === "--expected-version") options.expectedVersion = argv[++index];
    else if (arg === "--expected-revision") options.expectedRevision = argv[++index];
    else if (arg === "--timeout-ms") options.timeoutMs = Number(argv[++index]);
    else throw new Error(`unknown argument: ${arg}`);
  }
  options.pluginRoot ||= process.env.DRAWIO_SCIENTIFIC_PLUGIN_ROOT;
  return options;
}

async function runCli() {
  let result;
  try {
    result = await checkUpstream(parseArgs(process.argv.slice(2)));
  } catch {
    result = { ok: false, missingTools: [], errors: ["upstream preflight failed"] };
  }
  process.stdout.write(`${JSON.stringify(result)}\n`);
  process.exitCode = result.ok ? 0 : 1;
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  await runCli();
}
