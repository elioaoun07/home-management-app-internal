import { describe, it, expect } from 'vitest';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createKit4Control, KIT4_CONTROL_VARIANTS } from './fixtures/kit4-controls.mjs';

const root = resolve(import.meta.dirname, '../..');
const oracle = join(root, 'tests/delivery-oracles/kit4-meal-coverage.mjs');
function observe(candidate: string) {
  const out = mkdtempSync(join(tmpdir(), 'era-kit4-oracle-result-'));
  try {
    const result = spawnSync(process.execPath, [oracle, candidate, out], { timeout: 30000, encoding: 'utf8', windowsHide: true });
    expect(result.error).toBeUndefined();
    expect(result.signal).toBeNull();
    const report = JSON.parse(readFileSync(join(out, 'kit4-oracle-results.json'), 'utf8'));
    expect(report.timezone).toBe('Asia/Beirut');
    expect(report.selected).toBe(54);
    return { status: result.status, report, stdout: result.stdout };
  } finally { rmSync(out, { recursive: true, force: true }); }
}

describe('KIT-4 protected oracle discrimination', () => {
  it('rejects the real unchanged baseline for retrieval and adapter defects, beyond the absent helper', () => {
    const { status, report } = observe(root);
    expect(status).toBe(1);
    const failed = report.cases.filter((c: { ok: boolean }) => !c.ok).map((c: { name: string }) => c.name);
    expect(failed).toContain('GET interval overlap without age cutoff');
    expect(failed).toContain('weekly hook retrieves old overlap and exact window');
    expect(failed).toContain('Chef adapter: old leftovers');
  }, 40000);
  it('accepts all criteria against an isolated corrected control', () => {
    const candidate = mkdtempSync(join(tmpdir(), 'era-kit4-corrected-'));
    try {
      createKit4Control(root, candidate);
      const { status, report, stdout } = observe(candidate);
      expect(report.loadErrors).toEqual({});
      expect(report.cases.filter((c: { ok: boolean }) => !c.ok)).toEqual([]);
      expect(status).toBe(0);
      expect(stdout).toContain('54 of 54 checks passed');
    } finally { rmSync(candidate, { recursive: true, force: true }); }
  }, 40000);
  for (const [variant, requiredFailure] of Object.entries(KIT4_CONTROL_VARIANTS)) {
    it('rejects the independently broken control: ' + variant, () => {
      const candidate = mkdtempSync(join(tmpdir(), 'era-kit4-negative-'));
      try {
        createKit4Control(root, candidate, variant);
        const { status, report } = observe(candidate);
        expect(report.loadErrors).toEqual({});
        expect(status).toBe(1);
        expect(report.cases.some((c: { name: string; ok: boolean }) => c.name === requiredFailure && !c.ok)).toBe(true);
      } finally { rmSync(candidate, { recursive: true, force: true }); }
    }, 40000);
  }
});
