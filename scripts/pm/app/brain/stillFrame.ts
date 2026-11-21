/** Save colour AND depth from the native-sized CPU drawing surface. Restoring
 * both lets the optical assembly continue to pass behind the real furniture
 * without re-rasterizing the architecture at a fixed camera. */
export function stillFrame(gl: WebGL2RenderingContext) {
  const target = gl.createFramebuffer(), colour = gl.createRenderbuffer(), depth = gl.createRenderbuffer();
  const bits = gl.getParameter(gl.DEPTH_BITS) as number;
  const stencil = (gl.getParameter(gl.STENCIL_BITS) as number) > 0;
  let width = 0, height = 0, supported = !!(target && colour && depth), valid = false;
  const mask = gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT;
  function store() {
    if (!supported || !target) return false;
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, target);
    if (width !== gl.drawingBufferWidth || height !== gl.drawingBufferHeight) {
      width = gl.drawingBufferWidth; height = gl.drawingBufferHeight;
      gl.bindRenderbuffer(gl.RENDERBUFFER, colour);
      gl.renderbufferStorage(gl.RENDERBUFFER, gl.RGBA8, width, height);
      gl.framebufferRenderbuffer(gl.DRAW_FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.RENDERBUFFER, colour);
      gl.bindRenderbuffer(gl.RENDERBUFFER, depth);
      const format = stencil ? gl.DEPTH24_STENCIL8 : bits === 16 ? gl.DEPTH_COMPONENT16 :
        bits === 32 ? gl.DEPTH_COMPONENT32F : gl.DEPTH_COMPONENT24;
      gl.renderbufferStorage(gl.RENDERBUFFER, format, width, height);
      gl.framebufferRenderbuffer(gl.DRAW_FRAMEBUFFER, stencil ? gl.DEPTH_STENCIL_ATTACHMENT : gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, depth);
      gl.bindRenderbuffer(gl.RENDERBUFFER, null);
      supported = gl.checkFramebufferStatus(gl.DRAW_FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
    }
    if (supported) {
      gl.blitFramebuffer(0, 0, width, height, 0, 0, width, height, mask, gl.NEAREST);
      supported = gl.getError() === gl.NO_ERROR;
    }
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, null);
    valid = supported;
    return valid;
  }
  return { store, get valid() { return valid; }, get supported() { return supported; },
    invalidate() { valid = false; },
    restore(x: number, y: number, w: number, h: number) {
      gl.bindFramebuffer(gl.READ_FRAMEBUFFER, target);
      gl.blitFramebuffer(x, y, x+w, y+h, x, y, x+w, y+h, mask, gl.NEAREST);
      gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null);
    },
    dispose() {
      gl.deleteFramebuffer(target); gl.deleteRenderbuffer(colour); gl.deleteRenderbuffer(depth);
    },
  };
}
