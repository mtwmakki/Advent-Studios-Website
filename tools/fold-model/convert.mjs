// Converts the iPhone Duo model (by jadon7, github.com/jadon7/iphone-duo, used with the author's
// permission) into a compact GLB for the Work section: geometry only (materials are set in code),
// baked to the viewer's units, the Apple logo removed, welded, simplified and meshopt-compressed.
// Each mesh keeps its name and records which half it belongs to in extras.
// Usage: node tools/fold-model/convert.mjs <iPhone_Duo_Render.usdc> public/fold/duo.glb
import { readFileSync } from 'node:fs';
import { USDLoader } from 'three/examples/jsm/loaders/USDLoader.js';
import { Document, NodeIO } from '@gltf-transform/core';
import { EXTMeshoptCompression, ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { weld, simplifyPrimitive, quantize, reorder, meshopt, dedup, prune } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer';

const [src, out] = process.argv.slice(2);
const MOVING = 'upTUAKvMVkPOMKq', FIXED = 'SiftyleUEEZwLhF';
const FLEXIBLE = ['JnJdTkxbQgUtLwU', 'xdyyaajWsatVNxN', 'UXtsBZYlaUvHoEh', 'MvKPXGSdYDVvSpk'];
const DROP = ['tYVfzVmYBKhfUhm', 'tnxsltexVWtEjsz']; // the Apple logo on the back

const origWarn = console.warn; console.warn = () => {};
const buf = readFileSync(src);
const model = new USDLoader().parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
console.warn = origWarn;
model.scale.multiplyScalar(100);
model.updateMatrixWorld(true);

const doc = new Document();
const buffer = doc.createBuffer();
const scene = doc.createScene();
let kept = 0, dropped = [];
model.traverse((o) => {
  if (!o.isMesh) return;
  if (DROP.includes(o.name)) { dropped.push(o.name); return; }
  const g = o.geometry.clone().applyMatrix4(o.matrixWorld);
  g.translate(0, -5.8974, 0);
  let a = o; while (a && ![MOVING, FIXED].includes(a.name)) a = a.parent;
  const m = Array.isArray(o.material) ? o.material[0] : o.material;
  const pos = g.attributes.position, nor = g.attributes.normal;
  const prim = doc.createPrimitive()
    .setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(new Float32Array(pos.array)).setBuffer(buffer))
    .setAttribute('NORMAL', doc.createAccessor().setType('VEC3').setArray(new Float32Array(nor.array)).setBuffer(buffer));
  if (g.index) prim.setIndices(doc.createAccessor().setType('SCALAR').setArray(new Uint32Array(g.index.array)).setBuffer(buffer));
  const mat = doc.createMaterial(m.name || o.name)
    .setBaseColorFactor([m.color.r, m.color.g, m.color.b, m.opacity ?? 1])
    .setMetallicFactor(m.metalness ?? 0).setRoughnessFactor(m.roughness ?? 1);
  if (m.transparent || (m.opacity ?? 1) < 1) mat.setAlphaMode('BLEND');
  prim.setMaterial(mat);
  const mesh = doc.createMesh(o.name).addPrimitive(prim);
  const node = doc.createNode(o.name).setMesh(mesh).setExtras({ half: a?.name === MOVING ? 'moving' : 'fixed', flexible: FLEXIBLE.includes(o.name), opacity: m.opacity ?? 1, transparent: !!m.transparent });
  scene.addChild(node);
  kept++;
});

await MeshoptEncoder.ready;
await MeshoptSimplifier.ready;
doc.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.QUANTIZE });
// Simplify only the body: the screens and the bending hinge strip keep every vertex, or hairline
// gaps open along the fold and the hinge metal shows through the open screen.
const KEEP = new Set([...FLEXIBLE, 'hhgAIoCGsHXeDPY']);
await doc.transform(dedup(), weld());
for (const node of doc.getRoot().listNodes()) {
  const mesh = node.getMesh();
  if (!mesh || KEEP.has(node.getName())) continue;
  for (const prim of mesh.listPrimitives()) simplifyPrimitive(prim, { simplifier: MeshoptSimplifier, ratio: 0.5, error: 0.0004 });
}
await doc.transform(
  reorder({ encoder: MeshoptEncoder }),
  quantize({ quantizePosition: 16, quantizeNormal: 10 }),
  meshopt({ encoder: MeshoptEncoder, level: 'medium' }),
  prune({ keepExtras: true }),
);
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder });
await io.write(out, doc);
console.log(`kept ${kept} meshes, dropped ${dropped.join(', ')}`);
