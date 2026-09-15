# 향을 찾는 종이배 — 로컬 프로토타입

흰 여백 위를 종이배 한 척이 떠간다. 하늘도 지평선도 없고, 물은 배경색(`#F6F5F2`)으로 흩어져 사라진다.
사용자는 향을 검색하거나 미니맵을 누르거나 직접 배를 몰아서, **향수 200개가 떠 있는 지도**의 아홉 향조 해역을 찾아간다
(2026-09-11 부터 — 웹 항해 게임처럼 : 흰 안개 이동 · 도착 연출 · 부표 옆 말풍선 · 지나온 바다만 밝은 미니맵).

> ⚠ 이 README 는 **구조와 함정**이다. 지금 상태·다음 할 일은 `docs/다음-세션.md`, 규칙은 `CLAUDE.md`, 버전별 실측은 `CHANGELOG.md`.

수면은 노이즈가 아니라 **실제 파동방정식을 GPU 핑퐁 렌더타깃으로 푼 결과**다. 등고선 그리드가 그 파를 타고,
배는 높이맵을 직접 읽어 실제 수면에 뜬다. 이 세 가지가 서로 같은 시각·같은 위상을 봐야 그림이 성립한다.

---

## 실행

```bash
npm install
npm run dev        # http://localhost:5173
```

```bash
npm run build      # dist/
npm run preview
```

`npm` 없이 그림만 확인하려면 `preview-nobuild.html` 을 브라우저로 열면 된다 (three.js 를 CDN 에서 가져온다).
개발은 `npm run dev` 로 한다.

---

## 파일

`src/` 는 **42개 모듈**이다 (2026-09-13). 무리별로 적는다.

| 무리 | 파일 | 담당 |
|---|---|---|
| 뼈대 | `index.html` | DOM 전체 — 검색바 · 존 정보 블록 · 말풍선 카드 · 미니맵 · 흰 안개 · DRIFT. 스타일은 **인라인**이고 자리·크기 숫자는 `var(--pb-…, px)` (반응형, 불변식 23) |
| | `src/main.js` | 씬·카메라(`cameraPose`)·렌더 루프, 항해 상태(`nav`) · 범위 막기, 모듈 조립, `PB` 핸들 |
| | `src/config.js` | 구조적인 수치 — 물리와 형태의 골격 · 향조 아홉(`families`) |
| | `src/params.js` | 런타임에 만지는 값 + 슬라이더 범위(`PARAM_RANGES`) |
| | `src/util.js` | lerp · clamp · wrapPi · half-float 디코드 · 수평선 위치(`horizonNDC`) |
| 물 | `src/sim.js` | 파동 시뮬 (핑퐁 RT, 파면 생성, 이류, 선체 grip, 부력 프로브) |
| | `src/swell.js` | 긴 주기 너울. **`BANDS` 표 하나에서 GLSL 과 CPU 사본을 함께 생성한다** |
| | `src/ocean-clock.js` | 배와 파도의 같은 시계 — 속도는 위상속도의 몇 배 (`PB.clock.report()`) |
| | `src/water.js` | **수면. 명암·오로라 분광·거리 LOD·반사 합성 — 화면에 물을 그리는 곳** |
| | `src/grid.js` · `src/spray.js` | 등고선 그리드(**기본 꺼짐**) · 물보라 |
| 빛·하늘 | `src/sky.js` · `src/stage.js` | 하늘 함수(`SKY` 표 — 물과 **같은 GLSL·같은 유니폼**) · 화면에 그리는 스카이 스피어 |
| | `src/reflect.js` · `src/submerged.js` | 평면 반사 패스(레이어 2 — 배·부표·타이포) · 물에 잠긴 선체 |
| | `src/bloom.js` | 전역 블룸(문턱 1.40) + **부표만 번지는 `GlowPass`**(레이어 3 원천 · 4 가림, 불변식 22) |
| | `src/times.js` | 시간대 표(`CONFIG.times`)를 받는 **한 곳**(`timeNow()`) — 하늘·물·조명·암석·타이포·DOM 글자색이 여기서 받는다. 기본은 저녁(`sceneTime 1`, v0.44.0 · 불변식 25) |
| 배 | `src/boat.js` · `src/paper.js` | GLB 세일보트 · 부력·자세 · 돛/선체 톤 · 코드로 굽는 종이 결 |
| 지도 | `src/perfumes-data.js` | CSV → **생성물** (손으로 안 고친다. `node scripts/perfumes-from-csv.mjs`) · 닮은 향수 `nb` 는 `data/scent_map.json` 의 neighbors (v0.62.0) |
| | `src/terrain-data.js` | 향 영역 아홉의 벡터 경계 · 해안선 — JSON → **생성물** (손으로 안 고친다. `node scripts/terrain-from-json.mjs`, 불변식 29) |
| | `src/scentmap.js` | 지도 → 월드 좌표 · 겹침 풀기 · 향조 대표 지점 · `regionAt` · **갈 수 있는 바다** — 향수마다 반경 `navReach` 인 원들의 합집합(`inNav` · `navOutline`, v0.45.0 · 불변식 21) |
| | `src/areas.js` | 지금 존 표(`areasNow` · `areaOf` · `findArea`) — 지도면 향조 아홉 |
| | `src/marks.js` | 향수 부표 — 배치 · 스스로 빛남 · 반투명 · 향수 고르기(12개) · 레이캐스트 |
| | `src/links.js` | 향수 고르기 12개의 유사 연결선 — **유사도 = 데이터 neighbors**(`focusLinkBasis`, v0.62.0 · 백엔드와 같은 목록) · 무리(`linkEdges()`)와 차이(`linkDiff()`)는 깊이 배치와 같이 쓴다 (불변식 27 · 30) |
| | `src/seamark.js` | 바다 누르기 표시 — 누른 자리의 고리 · 점으로 빨려 드는 네 줄기 (좁은 ∩ 길 위를 촉이 달리고 짧은 꼬리가 따른다 · 약 0.54초 한 번 · 시간대 색, v0.59.0) |
| | `src/zones.js` | 자동 조타 목표 · 방위각 · 도착 판정 (화면에는 아무것도 안 그린다) |
| | `src/travel.js` · `src/minimap.js` | 먼 곳 이동(흰 안개) · 미니맵(캔버스 — 안개 · 갈 수 없는 바다 한 색 `--pb-void` · 누르기) |
| | `src/chart.js` | 전체 화면 해도 — 미니맵 [확대] · **SVG** · 향 영역 · 누르면 그 해역으로 떠난다 (v0.48.0 · 불변식 28) |
| 연출 | `src/phase.js` | 연출 상태머신 — 중립 객체 `cue` 하나 (THREE 를 모른다) · 머묾(`hold`·`pauseHold`) |
| | `src/title.js` · `src/gate.js` | 수면 타이포(캔버스에 굽기 · 천장) · 좌우 암석 |
| | `src/ui.js` | DOM 참조 — 존 정보 블록 · 말풍선 자리(`placeScent`) · 경고(`warn`) · 이름표 · DRIFT |
| | `src/host.js` | 앱(호스트) 경계 — 카드의 [자세히 보기] · [진열대에 저장] · [주변 향 탐색] 이 나가는 문 하나 (`setHost` · `callHost` · 호스트가 없으면 경고 한 줄, v0.68.0) |
| | `src/input.js` | 키 / 클릭 · 드래그 구분(6px) / 휠 / 마우스 패럴랙스 |
| 개발 전용 | `src/perf.js` | 계측 HUD — GPU 시간·드로우콜·게이트 간격·LoAF |
| | `src/compare.js` | **원본 비교 패널.** ⭐ 새 작업을 시작할 때 **`BASELINES` 표에 한 줄을 먼저 적는다** (2026-09-13 마흔셋 묶음) |
| | `src/campanel.js` | 시점 패널. ⭐ `[화면만]`(또는 `H` · `PB.solo()`)이 개발 UI 를 통째로 숨긴다 — **측정·스크린샷 전에 쓴다** |
| | `src/tweaks.js` · `src/viewbar.js` | 슬라이더 패널 · 좌상단 조작 바(검증 보기 · 카메라 · 프레임 게이트 · 연출) |
| | `src/freecam.js` · `src/probes.js` | 자유 시점 · 부력 프로브 시각화 |
| | `src/framegrab.js` | 프레임 잡기 `PB.grab` — G 키로 걸고 다시 누르면 직전 프레임들을 한 장씩 넘겨 본다 (움찔거림 진단) |
| | `docs/` | 작업계획 · 다음-세션(인계) · 파도-물리 · 무대와-존-연출 · 롤백-지도 |

---

## 알아야 하는 규칙 3개

### 1. 카메라는 고정, 도는 것은 배뿐

카메라는 월드 원점 뒤에 붙어 있고 배는 항상 화면 가운데에 있다. 항해는 **물을 뒤로 흘려보내는 것**(이류)으로
표현된다. 그래서 `nav.scroll` 은 "배의 위치"이자 "월드가 흐른 양"이고, 두 뜻이 같은 값이다.
~~향 영역도 100 단위로 순환한다~~ — ⚠ 2026-09-11 부터 **향수 지도는 유한 좌표**다 (`scentmap.js`, 불변식 21).
토러스(100 단위 순환)는 예전 더미 32개(`markMap 0`)에서만 남아 있다. 갈 수 있는 바다는 **향수마다 반경 `navReach`(45) 인 원들의 합집합**이고(v0.45.0),
그 밖으로 나가는 **속도 성분만** 깎는다 — 배는 경계를 따라 미끄러지고 '범위 없음' 경고가 뜬다.

### 2. 물의 시각은 양자화되어 있다 (`sim.qT`, `sim.qScroll`)

물은 초당 `params.simFps` 번만 갱신되고, 배는 `boatFps` 번만 갱신된다 — **지금 기본은 30/30** (2026-09-08, 불변식 20.
그 전 12/8 은 개발 바의 비교용 스위치로 남았다). 게이트를 없애지 않는다 — 끊어 그리는 것 자체가 의도된 질감이다.
물의 형태를 만드는 모든 층 — 수면 · 그리드 · 물보라 · **배의 부력** — 은 실시간 `t` 가 아니라
마지막 갱신 시각 `sim.qT` 와 그때의 위치 `sim.qScroll` 을 봐야 한다.
하나라도 실시간을 보면 그 층만 60fps 로 미끄러지고, 부력이 어긋나면 배가 물에 잠기거나 공중에 뜬다.

예외는 **빛**이다. `uTime`(실시간)을 쓰는 것은 분광과 반짝임뿐이다 — 형태는 멈춰도 빛은 계속 흐른다.

### 3. 너울의 대역은 `BANDS` 표에만 적는다

`src/swell.js` 의 `SWELL`(GPU : `swellH` / `swellG` / `swellD`)과 `swellCPU`(부력)는
**같은 `BANDS` 배열에서 생성된다.** 파를 하나 더하려면 그 표에 한 줄만 넣으면 되고,
GPU 와 CPU 가 갈라질 방법이 없다. 셰이더 문자열에 항을 직접 적지 않는다.

⚠ 하나의 의도된 비대칭이 있다. Gerstner(`params.gerstner`)를 켜면 GPU 는 매개변수 `p` 의 정점을
월드 `p + D(p)` 에 놓는데, 배는 반대로 "월드 `X` 에서의 수면 높이"를 물어야 한다.
그래서 `swellCPU` 는 뉴턴 한 걸음(`p ≈ X − D(X)`)으로 역을 푼다. 이걸 빼면 배가 파도와 어긋나 뜬다.

---

## 어디를 만지면 무엇이 바뀌는가

| 하고 싶은 것 | 파일 · 위치 |
|---|---|
| 마루를 뾰족하게 (융기) | `params.gerstner` (0 = 순수 sin·둥근 마루, 1.2 = 기본, 3 이상은 격자 왜곡으로 보인다). 진폭을 안 올리고 융기를 만드는 길이다 |
| 빛의 세기 / 방향 | `params.lightAmount`, `params.reflect`. 방향은 `main.js` 의 `dirLight.position` — 배와 물이 같은 벡터를 본다 |
| 파도 높이 / 속도 | `params.oceanSwell`(높이) · `params.waveSpeed`(전 대역 각속도 배율, 0.55 기본) |
| 파도를 크게 / 사납게 | `config.js` `sim.height` (기하 변위), `params.swell` (파면 진폭), `params.oceanSwell` (너울). `sim.c` 는 건드리지 않는다 |
| 파도의 결·방향 | `sim.js` 파면 생성 블록 — `seaDir`, `ambSpread`, `crossAngle`, `crossMix` |
| 일렁임 (잔물결) | `params.ripple` + `swell.js` 의 `BANDS` 표 (group: ripple 인 4개) |
| 물의 색·명암 | `config.js` `color` 의 5색(bg / waterBase / waterMid / waterTrough / transmission). **배경만 따뜻하고 물은 전부 차갑다** — 둘 다 따뜻하면 크림·도자기가 된다. 세기는 `params.waterShade` |
| 물속 / 수영장 바닥 | `params.floorAmount` · `floorScale` · `refract`. refract 가 작으면 기계적 격자로 읽힌다 — 한 칸 이상 밀려야 물을 통해 보이는 바닥이 된다 |
| 능선 오로라 | `params.iriWater`. 색은 `config.js` 의 crestViolet / crestBlue / crestApex 셋뿐이다. 구동축은 경사가 아니라 **정규화된 파도 높이** — 경사로 몰면 화면 전체가 기름막이 된다 |
| 원경 디테일 / 부하 | `config.js` `surface.detail0/detail1`. 이 구간에서 잔물결 대역과 오로라만 꺼진다. 저주파 너울은 안 줄인다 |
| 빛 / 반짝임 / 분광 (선) | `grid.js` `GRID_FRAG` 후반부 — `lit`, `uIriA/uIriB`, `drift`, glint 해시. `spray.js`·`water.js` 가 **글자 그대로 같은 식**을 쓴다. 한쪽만 고치면 하나의 현상이라는 전제가 깨진다 |
| 반사 | ⚠ 낡은 줄 — 지금은 **평면 반사 패스**가 있다 (`reflect.js`, 레이어 2 에 등록한 배·부표·타이포만 찍는다. `boatReflect` · `titleReflect`). `Reflector` / 씬 전체 재렌더는 여전히 안 쓴다 (CLAUDE.md '하지 않는 것') |
| 선의 밀도 / 명암 | `params.lineOpacity`, `lineContrast`, `crest`, `trailEmphasis`. LOD 3단은 `config.js` `gridLods` |
| 종이배를 GLB 로 교체 | `boat.js` `createBoatMesh()` **이 함수 내부만** 바꾸면 된다. 나머지는 Group 하나만 본다 |
| 향조 · 존 (지도) | `config.js` `families` (아홉 — 색 · 타이포 색 · 설명 · 노트 · 검색 키워드). 존을 읽는 곳은 전부 `areas.js` 로 받는다. 예전 넷(`areas`)은 `markMap 0` 에서만 |
| 향수 좌표 · 지도 크기 · 갈 수 있는 끝 | `data/perfume_map_points.csv` → 생성기 → `scentmap.js` (`mapSize 320` · 갈 수 있는 바다 `navReach 45`) |
| 향수 부표 모양 · 빛 | `marks.js` (몸통 `patchSelfLit`) + `bloom.js` `GlowPass` — 값은 `params.js` 의 `markSelfLit` 묶음 · `markBloom*` |
| 부표 클릭 · 카드 | `main.js` `onPick` → `marks.select` / `startFocus` → `ui.showScent` · `placeScent` (말풍선) |
| 부표 누르기 · 겹침 | `marks.js` `pick` (커서가 올라간 몸통 → 가장자리가 가장 가까운 것) · `update` 의 히트박스 크기 (`markHitFit` · `markHitK` · `markHitMinPx`) |
| 향수 고르기 12개의 자리 — 화면 안 · 겹침 · 좌우 간격 | `main.js` `focusDepthPlace` (깊이 배치 · 불변식 30) · `focusDepthFit` (몸통 + 이름표 상자로 화면 안 · 겹침 벌점, v0.63.0) · `focusDepthMargin` · `focusDepthSpread` · 검사 `PB.focusPlan()` (px · py · r) |
| 저녁 카드 · 저녁 미니맵 색 | `index.html` 의 `html[data-card-eve]` · `html[data-mini-eve]` 토큰 (`--pb-card-*` · `--pb-mini-*` · 캔버스 `--pb-mini-c-*`) — `main.js` `applyUiEve` 가 속성을 단다 |
| 카드 이미지 자리 · 카드 진하기 | `index.html` `#scent-img-slot` (높이 `--pb-card-img-h` 반응형 · 켜기 `<html data-card-img>` ← `cardImg`) · 그림 주소 = 향수 데이터 `img` → marks.js `m.img` → ui.js `showScent` · 바탕 불투명도 `cardGlassA` (→ `--pb-card-a`, v0.65.0 부터 0.86) |
| 호버 카드가 틈에서 안 끊기게 | `main.js` `updateHover` (`cardHoverBridge` · `cardHoverGrace`) · 판정 상자 `ui.js` `scentCardHit` · `scentZoneHit` · 마우스 자리 `input.state.px · py` · 카드 위면 통과를 끈다 (틱의 `setScentPeek`) |
| 카드의 서비스 동작 · 검색창 (앱으로 나가는 문) | `src/host.js` (`setHost` · `callHost` · `perfumeRef` · 검색창 `hostSearch`) · 단추 `index.html` `#scent-actions` (켜기 `<html data-card-actions>` ← `cardActions`) · 누르면 `main.js` `cardAction` · 앱 창 동안 입력 잠금 `holdWhile` → `input.setHold` · [주변 향 탐색] = `exploreAround` (앞 12개는 제자리에서 잠김 — marks.js `focusOn` 의 `prev`) |
| 사이트 헤더 자리 (1차 시안) | `index.html` `#site-header` (자리표시 그림) · `#stage` 높이 `calc(--pb-stage-h − --pb-header-h)` · 켜기 `<html data-site-header>` ← `siteHeader` (`main.js` `applyUiEve`) |
| 존 정보 블록 자리 · 연출 중 미니맵 | `index.html` 의 `:root[data-info-center]` (자리 변수만) · `main.js` tick 의 `zoneMiniHide` (opacity · pointer-events) · 검색창 · 정보 블록 내림 `--pb-search-drop` (`searchDrop`, v0.67.0) · 설명 글자 배율 `--pb-info-desc-k` (`infoDescK`) |
| 경고 토스트 ('범위 없음') | `ui.js` `warn` (인라인은 `var(--pb-warn-…, 예전 값)`) · 색 · 모양은 `index.html` 의 `html[data-warn-eve]` · z-index 45 (해도 40 위) · 자리 = `--pb-warn-top`(반응형) + `--pb-warn-drop`(`warnDrop`) |
| 빈 바다 누르기 (Shift 없이도) | `main.js` `onPick` → `seaGo` (수면 평면 투영 → `zones.goTo({ custom, sea, boost, arrive })`) · 그냥 누름 `seaClickGo` · Shift 누름 `seaShiftGo` (`input.js` 가 `onPick` 에 이벤트를 넘긴다 — `e.shiftKey`) · 도착 반경 `seaGoArrive` (선회 반경 × 1.3 아래로 안 내린다) · 연출 중이면 다 걷힌 뒤 출발 (`pendingSea` · `seaGoAfterZone`) |
| 부표 누르기 · 가속 키 | `main.js` `pickSail` (가속을 끄고 누른 향수 곁으로 · `focusCamStill` 연출 동안 카메라가 속도를 안 탄다) · 연출 중 빈 곳 = 연출만 끝 (`focusSeaEnds`) · ESC · 스페이스 가속 ↔ 일반 (`sailBoostKey` · 97% / 3% 잠금 · `SAIL_NORMAL` 0.72) |
| 누른 자리 화살표 | `src/seamark.js` (과녁 = 수면에 누운 판 · 꼬리 넷 = 카메라를 보는 띠 한 메시 · 촉 넷 · 캔버스 그림 셋) · 띄우기는 `main.js` `seaGo` 의 `seamark.show` · 색은 `CONFIG.times[].seaMark` (낮은 모듈의 짙은 금빛) · 값 `seaMark*` (원근 `seaMarkPersp` · 고리 퍼짐 `seaMarkRipple` · 빠르기 `seaMarkSpeed` · 길 높이 `seaMarkArc` · 꼬리 `seaMarkTrail` · 굵기 `seaMarkWidth` · 대각선 `seaMarkDiag`) · 한 장면 멈춰 보기 `PB.seamark.pin(0.5)` |
| 흰 거품 — 두 겹 · 파란 띠 밑 · 군집 | `water.js` 흰 거품 블록 (탄생은 `sim.js` `br` 그대로) · 파란 띠 밑 `foamUnder` · 띠 자리 `foamStripAt/W` (마루선 블록의 halo · faceL · tallL 복제 — 같이 고친다, 불변식 13-2) · 앞뒤 기억 조회 `foamReach` · 군집 `foamPatch*` · 은은함 `foamUnderA` · 오로라 비키기 `lineYield` · 탄생 쪽 무리 `foamClump`(기본 끔) · 검증 보기 14 '겹침' · 15 '무리' · 비교 패널 '거품 파란 띠 밑' · '흰 거품 두 겹' · '거품 무리' · '거품 단면' |
| 먼 곳 이동 · 미니맵 · 해도 | `travel.js` (lead → 흰 안개 → 목표 앞) · `minimap.js` (안개 · 갈 수 없는 바다 한 색) · `chart.js` (전체 화면 해도, SVG) · 연출 중이면 다 걷힌 뒤 출발 (`startTravel` 의 `pendingTravel` · `travelAfterZone`) |
| 도착 연출 | `phase.js` 의 `TL` 표 (진입 2.00s · 퇴장 1.90s) · 머묾 `zoneHold` · 호버 `zoneHoldHover` |
| 검색 로직 | `areas.js` `findArea()` — 키·이름이 같거나 검색어에 키워드(`kw`)가 들어 있으면 그 존 → `goRegion` (먼 곳 이동과 같은 길) |

### 값 튜닝

브라우저 콘솔에서 바로 만질 수 있다.

```js
PB.params.lineOpacity = 0.4;
PB.params.crest = 2.4;
PB.apply();          // 재질·색·가시성 값은 apply() 가 필요하다
PB.params.oceanSwell = 0.3;   // 매 프레임 밀리는 값은 apply() 없이 바로 반영된다
```

`PB` 에는 `sim / water / grids / spray / boat / zones / marks / links / phase / title / gate / travel / minimap / chart / bloom / reflect / scene / cam / renderer / nav` 가
다 들어 있고, `PB.dispose()`(전체 정리) · `PB.onResize(fn)`(리사이즈 훅 등록) · `PB.perf`(계측 HUD) · `PB.solo(true)`(개발 UI 숨기기) ·
`PB.layout()`(반응형 검산) · `PB.goRegion('WOODY')` · `PB.focusPlan()`(향수 고르기 배치 검사) · `PB.grab`(프레임 잡기) · `PB.clock.report()` · `PB.scentMap.report()` 도 같이 있다.
`params.js` 의 `PARAM_RANGES` 는 슬라이더 패널(`tweaks.js`, 개발 빌드 우측)이 쓰는 범위표다 — 새 값을 넣으면 **둘 다** 채운다.

### 계측 HUD

`npm run dev` 로 띄우면 좌상단에 계측 패널이 뜬다. 프로덕션 빌드에서는 트리셰이킹으로 통째로 사라진다.

```
GPU  2.5ms                  ← EXT_disjoint_timer_query_webgl2. 없는 브라우저면 '(미지원)'
rAF  p50 9.2  p95 14.1ms
draw 13  prog 7  tex 2      ← 기준선. 늘어나면 그만큼 예산을 쓴 것
tri  131126  line 64720
물   83.3ms   배 125.0ms    ← 프레임 게이트. 둘이 같아지면 게이트가 깨진 것이다
LoAF 0ms                    ← 렌더 루프가 입력을 막은 시간
```

**⚠ 창이 화면에 안 보이면 시간 기반 값은 전부 거짓이다.** 브라우저가 rAF 를 아예 안 돌리기 때문에
`GPU / rAF / 물 / 배` 가 수천 ms 로 뜬다. 판정하려면 창을 실제로 띄워 두고 봐야 한다.
드로우콜·정점 수는 이 영향을 받지 않는다.

### 측정치 회수 — `?perf`

HUD 를 눈으로 읽을 수 없을 때(자동화된 브라우저, 원격 세션) 쓴다.

```
http://localhost:5173/?perf
```

`?perf` 가 붙으면 페이지가 5초마다 자기 측정치를 개발 서버 `/__perf` 로 POST 하고,
`perf-report.json` 에 덮어쓴다. 붙이지 않으면 아무것도 안 보낸다. 이 파일은 gitignore 된다.
회수 경로는 `vite.config.js` 의 `perfReport()` 플러그인이고 `apply: 'serve'` 라 빌드에는 안 낀다.

리포트에는 **그 측정을 믿어도 되는지 판정할 재료**가 같이 실린다 — `표본.평균fps` 가 55 아래면
rAF 가 제대로 안 돈 것이고, `창.숨은프레임` 이 0 이 아니면 중간에 창이 가려진 것이다.

---

## 손대면 깨지는 것들

- **`sim.c ≥ 0.5` → 발산.** 화면이 하얗게 날아간다.
- **`sim.step` 을 키우면** 스텝당 감쇠가 초당 감쇠를 약화시켜 누적 발산한다. 느리게 하려면 `simFps` 를 내린다.
- **이류는 정수 텍셀 단위로만.** 소수로 밀면 매 스텝 바이리니어 보간이 걸려 잔물결이 전부 뭉개진다 (`sim.js` 의 `acc`).
- **흡수층은 uv 0.29 부터** 진폭을 깎는다. 파면을 그 밖에서 낳으면 태어나자마자 먹힌다 (`ambEdge: 0.28` 의 이유).
- **선체는 파를 더하지 않고 붙잡는다** (`bowGrip`). 더하기로 바꾸면 누적 발산한다.
- **`atan(y, x)` 는 두 인자가 0 이면 GLSL 에서 미정의.** 정지한 원경은 `vGrad` 가 정확히 0 이다. `+ 1e-6` 가드를 지우면 격자가 검게 오염될 수 있다.
- **그리드의 너울 항은 감쇠하지 않는다.** 감쇠시키면 그리드가 너울 아래로 깔려 수면 메시에 가려진다.
- **그리드 알파의 `sqrt`** 는 LOD 겹침 구간에서 밀도를 일정하게 유지하는 보정이다. 지우면 링 경계가 보인다.

---

## 원본과 달라진 점

이 폴더는 프로토타입(`향을 찾는 종이배.dc.html`, 단일 파일 807줄)을 옮긴 것이다. 물리·셰이더·수치는 그대로다.

- React / 컴포넌트 런타임 의존을 제거했다. 순수 three.js + ES 모듈.
- `this.props.x ?? CONFIG.y` 패턴을 `params.js` 로 합쳤다. Tweaks 패널의 25개 값이 그대로 대응한다.
- `ref` → `document.getElementById` (`ui.js`).
- 기능별로 12개 모듈로 쪼갰다. 렌더 루프와 항해 상태만 `main.js` 에 남아 있다. (그 뒤로 늘어 지금은 42개 — 위 '파일' 표)
- three.js 는 CDN 동적 import 대신 npm 의존(0.160.1 고정)이다.

---

## 레포에 넣기

이 폴더는 `moonmung/custompjt` 의 하위 폴더로 들어가도록 만들었다.

```bash
cd custompjt
cp -R ~/Downloads/paperboat ./paperboat
cd paperboat && npm install && npm run dev
```

`node_modules/`, `dist/` 는 `paperboat/.gitignore` 가 이미 막아 둔다.
