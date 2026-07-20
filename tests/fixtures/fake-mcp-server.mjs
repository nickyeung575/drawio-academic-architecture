#!/usr/bin/env node

import { appendFile, writeFile } from "node:fs/promises";
import { createInterface } from "node:readline";

const tools = JSON.parse(process.argv[2] || "[]");
const logPath = process.argv[3];
const serverName = process.argv[4] || "fixture-mcp";
const mode = process.argv[5] || "normal";
const pidPath = process.argv[6];

if (pidPath) await writeFile(pidPath, String(process.pid), "utf8");

const rl = createInterface({ input: process.stdin, crlfDelay: Infinity });

rl.on("line", async (line) => {
  if (!line.trim()) return;
  const message = JSON.parse(line);
  if (logPath) await appendFile(logPath, `${message.method}\n`, "utf8");
  if (mode === "hang") return;

  let result;
  if (message.method === "initialize") {
    result = {
      protocolVersion: "2025-06-18",
      capabilities: { tools: { listChanged: false } },
      serverInfo: { name: serverName, version: "1.0.0" },
    };
  } else if (message.method === "tools/list") {
    result = { tools: tools.map((name) => ({ name, inputSchema: { type: "object" } })) };
  } else {
    process.stdout.write(`${JSON.stringify({ jsonrpc: "2.0", id: message.id, error: { code: -32601, message: "method not found" } })}\n`);
    return;
  }

  process.stdout.write(`${JSON.stringify({ jsonrpc: "2.0", id: message.id, result })}\n`);
});
