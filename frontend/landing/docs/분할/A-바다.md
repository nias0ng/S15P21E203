# A. 바다·배 렌더 — 갈래 메모

> 브랜치 `claude/threejs-split-a-sea` · 워크트리 `.claude/worktrees/threejs-a-sea` · 개발 서버 포트 5175
> 맡는 파일은 `../워크트리-분할.md` §1-A. **이 메모만 고친다** — `CHANGELOG.md` · `landing/CLAUDE.md` · `window.PB` 줄은 통합할 때 여기서 옮긴다.

## 이 갈래에서 할 일

## 바꾼 것

<!-- 나중에 CHANGELOG 항목이 된다. 버전 번호는 비워 둔다 -->

- ✅ 통합됨 → CHANGELOG **v0.71.1** (2026-09-16) — 바다 하단 바닥 격자(수영장 바닥)를 끔 — `params.floorAmount` 0.10 → 0 (2026-09-15, 사용자 요청 "바다 하단에 있던 격자 제거")

## 새 불변식

<!-- 나중에 landing/CLAUDE.md 로 옮긴다 -->

## PB 에 넣을 이름

## 다른 갈래에 요청

- **C** : 자연어 검색창(`#search-input` 을 감싼 막대)을 조금 줄이기 (2026-09-15, 사용자 요청). 지금 넓은 창 기본값 520 × 56 (`index.html` 인라인 `var(--pb-search-w,520px)` · `var(--pb-search-h,56px)`), 1280 단계 480. 크기 값은 0 · 5 로 끝나게.
- **D** : 앱 헤더(`src/app/layouts/GlobalHeader.tsx`)를 **거의 투명한 유리**로 (2026-09-15, 사용자 요청). 지금은 짙은 밤색 반투명 그라데이션(`from-surface-night/60 to-surface-night/45`) · `backdrop-blur-xl` · 그림자 · 아래 선 때문에 3D 와 구분된 띠로 보인다 → 뒤 색이 그대로 비치고 경계가 드러나지 않게.
- **D** : 앱 헤더가 엔진의 개발자 패널(비교 패널 · `tweaks.js` · `perf.js` · `viewbar.js` 등)을 가린다 (2026-09-15, 사용자 요청). 헤더는 iframe 바깥이라 패널 z-index 로는 못 넘는다 → 패널을 `hostTop`(`--pb-host-top`)만큼 내리거나 개발 모드에서 헤더를 숨긴다. 이 패널 파일들은 분할 표에 주인이 없다. 임시로는 `/landing/index.html` 로 연다.
- **D** : 왼쪽 위 **항해 일지**(`src/features/map/components/VoyageLog.tsx`) 디자인 변경 (2026-09-16, 사용자 요청). 지도 API 를 연결해 실제 데이터로 보면서 고친다 — 구체 디자인은 D 세션에서 사용자와 정한다.

## 롤백

<!-- 파라미터를 0 으로 두면 예전 화면인지 -->

- 바닥 격자 : `PB.params.floorAmount = 0.10`
