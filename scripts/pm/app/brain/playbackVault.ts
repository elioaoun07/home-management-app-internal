import * as T from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { coreStations } from "./layout";

/** An indexed instrument room built from the same machined rings as the ERA
 * mark. Playback stations and apertures are at physical, walkable positions. */
export function fitPlaybackVault(inner: T.Group) {
  const midnight = new T.MeshStandardMaterial({color:"#142332",metalness:.18,roughness:.58});
  const ceramic = new T.MeshStandardMaterial({color:"#526778",metalness:.37,roughness:.46});
  const rail = new T.MeshStandardMaterial({color:"#a9c4c7",metalness:.54,roughness:.36});
  const signal = new T.MeshStandardMaterial({color:"#aed6d9",emissive:"#75d4df",emissiveIntensity:.50});
  const batches = new Map<T.Material,T.BufferGeometry[]>();
  function add(material: T.Material, geometry: T.BufferGeometry) {
    const parts = batches.get(material) ?? [];
    parts.push(geometry); batches.set(material,parts);
  }
  const turn = Math.PI*2;
  function hoop(radius: number,width:number,y:number, material:T.Material) {
    add(material,new T.TorusGeometry(radius,width,8,80).rotateX(Math.PI/2).translate(0,y,0));
  }
  // Keep the dark recess and the off-white reveal on different radii. The
  // slit between neighbouring panels exposes the uninterrupted rear liner.
  const liner = new T.Mesh(new T.CylinderGeometry(6.53,6.53,6.7,48,1,true),
    new T.MeshBasicMaterial({color:"#101f30",side:T.BackSide}));
  liner.position.y=2.8; inner.add(liner);
  for (let i=0; i<20; i++) {
    const angle=i*turn/20;
    const place = (geometry:T.BufferGeometry,r:number,y:number) => geometry.translate(0,y,r).rotateY(angle);
    add(midnight,place(new T.BoxGeometry(1.64,4.78,.24),5.84,2.26));
    add(ceramic,place(new T.BoxGeometry(.095,4.8,.22),5.64,2.24));
    add(rail,place(new T.BoxGeometry(1.54,.14,.19),5.62,.36));
    add(rail,place(new T.BoxGeometry(1.57,.12,.16),5.63,4.29));
    add(signal,place(new T.BoxGeometry(.38,.05,.12),5.51,3.94));
    for (let j=0;j<3;j++) add(ceramic,place(new T.BoxGeometry(.68,.034,.10),5.60,1.25+j*.14));
    const slat = new T.BoxGeometry(.23,.16,4.42).rotateX(.26);
    add(ceramic,place(slat,3.75,4.95));
  }
  for (const [r,y] of [[5.46,.14],[5.56,3.78],[5.48,4.47],[2.13,5.41],[1.47,5.37]]) hoop(r,.074,y,rail);
  hoop(1.94,.057,5.34,signal); hoop(1.35,.035,5.28,signal);
  add(midnight,new T.CylinderGeometry(5.95,5.95,.26,60).translate(0,5.76,0));
  // The selected topic's smaller sphere floats above a recessed optical bed.
  add(midnight,new T.CylinderGeometry(.72,.78,.23,48).translate(0,.115,0));
  hoop(.66,.032,.24,signal); hoop(.47,.027,.25,rail);
  for (const [,x,z] of coreStations) {
    const yaw=Math.atan2(-x,-z);
    const place=(g:T.BufferGeometry,dx:number,y:number,dz:number) => g.translate(dx,y,dz).rotateY(yaw).translate(x,0,z);
    add(rail,place(new T.CylinderGeometry(.54,.60,.12,8),0,.063,0));
    add(ceramic,place(new T.CylinderGeometry(.37,.48,.37,12),0,.27,0));
    for (const side of [-1,1]) add(rail,place(new T.BoxGeometry(.074,.46,.35),side*.47,.70,0));
    add(rail,place(new T.BoxGeometry(1.07,.056,.48),0,1.02,0));
    add(signal,place(new T.BoxGeometry(.11,.045,.026),.35,1.16,.08));
  }
  for (const [material,parts] of batches) {
    inner.add(new T.Mesh(mergeGeometries(parts)!,material));
    parts.forEach(part=>part.dispose());
  }
}
