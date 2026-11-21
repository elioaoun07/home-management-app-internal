# Tests

## Timing

Tests and hooks that start a compiler, ESLint, a browser, a child process or a real Git repository must set an explicit timeout of at least 60 seconds at the call site. Keep the global default unchanged and use no retries so failures remain visible.
