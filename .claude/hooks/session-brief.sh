#!/bin/bash
# SessionStart hook: inject a compact freshness brief so every session starts
# knowing whether the PM layer it will read is live or historical.
# Fail-silent by design — this must NEVER block or slow a session start.

pm="ERA Notes/10 - Project Management"
now=$(date +%s)

warn_stale() { # $1=file  $2=frontmatter-key  $3=threshold-days  $4=label
  [ -f "$1" ] || return 0
  stamp=$(grep -m1 "^$2:" "$1" | sed "s/$2:[[:space:]]*//" | tr -d '\r"' | cut -c1-10)
  [ -n "$stamp" ] || return 0
  then=$(date -d "$stamp" +%s 2>/dev/null) || return 0
  days=$(( (now - then) / 86400 ))
  if [ "$days" -gt "$3" ]; then
    echo "- $4 is stamped $stamp ($days days old) — treat as historical, not current."
    return 1
  fi
  return 0
}

warn_stale_body() { # $1=file  $2=threshold-days  $3=label — matches "Updated YYYY-MM-DD" anywhere in body
  [ -f "$1" ] || return 0
  stamp=$(grep -oE "Updated [0-9]{4}-[0-9]{2}-[0-9]{2}" "$1" | tail -1 | cut -d' ' -f2)
  [ -n "$stamp" ] || return 0
  then=$(date -d "$stamp" +%s 2>/dev/null) || return 0
  days=$(( (now - then) / 86400 ))
  if [ "$days" -gt "$2" ]; then
    echo "- $3 was last stamped Updated $stamp ($days days old) — treat as historical, not current."
    return 1
  fi
  return 0
}

# Freshness now tracks the LIVING execution queues (the campaign checklists),
# not the archived root files. Warn only if the newest of them has gone stale.
newest=""
for c in "Budget" "Schedule" "Kitchen" "Trips" "Hub & ERA" "Notifications & Alerts" "Healthcare" "Outfits"; do
  f="$pm/$c/4 - Checklist.md"
  [ -f "$f" ] || continue
  s=$(grep -m1 "^updated:" "$f" | sed 's/updated:[[:space:]]*//' | tr -d '\r"' | cut -c1-10)
  [ -n "$s" ] || continue
  if [ -z "$newest" ] || [ "$s" \> "$newest" ]; then newest="$s"; fi
done

out=""
if [ -n "$newest" ]; then
  then=$(date -d "$newest" +%s 2>/dev/null) && {
    days=$(( (now - then) / 86400 ))
    [ "$days" -gt 14 ] && out="- No campaign checklist has been updated since $newest ($days days ago) — the execution queues may be stale."
  }
fi

if [ -n "$out" ]; then
  echo "PM FRESHNESS RADAR (SessionStart hook):"
  echo "$out"
  echo "Current cluster truth lives in the FABLED 3 layer — start at 'ERA Notes/00 - Home/FABLED 3 Master Index.md', then delta with git log --since=2026-07-18. Before working a cluster, read its 'FABLED 3/5 - FABLED 3 — Successor Briefing.md' (task-tier map + traps). Execution = the campaign 4 - Checklist.md Now/Next/Later lanes (grammar in _Conventions.md, viewed via 'pnpm pm'). If this session ships work, update the campaign PM files (Hard Rule 25) and append the cluster's FABLED 3 delta ledger."
fi
exit 0
