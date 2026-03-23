#!/usr/bin/env bash
# MEMORY.sh — Injects live git context into CLAUDE.md session preamble
# Run at the start of a session so the AI has full repo awareness.
# Usage: source MEMORY.sh  OR  bash MEMORY.sh

set -euo pipefail
cd "$(dirname "$0")"

SEP="───────────────────────────────────────"

echo ""
echo "🧠 MEMORY.sh — Live Git Context Snapshot"
echo "$SEP"

# ── Current branch & tracking ──
BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "detached")
UPSTREAM=$(git rev-parse --abbrev-ref "@{upstream}" 2>/dev/null || echo "none")
echo "Branch:   $BRANCH"
echo "Tracking: $UPSTREAM"

# ── Ahead/behind remote ──
if [ "$UPSTREAM" != "none" ]; then
  AHEAD=$(git rev-list --count "@{upstream}..HEAD" 2>/dev/null || echo "?")
  BEHIND=$(git rev-list --count "HEAD..@{upstream}" 2>/dev/null || echo "?")
  echo "Ahead:    $AHEAD commit(s)  |  Behind: $BEHIND commit(s)"
fi

echo "$SEP"

# ── Last 5 commits ──
echo "Last 5 commits:"
git --no-pager log --oneline --no-decorate -5 2>/dev/null || echo "  (no commits)"

echo "$SEP"

# ── Working tree status ──
STAGED=$(git diff --cached --name-status 2>/dev/null)
MODIFIED=$(git diff --name-status 2>/dev/null)
UNTRACKED=$(git ls-files --others --exclude-standard 2>/dev/null)

if [ -n "$STAGED" ]; then
  echo "Staged changes:"
  echo "$STAGED" | sed 's/^/  /'
else
  echo "Staged changes: (none)"
fi

if [ -n "$MODIFIED" ]; then
  echo "Unstaged changes:"
  echo "$MODIFIED" | sed 's/^/  /'
else
  echo "Unstaged changes: (none)"
fi

if [ -n "$UNTRACKED" ]; then
  COUNT=$(echo "$UNTRACKED" | wc -l | tr -d ' ')
  echo "Untracked files ($COUNT):"
  echo "$UNTRACKED" | head -15 | sed 's/^/  /'
  [ "$COUNT" -gt 15 ] && echo "  ... and $((COUNT - 15)) more"
else
  echo "Untracked files: (none)"
fi

echo "$SEP"

# ── Merge / rebase / cherry-pick state ──
if [ -d .git/rebase-merge ] || [ -d .git/rebase-apply ]; then
  echo "⚠  Rebase in progress"
elif [ -f .git/MERGE_HEAD ]; then
  echo "⚠  Merge in progress"
elif [ -f .git/CHERRY_PICK_HEAD ]; then
  echo "⚠  Cherry-pick in progress"
else
  echo "Repo state: clean (no merge/rebase/cherry-pick in progress)"
fi

# ── Stash ──
STASH_COUNT=$(git stash list 2>/dev/null | wc -l | tr -d ' ')
if [ "$STASH_COUNT" -gt 0 ]; then
  echo "Stashes: $STASH_COUNT"
  git --no-pager stash list | head -3 | sed 's/^/  /'
else
  echo "Stashes: (none)"
fi

echo "$SEP"

# ── Recent tags ──
TAGS=$(git --no-pager tag --sort=-creatordate 2>/dev/null | head -3)
if [ -n "$TAGS" ]; then
  echo "Recent tags:"
  echo "$TAGS" | sed 's/^/  /'
else
  echo "Tags: (none)"
fi

# ── Active remotes ──
echo "Remotes:"
git remote -v 2>/dev/null | grep '(push)' | sed 's/^/  /' || echo "  (none)"

echo "$SEP"
echo "Snapshot taken: $(date '+%Y-%m-%d %H:%M:%S')"
echo ""
