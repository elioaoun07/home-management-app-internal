import * as T from "three";

// Same scene exposure and ACES transform as WebGLRenderer. A static painted
// surface needs its film response once; repeating it over every visible texel
// is disproportionately expensive on a software rasterizer.
const input = new T.Matrix3().set(.59719,.35458,.04823, .076,.90834,.01566, .0284,.13383,.83777);
const output = new T.Matrix3().set(1.60475,-.53108,-.07367, -.10208,1.10813,-.00605, -.00327,-.07276,1.07602);
const fit = (v: number) => (v * (v + .0245786) - .000090537) / (v * (.983729 * v + .432951) + .238081);
const linear = new T.Vector3();
export function fixtureDisplayColour(colour: T.Color) {
  linear.set(colour.r, colour.g, colour.b).multiplyScalar(1.13 / .6).applyMatrix3(input);
  linear.set(fit(linear.x), fit(linear.y), fit(linear.z)).applyMatrix3(output).clampScalar(0, 1);
  return colour.setRGB(linear.x, linear.y, linear.z).convertLinearToSRGB();
}

function panel(center: T.Vector3, up: T.Vector3, w: number, h: number) {
  center.normalize();
  const right = up.cross(center).normalize(), top = center.clone().cross(right);
  return (ray: T.Vector3) => {
    const facing = ray.dot(center);
    if (facing <= .25) return 0;
    const horizontal = Math.abs(ray.dot(right)) / (facing * w), vertical = Math.abs(ray.dot(top)) / (facing * h);
    return (1 - T.MathUtils.smoothstep(horizontal,.2,1)) * (1 - T.MathUtils.smoothstep(vertical,.6,1)) *
      T.MathUtils.smoothstep(facing,.25,.50);
  };
}

/** An octahedral map of the four real clearcoat luminaires. RGB holds the
 * display response and alpha their coverage. The view-dependent reflection
 * vector and Fresnel term still come from the moving three-dimensional glass. */
export function fixtureReflection(tint: T.Color) {
  const size = 256, texels = new Uint8Array(size * size * 4);
  const v = (x: number, y: number, z: number) => new T.Vector3(x,y,z);
  const window = panel(v(-.79,.53,-.12),v(.78,1,.09),.25,.93);
  const strip = panel(v(-.93,.22,-.20),v(.78,1,.09),.042,.77);
  const amber = panel(v(.84,.02,-.62),v(-.15,1,.07),.12,.71);
  const deck = panel(v(.18,-.67,-.62),v(1,.07,.09),.043,.94);
  const base = new T.Color(.18,.27,.40).lerp(tint,.13), colour = new T.Color(), ray = new T.Vector3();
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const u = (x + .5) * 2 / size - 1, v = (y + .5) * 2 / size - 1;
    const z = 1 - Math.abs(u) - Math.abs(v);
    ray.set(z < 0 ? Math.sign(u) * (1 - Math.abs(v)) : u, z < 0 ? Math.sign(v) * (1 - Math.abs(u)) : v, z).normalize();
    const cool = window(ray) + .65 * strip(ray), warm = amber(ray), floor = deck(ray);
    colour.setRGB(base.r + .77*cool + .69*warm + .26*floor, base.g + .87*cool + .46*warm + .40*floor,
      base.b + cool + .24*warm + .46*floor);
    fixtureDisplayColour(colour);
    const at = (y * size + x) * 4;
    texels[at] = Math.round(255 * colour.r); texels[at + 1] = Math.round(255 * colour.g);
    texels[at + 2] = Math.round(255 * colour.b);
    texels[at + 3] = Math.round(255 * (.012 + cool*.38 + warm*.23 + floor*.19));
  }
  const texture = new T.DataTexture(texels,size,size);
  texture.minFilter = texture.magFilter = T.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}
