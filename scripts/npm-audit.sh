#!/usr/bin/env bash
#
# npm audit wrapper for the Nightly Security workflow.
#
# A bare `npm audit` cannot tell "the npm registry audit endpoint is down" apart
# from "this project has vulnerable dependencies" — both exit 1. That turned a
# registry 503 into a red security workflow (run 33842613035). This wrapper runs
# the audit as JSON and classifies each attempt:
#
#   conclusive   stdout parses as JSON and carries a .metadata.vulnerabilities
#                object, i.e. the registry actually answered with audit data
#   inconclusive anything else — an error payload, empty output, malformed JSON
#
# Conclusive results are final: clean passes, findings fail immediately with no
# retries. Inconclusive attempts are retried with exponential backoff, and once
# they are exhausted the job emits a ::warning:: rather than a false-positive
# vulnerability failure. An inconclusive response is never read as a clean audit.
#
# Environment:
#   AUDIT_LEVEL                   npm --audit-level threshold  (default: moderate)
#   AUDIT_MAX_ATTEMPTS            attempts before giving up    (default: 4)
#   RETRY_BASE_SECONDS            backoff base, * 2^n          (default: 30)
#   AUDIT_FAIL_ON_REGISTRY_ERROR  "true" to fail closed when
#                                 every attempt is inconclusive (default: false)
#   AUDIT_FETCH_TIMEOUT_MS        per-attempt npm fetch timeout (default: 120000)
#   NPM_BIN                       npm executable               (default: npm)

set -euo pipefail

AUDIT_LEVEL="${AUDIT_LEVEL:-moderate}"
AUDIT_MAX_ATTEMPTS="${AUDIT_MAX_ATTEMPTS:-4}"
RETRY_BASE_SECONDS="${RETRY_BASE_SECONDS:-30}"
AUDIT_FAIL_ON_REGISTRY_ERROR="${AUDIT_FAIL_ON_REGISTRY_ERROR:-false}"
AUDIT_FETCH_TIMEOUT_MS="${AUDIT_FETCH_TIMEOUT_MS:-120000}"
NPM_BIN="${NPM_BIN:-npm}"

if ! command -v jq >/dev/null 2>&1; then
  echo "::error::scripts/npm-audit.sh requires jq, which was not found on PATH."
  exit 1
fi

stderr_file="$(mktemp)"
trap 'rm -f "$stderr_file"' EXIT

# A response only counts as a real audit result when it carries the metadata
# block npm fills in from the registry's answer. Classifying on that rather than
# on error strings means an unrecognised payload degrades to "retry", never to
# "clean".
is_conclusive() {
  jq -e 'type == "object" and (.metadata.vulnerabilities | type) == "object"' >/dev/null 2>&1 <<<"$1"
}

# Number of reported vulnerabilities at or above AUDIT_LEVEL. npm's own exit code
# already encodes this, but recomputing it means a zero exit can never be read as
# clean when the payload disagrees.
count_at_or_above_level() {
  jq -r --arg lvl "$AUDIT_LEVEL" '
    ["info", "low", "moderate", "high", "critical"] as $levels
    | ($levels | index($lvl)) as $i
    | if $i == null then 0
      else (.metadata.vulnerabilities // {}) as $v
        | [$levels[$i:][] | ($v[.] | if type == "number" then . else 0 end)]
        | add // 0
      end
  ' <<<"$1"
}

print_totals() {
  jq -r '
    .metadata.vulnerabilities as $v
    | "Totals: \($v.critical // 0) critical, \($v.high // 0) high, \($v.moderate // 0) moderate, \($v.low // 0) low, \($v.info // 0) info"
  ' <<<"$1"
}

# Renders the human-readable report from the JSON we already have, so a genuine
# finding costs exactly one npm invocation.
print_report() {
  jq -r '
    {"critical": 0, "high": 1, "moderate": 2, "low": 3, "info": 4} as $order
    | (.vulnerabilities // {})
    | to_entries
    | sort_by($order[.value.severity] // 9)
    | .[]
    | "  \(.value.name) — \(.value.severity) — vulnerable range \(.value.range // "unknown")",
      ([.value.via[]? | select(type == "object") | "      \(.title // "advisory") (\(.url // "no advisory url"))"] | .[]),
      "      fix available: \(
        .value.fixAvailable
        | if . == false then "no"
          elif type == "object" then "\(.name)@\(.version)"
          else "yes"
          end
      )"
  ' <<<"$1"
}

print_diagnostics() {
  if [ -s "$stderr_file" ]; then
    echo "--- npm stderr (last 20 lines) ---"
    tail -n 20 "$stderr_file"
    echo "----------------------------------"
  fi
  if [ -n "$1" ]; then
    echo "--- npm stdout (first 20 lines) ---"
    printf '%s\n' "$1" | head -n 20 || true
    echo "-----------------------------------"
  else
    echo "--- npm stdout was empty ---"
  fi
}

attempt=1
while [ "$attempt" -le "$AUDIT_MAX_ATTEMPTS" ]; do
  echo "==> npm audit attempt ${attempt}/${AUDIT_MAX_ATTEMPTS} (audit level: ${AUDIT_LEVEL})"

  set +e
  audit_json="$("$NPM_BIN" audit --audit-level="$AUDIT_LEVEL" --json --fetch-timeout="$AUDIT_FETCH_TIMEOUT_MS" 2>"$stderr_file")"
  npm_status=$?
  set -e

  if is_conclusive "$audit_json"; then
    findings="$(count_at_or_above_level "$audit_json")"

    if [ "$npm_status" -eq 0 ] && [ "$findings" -eq 0 ]; then
      echo "Conclusive result: no vulnerabilities at or above '${AUDIT_LEVEL}'."
      print_totals "$audit_json"
      exit 0
    fi

    echo "Conclusive result: ${findings} vulnerabilit(ies) at or above '${AUDIT_LEVEL}' (npm exit ${npm_status})."
    echo "::error::npm audit found vulnerabilities at or above '${AUDIT_LEVEL}'."
    echo ""
    echo "npm audit report"
    print_report "$audit_json"
    echo ""
    print_totals "$audit_json"
    exit 1
  fi

  echo "Inconclusive result on attempt ${attempt}/${AUDIT_MAX_ATTEMPTS} (npm exit ${npm_status}): the response carried no .metadata.vulnerabilities object, so no audit data was returned."
  print_diagnostics "$audit_json"

  if [ "$attempt" -lt "$AUDIT_MAX_ATTEMPTS" ]; then
    backoff=$((RETRY_BASE_SECONDS * (2 ** (attempt - 1))))
    echo "Retrying in ${backoff}s..."
    sleep "$backoff"
  fi

  attempt=$((attempt + 1))
done

summary="npm audit could not be completed: all ${AUDIT_MAX_ATTEMPTS} attempt(s) returned an inconclusive response (the npm registry audit endpoint was unreachable or answered with an unparseable payload). No vulnerability data was obtained — this is not a clean audit result."
echo "::warning::${summary}"
if [ -n "${GITHUB_STEP_SUMMARY:-}" ]; then
  echo "⚠️ ${summary}" >>"$GITHUB_STEP_SUMMARY"
fi

if [ "$AUDIT_FAIL_ON_REGISTRY_ERROR" = "true" ]; then
  echo "AUDIT_FAIL_ON_REGISTRY_ERROR=true — failing the job."
  exit 1
fi

echo "AUDIT_FAIL_ON_REGISTRY_ERROR is not 'true' — passing the job with a warning. Set it to 'true' to fail closed instead."
exit 0
