import * as T from "three";

const radius = 1.836;

/** Radial cracks spread from two impact sites on the spherical laminate.
 * Each seam has a dark opening and an exposed, directional reflective lip.
 * All facets and seams share one draw, allocated on the first failure. */
export function fracturedGlass() {
  const positions: number[] = [], faces: number[] = [], profiles: number[] = [], indices: number[] = [];
  function impact(pole: T.Vector3, size: number, seed: number, count: number) {
    pole.normalize();
    const east = new T.Vector3().crossVectors(new T.Vector3(0,1,0), pole).normalize();
    const up = new T.Vector3().crossVectors(pole,east);
    const rays: T.Vector3[][] = [];
    let state = seed;
    const random = () => ((state = (Math.imul(state,1664525) + 1013904223) >>> 0) / 4294967296);
    function point(angle: number, arc: number) {
      return pole.clone().multiplyScalar(Math.cos(arc)).addScaledVector(east,Math.sin(arc)*Math.cos(angle))
        .addScaledVector(up,Math.sin(arc)*Math.sin(angle));
    }
    function fissure(path: T.Vector3[], width: number, secondary = false) {
      const first = positions.length / 3;
      for (let i = 0; i < path.length; i++) {
        const p = path[i];
        const along = path[Math.min(i+1,path.length-1)].clone().sub(path[Math.max(0,i-1)]);
        const across = new T.Vector3().crossVectors(along,p).normalize();
        const fade = i / (path.length-1);
        const halfWidth = width * (1 - .80*fade);
        for (const side of [-1,1]) {
          const edge = p.clone().addScaledVector(across, side * halfWidth / radius).normalize();
          positions.push(edge.x*radius,edge.y*radius,edge.z*radius);
          faces.push(across.x,across.y,across.z);
          profiles.push(side, secondary ? .70 : 1);
        }
        const n = first + i*2;
        if (i+1 < path.length) indices.push(n,n+1,n+2,n+1,n+3,n+2);
      }
    }
    const startAngle = random();
    for (let i = 0; i < count; i++) {
      const direction = startAngle + (i + .32*random()) * Math.PI*2/count;
      const reach = size*(.63+.48*random());
      const sweep = (random()-.5)*.47;
      const ray: T.Vector3[] = [];
      for (let j = 0; j < 9; j++) {
        const f = j/8;
        const bend = sweep*f + (random()-.5)*.11;
        ray.push(point(direction+bend, (.021 + f*f*.41 + f*.58)*reach));
      }
      rays.push(ray);
      fissure(ray,size*(.012+.011*random()));
      for (const j of [3,6]) {
        const side = (i+j)%2 === 0 ? 1 : -1;
        const arc = ray[j].angleTo(pole);
        fissure([ray[j],point(direction+sweep*.48+side*.078,arc+reach*.082),
          point(direction+sweep*.60+side*.13,arc+reach*.14),
          point(direction+sweep*.68+side*.23,arc+reach*.22)],size*.010,true);
      }
    }
    // Arrest lines meet the existing spokes. Missing sectors and secondary
    // forks distinguish a localized impact from a uniform wireframe grid.
    for (let i = 0; i < count; i++) {
      const next = rays[(i+1)%count];
      // Thin chips remain trapped between the laminates at the impact site.
      const at = positions.length/3;
      const edge = rays[i][0], lip = edge.clone().sub(pole).normalize();
      for (const p of [pole,edge,next[0]]) {
        positions.push(p.x*radius,p.y*radius,p.z*radius);
        faces.push(lip.x,lip.y,lip.z);
        profiles.push(.54,.46+.44*random());
      }
      indices.push(at,at+1,at+2);
      for (const level of [0,2,4]) {
        if (level && random() < level*.13) continue;
        const a = rays[i][level], b = next[level + Number(level > 0 && random()>.64)];
        const bend = a.clone().lerp(b,.51).lerp(pole,.058+.07*random()).normalize();
        fissure([a,bend,b],size*(level === 0 ? .016 : .009),true);
      }
    }
  }
  impact(new T.Vector3(-.50,.34,.80),1.30,991,9);
  impact(new T.Vector3(.59,-.26,-.77),.94,2671,7);
  const geometry = new T.BufferGeometry();
  geometry.setAttribute("position",new T.Float32BufferAttribute(positions,3));
  geometry.setAttribute("lip",new T.Float32BufferAttribute(faces,3));
  geometry.setAttribute("seam",new T.Float32BufferAttribute(profiles,2));
  geometry.setIndex(indices);
  const material = new T.ShaderMaterial({
    transparent:true, depthWrite:false,
    vertexShader:`
      attribute vec3 lip;
      attribute vec2 seam;
      varying vec2 profile;
      varying float glint;
      void main(){
        profile=seam;
        vec3 n=normalize(mat3(modelMatrix)*position);
        vec3 facet=normalize(.52*n+.78*normalize(mat3(modelMatrix)*lip));
        vec3 eye=normalize(cameraPosition-(modelMatrix*vec4(position,1.)).xyz);
        glint=.24+.57*max(0.,dot(facet,vec3(-.43,.81,.39)))
                 +.16*pow(max(0.,dot(facet,eye)),7.);
        gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);
      }`,
    fragmentShader:`
      varying vec2 profile;
      varying float glint;
      void main(){
        float side=profile.x, aa=min(.48,max(.06,fwidth(side)));
        float opening=smoothstep(-.20-aa,-.20+aa,side);
        vec3 colour=mix(vec3(.009,.013,.019),vec3(.53,.66,.71)*glint,opening);
        float opacity=(1.-smoothstep(1.-aa,1.,abs(side)))*profile.y;
        gl_FragColor=vec4(colour,opacity);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const cracks = new T.Mesh(geometry,material);
  cracks.name = "Fractured glass";
  cracks.renderOrder = 2.1;
  return cracks;
}
