#!/usr/bin/env bash
# Blocks `git push` unless the console's tests and build both pass.
#
# Wired as a PreToolUse hook on Bash in .claude/settings.json. Claude Code
# hands the tool call in on stdin as JSON; exit 2 refuses the call and sends
# stderr back to the model, which is what makes this enforcement rather than
# advice. Any other command passes straight through.
set -uo pipefail

payload=$(cat)

command=$(printf '%s' "$payload" | python3 -c '
import json, sys
try:
    print(json.load(sys.stdin).get("tool_input", {}).get("command", ""))
except Exception:
    print("")
')

# Only git push is gated. Anything else is none of this hook'"'"'s business.
if ! printf '%s' "$command" | grep -Eq '(^|[;&|[:space:]])git[[:space:]]+([^;&|]*[[:space:]])?push([[:space:]]|$)'; then
  exit 0
fi

root="${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2>/dev/null)}"
app="$root/build-battle/merchant-console"

if [ ! -d "$app/node_modules" ]; then
  echo "pre-push: $app has no node_modules, so the checks cannot run." >&2
  echo "Run 'npm install --prefix build-battle/merchant-console', then push again." >&2
  exit 2
fi

fail() {
  echo "pre-push: $1 failed, so this push was refused." >&2
  echo "" >&2
  echo "$2" | tail -25 >&2
  echo "" >&2
  echo "Fix it and push again. Nothing reaches main that does not pass here." >&2
  exit 2
}

test_out=$(cd "$app" && npm test 2>&1) || fail "npm test" "$test_out"
build_out=$(cd "$app" && npm run build 2>&1) || fail "npm run build" "$build_out"

summary=$(printf '%s' "$test_out" | grep -E '^ +Tests +' | head -1)
echo "pre-push: checks passed.${summary:+ $summary}" >&2
exit 0
