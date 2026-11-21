import * as T from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { fixtureReflection } from "./fixtureReflection";
import { fracturedGlass } from "./fracturedGlass";
import { topicMotif } from "./topicMotif";
import { plasmaDischarge } from "./plasmaDischarge";
import { topics, type Topic } from "./topics";

// The optical backing darkens behind the cue and opens at the shoulders so
// the chamber is visible through the glass. Ring spacing follows EraShell.
const surfaceVertex = `
  varying vec3 viewNormal, viewRay, localNormal;
  void main() {
    vec4 eye = modelViewMatrix * vec4(position, 1.);
    viewRay = -eye.xyz;
    viewNormal = normalMatrix * normal;
    localNormal = normal;
    gl_Position = projectionMatrix * eye;
  }`;

function opticalShell(tint: T.Color, illustrated: boolean, failure: T.IUniform<number>) {
  return new T.ShaderMaterial({
    side: T.BackSide, transparent:true, depthWrite:false,
    uniforms: { tint: {value: tint}, power: {value: .2}, tick: {value: 0}, ink: {value: Number(illustrated)}, failure },
    vertexShader: surfaceVertex,
    fragmentShader: `
      varying vec3 viewNormal, viewRay, localNormal;
      uniform vec3 tint;
      uniform float tick, power, ink, failure;
      float ruled(float p, float at, float w) {
        float aa = max(fwidth(p), .0008);
        return 1. - smoothstep(w, w + aa, abs(at-p));
      }
      void main() {
        vec3 n = normalize(viewNormal);
        float facing = clamp(abs(dot(n, normalize(viewRay))), 0., 1.);
        float r = sqrt(max(0., 1.-facing*facing));
        vec3 orientation = normalize(localNormal);
        if (failure>.5) {
          float edge=pow(r,6.);
          vec3 smoke=vec3(.009,.014,.020)+vec3(.041,.052,.062)*edge;
          gl_FragColor=vec4(smoke,.46+.44*facing);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
          return;
        }
        // A sweeping reflection on the lacquer still shows which way the
        // volume turns when the viewer circles a paused run.
        float top = max(0., dot(orientation, normalize(vec3(-.51,.79,-.52))));
        float side = max(0., dot(orientation, normalize(vec3(.86,-.15,.48))));
        float rim = pow(r, 8.);
        float angle = atan(n.y, n.x);
        float sweep = .5+.5*cos(angle-tick*.64);
        float wave = sweep*sweep*sweep;
        float breathing = .86 + .14*cos(tick*1.3);
        vec3 midnight = vec3(.006,.011,.025);
        vec3 body = midnight + tint*(.009 + .024*top*top + .011*side*side);
        body += (tint*.049+vec3(.025,.035,.065))*rim;
        body += (tint*.07+vec3(.025,.034,.055))*pow(top,16.);
        body += tint*exp(-r*r*13.)*(.12+power*.29)*breathing;
        // The outer collector, evidence orbit and inner register are visible
        // from the rear as well. Narrow ticks live on the recessed outer rim.
        float middle = ruled(r,.872,.0028);
        float edge = ruled(r,.975,.0028);
        float grad = max(.18, .5+.5*cos(angle-2.2));
        float marks = smoothstep(.87,.99,cos(angle*60.));
        float knurl = smoothstep(.914,.925,r)*(1.-smoothstep(.94,.954,r))*marks;
        vec3 light = mix(tint,vec3(.77,.92,1.),.31);
        body += light*(edge*(.075+.28*grad) + middle*(.11+.39*wave*power) + knurl*.065);
        body += tint*(1.-smoothstep(.002,.036,abs(r-.872)))*wave*power*.14;
        // Interrupted deposition on the spinning envelope gives the eye fixed
        // features to follow; the actual luminaire reflections stay room-fixed.
        float latitude=dot(orientation,vec3(.20,.850,.487));
        float engraving=ruled(latitude,.34,.004)*smoothstep(-.30,.02,orientation.x);
        engraving+=ruled(latitude,.37,.002)*smoothstep(.20,.46,orientation.x);
        body+=light*engraving*(.12+power*.10);
        body += light*pow(r,67.)*(.24+.35*grad);
        body *= 1. - ink*.10;
        float density = .18+.77*smoothstep(.045,.69,facing);
        gl_FragColor = vec4(body,density);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
}

/** Polished front surface. Its two long, curved ceiling reflections are
 * fixed in room space. Motion around the instrument reveals its curvature.
 * No back-buffer sampling, texture, environment map or post-process pass. */
function clearcoat(tint: T.Color, software: boolean, failure: T.IUniform<number>) {
  const material = new T.ShaderMaterial({
    transparent:true,depthWrite:false,
    uniforms:{tint:{value:tint},failure},
    vertexShader:`
      varying vec3 N, eye;
      void main(){
        vec4 world = modelMatrix * vec4(position,1.);
        N = mat3(modelMatrix)*normal;
        eye = cameraPosition-world.xyz;
        gl_Position = projectionMatrix*viewMatrix*world;
      }`,
    fragmentShader:`
      varying vec3 N, eye;
      uniform vec3 tint;
      uniform float failure;
      float boxLight(vec3 r, vec3 c, vec3 up, vec2 size) {
        c=normalize(c);
        vec3 right=normalize(cross(up,c)), top=cross(c,right);
        float facing=dot(r,c);
        vec2 q=abs(vec2(dot(r,right),dot(r,top))/max(.08,facing))/size;
        return (1.-smoothstep(.20,1.,q.x))*(1.-smoothstep(.60,1.,q.y))*smoothstep(.25,.50,facing);
      }
      void main(){
        vec3 n=normalize(N), v=normalize(eye), r=reflect(-v,n);
        float rim=pow(1.-max(0.,dot(n,v)),3.6);
        vec3 up=vec3(.78,1.,.09);
        float softbox=boxLight(r,vec3(-.79,.53,-.12),up,vec2(.25,.93));
        softbox+=.65*boxLight(r,vec3(-.93,.22,-.20),up,vec2(.042,.77));
        float amber=boxLight(r,vec3(.84,.02,-.62),vec3(-.15,1.,.07),vec2(.12,.71));
        float deck=boxLight(r,vec3(.18,-.67,-.62),vec3(1.,.07,.09),vec2(.043,.94));
        vec3 coat=mix(vec3(.18,.27,.40),tint,.13)+vec3(.77,.87,1.)*softbox
          + amber*vec3(.69,.46,.24)+deck*vec3(.26,.40,.46);
        float opacity=.012+rim*.33+softbox*.38+amber*.23+deck*.19;
        coat=mix(coat,vec3(.90,.96,1.)*dot(coat,vec3(.21,.72,.07)),failure);
        gl_FragColor=vec4(coat,clamp(opacity,0.,.88));
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  if (software) {
    const texture = fixtureReflection(tint);
    material.uniforms.reflections = { value: texture };
    material.fragmentShader = `
      varying vec3 N, eye;
      uniform sampler2D reflections;
      uniform float failure;
      void main() {
        vec3 n=normalize(N), v=normalize(eye), r=reflect(-v,n);
        float rim=1.-max(0.,dot(n,v));
        r/=dot(abs(r),vec3(1.));
        vec2 uv=r.z < 0. ? (1.-abs(r.yx))*sign(r.xy) : r.xy;
        vec4 film=texture2D(reflections, uv*.5+.5);
        film.rgb=mix(film.rgb,vec3(.90,.96,1.)*dot(film.rgb,vec3(.21,.72,.07)),failure);
        gl_FragColor=vec4(film.rgb, min(.88,film.a+.33*pow(rim,3.6)));
      }`;
    material.addEventListener("dispose", () => texture.dispose());
  }
  return material;
}

function luminousPearl(tint: T.Color, illustrated: boolean, failure: T.IUniform<number>) {
  return new T.ShaderMaterial({
    uniforms: {tint:{value:tint}, power:{value:.2}, ink:{value:Number(illustrated)},failure},
    vertexShader:surfaceVertex,
    fragmentShader:`
      varying vec3 viewNormal, viewRay, localNormal;
      uniform vec3 tint;
      uniform float power, ink, failure;
      void main(){
        vec3 n = normalize(viewNormal);
        float face = max(0.,dot(n,normalize(viewRay)));
        float gleam = max(0.,dot(n,normalize(vec3(-.31,.48,.82))));
        float core = pow(face, 3.);
        vec3 color = tint*(.20+.65*face+.36*power) + vec3(.06,.08,.10)*pow(1.-face,3.);
        color += mix(tint,vec3(.86,.97,1.),.70)*core*(.51+.61*power);
        color += vec3(.90,.96,1.)*pow(gleam,19.)*(.72-.22*ink);
        vec3 cold=vec3(.011,.016,.024)+vec3(.029,.038,.045)*face+vec3(.10)*pow(gleam,22.);
        color=mix(color,cold,failure);
        gl_FragColor=vec4(color,1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
}

function collectorBand(material: T.MeshStandardMaterial) {
  const metal: T.BufferGeometry[] = [new T.TorusGeometry(1.49,.017,8,88)];
  // Asymmetric sleeves with split index marks make the rotation physically
  // visible even on the unmarked General pearl. They share the carrier draw.
  for (const [angle,length] of [[.41,.24],[2.48,.095],[2.64,.056],[4.91,.16]]) {
    metal.push(new T.TorusGeometry(1.49,.033,8,14,length).rotateZ(angle));
    metal.push(new T.BoxGeometry(.092,.032,.052).translate(1.49,0,0).rotateZ(angle));
  }
  const geometry = mergeGeometries(metal)!;
  metal.forEach(part => part.dispose());
  return new T.Mesh(geometry,material);
}

export function makeSphere(topic: Topic, illustrated: boolean, software = false) {
  const orb = new T.Group();
  orb.name = "ERA · " + topics[topic][0];
  const tint = new T.Color().setHSL(topics[topic][1] / 360, topic === "general" ? .32 : .80, .59, T.SRGBColorSpace);
  const failure = {value: 0};
  const shell = opticalShell(tint, illustrated, failure);
  const pearl = luminousPearl(tint, illustrated, failure);
  const enamel = new T.MeshStandardMaterial({
    color:tint.clone().multiplyScalar(.56), emissive:tint, emissiveIntensity:.21,
    metalness: illustrated ? .12 : .44, roughness: illustrated ? .56 : .25,
  });
  const metal = new T.MeshStandardMaterial({
    color:tint.clone().lerp(new T.Color("#99a9ba"),.66),
    metalness: illustrated ? .20 : .54, roughness: illustrated ? .50 : .32,
  });
  const light = new T.MeshStandardMaterial({
    color:tint.clone().lerp(new T.Color("#f1fff9"),.67), emissive:tint, emissiveIntensity:.50,
    metalness:.16, roughness:illustrated ? .46 : .22,
  });
  const globe = new T.Mesh(new T.SphereGeometry(1.83,64,40),shell);
  globe.renderOrder=1;
  const glazing = new T.Mesh(globe.geometry,clearcoat(tint, software, failure));
  glazing.renderOrder=2;
  const orbitMaterial = new T.MeshStandardMaterial({
    color:tint.clone().lerp(new T.Color("#526d81"),.65),metalness:.52,roughness:.32,
    emissive:tint,emissiveIntensity:.14,
  });
  const orbit = collectorBand(orbitMaterial);
  orbit.name = "Collector";
  orbit.rotation.set(-.57,.48,-.31,"YXZ");
  const pearlRadius = topic === "general" ? .44 : topic === "trip" ? .132 : .25;
  const core = new T.Mesh(new T.SphereGeometry(pearlRadius,32,24),pearl);
  const cue = topicMotif(topic, metal, enamel, light);
  cue.rotation.order = "YXZ";
  const used = new Set(cue.children.map(child => (child as T.Mesh).material));
  for (const material of [metal,enamel,light]) if (!used.has(material)) material.dispose();
  // Seat the Trips jewel in its machined bearing so it follows the physical
  // axle through every attitude. The other marks have a recessed light source.
  if (topic === "trip") {
    core.position.z = .337;
    const carrier = cue.children.find(part => (part as T.Mesh).material === metal)!;
    carrier.add(core);
  } else {
    core.position.z = topic === "general" ? 0 : -.31;
    orb.add(core);
  }
  const discharge = plasmaDischarge(cue, {
    tint: shell.uniforms.tint, tick: shell.uniforms.tick, power: shell.uniforms.power,
  });
  discharge.name = "Plasma discharge";
  orb.add(globe,orbit,cue,discharge,glazing);
  const finishes = [enamel,metal,light,orbitMaterial];
  const liveFinish = finishes.map(material => material.color.clone());
  const coldFinish = ["#364249","#59666d","#758289","#46545d"].map(value => new T.Color(value));
  let cracks: ReturnType<typeof fracturedGlass> | undefined;
  let lastClock = 0, lastWorkClock = 0;
  function paint(energy: number, kick: number, clock: number, inside: boolean, failed = false, workClock = clock) {
    if (Boolean(failure.value) !== failed) {
      failure.value = Number(failed);
      finishes.forEach((material,i) => material.color.copy(failed ? coldFinish[i] : liveFinish[i]));
      discharge.visible = !failed;
      if (failed && !cracks) {
        cracks = fracturedGlass();
        // Software caches the static environment on a separate camera layer.
        // A failure may arrive long after that layer was assigned to the orb.
        cracks.layers.mask = orb.layers.mask;
        orb.add(cracks);
      }
      if (cracks) {
        cracks.visible = failed;
        if (failed) cracks.rotation.y = -orb.rotation.y;
      }
    }
    const power = failed ? 0 : energy + kick*.24;
    shell.uniforms.power.value = power;
    if (!failed) {
      lastClock = clock;
      lastWorkClock = workClock;
    }
    const t = lastClock;
    shell.uniforms.tick.value = lastWorkClock;
    // The motor turns the envelope through a full revolution. Its gimballed
    // topic card keeps its heading as the register and collector pass around it.
    const spin = t*.27;
    orb.rotation.y = spin;
    orbit.rotation.y = .48+t*.12;
    orbitMaterial.emissiveIntensity=failed ? 0 : .10+.18*energy+.13*kick;
    pearl.uniforms.power.value = power;
    light.emissiveIntensity = failed ? 0 : .35+energy*.48+kick*.32;
    enamel.emissiveIntensity = failed ? 0 : .14+energy*.22;
    core.scale.setScalar(failed ? 1 : 1+.022*Math.sin(lastWorkClock*1.3)+kick*.035);
    cue.rotation.y = .16 + .33*Math.sin(t*.35) - spin;
    cue.rotation.z = (topic === "trip" ? .13 : .045)*Math.sin(t*.42);
    if (topic !== "trip" && topic !== "general")
      core.position.set(.31*Math.sin(spin),0,-.31*Math.cos(spin));
    discharge.rotation.copy(cue.rotation);
    orb.position.y = inside ? 2.30 : 2.38;
    orb.scale.setScalar(inside ? .42 : 1);
  }
  paint(.20,0,0,false);
  return {orb,tint,paint};
}
