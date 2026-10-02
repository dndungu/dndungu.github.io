#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BASE_URL = process.env.BASE_URL || "https://ndungu.dev";
const worker = (await import(pathToFileURL(path.join(ROOT, ".cf-worker/src/worker.js")).href)).default;

let passed = 0;
let failed = 0;
const failures = [];

function extToMime(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case ".html":
      return "text/html; charset=utf-8";
    case ".md":
      return "text/markdown; charset=utf-8";
    case ".txt":
      return "text/plain; charset=utf-8";
    case ".xml":
      return "application/xml; charset=utf-8";
    case ".json":
      return "application/json; charset=utf-8";
    case ".css":
      return "text/css; charset=utf-8";
    case ".js":
      return "application/javascript; charset=utf-8";
    case ".svg":
      return "image/svg+xml";
    case ".png":
      return "image/png";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".yaml":
    case ".yml":
      return "application/yaml; charset=utf-8";
    default:
      return "application/octet-stream";
  }
}

async function readCandidate(relativePath) {
  const fullPath = path.join(ROOT, relativePath);
  try {
    const data = await fs.readFile(fullPath);
    return { path: relativePath, data };
  } catch (err) {
    return null;
  }
}

async function fetchFromOrigin(request) {
  const req = typeof request === "string" ? new Request(request) : request;
  const pathname = new URL(req.url).pathname;
  const cleaned = pathname.replace(/^\/+/, "");

  let candidates;
  if (cleaned === "") {
    candidates = ["index.html", "index.md"];
  } else if (cleaned.endsWith("/")) {
    candidates = [`${cleaned}index.html`, `${cleaned}index.md`];
  } else if (path.extname(cleaned)) {
    candidates = [cleaned];
  } else {
    candidates = [cleaned, `${cleaned}/index.html`, `${cleaned}/index.md`];
  }

  for (const candidate of candidates) {
    const found = await readCandidate(candidate);
    if (found) {
      const contentType = extToMime(found.path);
      return new Response(found.data, {
        status: 200,
        headers: {
          "Content-Type": contentType,
        },
      });
    }
  }

  return new Response("<!doctype html><title>not found</title>", {
    status: 404,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
    },
  });
}

globalThis.fetch = fetchFromOrigin;

async function run(name, fn) {
  try {
    await fn();
    console.log(`PASS  ${name}`);
    passed += 1;
  } catch (err) {
    console.error(`FAIL  ${name}: ${err?.message || err}`);
    failures.push({ name, error: String(err?.message || err) });
    failed += 1;
  }
}

async function parseText(res) {
  return res.text();
}

async function parseJson(res) {
  const raw = await res.text();
  try {
    return JSON.parse(raw);
  } catch (err) {
    throw new Error(`Invalid JSON response: ${raw}`);
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function containsNoCase(haystack, needle) {
  return (haystack || "").toLowerCase().includes((needle || "").toLowerCase());
}

const makeReq = (pathname, init = {}) => new Request(`${BASE_URL}${pathname}`, init);

await run("worker handles markdown 404 recoveries", async () => {
  const missing = `/__agentic-not-found-${Date.now()}`;
  const mdResp = await worker.fetch(makeReq(missing, { headers: { Accept: "text/markdown" } }));
  assert(mdResp.status === 404, `expected 404, got ${mdResp.status}`);
  const mdType = mdResp.headers.get("content-type") || "";
  assert(mdType.includes("text/markdown"), `expected text/markdown, got ${mdType}`);
  const body = await parseText(mdResp);
  assert(containsNoCase(body, "sitemap"), `markdown 404 body did not include sitemap guidance`);
});

await run("non-markdown missing paths remain 404", async () => {
  const missing = `/__agentic-not-found-${Date.now()}-html`;
  const resp = await worker.fetch(makeReq(missing));
  assert(resp.status === 404, `expected 404, got ${resp.status}`);
});

await run("/api/ returns markdown when requested", async () => {
  const resp = await worker.fetch(makeReq("/api/", { headers: { Accept: "text/markdown" } }));
  assert(resp.status === 200, `expected 200, got ${resp.status}`);
  const type = resp.headers.get("content-type") || "";
  assert(type.includes("text/markdown"), `expected text/markdown, got ${type}`);
  const vary = resp.headers.get("Vary") || "";
  assert(vary.toLowerCase().includes("accept"), `expected Vary include Accept, got ${vary}`);
});

await run("/sire/ returns markdown when requested", async () => {
  const resp = await worker.fetch(makeReq("/sire/", { headers: { Accept: "text/markdown" } }));
  assert(resp.status === 200, `expected 200, got ${resp.status}`);
  const type = resp.headers.get("content-type") || "";
  assert(type.includes("text/markdown"), `expected text/markdown, got ${type}`);
  const body = await parseText(resp);
  assert(containsNoCase(body, "Sire"), "missing Sire content in markdown page");
});

await run("HTML responses continue to advertise Vary: Accept and Accept-Encoding", async () => {
  const resp = await worker.fetch(makeReq("/"));
  assert(resp.status === 200, `expected 200, got ${resp.status}`);
  const type = resp.headers.get("content-type") || "";
  assert(type.includes("text/html"), `expected text/html, got ${type}`);
  const vary = resp.headers.get("Vary") || "";
  assert(vary.toLowerCase().includes("accept"), `expected Vary include Accept, got ${vary}`);
  assert(vary.toLowerCase().includes("accept-encoding"), `expected Vary include Accept-Encoding, got ${vary}`);
});

await run("MCP endpoint supports initialize", async () => {
  const body = JSON.stringify({
    jsonrpc: "2.0",
    id: "verify",
    method: "initialize",
    params: { protocolVersion: "2025-03-26" },
  });
  const resp = await worker.fetch(
    makeReq("/mcp", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
    }),
  );
  assert(resp.status === 200, `expected 200, got ${resp.status}`);
  const payload = await parseJson(resp);
  assert(payload.result?.protocolVersion === "2025-03-26", "initialize response missing protocolVersion");
  assert(payload.result?.serverInfo?.name === "ndungu.dev-mcp", "initialize response missing serverInfo.name");
});

await run("MCP endpoint exposes tools", async () => {
  const body = JSON.stringify({ jsonrpc: "2.0", id: "verify", method: "tools/list" });
  const resp = await worker.fetch(
    makeReq("/mcp", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
    }),
  );
  assert(resp.status === 200, `expected 200, got ${resp.status}`);
  const payload = await parseJson(resp);
  const toolNames = (payload.result?.tools || []).map((tool) => tool?.name).filter(Boolean);
  assert(toolNames.includes("get_developer_resources"), `tools/list missing expected developer tool`);
});

await run("MCP endpoint calls get_contact_brief", async () => {
  const body = JSON.stringify({
    jsonrpc: "2.0",
    id: "verify",
    method: "tools/call",
    params: {
      name: "get_contact_brief",
      arguments: { includePhone: true },
    },
  });
  const resp = await worker.fetch(
    makeReq("/mcp", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
    }),
  );
  assert(resp.status === 200, `expected 200, got ${resp.status}`);
  const payload = await parseJson(resp);
  const contentText = payload.result?.content?.[0]?.text || "";
  assert(containsNoCase(contentText, "david"), "missing contact person in tool output");
  assert(containsNoCase(contentText, "cal.com"), "missing booking link in tool output");
});

await run("MCP server card is discoverable", async () => {
  const resp = await worker.fetch(makeReq("/mcp/server-card"));
  assert(resp.status === 200, `expected 200, got ${resp.status}`);
  const payload = await parseJson(resp);
  assert(payload.name === "com.ndungu.dev.mcp", `unexpected MCP card name: ${payload.name}`);
  assert(payload.protocol === "2025-03-26", `unexpected MCP protocol version: ${payload.protocol}`);
});

console.log(`\nWorker tests complete: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  for (const item of failures) {
    console.error(`- ${item.name}: ${item.error}`);
  }
  process.exitCode = 1;
}
