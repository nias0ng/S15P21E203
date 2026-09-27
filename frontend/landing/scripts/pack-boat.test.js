// ───────── 배 GLB 검사 — 커밋된 압축본이 지금의 원본 · 차폐 · three 해독기와 맞는가 (2026-09-27, S15P21E203-435) ─────────
//   `public/landing/boat_v2.meshopt.glb` 는 pack-boat.mjs 로 **손으로** 만드는 생성 파일이다 — 도구가 프로젝트 의존성에 없어
//   CI 가 다시 만들지 못한다. 그래서 만들어 둔 결과가 지금 저장소의 원본과 짝이 맞는지를 `npm run verify` 에서 본다 (MR !306 리뷰).
//   ⚠ 도구 없이 돈다 — GLB 는 JSON 조각만 읽고, 압축은 앱이 실제로 쓰는 three 의 해독기(boat.js 와 같은 모듈)로 푼다.
//
// 잡는 것 :
//   · 원본(data/boat_v2.glb)을 갈고 압축본을 다시 안 만들었다 — 프리미티브 순서 · 이름 · 삼각형 수 · 속성 · 재질이 어긋난다
//   · 차폐가 원본과 짝이 안 맞거나 압축본에서 빠졌다 — ao.json 의 이름 · 정점 수 · 재질, 프리미티브마다 `_AOFB`
//   · three 0.160 이 못 읽는 압축 형식 — meshoptimizer 를 올려 새 형식(v1)으로 쓰면 배가 안 뜬다 (pack-boat.mjs 머리말)
//   · glTF-Transform 기본값 사고 — dedup 이 재질 23개를 하나로 합치고 prune 이 UV 를 지운다 (2026-09-27 두 번 겪었다)

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { describe, expect, it } from 'vitest';

const here = (p) => fileURLToPath(new URL(p, import.meta.url));
const SRC = here('../data/boat_v2.glb');
const AO_BIN = here('../data/boat_v2.ao.bin');
const AO_JSON = here('../data/boat_v2.ao.json');
const OUT = here('../../public/landing/boat_v2.meshopt.glb');

// GLB → { json, bin }. 머리 12바이트(glTF · 판 2 · 길이) 뒤로 [길이 · 종류 · 몸] 조각이 잇는다
function readGlb(path) {
  const b = readFileSync(path);
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  if (dv.getUint32(0, true) !== 0x46546c67 || dv.getUint32(4, true) !== 2) throw new Error(`${path} 는 glTF 2.0 GLB 가 아니다`);
  let off = 12, json = null, bin = null;
  while (off < b.byteLength) {
    const len = dv.getUint32(off, true), type = dv.getUint32(off + 4, true);
    const body = b.subarray(off + 8, off + 8 + len);
    if (type === 0x4e4f534a) json = JSON.parse(body.toString('utf8'));   // 'JSON'
    else if (type === 0x004e4942) bin = body;                           // 'BIN\0'
    off += 8 + len;
  }
  return { json, bin };
}

// 장면 노드를 깊이 우선으로 — pack-boat.mjs 와 three 가 걷는 순서다 (차폐는 이 순서로 짝을 짓는다)
//   ⚠ 압축본에서는 양자화가 몇 메시(Handle · Wheel n°1 · Security)를 **이름 없는 자식 노드**로 옮겨 되양자화 변환을 거기 단다.
//     그래서 이름은 가장 가까운 이름 있는 조상에서 읽는다. three 쪽 이름도 그만큼 바뀌지만 boat.js 는 부품을 재질 이름으로 가른다
function primitives(g) {
  const out = [];
  const walk = (i, name) => {
    const n = g.nodes[i], own = n.name !== undefined ? n.name : name;
    if (n.mesh !== undefined) g.meshes[n.mesh].primitives.forEach((p) => out.push({ name: own, mesh: g.meshes[n.mesh].name, p }));
    (n.children || []).forEach((c) => walk(c, own));
  };
  g.scenes[g.scene || 0].nodes.forEach((i) => walk(i, undefined));
  return out;
}

// three 가 다듬은 이름 (PropertyBinding.sanitizeNodeName) — ao.json 은 three 에서 내보낸 이름이다 (pack-boat.mjs 와 같은 식)
const sanitize = (s) => String(s || '').replace(/\s/g, '_').replace(/[[\].:/]/g, '');
const tris = (g, p) => g.accessors[p.indices !== undefined ? p.indices : p.attributes.POSITION].count;
const verts = (g, p) => g.accessors[p.attributes.POSITION].count;
const attrs = (p) => Object.keys(p.attributes).filter((k) => k !== '_AOFB').sort();
const matName = (g, p) => (p.material !== undefined ? g.materials[p.material].name : null);

const src = readGlb(SRC);
const out = readGlb(OUT);
const man = JSON.parse(readFileSync(AO_JSON, 'utf8')).meshes;
const S = primitives(src.json);
const O = primitives(out.json);

describe('배 압축 GLB (public/landing/boat_v2.meshopt.glb)', () => {
  it('지금의 원본에서 만든 것이다 — 프리미티브 순서 · 이름 · 삼각형 수 · 속성 · 재질이 같다', () => {
    expect(O.length).toBe(S.length);
    O.forEach((o, i) => {
      const s = S[i];
      expect({ i, name: o.name, mesh: o.mesh, tris: tris(out.json, o.p), attrs: attrs(o.p), mat: matName(out.json, o.p) })
        .toEqual({ i, name: s.name, mesh: s.mesh, tris: tris(src.json, s.p), attrs: attrs(s.p), mat: matName(src.json, s.p) });
    });
  });

  it('재질 이름이 합쳐지지 않았다 — boat.js 가 부품을 재질 이름으로 가른다', () => {
    const names = (g) => [...new Set(g.materials.map((m) => m.name))].sort();
    expect(names(out.json)).toEqual(names(src.json));
    expect(names(out.json).length).toBeGreaterThan(1);
  });

  it('차폐(ao.json · ao.bin)는 지금의 원본에서 구운 것이다 — 이름 · 정점 수 · 재질이 같다', () => {
    expect(man.length).toBe(S.length);
    S.forEach((s, i) => {
      expect({ i, name: sanitize(s.name), count: verts(src.json, s.p), mat: matName(src.json, s.p) })
        .toEqual({ i, name: man[i].name, count: man[i].count, mat: man[i].mat });
    });
    // 정점마다 앞 · 뒷면 두 바이트
    expect(readFileSync(AO_BIN).length).toBe(man.reduce((t, m) => t + m.count * 2, 0));
  });

  it('모든 프리미티브가 차폐(_AOFB · VEC2 · 8비트 정규화)를 정점마다 싣는다 — 하나라도 없으면 boat.js 가 불러올 때 다시 굽는다', () => {
    O.forEach((o, i) => {
      const id = o.p.attributes._AOFB;
      expect(id, `#${i} ${o.name} 에 _AOFB 가 없다`).toBeDefined();
      const a = out.json.accessors[id];
      expect({ i, type: a.type, componentType: a.componentType, normalized: a.normalized, count: a.count })
        .toEqual({ i, type: 'VEC2', componentType: 5121, normalized: true, count: verts(out.json, o.p) });
    });
  });

  it('three 가 받는 확장만 필수로 건다', () => {
    expect([...out.json.extensionsRequired].sort()).toEqual(['EXT_meshopt_compression', 'KHR_mesh_quantization']);
  });

  it('three 0.160 의 해독기로 모든 압축 조각이 풀린다', async () => {
    await MeshoptDecoder.ready;
    const views = out.json.bufferViews.map((v) => v.extensions && v.extensions.EXT_meshopt_compression).filter(Boolean);
    expect(views.length).toBeGreaterThan(0);
    for (const e of views) {
      expect(out.json.buffers[e.buffer].uri).toBeUndefined();   // GLB 안의 BIN 조각
      const from = e.byteOffset || 0;
      const data = out.bin.subarray(from, from + e.byteLength);
      const target = new Uint8Array(e.count * e.byteStride);
      expect(() => MeshoptDecoder.decodeGltfBuffer(target, e.count, e.byteStride, data, e.mode, e.filter || 'NONE')).not.toThrow();
    }
  });
});
