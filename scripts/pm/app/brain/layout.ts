import type { ZoneId } from "../stage/config";

export type Point = { x: number; z: number };
export type View = "map" | "walk" | "seat";
export type Finish = "realistic" | "illustrated";
export type Area = "room" | "core";
export const spawn = { x: 0, z: 7.5, yaw: 0, pitch: 0, area: "room" } as const;
export const chair = { x: -1.35, z: 3.32 };
export const roomRadius = 10;
const at = (degrees: number, radius: number) => ({
  x: Math.sin(degrees * Math.PI / 180) * radius,
  z: -Math.cos(degrees * Math.PI / 180) * radius,
});
export const bays = [
  { name: "Plan", angle: -126, zones: ["brief"] },
  { name: "Setup", angle: -88, zones: ["setup"] },
  { name: "Build", angle: -26, zones: ["explore", "think", "build", "bench", "seal"] },
  { name: "Verify", angle: 32, zones: ["verify"] },
  { name: "Test", angle: 76, zones: ["handover", "test"] },
  { name: "Ship", angle: 126, zones: ["ship"] },
] as const;
export const stations = bays.flatMap(({ angle, zones }) => zones.map((id, index) => {
  const heading = angle + (index - (zones.length - 1) / 2) * 9;
  const radius = id === "build" ? 7.35 : 10.65;
  return { id, angle: heading, ...at(heading, radius), arrival: at(heading, radius - 1.65) };
}));
export const zoneNames: Record<ZoneId, string> = {
  brief: "Plan", setup: "Setup", explore: "Explore", think: "Comms", build: "Build", bench: "Bench",
  seal: "Seal", verify: "Verify", handover: "Handover", test: "Test", ship: "Ship",
};
export function angularDistance(a: number, b: number) {
  return Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
}
export function bayAt(point: Point) {
  const angle = Math.atan2(point.x, -point.z);
  return bays.find(bay => angularDistance(angle, bay.angle * Math.PI / 180) < (bay.name === "Build" ? .48 : .25));
}
export function canStand(point: Point, area: Area) {
  const radius = Math.hypot(point.x, point.z);
  if (area === "core") return radius < 4.8 && radius > 1.0;
  const clear = radius < (bayAt(point) ? 12.1 : roomRadius - .32) && radius > 2.27;
  return clear && Math.hypot(point.x - chair.x, point.z - chair.z) > .50
    && stations.every(s => Math.hypot(point.x - s.x, point.z - s.z) > .67);
}
