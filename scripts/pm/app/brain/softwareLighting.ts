import * as T from "three";
import { fixtureDisplayColour } from "./fixtureReflection";

// The CPU backend shades the room's key, warm bounce, softbox reflection and
// filmic response at each surface vertex. Solid surfaces then have a single
// interpolated colour per fragment. Mapped surfaces retain their own UVs and
// the floor's indirect-light map. The glass and topic optics keep their shaders.
const vertex = `
  uniform vec3 diffuse;
  #ifdef FIXTURE_METAL
    uniform vec3 emissive;
    uniform float metalness;
    uniform float roughness;
  #endif
  varying vec3 displayLight;
  #include <common>
  #include <uv_pars_vertex>
  #include <fog_pars_vertex>
  #include <tonemapping_pars_fragment>
  #include <colorspace_pars_fragment>
  void main() {
    #include <uv_vertex>
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.);
    vec3 colour = diffuse;
    #ifdef USE_COLOR
      colour *= color;
    #endif
    #ifdef FIXTURE_METAL
      vec3 n = normalize(normalMatrix * normal);
      vec3 key = mat3(viewMatrix) * vec3(-.54, .77, .34);
      vec3 rim = mat3(viewMatrix) * vec3(.78, .46, -.42);
      float upper = dot(n, viewMatrix[1].xyz);
      vec3 light = vec3(.44 + .22 * upper) + vec3(.76, .88, 1.02) * max(0., dot(n, key))
                   + vec3(.74, .43, .22) * max(0., dot(n, rim));
      vec3 r = reflect(normalize(mvPosition.xyz), n);
      float reflection = smoothstep(.46,.91,dot(r,key)) + .48*smoothstep(.60,.95,dot(r,rim));
      colour = colour * light + emissive + vec3(.14,.18,.23) * reflection * metalness * (1.-roughness*.48);
    #endif
    #ifdef FIXTURE_PRELIT
      displayLight = color;
    #elif defined(FIXTURE_DISPLAY)
      displayLight = sRGBTransferOETF(vec4(colour,1.)).rgb;
    #else
      displayLight = sRGBTransferOETF(vec4(ACESFilmicToneMapping(colour), 1.)).rgb;
    #endif
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }`;

const fragment = `
  uniform float opacity;
  varying vec3 displayLight;
  #include <common>
  #include <uv_pars_fragment>
  #include <map_pars_fragment>
  #include <alphatest_pars_fragment>
  #include <lightmap_pars_fragment>
  #include <fog_pars_fragment>
  void main() {
    vec3 lit = displayLight;
    float coverage = opacity;
    #ifdef USE_MAP
      vec4 texel = texture2D(map, vMapUv);
      lit *= texel.rgb;
      coverage *= texel.a;
    #endif
    #ifdef USE_ALPHATEST
      if (coverage < alphaTest) discard;
    #endif
    #ifdef USE_LIGHTMAP
      vec3 bounce = texture2D(lightMap, vLightMapUv).rgb;
      lit *= sqrt(.43 + (.52 * lightMapIntensity) * bounce);
    #endif
    gl_FragColor = vec4(lit, coverage);
    #include <fog_fragment>
  }`;

export function applySoftwareLighting(room: T.Object3D) {
  const graded = new Set<T.BufferGeometry>();
  const colour = new T.Color();
  room.traverse(object => {
    if (!(object instanceof T.Mesh)) return;
    const material = object.material;
    const metal = material instanceof T.MeshStandardMaterial;
    const basic = material instanceof T.MeshBasicMaterial;
    const baked = basic && material.vertexColors && object.geometry.hasAttribute("color") && !material.transparent;
    if (!metal && !basic) return;
    // The software shader keeps its modulation in display space. Read the
    // authored sRGB bytes directly, including asynchronously loaded artwork.
    // The separate indirect-light texture continues to use linear samples.
    material.onBeforeRender = () => {
      const map = material.map;
      if (map && (map.colorSpace === T.SRGBColorSpace || map.anisotropy > 1)) {
        map.colorSpace = T.NoColorSpace;
        map.anisotropy = 1;
        map.needsUpdate = true;
      }
    };
    if (baked && !graded.has(object.geometry)) {
      const colours = object.geometry.getAttribute("color");
      if (!colours) return;
      graded.add(object.geometry);
      for (let i = 0; i < colours.count; i++) {
        colour.fromBufferAttribute(colours, i).multiply(material.color);
        fixtureDisplayColour(colour);
        colours.setXYZ(i, colour.r, colour.g, colour.b);
      }
      colours.needsUpdate = true;
    }
    material.defines = { ...material.defines, ...(metal ? { FIXTURE_METAL: 1 } : {}),
      ...(baked ? { FIXTURE_PRELIT: 1 } : !material.toneMapped ? { FIXTURE_DISPLAY: 1 } : {}) };
    material.onBeforeCompile = (parameters: T.WebGLProgramParametersWithUniforms) => {
      parameters.vertexShader = vertex;
      parameters.fragmentShader = fragment;
    };
  });
}
