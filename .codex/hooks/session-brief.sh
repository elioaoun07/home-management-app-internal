#!/bin/bash
# SessionStart hook: a compact freshness brief, printed only when something the
# session will rely on is stale. Fail-silent by design — this must NEVER block
# or slow a session start.

pm="ERA Notes/10 - Project Management"
now=$(date +%s)

days_since() { # $1=YYYY-MM-DD -> days, or empty when unparsable
  local then
  then=$(date -d "$1" +%s 2>/dev/null) || return 0
  echo $(( (now - then) / 86400 ))
}

# Campaign checklists are the living queues. Every folder holding a
# '4 - Checklist.md' is a campaign, so a new campaign needs no edit here.
newest=""
for f in "$pm"/*/"4 - Checklist.md"; do
  [ -f "$f" ] || continue
  s=$(grep -m1 "^updated:" "$f" | sed 's/updated:[[:space:]]*//' | tr -d '\r"' | cut -c1-10)
  [ -n "$s" ] || continue
  if [ -z "$newest" ] || [ "$s" \> "$newest" ]; then newest="$s"; fi
done

if [ -n "$newest" ]; then
  days=$(days_since "$newest")
  if [ -n "$days" ] && [ "$days" -gt 14 ]; then
    echo "PM FRESHNESS: no campaign checklist has been updated since $newest ($days days ago) — the queues may be stale. Verify an item against the code before trusting its lane."
  fi
fi

# DB state snapshot freshness (Hard Rule #27). RLS, policy bodies, FK cascades
# and SECURITY DEFINER facts live ONLY in migrations/db-state.json — schema.sql
# cannot hold them. A missing or stale snapshot must be announced, or an agent
# falls back to trusting repo prose about RLS (the 2026-08-04 failure).
db_state="migrations/db-state.json"
if [ ! -f "$db_state" ]; then
  echo "DB STATE: migrations/db-state.json is MISSING. This repo cannot answer any question about RLS, policy bodies, FK cascade rules or SECURITY DEFINER functions. Do NOT infer RLS from schema.sql or any doc (Hard Rule #27) — ask the owner to run migrations/db-state.sql. Verify with 'pnpm db:verify-rls'."
else
  # The snapshot may be pasted as one escaped JSON string (\"generated_at\": \"…\"),
  # so match the key without its quotes.
  stamp=$(grep -oE 'generated_at[^0-9]{0,12}[0-9]{4}-[0-9]{2}-[0-9]{2}' "$db_state" | head -1 | grep -oE '[0-9]{4}-[0-9]{2}-[0-9]{2}')
  if [ -n "$stamp" ]; then
    days=$(days_since "$stamp")
    if [ -n "$days" ] && [ "$days" -gt 30 ]; then
      echo "DB STATE: migrations/db-state.json was generated $stamp ($days days ago). Treat its RLS/policy/cascade contents as historical; ask the owner to re-run migrations/db-state.sql before relying on it (Hard Rule #27)."
    fi
  fi
fi
exit 0
