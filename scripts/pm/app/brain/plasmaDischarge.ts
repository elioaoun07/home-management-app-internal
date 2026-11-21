import * as T from "three";

type OpticalUniforms = {
  tick: T.IUniform<number>;
  power: T.IUniform<number>;
  tint: T.IUniform<T.Color>;
};

// Find metal or enamel on the outside of the actual instrument. A transfer
// arrow has two electrodes, for example, where a compass has a continuous rim.
function contactPoints(cue: T.Group, angles: number[]) {
  const directions = angles.map(a => new T.Vector2(Math.cos(a), Math.sin(a)));
  const scores = angles.map(() => -Infinity);
  const contacts = directions.map(d => new T.Vector3(d.x * .44, d.y * .44, 0));
  for (const part of cue.children) {
    const points = (part as T.Mesh).geometry.getAttribute("position");
    for (let i = 0; i < points.count; i++) {
      const x = points.getX(i), y = points.getY(i), z = points.getZ(i);
      for (let k = 0; k < directions.length; k++) {
        const d = directions[k];
        const score = x*d.x + y*d.y - .84*Math.abs(x*d.y - y*d.x);
        if (score > scores[k]) { scores[k] = score; contacts[k].set(x,y,z); }
      }
    }
  }
  return contacts;
}

/** One static ribbon mesh. The glass and the dimensional topic mark bracket
 * these channels in depth. A shared, deterministic field at the junctions
 * keeps each fork welded while light travels outwards. */
export function plasmaDischarge(cue: T.Group, uniforms: OpticalUniforms) {
  const positions: number[] = [], tangents: number[] = [], profiles: number[] = [], indices: number[] = [];
  const angles = [.24, 1.29, 2.47, 3.46, 4.54, 5.53];
  const contacts = contactPoints(cue, angles);
  function ribbon(curve: T.Curve<T.Vector3>, steps: number, start: number, weight: number, seed: number) {
    const base = positions.length / 3;
    for (let i = 0; i <= steps; i++) {
      const t = i/steps, p = curve.getPoint(t), axis = curve.getTangent(t);
      for (const side of [-1,1]) {
        positions.push(p.x,p.y,p.z);
        tangents.push(axis.x,axis.y,axis.z);
        profiles.push(start + (1-start)*t, side, weight, seed);
      }
      const at = base + 2*i;
      if (i < steps) indices.push(at,at+1,at+2,at+1,at+3,at+2);
    }
  }
  function collector(angle: number, depth: number) {
    const r = Math.sqrt(1.786**2 - depth**2);
    return new T.Vector3(r*Math.cos(angle),r*Math.sin(angle),depth);
  }
  const depth = [.48, -.35, .69, -.70, .41, -.58];
  const sweep = [.33, -.25, .37, -.34, .28, -.32];
  angles.forEach((angle, i) => {
    const start = contacts[i], bend = sweep[i];
    const tangent = new T.Vector3(-Math.sin(angle),Math.cos(angle),0);
    const end = collector(angle+bend,depth[i]);
    const guide = (t: number, sideways: number, advance: number) =>
      start.clone().lerp(end,t).addScaledVector(tangent,sideways*bend)
        .add(new T.Vector3(0,0,advance));
    const arc = new T.CatmullRomCurve3([start,guide(.25,-.38,.08),guide(.53,.31,-.04),
      guide(.76,.07,.04),end]);
    const seed = i * 1.731;
    ribbon(arc,32,0,1,seed);
    const joint = i % 2 ? .42 : .60;
    const origin = arc.getPoint(joint);
    const branchEnd = collector(angle+bend*.26,depth[i]+(i % 2 ? -.23 : .23));
    const reach = origin.clone().lerp(branchEnd,.57).addScaledVector(tangent,-bend*.09);
    ribbon(new T.CatmullRomCurve3([origin,origin.clone().addScaledVector(arc.getTangent(joint),.09),
      reach,branchEnd]),16,joint,.50,seed);
  });
  const geometry = new T.BufferGeometry();
  geometry.setAttribute("position",new T.Float32BufferAttribute(positions,3));
  geometry.setAttribute("axis",new T.Float32BufferAttribute(tangents,3));
  geometry.setAttribute("profile",new T.Float32BufferAttribute(profiles,4));
  geometry.setIndex(indices);
  const material = new T.ShaderMaterial({
    uniforms, transparent:true, depthWrite:false, side:T.DoubleSide,
    forceSinglePass:true, blending:T.AdditiveBlending,
    vertexShader:`
      attribute vec3 axis;
      attribute vec4 profile;
      varying vec4 filament;
      uniform float power, tick;
      void main(){
        filament=profile;
        float u=profile.x, seed=profile.w;
        float field=sin(3.14159*u)*smoothstep(.24,.95,power);
        vec3 p=position;
        p.xy+=field*.027*vec2(sin(9.*u+seed+tick*1.48),cos(14.*u-seed-tick*.96));
        p.z+=field*.035*sin(13.*u+seed-tick*1.32);
        vec4 view=modelViewMatrix*vec4(p,1.);
        vec3 side=cross(mat3(modelViewMatrix)*axis,normalize(-view.xyz));
        float scale=length(modelViewMatrix[0].xyz);
        filament.z*=smoothstep(.035,.28,length(side)/scale);
        float width=(.032+.025*smoothstep(.22,.98,power))*mix(.57,1.,profile.z);
        // The ionized gas narrows to a point where it touches the collector.
        // A broad ribbon cut across its end shows a rectangular cap in profile.
        width*=mix(.30,1.,smoothstep(0.,.085,u))*(1.-.90*smoothstep(.85,1.,u));
        view.xyz+=side*inversesqrt(max(dot(side,side),.000001))*profile.y*width*scale;
        gl_Position=projectionMatrix*view;
      }`,
    fragmentShader:`
      varying vec4 filament;
      uniform vec3 tint;
      uniform float power, tick;
      void main(){
        float side=abs(filament.y), u=filament.x, seed=filament.w;
        float core=exp2(-43.*side*side);
        float halo=exp2(-5.*side*side)*(1.-smoothstep(.76,1.,side));
        float charge=smoothstep(.22,.94,power);
        float flow=.5+.5*cos(u*8.-tick*2.24+seed);
        float gain=(.065+charge*(.41+.43*flow*flow))*filament.z;
        vec3 gas=mix(tint,vec3(.35,.45,1.),.18);
        vec3 hot=mix(tint,vec3(.92,1.,1.),.68);
        vec3 light=gas*.58*halo+hot*(1.08+.41*smoothstep(.88,1.,u))*core;
        gl_FragColor=vec4(light,gain*(1.-smoothstep(.16,.97,side)));
        #include <colorspace_fragment>
      }`,
  });
  const streamers = new T.Mesh(geometry,material);
  streamers.renderOrder = 1.5;
  return streamers;
}
