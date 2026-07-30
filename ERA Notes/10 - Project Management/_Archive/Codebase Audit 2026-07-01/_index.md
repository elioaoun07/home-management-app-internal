---
created: 2026-07-01
type: audit-index
status: living
tags:
  - pm/audit
  - scope/cross-cutting
  - codebase-audit
---

# Codebase Audit 2026-07-01

This folder is a whole-codebase audit pack covering security vulnerabilities, functional vulnerabilities, structural vulnerabilities, enhancement opportunities, and strong areas to preserve as hard rules.

## Files

| # | File | Use it when... |
|---|---|---|
| 00 | [Executive Summary](<00 - Executive Summary.md>) | You want the one-page verdict, severity model, and priority order. |
| 01 | [Security Vulnerabilities](<01 - Security Vulnerabilities.md>) | You are fixing auth, logging, API, Supabase, cron, RLS, or secret-handling risk. |
| 02 | [Functional Vulnerabilities](<02 - Functional Vulnerabilities.md>) | You are fixing stale UI, broken mutations, offline/sync, undo, timezone, or mobile behavior. |
| 03 | [Structural Vulnerabilities](<03 - Structural Vulnerabilities.md>) | You are fixing architecture drift, documentation drift, weak enforcement, or test gaps. |
| 04 | [Areas To Enhance](<04 - Areas To Enhance.md>) | You want the opportunity backlog after the vulnerability list. |
| 05 | [Strong Areas To Keep As Hard Rules](<05 - Strong Areas To Keep As Hard Rules.md>) | You want the practices that should stay non-negotiable. |
| 06 | [Evidence Index](<06 - Evidence Index.md>) | You need evidence paths and next actions in one table. |
| 07 | [Remediation Checklist](<07 - Remediation Checklist.md>) | You want the executable checklist by priority. |
| F2 | [FABLED 2/](<FABLED 2/_index.md>) | **The living delta layer (2026-07-02):** every qualitative claim pinned to exact baseline numbers, the P0s mapped to campaign owners, the red-suite meta-finding, and the monthly delta cadence. Read this before treating the audit as current. |

## Operating Rule

Do not treat this audit as a one-time snapshot. When a finding is fixed, update the relevant report and check it off in [07 - Remediation Checklist](<07 - Remediation Checklist.md>). If the fix touches `src/` or `migrations/`, also update the relevant module PM folder according to Hard Rule 25.