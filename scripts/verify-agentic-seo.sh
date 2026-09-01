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

check_json_ld() {
  local file="$1" label="$2"
  local json
  json=$(python3 - "$file" <<'PY'
import re, sys
html = open(sys.argv[1], encoding="utf-8").read()
m = re.search(r'<script type="application/ld\+json">(.*?)</script>', html, re.S)
print(m.group(1) if m else "")
PY
)
  if [ -z "$json" ]; then bad "$label: no JSON-LD block found"; return; fi
  if echo "$json" | python3 -c "import json,sys; json.load(sys.stdin)" >/dev/null 2>&1; then
    pass "$label: JSON-LD is valid JSON"
  else
    bad "$label: JSON-LD is not valid JSON"
  fi
}

echo "== Static file checks (local tree: $REPO_ROOT) =="

[ -f "$REPO_ROOT/404.html" ] && pass "404.html exists" || bad "404.html missing"
grep -q "sitemap.xml" "$REPO_ROOT/404.html" 2>/dev/null && pass "404.html links to sitemap.xml" || bad "404.html does not link to sitemap.xml"
grep -q "llms.txt" "$REPO_ROOT/404.html" 2>/dev/null && pass "404.html links to llms.txt" || bad "404.html does not link to llms.txt"

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

check_json_ld "$REPO_ROOT/index.html" "index.html"

[ -f "$REPO_ROOT/og-image.png" ] && pass "og-image.png exists" || bad "og-image.png missing"

for md in index.md about/index.md contact/index.md privacy/index.md; do
  [ -f "$REPO_ROOT/$md" ] && pass "$md exists" || bad "$md missing"
done

if [ "$LIVE" -eq 1 ]; then
  echo
  echo "== Live checks ($BASE_URL) =="
  code=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/this-path-should-not-exist-$$")
  [ "$code" = "404" ] && pass "nonexistent path returns HTTP 404 ($code)" || bad "nonexistent path returned HTTP $code, expected 404"

  for p in / /about/ /contact/ /privacy/ /sitemap.xml /llms.txt /robots.txt /og-image.png /index.md; do
    code=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL$p")
    [ "$code" = "200" ] && pass "$p returns 200" || bad "$p returned HTTP $code, expected 200"
  done
fi

echo
if [ "$fail" -eq 0 ]; then
  echo "All checks passed."
else
  echo "Some checks failed."
fi
exit "$fail"
