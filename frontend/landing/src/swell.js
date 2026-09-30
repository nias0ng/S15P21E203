import { PARAMS as P } from './params.js';   // ⚠ params.js 는 아무것도 import 하지 않는다 (순환 없음)

// ───────── 해석적 너울 ─────────
// 시뮬 격자와 무관하게 월드 전체에 깔리는 정현파의 합. 화면의 파도는 대부분 이것이다.
// 너울 4대역 + 잔물결 2대역.
//
// 불변식 : GLSL(swellH / swellG / swellD)과 CPU 사본(swellCPU)은 항상 같은 식이어야 한다.
//   수면·그리드·물보라는 GPU 쪽을, 배의 부력은 CPU 쪽을 쓴다. 어긋나면 배가 잠기거나 뜬다.
//   그래서 넷 다 아래 BANDS 표 하나에서 생성한다 — 어긋날 방법이 없다.
//
// ─── BANDS 를 만질 때 알아야 하는 것 네 가지 ───
//
// ① 방향이 가장 중요하다. 큰 각도로 교차하는 파들은 마루가 이어지지 않고 달걀판(격자)
//    무늬를 만든다. 예전에 −69°~+115° 로 180° 넘게 퍼뜨렸다가 정확히 그렇게 됐다.
//    실제 바다는 방향 분산 함수 때문에 에너지가 바람 방향 ±30° 안에 몰려 있고, 그래서
//    마루가 길게 이어진다. 지금은 전부 주방향 −45° 의 ±20° 안에 있다.
//    주방향 −45° = 월드 (+x, −z). 카메라가 −z 를 보므로 화면에서 왼쪽 아래 → 오른쪽 위로 간다.
//
// ② 스케일의 기준은 배다 (2.48 월드). 파도 하나에 배가 1~3척 들어와야 '파도'로 읽힌다.
//    16.5척이던 시절에는 파도가 아니라 지형이었고 "등고선이 움직이는" 것으로 보였다.
//    threejswaterpro 의 프리셋을 실측해보면 '파도다운' 프리셋의 첨두파장 ÷ 배 길이가
//    1.0~1.3 이다. 지금 주파장 3.20 → 1.29척.
//
// ③ 파장을 줄이면 가파름(= 2σ ÷ 파장)이 그만큼 올라간다. 진폭을 같이 내리지 않으면
//    부서짐 영역(H/λ > 1/7)을 넘고 Gerstner 루프 한계도 깨진다. 지금 2σ 0.49 / 15.4%.
//
// ④ 위상 오프셋 p 가 없으면 모든 대역이 원점에서 위상이 맞아 같은 자리에서 같이 솟는다 —
//    파도가 전부 같은 높이로 보이는 원인이다. 고정된 난수값이라 새로고침해도 그림은 같다.
//    파장을 4.60~2.60 으로 촘촘히 둔 것도 의도적이다. 가까운 파수끼리 맥놀이를 일으켜
//    하나의 긴 마루가 자리마다 높낮이가 달라진다.
//
// 각속도 w 는 심해 중력파 분산관계 ω = 0.62·√(g·k) 에서 뽑았다. 긴 파가 빠르고 짧은 파가
// 느린 관계가 맞아야 파들이 서로 미끄러지지 않는다.
// beta 는 2차 조화파 : h = A·(sin φ − β·cos 2φ). 마루를 좁히고 골을 넓힌다.
// Gerstner 가 루프 한계에 막혀 더 못 올라가므로 비대칭은 이쪽으로 만든다. β > 0.18 은 쓰지 않는다.
//
// d = 진행 방향(단위벡터), k = 파수(2π/파장), w = 각속도, a = 대역군 안에서의 상대 진폭
// group : 'swell' 은 uSwellA(oceanSwell), 'ripple' 은 uRippleA(ripple) 로 크기가 조절된다
// ⑤ 파장 간격을 일부러 불규칙하게 둔다. 등간격으로 놓으면 마루가 골함석처럼 규칙적으로
//    줄지어 서고, 그것도 파도로 안 읽힌다 (방향만 좁히고 간격을 고르게 뒀다가 그렇게 됐다).
//    5.60 / 4.40 / 3.70 / 3.20 / 2.90 / 2.25 처럼 촘촘한 데와 성긴 데를 섞으면
//    가까운 파수끼리 맥놀이를 일으켜 파도가 '무리지어 몰려오는' 리듬이 생긴다.
// ⚠ 방향의 **퍼짐**이 마루 길이를 정한다. 좁으면 길게 이어지고(골판지), 넓으면 짧게
// 끊긴다(달걀판 격자). 2026-09-02 : 30도(−28~−58) → 40도(−25~−65) 로 넓혔다.
// 실측 (마루 방향 자기상관이 0.5 로 떨어지는 거리) : 3.48 → 2.40 월드.
// 50도까지 넓히면 1.92 로 진행 방향 상관거리(0.60)의 3배까지 내려와 격자 쪽으로 기운다.
// 방향 자체를 바꾸려면 여덟 줄을 **같은 각만큼** 돌린다. 하나만 돌리면 그 대역이 어긋나 무늬가 뜬다
// ⑥ ⚠⚠ **스케일이 하나뿐이면 어디를 봐도 같은 결이 된다.** 2026-09-03 자유 시점을 붙이고
//    카메라를 움직여 보니 그게 드러났다 ("답답하다 · 너무 일정한 파도").
//    실측 : 파장이 1.60~5.60 뿐이라 **스펙트럼 배율이 3.5배**고, 가장 긴 파도 화면에 6.8번
//    들어온다. 즉 화면을 가로지르는 **큰 것이 없다.** 마루 높이의 들쭉날쭉함은 오히려
//    괜찮았다 (최대/평균 2.34, 변동계수 0.56) — 모자란 것은 '높낮이'가 아니라 **크기의 층위**다.
//    실제 바다 사진에는 화면을 덮는 너울 + 그 위의 잔파도 + 더 잔 물결이 같이 있다 (배율 50배 이상).
//    그래서 **긴 너울 두 대역**(16.0 / 9.6)을 아래에 깔았다. 배율 3.5 → 10.0.
//    ⚠ ②의 "16.5척이면 지형이 된다" 와 모순되지 않는다. 그때는 그게 **유일한 스케일**이었다.
//    지금은 주파(3.20)를 그대로 두고 그 밑에 깔았으므로, 배는 여전히 파도를 타고 긴 너울은
//    그 파도들을 **무리지어 들어올린다.** 그게 사진에서 보이는 리듬이다.
//    ⚠ 긴 파는 가파르면 안 된다. 가파름은 a·k 인데 λ16 은 k 가 0.39 라 a 를 1 가까이 줘도
//    주파(1.18 × 1.96 = 2.32)의 4분의 1이다 — 높이만 얹고 각은 안 세운다.
// ⑦ ⚠⚠ **크기의 층위(⑥)를 넓히는 것과 군집(무리지어 몰려옴)은 서로를 깎는다** (2026-09-06).
//    사용자 : "잔잔한 영역도 있을 것이고 파도가 심하게 몰아치는 부분도 있을 텐데,
//    지금은 **모든 맵의 모든 면적**이 일정한 파도를 유지하려고 한다."
//    ⚠ 이걸 BANDS 로 풀려고 하지 마라. 정현파 합은 진폭이 상수라 통계적으로 **균질**하다 —
//    맵 어디서나 파도의 세기가 같다. 그건 인상이 아니라 이 모델의 정의다.
//    실측 : 12×12 월드(카메라 폭) 상자별 국소 RMS 의 변동계수가 **0.072**, 상자 p90/p10 이
//    **1.21** 이다. 즉 화면 안 어느 두 자리를 비교해도 파고가 21% 안에서 같다.
//    ⚠ 대역을 늘리는 것으로도 못 고친다. 무작위 위상 정현파 합의 포락선은 레일리라
//    군집도(GF)에 대역 수·스펙트럼과 **무관한 상한**이 있다 (파도-물리.md 8-2 의 스윕이
//    10~96대역에서 0.22~0.50 에 갇힌 진짜 이유다 — N_eff 는 반복성 지표의 이유이지
//    군집도의 이유가 아니다).
//    → 그래서 **BANDS 는 한 줄도 안 바꿨다.** ⑥이 얻은 배율 16배를 그대로 두고,
//      군집은 아래 MOD(군 포락선)라는 **별도의 축**에서 번다. 두 요구가 같은 손잡이를
//      두고 싸우지 않게 축을 분리한 것이 이 설계의 요점이다.
const BANDS = [
  // ── 주 너울 8대역. ⚠ 방향·상대진폭·위상은 v0.11 그대로다 (긴 마루를 지키는 값들이라
  //   손대지 않았다). **파장만 2.5배**로 늘렸다.
  { d: [0.6157, -0.7880], k: 0.1571, w: 0.7696, a: 0.95, b: 0.015, p: 1.07, group: 'swell' },  // 40.0, −52°
  { d: [0.7880, -0.6157], k: 0.2618, w: 0.9936, a: 0.72, b: 0.025, p: 4.28, group: 'swell' },  // 24.0, −38°
  { d: [0.4226, -0.9063], k: 0.4488, w: 1.3009, a: 0.55, b: 0.030, p: 2.13, group: 'swell' },  // 14.0, −65°
  { d: [0.8387, -0.5446], k: 0.5712, w: 1.4676, a: 0.70, b: 0.040, p: 5.07, group: 'swell' },  // 11.0, −33°
  { d: [0.5878, -0.8090], k: 0.6793, w: 1.6005, a: 0.95, b: 0.060, p: 0.84, group: 'swell' },  // 9.25, −54°
  { d: [0.7071, -0.7071], k: 0.7854, w: 1.7210, a: 1.18, b: 0.070, p: 3.96, group: 'swell', main: true },  // 8.00, −45° ← 주파
  { d: [0.8910, -0.4540], k: 0.8666, w: 1.8078, a: 0.80, b: 0.050, p: 1.52, group: 'swell' },  // 7.25, −27°
  { d: [0.5000, -0.8660], k: 1.1170, w: 2.0524, a: 0.45, b: 0.025, p: 4.71, group: 'swell' },  // 5.63, −60°
  // ── ⑧ 교차 너울 (2026-09-06). 사용자 : "한 곳으로 흐르는 것 맞지만 **여러 방향으로 파도가
  //   형성되고 사라져야 함**". 주방향에서 59~81도 떨어진 **두 번째 계열**이다.
  //   ⚠⚠ 주석 ①의 '달걀판' 경고는 **스펙트럼 전체를 180도로 편** 실패였다. 여기는 다르다 —
  //     에너지의 **12.2%**(진폭비 0.37)뿐이라 주 계열이 여전히 마루를 길게 끌고, 교차 계열은
  //     그 위에서 자리마다 마루를 꺾고 끊는다. 이 비율을 올리면 그때 달걀판이 된다.
  //   ⚠ 파장을 주 계열과 **어긋나게** 둔다 (13.0 / 8.6 / 5.4). 같은 파장이면 두 계열이
  //     한 무늬로 잠겨 방향이 안 읽힌다.
  //   ⚠ 크기는 params.crossAmount 가 정한다 (0 = 이 계열만 정확히 꺼진다 · 롤백)
  { d: [0.9703,  0.2419], k: 0.4833, w: 1.3500, a: 0.62, b: 0.030, p: 2.41, group: 'cross' },  // 13.0, +14°
  { d: [0.8090,  0.5878], k: 0.7306, w: 1.6598, a: 0.48, b: 0.030, p: 5.88, group: 'cross' },  // 8.60, +36°
  { d: [0.9994, -0.0349], k: 1.1636, w: 2.0947, a: 0.36, b: 0.020, p: 0.97, group: 'cross' },  //  5.4,  −2°
  // ── 잔물결. ⚠⚠ 방향을 주 계열보다 **넓게 편다** (−6 ~ −84도). 실제 바다도 짧은 파일수록
  //   방향 분산이 크고, 작은 파는 교차해도 긴 마루를 안 끊는다 — 달걀판이 되는 것은 큰 파끼리다.
  { d: [0.9063, -0.4226], k: 1.3228, w: 2.2334, a: 1.00, b: 0.000, p: 2.88, group: 'ripple' }, // 4.75, −25°
  { d: [0.6293, -0.7771], k: 1.5708, w: 2.4338, a: 0.55, b: 0.000, p: 0.31, group: 'ripple' }, // 4.00, −51°
  { d: [0.8192, -0.5736], k: 2.0106, w: 2.7535, a: 0.42, b: 0.000, p: 5.62, group: 'ripple' }, // 3.13, −35°
  { d: [0.3746, -0.9272], k: 2.5133, w: 3.0785, a: 0.26, b: 0.000, p: 1.93, group: 'ripple' }, // 2.50, −68°
  // ⚠ 2026-09-06 추가 — 사용자 : "완만한 파도를 이루더라도 **작은 물결의 파도가 존재**하고 있고".
  //   파장을 2.5배로 늘리면서 옛 잔물결이 4.75~2.50 이 되어 더는 '잔물결' 이 아니게 됐다.
  //   ⚠ 최단 1.20 은 정점 5.6개다 (하한 4). 12Hz 게이트에서 주기당 표본 17개 — 안전하다
  { d: [0.9945, -0.1045], k: 3.6960, w: 3.7333, a: 0.30, b: 0.000, p: 3.44, group: 'ripple' }, // 1.70,  −6°
  { d: [0.1045, -0.9945], k: 5.2360, w: 4.4435, a: 0.22, b: 0.000, p: 0.62, group: 'ripple' }  // 1.20, −84°
];

// ───────── 군 포락선 (MOD) ─────────
// h = E_s(p,t)·Σ_너울 + detail·E_r(p,t)·Σ_잔물결.
// 진폭을 **상수에서 「군속도로 흐르는 공간·시간의 장」으로** 바꾼다. 그래야 맵의 면적이 갈린다.
//
// ⚠⚠ **왜 fbm/hash 가 아니라 정현파인가 — 불변식 2 때문이다.**
//   fract(sin(x)*43758.5453) 은 GLSL highp sin 과 JS Math.sin 의 마지막 1 ulp 차이가
//   fract 에서 통째로 다른 값이 된다. GPU 와 CPU 가 같은 좌표에서 다른 포락선을 보게 되고,
//   그건 배가 그 자리에서 잠긴다는 뜻이다. 정현파 4항은 조건수가 좋아 양쪽 차이가 1e-15 다.
//
// ⚠⚠ **w 는 튜닝값이 아니라 유도값이다 : w = cg · (n̂·d) · k.**
//   포락선은 위상속도가 아니라 **군속도**로 흐른다 (파도-물리.md 2-2). 그래야 마루가 군의
//   뒤에서 태어나 군을 앞질러 가로지르고 앞쪽에서 사라진다 — 사용자 요구 2번이 여기서
//   **공짜로** 나온다. n̂ = 진폭가중 평균 방향 (−45.82°, swellMeanDir 과 같은 값).
//   ⚠ w 를 임의로 주면 포락선이 파도를 가로질러 미끄러지고 그 관계가 통째로 깨진다.
//
// ⚠ **cg 를 항마다 다르게 준다.** 전부 같으면 무늬가 **강체 평행이동**만 해서 군이 태어나지도
//   죽지도 않는다 (한 무늬가 지나갈 뿐이다). 실제 바다의 군속도는 대역마다 다르다
//   (cg = ω/2k : λ16 → 1.549 · λ3.20 → 0.693 · λ2.25 → 0.581). 주파의 0.693 을 중심으로
//   벌려 잡되 **위상속도 1.386 보다 반드시 느리게** 둔다 — 안 그러면 군이 마루를 앞지른다.
//
// ⚠ **여기서만은 방향을 넓게 벌린다** (주방향 기준 −26° / +31° / +67° / −74°).
//   BANDS 주석 ①의 달걀판 경고는 **마루끼리** 교차할 때의 것이고, 포락선에는 마루가 없다.
//   좁게 두면 거친 띠가 무한히 이어져 '줄무늬 바다'가 되고, 벌려야 유한한 **얼룩**으로 끊긴다.
//
// ⚠ **파장은 화면 발자국에 맞춘 것이다.** 카메라가 담는 폭이 약 12, 물이 사라지는 거리가 40.
//   10.5 / 16 은 한 화면 안에서 갈리고, 27 / 43 은 화면보다 커서 "배가 그 구역으로 들어간다"
//   로 읽힌다. ⚠ 10.5 는 주파장 3.20 의 3.3배다 — 이보다 짧게 두면 포락선이 파도로 읽힌다.
//
// ⚠⚠ **d 는 주방향(−45.82°) 기준 오프셋에서 계산된다.** BANDS 를 돌리는 날 이 표도 같은
//   각만큼 자동으로 따라 돈다 (아래 MDIR). **d 와 w 를 손으로 적지 않는다** — 적는 순간
//   군이 파도와 다른 방향으로 흐르고, 그건 부감(topView) 없이는 안 보인다.
//   거품이 마루와 90도 어긋난 채 세 커밋을 간 그 실패와 같은 종류다.
//
// L = 얼룩의 파장 · deg = 주방향 기준 각 · cg = 군속도 · c = 상대 세기 · q = 위상
// 정지 관측자 기준 주기 (waveSpeed 0.48 포함) : 26s / 50s / 225s / 625s.
// ⚠ 순항(0.45 월드/초) 중에는 도플러로 헤딩마다 13~140초로 흔들린다 — 판정할 때는
//   **배를 세우고 topView + debugView 10 으로** 본다. 10초로는 절대 판정할 수 없다.
const MOD_RAW = [
  { L: 10.5, deg: -26, cg: 0.95, c: 0.70, q: 1.73 },   // 세트 : 한 화면 안에서 갈린다
  { L: 16.0, deg:  31, cg: 0.78, c: 0.95, q: 4.91 },   // 무리 : 화면 발자국과 같은 크기
  { L: 27.0, deg:  67, cg: 0.64, c: 0.90, q: 0.42 },   // 구역 : 화면보다 크다
  { L: 43.0, deg: -74, cg: 0.52, c: 0.72, q: 3.28 }    // 맵   : 배가 그 안으로 들어간다
];

// ⚠ 'cross' 는 uCrossA = oceanSwell × crossAmount 다 (water.js 등이 그렇게 민다).
// 그래서 파고를 바꾸면 교차 계열도 같이 따라가고, crossAmount 로 따로도 조절된다
const AMP = { swell: 'uSwellA', ripple: 'uRippleA', cross: 'uCrossA' };
const f = (n) => Number(n).toFixed(6);   // GLSL float 리터럴은 소수점이 있어야 한다
const dv = (b) => `vec2(${f(b.d[0])}, ${f(b.d[1])})`;
// uWaveSpeed 는 전 대역의 각속도에 한꺼번에 걸린다. 파장별 상대 속도(긴 파가 빠르다)는
// 유지한 채 전체만 느려지므로, 파가 서로 어긋나지 않는다
const phase = (b) => `dot(p, ${dv(b)}) * ${f(b.k)} - ${f(b.w)} * uWaveSpeed * uTimeQ + ${f(b.p)}`;
// 오로라 띠가 따라갈 기준 파. 대역 중 진폭이 가장 큰 것이고, 화면의 긴 마루가 이것이다
const MAIN = BANDS.find(b => b.main);
// ⚠ 'cross' 는 너울 쪽이다 — 군 포락선(E.x)과 Gerstner 의 ed.x 를 같이 받는다.
//   'swell' 만으로 거르면 교차 계열이 포락선 밖에 남아 잔잔한 구역에서도 혼자 친다
const lo = (bs) => bs.filter(b => b.group !== 'ripple');
const hi = (bs) => bs.filter(b => b.group === 'ripple');
const join = (bs, fn) => (bs.length ? bs.map(fn).join('\n         + ') : '0.0');

// 너울의 **진폭 가중 평균 방향**. 마루 색의 앞면/뒷면을 가르는 데 쓰고, MOD 의 방향도
// 여기서 나온다 (불변식 2). 셰이더에 −45도를 직접 적으면 BANDS 를 돌린 날 색만 옛 방향에 남는다.
// 주파의 **위상속도 ÷ waveSpeed**. 거품이 마루를 따라 흐르게 할 때 쓴다.
// ⚠ 셰이더에 1.386 을 직접 적지 않는다 — BANDS 를 고치면 같이 따라와야 한다 (불변식 2).
// ⚠ 실제 위상속도 = 이 값 × params.waveSpeed 다 (지금 0.48 이라 0.665 월드/초).
//   검산 : 한 주기(2π/(ω·waveSpeed) = 4.81초) 동안 3.20 = 주파장과 정확히 같다.
export function swellPhaseC() {
  const m = BANDS.find(b => b.main) || BANDS.filter(b => b.group === 'swell')
    .reduce((x, y) => (y.a > x.a ? y : x));
  return m.w / m.k;
}

// 너울 대역의 **rms 진행방향 경사** (진폭 1 기준). 실제 값 = 이 값 × params.oceanSwell.
// ⚠ 셰이더에도 params 에도 숫자를 적지 않는다 — BANDS 를 고치면 따라와야 한다 (불변식 2).
// ⚠ 거품의 앞뒤 창이 **정규화하지 않은** dot(∇h, MDIR) 를 이 값으로 나눠 쓴다. 그래야
//   능선 근처에서 |∇h| 가 작아지는 만큼 창이 월드 공간에서 부드럽게 열린다 —
//   정규화한 dirf 는 면적의 69.5% 가 |dirf|>0.9 인 **준-이진**이라 능선에서 칼로 잘린다.
// 주파(진폭 최대 대역)의 파수·각속도·파장, 그리고 전 대역 중 가장 빠른 각속도.
// ⚠ ocean-clock.js 의 진단이 이걸 쓴다 — 거기에 3.20 이나 2.7211 을 적어 두면 BANDS 를
//   고친 날 **진단만 옛 바다를 가리킨다** (실제로 그랬다. 가파름이 0.120 인데 0.300 으로 찍혔다).
export function swellPeak() {
  const m = BANDS.find(b => b.main);
  return { k: m.k, w: m.w, lambda: 2 * Math.PI / m.k };
}
export function swellFastW() { return Math.max(...BANDS.map(b => b.w)); }

export function swellSlopeRms() {
  let s = 0;
  for (const b of BANDS) if (b.group === 'swell') s += (b.a * b.k) * (b.a * b.k);
  return Math.sqrt(s / 2);
}

export function swellMeanDir() {
  let x = 0, z = 0;
  for (const b of BANDS) {
    if (b.group !== 'swell') continue;
    x += b.d[0] * b.a; z += b.d[1] * b.a;
  }
  const L = Math.hypot(x, z) || 1;
  return [x / L, z / L];
}

// MOD_RAW → 실제 표. d 와 w 를 여기서 **계산**한다 (표에 적지 않는다).
const MDIR = swellMeanDir();
const MOD = MOD_RAW.map(m => {
  const a = Math.atan2(MDIR[1], MDIR[0]) + m.deg * Math.PI / 180;
  const d = [Math.cos(a), Math.sin(a)];
  const k = 2 * Math.PI / m.L;
  return { d, k, w: m.cg * (MDIR[0] * d[0] + MDIR[1] * d[1]) * k, c: m.c, q: m.q };
});
// s 를 분산 1 로 맞추는 상수 = sqrt(Σc²/2). 이게 있어야 envBeta 의 의미가 MOD 표와
// 무관해진다 — 표를 손보면 세기가 아니라 무늬만 바뀐다
const SNORM = Math.sqrt(MOD.reduce((s, m) => s + m.c * m.c, 0) / 2);

const mdv = (m) => `vec2(${f(m.d[0])}, ${f(m.d[1])})`;
const mph = (m) => `dot(p, ${mdv(m)}) * ${f(m.k)}`
  + ` - ${f(m.w)} * uEnvSpeed * uWaveSpeed * uTimeQ + ${f(m.q)}`;

// 포락선 GLSL. **SWELL 과 SWELL_MAIN 이 같은 문자열을 쓴다** — 한쪽에만 넣으면 거품이
// 파도가 없는 자리에 뜬다 (불변식 0). 둘은 절대 한 프로그램에 같이 안 들어간다.
// ⚠ tanh 대신 x·inversesqrt(1+x²) : 더 싸고 GLSL 버전을 안 탄다.
// ⚠⚠ uEnvAmt = 0 이면 mix 가 정확히 1.0 을 내고 zw 가 0 이 된다 — **비트 단위 롤백 스위치다.**
const ENV_GLSL = `
// ⚠⚠ **uTimeQ · uWaveSpeed 를 여기서 선언한다.** ENV_GLSL 은 SWELL / SWELL_MAIN 보다
//   **앞에** 붙는데 swellEnv() 가 둘을 쓴다 — 아래에서 선언하면 'undeclared identifier' 로
//   셰이더가 통째로 컴파일 실패한다 (2026-09-06 에 실제로 그랬다).
//   ⚠ 그래서 SWELL / SWELL_MAIN 쪽 선언에서는 이 둘을 **뺐다.** GLSL 은 중복 선언이 에러다.
uniform float uTimeQ; uniform float uWaveSpeed;
uniform float uEnvAmt, uEnvLo, uEnvHi, uEnvRLo, uEnvRHi, uEnvBeta, uEnvGerst, uEnvSpeed;
// x = 너울 배율 E_s · y = 잔물결 배율 E_r · zw = ∇v (두 배율이 **공유하는** 기울기 인자)
// ⚠ E_r 은 E_s 와 **정확히 반대로** 움직인다 (같은 v 를 뒤집어 쓴다). sin 을 하나도 더 안
//   부르고, 잔잔한 구역이 '유리판'이 아니라 '잔물결만 남은 구역'이 된다 — 요구 3번의 축이다.
vec4 swellEnv(vec2 p){
  float s = 0.0; vec2 gs = vec2(0.0);
${MOD.map((m, i) => `  float mq${i} = ${mph(m)};
  s += ${f(m.c)} * sin(mq${i});  gs += ${f(m.c * m.k)} * cos(mq${i}) * ${mdv(m)};`).join('\n')}
  s *= ${f(1 / SNORM)}; gs *= ${f(1 / SNORM)};
  float u = uEnvBeta * s;
  float iv = inversesqrt(1.0 + u * u);
  float v = 0.5 + 0.5 * u * iv;
  return vec4(mix(1.0, mix(uEnvLo,  uEnvHi, v), uEnvAmt),
              mix(1.0, mix(uEnvRHi, uEnvRLo, v), uEnvAmt),
              (uEnvAmt * 0.5 * uEnvBeta * iv * iv * iv) * gs);
}`;

// h = A·(sin φ − β·cos 2φ). β 가 마루를 좁히고 골을 넓힌다 (2차 조화파)
const H = (b) => (b.b
  ? `${AMP[b.group]} * ${f(b.a)} * (sin(${phase(b)}) - ${f(b.b)} * cos(2.0 * (${phase(b)})))`
  : `${AMP[b.group]} * ${f(b.a)} * sin(${phase(b)})`);
// 위를 p 로 미분한 것 : A·k·(cos φ + 2β·sin 2φ)·d
const G = (b) => (b.b
  ? `${AMP[b.group]} * ${f(b.a)} * ${f(b.k)} * (cos(${phase(b)}) + ${f(2 * b.b)} * sin(2.0 * (${phase(b)}))) * ${dv(b)}`
  : `${AMP[b.group]} * ${f(b.a)} * ${f(b.k)} * cos(${phase(b)}) * ${dv(b)}`);
// Gerstner(트로코이드) 횡변위. 마루(sin=1)에서 cos=0 이라 변위가 0 이고 사면에서 최대다 —
// 그래서 물질이 마루로 모여, 진폭을 안 올리고도 마루만 뾰족해진다
const D = (b) => `${AMP[b.group]} * ${f(b.a)} * cos(${phase(b)}) * ${dv(b)}`;

// detail : 잔물결 대역에만 걸리는 계수. 원경에서 0 으로 가면
//   (1) 화면에서 파장이 한 픽셀 밑으로 내려가며 생기는 반짝임·모아레가 사라지고
//   (2) 가까이에서는 마음껏 잘게 넣을 수 있게 된다.
// 저주파 너울은 절대 줄이지 않는다 — 그건 지평선까지 이어져야 하는 바다의 형태다.
//
// ⚠⚠ **호출부는 포락선을 한 번만 뜨고 세 함수에 넘긴다** (3인자 형태).
//   H·G·D 가 각자 swellEnv 를 부르면 정점당 삼각함수가 8 이 아니라 24회가 되고, 더 나쁘게는
//   세 층이 서로 다른 E 를 볼 수 있다 — 기울기가 높이의 도함수가 아니게 된다.
export const SWELL = ENV_GLSL + `
// 시간 입력은 uTimeQ — 물의 형태를 만드는 모든 층이 같은 양자화된 시각을 쓴다.
// ⚠ uTimeQ 와 uWaveSpeed 는 **ENV_GLSL 이 이미 선언했다** (중복 선언은 GLSL 에러다)
uniform float uSwellA; uniform vec2 uSwellOff; uniform float uRippleA; uniform float uCrossA;
uniform float uGerstner;
// ⚠⚠ **높이와 기울기를 한 번에 낸다** (2026-09-06). 예전에는 swellH 와 swellG 가 같은
// 위상의 sin·cos 를 각자 다시 계산했다. 게다가 아래 곱의 미분 때문에 기울기 쪽이 높이 합
// (hs/hr)을 또 필요로 하는데, 합치면 그 20회가 통째로 사라진다 —
// **포락선이 새로 쓰는 8회를 여기서 벌어 온다.**
//   정점당 초월함수 : 오늘 52 → 60 (+15%). 안 합치면 80 (+54%) 이다.
//   (문서 8-1 : 16대역까지는 측정 잡음 아래. 60회 ≈ 13.9대역이라 그 구간 안이다)
// ⚠ 호출부는 **이 함수를 쓴다.** 아래 swellH / swellG 래퍼는 각각 전체를 다시 돈다
// ⭐ oGS = **너울(lo) 대역만의 기울기** (2026-09-29, S15P21E203-448). oG 를 만들며 어차피 거치는 중간값이라 삼각함수가 늘지 않는다.
//   물의 마루선 판정(water.js dirf · pw)이 이걸 쓴다 — 잔물결이 섞인 oG 로 fwidth 를 재면 띠 끝이 삼각형마다 튀어
//   마루 위에 격자 모양(쐐기 · 빗살 · 고리)이 선다 (불변식 13-1 의 ⭐ 주석)
void swellHGS(vec2 p, float detail, vec4 e, out float oH, out vec2 oG, out vec2 oGS){
  float hs = ${join(lo(BANDS), H)};
  float hr = ${join(hi(BANDS), H)};
  vec2  gs = ${join(lo(BANDS), G)};
  vec2  gr = ${join(hi(BANDS), G)};
  oH = e.x * hs + detail * e.y * hr;
  // ⚠⚠ **곱의 미분이다** : ∇(E·h) = E·∇h + h·∇E. 뒤 항을 빼면 안 된다 —
  // 상대 크기는 평균 9% 지만 |∇h| ≈ 0 인 **능선 위에서 발산**한다. 마루선(dirf 의 영점)과
  // 앞뒤 면이 전부 ∇h 의 영점에서 나오므로, 빼면 선이 실제 마루에서 벗어난다.
  // 거품이 마루와 90도 어긋난 채 세 커밋을 간 실패와 같은 종류다 (불변식 13-1)
  oGS = e.x * gs + hs * ((uEnvHi - uEnvLo) * e.zw);
  oG = oGS + detail * (e.y * gr + hr * ((uEnvRLo - uEnvRHi) * e.zw));
}
// ⚠ oGS 를 안 쓰는 호출부(grid.js · 발표 페이지)용 — 컴파일러가 안 쓰는 출력을 지운다
void swellHG(vec2 p, float detail, vec4 e, out float oH, out vec2 oG){ vec2 gs; swellHGS(p, detail, e, oH, oG, gs); }
float swellH(vec2 p, float detail, vec4 e){ float h; vec2 g; swellHG(p, detail, e, h, g); return h; }
vec2  swellG(vec2 p, float detail, vec4 e){ float h; vec2 g; swellHG(p, detail, e, h, g); return g; }
vec2 swellD(vec2 p, float detail, vec4 e){
  // ⚠⚠ Gerstner 만 포락선을 **덜 받는다** (uEnvGerst). 루프 한계가 1/Σ(E·A·k) 라
  // 국소값이 되기 때문이다. 실측 (야코비안 행렬식 최소, 4시각 × 420² 표본, ∇E 항 포함) :
  //   오늘 g 0.38 · env 없음 → Σ 1.68097 · 사용률 63.88% · min det J 0.4625
  //   제안 g 0.34 · eg 0.55  → Σ 1.87714 · 사용률 63.82% · min det J 0.4660  ← 오늘보다 안전
  //   eg 1.0 이면 Σ 2.04574 · 사용률 69.6%. **1.0 으로 올리지 않는다.**
  // ⚠ 대가는 정직하게 : 거친 구역의 마루가 자기 높이 대비 덜 뾰족하다.
  //   그래도 실효 첨예도(g·ed)는 군에서 0.34 × 1.23 = 0.417 로 **오늘 0.38 보다 뾰족하다**
  vec2 ed = vec2(1.0) + uEnvGerst * (e.xy - vec2(1.0));
  return uGerstner * (ed.x * (${join(lo(BANDS), D)})
       + detail * ed.y * (${join(hi(BANDS), D)}));
}
// 호환 래퍼. ⚠ 포락선을 스스로 뜨므로 **새 코드는 쓰지 않는다** (위 경고 참고)
float swellH(vec2 p, float detail){ return swellH(p, detail, swellEnv(p)); }
vec2  swellG(vec2 p, float detail){ return swellG(p, detail, swellEnv(p)); }
vec2  swellD(vec2 p, float detail){ return swellD(p, detail, swellEnv(p)); }
`;

// 거품 판정용 GLSL. 시뮬 셰이더가 "지금 이 텍셀이 큰 파도의 어디인가"를 알아야
// 부서짐을 기록할 수 있는데, 시뮬은 자기 교란만 알고 화면의 큰 파도는 해석적 너울이다.
//
// ⚠⚠ **한 대역만 넘기면 안 된다.** 처음에 주파 하나만 넘겼더니, 높이 임계로 자른 자리가
// 사인파 하나의 마루 근처가 되어 **자로 그은 듯한 얇은 평행선**이 됐다 — swellCrest 로
// 잘랐을 때와 기하학적으로 똑같은 문제다. 이름만 바꾼 같은 실수였다.
// 실제 파도가 구불거리는 것은 대역이 여럿이기 때문이다. 그래서 진폭 상위 네 대역을 합친다
// (sin·cos 각 4회. 640² × 서브스텝이라 8개 전부는 과하다).
// ⚠ 여기도 BANDS 에서 생성된다 — 표를 고치면 같이 따라온다 (불변식 2)
const FOAM_BANDS = BANDS.filter(b => b.group === 'swell').sort((x, y) => y.a - x.a).slice(0, 4);
const FOAM_SUM = FOAM_BANDS.reduce((s, b) => s + b.a, 0);
const FOAM_GSUM = FOAM_BANDS.reduce((s, b) => s + b.a * b.k, 0);
const foamPh = (b, i) => `  float ph${i} = ${phase(b)};`;
const foamH = (b, i) => `${f(b.a)} * (sin(ph${i}) - ${f(b.b)} * cos(2.0 * ph${i}))`;
const foamG = (b, i) => `${f(b.a)} * ${f(b.k)} * (cos(ph${i}) + ${f(2 * b.b)} * sin(2.0 * ph${i})) * ${dv(b)}`;
// ── 교차 너울을 거품 판정에 넣는 몫 (foamCross, v0.60 시안). BANDS 에서 생성한다 (불변식 2)
// ⚠ 합에 그냥 더하면 σ 가 −21% 라 같은 foamHigh 에서 점유가 준다 — σ 를 보존하는 배율로 나눈다
// ⚠ 0.85 를 넘기지 않는다 — 판정 자의 교차 에너지가 화면 바다(12.2%)보다 커져 달걀판 쪽으로 기운다
const FOAM_X   = BANDS.filter(b => b.group === 'cross');
const FOAM_A2  = FOAM_BANDS.reduce((s, b) => s + b.a * b.a, 0);
const FOAM_XA2 = FOAM_X.reduce((s, b) => s + b.a * b.a, 0);
const FOAM_G2  = FOAM_BANDS.reduce((s, b) => s + (b.a * b.k) ** 2, 0);
const FOAM_XG2 = FOAM_X.reduce((s, b) => s + (b.a * b.k) ** 2, 0);
const foamXPh = (b, i) => `    float px${i} = ${phase(b)};`;
const foamXH  = (b, i) => `${f(b.a)} * (sin(px${i}) - ${f(b.b)} * cos(2.0 * px${i}))`;
const foamXG  = (b, i) => `${f(b.a)} * ${f(b.k)} * (cos(px${i}) + ${f(2 * b.b)} * sin(2.0 * px${i})) * ${dv(b)}`;

export const SWELL_MAIN = ENV_GLSL + `
// ⚠ uTimeQ · uWaveSpeed 는 ENV_GLSL 이 선언했다
uniform float uSwellA; uniform vec2 uSwellOff; uniform float uCrossA;
uniform float uFoamCross;   // v0.60 시안. ⚠ 0 이면 아래 분기를 안 타 원래 return 그대로 (비트 단위). ⚠ ANGLE 에서 분기가 평탄화되면 0 에서도 비용이 들 수 있다
// ⚠ **진폭으로 정규화해서** 돌려준다 (대략 −1 ~ 1).
// 안 그러면 임계가 oceanSwell 에 묶여, 파고를 바꿀 때마다 거품이 사라지거나 뒤덮는다.
// 마루 색을 2σ 로 정규화한 것과 같은 이유다 (불변식 13)
//
// ⚠⚠ **여기에 같은 포락선을 안 곱하면 요구 2번이 통째로 무너진다.** 거품이 태어나는 자리가
// 이것이고, 여기가 변조돼야 거품이 **군 안에서만** 나서 군을 따라간다.
// 실측 (거친 E>1.15 / 잔잔 E<0.75 의 평균 br, 시뮬 교란 정규화 sd 0.20 포함) :
//   오늘 1.00배(균질이라 정의상) → 제안 **19.5배**. 점유는 오늘의 0.95배로 유지된다.
// ⚠ sim.js 의 **파면 진폭에도** 같은 포락선을 걸어야 이 숫자가 나온다. 안 걸면 7.1배로
//   떨어진다 — tot = sm.x + h.x/(uSwellA·1.18) 의 뒤 항이 여기서는 변조되지 않기 때문이다.
vec3 swellMain(vec2 p){          // x = 정규화 높이 · y = 정규화 기울기 크기 · z = 앞뒤 부호
  vec4 e = swellEnv(p);
  vec2 gE = (uEnvHi - uEnvLo) * e.zw;     // ∇E_s
${FOAM_BANDS.map(foamPh).join('\n')}
  float hh = ${FOAM_BANDS.map(foamH).join('\n           + ')};
  vec2  gg = ${FOAM_BANDS.map(foamG).join('\n           + ')};
  // ⚠ 여기도 곱의 미분이다 (swellG 와 같은 이유).
  // ⚠ 시뮬 프래그먼트 비용이 문제가 되면 **가장 먼저 잘라도 되는 항이 이것뿐이다** —
  //   sm.y 는 자르는 게이트가 아니라 0.35~1.0 사이의 가중치라서 (sm.x 는 절대 건드리지 마라)
  // ⚠⚠ **z 를 새로 돌려준다 (2026-09-06). 부호 있는 기울기다.**
  //   예전에는 length() 만 줘서 sim.js 의 br 이 마루 **앞뒤 대칭**으로 태어났다.
  //   사용자 지적 : "파도 거품이 지금 **양면으로** 생기고 있는데 … 서퍼 생각하면
   //   파도 위에 같이 존재해야 한다". 앞면만 남기려면 부호가 필요하다.
  //   docs/파도-표현-개선안.md 도 한계 1번으로 "br 이 부호 없는 sm.y 로 나서 앞뒤
  //   대칭으로 태어난다 — 진짜로 앞면에 옮기려면 부호 있는 gg 가 필요하다" 고 적었다.
  // ⚠ 부호는 **너울의 진폭가중 평균 방향**에 투영해서 얻는다 (MDIR, 불변식 2).
  //   셰이더에 −45도를 직접 적으면 BANDS 를 돌린 날 거품만 옛 방향에 남는다.
  // ⚠ 규약은 water.js 의 dirf 와 **같다** : 음수 = 파가 나아가는 쪽으로 내려가는 면 = 앞면.
  // ── 교차 너울을 판정에 넣는다 (v0.60 시안 foamCross). xr = foamCross × crossAmount
  //   σ 보존 : 높이는 sqrt(1 + xr² · 교차/주 진폭² 비), 기울기는 같은 식의 기울기² 비로 나눈다
  //   ⚠ 시뮬 삼각함수 +50% — 보이는 창에서 비용을 본 뒤 사용자가 켠다
  if (uFoamCross > 0.0) {
    float xr = uFoamCross * uCrossA / max(uSwellA, 1e-4);
${FOAM_X.map(foamXPh).join('\n')}
    float hx = hh + xr * (${FOAM_X.map(foamXH).join('\n           + ')});
    vec2  gx = gg + xr * (${FOAM_X.map(foamXG).join('\n           + ')});
    vec2  Gx = e.x * gx + hx * gE;
    float mx = length(Gx);
    return vec3(e.x * hx / (${f(FOAM_SUM)} * sqrt(1.0 + xr * xr * ${f(FOAM_XA2 / FOAM_A2)})),
                mx / (${f(FOAM_GSUM)} * sqrt(1.0 + xr * xr * ${f(FOAM_XG2 / FOAM_G2)})),
                mx > 1e-5 ? dot(Gx, vec2(${f(MDIR[0])}, ${f(MDIR[1])})) / mx : 0.0);
  }
  vec2  G   = e.x * gg + hh * gE;
  float mag = length(G);
  return vec3(e.x * hh / ${f(FOAM_SUM)}, mag / ${f(FOAM_GSUM)},
              mag > 1e-5 ? dot(G, vec2(${f(MDIR[0])}, ${f(MDIR[1])})) / mag : 0.0);
}
`;

// ───────── 쇄파 무리 (FOAM_CLUMP, v0.60) ─────────
// 같은 마루 안에서 어느 구간이 부서지는가. sim.js br 과 water.js 검증 보기 15 가 같은 문자열을 쓴다.
// ⚠⚠ 정현파가 아니라 난수인 이유 : 정현파 합은 평행 등간격 격자다 (v0.12.4). 포락선(MOD)에 짧은 항을 더해 끊으면
//   무리가 같은 간격으로 줄 서 다시 도장이 된다.
// ⚠ 해시를 쓰지만 불변식 2 를 어기지 않는다 — CPU 사본이 필요 없다. CPU(부력)는 .w 를 안 읽는다 (sampler 는 .x 만 읽는다)
// ⚠ 틀 : u = 마루선 방향 · s = 진행 방향. s 는 foamClumpFlow × 주파 위상속도(swellPhaseC × uWaveSpeed)로 흐른다.
//   0.5 = 군속도 (마루가 섬을 가로지른다) · 1 = 마루에 붙어 달린다(도장) · 0 = 바다에 박힌다
// ⚠ uTimeQ · uWaveSpeed 는 ENV_GLSL 이 선언한다 — 반드시 SWELL / SWELL_MAIN **뒤에** 붙인다 (앞이면 undeclared 로 셰이더가 통째로 실패한다)
// ⚠ 이 문자열의 GLSL 주석에 백틱을 쓰지 않는다 — JS 템플릿이 끊긴다
export const FOAM_CLUMP = `
uniform float uFoamClumpCell, uFoamClumpStretch, uFoamClumpFlow;
// [0,1] 해시 (sin 없음). water.js 의 hash2(±0.5) 와 다르다 — 이름을 일부러 달리 둔다
float fcHash(vec2 c){
  vec3 p3 = fract(vec3(c.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
float fcNoise(vec2 p){
  vec2 i = floor(p), g = p - i;
  g = g * g * (3.0 - 2.0 * g);
  return mix(mix(fcHash(i), fcHash(i + vec2(1.0, 0.0)), g.x),
             mix(fcHash(i + vec2(0.0, 1.0)), fcHash(i + vec2(1.0, 1.0)), g.x), g.y);
}
// 돌려주는 값은 [0,1] 이다. 문턱 범위(QLo~QHi)로 옮기는 것은 부르는 쪽 몫이다.
// 2옥타브 합(σ≈0.15)을 ×2.2 로 편다. 둘째 옥타브는 36.87° 돌린다 — 격자 결이 마루에 수직인 곧은 자름으로 읽히지 않게
float foamClumpQ(vec2 p){
  vec2 md = vec2(${f(MDIR[0])}, ${f(MDIR[1])});
  vec2 tc = vec2(-md.y, md.x);
  float s = dot(p, md) - uFoamClumpFlow * ${f(swellPhaseC())} * uWaveSpeed * uTimeQ;
  vec2 q = vec2(dot(p, tc), s / max(uFoamClumpStretch, 0.25)) / max(uFoamClumpCell, 0.5);
  float n = 0.65 * fcNoise(q)
          + 0.35 * fcNoise(mat2(0.8, -0.6, 0.6, 0.8) * q * 2.37 + 19.1);
  return clamp((n - 0.5) * 2.2 + 0.5, 0.0, 1.0);
}`;

// ── CPU 사본 ──
// swellH / swellG 는 GLSL 과 글자 그대로 같은 식이다 (같은 BANDS + MOD 에서 나온다).
//
// ⚠ 다만 Gerstner 를 켜면 좌표계가 하나 갈라진다.
//   GPU 는 매개변수 p 의 정점을 월드 p + D(p) 에 놓고 높이 H(p) 를 준다.
//   배는 반대로 '월드 X 에서의 수면 높이'를 물어야 하므로, 먼저 X → p 를 풀어야 한다.
//   |D| 가 작아 뉴턴 한 걸음이면 충분하다 : p ≈ X − D(X).
//   이 역변환이 swellCPU 안에 들어 있다. 안 하면 배가 파도와 어긋난 자리에서 뜬다.
//
// ⚠⚠ **포락선의 게인을 인자로 받지 않고 PARAMS 를 직접 읽는다.** 유니폼도 같은 P 에서
//   밀리므로 두 쪽이 같은 프레임에 같은 값을 본다 — 갈라질 경로가 구조적으로 없다.
//   시그니처에 인자를 더하면 boat.js:91 · marks.js:233 두 호출부가 **조용히 옛 동작으로**
//   남는다. 그게 배가 잠기는 경로다.

// GLSL swellEnv 의 CPU 사본. 글자 그대로 같은 식이다.
// ⚠ t 는 이미 uTimeQ × uWaveSpeed 다 (boat.js 가 그렇게 넘긴다). GLSL 의 uWaveSpeed 곱과 대응
export function swellEnvCPU(x, z, t) {
  let s = 0, gx = 0, gz = 0;
  for (const m of MOD) {
    const ph = (x * m.d[0] + z * m.d[1]) * m.k - m.w * P.envSpeed * t + m.q;
    s += m.c * Math.sin(ph);
    const c = m.c * m.k * Math.cos(ph);
    gx += c * m.d[0]; gz += c * m.d[1];
  }
  s /= SNORM; gx /= SNORM; gz /= SNORM;
  const u = P.envBeta * s, iv = 1 / Math.sqrt(1 + u * u);
  const v = 0.5 + 0.5 * u * iv;
  const gk = P.envAmount * 0.5 * P.envBeta * iv * iv * iv;
  return {
    es: 1 + P.envAmount * (P.envLo  + (P.envHi  - P.envLo ) * v - 1),
    er: 1 + P.envAmount * (P.envRHi + (P.envRLo - P.envRHi) * v - 1),
    gvx: gk * gx, gvz: gk * gz
  };
}

// ⚠⚠ **CPU 의 진폭 선택자는 여기 하나뿐이다.** 아래 다섯 함수가 전부 이걸 쓴다 —
//   각자 `group === 'ripple' ? r : a` 를 적으면 교차 계열을 빠뜨린 함수가 조용히 생기고,
//   그건 GPU/CPU 가 갈라진다는 뜻이다 (불변식 2 · 배가 잠기는 경로).
// ⚠ crossAmount 를 **인자로 받지 않고 PARAMS 를 직접 읽는다.** 유니폼도 같은 P 에서 밀리므로
//   두 쪽이 같은 프레임에 같은 값을 본다 — swellEnvCPU 가 포락선 게인에 쓰는 것과 같은 처방이다.
//   ⚠ 시그니처에 인자를 더하면 boat.js · marks.js 두 호출부가 조용히 옛 동작으로 남는다.
const ampOf = (b, a, r) => (b.group === 'ripple' ? r
                          : b.group === 'cross'  ? a * P.crossAmount : a);

// detail 은 GLSL 과 같은 뜻이다. 배는 항상 카메라 바로 앞이라 실제로는 늘 1 이지만,
// 인자로 남겨 둬야 셰이더 소스와 값을 대조할 수 있다
function rawH(x, z, t, a, r, detail) {
  const E = swellEnvCPU(x, z, t);
  let hs = 0, hr = 0;
  for (const b of BANDS) {
    const p = (x * b.d[0] + z * b.d[1]) * b.k - b.w * t + b.p;
    const s = ampOf(b, a, r) * b.a
            * (Math.sin(p) - b.b * Math.cos(2 * p));   // GLSL H 와 같은 식
    if (b.group === 'ripple') hr += s; else hs += s;
  }
  return E.es * hs + detail * E.er * hr;
}

// swellD 의 CPU 사본. ⚠ ed(포락선의 uEnvGerst 몫)까지 GLSL 과 같다 — 여기를 빠뜨리면
// 배가 파도와 **가로로** 어긋난 자리에 뜬다 (showProbes 의 청록 원반이 파면에서 벗어난다)
export function swellDispCPU(x, z, t, a, r, g, detail = 1) {
  const E = swellEnvCPU(x, z, t);
  const eds = 1 + P.envGerst * (E.es - 1), edr = 1 + P.envGerst * (E.er - 1);
  let dx = 0, dz = 0;
  for (const b of BANDS) {
    const c = ampOf(b, a, r) * b.a
            * Math.cos((x * b.d[0] + z * b.d[1]) * b.k - b.w * t + b.p);
    const w = (b.group === 'ripple') ? detail * edr : eds;
    dx += w * c * b.d[0];
    dz += w * c * b.d[1];
  }
  return [g * dx, g * dz];
}

// 월드 좌표 (x, z) 에서의 수면 높이. g = 0 이면 GLSL swellH 와 완전히 같다
export function swellCPU(x, z, t, a, r, g = 0, detail = 1) {
  if (!g) return rawH(x, z, t, a, r, detail);
  const [dx, dz] = swellDispCPU(x, z, t, a, r, g, detail);
  return rawH(x - dx, z - dz, t, a, r, detail);
}

// swellG 의 CPU 사본. 지금은 쓰는 곳이 없지만, 배의 자세를 기울기로 잡게 되면 필요하다.
// ⚠ 곱의 미분 항(h·∇E)까지 GLSL 과 같다. 되살릴 때 이 항을 빼면 안 된다 — 위 swellG 주석 참고
export function swellGradCPU(x, z, t, a, r, detail = 1) {
  const E = swellEnvCPU(x, z, t);
  let hs = 0, hr = 0, gsx = 0, gsz = 0, grx = 0, grz = 0;
  for (const b of BANDS) {
    const p = (x * b.d[0] + z * b.d[1]) * b.k - b.w * t + b.p;
    const A = ampOf(b, a, r) * b.a;
    const hv = A * (Math.sin(p) - b.b * Math.cos(2 * p));
    const c = A * b.k * (Math.cos(p) + 2 * b.b * Math.sin(2 * p));   // GLSL G 와 같은 식
    if (b.group === 'ripple') { hr += hv; grx += c * b.d[0]; grz += c * b.d[1]; }
    else                      { hs += hv; gsx += c * b.d[0]; gsz += c * b.d[1]; }
  }
  const ks = P.envHi - P.envLo, kr = P.envRLo - P.envRHi;
  return [E.es * gsx + hs * ks * E.gvx + detail * (E.er * grx + hr * kr * E.gvx),
          E.es * gsz + hs * ks * E.gvz + detail * (E.er * grz + hr * kr * E.gvz)];
}

// 루프(자기교차) 한계. Σ g·k·A ≤ 1 을 넘으면 파가 스스로를 말아 올려 격자가 뒤집힌다.
// ⚠⚠ 포락선이 붙으면서 이 값이 **국소값**이 됐다. E_s 와 E_r 이 서로 반대로 움직이므로
//   최악이 끝점에 있지 않다 — v 를 훑어서 찾는다.
// ⚠ envAmount = 0 이면 정확히 옛 값(0.594894)으로 돌아온다.
// ⚠ oceanSwell · ripple · envHi · envRHi · envGerst 중 하나라도 올리면 이 값을 다시 찍는다 :
//     PB.gerstnerLoopLimit(PB.params.oceanSwell, PB.params.ripple)
export function gerstnerLoopLimit(a, r) {
  let ws = 0, wr = 0;
  for (const b of BANDS) {
    const A = ampOf(b, a, r) * b.a * b.k;
    if (b.group === 'ripple') wr += A; else ws += A;
  }
  let worst = 0;
  for (let i = 0; i <= 200; i++) {
    const v = i / 200;
    const es = 1 + P.envAmount * (P.envLo  + (P.envHi  - P.envLo ) * v - 1);
    const er = 1 + P.envAmount * (P.envRHi + (P.envRLo - P.envRHi) * v - 1);
    worst = Math.max(worst, (1 + P.envGerst * (es - 1)) * ws + (1 + P.envGerst * (er - 1)) * wr);
  }
  return 1 / worst;
}

// ── 포락선의 2차 모멘트 E[E²] ──
// ⚠⚠ **하드코딩하지 않는다.** envBeta 가 라이브 슬라이더라, 상수로 박아 두면 슬라이더를
//   한 칸만 밀어도 2σ 가 틀리고 foamLive / lineH / seamH / apexH 게이트가 **조용히** 어긋난다
//   (컴파일 에러도 콘솔 경고도 안 난다). 그래서 위상 토러스 위에서 매번 구한다.
// ⚠ E[v] = 0.5 는 s 의 분포가 대칭이고 시그모이드가 홀함수라 **정확히** 나온다.
//   남는 미지수는 E[v²] 하나뿐이고 envBeta 만의 함수라 캐시된다 (값이 바뀐 프레임에만
//   12⁴ = 20,736회를 돈다 — 1ms 아래다).
// 참고값 : β 1.0 → 0.338563 · 1.5 → 0.371150 · 1.7 → 0.380984 · 2.2 → 0.400220
let _envB = null, _envV2 = 0;
function envV2() {
  if (P.envBeta === _envB) return _envV2;
  const N = 12, K = MOD.length;
  const T = MOD.map(m => {
    const a = []; for (let i = 0; i < N; i++) a.push(m.c * Math.sin(2 * Math.PI * i / N));
    return a;
  });
  const idx = new Array(K).fill(0);
  const tot = Math.pow(N, K);
  let acc = 0;
  for (let c = 0; c < tot; c++) {
    let s = 0;
    for (let j = 0; j < K; j++) s += T[j][idx[j]];
    const u = P.envBeta * s / SNORM;
    const v = 0.5 + 0.5 * u / Math.sqrt(1 + u * u);
    acc += v * v;
    for (let j = 0; j < K; j++) { if (++idx[j] < N) break; idx[j] = 0; }
  }
  _envB = P.envBeta; _envV2 = acc / tot;
  return _envV2;
}
// E[E²] = lo·hi + (hi−lo)²·E[v²]  (E[v] = 0.5 를 쓴 축약). envAmount = 0 이면 정확히 1
export function envMoments() {
  const v2 = envV2(), k = P.envAmount;
  const m2 = (x, y) => {
    const a = 1 + k * (x - 1), b = 1 + k * (y - 1);
    return a * b + (b - a) * (b - a) * v2;
  };
  return { swell: m2(P.envLo, P.envHi), ripple: m2(P.envRHi, P.envRLo) };
}

// 수면 색을 '정규화된 파도 높이'로 칠하려면 무엇으로 나눌지가 있어야 한다.
//
// ⚠ 진폭을 그냥 더하면 안 된다. 그건 모든 대역의 마루가 한 점에 정렬돼야 나오는 값이라
// 실제로는 도달하지 않는다 (실측 : 합 0.614 인데 p99 가 0.48, 그래서 마루 색이 안 떴다).
// 무작위 위상의 정현파 합에서 실제로 눈에 보이는 마루 높이는 2σ 다 (해양학의 유의파고 / 2).
// σ = sqrt(Σ A²/2) 이므로 2σ = sqrt(2 · Σ A²). 실측 p99 와 거의 정확히 맞는다.
// 2차 조화파(β)가 만드는 추가 분산까지 포함한다 : var += 0.5·A²·(1 + β²)
//
// ⚠⚠ **포락선의 E[E²] 를 반드시 곱한다.** 안 곱하면 uHNorm 이 옛 값에 묶여 h 분포가 통째로
//   어긋나고 모든 높이 게이트가 무효가 된다. water.js 가 매 프레임 이 함수를 다시 부르므로
//   여기만 맞으면 uHNorm 은 **자동으로 따라온다** — 손으로 보정할 것이 없다.
// 실측 : envAmount 0 → 0.450834 (옛 값과 완전 일치) · envAmount 1 → 0.451289 (+0.10%).
//   E[E_s²] 를 1 근처(0.9975)로 맞춰 설계했기 때문이다 — 그래서 게이트가 거의 안 움직인다
export function swellAmplitude(a, r) {
  const e2 = envMoments();
  const v = BANDS.reduce((s, b) => {
    const A = ampOf(b, a, r) * b.a;
    return s + (b.group === 'ripple' ? e2.ripple : e2.swell) * 0.5 * A * A * (1 + b.b * b.b);
  }, 0);
  return 2 * Math.sqrt(v);
}
