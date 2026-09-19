/*
=====================================================
MARKSTREET — SIGNAL DESK GRADIENT ORB
=====================================================

Presentation-only Vanilla WebGL renderer for the existing
Signal Desk launcher. It does not own launcher interaction.
*/

(() => {
  'use strict';

  const DEFAULT_ORB_CONFIG = Object.freeze({
    background: '#0a0a0a',
    rotationSpeed: 0.3,
    noiseScale: 0.65,
    innerRadius: 0.1,
    hue: 0,
    timeScale: 1,
    maxDevicePixelRatio: 2,
  });
  const CONFIG_LIMITS = Object.freeze({
    rotationSpeed: Object.freeze([-1, 1]),
    noiseScale: Object.freeze([0.2, 1.8]),
    innerRadius: Object.freeze([0.02, 0.7]),
    hue: Object.freeze([-180, 180]),
    timeScale: Object.freeze([0, 2]),
    maxDevicePixelRatio: Object.freeze([1, 2]),
  });
  const CONTEXT_OPTIONS = Object.freeze({
    alpha: true,
    antialias: true,
    premultipliedAlpha: true,
    depth: false,
    stencil: false,
    powerPreference: 'low-power',
  });
  const FULLSCREEN_TRIANGLE = new Float32Array([-1, -1, 3, -1, -1, 3]);
  const VERTEX_SHADER_WEBGL1 = `
    precision highp float;
    attribute vec2 position;
    varying vec2 vUv;
    void main() {
      vUv = position * 0.5 + 0.5;
      gl_Position = vec4(position, 0.0, 1.0);
    }
  `;
  const VERTEX_SHADER_WEBGL2 = `#version 300 es
    precision highp float;
    in vec2 position;
    out vec2 vUv;
    void main() {
      vUv = position * 0.5 + 0.5;
      gl_Position = vec4(position, 0.0, 1.0);
    }
  `;
  const FRAGMENT_SHADER_BODY = `
    uniform float iTime;
    uniform vec3 iResolution;
    uniform float hue;
    uniform float rot;
    uniform float noiseScale;
    uniform float innerRadius;
    VARYING vec2 vUv;

    vec3 rgb2yiq(vec3 c) {
      return vec3(
        dot(c, vec3(0.299, 0.587, 0.114)),
        dot(c, vec3(0.596, -0.274, -0.322)),
        dot(c, vec3(0.211, -0.523, 0.312))
      );
    }

    vec3 yiq2rgb(vec3 c) {
      return vec3(
        c.x + 0.956 * c.y + 0.621 * c.z,
        c.x - 0.272 * c.y - 0.647 * c.z,
        c.x - 1.106 * c.y + 1.703 * c.z
      );
    }

    vec3 adjustHue(vec3 color, float hueDeg) {
      float hueRad = radians(hueDeg);
      vec3 yiq = rgb2yiq(color);
      float cosA = cos(hueRad);
      float sinA = sin(hueRad);
      yiq.yz = vec2(yiq.y * cosA - yiq.z * sinA, yiq.y * sinA + yiq.z * cosA);
      return yiq2rgb(yiq);
    }

    vec3 hash33(vec3 p3) {
      p3 = fract(p3 * vec3(0.1031, 0.11369, 0.13787));
      p3 += dot(p3, p3.yxz + 19.19);
      return -1.0 + 2.0 * fract(vec3(p3.x + p3.y, p3.x + p3.z, p3.y + p3.z) * p3.zyx);
    }

    float snoise3(vec3 p) {
      const float K1 = 0.333333333;
      const float K2 = 0.166666667;
      vec3 i = floor(p + (p.x + p.y + p.z) * K1);
      vec3 d0 = p - (i - (i.x + i.y + i.z) * K2);
      vec3 e = step(vec3(0.0), d0 - d0.yzx);
      vec3 i1 = e * (1.0 - e.zxy);
      vec3 i2 = 1.0 - e.zxy * (1.0 - e);
      vec3 d1 = d0 - (i1 - K2);
      vec3 d2 = d0 - (i2 - K1);
      vec3 d3 = d0 - 0.5;
      vec4 h = max(0.6 - vec4(dot(d0, d0), dot(d1, d1), dot(d2, d2), dot(d3, d3)), 0.0);
      vec4 n = h * h * h * h * vec4(
        dot(d0, hash33(i)),
        dot(d1, hash33(i + i1)),
        dot(d2, hash33(i + i2)),
        dot(d3, hash33(i + 1.0))
      );
      return dot(vec4(31.316), n);
    }

    vec4 extractAlpha(vec3 colorIn) {
      float a = max(max(colorIn.r, colorIn.g), colorIn.b);
      return vec4(colorIn.rgb / (a + 1e-5), a);
    }

    const vec3 baseColor0 = vec3(0.239, 0.353, 1.0);
    const vec3 baseColor1 = vec3(0.616, 0.0, 1.0);
    const vec3 baseColor2 = vec3(1.0, 0.373, 0.122);
    const vec3 baseColor3 = vec3(0.0, 0.0, 0.0);

    float light1(float intensity, float attenuation, float dist) {
      return intensity / (1.0 + dist * attenuation);
    }

    float light2(float intensity, float attenuation, float dist) {
      return intensity / (1.0 + dist * dist * attenuation);
    }

    vec4 draw(vec2 uv) {
      vec3 color0 = adjustHue(baseColor0, hue);
      vec3 color1 = adjustHue(baseColor1, hue);
      vec3 color2 = adjustHue(baseColor2, hue);
      vec3 color3 = adjustHue(baseColor3, hue);

      float len = length(uv);
      float invLen = len > 0.0 ? 1.0 / len : 0.0;

      float pulse = sin(iTime * 1.5) * 0.02;
      float n0 = snoise3(vec3(uv * noiseScale, iTime * 0.5)) * 0.5 + 0.5;
      float r0 = mix(mix(innerRadius + pulse, 1.0, 0.4), mix(innerRadius + pulse, 1.0, 0.6), n0);

      float d0 = distance(uv, (r0 * invLen) * uv);
      float v0 = light1(1.0, 10.0, d0);
      v0 *= smoothstep(r0 * 1.05, r0, len);
      float cl = cos(atan(uv.y, uv.x) + iTime * 2.0) * 0.5 + 0.5;

      float a = iTime * -1.0;
      vec2 pos = vec2(cos(a), sin(a)) * r0;
      float d = distance(uv, pos);
      float v1 = light2(1.5, 5.0, d);
      v1 *= light1(1.0, 50.0, d0);

      float v2 = smoothstep(1.0, mix(innerRadius, 1.0, n0 * 0.5), len);
      float v3 = smoothstep(innerRadius, mix(innerRadius, 1.0, 0.5), len);

      vec3 col = mix(color1, color2, cl);
      col = mix(col, color0, n0);
      col = mix(color3, col, v0);
      col = (col + v1) * v2 * v3;
      col = clamp(col, 0.0, 1.0);

      return extractAlpha(col);
    }

    void main() {
      vec2 center = iResolution.xy * 0.5;
      float size = min(iResolution.x, iResolution.y);
      vec2 uv = (vUv * iResolution.xy - center) / size * 2.0;

      float s = sin(rot);
      float c = cos(rot);
      uv = vec2(c * uv.x - s * uv.y, s * uv.x + c * uv.y);

      vec4 col = draw(uv);
      FRAGMENT_OUTPUT = vec4(col.rgb * col.a, col.a);
    }
  `;

  let trigger = null;
  let orb = null;
  let canvas = null;
  let gl = null;
  let program = null;
  let positionBuffer = null;
  let uniforms = null;
  let positionLocation = -1;
  let isWebGL2 = false;
  let animationFrame = null;
  let resizeObserver = null;
  let bodyObserver = null;
  let hideTimer = null;
  let initialized = false;
  let destroyed = false;
  let manuallyPaused = false;
  let contextLost = false;
  let elapsedTime = 0;
  let rotation = 0;
  let previousTime = null;
  const config = { ...DEFAULT_ORB_CONFIG };
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  function clamp(value, minimum, maximum) {
    return Math.min(maximum, Math.max(minimum, value));
  }

  function setRendererState(state) {
    if (trigger) trigger.dataset.orbRenderer = state;
  }

  function stopLoop() {
    if (animationFrame !== null) cancelAnimationFrame(animationFrame);
    animationFrame = null;
    previousTime = null;
  }

  function isLauncherVisible() {
    if (!trigger || document.visibilityState !== 'visible') return false;
    if (document.body.classList.contains('signal-desk-open')) return false;
    const anchor = trigger.closest('.signal-desk-trigger-anchor');
    if (!anchor || anchor.getClientRects().length === 0) return false;
    const style = window.getComputedStyle(anchor);
    return style.display !== 'none' && style.visibility !== 'hidden';
  }

  function shouldAnimate() {
    return initialized
      && !destroyed
      && !manuallyPaused
      && !contextLost
      && !reducedMotion.matches
      && Boolean(program)
      && isLauncherVisible();
  }

  function compileShader(type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      gl.deleteShader(shader);
      return null;
    }
    return shader;
  }

  function releaseResources() {
    if (!gl || contextLost) return;
    if (positionBuffer) gl.deleteBuffer(positionBuffer);
    if (program) gl.deleteProgram(program);
    positionBuffer = null;
    program = null;
    uniforms = null;
    positionLocation = -1;
  }

  function buildResources() {
    releaseResources();
    const vertexSource = isWebGL2 ? VERTEX_SHADER_WEBGL2 : VERTEX_SHADER_WEBGL1;
    const fragmentSource = isWebGL2
      ? `#version 300 es\nprecision highp float;\n#define VARYING in\nout vec4 orbColor;\n#define FRAGMENT_OUTPUT orbColor\n${FRAGMENT_SHADER_BODY}`
      : `precision highp float;\n#define VARYING varying\n#define FRAGMENT_OUTPUT gl_FragColor\n${FRAGMENT_SHADER_BODY}`;
    const vertexShader = compileShader(gl.VERTEX_SHADER, vertexSource);
    const fragmentShader = compileShader(gl.FRAGMENT_SHADER, fragmentSource);
    if (!vertexShader || !fragmentShader) {
      if (vertexShader) gl.deleteShader(vertexShader);
      if (fragmentShader) gl.deleteShader(fragmentShader);
      return false;
    }
    const nextProgram = gl.createProgram();
    gl.attachShader(nextProgram, vertexShader);
    gl.attachShader(nextProgram, fragmentShader);
    gl.linkProgram(nextProgram);
    gl.deleteShader(vertexShader);
    gl.deleteShader(fragmentShader);
    if (!gl.getProgramParameter(nextProgram, gl.LINK_STATUS)) {
      gl.deleteProgram(nextProgram);
      return false;
    }
    program = nextProgram;
    positionLocation = gl.getAttribLocation(program, 'position');
    positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, FULLSCREEN_TRIANGLE, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);
    uniforms = Object.freeze({
      time: gl.getUniformLocation(program, 'iTime'),
      resolution: gl.getUniformLocation(program, 'iResolution'),
      hue: gl.getUniformLocation(program, 'hue'),
      rotation: gl.getUniformLocation(program, 'rot'),
      noiseScale: gl.getUniformLocation(program, 'noiseScale'),
      innerRadius: gl.getUniformLocation(program, 'innerRadius'),
    });
    gl.disable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.clearColor(0, 0, 0, 0);
    return true;
  }

  function resizeCanvas() {
    if (!canvas || !gl || contextLost) return false;
    const bounds = orb.getBoundingClientRect();
    const pixelRatio = Math.min(window.devicePixelRatio || 1, config.maxDevicePixelRatio);
    const width = Math.max(1, Math.round(bounds.width * pixelRatio));
    const height = Math.max(1, Math.round(bounds.height * pixelRatio));
    if (canvas.width === width && canvas.height === height) return false;
    canvas.width = width;
    canvas.height = height;
    gl.viewport(0, 0, width, height);
    return true;
  }

  function renderFrame() {
    if (!gl || !program || contextLost) return;
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(program);
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);
    gl.uniform1f(uniforms.time, elapsedTime);
    gl.uniform3f(uniforms.resolution, canvas.width, canvas.height, canvas.width / canvas.height);
    gl.uniform1f(uniforms.hue, config.hue);
    gl.uniform1f(uniforms.rotation, rotation);
    gl.uniform1f(uniforms.noiseScale, config.noiseScale);
    gl.uniform1f(uniforms.innerRadius, config.innerRadius);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  function frame(now) {
    if (!shouldAnimate()) {
      stopLoop();
      return;
    }
    const delta = previousTime === null
      ? 0
      : Math.min(Math.max((now - previousTime) / 1000, 0), 0.1);
    previousTime = now;
    elapsedTime += delta * config.timeScale;
    rotation += delta * config.rotationSpeed;
    renderFrame();
    animationFrame = requestAnimationFrame(frame);
  }

  function reconcileRendering() {
    if (!initialized || destroyed || contextLost || !program) return;
    resizeCanvas();
    if (reducedMotion.matches) {
      stopLoop();
      setRendererState('reduced-motion');
      renderFrame();
      return;
    }
    setRendererState('webgl');
    if (!shouldAnimate()) {
      stopLoop();
      return;
    }
    if (animationFrame === null) animationFrame = requestAnimationFrame(frame);
  }

  function handleLauncherVisibilityChange() {
    if (hideTimer !== null) window.clearTimeout(hideTimer);
    if (document.body.classList.contains('signal-desk-open')) {
      hideTimer = window.setTimeout(() => {
        hideTimer = null;
        reconcileRendering();
      }, 220);
      return;
    }
    hideTimer = null;
    reconcileRendering();
  }

  function handleContextLost(event) {
    event.preventDefault();
    contextLost = true;
    stopLoop();
    program = null;
    positionBuffer = null;
    uniforms = null;
    setRendererState('fallback');
  }

  function handleContextRestored() {
    contextLost = false;
    if (!buildResources()) {
      setRendererState('fallback');
      return;
    }
    resizeCanvas();
    renderFrame();
    reconcileRendering();
  }

  function handleReducedMotionChange() {
    reconcileRendering();
  }

  function init() {
    if (initialized || destroyed) return initialized;
    trigger = document.querySelector('[data-signal-desk-open]');
    canvas = trigger?.querySelector('[data-signal-desk-orb-canvas]') || null;
    orb = canvas?.closest('.signal-desk-trigger__orb') || null;
    if (!trigger || !canvas || !orb) return false;
    initialized = true;
    gl = canvas.getContext('webgl2', CONTEXT_OPTIONS);
    isWebGL2 = Boolean(gl);
    if (!gl) gl = canvas.getContext('webgl', CONTEXT_OPTIONS);
    if (!gl || !buildResources()) {
      setRendererState('fallback');
      return false;
    }
    canvas.addEventListener('webglcontextlost', handleContextLost);
    canvas.addEventListener('webglcontextrestored', handleContextRestored);
    if ('ResizeObserver' in window) {
      resizeObserver = new ResizeObserver(() => {
        const changed = resizeCanvas();
        if (changed && animationFrame === null) renderFrame();
      });
      resizeObserver.observe(orb);
    }
    bodyObserver = new MutationObserver(handleLauncherVisibilityChange);
    bodyObserver.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    window.addEventListener('resize', reconcileRendering, { passive: true });
    window.visualViewport?.addEventListener('resize', reconcileRendering, { passive: true });
    document.addEventListener('visibilitychange', reconcileRendering);
    window.addEventListener('pagehide', stopLoop);
    window.addEventListener('pageshow', reconcileRendering);
    reducedMotion.addEventListener?.('change', handleReducedMotionChange);
    resizeCanvas();
    renderFrame();
    reconcileRendering();
    return true;
  }

  function pause() {
    manuallyPaused = true;
    stopLoop();
  }

  function resume() {
    manuallyPaused = false;
    reconcileRendering();
  }

  function updateConfig(nextConfig = {}) {
    if (!nextConfig || typeof nextConfig !== 'object' || Array.isArray(nextConfig)) {
      return Object.freeze({ ...config });
    }
    Object.keys(CONFIG_LIMITS).forEach((key) => {
      const value = nextConfig[key];
      if (typeof value !== 'number' || !Number.isFinite(value)) return;
      const [minimum, maximum] = CONFIG_LIMITS[key];
      config[key] = clamp(value, minimum, maximum);
    });
    resizeCanvas();
    if (animationFrame === null && program && !contextLost) renderFrame();
    return Object.freeze({ ...config });
  }

  function destroy() {
    if (destroyed) return;
    destroyed = true;
    stopLoop();
    if (hideTimer !== null) window.clearTimeout(hideTimer);
    hideTimer = null;
    resizeObserver?.disconnect();
    bodyObserver?.disconnect();
    window.removeEventListener('resize', reconcileRendering);
    window.visualViewport?.removeEventListener('resize', reconcileRendering);
    document.removeEventListener('visibilitychange', reconcileRendering);
    window.removeEventListener('pagehide', stopLoop);
    window.removeEventListener('pageshow', reconcileRendering);
    reducedMotion.removeEventListener?.('change', handleReducedMotionChange);
    canvas?.removeEventListener('webglcontextlost', handleContextLost);
    canvas?.removeEventListener('webglcontextrestored', handleContextRestored);
    releaseResources();
    setRendererState('fallback');
  }

  window.MarkStreetSignalDeskOrb = Object.freeze({
    init,
    destroy,
    pause,
    resume,
    updateConfig,
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
