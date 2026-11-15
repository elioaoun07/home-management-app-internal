#!/usr/bin/env bash
# Runs TypeScript check and ESLint on staged TS/TSX files.
# Sourced by .husky/pre-commit.

echo "Checking AI guidance docs..."
if ! pnpm docs:check; then
  echo "AI guidance docs drifted; fix before committing." >&2
  exit 2
fi

echo "Checking generated agent setup..."
if ! pnpm sync:ai:check; then
  echo "Generated agent setup drifted; run pnpm sync:ai." >&2
  exit 2
fi

echo "Checking PWA manifests..."
if ! pnpm -s pwa:check; then
  echo "PWA manifest scopes collide - see .claude/skills/pwa-install/SKILL.md" >&2
  exit 2
fi

echo "Running TypeScript check..."
if ! pnpm tsc --noEmit; then
  echo "TypeScript errors — fix before committing." >&2
  exit 2
fi

echo "Running unit tests..."
if ! (
  # Tests create foreign repositories. Git's hook environment must not make
  # their commands use this checkout's index, worktree or -c configuration.
  test_git_env=$(git rev-parse --local-env-vars) || exit 1
  while IFS= read -r test_git_variable; do
    unset "$test_git_variable"
  done <<< "$test_git_env"
  pnpm test
); then
  echo "Unit tests failed — fix before committing." >&2
  exit 2
fi

STAGED=()
while IFS= read -r -d '' file; do
  [[ "$file" == *.ts || "$file" == *.tsx ]] && STAGED+=("$file")
done < <(git diff --cached --name-only --diff-filter=ACM -z)
if [ "${#STAGED[@]}" -gt 0 ]; then
  echo "Running ESLint on staged files..."
  if ! pnpm eslint --max-warnings=0 -- "${STAGED[@]}"; then
    echo "ESLint errors — fix before committing." >&2
    exit 2
  fi
fi
