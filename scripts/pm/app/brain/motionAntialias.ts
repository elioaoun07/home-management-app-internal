import * as T from "three";

// Smooth contrasting coverage transitions on the unaccelerated driver.
// Derivatives of the current 2×2 pixel quad identify edges for free; flat
// paint and detailed, low-contrast material grain keep their original texel.
export function motionAntialias(renderer: T.WebGLRenderer) {
  const texture = new T.FramebufferTexture(1, 1);
  texture.minFilter = texture.magFilter = T.LinearFilter;
  const texel = new T.Vector2();
  const material = new T.RawShaderMaterial({
    glslVersion: T.GLSL3, depthTest: false, depthWrite: false,
    uniforms: { source: { value: texture }, texel: { value: texel } },
    vertexShader: `
      precision highp float;
      in vec3 position;
      out vec2 uv;
      void main() { uv = position.xy * .5 + .5; gl_Position = vec4(position.xy, 0., 1.); }`,
    fragmentShader: `
      precision highp float;
      uniform sampler2D source;
      uniform vec2 texel;
      in vec2 uv;
      out vec4 result;
      void main() {
        vec3 colour = texture(source, uv).rgb;
        float luma = dot(colour, vec3(.299,.587,.114));
        vec2 gradient = vec2(dFdx(luma), dFdy(luma));
        float contrast = max(abs(gradient.x), abs(gradient.y));
        if (contrast > .045 + .055 * luma) {
          vec2 offset = gradient * (.62 / contrast) * texel;
          vec3 sides = texture(source, uv + offset).rgb + texture(source, uv - offset).rgb;
          colour = mix(colour, sides * .5, .70);
        }
        result = vec4(colour, 1.);
      }`,
  });
  const geometry = new T.BufferGeometry();
  geometry.setAttribute("position", new T.Float32BufferAttribute([-1,-1,0, 3,-1,0, -1,3,0], 3));
  const triangle = new T.Mesh(geometry, material);
  triangle.frustumCulled = false;
  const pass = new T.Scene().add(triangle), camera = new T.Camera();
  const native = new T.WebGLRenderTarget(1, 1, { depthBuffer: false });
  const gl = renderer.getContext() as WebGL2RenderingContext;
  let nativeBuffer: WebGLFramebuffer | null = null;
  function resolve(source: T.Texture, width: number, height: number) {
    material.uniforms.source.value = source;
    texel.set(1 / width, 1 / height);
    renderer.autoClear = false;
    renderer.render(pass, camera);
    renderer.autoClear = true;
  }
  return {
    draw() {
      const {width, height} = renderer.domElement;
      if (texture.image.width !== width || texture.image.height !== height) {
        texture.dispose();
        texture.image.width = width;
        texture.image.height = height;
        texture.needsUpdate = true;
      }
      renderer.copyFramebufferToTexture(texture);
      resolve(texture, width, height);
    },
    // Keep a pristine full-size source. A rotating optic replaces only its
    // freshly drawn pixels; its neighbours always come from unfiltered colour.
    drawNative(x = 0, y = 0, w = renderer.domElement.width, h = renderer.domElement.height) {
      const {width, height} = renderer.domElement;
      if (!nativeBuffer || native.width !== width || native.height !== height) {
        native.setSize(width, height);
        renderer.setRenderTarget(native);
        nativeBuffer = gl.getParameter(gl.DRAW_FRAMEBUFFER_BINDING);
        renderer.setRenderTarget(null);
      }
      const right = x + w, top = y + h;
      gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, nativeBuffer);
      gl.blitFramebuffer(x, y, right, top, x, y, right, top, gl.COLOR_BUFFER_BIT, gl.NEAREST);
      gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, null);
      const partial = w !== width || h !== height;
      if (partial) {
        // Both the derivatives and the bilinear edge taps reach across the
        // damage boundary. Repaint a two-pixel halo from the pristine source.
        const left = Math.max(0, x - 2), bottom = Math.max(0, y - 2), dpr = renderer.getPixelRatio();
        renderer.setScissor(left / dpr, bottom / dpr,
          (Math.min(width, right + 2) - left) / dpr, (Math.min(height, top + 2) - bottom) / dpr);
        renderer.setScissorTest(true);
      }
      resolve(native.texture, width, height);
      if (partial) renderer.setScissorTest(false);
    },
    dispose() { texture.dispose(); native.dispose(); geometry.dispose(); material.dispose(); },
  };
}
