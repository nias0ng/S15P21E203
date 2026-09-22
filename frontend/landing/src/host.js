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
//   배를 누름      → openCabin() · closeCabin()  앱 : 배 옆의 **작은 말풍선** (진열대 · 컬렉션, 2026-09-21 · hostCabin). 인자가 없다 — 배는 한 척이라 가릴 일이 없다
//                                         ⚠ 입력을 안 잠근다 — 말풍선은 아무 데나 누르면 닫히고, 그 누름을 엔진이 받아 closeCabin 으로 알린다
//
// ⚠ 향수 id : 엔진의 `id` 는 fragrantica_id 다. 앱의 경로는 DB 의 perfumeId 라 **호스트가 바꾼다**.
//   데이터를 주입할 때 항목에 perfumeId 를 실어 주면 ref.perfumeId 로 같이 간다 (지금 perfumes-data.js 에는 없다 — null)
// ⚠ 호스트가 없으면 (이 프로토타입 단독) 기본 동작 — 경고 한 줄(ui.warn) + 콘솔. 화면 이동 · 모달은 앱이 붙은 뒤에 산다

let handlers = null;
let notice = null;   // 단독일 때 알릴 곳 — main.js 가 ui.warn 을 넘긴다

/** 호스트가 붙을 때 부른다. h = { openDetail, saveToShelf, exploreSimilar, search, moveBoat, openCabin, closeCabin } — 없는 것은 기본 동작. null 이면 단독으로 돌아간다 */
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

// ───────── 배가 옮겨 간 자리 (2026-09-18, v0.75.12) — 앱의 향해 일지가 듣는다 ─────────
// 앱 : `PUT /api/v1/map/exploration/me` (ExplorationController). 향수를 고른 이동은 `perfumeId` 를,
//   빈 바다로 간 이동은 정규화 좌표 `x`·`y` 를 보낸다 — **서버가 기록할지 정한다** (향수는 늘 남기고,
//   빈 바다는 향 영역이 바뀐 경우에만). 그래서 엔진은 '어디로 갔는가' 만 말하고 일지를 모른다.
// ⚠⚠ **좌표는 정규화 공간이다** (CSV 의 map_x·map_y · 백엔드 `perfume_map_points` 와 같은 공간) —
//   월드를 보내면 서버가 지도 밖으로 읽는다. 옮기는 것은 `scentmap.toNorm()` 하나다 (불변식 21).
// ⚠ 비로그인이어도 앱이 부른다 — 서버가 옮긴 자리만 돌려주고 기록은 안 남긴다 (컨트롤러 주석).
//   엔진이 로그인 여부를 알 필요가 없다는 뜻이다.
// ⚠ **알림만이다** — 호스트가 Promise 를 줘도 입력을 잠그지 않는다 (`exploreSimilar` 와 같은 규약 · 불변식 32).
export function hostMove(move) {
  const fn = handlers && handlers.moveBoat;
  if (typeof fn !== 'function' || !move) return false;
  fn(move);
  return true;
}

// ───────── 선실 (2026-09-21, v0.79.0) — 배 옆에 뜨는 작은 말풍선 ─────────
// 앱 : 배 옆구리에 꼬리를 댄 **작은 말풍선** (`features/map/components/CabinBubble`) — 줄은 둘뿐이다,
//   진열대 · 컬렉션. 자리는 앱이 `PB.boat.screen` 을 매 프레임 읽어 잡는다 (배를 따라다닌다).
// ⚠⚠ **인자가 없다.** 배는 한 척이라 어느 배인지 가릴 일이 없다 — 그래서 `perfumeRef` 를 타는
//   `callHost` 가 아니라 `hostSearch` 처럼 제 문을 쓴다 (`callHost` 는 ref 가 없으면 아무 일도 안 한다).
// ⚠⚠ **여닫이 둘 다 이 문으로 간다** (`open` true/false). 말풍선은 팝오버라 **아무 데나 누르면 닫히는데**,
//   그 누름을 받는 것은 엔진(`onPick`)이라 닫아 달라고 말할 길이 필요하다.
// ⚠ 여는 쪽은 **앱이 돌려준 Promise 를 그대로 되돌린다** — main.js 가 그걸로 '말풍선이 떠 있다' 를 센다.
// ⚠ **입력을 안 잠근다** ([진열대에 저장]과 다른 점). 판이 아니라 말풍선이라 뒤의 바다가 살아 있어야 하고,
//   어차피 포커스가 앱으로 넘어가 엔진의 키 처리기는 안 불린다. 누름은 위 규약대로 '닫기' 로 쓰인다.
export function hostCabin(open) {
  const fn = handlers && (open ? handlers.openCabin : handlers.closeCabin);
  if (typeof fn === 'function') return fn();
  if (!open) return undefined;   // 단독일 때는 뜬 것이 없으니 닫을 것도 없다
  console.info('[paperboat] 선실 → 앱에서는 진열대 · 컬렉션으로 가는 작은 말풍선 (A13)');
  if (notice) notice('선실', '앱에 붙으면 배 옆에 진열대 · 컬렉션 말풍선이 뜹니다');
  return undefined;
}

/** 검색창 (main.js onSearch). 호스트가 search 를 주면 검색어를 넘기고 true — 엔진은 해역으로 떠나지 않는다. 없으면 false — 예전 그대로 엔진이 찾는다 (goSearch) */
export function hostSearch(query) {
  const fn = handlers && handlers.search;
  if (typeof fn !== 'function') return false;
  fn(query == null ? '' : String(query));
  return true;
}

// ───────── 부팅 신호 (2026-09-17, v0.75.0) — 앱의 로딩 커튼이 듣는다 ─────────
// 엔진이 어디까지 떴는지를 **부모 창**에 알린다 (`postMessage` · 같은 출처). 앱(ScentScene)은 이걸 받아
// '향해' 커튼의 퍼센트를 민다 (docs/고도화-0917/03-로딩-전환-수중.md §2-4).
//   html        index.html 인라인 스크립트 (모듈보다 앞이라 이 파일을 못 부른다 — 같은 모양으로 직접 보낸다)
//   script      main.js 의 import 평가 직후
//   frame       첫 tick() 다음 줄 — 셰이더가 컴파일되고 첫 장이 그려졌다
//   boat-bytes  GLB 받는 중 (loaded · total — total 0 이면 크기를 모른다)
//   boat        GLB 를 붙였다 (ok) · 실패해 종이배로 간다 (ok:false) · 종이배 설정이라 안 받는다 (skipped)
//   error       스크립트 오류 (where · message)
// ⚠ setHost 처리기만으로는 모자라다 — 호스트는 `window.PB` 가 열린 **뒤**에 붙는데 html · script · frame 은 그 전이다.
//   그래서 postMessage 로 보내고, 늦게 붙은 호스트를 위해 마지막 상태를 `bootNow()`(PB.boot) 로도 읽게 한다.
// ⚠ 시각은 이 문서의 performance.now() 다 — 부모 문서와 시간 원점이 달라 밖으로 내보내지 않는다 (단계가 끝났는지만 본다).
const boot = { stages: {}, bytes: null, error: null };
export function bootReport(stage, detail) {
  const d = detail || {};
  if (stage === 'boat-bytes') boot.bytes = { loaded: d.loaded || 0, total: d.total || 0 };
  else if (stage === 'error') boot.error = { where: d.where || '', message: d.message || '' };
  else if (!boot.stages[stage]) boot.stages[stage] = performance.now();
  if (window.parent && window.parent !== window) {
    // file: 로 열면 origin 이 'null' 이라 postMessage 가 던진다 — 단독 화면에서는 알릴 곳도 없으니 조용히 넘어간다
    try { window.parent.postMessage({ type: 'pb:boot', stage, ...d }, location.origin); } catch (e) { /* 단독 */ }
  }
}
/** 지금까지의 부팅 상태 — 늦게 붙은 호스트가 놓친 단계를 따라잡는다 (main.js 가 PB.boot 로 내보낸다) */
export function bootNow() {
  return {
    stages: { ...boot.stages },
    bytes: boot.bytes ? { ...boot.bytes } : null,
    error: boot.error ? { ...boot.error } : null
  };
}
