# Error Logs

**Type:** Standalone
**Route:** `/error-logs`
**Vault doc:** `ERA Notes/02 - Standalone Modules/Error Logs/`

## What it does

A persistent, structured error log viewable in-app. Replaces `console.error` (Hard Rule #22). Errors are written from client + server through `src/lib/logger.ts` (if present) or the error-log API.

## Files at a glance

- **Page entry**: `src/app/error-logs/page.tsx`
- **API routes**: `src/app/api/error-logs/`
- **DB tables**: `error_logs` (confirm in `schema.sql`)
- **Component**: `src/components/ErrorLogger.tsx`

## Common edit scenarios

- **"Add a new error category"** → DB enum → API zod → log call site → filter UI on the page.
- **"Change the viewer UI"** → `src/app/error-logs/page.tsx`.

## Gotchas

- **Never** `console.log` / `console.error` in committed code. Use this module's logger.

## Connected modules

- Touched by every module that needs structured logging.
