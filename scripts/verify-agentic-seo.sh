#!/usr/bin/env bash
# Verifies the agent-readiness fixes tracked for ndungu.dev.
# Local mode (default): validates files in the working tree.
# Live mode: BASE_URL=https://ndungu.dev ./scripts/verify-agentic-seo.sh --live
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BASE_URL="${BASE_URL:-https://ndungu.dev}"
LIVE=0
[ "${1:-}" = "--live" ] && LIVE=1

fail=0
pass() { echo "PASS  $1"; }
bad()  { echo "FAIL  $1"; fail=1; }

fetch_headers() {
  local path="$1"
  local headers="$2"
  local body="$3"
  local extra_headers="${4:-}"
  if [ -n "$extra_headers" ]; then
    curl -s -o "$body" -D "$headers" -H "$extra_headers" "$BASE_URL$path"
  else
    curl -s -o "$body" -D "$headers" "$BASE_URL$path"
  fi
}

check_json_ld() {
  local file="$1" label="$2"
  local result
  if ! result=$(python3 - "$file" <<'PY'
import json
import re
import sys

html = open(sys.argv[1], encoding="utf-8").read()
m = re.search(r'<script type="application/ld\+json">(.*?)</script>', html, re.S)
if not m:
    print("NO_BLOCK")
    sys.exit(1)

data = json.loads(m.group(1))
items = []
if isinstance(data, dict):
    if "@graph" in data and isinstance(data["@graph"], list):
        items.extend(data["@graph"])
    else:
        items.append(data)
elif isinstance(data, list):
    items.extend(data)

has_person = any(isinstance(item, dict) and item.get("@type") == "Person" for item in items)
has_website = any(isinstance(item, dict) and item.get("@type") == "WebSite" for item in items)

if has_person and has_website:
    print("OK")
    sys.exit(0)
print("MISSING_REQUIRED_ENTITIES")
sys.exit(2)
PY
); then
  if [ "$result" = "NO_BLOCK" ]; then
    bad "$label: no JSON-LD block found"
  else
    bad "$label: JSON-LD does not include expected entities"
  fi
  return
fi
pass "$label: JSON-LD includes Person and WebSite entities"
}

assert_contains() {
  local file="$1" pattern="$2" message="$3"
  if grep -Fqi "$pattern" "$file"; then
    pass "$message"
  else
    bad "$message"
  fi
}

assert_in_json() {
  local file="$1" key="$2" message="$3"
  if python3 - "$file" "$key" <<'PY'
import json,sys
path=sys.argv[1]
needle=sys.argv[2]
text=open(path,encoding="utf-8").read()
try:
  data=json.loads(text)
except Exception:
  sys.exit(1)
flat=str(data)
sys.exit(0 if needle in flat else 1)
PY
  then
    pass "$message"
  else
    bad "$message"
  fi
}

echo "== Static file checks (local tree: $REPO_ROOT) =="

echo "== Local worker behavior checks =="
if node scripts/test-agentic-worker.mjs; then
  pass "Local Cloudflare worker behavior checks passed"
else
  bad "Local Cloudflare worker behavior checks failed"
fi

[ -f "$REPO_ROOT/404.html" ] && pass "404.html exists" || bad "404.html missing"
grep -q "sitemap.xml" "$REPO_ROOT/404.html" 2>/dev/null && pass "404.html links to sitemap.xml" || bad "404.html does not link to sitemap.xml"
grep -q "llms.txt" "$REPO_ROOT/404.html" 2>/dev/null && pass "404.html links to llms.txt" || bad "404.html does not link to llms.txt"
grep -q "404.md" "$REPO_ROOT/404.html" 2>/dev/null && pass "404.html links to 404 markdown recovery" || bad "404.html does not reference /404.md"

[ -f "$REPO_ROOT/sitemap.xml" ] && pass "sitemap.xml exists" || bad "sitemap.xml missing"
if command -v xmllint >/dev/null 2>&1; then
  xmllint --noout "$REPO_ROOT/sitemap.xml" 2>/dev/null && pass "sitemap.xml is well-formed XML" || bad "sitemap.xml is not well-formed XML"
else
  python3 -c "import xml.etree.ElementTree as ET; ET.parse('$REPO_ROOT/sitemap.xml')" 2>/dev/null \
    && pass "sitemap.xml is well-formed XML" || bad "sitemap.xml is not well-formed XML"
fi

[ -f "$REPO_ROOT/robots.txt" ] && grep -q "^Sitemap:" "$REPO_ROOT/robots.txt" && pass "robots.txt references a sitemap" || bad "robots.txt missing or has no Sitemap: line"

[ -f "$REPO_ROOT/llms.txt" ] && pass "llms.txt exists" || bad "llms.txt missing"
grep -qi "when to use" "$REPO_ROOT/llms.txt" 2>/dev/null && pass "llms.txt has a when-to-use section" || bad "llms.txt has no when-to-use section"
assert_contains "$REPO_ROOT/llms.txt" "When to use this site" "llms.txt has explicit when-to-use guidance section"
assert_contains "$REPO_ROOT/llms.txt" "Developer resources" "llms.txt includes a developer resources section"
assert_contains "$REPO_ROOT/llms.txt" "MCP endpoint" "llms.txt documents MCP endpoint"

[ -f "$REPO_ROOT/agent-instructions.md" ] && pass "agent-instructions.md exists" || bad "agent-instructions.md missing"
assert_contains "$REPO_ROOT/agent-instructions.md" "When to call this site" "agent-instructions.md has agent entrypoint guidance"
assert_contains "$REPO_ROOT/sitemap.xml" "agent-instructions.md" "sitemap.xml includes agent-instructions.md"

for f in index.html about/index.html contact/index.html privacy/index.html; do
  path="$REPO_ROOT/$f"
  [ -f "$path" ] || { bad "$f missing"; continue; }
  grep -q 'rel="canonical"' "$path" && pass "$f has canonical link" || bad "$f missing canonical link"
  grep -q 'og:image' "$path" && pass "$f has og:image" || bad "$f missing og:image"
  grep -q 'og:type' "$path" && pass "$f has og:type" || bad "$f missing og:type"
  grep -q '<html lang=' "$path" && pass "$f has html lang" || bad "$f missing html lang"
  chars=$(python3 -c "import re,sys; html=open('$path',encoding='utf-8').read(); text=re.sub(r'<[^>]+>',' ',html.split('<main')[1] if '<main' in html else html); print(len(re.sub(r'\s+',' ',text).strip()))")
  if [ "$f" != "index.html" ]; then
    if [ "$chars" -ge 500 ]; then pass "$f has >=500 chars of content ($chars)"; else bad "$f has only $chars chars of content"; fi
  fi
done

for f in api/index.html mcp/index.html sire/index.html; do
  path="$REPO_ROOT/$f"
  [ -f "$path" ] && pass "$f exists" || bad "$f missing"
  grep -q 'rel="canonical"' "$path" && pass "$f has canonical link" || bad "$f missing canonical link"
  grep -q 'og:image' "$path" && pass "$f has og:image" || bad "$f missing og:image"
  grep -q 'og:type' "$path" && pass "$f has og:type" || bad "$f missing og:type"
  grep -q '<html lang=' "$path" && pass "$f has html lang" || bad "$f missing html lang"
done

for f in api/index.md mcp/index.md sire/index.md .well-known/ai-catalog.json .well-known/mcp-server-card; do
  [ -f "$REPO_ROOT/$f" ] && pass "$f exists" || bad "$f missing"
done

for f in api/openapi.yaml; do
  [ -f "$REPO_ROOT/$f" ] && pass "$f exists" || bad "$f missing"
done

assert_contains "$REPO_ROOT/sitemap.xml" "/api/" "sitemap.xml includes API entry"
assert_contains "$REPO_ROOT/sitemap.xml" "/mcp" "sitemap.xml includes MCP entry"
assert_contains "$REPO_ROOT/sitemap.xml" "/sire/" "sitemap.xml includes Sire brand page"
assert_contains "$REPO_ROOT/robots.txt" "Sitemap:" "robots.txt includes sitemap reference"

assert_contains "$REPO_ROOT/404.md" "sitemap.xml" "404.md includes a sitemap pointer"
assert_contains "$REPO_ROOT/404.md" "llms.txt" "404.md points to llms.txt"
assert_contains "$REPO_ROOT/404.md" "Developer resources" "404.md points to developer resources"

for md in api/index.md mcp/index.md sire/index.md; do
  [ -f "$REPO_ROOT/$md" ] && pass "$md exists" || bad "$md missing"
done

check_json_ld "$REPO_ROOT/index.html" "index.html"

[ -f "$REPO_ROOT/og-image.png" ] && pass "og-image.png exists" || bad "og-image.png missing"

for md in index.md about/index.md contact/index.md privacy/index.md; do
  [ -f "$REPO_ROOT/$md" ] && pass "$md exists" || bad "$md missing"
done
assert_contains "$REPO_ROOT/.well-known/ai-catalog.json" "mcp/server-card" "AI catalog points to mcp/server-card"
assert_in_json "$REPO_ROOT/.well-known/ai-catalog.json" "urn:air:ndungu.dev:mcp:ndungu" "AI catalog includes ndungu MCP identifier"
assert_in_json "$REPO_ROOT/.well-known/mcp-server-card" "com.ndungu.dev.mcp" "Static MCP card contains MCP server name"
assert_in_json "$REPO_ROOT/.well-known/mcp-server-card" "2025-03-26" "MCP card exposes protocol version"

if [ "$LIVE" -eq 1 ]; then
  echo
  echo "== Live checks ($BASE_URL) =="
  missing_path="/this-path-should-not-exist-$$"
  miss_headers=$(mktemp)
  miss_body=$(mktemp)
  fetch_headers "$missing_path" "$miss_headers" "$miss_body"
  miss_code=$(awk 'NR==1 {print $2}' "$miss_headers")
  [ "$miss_code" = "404" ] && pass "nonexistent path returns HTTP 404 ($miss_code)" || bad "nonexistent path returned HTTP $miss_code, expected 404"

  fetch_headers "$missing_path" "$miss_headers" "$miss_body" "Accept: text/markdown"
  miss_md_code=$(awk 'NR==1 {print $2}' "$miss_headers")
  miss_md_ct=$(awk 'BEGIN{IGNORECASE=1} /^content-type:/ {sub(/^[Cc]ontent-[Tt]ype:[[:space:]]*/, "", $0); print $0; exit}' "$miss_headers" | tr -d '\\r')
  if [ "$miss_md_code" = "404" ]; then
    pass "Accept:text/markdown 404 path also returns HTTP $miss_md_code"
  else
    bad "Accept:text/markdown 404 path returned HTTP $miss_md_code, expected 404"
  fi
  if echo "$miss_md_ct" | grep -qi 'text/markdown'; then
    pass "Accept:text/markdown missing path returns markdown (content-type $miss_md_ct)"
  else
    bad "missing path with Accept:text/markdown did not return markdown (content-type $miss_md_ct)"
  fi
  if grep -qi "sitemap" "$miss_body"; then
    pass "markdown 404 body includes recovery path hints"
  else
    bad "markdown 404 body missing recovery hints"
  fi

  for p in / /about/ /contact/ /privacy/ /sitemap.xml /llms.txt /robots.txt /og-image.png /index.md /agent-instructions.md /404.md /api/ /mcp /mcp/server-card /sire/ /api/openapi.yaml /.well-known/ai-catalog.json /sire/index.md; do
    code=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL$p")
    [ "$code" = "200" ] && pass "$p returns 200" || bad "$p returned HTTP $code, expected 200"
  done
  code=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE_URL/mcp" -H 'Content-Type: application/json' -d '{"jsonrpc":"2.0","id":"verify","method":"initialize","params":{"protocolVersion":"2025-03-26"}}')
  [ "$code" = "200" ] && pass "/mcp accepts initialize POST" || bad "/mcp initialize returned HTTP $code"

  code=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE_URL/mcp" -H 'Content-Type: application/json' -d '{"jsonrpc":"2.0","id":"verify","method":"tools/list"}')
  [ "$code" = "200" ] && pass "/mcp tools/list returns 200" || bad "/mcp tools/list returned HTTP $code"

  code=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE_URL/mcp" -H 'Content-Type: application/json' -d '{"jsonrpc":"2.0","id":"verify","method":"tools/call","params":{"name":"get_site_navigation"}}')
  [ "$code" = "200" ] && pass "/mcp tools/call returns 200" || bad "/mcp tools/call returned HTTP $code"

  echo
  echo "== Accept: text/markdown negotiation (Cloudflare Worker) =="
  for p in / /about/ /contact/ /privacy/ /api/ /sire/; do
    md_headers=$(mktemp)
    md_body=$(mktemp)
    fetch_headers "$p" "$md_headers" "$md_body" "Accept: text/markdown"
    ct=$(awk 'BEGIN{IGNORECASE=1} /^content-type:/ {print $0}' "$md_headers" | tr -d '\r')
    vary=$(awk 'BEGIN{IGNORECASE=1} /^vary:/ {print $0}' "$md_headers" | tr -d '\r')
    echo "$ct" | grep -qi 'text/markdown' && pass "$p negotiates text/markdown" || bad "$p did not negotiate text/markdown ($ct)"
    echo "$vary" | grep -qi 'accept' && pass "$p Vary header includes Accept" || bad "$p Vary header missing Accept ($vary)"
    rm -f "$md_headers" "$md_body"
  done
  plain_ct=$(curl -s -D - -o /dev/null "$BASE_URL/" | awk 'BEGIN{IGNORECASE=1} /^content-type:/ {print $0}' | tr -d '\r')
  echo "$plain_ct" | grep -qi 'text/html' && pass "/ still serves text/html without Accept override" || bad "/ unexpectedly changed default content type ($plain_ct)"

  rm -f "$miss_headers" "$miss_body"
fi

echo
if [ "$fail" -eq 0 ]; then
  echo "All checks passed."
else
  echo "Some checks failed."
fi
exit "$fail"
