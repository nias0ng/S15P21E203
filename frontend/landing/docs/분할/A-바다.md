# A. 바다·배 렌더 — 갈래 메모

> 브랜치 `claude/threejs-split-a-sea` · 워크트리 `.claude/worktrees/threejs-a-sea` · 개발 서버 포트 5175
> 맡는 파일은 `../워크트리-분할.md` §1-A. **이 메모만 고친다** — `CHANGELOG.md` · `landing/CLAUDE.md` · `window.PB` 줄은 통합할 때 여기서 옮긴다.

## 이 갈래에서 할 일

## 바꾼 것

<!-- 나중에 CHANGELOG 항목이 된다. 버전 번호는 비워 둔다 -->

- 바다 하단 바닥 격자(수영장 바닥)를 끔 — `params.floorAmount` 0.10 → 0 (2026-09-15, 사용자 요청 "바다 하단에 있던 격자 제거")

## 새 불변식

<!-- 나중에 landing/CLAUDE.md 로 옮긴다 -->

## PB 에 넣을 이름

## 다른 갈래에 요청

- **C** : 자연어 검색창(`#search-input` 을 감싼 막대)을 조금 줄이기 (2026-09-15, 사용자 요청). 지금 넓은 창 기본값 520 × 56 (`index.html` 인라인 `var(--pb-search-w,520px)` · `var(--pb-search-h,56px)`), 1280 단계 480. 크기 값은 0 · 5 로 끝나게.

## 롤백

<!-- 파라미터를 0 으로 두면 예전 화면인지 -->

- 바닥 격자 : `PB.params.floorAmount = 0.10`
