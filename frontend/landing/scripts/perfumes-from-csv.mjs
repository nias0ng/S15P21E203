// ───────── 향수 지도 CSV → JS 모듈 (2026-09-11) ─────────
//   node scripts/perfumes-from-csv.mjs            (paperboat 폴더에서)
//
// 원본 : data/perfume_map_points.csv (+ 한글 이름 data/perfume_names_ko.csv · 닮은 향수 data/scent_map.json)  →  생성 : src/perfumes-data.js
//
// ⚠ 왜 CSV 를 바로 import 하지 않는가 — Vite 의 `?raw` 를 쓰면 **Vite 없이 여는
//   preview-nobuild.html 이 통째로 죽는다** (브라우저가 CSV 를 모듈로 받으려다 MIME 에러).
//   그래서 한 번 JS 로 굽는다. 데이터가 바뀌면 CSV 를 갈아 끼우고 이 스크립트를 다시 돌린다.
// ⚠ 생성 파일은 손으로 고치지 않는다. 좌표를 월드로 옮기는 일은 src/scentmap.js 가 한다 —
//   여기서는 CSV 의 값을 **그대로** 옮기기만 한다 (정규화 좌표 0~1 그대로).

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(root, 'data', 'perfume_map_points.csv');
const OUT = join(root, 'src', 'perfumes-data.js');

// ⚠ 원본에 UTF-8 BOM 이 붙어 있다 (EF BB BF). 안 벗기면 첫 열 이름이 '﻿fragrantica_id' 가 된다
const text = readFileSync(SRC, 'utf8').replace(/^﻿/, '');

// 따옴표 안의 쉼표를 지키는 최소 파서 — 이름에 쉼표가 있다 ("Thank U, Next")
function parseLine(line) {
  const out = []; let cur = '', q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) {
      if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') q = false;
      else cur += c;
    } else if (c === '"') q = true;
    else if (c === ',') { out.push(cur); cur = ''; }
    else cur += c;
  }
  out.push(cur);
  return out;
}

const lines = text.split(/\r?\n/).filter(l => l.trim());
const head = parseLine(lines[0]);
const need = ['fragrantica_id', 'brand', 'name', 'year', 'gender', 'map_x', 'map_y', 'primary_family_key', 'korea_selection_rank', 'korea_selection_basis'];
for (const k of need) if (!head.includes(k)) throw new Error('CSV 에 열이 없다 : ' + k);
const col = Object.fromEntries(head.map((h, i) => [h, i]));

const rows = lines.slice(1).map((l, n) => {
  const v = parseLine(l);
  const num = (k) => { const s = v[col[k]]; return s === '' || s === undefined ? null : Number(s); };
  const r = {
    id: num('fragrantica_id'),
    brand: v[col.brand],
    name: v[col.name],
    year: num('year'),                     // ⚠ 비어 있는 행이 있다 (null)
    gender: v[col.gender],
    mx: num('map_x'),
    my: num('map_y'),
    family: v[col.primary_family_key],
    rank: num('korea_selection_rank'),
    basis: v[col.korea_selection_basis]
  };
  if (!Number.isFinite(r.mx) || !Number.isFinite(r.my)) throw new Error(`좌표가 숫자가 아니다 (${n + 2}행)`);
  return r;
});

// ── 한글 이름 (2026-09-12) — data/perfume_names_ko.csv 를 fragrantica_id 로 붙인다.
//   ⚠ 원본 CSV 에 열을 더하지 않고 **따로 둔다** — 데이터 팀이 원본을 갈아 끼워도 번역이 안 날아간다.
//   ⚠ 사용자 : *"영어로 향수 이름이 적혀있다면 한글로 다시 정확히 번역해서"*. 향수 이름은 뜻을 옮기지 않고
//     **국내 판매명(음역)** 을 쓴다 — '나일의 정원' 처럼 판매명이 번역어인 것만 번역어다. basis 열이 근거다 (확인 · 관례 · 추정).
//   이름표(labelKo)는 label_ko 가 비어 있으면 name_ko 에서 **농도 · 연도**를 떼어 만든다 — 작게 떠야 해서다.
const KO = join(root, 'data', 'perfume_names_ko.csv');
const koText = readFileSync(KO, 'utf8').replace(/^﻿/, '');
const koLines = koText.split(/\r?\n/).filter(l => l.trim());
const koHead = parseLine(koLines[0]);
for (const k of ['fragrantica_id', 'brand_ko', 'name_ko', 'label_ko', 'basis']) if (!koHead.includes(k)) throw new Error('한글 이름 CSV 에 열이 없다 : ' + k);
const kc = Object.fromEntries(koHead.map((h, i) => [h, i]));
const koById = new Map(koLines.slice(1).map(l => { const v = parseLine(l); return [Number(v[kc.fragrantica_id]), v]; }));
const shortLabel = (s) => s
  .replace(/\s*\((19|20)\d{2}\)\s*$/, '')                       // ' (2021)'
  .replace(/\s+(오 드 퍼퓸|오 드 빠르펭|오 드 뚜왈렛|코롱)$/, '')   // 농도 — 제품명의 일부가 아닐 때만 끝에 붙어 있다
  .trim();
const warn = [];
rows.forEach(r => {
  const v = koById.get(r.id);
  if (!v) { warn.push(`한글 이름이 없다 : ${r.id} ${r.brand} | ${r.name}`); return; }
  // 원본과 한글 파일의 영문이 다르면 id 가 어긋난 것이다 — 조용히 엉뚱한 이름이 붙는다
  if (kc.name_en !== undefined && v[kc.name_en] && v[kc.name_en] !== r.name) warn.push(`영문 이름이 다르다 : ${r.id} '${r.name}' ≠ '${v[kc.name_en]}'`);
  r.nameKo = v[kc.name_ko];
  r.brandKo = v[kc.brand_ko];
  r.labelKo = v[kc.label_ko] || shortLabel(v[kc.name_ko]);
  r.koBasis = v[kc.basis];
});
for (const id of koById.keys()) if (!rows.some(r => r.id === id)) warn.push(`원본에 없는 id : ${id}`);
const seen = new Map();
rows.forEach(r => { if (!r.labelKo) return; if (seen.has(r.labelKo)) warn.push(`이름표가 겹친다 : '${r.labelKo}' (${seen.get(r.labelKo)} · ${r.id}) — label_ko 로 가른다`); else seen.set(r.labelKo, r.id); });
if (warn.length) console.warn('⚠ 한글 이름 :\n  ' + warn.join('\n  '));

// ── 닮은 향수 (2026-09-14, v0.62.0) — data/scent_map.json 의 points[].neighbors 를 fragrantica_id 로 붙인다.
//   ⭐ 사용자 확정 : **유사도 = 데이터 neighbors** 다 (*"백엔드에 있는 자료가 더 좋을듯"*). 지도 좌표 거리가 아니다 —
//     원본이 *"x,y 로 거리를 계산하면 안 된다"* 고 적어 두었다 (좌표는 200개를 평면에 눌러 담은 것 · distance_is_metric false).
//     백엔드 perfume_neighbors(/api/v1/perfumes/{id}/neighbors · /similar)와 **같은 목록**이다 (09-14 대조 200/200).
//   nb = [[fragrantica_id, 유사도], …] 닮은 순 10개. ⚠ 방향이 있다 — a 의 목록에 b 가 있어도 b 의 목록에 a 가 없을 수 있다
//     (2000행 중 810행이 한쪽뿐). 짝으로 볼 때는 어느 쪽 목록에 있든 본다 — src/links.js `linkSim`.
const SM = join(root, 'data', 'scent_map.json');
const smap = JSON.parse(readFileSync(SM, 'utf8'));
const nbById = new Map((smap.points || []).map(q => [q.fragrantica_id, q.neighbors || []]));
const ids = new Set(rows.map(r => r.id));
const nbWarn = [];
rows.forEach(r => {
  const list = nbById.get(r.id);
  if (!list || !list.length) { nbWarn.push(`닮은 향수가 없다 : ${r.id} ${r.brand} | ${r.name}`); r.nb = []; return; }
  r.nb = list.map(q => [q.id, q.sim]);
  list.forEach((q, k) => {
    if (!ids.has(q.id)) nbWarn.push(`닮은 향수가 지도에 없다 : ${r.id} → ${q.id}`);
    if (!(q.sim > 0 && q.sim <= 1)) nbWarn.push(`유사도가 0~1 밖이다 : ${r.id} → ${q.id} (${q.sim})`);
    if (k && q.sim > list[k - 1].sim) nbWarn.push(`닮은 순이 아니다 : ${r.id} 의 ${k + 1}번째`);
  });
});
for (const id of nbById.keys()) if (!ids.has(id)) nbWarn.push(`scent_map.json 에만 있는 id : ${id}`);
if (nbWarn.length) console.warn('⚠ 닮은 향수 :\n  ' + nbWarn.join('\n  '));
const nbCount = rows.reduce((s, r) => s + r.nb.length, 0);

const fams = {};
rows.forEach(r => { fams[r.family] = (fams[r.family] || 0) + 1; });

const body = rows.map(r => '  ' + JSON.stringify(r)).join(',\n');
writeFileSync(OUT,
`// ⚠⚠ 생성 파일이다 — 손으로 고치지 않는다.
//   원본 : data/perfume_map_points.csv  ·  다시 만들기 : node scripts/perfumes-from-csv.mjs
//   ${rows.length}행 · 향조 ${Object.entries(fams).map(([k, n]) => k + ' ' + n).join(' · ')}
//   mx·my 는 CSV 의 정규화 좌표(0~1) 그대로다. 월드로 옮기는 것은 src/scentmap.js 다.
//   nameKo · brandKo · labelKo 는 data/perfume_names_ko.csv 에서 붙였다 (koBasis = 확인 · 관례 · 추정)
//   nb 는 data/scent_map.json 의 neighbors 다 — [fragrantica_id, 유사도] 닮은 순 10개 · ${nbCount}개 (유사 연결선의 기준, focusLinkBasis 1)
export const PERFUMES = [
${body}
];
`);
console.log('생성 :', OUT, '·', rows.length, '행 ·', JSON.stringify(fams), '· 닮은 향수', nbCount, '개');
