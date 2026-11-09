import {
  WebGLRenderer,
  Scene,
  PerspectiveCamera,
  Group,
  Mesh,
  Shape,
  ExtrudeGeometry,
  ShapeGeometry,
  CylinderGeometry,
  MeshStandardMaterial,
  MeshBasicMaterial,
  ShaderMaterial,
  Matrix4,
  Vector3,
  type Object3D,
  VideoTexture,
  TextureLoader,
  SRGBColorSpace,
  PMREMGenerator,
  DirectionalLight,
  ACESFilmicToneMapping,
  type BufferGeometry,
  type Texture,
} from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { cursorFollower } from './cursor';
import { hingeAngles } from './fold-math';

/**
 * The Work section's foldable: an original space-black book-style foldable drawn with three.js.
 * Closed, its cover screen shows a lock screen with a tracker alert. The hinge is on the left of the
 * cover screen and the front half opens to the left like a book cover. As you scroll through the
 * pinned track it turns once to face you while unfolding to 180°, and the inner screen plays the
 * dashboard loop with a parallax: the picture holds still from the viewer's side while the
 * hardware folds around it. Everything is driven by scroll; nothing loops on its own.
 */

// One half of the device, in scene units (height 1). The open inner screen is 1.38:1, the same
// shape as the recorded dashboard, so nothing is cropped.
const W = 0.68;
const H = 1;
const T = 0.032;
const R = 0.085; // outer corner radius
const RH = 0.012; // hinge-side corner radius
const BEVEL = 0.009;
export const SCREEN_ASPECT = 1.38;
const BEZEL = (SCREEN_ASPECT * H - 2 * W) / (2 * SCREEN_ASPECT - 2); // inner screen border on the three outer sides
const COVER_H = 0.92;
const COVER_W = COVER_H * (414 / 600);

// Inner screen: unlit, with the screen parallax. Each fragment samples the picture where the ray
// from a fixed eye in front of the open device meets the open screen's plane (see fold-math.ts).
const innerVertex = /* glsl */ `
  uniform mat4 uToDevice;
  varying vec3 vDev;
  void main() {
    vDev = (uToDevice * vec4(position, 1.0)).xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const innerFragment = /* glsl */ `
  uniform sampler2D map;
  uniform float hasMap;
  uniform vec3 eye;
  uniform vec4 rect;
  uniform float plane;
  varying vec3 vDev;
  void main() {
    vec3 dir = vDev - eye;
    vec2 q = eye.xy + dir.xy * ((plane - eye.z) / dir.z);
    vec2 uv = clamp((q - rect.xy) / (rect.zw - rect.xy), 0.0, 1.0);
    // Screen pixels pass straight through: the textures are left undecoded (sRGB in, sRGB out).
    vec3 col = hasMap > 0.5 ? texture2D(map, uv).rgb : vec3(0.067, 0.067, 0.063);
    gl_FragColor = vec4(col, 1.0);
  }
`;

const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const smooth = (a: number, b: number, v: number) => { const t = clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

/** A rectangle with its own radius at each corner (top-left, top-right, bottom-right, bottom-left). */
function roundedRect(x0: number, y0: number, x1: number, y1: number, tl: number, tr: number, br: number, bl: number): Shape {
  const s = new Shape();
  s.moveTo(x0 + bl, y0);
  s.lineTo(x1 - br, y0);
  if (br) s.quadraticCurveTo(x1, y0, x1, y0 + br);
  s.lineTo(x1, y1 - tr);
  if (tr) s.quadraticCurveTo(x1, y1, x1 - tr, y1);
  s.lineTo(x0 + tl, y1);
  if (tl) s.quadraticCurveTo(x0, y1, x0, y1 - tl);
  s.lineTo(x0, y0 + bl);
  if (bl) s.quadraticCurveTo(x0, y0, x0 + bl, y0);
  return s;
}

/** Flat shape with UVs spread over [u0, u1] x [0, 1] across its bounding box. */
function screenGeometry(shape: Shape, u0 = 0, u1 = 1): BufferGeometry {
  const g = new ShapeGeometry(shape, 12);
  g.computeBoundingBox();
  const b = g.boundingBox!;
  const pos = g.attributes.position;
  const uv = g.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    uv.setXY(i, lerp(u0, u1, (pos.getX(i) - b.min.x) / (b.max.x - b.min.x)), (pos.getY(i) - b.min.y) / (b.max.y - b.min.y));
  }
  uv.needsUpdate = true;
  return g;
}

/** A slab whose top face sits at z = 0 and whose back is at z = -T. */
function slab(shape: Shape): BufferGeometry {
  const g = new ExtrudeGeometry(shape, {
    depth: T - 2 * BEVEL,
    bevelEnabled: true,
    bevelThickness: BEVEL,
    bevelSize: BEVEL,
    bevelOffset: -BEVEL,
    bevelSegments: 4,
    curveSegments: 16,
  });
  g.translate(0, 0, -(T - BEVEL));
  return g;
}

export type FoldHandle = {
  destroy: () => void;
  screenAspect: number;
  /** For tests: where a part of the device is on screen, in px from the stage's left edge. */
  screenX: (part: 'spine' | 'frontEdge') => number;
};

/** Waits for an idle moment so the setup never blocks scrolling in one long task. */
const idle = () => new Promise<void>((r) => ('requestIdleCallback' in window ? window.requestIdleCallback(() => r(), { timeout: 400 }) : setTimeout(r, 30)));

export async function initFold(track: HTMLElement): Promise<FoldHandle | null> {
  const stage = track.querySelector<HTMLElement>('[data-fold-stage]');
  const work = document.getElementById('work');
  if (!stage || !work) return null;

  let renderer: WebGLRenderer;
  try {
    renderer = new WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  } catch {
    return null;
  }
  if (!renderer.getContext()) return null;
  const coarse = window.matchMedia('(pointer: coarse)').matches;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, coarse ? 1.5 : 2));
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1;
  // Render state: draw only when something changed.
  let p = 0;
  let dirty = true;
  let lastAngle = -1;
  let shown = false;
  let raf = 0;
  let active = false;
  let lastVideoTime = -1;
  let pointer = { x: -1, y: -1 };
  let overDevice = false;
  let labelled = false;

  const canvas = renderer.domElement;
  canvas.setAttribute('data-fold-canvas', '');
  canvas.setAttribute('aria-hidden', 'true');
  canvas.className = 'fold__canvas';
  stage.appendChild(canvas);

  await idle();
  const scene = new Scene();
  const key = new DirectionalLight(0xffffff, 1.4);
  key.position.set(2.5, 3, 4);
  scene.add(key);

  const camera = new PerspectiveCamera(26, 1, 0.1, 50);

  // Materials: space-black anodised frame, black glass faces, unlit screens.
  const metal = new MeshStandardMaterial({ color: 0x1d1d1f, metalness: 0.9, roughness: 0.36 });
  const glass = new MeshStandardMaterial({ color: 0x050506, metalness: 0.2, roughness: 0.08 });
  const loader = new TextureLoader();
  const asTexture = (t: Texture) => { t.colorSpace = SRGBColorSpace; t.anisotropy = renderer.capabilities.getMaxAnisotropy(); return t; };
  // One material per inner half: each carries its own transform into device space.
  const SCREEN_Z = 0.0012;
  const innerScreen = () => new ShaderMaterial({
    vertexShader: innerVertex,
    fragmentShader: innerFragment,
    uniforms: {
      map: { value: null },
      hasMap: { value: 0 },
      uToDevice: { value: new Matrix4() },
      eye: { value: new Vector3(0, 0, 2.4) },
      rect: { value: [-W + BEZEL, -H / 2 + BEZEL, W - BEZEL, H / 2 - BEZEL] },
      plane: { value: SCREEN_Z },
    },
  });
  const innerFront = innerScreen();
  const innerBack = innerScreen();
  const setInner = (t: Texture) => {
    for (const m of [innerFront, innerBack]) { m.uniforms.map.value = t; m.uniforms.hasMap.value = 1; }
    dirty = true;
  };
  const coverMat = new MeshBasicMaterial({ color: 0x111110, toneMapped: false });

  const geos: BufferGeometry[] = [];
  const mesh = (g: BufferGeometry, m: MeshStandardMaterial | MeshBasicMaterial | ShaderMaterial) => { geos.push(g); return new Mesh(g, m); };

  // Back half (fixed, right of the hinge at x = 0) and front half (turns about the hinge; it lies
  // over the back half when closed and opens out to the left).
  const device = new Group();
  const toDevice = (screen: Mesh, mat: ShaderMaterial) => {
    const inv = new Matrix4();
    screen.onBeforeRender = () => {
      inv.copy(device.matrixWorld).invert();
      mat.uniforms.uToDevice.value.multiplyMatrices(inv, screen.matrixWorld);
    };
  };
  const a = new Group();
  a.add(mesh(slab(roundedRect(0, -H / 2, W, H / 2, RH, R, R, RH)), metal));
  const faceA = mesh(new ShapeGeometry(roundedRect(0.0015, -H / 2 + 0.003, W - 0.003, H / 2 - 0.003, RH, R - 0.003, R - 0.003, RH), 12), glass);
  faceA.position.z = 0.0006;
  a.add(faceA);
  const screenA = mesh(new ShapeGeometry(roundedRect(0, -H / 2 + BEZEL, W - BEZEL, H / 2 - BEZEL, 0, R - BEZEL, R - BEZEL, 0), 12), innerBack) as Mesh;
  screenA.position.z = SCREEN_Z;
  toDevice(screenA, innerBack);
  a.add(screenA);

  const pivot = new Group();
  const b = new Group();
  b.add(mesh(slab(roundedRect(-W, -H / 2, 0, H / 2, R, RH, RH, R)), metal));
  const faceB = mesh(new ShapeGeometry(roundedRect(-W + 0.003, -H / 2 + 0.003, -0.0015, H / 2 - 0.003, R - 0.003, RH, RH, R - 0.003), 12), glass);
  faceB.position.z = 0.0006;
  b.add(faceB);
  const screenB = mesh(new ShapeGeometry(roundedRect(-W + BEZEL, -H / 2 + BEZEL, 0, H / 2 - BEZEL, R - BEZEL, 0, 0, R - BEZEL), 12), innerFront) as Mesh;
  screenB.position.z = SCREEN_Z;
  toDevice(screenB, innerFront);
  b.add(screenB);
  // The outside of the front half carries the cover screen, under black glass, with a camera hole.
  const backGlass = new ShapeGeometry(roundedRect(-W / 2 + 0.003, -H / 2 + 0.003, W / 2 - 0.003, H / 2 - 0.003, R - 0.003, R - 0.003, R - 0.003, R - 0.003), 12);
  backGlass.rotateY(Math.PI);
  backGlass.translate(-W / 2, 0, -T - 0.0006);
  b.add(mesh(backGlass, glass));
  const cover = screenGeometry(roundedRect(-COVER_W / 2, -COVER_H / 2, COVER_W / 2, COVER_H / 2, R - 0.03, R - 0.03, R - 0.03, R - 0.03));
  cover.rotateY(Math.PI);
  cover.translate(-W / 2, 0, -T - 0.0012);
  b.add(mesh(cover, coverMat));
  const hole = new ShapeGeometry(roundedRect(-0.011, -0.011, 0.011, 0.011, 0.011, 0.011, 0.011, 0.011), 12);
  hole.rotateY(Math.PI);
  hole.translate(-W / 2, COVER_H / 2 - 0.028, -T - 0.0018);
  b.add(mesh(hole, new MeshBasicMaterial({ color: 0x020202 })));
  pivot.add(b);

  // The hinge spine: a half cylinder that faces outwards (-x) when closed and tucks behind when open.
  const spine = mesh(new CylinderGeometry(T * 0.985, T * 0.985, H - 2 * RH, 32, 1, false, Math.PI, Math.PI), metal);
  device.add(a, pivot, spine);
  const root = new Group();
  root.add(device);
  scene.add(root);

  // Reflections from a small studio environment, then compile the shaders off the main thread
  // where the browser supports it.
  await idle();
  const pmrem = new PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  scene.environment = pmrem.fromScene(room, 0.04, 0.1, 100, { size: 128 }).texture;
  room.dispose();
  await idle();
  try { await renderer.compileAsync(scene, camera); } catch { /* compiles on first render instead */ }

  // Textures: the lock screen and the first dashboard frame now; the video only once it opens.
  const { cover: coverUrl, inner: innerUrl, innerPoster } = track.dataset;
  const ready = { cover: false };
  if (coverUrl) loader.load(coverUrl, (t) => { coverMat.map = asTexture(t); coverMat.color.set(0xffffff); coverMat.needsUpdate = true; ready.cover = true; dirty = true; });
  if (innerPoster) loader.load(innerPoster, (t) => { if (!videoTex) { t.anisotropy = renderer.capabilities.getMaxAnisotropy(); setInner(t); } });
  const video = document.createElement('video');
  video.muted = true;
  video.loop = true;
  video.playsInline = true;
  video.preload = 'none';
  video.crossOrigin = 'anonymous';
  let videoTex: VideoTexture | null = null;
  const startVideo = () => {
    if (!innerUrl || video.src) return;
    video.src = innerUrl;
    video.addEventListener('loadeddata', () => {
      videoTex = new VideoTexture(video);
      videoTex.needsUpdate = true; // upload the current frame now, before playback starts
      (innerFront.uniforms.map.value as Texture | null)?.dispose();
      setInner(videoTex);
    }, { once: true });
  };

  // Size the canvas to the stage.
  let aspect = 1;
  const resize = () => {
    const w = stage.clientWidth, h = stage.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    aspect = w / h;
    camera.aspect = aspect;
    camera.updateProjectionMatrix();
    dirty = true;
  };
  // Whether the pointer is over the open device (its middle part of the stage), for the cursor label.
  const isOverDevice = () => {
    const r = stage.getBoundingClientRect();
    return Math.abs(pointer.x - (r.left + r.width / 2)) < r.width * 0.42 && Math.abs(pointer.y - (r.top + r.height / 2)) < r.height * 0.4;
  };
  const onPointer = (e: PointerEvent) => {
    if (e.pointerType !== 'mouse') return;
    pointer = { x: e.clientX, y: e.clientY };
    const now = isOverDevice();
    if (now !== overDevice) { overDevice = now; dirty = true; }
  };
  window.addEventListener('pointermove', onPointer, { passive: true });
  const ro = new ResizeObserver(resize);
  ro.observe(stage);
  resize();

  const fitDistance = (w: number, h: number) => {
    const t = Math.tan((camera.fov * Math.PI) / 360);
    return Math.max(h / (2 * t), w / (2 * t * aspect));
  };

  // Scroll progress through the pinned track: < 0 while it scrolls in, 0..1 while pinned.
  const progress = () => {
    const r = track.getBoundingClientRect();
    const vh = window.innerHeight;
    const run = Math.max(1, track.offsetHeight - vh);
    return clamp(-r.top / run, -1, 1);
  };
  p = progress();

  const apply = () => {
    const unfold = smooth(0.1, 0.8, p);
    const hinge = hingeAngles(unfold);
    const theta = hinge.theta;
    pivot.rotation.y = hinge.pivot;
    spine.rotation.y = hinge.spine;
    // Keep the device centred as its outline grows to the left.
    const left = Math.min(0, hinge.outerEdgeX(W));
    device.position.x = -(W + left) / 2;
    device.position.z = -0.5 * W * Math.sin(theta) * 0.6;

    // One clear turn: a three-quarter view that swings round to face you while it opens.
    const turn = easeOut(smooth(0, 0.86, p));
    const enter = clamp(-p); // 1 when the stage is just entering, 0 once pinned
    root.rotation.y = lerp(0.62, 0, turn) + 0.18 * enter; // starts showing the hinge side
    root.rotation.x = lerp(0.2, 0, turn) + 0.05 * enter;
    root.position.y = -0.12 * enter;

    // Frame the closed phone by height and the open device by width; portrait screens get closer.
    const portrait = aspect < 1;
    const dClosed = fitDistance((W + T) / (portrait ? 0.62 : 0.42), H / 0.64);
    const dOpen = fitDistance((2 * W) / (portrait ? 0.94 : 0.86), H / 0.8);
    camera.position.set(0, 0, lerp(dClosed, dOpen, unfold));
    camera.lookAt(0, 0, 0);

    const deg = Math.round((theta * 180) / Math.PI);
    if (deg !== lastAngle) { track.setAttribute('data-fold-angle', String(deg)); lastAngle = deg; }
    // Once it is open, the glass cursor reads "Live demo" over it.
    overDevice = isOverDevice();
    const wantLabel = active && overDevice && unfold > 0.9;
    if (wantLabel !== labelled) {
      labelled = wantLabel;
      const c = cursorFollower();
      if (c) { if (wantLabel) c.setText('Live demo'); else c.removeText(); }
    }
    if (unfold > 0.15) startVideo();
    const wantPlay = unfold > 0.35 && active && onScreen();
    if (wantPlay && video.paused && video.src) video.play().catch(() => {});
    if (!wantPlay && !video.paused) video.pause();
  };

  // Kept warm just outside the screen, but drawn (and the video played) only while visible.
  const onScreen = () => { const r = stage.getBoundingClientRect(); return r.bottom > 0 && r.top < window.innerHeight; };
  let wasOnScreen = false;
  const frame = () => {
    raf = requestAnimationFrame(frame);
    const visibleNow = onScreen();
    if (!visibleNow) {
      if (wasOnScreen) { wasOnScreen = false; if (!video.paused) video.pause(); }
      return;
    }
    if (!wasOnScreen) { wasOnScreen = true; dirty = true; }
    const target = progress();
    const next = Math.abs(target - p) < 0.0005 ? target : p + (target - p) * (coarse ? 0.25 : 0.16);
    if (next !== p) { p = next; dirty = true; }
    if (videoTex && video.currentTime !== lastVideoTime) { lastVideoTime = video.currentTime; dirty = true; }
    if (!dirty) return;
    dirty = false;
    apply();
    renderer.render(scene, camera);
    if (!shown && ready.cover) { shown = true; work.classList.add('is-3d'); }
  };
  const start = () => { if (active) return; active = true; dirty = true; raf = requestAnimationFrame(frame); };
  const stop = () => {
    if (!active) return;
    active = false;
    cancelAnimationFrame(raf);
    video.pause();
    if (labelled) { labelled = false; cursorFollower()?.removeText(); }
  };
  const io = new IntersectionObserver(([e]) => (e.isIntersecting ? start() : stop()), { rootMargin: '25% 0px' });
  io.observe(track);

  const probe = new Vector3();
  const stageX = (obj: Object3D, x: number) => {
    scene.updateMatrixWorld();
    probe.set(x, 0, 0);
    obj.localToWorld(probe);
    probe.project(camera);
    return (probe.x * 0.5 + 0.5) * stage.clientWidth;
  };
  const handle: FoldHandle = {
    screenAspect: SCREEN_ASPECT,
    screenX: (part) => (part === 'spine' ? stageX(device, -T) : stageX(b, -W)),
    destroy: () => {
      io.disconnect();
      ro.disconnect();
      window.removeEventListener('pointermove', onPointer);
      stop();
      video.removeAttribute('src');
      geos.forEach((g) => g.dispose());
      [metal, glass, coverMat].forEach((m) => { m.map?.dispose(); m.dispose(); });
      (innerFront.uniforms.map.value as Texture | null)?.dispose();
      innerFront.dispose();
      innerBack.dispose();
      scene.environment?.dispose();
      pmrem.dispose();
      renderer.dispose();
      canvas.remove();
      work.classList.remove('is-3d');
    },
  };
  (window as unknown as { __fold: FoldHandle }).__fold = handle;
  return handle;
}
