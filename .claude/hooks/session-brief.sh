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

out=""
o1=$(warn_stale "$pm/4 - This Week (Action Plan).md" "week_of" 10 "The weekly plan (PM file 4)")
o2=$(warn_stale_body "$pm/2 - Feature State — Current Reality.md" 30 "Global Feature State (PM file 2)")
out="${o1}${o2:+
$o2}"

if [ -n "$out" ]; then
  echo "PM FRESHNESS RADAR (SessionStart hook):"
  echo "$out"
  echo "Current cluster truth lives in the FABLED 2 layer — start at 'ERA Notes/00 - Home/FABLED 2 Master Index.md', then delta with git log --since=<its stamp>. If this session ships work, update the campaign PM files (Hard Rule 25); refreshing the stale file above is optional and secondary."
fi
exit 0
