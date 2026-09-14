// ───────── 향 영역 지형 생성기 (2026-09-12 저녁, v0.49.0) ─────────
// `data/scent_map_terrain.json` + `data/scent_map.json` → `src/terrain-data.js`
//
// 실행 : node scripts/terrain-from-json.mjs
//
// ⚠⚠ `src/terrain-data.js` 는 **생성물이다 — 손으로 고치지 않는다** (perfumes-data.js 와 같은 규율, 불변식 21).
//   원본 JSON 을 새로 받으면 이걸 다시 돌리고 **경고부터** 본다.
//
// ⭐ 왜 생성기인가 : 원본의 향조 폴리곤은 **격자 계단**이다 (마칭 스퀘어가 칸 중점을 지나므로 0.0043
//   단위로 꺾인다). 그대로 그리면 해도를 확대했을 때 톱니가 보인다 — 사용자 : *"지도 전체 맵도 픽셀이
//   깨진것처럼 나오는데 좀 자세하게 디테일하게 SVG 로"*. 그래서 **구울 때 다듬는다** :
//     ① Douglas–Peucker (eps ≈ 칸 1/3) — **계단을 먼저 편다.** 마칭 스퀘어의 지그재그만 걷힌다
//     ② Chaikin 두 번 — 남은 꼭짓점을 둥글려 해안선으로 만든다
//     ③ Douglas–Peucker (아주 작게) — 둥글린 뒤 남는 점을 덜어낸다
//   ⚠ 순서를 뒤집으면 Chaikin 이 계단의 꼭짓점을 전부 깎아 점만 4배가 되고 모양은 그대로다.
//   런타임(chart.js)은 받은 점을 잇기만 한다. 확대해도 벡터라 또렷하다.
//
// ⚠ 좌표는 **정규화 공간 그대로** 내보낸다 (CSV 의 map_x·map_y 와 같은 공간, 여백 때문에 음수가 나온다).
//   월드로 옮기는 식은 `scentmap.js` 한 곳이다 (불변식 21) — 여기서 월드로 구워 넣으면 `mapSize` 를
//   바꾸는 순간 지형만 옛 축척에 남는다.

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const R = (p) => JSON.parse(readFileSync(join(root, p), 'utf8'));

const terrain = R('data/scent_map_terrain.json');
const smap = R('data/scent_map.json');

const warn = [];
if (terrain.schema_version !== 3 || smap.schema_version !== 3) {
  warn.push(`schema_version 이 3 이 아니다 (terrain ${terrain.schema_version} · map ${smap.schema_version}) — 구조가 바뀌었는지 본다`);
}
if (terrain.generated_at !== smap.generated_at) {
  warn.push(`두 파일의 generated_at 이 다르다 (${terrain.generated_at} vs ${smap.generated_at}) — 같은 판이 아닐 수 있다`);
}

const B = terrain.bounds;
const EPS = 1e-9;
const same = (a, b) => Math.abs(a - b) < EPS;
const closed = (r) => same(r[0][0], r[r.length - 1][0]) && same(r[0][1], r[r.length - 1][1]);
// 경계에 닿았는가 — 열린 고리를 곧게 닫아도 되는지 판정한다
const onEdge = (p) => (same(p[0], B.x_min) ? 'xL' : same(p[0], B.x_max) ? 'xR' : same(p[1], B.y_min) ? 'yB' : same(p[1], B.y_max) ? 'yT' : '');

// ── Chaikin : 각 변에서 1/4 · 3/4 점을 뽑아 계단을 깎는다. 닫힌 고리는 순환으로, 열린 고리는 양 끝을 남긴다
function chaikin(pts, loop) {
  const n = pts.length;
  if (n < 3) return pts;
  const out = [];
  if (!loop) out.push(pts[0]);
  const last = loop ? n : n - 1;
  for (let i = 0; i < last; i++) {
    const a = pts[i], b = pts[(i + 1) % n];
    out.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25]);
    out.push([a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]);
  }
  if (!loop) out.push(pts[n - 1]);
  return out;
}

// ── Douglas–Peucker : 선에서 벗어난 정도가 eps 아래인 점을 뺀다 (곡률은 남는다)
function rdp(pts, eps) {
  if (pts.length < 3) return pts;
  const keep = new Uint8Array(pts.length);
  keep[0] = keep[pts.length - 1] = 1;
  const stack = [[0, pts.length - 1]];
  while (stack.length) {
    const [i0, i1] = stack.pop();
    const [x0, y0] = pts[i0], [x1, y1] = pts[i1];
    const dx = x1 - x0, dy = y1 - y0;
    const len = Math.hypot(dx, dy) || 1e-12;
    let far = -1, fd = eps;
    for (let i = i0 + 1; i < i1; i++) {
      const d = Math.abs((pts[i][0] - x0) * dy - (pts[i][1] - y0) * dx) / len;
      if (d > fd) { fd = d; far = i; }
    }
    if (far > 0) { keep[far] = 1; stack.push([i0, far], [far, i1]); }
  }
  return pts.filter((_, i) => keep[i]);
}

// ⚠⚠⚠ **닫힌 고리에 RDP 를 그냥 걸면 고리가 점 둘로 붕괴한다.** 기준선이 첫 점 → 마지막 점인데
//   닫힌 고리에서는 그 둘이 같은 점이라 길이가 0 이고, 모든 점의 거리가 0 으로 나와 전부 버려진다.
//   실측 2026-09-12 : 면적비 **0.342** · 향수가 자기 영역 안에 드는 비율 76.5% → **32.0%**.
//   그래서 첫 점에서 **가장 먼 점**을 찾아 고리를 둘로 쪼갠 뒤 각각에 건다.
function rdpRing(p, eps) {
  if (p.length < 4 || eps <= 0) return p;
  let far = 0, fd = -1;
  for (let i = 1; i < p.length; i++) {
    const d = (p[i][0] - p[0][0]) ** 2 + (p[i][1] - p[0][1]) ** 2;
    if (d > fd) { fd = d; far = i; }
  }
  const a = rdp(p.slice(0, far + 1), eps);
  const b = rdp(p.slice(far).concat([p[0]]), eps);
  return a.concat(b.slice(1, -1));
}

// ── 다듬기 한 벌. ⚠⚠ **순서가 중요하다 : 계단을 먼저 펴고(RDP) 그 다음에 둥글린다(Chaikin).**
//   거꾸로 하면 Chaikin 이 계단의 모든 꼭짓점을 깎아 점이 4배가 되고도 모양은 그대로다.
//   앞 RDP 의 eps 는 **칸 절반**(0.0043의 0.7)이라 마칭 스퀘어의 지그재그만 걷어내고 진짜 경계는 남는다.
const EPS_PRE = 0.003;     // 계단 펴기 (정규화 단위 · 칸 0.0086 의 0.35배)
const EPS_POST = 0.0002;   // 둥글린 뒤 남는 점 덜어내기. 해도 1022px 에서 ≈ 0.19px (6배 확대 1.1px)
function smooth(ring) {
  const loop = closed(ring);
  let p = loop ? ring.slice(0, -1) : ring.slice();
  p = loop ? rdpRing(p, EPS_PRE) : rdp(p, EPS_PRE);
  p = chaikin(p, loop);
  p = chaikin(p, loop);
  p = loop ? rdpRing(p, EPS_POST) : rdp(p, EPS_POST);
  return loop ? p.concat([p[0]]) : p;
}

// 고리의 면적 (부호 없음) — 다듬기가 모양을 먹었는지 재는 자다
const areaOf = (ring) => {
  let a = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) a += ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1];
  return Math.abs(a / 2);
};

const r4 = (v) => Math.round(v * 1e4) / 1e4;
const flat = (ring) => { const a = []; for (const p of ring) { a.push(r4(p[0]), r4(p[1])); } return a; };

// ── 향조 아홉. ⚠ 색·한글 이름은 **여기서 내보내지 않는다** — 색은 `CONFIG.families`,
//   존 이름·번호는 `areas.js` 가 단일 출처다 (불변식 2 · 21). 키만 넘기고 런타임이 붙인다.
let ptsIn = 0, ptsOut = 0, ringsN = 0, tiny = 0, areaIn = 0, areaOut = 0;
const families = smap.families.items.map((f) => {
  const rings = [];
  for (const ring of f.polygon) {
    ringsN++;
    ptsIn += ring.length;
    if (ring.length < 4) { tiny++; continue; }   // 점 셋 이하는 면이 아니다
    if (!closed(ring)) {
      const a = onEdge(ring[0]), b = onEdge(ring[ring.length - 1]);
      // 같은 경계에서 열렸으면 곧게 닫는 것이 곧 그 경계선이다. 다른 경계면 모서리를 잘라 먹는다
      if (!a || !b) warn.push(`${f.key} 의 고리가 경계가 아닌 곳에서 열려 있다 (${a || '내부'} → ${b || '내부'}) — 곧게 닫으면 모양이 틀어진다`);
      else if (a !== b) warn.push(`${f.key} 의 고리가 서로 다른 경계에서 열려 있다 (${a} → ${b}) — 모서리를 따라 닫아야 한다`);
    }
    const s = smooth(ring);
    areaIn += areaOf(ring); areaOut += areaOf(s);
    ptsOut += s.length;
    rings.push(flat(s));
  }
  if (!rings.length) warn.push(`${f.key} 에 그릴 고리가 없다`);
  return {
    key: f.key, id: f.id,
    anchor: [r4(f.label_anchor.x), r4(f.label_anchor.y)],
    area: Math.round(f.area_share * 1e4) / 1e4,
    rings
  };
});

// ── 해안선. ⚠ **선으로만** 쓴다 — 넷 중 셋이 경계에서 열려 있어 면으로 닫으면 지도 밖까지 칠한다
const coast = terrain.contours[0].polygons
  .filter((r) => r.length >= 4)
  .map((r) => flat(smooth(r)));

// ── 검사 ① 향수가 자기 향조의 영역 안에 있는가 (evenodd)
const inRings = (rings, x, y) => {
  let inside = false;
  for (const a of rings) {
    for (let i = 0, j = a.length - 2; i < a.length; j = i, i += 2) {
      const xi = a[i], yi = a[i + 1], xj = a[j], yj = a[j + 1];
      if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
    }
  }
  return inside;
};
const byKey = Object.fromEntries(families.map((f) => [f.key, f]));
let hit = 0, miss = 0;
const missBy = {};
for (const p of smap.points) {
  const key = (p.families && p.families[0] && p.families[0].key) || null;
  const fam = key && byKey[key];
  if (!fam) continue;
  if (inRings(fam.rings, p.x, p.y)) hit++;
  else { miss++; missBy[key] = (missBy[key] || 0) + 1; }
}

// ── 검사 ② 점의 좌표 공간. points 는 [0,1] 이고 폴리곤은 terrain bounds 다 (원본 notes)
const xs = smap.points.map((p) => p.x), ys = smap.points.map((p) => p.y);
const pb = { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
if (pb.x0 < B.x_min || pb.x1 > B.x_max || pb.y0 < B.y_min || pb.y1 > B.y_max) {
  warn.push('향수 좌표가 지형 bounds 를 벗어난다 — 두 파일의 좌표 공간이 어긋났다');
}

// ── 검사 ③ CSV 와 같은 지도인가 (향수 좌표가 일치해야 부표와 영역이 같은 자리다)
const csv = readFileSync(join(root, 'data/perfume_map_points.csv'), 'utf8').split(/\r?\n/).slice(1).filter(Boolean);
const csvXY = new Map();
for (const line of csv) {
  // ⚠ 이름에 쉼표가 들어 있다 ("Thank U, Next") — 앞 열과 뒤 열을 따로 센다
  const head = line.split(',');
  const id = head[0];
  const tail = line.split(',').slice(-5);
  csvXY.set(id, [Number(tail[0]), Number(tail[1])]);
}
let drift = 0, driftMax = 0;
for (const p of smap.points) {
  const c = csvXY.get(String(p.fragrantica_id));
  if (!c) { drift++; continue; }
  const d = Math.max(Math.abs(c[0] - p.x), Math.abs(c[1] - p.y));
  if (d > 1e-4) { drift++; driftMax = Math.max(driftMax, d); }
}
if (drift) warn.push(`CSV 와 좌표가 다른 향수 ${drift}개 (최대 ${driftMax.toFixed(5)}) — 부표와 향 영역이 다른 지도가 된다`);

if (areaOut / areaIn < 0.97 || areaOut / areaIn > 1.03) warn.push(`다듬기가 면적을 ${(100 * (1 - areaOut / areaIn)).toFixed(1)}% 바꿨다 — 닫힌 고리 RDP 가 무너진 것을 먼저 의심한다`);
if (hit / (hit + miss) < 0.7) warn.push(`향수가 자기 향조 영역 안에 드는 비율이 ${(100 * hit / (hit + miss)).toFixed(1)}% 다 — 원본은 76.5% 였다`);

const out = `// ⚠⚠ **생성물이다 — 손으로 고치지 않는다.** \`node scripts/terrain-from-json.mjs\` 가 만든다.
//   원본 : data/scent_map_terrain.json · data/scent_map.json (schema 3, ${terrain.generated_at})
//
// 향 영역 아홉의 **벡터 경계**와 해안선이다. 원본은 격자 계단(0.0043 단위)이라 그대로 그리면
// 확대했을 때 톱니가 보인다 — 생성기가 Chaikin 두 번 + Douglas–Peucker 로 다듬었다
// (점 ${ptsIn} → ${ptsOut} · 면적비 ${(areaOut / areaIn).toFixed(4)}).
//
// ⚠ 좌표는 **정규화 공간**이다 (CSV 의 map_x·map_y 와 같은 공간 · 여백 때문에 음수가 있다).
//   월드로 옮기는 것은 \`scentmap.js\` 의 \`toWorld()\` 하나다 (불변식 21).
// ⚠ 고리는 \`[x, y, x, y, …]\` 평평한 배열이다 (짝으로 두면 파일이 두 배가 된다).
// ⚠ 색·한글 이름·번호는 여기 없다 — 색은 \`CONFIG.families\`, 이름·순서는 \`areas.js\` 다 (불변식 2).
// ⚠ 해안선은 **선으로만** 쓴다 (넷 중 셋이 지도 경계에서 열려 있다).

export const TERRAIN = {
  schema: ${terrain.schema_version},
  generatedAt: '${terrain.generated_at}',
  bounds: { x0: ${B.x_min}, x1: ${B.x_max}, y0: ${B.y_min}, y1: ${B.y_max} },
  seaLevel: ${terrain.density.sea_level},
  landShare: ${terrain.density.land_area_share},
  families: [
${families.map((f) => `    { key: '${f.key}', id: ${f.id}, anchor: [${f.anchor}], area: ${f.area}, rings: [
${f.rings.map((r) => `      [${r.join(',')}]`).join(',\n')}
    ] }`).join(',\n')}
  ],
  coast: [
${coast.map((r) => `    [${r.join(',')}]`).join(',\n')}
  ]
};
`;

writeFileSync(join(root, 'src/terrain-data.js'), out, 'utf8');

console.log('── 향 영역 지형 생성 ──');
console.log(`격자 ${terrain.grid_width}×${terrain.grid_height} · 해수면 ${terrain.density.sea_level} · 육지 ${(terrain.density.land_area_share * 100).toFixed(1)}%`);
console.log(`향조 ${families.length} · 고리 ${ringsN} (점 셋 이하로 버린 것 ${tiny}) · 해안선 고리 ${coast.length}`);
console.log(`점 ${ptsIn} → ${ptsOut} (RDP ${EPS_PRE} → Chaikin ×2 → RDP ${EPS_POST}) · 면적비 ${(areaOut / areaIn).toFixed(4)}`);
console.log(`향수가 자기 향조 영역 안 : ${hit}/${hit + miss} (${(100 * hit / (hit + miss)).toFixed(1)}%)`);
if (miss) console.log('  밖에 있는 것 :', Object.entries(missBy).map(([k, v]) => `${k} ${v}`).join(' · '));
const bytes = Buffer.byteLength(out, 'utf8');
console.log(`src/terrain-data.js ${(bytes / 1024).toFixed(1)}KB`);
if (warn.length) { console.log('\n⚠ 경고'); for (const w of warn) console.log('  · ' + w); }
else console.log('\n경고 없음');
