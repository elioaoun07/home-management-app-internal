import { Color, ShaderMaterial, Vector3 } from "three";

/** The optical receiver is a shallow disk of smoked, machined metal. A ray
 * reflected off the deck intersects ERA's spherical envelope analytically, so
 * the highlight follows the eye without rendering the entire room twice. */
export function receiverMaterial() {
  return new ShaderMaterial({
    uniforms: {
      corePosition: { value: new Vector3(0, 2.38, 0) },
      tint: { value: new Color() },
      power: { value: .2 }, emission: { value: 1 },
    },
    vertexShader: `
      varying vec3 surface;
      void main() {
        vec4 world = modelMatrix * vec4(position, 1.);
        surface = world.xyz;
        gl_Position = projectionMatrix * viewMatrix * world;
      }`,
    fragmentShader: `
      uniform vec3 corePosition, tint;
      uniform float power, emission;
      varying vec3 surface;
      void main() {
        vec3 eye = normalize(cameraPosition - surface);
        vec3 reflected = reflect(-eye, vec3(0., 1., 0.));
        vec3 toCore = corePosition - surface;
        float along = max(dot(reflected, toCore), 0.);
        float separation = length(toCore - reflected * along);
        float reflectedRim = 1. - smoothstep(.025, .23, abs(separation - 1.83));
        float reflectedBody = 1. - smoothstep(.08, 1.83, separation);
        float grazing = .12 + .68 * pow(1. - clamp(eye.y, 0., 1.), 3.);
        float radius = length(surface.xz);
        float grooves = radius * 150.;
        float resolved = 1. - smoothstep(.4, 2.9, fwidth(grooves));
        float grain = cos(grooves) * .0017 * resolved;
        float shoulder = smoothstep(1.18, 1.42, radius);
        float falloff = exp(-radius * radius * 1.35);
        vec3 metal = mix(vec3(.023,.031,.041), vec3(.049,.063,.074), shoulder) + grain;
        vec3 light = tint * ((.03 + .095 * power) * falloff +
          grazing * (.47 * reflectedRim + .74 * reflectedBody));
        light += vec3(.26,.32,.35) * grazing * reflectedRim;
        gl_FragColor = vec4(metal + light * emission, 1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
}
