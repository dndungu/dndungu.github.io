// Serves a markdown variant of key pages when the client asks for it via
// Accept: text/markdown (acceptmarkdown.com-style content negotiation),
// while leaving every other request untouched as a pass-through to the
// GitHub Pages origin. Also ensures HTML responses advertise `Vary: Accept`
// so CDN/browser caches don't collapse the HTML and markdown variants.

const MARKDOWN_MAP = {
  "/": "/index.md",
  "/index.html": "/index.md",
  "/about/": "/about/index.md",
  "/about/index.html": "/about/index.md",
  "/contact/": "/contact/index.md",
  "/contact/index.html": "/contact/index.md",
  "/privacy/": "/privacy/index.md",
  "/privacy/index.html": "/privacy/index.md",
};

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

    if (wantsMarkdown && mdPath) {
      const mdUrl = new URL(mdPath, url.origin);
      const mdResp = await fetch(mdUrl.toString(), request);
      if (mdResp.ok) {
        const headers = new Headers(mdResp.headers);
        headers.set("Content-Type", "text/markdown; charset=utf-8");
        headers.set("Vary", mergeVary(headers.get("Vary"), ["Accept"]));
        return new Response(mdResp.body, { status: mdResp.status, headers });
      }
      // No markdown variant for this path (or origin error) — fall through to HTML.
    }

    const resp = await fetch(request);
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
