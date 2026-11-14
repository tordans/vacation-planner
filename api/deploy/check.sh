#!/usr/bin/env bash
# Post-deploy check of https://urlaub.ingsparks.de (also runnable by hand):
#   api/deploy/check.sh https://urlaub.ingsparks.de [expected-commit]
# Verifies what api/deploy/htaccess promises (routing, 404 for missing assets, SPA fallback, CSP,
# auth on the plan API) and that /api/health reports the commit that was just deployed.
# Exit code 1 if anything is off.
set -uo pipefail

base="${1:?usage: check.sh <base-url> [expected-commit]}"
base="${base%/}"
expected="${2:-}"
failures=0
warnings=0

pass() { printf 'ok    %s\n' "$1"; }
fail() { printf 'FAIL  %s\n' "$1"; failures=$((failures + 1)); }
warn() { printf 'warn  %s\n' "$1"; warnings=$((warnings + 1)); }

# fetch <path> [curl args...] -> sets $status, $headers (lowercased), $body
fetch() {
  local path="$1"
  shift
  local out
  out="$(curl -sS --max-time 30 -D - -w '\n__STATUS__%{http_code}' "$@" "$base$path")" || { status=000; headers=''; body=''; return; }
  status="${out##*__STATUS__}"
  out="${out%$'\n'__STATUS__*}"
  headers="$(printf '%s' "$out" | sed -n '1,/^\r\{0,1\}$/p' | tr 'A-Z' 'a-z')"
  body="${out#*$'\r\n\r\n'}"
}

expect_status() { # path expected [label]
  fetch "$1"
  if [ "$status" = "$2" ]; then pass "${3:-$1} -> $2"; else fail "${3:-$1} -> $status (expected $2)"; fi
}

# 1. the app shell
fetch /
if [ "$status" = 200 ] && printf '%s' "$headers" | grep -q 'content-type: text/html'; then pass "/ is the HTML shell"; else fail "/ -> $status"; fi
if printf '%s' "$headers" | grep -q 'cache-control:.*no-cache'; then pass "/ is no-cache"; else warn "/ has no no-cache header (mod_headers missing?)"; fi
if printf '%s' "$headers" | grep -q "content-security-policy:.*default-src 'self'"; then pass "/ sends a Content-Security-Policy"; else fail "/ has no Content-Security-Policy header (mod_headers missing?)"; fi
if printf '%s' "$headers" | grep -q 'www.mehr-schulferien.de'; then pass "CSP allows the holiday API"; else fail "CSP does not allow https://www.mehr-schulferien.de"; fi
asset="$(printf '%s' "$body" | grep -o '/assets/[^"]*\.js' | head -1 || true)"

# 2. hashed assets: served, immutable; missing ones are a real 404
if [ -n "$asset" ]; then
  fetch "$asset"
  if [ "$status" = 200 ]; then pass "$asset -> 200"; else fail "$asset -> $status"; fi
  if printf '%s' "$headers" | grep -q 'cache-control:.*immutable'; then pass "assets are immutable"; else warn "assets are not immutable (mod_headers missing?)"; fi
else
  fail "no /assets/*.js reference found in /"
fi
expect_status /assets/does-not-exist.js 404

# 3. SPA fallback for deep links
expect_status /urlaub/2027 200 '/urlaub/2027 (deep link)'
expect_status '/?year=2027' 200 '/?year=2027'

# 4. API: health shows the deployed commit (retried while the new code settles)
for attempt in 1 2 3 4 5; do
  fetch /api/health
  commit="$(printf '%s' "$body" | sed -n 's/.*"commit" *: *"\([^"]*\)".*/\1/p')"
  if [ "$status" = 200 ] && { [ -z "$expected" ] || [ "$commit" = "$expected" ]; }; then break; fi
  sleep 5
done
if [ "$status" != 200 ]; then
  fail "/api/health -> $status"
elif [ -n "$expected" ] && [ "$commit" != "$expected" ]; then
  fail "/api/health reports commit '${commit:-none}', expected '$expected'"
else
  pass "/api/health -> 200, commit ${commit:-?}"
fi

# The plan needs a key: GET and PUT without one are 401, and so is a made-up key.
expect_status /api/plan 401 '/api/plan without key'
fetch /api/plan -X PUT -H 'Content-Type: application/json' --data '{"data":{}}'
if [ "$status" = 401 ]; then pass "PUT /api/plan without key -> 401"; else fail "PUT /api/plan without key -> $status (expected 401)"; fi
fetch /api/plan -H 'Authorization: Bearer check-with-a-wrong-key'
if [ "$status" = 401 ]; then pass "/api/plan with a wrong key -> 401"; else fail "/api/plan with a wrong key -> $status (expected 401)"; fi

# 5. nothing hidden is served
fetch /.htaccess
case "$status" in 403 | 404) pass "/.htaccess -> $status" ;; *) fail "/.htaccess -> $status (must not be served)" ;; esac
fetch /.ftp-deploy-sync-state.json
case "$status" in 403 | 404) pass "/.ftp-deploy-sync-state.json -> $status" ;; *) fail "/.ftp-deploy-sync-state.json -> $status (must not be served)" ;; esac

printf '\n%d failure(s), %d warning(s)\n' "$failures" "$warnings"
[ "$failures" -eq 0 ]
