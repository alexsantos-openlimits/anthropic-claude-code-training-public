#!/usr/bin/env bash
# PreToolUse hook for Bash: before any `git push`, run the merchant console's
# tests and build. Exit 2 blocks the push and the message on stderr reaches Claude.
set -uo pipefail

command=$(jq -r '.tool_input.command // empty')
if ! printf '%s' "$command" | grep -Eq '(^|[;&|[:space:]])git[[:space:]]+push([[:space:]]|$)'; then
  exit 0
fi

project_dir="${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel)}"
app_dir="$project_dir/build-battle/merchant-console"
log_dir="${TMPDIR:-/tmp}/pre-push-check"
mkdir -p "$log_dir"
test_log="$log_dir/test.log"
build_log="$log_dir/build.log"

if ! (cd "$app_dir" && npm test) >"$test_log" 2>&1; then
  {
    echo "Push blocked: npm test failed in build-battle/merchant-console."
    grep -E "FAIL|✗|×|AssertionError|Tests +[0-9]" "$test_log" | head -n 15
    echo "Full output: cat $test_log"
  } >&2
  exit 2
fi

# GOTCHA: `next build` rewrites .next, which a running `next dev` also uses, so
# build a throwaway copy that shares node_modules instead of the live folder.
build_dir=$(mktemp -d "$log_dir/build.XXXXXX")
rsync -a --exclude node_modules --exclude .next "$app_dir/" "$build_dir/"
ln -s "$app_dir/node_modules" "$build_dir/node_modules"
if ! (cd "$build_dir" && npm run build) >"$build_log" 2>&1; then
  {
    echo "Push blocked: npm run build failed in build-battle/merchant-console."
    grep -iE "error|failed" "$build_log" | head -n 15
    echo "Full output: cat $build_log"
  } >&2
  rm -rf "$build_dir"
  exit 2
fi
rm -rf "$build_dir"

exit 0
