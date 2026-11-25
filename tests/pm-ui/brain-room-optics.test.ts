import { describe, expect, it } from "vitest";
import { Mesh, MeshStandardMaterial, PerspectiveCamera, ShaderMaterial, Vector3 } from "three";
import { ambientRegion } from "../../scripts/pm/app/brain/ambientRegion";
import { makeSphere } from "../../scripts/pm/app/brain/topicSphere";

it("repaints the current workstation beyond the collector on software graphics", () => {
  const camera = new PerspectiveCamera(65, 16 / 9, .08, 63);
  camera.position.set(0, 1.65, 7);
  camera.updateMatrixWorld();
  const center = new Vector3(0, 2, 0);
  const desk = new Vector3(8, .055, -3);
  const width = 1280, height = 720;
  const damage = ambientRegion();
  const without = damage(camera, width, height, center, 2.06, [])!;
  const withDesk = damage(camera, width, height, center, 2.06, [], desk)!;
  // At the expanded edge of the floor ring and the highest tip of the pointer.
  for (const point of [desk.clone().add(new Vector3(1.03, 0, 0)), new Vector3(desk.x, 2.50, desk.z)]) {
    point.project(camera);
    const x = (point.x + 1) * width / 2, y = (1 - point.y) * height / 2;
    expect(x).toBeGreaterThan(without.x + without.width);
    expect(x).toBeGreaterThanOrEqual(withDesk.x);
    expect(x).toBeLessThanOrEqual(withDesk.x + withDesk.width);
    expect(y).toBeGreaterThanOrEqual(withDesk.y);
    expect(y).toBeLessThanOrEqual(withDesk.y + withDesk.height);
  }
});

describe.each([false,true])("ERA optics (software %s)", software => {
  it("turns continuously, holds a frozen clock, and preserves the topic card heading", () => {
    const {orb,paint} = makeSphere("trip",false,software);
    const cue = orb.getObjectByName("ERA cue · trip")!;
    paint(.9,0,2,false);
    const first = orb.rotation.y;
    paint(.9,0,3,false);
    const second = orb.rotation.y;
    expect(second - first).toBeGreaterThan(.16);
    paint(.9,0,4,false);
    expect(orb.rotation.y - second).toBeCloseTo(second - first);
    paint(.9,0,32,false);
    expect(orb.rotation.y - first).toBeGreaterThan(Math.PI*2);
    expect(Math.abs(orb.rotation.y + cue.rotation.y)).toBeLessThan(.55);
    const fixed = cue.quaternion.toArray();
    paint(.9,0,32,false);
    expect(cue.quaternion.toArray()).toEqual(fixed);
    const plasma = orb.getObjectByName("Plasma discharge") as Mesh;
    const clock = (plasma.material as ShaderMaterial).uniforms.tick;
    paint(.9,0,33,false,false,7);
    paint(.9,0,36,false,false,7);
    expect(clock.value).toBe(7);
    expect(cue.quaternion.toArray()).not.toEqual(fixed);
  });

  it("retains dark fractured glass through a failed replay and restores the intact finish", () => {
    const {orb,paint} = makeSphere("schedule",false,software);
    const collector = orb.getObjectByName("Collector") as Mesh;
    const metal = collector.material as MeshStandardMaterial;
    const original = metal.color.getHex();
    const plasma = orb.getObjectByName("Plasma discharge")!;
    const coat = orb.children.find(part => part.renderOrder === 2) as Mesh;
    const shell = orb.children.find(part => part.renderOrder === 1) as Mesh;
    orb.layers.enable(2);
    paint(.91,.2,6,false);
    const atStop = orb.rotation.y;
    paint(.91,.2,8,false,true);
    const scar = orb.getObjectByName("Fractured glass") as Mesh;
    expect(scar.visible).toBe(true);
    expect(scar.layers.mask).toBe(orb.layers.mask);
    expect(scar.geometry.getAttribute("position").count).toBeGreaterThan(350);
    expect(plasma.visible).toBe(false);
    expect(metal.color.getHex()).not.toBe(original);
    expect(metal.emissiveIntensity).toBe(0);
    expect((coat.material as ShaderMaterial).uniforms.failure.value).toBe(1);
    expect((shell.material as ShaderMaterial).uniforms.power.value).toBe(0);
    paint(1,1,15,true,true);
    expect(orb.rotation.y).toBe(atStop);
    expect(orb.getObjectByName("Fractured glass")).toBe(scar);
    expect(scar.visible).toBe(true);
    paint(.91,0,16,true);
    expect(scar.visible).toBe(false);
    expect(plasma.visible).toBe(true);
    expect(metal.color.getHex()).toBe(original);
    expect((coat.material as ShaderMaterial).uniforms.failure.value).toBe(0);
    expect(metal.emissiveIntensity).toBeGreaterThan(0);
  });
});
