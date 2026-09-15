// ───────── 호스트 경계 — 카드의 서비스 동작 ─────────
// 말풍선 카드의 [자세히 보기] · [진열대에 저장] · [주변 향 탐색] 이 **서비스 앱(호스트)** 으로 나가는 문은 이 파일 하나다 (2026-09-15, v0.68.0).
// 호스트 = 팀 프론트 (React · react-router · TanStack Query). 엔진은 라우터도 모달도 모른다 — **무엇을 눌렀는가**만 넘긴다.
//
// 프론트 HomePage (A01 · A02 · A03) 의 흐름을 그대로 옮겼다 (docs/프론트-이식-검토.md §7) :
//   [자세히 보기]  → openDetail(ref)      앱 : navigate(toPerfumeDetail(perfumeId)) — A10 으로 **화면이 바뀐다** (셋 중 이것만)
//   [진열대에 저장] → saveToShelf(ref)    앱 : ShelfSaveModal (A11) — 카드 · 고른 향수 · 12개는 그대로 둔다. 취소하면 고른 향수가 남는다
//                                         ⚠ Promise 를 돌려주면 끝날 때까지 엔진 입력을 잠근다 (main.js holdWhile) — 모달 위 방향키 · ESC 가 배로 새지 않게
//   [주변 향 탐색] → exploreSimilar(ref)  **엔진이 먼저 한다** — 카드의 향을 새 중심으로 12개를 다시 띄운다 (A03 의 "누르면 그 향이 새 중심").
//                                         앱은 알림만 받는다. neighbors 를 같이 준다 — 백엔드 /perfumes/{id}/neighbors 와 같은 목록이다
//   검색창        → search(query)        앱 : navigate('/recommend?q=…') — A06 자연어 추천 (hostSearch). 호스트가 search 를 안 주면 예전처럼 해역으로 떠난다
//
// ⚠ 향수 id : 엔진의 `id` 는 fragrantica_id 다. 앱의 경로는 DB 의 perfumeId 라 **호스트가 바꾼다**.
//   데이터를 주입할 때 항목에 perfumeId 를 실어 주면 ref.perfumeId 로 같이 간다 (지금 perfumes-data.js 에는 없다 — null)
// ⚠ 호스트가 없으면 (이 프로토타입 단독) 기본 동작 — 경고 한 줄(ui.warn) + 콘솔. 화면 이동 · 모달은 앱이 붙은 뒤에 산다

let handlers = null;
let notice = null;   // 단독일 때 알릴 곳 — main.js 가 ui.warn 을 넘긴다

/** 호스트가 붙을 때 부른다. h = { openDetail, saveToShelf, exploreSimilar } — 없는 것은 기본 동작. null 이면 단독으로 돌아간다 */
export function setHost(h) { handlers = h || null; }
export function setHostNotice(fn) { notice = typeof fn === 'function' ? fn : null; }

/** 카드가 비추는 부표 → 호스트에 넘길 향수 요약. 지도 향수가 아니면 (예전 토러스 부표) null — 세 동작 모두 쉰다 */
export function perfumeRef(m) {
  const p = m && m.src === 'map' ? m.perfume : null;
  if (!p) return null;
  return {
    fragranticaId: p.id,
    perfumeId: p.perfumeId === undefined ? null : p.perfumeId,
    name: p.name, nameKo: p.nameKo || p.name,
    brand: p.brand, brandKo: p.brandKo || p.brand,
    family: p.family,
    mx: p.mx, my: p.my,
    neighbors: (p.nb || []).map(([id, sim]) => ({ fragranticaId: id, similarity: sim }))
  };
}

const DEFAULTS = {
  openDetail(ref) {
    console.info('[paperboat] 자세히 보기 → 앱에서는 향수 상세 /perfumes/{perfumeId} (A10)', ref);
    if (notice) notice('자세히 보기', '앱에 붙으면 향수 상세 화면으로 이동합니다');
  },
  saveToShelf(ref) {
    console.info('[paperboat] 진열대에 저장 → 앱에서는 분류 선택 모달 (A11)', ref);
    if (notice) notice('진열대에 저장', '앱에 붙으면 분류를 고르는 창이 뜹니다');
  },
  // 엔진이 이미 12개를 다시 띄웠다 — 단독일 때 더 할 일이 없다
  exploreSimilar() {}
};

/** 동작 하나를 호스트로 보낸다. 호스트 처리기가 돌려준 값 (Promise 일 수 있다) 을 그대로 돌려준다 */
export function callHost(name, ref) {
  if (!ref) return undefined;
  const fn = handlers && handlers[name];
  if (typeof fn === 'function') return fn(ref);
  DEFAULTS[name](ref);
  return undefined;
}

/** 검색창 (main.js onSearch). 호스트가 search 를 주면 검색어를 넘기고 true — 엔진은 해역으로 떠나지 않는다. 없으면 false — 예전 그대로 엔진이 찾는다 (goSearch) */
export function hostSearch(query) {
  const fn = handlers && handlers.search;
  if (typeof fn !== 'function') return false;
  fn(query == null ? '' : String(query));
  return true;
}
