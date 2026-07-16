import { describe, expect, it } from "vitest";
import {
  CONTROL_TYPES,
  ControlsError,
  buildControl,
  controlFileName,
  isProviderSwitch,
  validateControlPayload,
} from "../../scripts/delivery/controls.mjs";

describe("buildControl / controlFileName", () => {
  it("builds a pause control with defaults", () => {
    const control = buildControl({ seq: 1, type: "pause" });
    expect(control).toMatchObject({ seq: 1, type: "pause", payload: {} });
    expect(typeof control.at).toBe("string");
  });

  it("requires a numeric seq and a known type", () => {
    expect(() => buildControl({ seq: "x" as unknown as number, type: "pause" })).toThrow(ControlsError);
    expect(() => buildControl({ seq: 1, type: "bogus" })).toThrow(ControlsError);
  });

  it("controlFileName zero-pads seq and includes the type", () => {
    const control = buildControl({ seq: 7, type: "resume-run" });
    expect(controlFileName(control)).toBe("0007-resume-run.json");
  });

  it("CONTROL_TYPES lists all nine channel types", () => {
    expect(CONTROL_TYPES).toEqual([
      "pause", "resume-run", "set-config", "rotate", "fork", "pin", "unpin", "answer", "ask",
    ]);
  });
});

describe("validateControlPayload: pause / resume-run", () => {
  it("pause accepts an empty payload and an optional abortInFlight boolean", () => {
    expect(() => validateControlPayload("pause", {})).not.toThrow();
    expect(() => validateControlPayload("pause", { abortInFlight: true })).not.toThrow();
  });

  it("pause rejects a non-boolean abortInFlight", () => {
    expect(() => validateControlPayload("pause", { abortInFlight: "yes" })).toThrow(ControlsError);
  });

  it("resume-run accepts any/no payload", () => {
    expect(() => validateControlPayload("resume-run", {})).not.toThrow();
  });
});

describe("validateControlPayload: set-config", () => {
  it("accepts model-only, effort-only, provider-only, or a combination", () => {
    expect(() => validateControlPayload("set-config", { model: "claude-sonnet-5" })).not.toThrow();
    expect(() => validateControlPayload("set-config", { effortByPhase: { discovery: "high" } })).not.toThrow();
    expect(() => validateControlPayload("set-config", { provider: "codex" })).not.toThrow();
    expect(() => validateControlPayload("set-config", { provider: "codex", model: "gpt-5.2-codex" })).not.toThrow();
  });

  it("rejects an empty payload (must change at least one thing)", () => {
    expect(() => validateControlPayload("set-config", {})).toThrow(ControlsError);
  });

  it("rejects an unknown provider", () => {
    expect(() => validateControlPayload("set-config", { provider: "gpt5" })).toThrow(ControlsError);
  });

  it("rejects a non-string model or non-object effortByPhase", () => {
    expect(() => validateControlPayload("set-config", { model: 123 })).toThrow(ControlsError);
    expect(() => validateControlPayload("set-config", { effortByPhase: "high" })).toThrow(ControlsError);
  });
});

describe("validateControlPayload: rotate / fork / pin / unpin / answer / ask", () => {
  it("rotate accepts an empty payload", () => {
    expect(() => validateControlPayload("rotate", {})).not.toThrow();
  });

  it("fork accepts an optional atTurnId string", () => {
    expect(() => validateControlPayload("fork", {})).not.toThrow();
    expect(() => validateControlPayload("fork", { atTurnId: "0003" })).not.toThrow();
    expect(() => validateControlPayload("fork", { atTurnId: 3 })).toThrow(ControlsError);
  });

  it("pin requires turnId + numeric seqFrom/seqTo", () => {
    expect(() => validateControlPayload("pin", { turnId: "0001", seqFrom: 1, seqTo: 3 })).not.toThrow();
    expect(() => validateControlPayload("pin", { seqFrom: 1, seqTo: 3 })).toThrow(ControlsError);
    expect(() => validateControlPayload("pin", { turnId: "0001" })).toThrow(ControlsError);
  });

  it("unpin requires turnId", () => {
    expect(() => validateControlPayload("unpin", { turnId: "0001" })).not.toThrow();
    expect(() => validateControlPayload("unpin", {})).toThrow(ControlsError);
  });

  it("answer requires questionId + non-empty text", () => {
    expect(() => validateControlPayload("answer", { questionId: "q-1", text: "yes" })).not.toThrow();
    expect(() => validateControlPayload("answer", { questionId: "q-1", text: "  " })).toThrow(ControlsError);
    expect(() => validateControlPayload("answer", { text: "yes" })).toThrow(ControlsError);
  });

  it("ask requires non-empty text", () => {
    expect(() => validateControlPayload("ask", { text: "why?" })).not.toThrow();
    expect(() => validateControlPayload("ask", {})).toThrow(ControlsError);
  });
});

describe("isProviderSwitch", () => {
  it("is true only for set-config controls whose provider differs from the current one", () => {
    const control = buildControl({ seq: 1, type: "set-config", payload: { provider: "codex" } });
    expect(isProviderSwitch(control, "claude")).toBe(true);
    expect(isProviderSwitch(control, "codex")).toBe(false);
  });

  it("is false for set-config without a provider change", () => {
    const control = buildControl({ seq: 1, type: "set-config", payload: { model: "x" } });
    expect(isProviderSwitch(control, "claude")).toBe(false);
  });

  it("is false for non-set-config types", () => {
    const control = buildControl({ seq: 1, type: "pause" });
    expect(isProviderSwitch(control, "claude")).toBe(false);
  });
});
