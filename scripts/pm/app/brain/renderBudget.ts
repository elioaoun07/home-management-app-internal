// The camera's resting image and the moving frame have different costs. Keep a
// separate scale for each so a busy walk cannot permanently soften a recording.
export function roomRenderBudget(software = false) {
  let scale = 0, ceiling = 1, floor = 1, resting = 1;
  let slow = 0, fastMs = 0, cooldown = 0;

  function resize(width: number, height: number, dpr: number) {
    const pixels = Math.max(1, width * height);
    const density = Math.max(1, Math.min(dpr || 1, 2));
    // Native coverage through a 4K desktop; small screens can use device DPR.
    resting = Math.min(density, Math.sqrt((software ? 4_200_000 : 8_300_000) / pixels));
    ceiling = software ? Math.min(resting, Math.sqrt(1_600_000/pixels)) : resting;
    floor = Math.min(ceiling, software ? Math.sqrt(950_000/pixels) : Math.max(1, Math.sqrt(850_000 / pixels)));
    // Repeated swapchain allocations at the start of a walk stall SwiftShader
    // even when its steady frame fits. Grow only from observed GPU headroom.
    const initial = software ? floor : Math.max(1, Math.sqrt(3_200_000 / pixels));
    scale = Math.max(floor, Math.min(ceiling, scale || initial));
    return scale;
  }

  function sample(interval: number, gpuMs?: number) {
    if (interval <= 0 || !Number.isFinite(interval)) return false;
    if (cooldown > 0) { cooldown -= interval; return false; }
    const target = software ? 1000 / 30 : 1000 / 60;
    const gpuBusy = gpuMs === undefined || gpuMs > target * .83;
    slow = interval > target * 1.3 && gpuBusy ? slow + 1 : 0;
    fastMs = (gpuMs === undefined ? interval < target * 1.13 : gpuMs < target * .54) ? fastMs + interval : 0;
    let next = scale;
    if (slow >= (interval > 50 ? 3 : 7))
      next = Math.max(floor, scale * (interval > 80 ? .74 : .88));
    else if (fastMs >= 1700)
      next = Math.min(ceiling, scale * 1.15);
    if (next === scale) return false;
    scale = next;
    slow = fastMs = 0;
    cooldown = 850;
    return true;
  }

  return { resize, sample, get scale() { return scale; }, get restingScale() { return resting; },
    resetTiming() { slow = fastMs = 0; } };
}
