# Claude Code production guardrails audit

One fixed week. Committed, tested guardrails in your repos, a findings report ranked by blast radius, and your team holding the reviewer role at the end. Remote. $6,000 fixed. Work directly with David Ndungu.

## Who it is for

Engineering teams of 3 to 60 developers who have rolled Claude Code out and hit one of these:

- An agent ran a destructive command against real data.
- A setting changed without anyone choosing it.
- CLAUDE.md files disagree across repos.
- Nobody owns the MCP servers.
- The security team blocked the rollout from reaching production.

## Why now

Fast code generation helps only if reviews, integration, and releases keep moving. I inspect your actual agent workflow, identify where it stalls or bypasses a control, and test the fixes we agree to make. Every week your team runs Claude Code without a hook-blocked destructive-command policy and a settings audit for silent changes is a week you're exposed to the incident that gets a rollout banned instead of shipped.

## What you get in one week

| Day | Work | Deliverable |
|---|---|---|
| 1 | Inventory: every repo's CLAUDE.md, settings files, hooks, MCP servers, permission modes, and who runs what | Findings report, ranked by blast radius |
| 2-3 | Guardrails: PreToolUse hooks that block destructive commands (database resets, forced deletes, history rewrites) outside isolated worktrees; permission-mode policy per repo; settings audit for remote access and telemetry. Each guardrail is installed and exercised as a governed lane: the change is proposed by an agent, held for a named reviewer, and applied only after approval, so the audit trail starts on day 2, not after handoff | Committed hooks and settings in your repos, with tests that prove each block fires, and a receipt per applied change |
| 4 | Consistency: one CLAUDE.md template with per-repo overrides; MCP server ownership and allowlist | Template plus a diff for every repo |
| 5 | Observability and handoff: audit logging of tool calls, cost controls, and a 60-minute session with the team. Your fleet's lanes are running under the same governance that installed the guardrails: nothing goes out that you haven't read, and idle costs nothing | Runbook, recording, and your team holding the reviewer role |

## How the governed lanes work

I run my own fleet on [Sire](https://sire.run), the runtime I build for exactly this: an agent proposes, a human reads and releases, a receipt records who approved what. Two things it promises your team from day 2: nothing goes out that you haven't read (a human reads each outbound action before it applies, until you release a class of actions), and idle costs nothing (no queued work means no spend).

You are not buying Sire. A subscription is not required to keep the guardrails, which live as plain hooks and settings in your repos. Staying on Sire after the week is your choice and a separate conversation.

## What it does not include

General Claude Code training, prompt writing, or building features. If the team needs those, they are separate engagements. See [the scoped engagement](https://ndungu.dev/#pricing).

## Price

$6,000 fixed, one week, remote. First three clients: $3,500, an introductory rate in exchange for a named case study, while this offer has no published track record yet.

## Guarantee

If day 1's findings report turns up none of the failure modes this audit exists to catch (unblocked destructive commands, settings enabled without a decision, inconsistent CLAUDE.md files, unowned MCP servers), you pay for day 1 only and the engagement stops there.

## Why me

I run a fleet of about a dozen parallel Claude Code sessions daily across a dozen repos. Every guardrail in this audit is one I run myself: hook-blocked destructive commands, destructive operations confined to isolated worktrees, permission modes per repo, MCP allowlists, and audit trails through a reconciliation controller I built for converging agent work against machine-checkable predicates. Go and iOS backgrounds; senior engineer. [More about David](https://ndungu.dev/about/).

## Next step

- [Book a discovery call](https://cal.com/david-ndungu/automation-audit)
- Phone: +1 (559) 414-8242
- Email: david@sire.run
