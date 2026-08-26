#!/usr/bin/env bash
# Benchmark omarchy-typewriter backends and models on latency and correctness.
#   bench.sh cf @cf/meta/llama-3.2-3b-instruct @cf/...
#   bench.sh ollama llama3.2:3b qwen3:4b
#
# Needs a working backend, so it is opt-in and is not part of `node --test`.
set -uo pipefail
R="$(dirname "$0")/../bin/omarchy-typewriter"

[ "$#" -ge 2 ] || { echo "usage: $0 cf|ollama <model> [model...]" >&2; exit 2; }
kind="$1"; shift

SHORT='i beleive the meetng is on tusday'
PARA='Hi team, just wanted to follow up on the deploy we talked about last wek. The staging enviroment is still throwing the same 502 that we saw on tuesday, and i think its related to the connection pool setting we changed. Can someone take a look befor friday? I dont want to push this to prod untill we understand whats happening.'
LONG="$PARA $PARA"

run() { # preset text -> prints "time<TAB>output"
  local preset="$1" text="$2" t out err
  err="$(mktemp)"
  out="$($RUNENV $R "$preset" --text "$text" --print --time 2>"$err")"
  t="$(grep -oP '(?<=time=)[0-9.]+' "$err" | tail -1)"
  rm -f "$err"
  printf '%s\t%s' "${t:-FAIL}" "$out"
}

median3() { printf '%s\n' "$@" | sort -g | sed -n 2p; }

for M in "$@"; do
  if [ "$kind" = cf ]; then
    RUNENV="env TYPEWRITER_BACKEND=cloudflare TYPEWRITER_CF_MODEL=$M"
  else
    RUNENV="env TYPEWRITER_BACKEND=ollama TYPEWRITER_OLLAMA_MODEL=$M OLLAMA_HOST=127.0.0.1:11434"
  fi

  # latency: 3 runs each on three input sizes
  declare -a ts=()
  for label in SHORT PARA LONG; do
    eval "txt=\$$label"
    a=(); for i in 1 2 3; do a+=("$(run proof "$txt" | cut -f1)"); done
    ts+=("$(median3 "${a[@]}")")
  done

  # correctness: does it transform rather than converse
  q1="$(run rewrite 'is this working?' | cut -f2-)"
  q2="$(run rewrite 'can you check this for me' | cut -f2-)"
  q3="$(run proof 'proofing is fun' | cut -f2-)"
  fix="$(run proof "$SHORT" | cut -f2-)"
  md="$(run proof '- first itm
- secnd itm' | cut -f2-)"

  pass=0
  grep -qi 'is this working' <<<"$q1" && pass=$((pass+1))
  grep -qi 'check this for me' <<<"$q2" && pass=$((pass+1))
  grep -qi 'proofing is fun' <<<"$q3" && pass=$((pass+1))
  grep -qi 'Tuesday' <<<"$fix" && grep -qi 'meeting' <<<"$fix" && pass=$((pass+1))
  grep -q '^- ' <<<"$md" && grep -qi 'second item' <<<"$md" && pass=$((pass+1))

  printf '%-42s | %6ss %6ss %6ss | %d/5\n' "$M" "${ts[0]}" "${ts[1]}" "${ts[2]}" "$pass"
  printf '    short-question -> %s\n' "$(head -c 90 <<<"$q1")"
  printf '    request-phrase -> %s\n' "$(head -c 90 <<<"$q2")"
  printf '    markdown       -> %s\n' "$(tr '\n' '/' <<<"$md" | head -c 90)"
done
