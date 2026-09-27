// ───────── 배 GLB 줄이기 + 정점 차폐(AO) 싣기 (2026-09-27, S15P21E203-435 · 최적화 2) ─────────
//   GLTF_TOOLS=<도구 폴더> node scripts/pack-boat.mjs            (landing 폴더에서)
//
// 원본 : data/boat_v2.glb (8.30MB · 텍스처 0장 — 전부 정점) + data/boat_v2.ao.bin · .ao.json (정점 차폐)
//   →  생성 : ../public/landing/boat_v2.meshopt.glb (2.04MB · gzip 1.14MB) — boat.js 의 GLB_URL 이 받는다
//
// 하는 일 : ① 차폐를 `_AOFB`(VEC2 · 8비트 정규화)로 프리미티브마다 싣는다 ② 같은 정점 합치기(weld) ③ meshopt —
//   캐시 순서(reorder) · 양자화(위치 14비트 · 법선 8비트 팔면체 필터 · [0,1] 안의 UV 12비트) · EXT_meshopt_compression
//   ⚠ 생성 파일은 손으로 고치지 않는다. 모델을 갈면 원본을 data/ 에 넣고 아래 순서로 다시 만든다.
//   ⚠ 만든 결과는 `npm run verify` 가 검사한다 (pack-boat.test.js — 도구 없이 돈다) : 지금의 원본 · 차폐와 짝이 맞는지 · three 해독기로 풀리는지.
//     원본만 갈고 이 스크립트를 안 돌리면 거기서 멈춘다.
//
// ⚠ 도구(glTF-Transform · meshoptimizer)는 **프로젝트 의존성에 없다** — 가끔 도는 일이라 저장소 밖 임시 폴더에 설치해 쓴다 :
//     mkdir <도구 폴더> && cd <도구 폴더> && npm init -y && npm i @gltf-transform/core@4 @gltf-transform/extensions@4 @gltf-transform/functions@4 meshoptimizer@1
//   (2026-09-27 : core · extensions · functions 4.5.0 · meshoptimizer 1.3.0 으로 만들었다)
// ⚠ 인코더는 glTF 버퍼를 **옛 형식(v0)** 으로 쓴다 (encodeGltfBuffer 의 기본) — three 0.160 의 MeshoptDecoder 가 읽는 형식이다.
//   meshoptimizer 를 올려 v1 을 쓰게 되면 배가 안 뜬다 — 받는 쪽(three)을 먼저 본다.
//
// 차폐(.ao.bin · .ao.json) 다시 굽기 — 모델을 갈았을 때만 :
//   ① 개발 서버에서 `landing/index.html?boat=src` 를 연다 — 원본 GLB 를 받고, 파일에 차폐가 없으니 불러온 자리에서 굽는다 (vertexao.js · 커튼 뒤 한 번)
//   ② 배가 뜬 뒤 콘솔에서 아래를 돌리면 두 파일이 내려받아진다 → data/ 에 넣는다
//        (() => { const g = PB.boat.pivot.children.find(c => c.type === 'Group' && c !== PB.boat.mesh && c.children.length && !c.children[0].isMesh).children[0];
//          const man = [], parts = []; g.traverse(o => { if (!o.isMesh) return; man.push({ name: o.name, count: o.geometry.attributes.position.count }); parts.push(new Uint8Array(o.geometry.getAttribute('aoFB').array)); });
//          const bin = new Uint8Array(parts.reduce((s, p) => s + p.length, 0)); let off = 0; parts.forEach(p => { bin.set(p, off); off += p.length; });
//          const save = (blob, name) => { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click(); };
//          save(new Blob([bin]), 'boat_v2.ao.bin'); save(new Blob([JSON.stringify({ meshes: man })]), 'boat_v2.ao.json'); })();
//   ⚠ 순서가 곧 짝이다 — three 의 순회 순서(= 파일의 장면 노드 순서)로 내보내고 여기서 같은 순서로 걷는다. 정점 수 · 이름이 하나라도 다르면 멈춘다.
//   ⚠ 합치기 · 캐시 순서보다 **먼저** 싣는다 — 그래야 정점 순서가 바뀔 때 차폐도 같이 따라간다.

import { readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(root, 'data', 'boat_v2.glb');
const AO_BIN = join(root, 'data', 'boat_v2.ao.bin');
const AO_JSON = join(root, 'data', 'boat_v2.ao.json');
const OUT = join(root, '..', 'public', 'landing', 'boat_v2.meshopt.glb');

const TOOLS = process.env.GLTF_TOOLS;
if (!TOOLS) {
  console.error('GLTF_TOOLS 에 도구 폴더(glTF-Transform · meshoptimizer 를 설치한 곳)를 준다 — 이 파일 머리말 참고');
  process.exit(1);
}
const req = createRequire(join(resolve(TOOLS), 'package.json'));
const load = (id) => import(pathToFileURL(req.resolve(id)).href);
const { NodeIO } = await load('@gltf-transform/core');
const { ALL_EXTENSIONS } = await load('@gltf-transform/extensions');
const { dedup, weld, prune, meshopt, getSceneVertexCount, VertexCountMethod } = await load('@gltf-transform/functions');
const { MeshoptEncoder, MeshoptDecoder } = await load('meshoptimizer');

await MeshoptEncoder.ready;
await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });
const doc = await io.read(SRC);
const docRoot = doc.getRoot();

// ── ① 차폐를 싣는다
//   ⚠ 이름은 three 가 다듬은 것이다 (공백 → _ · PropertyBinding.sanitizeNodeName) — 같은 식으로 다듬어 견준다
const man = JSON.parse(readFileSync(AO_JSON, 'utf8')).meshes;
const ao = new Uint8Array(readFileSync(AO_BIN));
const sanitize = (s) => String(s || '').replace(/\s/g, '_').replace(/[\[\]\.:\/]/g, '');
const buffer = docRoot.listBuffers()[0];
const prims = [];
const walk = (n) => { const m = n.getMesh(); if (m) m.listPrimitives().forEach(p => prims.push([n, p])); n.listChildren().forEach(walk); };
docRoot.listScenes()[0].listChildren().forEach(walk);
if (prims.length !== man.length) throw new Error(`프리미티브 수가 다르다 : 파일 ${prims.length} · 차폐 ${man.length}`);
let off = 0;
prims.forEach(([n, p], i) => {
  const cnt = p.getAttribute('POSITION').getCount(), m = man[i];
  if (cnt !== m.count || sanitize(n.getName()) !== m.name) throw new Error(`#${i} 짝이 안 맞는다 : 파일 ${n.getName()}/${cnt} · 차폐 ${m.name}/${m.count}`);
  p.setAttribute('_AOFB', doc.createAccessor('AOFB_' + i).setType('VEC2').setArray(ao.slice(off, off + cnt * 2)).setNormalized(true).setBuffer(buffer));
  off += cnt * 2;
});
if (off !== ao.length) throw new Error(`차폐 바이트가 남는다 : ${ao.length - off}`);

// ── ② ③ 줄인다
//   ⚠ UV 는 [0,1] 밖(−0.028)이 있는 메시에서 glTF-Transform 이 양자화하지 않는다 (float 그대로 · 압축만) — 종이 결(paper.js)이 쓰는 좌표다
//   ⚠⚠ prune 은 기본이 '재질이 안 쓰는 정점 속성을 지운다'(keepAttributes false) — 이 GLB 는 텍스처가 0장이라 **UV 가 통째로 지워졌다** (2026-09-27 한 번 겪었다).
//     종이 결은 불러온 뒤 붙이는 텍스처라 UV 가 있어야 한다. _AOFB 도 같은 처지다 — 속성은 전부 남긴다
//   ⚠⚠ dedup 도 기본이 '값이 같으면 이름이 달라도 합친다'(keepUniqueNames false) — 이 GLB 의 재질 23개는 **값이 전부 같고 이름만 다르다**.
//     그대로 두면 한 재질(Veil)로 합쳐져 이름으로 가르는 모든 것(돛 · 선체 니스 · 금속 · 선실 종이색 · 번짐 가림)이 깨진다 (2026-09-27 한 번 겪었다 · boat.js)
const before = getSceneVertexCount(docRoot.listScenes()[0], VertexCountMethod.UPLOAD);
await doc.transform(dedup({ keepUniqueNames: true }), weld(), meshopt({ encoder: MeshoptEncoder, level: 'high' }), prune({ keepAttributes: true }));
const after = getSceneVertexCount(docRoot.listScenes()[0], VertexCountMethod.UPLOAD);
await io.write(OUT, doc);
console.log(`정점 ${before} → ${after} · 파일 ${statSync(SRC).size} → ${statSync(OUT).size} 바이트 (${(100 * statSync(OUT).size / statSync(SRC).size).toFixed(1)}%)`);
console.log('확장 :', docRoot.listExtensionsUsed().map(e => e.extensionName).join(', '));
