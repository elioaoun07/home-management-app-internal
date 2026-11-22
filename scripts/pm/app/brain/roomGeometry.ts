import * as T from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

export const point = (x: number, y: number, z: number) => new T.Vector3(x, y, z);

export function mesh<M extends T.Material>(parent: T.Object3D, geometry: T.BufferGeometry, material: M, x = 0, y = 0, z = 0) {
  const object = new T.Mesh(geometry, material);
  object.position.set(x, y, z);
  parent.add(object);
  return object;
}
export function block<M extends T.Material>(parent: T.Object3D, material: M, x: number, y: number, z: number, w: number, h: number, d: number) {
  return mesh(parent, new T.BoxGeometry(w, h, d), material, x, y, z);
}
export function ring<M extends T.Material>(parent: T.Object3D, m: M, radius: number, width: number) {
  return mesh(parent, new T.TorusGeometry(radius, width, 6, 72), m);
}
export function strip(parent: T.Object3D, m: T.Material, points: T.Vector3[], radius = .027, segments = 24) {
  return mesh(parent, new T.TubeGeometry(new T.CatmullRomCurve3(points), segments, radius, 5, false), m);
}
export function beam(parent: T.Object3D, material: T.Material, from: T.Vector3, to: T.Vector3, width: number, depth: number) {
  const middle = from.clone().lerp(to, .5);
  const segment = block(parent, material, middle.x, middle.y, middle.z, from.distanceTo(to) + width * .28, width, depth);
  segment.quaternion.setFromUnitVectors(point(1, 0, 0), to.clone().sub(from).normalize());
}

export function batchPanels(source: T.Group) {
  const batches = new Map<T.Material, T.BufferGeometry[]>();
  source.updateWorldMatrix(true, true);
  const space = source.matrixWorld.clone().invert();
  const transform = new T.Matrix4();
  source.traverse(node => {
    if (!(node instanceof T.Mesh) || Array.isArray(node.material)) return;
    const group = batches.get(node.material) ?? [];
    node.geometry.applyMatrix4(transform.multiplyMatrices(space, node.matrixWorld));
    group.push(node.geometry);
    batches.set(node.material, group);
  });
  source.clear();
  for (const [material, parts] of batches) {
    const merged = mergeGeometries(parts);
    if (merged) mesh(source, merged, material);
    parts.forEach(geometry => geometry.dispose());
  }
}
