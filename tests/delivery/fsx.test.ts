import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  FsxError,
  appendNdjsonLine,
  atomicWriteFileSync,
  atomicWriteJsonSync,
  readJsonIfExists,
  readTextIfExists,
} from "../../scripts/delivery/fsx.mjs";

type CodedError = Error & { code?: string };

function epermError(message: string): CodedError {
  const e: CodedError = new Error(message);
  e.code = "EPERM";
  return e;
}

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "fsx-test-"));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("atomicWriteFileSync (real filesystem, happy path)", () => {
  it("writes the file and leaves no .tmp behind", () => {
    const target = join(dir, "nested", "state.json");
    atomicWriteFileSync(target, '{"ok":true}');
    expect(readFileSync(target, "utf8")).toBe('{"ok":true}');
    expect(existsSync(`${target}.tmp`)).toBe(false);
  });

  it("overwrites an existing file", () => {
    const target = join(dir, "state.json");
    atomicWriteFileSync(target, "v1");
    atomicWriteFileSync(target, "v2");
    expect(readFileSync(target, "utf8")).toBe("v2");
  });
});

describe("atomicWriteJsonSync", () => {
  it("pretty-prints and newline-terminates", () => {
    const target = join(dir, "packet.json");
    atomicWriteJsonSync(target, { a: 1 });
    const text = readFileSync(target, "utf8");
    expect(text.endsWith("\n")).toBe(true);
    expect(JSON.parse(text)).toEqual({ a: 1 });
  });
});

describe("atomicWriteFileSync EPERM retry (mocked fs)", () => {
  it("retries on EPERM and eventually succeeds", () => {
    const epermThenOk = vi
      .fn()
      .mockImplementationOnce(() => {
        throw epermError("locked");
      })
      .mockImplementationOnce(() => {
        throw epermError("locked");
      })
      .mockImplementationOnce(() => undefined);
    const fakeFs = {
      mkdirSync: vi.fn(),
      writeFileSync: vi.fn(),
      renameSync: epermThenOk,
    };
    const sleep = vi.fn();

    expect(() =>
      atomicWriteFileSync("/x/y.json", "{}", { fs: fakeFs, sleep, retries: 3 }),
    ).not.toThrow();
    expect(epermThenOk).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenCalledTimes(2);
  });

  it("throws the original error once retries are exhausted", () => {
    const alwaysEperm = vi.fn().mockImplementation(() => {
      throw epermError("still locked");
    });
    const fakeFs = {
      mkdirSync: vi.fn(),
      writeFileSync: vi.fn(),
      renameSync: alwaysEperm,
    };
    expect(() =>
      atomicWriteFileSync("/x/y.json", "{}", { fs: fakeFs, sleep: vi.fn(), retries: 2 }),
    ).toThrow(/still locked/);
    expect(alwaysEperm).toHaveBeenCalledTimes(3); // initial + 2 retries
  });

  it("does not retry on a non-EPERM error", () => {
    const otherError = vi.fn().mockImplementation(() => {
      throw new Error("disk full");
    });
    const fakeFs = { mkdirSync: vi.fn(), writeFileSync: vi.fn(), renameSync: otherError };
    expect(() =>
      atomicWriteFileSync("/x/y.json", "{}", { fs: fakeFs, sleep: vi.fn() }),
    ).toThrow(/disk full/);
    expect(otherError).toHaveBeenCalledTimes(1);
  });
});

describe("appendNdjsonLine", () => {
  it("creates the file and appends lines, adding a trailing newline when missing", () => {
    const target = join(dir, "events.ndjson");
    appendNdjsonLine(target, '{"seq":1}');
    appendNdjsonLine(target, '{"seq":2}\n');
    const text = readFileSync(target, "utf8");
    expect(text).toBe('{"seq":1}\n{"seq":2}\n');
  });
});

describe("readJsonIfExists / readTextIfExists", () => {
  it("returns null when the file is missing", () => {
    expect(readJsonIfExists(join(dir, "missing.json"))).toBeNull();
    expect(readTextIfExists(join(dir, "missing.txt"))).toBeNull();
  });

  it("parses existing JSON", () => {
    const target = join(dir, "state.json");
    atomicWriteJsonSync(target, { ok: true });
    expect(readJsonIfExists(target)).toEqual({ ok: true });
  });

  it("throws FsxError on invalid JSON", () => {
    const target = join(dir, "bad.json");
    atomicWriteFileSync(target, "{not json");
    expect(() => readJsonIfExists(target)).toThrow(FsxError);
  });

  it("readTextIfExists returns raw text", () => {
    const target = join(dir, "note.txt");
    atomicWriteFileSync(target, "hello");
    expect(readTextIfExists(target)).toBe("hello");
  });
});
