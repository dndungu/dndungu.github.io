# ndungu.dev Developer Resources

This site exposes a small, practical set of developer references for people integrating with David’s consulting and agent workflows.

## API references

- [OpenAPI specification](https://ndungu.dev/api/openapi.yaml)
- [Sitemap](https://ndungu.dev/sitemap.xml)
- [Machine-readable endpoints for agents](https://ndungu.dev/llms.txt)

## MCP endpoint

- [MCP endpoint](https://ndungu.dev/mcp)
- [MCP server card](https://ndungu.dev/mcp/server-card)
- [AI Catalog](https://ndungu.dev/.well-known/ai-catalog.json)

## Trust and contact

- [Agent instructions](https://ndungu.dev/agent-instructions.md)
- [Contact page](https://ndungu.dev/contact/)
- [Privacy policy](https://ndungu.dev/privacy/)

## Why these pages exist

The developer resources are intentionally small and low-risk: they expose only public pages, public API links, and tool hints that help an agent recover safely from a missing path or plan a structured integration.

For non-HTML consumption, request:
- `Accept: text/markdown` on `/`, `/about/`, `/contact/`, `/privacy/`, `/api/`, `/mcp/` and related pages.
- Use the MCP `tools/list` and `tools/call` methods for tool metadata.
