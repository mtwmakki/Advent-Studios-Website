import { Renderer, Program, Mesh, Plane, Texture } from 'ogl';

/**
 * The Work-section "melt": the laptop footage is drawn on a bendable WebGL mesh that flows
 * from the small thumbnail ([data-melt-from]) into the big player ([data-melt-to]) as you
 * scroll. Corners travel at different times and the surface bows with scroll speed, so it
 * reads like soft material; a warm grey duotone fades to full colour as it lands.
 * The DOM thumbnail and video stay underneath as the no-WebGL / reduced-motion fallback.
 */

const vertex = /* glsl */ `
  attribute vec2 uv;
  attribute vec3 position;
  uniform vec4 uFrom;      // x, y, w, h in CSS px (viewport)
  uniform vec4 uTo;
  uniform float uProgress;
  uniform float uVelocity;
  uniform vec2 uViewport;
  varying vec2 vUv;
  varying vec2 vSize;
  varying float vLocal;

  float ease(float t) { return t < 0.5 ? 4.0 * t * t * t : 1.0 - pow(-2.0 * t + 2.0, 3.0) / 2.0; }

  void main() {
    vUv = uv;
    // Each vertex starts later the further it is from the top-right corner.
    float delay = (1.0 - uv.x) * 0.7 + (1.0 - uv.y) * 0.3;
    float k = 0.55;
    float local = ease(clamp(uProgress * (1.0 + k) - delay * k, 0.0, 1.0));
    vLocal = local;

    vec2 from = uFrom.xy + vec2(uv.x, 1.0 - uv.y) * uFrom.zw;
    vec2 to = uTo.xy + vec2(uv.x, 1.0 - uv.y) * uTo.zw;
    vec2 p = mix(from, to, local);

    // Soft bow along the edges while travelling, plus a wobble from scroll speed.
    float travel = sin(local * 3.14159);
    float h = mix(uFrom.w, uTo.w, local);
    p.y += sin(uv.x * 3.14159) * travel * h * 0.12;
    p.x += sin(uv.y * 3.14159) * travel * h * 0.05;
    p.y += sin(uv.x * 3.14159) * uVelocity;

    vSize = mix(uFrom.zw, uTo.zw, local);
    vec2 clip = vec2(p.x / uViewport.x * 2.0 - 1.0, 1.0 - p.y / uViewport.y * 2.0);
    gl_Position = vec4(clip, 0.0, 1.0);
  }
`;

const fragment = /* glsl */ `
  precision highp float;
  uniform sampler2D tMap;
  uniform float uRadius;
  uniform float uColor;
  uniform float uReady;
  varying vec2 vUv;
  varying vec2 vSize;
  varying float vLocal;

  float roundedBox(vec2 p, vec2 b, float r) {
    vec2 q = abs(p) - b + r;
    return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
  }

  void main() {
    vec2 px = (vUv - 0.5) * vSize;
    float d = roundedBox(px, vSize * 0.5, uRadius);
    float alpha = 1.0 - smoothstep(-1.0, 0.5, d);
    vec3 video = texture2D(tMap, vUv).rgb;
    // Warm grey duotone (Obsidian -> Bone) that blooms into full colour as it lands.
    float l = dot(video, vec3(0.299, 0.587, 0.114));
    vec3 duo = mix(vec3(0.067, 0.067, 0.063), vec3(0.949, 0.945, 0.925), l);
    vec3 col = mix(duo, video, uColor);
    // Before the first video frame arrives, show the Obsidian card colour.
    col = mix(vec3(0.067, 0.067, 0.063), col, uReady);
    gl_FragColor = vec4(col * alpha, alpha);
  }
`;

const rectOf = (el: Element) => {
  const r = el.getBoundingClientRect();
  return [r.left, r.top, r.width, r.height];
};

export function initMelt(): (() => void) | null {
  const section = document.getElementById('work');
  const fromEl = section?.querySelector('[data-melt-from]');
  const toEl = section?.querySelector('[data-melt-to]');
  const domVideo = section?.querySelector<HTMLVideoElement>('[data-melt-video]');
  if (!section || !fromEl || !toEl || !domVideo) return null;

  let renderer: Renderer;
  try {
    renderer = new Renderer({ dpr: Math.min(window.devicePixelRatio || 1, 1.5), alpha: true, premultipliedAlpha: true, antialias: true });
  } catch {
    return null;
  }
  const gl = renderer.gl;
  if (!gl) return null;
  const canvas = gl.canvas as HTMLCanvasElement;
  canvas.setAttribute('data-melt', '');
  canvas.setAttribute('aria-hidden', 'true');
  canvas.className = 'melt-canvas';
  document.body.appendChild(canvas);

  // A separate, off-DOM video feeds the texture so browser offscreen-pausing never freezes it.
  // Nothing downloads until the section is reached; the poster stands in until frames arrive.
  const video = document.createElement('video');
  video.muted = true;
  video.loop = true;
  video.playsInline = true;
  video.preload = 'none';
  video.crossOrigin = 'anonymous';
  domVideo.querySelectorAll('source').forEach((s) => video.appendChild(s.cloneNode()));
  const poster = new Image();
  poster.decoding = 'async';

  const texture = new Texture(gl, { generateMipmaps: false, minFilter: gl.LINEAR, magFilter: gl.LINEAR });
  const program = new Program(gl, {
    vertex,
    fragment,
    transparent: true,
    cullFace: false,
    uniforms: {
      tMap: { value: texture },
      uFrom: { value: [0, 0, 1, 1] },
      uTo: { value: [0, 0, 1, 1] },
      uProgress: { value: 0 },
      uVelocity: { value: 0 },
      uViewport: { value: [window.innerWidth, window.innerHeight] },
      uRadius: { value: 14 },
      uColor: { value: 0 },
      uReady: { value: 0 },
    },
  });
  const mesh = new Mesh(gl, { geometry: new Plane(gl, { widthSegments: 48, heightSegments: 30 }), program });

  const resize = () => {
    renderer.setSize(window.innerWidth, window.innerHeight);
    program.uniforms.uViewport.value = [window.innerWidth, window.innerHeight];
  };
  resize();
  window.addEventListener('resize', resize);

  let raf = 0;
  let active = false;
  let lastY = window.scrollY;
  let velocity = 0;
  let source: 'none' | 'poster' | 'video' = 'none';
  let lastFrameTime = -1;
  let lastKey = '';
  let shown = false;

  const frame = () => {
    raf = requestAnimationFrame(frame);
    const vh = window.innerHeight;
    const from = rectOf(fromEl);
    const to = rectOf(toEl);
    // 0 when the player starts entering the screen, 1 when it is centred.
    const start = vh;
    const end = Math.max(0, (vh - to[3]) / 2);
    const progress = Math.min(1, Math.max(0, (start - to[1]) / (start - end)));

    const dy = window.scrollY - lastY;
    lastY = window.scrollY;
    velocity += (Math.max(-60, Math.min(60, dy * 1.4)) - velocity) * 0.12;

    // Upload a texture only when there is a new picture: the poster once, then each new video frame.
    let fresh = false;
    if (video.readyState >= 2 && video.currentTime !== lastFrameTime) {
      lastFrameTime = video.currentTime;
      texture.image = video;
      texture.needsUpdate = true;
      source = 'video';
      fresh = true;
    } else if (source === 'none' && poster.complete && poster.naturalWidth) {
      texture.image = poster;
      texture.needsUpdate = true;
      source = 'poster';
      fresh = true;
    }
    if (source === 'none') return;

    // Redraw only when something on screen changed.
    const v = Math.abs(velocity) < 0.05 ? 0 : velocity;
    const key = `${from.join()}|${to.join()}|${v.toFixed(2)}|${window.innerWidth}x${vh}`;
    if (!fresh && key === lastKey) return;
    lastKey = key;

    const u = program.uniforms;
    u.uFrom.value = from;
    u.uTo.value = to;
    u.uProgress.value = progress;
    u.uVelocity.value = v * Math.sin(progress * Math.PI + 0.2);
    u.uRadius.value = 14 + (24 - 14) * progress;
    u.uColor.value = Math.min(1, Math.max(0, (progress - 0.55) / 0.45));
    u.uReady.value = 1;
    renderer.render({ scene: mesh });
    // Hand over from the DOM copies only once the canvas has drawn a picture.
    if (!shown) {
      shown = true;
      section.classList.add('is-gl');
    }
  };

  const start = () => {
    if (active) return;
    active = true;
    canvas.style.visibility = 'visible';
    if (!poster.src) poster.src = domVideo.poster;
    video.preload = 'auto';
    video.play().catch(() => {});
    lastY = window.scrollY;
    lastKey = '';
    raf = requestAnimationFrame(frame);
  };
  const stop = () => {
    if (!active) return;
    active = false;
    cancelAnimationFrame(raf);
    video.pause();
    canvas.style.visibility = 'hidden';
  };

  // Runs while the section is on screen; it starts once its top passes the lower part of the screen.
  const io = new IntersectionObserver(([e]) => (e.isIntersecting ? start() : stop()), { rootMargin: '0px 0px -12% 0px' });
  io.observe(section);

  return () => {
    io.disconnect();
    stop();
    window.removeEventListener('resize', resize);
    canvas.remove();
    section.classList.remove('is-gl');
  };
}
