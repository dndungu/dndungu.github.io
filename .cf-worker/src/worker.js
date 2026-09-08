// Serves a markdown variant of key pages when the client asks for it via
// Accept: text/markdown (acceptmarkdown.com-style content negotiation),
// while leaving every other request untouched as a pass-through to the
// GitHub Pages origin. Also ensures HTML responses advertise `Vary: Accept`
// so CDN/browser caches don't collapse the HTML and markdown variants.

// Exposes a lightweight MCP endpoint at `/mcp` using the streamable-HTTP
// transport shape so clients can discover tools and call site-oriented
// helpers without touching the page UI.

const MCP_PROTOCOL_VERSION = "2025-03-26";
const MCP_SUPPORTED_VERSIONS = [MCP_PROTOCOL_VERSION, "2024-11-05"];

const MCP_TOOLS = [
  {
    name: "get_site_navigation",
    description:
      "Return the main navigation targets and trust pages for ndungu.dev.",
    inputSchema: {
      type: "object",
      properties: {
        locale: {
          type: "string",
          description: "Optional locale hint for wording, defaults to en-US",
          default: "en-US",
        },
      },
      required: [],
    },
  },
  {
    name: "get_developer_resources",
    description:
      "Return links to developer resources: API docs, openapi spec, and MCP details.",
    inputSchema: {
      type: "object",
      properties: {
        includeMarkdown: {
          type: "boolean",
          description: "If true, return markdown versions where available",
          default: true,
        },
      },
      required: [],
    },
  },
  {
    name: "get_contact_brief",
    description: "Get a short, practical contact block for booking and outreach.",
    inputSchema: {
      type: "object",
      properties: {
        includePhone: {
          type: "boolean",
          description: "Include phone contact details",
          default: true,
        },
      },
      required: [],
    },
  },
];

const MCP_SERVER_CARD = {
  "$schema": "https://static.modelcontextprotocol.io/schemas/v1/server-card.schema.json",
  schema_version: "1.0",
  version: "1.0.0",
  name: "com.ndungu.dev.mcp",
  title: "ndungu.dev MCP server",
  description:
    "Streamable HTTP MCP endpoint for ndungu.dev trust pages, contact details, and developer resources.",
  protocol: MCP_PROTOCOL_VERSION,
  websiteUrl: "https://ndungu.dev/",
  repository: "https://github.com/dndungu",
  remotes: [
    {
      type: "streamable-http",
      url: "https://ndungu.dev/mcp",
    },
  ],
};

const MARKDOWN_MAP = {
  "/": "/index.md",
  "/index.html": "/index.md",
  "/about/": "/about/index.md",
  "/about/index.html": "/about/index.md",
  "/contact/": "/contact/index.md",
  "/contact/index.html": "/contact/index.md",
  "/privacy/": "/privacy/index.md",
  "/privacy/index.html": "/privacy/index.md",
  "/agent-instructions.md": "/agent-instructions.md",
  "/404.md": "/404.md",
  "/api/": "/api/index.md",
  "/api/index.html": "/api/index.md",
  "/sire/": "/sire/index.md",
  "/sire/index.html": "/sire/index.md",
};

function jsonResponse(payload, status = 200, headers = {}) {
  const combined = new Headers(headers);
  combined.set("Content-Type", "application/json; charset=utf-8");
  combined.set("MCP-Protocol-Version", MCP_PROTOCOL_VERSION);
  combined.set("Access-Control-Allow-Origin", "*");
  return new Response(JSON.stringify(payload, null, 2), {
    status,
    headers: combined,
  });
}

function jsonRpcError(id, code, message) {
  return {
    jsonrpc: "2.0",
    id: id ?? null,
    error: {
      code,
      message,
    },
  };
}

function asText(v) {
  if (typeof v === "undefined") return "";
  if (typeof v === "string") return v;
  return JSON.stringify(v);
}

async function handleMcpEndpoint(request) {
  const method = request.method.toUpperCase();

  if (method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, MCP-Protocol-Version",
      },
    });
  }

  if (method === "GET") {
    // Streamable HTTP reserves GET for SSE behavior. For this lightweight
    // deployment, provide an explicit discovery-oriented response.
    return jsonResponse(
      {
        jsonrpc: "2.0",
        id: null,
        result: {
          status: "ready",
          message:
            "Streamable HTTP endpoint ready. Use POST with initialize/tool calls.",
          endpoint: "https://ndungu.dev/mcp",
        },
      },
      200,
      {
        "X-MCP-Endpoint": "streamable-http",
      },
    );
  }

  if (method !== "POST") {
    return jsonResponse(jsonRpcError(null, -32601, "Method not allowed"), 405);
  }

  let message;
  try {
    message = await request.json();
  } catch (err) {
    return jsonResponse(jsonRpcError(null, -32700, "Invalid JSON"), 400);
  }

  const { jsonrpc, id, method: rpcMethod, params } = message || {};
  if (jsonrpc !== "2.0" || typeof rpcMethod !== "string") {
    return jsonResponse(jsonRpcError(id, -32600, "Invalid JSON-RPC request"), 400);
  }

  if (rpcMethod === "initialize") {
    const requestedVersion = asText(params?.protocolVersion);
    const selectedVersion = MCP_SUPPORTED_VERSIONS.includes(requestedVersion)
      ? requestedVersion
      : MCP_PROTOCOL_VERSION;
    return jsonResponse({
      jsonrpc: "2.0",
      id,
      result: {
        protocolVersion: selectedVersion,
        capabilities: {
          tools: {},
        },
        serverInfo: {
          name: "ndungu.dev-mcp",
          version: "1.0.0",
        },
      },
    });
  }

  if (rpcMethod === "tools/list") {
    return jsonResponse({
      jsonrpc: "2.0",
      id,
      result: {
        tools: MCP_TOOLS,
      },
    });
  }

  if (rpcMethod === "tools/call") {
    const toolName = asText(params?.name);
    if (toolName === "get_site_navigation") {
      return jsonResponse({
        jsonrpc: "2.0",
        id,
        result: {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  homepage: "https://ndungu.dev/",
                  about: "https://ndungu.dev/about/",
                  contact: "https://ndungu.dev/contact/",
                  privacy: "https://ndungu.dev/privacy/",
                  blog: "https://ndungu.dev/blog/",
                  audit: "https://ndungu.dev/audit/",
                  apiDocs: "https://ndungu.dev/api/",
                  mcpEndpoint: "https://ndungu.dev/mcp",
                },
                null,
                2,
              ),
            },
          ],
        },
      });
    }

    if (toolName === "get_developer_resources") {
      return jsonResponse({
        jsonrpc: "2.0",
        id,
        result: {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  openApi: "https://ndungu.dev/api/openapi.yaml",
                  openApiDescription:
                    "Developer-focused API docs including page metadata and MCP resources.",
                  mcpEndpoint: "https://ndungu.dev/mcp",
                  mcpServerCard: "https://ndungu.dev/mcp/server-card",
                  agentInstructions: "https://ndungu.dev/agent-instructions.md",
                  sitemap: "https://ndungu.dev/sitemap.xml",
                  llms: "https://ndungu.dev/llms.txt",
                },
                null,
                2,
              ),
            },
          ],
        },
      });
    }

    if (toolName === "get_contact_brief") {
      return jsonResponse({
        jsonrpc: "2.0",
        id,
        result: {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  person: "David Ndungu",
                  email: "david@sire.run",
                  phone: "+1 (559) 414-8242",
                  booking: "https://cal.com/david-ndungu/automation-audit",
                },
                null,
                2,
              ),
            },
          ],
        },
      });
    }

    return jsonResponse(jsonRpcError(id, -32602, "Unknown tool"), 404);
  }

  return jsonResponse(jsonRpcError(id, -32601, "Method not found"), 404);
}

async function handleMcpServerCard() {
  return jsonResponse(MCP_SERVER_CARD, 200, {
    "Content-Type": "application/mcp-server-card+json; charset=utf-8",
  });
}

async function serveMarkdownResource(markdownUrl) {
  const mdResp = await fetch(markdownUrl);
  const headers = new Headers(mdResp.headers);
  headers.set("Content-Type", "text/markdown; charset=utf-8");
  headers.set("Vary", mergeVary(headers.get("Vary"), ["Accept"]));
  return new Response(mdResp.body, {
    status: mdResp.status,
    statusText: mdResp.statusText,
    headers,
  });
}

function mergeVary(existing, add) {
  const parts = (existing || "").split(",").map((s) => s.trim()).filter(Boolean);
  for (const token of add) {
    if (!parts.some((p) => p.toLowerCase() === token.toLowerCase())) parts.push(token);
  }
  return parts.join(", ");
}

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const accept = request.headers.get("Accept") || "";
    const wantsMarkdown = request.method === "GET" && accept.includes("text/markdown");
    const mdPath = MARKDOWN_MAP[url.pathname];

    if (url.pathname === "/mcp") {
      return handleMcpEndpoint(request);
    }

    if (url.pathname === "/mcp/server-card" || url.pathname === "/mcp/server-card/") {
      return handleMcpServerCard();
    }

    if (wantsMarkdown && mdPath) {
      const mdUrl = new URL(mdPath, url.origin).toString();
      return serveMarkdownResource(mdUrl);
    }

    const resp = await fetch(request);
    if (wantsMarkdown && resp.status === 404) {
      const fallbackUrl = new URL("/404.md", url.origin).toString();
      const fallback = await fetch(fallbackUrl);
      const fallbackHeaders = new Headers(fallback.headers);
      fallbackHeaders.set("Content-Type", "text/markdown; charset=utf-8");
      fallbackHeaders.set("Vary", mergeVary(fallbackHeaders.get("Vary"), ["Accept"]));
      return new Response(fallback.body, {
        status: 404,
        statusText: "Not Found",
        headers: fallbackHeaders,
      });
    }

    const headers = new Headers(resp.headers);
    const contentType = headers.get("Content-Type") || "";
    if (contentType.includes("text/html")) {
      headers.set("Vary", mergeVary(headers.get("Vary"), ["Accept", "Accept-Encoding"]));
    }
    return new Response(resp.body, {
      status: resp.status,
      statusText: resp.statusText,
      headers,
    });
  },
};
