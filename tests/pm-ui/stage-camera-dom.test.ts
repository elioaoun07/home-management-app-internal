import { describe, expect, it } from "vitest";
import { cameraDomPort } from "../../scripts/pm/app/stage/cameraDom";

function fixture() {
  let computed = "matrix(0.6,0,0,0.6,10,20)",
    reads = 0;
  const writes: { value: string; transition: string }[] = [];
  const seen: { transform: string; transition: string; scale: string }[] = [];
  const target = {
    dataset: {},
    style: {
      transformOrigin: "",
      width: "",
      height: "",
      transition: "",
      transform: "",
      setProperty(_name: string, value: string | null) {
        writes.push({
          value: String(value),
          transition: target.style.transition,
        });
      },
    },
  };
  const port = cameraDomPort(target, () => {
    reads++;
    seen.push({
      transform: target.style.transform,
      transition: target.style.transition,
      scale: writes.at(-1)?.value ?? "",
    });
    return computed;
  });
  return {
    port,
    target,
    writes,
    seen,
    reads: () => reads,
    computed(value: string) {
      computed = value;
    },
  };
}

describe("camera CSS property synchronization", () => {
  it("restarts a translated same-scale shot from one actual scale, flushing before both new targets", () => {
    const f = fixture();
    f.port.paint({ x: 10, y: 20, scale: 0.6 }, 0);
    f.port.paint({ x: -40, y: -60, scale: 1.3 }, 900);
    expect(f.reads()).toBe(2);
    f.computed("matrix(0.85,0,0,0.85,-12,-8)");
    f.port.paint({ x: -40, y: -160, scale: 1.3 }, 900);
    expect(f.reads()).toBe(4);
    expect(f.seen[3]).toEqual({
      transition: "none",
      scale: "0.85",
      transform: "translate(-12px,-8px) scale(0.85)",
    });
    expect(f.writes.slice(-2)).toEqual([
      { value: "0.85", transition: "none" },
      {
        value: "1.3",
        transition: expect.stringContaining("--board-scale 900ms"),
      },
    ]);
    expect(f.target.style.transform).toBe("translate(-40px,-160px) scale(1.3)");
  });
  it("does no computed reads for cuts and restarts changed-scale shots from the actual pose too", () => {
    const f = fixture();
    f.port.paint({ x: 0, y: 0, scale: 1 }, 0);
    f.port.paint({ x: 20, y: 20, scale: 1.5 }, 0);
    expect(f.reads()).toBe(0);
    f.computed("matrix(1.2,0,0,1.2,20,20)");
    const count = f.writes.length;
    f.port.paint({ x: 40, y: 30, scale: 0.8 }, 900);
    expect(f.reads()).toBe(2);
    expect(f.writes).toHaveLength(count + 2);
    expect(f.writes.slice(-2)).toEqual([
      { value: "1.2", transition: "none" },
      {
        value: "0.8",
        transition: expect.stringContaining("--board-scale 900ms"),
      },
    ]);
    expect(f.target.style.transition).toContain("transform 900ms");
  });
});
