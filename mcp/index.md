# MCP for ndungu.dev

ndungu.dev provides a public MCP endpoint using streamable HTTP transport for safe agent integrations.

- MCP endpoint: `https://ndungu.dev/mcp`
- Transport: Streamable HTTP
- Protocol: `2025-03-26`

## Tools

The server currently exposes:

- `get_site_navigation` — canonical links for homepage, about, contact, privacy, audit, blog, and agent resources.
- `get_developer_resources` — API docs, MCP resources, and machine-readable index pointers.
- `get_contact_brief` — practical contact summary for outreach and booking.

## Discovery

- [MCP server card](https://ndungu.dev/mcp/server-card)
- [AI catalog](https://ndungu.dev/.well-known/ai-catalog.json)
- [OpenAPI](https://ndungu.dev/api/openapi.yaml)

## Compatibility notes

- Content negotiation via `Accept: text/markdown` still resolves static page mirrors and fallback 404s for robust crawling and agent recovery.
- Current scope is intentionally limited to public, non-sensitive site references.
