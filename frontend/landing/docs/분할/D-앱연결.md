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
- [x] 항해 일지 디자인 + API (A 메모의 요청) — 오른쪽 아래 엔진 미니맵(SCENT MAP)과 한 벌로 (2026-09-16 사용자 : *"하단 오른쪽 밑 향해 지도랑 통일성 있게"* — 처음 고른 '헤더와 같은 유리 톤'을 바꿨다) · 아래 '바꾼 것'
- [ ] 향해 일지가 쌓이게 — 배를 옮길 때 `PUT /api/v1/map/exploration/me` (향수를 고르면 perfumeId · 빈 바다면 지도 좌표 0~1). 엔진 `host.js` 로 이동을 알리는 문이 필요하다
- [ ] 실제 백엔드로 확인 — 이 PC 는 백엔드를 못 띄운다 (Docker 없음 · Java 8). 비로그인 안내(401) · 실제 일지는 서버가 있는 곳에서 본다
- [ ] `../워크트리-분할.md` §1-D 의 할 일 (`프론트-이식-검토.md` §2 의 3 ~ 6 · §6)

## 바꾼 것

<!-- 나중에 CHANGELOG 항목이 된다. 버전 번호는 비워 둔다 -->

✅ **2026-09-16 통합됨 → CHANGELOG v0.72.0** (아래 항목 전부 · 커밋 `5ae5e6b` ~ `9525a18`)

- **메인 헤더를 거의 투명한 유리로** (2026-09-16, 사용자 : "거의 투명 유리처럼 만들어서 뒷 색상이 잘 보이게 · 구분되어 있으면 안 될 것 같고"). `src/app/layouts/GlobalHeader.tsx` — 짙은 남색 판(60% → 45%) · 흐림 24px · 그림자 · 아래 상아색 실선을 걷고, before 층의 옅은 판(25%) + 흐림 4px 을 아래로 갈수록 0 으로 녹인다 (mask).
- **판 색 · 글자색 · 글자 그림자가 3D 하늘을 따른다** (사용자 : "밤 하늘이면 흰색으로 자연스럽게 돌아가게"). 밝은 하늘(낮 · 저녁) `glassLight` = 상아색 판 · 먹색 글자 · 상아색 그림자 / 밤 `glass` = 남색 판 · 상아색 글자 · 남색 그림자.
  엔진이 iframe 문서에 다는 `<html data-time>` 을 `ScentScene` 이 MutationObserver 로 지켜보고 `onNightChange` → `HomePage` 가 새 `src/shared/store/sceneSkyStore.ts` 에 적고 → `RootLayout` 이 tone 을 고른다. 기본값 dark (3D 가 뜨기 전 남색 바탕 · 화면을 떠나면 되돌린다).
  실측 (1920×1080 · 헤더 띠의 하늘을 엔진 렌더에서 읽어 계산) : 저녁 먹색 최저 6.4:1 · 옅은 글자(85%) 4.7:1 / 밤 상아색 7.4:1 · 옅은 글자 5.9:1.
  비교 — 예전(상아색 + 짙은 남색 판) 저녁 4.2:1 · 투명한 판에 상아색 그대로 1.7:1 · 먹색 + 남색 판 4.3:1 (남색 판은 먹색 글자 뒤를 어둡게 해서 판 색도 하늘을 따르게 했다).
  시간대 저녁 → 밤 → 저녁 전환에서 판 색 · 글자색 · 그림자가 따라 바뀌는 것을 확인 · `npm run verify` 통과 · 콘솔 에러 없음.
  ✅ `frontend/CLAUDE.md` '3D 향 지도 엔진' 절의 헤더 설명(*"짙은 남색 토큰 surface-night · 뒤 흐림"*)을 v0.72.0 통합 때 고쳤다.
- **헤더 우측의 '오늘도, 좋은 향과 함께.' 문구와 세로 구분선을 뺐다** — 모든 화면 공통 (`GlobalHeader.tsx` · 2026-09-16, 사용자 : *"오늘도, 좋은 향과 함께 그리고 세로 구분선도 전체적으로 삭제"*). 잉크 묶음의 `rule` 필드도 같이 뺐다. 우측은 돋보기 · 계정(로그인)뿐이다.
- **엔진 개발 패널을 호스트 헤더 아래로** (A 메모의 요청). `perf.js`(계측 HUD) · `viewbar.js`(개발 바) · `tweaks.js`(파라미터)의 `top` 에 `var(--pb-host-top)` 을 더하고, tweaks 의 최대 높이에서 뺐다.
  dock(카메라 패널 · 원본 비교)은 bottom 기준이고 천장이 개발 바 아래라 따라온다. 단독 실행(hostTop 0)이면 예전 자리다.
  실측 (1920×1080 · hostTop 90) : HUD 위끝 12 → 102 · 개발 바 150 → 240 · 파라미터 8 → 98 (아래끝 1064) · dock 826 ~ 1068.
  ⚠ 이 패널 파일들은 분할 표에 주인이 없어 D 가 맡았다 — 개발 패널은 develop 에서 빠질 것들이다 (위 할 일).
- 확인 : `npm run verify` 통과 · 콘솔 에러 없음 · `/perfumes` 헤더도 문구 · 구분선이 없다.
- **향해 일지를 엔진 미니맵(SCENT MAP)과 한 벌로 다시 그렸다** (`features/map/components/VoyageLog.tsx` · 2026-09-16, 사용자 : *"하단 오른쪽 밑 향해 지도랑 통일성 있게"*).
  같은 저녁 유리 판 — 미니맵의 `html[data-mini-eve]` 값을 앱 토큰으로 옮겼다 (`styles/index.css` : `--color-dusk` #2c263e · `--color-dusk-gold` #d9be86 · `--radius-glass` 9px · `--shadow-glass`).
  머리말도 같다 — 영문 제목 VOYAGE LOG (10px · 600 · 자간 0.2em) · 보조 글자 '진입 N' · 테두리 친 접기 단추. 자리는 헤더 아래 30 · 왼쪽 30 (미니맵은 오른쪽 아래 28).
  실측 (1920×1080, 앱 판 vs 엔진 미니맵 computed style) : 바탕 dusk 60% = rgba(44,38,62,0.6) · 흐림 6px = 6px · 반경 9px = 9px · 그림자 같음 · 제목 10px/600/2px 같음 · 테두리 상아색 15% vs 16%.
  읽기 : 비로그인(401) = 로그인 안내 · 불러오는 중 · 오류 · 빈 일지 한 줄 안내. 펼침은 누르기 전까지 가장 최근 진입 하나 (일지가 늦게 와도 열린 채로).
- **향해 일지 API 연결** — `api.ts` 의 `getVoyageLog` 가 `GET /api/v1/map/exploration-logs?size=20` 을 부른다 (백엔드 VoyageLogResponse 모양 — `types.ts` 의 VoyageLogEntry 에 scentRegionId 추가 · region 은 계열 아홉 `SCENT_FAMILIES`).
  개발 중 서버에 닿지 못하면(0 · 502~504) 대체 일지 — perfume 도메인의 `withDevFallback` 과 같은 규칙을 map 에 복사했다 (⚠ 두 번째 사용처 — 통합할 때 `shared/api` 로 올린다). 401 은 재시도하지 않는다 (`queries.ts`).
  확인 : 요청 502 → `[map]` 경고 · 대체 일지 3줄 · 줄 펼치기 / 판 접기 동작 · `npm run verify` 통과. ⚠ 실제 서버 응답 · 비로그인 안내는 아직 못 봤다.
  ⚠ 계열 여섯(`SCENT_REGIONS`)은 A06 배경의 SVG 자리표시자(ScentMap)만 남아 있다 — 호스트 타입을 아홉으로 합치는 것은 FE 팀 합의 항목.
- **향해 일지 다듬기** (2026-09-16, 사용자 : *"폰트 좀 더 키워주고 · 최대 5가지 목록 · 구역 말고 해역에 진입 · 어떤 향수 클릭했는지 다 열려 있어야 함 · 맨 앞 아이콘은 밑 방향 세모 작게"*).
  줄은 최근 다섯 (`types.ts` `VOYAGE_LOG_SIZE` — API 에도 size=5) · '○○ 해역 진입' · 들른 향수는 늘 펼쳐 둔다 (줄마다 접기를 뺐다 — 판 전체 접기는 남김) · 줄 앞 표시는 6×4px 아래 세모(dusk-gold).
  글자 : 해역 13px(text-body) · 향수 12px(text-caption) · 날짜 11px — 머리말(VOYAGE LOG · 진입 N)은 미니맵과 같은 10px 로 뒀다.
  진하기 : 판(dusk 60%) 뒤로 하늘이 비쳐 옅은 글자가 흐리다 — 실측 상아색 100% 최저 5.1:1 · 95% 4.8:1 · 90% 4.5:1 · 70% 3.4:1 → 향수 · 안내 95% · 날짜 90%.
- **향해 일지를 열고 닫는 움직임 · 머리말 · 글꼴** (2026-09-16, 사용자 : *"위에서부터 하나씩 창도 열리듯 내려가고 · ease 결로 부드럽게 · 글자도 거의 동시에 · 튀어나오면 안 됨 · 진입 3 빼고 · VOYAGE LOG 는 향해 일지로 · 글자체는 인풋(3D 검색창)에 있는 글자체"*).
  판 : grid-template-rows 0fr → 1fr 을 0.5초 · CSS ease 로 (내용 높이를 몰라도 위에서부터 내려 열린다) · 줄 : 위에서부터 한 줄씩 옅게 떠오른다 (80ms 뒤 시작 · 한 줄 50ms · 4px 만 내려옴 · 0.4초) · 닫을 때는 줄이 한꺼번에 0.2초에 사라지고 판이 접힌다 · 접기 표시 ▾ 는 같은 곡선으로 −90° 돈다 · 닫힌 판은 inert · 움직임 줄이기 설정이면 안 움직인다.
  처음 뜰 때 · 일지가 늦게 도착할 때도 같은 움직임이다 (한 번 숨긴 모양을 칠한 뒤 드러낸다).
  실측 (열기 : 판 높이 0 → 44 → 211 → 221px · 줄 불투명도 +370ms 에 0.98 · 0.93 · 0.85 · 0.72 · 0.51 · 0.24 · 0.03 · 0 로 위에서부터 차오름 / 닫기 +60ms 에 줄 0.69 · 판 191px → +760ms 에 0px).
  머리말은 한글 '향해 일지'(13px · 600) 한 줄 — 영문 VOYAGE LOG · 진입 수를 뺐다. 글꼴은 3D 검색창과 같은 Noto Serif KR (`font-serif`) — 앱은 이 글꼴을 600 · 700 만 받고 있어서 `frontend/index.html` 의 폰트 링크에 400 을 더했다 (공용 파일 · 한 줄).
- **헤더 로고 밑의 SCENT JOURNEY 를 모든 화면에서 뺐다** (`GlobalHeader.tsx` BrandMark · 2026-09-16 사용자). 잉크 묶음의 `muted` 필드도 같이 뺐다 (쓰는 곳이 없어졌다). 메인 · `/perfumes` 에서 확인.

## 새 불변식

<!-- 나중에 landing/CLAUDE.md 로 옮긴다 -->

✅ 2026-09-16 옮김 → `landing/CLAUDE.md` 불변식 23 (개발 패널 · hostTop) · 25 (앱 헤더가 시간대를 받는다)

- 앱의 메인 헤더도 시간대를 받는다 — 엔진 `<html data-time>` 값(dusk · night)이나 시간대 표(`CONFIG.times[].ui`)를 바꾸면 앱 `ScentScene` 의 밤 판정(`data-time === 'night'`)을 같이 본다 (불변식 25 의 소비자 목록에 앱 헤더를 더한다)

## PB 에 넣을 이름

## 다른 갈래에 요청

- **C** : 미니맵(SCENT MAP)의 저녁 유리 값(`index.html` `html[data-mini-eve]` 의 --pb-mini-bg · --pb-mini-accent · --pb-mini-shadow · 판 반경 9px)을 바꾸면 D 에 알린다 — 앱의 향해 일지가 같은 값을 토큰(dusk · dusk-gold · shadow-glass · radius-glass)으로 쓴다 (2026-09-16)

## 롤백

<!-- 파라미터를 0 으로 두면 예전 화면인지 -->

- 헤더 유리 · 하늘 따르기 : 파라미터가 없다 — `GlobalHeader.tsx` · `RootLayout.tsx` · `HomePage.tsx` · `ScentScene.tsx` 를 이 변경 전으로 되돌리고 `sceneSkyStore.ts` 를 지운다
