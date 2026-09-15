# D. 앱 연결 (React) — 갈래 메모

> 브랜치 `claude/threejs-split-d-host` · 워크트리 `.claude/worktrees/threejs-d-host` · 개발 서버 포트 5178
> 맡는 파일은 `../워크트리-분할.md` §1-D. **이 메모만 고친다** — `CHANGELOG.md` · `landing/CLAUDE.md` · `window.PB` 줄은 통합할 때 여기서 옮긴다.
> ⚠⚠ `mountPaperboat` 전환은 A · B · C 가 통합 브랜치에 들어온 **뒤에** 한다. 그 전까지는 React 쪽과 `host.js` 만.
> 앱 코드를 고쳤으면 `frontend/` 에서 `npm run verify` 를 통과시킨다.

## 이 갈래에서 할 일

- [x] 메인 헤더를 거의 투명한 유리로 (A 메모의 요청 · 2026-09-15) — 아래 '바꾼 것'
- [x] 헤더가 엔진의 개발 패널을 가림 (A 메모의 요청) — 패널을 `hostTop` 만큼 내렸다 (2026-09-16 사용자 결정) · 아래 '바꾼 것'
- [x] 헤더 우측 '오늘도, 좋은 향과 함께.' 문구 · 세로 구분선을 모든 화면에서 뺀다 (2026-09-16 사용자)
- [ ] **develop 으로 넘길 때 개발 패널을 뺀다** (2026-09-16 사용자 : *"최종 develop 에 올릴 때는 노출 안 되게 삭제"*) — `../워크트리-분할.md` §4-7 의 develop 브랜치에서
  개발 패널 모듈(`perf` · `tweaks` · `viewbar` · `campanel` · `compare` · `freecam` · `probes` · `framegrab`)과 `main.js` 의 `DEV ? create…` 줄을 뺀다.
  ⚠ 지금도 production 빌드에는 안 들어간다 — `main.js` 가 `import.meta.env.DEV` 일 때만 만들고 빌드가 코드째 뺀다 (2026-09-16 확인 : dist 의 landing 번들에 tweaks · compare 문자열 0개 · 패널 파일을 고쳐도 번들 해시가 그대로).
  남는 곳은 develop 을 `npm run dev` 로 띄운 팀원 화면이다 (앱이 `PB.solo(true)` 로 숨기지만 H 키로 켜진다)
- [ ] 항해 일지가 계측 HUD(perf, 왼쪽 위 102px)를 덮는다 — 앱 DOM 이 iframe 위라 z-index 로 못 넘는다. 항해 일지를 다시 그릴 때 자리와 같이 본다
- [ ] 항해 일지 디자인 + API (A 메모의 요청 · 2026-09-16 사용자 결정 : 헤더와 같은 유리 톤 · `GET /api/v1/map/exploration-logs` 응답 모양대로 붙이고 서버가 없으면 대체 데이터로 확인)
- [ ] `../워크트리-분할.md` §1-D 의 할 일 (`프론트-이식-검토.md` §2 의 3 ~ 6 · §6)

## 바꾼 것

<!-- 나중에 CHANGELOG 항목이 된다. 버전 번호는 비워 둔다 -->

- **메인 헤더를 거의 투명한 유리로** (2026-09-16, 사용자 : "거의 투명 유리처럼 만들어서 뒷 색상이 잘 보이게 · 구분되어 있으면 안 될 것 같고"). `src/app/layouts/GlobalHeader.tsx` — 짙은 남색 판(60% → 45%) · 흐림 24px · 그림자 · 아래 상아색 실선을 걷고, before 층의 옅은 판(25%) + 흐림 4px 을 아래로 갈수록 0 으로 녹인다 (mask).
- **판 색 · 글자색 · 글자 그림자가 3D 하늘을 따른다** (사용자 : "밤 하늘이면 흰색으로 자연스럽게 돌아가게"). 밝은 하늘(낮 · 저녁) `glassLight` = 상아색 판 · 먹색 글자 · 상아색 그림자 / 밤 `glass` = 남색 판 · 상아색 글자 · 남색 그림자.
  엔진이 iframe 문서에 다는 `<html data-time>` 을 `ScentScene` 이 MutationObserver 로 지켜보고 `onNightChange` → `HomePage` 가 새 `src/shared/store/sceneSkyStore.ts` 에 적고 → `RootLayout` 이 tone 을 고른다. 기본값 dark (3D 가 뜨기 전 남색 바탕 · 화면을 떠나면 되돌린다).
  실측 (1920×1080 · 헤더 띠의 하늘을 엔진 렌더에서 읽어 계산) : 저녁 먹색 최저 6.4:1 · 옅은 글자(85%) 4.7:1 / 밤 상아색 7.4:1 · 옅은 글자 5.9:1.
  비교 — 예전(상아색 + 짙은 남색 판) 저녁 4.2:1 · 투명한 판에 상아색 그대로 1.7:1 · 먹색 + 남색 판 4.3:1 (남색 판은 먹색 글자 뒤를 어둡게 해서 판 색도 하늘을 따르게 했다).
  시간대 저녁 → 밤 → 저녁 전환에서 판 색 · 글자색 · 그림자가 따라 바뀌는 것을 확인 · `npm run verify` 통과 · 콘솔 에러 없음.
  ⚠ 통합할 때 `frontend/CLAUDE.md` '3D 향 지도 엔진' 절의 헤더 설명(*"짙은 남색 토큰 surface-night · 뒤 흐림"*)을 이 내용으로 고친다.
- **헤더 우측의 '오늘도, 좋은 향과 함께.' 문구와 세로 구분선을 뺐다** — 모든 화면 공통 (`GlobalHeader.tsx` · 2026-09-16, 사용자 : *"오늘도, 좋은 향과 함께 그리고 세로 구분선도 전체적으로 삭제"*). 잉크 묶음의 `rule` 필드도 같이 뺐다. 우측은 돋보기 · 계정(로그인)뿐이다.
- **엔진 개발 패널을 호스트 헤더 아래로** (A 메모의 요청). `perf.js`(계측 HUD) · `viewbar.js`(개발 바) · `tweaks.js`(파라미터)의 `top` 에 `var(--pb-host-top)` 을 더하고, tweaks 의 최대 높이에서 뺐다.
  dock(카메라 패널 · 원본 비교)은 bottom 기준이고 천장이 개발 바 아래라 따라온다. 단독 실행(hostTop 0)이면 예전 자리다.
  실측 (1920×1080 · hostTop 90) : HUD 위끝 12 → 102 · 개발 바 150 → 240 · 파라미터 8 → 98 (아래끝 1064) · dock 826 ~ 1068.
  ⚠ 이 패널 파일들은 분할 표에 주인이 없어 D 가 맡았다 — 개발 패널은 develop 에서 빠질 것들이다 (위 할 일).
- 확인 : `npm run verify` 통과 · 콘솔 에러 없음 · `/perfumes` 헤더도 문구 · 구분선이 없다.

## 새 불변식

<!-- 나중에 landing/CLAUDE.md 로 옮긴다 -->

- 앱의 메인 헤더도 시간대를 받는다 — 엔진 `<html data-time>` 값(dusk · night)이나 시간대 표(`CONFIG.times[].ui`)를 바꾸면 앱 `ScentScene` 의 밤 판정(`data-time === 'night'`)을 같이 본다 (불변식 25 의 소비자 목록에 앱 헤더를 더한다)

## PB 에 넣을 이름

## 다른 갈래에 요청

## 롤백

<!-- 파라미터를 0 으로 두면 예전 화면인지 -->

- 헤더 유리 · 하늘 따르기 : 파라미터가 없다 — `GlobalHeader.tsx` · `RootLayout.tsx` · `HomePage.tsx` · `ScentScene.tsx` 를 이 변경 전으로 되돌리고 `sceneSkyStore.ts` 를 지운다
