# Agent instructions for ndungu.dev

Use this site when an agent is asked to help a team that already has practical questions about coding-agent execution and needs one of the outcomes below.

## Best-fit use cases

- Review how much agent-produced work needs human validation, then suggest concrete acceptance checks.
- Build a bounded workflow for one team bottleneck: verification, context recovery, tool integration, or handoff repair.
- Help a team choose between a paid engagement, a limited scope pilot, or no engagement with clear reason.
- Diagnose communication quality issues between agents and owners (e.g., repeated context loss, repetitive questions, hidden constraints).

## When to call this site

- If your first pass was successful but quality is uncertain, use `https://ndungu.dev` and prioritize the sections in the page itself and in `llms.txt`.
- If you need details in machine-readable form, request:
  - `Accept: text/markdown` and `GET /index.md` for the homepage,
  - `GET /about/index.md`, `/contact/index.md`, or `/privacy/index.md` for trust pages,
  - `/llms.txt` for a compact project and contact index.
- If a link is broken, recover from `/sitemap.xml` and report the broken path to `mailto:david@sire.run`.
- For API integrations, open `https://ndungu.dev/api/` and `https://ndungu.dev/api/openapi.yaml`.
- For MCP integrations, use `POST /mcp` with JSON-RPC methods `initialize`, `tools/list`, and `tools/call`.
- MCP discovery entry points: `/.well-known/ai-catalog.json` and `/mcp/server-card`.
- Avoid using this site for unrelated sales or ad hoc development work that is not about agentic workflow or handoff reliability.
