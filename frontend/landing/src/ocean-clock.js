import { PARAMS as P } from './params.js';
import { CONFIG } from './config.js';   // ⚠ config.js 는 아무것도 import 하지 않는다 (순환 없음)
import { swellPhaseC, swellSlopeRms, swellAmplitude, gerstnerLoopLimit,
         swellPeak, swellFastW, swellMeanDir } from './swell.js';

// ───────── 이 바다의 단위와 시계 ─────────
// 여기까지 이 프로젝트에는 **길이 단위가 선언된 적이 없었다.** 월드 단위가 몇 m 인지 아무도
// 안 정했고, 그래서 "파도는 이만큼 빠르고 배는 저만큼 빠르다" 를 검산할 자가 없었다.
// 그 자리에서 배와 파도가 서로 다른 시계를 쓰게 됐다 — 그게 사용자가 말한 이질감이다.
//
// ⚠⚠ **이 파일은 값을 만들지 않는다.** BANDS(swell.js)와 PARAMS 에서 이미 정해진 것을
//   물리 단위로 **번역**할 뿐이다. 숫자를 여기 적기 시작하면 불변식 2 가 깨진다.
//
// ── 핵심 관계 ──
//
//   BANDS 의 각속도는 ω = 0.62·√(g·k) 다. 주석은 이 0.62 를 "배율" 이라고 적었지만
//   **배율이 아니라 길이 단위의 선언이다.** 심해 중력파의 월드 단위 각속도는
//
//        ω_월드 = √(g·k_월드 / ℓ)        (ℓ = 1 월드 단위가 몇 m 인가)
//
//   이고, 셰이더가 쓰는 값은 ω_코드 · uWaveSpeed = 0.62·√(g·k)·ws 다. 둘을 같게 두면
//
//        0.62 · ws = 1/√ℓ      ⇒      ℓ = 1 / (0.62·ws)²
//
//   즉 **waveSpeed 를 고르는 것이 곧 이 바다의 길이 단위를 고르는 것이다.** 0.62 는 틀린
//   중력이 아니었다. ws=1.0 이 정확히 물리 분산관계이고, 그때 1 월드 = 2.60 m 다.
//   (params.js 의 "1 이 원래 속도" 라는 주석은 처음부터 맞는 말이었다.)
//
//   ⚠ 그래서 waveSpeed 를 내리면 파도가 느려지는 게 아니라 **바다가 커진다.**
//     ws 0.48 은 1 월드 = 11.29 m 를 뜻하고, 그러면 배가 28 m 짜리 여객선이 된다.
//
// ── 무차원이라 ℓ 을 안 정해도 판정할 수 있는 것 ──
//
//   가파름 Hs/λp, 배속도/위상속도 v/cp, 궤도/위상 kA, 선체속도/cp — 전부 ℓ 이 약분된다.
//   ⚠ **선체속도 ÷ cp 는 ℓ 과 무관하다** — 선체속도도 cp 도 √ℓ 에 비례해 약분되기 때문이다.
//     다만 **배 길이와 주파장에 의존한다** : `선체속도/cp = √(L / λp)`.
//     (HULL_K 1.25 가 √(g/2π) = 1.2495 라 상수가 1 로 떨어진다. 실측과 오차 0.04%.)
//       L 2.48 · λp 3.2 → 0.880 (v0.12.0 이전. 못 앞지른다)
//       L 5.00 · λp 3.2 → 1.250 (v0.12.2. 앞지를 수 있었다 — 배만 키우고 파장을 안 늘린 구간)
//       L 5.00 · λp 8.0 → **0.791** (지금. 다시 못 앞지른다)
//     ⚠ 이 주석은 두 번 낡았다. 2026-09-06 이전에는 "ℓ 과 무관한 상수" 라고만 적어 **배 길이
//       의존을 빠뜨렸고**, 그 뒤엔 "L 5.0 → 1.245 가 지금 값" 이라 적었는데 v0.12.3 이 파장을
//       2.5배로 늘리면서 **결론이 정반대로 뒤집혔다** (2026-09-07 정정).
//       **한쪽만 적으면 또 낡는다 — L 과 λp 를 같이 본다.**
//   ⚠ 배 길이와 무관하게 남는 사실 : **v/cp 가 1 을 넘는 화면은 어떤 축척에서도 존재할 수 없다.**
//     선체속도가 cp 를 넘더라도, 그건 '앞지를 수 있다' 이지 '앞지르고 있다' 가 아니다.
export const G = 9.81;

// 이 배의 길이(월드). ⚠ 여기 숫자를 적지 않는다 — 배의 크기는 CONFIG.boat.lengthW 하나가
// 정하고 boat.js 의 메시도 같은 값에서 스케일된다 (불변식 2 와 같은 규율이다)
export const BOAT_LEN_W = CONFIG.boat.lengthW;
// 배수형 선체의 이론 최고속도(선체속도) : 1.25·√(L[m]) m/s. 배가 자기 뱃머리 파를 못 넘는다
const HULL_K = 1.25;

// 1 월드 단위 = 몇 m 인가. waveSpeed 에서 **파생된다** (위 유도)
export function metersPerWorld() {
  const c = 0.62 * Math.max(1e-4, P.waveSpeed);
  return 1 / (c * c);
}

// 주파의 위상속도 (월드/초). ⚠ 셰이더에 1.386 을 적지 않는 것과 같은 이유로 여기서도
// BANDS 에서 뽑는다 — 표를 고치면 배의 속도가 같이 따라와야 한다 (불변식 2)
export function phaseSpeed() { return swellPhaseC() * P.waveSpeed; }

// 선체속도 (월드/초). ⚠ cp 와의 비는 ℓ 과 무관하지만 **배 길이와 주파장에는 의존한다** :
//   `선체속도/cp = √(L/λp)`. L 5.0 · λp 8.0 인 지금은 **0.791** 이다 (위 유도 참고)
export function hullSpeed() {
  const l = metersPerWorld();
  return HULL_K * Math.sqrt(BOAT_LEN_W * l) / l;
}

// ── 배의 지상속도 ──
// ⚠⚠ **cp 를 단위로 잰다.** 이게 '같은 시계' 의 전부다. 무차원이라 waveSpeed 를 어떻게
//   바꿔도 배와 파도의 관계가 안 깨진다 — 예전처럼 월드/초를 직접 적으면 waveSpeed 를
//   건드릴 때마다 둘이 조용히 갈라진다.
// s = 스로틀 0~1 (main.js 의 nav.speed)
export function groundSpeed(s) {
  // 롤백 경로. ⚠ 9.0 을 여기 적지 않는다 — main.js 가 쓰던 식과 **글자 그대로** 같아야 한다
  if (!P.clockUnified) return P.driftSpeed + s * CONFIG.move.scrollBoost;
  return phaseSpeed() * (P.driftCp + s * P.boostCp);
}

// ── 선회 각속도 ──
// ⚠⚠ **속도만 줄이고 각속도를 그대로 두면 배가 제자리에서 팽이처럼 돈다.**
//   보존해야 하는 것은 각속도가 아니라 **선회 반경** R = v/ω 다.
//   오늘 값 : 순항 4.17 ÷ 1.1 = 3.79 월드 = 배 길이의 1.53배. turnRadius 는 그 값이다.
// ⚠ 하한(turnFloor)은 실제 배의 '타효(steerage way)' 자리다. 표류 중에도 뱃머리는 돌아야
//   UI 가 안 막힌다. 물리적으로는 정지한 배가 안 도는 게 맞지만 여기는 조타 화면이다.
export function turnRate(vFwd) {
  if (!P.clockUnified) return P.turnRate;
  return Math.max(P.turnFloor, Math.min(P.turnRate, vFwd / Math.max(0.1, P.turnRadius)));
}

// ── 진단 ──
// PB.clock.report() — 콘솔에서 부른다. **전부 무차원이거나 파생값이라 손으로 적은 수가 없다.**
// ⚠ 화면을 보고 판정하기 전에 이걸 먼저 읽는다. 파도의 '느낌' 은 밝기·색으로 흉내낼 수
//   있지만 아래 비율들은 못 속인다.
export function report() {
  const l = metersPerWorld();
  const cp = phaseSpeed(), hull = hullSpeed();
  const A2 = swellAmplitude(P.oceanSwell, P.ripple);   // 2σ
  const Hs = 2 * A2;                                   // Hs = 4σ
  // ⚠⚠ **여기에 숫자를 적지 않는다.** BANDS 를 고치면 진단이 조용히 옛 바다를 가리킨다
  const pk = swellPeak();
  const lamP = pk.lambda;                              // 주파장(월드) — BANDS 의 main
  const slope = P.oceanSwell * swellSlopeRms();
  const kA = 2 * Math.PI / lamP * (A2 / 2);            // k·σ ≈ 궤도속도/위상속도
  const cru = groundSpeed(0.45), bst = groundSpeed(1.0);
  const cpz = cp * Math.abs(swellMeanDir()[1]);        // 너울의 −z 성분 (MDIR 에서 파생)
  const flow = cru + cpz;                              // 순항 중 마루가 다가오는 속도
  const orb = cp * 2 * Math.PI / lamP * (A2 / 2);      // ω·A ≈ 물 알갱이 궤도속도

  const L = [];
  const row = (k, v, note) => L.push(`  ${k.padEnd(26)} ${String(v).padStart(10)}   ${note || ''}`);
  L.push('── 단위 ──');
  row('1 월드 =', l.toFixed(3) + ' m', 'waveSpeed 에서 파생 : ℓ = 1/(0.62·ws)²');
  row('배 길이', (BOAT_LEN_W * l).toFixed(2) + ' m', BOAT_LEN_W + ' 월드');
  row('파장 ÷ 배 길이', (lamP / BOAT_LEN_W).toFixed(2) + ' 척',
      (lamP / BOAT_LEN_W < 1 || lamP / BOAT_LEN_W > 3)
        ? '⚠⚠ 1~3척 밖이다 — 배가 파장을 걸치면 선체가 잠긴다 (불변식 ②)'
        : '배가 걸치는 파장 ' + (BOAT_LEN_W / lamP).toFixed(2) + '개');
  row('주파장 λp', (lamP * l).toFixed(2) + ' m', lamP + ' 월드');
  row('유의파고 Hs = 4σ', (Hs * l).toFixed(2) + ' m', Hs.toFixed(3) + ' 월드');
  row('주기 Tp', (2 * Math.PI / (pk.w * P.waveSpeed)).toFixed(2) + ' s', '');
  L.push('── 무차원 (ℓ 과 무관 · 이걸로 판정한다) ──');
  row('가파름 Hs/λp', (Hs / lamP).toFixed(3), '실제 바다 0.02~0.06 · 부서짐 0.143  ⚠ 양식화');
  row('rms 기울기', slope.toFixed(3), (Math.atan(slope) * 180 / Math.PI).toFixed(1) + '도');
  row('궤도/위상 kσ', kA.toFixed(3), 'Gerstner 실효 ' + (kA * P.gerstner).toFixed(3) + ' (원형이면 kσ 와 같다)');
  row('Gerstner 종횡비', P.gerstner.toFixed(2) + ' : 1', '루프 한계 ' + gerstnerLoopLimit(P.oceanSwell, P.ripple).toFixed(3));
  row('선체속도/cp', (hull / cp).toFixed(4),
      hull > cp ? '배가 이 너울을 앞지를 수 있다 (커진 배)' : '⚠ 파도가 언제나 배보다 빠르다');
  row('v/cp 순항', (cru / cp).toFixed(3), cru.toFixed(3) + ' 월드/초' + (cru > cp ? '   ⚠⚠ 파도를 앞지른다' : ''));
  row('v/cp 부스트', (bst / cp).toFixed(3), bst.toFixed(3) + ' 월드/초' + (bst > hull ? '   ⚠ 선체속도 초과' : ''));
  L.push('── 화면 위의 흐름 (순항) ──');
  row('마루가 다가오는 속도', flow.toFixed(3), '월드/초');
  row('그중 파도 자신의 몫', (cpz / flow * 100).toFixed(1) + '%', '나머지는 내가 달린 것');
  row('물 알갱이 궤도속도', orb.toFixed(3), '흐름의 ' + (orb / flow * 100).toFixed(1) + '%  ← 낮을수록 스크롤하는 무늬로 읽힌다');
  row('마루 통과', (flow / lamP).toFixed(2) + ' 개/초', '조우주기 ' + (lamP / flow).toFixed(2) + ' 초');
  L.push('── 시간 양자화 ──');
  const wFast = swellFastW() * P.waveSpeed;   // BANDS 중 가장 빠른 대역 (파생)
  row('최단파 주기당 표본', (P.simFps * 2 * Math.PI / wFast).toFixed(1) + ' 개', 'simFps ' + P.simFps + ' · 10 아래면 잔물결이 계단으로 보인다');
  row('거품 반감기', foamHalfLife().toFixed(3) + ' s', '그동안 마루가 ' + (cp * foamHalfLife() / lamP).toFixed(2) + ' 파장 앞선다');
  console.log(L.join('\n'));
  return { l, cp, hull, Hs, steep: Hs / lamP, vcp: cru / cp, waveShare: cpz / flow };
}

// 거품 반감기(초). 스텝당 잔존율 × 120스텝/초에서 나온다
export function foamHalfLife() {
  return Math.log(0.5) / (120 * Math.log(Math.max(1e-6, P.foamDecay)));
}
