import { Group, Mesh, MeshStandardMaterial, Vector3 } from "three";
import { describe, expect, it } from "vitest";
import { createFaultCable } from "../../scripts/pm/app/brain/faultCable";

function rig() {
  const room = new Group(), stock = new MeshStandardMaterial();
  const cable = createFaultCable(room, stock);
  for (const [zone, yaw] of [["build", -.46], ["verify", .56]] as const) {
    const point = (r:number, y:number) => new Vector3(Math.sin(yaw)*r,y,-Math.cos(yaw)*r);
    const route = [point(5,.026), point(5.32,.026), point(8.80,.026), point(9.66,.04), point(9.9,.82), point(10,1.19)];
    cable.register(zone,route,[point(2,.45),point(3.15,.026),...route],stock);
  }
  cable.finish();
  const jacket = room.getObjectByName("Station cable jackets") as Mesh;
  return {room,cable,indices:() => Array.from(jacket.geometry.index!.array)};
}

describe("a station's failed cable", () => {
  it("removes one jacket and one live conductor, and restores both after replay or recovery", () => {
    const {room,cable,indices} = rig();
    const original = indices(), middle = original.length/2;
    cable.set("verify");
    expect(room.getObjectByName("Cable to verify")!.visible).toBe(false);
    expect(room.getObjectByName("Cable to build")!.visible).toBe(true);
    expect(indices().slice(0,middle)).toEqual(original.slice(0,middle));
    expect(indices().slice(middle).every(i => i === 0)).toBe(true);
    const tip = cable.supplyPath.at(-1)!;
    expect(Math.hypot(tip.x,tip.z)).toBeLessThan(8);
    expect(tip.y).toBeGreaterThan(.25);
    const damaged = room.getObjectByName("Broken station cable")!;
    const cold = damaged.getObjectByName("Cold electrodes") as Mesh;
    const metal = cold.geometry.getAttribute("position"), nearest = new Vector3();
    for (let i = 0; i < metal.count; i++) {
      const vertex = new Vector3().fromBufferAttribute(metal,i);
      if (i === 0 || vertex.distanceToSquared(tip) < nearest.distanceToSquared(tip)) nearest.copy(vertex);
    }
    expect(nearest.distanceTo(tip)).toBeGreaterThan(.20);
    expect(nearest.distanceTo(tip)).toBeLessThan(.74);
    const gap = nearest.lerp(tip,.5);
    damaged.updateWorldMatrix(true,true);
    for (const part of damaged.children) {
      if (!part.visible || !(part instanceof Mesh)) continue;
      const vertices = part.geometry.getAttribute("position");
      let clearance = Infinity;
      for (let i = 0; i < vertices.count; i++)
        clearance = Math.min(clearance,new Vector3().fromBufferAttribute(vertices,i).applyMatrix4(part.matrixWorld).distanceTo(gap));
      expect(clearance).toBeGreaterThan(.09);
    }
    const jacket = damaged.getObjectByName("Torn insulation") as Mesh;
    const geometry = jacket.geometry;
    cable.set("verify");
    expect(jacket.geometry).toBe(geometry);
    cable.set("build");
    expect(indices().slice(middle)).toEqual(original.slice(middle));
    expect(room.getObjectByName("Cable to verify")!.visible).toBe(true);
    expect(room.getObjectByName("Cable to build")!.visible).toBe(false);
    cable.set(null);
    expect(damaged.visible).toBe(false);
    expect(indices()).toEqual(original);
    expect(cable.supplyPath).toHaveLength(0);
    expect(cable.damagePath).toHaveLength(0);
  });

  it("sleeps between brief local bursts and keeps both bare ends in quiet mode", () => {
    const {room,cable} = rig();
    expect(cable.nextWake(0)).toBe(Infinity);
    cable.set("build");
    const burst = cable.nextWake(0)+.08;
    expect(cable.nextWake(burst)).toBe(0);
    cable.paint(burst,true);
    expect(cable.opticalObjects.every(o => o.visible)).toBe(true);
    cable.paint(burst,false);
    expect(cable.opticalObjects.every(o => !o.visible)).toBe(true);
    expect(room.getObjectByName("Broken station cable")!.visible).toBe(true);
    cable.paint(burst+.52,true);
    expect(cable.opticalObjects.every(o => !o.visible)).toBe(true);
    expect(cable.nextWake(burst+.52)).toBeGreaterThan(2);
    cable.set(null);
    expect(cable.nextWake(burst)).toBe(Infinity);
  });
});
