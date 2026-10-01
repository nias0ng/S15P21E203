import { PARAMS as P } from './params.js';

// ───────── 화면 글자 사전 (2026-09-30) — 한국어 · 영어 두 벌 ─────────
// 앱(React)은 i18next 를 쓰지만 엔진은 iframe 안의 순수 JS 라 그 묶음을 못 읽는다 — 엔진이 쓰는 글자만 여기 따로 둔다.
// 언어는 시작할 때 주소의 `?lang=ko|en` 으로 고르고(기본 ko), 앱이 KO · EN 을 바꾸면 `PB.setLang(lang)` 을 부른다.
//
// ⚠ 한국어 문구는 **예전 글자 그대로**다 — index.html 의 고정 글자와 한 글자라도 다르면 시작할 때 화면이 바뀐다.
// ⚠ 향조 이름(FLORAL 등) · 노트 · 'SCENT MAP' 같은 영문 머리말은 원래 영어라 사전에 없다.
// ⚠ 향수 이름은 사전이 아니라 데이터다 — 영어 화면이면 labelKo · nameKo 대신 영문 원명(name)을 쓴다 (koNames).
// ⚠ 치환은 `{{이름}}` 이다 (앱의 i18next 와 같은 모양). 영어에서 개수가 1 이면 `키_one` 을 먼저 찾는다.

export const LANGS = ['ko', 'en'];

const DICT = {
  ko: {
    doc: { title: '향을 찾는 종이배' },
    // 자리표시 사이트 헤더 (params.siteHeader — 앱에 붙으면 앱 헤더가 대신한다)
    header: {
      menu: '사이트 메뉴 (자리표시)', perfume: '향수', brand: '브랜드', note: '노트', community: '커뮤니티',
      search: '찾기 (자리표시)', login: '로그인', greet: '오늘도,<br>좋은 향과 함께.'
    },
    search: { placeholder: '어떤 향을 찾고 계신가요?', button: '찾기' },
    card: { close: '닫기', detail: '자세히 보기', save: '진열대에 저장', sail: '이 향의 해역으로' },
    cabin: { open: '선실 열기' },
    sea: { out: '범위 없음', outSub: '이 너머는 갈 수 없는 해역입니다', open: '빈 바다', waters: '{{name}} 해역' },
    mini: { open: '해도 열기', explored: '탐색 {{pct}}%' },
    chart: {
      title: '향해 지도', reset: '처음 배율', close: '닫기', closeTitle: '닫기 (ESC)',
      count: '향수 {{n}}', explored: ' · 탐색 {{pct}}%', zoom: ' · {{k}}배', unexplored: ' · 미탐색',
      tail: '해역을 누르면 그리로 떠납니다\n휠 확대 · 끌어 이동 · ESC 닫기'
    },
    // ⚠ 공백 · NBSP 는 index.html 의 `그쪽으로 &nbsp;·&nbsp; 부표를` 그대로다 · keys 는 .pb-help-keys 칸이다 (방향키가 없는 기기에서 숨는다)
    drift: { speed: '속도', help: '바다를 누르면 그쪽으로  ·  부표를 누르면 향수', keys: '  ·  ← → ↑ 로 직접 몰기' },
    quality: { high: '높음', mid: '보통', low: '낮음', min: '최저' },
    // 앱 없이 단독으로 띄웠을 때의 알림 (host.js DEFAULTS)
    host: {
      detail: '자세히 보기', detailSub: '앱에 붙으면 향수 상세 화면으로 이동합니다',
      save: '진열대에 저장', saveSub: '앱에 붙으면 분류를 고르는 창이 뜹니다',
      cabin: '선실', cabinSub: '앱에 붙으면 배 옆에 진열대 · 컬렉션 말풍선이 뜹니다'
    }
  },
  en: {
    doc: { title: 'Paper Boat Scent Voyage' },
    header: {
      menu: 'Site menu (placeholder)', perfume: 'Perfume', brand: 'Brand', note: 'Note', community: 'Community',
      search: 'Search (placeholder)', login: 'Log in', greet: 'Every day,<br>with a good scent.'
    },
    search: { placeholder: 'What scent are you looking for?', button: 'Search' },
    card: { close: 'Close', detail: 'View details', save: 'Save to Shelf', sail: 'Sail to its waters' },
    cabin: { open: 'Open cabin' },
    // ⚠ 미니맵 머리말의 글자 칸은 좁은 단계(폭 1280 이하 · 판 200px)에서 약 65px 이다 — 'explored' · 'Out of range' 는 두 줄로 꺾였다 (10px · 자간 0.12em 실측)
    sea: { out: 'Off limits', outSub: 'You can’t sail beyond this point', open: 'Open sea', waters: '{{name}} waters' },
    mini: { open: 'Open chart', explored: '{{pct}}% seen' },
    chart: {
      title: 'Hyanghae Map', reset: 'Reset zoom', close: 'Close', closeTitle: 'Close (Esc)',
      count: '{{n}} perfumes', count_one: '{{n}} perfume', explored: ' · {{pct}}% explored', zoom: ' · {{k}}×', unexplored: ' · unexplored',
      tail: 'Click waters to sail there\nScroll to zoom · Drag to pan · Esc to close'
    },
    drift: { speed: 'Speed', help: 'Click the sea to sail there  ·  click a buoy for its perfume', keys: '  ·  ← → ↑ to steer' },
    quality: { high: 'High', mid: 'Medium', low: 'Low', min: 'Lowest' },
    host: {
      detail: 'View details', detailSub: 'In the app, this opens the perfume page',
      save: 'Save to Shelf', saveSub: 'In the app, this opens the shelf picker',
      cabin: 'Cabin', cabinSub: 'In the app, a Shelf · Collection bubble appears by the boat'
    }
  }
};

// 해역 설명 두 줄 (config.js 의 desc) — 영어판만 여기 둔다. 한국어는 config 가 원본이다.
//   키는 향조 키(대문자)다. 예전 존 넷(markMap 0)의 fresh 는 AQUATIC 과 같은 문구라 FRESH 로 같이 둔다
const ZONE_DESC_EN = {
  FLORAL:   ['Offered by opening petals,', 'a soft and radiant impression.'],
  FRUITY:   ['Ripe juice spreading out,', 'a lively, sweet impression.'],
  WOODY:    ['Carried on the breath of quiet trees,', 'a deep and steady beauty.'],
  GREEN:    ['Released by freshly picked leaves,', 'a crisp, upright breath.'],
  CITRUS:   ['Sun-warmed peel bursting open,', 'a bright, zesty first impression.'],
  AQUATIC:  ['Left by a breeze skimming the water,', 'a clear, light trail.'],
  FRESH:    ['Left by a breeze skimming the water,', 'a clear, light trail.'],
  AMBER:    ['Warm resin slowly spreading,', 'a cozy, lingering drydown.'],
  GOURMAND: ['Sweet warmth slowly melting in,', 'a soft, cozy trail.'],
  MUSK:     ['Sinking into clean skin,', 'a subtle, cozy drydown.']
};
// 해도 범례의 둘째 줄 — 한국어는 검색 키워드의 첫 낱말(kw[0])이고, 영어는 용어집의 향 표현이다
const FAM_WORD_EN = {
  FLORAL: 'floral', FRUITY: 'fruity', WOODY: 'woody', GREEN: 'green', CITRUS: 'citrus',
  AQUATIC: 'aquatic', FRESH: 'fresh', AMBER: 'amber', GOURMAND: 'gourmand', MUSK: 'musky'
};

// 두 벌의 모양이 같은지는 i18n.test.js 가 본다 (한쪽에만 키를 더하면 그 언어에서 키 이름이 화면에 뜬다)
export const MESSAGES = DICT;

/** 주소의 검색 문자열 → 'ko' | 'en'. 모르는 값이면 ko */
export function langFromSearch(search) {
  try {
    const q = new URLSearchParams(search || '').get('lang');
    return LANGS.includes(q) ? q : 'ko';
  } catch (e) { return 'ko'; }
}

let cur = langFromSearch(typeof location === 'undefined' ? '' : location.search);
const listeners = new Set();

export const lang = () => cur;
export const isKo = () => cur === 'ko';
// 한글 이름(labelKo · nameKo · subKo · 어코드 ko)을 쓸 것인가 — 개발 손잡이 markNameKo 가 꺼져 있어도 영문이다
export const koNames = () => cur === 'ko' && (P.markNameKo === undefined ? 1 : P.markNameKo) >= 0.5;

const lookup = (l, key) => key.split('.').reduce((o, k) => (o && typeof o === 'object' ? o[k] : undefined), DICT[l]);

/** 사전 글자. 없는 키면 한국어 → 키 그대로 (화면이 비지 않게) */
export function t(key, vars) {
  let s;
  if (vars && vars.n === 1 && cur !== 'ko') s = lookup(cur, key + '_one');
  if (typeof s !== 'string') s = lookup(cur, key);
  if (typeof s !== 'string') s = lookup('ko', key);
  if (typeof s !== 'string') return key;
  return vars ? s.replace(/\{\{(\w+)\}\}/g, (m, k) => (vars[k] === undefined ? m : String(vars[k]))) : s;
}

// 'FLORAL' → 'Floral' (영어 문장 안에 대문자 향조 이름이 그대로 들어가면 소리치는 것처럼 읽힌다)
const titleCase = (s) => String(s || '').toLowerCase().replace(/(^|\s)\S/g, (c) => c.toUpperCase());

/** '{향조} 해역' · '{Family} waters' */
export const waters = (name) => t('sea.waters', { name: cur === 'ko' ? name : titleCase(name) });

/** 해역 설명(두 줄 배열). 영어판이 없으면 config 의 한국어 */
export function zoneDesc(z) {
  if (!z) return [];
  if (cur !== 'ko') { const d = ZONE_DESC_EN[String(z.key || '').toUpperCase()]; if (d) return d; }
  return z.desc || [];
}

/** 해도 범례의 향조 둘째 줄 */
export function famWord(f) {
  if (!f) return '';
  if (cur !== 'ko') return FAM_WORD_EN[String(f.key || '').toUpperCase()] || String(f.name || '').toLowerCase();
  return (f.kw && f.kw[0]) || '';
}

/**
 * index.html 의 고정 글자를 지금 언어로 다시 쓴다.
 *   data-i18n="키"          → textContent
 *   data-i18n-html="키"     → innerHTML (⚠ 사전 글자만 들어간다 — 바깥 입력을 넣지 않는다)
 *   data-i18n-attr="속성:키;속성:키" → 속성 (aria-label · title · placeholder)
 */
export function applyStatic(root) {
  const doc = root || (typeof document === 'undefined' ? null : document);
  if (!doc || !doc.querySelectorAll) return;
  doc.querySelectorAll('[data-i18n]').forEach((el) => { const s = t(el.getAttribute('data-i18n')); if (el.textContent !== s) el.textContent = s; });
  doc.querySelectorAll('[data-i18n-html]').forEach((el) => { const s = t(el.getAttribute('data-i18n-html')); if (el.innerHTML !== s) el.innerHTML = s; });
  doc.querySelectorAll('[data-i18n-attr]').forEach((el) => {
    for (const pair of el.getAttribute('data-i18n-attr').split(';')) {
      const i = pair.indexOf(':');
      if (i > 0) el.setAttribute(pair.slice(0, i).trim(), t(pair.slice(i + 1).trim()));
    }
  });
  if (!root && typeof document !== 'undefined') {
    document.documentElement.lang = cur;
    document.title = t('doc.title');
  }
}

/** 언어가 바뀌면 부른다 — 돌려준 함수로 끊는다 (모듈의 dispose) */
export function onLang(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** 언어를 바꾼다 (PB.setLang). 고정 글자를 다시 쓰고, 다음에 그리는 글자는 각 모듈이 onLang 으로 다시 짓는다 */
export function setLang(next) {
  const l = LANGS.includes(next) ? next : 'ko';
  if (l === cur) return cur;
  cur = l;
  applyStatic();
  listeners.forEach((fn) => { try { fn(cur); } catch (e) { console.warn('[i18n]', e); } });
  return cur;
}
