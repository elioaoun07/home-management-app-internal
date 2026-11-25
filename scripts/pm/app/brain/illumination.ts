import * as T from "three";
import type { OwnerStation } from "../ownerStations";
import type { makeRoom, makeSphere } from "./art";
import type { Area } from "./layout";
import type { Signal, WorldState } from "./protocol";

type Room = ReturnType<typeof makeRoom>;
type Sphere = ReturnType<typeof makeSphere>;
const tracePoints = 33;
const outcomes = ["passed", "failed", "inconclusive"] as const;
const colors = {
  owner: new T.Color("#ffc37b"),
  fault: new T.Color("#e79d6b"),
  passed: new T.Color("#98e9ba"),
  failed: new T.Color("#ffc27e"),
  inconclusive: new T.Color("#ddd0ee"),
};

/** A world-space strip with a subpixel core and a soft corona. Its path is
 * written on a receipt or routing change; only uniforms change each frame. */
function conductor(strands: number, segments: number, flowing: boolean) {
  const points = (segments + 1) * 2;
  const position = new T.Float32BufferAttribute(new Float32Array(points * strands * 3), 3);
  const tangent = new T.Float32BufferAttribute(new Float32Array(points * strands * 3), 3);
  const shape: number[] = [], indices: number[] = [];
  for (let strand = 0; strand < strands; strand++) {
    for (let i = 0; i <= segments; i++) {
      shape.push(i / segments, -1, strand, i / segments, 1, strand);
      if (i === segments) continue;
      const k = strand * points + 2*i;
      indices.push(k, k+1, k+2, k+1, k+3, k+2);
    }
  }
  const geometry = new T.BufferGeometry();
  geometry.setAttribute("position", position);
  geometry.setAttribute("direction", tangent);
  geometry.setAttribute("shape", new T.Float32BufferAttribute(shape, 3));
  geometry.setIndex(indices);
  const material = new T.ShaderMaterial({
    uniforms: {
      tint: { value: new T.Color() }, tick: { value: 0 }, gain: { value: 1 },
      flow: { value: Number(flowing) }, inward: { value: 0 },
    },
    side:T.DoubleSide, forceSinglePass:true, transparent:true, depthWrite:false, blending:T.AdditiveBlending,
    vertexShader:`
      attribute vec3 direction, shape;
      uniform float flow;
      varying vec3 line;
      void main() {
        line=shape;
        vec4 view=modelViewMatrix*vec4(position,1.);
        vec3 tangent=mat3(modelViewMatrix)*direction;
        vec3 side=normalize(cross(tangent,normalize(-view.xyz))+vec3(.000001));
        float width=mix(.081,.056,flow)*mix(1.,.49,step(.5,shape.z));
        view.xyz+=side*shape.y*width;
        gl_Position=projectionMatrix*view;
      }`,
    fragmentShader:`
      varying vec3 line;
      uniform vec3 tint;
      uniform float tick, gain, flow, inward;
      void main() {
        float hot=pow(max(0.,1.-abs(line.y)),5.);
        float corona=pow(max(0.,1.-abs(line.y)),1.65);
        float along=mix(line.x,1.-line.x,inward);
        float tail=mod(tick-along*1.48,1.);
        float wave=flow>.5 ? exp(-tail*12.)*(1.-smoothstep(.94,1.,tail)) : 1.-smoothstep(tick,tick+.12,along);
        float alpha=gain*wave*mix(1.,.56,step(.5,line.z));
        vec3 light=(tint*1.2+vec3(.045,.035,.1))*corona+vec3(.73,.84,1.)*hot*1.2;
        gl_FragColor=vec4(light,alpha);
        #include <colorspace_fragment>
      }`,
  });
  const mesh = new T.Mesh(geometry, material);
  mesh.frustumCulled=false;
  mesh.renderOrder=4;
  mesh.visible=false;
  const path = Array.from({length:segments+1}, () => new T.Vector3());
  const axis = new T.Vector3();
  function write(strand: number, sample: (fraction: number, point: T.Vector3) => void) {
    for (let i=0; i<=segments; i++) sample(i/segments,path[i]);
    for (let i=0; i<=segments; i++) {
      const p=path[i];
      axis.subVectors(path[Math.min(segments,i+1)],path[Math.max(0,i-1)]).normalize();
      for (let side=0; side<2; side++) {
        const at=strand*points+i*2+side;
        position.setXYZ(at,p.x,p.y,p.z); tangent.setXYZ(at,axis.x,axis.y,axis.z);
      }
    }
    position.needsUpdate=tangent.needsUpdate=true;
  }
  return {mesh, write, uniforms:material.uniforms};
}

export function createIllumination(scene: T.Scene, room: Room) {
  const coreLight = new T.PointLight(0xffffff, 1, 8, 2);
  const bayLamp = new T.PointLight(0xffffff, 0, 7, 2);
  const leader = conductor(3, 38, false), current = conductor(1, 76, true);
  scene.add(leader.mesh, current.mesh);
  const lineMaterial = new T.LineBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, blending: T.AdditiveBlending });
  const traces = Array.from({ length: 3 }, () => {
    const geometry = new T.BufferGeometry().setAttribute("position", new T.BufferAttribute(new Float32Array(tracePoints * 3), 3));
    const line = new T.Line(geometry, lineMaterial);
    line.frustumCulled = false; line.visible = false;
    return line;
  });
  const sparkMaterial = new T.MeshBasicMaterial({ color: "#d6fbff", toneMapped: false });
  const spark = new T.Mesh(new T.SphereGeometry(.068, 12, 8), sparkMaterial);
  spark.visible = false;
  const halo = new T.Mesh(new T.RingGeometry(.82, .875, 64), new T.MeshBasicMaterial({
    transparent: true, toneMapped: false, depthWrite: false, blending: T.AdditiveBlending,
  }));
  halo.rotation.x = -Math.PI / 2;
  halo.visible = false;
  const pointer = new T.Mesh(new T.ConeGeometry(.19, .30, 4), new T.MeshBasicMaterial({ toneMapped: false }));
  pointer.rotation.z = Math.PI;
  pointer.visible = false;
  scene.add(coreLight, bayLamp, ...traces, spark, halo, pointer);

  const bayParts = [...new Map([...room.circuits.values()].map(part => [part.bay, part])).values()];
  const machineRest = new Map([...room.machines].map(([zone, machine]) => [zone, machine.moving.position.z]));
  const sparkPosition = new T.Vector3();
  let routed: WorldState["lighting"]["endpoint"] = null;
  let flight: { signal: Signal; path: T.CatmullRomCurve3; start: number } | null = null;
  let ownerPulse: { source: T.Vector3; start: number } | null = null;
  let energy = .05, prior = 0, clock = 0, rotationClock = 0, firstWork = true, steady = false;

  function clear() {
    flight = null;
    ownerPulse = null;
    current.mesh.visible = false;
    leader.mesh.visible = false;
    spark.visible = false;
    for (const trace of traces) trace.visible = false;
  }
  function pulseOwner(id: OwnerStation, start: number) {
    const source = room.ownerMarkers.get(id), route = room.ownerRoute(id);
    if (room.deck !== "owner" || !source || !route) return;
    clear();
    // Reuse the AI floor's traveling conductor over the physical desk lead.
    // Invalidate its cached SDK endpoint when that circuit is borrowed.
    routed = null;
    current.write(0, (fraction, sample) => { route.getPointAt(fraction, sample); sample.y += .035; });
    ownerPulse = { source, start };
  }
  function play(signal: Signal, start: number) {
    const branch = room.circuits.get(signal.zone);
    if (!branch) return;
    const conduit = signal.kind === "question" ? room.seatCircuit.path : branch.path;
    const landing = conduit.findIndex(p => Math.hypot(p.x,p.z)>=4.7);
    const join = landing<0 ? Math.max(0,conduit.length-2) : landing;
    const sink = conduit[join];
    const azimuth = Math.atan2(sink.x,sink.z);
    const onRadius = (r:number,y:number,turn:number) => new T.Vector3(
      Math.sin(azimuth+turn)*r,y,Math.cos(azimuth+turn)*r,
    );
    // Start on the glass shoulder and fan over its edge into the selected
    // circuit. Opposite-bay discharges clear the face of the globe.
    const direction = Math.sin(azimuth)*Math.cos(azimuth)>=0 ? 1 : -1;
    const radial = Math.hypot(sink.x,sink.z);
    const leaderPath = new T.CatmullRomCurve3([
      onRadius(1.42,3.53,direction*.57), onRadius(2.27,3.63,direction*.70),
      onRadius(radial*.74,2.20,direction*.65),onRadius(radial*.92,.70,direction*.19),
      sink.clone().add(new T.Vector3(0,.043,0)),
    ]);
    let seed = 0;
    for (const char of signal.id) seed = (seed * 31 + char.charCodeAt(0)) | 0;
    const side = onRadius(1,0,Math.PI/2);
    function strandAt(t:number,p:T.Vector3) {
      leaderPath.getPointAt(t,p);
      const k=Math.sin(t*Math.PI);
      return p.addScaledVector(side,k*(Math.sin(t*43+seed%17)*.049+Math.sin(t*77+seed%11)*.023));
    }
    leader.write(0,strandAt);
    for (let i=1; i<=2; i++) {
      leader.write(i,(f,p) => {
        const t=(i===1?.22:.49)+f*(i===1?.42:.35);
        strandAt(t,p);
        const spread=Math.sin(f*Math.PI);
        p.addScaledVector(side,spread*(i===1?.25:-.16)*(1+.21*Math.sin(t*57)));
        p.y+=spread*.10;
      });
    }
    leader.uniforms.inward.value=Number(signal.kind==="read");
    const route = [...leaderPath.getSpacedPoints(9), ...conduit.slice(join+1)];
    if (signal.kind === "handover") route.push(...branch.path.slice(0,-1).reverse(),...room.seatCircuit.path.slice(1));
    if (signal.kind === "read") route.reverse();
    const path = new T.CatmullRomCurve3(route, false, "centripetal");
    flight = { signal, path, start };
    for (let index = 0; index < traces.length; index++) {
      const trace = traces[index];
      const positions = trace.geometry.getAttribute("position");
      for (let i = 0; i < tracePoints; i++) {
        const fraction = i / (tracePoints - 1);
        const point = path.getPointAt(fraction, sparkPosition);
        const branchWidth = Math.sin(fraction * Math.PI) * index * .11;
        const side = branchWidth * Math.sin(fraction * 49 + index * 5 + seed % 47);
        const up = branchWidth * (.36 + Math.abs(Math.cos(fraction * 34)) * .65);
        positions.setXYZ(i, point.x + side, point.y + up, point.z - side * .55);
      }
      positions.needsUpdate = true;
      trace.visible = index === 0 || signal.kind === "edit";
    }
  }
  function paint(now: number, state: WorldState, sphere: Sphere, area: Area, animate: boolean, ambient: boolean) {
    const { lighting } = state;
    room.faultCable.set(room.deck === "ai" ? lighting.faultZone : null);
    room.faultCable.paint(now / 1000, animate && area === "room");
    const dt = prior ? Math.min(.1, (now - prior) / 1000) : 0;
    prior = now;
    if (ambient) {
      if (firstWork) { energy = .05; firstWork = false; }
      energy = T.MathUtils.damp(energy, lighting.energy, 4.3, dt);
    } else energy = lighting.energy;
    steady = Math.abs(energy - lighting.energy) < .003;
    if (steady) energy = lighting.energy;
    if (ambient) clock += dt * (.52 + energy * 1.37);
    if (animate && !lighting.failed) rotationClock += dt;
    let boost = 0, contact = 0;
    if (flight) {
      const { signal } = flight;
      const gather = signal.kind === "edit" ? 100 : 0;
      const move = signal.kind === "handover" ? 730 : 450;
      const settle = signal.kind === "handover" ? 170 : 180;
      const age = now - flight.start;
      if (!animate || area !== "room" || age >= gather + move + settle) {
        clear();
      } else {
        const progress = T.MathUtils.clamp((age - gather) / move, 0, 1);
        contact = age >= gather + move ? 1 - (age - gather - move) / settle : 0;
        boost = progress < .35 ? .8 * Math.sin(age / Math.max(1, gather + move * .35) * Math.PI * .5) : .25 + contact * .45;
        flight.path.getPointAt(progress, sparkPosition);
        spark.position.copy(sparkPosition);
        spark.visible = age >= gather;
        spark.scale.setScalar(.9 + contact * 1.2);
        lineMaterial.color.copy(lighting.owner ? colors.owner : sphere.tint);
        leader.mesh.visible = true;
        leader.uniforms.tint.value.copy(lineMaterial.color);
        // Reverse reads strike the glass on arrival. Outgoing receipts first
        // gather on it, then release and leave the bay's standing power level.
        const strike = signal.kind === "read" ? T.MathUtils.clamp((progress-.50)*2,0,1) : Math.min(1,progress*2.2);
        leader.uniforms.tick.value = strike;
        leader.uniforms.gain.value = signal.kind === "read" ? strike*(age>=gather+move?contact:1) :
          Math.min(1,strike*3)*(1-T.MathUtils.smoothstep(progress,.51,1));
        lineMaterial.opacity = .72 * (1 - .75 * contact);
        const end = Math.round(progress * (tracePoints - 1));
        const head = Math.max(0, end - (signal.kind === "edit" ? 18 : 11));
        for (const trace of traces) trace.geometry.setDrawRange(head, end - head + 1);
      }
    }

    // Freeze the current phase in quiet/paused views. Resetting it to zero
    // rotated the core backwards whenever a run moved into a waiting state.
    sphere.paint(energy, boost, rotationClock, area === "core", lighting.failed, clock);
    room.receiver.uniforms.corePosition.value.copy(sphere.orb.position);
    room.receiver.uniforms.tint.value.copy(sphere.tint);
    room.receiver.uniforms.power.value = energy + boost * .48;
    room.receiver.uniforms.emission.value = lighting.failed ? 0 : 1;
    coreLight.position.copy(sphere.orb.position);
    coreLight.color.copy(sphere.tint);
    coreLight.intensity = lighting.failed ? 0 : 6 + energy * 13 + boost * 12;

    const ownerFloor = room.deck === "owner";
    const station = ownerFloor ? room.ownerLight?.source : state.currentZone && room.markers.get(state.currentZone);
    halo.visible = pointer.visible = area === "room" && !!station;
    if (station && halo.visible) {
      const pulse = animate && (!state.replay || state.playing) ? (1 - Math.cos(now * .0025)) * .5 : 0;
      const tint = ownerFloor || lighting.owner ? colors.owner : sphere.tint;
      halo.position.set(station.x, .055, station.z);
      halo.scale.setScalar(1 + pulse * .18);
      halo.material.color.copy(tint);
      halo.material.opacity = .91 - pulse * .31;
      pointer.position.set(station.x, 2.22 + pulse * .13, station.z);
      pointer.material.color.copy(tint).lerp(sparkMaterial.color, .40);
    }

    if (ownerFloor) {
      if (flight) clear();
      const lamp = room.ownerLight;
      bayLamp.intensity = lamp && area === "room" ? 17 : 0;
      if (lamp) {
        bayLamp.position.copy(lamp.source);
        bayLamp.position.y += 1;
        bayLamp.color.copy(lamp.color);
      }
      current.mesh.visible = false;
      if (ownerPulse) {
        const phase = T.MathUtils.clamp((now - ownerPulse.start) / 900, 0, 1);
        if (!animate || area !== "room" || phase >= 1) { clear(); return; }
        const glow = Math.sin(Math.PI * phase);
        current.mesh.visible = true;
        current.uniforms.tint.value.copy(colors.owner);
        current.uniforms.tick.value = phase * 1.48;
        current.uniforms.gain.value = glow;
        bayLamp.position.copy(ownerPulse.source); bayLamp.position.y += .7;
        bayLamp.color.copy(colors.owner);
        bayLamp.intensity = 17 + 23 * glow;
      }
      return;
    }
    if (ownerPulse) clear();

    for (const part of bayParts) {
      part.bay.emissiveIntensity = .018;
      part.wash.opacity = 0;
    }
    const powerColor = lighting.owner || lighting.ship === "pending" ? colors.owner : sphere.tint;
    if (routed !== lighting.endpoint) {
      routed = lighting.endpoint;
      const flowPath = routed === "seat" ? room.seatCircuit.path : routed && room.circuits.get(routed)?.path;
      if (flowPath) {
        const spline = new T.CatmullRomCurve3([...flowPath]);
        current.write(0,(fraction,point) => { spline.getPointAt(fraction,point); point.y+=.049; });
      }
    }
    current.mesh.visible = !!routed && ambient && area === "room";
    current.uniforms.tint.value.copy(powerColor);
    current.uniforms.tick.value = clock * .49;
    current.uniforms.gain.value = .52 + energy*.30;
    const source = lighting.endpoint && room.markers.get(lighting.endpoint);
    bayLamp.intensity = source && area === "room" ? 15 + energy * 10 : 0;
    if (source) {
      bayLamp.position.copy(source);
      bayLamp.position.y += 1;
      bayLamp.color.copy(powerColor);
    }
    for (const [zone, part] of room.circuits) {
      const mark = lighting.marks[zone];
      const powered = lighting.endpoint === zone;
      const landing = flight?.signal.zone === zone ? contact : 0;
      part.branch.emissive.copy(powered ? powerColor : sphere.tint);
      part.branch.emissiveIntensity = powered ? .65 + energy * .6 + boost * .44 : .022;
      part.witness.visible = mark === "reached" || mark === "fault";
      part.witness.material.emissive.copy(mark === "fault" ? colors.fault : sphere.tint);
      part.skipped.visible = mark === "skipped";
      if (powered || mark === "fault") {
        part.bay.emissive.copy(mark === "fault" ? colors.fault : powerColor);
        part.bay.emissiveIntensity = powered ? .55 + energy * .64 + landing : .3;
        part.wash.color.copy(part.bay.emissive);
        part.wash.opacity = powered ? .12 + energy * .16 + landing * .09 : .075;
      }
      const machine = room.machines.get(zone);
      if (!machine) continue;
      machine.light.emissive.copy(mark === "fault" ? colors.fault : powered ? powerColor : sphere.tint);
      machine.light.emissiveIntensity = powered ? .8 + landing : mark === "reached" ? .27 : .025;
      machine.stamp.visible = zone !== "verify" && (mark === "reached" || mark === "fault" || zone === "ship" && !!lighting.ship);
      machine.stamp.scale.x = zone === "ship" && lighting.ship !== "shipped" ? .46 : 1;
      if (zone === "ship") machine.moving.visible = lighting.ship === "shipped";
      machine.moving.position.z = (machineRest.get(zone) ?? 0) + landing * .23 + (mark === "reached" && zone === "build" ? .08 : 0);
      machine.moving.scale.y = mark === "fault" ? .72 : 1;
    }
    room.seatCircuit.branch.emissive.copy(colors.owner);
    for (const part of bayParts) part.wash.visible = part.wash.opacity > 0;
    room.seatCircuit.branch.emissiveIntensity = lighting.endpoint === "seat" ? .92 : .018;
    room.checkStamps.forEach((options, index) => {
      options.forEach((stamp, shape) => {
        const outcome = outcomes[shape];
        stamp.visible = lighting.checks[index] === outcome;
        if (stamp.visible) stamp.material.emissive.copy(colors[outcome]);
      });
    });
    for (const [index, id] of (["previous", "present", "next", "exit"] as const).entries()) {
      const machine = room.machines.get(id);
      if (machine) machine.stamp.visible = index === 3 || state.core[index];
    }
  }
  return { play, pulseOwner, clear, paint, opticalObjects: [leader.mesh, current.mesh, spark, halo, pointer, ...traces],
    get activeDesk() { return halo.visible ? halo.position : null; },
    get flying() { return !!(flight || ownerPulse); }, get steady() { return steady; }, resetClock() { prior = 0; } };
}
