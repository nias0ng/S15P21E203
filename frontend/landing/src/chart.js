import { PARAMS as P } from './params.js';
import { BAND as MINI_BAND } from './minimap.js';
import { areasNow } from './areas.js';
import { TERRAIN } from './terrain-data.js';
// 격자 → 부드러운 닫힌 고리 (안개 윤곽 · scentmap.navLoops 와 **같은 함수**다)
import { traceGrid } from './util.js';

// ───────── 전체 화면 해도 (2026-09-12 저녁, v0.48.0) ─────────
// 미니맵 머리말의 [확대] 를 누르면 열리는 **화면 가득한 지도**다. 사용자 : *"미니맵 확대 버전도
//   만들어야함"* → *"전체 화면 해도 선택 지도"* — 향조·향수 이름이 다 보이고 누르면 그 해역으로
//   떠난다 (docs/UI-디자인-개정.md §3-4). 미니맵이 '지금 어디인가' 라면 해도는 '어디로 갈까' 다.
//
// ⚠⚠⚠ **캔버스가 아니라 SVG 다.** 미니맵(minimap.js)은 층마다 비트맵을 구워 `drawImage` 로 합성한다
//   (v0.49.0 까지는 정적 층 · 안개 · 마스크 · 빗금 · 끝선 다섯). 214px 판에서는 그게 제일 싸지만 전체 화면에서는 뒤집힌다 :
//     · 층당 1920×1080×dpr² 비트맵 — dpr 2 면 **한 장 33MB**, 다섯 층이면 100MB 대다
//     · 구운 그림은 확대하면 **뭉갠다** — 해도는 확대해서 읽는 물건이다
//     · 값이 하나 바뀔 때마다 층을 통째로 다시 굽는다 (전체 화면에서는 그 비용이 프레임을 먹는다)
//   SVG 는 점·선·글자가 배율과 무관하게 또렷하고, 확대·이동이 `transform` 한 줄이며,
//   바뀐 것만 속성으로 고친다. 사용자 : *"SVG 나 새롭게 더 가볍게 제작할 수 있는 방향"*.
//
// ⚠⚠⚠ **이 해도에는 비트맵이 하나도 없다** (2026-09-13, v0.50.0). v0.48.0 ~ v0.49.0 에서는 격자인 두 층
//   (갈 수 있는 바다 132×110 · 안개 116×102)을 작은 그림으로 두고 `<mask>` 안에서 늘려 흐렸는데,
//   **6배 확대에서 칸이 45~58px 이 되어 흐린 계단**으로 보였다 (사용자 화면 : *"SVG 면 이렇게 blur 처리
//   되듯이 되면 안될텐데"*). 지금은 :
//     · 갈 수 있는 바다 = `scentmap.navLoops()` 의 **부드러운 고리** — 면과 끝선이 같은 경로다 (2026-09-18).
//       ⚠ v0.50.0 ~ 2026-09-17 은 원 200개의 합집합과 그 정확한 바깥 호였다. 반지름이 같은 원들이라
//         만나는 자리마다 오목한 뾰족점이 생겨 테두리가 물결쳤다 — 사용자가 본 '구름' 이다 (호 50개).
//       ⚠⚠ **미니맵도 같은 고리를 긋는다** (불변식 21 · 28) — 한쪽만 고치면 같은 바다가 두 모양이 된다.
//     · 안개 = 격자를 **마칭 스퀘어로 잇고 Chaikin 세 번**으로 둥글린 윤곽 (같은 `traceGrid`)
//   ⚠ 갈 수 없는 바다는 빗금이 아니라 **`--pb-void` 한 색**이다 (미니맵과 같은 토큰 — 연관성).
//
// ⚠ 좌표는 scentmap 월드 그대로다 (불변식 21). 화면 px 로 옮기는 식은 `sx/sy` 하나, 그 역이 `toW` 이고
//   바다 층의 SVG transform 도 **같은 값에서** 나온다 — 변환식을 두 곳에 적지 않는다.
// ⚠ 색은 `index.html` 의 `:root` 에서 읽는다 (minimap.js 의 `PAL` 과 같은 규율 — 불변식 2).
// ⚠⚠ 안개 기록의 **주인은 미니맵이다** (localStorage · 배가 지나갈 때 밝히기). 여기서는 `minimap.fogMask()`
//   로 읽기만 한다 — 같은 격자를 두 곳에서 쓰면 갈라진다.
// ⚠ 글자는 판 위에 앉으므로 `--pb-on-surface` 다 (`--pb-ink` 가 아니다 — 불변식 25).
//
// ⭐⭐⭐ 2026-09-12 저녁 (v0.49.0) — **향 영역이 데이터에서 온다** (`terrain-data.js`).
//   사용자가 지형 JSON 두 개를 주며 : *"향 영역이 첨부 파일처럼 구성이 될텐데 최대한 참고해서 현재
//   컨셉과 어울어지게"*. 아홉 향조의 영역 경계가 **이미 벡터 폴리곤**으로 들어 있다 (밀도 격자에서
//   뽑은 것). 격자 계단은 생성기가 다듬는다 (`scripts/terrain-from-json.mjs`).
//   ⚠ 색은 `CONFIG.families` 에서 받는다 (부표·점과 같은 색이라야 3D 에서 본 향조와 이어진다, 불변식 2).
//   ⚠ 향수 200개 중 **48개(24%)는 자기 향조 영역 밖에 있다** (원본 데이터의 성질이다 — 영역은
//     보로노이가 아니라 밀도 덩어리다). 점 색과 영역 색이 다른 자리는 버그가 아니다.
//   ⚠⚠ 2026-09-18 **뒤집혔다** — 영역마다 옅은 경계선을 두른다 (`gTerrEdge`). 여기 있던 *"선으로 두르지
//     않는다"* 는 색만으로 갈린다는 전제였는데, 사용자 판정은 *"향조 영역끼리의 경계"* 도 뭉개져 보인다였다.
//     맞닿은 변이 두 번 칠해지는 것은 그대로라 **평소 짙기를 0.4 로 묶어 둔다** (겹치면 0.64) — 올리면 티가 난다.
//     범례에 마우스를 올린 하나만 제 색으로 또렷해진다 (그때는 한 겹뿐이라 겹침이 없다).
//
// ⭐⭐ **이름은 지나온 바다에서만 적는다** (`chartNames` 1). 사용자 : *"내가 탐색한 이름만 노출"*.
//   안개 격자(미니맵이 주인)를 그대로 판정에 쓴다 — 영역과 점은 전부 보이고 **이름만** 가린다
//   (2026-09-11 의 *"어떤 영역, 어떤 향수 위치는 전부 보이게"* 를 깨지 않는다).

const NS = 'http://www.w3.org/2000/svg';
const svgEl = (n, a) => {
  const e = document.createElementNS(NS, n);
  if (a) for (const k in a) e.setAttribute(k, a[k]);
  return e;
};

const PADS = 10;          // 지도와 판 사이 여백 (px)
const SNAP = 15;          // 향수 점을 '눌렀다' 로 볼 반경 (px)
const LABEL_R = 20;       // 향조 이름을 '눌렀다' 로 볼 반경 (px)
// 최대 배율. 6 은 *"가장 몰린 곳에서 이름이 다 펴지는 값"* 이었는데 **2026-09-20 에 4 로 내렸다**
// (사용자 : *"6배까지 크게 할필요없고 4배까지 하면 되고"*). 그만큼 이름 몇 개가 겹쳐 안 뜨는 것은
// 받아들인 것이다 — 확대는 읽기가 아니라 '어디쯤인가' 를 보는 일이라는 판정.
const K_MAX = 4;
const NAME_CAP = 200;     // 이름은 많아도 향수 수만큼이다
// 마스크를 흐리는 정도 (**화면 px** — syncZoom 이 배율로 나눈다).
// 갈 수 있는 바다의 끝은 적당히, 안개는 **크게** — 격자 윤곽의 구불거림을 덩어리로 뭉갠다
/*
 * ⚠⚠ **바다의 끝과 안개는 다른 것이다 — 같은 번짐으로 다루지 않는다** (2026-09-20 사용자 :
 *   *"전부다 블러를 사용하는게 아니라 맵 외곽은 닫겨있어야지"* · *"나갈 수 없는 범위까지 블러 말고
 *   뭔가 정말 영토를 표현한듯 울퉁 불퉁한 그런거였으면"*).
 *     · **바다의 끝** = 닫힌 해안선이다. 흐리지 않고 **울퉁불퉁하게** 만든다 (feTurbulence + 변위).
 *       그 안쪽에 그림자 한 겹을 둘러 '여기서 막힌다' 를 말한다 (사용자 : *"그림자 표현은 좋았다"*).
 *     · **안개** = 격자를 딴 윤곽이라 원래 구불거린다. 여기만 흐려서 동그란 덩어리로 만든다.
 */
// 해안선의 울퉁불퉁함. ⚠ **배율로 안 나눈다** — 이 굴곡은 지도에 붙은 것이라 확대하면 같이 커지는 게 맞다
//   (실제 해안선이 그렇다). 잦기가 낮을수록 큰 만(灣), `AMP` 가 클수록 깊게 파인다
const COAST_FREQ = 0.012, COAST_AMP = 9, COAST_SEED = 11;
// 바다 끝 안쪽으로 드리우는 그림자 (**화면 px** — syncZoom 이 배율로 나눈다)
const NAV_SHADE_W = 16, NAV_SHADE_BLUR = 5;
/*
 * ⭐⭐⭐ **등심선 = 같은 해안선을 굵기만 키워 덧그은 것** (2026-09-21 사용자 : *"진한쪽이 안으로 들어오고
 *   바깥으로 나갈때 조금 옅어지자 · 더 촘촘하게 · 지도 모양을 유지하면서"*).
 *
 *   ⚠⚠⚠ **여기가 방식이 통째로 바뀐 자리다.** 2026-09-20 ~ 09-21 의 띠는
 *     *부풀림(feMorphology) → 흐림(feGaussianBlur σ 72) → 계단으로 자르기(feComponentTransfer)* 였다.
 *     비탈을 만드는 것이 **흐림**인데, 흐림은 곧 **해안선 굴곡을 지우는 연산**이다 — 그래서 띠가 멀어질수록
 *     동심원으로 뭉개졌다. 사용자가 짚은 *"지도 모양을 유지하면서"* 가 이것이고, 흐림을 쓰는 한 못 고친다.
 *
 *   ⭐ 대신 **스트로크**를 쓴다. 굵기 `2r` 짜리 스트로크는 그 경로의 **정확한 오프셋**이다 (경로에서 r 안,
 *     r 밖). 그래서 만(灣)도 곶도 모양 그대로 따라간다 — SVG 에 없는 '경로 오프셋' 의 진짜 대체다.
 *     고리 `RING_N` 개를 **큰 것부터** 깔면 해안 쪽이 겹겹이 쌓여 짙어지고 바깥은 한 겹만 남아 옅어진다.
 *     안쪽 절반은 `pbc-out` 이 잘라 낸다 (아래 gBands).
 *
 *   | | 값 | 뜻 |
 *   |---|---|---|
 *   | `RING_W` | 10 | 고리 하나의 폭 (**화면 px** — `syncZoom` 이 배율로 나눈다) |
 *   | `RING_N` | 12 | 고리 수. 해안에서 `W × N` = 120px 까지 뻗는다 |
 *   | `RING_IN` | 0.70 | **해안 쪽** 끝의 짙기 (void-deep 을 이만큼 얹은 값) |
 *   | `RING_OUT` | 0.14 | **바깥** 끝의 짙기 — 여기서 0 으로 끊기지 않게 낮게 둔다 |
 *
 *   ⚠ 촘촘하게 하려면 `RING_W` 를 줄이고 `RING_N` 을 같이 올린다 (뻗는 거리 = W × N 이라 한쪽만
 *     줄이면 등심선이 해안에 붙어 버린다).
 *   ⚠ `RING_N` 은 곧 **경로 수**다 — 늘리면 그리는 비용이 선형으로 는다. 20 을 넘기지 않는다.
 */
const RING_W = 10, RING_N = 12, RING_IN = 0.70, RING_OUT = 0.14;
// 등심선의 색 — `--pb-void` 를 이만큼 **어둡게만** 한다 (`RING_COL` 머리말 : 색상 · 채도는 안 건드린다)
const RING_SHADE = 0.62;
/*
 * ⭐⭐ **갈 수 있는 바다를 띠의 바깥 끝 색으로 칠한다** (2026-09-21 사용자 : *"등심선 안쪽 흰색 배가
 *   지나다닐 수 있는 곳을 등심선 맨 가장자리 색상으로 변경하고 그 색상 채도 명도에 맞게 색상 영역을
 *   더 진하게"*). 여태는 **판의 아이보리 바탕**(`--pb-chart-bg`)이 그대로 비치고 물빛이 0.12 만
 *   얹혀 있었다 — 그게 그 '흰색' 이다.
 *
 *   색을 새로 적지 않는다 — `--pb-void` 위에 `--pb-void-deep` 가 이만큼 덮인 값 = **#21282F**.
 *   ⚠ 2026-09-21 등심선을 스트로크로 바꾸면서 **이 값은 홀로 선다** — 예전에는 띠의 짙기(`BAND_A`)와
 *     같은 상수를 나눠 썼지만 지금 고리의 짙기는 `RING_IN` · `RING_OUT` 이다. 바다 색만 정한다.
 *   ⭐ 문서 §2 실측표의 *"그 밖 L39"* 와 같은 값이다 (0.2126·33 + 0.7152·40 + 0.0722·47 = 39.0).
 *   토큰을 손보면 바다도 같이 따라온다 (불변식 2 — 색의 단일 출처).
 *
 *   ⚠ **0 으로 두면 여울(첫 띠, 가장 밝은 계단) 색이 된다 — 그 쪽은 해안선이 사라진다.**
 *     안과 첫 띠가 같은 색이 되어 경계가 없어진다. 뒤집어 볼 때만 쓴다.
 *   ⚠ 미니맵은 이 값을 안 쓴다 — 거기는 판(`--pb-mini-bg`)이 이미 어두운 유리라 항행 바다를
 *     **뚫어서** 낸다 (minimap.js 의 destination-out). 이번 변경이 둘을 오히려 가깝게 한다.
 */
const NAV_SEA_MIX = 0.55;
/*
 * ⭐ 향 영역 아홉의 짙기 — **바탕이 어두워졌으니 같이 올린다** (위 NAV_SEA_MIX 와 한 벌이다).
 *   아이보리 위에서는 0.34 / 0.30 으로 충분했지만 #21282F 위에서는 그대로 두면 아홉이 다 가라앉는다.
 *   DESAT 은 '어디나 깔리는 겹' 에서 빼는 채도다 — ⚠ 많이 빼면 등휘도라 아홉이 한 회색으로 뭉친다
 *   (불변식 29-2). 그래서 0.3 → 0.18 로 **덜** 뺀다.
 */
const TERR_A = 0.52, TERR_LIT_A = 0.44, TERR_DESAT = 0.18;
/*
 * ⭐⭐ **평소에도 불이 꺼져 있다** (2026-09-21 사용자 : *"향조 영역이 … 불이 꺼져있게 · 마우스를 올렸을때
 *   다른 지역들이 어두워지는 느낌을 평소 느낌으로하고 현재 마우스를 올렸을때의 상태를 더 검게"*).
 *
 *   여태 어둠은 **호버 때만** 켜졌다 (`rFamDim` — 고른 해역만 빼고 덮는 겹). 이제 그 정도를 **평소**로
 *   내리고(`TERR_DIM`), 호버는 그 위에 한 겹 더 얹어(`FAM_DIM`) *"더 검게"* 간다.
 *     평소   : 바다 L39 · 향조 L66~72   (여태는 L100~111 — 불이 켜져 있었다)
 *     호버   : 고른 해역은 그대로 · 나머지 **L45~49** (바다에 거의 닿는다)
 *   ⚠ 겹이 **쌓이므로** 실효는 1 − (1−0.42)² = **0.66** 이다. 둘을 따로 0.66 으로 올리지 마라.
 *   ⚠ `TERR_DIM` 은 마스크가 없다 — 갈 수 있는 바다 **전체**를 덮어 밝기 사다리(지금·지나온·미탐색)까지
 *     같이 내린다. 그게 *"전반적으로 더 어둡게 탐험의 느낌"* 이다. 순서는 사다리가 안 뒤집힌다.
 *   ⚠ 향수 점 · 이름 · 시야 원은 `gMark`(화면 좌표 층)라 **이 겹 위**다 — 같이 안 어두워진다.
 */
const TERR_DIM = 0.42, FAM_DIM = 0.42;
/*
 * ⭐⭐ **아직 못 만난 향수는 무채색이다** (2026-09-21 사용자 : *"지나가면서 발견했거나 클릭했던 향수만
 *   현재 색상으로 표현되어야하고 나머지는 조금 살짝 어두운 무채색으로 … 다 강조되게 표현되어있으면 안됨"*).
 *
 *   여태 점 200개가 **전부 제 색**이라 지도를 열면 아홉 색이 한꺼번에 소리쳤다. 이제 안개가 걷힌
 *   자리의 점만 제 색이고, 나머지는 채도를 빼고 조금 어둡게 간다 — 탐색이 곧 색이다.
 *     제 색   L177 · 채도 0.45   (CITRUS 기준)
 *     못 만남 L128 · 채도 0.076
 *   ⚠ 바탕(바다 L39 · 불 꺼진 향조 영역 L66~72)보다는 확실히 위에 둔다 — *"전부 보이게"* 는 그대로다
 *     (2026-09-11 규약 · 불변식 29-2). 안 보이게 하는 것이 아니라 **강조를 거두는 것**이다.
 *   ⚠ 판정은 이름표와 **같은 안개 격자**다 (`fogGrid` · `seen`) — 이름은 뜨는데 점은 회색인 일이 없다.
 *   ⚠ 안개가 꺼져 있으면(`seen` 이 true) 전부 제 색이다 — 그때는 '못 만남' 이라는 개념이 없다.
 */
// ⚠ 0.85 는 **너무 회색**이었다 (2026-09-21 사용자 : *"영역 색상 조금만 섞어줘"*) — 채도가 0.015~0.076 이라
//   어느 해역 향수인지가 아예 안 남았다. 0.62 면 제 색의 약 **40%** 가 비쳐 계열은 읽히고 강조는 안 된다
const PT_DESAT = 0.62, PT_DIM = 0.26;
/*
 * ⭐ **바다 종이결** (2026-09-21 레퍼런스 지도 A-2) — `feTurbulence` 한 장으로 종이/구름 질감을 낸다.
 *   FREQ 가 결의 잦기 (작을수록 큰 구름 — 0.03 이면 가장 큰 덩어리가 약 33px) · OCT 는 겹치는 옥타브 수
 *   (4 면 33 · 16 · 8 · 4px 이 겹쳐 구름과 종이 알갱이가 같이 난다) · A 는 얹는 세기.
 *
 *   ⚠⚠ **전부 배율로 안 나눈다** — 결은 **지도에 붙은 것**이라 확대하면 같이 커지는 게 맞다
 *     (해안선 굴곡 `COAST_AMP` 와 같은 규율 · 진행안 §6-2). `gSea` 가 받는 scale(k) 가 그 일을 하므로
 *     `syncZoom` 에서 아무것도 안 하면 저절로 그렇게 된다 — **여기에 `/ k` 를 넣지 마라.**
 *     (띠 · 번짐 · 그림자는 반대다 — 그쪽은 화면 px 이라 `syncZoom` 이 k 로 나눈다)
 */
const GRAIN_FREQ = 0.03, GRAIN_OCT = 4, GRAIN_SEED = 19, GRAIN_A = 0.5;
/*
 * ⭐⭐ **밝기 사다리** — 갈 수 있는 바다 안에서 *지금 · 지나온 · 못 가 본* 을 밝기로만 가른다
 *   (2026-09-21 사용자 : *"지나 온 길은 현재 온 위치보다 조금 어둡게 기존 탐험 안된 곳도 더 어둡게"*).
 *
 *   | 칸 | 무엇 | 얹는 것 | 밝기 |
 *   |---|---|---|---:|
 *   | ① 지금 있는 바다 | `pbc-sight` 방사 | 물빛 0.34 | L92 |
 *   | ② 지나온 바다   | `rLit`          | 물빛 LIT_A | L50 |
 *   | ③ 못 가 본 바다 | `rFog`          | **void-deep** FOG_A | L29 |
 *   (바탕 = `NAV_SEA` #21282F L39 — ②는 그 위로, ③은 그 아래로 벌린다)
 *
 *   ⚠⚠⚠ **여기서 층 하나가 뒤집혀 있었다** (2026-09-21 실측). `rFog` 는 `--pb-on-surface`(#2F2F32 · **L47.2**)
 *     를 쓰는데 새 바다가 L39 라, *어둡게* 하라고 둔 안개가 거꾸로 **밝히고** 있었다 (39 → 42.3).
 *     바탕이 아이보리(L96)이던 시절에는 맞던 색이다 — 불변식 28 이 말한 뒤집힘의 **다섯 번째**다.
 *     그래서 색을 `--pb-void-deep` 으로 바꿨다. ⚠ 바다를 다시 밝게 되돌리면 이 색부터 같이 본다.
 *   ⚠ 예전 주석의 *"안개를 더 어둡게 해서 차이를 벌리지 않는다"* (2026-09-12 · *"미탐색 영역 너무 어둡고"*)
 *     는 **아이보리 바탕 기준**이라 지금은 안 맞는다. 어두운 바다에서는 밝히는 쪽에 여지가 없다.
 */
const LIT_A = 0.07, FOG_A = 0.45;
// 안개만 흐린다 — `SOFT` 가 둥글어지는 크기, `EDGE` 가 또렷함 (경계 폭 ≈ SOFT ÷ EDGE)
const FOG_SOFT = 18, FOG_EDGE = 2.6;
// 이 면적(정규화 좌표) 아래의 향 영역 조각은 **안 그린다** (2026-09-20 사용자 : *"영역도 작게작게 벗어난
// 것들은 다 지우셈 … 너무 의미없는 데이터는 시각적 허용으로"*).
// 실측 : 조각 30개 중 15개가 이 아래인데 **면적 몫은 0.35%** 다 — 지도에서 사라져도 잃는 정보가 없다.
const RING_MIN = 5e-4;
// 향조 강조 — 번짐 · 후광 굵기 · 땅이 솟아 보이는 그림자 거리 (전부 **화면 px**)
const FAM_BLUR = 6, FAM_GLOW_W = 16, FAM_LIFT = 5;

export function createChart({ onPick, onBlocked, minimap } = {}) {
  const box = document.getElementById('chart');
  const stage = document.getElementById('chart-stage');
  const panel = document.getElementById('chart-panel');
  const legend = document.getElementById('chart-legend');
  const hintEl = document.getElementById('chart-hint');
  const btnOpen = document.getElementById('minimap-zoom');
  const btnClose = document.getElementById('chart-close');
  const btnReset = document.getElementById('chart-reset');
  const veil = document.getElementById('chart-veil');
  if (!box || !stage) {
    return { update() {}, open() {}, close() {}, isOpen: () => false, dispose() {}, report: () => '해도 없음' };
  }

  // ── 팔레트. ⚠ 색을 여기 적지 않는다 — `:root` 가 단일 출처다 (minimap.js 와 같은 규율)
  const PAL = (() => {
    const r = getComputedStyle(document.documentElement);
    const g = (k, d) => ((r.getPropertyValue(k) || '').trim() || d);
    return {
      surface: g('--pb-surface', '#F9F6EF'),
      surface2: g('--pb-surface-2', '#E8E1D6'),
      line: g('--pb-line-soft', '#C9C4BB'),
      ink: g('--pb-on-surface', '#2F2F32'),
      accent: g('--pb-accent', '#A68F5B'),
      shimmer: g('--pb-shimmer', '#A7C8DB'),
      // 갈 수 없는 바다 — 미니맵과 **같은 토큰**이다 (2026-09-13)
      void: g('--pb-void', '#515A61'),
      // 바깥으로 갈수록 짙어지는 끝 색 (rVoidDeep · pNavShade)
      voidDeep: g('--pb-void-deep', '#0D1219'),
      /*
       * ⭐ **어두워진 바다 위에 앉는 글자색** (2026-09-21, NAV_SEA_MIX 와 한 벌).
       *   판의 아이보리 위에 서는 글자(범례 · 머리말)는 그대로 `ink` 다 — 이건 **바다 위**에만 쓴다.
       *   ⚠⚠ 불변식 28 : *"해도에서 밝기를 전제한 층은 바탕이 바뀔 때마다 뒤집혔다 — 두 번"*.
       *     세 번째가 이것이다. 향조 이름 · 향수 이름이 `ink`(먹색) 그대로면 #21282F 에서 안 읽힌다.
       */
      seaInk: g('--pb-chart-sea-ink', '#EDE8DF'),
      /*
       * ⭐ **판 위**에 앉는 글자 · 선 (2026-09-21 — 판이 어두운 유리가 되면서 같이 뒤집혔다).
       *   ⚠ `ink` · `line` · `surface2` 는 검색창 · 카드도 쓰는 전역 토큰이라 그대로 둔다. 해도 판만
       *     따로 이름을 갖는다 (index.html 의 `--pb-chart-*` 머리말).
       *   ⚠ **바다 위 글자(`seaInk`)와 다른 토큰이다** — 판(#221D30)과 바다(#21282F)는 다른 바탕이다.
       */
      chartInk: g('--pb-chart-ink', '#2F2F32'),
      chartInk2: g('--pb-chart-ink-2', 'rgba(47,47,50,0.62)'),
      chartLine: g('--pb-chart-line', '#C9C4BB'),
      chartRow: g('--pb-chart-row', 'rgba(232,225,214,0.9)')
    };
  })();
  /*
   * 두 색을 섞는다 — `b` 를 `a` 위에 알파 `t` 로 얹었을 때의 색. `rgba` 가 문자열을 만드는 것과 달리
   * 이쪽은 **합쳐진 한 색**이 필요한 자리(갈 수 있는 바다)가 쓴다. SVG 에 '아래 색과 합친 값' 이 없다
   */
  const mix = (a, b, t) => {
    const p = (h) => { const s = (h || '').trim(); return s[0] === '#' && s.length === 7 ? [parseInt(s.slice(1, 3), 16), parseInt(s.slice(3, 5), 16), parseInt(s.slice(5, 7), 16)] : null; };
    const ca = p(a), cb = p(b);
    if (!ca || !cb) return a;
    return '#' + ca.map((v, i) => Math.round(v + (cb[i] - v) * t).toString(16).padStart(2, '0')).join('');
  };
  // 갈 수 있는 바다의 색 — 등심선 띠가 다 짙어진 자리와 **같은 색**이다 (NAV_SEA_MIX 머리말)
  const NAV_SEA = mix(PAL.void, PAL.voidDeep, NAV_SEA_MIX);
  /*
   * 색을 **어둡게만** 한다 — RGB 를 통째로 같은 비로 줄이므로 색상(hue)과 채도가 그대로 남는다.
   * ⚠⚠ 이게 `mix(…, voidDeep, t)` 와 다른 점이다 (2026-09-21 사용자 : *"등심선 그냥 한 색상에서
   *   뻗어나가는 그라데이션 하면됨 지금 이상한 색상이 들어가있는데"*).
   *   고리를 `--pb-void-deep` 으로 칠하면 **두 색을 섞게 된다** — `--pb-void`(#39424A · 채도 0.13)와
   *   `--pb-void-deep`(#0D1219 · 채도 0.32)은 채도가 2.5배 차이라, 겹이 쌓일수록 채도가 오르내려
   *   같은 파랑이 아니라 **청록이 도는 띠**로 읽힌다. 바탕을 어둡게만 하면 그 흔들림이 아예 없다.
   */
  const shade = (hex, k) => {
    const h = (hex || '').trim();
    if (h[0] !== '#' || h.length !== 7) return h;
    const f = (i) => Math.round(parseInt(h.slice(1 + i * 2, 3 + i * 2), 16) * (1 - k)).toString(16).padStart(2, '0');
    return '#' + f(0) + f(1) + f(2);
  };
  // 등심선이 쓰는 **단 하나의 색** — 갈 수 없는 바다(`--pb-void`)를 어둡게만 한 값이다
  const RING_COL = shade(PAL.void, RING_SHADE);
  // 색에서 채도만 뺀다 (명도는 남긴다) — 미탐색 지형의 색이다. k 1 이면 완전 회색
  const desat = (hex, k) => {
    const h = (hex || '').trim();
    if (h[0] !== '#' || h.length !== 7) return h;
    const r = parseInt(h.slice(1, 3), 16), g = parseInt(h.slice(3, 5), 16), b = parseInt(h.slice(5, 7), 16);
    const y = 0.299 * r + 0.587 * g + 0.114 * b;
    const m = (v) => Math.round(v + (y - v) * k).toString(16).padStart(2, '0');
    return '#' + m(r) + m(g) + m(b);
  };
  const rgba = (hex, a) => {
    const h = (hex || '').trim();
    if (h[0] !== '#' || (h.length !== 7 && h.length !== 4)) return h;
    const f = h.length === 4 ? h.replace(/#(.)(.)(.)/, '#$1$1$2$2$3$3') : h;
    return `rgba(${parseInt(f.slice(1, 3), 16)},${parseInt(f.slice(3, 5), 16)},${parseInt(f.slice(5, 7), 16)},${a})`;
  };

  let open = false, map = null, mapKey = '';
  let W = 0, H = 0, s = 1, ox = 0, oy = 0;                 // 집 배치 (배율 1 일 때)
  let home = { x0: 0, x1: 1, z0: 0, z1: 1 };
  let k = 1, tx = 0, ty = 0;                               // 확대 · 이동
  let boat = { x: 0, z: 0, head: 0 }, target = null, sight = 0;
  let hoverPt = null, fogN = -1, lastLive = '';
  let nameFs = 11, famFs = 13;

  const boundOn = () => (P.mapBound === undefined ? 1 : P.mapBound) >= 0.5;
  const margin = () => Math.max(0, P.mapMargin === undefined ? 20 : P.mapMargin);
  // 0 이름 없음 · 1 **지나온 바다만** (기본) · 2 전부 (시연용)
  const nameMode = () => Math.round(P.chartNames === undefined ? 1 : P.chartNames);
  const terrAmt = () => Math.max(0, Math.min(1, P.chartTerrain === undefined ? 1 : P.chartTerrain));

  // 월드 → 화면 px (확대 · 이동까지). ⚠ 북(−Z)이 위 — 미니맵과 같다 (불변식 0-2)
  const sx = (x) => (ox + (x - home.x0) * s) * k + tx;
  const sy = (z) => (oy + (z - home.z0) * s) * k + ty;
  const toW = (px, py) => [home.x0 + ((px - tx) / k - ox) / s, home.z0 + ((py - ty) / k - oy) / s];

  // ⭐ 안개가 걷힌 자리인가 — **미니맵의 격자를 그대로 읽는다** (기록의 주인은 미니맵이다, 불변식 28).
  //   ⚠ 격자 밖은 '안 지나갔다' 로 본다. 안개가 꺼져 있으면(fm 없음) 전부 지나간 것으로 본다
  const fogGrid = () => (minimap && minimap.fogMask && minimap.fogMask()) || null;
  const seen = (fm, x, z) => {
    if (!fm) return true;
    const i = Math.floor((x - fm.x0) / fm.cell), j = Math.floor((z - fm.z0) / fm.cell);
    if (i < 0 || j < 0 || i >= fm.cols || j >= fm.rows) return false;
    return !!fm.bits[j * fm.cols + i];
  };

  /*
   * ⭐⭐ **마우스가 짚은 것을 커서 옆에 띄운다** (2026-09-20 사용자 : *"마우스 오버했을때 해당 정보가
   *   조금 더 잘 보였으면 좋겠는데"*). 같은 글은 판 머리말(`#chart-hint`)에도 그대로 나가지만,
   *   거기는 지도에서 눈이 가 있는 자리와 **멀다** — 향수 점 하나를 짚어 놓고 판 꼭대기를 읽어야 했다.
   *   ⚠ `pointer-events:none` — 이름표가 제 밑의 점을 가로채면 짚은 것이 바뀐다.
   *   ⚠ 자리는 커서의 오른쪽 아래이고, 판 끝에 닿으면 반대쪽으로 넘긴다 (아래 `moveTip`).
   */
  const tip = document.createElement('div');
  tip.style.cssText = 'position:absolute;left:0;top:0;z-index:3;display:none;pointer-events:none;'
    + 'padding:5px 9px;border-radius:6px;white-space:nowrap;'
    + 'font-size:12px;letter-spacing:0.02em;'
    + 'background:' + rgba(PAL.ink, 0.88) + ';color:' + PAL.surface + ';'
    + 'box-shadow:0 4px 14px rgba(16,12,24,0.28);';
  stage.appendChild(tip);
  const TIP_GAP = 14;
  const moveTip = (e, text) => {
    if (!text || text === '—') { tip.style.display = 'none'; return; }
    tip.textContent = text;
    tip.style.display = 'block';
    const r = stage.getBoundingClientRect();
    let x = e.clientX - r.left + TIP_GAP, y = e.clientY - r.top + TIP_GAP;
    // 판 밖으로 나가면 커서의 반대쪽으로 — 잘려서 못 읽는 것보다 낫다
    if (x + tip.offsetWidth > r.width - 4) x = e.clientX - r.left - TIP_GAP - tip.offsetWidth;
    if (y + tip.offsetHeight > r.height - 4) y = e.clientY - r.top - TIP_GAP - tip.offsetHeight;
    tip.style.transform = `translate(${Math.max(4, x).toFixed(0)}px,${Math.max(4, y).toFixed(0)}px)`;
  };

  // ── SVG 뼈대. 한 번만 만든다
  const svg = svgEl('svg', { width: '100%', height: '100%' });
  svg.style.display = 'block';
  const defs = svgEl('defs');
  // ⭐⭐ 마스크 넷 — **전부 벡터 경로다** (2026-09-13, v0.50.0). 예전에는 격자 그림(132×110 · 116×102)을
  //   마스크 안에서 늘리고 흐렸다 — 6배 확대에서 칸이 45~58px 이 되어 **흐린 계단**으로 보였다 (사용자 화면).
  //   ⚠ 마스크 영역은 drawSea 가 판의 세 배로 잡는다 (기본 −10% ~ 120% 로 두면 확대·이동한 끝에서 잘린다)
  // 갈 수 있는 바다 **안쪽** — 원들의 합집합을 흰색으로
  /*
   * ⭐⭐⭐ **마스크 자체를 흐린다** (2026-09-20 사용자 : *"확대 부분에서는 가우시안 블러가 안된다고했나?
   *   허용하게 할태니까 한번 해결해봐"*).
   *   ⚠⚠ 그 전까지 번짐은 **안쪽으로 덧그은 겹**(`pNavSoft`) 하나였다. 그런데 바깥을 칠하는 `rVoid` 는
   *     `pbc-out` 마스크가 **딱 잘라** 주므로, 그 금은 그대로 남아 있었다 — 사용자가 본 *"구불구불"* 하고
   *     또렷한 테두리가 이것이다. 안쪽에 아무리 번지는 겹을 얹어도 **자르는 자리 자체가 하드컷**이면 안 없어진다.
   *   그래서 마스크의 경로에 `feGaussianBlur` 를 건다 — 알파가 비탈로 바뀌어 바깥과 안이 **서로 녹는다.**
   *   덧그리던 `pNavSoft` 는 할 일이 없어져 걷었다.
   *   ⚠ 번짐은 user space 라 배율을 탄다 — `syncZoom` 이 1/k 로 나눈다 (화면에서 같은 두께).
   *   ⚠ 안개 쪽은 **더 크게** 흐린다 : 격자를 마칭 스퀘어로 딴 윤곽이라 원래 구불구불한데,
   *     작은 미니맵은 격자 그림을 쌍선형으로 늘려 흐리므로 **동그란 덩어리**로 보인다 (사용자 :
   *     *"작은 미니맵처럼 원형으로 동그랗게"*). 같은 인상을 여기서는 이 번짐이 만든다.
   */
  /*
   * ⚠⚠⚠ **흐리기만 하면 둥글어지는 동시에 흐려진다.** 처음에 번짐만 크게 줬더니 구불거림은 없어졌지만
   *   지도 전체가 구름처럼 떠 버렸다 (2026-09-20 실측 · 화면으로 확인).
   *   둘은 **따로 정할 수 있다** — 흐린 뒤 알파를 비탈로 다시 세우면 된다 (`feComponentTransfer`).
   *     · `stdDeviation` 이 **얼마나 둥글어지는가** (작은 굴곡이 뭉개지는 크기)
   *     · `slope` 가 **얼마나 또렷한가** (비탈이 가파를수록 경계가 좁다 — 폭 ≈ 번짐 ÷ slope)
   *   `intercept` 는 비탈의 한가운데가 알파 0.5 에 오게 맞춘 값이다 (`0.5 − slope × 0.5`) —
   *   그래야 **원래 모양의 크기가 안 변한다.** 안 맞추면 영역이 통째로 부풀거나 쪼그라든다.
   */
  const mkBlur = (id, sd, slope) => {
    const f = svgEl('filter', { id, x: '-30%', y: '-30%', width: '160%', height: '160%' });
    const b = svgEl('feGaussianBlur', { stdDeviation: sd });
    const t = svgEl('feComponentTransfer');
    t.appendChild(svgEl('feFunc' + 'A', { type: 'linear', slope, intercept: (0.5 - slope * 0.5).toFixed(3) }));
    f.append(b, t); defs.appendChild(f);
    return b;
  };
  const fFogBlur = mkBlur('pbc-mblur-fog', FOG_SOFT, FOG_EDGE);

  /*
   * ⭐⭐⭐ **해안선 — 흐리는 게 아니라 울퉁불퉁하게 만든다** (2026-09-20 사용자 :
   *   *"맵 외곽은 닫겨있어야지"* · *"블러 말고 뭔가 정말 영토를 표현한듯 울퉁 불퉁한"*).
   *   `scentmap.navLoops()` 가 주는 고리는 원들의 합집합을 둥글린 것이라 **너무 매끈하다** — 지도가 아니라
   *   물방울로 읽힌다. `feTurbulence` 로 뽑은 결을 `feDisplacementMap` 으로 밀어 만(灣)과 곶을 만든다.
   *   ⚠⚠ **배율로 안 나눈다.** 이 굴곡은 지도에 붙은 것이라 확대하면 같이 커지는 게 맞다 (실제 해안선이
   *     그렇다). 번짐(안개 · 그림자)만 화면 기준이라 나눈다 — 둘의 성질이 다르다.
   *   ⚠ 마스크 둘(`pbc-in` · `pbc-out`)과 안쪽 그림자가 **같은 필터 · 같은 seed** 를 써야 한 해안선이 된다.
   *     하나만 바꾸면 그림자가 뭍에서 떠오른다.
   */
  // ⚠ `pad` 는 필터 영역의 여유(%)다 — 등심선처럼 **굵은 스트로크**를 담는 겹은 크게 줘야 한다.
  //   SVG 의 objectBoundingBox 는 **선 굵기를 안 센다** — 기본 15% 로 두면 굵은 고리의 바깥이 잘린다
  /*
   * ⚠⚠⚠ `srgb` 를 빼먹으면 **색이 변한다** (2026-09-21 사용자 : *"지금 이상한 색상이 들어가있는데"*).
   *   SVG 필터의 기본 색공간은 **linearRGB** 라, 거쳐 가는 픽셀이 sRGB → 선형 → sRGB 로 두 번 변환된다.
   *   `pbc-coast` · `pbc-coast-soft` 는 결과를 **마스크(휘도)** 로만 써서 티가 안 났는데, 등심선은
   *   **색이 그대로 보이는 스트로크**라 그 변환이 화면에 나온다 — 반투명 겹을 선형에서 합성하면
   *   같은 `--pb-void-deep` 이 아닌 옅고 탁한 색이 된다. 색이 보이는 겹에는 반드시 sRGB 를 준다.
   */
  const mkCoast = (id, blur, pad = 15, srgb = false) => {
    const f = svgEl('filter', { id, x: `-${pad}%`, y: `-${pad}%`, width: `${100 + pad * 2}%`, height: `${100 + pad * 2}%` });
    if (srgb) f.setAttribute('color-interpolation-filters', 'sRGB');
    f.append(
      svgEl('feTurbulence', { type: 'fractalNoise', baseFrequency: COAST_FREQ, numOctaves: 3, seed: COAST_SEED, result: 'n' }),
      svgEl('feDisplacementMap', { in: 'SourceGraphic', in2: 'n', scale: COAST_AMP, xChannelSelector: 'R', yChannelSelector: 'G' }),
      // ⚠ 아주 옅은 번짐 한 겹 — 변위가 만든 톱니를 없애는 몫이지 '흐리는' 몫이 아니다
      svgEl('feGaussianBlur', { stdDeviation: blur }),
    );
    defs.appendChild(f);
    return f.lastChild;
  };
  mkCoast('pbc-coast', 0.7);
  const fShadeBlur = mkCoast('pbc-coast-soft', NAV_SHADE_BLUR);

  /*
   * ⭐⭐⭐ **등심선 — 같은 해안선을 굵기만 키워 덧긋는다** (2026-09-21 · 위 RING_* 머리말이 값의 뜻이다).
   *   고리 하나 = 해안선 경로 그대로에 `stroke-width = 2r` 를 준 것. 스트로크는 경로의 **정확한 오프셋**이라
   *   만(灣)도 곶도 모양이 그대로 남는다 (옛 흐림+계단 방식이 뭉갠 바로 그 자리다).
   *
   *   ⚠⚠ **큰 것부터 깐다.** 고리는 서로 **포개져 있어서**(작은 것 ⊂ 큰 것) 겹친 만큼 알파가 쌓인다 —
   *     해안 바로 밖은 12겹이 다 덮어 가장 짙고, 바깥 끝은 한 겹만 남아 가장 옅다. 그게 사용자가 말한
   *     *"진한 쪽이 안으로, 바깥으로 갈수록 옅게"* 다.
   *   ⚠ 알파는 **눈금이 고르도록 역산한다** (아래 RINGS) — 같은 값을 12번 쌓으면 기하급수라 안쪽 넷이
   *     거의 같은 색으로 뭉친다. `a = (A - A이전) / (1 - A이전)` 이 그 역산이다.
   *   ⚠ 스트로크는 경로 **안쪽으로도** r 만큼 번진다 — 그 절반은 `pbc-out` 이 잘라 낸다 (아래 gBands).
   *   ⚠⚠ 굴곡(변위)은 **겹 하나에 한 번만** 건다 (`pbc-coast-rings` 를 그룹에 건다). 고리마다 따로 걸면
   *     필터가 12번 돌고, 무엇보다 **고리들이 서로 다른 굴곡을 타서 동심이 깨진다.**
   *   ⚠ 굵기는 화면 px 라 `syncZoom` 이 배율로 나눈다. 굴곡은 안 나눈다 (mkCoast 규율).
   */
  const fRings = mkCoast('pbc-coast-rings', 0.8, 45, true);
  // 겹마다 얹을 알파 — 누적이 RING_OUT → RING_IN 으로 **고르게** 가도록 역산한다 (큰 고리부터)
  const RINGS = (() => {
    const out = [];
    let prev = 0;
    for (let c = 1; c <= RING_N; c++) {
      const want = RING_OUT + (RING_IN - RING_OUT) * ((c - 1) / (RING_N - 1));
      out.push({ r: RING_W * (RING_N - c + 1), a: (want - prev) / (1 - prev) });
      prev = want;
    }
    return out;
  })();
  const gRings = svgEl('g', { filter: 'url(#pbc-coast-rings)' });
  const ringPaths = RINGS.map((it) => {
    const p = svgEl('path', {
      fill: 'none', stroke: RING_COL, 'stroke-opacity': it.a.toFixed(4),
      'stroke-linejoin': 'round', 'stroke-linecap': 'round',
    });
    gRings.appendChild(p);
    return p;
  });

  const maskIn = svgEl('mask', { id: 'pbc-in', maskUnits: 'userSpaceOnUse' });
  const pInFill = svgEl('path', { fill: '#fff', 'fill-rule': 'evenodd', filter: 'url(#pbc-coast)' });
  maskIn.appendChild(pInFill);
  // 갈 수 있는 바다 **바깥** — 흰 판에서 합집합을 검게 뺀다
  const maskOut = svgEl('mask', { id: 'pbc-out', maskUnits: 'userSpaceOnUse' });
  const maskOutBg = svgEl('rect', { fill: '#fff' });
  const pOutFill = svgEl('path', { fill: '#000', 'fill-rule': 'evenodd', filter: 'url(#pbc-coast)' });
  maskOut.append(maskOutBg, pOutFill);
  // 안개 — 흰 판에서 **지나온 바다**를 검게 뺀다 (너울은 안 지나온 곳에만 얹힌다)
  const maskFog = svgEl('mask', { id: 'pbc-fog', maskUnits: 'userSpaceOnUse' });
  const maskFogBg = svgEl('rect', { fill: '#fff' });
  const pFogHole = svgEl('path', { fill: '#000', 'fill-rule': 'evenodd', filter: 'url(#pbc-mblur-fog)' });
  maskFog.append(maskFogBg, pFogHole);
  // ⭐ **지나온 바다만** — 향 영역의 '색이 돌아온 겹' 이 쓴다. ⚠ 안개가 꺼져 있으면 판 전체가 지나온 곳이다 (`maskLitAll`)
  const maskLit = svgEl('mask', { id: 'pbc-lit', maskUnits: 'userSpaceOnUse' });
  const maskLitAll = svgEl('rect', { fill: '#fff' });
  const pLitFill = svgEl('path', { fill: '#fff', 'fill-rule': 'evenodd', filter: 'url(#pbc-mblur-fog)' });
  maskLit.append(maskLitAll, pLitFill);
  defs.append(maskIn, maskOut, maskFog, maskLit);

  // 바다 층 — **집 좌표계**로 한 번 그려 두고 확대·이동은 transform 하나로 받는다 (DOM 을 다시 안 만든다)
  const gSea = svgEl('g');
  // ⭐⭐ **갈 수 없는 바다는 한 색이다** (2026-09-13, v0.50.0). 사용자 : *"영역밖은 완전한 검은색 보다 계열이
  //   좀 낮은 색상으로 칠해야 … 확대했을때 빗금 표현은 몹시 안좋고 연관성을 만들어야하니 작은 미니맵에도
  //   같은 색상으로"*. 색은 `--pb-void` 하나이고 미니맵과 **같은 토큰**이다. 빗금 무늬는 걷어냈다.
  //   ⚠ 판 전체를 덮는다 — 담는 사각형만 칠하면 그 **네모난 끝**이 어두운 색에서 그대로 드러난다
  const rVoid = svgEl('rect', { fill: PAL.void, mask: 'url(#pbc-out)' });
  /*
   * ⭐⭐ **바깥으로 갈수록 더 어둡다** (2026-09-20 사용자 : *"조금더 집중력을 높힐려면 아마 외곽의
   *   나갈 수 없는 범위가 정말 어둡게 되어있고 안쪽으로올수록 지금의 색상이면 좋겠음"*).
   *   `--pb-void` 한 색만 깔면 판 끝까지 같은 밝기라 시선이 바깥으로 샌다. 지도 한가운데를 중심으로
   *   **투명 → 아주 짙은 색**으로 가는 겹을 덧깔아, 눈이 가운데(갈 수 있는 바다)에 모이게 한다.
   *   ⚠ 같은 `pbc-out` 마스크를 쓴다 — 갈 수 있는 바다에는 한 방울도 안 떨어진다.
   *   ⚠ 중심 · 반지름은 `drawSea` 가 집 상자에서 잡는다 (판 크기가 바뀌면 같이 따라간다).
   */
  const gradDeep = svgEl('radialGradient', { id: 'pbc-deep', gradientUnits: 'userSpaceOnUse' });
  /*
   * ⚠⚠ 2026-09-21 : 가운데 두 멈춤을 **눅였다** (0.18 → 0.10 · 0.55 → 0.38). 띠가 180px 까지 뻗으면서
   *   이 방사 어둠이 그 위를 덮어 **바깥 계단이 안 읽혔다** — 0.78 자리에서 이미 0.55 면 바탕이 거의
   *   void-deep 이라 계단을 더 얹어도 차이가 안 난다.
   * ⚠ **끝(1.0)은 0.92 그대로다** — 2026-09-20 사용자의 *"외곽의 나갈 수 없는 범위가 정말 어둡게"* 는
   *   판 끝에 대한 말이고, 같은 문장의 *"안쪽으로올수록 지금의 색상이면"* 이 오히려 이 완화와 맞는다.
   */
  for (const [o, al] of [[0, 0], [0.5, 0.10], [0.78, 0.38], [1, 0.92]]) {
    gradDeep.appendChild(svgEl('stop', { offset: o, 'stop-color': PAL.voidDeep, 'stop-opacity': al }));
  }
  defs.appendChild(gradDeep);
  const rVoidDeep = svgEl('rect', { fill: 'url(#pbc-deep)', mask: 'url(#pbc-out)' });
  // ⚠ `pbc-out` 이 고리의 **안쪽 절반**을 잘라 낸다 — 스트로크는 경로 양쪽으로 번지므로 이게 없으면
  //   갈 수 있는 바다 가장자리가 같이 어두워진다 (fRings 머리말)
  const gBands = svgEl('g', { mask: 'url(#pbc-out)' });
  gBands.appendChild(gRings);
  /*
   * ⭐ **바다 끝 안쪽에 드리우는 그림자** — 사용자 : *"이전처럼 뭔가 그림자져서 나갈 수 없는 곳이라는
   *   표현은 좋았음"* · *"나갈 수 없는 부분 그림자 표현은 좋았다"*. 잠깐 걷었다가 되살렸다.
   *   ⚠ 마스크와 **같은 해안선 필터**를 쓴다 (`pbc-coast-soft`) — 안 그러면 그림자가 뭍에서 떠오른다.
   */
  const pNavShade = svgEl('path', { fill: 'none', stroke: rgba(PAL.voidDeep, 0.85), 'stroke-linecap': 'round', 'stroke-linejoin': 'round', filter: 'url(#pbc-coast-soft)' });
  /*
   * ⭐ **갈 수 있는 바다에 물빛을 깐다** (2026-09-12 저녁, 화면 판정). 갈 수 있는 바다가 '물' 로 읽혀야 지도가 된다
   * ⭐⭐ 2026-09-21 : 그 물빛이 **판의 아이보리 위**에 0.12 로 얹혀 있었다 (= 그 '흰색'). 이제 판을 안 비치게
   *   `NAV_SEA` 로 **꽉 채운다** — 띠가 다 짙어진 자리와 같은 색이다 (NAV_SEA_MIX 머리말).
   *   ⚠ 이 사각형은 판 전체를 덮지만 바깥은 `rVoid`(불투명)가 다시 덮으므로 갈 수 없는 바다는 그대로다.
   */
  const rSea = svgEl('rect', { fill: NAV_SEA, 'fill-opacity': 1 });
  // ⭐⭐ 향 영역 아홉 — **두 겹이다** (2026-09-12 저녁, 화면 판정).
  //   ① `gTerr` 회색 지형 : 어디나 보인다 (2026-09-11 규약 *"어떤 영역은 전부 보이게"*)
  //   ② `gTerrLit` 색 : **지나온 바다에만** (마스크 `pbc-lit`) — 탐색하면 색이 돌아온다
  //   ⚠ 한 겹으로 두고 안개를 얹으면 색이 0.16 로 눌려 **아홉 향조가 한 회색으로 뭉친다** (화면으로 확인).
  //   ⚠ 면만 칠한다 (테두리 없음 · evenodd 라 고리 안의 고리는 구멍이 된다)
  const gTerr = svgEl('g', { 'fill-rule': 'evenodd' });
  const gTerrLit = svgEl('g', { 'fill-rule': 'evenodd', mask: 'url(#pbc-lit)' });
  // 해안선 — 육지 전체의 경계 한 겹. ⚠ 면이 아니라 **선**이다 (넷 중 셋이 지도 경계에서 열려 있다)
  /*
   * 향 영역의 경계선 — **평소에는 안 긋고, 마우스를 올린 하나만** 제 색으로 또렷해진다 (paintEdge).
   * ⚠⚠ 2026-09-18 에는 늘 0.4 로 그었다 (*"색만으로는 향조끼리의 경계가 뭉개진다"*). 2026-09-20 에
   *   **되돌렸다** — 사용자 : *"영역 전체적으로 표현되었을때 무슨 외곽선이 이상하게 그어져있는데 이부분도 지우고"*.
   *   올렸을 때 영역 전체가 솟으므로(gFamHi) 평소의 그 선이 할 일이 없고, 맞닿은 변이 두 번 칠해지던
   *   문제(불변식 29)도 같이 사라진다.
   * ⚠ 육지 전체의 해안선(`pCoast`)도 같은 날 걷었다 — 갈 수 있는 바다의 끝과 나란히 놓여 '테두리가 둘' 로 읽혔다.
   */
  const gTerrEdge = svgEl('g', { fill: 'none', 'stroke-linejoin': 'round', 'stroke-linecap': 'round' });
  // 미탐색 너울 — 밝기 사다리의 **셋째 칸** (LIT_A · FOG_A 머리말의 표가 세 칸을 다 적어 뒀다).
  // ⚠⚠ 색이 `PAL.ink` 였다 — 새 바다보다 **밝아서** 어둡게 하라고 둔 층이 거꾸로 밝히고 있었다 (실측 L39 → L42.3)
  const rFog = svgEl('rect', { fill: PAL.voidDeep, 'fill-opacity': FOG_A, mask: 'url(#pbc-fog)' });
  /*
   * ⛔ 갈 수 있는 바다의 **끝선은 없다** (2026-09-20). 상아색 1.4px 짜리 `pNavEdge` 였고, 그 전에는 먹색이었다 —
   *   바탕이 뒤집힐 때마다 같이 뒤집힌 선이다 (불변식 28). 사용자 : *"흰색 외곽선을 없애고"*.
   *   잠깐 **안쪽으로 덧그은 번짐 겹**(`pNavSoft`)으로 대신했지만 그것도 걷었다 — 자르는 자리(마스크)가
   *   하드컷인 한 금은 그대로 남기 때문이다. 지금은 **마스크 자체를 흐린다** (위 mkBlur 머리말).
   */

  /*
   * ⭐⭐⭐ **한 향조를 고르면 나머지가 가라앉고 그 영역만 솟는다** (2026-09-20 사용자 :
   *   *"전체적으로 어두워진 UI 만큼 나머지가 어둡게 변하고 해당 영역만 glow 값을 줘도 되니 훨씬 밝게
   *   표현해서 해당 향조의 향수가 어디있고 그 영역이 어디있는지 확실히 구별해줘 마우스호버했을때
   *   해역 영역이 영토처럼 살짝 높이감을 줘도됨"*).
   *
   * ⚠⚠ **여기서 기록된 판단을 뒤집는다.** `setFamHover` 에는 *"면을 같이 밝히지 않는다 : 아홉 색이
   *   등휘도라 한 영역만 밝히면 그 영역이 아니라 **나머지가 어두워진 것**처럼 보인다"* 고 적혀 있었다.
   *   사용자가 원한 것이 바로 그 '나머지가 어두워지는' 쪽이다 — 등휘도라 한 영역만 밝혀서는 안 되니
   *   **나머지를 실제로 내리는 것**이 아홉 색에서 하나를 뽑는 유일한 길이라는 판정이다.
   *   되돌리려면 이 네 겹(`rFamDim` · `pFamShade` · `pFamGlow` · `pFamFill`)을 안 보이게만 두면 된다.
   *
   * 네 겹 : 나머지를 덮는 어둠 → 땅 밑 그림자(높이감) → 제 색 번짐(glow) → 제 색 면.
   * ⚠ 그림자 거리 · 번짐 · 굵기는 `syncZoom` 이 배율로 나눈다 (경계 겹과 같은 이유).
   */
  const maskFam = svgEl('mask', { id: 'pbc-fam', maskUnits: 'userSpaceOnUse' });
  const maskFamBg = svgEl('rect', { fill: '#fff' });
  const maskFamHole = svgEl('path', { fill: '#000', 'fill-rule': 'evenodd' });
  maskFam.append(maskFamBg, maskFamHole);
  const fFam = svgEl('filter', { id: 'pbc-famglow', x: '-25%', y: '-25%', width: '150%', height: '150%' });
  const fFamBlur = svgEl('feGaussianBlur', { stdDeviation: 6 });
  fFam.appendChild(fFamBlur);
  defs.append(maskFam, fFam);
  // ⚠⚠ `rFog` 와 **같은 뒤집힘**이었다 — `PAL.ink`(L47.2)가 새 바다(L39)보다 밝아, 고르지 않은 해역을
  //   누르라고 둔 겹이 바다 위에서는 거꾸로 밝히고 있었다. 같은 이유로 `voidDeep` 이다 (LIT_A 머리말)
  const rFamDim = svgEl('rect', { fill: PAL.voidDeep, 'fill-opacity': FAM_DIM, mask: 'url(#pbc-fam)' });
  // ⚠ `rFog` · `rFamDim` 과 **같은 뒤집힘의 셋째**다 — 그림자인데 `PAL.ink`(L47.2)가 새 바다(L39)보다
  //   밝아 '높이감' 대신 발밑을 밝히고 있었다. 그림자는 어두워야 한다 (불변식 28)
  const pFamShade = svgEl('path', { 'fill-rule': 'evenodd', fill: rgba(PAL.voidDeep, 0.55), filter: 'url(#pbc-famglow)' });
  const pFamGlow = svgEl('path', { 'fill-rule': 'evenodd', fill: 'none', 'stroke-linejoin': 'round', filter: 'url(#pbc-famglow)' });
  const pFamFill = svgEl('path', { 'fill-rule': 'evenodd' });
  const gFamHi = svgEl('g');
  gFamHi.append(rFamDim, pFamShade, pFamGlow, pFamFill);
  gFamHi.style.display = 'none';
  // ⚠⚠ **안개는 갈 수 있는 바다 안쪽에만 깐다** — 갈 수 없는 바다까지 '미탐색' 으로 덮는 것은 뜻이 없다.
  //   마스크 둘을 곱하는 방법이 이것이다 — 겹(`gIn`)에 '안쪽' 을 걸고 그 안의 판에 '안개' 를 건다
  // ⚠⚠⚠ **안개 너울이 향 영역 아래다** (2026-09-12 저녁, 화면 판정 두 번).
  //   위에 얹으면 향 영역의 색을 곱으로 눌러 아홉이 한 회색으로 뭉친다 — 그리고 채도를 빼는 것으로도
  //   못 살린다 : **부표 색은 일부러 등휘도다** (불변식 21 — 선형 휘도 0.33~0.45 로 맞춰 뒀다).
  /*
   * ⭐ **지나온 바다에 옅은 빛 한 겹** (2026-09-20 — 밝기 사다리의 둘째 칸 · 미니맵과 같은 결정).
   *   `pbc-lit` 은 이미 '지나온 바다' 마스크다 (향 영역의 색 겹이 쓰던 것) — 같은 마스크를 다시 쓴다.
   *   ⚠⚠ 안개를 **더 어둡게 해서** 차이를 벌리지 않는다 : 2026-09-12 에 0.82 → 0.52 로 내린 이유가
   *     *"미탐색 영역 너무 어둡고"* 였다. 밝히는 쪽으로 벌린다.
   */
  // ⚠ 0.10 → LIT_A(0.07) — 지금 있는 바다(L92)와의 사이를 벌린다 (2026-09-21 *"현재 위치보다 조금 어둡게"*)
  const rLit = svgEl('rect', { fill: PAL.shimmer, 'fill-opacity': LIT_A, mask: 'url(#pbc-lit)' });
  /*
   * ⭐⭐ **바다 종이결** (2026-09-21, A-2 — 위 GRAIN_* 머리말이 값의 뜻이다).
   *   `feTurbulence` 를 **회색 결**로 바꿔 `soft-light` 로 얹는다. 이 혼합은 0.5 회색에서 아무 일도
   *   안 하고 밝은 쪽은 밝히고 어두운 쪽만 어둡게 하므로, **평균 밝기를 안 옮기고 결만** 남는다.
   *   ⚠ 알파 하나짜리 어두운 결을 덮는 방식이면 바다가 통째로 내려앉아 `NAV_SEA` 를 다시 잡아야 한다.
   *
   *   ⚠ 자리는 `gIn` **안**, `rSea` 바로 위다 = **갈 수 있는 바다에만** 깐다. 갈 수 없는 바다는
   *     *"확대했을때 빗금 표현은 몹시 안좋고"* (2026-09-13) 로 **한 색**이 된 자리라 결을 안 얹는다
   *     (불변식 28). 향 영역 · 안개는 이 위에 쌓이므로 결이 그 밑으로 비친다.
   *   ⚠⚠ `gIn` 이 마스크를 갖고 있어 **혼합이 그 안에 갇힌다** — 섞이는 상대는 바로 밑의 `rSea` 뿐이고
   *     판이나 바깥 바다로 새지 않는다 (mask 가 쌓임 맥락을 만든다). 마스크를 떼면 결이 판까지 물들인다.
   */
  const fGrain = svgEl('filter', { id: 'pbc-grain', 'color-interpolation-filters': 'sRGB' });
  fGrain.append(
    svgEl('feTurbulence', { type: 'fractalNoise', baseFrequency: GRAIN_FREQ, numOctaves: GRAIN_OCT, seed: GRAIN_SEED }),
    // ⚠ 채도를 빼고(세 채널을 평균으로) **알파를 1 로 세운다** — 결이 색을 띠면 바다가 물들고,
    //   알파가 같이 흔들리면 결이 질감이 아니라 **구멍**이 된다 (feTurbulence 는 알파도 노이즈다)
    svgEl('feColorMatrix', { type: 'matrix', values: '0.333 0.333 0.333 0 0  0.333 0.333 0.333 0 0  0.333 0.333 0.333 0 0  0 0 0 0 1' })
  );
  defs.appendChild(fGrain);
  const rGrain = svgEl('rect', { filter: 'url(#pbc-grain)', opacity: GRAIN_A });
  rGrain.style.mixBlendMode = 'soft-light';

  const gIn = svgEl('g', { mask: 'url(#pbc-in)' });
  // ⚠ 그림자는 `gIn` **안**이다 — `pbc-in` 이 바깥으로 샌 몫을 잘라 어둠이 안쪽으로만 드리운다
  // 평소의 불 꺼짐 — 향 영역 **위**, 호버 강조(`gFamHi`) **아래**다 (TERR_DIM 머리말).
  // ⚠ 마스크가 없다 : 갈 수 있는 바다 전체를 덮는다. 위로 올리면 호버한 해역까지 같이 꺼진다
  const rTerrDim = svgEl('rect', { fill: PAL.voidDeep, 'fill-opacity': TERR_DIM });
  gIn.append(rSea, rGrain, rLit, rFog, gTerr, gTerrLit, gTerrEdge, rTerrDim, gFamHi, pNavShade);
  // 쌓는 순서 : 갈 수 없는 바다(한 색) → 갈 수 있는 바다(물빛 · 지나온 빛 · 너울 · 향 영역 · 해안선 · 녹는 경계)
  // 쌓는 순서 : 바깥 한 색 → 등심선 띠(해안을 따라 계단) → 멀어질수록 짙게(방사) → 갈 수 있는 바다
  gSea.append(rVoid, gBands, rVoidDeep, gIn);

  /*
   * ⭐⭐ **지금 있는 바다 — 반지름 하나짜리 원, 테두리 없음** (2026-09-20 · 미니맵과 **같은 뜻 · 같은 값**).
   *   예전에는 `main.js` 의 `footprint(cam)` 이 넘긴 부채꼴 폴리곤이었다 — 가까운 쪽이 절두체라 구불구불했다.
   *   사용자 : *"정확한 원형 형태로 유지하되 … 경계선이 구별되어있지않고 그라데이션이든, 블러처리든 해서 부드럽게"*.
   *   ⚠ 반지름은 월드 값이라 **화면 좌표로 옮길 때 `s * k` 를 곱한다** (이 층은 배율을 안 타는 층이다).
   *   ⚠ 테두리를 긋지 않는다 — 미니맵과 같은 이유다 (선을 그으면 사다리의 칸이 아니라 '영역' 이 된다).
   */
  const gradSight = svgEl('radialGradient', { id: 'pbc-sight' });
  for (const [o, a] of [[0, 0.34], [0.55, 0.2], [1, 0]]) {
    gradSight.appendChild(svgEl('stop', { offset: o, 'stop-color': PAL.shimmer, 'stop-opacity': a }));
  }
  defs.appendChild(gradSight);

  // 표시 층 — **화면 좌표**다 (배율과 무관한 크기여야 한다 : 점 · 글자 · 배)
  const gMark = svgEl('g');
  const pFoot = svgEl('circle', { fill: 'url(#pbc-sight)' });
  const gPts = svgEl('g');
  const cHover = svgEl('circle', { r: 8, fill: 'none', stroke: PAL.accent, 'stroke-width': 1.4 });
  const gFams = svgEl('g');
  const gNames = svgEl('g');
  const pRoute = svgEl('path', { fill: 'none', stroke: rgba(PAL.accent, 0.85), 'stroke-width': 1.4, 'stroke-dasharray': '3 4' });
  const cRing = svgEl('circle', { r: 7, fill: 'none', stroke: rgba(PAL.accent, 0.9), 'stroke-width': 1.4 });
  const pBoat = svgEl('path', { fill: PAL.accent, stroke: rgba(PAL.surface, 0.95), 'stroke-width': 1.6 });
  gMark.append(pFoot, gPts, cHover, gFams, gNames, pRoute, cRing, pBoat);
  svg.append(defs, gSea, gMark);
  stage.appendChild(svg);

  /*
   * 글자 층의 글꼴은 판에서 물려받는다 (#stage 가 Noto Serif KR 이다 — 두 곳에 적지 않는다).
   *
   * ⭐⭐ **외곽선은 없다** (2026-09-21 사용자 : *"확대시 폰트가 너무 밝음 폰트 외곽선 있는것 삭제하고
   *   흰색은 유지하면 될듯"*). 여태는 상아색 테두리(`paint-order: stroke` · `--pb-surface` 0.92 ·
   *   굵기 3.4 / 2.6)를 글자 밑에 깔았다 — **먹색 글자를 밝은 바다에서 읽히게 하던 장치**다.
   *
   *   ⚠⚠ 바다가 `#21282F` 로 내려가고 글자가 `--pb-chart-sea-ink` 로 뒤집힌 지금은 그 테두리가
   *     읽힘을 돕는 게 아니라 **흰 글자에 흰 후광**을 둘러 한 덩어리로 밝아진다. 그리고 테두리 굵기는
   *     글자 크기와 달리 배율로 안 나뉘어서 **확대할수록 굵어진다** — 그게 사용자가 본 '너무 밝음' 이다.
   *   ⚠ 불변식 28 이 적어 둔 *"밝기를 전제한 층은 바탕이 바뀔 때마다 뒤집힌다"* 의 **네 번째**다.
   *     바다를 다시 밝게 되돌리면 이 테두리부터 같이 본다 (글자색 · 테두리가 한 벌이다).
   */
  for (const g of [gFams, gNames]) {
    g.setAttribute('text-anchor', 'middle');
  }

  // 이름 칸을 **미리 만들어 두고 돌려 쓴다** — 확대할 때마다 200개를 새로 만들지 않는다
  const namePool = [];
  const famPool = [];

  // ── 글자 폭 재기. ⚠ SVG 글꼴과 같은 문자열로 재야 겹침 판정이 맞는다 (ui.js LABEL_FONT 과 같은 규율)
  const meas = document.createElement('canvas').getContext('2d');
  let measFont = '', measCache = new Map();
  const textW = (t) => {
    let v = measCache.get(t);
    if (v === undefined) { meas.font = measFont; v = meas.measureText(t).width; measCache.set(t, v); }
    return v;
  };

  // ── 지나온 바다의 **벡터 윤곽** (2026-09-13, v0.50.0).
  //   안개 격자(미니맵이 주인 · 칸 4 월드)를 위 `traceGrid` 로 둥글린다.
  //   ⚠⚠ 예전에는 격자 크기 그대로의 그림을 마스크 안에서 늘리고 흐렸다 — 6배 확대에서 칸이 58px 이 되어
  //     흐린 계단으로 보였다 (사용자 화면). 경계는 벡터라야 확대해도 또렷하다.
  //   ⚠ 칸 수가 달라질 때만 다시 굽는다 (배가 새 칸을 밝혔을 때). 격자 1만 2천 칸이라 1ms 대다
  //   ⭐ 2026-09-18 : Chaikin 두 번 → **세 번**. 칸이 4 월드라 두 번으로는 격자 자국이 남았다
  //     (사용자 : *"흰색으로 영역이 띄어져있는것도 원형이 다 삐뚤고 어색하고"* — 이 윤곽이 곧 그 흰 자국이다)
  const fog = { key: '', loops: [], on: false };
  function buildFog() {
    const fm = fogGrid();
    if (!fm) { fog.key = 'off'; fog.loops = []; fog.on = false; fogN = -1; return; }
    fog.on = true;
    const key = fm.cols + 'x' + fm.rows + '@' + fm.n + '@' + fm.x0 + ',' + fm.z0;
    if (fog.key === key) return;
    fog.key = key; fogN = fm.n;
    const C = fm.cols, R = fm.rows, bits = fm.bits;
    const at = (i, j) => (i >= 0 && j >= 0 && i < C && j < R && bits[j * C + i] ? 1 : 0);
    const toXZ = (kk) => {
      const X = Math.floor(kk / 65536) - 4, Y = (kk % 65536) - 4;
      return [fm.x0 + (X / 2 + 0.5) * fm.cell, fm.z0 + (Y / 2 + 0.5) * fm.cell];
    };
    fog.loops = traceGrid(C, R, at, toXZ, 3);
  }


  // ── 배치. 판 크기가 바뀌거나 지도가 바뀔 때만 돈다
  function layout() {
    home = boundOn() ? map.navRect(margin() + MINI_BAND) : { ...map.bounds };
    const hw = home.x1 - home.x0, hh = home.z1 - home.z0;
    // ⚠⚠ **지도의 폭은 여기서 재서 넣는다.** 지도는 세로가 기준이라(1920×1080 에서 높이가 먼저 찬다)
    //   판을 화면 가득 두면 지도 양옆에 250px 씩 빈 띠가 남아 **버그처럼 보인다** (화면으로 확인).
    //   판은 `width:fit-content` 라 지도의 폭에 오그라들고, 남는 자리는 바다를 덮은 너울이 맡는다
    //   (종이 한 장이 어두운 바다 위에 뜬 그림이 된다).
    //   ⚠⚠ `aspect-ratio` 로는 안 된다 — 백분율 높이에서 나온 폭은 내재 폭이 아니라 `fit-content` 가 못 읽는다.
    //     첫 시안에서 **판 596px 안에 지도 1022px** 이 들어 범례가 판 밖으로 밀려났다 (화면으로 확인).
    //   ⚠ 그래서 순서가 있다 : 폭을 0 으로 두고 ① 쓸 수 있는 **높이**와 ② 지도를 뺀 판의 폭을 잰 뒤, 폭을 넣는다.
    //     판 높이는 CSS 가 정해 뒀으므로(calc) 폭이 높이에 되먹이지 않는다 — 순환이 아니다
    stage.style.aspectRatio = '';
    stage.style.width = '0px';
    const H0 = stage.getBoundingClientRect().height;
    // ⚠⚠ 남는 폭은 **여백 · 범례 · 사이 틈만** 세서 낸다. 지도를 뺀 **판 폭**을 재면 머리말의 최소 폭이
    //   섞여 든다 — 375px 창에서 머리말이 235px 을 우겨 지도가 **120px 사리**로 눌렸다 (실측).
    const pcs = panel ? getComputedStyle(panel) : null;
    const chrome = pcs ? parseFloat(pcs.paddingLeft) + parseFloat(pcs.paddingRight)
      + parseFloat(pcs.borderLeftWidth) + parseFloat(pcs.borderRightWidth) : 0;
    const legOn = legend && getComputedStyle(legend).display !== 'none';
    const legW = legOn ? legend.getBoundingClientRect().width + (parseFloat(getComputedStyle(stage.parentElement).columnGap) || 0) : 0;
    const maxW = (pcs && parseFloat(pcs.maxWidth)) || box.clientWidth;
    // 화면이 좁으면 폭이 기준이 된다 — 그때는 지도가 위아래로 남는다 (아래 s 가 알아서 작은 쪽을 고른다)
    const wantW = Math.max(120, Math.min(H0 * hw / hh, maxW - chrome - legW));
    stage.style.width = Math.round(wantW) + 'px';
    W = Math.round(wantW); H = Math.max(80, Math.round(H0));
    s = Math.min((W - PADS * 2) / hw, (H - PADS * 2) / hh);
    ox = (W - hw * s) / 2; oy = (H - hh * s) / 2;
    // 글자 크기는 반응형 변수에서 받는다 (불변식 23). 없으면 1920 에서 고른 기본값이다
    const cs = getComputedStyle(stage);
    nameFs = parseFloat(cs.getPropertyValue('--pb-chart-name')) || 11;
    famFs = Math.round(nameFs * 1.2);
    gNames.setAttribute('font-size', nameFs);
    gNames.setAttribute('font-weight', 400);
    gFams.setAttribute('font-size', famFs);
    gFams.setAttribute('font-weight', 600);
    gFams.setAttribute('letter-spacing', (famFs * 0.12).toFixed(2));
    const fam = (cs.fontFamily || 'serif');
    measFont = '400 ' + nameFs + 'px ' + fam;
    measCache = new Map();
    buildFog();
    clampPan();
    drawSea();
    drawPts();
  }

  // 지도 상자가 판 밖으로 달아나지 않게 (배율 1 이면 가운데로 돌아온다)
  function clampPan() {
    const hw = (home.x1 - home.x0) * s * k, hh = (home.z1 - home.z0) * s * k;
    tx = hw <= W ? (W - hw) / 2 - ox * k : Math.min(-ox * k, Math.max(W - hw - ox * k, tx));
    ty = hh <= H ? (H - hh) / 2 - oy * k : Math.min(-oy * k, Math.max(H - hh - oy * k, ty));
  }

  // ── 바다 층. 집 좌표계에 한 번 그리고, 확대·이동은 transform 이 받는다
  //   ⭐⭐ 2026-09-13 (v0.50.0) — **이 층에 비트맵이 없다.** 갈 수 있는 바다 = 원 200개의 합집합 경로,
  //   끝선 = 그 합집합의 정확한 바깥 호, 안개 = 마칭 스퀘어 윤곽. 확대해도 경계가 흐려지지 않는다
  function drawSea() {
    const bound = boundOn();
    // 판 전체를 덮는 사각형 — 확대·이동해도 판 밖이 드러나지 않게 세 배로 둔다
    //   (배율 1 이상에서 clampPan 이 지도 상자를 판에 붙여 두므로 보이는 곳은 늘 [0,W]×[0,H] 안이다)
    const BX = -W, BY = -H, BW = W * 3, BH = H * 3;
    for (const el of [rVoid, rVoidDeep, rSea, rLit, rFog, rTerrDim, rFamDim, maskOutBg, maskFamBg, maskFogBg, maskLitAll, maskIn, maskOut, maskFog, maskLit]) {
      el.setAttribute('x', BX); el.setAttribute('y', BY); el.setAttribute('width', BW); el.setAttribute('height', BH);
    }
    const hx = (x) => ox + (x - home.x0) * s, hy = (z) => oy + (z - home.z0) * s;
    /*
     * 종이결만 3배 상자를 안 쓴다 — **집 상자**(갈 수 있는 바다가 들어 있는 범위)만 덮는다.
     * ⚠ `feTurbulence` 는 필터 영역 전체를 계산하므로 3배로 두면 결 계산이 **9배**가 된다.
     *   `gIn` 마스크가 어차피 집 상자 밖을 다 자르니 보이지 않는 곳을 계산할 이유가 없다.
     * ⚠ 여유 GM 을 빼먹으면 필터 영역이 상자에 딱 붙어 결의 가장자리가 잘린다
     */
    const GM = 8;
    rGrain.setAttribute('x', (hx(home.x0) - GM).toFixed(2));
    rGrain.setAttribute('y', (hy(home.z0) - GM).toFixed(2));
    rGrain.setAttribute('width', ((home.x1 - home.x0) * s + GM * 2).toFixed(2));
    rGrain.setAttribute('height', ((home.z1 - home.z0) * s + GM * 2).toFixed(2));
    // ⚠ 소수 둘째 자리까지 — 6배 확대에서 0.1px 반올림이 0.6px 어긋남이 되어 끝선과 면이 갈라진다
    const f = (v) => v.toFixed(2);
    if (bound) {
      // ── 갈 수 있는 바다 — **면과 끝선이 같은 경로다** (2026-09-18 · scentmap.navLoops 주석).
      //   ⚠ evenodd — 바다 속에 갈 수 없는 웅덩이가 생기면 구멍이 된다 (고리의 감김 방향과 무관하게)
      let d = '';
      for (const lp of map.navLoops()) {
        for (let i = 0; i < lp.length; i++) d += (i ? 'L' : 'M') + f(hx(lp[i][0])) + ' ' + f(hy(lp[i][1]));
        d += 'Z';
      }
      pInFill.setAttribute('d', d);
      pOutFill.setAttribute('d', d);
      pNavShade.setAttribute('d', d);
      // 등심선 고리 — **같은 경로**다. 굵기만 다르다 (fRings 머리말). 다른 경로를 주면 동심이 깨진다
      for (const p of ringPaths) p.setAttribute('d', d);
      gIn.setAttribute('mask', 'url(#pbc-in)');
    } else {
      gIn.removeAttribute('mask');
    }
    rVoid.style.display = bound ? '' : 'none';
    rVoidDeep.style.display = bound ? '' : 'none';
    gBands.style.display = bound ? '' : 'none';
    pNavShade.style.display = bound ? '' : 'none';
    // 어둠의 중심은 **지도 한가운데**, 반지름은 집 상자의 반대각보다 조금 넉넉히 (판 모서리까지 닿게)
    {
      const cx = ox + (home.x1 - home.x0) * s * 0.5, cy = oy + (home.z1 - home.z0) * s * 0.5;
      const rr = Math.hypot((home.x1 - home.x0) * s, (home.z1 - home.z0) * s) * 0.72;
      gradDeep.setAttribute('cx', cx.toFixed(1));
      gradDeep.setAttribute('cy', cy.toFixed(1));
      gradDeep.setAttribute('r', rr.toFixed(1));
    }
    // ── 안개 — 지나온 바다의 윤곽. evenodd 라 밝힌 바다 속의 안 밝힌 섬은 구멍이 된다
    let fd = '';
    if (fog.on) for (const lp of fog.loops) {
      for (let i = 0; i < lp.length; i++) fd += (i ? 'L' : 'M') + f(hx(lp[i][0])) + ' ' + f(hy(lp[i][1]));
      fd += 'Z';
    }
    pFogHole.setAttribute('d', fd);
    pLitFill.setAttribute('d', fd);
    rFog.style.display = fog.on ? '' : 'none';
    // ⚠ 안개가 꺼져 있으면 **어디나 지나온 곳**이다 — 색 겹이 판 전체에 얹힌다
    //   (v0.49.0 에서는 이 경우 마스크 그림이 비어 **색 겹이 통째로 사라졌다**)
    maskLitAll.style.display = fog.on ? 'none' : '';
    drawTerr();
    syncZoom();
  }

  // ── 향 영역 아홉 + 해안선. **집 좌표계에 한 번 굽는다** (확대는 바다 층 transform 이 받는다).
  //   ⚠ 정규화 → 월드는 `scentmap.toWorld()` 가 한다 — 변환식을 여기 또 적지 않는다 (불변식 21).
  //   ⚠ 색은 `areasNow()`(= CONFIG.families) 에서 받는다 — 점·부표와 같은 색이라야 향조가 이어진다.
  const terrPaths = [];

  // ── 마우스를 올린 향조 (범례). null 이면 아무것도 안 올렸다
  let famHover = null;
  /** 경계선 한 겹을 칠한다. 올렸으면 제 색으로 또렷하게, 아니면 아주 옅게 (gTerrEdge 주석) */
  /*
   * ⚠⚠ **평소에는 경계선을 안 긋는다** (2026-09-20 사용자 : *"영역 전체적으로 표현되었을때 무슨 외곽선이
   *   이상하게 그어져있는데 이부분도 지우고"*). 2026-09-18 에 0.4 로 늘 긋기로 했던 것을 되돌린다 —
   *   그때는 *"색만으로는 향조끼리의 경계가 뭉개진다"* 가 이유였는데, 지금은 마우스를 올리면 영역 전체가
   *   솟으므로(gFamHi) 평소의 그 선이 하는 일이 없다. 맞닿은 변이 두 번 칠해지던 문제도 같이 사라진다.
   *   ⚠ 해안선(`pCoast`)도 같은 이유로 걷었다 — 갈 수 있는 바다의 끝과 나란히 놓여 '테두리가 둘' 로 읽혔다.
   */
  function paintEdge(edge, on, amt) {
    edge.setAttribute('stroke-opacity', (on ? 0.95 * amt : 0).toFixed(3));
    edge.setAttribute('stroke-width', on ? 2.4 : 1);
  }
  /** 향조별 경로와 색 — 강조 겹이 **같은 경로를 다시 쓰려고** 받아 둔다 (drawTerr 가 채운다) */
  const famD = Object.create(null), famCol = Object.create(null);

  /**
   * 마우스를 올린 향조 하나를 **뽑아낸다** (범례 줄 · 지도 위 해역 둘 다).
   *
   * ⚠⚠ 2026-09-20 에 **뒤집혔다.** 여기 있던 규칙은 *"경계선만 다시 칠한다 — 면을 같이 밝히지 않는다 :
   *   아홉 색이 등휘도라 한 영역만 밝히면 그 영역이 아니라 나머지가 어두워진 것처럼 보인다"* 였다.
   *   사용자가 원한 것이 그 '나머지가 어두워지는' 쪽이다 (위 gFamHi 머리말) — **등휘도이기 때문에
   *   나머지를 실제로 내리는 것 말고는 하나를 뽑을 방법이 없다**는 판정으로 바꾼 것이다.
   * ⚠ 향수 점도 같이 가른다 — 사용자가 물은 것이 *"해당 향조의 향수가 어디있고"* 이기 때문이다.
   *   점은 화면 좌표 층(`gPts`)이라 마스크가 안 닿는다. 그래서 여기서 직접 흐리고 키운다.
   */
  function setFamHover(key) {
    if (famHover === key) return;
    famHover = key;
    const amt = terrAmt();
    for (const row of terrPaths) {
      if (row[2]) paintEdge(row[2], row[2].dataset.key === key, amt);
    }
    const d = key ? famD[key] : null;
    gFamHi.style.display = d ? '' : 'none';
    if (d) {
      const col = famCol[key] || PAL.accent;
      maskFamHole.setAttribute('d', d);
      pFamShade.setAttribute('d', d);
      pFamGlow.setAttribute('d', d);
      pFamGlow.setAttribute('stroke', col);
      pFamGlow.setAttribute('stroke-opacity', 0.85);
      pFamFill.setAttribute('d', d);
      pFamFill.setAttribute('fill', col);
      // ⚠ 1 로 채우지 않는다 — 아래 지형 · 해안선이 비쳐야 '그 해역' 이지 색종이가 아니다
      pFamFill.setAttribute('fill-opacity', 0.72);
    }
    if (map) {
      const pts = map.points;
      for (let i = 0; i < pts.length && i < gPts.childNodes.length; i++) {
        const c = gPts.childNodes[i];
        const mine = !key || pts[i].fam.key === key;
        c.setAttribute('opacity', mine ? 1 : 0.18);
        c.setAttribute('r', key && mine ? 3.6 : 2.6);
      }
    }
  }

  function drawTerr() {
    const amt = terrAmt();
    const on = amt > 0.01 && map && typeof map.toWorld === 'function';
    // ⚠ **세 겹을 다 끈다** — 색 겹(gTerrLit)을 빼먹어 chartTerrain 0 에서 색만 남았다 (실측으로 걸렸다)
    for (const el of [gTerr, gTerrLit, gTerrEdge]) el.style.display = on ? '' : 'none';
    if (!on) return;
    const fams = Object.fromEntries(areasNow().map((a) => [a.key, a]));
    const toH = (nx, ny) => { const w = map.toWorld(nx, ny); return [(ox + (w[0] - home.x0) * s).toFixed(1), (oy + (w[1] - home.z0) * s).toFixed(1)]; };
      // 신발끈 — 정규화 좌표 그대로의 면적 (부호 없음)
    const ringArea = (r) => {
      let v = 0;
      for (let i = 0; i < r.length; i += 2) {
        const j = (i + 2) % r.length;
        v += r[i] * r[j + 1] - r[j] * r[i + 1];
      }
      return Math.abs(v) / 2;
    };
  const ringD = (r, close) => {
      let d = '';
      for (let i = 0; i < r.length; i += 2) { const c = toH(r[i], r[i + 1]); d += (i ? 'L' : 'M') + c[0] + ' ' + c[1]; }
      return d + (close ? 'Z' : '');
    };
    while (terrPaths.length < TERRAIN.families.length) {
      const a = svgEl('path'), b = svgEl('path');
      // 경계선 — 확대해도 화면에서 같은 굵기다 (끝선과 같은 규약)
      const c = svgEl('path', { 'vector-effect': 'non-scaling-stroke' });
      gTerr.appendChild(a); gTerrLit.appendChild(b); gTerrEdge.appendChild(c);
      terrPaths.push([a, b, c]);
    }
    TERRAIN.families.forEach((f, i) => {
      const [el, lit, edge] = terrPaths[i], fam = fams[f.key];
      const col = (fam && fam.color) || PAL.sage;
      // ⚠ **작은 조각은 버린다** (RING_MIN 머리말). 신발끈 공식으로 정규화 면적을 재서 거른다 —
      //   지도 밖으로 흩어진 점 몇 개짜리 섬이 '영역' 처럼 보여 아홉 개가 열다섯 개로 읽혔다
      const d = f.rings.filter((r) => ringArea(r) >= RING_MIN).map((r) => ringD(r, true)).join('');
      // ⚠ 맞히기가 **이 경로를 그대로** 쓴다 (`areaAt`) — 그림과 판정이 한 몸이어야 한다 (hitAt 머리말)
      el.__key = f.key; el.__name = (fam && fam.name) || f.key;
      // 어디나 깔리는 겹 — 제 색의 TERR_A. ⚠ 채도를 조금만 뺀다 (많이 빼면 등휘도라 아홉이 같아진다)
      el.setAttribute('fill', desat(col, TERR_DESAT));
      el.setAttribute('fill-opacity', (TERR_A * amt).toFixed(3));
      el.setAttribute('d', d);
      // 지나온 곳에 **한 겹 더** — 제 색 그대로. 쌓이므로 탐색한 바다가 또렷하게 짙다
      lit.setAttribute('fill', col);
      lit.setAttribute('fill-opacity', (TERR_LIT_A * amt).toFixed(3));
      lit.setAttribute('d', d);
      // 경계선 — 제 색. 평소엔 옅고, 마우스를 올린 하나만 또렷해진다 (gTerrEdge 주석 · setFamHover)
      edge.dataset.key = f.key;
      edge.setAttribute('stroke', col);
      edge.setAttribute('d', d);
      paintEdge(edge, f.key === famHover, amt);
      // 강조 겹이 **같은 경로 · 같은 색**을 쓴다 (불변식 2 — 한 영역을 두 모양으로 그리지 않는다)
      famD[f.key] = d; famCol[f.key] = col;
    });
  }

  // 확대 · 이동을 한 줄로 먹인다. ⚠ 끝선은 `non-scaling-stroke` 라 배율을 따로 넘기지 않는다
  //   (v0.49.0 까지는 빗금 무늬를 배율로 나눠야 했다 — 무늬가 없어지면서 그 일도 없어졌다)
  function syncZoom() {
    gSea.setAttribute('transform', `translate(${tx.toFixed(2)} ${ty.toFixed(2)}) scale(${k.toFixed(4)})`);
    /*
     * ⚠⚠ 마스크를 흐리는 정도는 **배율로 나눠 준다.** 마스크 경로는 `gSea` 안이라 번짐이 user space 이고,
     *   그대로 두면 4배에서 띠가 4배로 부풀어 지도의 절반이 뿌예진다. 화면에서 같은 두께로 보여야
     *   '번짐' 이지, 지도와 같이 커지면 '넓은 얕은 바다' 라는 다른 뜻이 된다.
     */
    pNavShade.setAttribute('stroke-width', (NAV_SHADE_W / k).toFixed(2));
    fShadeBlur.setAttribute('stdDeviation', (NAV_SHADE_BLUR / k).toFixed(2));
    // 등심선 띠 — 여울 폭 · 번짐도 화면 기준
    // 등심선 고리 — 굵기 = 2r (경로 양쪽으로 r). **화면 px** 라 배율로 나눈다 (fRings 머리말)
    for (let i = 0; i < ringPaths.length; i++) ringPaths[i].setAttribute('stroke-width', (RINGS[i].r * 2 / k).toFixed(2));
    fFogBlur.setAttribute('stdDeviation', (FOG_SOFT / k).toFixed(2));
    // 강조 겹도 같다 — 번짐 · 그림자 거리 · 후광 굵기는 **화면에서** 일정해야 한다
    fFamBlur.setAttribute('stdDeviation', (FAM_BLUR / k).toFixed(2));
    pFamGlow.setAttribute('stroke-width', (FAM_GLOW_W / k).toFixed(2));
    pFamShade.setAttribute('transform', `translate(0 ${(FAM_LIFT / k).toFixed(2)})`);
    if (btnReset) btnReset.style.display = k > 1.01 ? 'block' : 'none';
  }

  /*
   * ── 향수 점 200개. 자리만 고쳐 쓴다 (만드는 것은 한 번)
   *
   * ⛔ **흰 테두리는 없다** (2026-09-21 사용자 : *"원형에 지금 흰색 외곽선이 있는데 이것 삭제"*).
   *   상아색 0.55 짜리 테를 둘렀던 것은 **판이 아이보리이던 시절**에 점을 밝은 종이에서 떼어 놓으려던
   *   장치다. 바다가 #21282F 로 내려간 지금은 점마다 흰 고리가 남아 200개가 한꺼번에 반짝인다 —
   *   불변식 28 의 *"바탕이 바뀌면 밝기를 전제한 층이 뒤집힌다"* 의 여섯 번째다 (글자 외곽선과 같은 이유).
   *
   * ⭐ 색은 **안개가 가른다** (PT_DESAT · PT_DIM 머리말) — 지나간 자리의 점만 제 색이다.
   */
  function drawPts() {
    const pts = map.points;
    while (gPts.childNodes.length < pts.length) gPts.appendChild(svgEl('circle', { r: 2.6 }));
    // ⚠ 격자는 **루프 밖에서 한 번** 읽는다 — `fogMask()` 는 미니맵을 거치는 호출이라 200번 부르지 않는다
    const fm = fogGrid();
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i], c = gPts.childNodes[i];
      c.setAttribute('cx', sx(p.x).toFixed(1));
      c.setAttribute('cy', sy(p.z).toFixed(1));
      c.setAttribute('fill', seen(fm, p.x, p.z) ? p.fam.color : shade(desat(p.fam.color, PT_DESAT), PT_DIM));
    }
    drawNames();
  }

  // ── 이름. **순위가 높은 것부터 놓고 겹치면 건너뛴다** (marks.js 의 이름표와 같은 규율 : 우선이 낮은 쪽이 비킨다).
  //   ⚠ 화면 밖은 아예 후보가 아니다 — 확대하면 그만큼 자리가 나 이름이 더 펴진다 (그게 확대의 뜻이다)
  let byRank = [];
  function drawNames() {
    const boxes = [];
    const hit = (b) => boxes.some(o => o.x0 < b.x1 && o.x1 > b.x0 && o.y0 < b.y1 && o.y1 > b.y0);
    // ① 향조 아홉이 먼저다 — 해도에서 가장 큰 글자이고 향수 이름이 이것을 비켜 간다
    const fams = Object.entries(map.familyAnchors).map(([key, a]) => {
      const p = map.points.find(q => q.fam.key === key);
      return { key, name: p ? p.fam.name : key, a, fam: p && p.fam };
    });
    meas.font = '600 ' + famFs + 'px ' + (getComputedStyle(stage).fontFamily || 'serif');
    const famPut = [];
    for (const f of fams) {
      const w = meas.measureText(f.name).width + famFs * 0.12 * f.name.length;
      const hw2 = w * 0.5 + 3;
      const x = Math.min(W - hw2, Math.max(hw2, sx(f.a.x))), y = sy(f.a.z) - 9;
      const b = { x0: x - hw2, x1: x + hw2, y0: y - famFs, y1: y + 3 };
      boxes.push(b);
      famPut.push({ f, x, y });
    }
    while (famPool.length < famPut.length) { const t = svgEl('text'); gFams.appendChild(t); famPool.push(t); }
    famPool.forEach((t, i) => {
      const it = famPut[i];
      if (!it) { t.style.display = 'none'; return; }
      t.style.display = '';
      t.setAttribute('x', it.x.toFixed(1)); t.setAttribute('y', it.y.toFixed(1));
      // ⚠ 바다 위에 앉는 글자라 `seaInk` 다 — 바탕이 #21282F 로 내려가 먹색은 안 읽힌다 (불변식 28)
      t.setAttribute('fill', rgba(PAL.seaInk, 0.9));
      t.textContent = it.f.name;
      t.__fam = it.f; t.__x = it.x; t.__y = it.y;
    });
    // ② 향수 이름 — 순위 순서로 놓는다
    const put = [];
    const mode = nameMode();
    // ⭐ 1 이면 **지나온 바다만** 적는다 (사용자 : *"내가 탐색한 이름만 노출"*). 2 는 전부 (시연용)
    const fm = mode === 1 ? fogGrid() : null;
    if (mode >= 1) {
      if (!byRank.length || byRank.length !== map.points.length) byRank = [...map.points].sort((a, b) => (a.rank || 999) - (b.rank || 999));
      for (const p of byRank) {
        if (fm && !seen(fm, p.x, p.z)) continue;
        const x = sx(p.x), y = sy(p.z);
        if (x < -60 || x > W + 60 || y < -30 || y > H + 30) continue;
        const t = p.labelKo || p.nameKo || p.name;
        const hw2 = textW(t) * 0.5 + 4.5, top = y - 6 - nameFs - 1.5, bot = y - 6 + 4;   // ⚠ 여백을 좁히면 이름이 서로 닿아 한 덩어리로 읽힌다
        const b = { x0: x - hw2, x1: x + hw2, y0: top, y1: bot };
        if (hit(b)) continue;
        boxes.push(b);
        put.push({ p, x, y: y - 6, t });
        if (put.length >= NAME_CAP) break;
      }
    }
    while (namePool.length < put.length) { const t = svgEl('text'); gNames.appendChild(t); namePool.push(t); }
    namePool.forEach((t, i) => {
      const it = put[i];
      if (!it) { t.style.display = 'none'; return; }
      t.style.display = '';
      t.setAttribute('x', it.x.toFixed(1)); t.setAttribute('y', it.y.toFixed(1));
      // 향수 이름도 바다 위다 (위 향조 이름과 같은 이유) — 향조보다 한 단 낮춰 위계를 남긴다
      t.setAttribute('fill', rgba(PAL.seaInk, 0.78));
      t.textContent = it.t;
    });
    named = new Set(put.map(o => o.p.i));
    famAt = famPut;
  }
  let named = new Set(), famAt = [];

  // ── 살아 있는 것들 (배 · 시야 · 가는 곳 · 호버). 값이 달라질 때만 고친다
  function drawLive() {
    const bx = sx(boat.x), by = sy(boat.z);
    if (sight > 0) {
      pFoot.style.display = '';
      pFoot.setAttribute('cx', bx.toFixed(1));
      pFoot.setAttribute('cy', by.toFixed(1));
      pFoot.setAttribute('r', Math.max(1, sight * s * k).toFixed(1));
    } else pFoot.style.display = 'none';
    if (target) {
      const txp = sx(target.x), typ = sy(target.z);
      pRoute.style.display = ''; cRing.style.display = '';
      pRoute.setAttribute('d', `M${bx.toFixed(1)} ${by.toFixed(1)} L${txp.toFixed(1)} ${typ.toFixed(1)}`);
      cRing.setAttribute('cx', txp.toFixed(1)); cRing.setAttribute('cy', typ.toFixed(1));
    } else { pRoute.style.display = 'none'; cRing.style.display = 'none'; }
    // 배 — 뱃머리를 향한 삼각형. ⚠ 뱃머리의 월드 방향 (−sin h, −cos h) · 화면은 z 가 아래라 같은 부호 (미니맵과 같다)
    const fx = -Math.sin(boat.head), fy = -Math.cos(boat.head), r = 8, w = 5;
    pBoat.setAttribute('d', `M${(bx + fx * r).toFixed(1)} ${(by + fy * r).toFixed(1)}`
      + ` L${(bx - fx * r * 0.6 - fy * w).toFixed(1)} ${(by - fy * r * 0.6 + fx * w).toFixed(1)}`
      + ` L${(bx - fx * r * 0.6 + fy * w).toFixed(1)} ${(by - fy * r * 0.6 - fx * w).toFixed(1)} Z`);
    if (hoverPt) {
      cHover.style.display = '';
      cHover.setAttribute('cx', sx(hoverPt.x).toFixed(1)); cHover.setAttribute('cy', sy(hoverPt.z).toFixed(1));
    } else cHover.style.display = 'none';
  }

  // ── 머리말 오른쪽 글. 호버가 없으면 지도 전체를 말한다
  function idleHint() {
    if (!hintEl || !map) return;
    const fm = minimap && minimap.fogMask && minimap.fogMask();
    const ex = fm ? ' · 탐색 ' + Math.round(100 * fm.n / Math.max(1, fm.bits.length)) + '%' : '';
    hintEl.textContent = '향수 ' + map.points.length + ex + (k > 1.01 ? ' · ' + k.toFixed(1) + '배' : '');
  }

  // ── 범례 아홉. 누르면 그 향조의 대표 향수 자리로 떠난다 (미니맵에서 해역 이름을 누른 것과 같은 뜻)
  function drawLegend() {
    if (!legend) return;
    legend.innerHTML = '';
    const head = document.createElement('div');
    head.style.cssText = 'flex:none;padding-bottom:9px;margin-bottom:6px;border-bottom:1px solid ' + PAL.chartLine
      + ';font-size:10px;font-weight:600;letter-spacing:0.2em;color:' + PAL.chartInk2;
    head.textContent = 'FAMILIES';
    legend.appendChild(head);
    // ⚠⚠ **순서와 번호는 `areas.js` 에서 받는다** (= CONFIG.families 의 배열 순서). 지도 데이터의
    //   `familyAnchors` 키 순서로 매기면 **존 정보 블록과 번호가 갈라진다** — 실측 : 해도는 '09 AMBER',
    //   정보 블록은 '07 AMBER ZONE' 이었다. ui.js 도 같은 배열의 findIndex 로 번호를 낸다 (불변식 2 · 21)
    //   ⚠ 번호는 **거른 뒤의 순서가 아니라** 원래 배열의 자리다 — 향수가 없는 향조가 생기면 갈라진다
    const list = areasNow().map((a, n) => ({ key: a.key, no: n + 1 })).filter(o => map.familyAnchors[o.key]);
    list.forEach(({ key, no }) => {
      const pts = map.points.filter(p => p.fam.key === key);
      if (!pts.length) return;
      const fam = pts[0].fam;
      const row = document.createElement('button');
      row.style.cssText = 'display:flex;align-items:center;gap:9px;width:100%;padding:7px 6px;border:none;border-radius:6px;'
        + 'background:none;font-family:inherit;text-align:left;cursor:pointer;color:' + PAL.chartInk + ';';
      row.innerHTML = '<span style="flex:none;width:15px;font-size:9.5px;letter-spacing:0.06em;color:' + PAL.chartInk2 + ';">'
        + String(no).padStart(2, '0') + '</span>'
        + '<span style="flex:none;width:9px;height:9px;border-radius:50%;background:' + fam.color + ';"></span>'
        + '<span style="flex:1;min-width:0;"><span style="display:block;font-size:11px;font-weight:600;letter-spacing:0.16em;">'
        + fam.name + '</span><span style="display:block;margin-top:1px;font-size:10.5px;color:' + PAL.chartInk2 + ';">'
        + ((fam.kw && fam.kw[0]) || '') + '</span></span>'
        + '<span style="flex:none;font-size:10px;color:' + PAL.chartInk2 + ';">' + pts.length + '</span>';
      // ⭐ 2026-09-18 : 지도에서 **그 해역의 경계선이 밝아진다** (setFamHover — 사용자 요청)
      row.onmouseenter = () => { row.style.background = PAL.chartRow; if (hintEl) hintEl.textContent = fam.name + ' 해역 · 향수 ' + pts.length; setFamHover(key); };
      row.onmouseleave = () => { row.style.background = 'none'; idleHint(); setFamHover(null); };
      row.onclick = () => {
        const a = map.familyAnchors[key];
        pick({ key, name: fam.name, x: a.x, z: a.z, custom: true });
      };
      legend.appendChild(row);
    });
    const tail = document.createElement('div');
    tail.style.cssText = 'flex:none;margin-top:auto;padding-top:10px;font-size:10px;line-height:1.7;color:' + PAL.chartInk2;
    tail.textContent = '해역을 누르면 그리로 떠납니다\n휠 확대 · 끌어 이동 · ESC 닫기';
    tail.style.whiteSpace = 'pre-line';
    legend.appendChild(tail);
  }

  /*
   * ⭐⭐⭐ **'이 자리가 무슨 해역인가' 는 칠해진 면에 물어본다** (2026-09-21 사용자 :
   *   *"빈 공간에도 자꾸 영역표시가 뜨는데 … 색상이 칠해져있는 공간에만 영역이라는 걸 알려줘야할듯"*).
   *
   *   ⚠⚠ 여태는 `map.regionAt(x, z)` 였다 — 그건 **가장 가까운 향수의 향조**를 돌려주는 함수라
   *     (scentmap.js : 200개를 훑어 최근접) 향 영역에서 한참 떨어진 빈 바다에서도 늘 무언가를 답한다.
   *     그림(칠해진 면)과 판정(최근접)이 **다른 것을 보고 있었다.**
   *
   *   ⭐ `isPointInFill` 은 **그 경로의 실제 채움**을 묻는다 — `fill-rule: evenodd` 까지 그대로 따르므로
   *     고리 안의 구멍도 옳게 빠지고, `RING_MIN` 으로 걸러 낸 작은 조각도 애초에 경로에 없어 자동으로 빠진다.
   *     hitAt 의 규율(*"여유 없이 그린 경계 그대로 판정한다"*)을 향 영역에도 그대로 적용한 것이다.
   *   ⚠ 점은 **`gSea` 의 확대 전 좌표**(집 좌표)라야 한다 — 경로의 `d` 가 그 좌표계이고 확대는 조상
   *     그룹의 transform 이다. `(화면 − t) / k` 가 그 역변환이다.
   *   ⚠ 지형을 끄면(`chartTerrain 0`) 경로가 비어 있어 아무 데서도 안 맞는다 — 그게 맞는 동작이다.
   */
  function areaAt(px, py) {
    if (!svg.createSVGPoint || !terrPaths.length) return null;
    const p = svg.createSVGPoint();
    p.x = (px - tx) / k; p.y = (py - ty) / k;
    for (const row of terrPaths) {
      const el = row[0];
      if (!el.__key || !el.getAttribute('d')) continue;
      if (el.isPointInFill && el.isPointInFill(p)) return { key: el.__key, name: el.__name };
    }
    return null;
  }

  // ── 맞히기. 화면 px → 월드 → (향수 · 향조 이름 · 빈 바다 · 범위 밖)
  function hitAt(e) {
    const r = stage.getBoundingClientRect();
    const px = e.clientX - r.left, py = e.clientY - r.top;
    const [x, z] = toW(px, py);
    // ⚠ 2026-09-13 : 여유(mapMargin) 없이 **그린 경계 그대로** 판정한다. 바깥을 한 색으로 칠하자 그 안쪽 20 월드를
    //   누르면 떠나는 것이 '갈 수 없는 바다를 눌렀는데 간다' 로 읽혔다 — 그림과 판정이 같아야 한다
    const out = boundOn() && !map.inNav(x, z, 0);
    // 향조 이름이 먼저다 (해역을 고르는 것이 해도의 뜻이다) — 그 다음이 향수 점
    let label = null, bd = LABEL_R;
    for (const it of famAt) { const d = Math.hypot(px - it.x, py - (it.y - famFs * 0.4)); if (d < bd) { bd = d; label = it; } }
    let pt = null, pd = SNAP;
    if (!label) for (const p of map.points) { const d = Math.hypot(px - sx(p.x), py - sy(p.z)); if (d < pd) { pd = d; pt = p; } }
    // ⚠ 둘을 **가른다** : `area` 는 칠해진 면(= 보이는 것 · 호버가 읽는다) · `reg` 는 최근접 향조
    //   (= 빈 바다를 눌렀을 때 '어디로 떠나는가' 만 정한다 — onUp). 호버에 `reg` 를 쓰면 빈 바다가 해역이 된다
    const area = out ? null : areaAt(px, py);
    const reg = out ? null : map.regionAt(x, z);
    return { px, py, x, z, out, label: out ? null : label, pt: out ? null : pt, area, reg };
  }

  function pick(t) { close(); onPick && onPick(t); }

  // ── 누르기 · 끌기 · 휠
  const drag = { on: false, id: null, px: 0, py: 0, moved: 0 };
  // 손가락 첫 탭의 미리보기 (onUp · v0.87.0)
  let tapArm = null;
  const onDown = (e) => {
    if (e.button !== 0) return;
    drag.on = true; drag.id = e.pointerId; drag.px = e.clientX; drag.py = e.clientY; drag.moved = 0;
    stage.setPointerCapture && stage.setPointerCapture(e.pointerId);
  };
  const onMove = (e) => {
    if (!map) return;
    if (drag.on && e.pointerId === drag.id) {
      const dx = e.clientX - drag.px, dy = e.clientY - drag.py;
      drag.px = e.clientX; drag.py = e.clientY;
      drag.moved += Math.abs(dx) + Math.abs(dy);
      if (k > 1.01) {
        tx += dx; ty += dy; clampPan();
        syncZoom(); drawPts(); drawLive();
        stage.style.cursor = 'grabbing';
        return;
      }
    }
    const h = hitAt(e);
    hoverPt = h.pt;
    // ⚠ 글은 **한 번만 짓는다** — 머리말과 커서 옆 이름표가 같은 말을 해야 한다 (불변식 2)
    const say = h.out ? '범위 없음'
      : h.label ? h.label.f.name + ' 해역'
      : h.pt ? ((h.pt.labelKo || h.pt.nameKo || h.pt.name) + ' · ' + h.pt.fam.name
          + (seen(fogGrid(), h.pt.x, h.pt.z) ? '' : ' · 미탐색'))
      : h.area ? h.area.name + ' 해역' : '빈 바다';
    if (hintEl) hintEl.textContent = say;
    moveTip(e, say);
    stage.style.cursor = h.out ? 'not-allowed' : (h.label || h.pt) ? 'pointer' : 'crosshair';
    /*
     * ⭐ 지도 위에서도 같은 강조가 걸린다 (2026-09-20) — 범례 줄에만 있으면 지도를 보는 동안에는
     *   아홉이 그대로라 *"어디있는지 확실히 구별"* 이 안 된다.
     *   ⚠ 호버만이다 — **누르기는 '그 해역으로 떠난다' 가 이미 차지하고 있다** (아래 onUp · 불변식 21).
     */
    // ⚠ `h.reg` 가 아니라 `h.area` 다 — 칠해진 면 위에서만 해역이 밝아진다 (areaAt 머리말)
    setFamHover(h.out ? null : h.label ? h.label.f.key : h.pt ? h.pt.fam.key : h.area ? h.area.key : null);
    drawLive();
  };
  const onUp = (e) => {
    const wasDrag = drag.on && drag.moved > 5;
    if (drag.on && e.pointerId === drag.id) {
      drag.on = false;
      stage.releasePointerCapture && stage.hasPointerCapture && stage.hasPointerCapture(e.pointerId) && stage.releasePointerCapture(e.pointerId);
      stage.style.cursor = 'crosshair';
    }
    if (wasDrag || !map) return;
    const h = hitAt(e);
    if (h.out) { onBlocked && onBlocked(); return; }
    // ⭐ 손가락이면 첫 탭은 미리보기 — 머리말 · 커서 옆 이름표가 무엇인지 말하고, 같은 것을 3초 안에 다시 누르면 떠난다 (v0.87.0 · minimap.js 와 같은 규약)
    if (e.pointerType && e.pointerType !== 'mouse') {
      const key = h.label ? 'L:' + h.label.f.key : h.pt ? 'P:' + h.pt.x.toFixed(2) + ',' + h.pt.z.toFixed(2) : h.reg ? 'R:' + h.reg.key : null;
      const now = performance.now();
      if (key && (!tapArm || tapArm.key !== key || now - tapArm.t > 3000)) {
        tapArm = { key, t: now };
        onMove(e);
        if (hintEl) hintEl.textContent += ' · 한 번 더 누르면 출발';
        return;
      }
      tapArm = null;
    }
    if (h.label) { const a = h.label.f.a; pick({ key: h.label.f.key, name: h.label.f.name, x: a.x, z: a.z, custom: true }); return; }
    if (h.pt) { pick({ key: h.pt.fam.key, name: h.pt.fam.name, x: h.pt.x, z: h.pt.z, custom: true, spot: true }); return; }
    if (h.reg) pick({ key: h.reg.key, name: h.reg.name, x: h.x, z: h.z, custom: true, spot: true });
  };
  // ⚠ 지도 밖으로 나가면 강조도 같이 푼다 — 안 풀면 마지막 해역이 밝은 채로 굳고 나머지 점이 계속 흐리다
  // ⚠ 손가락은 떼는 순간 pointerleave 가 따라온다 — 첫 탭의 미리보기(tapArm)를 걸어 둔 참이면 지우지 않는다 (v0.87.0)
  const onLeave = (e) => { if (e && e.pointerType && e.pointerType !== 'mouse' && tapArm) return; hoverPt = null; tip.style.display = 'none'; setFamHover(null); idleHint(); drawLive(); };
  // 휠 — 커서 아래 바다가 제자리에 있도록 배율을 바꾼다
  const onWheel = (e) => {
    e.preventDefault();
    const r = stage.getBoundingClientRect();
    const px = e.clientX - r.left, py = e.clientY - r.top;
    const k0 = k;
    k = Math.min(K_MAX, Math.max(1, k * Math.exp(-e.deltaY * 0.0016)));
    if (k === k0) return;
    tx = px - (px - tx) * (k / k0); ty = py - (py - ty) * (k / k0);
    clampPan(); syncZoom(); drawPts(); drawLive(); idleHint();
  };

  function resetZoom() { k = 1; clampPan(); syncZoom(); drawPts(); drawLive(); idleHint(); }

  // ── 열기 · 닫기
  // ⭐⭐ **앱에 해도가 열렸다고 알린다** (2026-09-21) — `<html data-chart>` 한 장 (`data-time` 과 같은 규약).
  //   ⚠⚠ 해도는 **iframe 안**이라 z-index 를 아무리 올려도 앱이 3D 위에 얹은 것(검색창 · 향해 일지 ·
  //     선실 말풍선)을 못 덮는다 — 그것들은 iframe **밖**, 부모 문서에 있다. 스태킹이 아니라 **문서가 다르다.**
  //     그래서 덮는 대신 **앱이 비켜야** 하고, 비키려면 열렸다는 것을 알아야 한다 (`ScentScene` 의 onChartChange).
  //   ⚠ 앱의 유리판 헤더는 그대로 둔다 — 해도가 `--pb-host-top` 만큼 그 아래에 서는 것이 원래 설계다 (불변식 23).
  const tellHost = (on) => {
    const html = document.documentElement;
    if (on) html.dataset.chart = '1'; else delete html.dataset.chart;
  };

  function openIt() {
    if (open || !map) return;
    open = true;
    tellHost(true);
    box.style.display = 'flex';   // ⚠ flex 다 — 판을 가운데 놓는다 (index.html 의 align/justify 가 여기서 산다)
    k = 1; tx = 0; ty = 0;
    mapKey = '';
    ensure();
    idleHint();
  }
  function close() {
    if (!open) return;
    open = false;
    tellHost(false);
    box.style.display = 'none';
    hoverPt = null;
    drag.on = false;
    // ⚠ 닫을 때 경계선 강조를 거둔다 — 범례를 지우며 onmouseleave 가 안 오는 길이 있다 (다시 열면 켜진 채다)
    setFamHover(null);
  }
  // 지도가 바뀌었거나 처음 열었으면 다시 배치한다
  function ensure() {
    const key = map.size + '|' + map.minGap + '|' + map.flipY + '|' + (boundOn() ? margin() + '@' + map.navReach : 'x') + '|' + Math.round(stage.clientWidth) + 'x' + Math.round(stage.clientHeight);
    if (key === mapKey) return false;
    mapKey = key;
    layout(); drawLegend(); drawLive();
    return true;
  }

  // ⚠ 방향키가 **조타로 새지 않게** 가둔다 (input.js 는 window 에 붙어 있다). 캡처에서 잡아야 먼저 온다.
  //   ESC 도 여기서 먹는다 — 안 그러면 main.js 의 onKeyExit 이 존까지 같이 나간다
  const onKey = (e) => {
    if (!open) return;
    if (e.key === 'Escape') { e.stopPropagation(); e.preventDefault(); close(); return; }
    if (e.key.startsWith('Arrow') || e.key === 'Shift') { e.stopPropagation(); }
  };
  window.addEventListener('keydown', onKey, true);
  window.addEventListener('keyup', onKey, true);
  const onResize = () => { if (open) { mapKey = ''; ensure(); drawLive(); } };
  window.addEventListener('resize', onResize);
  stage.addEventListener('pointerdown', onDown);
  stage.addEventListener('pointermove', onMove);
  stage.addEventListener('pointerup', onUp);
  stage.addEventListener('pointerleave', onLeave);
  stage.addEventListener('wheel', onWheel, { passive: false });
  if (btnOpen) btnOpen.addEventListener('click', openIt);
  if (btnClose) btnClose.addEventListener('click', close);
  if (btnReset) btnReset.addEventListener('click', resetZoom);
  if (veil) veil.addEventListener('click', close);

  return {
    // main.js 의 tick 에서 미니맵과 **같은 값**을 받는다. ⚠ 닫혀 있으면 값만 갈아 두고 그리지 않는다
    update({ map: m, boat: b, target: t, sight: g }) {
      if (m && m !== map) { map = m; mapKey = ''; }
      boat = b || boat; target = t || null; sight = g || 0;
      if (btnOpen) btnOpen.style.display = m ? 'flex' : 'none';
      if (!open || !map) return;
      if (ensure()) { drawLive(); return; }
      // 안개는 배가 지나가며 자란다 — 칸 수가 달라졌을 때만 그림을 다시 만든다
      const fm = minimap && minimap.fogMask && minimap.fogMask();
      // ⚠ 이름이 안개를 타므로 **이름도 같이** 다시 앉는다 (안개만 고치면 새로 밝힌 곳에 이름이 안 뜬다)
      // ⚠⚠ 2026-09-21 : `drawNames()` → **`drawPts()`** — 이제 **점 색도** 안개를 탄다 (PT_DESAT 머리말).
      //   이름만 다시 그리면 새로 지나간 향수의 이름은 뜨는데 점은 회색인 채로 굳는다.
      //   `drawPts()` 가 끝에 `drawNames()` 를 부르므로 이름은 그대로 따라온다
      if (fm && fm.n !== fogN) { buildFog(); drawSea(); drawPts(); idleHint(); }
      const key = [Math.round(b.x * 4), Math.round(b.z * 4), Math.round(b.head * 40),
        t ? Math.round(t.x) + ',' + Math.round(t.z) : '-', Math.round(sight)].join('|');
      if (key === lastLive) return;
      lastLive = key;
      drawLive();
    },
    open: openIt,
    close,
    isOpen: () => open,
    report() {
      if (!map) return '해도 — 지도 없음';
      const fm = fogGrid();
      return `해도 ${open ? '열림' : '닫힘'} · ${W}×${H} · 배율 ${k.toFixed(2)} · 이름 ${named.size}/${map.points.length}`
        + ` (모드 ${nameMode()}${fm ? ' · 밝힌 칸 ' + fm.n : ' · 안개 꺼짐'})`
        + ` · 향 영역 ${TERRAIN.families.length}개 고리 ${TERRAIN.families.reduce((a, f) => a + f.rings.length, 0)} · 해안선 ${TERRAIN.coast.length}`
        + ` · 바다 고리 ${map.navLoops ? map.navLoops().length : 0} · 안개 윤곽 ${fog.loops.length}고리 (${fog.key})`;
    },
    dispose() {
      window.removeEventListener('keydown', onKey, true);
      window.removeEventListener('keyup', onKey, true);
      window.removeEventListener('resize', onResize);
      stage.removeEventListener('pointerdown', onDown);
      stage.removeEventListener('pointermove', onMove);
      stage.removeEventListener('pointerup', onUp);
      stage.removeEventListener('pointerleave', onLeave);
      stage.removeEventListener('wheel', onWheel);
      if (btnOpen) btnOpen.removeEventListener('click', openIt);
      if (btnClose) btnClose.removeEventListener('click', close);
      if (btnReset) btnReset.removeEventListener('click', resetZoom);
      if (veil) veil.removeEventListener('click', close);
      // ⚠ 속성을 걷어 둔다 — 남으면 앱의 검색창 · 향해 일지가 영영 비킨 채다 (불변식 10 의 규율)
      tellHost(false);
      box.style.display = 'none';
      stage.innerHTML = '';
      if (legend) legend.innerHTML = '';
      open = false;
    }
  };
}
