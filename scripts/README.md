# Claude Code usage tracking

Aggregates local Claude Code session logs (`~/.claude/projects/**/*.jsonl`) into
`usage/<machine>.json`, which the "Live usage" section on the site reads client-side.
Each machine writes only its own file, so machines on different Claude accounts
don't need to share credentials — the site sums whatever files exist.

## One-time setup per machine

```bash
cd <path to this repo clone>
git checkout main   # GitHub Pages only builds main — the sync script refuses to run elsewhere
MACHINE=mac-laptop   # or mac-mini / dgx — pick one label, used consistently
./scripts/claude_usage_sync.sh "$MACHINE"   # generates usage/$MACHINE.json and pushes it once

sed "s#__REPO_DIR__#$(pwd)#" scripts/com.dndungu.claude-usage-sync.mac-laptop.plist.template \
  > /tmp/com.dndungu.claude-usage-sync.$MACHINE.plist
sed -i '' "s/mac-laptop/$MACHINE/g" /tmp/com.dndungu.claude-usage-sync.$MACHINE.plist
cp /tmp/com.dndungu.claude-usage-sync.$MACHINE.plist ~/Library/LaunchAgents/
launchctl load ~/Library/LaunchAgents/com.dndungu.claude-usage-sync.$MACHINE.plist
```

This runs the sync every 6 hours (`StartInterval`) and once immediately
(`RunAtLoad`). Logs land in `/tmp/claude-usage-sync.$MACHINE.log`. The plist
template is macOS/launchd; on Linux (e.g. the DGX) use cron or a systemd timer
calling `scripts/claude_usage_sync.sh "$MACHINE"` on the same schedule instead.

Whatever label you pick here must also be added to the `MACHINES` array in
`index.html`'s usage script, or the site will never fetch that machine's file.

## What it does NOT do

- No API keys, OAuth tokens, or account credentials ever leave the machine —
  only aggregated daily token counts and model names.
- Doesn't touch message content, file paths beyond `cwd` (which is dropped),
  or anything from `.claude/settings*`.

## Uninstall

```bash
launchctl unload ~/Library/LaunchAgents/com.dndungu.claude-usage-sync.$MACHINE.plist
rm ~/Library/LaunchAgents/com.dndungu.claude-usage-sync.$MACHINE.plist
```
