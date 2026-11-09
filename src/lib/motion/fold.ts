import {
  WebGLRenderer,
  Scene,
  PerspectiveCamera,
  Group,
  Mesh,
  MeshStandardMaterial,
  MeshBasicMaterial,
  VideoTexture,
  TextureLoader,
  BufferAttribute,
  Vector2,
  Vector3,
  Vector4,
  SRGBColorSpace,
  NoColorSpace,
  LinearFilter,
  LinearMipmapLinearFilter,
  PMREMGenerator,
  PlaneGeometry,
  DirectionalLight,
  HemisphereLight,
  ACESFilmicToneMapping,
  type BufferGeometry,
  type Texture,
  type Object3D,
} from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { cursorFollower } from './cursor';
import { hingeAngles } from './fold-math';

/**
 * The Work section's foldable: the iPhone Duo model by jadon7 (github.com/jadon7/iphone-duo),
 * used with the author's permission, in a white finish and without the Apple logo. Its fold and
 * screen shaders follow the author's viewer: only the cover half turns about the hinge, the inner
 * screen is a flexible strip that bends round it, and both screens are projected from a fixed eye
 * in front of the device, so the picture holds still while the hardware folds (the parallax),
 * with a soft blur and shade on the part still turning.
 *
 * As you scroll through the pinned track the closed phone flips from showing its back round to
 * its cover screen (a lock screen with a tracker alert), then unfolds to 180° while it turns to
 * face you, and the inner screen plays the dashboard loop. Everything is driven by scroll.
 */

// Model units (after the author's scale and centring). Open, the device spans x -8.3..8.3.
const HALF_W = 8.3;
const HEIGHT = 11.84;
const HINGE_Z = 0.275454;
const INNER_FRAME = new Vector4(-7.89935, 0.34562 - 5.8974, 15.7987, 11.1035);
export const SCREEN_ASPECT = INNER_FRAME.z / INNER_FRAME.w; // 1.4228: the recording matches it
const EYE = new Vector3(0, 0, 40);
const OUTER_FRAME = new Vector4(0.23396, 0.27173 - 5.8974, 7.73936, 11.2513).multiplyScalar((EYE.z - 0.24948) / (EYE.z - 0.825538));
const INNER = 'UXtsBZYlaUvHoEh';
const OUTER = 'hhgAIoCGsHXeDPY';
const HIDDEN = ['lJPfQMFXvvcmdtA'];
// The dark layer behind the back glass shows through where the Apple logo was: make it white too.
const BACK_LAYERS = ['UPeNpLgJbcWzHun'];
// The black surrounds behind the inner screen. The screen mesh has hairline cracks near the hinge,
// and lit, these surrounds showed through them as two grey lines down the open screen; drawn in
// flat black they disappear (they are a black bezel either way).
const UNDER_SCREEN = ['RwQzmCvUWHGlFfV', 'PXwNjghIIgDPXsa'];

const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const smooth = (a: number, b: number, v: number) => { const t = clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

// After jadon7's viewer: screen projection with the soft blur and shade on the turning part.
const screenShader = /* glsl */ `
uniform float foldAngle;
uniform vec2 uiPixel;
uniform vec4 uiFrame;
uniform vec2 uiGradient;
uniform vec3 uiReferenceEye;
varying vec3 vUIPosition;
vec3 toLinear(vec3 c) { return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(vec3(0.04045), c)); }
vec3 sampleUI(vec2 uv, float lod) { return toLinear(textureLod(map, clamp(uv, vec2(0.0), vec2(1.0)), lod).rgb); }
vec3 screenColor() {
  float depth = (0.24948 - uiReferenceEye.z) / (vUIPosition.z - uiReferenceEye.z);
  vec2 projected = uiReferenceEye.xy + (vUIPosition.xy - uiReferenceEye.xy) * depth;
  vec2 sourceUV = (projected - uiFrame.xy) / uiFrame.zw;
  #ifdef INNER_UI
    float progress = clamp(foldAngle / 1.570796327, 0.0, 1.0);
  #else
    float c = cos(foldAngle), s = sin(foldAngle);
    vec2 hingeEdge = vec2(-0.23396, -0.27463 - 0.275454);
    vec2 foldedEdge = vec2(c * hingeEdge.x + s * hingeEdge.y, -s * hingeEdge.x + c * hingeEdge.y + 0.275454);
    float edgeDepth = (0.24948 - uiReferenceEye.z) / (foldedEdge.y - uiReferenceEye.z);
    float anchorX = uiReferenceEye.x + (foldedEdge.x - uiReferenceEye.x) * edgeDepth;
    sourceUV.x = uiGradient.x + (projected.x - anchorX) / uiFrame.z;
    float progress = clamp((3.141592654 - foldAngle) / 1.570796327, 0.0, 1.0);
  #endif
  float edge = (sourceUV.x - uiGradient.x) / (uiGradient.y - uiGradient.x);
  float motion = smoothstep(0.0, 1.0, progress);
  float blurGradient = clamp(edge, 0.0, 1.0);
  float darkenGradient = clamp((edge - 0.2) / 0.8, 0.0, 1.0);
  float effect = motion * pow(darkenGradient, 1.35);
  float radius = 72.0 * motion * pow(blurGradient, 1.35);
  // Sharpness from the screen's own smooth UVs: the bent coordinates jump at the joins of the
  // bending strip, which picked a blurry mip there and drew hairlines down the open screen.
  vec2 aa = max(fwidth(vMapUv), uiPixel * 0.5);
  vec2 dx = dFdx(vMapUv) / uiPixel;
  vec2 dy = dFdy(vMapUv) / uiPixel;
  float baseLod = log2(max(1.0, max(length(dx), length(dy))));
  vec2 coverage = smoothstep(-aa, aa, sourceUV) * (1.0 - smoothstep(vec2(1.0) - aa, vec2(1.0) + aa, sourceUV));
  vec3 color = sampleUI(sourceUV, baseLod) * coverage.x * coverage.y;
  if (radius > 0.0) {
    float lod = max(baseLod, log2(max(1.0, radius)));
    vec2 footprint = max(aa, uiPixel * radius * 0.75);
    color = vec3(0.0);
    for (int y = -2; y <= 2; y++) {
      for (int x = -2; x <= 2; x++) {
        float wx = x == 0 ? 6.0 : (abs(x) == 1 ? 4.0 : 1.0);
        float wy = y == 0 ? 6.0 : (abs(y) == 1 ? 4.0 : 1.0);
        vec2 sampleUV = sourceUV + vec2(float(x), float(y)) * uiPixel * radius;
        vec2 cov = smoothstep(-footprint, footprint, sampleUV) * (1.0 - smoothstep(vec2(1.0) - footprint, vec2(1.0) + footprint, sampleUV));
        color += sampleUI(sampleUV, lod) * cov.x * cov.y * wx * wy / 256.0;
      }
    }
  }
  return color * (1.0 - min(1.0, effect * 2.0));
}
`;

// After jadon7's viewer: the cover half turns about the hinge; the flexible screen bends round it.
const foldShader = /* glsl */ `
uniform float foldAngle;
vec2 rotateHinge(vec2 p) {
  float c = cos(foldAngle), s = sin(foldAngle);
  p.y -= 0.275454;
  return vec2(c * p.x + s * p.y, -s * p.x + c * p.y + 0.275454);
}
#ifdef FLEXIBLE_SCREEN
vec4 bendStrip(vec3 p) {
  float halfWidth = 0.35;
  if (p.x >= halfWidth) return vec4(p.x, p.z, 1.0, 0.0);
  if (p.x <= -halfWidth) return vec4(rotateHinge(p.xz), cos(foldAngle), -sin(foldAngle));
  float t = (p.x + halfWidth) / (2.0 * halfWidth);
  float t2 = t*t, t3 = t2*t;
  vec2 a = rotateHinge(vec2(-halfWidth, p.z));
  vec2 b = vec2(halfWidth, p.z);
  vec2 ta = 2.0 * halfWidth * vec2(cos(foldAngle), -sin(foldAngle));
  vec2 tb = vec2(2.0 * halfWidth, 0.0);
  vec2 point = (2.0*t3-3.0*t2+1.0)*a + (t3-2.0*t2+t)*ta + (-2.0*t3+3.0*t2)*b + (t3-t2)*tb;
  vec2 tangent = normalize((6.0*t2-6.0*t)*a + (3.0*t2-4.0*t+1.0)*ta + (-6.0*t2+6.0*t)*b + (3.0*t2-2.0*t)*tb);
  return vec4(point, tangent);
}
#endif
`;

/** The white finish: every part gets its material from what it is in the original model. */
function finish(src: MeshStandardMaterial): MeshStandardMaterial {
  const c = src.color;
  const lum = 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
  const metal = src.metalness ?? 0;
  const rough = src.roughness ?? 1;
  if (lum > 0.35 && metal > 0.7) {
    // Frame, buttons and camera rings: white aluminium, polished where the original was.
    return new MeshStandardMaterial({ color: rough < 0.3 ? 0xeeede9 : 0xd9d7d2, metalness: 0.8, roughness: rough < 0.3 ? 0.2 : 0.42 });
  }
  if (lum > 0.6 && metal < 0.3 && rough > 0.9) {
    // Back glass: frosted white.
    return new MeshStandardMaterial({ color: 0xf4f3ef, metalness: 0, roughness: 0.5 });
  }
  if (lum > 0.25) return new MeshStandardMaterial({ color: c.clone().lerp(c.clone().setHex(0xf2f1ec), 0.6), metalness: Math.min(metal, 0.4), roughness: Math.max(rough, 0.3) });
  // Glass, lenses, bezels and the screen surrounds stay black.
  return new MeshStandardMaterial({ color: c.clone(), metalness: metal, roughness: rough < 0.9 ? rough : 0.35 });
}

/** Undo the file's compression: plain float positions and normals, baked into model units. */
function bake(mesh: Mesh): BufferGeometry {
  mesh.updateWorldMatrix(true, false);
  const g = mesh.geometry.clone();
  for (const name of ['position', 'normal']) {
    const a = g.getAttribute(name);
    if (!a) continue;
    const out = new Float32Array(a.count * 3);
    for (let i = 0; i < a.count; i++) { out[i * 3] = a.getX(i); out[i * 3 + 1] = a.getY(i); out[i * 3 + 2] = a.getZ(i); }
    g.setAttribute(name, new BufferAttribute(out, 3));
  }
  g.applyMatrix4(mesh.matrixWorld);
  return g;
}

/** Screen UVs, as in the author's viewer, so the shader can sample our pictures. */
function screenUVs(g: BufferGeometry, kind: 'inner' | 'outer') {
  const p = g.getAttribute('position');
  const uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    uv[i * 2] = kind === 'inner' ? (p.getX(i) + 7.89935) / 15.7987 : (-0.23396 - p.getX(i)) / 7.73936;
    uv[i * 2 + 1] = kind === 'inner' ? (p.getY(i) + 5.8974 - 0.34562) / 11.1035 : (p.getY(i) + 5.8974 - 0.27173) / 11.2513;
  }
  g.setAttribute('uv', new BufferAttribute(uv, 2));
}

/** Waits for an idle moment so the setup never blocks scrolling in one long task. */
const idle = () => new Promise<void>((r) => ('requestIdleCallback' in window ? window.requestIdleCallback(() => r(), { timeout: 400 }) : setTimeout(r, 30)));

export type FoldHandle = {
  destroy: () => void;
  screenAspect: number;
  /** For tests: where a part of the device is on screen, in px from the stage's left edge. */
  screenX: (part: 'spine' | 'frontEdge') => number;
  /** For tests: whether the canvas is currently the fixed layer (stage pinned). */
  isCanvasFixed: () => boolean;
  /** For tests: which side of the device faces the viewer. */
  facing: () => 'front' | 'back';
};

export async function initFold(track: HTMLElement): Promise<FoldHandle | null> {
  const stage = track.querySelector<HTMLElement>('[data-fold-stage]');
  const work = document.getElementById('work');
  const { model: modelUrl, cover: coverUrl, inner: innerUrl, innerPoster } = track.dataset;
  if (!stage || !work || !modelUrl) return null;

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
  renderer.toneMappingExposure = 1.1;

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

  // Load the model first; nothing is added to the page until it has arrived.
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  let gltf;
  try {
    gltf = await loader.loadAsync(modelUrl);
  } catch {
    renderer.dispose();
    return null;
  }
  await idle();

  const canvas = renderer.domElement;
  canvas.setAttribute('data-fold-canvas', '');
  canvas.setAttribute('aria-hidden', 'true');
  canvas.className = 'fold__canvas';
  stage.appendChild(canvas);

  const scene = new Scene();
  scene.add(new HemisphereLight(0xffffff, 0xb5baa8, 1.6));
  const key = new DirectionalLight(0xfffcf5, 2.4);
  key.position.set(-15, 25, 30);
  scene.add(key);
  const rim = new DirectionalLight(0xe8edf5, 1.8);
  rim.position.set(15, 5, -15);
  scene.add(rim);
  const camera = new PerspectiveCamera(30, 1, 0.5, 400);

  // Screens: unlit, with the author's projection. Textures stay undecoded and are decoded in the shader.
  const bend = { value: Math.PI };
  const anisotropy = renderer.capabilities.getMaxAnisotropy();
  const screens = {
    inner: { material: new MeshBasicMaterial({ color: 0x000000, toneMapped: false }), frame: { value: INNER_FRAME.clone() }, gradient: { value: new Vector2(0.5, 0) }, pixel: { value: new Vector2(1 / 2288, 1 / 1608) } },
    outer: { material: new MeshBasicMaterial({ color: 0x000000, toneMapped: false }), frame: { value: OUTER_FRAME.clone() }, gradient: { value: new Vector2(0, 1) }, pixel: { value: new Vector2(1 / 1035, 1 / 1500) } },
  };
  const setScreen = (kind: 'inner' | 'outer', t: Texture, w: number, h: number) => {
    t.colorSpace = NoColorSpace;
    t.generateMipmaps = true;
    t.minFilter = LinearMipmapLinearFilter;
    t.magFilter = LinearFilter;
    t.anisotropy = anisotropy;
    const s = screens[kind];
    if (s.material.map !== t) s.material.map?.dispose();
    s.material.map = t;
    s.material.color.set(0xffffff);
    s.material.needsUpdate = true;
    s.pixel.value.set(1 / w, 1 / h);
    dirty = true;
  };

  const phone = new Group();
  const materials: (MeshStandardMaterial | MeshBasicMaterial)[] = [];
  const geos: BufferGeometry[] = [];
  gltf.scene.updateMatrixWorld(true);
  gltf.scene.traverse((o: Object3D) => {
    const src = o as Mesh;
    if (!src.isMesh || HIDDEN.includes(src.name)) return;
    const data = (src.userData ?? {}) as { half?: string; flexible?: boolean };
    const moving = data.half === 'moving';
    const flexible = !!data.flexible;
    const kind = src.name === INNER ? 'inner' : src.name === OUTER ? 'outer' : null;
    const geometry = bake(src);
    if (kind) screenUVs(geometry, kind);
    const material = kind
      ? screens[kind].material
      : BACK_LAYERS.includes(src.name)
        ? new MeshStandardMaterial({ color: 0xf4f3ef, metalness: 0, roughness: 0.5 })
        : UNDER_SCREEN.includes(src.name)
          ? new MeshBasicMaterial({ color: 0x050505 })
          : finish(src.material as MeshStandardMaterial);
    if (moving || flexible) {
      material.onBeforeCompile = (shader) => {
        shader.uniforms.foldAngle = bend;
        if (kind) {
          const s = screens[kind];
          shader.uniforms.uiFrame = s.frame;
          shader.uniforms.uiGradient = s.gradient;
          shader.uniforms.uiReferenceEye = { value: EYE };
          shader.uniforms.uiPixel = s.pixel;
          shader.fragmentShader = shader.fragmentShader
            .replace('#include <map_pars_fragment>', `#include <map_pars_fragment>\n${kind === 'inner' ? '#define INNER_UI' : ''}\n${screenShader}`)
            .replace('#include <map_fragment>', 'diffuseColor.rgb *= screenColor();');
          shader.vertexShader = `varying vec3 vUIPosition;\n${shader.vertexShader}`.replace('#include <project_vertex>', 'vUIPosition = transformed;\n#include <project_vertex>');
        }
        shader.vertexShader = `${flexible ? '#define FLEXIBLE_SCREEN\n' : ''}${foldShader}\n${shader.vertexShader}`
          .replace('#include <begin_vertex>', flexible
            ? 'vec4 folded = bendStrip(position);\nvec3 transformed = vec3(folded.x, position.y, folded.y);'
            : 'vec2 folded = rotateHinge(position.xz);\nvec3 transformed = vec3(folded.x, position.y, folded.y);')
          .replace('#include <beginnormal_vertex>', `vec3 objectNormal = vec3(normal);
            ${flexible ? 'vec4 strip = bendStrip(position); float a = atan(-strip.w, strip.z);' : 'float a = foldAngle;'}
            objectNormal.x = cos(a) * normal.x + sin(a) * normal.z;
            objectNormal.z = -sin(a) * normal.x + cos(a) * normal.z;`);
      };
      material.customProgramCacheKey = () => `fold-${flexible ? 'flexible' : 'cover'}-${kind || 'body'}`;
    }
    if (!kind) materials.push(material);
    geos.push(geometry);
    const mesh = new Mesh(geometry, material);
    mesh.name = src.name;
    mesh.frustumCulled = false;
    phone.add(mesh);
  });

  // A black backing under each half of the inner screen. The screen's bending strip meets the flat
  // screen with hairline gaps that let the page show through as faint lines on high-density screens.
  const backing = (moving: boolean) => {
    const g = new PlaneGeometry(7.95, 11.2);
    g.translate(moving ? -7.95 / 2 : 7.95 / 2, 0.34562 + 11.1035 / 2 - 5.8974, 0.2);
    const m = new MeshBasicMaterial({ color: 0x000000 });
    if (moving) {
      m.onBeforeCompile = (shader) => {
        shader.uniforms.foldAngle = bend;
        shader.vertexShader = `${foldShader}\n${shader.vertexShader}`.replace('#include <begin_vertex>', 'vec2 folded = rotateHinge(position.xz);\nvec3 transformed = vec3(folded.x, position.y, folded.y);');
      };
      m.customProgramCacheKey = () => 'fold-backing';
    }
    materials.push(m);
    geos.push(g);
    const mesh = new Mesh(g, m);
    mesh.frustumCulled = false;
    return mesh;
  };
  phone.add(backing(false), backing(true));

  const device = new Group();
  device.add(phone);
  const root = new Group();
  root.add(device);
  scene.add(root);

  await idle();
  const pmrem = new PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  scene.environment = pmrem.fromScene(room, 0.04, 0.1, 100, { size: 128 }).texture;
  scene.environmentIntensity = 1.3;
  room.dispose();
  await idle();
  try { await renderer.compileAsync(scene, camera); } catch { /* compiles on first render instead */ }

  // Textures: the lock screen and the first dashboard frame now; the video only once it opens.
  const images = new TextureLoader();
  const ready = { cover: false };
  let videoTex: VideoTexture | null = null;
  if (coverUrl) images.load(coverUrl, (t) => { setScreen('outer', t, t.image.width, t.image.height); ready.cover = true; });
  if (innerPoster) images.load(innerPoster, (t) => { if (!videoTex) setScreen('inner', t, t.image.width, t.image.height); });
  const video = document.createElement('video');
  video.muted = true;
  video.loop = true;
  video.playsInline = true;
  video.preload = 'none';
  video.crossOrigin = 'anonymous';
  const startVideo = () => {
    if (!innerUrl || video.src) return;
    video.src = innerUrl;
    video.addEventListener('loadeddata', () => {
      videoTex = new VideoTexture(video);
      videoTex.needsUpdate = true; // upload the current frame now, before playback starts
      setScreen('inner', videoTex, video.videoWidth, video.videoHeight);
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
  // Measured against the stage (100svh), not the window: on iPhone the window height changes as
  // Safari's address bar collapses and expands, which would nudge the angle while it animates.
  const progress = () => {
    const r = track.getBoundingClientRect();
    const sh = stage.offsetHeight || window.innerHeight;
    const run = Math.max(1, track.offsetHeight - sh);
    return clamp(-r.top / run, -1, 1);
  };
  p = progress();

  // Kept warm just outside the screen, but drawn (and the video played) only while visible.
  const onScreen = () => { const r = stage.getBoundingClientRect(); return r.bottom > 0 && r.top < window.innerHeight; };

  let rotY = 0;
  const apply = () => {
    // Pinned, it first shows its back, flips round to the cover screen, then unfolds.
    const unfold = smooth(0.38, 0.88, p);
    const hinge = hingeAngles(unfold);
    bend.value = hinge.pivot;
    const left = Math.min(0, hinge.outerEdgeX(HALF_W));
    device.position.x = -(HALF_W + left) / 2;
    device.position.z = -0.35 * HALF_W * Math.sin(hinge.theta);

    const flip = easeInOut(smooth(0.02, 0.36, p)); // back (π + 0.55) round to a three-quarter front (0.45)
    rotY = lerp(lerp(Math.PI + 0.55, 0.45, flip), 0, smooth(0.36, 0.93, p)) + 0.2 * clamp(-p);
    root.rotation.y = rotY;
    root.rotation.x = lerp(0.18, 0, smooth(0.3, 0.93, p));
    root.rotation.z = Math.sin(flip * Math.PI) * -0.08; // a little roll mid-flip
    root.position.y = -1.2 * clamp(-p);

    // Frame the closed phone by height and the open device by width; portrait screens get closer.
    const portrait = aspect < 1;
    const dClosed = fitDistance((HALF_W + 0.6) / (portrait ? 0.62 : 0.42), HEIGHT / 0.64);
    const dOpen = fitDistance((2 * HALF_W) / (portrait ? 0.94 : 0.86), HEIGHT / 0.8);
    camera.position.set(0, 0, lerp(dClosed, dOpen, unfold));
    camera.lookAt(0, 0, 0);

    const deg = Math.round((hinge.theta * 180) / Math.PI);
    if (deg !== lastAngle) { track.setAttribute('data-fold-angle', String(deg)); lastAngle = deg; }
    // Once it is open, the glass cursor reads "Live demo" over it.
    overDevice = isOverDevice();
    const wantLabel = active && overDevice && unfold > 0.9;
    if (wantLabel !== labelled) {
      labelled = wantLabel;
      const c = cursorFollower();
      if (c) { if (wantLabel) c.setText('Live demo'); else c.removeText(); }
    }
    if (unfold > 0.1) startVideo();
    const wantPlay = unfold > 0.35 && active && onScreen();
    if (wantPlay && video.paused && video.src) video.play().catch(() => {});
    if (!wantPlay && !video.paused) video.pause();
  };

  // While the stage is pinned, the canvas is a fixed layer at the same spot instead of riding the
  // sticky stage: iOS Safari shakes sticky layers whose content repaints every frame (the video).
  let fixed = false;
  const pinCanvas = () => {
    const r = track.getBoundingClientRect();
    const on = r.top <= 0 && r.bottom >= stage.offsetHeight;
    if (on !== fixed) { fixed = on; canvas.classList.toggle('is-fixed', on); }
  };

  let wasOnScreen = false;
  const frame = () => {
    raf = requestAnimationFrame(frame);
    const visibleNow = onScreen();
    if (!visibleNow) {
      if (wasOnScreen) { wasOnScreen = false; if (!video.paused) video.pause(); }
      return;
    }
    if (!wasOnScreen) { wasOnScreen = true; dirty = true; }
    pinCanvas();
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

  // Test hooks: the hinge (model x ≈ -0.3) and the cover half's free edge (model x -8.25, turned).
  const probe = new Vector3();
  const stageX = (x: number, z: number) => {
    scene.updateMatrixWorld();
    probe.set(x, 0, z);
    phone.localToWorld(probe);
    probe.project(camera);
    return (probe.x * 0.5 + 0.5) * stage.clientWidth;
  };
  const handle: FoldHandle = {
    screenAspect: SCREEN_ASPECT,
    isCanvasFixed: () => fixed,
    facing: () => (Math.cos(rotY) >= 0 ? 'front' : 'back'),
    screenX: (part) => {
      if (part === 'spine') return stageX(-0.3, HINGE_Z);
      const c = Math.cos(bend.value), s = Math.sin(bend.value);
      const x = -8.25, z = 0 - HINGE_Z;
      return stageX(c * x + s * z, -s * x + c * z + HINGE_Z);
    },
    destroy: () => {
      io.disconnect();
      ro.disconnect();
      window.removeEventListener('pointermove', onPointer);
      stop();
      video.removeAttribute('src');
      geos.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
      for (const s of Object.values(screens)) { s.material.map?.dispose(); s.material.dispose(); }
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
