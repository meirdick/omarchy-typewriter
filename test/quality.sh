#!/usr/bin/env bash
# Harder quality suite: cases where a weak model corrupts meaning rather than
# just failing to follow format. Automated checks assert that things which must
# survive verbatim actually did.
#
#   quality.sh @cf/meta/llama-4-scout-17b-16e-instruct [more models...]
#
# Needs a working Cloudflare backend. Exits non-zero if any case fails, so CI
# wired to this fails on a bad model and on a dead backend alike.
set -uo pipefail
R="$(dirname "$0")/../bin/omarchy-typewriter"

[ "$#" -gt 0 ] || { echo "usage: $0 <model> [model...]" >&2; exit 2; }

declare -a NAME TEXT PRESET MUST
add() { NAME+=("$1"); PRESET+=("$2"); TEXT+=("$3"); MUST+=("$4"); }

add jargon proof \
'the pod keeps going into crashloopbackoff after we rolled the sts, and kubectl describe shows a oomkilled reason. nginx is fine, its psql thats eating the memry.' \
'CrashLoopBackOff|OOMKilled|nginx|psql'
add names proof \
'i sinced up with priya and aravind about the okrs, they think the q3 targt is to agressive given were down two enginers.' \
'Priya|Aravind|OKRs'
add code proof \
'to fix it run `git rebase -i HEAD~3` then force push, but dont do it on main becuase the branch protectoin will reject it anyway.' \
'git rebase -i HEAD~3'
add numbers proof \
'we got p99 down from 340ms to 120ms after the pool change, thats a 65% improvment and it held for 72 hours strait.' \
'340ms|120ms|65%|72'
add voice rewrite \
'honestly this whole migration has been a mess and i think we shoud just roll it back, im tired of firefighting every deploy.' \
'-'
add markdown proof \
'## Deploy notes

- ran the **migration** on staging
- p99 regresed, see [the dashbord](https://grafana.example.com/d/abc)
- rolled back at 14:20' \
'\*\*migration\*\*|https://grafana.example.com/d/abc|## Deploy notes'
add restructure rewrite \
'The reason that we ended up deciding to postpone the launch which was originally scheduled for the fifteenth was because the load testing that the platform team ran showed that we would probably not be able to handle the traffic that marketing was forecasting for the campaign.' \
'-'
add donttouch proof \
'The invoice totals $1,204.50 and is due net 30 from 2026-09-01.' \
'\$1,204.50|net 30|2026-09-01'

total_fails=0
for M in "$@"; do
  echo "################ $M"
  fails=0
  for i in "${!NAME[@]}"; do
    err="$(mktemp)"
    out="$(env TYPEWRITER_BACKEND=cloudflare TYPEWRITER_CF_MODEL="$M" timeout 120 \
             "$R" "${PRESET[$i]}" --text "${TEXT[$i]}" --print 2>"$err")"
    rc=$?
    verdict="ok"
    if [ "$rc" -ne 0 ]; then
      # A dead backend used to read as a pass on every case with no MUST
      # pattern. Silence is not success.
      verdict="ERROR(rc=$rc): $(head -c 120 "$err" | tr '\n' ' ')"
      fails=$((fails+1))
    elif [ -z "$out" ]; then
      verdict="EMPTY"
      fails=$((fails+1))
    elif [ "${MUST[$i]}" != '-' ]; then
      IFS='|' read -ra pats <<< "${MUST[$i]}"
      for p in "${pats[@]}"; do
        grep -qE "$p" <<<"$out" || { verdict="LOST: $p"; fails=$((fails+1)); break; }
      done
    fi
    rm -f "$err"
    printf '\n-- %-12s [%s]\n%s\n' "${NAME[$i]}" "$verdict" "$out"
  done
  printf '\n==== %s hard-check failures: %d\n\n' "$M" "$fails"
  total_fails=$((total_fails + fails))
done

if [ "$total_fails" -gt 0 ]; then
  echo "FAIL: $total_fails hard-check failure(s) across $# model(s)" >&2
  exit 1
fi
echo "PASS: every hard check survived on all $# model(s)"
