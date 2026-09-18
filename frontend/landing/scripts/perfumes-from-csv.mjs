// ───────── 향수 지도 CSV → JS 모듈 (2026-09-11) ─────────
//   node scripts/perfumes-from-csv.mjs            (paperboat 폴더에서)
//
// 원본 : data/perfume_map_points.csv (+ 한글 이름 data/perfume_names_ko.csv · 어코드 · 닮은 향수 data/scent_map.json · 어코드 한글 data/accord_names_ko.csv)  →  생성 : src/perfumes-data.js
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

// ── 카드 어코드 (2026-09-17, v0.75.3) — data/scent_map.json 의 points[].top_accords 에서 **상위 3개**를 [영문, 한글] 로 붙인다 (카드의 ACCORDS 줄).
//   ⭐ 사용자 : *"어코드로 진행해줘 상위 3개만"*. 노트(탑 · 미들 · 베이스)는 데이터가 없다 — 백엔드 perfume_notes 가 비어 있다 (09-17 로컬 DB 0행).
//     어코드는 백엔드 perfume_accords(/api/v1/perfumes/{id}/notes 의 accords)와 같은 값이다 (strength 0~100 = weight × 100).
//   한글은 data/accord_names_ko.csv — basis : 서비스(향 계열 이름 · 노트 목록에 이미 있는 표기) · 관례(흔히 쓰는 음역) · 추정.
//   ⚠ top_accords 는 세기 순이다 (아니면 경고). 3위와 4위의 세기가 같은 향수(11개)는 원본 순서를 따른다.
//   ⭐ 2026-09-18 (v0.75.7) : 어코드마다 **향조 아홉 중 하나**(`family`)를 같이 싣는다 — [영문, 한글, 향조]. 카드가 그 향조 색 계열로 어코드 글자를 칠한다 (ui.js accordInk).
//     사용자 : *"해당 어코드들을 9개로 묶어 … 전부 같은 색이 아니라 유사한 계열 색상의 폰트로"*. 묶음은 data/accord_names_ko.csv 의 family 열이다 —
//     family_basis : 데이터(200개에서 어코드 세기와 향조 비중의 상관이 가장 큰 향조 · 10회 이상이거나 r ≥ 0.3) · 데이터(약함) · 판단(드물고 데이터 1위가 향료 상식과 어긋난 것 — family_note).
//     ⚠ 여기서 그 상관을 다시 재어, **10회 이상 나오는 어코드**의 family 가 데이터 1위와 다르면 경고한다 — 원본이 바뀌어 묶음이 낡은 것이다.
const SM = join(root, 'data', 'scent_map.json');
const smap = JSON.parse(readFileSync(SM, 'utf8'));
const AC_TOP = 3;
const FAMILY_KEYS = ['CITRUS', 'FRUITY', 'FLORAL', 'GREEN', 'AQUATIC', 'WOODY', 'AMBER', 'GOURMAND', 'MUSK'];
const AKO = join(root, 'data', 'accord_names_ko.csv');
const akText = readFileSync(AKO, 'utf8').replace(/^﻿/, '');
const akLines = akText.split(/\r?\n/).filter(l => l.trim());
const akHead = parseLine(akLines[0]);
for (const k of ['accord', 'name_ko', 'basis', 'family', 'family_basis']) if (!akHead.includes(k)) throw new Error('어코드 한글 CSV 에 열이 없다 : ' + k);
const akc = Object.fromEntries(akHead.map((h, i) => [h, i]));
const acKo = new Map(), acFam = new Map();
const acWarn = [];
akLines.slice(1).forEach(l => {
  const v = parseLine(l);
  const en = v[akc.accord];
  if (acKo.has(en)) acWarn.push(`한글 이름이 둘이다 : ${en}`);
  if (!v[akc.name_ko]) acWarn.push(`한글 이름이 비었다 : ${en}`);
  if (!FAMILY_KEYS.includes(v[akc.family])) acWarn.push(`향조가 아홉 중 하나가 아니다 : ${en} '${v[akc.family]}'`);
  acKo.set(en, v[akc.name_ko]);
  acFam.set(en, v[akc.family]);
});
// 묶음 검사 — 어코드 세기(없으면 0)와 향수의 향조 비중(families[].weight, 없으면 0)의 상관 (피어슨)
{
  const pts = smap.points || [];
  const fw = pts.map(p => Object.fromEntries(FAMILY_KEYS.map(f => [f, ((p.families || []).find(q => q.key === f) || {}).weight || 0])));
  const corr = (x, y) => {
    const n = x.length, mx = x.reduce((a, b) => a + b, 0) / n, my = y.reduce((a, b) => a + b, 0) / n;
    let sxy = 0, sxx = 0, syy = 0;
    for (let i = 0; i < n; i++) { sxy += (x[i] - mx) * (y[i] - my); sxx += (x[i] - mx) ** 2; syy += (y[i] - my) ** 2; }
    return sxx && syy ? sxy / Math.sqrt(sxx * syy) : 0;
  };
  for (const [en, fam] of acFam) {
    const x = pts.map(p => ((p.top_accords || []).find(a => a.name === en) || {}).strength || 0);
    if (x.filter(v => v > 0).length < 10) continue;
    const best = FAMILY_KEYS.map(f => [f, corr(x, fw.map(o => o[f]))]).sort((a, b) => b[1] - a[1])[0];
    if (best[0] !== fam) acWarn.push(`묶음이 데이터와 다르다 : ${en} → ${fam} (데이터 1위 ${best[0]} ${best[1].toFixed(2)})`);
  }
}
const acById = new Map((smap.points || []).map(q => [q.fragrantica_id, q.top_accords || []]));
rows.forEach(r => {
  const list = acById.get(r.id);
  if (!list || !list.length) { acWarn.push(`어코드가 없다 : ${r.id} ${r.brand} | ${r.name}`); return; }
  list.forEach((a, k) => { if (k && a.strength > list[k - 1].strength) acWarn.push(`세기 순이 아니다 : ${r.id} 의 ${k + 1}번째`); });
  r.ac = list.slice(0, AC_TOP).map(a => {
    const ko = acKo.get(a.name);
    // 한글이 없으면 영문으로 띄우고 경고한다 — 새 원본에 처음 보는 어코드가 들어온 것이다 (향조가 없으면 글자는 상아색으로 뜬다)
    if (!ko) acWarn.push(`어코드 한글 이름이 없다 : '${a.name}' (${r.id}) — data/accord_names_ko.csv 에 더한다`);
    return [a.name, ko || a.name, acFam.get(a.name) || ''];
  });
});
if (acWarn.length) console.warn('⚠ 카드 어코드 :\n  ' + acWarn.join('\n  '));
const acCount = rows.filter(r => r.ac && r.ac.length).length;

// ── 닮은 향수 (2026-09-14, v0.62.0) — data/scent_map.json 의 points[].neighbors 를 fragrantica_id 로 붙인다.
//   ⭐ 사용자 확정 : **유사도 = 데이터 neighbors** 다 (*"백엔드에 있는 자료가 더 좋을듯"*). 지도 좌표 거리가 아니다 —
//     원본이 *"x,y 로 거리를 계산하면 안 된다"* 고 적어 두었다 (좌표는 200개를 평면에 눌러 담은 것 · distance_is_metric false).
//     백엔드 perfume_neighbors(/api/v1/perfumes/{id}/neighbors · /similar)와 **같은 목록**이다 (09-14 대조 200/200).
//   nb = [[fragrantica_id, 유사도], …] 닮은 순 10개. ⚠ 방향이 있다 — a 의 목록에 b 가 있어도 b 의 목록에 a 가 없을 수 있다
//     (2000행 중 810행이 한쪽뿐). 짝으로 볼 때는 어느 쪽 목록에 있든 본다 — src/links.js `linkSim`.
//   (scent_map.json 은 위 카드 어코드에서 읽어 두었다 — smap)
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
//   ac 는 data/scent_map.json 의 top_accords 상위 ${AC_TOP}개다 — [영문, 한글, 향조] · ${acCount}/${rows.length}개 (한글 · 향조 data/accord_names_ko.csv · 카드 ACCORDS 줄, ui.js showScent)
//   nb 는 data/scent_map.json 의 neighbors 다 — [fragrantica_id, 유사도] 닮은 순 10개 · ${nbCount}개 (유사 연결선의 기준, focusLinkBasis 1)
export const PERFUMES = [
${body}
];
`);
console.log('생성 :', OUT, '·', rows.length, '행 ·', JSON.stringify(fams), '· 어코드', acCount, '개 · 닮은 향수', nbCount, '개');
