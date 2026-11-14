import type { CoreSessionState } from "./coreState";

export interface CoreDynamics {
  /** Unwrapped degrees preserve the wheel's phase through every speed change. */
  angle: number;
  speed: number;
  energy: number;
  throttleRemaining: number;
  elapsed: number;
}

const REST_SPEED: Record<CoreSessionState["state"], number> = {
  idle: 22.5,
  running: 1080,
  attention: 11.25,
  success: 30,
  failed: 0,
  unknown: 22.5,
};

export function createCoreDynamics(): CoreDynamics {
  return {
    angle: 0,
    speed: REST_SPEED.idle,
    energy: 0,
    throttleRemaining: 0,
    elapsed: 0,
  };
}

/** Adding throttle extends the drive without resetting momentum or particles. */
export function kickCore(model: CoreDynamics): void {
  model.throttleRemaining = 2.4;
}

function advance(
  model: CoreDynamics,
  state: CoreSessionState["state"],
  seconds: number,
  driven: boolean,
): void {
  const targetSpeed =
    state === "failed" ? 0 : driven ? 1440 : REST_SPEED[state];
  const targetEnergy = driven ? 1 : state === "running" ? 0.82 : 0;
  const speedTau = targetSpeed > model.speed ? 0.18 : 1.05;
  const heatTau = targetEnergy > model.energy ? 0.16 : 0.85;
  const speedResponse = -Math.expm1(-seconds / speedTau);

  // Integrate the exponential velocity analytically. Euler integration makes
  // the distance depend on refresh rate and causes a visible phase jump.
  model.angle +=
    targetSpeed * seconds +
    (model.speed - targetSpeed) * speedTau * speedResponse;
  model.speed += (targetSpeed - model.speed) * speedResponse;
  model.energy +=
    (targetEnergy - model.energy) * -Math.expm1(-seconds / heatTau);
}

/**
 * Advance visible animation time, in seconds. The caller owns hidden/offscreen
 * pauses and caps resumed-frame deltas; this model is independent of frame rate.
 */
export function stepCoreDynamics(
  model: CoreDynamics,
  state: CoreSessionState["state"],
  seconds: number,
): void {
  if (!Number.isFinite(seconds) || seconds <= 0) return;

  // A frame can cross the end of the drive. Account for both sides exactly so
  // release does not land on a different frame at 30, 60 or 120 Hz.
  const drivenSeconds = Math.min(model.throttleRemaining, seconds);
  if (drivenSeconds > 0) advance(model, state, drivenSeconds, true);
  const coastSeconds = seconds - drivenSeconds;
  if (coastSeconds > 0) advance(model, state, coastSeconds, false);
  model.throttleRemaining = Math.max(0, model.throttleRemaining - seconds);
  model.elapsed += seconds;
}
