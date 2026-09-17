import { CONFIG } from './config.js';
import { PARAMS as P } from './params.js';

// ───────── 존 표 (2026-09-11, v0.32.0) ─────────
// 향수 지도(`markMap 1`)에서는 **존 = CSV 의 향조 아홉** (`CONFIG.families`),
// 예전(`markMap 0`, 더미 32개 토러스)에서는 **넷** (`CONFIG.areas`).
//
// ⚠⚠ 존을 읽는 곳은 **전부 여기서 받는다** — title.js(타이포 글자·색) · ui.js(우측 정보 블록) ·
//   zones.js(검색·자동 조타) · viewbar.js(개발 바 '연출' 행) · marks.js(카드 라벨).
//   표를 직접 잡으면 지도를 켰을 때 넷짜리 표를 보고 'CITRUS' 를 못 찾는다 — 글자는 키 이름으로
//   대신 나오고 색·설명이 조용히 빈다 (화면에 무언가 나오므로 안 들킨다).
// ⚠ 키 비교는 **대소문자를 가리지 않는다.** 예전 존 키는 소문자('floral'), 향조 키는 대문자('FLORAL')다.

export const areasNow = () => (P.markMap >= 0.5 ? CONFIG.families : CONFIG.areas);

export function areaOf(key) {
  if (!key) return null;
  const k = String(key).toLowerCase();
  return areasNow().find(a => a.key.toLowerCase() === k) || null;
}

// 검색어 → 존. 키 · 이름 · 키워드 중 하나라도 맞으면 그 존이다 (zones.search 와 main.js 가 쓴다)
export function findArea(raw) {
  const q = (raw || '').trim().toLowerCase();
  if (!q) return null;
  return areasNow().find(a =>
    a.key.toLowerCase() === q || a.name.toLowerCase() === q || (a.kw || []).some(k => q.includes(k))) || null;
}
