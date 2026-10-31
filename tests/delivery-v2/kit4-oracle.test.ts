import { describe, it, expect } from 'vitest';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { spawnSync } from 'node:child_process';

// KIT-4 shipped (2026-10-27): the protected oracle is now a regression check over
// the real source. Its pre-implementation discrimination evidence (baseline 45
// failures, eleven broken controls rejected) is retained in the Kitchen Master Book.
const root = resolve(import.meta.dirname, '../..');
const oracle = join(root, 'tests/delivery-oracles/kit4-meal-coverage.mjs');

describe('KIT-4 meal coverage oracle', () => {
  it('passes all 54 checks against the real source', () => {
    const out = mkdtempSync(join(tmpdir(), 'era-kit4-oracle-result-'));
    try {
      const result = spawnSync(process.execPath, [oracle, root, out], { timeout: 30000, encoding: 'utf8', windowsHide: true });
      expect(result.error).toBeUndefined();
      const report = JSON.parse(readFileSync(join(out, 'kit4-oracle-results.json'), 'utf8'));
      expect(report.timezone).toBe('Asia/Beirut');
      expect(report.loadErrors).toEqual({});
      expect(report.cases.filter((c: { ok: boolean }) => !c.ok)).toEqual([]);
      expect(result.status).toBe(0);
      expect(result.stdout).toContain('54 of 54 checks passed');
    } finally { rmSync(out, { recursive: true, force: true }); }
  }, 40000);
});
