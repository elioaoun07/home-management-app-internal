import { slideAgainstRoom, type Area, type Point } from "./layout";
import type { Pose } from "./protocol";

const walkSpeed = 2.4;
const runSpeed = 4.15;
const collisionStep = 1 / 120;
const stopSpeed = .015;
const contactNormal = { x: 0, z: 0 };
// Visibility/blur explicitly reset the simulation. A long foreground frame
// should still advance it; only discard time after a genuine suspension.
export const maxNavigationElapsed = .75;

export function movementKey(code: string, key: string) {
  if (/^Key[WASD]$/.test(code)) return code.slice(-1).toLowerCase();
  if (code === "ShiftLeft" || code === "ShiftRight") return code;
  if (key.startsWith("Arrow")) return key.toLowerCase();
  return "";
}

export function advanceWalk(
  pose: Pose,
  velocity: Point,
  area: Area,
  forward: number,
  side: number,
  elapsed: number,
  sprint = false,
) {
  // A suspended page can miss the normal visibility notification on resume.
  if (elapsed <= 0 || !Number.isFinite(elapsed)) return 0;
  if (elapsed > maxNavigationElapsed) {
    velocity.x = 0;
    velocity.z = 0;
    return 0;
  }

  const magnitude = Math.hypot(forward, side);
  const speed = (sprint && forward > .1 ? runSpeed : walkSpeed) / Math.max(1, magnitude);
  const sideDirection = Math.sin(pose.yaw), forwardDirection = Math.cos(pose.yaw);
  const targetX = speed * (-sideDirection * forward + forwardDirection * side);
  const targetZ = speed * (-forwardDirection * forward - sideDirection * side);
  const smoothing = magnitude ? .072 : .049;
  const steps = Math.ceil(elapsed / collisionStep);
  const dt = elapsed / steps;
  const response = -Math.expm1(-dt / smoothing);
  let distance = 0;
  for (let index = 0; index < steps; index++) {
    const oldX = pose.x, oldZ = pose.z;
    pose.x += targetX * dt + (velocity.x - targetX) * smoothing * response;
    pose.z += targetZ * dt + (velocity.z - targetZ) * smoothing * response;
    velocity.x += (targetX - velocity.x) * response;
    velocity.z += (targetZ - velocity.z) * response;
    if (!slideAgainstRoom(pose, velocity, area, contactNormal)) {
      // Two benches can form a gap narrower than the player's shoulders.
      pose.x = oldX; pose.z = oldZ;
      velocity.x = 0; velocity.z = 0;
    }
    distance += Math.hypot(pose.x - oldX, pose.z - oldZ);
  }
  if (!magnitude && Math.hypot(velocity.x, velocity.z) < stopSpeed) {
    velocity.x = 0;
    velocity.z = 0;
  }
  return distance;
}

export function restingGait() {
  return { phase: 0, weight: 0, sprint: 0, lift: 0, sway: 0 };
}

export function advanceGait(gait: ReturnType<typeof restingGait>, distance: number, elapsed: number) {
  if (elapsed <= 0 || elapsed > maxNavigationElapsed) return;
  // Actual travel determines the cadence, including while sliding along a
  // wall. Pressing directly into a solid surface does not generate footsteps.
  const speed = distance / elapsed;
  const running = Math.max(0, Math.min(1, (speed - walkSpeed) / (runSpeed - walkSpeed)));
  const response = -Math.expm1(-elapsed / .11);
  gait.sprint += (running - gait.sprint) * response;
  gait.weight += (Math.min(speed / walkSpeed, 1) - gait.weight) * response;
  if (gait.weight < .002 && speed < stopSpeed) {
    Object.assign(gait, restingGait());
    return;
  }
  gait.phase = (gait.phase + distance * Math.PI / (.91 + .23 * gait.sprint)) % (2 * Math.PI);
  gait.lift = -Math.cos(2 * gait.phase) * (.013 + .009 * gait.sprint) * gait.weight;
  gait.sway = Math.sin(gait.phase) * .009 * gait.weight;
}

