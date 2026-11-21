import * as T from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import type { ZoneId } from "../stage/config";

type Branch = {
  intact: T.Mesh;
  curve: T.CatmullRomCurve3;
  supply: T.Vector3[];
  offset: number;
  count: number;
};

const rodAxis = new T.Vector3(0, 1, 0);
const period = 11.3;
const strikes = [.63, 4.76, 8.41];
const sparkLife = .51;

function combine(parts: T.BufferGeometry[]) {
  const geometry = mergeGeometries(parts)!;
  for (const part of parts) part.dispose();
  return geometry;
}

function tube(points: T.Vector3[], radius: number, segments: number, sides = 8) {
  return new T.TubeGeometry(new T.CatmullRomCurve3(points), segments, radius, sides, false);
}

/** A complete jacket and conductor in normal operation. A single replacement
 * assembly is fitted to the recorded branch when it fails. Shared trunk and
 * adjacent station runs retain their original mesh and uninterrupted power. */
export function createFaultCable(outer: T.Group, recess: T.MeshStandardMaterial) {
  const branches = new Map<ZoneId, Branch>();
  const jackets: T.BufferGeometry[] = [];
  const jacket = new T.Mesh(new T.BufferGeometry(), recess);
  const repair = new T.Group();
  jacket.name = "Station cable jackets";
  repair.name = "Broken station cable";
  outer.add(jacket, repair);
  repair.visible = false;
  let indexCount = 0;
  let originalIndex: Uint32Array | Uint16Array | null = null;
  let selected: ZoneId | null = null, phaseOffset = 0;
  let supplyPath: T.Vector3[] = [], damagePath: T.Vector3[] = [];

  function surface(material: T.Material) {
    const part = new T.Mesh(new T.BufferGeometry(), material);
    repair.add(part);
    return part;
  }
  const rubber = new T.MeshStandardMaterial({color:"#253138",roughness:.80,metalness:.08});
  const ferrule = new T.MeshStandardMaterial({color:"#987959",roughness:.45,metalness:.60});
  const liveMetal = new T.MeshStandardMaterial({color:"#bc7d4c",emissive:"#e4914b",emissiveIntensity:.50,roughness:.39,metalness:.54});
  const coldMetal = new T.MeshStandardMaterial({color:"#806951",roughness:.63,metalness:.47});
  const sheath = surface(rubber), ferrules = surface(ferrule);
  const live = surface(liveMetal), cold = surface(coldMetal);
  sheath.name = "Torn insulation";
  cold.name = "Cold electrodes";
  // A thin deposit on the deck grounds the lifted ends. Alpha falls away in
  // uneven concentric bands so the existing deck seams still show through.
  const soot = new T.MeshBasicMaterial({color:"#221d18",vertexColors:true,transparent:true,depthWrite:false,
    polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1});
  const scorch = surface(soot);
  const scorchPosition: number[] = [], scorchInk: number[] = [], scorchIndex: number[] = [];
  const samples = 24;
  for (const [ring,alpha] of [[0,.55],[.34,.50],[.67,.23],[1,0]]) {
    for (let i = 0; i <= samples; i++) {
      const a = i*2*Math.PI/samples;
      const edge = 1 + .10*Math.sin(3*a+.52) + .063*Math.cos(7*a);
      scorchPosition.push(.51*ring*edge*Math.cos(a),0,.33*ring*edge*Math.sin(a));
      scorchInk.push(1,1,1,alpha*(.89+.11*Math.cos(5*a)));
      const k = scorchPosition.length/3-1;
      if (k>samples && i>0) scorchIndex.push(k,k-1,k-samples-1,k-samples-1,k-1,k-samples-2);
    }
  }
  scorch.geometry.setIndex(scorchIndex);
  scorch.geometry.setAttribute("position",new T.Float32BufferAttribute(scorchPosition,3));
  scorch.geometry.setAttribute("color",new T.Float32BufferAttribute(scorchInk,4));
  const discharge = new T.MeshBasicMaterial({color:"#ffe9c7",toneMapped:false,transparent:true,depthWrite:false,blending:T.AdditiveBlending});
  const halo = new T.MeshBasicMaterial({color:"#ffb477",toneMapped:false,transparent:true,depthWrite:false,blending:T.AdditiveBlending});
  const arc = surface(discharge), corona = surface(halo);
  const embers = new T.MeshBasicMaterial({color:"#ffce89",toneMapped:false,transparent:true,depthWrite:false,blending:T.AdditiveBlending});
  const sparks = new T.InstancedMesh(new T.SphereGeometry(1,6,4), embers, 5);
  sparks.instanceMatrix.setUsage(T.DynamicDrawUsage);
  sparks.frustumCulled = false;
  repair.add(sparks);
  const opticalObjects = [arc, corona, sparks];
  const arcAxis = new T.Vector3();
  for (const object of opticalObjects) { object.visible = false; object.renderOrder = 4; }

  function replace(mesh: T.Mesh, geometry: T.BufferGeometry) {
    mesh.geometry.dispose();
    mesh.geometry = geometry;
  }

  function register(zone: ZoneId, points: T.Vector3[], full: T.Vector3[], material: T.Material) {
    const curve = new T.CatmullRomCurve3(points);
    const intact = new T.Mesh(new T.TubeGeometry(curve,24,.032,5,false),material);
    intact.name = "Cable to " + zone;
    outer.add(intact);
    const casing = tube(points.map(p => new T.Vector3(p.x,p.y-.048,p.z)),.055,24,5);
    const count = casing.index!.count;
    jackets.push(casing);
    branches.set(zone,{intact,curve,supply:full.slice(0,full.length-points.length),offset:indexCount,count});
    indexCount += count;
  }
  function finish() {
    replace(jacket,combine(jackets));
    jackets.length = 0;
    const index = jacket.geometry.index!;
    originalIndex = new Uint32Array(index.array);
    index.setUsage(T.DynamicDrawUsage);
  }
  function intact(branch: Branch, visible: boolean) {
    branch.intact.visible = visible;
    const index = jacket.geometry.index!;
    const { offset, count } = branch;
    if (visible) index.array.set(originalIndex!.subarray(offset,offset+count),offset);
    else index.array.fill(0,offset,offset+count);
    index.addUpdateRange(offset,count);
    index.needsUpdate = true;
  }

  function fit(branch: Branch) {
    const path = branch.curve, length = path.getLength();
    // After the fork, on the open floor in front of this particular tool.
    const end = path.getPoint(1);
    const radius = Math.hypot(end.x,end.z);
    const breakRadius = radius - (radius < 8 ? 1.22 : 2.18);
    let station = 0, nearest = Infinity;
    for (let i = 0; i <= 64; i++) {
      const p = path.getPointAt(i/64);
      const distance = Math.abs(Math.hypot(p.x,p.z) - breakRadius);
      if (distance < nearest) { nearest = distance; station = i/64; }
    }
    const center = path.getPointAt(station);
    const forward = path.getTangentAt(station);
    forward.y = 0; forward.normalize();
    const across = new T.Vector3(-forward.z,0,forward.x);
    const local = (x:number,y:number,z:number) => center.clone().addScaledVector(forward,x)
      .addScaledVector(rodAxis,y).addScaledVector(across,z);
    const along = (meters:number) => T.MathUtils.clamp(station + meters / length,0,1);
    function sample(start:number,stop:number,count:number) {
      return Array.from({length:count+1},(_,i) => path.getPointAt(T.MathUtils.lerp(start,stop,i/count)));
    }
    // The tips curl slightly away from one another in all three axes. The air
    // gap reads when looking down the length of the cable and from the aisle.
    const hotRoot = local(-.31,.28,-.17), coldRoot = local(.31,.14,.16);
    const inside = [...sample(0,along(-.90),15),local(-.65,.052,-.045),local(-.46,.164,-.14),hotRoot];
    const outside = [coldRoot,local(.49,.097,.143),local(.66,.047,.055),...sample(along(.90),1,18)];
    replace(sheath,combine([tube(inside,.055,33),tube(outside,.055,36)]));
    const stripe = tube(inside.map(p=>new T.Vector3(p.x,p.y+.032,p.z)),.019,33);
    const collars: T.BufferGeometry[] = [], livePins = [stripe], deadPins: T.BufferGeometry[] = [];
    function terminate(points:T.Vector3[], head:T.Vector3, pins:T.BufferGeometry[], hot:boolean) {
      const out = head.clone().sub(points[points.length-2]).normalize();
      const rot = new T.Quaternion().setFromUnitVectors(rodAxis,out);
      for (const [offset,base,lip,depth] of [[-.107,.058,.066,.041],[-.066,.061,.075,.026],[-.028,.064,.076,.035]]) {
        const pos = head.clone().addScaledVector(out,offset);
        collars.push(new T.CylinderGeometry(lip,base,depth,12).applyQuaternion(rot).translate(pos.x,pos.y,pos.z));
      }
      // Bare, slightly splayed copper filaments remain visible between bursts.
      const vertical = new T.Vector3().crossVectors(across,out).normalize();
      let electrode = head;
      for (let i=0;i<5;i++) {
        const theta = Math.PI * 2 * i / 5;
        const radial = across.clone().multiplyScalar(Math.cos(theta)).addScaledVector(vertical,Math.sin(theta));
        const start = head.clone().addScaledVector(radial,.021);
        const mid = start.clone().addScaledVector(out,.066).addScaledVector(radial,.010);
        const tip = mid.clone().addScaledVector(out,i===0?.083:.046).addScaledVector(radial,.012);
        if (!hot) tip.y -= .021;
        pins.push(tube([start,mid,tip],i===0?.012:.009,4,6));
        if (i===0) electrode = tip;
      }
      return electrode;
    }
    const a = terminate(inside,hotRoot,livePins,true);
    const b = terminate(outside.slice().reverse(),coldRoot,deadPins,false);
    replace(ferrules,combine(collars)); replace(live,combine(livePins)); replace(cold,combine(deadPins));
    supplyPath = [...branch.supply,...inside,a];

    const coordinates = [[0,0,0],[.19,.038,.018],[.31,.023,-.021],[.54,.094,.035],
      [.66,.043,-.023],[.76,.053,.012],[.91,.018,-.007],[1,0,0]];
    const gap = coordinates.map(([f,y,z])=>a.clone().lerp(b,f).addScaledVector(rodAxis,y).addScaledVector(across,z));
    // Short piecewise-linear leaders are resolved in world space on all GPUs.
    function lightning(width:number) {
      const path = new T.CurvePath<T.Vector3>();
      for (let i=1;i<gap.length;i++) path.add(new T.LineCurve3(gap[i-1],gap[i]));
      return new T.TubeGeometry(path,22,width,5,false).translate(-a.x,-a.y,-a.z);
    }
    replace(arc,lightning(.009)); replace(corona,lightning(.027));
    arc.position.copy(a); corona.position.copy(a); arcAxis.subVectors(b,a).normalize();
    sparks.position.copy(a);
    sparks.rotation.y = Math.atan2(-forward.z,forward.x);
    scorch.position.set(center.x,.007,center.z); scorch.rotation.y = sparks.rotation.y;
    const extent = new T.Box3().setFromPoints([a,b]).expandByScalar(.68);
    damagePath = [];
    for (const x of [extent.min.x,extent.max.x]) for (const y of [extent.min.y,extent.max.y])
      for (const z of [extent.min.z,extent.max.z]) damagePath.push(new T.Vector3(x,y,z));
  }

  function set(zone: ZoneId | null) {
    if (zone === selected) return;
    if (selected) intact(branches.get(selected)!,true);
    for (const mesh of opticalObjects) mesh.visible = false;
    selected = zone;
    repair.visible = !!zone;
    if (!zone) { supplyPath = []; damagePath = []; return; }
    const branch = branches.get(zone)!;
    intact(branch,false);
    phaseOffset = (branch.offset % 491) / 113;
    fit(branch);
  }
  function phase(seconds:number) { return (seconds+phaseOffset) % period; }
  function nextWake(seconds:number) {
    if (!selected) return Infinity;
    const t = phase(seconds);
    for (const strike of strikes) {
      if (t < strike) return strike-t;
      if (t < strike+sparkLife) return 0;
    }
    return period-t+strikes[0];
  }
  const mote = new T.Object3D(), velocity = new T.Vector3();
  function paint(seconds:number,animate:boolean) {
    const t = phase(seconds);
    const burst = selected && animate ? strikes.findIndex(s => t >= s && t < s+sparkLife) : -1;
    const age = burst < 0 ? Infinity : t-strikes[burst];
    arc.visible = corona.visible = age < .18;
    sparks.visible = age >= .04 && age < sparkLife;
    if (arc.visible) {
      const strength = Math.sin(Math.PI * age / .18);
      const twist = .28*Math.sin(burst*2.46+.39) + .065*strength;
      arc.quaternion.setFromAxisAngle(arcAxis,twist); corona.quaternion.copy(arc.quaternion);
      discharge.opacity = .92*strength;
      halo.opacity = .16*strength;
    }
    if (!sparks.visible) return;
    const travel = age-.04;
    embers.opacity = Math.min(1,travel/.055) * (1 - travel/(sparkLife-.04))**1.35;
    for (let i = 0; i < sparks.count; i++) {
      const angle = i*2.4 + burst*1.15, speed = .39 + .065*i;
      const dx = Math.cos(angle)*speed, dz = Math.sin(angle)*speed, rise = 1.16 + .135*i;
      mote.position.set(dx*travel,rise*travel-2.86*travel*travel,dz*travel);
      velocity.set(dx,rise-5.72*travel,dz).normalize();
      mote.quaternion.setFromUnitVectors(rodAxis,velocity);
      mote.scale.set(.013,.042-i*.003,.013);
      mote.updateMatrix(); sparks.setMatrixAt(i,mote.matrix);
    }
    sparks.instanceMatrix.needsUpdate = true;
  }
  return {register,finish,set,paint,nextWake,opticalObjects,dispose:() => sparks.dispose(),
    get supplyPath() { return supplyPath; }, get damagePath() { return damagePath; }};
}
