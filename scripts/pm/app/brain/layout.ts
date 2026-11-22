import type { ZoneId } from "../stage/config";
import { OWNER_STATIONS, type OwnerStation } from "../ownerStations";

export type Point = { x: number; z: number };
export type View = "map" | "walk" | "seat";
export type Finish = "realistic" | "illustrated";
export type Area = "room" | "core";
export type Floor = "ai" | "owner";
// The doorway sightline clears the chair so the ERA sphere and the lit bay
// are both visible as soon as the player enters.
export const spawn = { x: .46, z: 6.62, yaw: .069, pitch: .055, area: "room" } as const;
export const chair = { x: -1.35, z: 3.32 };
export const roomRadius = 10;
export const roomPoint = (degrees: number, radius: number) => ({
  x: Math.sin(degrees * Math.PI / 180) * radius,
  z: -Math.cos(degrees * Math.PI / 180) * radius,
});
export const bays = [
  { name: "Plan", angle: -126, opening: .25, zones: ["brief"] },
  { name: "Setup", angle: -88, opening: .25, zones: ["setup"] },
  { name: "Build", angle: -26, opening: .48, zones: ["explore", "think", "build", "bench", "seal"] },
  { name: "Verify", angle: 32, opening: .25, zones: ["verify"] },
  { name: "Test", angle: 76, opening: .25, zones: ["handover", "test"] },
  { name: "Ship", angle: 126, opening: .25, zones: ["ship"] },
] as const;
export type BayName = (typeof bays)[number]["name"];
export const stations = bays.flatMap(({ angle, zones }) => zones.map((id, index) => {
  const heading = angle + (index - (zones.length - 1) / 2) * 9;
  const radius = id === "build" ? 7.35 : 10.65;
  return { id, angle: heading, bay: angle, radius, ...roomPoint(heading, radius), arrival: roomPoint(heading, radius - 1.65) };
}));
export const ownerStations3D = OWNER_STATIONS.map(({ id }, i) => {
  const angle = bays[i].angle, radius = 10.65;
  return { id, angle, bay: angle, radius, ...roomPoint(angle, radius), arrival: roomPoint(angle, radius - 2) };
});
const ownerDestinations: Record<ZoneId, OwnerStation> = {
  brief: "review", setup: "test", explore: "review", think: "review", build: "merge", bench: "test",
  seal: "commit", verify: "review", handover: "test", test: "test", ship: "push",
};
export function ownerStationForZone(zone: ZoneId): OwnerStation {
  return ownerDestinations[zone];
}
// Local +Z points out of the cabin and into the room. Both landings occupy
// the same open sector of the observatory, between Ship and the entrance.
export const liftAngle = -159 * Math.PI / 180;
const liftCenter = roomPoint(159, 8.02);
export function liftPoint(x: number, z: number) {
  return { x: liftCenter.x + Math.cos(liftAngle) * x + Math.sin(liftAngle) * z,
    z: liftCenter.z - Math.sin(liftAngle) * x + Math.cos(liftAngle) * z };
}
export const liftPanel = liftPoint(.86, .40);
export const liftCall = liftPoint(-1.14, 1.18);
export const liftThreshold = liftPoint(0, 2.82);
export const liftEntrance = liftPoint(-.25, 1.13);
export const liftPassenger = { ...liftPoint(-.05, -.44), yaw: liftAngle + Math.PI, pitch: .015 };
export const zoneNames: Record<ZoneId, string> = {
  brief: "Plan", setup: "Setup", explore: "Explore", think: "Comms", build: "Build", bench: "Bench",
  seal: "Seal", verify: "Verify", handover: "Handover", test: "Test", ship: "Ship",
};
export function angularDistance(a: number, b: number) {
  return Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
}
export function bayAt(point: Point) {
  const angle = Math.atan2(point.x, -point.z);
  return bays.find(bay => angularDistance(angle, bay.angle * Math.PI / 180) < bay.opening);
}
// Horizontal section of a standing player's capsule. Camera pitch and gait
// never change its footprint or allow the player to clip through furniture.
export const playerRadius = .27;
const hallWall = roomRadius - .20, bayWall = 12.13;

function footprint(center: Point, yaw: number, halfWidth: number, halfDepth: number) {
  return { ...center, cos: Math.cos(yaw), sin: Math.sin(yaw), halfWidth, halfDepth };
}
const sharedFixtures = [
  footprint(chair, .38, .56, .34),
  footprint({ x: chair.x * .73, z: chair.z * .73 }, .38, .425, .20),
  footprint(liftPoint(-1.10,0),liftAngle,.09,1.02),
  footprint(liftPoint(1.10,0),liftAngle,.09,1.02),
  footprint(liftPoint(0,-1.06),liftAngle,1.14,.08),
  footprint(liftPoint(-.96,1.06),liftAngle,.23,.12),
  footprint(liftPoint(.96,1.06),liftAngle,.23,.12),
];
const workFixtures = (items: readonly { x:number;z:number;angle:number }[]) =>
  [...sharedFixtures, ...items.map(s=>footprint(s,-s.angle*Math.PI/180,.61,.45))];
const roomFixtures = workFixtures(stations), ownerFixtures = workFixtures(ownerStations3D);
export const coreStations = [
  ["previous", -3, -1.75, "Previous"], ["present", 0, -3.5, "Selected"],
  ["next", 3, -1.75, "Next"], ["exit", 0, 4, "Room"],
] as const;
const coreFixtures = coreStations.map(([, x, z]) =>
  footprint({ x, z }, Math.atan2(-x, -z), .55, .24));

// Follow the actual outline, including the two jambs of each doorway. A
// circular player passes smoothly round the exposed corners from either side.
function perimeter() {
  const vertices: Point[] = [];
  const add = (angle: number, distance: number) => vertices.push({
    x: Math.sin(angle) * distance, z: -Math.cos(angle) * distance,
  });
  function arc(start: number, end: number, radius: number) {
    const count = Math.ceil((end - start) / .09);
    for (let i = 0; i <= count; i++) add(start + (end - start) * i / count, radius);
  }
  let angle = -Math.PI;
  for (const bay of bays) {
    const center = bay.angle * Math.PI / 180;
    arc(angle, center - bay.opening, hallWall);
    arc(center - bay.opening, center + bay.opening, bayWall);
    angle = center + bay.opening;
  }
  arc(angle, Math.PI, hallWall);
  return vertices.slice(1).map((end, i) => {
    const start = vertices[i];
    const dx = end.x - start.x, dz = end.z - start.z;
    return { ...start, dx, dz, lengthSquared: dx * dx + dz * dz };
  });
}
const walls = perimeter();

// Positive distance is free space. During movement we only need contacts
// within the player's radius; the optional normal points into the free space.
function clearance(point: Point, area: Area, normal?: Point, floor: Floor = "ai") {
  const radius = Math.hypot(point.x, point.z);
  let nearest = radius - (area === "core" ? .77 : 2.23);
  if (normal) { normal.x = point.x / (radius || 1); normal.z = radius ? point.z / radius : 1; }
  if (area === "core" && 5.08 - radius < nearest) {
    nearest = 5.08 - radius;
    if (normal) { normal.x = -point.x / radius; normal.z = -point.z / radius; }
  }
  const fixtures = area === "core" ? coreFixtures : floor === "owner" ? ownerFixtures : roomFixtures;
  for (const item of fixtures) {
    const dx = point.x - item.x, dz = point.z - item.z;
    if (Math.abs(dx) > 1.7 || Math.abs(dz) > 1.7) continue;
    const x = item.cos * dx - item.sin * dz, z = item.sin * dx + item.cos * dz;
    const ax = Math.abs(x) - item.halfWidth, az = Math.abs(z) - item.halfDepth;
    const px = Math.max(ax, 0), pz = Math.max(az, 0);
    const outside = Math.hypot(px, pz);
    const distance = outside + Math.min(Math.max(ax, az), 0);
    if (distance >= nearest) continue;
    nearest = distance;
    if (normal) {
      const nx = (outside ? px / outside : Number(ax > az)) * (x < 0 ? -1 : 1);
      const nz = (outside ? pz / outside : Number(az >= ax)) * (z < 0 ? -1 : 1);
      normal.x = item.cos * nx + item.sin * nz;
      normal.z = -item.sin * nx + item.cos * nz;
    }
  }
  if (area === "room" && radius > hallWall - playerRadius - .04) {
    for (const wall of walls) {
      const x = point.x - wall.x, z = point.z - wall.z;
      const fraction = Math.max(0, Math.min(1, (x * wall.dx + z * wall.dz) / wall.lengthSquared));
      const nx = x - wall.dx * fraction, nz = z - wall.dz * fraction;
      const squared = nx * nx + nz * nz;
      if (nearest < 0 || squared >= nearest * nearest) continue;
      nearest = Math.sqrt(squared);
      if (normal && nearest) { normal.x = nx / nearest; normal.z = nz / nearest; }
    }
  }
  return nearest;
}

export function canStand(point: Point, area: Area, floor: Floor = "ai") {
  if (area === "room" && Math.hypot(point.x, point.z) > (bayAt(point) ? bayWall : hallWall)) return false;
  return clearance(point, area, undefined, floor) >= playerRadius - .00001;
}

export function slideAgainstRoom(point: Point, velocity: Point, area: Area, normal: Point, floor: Floor = "ai") {
  for (let pass = 0; pass < 3; pass++) {
    const penetration = playerRadius - clearance(point, area, normal, floor);
    if (penetration <= 0) return true;
    point.x += normal.x * (penetration + .000001);
    point.z += normal.z * (penetration + .000001);
    const inward = Math.min(0, velocity.x * normal.x + velocity.z * normal.z);
    velocity.x -= inward * normal.x;
    velocity.z -= inward * normal.z;
  }
  return canStand(point, area, floor);
}
