import * as THREE from 'three';
import { CONFIG } from './config.js';
import { PARAMS as P } from './params.js';
import { SWELL, FOAM_CLUMP, swellAmplitude, swellMeanDir, swellPhaseC, swellSlopeRms } from './swell.js';
import { SKY_GLSL, SKY_UNIFORMS, syncHorizonGlow } from './sky.js';
import { timeNow, timeKey } from './times.js';
import { diveNow } from './dive.js';   // 잠수 — 팔레트 · 원경색이 짙은 바다색으로 눕는다 (2026-09-18)
// ⚠ 모듈 상수로 한 번만 뽑는다. 매 프레임 BANDS 를 다시 도는 것을 막는다
const SLOPE_RMS = swellSlopeRms();

// ───────── 수면 ─────────
// 원래 이 메시는 아무것도 안 그렸다 — 배경색으로만 칠하고 깊이 버퍼로 마루 뒤의 선을 가리는
// 마스크였다. 그래서 화면에 남는 잉크의 86% 가 그리드였고, 그리드를 끄면 물이 통째로 사라졌다.
//
// 이제 수면이 자기 명암을 갖는다. 핵심 제약은 **종이보다 밝을 수 없다**는 것이다 (배경 #F8F7F3).
// 그래서 물을 배경보다 조금 내려놓고(uWater), 빛을 받는 면이 배경색으로 '올라오는' 것을
// 하이라이트로 삼는다. 멀어지면 여전히 배경색으로 흩어져 사라진다 — 흰 여백 전제는 그대로다.
//
// 빛의 식은 grid.js 와 같다. 둘은 하나의 현상이어야 한다.

// 물에 비칠 수 있는 향수 부표의 최대 개수. 프래그먼트마다 이만큼 광선-구 교차를 푼다.
// ⚠ 전부 넣을 필요가 없다 — 반사는 부표 근처 수면에만 나타나므로 **가까운 것 몇 개**면
// 충분하다. marks 는 24개까지 있지만 여섯 개를 넘겨 본 적이 없다.
// ⚠ 셰이더의 배열 크기와 루프 상한이 이 값에서 생성된다. 직접 숫자를 적지 않는다
// (uAreaPos[4] 가 그렇게 박혀 있어서 영역을 늘리면 조용히 어긋난다 — 작업계획 1-4).
const MARK_REFL_MAX = 6;

// waterTone 이 종이색과 config 값 사이를 오간다. 원본을 여기 붙들어 둔다 —
// 유니폼을 직접 lerp 하면 두 번째 프레임부터 이미 섞인 값에서 다시 섞여 점점 바랜다
const LIGHT = CONFIG.color, DEEP = CONFIG.colorDeep;
const PAIR = ['waterBase', 'waterMid', 'waterTrough', 'transmission', 'wake', 'subTint', 'foam'];
// 배의 화면 좌표를 낼 때 쓰는 스크래치. ⚠ 매 프레임 new 하지 않는다
const _bp = new THREE.Vector3();
const _hT = new THREE.Vector2();   // 선체 자세(피치·롤) 보간용 스크래치

// ───────── 잔결 5대역 표 ─────────
// ⚠⚠ **여기가 유일한 출처다** — 예전에는 방향·파수·위상이 셰이더 문자열에 숫자로 박혀 있어서
//   각도를 만지려면 GLSL 을 고쳐야 했다 (2026-09-07, 사용자 : *"하드코딩되어있으니 이 값을
//   내가 자유롭게 이동할 수 있게"*). `BANDS` 를 표로 둔 것과 같은 규율이다 (불변식 2).
// ⚠ `w`(ω) 는 적지 않는다 — **`0.62·√(g·k)` 로 파생시킨다.** 원래 박혀 있던 다섯 값과
//   소수점 넷째 자리까지 같다 (검산 : k 3.3069 → 3.5313 ✓ · k 8.9760 → 5.8179 ✓).
//   그래서 파장을 바꾸면 속도가 **저절로** 따라온다. 손으로 적으면 그 순간 갈라진다.
// ⚠ `amp` 는 그룹별로 √Σw² = 1 로 정규화돼 있다 (A : 0.7411²+0.5336²+0.4076² = 1.0000).
//   microA/microB 의 뜻이 '세기' 로 유지되는 이유다. 여기 숫자를 바꾸면 그 성질이 깨진다.
const MICRO_BANDS = [
  { deg:  25, k: 3.3069, ph: 2.31, amp: 0.7411, grp: 0 },   // λ 1.90
  { deg: -78, k: 4.3332, ph: 5.07, amp: 0.5336, grp: 0 },   // λ 1.45
  { deg: -20, k: 5.4636, ph: 0.84, amp: 0.4076, grp: 0 },   // λ 1.15
  { deg:  62, k: 6.8295, ph: 3.96, amp: 0.8269, grp: 1 },   // λ 0.92
  { deg: -50, k: 8.9760, ph: 1.52, amp: 0.5623, grp: 1 }    // λ 0.70
];
// 퍼짐(microSpread)의 중심각. 다섯 방향의 평균이라 spread 1 이면 원래 각도가 그대로 나온다
const MICRO_MID = MICRO_BANDS.reduce((s, b) => s + b.deg, 0) / MICRO_BANDS.length;
// 표 → 유니폼. microRot(전체 회전) · microSpread(퍼짐) · microScale(파장 배율)을 여기서 굽는다.
// ⚠ GPU 에서 매 픽셀 돌리지 않는다 — 값이 바뀔 때 CPU 가 한 번 굽고 프래그먼트는 읽기만 한다
// ───────── 수면 정반사 태양의 방향 ─────────
// ⚠⚠ **이것이 물 위 '빛 반사 무리' 의 자리를 정한다** (2026-09-07). 사용자 :
//   *"다른 자리로 바꾸는 건데 이게 햇빛 위치에 따라 고정되어있는 것 같음."* — 맞았다.
//   `CONFIG.sun` 이 하드코딩이라 그 무리를 옮길 방법이 없었다.
// ⚠ **끄는 것과 옮기는 것은 다르다.** 그 무리를 만드는 층이 여럿이고(정반사·하늘 반사·
//   마루 무리) 전부 이 방향 하나를 보므로, 층을 하나씩 꺼 봐야 나머지가 같은 자리에 남는다.
//   실제로 13개 층을 하나씩 껐지만 어느 것도 밝은 무리 안에서 2.4단위를 못 넘었다.
//   반대로 방향을 돌리면 무리가 통째로 옮겨진다 (좌우 반전 : 화면 23.06% · 평균 11.92 변화).
// ⚠ 여기는 **수면 전용 태양**이다. 배를 비추는 main.js 의 dirLight 와 일부러 갈라져 있다
//   (config.js 의 sun 주석). 그래서 돌려도 종이배의 음영과 돛은 안 망가진다.
// ⚠ 다만 water.js 안에서 이 방향은 셋을 같이 정한다 — 정반사 하프벡터 · **물에 드리운 배
//   그림자 방향** · 하늘 반사. 돌리면 그림자도 같이 눕는다 (불변식 0-3-2).
// ⚠ 물의 **명암**(uLightXZ)은 여기가 아니라 setLight() 가 dirLight 로 채운다. 원래 갈라져
//   있던 것이고, 많이 돌리면 반짝임과 명암의 방향이 더 벌어진다.
//   ⭐ 2026-09-27 : 저녁 · 밤에는 update() 가 그 방향을 **이 해 쪽으로** 돌린다 (역광 바다 · params.seaBacklight 1) — 명암과 반짝임이 같은 해를 본다
const SUN_N = new THREE.Vector3(...CONFIG.sun).normalize();
const SUN_AZ0 = Math.atan2(CONFIG.sun[0], CONFIG.sun[2]);                                   // −159.44°
const SUN_EL0 = Math.atan2(CONFIG.sun[1], Math.hypot(CONFIG.sun[0], CONFIG.sun[2]));        // +14.44°
// ⚠ 둘 다 **오프셋**이다 (절대 각이 아니다). 0/0 이면 SUN_N 을 그대로 복사하므로
//   **비트 단위 롤백**이 보장된다 — 극좌표를 거치며 생기는 끝자리 오차조차 없다.
// ⚠ 여기에는 bakeMicro 같은 "안 바뀌었으면 건너뛰기" 가드를 두지 않는다. 한 번 넣었다가
//   sunRot 을 180 → 0 으로 되돌렸는데 **뒤집힌 방향이 그대로 남는** 버그를 실측으로 잡았다
//   (2026-09-07 : sunRot 0 인데 태양이 +0.340, +0.907 로 부호가 뒤집혀 있었다).
//   비용은 sin/cos 세 번이라 매 프레임 구워도 공짜다 — 굳이 캐시할 값이 아니었다.
function bakeSun(v) {
  const dz = (P.sunRot || 0) * Math.PI / 180, dy = (P.sunTilt || 0) * Math.PI / 180;
  if (!dz && !dy) { v.copy(SUN_N); return; }
  const az = SUN_AZ0 + dz, el = SUN_EL0 + dy, ch = Math.cos(el);
  v.set(Math.sin(az) * ch, Math.sin(el), Math.cos(az) * ch);
}

// vec4 다섯 칸을 배열처럼 다루기 위한 어댑터. 유니폼 객체는 그대로 두고 참조만 모은다
const MICRO_SLOTS = (u) => [u.uMicroD0, u.uMicroD1, u.uMicroD2, u.uMicroD3, u.uMicroD4];

// ⚠ update() 안에서 매 프레임 불린다. 세 값이 그대로면 즉시 돌아간다 —
//   sin/cos 열 번을 매 프레임 도는 것은 이 손잡이가 값어치하는 비용이 아니다
let _microKey = '';
function bakeMicro(slots) {
  const key = (P.microRot || 0) + '/' + P.microSpread + '/' + P.microScale;
  if (key === _microKey) return;
  _microKey = key;
  const rot = (P.microRot || 0) * Math.PI / 180;
  const spread = P.microSpread === undefined ? 1 : P.microSpread;
  const scale = Math.max(0.05, P.microScale === undefined ? 1 : P.microScale);
  for (let i = 0; i < MICRO_BANDS.length; i++) {
    const b = MICRO_BANDS[i];
    const deg = MICRO_MID + (b.deg - MICRO_MID) * spread;
    const th = deg * Math.PI / 180 + rot;
    const k = b.k / scale;                       // 파장 = 2π/k 이므로 배율은 나눈다
    // xy 방향 · z 파수 · w 각속도. ω 는 분산관계에서 파생한다 (위 ⚠)
    slots[i].value.set(Math.cos(th), Math.sin(th), k, 0.62 * Math.sqrt(9.81 * k));
  }
}

const UNI_OF = { waterBase: 'uBase', waterMid: 'uMid', waterTrough: 'uTrough',
                 transmission: 'uTrans', wake: 'uWakeCol', subTint: 'uSubTint',
                 foam: 'uFoamCol' };
// ───────── 물 팔레트 테마 ─────────
// ⚠ CONFIG.waterThemes 를 THREE.Color 로 한 번만 굽는다. 테마가 적지 않은 키는 기본
//   팔레트(color / colorDeep)에서 그대로 온다 — 그래서 0 번은 비트 단위로 예전과 같다.
// ⚠ waterTone 은 테마 **안에서** light(0) ↔ deep(1) 을 오간다. 테마는 색선, tone 은 그 위의 자리다.
const THEMES = (CONFIG.waterThemes && CONFIG.waterThemes.length
  ? CONFIG.waterThemes
  : [{ name: '종이', light: {}, deep: {} }]
).map(t => {
  const L = {}, D = {};
  PAIR.forEach(k => {
    L[k] = new THREE.Color((t.light && t.light[k] !== undefined) ? t.light[k] : LIGHT[k]);
    D[k] = new THREE.Color((t.deep  && t.deep[k]  !== undefined) ? t.deep[k]  : DEEP[k]);
  });
  return { name: t.name, L, D };
});
// 예전 이름을 남겨 둔다 — 0 번 테마의 양 끝이다 (다른 모듈이 참조할 때를 대비)
const C_LIGHT = THEMES[0].L, C_DEEP = THEMES[0].D;

// ⚠⚠ 유니폼을 직접 lerp 하면 두 번째 프레임부터 이미 섞인 값에서 또 섞여 점점 바랜다.
//   양 끝 원본을 붙들어 두고 **매번 처음부터** 섞는다.
// ⚠ 키에 테마 번호가 들어간다. tone 만 보면 테마를 갈아탈 때 갱신이 안 된다 (실제로 그렇게 놓쳤다)
let _palKey = '';
function syncPalette(uni) {
  const n = THEMES.length;
  // ⭐ 시간대(sceneTime, 2026-09-11 밤)가 켜져 있으면 waterTheme · waterTone 을 건너뛰고 표의 값을 쓴다 (times.js).
  //   반짝임·이음매 색(uApex)과 물이 녹아드는 원경색(uBg)도 같이 — 둘은 만들 때 한 번 칠하고 안 바뀌던 값이다
  const TM = timeNow();
  const i = Math.min(n - 1, Math.max(0, Math.round(TM ? TM.water.theme : (P.waterTheme || 0))));
  const tone = TM ? TM.water.tone : P.waterTone;
  // ⭐ 잠수 (2026-09-18, dive.js) — 이 팔레트 **전체**가 짙은 바다색으로 눕는다.
  //   ⚠⚠ 유니폼을 따로 밀지 않고 **여기 한 곳에서** 섞는다. 이 함수는 양 끝 원본에서 매번 처음부터
  //     섞으므로(위 주석) 잠수가 0 으로 돌아오면 값이 **정확히** 제자리다 — 밖에서 밀면 이 캐시(key)가
  //     되돌릴 기회를 영영 안 준다 (바다가 짙은 채로 남는다).
  //   ⚠ 거품 · 항적까지 같이 눕는다. 1초 동안 물속으로 들어가는 길이라 흰 줄만 남기지 않는다 —
  //     남기고 싶으면 `foam` · `wake` 를 이 섞기에서 빼는 것이 첫 손잡이다 (색은 화면에서 정한다)
  const D = diveNow();
  const dk = D ? D.dim : 0;
  const key = i + '/' + tone + '/' + timeKey() + '/' + dk.toFixed(3);
  if (key === _palKey) return;
  _palKey = key;
  const T = THEMES[i];
  PAIR.forEach(k => {
    const c = uni[UNI_OF[k]].value.copy(T.L[k]).lerp(T.D[k], tone);
    if (dk > 0) c.lerp(D.deep, dk);
  });
  uni.uApex.value.set(TM ? TM.apex : CONFIG.color.crestApex);
  uni.uBg.value.set(TM ? TM.bg : CONFIG.color.bg);
  // ⭐ 배 밑 물의 그늘색도 시간대를 탄다 (2026-09-27) — 낮의 색(color.boatShadow)은 저녁 물과 같고 밤 물보다 밝아 그늘이 안 됐다 (config.js 저녁 water.shadow 주석).
  //   ⚠ 표에 없으면(낮) 예전 색 그대로다. 잠수는 이 색을 안 눕힌다 (예전과 같다)
  uni.uShadowCol.value.set(TM && TM.water.shadow ? TM.water.shadow : CONFIG.color.boatShadow);
  // ⚠⚠ **마루선(오로라)의 두 색은 만들 때 한 번 칠하고 안 바뀌던 값이다** — 시간대도 안 탄다.
  //   잠수가 이 둘을 안 눕히면 **물만 어두워지고 밝은 선만 남는다** (2026-09-18 실측 : 짙어진 물 위에
  //   #9FE6F3 아이스블루 마루선이 그대로 떠 있었다 — 화면이 안 어두워 보이던 가장 큰 몫).
  //   ⚠ 그래서 여기서 **매번 원본에서** 다시 칠한다 — dk 0 이면 값 단위로 예전과 같다.
  uni.uViolet.value.set(CONFIG.color.crestViolet);
  uni.uBlue.value.set(CONFIG.color.crestBlue);
  if (dk > 0) {
    // ⚠ 물이 녹아드는 원경색 — 하늘(stage) · 씬 배경과 **같은 값**이라야 물끝에 띠가 안 생긴다
    uni.uBg.value.lerp(D.deep, dk);
    // 반짝임 · 이음매의 금빛도 같이 눕는다 — 안 눕히면 짙어진 물 위에 **금색 길만** 남는다
    uni.uApex.value.lerp(D.deep, dk);
    // 마루선 두 색 (위 주석)
    uni.uViolet.value.lerp(D.deep, dk);
    uni.uBlue.value.lerp(D.deep, dk);
  }
}

const WATER_VERT = SWELL + `
uniform sampler2D uH; uniform float uHScale; uniform vec2 uTexel; uniform float uCell;
uniform vec2 uCam; uniform float uDetail0, uDetail1;
varying vec2 vUv; varying vec3 vW; varying vec2 vGradW; varying float vDetail;
// ⚠ 물의 **재질 좌표** (Gerstner 횡변위 전). 월드 위치 vW.xz 와 다르다 —
// 거품은 물 위에 떠 있으므로 월드가 아니라 **이 좌표에 붙어야** 파도를 따라 움직인다
varying vec2 vMat;
varying vec4 vProj;
// 군 포락선의 너울 배율 E_s. 프래그먼트의 잔결(microG)과 검증 보기(debugView 10)가 쓴다.
// ⚠ 삼각형 한 변이 0.215 인데 포락선의 최단 파장이 10.5 라, 선형 보간 오차가 0.1% 아래다 —
//   프래그먼트에서 sin 을 다시 돌 이유가 없다
varying float vEnv;
// ⭐ 마루선 판정 전용 기울기 (2026-09-29, S15P21E203-448) — 너울(lo) 대역 + 시뮬. **잔물결이 없다.**
//   vGradW 는 잔물결까지 담아 한 파장에 정점이 5.6~7.9개뿐이라, 그걸로 잰 fwidth(dirf) 가 삼각형마다 튀었다 (프래그먼트 dirf 주석)
varying vec2 vGradS;
void main(){
  vUv = uv;
  // 높이를 얹기 전의 평평한 월드 위치. 여기서 카메라 거리를 먼저 구해야
  // 그 거리로 '얼마나 잘게 그릴지'를 정할 수 있다 (평면은 -90도 눕혀져 local z = world y)
  vec4 wp = modelMatrix * vec4(position, 1.0);
  float dist = length(wp.xz - uCam);
  // 거리 LOD : 잔물결 대역만 서서히 끈다. 원경에서 파장이 한 픽셀 밑으로 내려가면
  // 반짝임과 모아레만 남고 형태는 안 보인다 — 그릴수록 손해다.
  // 저주파 너울은 줄이지 않는다. 그건 지평선까지 이어져야 하는 바다의 형태다
  float detail = 1.0 - smoothstep(uDetail0, uDetail1, dist);
  vDetail = detail;

  vec2 sp = wp.xz + uSwellOff;          // 너울의 매개변수 좌표 (횡변위 전)
  // ⚠⚠ 군 포락선은 **한 번만** 뜨고 H·G·D 에 같이 넘긴다 (2026-09-06).
  //   각자 뜨게 두면 정점당 삼각함수가 8 → 24 회가 되고, 더 나쁘게는 세 층이 서로 다른 E 를
  //   볼 수 있다 — 그러면 기울기가 높이의 도함수가 아니게 되어 마루선·앞뒤 면·거품이
  //   전부 어긋난 자리에 선다
  vec4 env = swellEnv(sp);
  vEnv = env.x;
  // ⚠ 높이와 기울기는 swellHGS 로 **한 번에** 받는다 (같은 위상을 두 번 안 돈다) — 너울만의 기울기 swGS 도 같은 호출에서 나온다
  float swH; vec2 swG, swGS;
  swellHGS(sp, detail, env, swH, swG, swGS);
  wp.y += texture2D(uH, uv).x * uHScale + swH;
  // 시뮬 기울기. gr.y 의 부호를 뒤집는 이유는 grid.js 와 같다 (uv.y 가 z 와 반대 방향)
  vec2 gr = vec2(
    texture2D(uH, uv + vec2(uTexel.x, 0.0)).x - texture2D(uH, uv - vec2(uTexel.x, 0.0)).x,
    texture2D(uH, uv + vec2(0.0, uTexel.y)).x - texture2D(uH, uv - vec2(0.0, uTexel.y)).x
  ) / (2.0 * uCell);
  vGradW = vec2(gr.x, -gr.y) * uHScale + swG;
  // ⚠ 시뮬 항은 남긴다 — 선체가 밀어낸 물결의 마루선도 이 판정을 탄다 (항적 가장자리)
  vGradS = vec2(gr.x, -gr.y) * uHScale + swGS;
  vMat = sp;                           // 횡변위 **전** 좌표를 그대로 넘긴다 (거품이 쓴다)
  wp.xz += swellD(sp, detail, env);     // 그리드와 같은 변위 — 안 맞추면 마스크가 어긋난다
  vW = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
  vProj = gl_Position;
}`;

// ⚠ FOAM_CLUMP 는 검증 보기 15 만 쓴다 (v0.60). SWELL 뒤라야 한다 — uTimeQ · uWaveSpeed 를 ENV_GLSL 이 먼저 선언한다
const WATER_FRAG = SWELL + SKY_GLSL + FOAM_CLUMP + `
uniform vec3 uBg, uBase, uMid, uTrough, uTrans, uFloorLine;
uniform vec3 uViolet, uBlue, uApex;
uniform float uFade0, uFade1;
uniform float uFadeSky;   // 물이 사라진 자리를 하늘색으로 칠하는 정도 (0 = 예전 uBg)
uniform vec2 uCam;
uniform vec2 uLightXZ; uniform float uSteepK, uShade, uSpec;
uniform float uHNorm, uTime;
uniform float uFloorAmt, uFloorK, uRefract, uDepth, uFloorW;
uniform vec2 uFloorNear;   // 바닥 격자가 보이는 카메라 거리 (camDist 를 탄다)
uniform float uMicroA, uMicroB, uMicroWarp;
// 잔결 5대역 : xy = 방향, z = 파수 k, w = 각속도 ω. MICRO_BANDS 에서 CPU 가 구워 넣는다
// ⚠⚠ **배열 유니폼(uniform vec2 uMicroDir[5])으로 쓰면 안 된다.** 이 셰이더에서 실측으로
//   깨졌다 (2026-09-07) — 선언이 소스 139줄에 분명히 있고 사용이 299줄인데도 컴파일러가
//   'undeclared identifier' 를 냈고, 그런데도 물은 그려졌다. 즉 **조용히 옛 값으로 돌았다.**
//   판정은 눈이 아니라 A/B 였다 : microRot 을 90도 돌렸는데 화면이 **0픽셀** 바뀌었다.
//   vec4 다섯 개로 풀어 쓰면 문제가 없다. 대역을 늘릴 일이 생기면 이 함정을 먼저 떠올릴 것.
uniform vec4 uMicroD0, uMicroD1, uMicroD2, uMicroD3, uMicroD4;
uniform float uEnvMicro;
uniform vec3 uLightDir3;
uniform float uSpecAmt, uGlitter, uGlitOct2;
// 태양 반짝임 (HDR, S15P21E203-435) : 세기 · HDR 배율 / 로브 (가까이, 멀리) / 알갱이 → 빛길 거리 / 심의 색으로 가는 세기 구간
uniform float uGlintAmt, uGlintHot, uGlintFarK;
uniform vec2 uGlintShine, uGlintDist, uGlintWhite;
uniform vec3 uGlintCore;
uniform float uSkyAmt;
uniform float uShadowAmt, uShadowIn, uShadowKnee, uShadowOcc;
uniform float uContactAmt, uSmearK;
uniform float uScatNear, uScatFar, uScatRamp;
uniform vec2 uContactSize, uBoatUv;
uniform float uToneAmt;
uniform vec2 uToneDist;
uniform vec3 uToneCol;
uniform vec2 uShadowSize, uBoatDir;
uniform vec3 uShadowCol;
// ⭐ 해 쪽 주광의 **실제 그림자** (2026-09-27 · main.js sunLight 의 그림자 맵을 그대로 읽는다 — 아래 '배 그림자 ②')
//   uSunShK : x 세기 · y 깊이 여유 · z 가린 것에서 1 월드 멀어질 때 늘어나는 번짐 폭 · w 바닥 번짐 폭 (월드)
//   uSunShSpan : 그림자 카메라의 가로 · 세로 · 깊이 (월드) · 배(겨누는 점)의 깊이 (0~1)
#include <packing>
uniform sampler2D uSunSh;
uniform mat4 uSunShMat;
uniform vec4 uSunShK, uSunShSpan;
uniform vec2 uSunShReach;   // 배에서 이 거리(월드) 사이에서 그림자가 녹는다 — 앞은 그대로 · 뒤는 0
uniform float uShine, uGlitCell;
uniform vec3 uBoatPos;
// 공중의 향수 부표. xyz = 씬 좌표, w = 반지름. 배열 크기는 JS 의 MARK_REFL_MAX 와 같아야 한다
uniform vec4 uMarkPos[${MARK_REFL_MAX}];
uniform vec3 uMarkCol[${MARK_REFL_MAX}];
uniform int uMarkN;
uniform float uMarkRefl, uMarkSpread, uMarkFall, uMarkGlow, uMarkCore, uMarkAnchor;
uniform sampler2D uRefl;
uniform float uReflAmt, uReflFade, uReflSharp, uReflRise, uReflBlur;
uniform float uReflRipple, uReflPush, uReflAim;
uniform float uScatter, uScatCell, uScatK;
// ⚠ uH 는 정점 셰이더에도 선언돼 있지만, 프래그먼트는 자기 선언이 따로 있어야 한다
uniform sampler2D uH;
uniform vec3 uWakeCol; uniform float uWakeAmt, uWakeEdge, uWakeLo, uWakeHi;
uniform float uFoamLo, uFoamHi2, uFoamBlur;
uniform vec3 uFoamCol; uniform float uFoamWhite;
// 선체 접촉 거품. ⚠ 선언·초기화·갱신 세 곳이 한 묶음이다 (지난번 하나가 빠져 화면이 죽었다)
uniform float uHullAmt, uHullTaper, uHullBand, uHullPush;
uniform float uHullLap, uHullHit, uHullBead, uHullCull, uBoatY;
uniform float uHullInner, uContactLift, uHullDrift, uHullSwell, uHullOuter;
uniform float uReflMirror;
uniform float uSmearFade;
uniform vec4  uHullG;      // x = 1/a · y = 1/b · z = 도달반경(dB) · w = 흘수 램프 폭
uniform vec4  uHullT;      // x = 꼬리 세기 · y = 꼬리 하한 · z = 차선 폭 · w = **공칭 흘수**
uniform vec2  uHullTilt;   // (pitch, roll) 라디안. ⚠ 나누지 않는다 — hfw 와 곱해 월드가 된다
uniform float uSubReach;   // 잠긴 선체 거리 게이트 (0 = 무제한 = 예전 동작)
uniform float uFoamCell, uFoamThin, uFoamThick, uFoamEdge, uFoamBubble;
uniform float uFoamNear, uFoamFar, uFoamDrift, uFoamCull;
// ── 흰 거품 v0.10.4. 세 묶음이다 : 나이(③) · 자리(③) · 무늬(①②)
uniform float uFoamWLo, uFoamWHi;
uniform float uFoamLH0, uFoamLH1, uFoamLH2, uFoamLH3;
uniform float uFoamFace, uFoamFaceB, uFoamFaceA, uFoamLive, uFoamCalm;
uniform float uFoamFaceS, uFoamFaceSoft, uFoamFaceOut;   // v0.11.4 앞뒤 창
uniform float uLineYield, uLineYieldSrc, uLineYieldK;           // v0.60 두 겹 — 마루선 층이 흰 거품에 비킨다
uniform float uFoamFaceKeep, uFoamFaceKeepLo, uFoamFaceKeepHi;  // v0.60 두 겹 — 짙은 기억은 뒷면에서도 안 누른다
uniform float uFoamKnee, uLineFoamSrc;                          // v0.60 시안 — 흰 거품 무릎 · 마루선 나이 곡선 공유
uniform float uFoamUnder, uFoamTailLo, uFoamTailHi, uFoamUnderA;       // v0.61 파란 띠 밑 얇게
uniform float uFoamStripAt, uFoamStripW;                               // v0.61 파란 띠 바로 밑 (오로라 무리 가장자리)
uniform vec2  uFoamReachUV;                                             // v0.61 파도 뒤쪽 기억 조회 (기억 텍스처 좌표 이동량 — JS 가 계산)
uniform float uFoamPatch, uFoamPatchCell, uFoamPatchLo, uFoamPatchHi;  // v0.61 거품 군집
uniform float uFoamShade, uFoamLace, uFoamLaceThin;             // v0.60 시안 — 곡면 명암 · 레이스 (기본 0)
// ── 반짝임 거품 v0.12.1. 세 겹이다 : 높이(H0/H1/Rise) · 뭉침(Clump/Lo/Hi) · 알갱이(Cell/Jit/Shine)
uniform float uSparkAmt, uSparkH0, uSparkH1, uSparkRise;
uniform float uSparkFace, uSparkFaceW, uSparkFaceB, uSparkDrift;
uniform float uSparkClump, uSparkLo, uSparkHi, uSparkCell, uSparkJit, uSparkShine, uSparkDens, uSparkCull;
uniform float uFoamWarp, uFoamRough, uFoamStretch, uFoamFine, uFoamFineAmt, uFoamAA;
uniform float uCrestFace, uCrestBias;
uniform float uCrestEps;   // dirf 분모의 바닥 (params.crestEps) — 기울기 0 인 점의 꼭지점을 푼다
uniform float uLineAmt, uLineW, uLineHalo, uLineH0, uLineH1;
uniform float uLineFoam, uLineFoamHi;
uniform float uSeamAmt, uSeamW, uSeamH0, uSeamH1;
uniform float uGlowAmt, uGlowW;
uniform sampler2D uSub;
uniform float uSubAmt, uSubRefract, uSubScatter, uSubCell, uSubScatK, uSubEdge, uSubBreak, uSubDeepBlur;
uniform vec3 uSubTint;
uniform float uApexAmt, uApexH0, uApexH1, uSunLobe;
uniform int uDebug;
uniform float uDbgEdge;
uniform vec2 uSwellDir;
varying vec2 vUv; varying vec3 vW; varying vec2 vGradW; varying float vDetail;
// ⚠ 물의 **재질 좌표** (Gerstner 횡변위 전). 월드 위치 vW.xz 와 다르다 —
// 거품은 물 위에 떠 있으므로 월드가 아니라 **이 좌표에 붙어야** 파도를 따라 움직인다
varying vec2 vMat;
varying vec4 vProj;
varying float vEnv;          // 군 포락선의 너울 배율 (정점에서 보간)
varying vec2 vGradS;         // 마루선 판정 전용 기울기 — 너울 + 시뮬, 잔물결 없음 (정점 셰이더 주석 · S15P21E203-448)

// 격자점 하나당 고정 난수 2개 (-0.5 ~ 0.5). 반짝임 노이즈의 재료다
vec2 hash2(vec2 c){
  return vec2(fract(sin(dot(c, vec2(12.9898, 78.233))) * 43758.5453),
              fract(sin(dot(c, vec2(39.3460, 11.1350))) * 24634.6345)) - 0.5;
}
// ── 2채널 값 노이즈. hash2 가 vec2 를 주므로 보간 **한 번**으로 변위 벡터가 통째로 나온다 —
// 스칼라를 두 번 뜨면 해시 8회인 것을 4회로 줄이는 것이 이 함수의 존재 이유다.
// 반환은 ±0.5 (그건 최댓값이고 전형값은 ±0.17 쯤이다 — 접힘 판정에는 **최댓값**을 쓴다).
// ⚠ 반짝임(gn)·난반사(kn)·투과(sn)가 인라인으로 쓰는 것과 같은 식이다. 그쪽을 이걸로
//   바꾸는 리팩터링은 **하지 않는다** — 시각적 사양이 조용히 바뀐다.
vec2 vnoise2(vec2 p){
  vec2 i = floor(p), f = p - i;
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash2(i),                  hash2(i + vec2(1.0, 0.0)), f.x),
             mix(hash2(i + vec2(0.0, 1.0)), hash2(i + vec2(1.0, 1.0)), f.x), f.y);
}
// ── worley : 가장 가까운 두 세포점까지의 거리 (F1, F2).
// 거품의 기포 구조가 이것이다 — 기포 하나가 세포이고, 흰 것은 기포들이 만나는 **벽**이다.
//
// ⚠⚠ **벽은 F1 이 아니라 F2 − F1 이다.** F1 을 높은 문턱으로 자르면 벽이 아니라
// **꼭짓점(세 세포가 만나는 점)의 알갱이**가 남는다 — 실제로 그렇게 짰다가 화면이
// 연결된 그물이 아니라 모래알이 됐다. F2−F1 은 두 세포의 경계선 **전체**에서 0 에 가깝다.
// ⚠ hash2 는 ±0.5 를 주므로 +0.5 해서 셀 안 [0,1] 로 옮긴다
// ⚠⚠ 비교는 **제곱거리**로 한다. 순서가 같으므로 F1/F2 순위가 그대로 보존되고
//   sqrt 가 겹당 9회 → 2회가 된다 (두 겹이니 18 → 4). 도메인 워프가 새로 쓰는
//   해시 4회를 여기서 벌어 온다. 센티널 64.0 은 옛 8.0 의 제곱이다
vec2 worleyF12(vec2 p){
  vec2 i = floor(p), f = p - i;
  float d1 = 64.0, d2 = 64.0;
  for (int y = -1; y <= 1; y++){
    for (int x = -1; x <= 1; x++){
      vec2 g = vec2(float(x), float(y));
      vec2 r = g + hash2(i + g) + 0.5 - f;
      float d = dot(r, r);
      if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) { d2 = d; }
    }
  }
  return vec2(sqrt(d1), sqrt(d2));
}
void main(){
  // grid.js 와 같은 식 — 경사의 '방향'과 '세기'를 갈라서 쓴다 (물리적 dot(N,L) 은 이 바다에서
  // 진폭이 너무 작아 안 보인다. 작업계획 [2단계] 참고)
  float slope = length(vGradW);
  float steep = clamp(slope * uSteepK, 0.0, 1.0);
  float lit = -dot(vGradW / max(slope, 1e-5), uLightXZ) * steep;   // -1 = 등짐, +1 = 받음

  // 정규화된 파도 높이. 색의 모든 배치가 이 값 위에 선다
  float h = clamp(0.5 + vW.y * uHNorm, 0.0, 1.0);
  float crestMask = smoothstep(0.68, 0.94, h);   // 마루 근처의 얇은 띠 (바닥 격자를 가리는 용도)

  // ── 기본색 : 골짜기 → 중간 면 → 수면 기본. 셋 다 차가운 쪽이다.
  // ⚠ 방향광은 별도의 색 축을 만들지 않는다. '높이를 미는' 것으로만 작용시킨다 —
  // 예전에는 따뜻한 물색을 uShade 로 외삽했고, 그게 최암부를 종이의 6.5배로 따뜻하게 만들었다.
  // 밝기와 색조가 한 덩어리로 묶여 있으면 "더 어둡게" 가 곧 "더 베이지로" 가 된다
  float hc = clamp(h + uShade * lit * 0.16, 0.0, 1.0);
  vec3 c = mix(uTrough, uMid, smoothstep(0.0, 0.55, hc));
  c = mix(c, uBase, smoothstep(0.45, 1.0, hc));

  // ── micro ripple : 기하가 아니라 '노멀에만' 얹는 잔물결 두 대역.
  // 파장 1.30 / 0.85 는 정점 간격 0.43 으로 그릴 수 없다 (3, 2 샘플). 기하로 넣으면
  // 형태는 안 나오고 반짝임만 남는다. 그래서 큰 파도의 실루엣은 건드리지 않고
  // 프레넬과 굴절 방향만 가늘게 나눈다 — vW.y 와 h 와 배의 부력에는 영향이 없다.
  // 시각은 uTime 이 아니라 uTimeQ 다. 컷아웃 프레임 질감을 깨지 않기 위해서다
  // ⚠⚠ **2026-09-06 : 방향 2개짜리 순수 코사인이었다 — 구조적으로 평행 등간격 격자다.**
  //   사용자가 스크린샷에 빨간 선을 그어 지적한 *"일자로 똑같은 형태의 반복성 그래픽"* 이 이것이다.
  //   원래도 있었지만 v0.12.3 에서 파도를 완만하게 만들면서 드러났다 —
  //   너울 기울기 rms 가 0.361 → 0.144 로 내려가, 정반사가 쓰는 vGradW + microG*3.0 에서
  //   (⚠ 이 주석은 셰이더 **템플릿 문자열 안**이다 — 백틱을 쓰면 문자열이 거기서 끊긴다)
  //   **잔결의 몫이 33% → 83%(잔잔한 구역 128%)** 가 됐다. 격자가 화면을 지배하게 된 것이다.
  //
  // 고친 방법 세 가지 :
  //   ① **대역 2 → 5, 방향을 −78°~+62° 로 넓게.** 파장도 불규칙하게(1.90/1.45/1.15/0.92/0.70).
  //      BANDS 주석 ⑤가 큰 파도에 대해 적은 것과 같은 이유다 — 등간격·소수 방향은 골함석이 된다.
  //      ⚠ 총 rms 는 **정확히 보존**했다 (그룹별 가중치를 √Σw² 로 정규화). microA/microB 의
  //        뜻이 안 바뀐다 — 세기가 아니라 **무늬만** 바뀌었다.
  //   ② **도메인 워프** (uMicroWarp). 정현파 합은 아무리 겹쳐도 마루가 직선이다.
  //      좌표를 먼저 구부려야 마루가 휜다 (거품의 워프와 같은 처방). 0 = 예전 직선.
  //   ③ **좌표를 월드(vW.xz) → 재질(vMat).** 월드에 박으면 물이 그 밑으로 흘러 '도장'이 된다.
  // ⚠ ω 는 손대지 않았다 — 원래도 ω = 0.62√(g·k) 였다 (검산 : k 7.3920 → 5.2797 ✓).
  //   시각은 uTime 이 아니라 uTimeQ 다 (컷아웃 질감).
  // ⚠ 여전히 **노멀에만** 얹는다. vW.y · h · 배의 부력에는 영향이 없다.
  float calmK = clamp((1.0 - vEnv) / max(1.0 - uEnvLo, 1e-3), 0.0, 1.0);
  vec2 mq = vMat + vnoise2(vMat * 0.30) * uMicroWarp;
  // ⚠ 방향과 파수는 **MICRO_BANDS 표에서 구워 온다** (uMicroDir / uMicroKW). 예전에는 이 자리에
  //   vec2(0.9063, 0.4226) 같은 숫자가 박혀 있어 각도를 만지려면 셰이더를 고쳐야 했다.
  //   위상과 진폭계수는 여전히 상수다 — 무늬의 성격을 정하는 값이라 손잡이로 열지 않았다.
  //   ⚠ 굽는 것은 CPU 다. 여기서 도는 산술은 예전과 같다 (곱셈 하나도 안 늘었다).
  vec2 mg = vec2(0.0), md; float mp;
  md = uMicroD0.xy;  mp = dot(mq, md) * uMicroD0.z - uMicroD0.w * uWaveSpeed * uTimeQ + 2.31;
  mg += md * (uMicroA * 0.7411) * cos(mp);   // λ 1.90
  md = uMicroD1.xy;  mp = dot(mq, md) * uMicroD1.z - uMicroD1.w * uWaveSpeed * uTimeQ + 5.07;
  mg += md * (uMicroA * 0.5336) * cos(mp);   // λ 1.45
  md = uMicroD2.xy;  mp = dot(mq, md) * uMicroD2.z - uMicroD2.w * uWaveSpeed * uTimeQ + 0.84;
  mg += md * (uMicroA * 0.4076) * cos(mp);   // λ 1.15
  md = uMicroD3.xy;  mp = dot(mq, md) * uMicroD3.z - uMicroD3.w * uWaveSpeed * uTimeQ + 3.96;
  mg += md * (uMicroB * 0.8269) * cos(mp);   // λ 0.92
  md = uMicroD4.xy;  mp = dot(mq, md) * uMicroD4.z - uMicroD4.w * uWaveSpeed * uTimeQ + 1.52;
  mg += md * (uMicroB * 0.5623) * cos(mp);   // λ 0.70
  vec2 microG = mg * vDetail * (1.0 + uEnvMicro * calmK);
  // ⚠⚠ **픽셀당 해시 수를 세는 계수기** (2026-09-06). 검증 보기 12 가 이걸 히트맵으로 그린다.
  //   숨겨진 패널에서는 GPU 타이머가 거짓말을 하므로(셰이더를 다 꺼도 같은 ms), **어느 층이
  //   몇 픽셀에서 몇 번 도는가**가 여기서 유일하게 믿을 수 있는 비용 측정이다.
  //   바닥 = glitter 두 옥타브(8) + 잔결 워프(4) + **반사 흩기 4**. 전부 물 **전체**에서 돈다.
  // ⚠⚠ **2026-09-06 : 이 계수기가 거짓말을 하고 있었다.** 셋이 틀렸다 —
  //   ① 756줄이 굵은 그물에 18 을 청구했는데 실제는 vnoise2(4) + worleyF12(9) = **13** 이다
  //      (worleyF12 는 3×3 루프에 hash2 **1회**다 — 183~195줄. '두 겹' 이라 18 로 적었던 듯하다)
  //   ② 403~404줄의 반사 흩기 kn 은 hash2 **4회**인데 어디에도 안 세어졌다. **무조건** 돈다
  //   ③ 1072·1097줄의 잠긴 선체는 각각 4회씩 **8회**인데 역시 안 세어졌다
  //   측정으로 판정하는 프로젝트에서 **계측기가 오차를 굴려 나르고 있었다.**
  //   ⚠ 여기를 고치면 1163~1171 의 계단 문턱과 viewbar 범례도 **같이** 고쳐야 한다.
  // 바닥 = glitter 첫 옥타브 4 + 둘째 옥타브 4(켜면) + 잔결 워프 4(켜면) + 반사 흩기 4
  float dbgCost = 4.0 + (uGlitOct2 > 0.001 ? 4.0 : 0.0)
                      + (uMicroWarp > 0.001 ? 4.0 : 0.0)
                      + 4.0;

  // ── 물속이 보인다
  // 법선을 8배 과장해야 스침각이 파도를 따라 변한다 (실제 기울기가 작아서,
  // 그대로 쓰면 프레넬이 지평선에만 균일하게 깔린다)
  vec3 N = normalize(vec3(-(vGradW.x + microG.x) * 8.0, 1.0, -(vGradW.y + microG.y) * 8.0));
  vec3 V = normalize(cameraPosition - vW);
  float fres = pow(1.0 - clamp(dot(N, V), 0.0, 1.0), 3.0);
  c = mix(c, uTrans, fres * 0.22 * uSpec);   // 기울어진 면에 차가운 투과색

  // 수영장 바닥 : 수면이 기울어진 만큼 밀려 보이는 격자. 굴절 흉내다.
  // 일렁임이 공짜로 나온다 — 빛과 마루 색을 구동하는 그 기울기를 그대로 쓰기 때문이다.
  
  //
  // ⚠ 무늬를 수면 좌표(vW.xz)에 바로 그리면 안 된다. 그건 파도를 타고 다니는 표면 데칼이지
  // 바닥이 아니다. 바닥은 평평하게 깊이에 있고 우리는 그걸 물을 통해 볼 뿐이다 —
  // 그래서 시선 레이를 바닥 평면(y = -uDepth)까지 내려서 만나는 지점을 찾는다.
  // 이래야 시선이 스칠수록 바닥이 멀리 늘어나는 진짜 시차가 생긴다.
  // 꺼져 있으면(uFloorAmt = 0) 아래 계산을 통째로 건너뛴다
  if (uFloorAmt > 0.0) {
  vec3 I = -V;                                    // 카메라 → 수면 방향
  float tHit = (vW.y + uDepth) / max(-I.y, 1e-3);
  vec2 fp = vW.xz + I.xz * tHit;                  // 바닥 평면과의 교점
  // 수면 기울기가 그 교점을 민다 = 굴절. 일렁임은 여기서 나온다.
  // ⚠ 밀림(uRefract · 기울기)이 격자 한 칸을 넘으면 안 된다. 자기 주기보다 크게 밀면
  // 격자 구조가 남지 않고 뭉개진다 — 일렁이는 게 아니라 흐트러진 것이 된다 (실측).
  fp += vGradW * uRefract;
  // 선 두께는 거듭제곱이 아니라 '선까지의 거리'로 잡는다. cos^N 은 N=6 에서 칸의 30% 가
  // 선이 되고, 얇게 만들려면 N 을 80 넘게 올려야 한다 — 두께를 직접 지정하는 게 낫다.
  // uFloorW 는 칸 대비 선 두께다 (0.05 = 칸의 5%)
  vec2 tg = abs(fract(fp * uFloorK) - 0.5);
  float dl = 0.5 - max(tg.x, tg.y);           // 0 = 선 위, 0.5 = 칸 한가운데
  float fl = 1.0 - smoothstep(0.0, uFloorW, dl);
  // 물속은 내려다볼 때만 보인다. 스치는 각도에서는 반사가 이겨 바닥이 안 보인다 —
  // 물리적으로 맞고, 원경에서 격자가 앨리어싱하는 것도 이 한 항이 같이 막는다
  float look = smoothstep(0.03, 0.40, clamp(V.y, 0.0, 1.0));
  // ⚠ 이번 아트 방향에서 바닥 격자는 핵심 요소가 아니다. 카메라를 수면 가까이 내리면
  // 스치는 각도가 되어 원래 잘 안 보이는 게 맞다 — 억지로 살리지 않는다.
  // 카메라 바로 앞의 잔잔한 근경에만, 마루가 아닌 곳에 아주 옅게 남긴다
  // ⚠⚠ **카메라에서의 거리라 camDist 를 타야 한다** (2026-09-06). 7~14 를 상수로 두면
  //   카메라를 물릴 때마다 화면에서 조용히 사라진다 — camDist 3.24 에서 카메라가 원점에서
  //   30 월드라, 14 월드 안쪽이 화면에 거의 안 들어와 **바닥 격자가 통째로 안 보였다.**
  //   uFade0/uFade1·uDetail0/1 이 이미 camDist 를 타는 것과 같은 이유다 (main.js 주석).
  float nearFade = 1.0 - smoothstep(uFloorNear.x, uFloorNear.y, distance(cameraPosition.xz, vW.xz));
  // 바닥 선은 물보다 어두워야 한다. 투과색(시안 화이트)으로 그리면 흰 격자가 되어
  // 물 위에 뜬 것처럼 보인다 — 바닥은 빛이 덜 닿는 곳이다
  c = mix(c, uFloorLine, fl * uFloorAmt * nearFade * (1.0 - crestMask) * look * vDetail);
  }

  // ── 정반사 (빛이 실제로 반사되는 자리)
  // ⚠ 여기서는 계산만 한다. 칠하는 것은 이 함수의 맨 끝이다 — 오로라가 반짝임 위를 덮으면
  // 빛이 탁해진다. 다만 최상단 백색이 이 sp 를 게이트로 쓰므로 계산은 먼저 와야 한다
  // 하프벡터 방식. 광원·시선·법선이 맞는 면에서만 밝아지므로, 마루라고 다 희어지지 않고
  // 각도가 맞는 마루만 골라서 빛난다 — 그게 물처럼 보이는 이유다.
  vec3 Hv = normalize(uLightDir3 + V);

  // 반짝임 노이즈. 이어지는 저주파(월드 1/uGlitCell)라 하이라이트가 둥근 덩어리로 뜬다.
  //
  // ⚠ 예전에는 파도 높이로 '잔잔 ↔ 거침'을 갈라, 마루에서 셀을 1/70 까지 잘게 쪼개
  // 난반사를 뿌렸다. 실측으로 화면에 작은 점 5,230개가 흩뿌려졌고 — 사용자 판정으로
  // 어색해서 걷어냈다. 지금은 한 가지 성격뿐이다. 되살리려면 커밋 18368cb 이전을 본다.
  // ⚠ 셀을 크게 쓰므로 floor 양자화를 쓰면 안 된다. 흰 사각 타일이 된다 (셀 0.2 에서 실제로 그랬다)
  // ⚠⚠ **좌표를 월드(vW.xz) → 재질(vMat) 로 옮겼다** (2026-09-06). 사용자 :
  //   *"햇빛에 반사된 반사 표현이 너무 일정하게 보여지고 있음"*.
  //   월드에 박아 두면 노이즈 격자가 **화면에 못 박히고 물이 그 밑으로 흘러간다** —
  //   반짝임이 파도와 무관한 **도장**이 되어 어디서나 같은 얼룩으로 보인다.
  //   (CLAUDE.md '하지 않는 것' 이 반사에 대해 경고한 그 실패가, 반짝임에도 있었다.)
  //   재질 좌표에 붙이면 알갱이가 물과 같이 움직이므로 파면이 지나갈 때 하프벡터에
  //   맞았다 어긋났다 하며 **반짝인다**.
  // ⚠ **두 옥타브로 낸다.** 한 옥타브면 하이라이트가 전부 같은 크기의 둥근 덩어리라
  //   '고른 얼룩'이 된다. 실제 윤슬은 큰 조각과 작은 알갱이가 섞여 있다.
  //   ⚠ 둘째 옥타브의 배율 2.7 은 정수가 아니어야 한다 — 정수면 두 격자가 겹쳐
  //   같은 자리에서 같이 세지고, 그게 다시 규칙적인 무늬가 된다.
  //   ⚠ 도메인을 31 만큼 밀어 첫 옥타브와 독립시킨다.
  // ⚠⚠ **둘째 옥타브는 스위치를 단다** (uGlitOct2, 2026-09-06). 이 두 줄이 물 **전체**에서
  //   돌고, 물은 화면의 73% 다 — 즉 해시 4회가 화면 절반 이상에 곱해진다.
  //   실측 (검증 보기 12) : 픽셀당 평균 해시 17.3 중 **바닥 12 가 물의 100%** 에서 돈다.
  //   worley 거품은 물의 5% 뿐이라 그쪽을 깎아도 3% 밖에 안 준다.
  //   ⚠ 0 으로 끄면 하이라이트가 다시 한 가지 크기가 된다 (v0.12.3 이전).
  vec2 gm = vMat * uGlitCell;
  vec2 gn = vnoise2(gm);
  if (uGlitOct2 > 0.001) gn += vnoise2(gm * 2.7 + 31.0) * (0.55 * uGlitOct2);
  vec2 sg = vGradW + microG * 3.0 + gn * uGlitter * 0.35;
  vec3 Ns = normalize(vec3(-sg.x, 1.0, -sg.y));
  float sp = pow(max(dot(Ns, Hv), 0.0), uShine);

  // ── 항적 : 배가 지나간 자리를 물이 기억한다
  //
  // ⚠ 이 채널(uH 의 .z)은 sim.js 가 처음부터 쓰고 감쇠시키고 있었는데 **아무도 안 읽었다.**
  // 선체가 물을 붙잡는 자리에 1 이 찍히고(h.z = max(h.z, grip)) uTrailDecay 로 서서히 사라진다.
  //
  // 이 바다에서 **기억을 가진 유일한 층**이다. 마루 색도 백색도 반짝임도 반사도 전부
  // '지금 이 순간의 높이와 기울기'의 순수 함수라, 아름다운 무늬로는 보여도 장소로는 안 읽힌다.
  // 지나간 자국이 남는 것 하나가 그 성질을 바꾼다.
  //
  // ⚠ 흰 종이 위에서 거품을 흰색으로 그리면 안 된다 — 물이 237, 종이가 246 이라 안 보이고,
  // 보일 만큼 세게 주면 선을 지운다. 그래서 잉크 쪽(차가운 회청)으로 그린다
  // ⚠ 원본 값을 그대로 칠하면 안 된다. 선체가 물을 붙잡은 자국은 아주 옅은 꼬리를 멀리까지
  // 끄는데, 그걸 다 칠하면 띠가 아니라 **넓은 얼룩**이 된다 (실측 : 화면의 23%, 폭 1982px).
  // 문턱을 넣어 중심만 남긴다 — 잔존 시간(trailLife)을 줄여도 이건 안 없어진다
  float trail = smoothstep(uWakeLo, uWakeHi, texture2D(uH, vUv).z);
  if (trail > 0.002) {
    // 가장자리가 더 짙다 — 실제 항적의 거품도 경계에 몰린다.
    // t·(1−t) 는 0.5 에서 최대라 추가 텍스처 페치 없이 경계를 집어낸다
    float edge = trail * (1.0 - trail) * 4.0;
    float wk = clamp(trail * uWakeAmt + edge * uWakeEdge, 0.0, 1.0);
    c = mix(c, uWakeCol, wk * vDetail);
  }

  // ── 배가 물에 비치는 자국
  //
  // ⚠ 상이 또렷하면 눈이 '거울'로 읽고, 그 거울이 파도로 일그러지면 자연 현상이 아니라
  // 고장 난 거울로 보인다 (그렇게 만들었다가 걷어냈다). 실제 물에서 상이 안 맺히는 이유는
  // **난반사**다 — 파면이 잘게 기울어 광선이 흩어지고, 눈에는 조각난 톤만 남는다.
  //
  // 그래서 상을 **일부러 부순다.** 되읽는 좌표를 파도의 거칠기에 비례해 흩뿌린다.
  // 잔잔하면 조금 맺히고, 파도가 치면 조각으로 흩어진다. 색은 그대로 배의 것이다 —
  // 어두운 잉크를 임의로 칠하는 게 아니라, 비친 배가 부서져서 어둡게 남는 것이다.
  //
  // ⚠ 배 전체가 비치지 않는다. 스치는 각도에서 물에 남는 것은 아랫도리뿐이라
  // reflect.js 가 일정 높이(reflectSlice) 위를 잘라내고 찍는다.
  vec2 ruv = (vProj.xy / vProj.w) * 0.5 + 0.5;
  // ⚠⚠ **거울 렌더는 좌우가 뒤집혀 있다** (2026-09-06). 사용자 : *"배 아래에서 바로
  //   반사되는 게 아니라 **전혀 다른 좌표값**을 반사하고 있음."*
  //   reflect.js 가 up 을 (0,−1,0) 으로 두고 lookAt 하는데, 그러면 컬링은 안 깨지지만
  //   (그게 그 코드가 그렇게 쓰인 이유다) 이미지가 **좌우로 뒤집혀** 나온다.
  //   ⚠⚠ **실측으로 확정했다.** 부표 하나만 켜고 네 자리에서 잰 반사 무게중심 :
  //       부표 x  799 → 반사 1405 (예측 W−x = 1407, 오차 −2)
  //              864 →     1336 (1342, −6)
  //             1575 →      628 ( 631, −3)
  //             1523 →      680 ( 683, −3)
  //     네 번 다 **W − x** 에 떨어진다. 세로 어긋남은 −8~+3px 로 사실상 0 이다.
  //   ⚠ 배와 시험대가 화면 중앙에 대칭으로 있어서 지금까지 안 보였다 — 좌우로 뒤집어도
  //     대칭인 배치는 같아 보인다. 부표를 한쪽으로 몰고서야 드러났다.
  //   ⚠ 아래의 밀기·흩기는 이 뒤집힌 좌표계에서 더해진다. x 방향 흔들림의 부호가
  //     거울상이 되지만, 그건 방향성 없는 잔떨림이라 눈으로 판정할 수 있는 차이가 아니다.
  ruv.x = 1.0 - ruv.x;
  float dB = length(uBoatPos - vW);
  // ⚠⚠ **거리는 배가 아니라 카메라에서 잰다** (2026-09-06, 평면 패스).
  //   예전에는 셋 다 dB(배까지 거리)를 썼다. 배 하나만 비칠 때는 맞았지만, 레이어에 다른
  //   물체가 들어오는 순간 **배에서 먼 물체는 자기가 카메라 앞에 있어도 페이드로 죽는다.**
  //   실측 : far 게이트를 풀자 부표 반사가 **2,866 → 12,688 픽셀 (4.4배)** 이 됐다.
  //   ⚠ 물리적으로도 카메라가 맞다 — 반사가 멀수록 흐려지는 것은 시선이 지나온 수면의
  //     거칠기가 쌓이기 때문이지, 배와의 거리와는 아무 상관이 없다.
  //   ⚠ dB 는 그대로 둔다. 선체 거품·잠긴 선체는 **배** 기준이 맞다.
  float dCam = length(cameraPosition - vW);
  // 파도가 어긋남을 보정한다 (없으면 반사가 화면에 못 박힌다)
  float nearB = 1.0 - smoothstep(uReflFade * 0.35, uReflFade, dCam);
  ruv += (vGradW * uReflSharp + microG * uReflRipple) * uReflPush * nearB;
  // ⚠⚠ **이 한 줄이 반사를 제자리에서 밀어내고 있었다** (2026-09-06). 사용자 :
  //   *"오브젝트 바로 밑에 거울처럼 반사되어야 하는데 전혀 다른 곳에 생성되고 있다."*
  //   실측 (왜곡을 전부 0 으로 둔 기준 마스크와 비교) :
  //     reflectRise 0.55  → **58%** 가 기준 밖으로 새고 무게중심이 **134px** 이동
  //     reflectPush 0.05  →   5% / 6px    ·  Ripple 0.55 → 1% / 0px  ·  Scatter → 1% / 0px
  //   ⚠ 단위가 틀렸다 : vW.y 는 **월드 길이**인데 ruv 는 **화면 uv(0~1)** 다. 파고 0.3 에
  //     0.55 를 곱하면 uv 0.165 = 화면 **212픽셀**을 민다. 보정이 아니라 이사다.
  // ⚠⚠ **애초에 필요 없는 보정이다.** 거울 카메라가 수면(y=0)에 대해 본 카메라의 정확한
  //   대칭이므로, 평면 거울에서는 **같은 화면 픽셀**이 곧 그 점의 반사다 — 파고에 따른
  //   보정을 손으로 넣을 자리가 없다. 왜곡을 전부 0 으로 두면 반사가 물체 **바로 밑에**
  //   정확히 붙는 것을 눈으로 확인했다.
  // ⚠ 0 이 기본이고 옳다. 손잡이는 남긴다 — 일부러 어긋내고 싶을 때가 있을 수 있다.
  ruv.y -= vW.y * uReflRise;
  // ⚠⚠ **비침을 세로로 늘인다** (2026-09-06). 사용자 : *"파도 표현에 비춰지는 그림자가
  //   배랑 연관되게 붙어있어야 한다"* — 레퍼런스는 선체 밑에서 물 아래로 길게 끌리는 상이다.
  //   실측으로 지금 비침은 화면 **3,575px** 뿐이고, 세기를 두 배로 올려도 3,951px 이었다.
  //   병목이 세기가 아니라 **면적**이라는 뜻이다 — 카메라 pitch 23도에서 거울상이 물리적으로
  //   짧게 눕기 때문이다.
  // ⚠ 그래서 세기 대신 **표본 좌표를 배의 화면 위치(uBoatUv) 쪽으로 오므린다.** 1/k 로 오므리면
  //   같은 배 그림이 화면에서 k 배로 늘어난 것으로 보인다. 색은 여전히 **배의 것**이다 —
  //   이 파일의 규칙(어두운 잉크를 임의로 칠하지 않는다)을 안 깬다.
  // ⚠ 늘어나는 방향이 세로인 이유 : 물에 비친 상은 광원이 아니라 **보는 사람 쪽으로** 늘어난다.
  //   화면에서 그 방향이 곧 세로다. uSmearK = 1 이면 아무 일도 안 일어난다 (롤백).
  // 늘이기 **전**의 화면 거리. 아래에서 '얼마나 늘였나' 로 쓴다
  float smy = abs(ruv.y - uBoatUv.y);
  ruv.y = uBoatUv.y + (ruv.y - uBoatUv.y) / max(uSmearK, 0.05);
  // ⚠⚠ **늘인 상은 끝을 따로 죽여야 한다** (2026-09-06). 사용자 : *"끝부분이 매끄럽게
  //   마무리가 아니라 **끊김**이 발생하고 있음."*
  //   원인 : 늘인 상의 끝은 배 실루엣의 알파가 0 이 되는 자리다. 거기서 **뚝 끊긴다** —
  //   기존 거리 페이드(uReflFade)는 **월드 거리 dB** 로 재는데, 늘이기는 **화면**에서
  //   일어나므로 둘이 안 맞는다. 실루엣이 먼저 끝나면 페이드가 시작도 하기 전에 잘린다.
  //   ⚠ 그래서 **늘인 거리 자체**로 죽인다. smy 는 늘이기 전 화면 거리라 늘인 양에 비례한다.
  //   ⚠ uSmearFade = 0 이면 1.0 이 되어 **비트 단위 롤백**이다.
  //   ⚠⚠ **시작점이 0 이다** (2026-09-06 재조정). 처음에 uSmearFade*0.35 에서 시작했더니
  //     절벽이 그대로 남았다 — 늘인 비침의 세로 폭이 화면의 **약 25%뿐**이라, 페이드가
  //     그 안에서 시작해서 끝나면 전이 구간이 두어 줄밖에 안 된다. 실측 행평균 :
  //       시작 0.35배 → 0.395 / 0.202 / 0.485 / 0.002  (절벽비 1.00)
  //     0 에서 시작하면 선체에서부터 곧바로 기울어져 **비침 전체가 하나의 그라데이션**이 된다.
  //   ⚠ 실제 물의 반사도 이 모양이다 — 접촉점에서 가장 또렷하고 멀어질수록 흩어져 사라진다.
  float smFade = uSmearFade <= 0.0 ? 1.0
               : 1.0 - smoothstep(0.0, uSmearFade, smy);

  // 난반사 : 월드에 고정된 노이즈로 좌표를 흩는다. 세기는 국소 기울기가 정한다.
  // 흩어진 좌표가 배 밖으로 나가면 알파가 0 이라 그 자리는 비어 버린다 — 그게 '상이
  // 안 맺힌다'는 것의 실체다. 조각이 남고 나머지는 물이 그대로 보인다
  // ⚠⚠ **재질 좌표로 뜬다** (2026-09-07). 예전에는 vW.xz(월드)였는데, 배·카메라·수면
  //   메시가 전부 월드 고정이라 이 무늬가 **화면에 못 박혔다** — 물결이 지나가도 조각나는
  //   자리가 안 변해서, 반사가 흩어지는 것이 아니라 '고정된 얼룩' 으로 읽힌다.
  //   ⚠ 잠긴 선체(2026-09-06)와 반짝임에서 이미 같은 실수를 하고 vMat 으로 고쳤다.
  //     흩기만 남아 있었다. 흩는 주체는 **지나가는 물**이지 자리가 아니다.
  vec2 kp = vMat * uScatCell;
  vec2 ki = floor(kp), kf = fract(kp);
  kf = kf * kf * (3.0 - 2.0 * kf);
  vec2 kn = mix(mix(hash2(ki),                 hash2(ki + vec2(1.0, 0.0)), kf.x),
                mix(hash2(ki + vec2(0.0, 1.0)), hash2(ki + vec2(1.0, 1.0)), kf.x), kf.y);
  // ⚠⚠ **거리에 따라 흩어짐이 커진다** (2026-09-06). 사용자 : *"배 근처에는 약하게,
  //   점점 멀어질수록 노이즈가 심하게"*.
  //   ⚠ 연출이 아니라 **이 계산의 자연스러운 연장**이다 : 수면이 δ 기울면 반사 광선은 2δ
  //     꺾이는데, 그 각오차가 만드는 **상의 어긋남은 광선이 간 거리에 비례해 커진다.**
  //     그래서 실제로도 발밑 반사는 또렷하고 멀수록 부서진다.
  //   ⚠ 노이즈 샘플(kn) 을 **그대로 재사용한다** — 픽셀당 해시가 안 늘어난다.
  //     지금 셰이더 비용이 민감한 상태라(사용자 GPU 소리) 이게 중요하다.
  //   ⚠ 덤으로 배 근처가 또렷해져서 '비침이 배에 붙어 있다'(v0.13.2) 를 강화한다.
  //     지금까지는 흩어짐이 거리와 무관해 선체 바로 밑도 똑같이 부서지고 있었다.
  //   ⚠ uScatNear = uScatFar = 1 이면 비트 단위 롤백이다.
  // ⚠⚠ **카메라 기준이다** (2026-09-06 정정). v0.15.2 에서 far·nearB·aim 셋을 dCam 으로
  //   바꿀 때 **이 줄만 빠뜨렸다.** 그래서 배에서 scatterRamp(11) 넘게 떨어진 물체는
  //   **자기가 카메라 바로 앞에 있어도** fk=1, 즉 scatterFar 최대 흩기를 받았다 —
  //   시험대 부표가 거의 전부 그 상태였다 (사용자 : "난반사가 장난이 아니다").
  //   ⚠ v0.13.3 에 이 항을 넣을 때는 배만 비쳤으므로 dB 가 맞았다. 평면 패스가 되면서
  //     뜻이 달라진 것이다 — **'멀수록 흩어진다' 의 '멀다' 는 보는 사람 기준이다.**
  //   ⚠ 물리도 그렇다 : 상이 흩어지는 것은 시선이 지나온 수면의 기울기 오차가 쌓여서고,
  //     그 누적 거리는 **광선이 간 거리**이지 배와의 거리가 아니다.
  //   ⚠ 시작점이 0 이 아니라 **0.30배**다. 카메라가 배에서 37 월드에 있어서 보이는 수면이
  //     dCam 17~78 인데, 0 에서 시작하면 가까운 쪽도 이미 램프를 지나 **전 화면이 최대
  //     흩기**가 된다. 다른 거리 페이드(uReflFade)와 같은 '양끝 범위' 꼴로 맞춘다.
  float fk = smoothstep(max(uScatRamp, 0.1) * 0.30, max(uScatRamp, 0.1), dCam);
  float agit = clamp(slope * uScatK, 0.0, 1.0) * mix(uScatNear, uScatFar, fk);
  ruv += kn * uScatter * agit;

  // ⚠ 경계는 타원이 아니라 **물리**로 잡는다. 이 면의 법선으로 시선을 튕긴 광선이 배를
  // 향하지 않으면 애초에 비칠 수 없다. 이게 없으면 화면 660px 에 조각이 흩어진다 (실측)
  vec3 Nr = normalize(vec3(-(vGradW.x + microG.x) * uReflSharp, 1.0,
                           -(vGradW.y + microG.y) * uReflSharp));
  vec3 Rr = normalize(reflect(-V, Nr));
  // ⚠⚠ **aim 은 배 전용이었다.** "반사 광선이 **배를** 향하는가" 를 묻는다 — 부표를 향하는
  //   광선은 전부 탈락한다. 평면 패스에서 올바른 게이트는 **렌더타깃의 알파**다
  //   (거기 아무것도 없으면 알파가 0 이라 저절로 안 그려진다).
  //   ⚠ 지우지 않고 남긴다 — 배만 비출 때(레이어에 배 하나) 떠도는 조각을 잘라 주는
  //     쓸모가 있다. **기본값을 0(해제)으로 내렸다.**
  float aim = uReflAim <= 0.0 ? 1.0
            : smoothstep(uReflAim, 1.0, dot(Rr, (uBoatPos - vW) / max(dB, 1e-4)));

  // ⚠⚠ **그림자는 색만 덮는 것이 아니라 '빛을 가린다'** (2026-09-06).
  //   사용자 : *"배 밑에 들어가는 가장 짙은 그림자에서는 파도·바다에 들어가는 이펙트가
  //   안 보이게 할 수 있나? **그림자가 져서 보이지 않아야 할 빛 반사 이펙트**가 보인다"*.
  //   맞는 지적이다 — 지금까지 그림자는 c 를 한 번 덮을 뿐이고, 그 **뒤에** 정반사·반짝임
  //   거품·마루 백색이 다시 칠해져서 그늘 위에 하이라이트가 떠 있었다.
  //   여기서 가림 정도를 모아 두고, 아래의 **해가 만드는 항들**에만 곱한다.
  // ⚠ 하늘 반사에는 안 곱한다. 배가 가리는 것은 **해**지 하늘 돔 전체가 아니다 —
  //   선체가 하늘을 가리는 몫은 이미 접촉 그림자가 그리고 있다.
  // ⚠⚠ **가림을 둘로 나눈다** — 해를 가리는 몫과 하늘을 가리는 몫이 다르다.
  //   실측이 그렇게 시켰다 : 짙은 그늘 안을 밝히고 있던 것의 **88.7%가 하늘 반사**였고
  //   (15,328 / 17,288 px), 정반사·마루백색·반짝임은 그 자리에 **0 px** 이었다.
  //   그래서 해만 가려서는 사용자가 본 그 밝음이 안 없어진다.
  float shK = 0.0;     // 해를 가리는 몫 (드리운 그림자 + 선체)
  float skK = 0.0;     // 하늘을 가리는 몫 (접촉만)

  // ── 배 그림자 ─────────────────────────────────────────────────────────────
  // 사용자 : *"배 그림자도 배 바로 밑에 비추게 하긴 해야겠다. 이제 카메라 값이 올라갔으니까
  //   **그라데이션처럼 점점 어둡게** 해서 밝게 표현이 가능한가?"*
  //
  // ⚠⚠ **그게 정확히 불변식 14 다** : *"빛은 '그늘'로만 그린다. 등진 면에 잉크를 얹을 뿐,
  //   받는 면을 밝게 하지 않는다. 흰 종이 위에서 밝게 = 선 지우기다."*
  //   흰 하늘을 반사시켜 물을 밝히는 데는 한계가 있다 (실측 : 물 평균 +5.8 레벨).
  //   배가 물에 앉아 보이게 하는 것은 **배 밑의 어둠**이지 배의 밝기가 아니다.
  //
  // ⚠⚠ **예전에 걷어낸 '타원 얼룩' 과 다르다.** CLAUDE.md :
  //   *"배 밑에 타원 하나를 깔았는데, **광원 방향과 무관하게 항상 발밑에 붙어 있어서**
  //   '임의로 그린 얼룩'으로 보였다."*
  //   이건 **광선을 푼다** : 이 물점에서 빛을 향해 올라간 광선이 배 높이에서 어디를 지나는지
  //   보고, 그게 선체 발자국 안이면 그늘이다. 해가 낮으면 그림자가 길게 눕고, 배가 돌면
  //   그림자도 같이 돈다. 부표 반사를 광선-구 교차로 푼 것과 같은 방식이다.
  // ⚠ 발자국은 **배 축**으로 잰다 (길이 · 폭). 원으로 두면 어느 방향에서 봐도 같은 얼룩이다.
  // ⚠ uShadowAmt = 0 이면 mix 가 c 를 그대로 낸다 — 비트 단위 롤백.
  if (uShadowAmt > 0.0) {
    // 빛을 향해 올라가 배 높이에 닿는 지점. ⚠ lightDir.y 가 작으면(해가 낮으면) t 가 커져
    //   그림자가 멀리 눕는다 — 그게 맞는 동작이다. 0.08 은 발산 가드다
    float t = (uBoatPos.y - vW.y) / max(uLightDir3.y, 0.08);
    vec2 hit = vW.xz + uLightDir3.xz * t;
    vec2 rel = hit - uBoatPos.xz;
    vec2 F = uBoatDir, Rt = vec2(F.y, -F.x);          // 앞 · 옆
    vec2 loc = vec2(dot(rel, F) / uShadowSize.x, dot(rel, Rt) / uShadowSize.y);
    // ⚠⚠ **감쇠는 '심 + 무릎' 이다** (2026-09-06). 사용자 : *"보트 바로 밑에 생기는 그림자는
    //   인위적으로 조금 진하게, 그리고 **멀어지면 한 번에 크게 옅어져야** 하는 느낌"*.
    //   예전에는 smoothstep(0.15, 1.0, d) 를 **제곱**했다 — 0.15 에서 이미 떨어지기 시작해
    //   꼬리가 발자국 전체(13×5.5 월드)에 퍼졌고, 그게 '얼룩' 으로 읽히던 것이다.
    //   이제 uShadowIn 안쪽은 **평평하게 1** 이고 uShadowKnee 폭에서 한 번에 0 이 된다.
    // ⚠ 무릎을 0 으로 두지 않는다. 딱 잘린 타원은 다시 '도장' 이 된다 (원래 경고 그대로).
    //   바다 그래픽이 깔끔해 보이는 이유도 '경계가 없어서' 가 아니라 **경계가 좁아서**다.
    float sh = 1.0 - smoothstep(uShadowIn, uShadowIn + max(uShadowKnee, 0.02), length(loc));
    shK = clamp(sh * uShadowAmt, 0.0, 1.0);
    // ⚠ min — 그늘이 물을 **밝히는 일은 없다** (불변식 14 · 2026-09-27). 그늘색보다 이미 어두운 물(배의 짙은 반사 · 밤 물)에
    //   그늘색을 섞으면 그 자리가 밝아졌다 (밤 : 접촉 자리 픽셀의 92.5%). 그늘색이 물보다 어두운 낮에는 예전과 같다
    c = mix(c, min(c, uShadowCol), shK * vDetail);
  }

  // ── 배 그림자 ② — 해 쪽 주광의 실제 그림자 (2026-09-27, S15P21E203-435 · 역광 '중간안' 4단계) ─────────
  // 위 ①은 선체 발자국 하나(타원)라 돛대 · 돛이 드리우는 그림자가 없다. 해가 14° 로 낮아 그 그림자가 길다 —
  //   돛대 끝(9 월드)의 그림자는 배에서 34 월드 떨어져 떨어진다. 배는 이미 그 빛의 그림자 맵(main.js sunLight · 1024²)을
  //   매 프레임 그리므로, 물은 **그 맵을 읽기만** 한다 — 렌더 패스도 텍스처도 늘지 않는다.
  // ⚠ 물점은 **파도에 밀린 실제 자리(vW)** 로 읽는다 — 그림자가 파면을 따라 휜다 (화면 좌표가 아니라 도장이 될 수 없다).
  // ⚠ 해는 점이 아니다 — **가린 것에서 멀어질수록 번진다.** 번짐 폭은 배(겨누는 점)에서 잰 깊이로 정한다 :
  //   가린 것의 깊이를 픽셀마다 찾으면(PCSS) 탭이 두 배라, 가린 것이 배 하나뿐인 것을 쓴다. 배 곁은 또렷하고 멀리 갈수록 옅게 번져,
  //   가는 돛대의 그림자는 멀리서 저절로 사라진다 (실제 해의 반그림자 · ①의 '멀어지면 한 번에 옅어진다' 와 같은 성질).
  // ⚠ 무엇을 가리는가 : 물색을 어둡게 곱하고(①처럼 그늘색으로 섞지 않는다 — 아래 ⚠⚠) · 해에서 오는 빛(정반사 · 반짝임 · 마루 백색 — 아래 shLit)을 끈다.
  //   하늘 반사는 안 가린다 (해만 막힌 자리 — ① 과 같은 규율) · 배의 반사도 그대로다 (해가 아니라 배에서 오는 빛).
  // ⚠ uSunShK.x = 0 이면 이 블록이 통째로 안 돈다 — 낮(주광 0) · 그림자 끔 · 맵이 아직 없을 때. 예전과 비트 단위로 같다
  if (uSunShK.x > 0.0) {
    vec4 s4 = uSunShMat * vec4(vW, 1.0);
    vec3 sc = s4.xyz / s4.w;
    // 배(겨누는 점)에서 빛 방향으로 잰 거리 (월드) — 번짐 폭과 **멀어지면 옅어짐**이 같이 쓴다
    float shDist = max(sc.z - uSunShSpan.w, 0.0) * uSunShSpan.z;
    // ⭐ (2026-09-27) 배 곁은 그대로 두고 **uSunShReach 사이에서 녹인다** — 사용자 : *"그림자 조금만 더 연하게 … 화면 비례로 너무 규모가 커보이긴함"*.
    //   해가 14° 로 낮아 돛 그림자가 34 월드까지 누웠고, 항해 구도에서는 화면 아래 끝까지 띠로 이어졌다.
    //   발자국(①)에 준 성질과 같다 — *"바로 밑은 조금 진하게, 멀어지면 한 번에 크게 옅어지게"* (params.shadowSoft 주석).
    //   ⚠ 끝보다 먼 물은 그림자 맵을 **아예 안 짚는다** — 이 블록이 돌던 넓은 먼 자리가 통째로 빠진다
    float shFade = 1.0 - smoothstep(uSunShReach.x, uSunShReach.y, shDist);
    if (shFade > 0.0 && sc.x > 0.0 && sc.x < 1.0 && sc.y > 0.0 && sc.y < 1.0 && sc.z < 1.0) {
      float z = sc.z - uSunShK.y;
      float w = uSunShK.w + uSunShK.z * shDist;   // 번짐 폭 (월드)
      vec2 rad = w / uSunShSpan.xy;                                                    // → 그림자 맵 좌표
      // 황금각 나선 12탭 — 원판을 고르게 덮는다. ⚠ 상수 배열을 안 쓴다 (이 셰이더에서 배열 유니폼이 조용히 깨진 적이 있다 · 위 uMicroD 주석)
      // ⚠ 나선의 시작 각을 **픽셀마다 돌린다** (interleaved gradient noise) — 안 돌리면 번짐 폭이 탭 간격보다 커지는 먼 그림자가
      //   빗살처럼 여러 줄로 갈라진다 (같은 탭이 모든 픽셀에서 같은 자리를 짚어 가는 그림자의 겹상이 선다 · 2026-09-27 확인)
      float ra = 6.2831853 * fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
      vec2 d = vec2(cos(ra), sin(ra));
      // ① 가장자리 4탭 — 넷이 같으면(다 밝음 · 다 가려짐) 나머지를 안 짚는다.
      //   이 블록이 도는 자리는 화면의 14%(항해) ~ 36%(선실 줌인)인데 대부분이 **그림자 밖의 밝은 물**이다 — 거기서 12탭을 다 짚으면 헛일이다.
      //   ⚠ 탭 사이에 끼는 가는 그림자(먼 돛대)는 놓친다 — 거기는 어차피 번짐이 돛대보다 넓어 옅게 사라질 자리다
      float lit = 0.0;
      for (int i = 0; i < 4; i++) {
        lit += step(z, unpackRGBAToDepth(texture2D(uSunSh, sc.xy + d * rad)));
        d = vec2(-d.y, d.x);
      }
      float sh2 = 1.0 - lit / 4.0;   // 해가 가려진 몫 (0~1)
      if (lit > 0.5 && lit < 3.5) {
        // ② 경계 — 황금각 나선 12탭을 더 짚는다. ⚠ 상수 배열을 안 쓴다 (이 셰이더에서 배열 유니폼이 조용히 깨진 적이 있다 · 위 uMicroD 주석)
        const float GA = 2.39996323;
        mat2 rot = mat2(cos(GA), sin(GA), -sin(GA), cos(GA));
        for (int i = 0; i < 12; i++) {
          float r = sqrt((float(i) + 0.5) / 12.0);
          lit += step(z, unpackRGBAToDepth(texture2D(uSunSh, sc.xy + d * r * rad)));
          d = rot * d;
        }
        sh2 = 1.0 - lit / 16.0;
      }
      sh2 *= shFade;   // 멀어지면 옅어진다 — 물색을 누르는 몫도 · 해의 반짝임을 끄는 몫도 같이 (칼로 자른 선이 안 남게)
      // ⚠⚠ **그늘색으로 섞지 않고 어둡게 곱한다.** ①의 그늘색(color.boatShadow #6B7A92)은 낮의 종이 물(≈205)에 맞춘 색이라
      //   저녁 물(선형 0.21 · 0.21 · 0.31)과 거의 같다 — 세기 0.5 로 섞어도 그림자 자리의 밝기가 0.211 → 0.213 이었다 (2026-09-27 실측 · 오히려 밝아졌다).
      //   곱하면 물의 색조를 그대로 둔 채 어두워진다 — 시간대 팔레트가 바뀌어도 그늘로 읽힌다 (불변식 14 : 잉크를 얹는다).
      c *= 1.0 - clamp(sh2 * uSunShK.x, 0.0, 1.0) * vDetail;
      // ⚠ 해에서 오는 빛(정반사 · 반짝임 · 마루 백색 — 아래 shLit)은 세기가 아니라 **가려진 몫 그대로** 끈다 — 해가 막힌 자리에 해의 반짝임이 남을 수 없다
      shK = max(shK, sh2);
    }
  }

  // ── 접촉 그림자 (선체가 물에 닿은 자리) ─────────────────────────────────────
  // 사용자 : *"배 바로 밑에는 **진한 그림자**"*. 위 ①은 넓고 옅은 웅덩이라
  //   배가 물 위에 **떠 있는 것으로만** 보이고 **닿아 있는 것으로는** 안 보인다.
  //
  // ⚠⚠ **이건 광원 방향과 무관한 것이 맞다.** 주변 차폐(AO)이지 드리운 그림자가 아니다 —
  //   선체가 하늘을 가려서 그 밑 물이 하늘빛을 못 받는 것이고, 그건 해가 어디 있든 그렇다.
  //   예전에 걷어낸 타원은 *'드리운 그림자'인 척하면서* 광원을 무시해서 틀렸던 것이지,
  //   방향이 없다는 것 자체가 틀린 게 아니다. 드리운 쪽은 바로 위 ①이 광선을 풀어 그린다.
  //   ⚠ 그래서 둘을 **합치지 않는다.** 하나로 합치면 다시 그 타원이 된다.
  // ⚠ 발자국은 ①보다 **훨씬 좁다** — 선체 폭에 붙어야 '닿았다' 로 읽힌다.
  if (uContactAmt > 0.0) {
    vec2 crel = vW.xz - uBoatPos.xz;
    vec2 Fc = uBoatDir, Rc = vec2(Fc.y, -Fc.x);
    vec2 cl = vec2(dot(crel, Fc) / uContactSize.x, dot(crel, Rc) / uContactSize.y);
    // ⚠ 접촉 쪽은 심을 **더 넓게** 잡는다 — 여기가 '인위적으로 조금 진한' 부분이다.
    //   드리운 그림자와 같은 무릎을 쓰므로 둘의 가장자리 성격이 갈리지 않는다
    float core = min(uShadowIn + 0.22, 0.90);
    // ⚠⚠ **배가 물에서 들리면 접촉 그림자는 옅어지고 퍼져야 한다** (2026-09-06).
    //   사용자 : *"선체가 뛰어오르는 표현될 때 짙은 그림자가 너무 잘 보이게 됨."*
    //   원인 : 이 층은 지금까지 **배 높이를 아예 안 봤다.** 배가 들리면 선체에 가려져 있던
    //   짙은 심이 그대로 드러난다 — 세기는 그대로인데 보이는 면적만 커지니 더 진해 보인다.
    //   ⚠ 접촉 그림자는 주변 차폐다. 가리는 것이 멀어지면 **약해지고 동시에 번진다** —
    //     둘 중 하나만 하면 안 된다. 세기를 나누고 무릎을 같이 넓힌다.
    //   ⚠ uHullT.w 는 공칭 흘수다 (CPU 가 boatLift 에서 싣는다). 이걸 더해야 평소에 0 이 된다.
    //   ⚠ uContactLift = 0 이면 나눗셈도 곱셈도 1 이 되어 **비트 단위 롤백**이다.
    float clift = max((uBoatY - vW.y) + uHullT.w, 0.0) * uContactLift;
    float ct = 1.0 - smoothstep(core, core + max(uShadowKnee, 0.02) * (1.0 + clift),
                                length(cl));
    ct /= 1.0 + clift;
    // ⚠ 더한 게 아니라 **더 짙은 쪽**을 쓴다. 겹치는 자리에서 1 을 넘겨 봐야 의미가 없고,
    //   더하면 접촉+드리운이 겹치는 좁은 띠만 유독 새까매진다
    float ck = clamp(ct * uContactAmt, 0.0, 1.0);
    shK = max(shK, ck);
    // ⚠⚠ **접촉만 하늘을 가린다.** 드리운 그림자는 해가 막힌 자리일 뿐 하늘은 그대로 보이므로
    //   거기서 하늘 반사를 죽이면 그림자가 '물이 아닌 다른 재질' 로 보인다.
    //   반면 선체 **바로 밑**은 하늘 돔이 실제로 막혀 있다 — 그게 이 층의 정의다.
    skK = ck;
    c = mix(c, min(c, uShadowCol), ck * vDetail);   // ⚠ min — 위 발자국과 같은 이유 (그늘은 밝히지 않는다)
  }

  // 그늘에서 살아남는 빛의 비율. ⚠ uShadowOcc = 0 이면 비트 단위 롤백이다
  float shLit = 1.0 - shK * uShadowOcc * vDetail;
  // 정반사. ⚠ 반짝임(글리터)은 이미 이 sp 의 법선에 녹아 있어서 같이 죽는다
  sp *= shLit;

  // ── 하늘 반사 ─────────────────────────────────────────────────────────────
  // ⚠⚠ **같은 광선(Rr)을 쓴다.** 부표 반사·배 반사가 이미 이 광선을 쓰므로, 하늘까지
  //   같은 것을 보게 하면 셋이 한 장면에 있는 것으로 읽힌다 (불변식 15 와 같은 요구).
  // ⚠ **화면 좌표를 안 읽는다.** CLAUDE.md '하지 않는 것' 이 금지한 것은 *화면 좌표로
  //   되읽는 반사*(= 도장)이고, 이건 **반사 방향의 함수**라 구조적으로 도장이 될 수 없다.
  //   부표 반사를 광선-구 교차로 푼 것과 같은 방식이다. 텍스처도 렌더타깃도 없다.
  // ⚠⚠ **프레넬로 섞는다.** 스치는 각일수록 반사가 세다 — 그게 물이 멀리서 하얗게 보이는
  //   이유이고, 지금까지 없던 '방향에 따른 밝기 변화' 가 여기서 나온다.
  //   F0 = 0.02 (공기→물, 명세 8.1). Schlick 근사.
  // ⚠ 하늘이 종이 톤(232~250)이라 물(약 205)보다 밝다. 그래서 이 항은 물을 **밝히는**
  //   쪽으로만 작용하고, 여지는 약 40레벨이다. uSkyAmt 로 그 안에서 조절한다.
  //   **0 = 비트 단위로 예전 화면** (mix(c, x, 0.0) === c).
  if (uSkyAmt > 0.0) {
    float ct = clamp(dot(Nr, V), 0.0, 1.0);
    float F = 0.02 + 0.98 * pow(1.0 - ct, 5.0);
    // ⚠ 선체 밑에서는 하늘이 실제로 막혀 있다 (skK). 사용자 지적의 본체가 이 한 줄이다
    float skyLit = 1.0 - skK * uShadowOcc * vDetail;
    c = mix(c, skyColor(Rr, uLightDir3), clamp(F * uSkyAmt, 0.0, 1.0) * vDetail * skyLit);
  }

  if (uReflAmt > 0.0 && aim > 0.0 && ruv.x > 0.0 && ruv.x < 1.0 && ruv.y > 0.0 && ruv.y < 1.0) {
    vec2 bl = vec2(uReflBlur * 0.6, uReflBlur);
    vec4 refl = texture2D(uRefl, ruv) * 0.4
              + texture2D(uRefl, ruv + vec2(0.0, bl.y)) * 0.2
              + texture2D(uRefl, ruv - vec2(0.0, bl.y)) * 0.2
              + texture2D(uRefl, ruv + vec2(bl.x, 0.0)) * 0.1
              + texture2D(uRefl, ruv - vec2(bl.x, 0.0)) * 0.1;
    // ⚠⚠ **이 텍스처는 premultiplied alpha 다. 쓰기 전에 알파로 나눠 되돌린다**
    //   (2026-09-07). 사용자 : *"그림자에 바다색상과 같은 외곽선이 만들어져 있는데
    //   의도된 거임?"* — 의도된 것이 아니라 버그였다.
    //   reflect.js 가 렌더타깃을 (0,0,0,0) 으로 지우고 그 위에 보통 블렌딩으로 그린다.
    //   빈 곳이 검정이라 결과는 **rgb 가 이미 알파로 곱해진 꼴**이 된다 (알파 0.5 인
    //   경계 텍셀의 rgb 는 배 색의 절반). 그걸 straight 인 줄 알고 그대로 mix 에 넣어서,
    //   반사 둘레에 **어두운 띠**가 남았다 — 고전적 dark fringe 다.
    //   ⚠ 어둡게 만드는 자리가 둘이고 이 한 줄이 **둘 다** 고친다 :
    //     ① 5탭 블러가 실루엣 밖의 빈 곳을 물어올 때
    //     ② 그보다 큰 몫 — **하드웨어 LinearFilter** 가 텍셀 하나를 읽을 때도 이웃 빈 곳과
    //        섞는다. 블러를 꺼도 남던 것이 이것이다 (블러 0 에서도 9,805px 이 어두웠다)
    //   처음 이것을 잡은 증거 : 어두워진 자리의 바다색이 156,165,174 인데 반사 본체는
    //   211,204,195 였다 — **더 밝은 것을 얹었는데 어두워졌다.**
    //   실측 (A/B, 1600×900, 파도 얼림, OFF 평균밝기 179.3 으로 두 측정의 파도를 대조했다) :
    //     어둡게 만든 픽셀  13,568 → **5,445** (−60%) · 평균 −11.7 → −7.9 · 최대 −56 → −43
    //     밝게 만든 픽셀    26,249 → **32,770** (+25%)  ← 검정에 눌려 있던 반사가 제 밝기를 찾았다
    //     블러 0 일 때      9,805 → **5,347**           ← ② 하드웨어 보간 몫이 실제로 준다
    //   ⚠ 남은 5,445 는 **테두리가 아니다.** 79% 가 반사 본체 **안쪽**이고, 배의 그늘진 면처럼
    //     실제로 물보다 어두운 것이 비친 자리다 (밝은 물 위에 얹혀 정상적으로 어두워진 것도 59px).
    //   ⚠ 알파가 0 인 곳도 나누지만, 그 자리는 아래 mix 인자도 0 이라 화면에 안 나온다.
    //   롤백 : 이 한 줄을 지운다 (위 5탭 합은 예전 그대로다).
    refl.rgb /= max(refl.a, 1e-4);
    float grz = 1.0 - smoothstep(0.05, 0.55, clamp(V.y, 0.0, 1.0));   // 스칠수록 강하게
    float far = 1.0 - smoothstep(uReflFade * 0.45, uReflFade, dCam);
    // ⚠⚠ **거울 손잡이** (2026-09-06). 사용자 : *"특정 오브젝트만 정말 잘 반사할 수 있는
    //   방법은 없나, 거울처럼?"*
    //   (0.4 + 0.6·grz) 가 **스치는 각일수록 세지는** 물리 항이다. 카메라가 23도에서
    //   내려다보면 grz 가 작아 이 항이 0.4~0.5 로 눌린다 — 그게 반사가 약한 이유의 본체다.
    //   uReflMirror 는 그 항을 1 로 끌어올려 **각도와 무관한 거울**로 만든다.
    //   ⚠ 이건 물리를 **일부러 어기는** 손잡이다. 0 이 물리적으로 옳고 비트 단위 롤백이다.
    //   ⚠ 지금은 **전역**이다. 물체마다 다르게 주려면 렌더타깃 알파에 가중치를 실어야 한다
    //     (아래 주석 참고) — 그건 이 그림이 원하는 그림인지 먼저 보고 정한다.
    float ang = mix(0.4 + 0.6 * grz, 1.0, uReflMirror);
    // ⚠ clamp 를 새로 걸었다. 예전에는 없어서 세기를 올리면 mix 인자가 1 을 넘어
    //   **외삽**되고 있었다 (색이 반대쪽으로 튄다)
    c = mix(c, refl.rgb, clamp(refl.a * uReflAmt * ang * far * aim * vDetail * smFade, 0.0, 1.0));
  }

  // ── 공중에 뜬 향수 부표가 물에 비친다
  //
  // ⚠⚠ **배와 달리 렌더타깃이 아예 없다.** 부표는 위치·반지름·색을 전부 아는 **구**라서
  // 반사를 해석적으로 푼다 — 이 면의 법선으로 튕긴 광선이 그 구를 지나는지만 보면 된다.
  // 화면 좌표로 되읽지 않으므로 '도장'이 될 여지가 구조적으로 없다 (CLAUDE.md '하지 않는 것').
  // 발광을 가우시안으로 그린 것(v0.7.1)과 같은 성질이다 : 원인이 함수로 알려져 있으면
  // 그 결과도 함수로 쓴다.
  //
  // **상이 부서지는 것도 공짜다.** Rr 은 이미 파면의 기울기(vGradW · microG)로 흔들려 있어서,
  // 잔잔하면 광선이 모여 상이 맺히고 파도가 서면 흩어져 조각이 된다. 난반사 항이 따로 없다.
  if (uMarkRefl > 0.0) {
    for (int i = 0; i < ${MARK_REFL_MAX}; i++) {
      if (i >= uMarkN) break;
      vec3 L = uMarkPos[i].xyz - vW;
      float tca = dot(L, Rr);
      if (tca <= 0.0) continue;                  // 광선이 부표를 등지고 있다
      // ⚠⚠ 구의 **실제 반지름으로만** 재면 안 된다. 반지름 0.34 짜리 구의 정확한 거울상은
      // 화면의 0.05% 밖에 안 되고, 세기를 6배 올려도 면적이 안 는다 (실측 0.044% → 0.053%).
      // 실제 물의 반사도 그렇지 않다 — 잔물결이 광선을 흩어서 물체보다 훨씬 넓게 번진다.
      //
      // ⚠⚠ 다만 **사방으로 똑같이 넓히면 둥근 얼룩**이 되고, 그건 비친 것이 아니라 안개로
      // 읽힌다 (실측으로 확인했다). 물에 비친 상은 **보는 쪽으로 길게 끌린다.**
      // 그래서 허용 오차를 세로로만 키운다 — 광선이 구보다 높거나 낮게 지나가는 것을
      // 봐주는 것이고, 그게 화면에서는 보는 쪽으로 늘어난 줄기가 된다.
      vec3 Lp = L - tca * Rr;                    // 광선에서 구 중심까지의 수직 벡터
      float rm = uMarkPos[i].w;
      float sp = max(uMarkSpread, 1.0);
      // 한 손잡이로 두 축을 키우되 **비율을 유지한다** — 세로가 가로보다 대략 4배 넓다.
      // ⚠ 가로만 묶어 두면 0.28% 에서 포화하고, 사방을 똑같이 키우면 둥근 얼룩이 된다 (둘 다 실측)
      float rh = rm * (1.0 + (sp - 1.0) * 0.15);   // 가로 : 조금만
      float rv = rm * sp;                          // 세로 : 보는 쪽으로 길게
      float q = (Lp.x * Lp.x + Lp.z * Lp.z) / (rh * rh) + (Lp.y * Lp.y) / (rv * rv);
      // ⚠ 가장자리를 부드럽게 문다. 딱 자르면 물 위에 원반 도장이 찍힌다
      float hit = 1.0 - smoothstep(0.12, 1.0, q);
      if (hit <= 0.0) continue;
      // ⚠⚠ **부표 바로 밑이 가장 진하고 멀어질수록 옅다** (2026-09-03, 사용자 지시 :
      // "반사되는 범위가 너무 넓게 길게 표현되어있고 바로 밑은 진하게 멀어질수록 연하게").
      // 광선 판정만으로는 상이 보는 쪽으로 끝없이 끌려서 어디가 그 부표의 자리인지 안 읽힌다.
      // 부표의 **수직 발밑**(xz)에서 잰 거리로 감쇠시킨다 — 이게 자리를 못 박는 항이다.
      // 제곱으로 떨어뜨려 바로 밑만 진하게 남긴다
      // ⚠⚠⚠ **기준점을 평면 반사 패스에 맞춘다** (2026-09-09, 사용자 : *"부표가 바다에
      //   반사되고 있는 위치 값과 부표의 빛나는 표현의 반사 위치가 다른 위치에 구성되고 있는데
      //   같은 값의 위치에서 반사되게"*).
      //   부표는 markHeight 1.95 로 **공중에 떠 있다.** 그래서 두 반사가 갈라져 있었다 :
      //     · 평면 패스(reflect.js) — 부표의 **거울상 y = −1.95** 를 투영한다 (물리적으로 맞다)
      //     · 여기(해석적)         — ground 항이 **수직 발밑 y = 0** 에 못 박았다
      //   실측 : 화면의 부표 6개 **전부** 거울상이 발밑보다 32~72px 아래 (평균 49 = 화면의 6.8%).
      //   ⚠ 부표가 물에 닿아 있었다면 둘이 같은 자리였다 — 2026-09-03 에 띄우면서 생긴
      //     구조적 불일치이고, camPitch 를 15.4 로 내리며 반사가 세져 눈에 띄게 됐다.
      //   ⚠⚠ 카메라에서 거울상으로 가는 직선이 y=0 을 지나는 점을 쓴다. **같은 직선 위의
      //     점이라 화면 투영이 정확히 일치한다** — 근사가 아니라 항등이다.
      //   uMarkAnchor 0 = 예전(발밑) · 1 = 거울상. 0 이면 비트 단위 롤백이다
      vec2 anchor = uMarkPos[i].xz;
      if (uMarkAnchor > 0.0) {
        float hM = max(0.0, uMarkPos[i].y);
        float tt = cameraPosition.y / max(1e-3, cameraPosition.y + hM);
        anchor = mix(anchor, mix(cameraPosition.xz, uMarkPos[i].xz, tt), uMarkAnchor);
      }
      float gd = length(vW.xz - anchor) / uMarkFall;
      float ground = 1.0 - clamp(gd * gd, 0.0, 1.0);
      if (ground <= 0.0) continue;
      float grzM = 1.0 - smoothstep(0.05, 0.55, clamp(V.y, 0.0, 1.0));   // 스칠수록 강하게
      float kM = hit * ground * uMarkRefl * (0.4 + 0.6 * grzM) * vDetail;
      // ⚠⚠ **잉크로 그릴 것인가, 빛으로 그릴 것인가는 waterTone 이 정한다.**
      //   mix() 는 물색을 부표색으로 **바꾼다** — 흰 종이(tone 0, 물 220)에서는 그게 맞다.
      //   잉크를 얹는 것이고, 불변식 14 의 "빛은 그늘로만 그린다" 그대로다.
      //   그런데 어두운 바다에서는 같은 식이 **빛을 빼앗는다.** tone 0.85 실측 (층이 앉은
      //   자리의 바탕 밝기 122.7) : 평균 밝기 변화 −2.5 · 밝게 만든 픽셀 23.2% 뿐 ·
      //   가장 밝게 만든 값 +3.8 레벨(안 보인다) · 평균 채도 −7.09. 빛이 아니라 얼룩이었다.
      //   사용자 : *"부표들 빛났을 때 바다에는 왜 빛 표현 안 하고 있는지 모르겠음."*
      //   ⚠ 이건 불변식 14 가 이미 예고한 뒤집힘이다 (colorDeep.wake 가 밝은 색인 것과 같은 이유).
      //   그래서 **더하는 항**을 따로 둔다. uMarkGlow = 0 이면 예전 동작 그대로다.
      c = mix(c, uMarkCol[i], kM);
      c += uMarkCol[i] * kM * uMarkGlow;
      // ⚠⚠ **넓고 옅은 항만으로는 블룸 문턱을 절대 못 넘는다.** 위 항은 kM 이 작아서
      //   세기를 8배로 올려도 최고 휘도가 0.87 → 1.42 로만 가고 (문턱 1.6) 면적만 번진다.
      //   실측 : glow 1→2→3→4→6→8 에 최고휘도 0.87·0.92·0.97·1.05·1.20·1.42.
      //   부표가 빛나는 이유는 emissive 라서 조명을 안 타고 **그 값이 그대로 화면 밝기**가
      //   되기 때문이다 (marks.js). 물에도 같은 성질의 항이 필요하다.
      // ⚠ 그래서 불변식 13-1 이 적어 둔 구조를 그대로 쓴다 — **좁은 심 + 넓고 옅은 무리**.
      //   위가 무리이고, 아래가 심이다. 네제곱으로 몰아서 발밑 몇 픽셀만 문턱 위로 올린다.
      float core = hit * ground;
      core *= core; core *= core;
      c += uMarkCol[i] * core * uMarkCore;
    }
  }

  // ── 마루 선이 쓰는 값 셋. 예전에는 마루 색(면) 층이 같이 썼다.
  //
  // 너울 진행 방향으로 투영한 기울기의 **방향**. −1 = 내려가는 면, +1 = 올라가는 면.
  // 0 을 지나는 자리가 능선(또는 골)이다.
  // ⚠ 정규화 **전** 값을 따로 남긴다 — 아래 거품의 앞뒤 창이 이걸 쓴다 (비용 0, 같은 dot).
  // ⭐⭐ **너울만의 기울기(vGradS)로 잰다** (2026-09-29, S15P21E203-448). 예전에는 잔물결까지 든 vGradW 였다.
  //   띠 폭은 pw 의 배수다 (무리 135배 · 이음매 21.6배 · 발광 162배). 그런데 기울기는 정점에서만 계산되고
  //   삼각형 안에서 선형 보간되므로 fwidth(dirf) 가 **삼각형마다 거의 상수이고 모서리에서 뛴다.**
  //   잔물결(λ 1.2~1.7 · 한 파장에 정점 5.6~7.9개)은 마루 근처에서 기울기 방향을 약 30도씩 흔들어
  //   그 뜀이 커졌다 — 띠 끝이 삼각형 모서리에 붙어 피라미드 · 쐐기 · 빗살 · 고리가 섰다.
  //   멈춘 프레임 실험 : dirf 값만 픽셀별 → 그대로 깨짐 · pw 만 픽셀별 → 깨끗 (원인은 폭) · 잔물결 0 → 깨끗 ·
  //   이 판정만 너울 기울기 → 깨끗. 잔물결은 모양 · 음영(slope · lit) · 반짝임에 그대로 남는다
  // ⚠ 거품 앞뒤 창(fsig) · 물 오르는 속도(hrise) · 반짝임 면(faceS) · 거품 띠(haloS)도 이 값을 따라간다 —
  //   모두 '능선이 어디냐' 를 마루선과 **같은 식**으로 봐야 하는 층이다 (불변식 13-2)
  float slopeS = length(vGradS);
  float sdir = dot(vGradS, uSwellDir);
  // ⭐ 분모에 바닥(uCrestEps)을 둔다 (S15P21E203-448) — 방향코사인은 기울기 0 인 점에서 정의되지 않아 두 마루가 만나는 자리에
  //   선 · 앞뒤 색이 한 점으로 모여 뾰족한 **꼭지점**이 섰다 (params.crestEps 주석). 보통의 마루(기울기 ≫ ε)는 그대로다
  // ⚠ uCrestEps 0 이면 예전 식 그대로 (0 기울기 가드 포함)
  float dirf = (uCrestEps > 0.0 || slopeS > 1e-4) ? sdir / sqrt(slopeS * slopeS + uCrestEps * uCrestEps) : 0.0;
  float ad = abs(dirf);
  float pw = max(fwidth(dirf), 1e-5);   // ad / pw 가 곧 '능선에서 몇 픽셀인가' 다
  // 화면 한 픽셀이 재질 좌표에서 몇 인가. 거품 무늬의 안티에일리어싱이 이 값을 쓴다.
  // ⚠⚠ **반드시 분기 밖에서 뜬다.** 균일하지 않은 제어 흐름 안의 미분은 GLSL 이 정의하지
  //   않는다 — 바로 위 pw 를 여기 둔 것과 정확히 같은 이유다. 편의상 거품 블록 안으로
  //   옮기면 대부분의 GPU 에서 잘 돌다가 특정 드라이버에서 원경에 격자 얼룩이 뜬다.
  vec2 dMat = fwidth(vMat);
  float matPx = max(max(dMat.x, dMat.y), 1e-6);
  // 거품. 원본을 그대로 읽으면 잔 알갱이가 되므로 5탭으로 번지게 한다 —
  // 선의 세기를 이걸로 변조하므로(fglow) 번짐이 그대로 무리의 부드러움이 된다
  float fmR = texture2D(uH, vUv).w * 0.40
            + (texture2D(uH, vUv + vec2(uFoamBlur, 0.0)).w
             + texture2D(uH, vUv - vec2(uFoamBlur, 0.0)).w
             + texture2D(uH, vUv + vec2(0.0, uFoamBlur)).w
             + texture2D(uH, vUv - vec2(0.0, uFoamBlur)).w) * 0.15;
  float fm = smoothstep(uFoamLo, uFoamHi2, fmR);

  // ── 흰 거품 (v0.10.2). **부서진 자리를 실제로 흰색으로 그린다.**
  //
  // 거품 채널(.w)은 v0.4 부터 있었지만 화면에 칠하지는 않았다 — 마루 선의 세기를
  // 변조하는 마스크(fglow)로만 썼다. 그래서 레퍼런스 사진의 흰 그물이 없었다.
  //
  // ⚠ 이 층은 마루 선보다 **위에 오면 안 된다.** 선과 이음매가 거품 위에 얹혀야 한다.
  // ⚠ v0.60 : tone 0.85 에서는 이 선이 흰 덩어리를 덮어 두 줄로 가른다 — lineYield 로 비킨다.
  //   ⚠ waterTone 을 0 으로 되돌리면 lineYield 도 **손으로 같이** 0 으로 둔다 — 자동 연동이 아니다 (tone 은 시간대 표에서도 오고 셰이더에 tone 유니폼이 없다)
  // ⚠⚠ 지금은 시뮬의 **거친 마스크를 그대로 칠하는 단계**다. 텍셀이 월드 0.172 라
  // 화면 가로에 70개뿐이고, 레퍼런스의 레이스 무늬는 여기서 절대 안 나온다.
  // 무늬는 다음 단계에서 프래그먼트 노이즈(worley 경계)로 넣는다 — 마스크는 이걸 쓴다.
  // ⚠ 흰 종이 위에서 백색은 선을 지운다(불변식 14). tone 0 에서는 여지가 13레벨뿐이라
  // uFoamWhite 를 올려도 잘 안 보인다. waterTone 과 **같이** 봐야 하는 손잡이다
  //
  // ── 무늬. **레퍼런스(threejswaterpro)는 여기서 거품 텍스처 두 장을 쓴다** —
  // 성긴 레이스 한 장(어두운 바탕 + 밝은 세포벽)과 짙은 것 한 장(흰 바탕 + 검은 구멍).
  // 실제로 열어 보니 **둘은 같은 세포 구조에 문턱만 다른 것**이었다. 그래서 이미지 두 장이
  // 아니라 **필드 하나 + 농도가 미는 문턱**으로 같은 그림을 만든다 (5-4 : 이미지 0장 유지).
  //
  //   fm 0 → 벽 폭 uFoamThin  : 경계선만 가늘게 → **얇은 실선 그물** (레퍼런스 foam2)
  //   fm 1 → 벽 폭 uFoamThick : 벽이 두꺼워져 서로 붙고 세포 중심만 남는다
  //                              → **흰 바탕에 검은 구멍** (레퍼런스 foam4)
  //
  // 이 이동이 곧 "모여지고 · 사라지고" 다. 세기를 따로 애니메이션할 필요가 없다 —
  // 거품 농도(fm)가 오르내리는 것만으로 무늬의 성격이 바뀐다.
  //
  // ⚠⚠ **좌표는 월드(vW.xz)가 아니라 재질 좌표(vMat)다.** 2026-09-05 에 고쳤다.
  // 사용자 지적 : "파도가 치고 그냥 그 위에 거품이 위치가 고정되어 표현되고 있음".
  //
  // 원인은 이거였다 — 무늬를 vW.xz(월드)에서 떴다. 월드는 Gerstner 횡변위가 **끝난**
  // 좌표라, 파도가 그 위를 지나가도 무늬는 제자리다. 벽지 위로 스텐실이 미끄러지는 꼴이다.
  // 물 입자의 이름표는 변위 **전** 좌표(vMat)다. 거기 붙이면 무늬가 물과 함께 실려
  // **마루에서 압축되고 골에서 늘어난다** — 파도를 타는 것이 공짜로 나온다.
  //
  // 그 위에 **스토크스 이류**를 얹는다. 실제 바다에서 거품은 파의 진행 방향으로 천천히
  // 떠내려간다 (심해에서 대략 ω·k·A²). uSwellDir 은 대역들의 평균 진행 방향이다.
  // ⚠ 부호가 마이너스인 이유 : 샘플 좌표를 뒤로 밀어야 무늬가 앞으로 간다.
  // ⚠ 시각은 반드시 uTimeQ(양자화)다. 실시간 t 를 쓰면 물은 초당 12번인데 무늬만
  //   매끄럽게 흘러 컷아웃 질감이 깨진다 (불변식 10).
  // ── 흰 거품 (v0.10.4). 사용자 지적 세 가지를 고친다 (2026-09-05).
  //   ① "폴리곤 형태라 인위적"  → 도메인 워프 + 벽 두께 요동 + 마루선 방향 이방성
  //   ② "성기고 안 촘촘하다"     → 세포를 2.5배 잘게 + 잔 그물을 **합집합(max)** 으로 얹음
  //   ③ "파도와 무관하게 남는다" → 흰 거품 전용 나이 곡선 + 높이 띠 · 앞뒤 치우침
  // 위 주석의 좌표·이류·시각 규칙(vMat · 스토크스 이류 · uTimeQ)은 그대로 유효하다.

  // ── ③-a 나이. **이것이 3번의 주 처방이고, 비용이 0 이다.**
  //
  // ⚠⚠ fm = smoothstep(0.12, 0.42, fmR) 은 감쇠를 **평평하게 눌러 편다.**
  //   br=1 인 자리는 fmR 이 0.42 로 내려올 때까지 fm 이 정확히 1.0 이다 —
  //   초당 0.70 감쇠에서 ln(0.42)/ln(0.70) = **2.43초**. 주파 주기는
  //   2π / (2.7211 × waveSpeed 0.48) = **4.81초** 다. 즉 거품이 반 주기 동안 최대 밝기
  //   그대로 버틴 뒤 갑자기 꺼진다. 그게 "파도가 지나갔는데 그대로 남아 있다" 의 실체다.
  // ⚠ fm 자체를 고치면 안 된다 — 마루 선의 fglow 가 같은 값을 쓴다. 그래서
  //   **번진 원본(fmR)을 여기서 자기 문턱으로 다시 읽는다. 텍스처 페치 0회 추가.**
  // ⚠⚠ uFoamWHi 를 1.0 가까이 두는 것이 요점이다. 내리면 평평한 뚜껑이 그대로 돌아온다
  float wHi = max(uFoamWHi, uFoamWLo + 1e-3);
  float fmW = smoothstep(uFoamWLo, wHi, fmR);

  // ── ③-b 지금 이 자리가 '높은 파도의 경사면 윗쪽' 인가.
  //
  // ⚠⚠ **h 의 상한 0.69 는 낡은 숫자다.** 실측 분포는 p10 0.151 / p50 0.467 / p90 0.793 이고
  //   1.0 에 닿는다. 옛 0.69 를 믿고 문턱을 0.6 대에 두면 이 게이트는 '마루' 가 아니라
  //   **바다의 위쪽 절반**을 고른다 — 게이트가 아니게 된다.
  // ⚠⚠ 높이는 **자르는 칼이 아니라 세기**다 (불변식 13). 무늬를 만드는 것은 여전히
  //   기억(fmW)이고, h 는 그 위에 곱해질 뿐이다.
  // ⚠⚠ **위쪽도 닫는다** (LH2/LH3). 마루 꼭대기는 바탕이 222~228 이라 흰색을 얹을 여지가
  //   아예 없다. 닫으면 **사면의 띠**가 되고, 그게 사용자가 말한 "경사면 윗쪽" 과 같은 자리다.
  //   ⚠ v0.60 측정 (저녁 tone 0.85) : 이 컷을 꺼도 흰 거품 면적 0.0793 → 0.0795 로 사실상 0 이라 두 겹의 원인이 아니었다.
  //     근거 222~228 은 tone 0 실측이라 낡았지만, 효과가 없어 그대로 둔다
  // ⚠ steep 으로 구동하지 않는다. 기울기 중앙값이 0.036 이라 화면 100% 가 덮이고,
  //   가파름은 sim.js 의 br 이 이미 가중치로 쓰고 있다 — 두 번 곱할 이유가 없다.
  // ⚠ smoothstep 의 edge0 < edge1 을 max 로 강제한다. 슬라이더 범위가 겹쳐 뒤집을 수 있는데,
  //   GLSL 은 e0 >= e1 에서 정의가 없고 e0 == e1 == x 면 NaN 이 c 로 번진다
  float lH1 = max(uFoamLH1, uFoamLH0 + 1e-3);
  float lH3 = max(uFoamLH3, uFoamLH2 + 1e-3);
  float liveH = smoothstep(uFoamLH0, lH1, h) * (1.0 - smoothstep(uFoamLH2, lH3, h));

  // dirf < 0 = 파가 나아가는 쪽으로 **내려가는** 면 = 앞면. 부서진 물이 쏟아지는 자리다.
  // ⚠⚠ **앞면만 남기면 거품이 통째로 사라진다.** fm 분포는 마루 **뒤**(dirf > 0)로 치우쳐
  //   있다. 구조적 이유가 있다 — sim.js 의 br 은 부호 없는 기울기 크기(sm.y)로 나므로
  //   앞뒤 대칭으로 태어나고, 마루가 앞으로 나아간 만큼 꼬리가 뒤에 남는다.
  //   그래서 ⓐ 중심을 uFoamFaceB 로 옮기고(crestBias 와 **같은 처방**)
  //        ⓑ 칼이 아니라 **치우침**으로 준다 (앞면 1.0 / 뒷면 1 − uFoamFaceA).
  // ⚠ uFoamFaceA 를 1.0 으로 올리지 않는다 — 뒷면이 0 이 되어 칠할 것이 없어진다
  // ⚠⚠ **위 근거는 낡았다** (2026-09-06). "br 은 부호 없는 sm.y 로 나므로 앞뒤 대칭으로
  //   태어난다" 는 v0.11.3 이 swellMain 에 부호 있는 z 와 uFoamFront(4:1)를 넣으면서
  //   더 이상 사실이 아니다. **태어나는 자리는 이미 선단이 맞다. 틀린 것은 남는 자리다** —
  //   기억(h.w)은 제자리에서 삭고(초당 0.697) 마루는 cp 0.665 월드/초로 간다.
  //   실측(CPU 재현, 상대비만 유효) : 칠해지는 거품의 **선단 48.3% · 앞:뒤 0.93 : 1**.
  //   사용자의 "반은 맞고 반은 틀림" 이 이 숫자다.
  //
  // ⚠⚠ 옛 게이트는 **권한이 없었다.** face 가 max(·, uFoamCalm)·uFoamLive 사슬 **안**이라
  //   dens 대비 상한이 1/(0.4+0.6·calm) = 1.72배였고, bias 0.45 탓에 실효는 **1.15배**였다.
  //   그래서 사슬 **밖**으로 꺼낸다 (uFoamFaceOut). uFoamCalm 은 **높이 띠**가 기억을 0 으로
  //   누르지 않게 막는 바닥이지(불변식 0) 앞뒤를 막는 바닥이 아니다.
  //   ⚠ 기억(fmW)은 여전히 곱셈으로 전부를 게이트한다 — fmW=0 이면 선단이라도 안 그려진다.
  //
  // ⚠⚠ 창의 신호를 **정규화 안 한 sdir** 로 바꾼다 (uFoamFaceSoft).
  //   dirf 는 방향코사인이라 면적의 69.5% 가 |dirf|>0.9 인 준-이진이고 전이 띠의 월드 폭이
  //   0.215(시뮬 텍셀 1.25개)뿐이다. 사슬 밖에서 세게 걸면 능선을 따라 1텍셀짜리
  //   **칼자국 = 90도 돌아온 등고선 뚜껑**(불변식 13)이 된다.
  //   실측 (amt 0.80) : 전이 중간대 면적 6.0% → **29.6%**, 선단비율 77.4% → 75.1%, 잉크 동일.
  //   **2 포인트를 주고 칼자국을 산다.**
  //   ⚠ 불변식 13 의 "경사로 구동 금지(기름막)" 와 다르다 — 저건 |∇h| **크기**로 색을 몰았고
  //     중앙값 0.036 이라 아무 데도 안 갈렸다. 이건 **부호**를 rms 로 정규화한 승수다.
  // ⚠ S = oceanSwell × swellSlopeRms(). 셰이더에 0.361 을 적지 않는다 (불변식 2).
  //
  // ⚠⚠ **롤백이 둘이다.** uFoamFaceSoft=0 → 옛 dirf · uFoamFaceOut=0 → 옛 자리.
  //   둘 다 0 이면 비트 단위로 v0.11.3 이다 (mix(x,y,0.0) === x).
  //   ⚠ uFoamLive=0 은 이제 **높이 띠만** 끈다. 앞뒤를 끄는 것은 uFoamFaceA=0 이다.
  float fsig  = mix(dirf, sdir / max(uFoamFaceS, 1e-4), uFoamFaceSoft);
  float faceW = 1.0 - smoothstep(-uFoamFace, uFoamFace, fsig - uFoamFaceB);
  // ── 짙은 기억은 뒷면에서도 안 누른다 (v0.60). 측정 : 흐린 두 겹의 22% 가 뒷면 ×0.15 가 짙은 꼬리를 누른 것이었다 (x782 · x626 윗띠).
  // ⚠ 잔물결 부호 뒤집힘이 아니다 — 측정 단면에서 뒷면 F 는 0.67~0.96 으로 이어졌다. 기하적인 뒷면을 통째로 누른 것이다
  // ⚠ 여전히 치우침이다 — 옅은 꼬리는 예전처럼 1 − uFoamFaceA 까지 눌린다 (레퍼런스의 '지나간 쪽으로 옅어짐')
  // ⚠ 입술(번진 기억의 진행 방향 미분)로 가르지 않는다 — 기억이 꼬리에서 선단으로 단조롭게 짙어져 꼬리 전체를 똑같이 누른다 (v0.60 검토에서 기각)
  // ⚠ uFoamFaceKeep 0 → 1.0 − A·(1.0 − 0.0·s) = 1.0 − A — 비트 단위로 예전
  float fKeep = uFoamFaceKeep * smoothstep(uFoamFaceKeepLo, max(uFoamFaceKeepHi, uFoamFaceKeepLo + 1e-3), fmW);
  float face  = mix(1.0 - uFoamFaceA * (1.0 - fKeep), 1.0, faceW);
  // ── 파란 띠 밑 (v0.61). 사용자 : "파도 오로라에서 파란색 부분을 담당하는 그 밑으로 은은하게 얇게".
  // ⚠ 실측 : 파도가 카메라 반대쪽으로 가서 화면의 큰 면은 뒷면(fsig > 0 = 오로라 파랑 쪽)이고, 앞면(보라)은 능선 위 얇은 조각이다.
  //   앞면을 남기는 옛 치우침은 그 조각 위에도 거품을 얹어 오로라 선을 사이에 둔 두 줄이 된다 — 그래서 뒤집는다
  // ⚠ 칼이 아니라 같은 smoothstep 창(±uFoamFace)의 반대편이다. 기억의 꼬리가 뒷면에 있어 거품이 통째로 사라지지 않는다
  //   ('앞면만 남기면 사라진다' 교훈의 거울상이다)
  // ⚠ uFoamUnder 0 → mix(face, …, 0.0) === face — 비트 단위
  face = mix(face, 1.0 - faceW, uFoamUnder);
  float live  = liveH * mix(face, 1.0, uFoamFaceOut);

  // ⚠⚠ 게이트에 **바닥(uFoamCalm)을 깐다.** 불변식 0 : z 와 w 는 이 바다에서 기억을 갖는
  //   유일한 층이다. 게이트로 0 까지 눌러 버리면 남는 그림이 '현재 파도 상태의 순수 함수'가
  //   되어 아름다운 무늬로는 보여도 **장소로는 안 읽힌다.**
  // ⚠ sim.js 의 br 을 흉내 내어 '기억 없이 마루에서 바로 태어나는' 항을 더하지 **않는다.**
  //   sim.js 가 실측으로 기각한 방식이다 ("등고선의 얇은 뚜껑이 된다. 실제로 그랬다").
  // ⚠ uFoamLive = 0 이면 mix 가 1 을 내므로 게이트가 통째로 꺼진다 — 롤백 스위치다
  // ── 오래된 꼬리를 자른다 (v0.61, foamUnder). 기억은 마루에서 태어나 제자리에서 삭고 마루는 떠난다 —
  //   농도가 곧 '마루에서 얼마나 멀어졌나' 다. 옅은 꼬리를 안 칠하면 능선 바로 밑의 얇은 띠만 남는다 (탄생은 그대로다)
  // ⚠ 흰 거품 칠에만 쓴다. 마루선 비키기(wMem) · 짙은 뒷면 남김(fKeep)은 fmW 그대로다
  // ⚠ uFoamUnder 0 → mix(fmW, …, 0.0) === fmW — 비트 단위
  // ── 능선 밑 띠 (v0.61, foamUnder). 사용자 : "너무 파도 한가운데에서 완만하게 너무 넓게 파도 밑으로 퍼지게 발생".
  // ⚠⚠ 농도(꼬리 자르기)로는 두께가 안 준다 — 기억이 마루 근처와 꼬리가 비슷한 농도의 넓은 판이다 (1634×1127 멈춘 프레임 : 문턱 0.30 에서
  //   세로 두께 상위 10% 160px ≈ v0.60 152px, 0.55 에서는 면적 9.2% → 0.3% 로 통째로 사라졌다). 그래서 두께는 **파도 모양**이 정한다.
  // ⚠ 기울기(sdir / rms)로 띠를 잡은 첫 판은 버렸다 — 잔물결이 섞여 능선 근처 기울기가 들쭉날쭉해 화면의 파란 띠와 안 맞았다
  //   (같은 프레임 : v0.60 면적 2.83% → 기울기 띠 0.38% · 조회 방향을 뒤집어도 0.42%).
  // 그래서 **화면에 보이는 오로라 그 자체**를 자로 쓴다 — 아래 마루선 블록의 무리(halo) · 파랑 쪽(faceL) · 높이(tallL)와 **글자 그대로 같은 식**이다.
  //   halo 는 능선에서 1 이고 바깥으로 0 이 된다 (무리 세기는 halo² 라 0.35 에서 이미 0.12). 그 옅어지는 가장자리가 곧 '파란 띠 바로 밑' 이다.
  // ⚠ 마루선 블록의 식을 바꾸면 여기도 같이 바꾼다 — 갈라지면 거품이 파란 띠에서 떨어져 뜬다
  // ⚠ 분기(uLineAmt > 0) 밖에서 다시 계산한다 — lineAmount 0 이어도 거품 자리는 같다. pw 는 분기 밖에서 뜬 fwidth 다
  float haloS  = 1.0 - smoothstep(0.0, pw * uLineW * uLineHalo, ad);
  float blueS  = clamp((dirf - uCrestBias) * uCrestFace * 0.5 + 0.5, 0.0, 1.0);
  float bandU  = (1.0 - smoothstep(0.0, max(uFoamStripW, 1e-3), abs(haloS - uFoamStripAt)))
               * smoothstep(0.5, 0.9, blueS)
               * smoothstep(uLineH0, max(uLineH1, uLineH0 + 1e-3), h);
  // ── 파도 뒤쪽 기억 조회 (v0.61). ⚠⚠ 기억은 능선 밑에 없다 — 기울기 1~3 · 높이 0.4~0.7 의 경사 중턱에 산다
  //   (1634×1127 멈춘 프레임 · 군집 끔 : 띠 없음 4.78% → 기울기 상한 0.5 에서 0.11% · 오로라를 꺼도 0.36%). 마루는 떠나고 기억은 제자리에 남기 때문이다.
  //   그래서 띠 픽셀이 **진행 방향 앞뒤** d · 2d 월드의 기억을 같이 본다 — 그 마루 둘레에 기억이 있으면 파란 띠 바로 밑에 칠한다.
  //   ⚠ 한쪽(뒤)만 보던 첫 판은 방향을 뒤집어도 결과가 같아(0.38% · 0.42%) 부호에 기대지 않게 양쪽을 본다
  //   어느 마루 · 어느 구간에 거품이 있는지는 여전히 기억이 정한다 (탄생 · 기억 층은 그대로 · 불변식 0).
  // ⚠ 좌표 : vMat == (u − 0.5, 0.5 − v)·domain 이라 swell 좌표의 Δp = −d·dir 는 Δu = −d·dir.x / domain · Δv = +d·dir.y / domain (uFoamReachUV, JS)
  //   v 부호를 틀리면 거품이 뒤집힌 바다의 기억을 본다 — sim.js 의 wpos 주석이 적어 둔 90도 사고와 같은 종류다
  // ⚠ 분기 밖에서 뜬다 (texture2D 의 암묵 미분). 조회 4회. uFoamUnder 0 이면 mix 가 fmW 를 그대로 내 결과에 안 쓰인다
  float fmReach = max(fmR, max(max(texture2D(uH, vUv + uFoamReachUV).w,       texture2D(uH, vUv - uFoamReachUV).w),
                               max(texture2D(uH, vUv + 2.0 * uFoamReachUV).w, texture2D(uH, vUv - 2.0 * uFoamReachUV).w)));
  float fmU  = mix(fmW, smoothstep(uFoamTailLo, max(uFoamTailHi, uFoamTailLo + 1e-3), fmReach) * bandU, uFoamUnder);
  float dens = fmU * mix(1.0, max(live, uFoamCalm), uFoamLive)
                   * mix(1.0, face, uFoamFaceOut);

  // ⚠⚠ **거품은 배 근처에만 있다.** 레퍼런스 영상 실측 (2026-09-05) : 풍속 15.8m/s 인데도
  // 배에서 먼 외해에는 흰 거품이 **사실상 하나도 없다.** 거기 있는 것은 잔결(microA/microB)
  // 뿐이고, 흰 거품은 선체 접촉과 항적 주변에서만 자란다.
  // ⚠ fm 자체를 깎으면 안 된다 — fm 은 마루 선의 거품 변조(fglow)도 구동한다.
  // ⚠ dB(배까지의 거리)는 위에서 이미 구해 뒀다. 새로 계산하지 않는다.
  // ⚠ 이 감쇠를 **해시를 뜨기 전에** 곱해 둔다. 예전에는 worley 두 겹(해시 18회)을 전부
  //   돌고 나서 0.12 를 곱했다 — 먼 바다에서 통째로 낭비였다
  float fNear = 1.0 - smoothstep(uFoamNear * 0.4, uFoamNear, dB);
  fNear = uFoamFar + (1.0 - uFoamFar) * fNear;
  float kF = dens * uFoamWhite * fNear * vDetail;

  // ── 마루선 층이 흰 거품에 비킨다 (v0.60). 측정 : 흐린 두 겹의 56% 는 마루선 층이 능선 위 흰 거품을 덮은 것이었다.
  // ⚠⚠ 위(흰 거품 머리 주석)의 '거품이 마루선 위에 오면 안 된다' 는 tone 0(흰 종이) 전제다 — tone 0.85 에서 뒤집힌다 (불변식 14)
  // ⚠⚠ 비키는 양을 kF 로 재지 않는다 (uLineYieldSrc 1) — kF 에는 앞뒤 창(뒷면 ×0.15)이 곱해져 뒷면 어깨에서 선이 절반 남는다
  //   (x718 y666 대입 : kF 0.62 → lineKeep 0.47). 앞뒤 창 전의 기억 존재량으로 잰다. fNear 는 남긴다 — 원경은 흰색도 옅다
  // ⚠ 무늬(pat)를 곱하지 않는다 — 곱하면 세포 구멍마다 보라·금빛이 비쳐 색 점 도장이 된다
  // ⚠ 흰 거품을 마루선 블록 뒤로 옮겨 칠하는 순서만 바꾸는 것도 같은 이유로 안 된다
  // ⚠ 컬 밖에서 늘 계산되는 연속값이라 경계가 없다 (불변식 19). uLineYield 0 → lineKeep 정확히 1.0
  // ⚠⚠ × min(uFoamWhite, 1.0) (v0.60 고침) : 흰 거품을 끄는 경로(개발 바 '끄기' 거품 · 전부 · 패널 층 끄기 '흰 거품' = foamWhite 0)에서
  //   흰색은 0 인데 마루선만 기억 자리에서 비켜 오로라에 흰색 없는 어두운 구멍이 났다 (정적 검토). 층 분해 측정의 기준 화면(foamWhite 0)도 오염된다.
  //   foamWhite 4.5 인 기본에서는 × 1.0 이라 그림이 그대로다. lineYield 0 되돌리기와도 무관하다 (lineKeep 이 이미 1.0)
  // ⚠⚠ uLineYieldK 0.35 → 0.10 (v0.60 재측정) : 배에서 foamNear 18 월드 너머는 fNear 가 foamFar 0.25 로 떨어져, fmW 0.57 짜리 짙은 기억도
  //   인수가 약 0.14 → wMem 0.35~0.6 → 선이 절반 넘게 남아 금빛 이음매 · 무리가 흰 덩어리를 두 띠로 갈랐다 (단면 x158 · x166, 보기 14 초록 0.77~0.89).
  //   흰 거품 kF 는 foamWhite 4.5 를 곱해 clamp 하므로 먼 곳에서도 포화해 남는데 wMem 에는 그 이득이 없었다.
  //   같은 멈춘 프레임 3장 : 마루선이 지운 흰 잉크 합 기본(K 0.35) 58 → K 0.10 23 (−61%) · 오로라 C −3% (거품 없는 능선은 ±5% 안). lineYield 1 은 52 로 거의 무효였다
  float wMem     = smoothstep(0.0, max(uLineYieldK, 1e-3), fmW * mix(1.0, max(liveH, uFoamCalm), uFoamLive) * fNear) * min(uFoamWhite, 1.0);
  float wCov     = mix(clamp(kF, 0.0, 1.0), wMem, uLineYieldSrc);
  // ⚠ v0.61 : foamUnder 면 오로라가 비키지 않고 **위에 남는다** — 거품이 뒷면에만 있어 선을 사이에 둔 두 줄이 생기지 않는다.
  //   사용자가 원한 그림이 '파란 띠 밑의 거품' 이라 파랑이 거품에 먹히면 안 된다. uFoamUnder 0 → mix(x, 1.0, 0.0) === x
  float lineKeep = mix(1.0 - uLineYield * wCov, 1.0, uFoamUnder);
  // 검증 보기 14 용 — 뒤에 오는 층의 섞는 비율 (흰 거품 세기 foamStr 는 보기 14 블록 안에서 계산한다 — 여기 두면 수면 전체 픽셀마다 exp 가 돈다)
  float dbgLineK = 0.0, dbgSeamK = 0.0, dbgGlowK = 0.0;

  // uFoamWhite = 0 이면 kF = 0 이라 여기서 걸린다 — 층 끄기(LAYERS)가 그대로 동작한다.
  // ⚠ v0.60 : 마루선 비키기(wMem)도 foamWhite 0 에서 꺼진다 (× min(uFoamWhite, 1.0)) — 흰 거품을 끈 화면의 오로라는 예전과 같다.
  // ⚠ 이 가드는 dens 로 건다. dens <= fmW <= 1 이고 게이트는 곱하기만 하므로, 예전
  //   가드(fm > 0.002)보다 항상 **안쪽**이다 — 거품 한가운데를 가로지르는 새 칼자국이 안 생긴다
  // ⚠⚠ **이 가드가 곧 비용이다.** 안쪽은 worley 두 겹(해시 18회) + 도메인 워프라
  //   이 수면 셰이더에서 가장 비싼 블록이다. 통과하는 **면적**이 GPU 시간을 정한다.
  //   ⚠ 0.0025 는 "색이 0.25% 섞인다" 는 뜻이라 눈에는 절대 안 보인다 — 즉 **보이지도 않는
  //     자리에서 해시 18회를 돌고 있었다.** uFoamCull 로 그 문턱을 올려 잘라낸다.
  //   ⚠ 어디서 도는지는 **검증 보기 12** 로 본다 (PB.params.debugView = 12).
  if (kF > uFoamCull) {
    dbgCost += 13.0;                     // ⚠ 18 이 아니다 : vnoise2(4) + worleyF12(9)
    // ── ① 좌표 : 재질 좌표 + 스토크스 이류 → 마루선 방향 신장 → 세포 단위
    // ⚠ 실제 백파는 마루를 따라 길게 눕는다 (전단이 늘린다). 등방 세포는 어느 방향으로도
    //   같은 직선 벽을 내서 벌집 = 다각형으로 읽힌다 — 지적 ①의 절반이 이것이다.
    // ⚠⚠ 축이 **전역 평균 방향**(uSwellDir)이라 국소 마루선과 어긋난다. 능선은 12대역 합에서
    //   나오는 이어진 곡선이지 평균 방향에 수직인 직선이 아니다. 그래서 1.6 이상 올리지
    //   않는다 — 크게 주면 화면 전체가 같은 각으로 빗질돼 오히려 더 인위적으로 읽힌다
    vec2 m  = vMat - uSwellDir * (uFoamDrift * uWaveSpeed * uTimeQ);
    vec2 T  = vec2(-uSwellDir.y, uSwellDir.x);
    vec2 q  = vec2(dot(m, T) / max(uFoamStretch, 0.2), dot(m, uSwellDir)) * uFoamCell;

    // ── ② 도메인 워프 — **각짐을 없애는 항이다** (지적 ①의 본체).
    //
    // Voronoi 의 벽은 두 세포점의 **수직이등분선**이라 수학적으로 직선이고 셋이 120도로
    // 만난다. 특징점을 아무리 흔들어도(hash2 가 이미 셀 한 칸 full jitter 다) 벽은 직선인
    // 채로 자리만 바뀐다 — 그게 "폴리곤으로 보인다" 의 원인이다.
    // ⚠ 거리 지표를 바꾸는 것(맨해튼/체비셰프)은 **더 나쁘다.** 이등분선이 축·45도로 꺾이는
    //   계단이 되고 **축 정렬 이방성**이 생긴다 — swell.js 가 '골함석' 으로 남긴 실패 유형이다.
    // 고칠 방법은 하나다 : **좌표계를 먼저 구부린 뒤 그 위에서 worley 를 뜬다.**
    // 매끄러운 비선형 사상에서 직선의 원상은 곡선이므로 벽이 통째로 휜다.
    // ⚠ 워프는 반드시 **이류된 좌표(q) 위에서** 뜬다. vMat 원본에서 뜨면 무늬만 흐르고
    //   일그러짐은 제자리라 '아지랑이 유리' 로 읽힌다 (무늬가 물에 안 붙는 것과 같은 병).
    // ⚠⚠ 진폭을 키우면 좌표가 **접힌다** (야코비안 부호 반전 → 거울 대칭 주름).
    //   vnoise2 의 최대 기울기는 smoothstep 보간이라 1.5 이고 격자값 폭이 1.0 이므로,
    //   접힘 한계는 uFoamWarp × 1.5 × 0.85 > 1, 즉 **uFoamWarp > 0.78** 이다.
    //   기본 0.30 은 여유 2.6배. 슬라이더 상한을 0.70 으로 막아 뒀다.
    //   ⚠ 옥타브를 하나 더 얹어 결과를 되먹이면(iterated warp) 이 한계가 절반 아래로
    //     내려간다. 그래서 **되먹이지 않는다.**
    // ⚠ 워프에 시간을 따로 넣지 않는다. 시각은 q 안의 uTimeQ 하나뿐이라야 한다 —
    //   넣는 순간 무늬가 물과 따로 끓는다
    vec2 nz = vnoise2(q * 0.85 + 17.3);
    vec2 fq = q + nz * uFoamWarp;

    // 화면 한 픽셀이 덮는 **세포 수**. 1.4 는 워프 야코비안 상한(1 + 0.30×1.5×0.85 = 1.38)이다.
    // ⚠ matPx 는 신장 **전** 좌표에서 쟀다. 신장은 T 축을 줄이므로 실제 발자국은 이보다
    //   작거나 같다 — 안전한 쪽으로 틀린 근사다
    float px  = matPx * uFoamCell * 1.4 * uFoamAA;
    float pxB = px * uFoamFine;

    vec2  wA    = worleyF12(fq);
    float wallA = wA.y - wA.x;                    // 경계선에서 0 (⚠ F1 이 아니다)

    // ── ③ 굵은 그물. 농도가 오르면 벽이 두꺼워진다
    //     (dens 0 → 얇은 실선 그물 / dens 1 → 흰 바탕에 검은 구멍).
    // ⚠ 여기 dens 를 쓰는 것이 지적 ③의 나머지 절반이다 — 파가 잦아들면 세기만 주는 게
    //   아니라 무늬의 **성격**이 얇은 그물로 되돌아간다. 이게 "은은하게 사라진다" 다.
    // ⚠⚠ **벽 두께를 자리마다 흔든다.** 각져 보이는 주범은 직선만이 아니라 **등폭**이다 —
    //   굵기가 일정하면 아무리 휘어도 도면으로 읽힌다. 소스는 워프 노이즈(nz) 재활용 (공짜).
    // ⚠⚠ 여기에 **잔 worley 를 쓰면 안 된다.** 각진 격자를 한 겹 더 얹는 꼴이고, 아래
    //   잔기포 침식과 같은 필드라 두 효과가 같은 선 위에서 서로를 강화해 격자가 도드라진다.
    // ⚠ nz.x + nz.y 는 ±1.0 이 상한이므로, uFoamRough 상한 0.6 에서도 t 는 항상 양수다
    // ⚠ 레이스 (v0.60, 시안) : 벽 두께를 앞뒤 창이 섞인 dens 대신 기억 fmW 가 몬다 — 짙은 기억은 흰 바탕에 잔 구멍,
    //   옅은 꼬리는 foamThin × foamLaceThin 의 큰 구멍 그물. fmW 는 한 덩어리 안에서 봉우리 하나라 두께 전환이 띠를 만들지 않는다
    // ⚠ uFoamLace 0 → 두 mix 모두 첫 값 그대로 (mix(dens, fmW, 0.0) === dens · mix(thin, thin·s, 0.0) === thin — 비트 단위)
    // ── 거품 군집 (v0.61). 사용자 : "어느부분에는 거품이 가득하게 어느 부분은 기포때문에 잘 생기지않는 모습".
    // 저주파 값 노이즈(FOAM_CLUMP 의 fcNoise, 2옥타브 · 둘째 36.87° 회전)를 무늬와 **같은 이류 좌표 m** 에서 뜬다 — 군집이 물에 실려 간다.
    // ⚠ 알파만 줄이지 않는다 — 벽 두께(tDrv)도 같이 줄여, 빈 곳은 옅어지는 게 아니라 **큰 구멍 레이스**가 된다 (기포 자리)
    // ⚠ 분기 안에 미분이 없다 (해시 · 산술뿐) — 비균일 제어 흐름이어도 정의된다. 컬(kF) 뒤에서 곱하므로 컬 경계 값이 늘지 않는다 (불변식 19)
    // ⚠ 마루선 비키기(wMem)는 이 값을 모른다 — foamUnder 에서는 오로라가 안 비키므로 빈 곳에 어두운 구멍이 생기지 않는다
    // ⚠ uFoamPatch 0 → 분기를 안 타 dP = 1.0 → × 1.0 — 비트 단위
    float dP = 1.0;
    if (uFoamPatch > 0.0) {
      dbgCost += 8.0;                    // fcNoise 2회 = 해시 8회
      vec2  pq = vec2(dot(m, T) / max(uFoamStretch, 0.2), dot(m, uSwellDir)) / max(uFoamPatchCell, 0.3);
      float pn = 0.65 * fcNoise(pq) + 0.35 * fcNoise(mat2(0.8, -0.6, 0.6, 0.8) * pq * 2.37 + 7.3);
      pn = clamp((pn - 0.5) * 2.2 + 0.5, 0.0, 1.0);
      dP = mix(1.0, smoothstep(uFoamPatchLo, max(uFoamPatchHi, uFoamPatchLo + 1e-3), pn), uFoamPatch);
    }
    float tDrv = mix(dens, fmW, uFoamLace) * dP;
    float t = mix(mix(uFoamThin, uFoamThin * uFoamLaceThin, uFoamLace), uFoamThick, tDrv)
            * (1.0 + uFoamRough * (nz.x + nz.y));
    float e = uFoamEdge + px * 0.6;

    // ⚠⚠ **문턱 폭을 넓히는 것만으로는 안티에일리어싱이 아니다.** px → ∞ 에서
    //   1 − smoothstep(t, t+e, wall) 은 평균 피복률이 아니라 **1(전면 백색)** 로 간다.
    //   원경이 재워지는 게 아니라 흰 안개가 되고, 흰 종이 위 백색은 선을 지운다(불변식 14).
    //   그래서 세포가 픽셀 밑으로 내려가는 만큼 **해석적 평균 피복률로 수렴**시킨다.
    // ⚠ 2.2 는 F2−F1 분포에서 나왔다 — 중앙값 0.228 이므로 원점 근처 밀도 ≈ 0.5/0.228 = 2.19
    float cov  = clamp((t + e * 0.5) * 2.2, 0.0, 0.92);
    // ⚠⚠ **전이 창을 크게 넓혔다** (0.35~1.10 → 0.30~2.60, 2026-09-06).
    //   사용자 지적 : *"거품 표현은 훌륭한데 해당 이팩트 **층류**가 보임"*.
    //   px 는 화면 픽셀의 재질 좌표 발자국이라, **스치는 시선에서는 화면 세로 좌표의 함수**다.
    //   그래서 좁은 창은 화면을 가로지르는 **띠**가 된다 — 그게 층류의 정체였다.
    //   실측 (구조 텐서로 잰 '한 축으로 빗질된 정도') :
    //     지금 그대로 0.706 · **foamAA 0 → 0.11** · foamNear 제거 0.614 · foamStretch 1 → 0.687
    //   → 원인의 94% 가 이 전이다. foamStretch 도 foamNear 도 아니었다.
    //   ⚠ 왜 지금 드러났나 : px 에 uFoamCell 이 곱해져 있는데 그 값이 2.5 → 9.9 로 **4배**가 됐다.
    //     전이 띠가 원경에서 근경으로 그대로 끌려 들어온 것이다.
    //   ⚠ foamAA = 0 으로 끄면 안 된다 — 원경에서 세포가 픽셀 밑으로 내려가 **끓는다**.
    //     창을 넓혀 같은 전이를 화면 넓게 펴는 것이 답이다.
    float soft = smoothstep(0.30, 2.60, px);
    float pat  = mix(1.0 - smoothstep(t, t + e, wallA), cov, soft);

    // ── ④ 잔 그물 — 밀도(지적 ②)를 만드는 항.
    //
    // ⚠⚠ 예전 코드는 두 번째 worley 를 pat *= 1 − bubble·… 로 **빼는 데만** 썼다.
    //   밀도가 줄어드는 방향이다 — 지적 ②의 절반이 정확히 이것이었다.
    //   **합집합(max)** 으로 돌려 굵은 그물의 빈 곳을 채우게 한다.
    // ⚠ 더하기가 아니라 max 인 것이 중요하다. 합은 흰 덩어리로 포화해 **색면**이 되지만,
    //   합집합은 '굵은 그물 사이사이에 잔 그물' 이라는 두 층위를 유지한다.
    //   가산이 아니므로 255 절단 문제도 없다 (블룸이 없다).
    // ⚠ 51.3도 회전을 섞는다 — 두 그물의 벽이 나란히 서면 다각형이 다시 보인다.
    // ⚠ uFoamFine 은 정수를 피한다. 2.0/3.0 은 공명해서 두 그물이 같은 자리에 겹친다.
    // ⚠⚠ 잔 겹이 픽셀 밑으로 내려간 원경에서는 worley 한 겹(해시 9회)을 통째로 건너뛴다.
    //   **이 분기 안에 fwidth 도 texture2D 도 없다** — 그래서 비균일 제어 흐름이라도
    //   미정의 동작이 없다. matPx 를 분기 밖에서 뜬 것이 이걸 가능하게 한다
    // ⚠ 잔 겹의 전이도 같은 이유로 넓힌다 (0.30~0.70 → 0.35~1.90). 이 창이 좁으면
    //   굵은 그물의 전이와 **다른 자리**에 두 번째 띠가 생겨 층이 두 겹으로 보인다
    float fineFade = 1.0 - smoothstep(0.35, 1.90, pxB);
    if (fineFade > 0.0) {
      dbgCost += 9.0;                    // 잔 그물 한 겹 더
      vec2  fqB   = mat2(0.6247, -0.7809, 0.7809, 0.6247) * fq * uFoamFine + 31.4;
      vec2  wB    = worleyF12(fqB);
      float wallB = wB.y - wB.x;
      float tB    = t * 0.60;                     // 잔 그물의 벽은 굵은 그물의 60%
      float patB  = 1.0 - smoothstep(tB, tB + e * 0.7 + pxB, wallB);
      pat = max(pat, patB * uFoamFineAmt * fineFade);
      // 잔기포가 흰 면 **안쪽**을 갉는다. 없으면 매끈한 플라스틱이 된다 (원래 항 그대로).
      // ⚠ 이제 같은 워프 좌표 위에 있으므로 이 겹도 같이 휘어 있다 — 예전에는 각진 무늬를
      //   지우겠다면서 각진 무늬를 한 겹 더 얹고 있었다
      pat *= 1.0 - uFoamBubble * fineFade * smoothstep(0.05, 0.45 + pxB, wallB);
    }

    // ⚠⚠ **거품 끝을 부드럽게 하려고 여기에 앞치마를 댔다가 되돌렸다** (2026-09-07).
    //   사용자 : *"거품 무늬 이 파라미터 값에도 은은하게 끝부분의 처리가 옅어져야 할 것 같음."*
    //   실측 근거는 맞았다 — 층이 끝나는 자리(세포 구멍을 메우고 잰 진짜 외곽)에 평균 **2.87**
    //   이 남아 있었다 (검출 문턱 1.5 · 기준선 : 선체거품 2.1 · 그림자 1.8 · 흰거품 2.3).
    //   ⚠ 그런데 smoothstep(uFoamCull, uFoamCull*6.0, kF) 를 곱했더니 **거품이 통째로
    //     사라졌다** (면적 6.19% → 0). 원인을 규명하기 전에는 되돌려 두는 것이 맞다.
    //   ⚠ **foamEdge · foamAA 로는 이 문제를 못 고친다** — 그 둘은 세포 벽의 부드럽기이지
    //     층이 끝나는 자리가 아니다 (상한까지 올려도 2.92 / 2.93 으로 그대로였다).
    //     즉 "층의 끝을 옅게" 하는 손잡이가 이 셰이더에 아직 없다.
    // ⚠⚠ **mix 다.** 가산(c += )은 255 에서 잘려 흰 덩어리가 된다 (후처리 블룸이 없다)
    // ⚠ 무릎 (v0.60, 시안) : clamp 는 dens ≥ 1/foamWhite(0.22) 에서 평평하게 포화한다 — 평평한 흰 칠이 되고 작은 골이 틈으로 증폭된다.
    //   1 − e^−x ≤ x 라 컬 경계 값이 늘지 않는다 (불변식 19). uFoamKnee 0 → mix(clamp(aF), …, 0.0) === clamp(aF)
    // ⚠ 곡면 명암 (v0.60, 시안) : 물의 톤 식 hc 와 그림자 shLit 그대로 uMid 쪽으로만 누른다 — 밝게는 안 한다 (불변식 14 · 15).
    //   uFoamShade 0 → fSh 0 → mix(uFoamCol, uMid, 0.0) === uFoamCol. ⚠ 밤에는 uMid 가 어두워 너무 가라앉을 수 있다
    // ⚠ v0.61 : × dP (군집) · 최대 불투명도 × mix(1.0, uFoamUnderA, uFoamUnder) (은은하게). 둘 다 되돌리기 값이면 × 1.0
    float aF  = pat * kF * dP;
    float fSh = uFoamShade * max(1.0 - smoothstep(0.45, 1.0, hc), 1.0 - shLit);
    c = mix(c, mix(uFoamCol, uMid, fSh), mix(clamp(aF, 0.0, 1.0), 1.0 - exp(-aF), uFoamKnee) * mix(1.0, uFoamUnderA, uFoamUnder));
  }

  // ── 선체 접촉 거품 ────────────────────
  // 사용자 : *"배와 파도·바다가 만나는 지점에 흰색 거품 띠가 생김. 이전에 앞부분에서
  //   파도 거품 나듯이 **한 cell 크기 정도로 작게** 배와 바다가 맞닿는 부분에."*
  //
  // ⚠⚠ **이 블록은 위의 if (kF > uFoamCull) 밖이다. 그게 요점이다.**
  //   안에 넣으면 dens = 나이 × 높이 × 앞뒤 를 통째로 상속하는데, 그건 "해석적 너울이
  //   부서지기로 결정한 자리"다. 잔잔한 물에서 배가 지나가도 접촉 거품이 안 난다 —
  //   요구의 정반대다. 대가는 worley 를 새로 뜨는 것이고, 그래서 두 겹으로 자른다.
  //
  // ⚠⚠ **무늬 좌표는 vMat(재질)이고 띠는 vW(월드)다. 둘을 섞지 않는다.**
  //   배가 x=z=0 고정이라 띠는 선체에 붙고, 너울 위상이 나아가므로 물결이 고정된 띠를
  //   **통과해 뒤로 흘러간다.** 이게 이 층이 '도장' 이 안 되는 이유다.
  //   띠를 vMat 으로 옮기면 배에서 떨어져 나가고, 무늬를 vW 로 옮기면 화면에 못 박힌다.
  float dbgHullD = 9.0, dbgHullB = 0.0, dbgHullK = 0.0;   // 검증 보기 13 (분기 밖)

  // ⚠ 바깥 껍질. dB 는 위에 **이미 있다** — 비교 하나로 화면 대부분이 여기서 끝난다.
  //   "거리를 해시 뜨기 전에 접는다" 는 규율을 한 단 더 바깥으로 민 것이다.
  //   ⚠ dB 는 3D 거리이고 uBoatPos.y 에 reflectRise 가 섞여 있으므로 CPU 가 여유를 얹는다
  if (uHullAmt > 0.0 && dB < uHullG.z) {
    // ── ① 흘수선 = **기울인 타원**. 실제 선체는 최대폭이 중앙보다 뒤에 있어서
    //   대칭 타원으로는 안 맞는다. 항 하나(uHullTaper)로 그 치우침을 준다.
    // ⚠⚠ **부호.** uBoatDir 은 뱃머리 월드 방향이다 (진행 방향 = 로컬 −z, 불변식 0-2).
    //   뒤집으면 뚱뚱한 쪽이 뱃머리로 가서 띠가 옆구리·선미에 링으로 뜬다.
    // ⚠ uContactSize(그림자 발자국)를 빌려 쓰지 않는다 — 그건 P.contactSize 에서 파생돼
    //   묶는 순간 **그림자 슬라이더가 거품 기하를 움직인다.**
    vec2  hrel = vW.xz - uBoatPos.xz;
    vec2  hF   = uBoatDir, hR = vec2(hF.y, -hF.x);   // hR = 로컬 −x = 좌현
    float hfw  = dot(hrel, hF);          // + = 뱃머리 (월드)
    float hsd  = dot(hrel, hR);          // + = 좌현   (월드)
    float hn   = hfw * uHullG.x;
    float hw   = hsd * uHullG.y;
    // ⚠⚠ **발산 가드.** taper 는 hn 이 크면 부호가 뒤집힌다 — 발자국 밖까지 프래그먼트가
    //   돌므로, 이게 없으면 뱃머리 앞에 거울 대칭 유령이 하나 더 선다
    float htpr = 1.0 - uHullTaper * hn;
    float htp  = max(htpr, 0.15);
    // ⚠⚠ **클램프가 걸린 자리는 좌표가 퇴화한다** (2026-09-06). 부호 뒤집힘만 막고 끝냈는데
    //   그걸로 부족했다 : htp 가 0.15 로 눌리면 hwt = hw/0.15 가 커지고, 아래 해석적 기울기의
    //   taper*hwt²*hti 항이 **폭발**한다. hd = (he−1)/|기울기| 이므로 hd 가 0 으로 내려앉아
    //   **뱃머리 앞의 넓은 영역이 통째로 '흘수선 위' 로 읽힌다.**
    //   사용자가 값을 올렸을 때 배 둘레에 생긴 **원반과 그 뚜렷한 테두리**가 이것이다 —
    //   테두리의 정체는 바깥 껍질(dB < uHullG.z)이 그 유령을 자른 자리다.
    //   실측 : 껍질을 4.85 → 30 으로 열면 층 픽셀이 19,789 → **634,198** 로 폭발하고
    //          경계 세기가 12.4 → 4.2 로 떨어진다. 잘린 것이 맞다는 증거다.
    //   ⚠ 그래서 퇴화 구간을 **밖으로 간주한다.** 딱 자르지 않고 smoothstep 으로 넘긴다 —
    //     step 으로 자르면 이번엔 그 자리에 새 경계선이 생긴다.
    float hvalid = smoothstep(0.15, 0.45, htpr);
    float hti  = 1.0 / htp;
    float hwt  = hw * hti;
    float he   = sqrt(hn * hn + hwt * hwt);          // he = 1 이 흘수선

    // ── ② 등고선을 **월드 거리로 편다.** 이걸 빼면 안 된다.
    // ⚠⚠ he 의 등고선 간격은 옆구리에서 b, 뱃머리에서 a 월드다 — 4배 넘게 차이 난다.
    //   |he−1| 로 바로 띠를 만들면 뱃머리·선미가 그만큼 두꺼운 링이 되고, 사용자가 요구한
    //   "한 cell 크기" 가 자리마다 달라진다. 해석적 기울기로 나눠 폭을 균일하게 만든다.
    // ⚠ fwidth 를 쓰지 않는다 — 여기는 비균일 제어 흐름이고 그 안의 미분은 GLSL 미정의다
    //   (pw/matPx 를 분기 밖에 둔 이유가 그것이다)
    float hes  = max(he, 1e-4);          // ⚠ 정중앙 0/0 로 그 텍셀이 띠로 살아나는 것을 막는다
    // ⚠⚠ **테이퍼 항을 가둔다** (2026-09-06). 안 가두면 옆으로 멀어질 때 hwt² 이 거리의
    //   제곱으로 커져 |기울기| 가 거리에 비례해 자라고, 그러면 hd = (he−1)/|기울기| 가
    //   **상수로 수렴한다** (실측 약 1.30). 그 상수가 띠 안에 들어가면 띠가 **옆으로 영원히
    //   끝나지 않는다** — 도달반경을 4.85 → 30 으로 열 때 픽셀이 포화하지 않고 계속 늘던
    //   것이 그것이다 (18,993 → 39,769, 선형). 그걸 바깥 껍질이 자르면 그게 곧 테두리다.
    //   ⚠ 이 보정은 원래 **등고선 근처에서만** 유효한 근사다. 4.0 = |hwt| 2 까지, 즉 반폭의
    //     두 배까지는 정확하고 그 밖은 자연히 커지게 둔다.
    vec2  hgr  = vec2((hn + uHullTaper * min(hwt * hwt, 4.0) * hti) * uHullG.x,
                      (hwt * hti) * uHullG.y) / hes;
    float hd   = (he - 1.0) / max(length(hgr), 1e-5);   // + = 선체 밖, **월드 단위**

    // ── ③ 띠. '심 + 무릎' (배 그림자와 같은 감쇠 성격)
    // ⚠ 화면 한 픽셀보다 얇아지지 않게 바닥을 깐다. matPx 는 **분기 밖**에서 떴다 —
    //   여기서 값을 읽는 것은 안전하다 (금지된 것은 분기 안에서 미분을 뜨는 것이다)
    // ⚠⚠ **국소 침수 깊이를 여기서 먼저 낸다** (2026-09-06). 예전에는 아래 게이트에서만
    //   썼는데, 사용자 요청으로 **띠 폭**도 이 값을 봐야 해서 위로 끌어올렸다. 계산은 그대로다.
    // ⚠⚠ uBoatPos.y 를 쓰면 안 된다 — 거기엔 reflectRise(반사 아트 손잡이)가 더해져 있어서
    //   쓰면 반사 슬라이더가 흘수선을 조용히 옮긴다. uBoatY 는 날것의 pivot 높이다.
    // ⚠ 자세 항은 **라디안**이다. 나누지 않는다 (v0.14.1 에서 단위를 바로잡았다).
    float hdep = (vW.y - uBoatY) - hfw * uHullTilt.x + hsd * uHullTilt.y;
    // 0 = 선체가 물에서 떨어졌다 · 1 = 충분히 잠겼다 (세기 게이트용, 창이 좁다)
    float himm = clamp(hdep / max(uHullG.w, 1e-3), 0.0, 1.0);
    // ⚠⚠ **폭에는 창이 넓은 별도의 값을 쓴다.** himm 은 hullLapW(0.12)로 정규화하는데
    //   평상시 hdep 이 공칭 흘수(약 0.24)라 **이미 1 로 포화**한다 — 그걸로 폭을 재면
    //   평소에 항상 최대 폭이고 '커지는' 쪽 여지가 없다 (실측으로 띠가 2배가 됐다).
    //   ⚠ **공칭 흘수(uHullT.w)의 2배로 정규화한다** → 평상시 0.5 = 배율 1.0 이 되어
    //     기본 폭이 안 변하고, 위아래 양쪽으로 여지가 생긴다. 이것도 상수가 아니라
    //     boatLift 에서 파생된 값이다 (불변식 2).
    float hgro = clamp(hdep / max(uHullT.w * 2.0, 1e-3), 0.0, 1.0);

    // ⚠⚠ **띠 폭이 침수 깊이를 따라간다** (2026-09-06). 사용자 : *"파도가 커져서 선체가
    //   파도와 멀어지는 경우가 생기는데, 이런 것도 계산해서 **거품 크기를 줄이고 크게**."*
    //   물리적으로 맞다 : 거품은 선체가 물을 가르며 밀어낸 공기가 만드는 것이라, 닿아 있지
    //   않으면 애초에 만들어질 것이 없다. 파도 마루가 선체를 때리면 반대로 넓게 인다.
    //   ⚠ 세기 게이트(hlap)와 **다른 일**이다. 세기만 낮추면 같은 크기의 띠가 흐려질 뿐이고,
    //     '거품이 줄었다' 가 아니라 '거품이 희미하다' 로 읽힌다. 크기를 같이 움직여야 한다.
    //   ⚠⚠ **uHullSwell = 0 이 비트 단위 롤백이다** — 괄호가 정확히 1.0 이 된다.
    //   ⚠ matPx 바닥은 그대로 둔다. 줄어들어도 화면 한 픽셀보다 얇아지면 반짝인다.
    float hbw   = max(uHullBand * (1.0 + uHullSwell * (hgro * 2.0 - 1.0)), matPx * 1.1);
    // ⚠⚠ **안팎을 비대칭으로 잰다** (2026-09-06). 사용자 : *"선체가 기울어지면서 살짝씩
    //   그 띠가 심하게 보이는데, **안쪽으로 방사형으로 그라데이션식으로 옅게**"*.
    //   예전에는 abs() 라 안팎이 대칭이었다 — 흘수선 양쪽에서 똑같이 끊겨서, 배가 기울면
    //   그 딱딱한 경계가 통째로 움직이는 것이 눈에 띄었다.
    //   hd 는 이미 **부호가 있는 월드 거리**(+ 바깥 / − 안쪽)다. 안쪽 거리만 uHullInner 배로
    //   '천천히' 세면 같은 문턱까지 더 멀리 가므로, 선체 안쪽으로 길게 번져 들어간다.
    // ⚠ 새 필드가 아니다. 이미 있는 hd 를 다르게 읽을 뿐이라 **해시·페치 0회, 산술 3개**다.
    // ⚠⚠ **uHullInner = 1.0 이 비트 단위 롤백이다** (0 이 아니다) — 1 이면 hout + hin 이
    //   정확히 abs(hs) 와 같다. 슬라이더 하한을 0 으로 열어 두면 안쪽이 무한히 번진다.
    float hs    = hd - uHullPush;                  // + 바깥 · − 안쪽
    // ⚠⚠ **방사형 페이드를 바깥·안쪽 따로 준다** (2026-09-06). 사용자 : *"방사형 투명도를
    //   2개 설정해서 외곽에도 내부에도 동시에 그런 표현이 가능한가?"* — 가능하고, 곱 하나다.
    //   배율이 **작을수록** 그 쪽 전이가 **길어진다** (같은 문턱까지 더 멀리 가므로).
    //   ⚠ 둘 다 1.0 이 비트 단위 롤백이다 (0 이 아니다).
    float hdist = max(hs, 0.0) * uHullOuter + max(-hs, 0.0) * uHullInner;
    float hband = (1.0 - smoothstep(hbw, hbw * 2.2, hdist)) * hvalid;

    // ── ④ 게이트 **둘.** ⚠ 셋이 아니다 — 게이트를 곱으로 쌓으면 몇 레벨로 죽는다.
    //   높이 띠를 일부러 뺐다. 접촉 거품은 "파도가 높은가" 가 아니라 "선체가 물에 닿아
    //   있는가" 로 나야 하고, 높이 띠는 이 블록이 kF 밖으로 나온 이유를 도로 무른다.
    //   ⚠ 둘 다 mix(1−amt, 1, ·) 로 바닥을 깔았다
    //
    // ⓐ 국소 흘수. ⚠⚠ **uBoatPos.y 를 쓰면 안 된다** — 거기엔 reflectRise(반사 아트
    //   손잡이)가 더해져 있어서, 쓰면 반사 슬라이더가 흘수선을 조용히 옮긴다.
    // ⚠⚠ 피치·롤이 지금까지 셰이더에 하나도 안 들어왔다 (uBoatDir 은 yaw 뿐).
    //   보정항이 아니라 지배항이다 — 몇 도만 기울어도 뱃머리 국소 흘수가 크게 움직인다.
    // ⚠ hdep · himm 은 **위 ③ 에서 이미 냈다** (띠 폭이 먼저 써야 해서 올렸다). 재계산 없음
    float hlap = mix(1.0 - uHullLap, 1.0, himm);
    //
    // ⓑ ⚠⚠ **이 항이 사용자가 말한 '충격' 이다.** 상수를 칠하면 가장자리가 딱딱한 도장이 된다.
    //   심해 중력파에서 수면의 시간 변화율은 −(위상속도)×(진행 방향 기울기) 이므로
    //   **−sdir 이 곧 물이 올라오는 속도**다. sdir 은 위에 이미 있고 주석이 "비용 0" 이라 못박았다.
    // ⚠ 정규화 상수를 셰이더에 적지 않는다 (불변식 2). uFoamFaceS 를 나눠 쓴다 —
    //   앞뒤 창이 같은 식으로 쓰는 **기존** 유니폼이다. 새 상수도 새 유니폼도 안 만든다
    float hrise = -sdir / max(uFoamFaceS, 1e-4);
    float hhit  = mix(1.0 - uHullHit, 1.0, smoothstep(0.0, 1.0, hrise));

    // ── ⑤ 꼬리(기억). ⚠ **기본 0 이다.**
    //   trail 은 위에서 이미 뜬 지역변수라 **새 페치 0회**다. 이 채널은 sim.js 가 선체
    //   grip 으로 직접 쓰고, 감쇠시키고, 뒤로 흘린다 — 기억과 이류가 이미 돈다.
    //   ⚠ 기본 0 인 이유 : 그 자리는 이미 항적 층이 차가운 회청으로 칠하고 있다.
    //     두 층이 같은 자리에 다른 색으로 서는지 눈으로 보고 켠다.
    float hlane = 1.0 - smoothstep(uHullT.z, uHullT.z * 2.0, abs(hw));
    float htail = smoothstep(uHullT.y, 0.30, trail) * hlane * uHullT.x;

    // ⚠ max 다. 띠와 꼬리를 **곱하면** 게이트가 넷이 되어 몇 레벨로 죽는다.
    //   둘은 옆구리에서 겹치고, 그 겹침이 이음매를 덮는다
    float hmask = clamp(max(hband * hlap * hhit, htail), 0.0, 1.0);
    // ⚠⚠ **최적화 경계는 반드시 0 에서 만나야 한다** (불변식 19, 2026-09-06).
    //   위의 바깥 껍질(dB < uHullG.z)은 **하드 if** 다. 지금은 띠가 스스로 그 전에 끝나지만,
    //   그건 파라미터가 우연히 그런 것이고 사용자가 값을 올리면 언제든 다시 잘린다 —
    //   실제로 그래서 배 둘레에 원반 테두리가 보였다.
    //   그래서 **껍질 자체에 앞치마를 댄다.** 이 항이 있으면 경계에서 값이 남는 것이
    //   구조적으로 불가능하다. 산술 두 개고 해시·페치는 0 이다.
    // ⚠ 0.75 는 앞치마의 폭이다 (도달반경의 마지막 25%에서 0 으로 간다).
    float hReach = 1.0 - smoothstep(uHullG.z * 0.75, uHullG.z, dB);
    float kH    = hmask * uHullAmt * vDetail * hReach;
    dbgHullD = hd; dbgHullB = hband; dbgHullK = kH;

    // ⚠⚠ **픽셀별 조기 탈출.** 여기까지 해시 0 · 페치 0 · 미분 0 이고, 아래가 해시 13회다.
    // ⚠ **자르는 식(kH)과 칠하는 식이 같아야** 문턱을 올려도 칼자국이 안 생긴다
    if (kH > uHullCull) {
      dbgCost += 13.0;                  // vnoise2(4) + worleyF12(9)

      // ── ⑥ 무늬 : **기존 흰 거품과 글자 그대로 같은 좌표·같은 워프다.**
      //   세포 크기가 uFoamCell 에서 나오므로 사용자가 그 값을 만지면 **같이 따라온다.**
      //   ⚠ 여기에 숫자를 다시 적으면 그 순간 두 자가 갈라진다 (불변식 2)
      // ⚠⚠ **워프를 반드시 같이 뜬다.** worley 의 벽은 수학적으로 직선이고 굵은 그물은
      //   워프 위에서 뜨므로 휘어 있다. 워프 없이 뜨면 같은 격자인데 **벽만 다르게 휘어**
      //   두 층이 만나는 자리에 재질 이음매가 그대로 남는다
      // ⚠⚠ **선체 띠만의 흐름 배율** (2026-09-06). 사용자 요청으로 따로 뗐다.
      //   ⚠ 원래 일부러 파도 거품과 **같은 값**을 썼다 : 선체 띠와 파도 거품은 배 옆구리에서
      //     겹치는데, 둘이 다른 속도로 흐르면 그 경계에서 두 무늬가 서로 미끄러져
      //     **재질이 갈라진 것처럼** 보인다. uHullDrift 가 1 에서 멀어질수록 그 이음매가 드러난다.
      //   ⚠ **uHullDrift = 1 이 비트 단위 롤백이다** (0 이 아니다) — 0 은 무늬를 물에 고정한다.
      //   ⚠ 곱셈 하나다. 해시·페치 0회.
      vec2  hm  = vMat - uSwellDir * (uFoamDrift * uHullDrift * uWaveSpeed * uTimeQ);
      vec2  hTn = vec2(-uSwellDir.y, uSwellDir.x);
      vec2  hq  = vec2(dot(hm, hTn) / max(uFoamStretch, 0.2), dot(hm, uSwellDir)) * uFoamCell;
      vec2  hnz = vnoise2(hq * 0.85 + 17.3);            // 굵은 그물과 **같은 워프**
      vec2  hwl = worleyF12(hq + hnz * uFoamWarp);      // 같은 세포, 같은 자리

      // 재질 손잡이를 전부 기존 것에서 빌린다 — 새 파라미터를 다섯 개 안 만든다
      float hpx = matPx * uFoamCell * 1.4 * uFoamAA;
      float ht  = mix(uFoamThin, uFoamThick, hmask) * (1.0 + uFoamRough * (hnz.x + hnz.y));
      float hEg = uFoamEdge + hpx * 0.6;
      // ⚠ px 가 커지면 1−smoothstep 은 평균 피복률이 아니라 **1(전면 백색)** 로 간다.
      //   흰 종이 위 백색은 선을 지운다 (불변식 14). 해석적 평균으로 수렴시킨다.
      //   ⚠ 전이 창은 굵은 그물과 **같다.** 다르게 두면 두 층 사이에 두 번째 전이 띠가 생긴다
      float hsf = smoothstep(0.30, 2.60, hpx);
      float hpt = mix(1.0 - smoothstep(ht, ht + hEg, hwl.y - hwl.x),
                      clamp((ht + hEg * 0.5) * 2.2, 0.0, 0.92), hsf);
      // ⚠⚠ **알갱이는 F1 이고, 이 worley 가 이미 낸 값이다 — 추가 해시 0회.**
      //   기존 굵은 그물은 wA 를 받아 wA.y − wA.x 만 쓰고 **wA.x 를 버린다.** F1 은 세포
      //   중심에서 0 이라 낮은 문턱을 걸면 정확히 **한 세포 크기**의 둥근 알갱이가 남는다 —
      //   사용자의 "한 cell 크기 정도로 작게" 가 이 필드다.
      //   ⚠ 벽(F2−F1)이 아니다. ⚠ 더하기가 아니라 max 다 (합은 흰 덩어리로 포화한다).
      //   ⚠ uHullBead = 0 이면 max(hpt, 0.0) 이 hpt 와 같다 — 알갱이만 비트 단위로 따로 끈다
      hpt = max(hpt, (1.0 - smoothstep(0.30, 0.30 + hEg, hwl.x)) * uHullBead * (1.0 - hsf));
      // ⚠ mix 다. 가산은 255 에서 잘려 흰 덩어리가 된다 (후처리 블룸이 없다)
      c = mix(c, uFoamCol, clamp(hpt * kH, 0.0, 1.0));
    }
  }

  // ── 반짝임 거품 (v0.12.1) — 무늬가 아니라 **빛**으로 그리는 거품 ────────────────
  //
  // 사용자 : *"빛·반짝임 패널의 specAmount / glitter / glitterCell 이 오히려 더 파도 거품처럼
  //   표현할 수 있을 것 같다. 그걸 새롭게 만들어 더 좁게 뭉쳐서, specAmount 가 천천히
  //   상승하며 파도가 높아질 때 생성되고 뒷부분으로 거의 흐르지 않게."*
  //
  // ⚠⚠ **이 층에는 기억이 없다. 그게 요구의 핵심이다.**
  //   위 흰 거품(.w 채널)이 뒤로 흐르는 것은 무늬를 잘못 골라서가 아니라 **구조** 때문이다 —
  //   기억은 제자리에서 삭는데(초당 0.474) 마루는 cp 로 나아가므로, 반감기 동안 마루가
  //   0.40 파장 앞선다. 어떤 무늬를 써도 꼬리가 남는다.
  //   높이의 **순수 함수**로 만들면 마루가 지나가는 순간 같이 사라지므로 뒤에 못 남는다.
  //   ⚠ 대가는 정직하게 : **부서진 자리가 기억되지 않는다.** 불변식 0 이 경고하는 그것이다 —
  //     아름다운 무늬로는 보여도 "여기서 부서졌다" 는 **장소로는 안 읽힌다.**
  //     장소가 필요해지면 .w 를 이 층의 **세기 바닥**으로만 되살린다. 무늬로 쓰지 않는다.
  //
  // ⚠ 왜 이게 흰 무늬보다 거품처럼 읽히는가 : 흰 종이 위에서 백색은 선을 지운다(불변식 14).
  //   반면 정반사는 **면의 각도가 맞는 조각만** 골라 빛나므로, 같은 밝기를 써도 면이 아니라
  //   알갱이가 된다. 실제 백파가 흰 이유도 기포 표면이 빛을 여러 번 되쏘기 때문이다.
  //
  // 세 겹이다 : ① 높이 게이트(천천히 상승) · ② 뭉침 마스크(좁게) · ③ 알갱이(반짝임)
  // 롤백 : uSparkAmt = 0 → 이 층만 정확히 꺼진다.
  if (uSparkAmt > 0.0005) {
    // ── ① 높이 — "파도가 높아질 때 생성된다". 창이 넓을수록 천천히 오른다.
    // ⚠ h 는 p10 0.151 / p50 0.467 / p90 0.793 이다 (2026-09-06 실측). 창을 0.9 위에만 두면
    //   면적이 거의 안 남는다 — 불변식 13 의 "한 번도 그려진 적이 없는 백색" 이 그 실패다.
    // ⚠ smoothstep 만으로는 문턱을 넘는 순간 확 켜진다. pow 로 한 번 더 눕혀야
    //   "**천천히** 상승" 이 된다 (uSparkRise 1 = 선형, 클수록 늦게 붙는다).
    float sH1 = max(uSparkH1, uSparkH0 + 1e-3);
    float gH  = pow(smoothstep(uSparkH0, sH1, h), max(uSparkRise, 0.05));

    // ── ② 보라 쪽 — 뒤로 안 흐르게 하는 두 번째 장치이자, **오로라와 자리를 맞추는 장치**다.
    // ⚠⚠ 사용자 : *"오로라 표현했을 때 **보라색 부분인 쪽에 파도 거품이 몰려** 지나가야 함"*.
    //   보라는 아래 마루선 블록의 faceL < 0.5, 즉 dirf < uCrestBias 다.
    //   예전에는 여기서 **정규화 안 한 sdir 을 따로** 쓰고 bias 도 따로여서 (uSparkFaceB)
    //   두 층이 **서로 다른 자리**에 앉았다 — 거품과 보라가 같이 안 다녔다.
    //   이제 같은 식을 쓴다. uCrestBias / uCrestFace 를 옮기면 거품도 따라간다.
    // ⚠ uSparkFaceW 는 그 갈림을 얼마나 **부드럽게** 따를지다 (uCrestFace 에 곱해진다).
    //   거품은 선이 아니라 **면**이라 1.0 으로 두면 능선에 칼자국이 생긴다 — 낮게 둔다.
    float faceS = clamp((dirf - uCrestBias) * uCrestFace * uSparkFaceW * 0.5 + 0.5, 0.0, 1.0);
    float sFace = mix(1.0 - uSparkFace, 1.0, 1.0 - faceS);   // faceS 0(보라) → 1

    // ⚠⚠ **픽셀별 조기 탈출** (2026-09-06). 위 gH·sFace 는 해시가 0 이라 공짜인데,
    //   아래 두 값 노이즈는 **해시 8회**다. 예전에는 uSparkAmt 라는 **유니폼** 조건뿐이라
    //   그 8회가 **물 전체**에서 돌았다 — 화면에 0.7% 만 그리면서.
    //   사용자 : "GPU 사용량이 엄청 증가했는데" — 이런 자리가 그 답이다.
    //   ⚠ 문턱은 최종 세기 기준이다. uSparkCull 0.004 = 색이 0.4% 섞이는 자리 = 안 보인다.
    if (gH * sFace * uSparkAmt * vDetail > uSparkCull) {
    dbgCost += 8.0;                        // 뭉침 + 알갱이, 값 노이즈 2회

    // ── ③ 좌표. uSparkDrift = 1 → 마루와 같은 속도(위상속도) · 0 → 물에 붙는다.
    // ⚠⚠ **월드(vW.xz)가 아니라 재질 좌표(vMat)다.** 월드에 붙이면 물이 그 밑으로 흘러
    //   화면에 못 박힌 **도장**이 된다 (CLAUDE.md '하지 않는 것' 의 첫 항목).
    //   ⚠ 지금 glitter 는 vW.xz 를 쓴다 — 그래서 반짝임이 파도를 안 따라간다. 이 층은 다르다.
    vec2 smq = vMat - uSwellDir * (uSparkDrift * uWaveSpeed * uTimeQ);

    // 뭉침 마스크 — 저주파 값 노이즈를 문턱으로 잘라 **패치**를 만든다.
    // ⚠⚠ 이게 "더 좁게 뭉쳐서" 의 본체다. 없으면 화면 전체에 고르게 뿌려져
    //   '반짝이는 물' 이지 '거품' 이 아니다. 좁히려면 uSparkLo 를 **올린다**.
    vec2 cq = smq * uSparkClump;
    vec2 cif = floor(cq), cfr = fract(cq);
    cfr = cfr * cfr * (3.0 - 2.0 * cfr);
    float cn = mix(mix(hash2(cif).x,                  hash2(cif + vec2(1.0, 0.0)).x, cfr.x),
                   mix(hash2(cif + vec2(0.0, 1.0)).x, hash2(cif + vec2(1.0, 1.0)).x, cfr.x), cfr.y);
    // ⚠⚠ **hash2 는 [0,1] 이 아니라 [−0.5, +0.5] 를 돌려준다** (선언부 주석 참고). 게다가
    //   네 점을 보간하면 분포가 가운데로 몰려 전형값이 ±0.17 이다. [0,1] 인 줄 알고 0.44 로
    //   자르면 **한 번도 안 넘는다** — 실측으로 점유 0% 였다. 2.9배로 펴서 0~1 로 옮긴다.
    //   실측 : 이 정규화 뒤 문턱 0.5 가 면적의 약 절반을 켠다.
    float cnn = clamp(cn * 2.9 + 0.5, 0.0, 1.0);
    // ⚠ 창을 **좁게** 둔다. 넓으면 패치가 아니라 회색 감쇠기가 되어, 셋을 곱한 결과가
    //   화면 최대차 3레벨로 죽는다 (v0.11 의 '거품 게이트' 가 겪은 그 실패다).
    // ⚠⚠ **높이가 패치의 문턱을 민다** (2026-09-06). 사용자 : *"파도가 높아질 땐 거품이 몰려
    //   있기 때문에 **밀도가 높아지며 색상이 진해졌다가**, 파도가 사라질 땐 **같이 퍼지면서**
    //   사라지는데"*.
    //   ⚠ 세기(gH)만 높이에 묶으면 **같은 무늬가 밝아졌다 어두워질** 뿐이다. 문턱을 밀어야
    //     패치가 실제로 넓어졌다 조각으로 흩어진다 — 그게 '몰린다 / 퍼진다' 의 실체다.
    //   높은 마루 : 문턱 −dens (넓고 촘촘) · 낮은 곳 : 문턱 +dens (흩어짐). 0 = 예전 동작
    float dens = uSparkDens * (gH - 0.5);
    float cLo = uSparkLo - dens;
    float clump = smoothstep(cLo, max(uSparkHi - dens, cLo + 1e-3), cnn);

    // 알갱이 — glitter 와 **같은 식**이다 (불변식 15 : 빛의 식은 한 현상이다).
    // ⚠ 밝기 노이즈가 아니라 **법선 노이즈**다. 밝기로 뿌리면 물이 아니라 종이 위의 점이 된다.
    // ⚠ hash 도메인을 17 만큼 밀어 뭉침 마스크와 독립시킨다 — 같은 자리면 둘이 붙어
    //   패치 경계에만 알갱이가 서고, 그건 다시 '경계선' 이 된다 (직물이 된 그 실패다).
    // ⚠ (sn − 0.5) 로 **중심을 0 에 둔다.** 위 glitter 는 [0,1] 을 그대로 더해 법선을 한쪽으로
    //   미는데, 그러면 알갱이가 아니라 면 전체가 한 방향으로 기운다.
    vec2 pq = smq * uSparkCell;
    vec2 pif = floor(pq), pfr = fract(pq);
    pfr = pfr * pfr * (3.0 - 2.0 * pfr);
    vec2 sn = mix(mix(hash2(pif + 17.0),                  hash2(pif + 17.0 + vec2(1.0, 0.0)), pfr.x),
                  mix(hash2(pif + 17.0 + vec2(0.0, 1.0)), hash2(pif + 17.0 + vec2(1.0, 1.0)), pfr.x), pfr.y);
    // ⚠⚠ hash2 가 이미 **0 중심**이라 여기서 −0.5 를 빼면 안 된다. 뺐더니 법선이 상수만큼
    //   한쪽으로 밀려(−0.5 × jit) 하프벡터에 아예 안 맞았다 — 실측 점유 0%.
    //   ⚠ 위 glitter 는 gn 을 그대로 더한다. 같은 함수라 그쪽도 0 중심이다 (불변식 15).
    vec2 sgS = vGradW + microG * 3.0 + sn * uSparkJit;
    vec3 NsS = normalize(vec3(-sgS.x, 1.0, -sgS.y));
    float spS = pow(max(dot(NsS, Hv), 0.0), max(uSparkShine, 1.0));

    // ⚠ vDetail 을 곱한다. 원경에서 셀이 한 픽셀 밑으로 내려가면 형태가 아니라 끓는 점만 남는다
    float kS = spS * clump * gH * sFace * uSparkAmt * vDetail * shLit;   // ⚠ 그늘에서 죽는다
    c = mix(c, uApex, clamp(kS, 0.0, 1.0));
    }
  }

  // ⚠ 여기 있던 **마루 색(면)** 층을 걷어냈다 (v0.6.1).
  // 거품 위에 옅은 색을 면으로 깔던 층인데, 실측으로 더한 색기가 **1.2** 였다 —
  // 사람이 겨우 알아채는 색차가 2~3 이니 인지 한계 아래다. 무리(halo)가 같은 일을
  // 색기 24.7 로 하고 있어서 그 아래 완전히 묻혔다.
  // 이력은 CHANGELOG v0.6.1 과 커밋 6537f87 → 259595e 에 남아 있다.
  // 같이 사라진 파라미터 : foamAmount, iriWater, crestH0~H3, crestWhite,
  //   auroraSpread, auroraFocus, auroraDark (9개).
  // ⚠ foamBlur / foamLo / foamHi 는 남는다 — 선의 거품 변조(fglow)가 fm 을 쓴다.

  // ── 마루 능선의 선
  //
  // 거품은 **덩어리 장**이라 아무리 다듬어도 얼룩이지 선이 안 된다. 선은 선인 소스에서
  // 나와야 한다 — 너울 방향 기울기가 0 을 지나는 자리가 곧 능선이다.
  // 8대역 합에서 나오므로 한 대역짜리 직선(옛 swellCrest)이 될 수 없고,
  // CPU 실측으로 **최장 53m 짜리 연속 곡선**이 있다 (카메라가 담는 폭이 12m).
  //
  // ⚠ dirf 는 골에서도 0 을 지난다. 높이(uLineH0~H1)로 마루만 고른다.
  // ⚠⚠ 이 선은 **어둡게** 그린다. 마루 꼭대기는 바탕이 222~228 이라 밝게 그릴 여지가
  // 아예 없다 (화면 최대 228). 밝은 심은 이 팔레트에서 물리적으로 불가능하다.
  // ⚠ 굵기는 fwidth 로 낸다 — 고정폭을 쓰면 원경에서 선이 사라지고 근경에서 뭉갠다.
  //   ad / fwidth(dirf) 가 곧 '능선까지 몇 픽셀인가' 다.
  // ⚠ 후처리 블룸이 없으므로 발광은 **좁은 심 + 넓고 옅은 무리** 로 흉내 낸다.
  if (uLineAmt > 0.0) {
    // 색 띠. 능선에서 멀어질수록 제곱으로 옅어진다 (v0.3.0 의 lat *= lat)
    float halo = 1.0 - smoothstep(0.0, pw * uLineW * uLineHalo, ad);
    halo *= halo;
    float tallL = smoothstep(uLineH0, uLineH1, h);
    // 실제로 부서지는 자리에서만 진해진다 (거품 = 기억을 가진 층)
    // ⚠ 거품 변조의 원천 (v0.60, 시안) : 0 = fm (2.43초 평평하게 버티는 옛 곡선) · 1 = fmW (흰 거품과 같은 나이 곡선).
    //   비킨 뒤 흰 덩어리 둘레에 남는 오로라 테를 줄이는 손잡이. ⚠ 보기 6·7·8 의 fmD 는 가운데 탭 그대로라 이 시안에서는 본 경로와 다르다
    //   (보기 6·7·8 은 lineKeep 은 곱한다 — 비키기(lineYield)는 보기와 본 경로가 같다)
    //   uLineFoamSrc 0 → mix(fm, fmW, 0.0) === fm
    float fglow = 1.0 - uLineFoam * (1.0 - smoothstep(0.0, uLineFoamHi, mix(fm, fmW, uLineFoamSrc)));
    // 능선을 사이에 두고 보라 ↔ 블루. dirf = 0 이 곧 능선이라 둘이 거기서 만난다
    float faceL = clamp((dirf - uCrestBias) * uCrestFace * 0.5 + 0.5, 0.0, 1.0);
    // ⚠ 곱의 맨 끝에 × lineKeep (v0.60) — lineYield 0 이면 × 1.0 이라 비트 단위. 변수로 뺀 것은 같은 clamp 식이다 (검증 보기 14 가 읽는다)
    float kLine = clamp(halo * uLineAmt * tallL * fglow * vDetail * lineKeep, 0.0, 1.0);
    dbgLineK = kLine;
    c = mix(c, mix(uViolet, uBlue, faceL), kLine);

    // ── 두 색이 만나는 이음매 = 흰 발광.
    //
    // 예전에는 여기에 **어두운 심**을 그었다. 선으로는 읽혔지만 색을 먹었고
    // (실측 : 색기 10.5 / 어둡기 32.8), 무엇보다 파도에 안 어울리는 연필선이었다.
    // 지금은 같은 자리에 **백색**을 놓는다 — 두 색이 만나 흰빛이 되는 그림이다.
    //
    // ⚠ 블룸이 없으므로 '번지는 빛' 은 못 만든다. 대신 **좁고 아주 밝은 심 +
    // 넓고 옅은 색 띠** 라는 배치로 발광처럼 읽히게 한다.
    // ⚠ 흰 종이 위에서 백색은 '선을 지우는 것' 이다 (불변식 14). 그래서 면적을 좁게 두고
    // **높은 파도에서만** 밝아지게 한다 — uSeamH0~H1 이 그 게이트다.
    // ⚠ 정반사(sp)와 달리 노이즈가 없다. 이건 반짝임이 아니라 '두 색의 경계' 다
    float seamH = smoothstep(uSeamH0, uSeamH1, h);
    float seam = 1.0 - smoothstep(0.0, pw * uLineW * uSeamW, ad);
    seam *= seam;
    float kSeam = clamp(seam * uSeamAmt * seamH * fglow * vDetail * shLit * lineKeep, 0.0, 1.0);   // ⚠ × lineKeep (v0.60)
    dbgSeamK = kSeam;
    c = mix(c, uApex, kSeam);

    // ── 선택적 발광 (v0.7.1). **후처리 블룸을 대신한다.**
    //
    // 전체 화면 블룸은 이 바다에서 두 가지로 실패했다 :
    //   1. 문턱 창이 칼날이다 (0.85 → 화면 76% 날아감 / 0.955 → 아무 일도 없음).
    //   2. 밝기로는 이음매(248)와 물의 마루(240)를 **분리하지 못한다** —
    //      이음매·해백색을 다 꺼도 밝은 픽셀이 절반만 줄었다.
    // 그리고 1600×900 에서 3.05ms 였다 (물 전체가 4.35ms).
    //
    // ⚠ 핵심 : **발광원이 '능선까지의 거리' 라는 함수로 이미 알려져 있다.**
    // 그러면 그 번짐도 함수로 쓸 수 있다 — 프레임버퍼를 블러할 이유가 없다.
    // 가우시안이 곧 블룸의 커널이다. 비용은 exp 한 번이고, 물 밖으로는 절대 안 샌다.
    //
    // ⚠ 가산(+=)이 아니라 mix 로 얹는다. 가산은 255 에서 잘려 흰 덩어리가 된다
    // (CLAUDE.md '하지 않는 것'). 넓고 옅은 무리를 mix 로 겹치면 같은 인상을 준다.
    float gd = ad / (pw * uLineW * uGlowW);
    float glow = exp(-gd * gd);
    float kGlow = clamp(glow * uGlowAmt * seamH * fglow * vDetail * shLit * lineKeep, 0.0, 1.0);   // ⚠ × lineKeep (v0.60)
    dbgGlowK = kGlow;
    c = mix(c, uApex, kGlow);
  }

  // ── 물에 잠긴 선체.
  //
  // ⚠ 반사와 다르다. 반사를 화면 좌표로 읽으면 '도장' 이 되지만(불변식), 투과는
  // 물 밑의 선체가 **실제로 그 픽셀 뒤에 있으므로** 화면 좌표가 물리적으로 맞다.
  //
  // ⚠ 또렷하게 그리지 않는다. 파면이 잘게 기울어 광선이 흩어지므로 물 밑의 상은
  // 안 맺힌다. 그래서 읽는 좌표를 **파면 기울기로** 민다 — 파도가 흔들리면 상도 흔들린다.
  // 이건 '노이즈를 뿌려 그럴듯하게' 가 아니라 굴절 그 자체다 (uRefract 와 같은 이유).
  //
  // ⚠ 물 밑은 **더 차갑고 어둡다.** 종이배 색 그대로 얹으면 물 위에 뜬 것처럼 보인다.
  // ⚠⚠ **2026-09-06 : 이 블록에 거리 게이트가 없었다.** 조건이 uSubAmt 하나뿐인 **유니폼**
  //   분기라, 화면의 **모든 물 픽셀**이 텍스처 페치 + 해시 8회를 냈다 — 실제로 잠긴 선체가
  //   보이는 자리는 배 밑 수백 픽셀뿐인데도. 실측으로 화면 4,242,138 픽셀 중 물이 약 340만이다.
  //   ⚠ 이건 사용자가 말한 "GPU 소리가 장난이 아님" 의 지분이 큰 항이다.
  //   ⚠ 게이트는 **dB(배까지 거리)** 다 — 잠긴 선체는 정의상 배 근처에만 있다.
  //     uHullG.z(접촉 거품 도달반경)를 재사용하지 않는다. 그쪽은 흘수선에 붙는 얇은 띠라
  //     반경이 좁고, 잠긴 선체는 선체 전체가 화면에 퍼지므로 더 넓어야 한다.
  //   ⚠ uSubReach = 0 이면 게이트가 사실상 무한대가 되어 **예전 동작 그대로**다 (롤백).
  if (uSubAmt > 0.0 && (uSubReach <= 0.0 || dB < uSubReach)) {
    vec2 suv = (vProj.xy / vProj.w) * 0.5 + 0.5;
    // ⚠ 오프셋은 **uv 단위**다. 0.06 이면 1280px 화면에서 77픽셀을 민다 —
    // 상이 배에서 멀찍이 떨어져 뜨고, 그게 정확히 '도장' 이 되는 원인이다.
    // 굴절은 물 한 겹을 통과하는 흔들림이지 상을 옮기는 게 아니다. 몇 픽셀이면 충분하다
    suv += (vGradW + microG * 2.0) * uSubRefract;

    // ⚠⚠ **또렷하면 안 된다.** 물을 통해 보는 것이라 파면이 잘게 기울어 광선이 흩어지고,
    // 눈에는 조각난 상만 남는다. 반사(reflect)에서 쓰는 것과 같은 난반사를 여기도 쓴다 —
    // 월드에 고정된 노이즈로 좌표를 흩고, 세기는 국소 기울기가 정한다.
    // 흩어진 좌표가 선체 밖으로 나가면 알파가 0 이라 그 자리는 비어 버린다.
    // 그게 '상이 안 맺힌다' 의 실체다 : 조각이 남고 나머지는 물이 그대로 보인다.
    // ⚠ 세기를 기울기에 묶는다. 잔잔하면 형상이 드러나고, 파도가 서면 부서진다
    // ⚠⚠ **좌표가 월드(vW.xz)였다 — 그래서 상이 안 일렁였다** (2026-09-06).
    //   배는 월드 원점에 고정돼 있고 **물이 그 밑을 흘러간다** (카메라도 월드 고정이다).
    //   그러니 vW.xz 로 뜬 노이즈는 선체 위에서 **완전히 정지**한다 — 조각나는 자리가
    //   프레임마다 똑같아서, 굴절 오프셋만 움직이고 상은 얼어 있었다.
    //   사용자 : *"빛의 굴절로 바다 내부에 있는 실링보트가 **일렁거리는** 표현"*.
    //   ⚠ 재질 좌표(vMat)로 옮기면 노이즈가 **물과 같이 흐른다** — 물결이 지나갈 때마다
    //     조각나는 자리가 바뀌고, 그게 곧 일렁임이다. 물리적으로도 이쪽이 맞다 :
    //     굴절시키는 주체는 배가 아니라 **지나가는 물**이다.
    //   ⚠ CLAUDE.md '하지 않는 것' 이 반사에 대해 경고한 '도장' 과 같은 종류의 실수였다.
    vec2 sp2 = vMat * uSubCell;
    dbgCost += 8.0;              // ⚠ 잠긴 선체 : hash2 4회 × 2곳. 예전엔 안 세어졌다
    vec2 si = floor(sp2), sf = fract(sp2);
    sf = sf * sf * (3.0 - 2.0 * sf);
    vec2 sn = mix(mix(hash2(si),                 hash2(si + vec2(1.0, 0.0)), sf.x),
                  mix(hash2(si + vec2(0.0, 1.0)), hash2(si + vec2(1.0, 1.0)), sf.x), sf.y);
    // ⚠⚠ **hash2 는 이미 ±0.5 다** (161줄). 여기서 0.5 를 또 빼면 중심이 −0.5 로 밀려서
    //   굴절이 '흔들리는' 게 아니라 **한 방향으로 고정 이동**한다. 폭은 그대로고 자리만 틀린다.
    //   CLAUDE.md 에 같은 함정이 이미 적혀 있는데(반짝임 거품에서 겪었다) 이 두 줄이 남아 있었다.
    //   ⚠ 바로 아래 1108줄이 bn.x + 0.5 로 [0,1] 을 만드는 것과 대비된다 — 거기는 맞다.
    suv += sn * uSubScatter * clamp(0.25 + slope * uSubScatK, 0.0, 1.0);

    // ⚠ 흩는 폭을 **깊이에 따라 키운다.** 깊을수록 물을 더 두껍게 통과하므로 더 흩어진다 —
    // 그래야 경계가 딱 잘리지 않고 아래로 갈수록 번지는 그라데이션이 된다.
    // 그래서 두 번 읽는다 : 한 번은 깊이를 알려고, 한 번은 그 깊이로 흩어서
    float depA = texture2D(uSub, suv).a;
    float dep01 = 1.0 - depA;                     // 알파에 '얕음' 이 실려 있다
    suv += sn * uSubScatter * dep01 * uSubDeepBlur;   // ⚠ 위와 같은 이유로 −0.5 를 뺐다
    vec4 sub = texture2D(uSub, suv);
    // 알파가 곧 '거기 선체가 있는가' 다. 문턱을 높게 잡아 가장자리를 갉아먹는다 —
    // 오려낸 티가 사라지고 수면선 근처부터 조각으로 나타난다
    // 존재는 알파가 0 이 아닌 것으로 본다. 세기는 알파 그 자체 —
    // 수면 근처는 진하고 깊을수록 옅어진다 (경계가 아니라 그라데이션)
    float sa = smoothstep(0.02, max(0.06, uSubEdge), sub.a) * sub.a;
    // ⚠⚠ **좌표만 흩으면 상이 안 끊긴다.** 선체 안에서는 흩어도 여전히 선체를 집기 때문이다
    // (실측 : 난반사만 키우면 조각 평균이 3.9 → 15.2px 로 오히려 늘었다).
    // 끊으려면 **가시성 자체**를 노이즈로 갉아야 한다. 그래야 물이 사이사이로 보이고
    // '조각난 상' 이 된다. 파도가 셀수록 더 끊긴다
    // ⚠ 끊는 노이즈도 같이 옮긴다. 하나만 옮기면 흩어짐은 흐르는데 조각 경계는 정지해
    //   두 층이 서로 미끄러진다 (2.7 은 정수를 피한 배율 — 두 노이즈가 겹치지 않게)
    vec2 bp = vMat * uSubCell * 2.7;
    vec2 bi = floor(bp), bf = fract(bp);
    bf = bf * bf * (3.0 - 2.0 * bf);
    vec2 bn = mix(mix(hash2(bi),                 hash2(bi + vec2(1.0, 0.0)), bf.x),
                  mix(hash2(bi + vec2(0.0, 1.0)), hash2(bi + vec2(1.0, 1.0)), bf.x), bf.y);
    float brk = uSubBreak * clamp(0.3 + slope * uSubScatK, 0.0, 1.0);
    sa *= smoothstep(brk - 0.25, brk + 0.25, bn.x + 0.5);
    // ⚠⚠ 같은 규칙 (불변식 19). uSubReach 게이트는 **내가 이번에 넣은 하드 if** 라
    //   경계에서 상이 남은 채 끊길 수 있다. 지금 실측으로는 안 잘리지만, 배가 커지거나
    //   카메라가 바뀌면 잘린다. 구조적으로 막는다
    float subFar = uSubReach <= 0.0 ? 1.0 : 1.0 - smoothstep(uSubReach * 0.75, uSubReach, dB);
    c = mix(c, sub.rgb * uSubTint, sa * uSubAmt * vDetail * subFar);
  }

  // ── 마루의 백색 — '높아서' 흰 게 아니라 '높은 마루가 해를 향해서' 흰 것이다.
  //
  // v0.3.0(18368cb)에 있던 층인데, 마루 색을 거품 위로 옮기면서(6537f87)
  // 거품 두께가 게이트인 형태로 흡수됐고 그 뒤 실측으로 화면 점유가 0.00~0.01% 였다.
  // 사실상 한 번도 안 그려졌다. 별도 층으로 되돌린다.
  //
  // ⚠ 게이트를 정반사(sp)로 걸면 안 된다. sp 는 로브가 좁아(지수 110~120) 뜨는 자리가
  // 사면에 몰리는데 높이 조건과 거의 안 겹쳐 백색이 통째로 사라진다 (실측 점유 0%).
  // 그래서 노이즈 없이 지수만 낮춘 '넓은 햇빛' 항을 따로 쓴다 — 반짝임이 아니라
  // "이 면이 해를 향하고 있는가" 를 재는 값이다.
  // ⚠ 높이는 '해를 향한 면들 중 어디를 희게 할지' 만 고른다. 면적은 좁게 —
  // 흰 종이 위에서 백색은 곧 '선을 지우는 것' 이라, 넓으면 그림이 옅어지기만 한다.
  if (uApexAmt > 0.0) {
    vec3 Nw = normalize(vec3(-vGradW.x, 1.0, -vGradW.y));
    float sun = pow(max(dot(Nw, Hv), 0.0), uSunLobe);
    // ⚠ '높은 마루가 **해를 향해서**' 흰 것이므로 그늘에서 죽는 것이 맞다
    c = mix(c, uApex, smoothstep(uApexH0, uApexH1, h) * sun * uApexAmt * vDetail * shLit);
  }

  // ── 검증 보기 (개발 전용). 여기서 c 를 통째로 갈아엎고 끝낸다.
  //
  // ⚠ 이 바다는 흰 종이 위 흰 물이라, 층이 **어디에** 서 있는지를 최종 화면으로는
  // 판정할 수 없다. 실제로 거품이 마루와 90도 어긋나 있었는데 몇 커밋 동안 몰랐다.
  // 노멀맵처럼 채널을 과장된 원색으로 그려서 눈으로 바로 읽게 한다.
  // ⚠ 방향을 볼 때는 **위에서 내려다보는 구도**(topView)와 같이 써야 한다 —
  // 기본 카메라는 수면을 스치듯 봐서 마루선과 진행 방향이 화면에서 둘 다 수평으로 눌린다
  // (실측 : 마루선 175도, 너울 진행 14도 — 화면에서 19도 차이밖에 안 난다).
  if (uDebug > 0) {
    vec3 dc = vec3(0.0);
    float fmD = smoothstep(uFoamLo, uFoamHi2, texture2D(uH, vUv).w);
    // ⚠ 본 경로의 dirf 그대로다 (너울 기울기 · 분모 바닥) — 보기가 실제 마루선을 재현해야 한다 (S15P21E203-448)
    float dirD = dirf;
    if (uDebug == 1) {            // 노멀 : 면이 어디를 향하나
      vec3 Nn = normalize(vec3(-vGradW.x * 6.0, 1.0, -vGradW.y * 6.0));
      dc = Nn * 0.5 + 0.5;
    } else if (uDebug == 2) {     // 높이 : 골 파랑 → 마루 빨강
      dc = mix(vec3(0.05, 0.15, 0.75), vec3(0.95, 0.15, 0.05), h);
    } else if (uDebug == 3) {     // 거품 .w : 없으면 검정, 짙을수록 노랑
      dc = mix(vec3(0.02, 0.02, 0.06), vec3(1.0, 0.92, 0.15), fmD);
    } else if (uDebug == 4) {     // 앞뒤 면 : **앞(선단) 초록 / 뒤 자홍** (마루선에서 갈린다)
      // ⚠⚠ 옛 주석이 정반대였다 (2026-09-06 수정, 코드는 정상이다).
      //   dirD = −1 이 선단이고 mix 의 t = dirD*0.5+0.5 = 0 이므로 **초록이 선단**이다.
      //   뒤집힌 범례를 믿고 판정하면 제대로 고쳐진 화면이 실패로 읽히고, 그 처방이
      //   foamFaceBias 를 음수로 미는 것 — 사용자 요구의 정반대다.
      dc = mix(vec3(0.05, 0.85, 0.35), vec3(1.0, 0.1, 0.65), dirD * 0.5 + 0.5);
    } else if (uDebug == 5) {     // 항적 .z
      dc = mix(vec3(0.02, 0.02, 0.06), vec3(0.1, 0.9, 1.0),
               smoothstep(uWakeLo, uWakeHi, texture2D(uH, vUv).z));
    } else if (uDebug == 6) {     // 마루 색만, 섞지 않고 원색으로
      // 무리의 색만 배경 없이. 마루 색(면) 층은 v0.6.1 에서 걷어냈다
      float faceD = clamp((dirD - uCrestBias) * uCrestFace * 0.5 + 0.5, 0.0, 1.0);
      float adD6 = abs(dirD), pwD6 = max(fwidth(dirD), 1e-5);
      float hl6 = 1.0 - smoothstep(0.0, pwD6 * uLineW * uLineHalo, adD6); hl6 *= hl6;
      float fg6 = 1.0 - uLineFoam * (1.0 - smoothstep(0.0, uLineFoamHi, fmD));
      // ⚠ × lineKeep (v0.60) — 본 경로는 흰 거품 자리에서 비켜 칠하지 않는다. 안 곱하면 이 보기가 비킨 능선에도 무리를 그려 도구가 낡는다.
      //   lineYield 0 이면 × 1.0 이라 예전 판독과 같다
      dc = mix(vec3(0.03, 0.03, 0.07), mix(uViolet, uBlue, faceD),
               hl6 * smoothstep(uLineH0, uLineH1, h) * fg6 * lineKeep);
    } else if (uDebug == 12) {
      // ⚠⚠ **비용 지도 — 픽셀당 해시 수.** 층마다 **원색 한 가지**로 계단을 만든다.
      //   연속 램프로 그렸더니 색을 되읽어 해시 수로 역산하는 게 불안정했다 (얼린 장면인데
      //   집계 픽셀 수가 흔들렸다). 계단이면 정확히 셀 수 있다.
      //   ⚠⚠ 2026-09-06 에 **문턱을 다시 세웠다.** 예전 값은 틀린 청구서 위에 세워져 있었다.
      //     파랑  16 = 바닥 (glitter 8 + 잔결 워프 4 + **반사 흩기 4**) — 물 전체에서 돈다
      //     시안  24 = + 반짝임 거품 8   또는  + 잠긴 선체 8
      //     노랑  29 = + worley 굵은 그물 13
      //     주황  38 = + 잔 그물 9  ·  빨강 = 전부 (최대 **54**, 예전 표기 47 은 틀렸다)
      dc = dbgCost < 17.0 ? vec3(0.0, 0.0, 1.0)
         : dbgCost < 25.0 ? vec3(0.0, 1.0, 1.0)
         : dbgCost < 34.0 ? vec3(1.0, 1.0, 0.0)
         : dbgCost < 46.0 ? vec3(1.0, 0.5, 0.0)
         :                  vec3(1.0, 0.0, 0.0);
    } else if (uDebug == 13) {
      // ── 선체 접촉 거품. ⚠ CLAUDE.md : "새 층을 넣으면 검증 보기부터 만든다."
      //   흰 종이 위 흰 물이라 최종 화면으로는 이 층이 **어디에** 서 있는지 판정할 수 없다
      //   (거품이 마루와 90도 어긋난 채 세 커밋을 간 적이 있다). 반드시 항공뷰와 같이 본다.
      //   파랑 = 선체 안쪽 · 초록 = 띠 · 자홍 = 게이트까지 통과한 최종 세기
      dc = vec3(0.03, 0.03, 0.07);
      dc = mix(dc, vec3(0.00, 0.30, 1.00), step(dbgHullD, 0.0) * 0.5);
      dc = mix(dc, vec3(0.10, 1.00, 0.35), dbgHullB);
      dc = mix(dc, vec3(1.00, 0.15, 0.75), clamp(dbgHullK * 3.0, 0.0, 1.0));
    } else if (uDebug == 11) {
      // ⚠⚠ **잔결(microG) 만.** 2026-09-06 에 새로 만들었다 — 이 층에 검증 보기가 없어서
      //   사용자가 스크린샷에 **빨간 선을 손으로 그어** 격자를 지적해야 했다.
      //   불변식 : "새 층을 넣으면 검증 보기부터 만든다". 이 층은 v0.4 부터 있었는데 없었다.
      // 잔결의 기울기 방향을 색으로, 크기를 밝기로. **평행한 등간격 줄무늬가 보이면 격자다.**
      // ⚠ 반드시 topView 와 같이 본다 — 스치는 시선에서는 어느 방향이든 수평으로 눌린다.
      float mLen = length(microG);
      dc = vec3(0.5) + vec3(microG.x, 0.0, microG.y) * (0.5 / max(mLen, 1e-4)) * smoothstep(0.0, 0.05, mLen);
      // 정반사가 실제로 보는 비율 : 잔결×3 이 너울 기울기보다 크면 노랑으로 경고한다
      float share = mLen * 3.0 / max(length(vGradW), 1e-4);
      dc = mix(dc, vec3(1.0, 0.95, 0.1), smoothstep(0.9, 1.6, share) * 0.75);
    } else if (uDebug == 10) {
      // 군 포락선 : 잔잔 파랑 → 평균 회색 → 거친 빨강.
      // ⚠⚠ **반드시 topView 와 같이 본다.** 구역 하나(λ27 / λ43)가 화면보다 크다 —
      //   기본 카메라로는 "화면 전체가 같은 색"으로만 보여서 판정이 거짓말을 한다.
      // ⚠ 그리고 최소 30초는 본다. 정지 관측자 기준 군의 주기가 26 / 50 / 225 / 625초다
      float ev = clamp((vEnv - uEnvLo) / max(uEnvHi - uEnvLo, 1e-3), 0.0, 1.0);
      dc = vec3(ev, 0.30, 1.0 - ev);
    } else if (uDebug == 9) {
      // 거품 게이트. 빨강 = 기억(나이 곡선 fmW) · 초록 = 지금(높이 띠 × 앞뒤 = live) ·
      // 파랑 = 실제로 칠해지는 몫(dens). **흰/청록으로 겹친 자리가 실제 백파다.**
      // ⚠ 반드시 topView 와 같이 본다. 기본 카메라는 마루선과 진행 방향을 둘 다 수평으로
      //   눌러서 방향 판정이 거짓말을 한다 (거품이 90도 어긋난 채 세 커밋을 간 전례가 있다).
      // ⚠⚠ **빨강만 남으면** 기억이 안 죽는 것이고, **초록만 남으면** 게이트 아래에 칠할
      //   것이 없는 것이다. 후자가 이 설계의 가장 큰 위험이다 — fm 은 마루 **뒤**로
      //   치우쳐 있으므로 foamFaceBias(중심 옮기기)부터 본다. crestBias 와 같은 처방이다
      // ⚠⚠ 본 경로 변수를 그대로 읽는다 (v0.60) — 식을 다시 적었더니 foamFaceKeep 이 들어온 순간 도구가 낡았다.
      //   예전에는 '본 경로와 글자 그대로 같은 식' 을 여기 한 번 더 적어 두었다 (v0.11.4 에서 한 번 낡은 적이 있다)
      // ⚠ v0.60 부터 빨강은 **번진** fmW 다 (예전 : 번지기 전 가운데 탭). 그 전 보기 9 수치와 비교하지 않는다
      dc = vec3(fmW, live, dens);
    } else if (uDebug == 14) {
      // 겹침 (v0.60). 빨강 = 흰 거품 세기(무늬 전 foamStr) · 초록 = 마루선 무리 몫(비킨 뒤) ·
      //   파랑 = 흰 거품이 최종 화면에 남는 가중치 = 빨강 × (1 − 무리)(1 − 이음매)(1 − 발광) — mix 사슬의 정확한 몫
      // ⚠ 빨강과 파랑의 두 겹 수 차이가 곧 마루선 층이 가른 몫이다 (층을 끄지 않고 잰다 · 저녁 블루의 부호 함정이 없다)
      // ⚠ 흰 거품과 마루선 사이에 c 를 칠하는 층이 둘 있다 — 선체 접촉 거품 · 반짝임 거품. **hullFoam 0 · sparkAmount 0 에서만** 파랑이 정확하다
      // ⚠ 출력은 sRGB 로 인코딩된다 — 픽셀로 잴 때는 선형으로 되돌려 쓴다
      // ⚠ 픽셀로 되읽어 빨강 = 파랑 을 확인할 수 있는 것은 가까운 바다뿐이다 — 하늘 · 먼 페이드 픽셀은 출력이 채널별로 달라진다 (v0.60 재측정 : 영역의 약 29% 만 남았다).
      //   '갈라짐 + lineAmount 0' 보기의 |R − B| > 3 을 몇 px 넓혀 빼고 잰다. 먼 능선의 두 겹은 이 보기로 과소평가된다
      // ⚠ foamStr 는 이 블록 안에서만 계산한다 (본 경로 흰 칠의 무릎 식 mix(clamp(aF), 1 − e^−aF, uFoamKnee) 에서 무늬 pat 를 뺀 것) — main 최상위에 두면 수면 전체에서 exp 가 돈다
      float foamStr = mix(clamp(kF, 0.0, 1.0), 1.0 - exp(-kF), uFoamKnee);
      dc = vec3(foamStr, dbgLineK, foamStr * (1.0 - dbgLineK) * (1.0 - dbgSeamK) * (1.0 - dbgGlowK));
    } else if (uDebug == 15) {
      // 쇄파 무리 (v0.60). 파랑 = 부서질 수 있는 섬 (짙을수록 낮은 마루도 부서지는 자리) · 노랑 = 기억 fmD
      // ⚠ 노랑 덩어리의 머리가 파랑 섬 위에 앉아 있어야 한다. vMat == sim 의 wpos · 같은 uTimeQ · 같은 문자열. topView 필수
      // ⚠ 파랑은 foamClump 값과 무관하게 그린다 — 섬이 보이는데 노랑이 일자면 sim 유니폼(uFoamClump) 누락부터 의심한다
      float qD = foamClumpQ(vMat);
      dc = mix(vec3(0.02, 0.02, 0.06), vec3(0.10, 0.35, 1.00), (1.0 - qD) * 0.7);
      dc = mix(dc, vec3(1.0, 0.92, 0.15), fmD);
    } else {
      // ── 7 · 8 : 두 색을 **구역으로 나눠** 보고, 경계를 선으로 그린다.
      // 그라디언트로 섞여 있으면 "어디가 보라고 어디가 블루인지" 를 눈으로 못 가른다.
      // 평평한 두 색 + 아웃라인으로 바꾸면 형태와 경계가 그대로 드러난다.
      //
      // ⚠ 선 굵기는 fwidth 로 낸다. abs(face - 0.5) 에 고정폭을 쓰면 기울기가 급한 곳에서는
      // 선이 사라지고 완만한 곳에서는 뭉개진다 — 이 바다는 그 차이가 크다
      // ⚠ 이 보기는 **색을 실제로 지고 있는 층**을 봐야 한다. 색이 마루 색(사면)에서
      // 무리(꼭대기)로 옮겨갔으므로 게이트도 무리 것을 쓴다. 옛 게이트를 그대로 두면
      // 도구가 "색이 아래에서 논다" 는 낡은 그림을 계속 보여준다 (실제로 그렇게 헷갈렸다)
      float faceD = clamp((dirD - uCrestBias) * uCrestFace * 0.5 + 0.5, 0.0, 1.0);
      float adD = abs(dirD);
      float pwD = max(fwidth(dirD), 1e-5);
      float haloD = 1.0 - smoothstep(0.0, pwD * uLineW * uLineHalo, adD);
      float fglowD = 1.0 - uLineFoam * (1.0 - smoothstep(0.0, uLineFoamHi, fmD));
      // ⚠ × lineKeep (v0.60) — 보기 6 과 같은 이유. 흰 거품에 비킨 자리를 칠해지는 영역으로 그리지 않는다 (lineYield 0 → × 1.0)
      float gate = haloD * smoothstep(uLineH0, uLineH1, h) * fglowD * lineKeep;
      float wF = max(fwidth(faceD) * uDbgEdge, 1e-4);
      float wG = max(fwidth(gate) * uDbgEdge, 1e-4);
      float lineFace = 1.0 - smoothstep(0.0, wF, abs(faceD - 0.5));   // 두 색의 경계
      float lineGate = 1.0 - smoothstep(0.0, wG, abs(gate - 0.06));   // 칠해지는 영역의 테두리
      float inPaint = step(0.06, gate);
      if (uDebug == 7) {
        // 구역 : 배경은 어둡게, 보라 구역 / 블루 구역을 평평한 원색으로
        dc = mix(vec3(0.05, 0.05, 0.09),
                 faceD < 0.5 ? vec3(0.62, 0.30, 1.00) : vec3(0.10, 0.78, 0.95), inPaint);
        dc = mix(dc, vec3(1.0, 0.95, 0.2), lineGate);              // 노랑 = 영역 테두리
        dc = mix(dc, vec3(1.0), lineFace * inPaint);               // 흰선 = 두 색이 갈리는 자리
      } else {
        // 실제 화면 위에 선만 얹는다 — 지금 색이 어디에 어떻게 앉는지 맥락째로 본다
        dc = c;
        dc = mix(dc, vec3(0.95, 0.75, 0.05), lineGate * 0.9);
        dc = mix(dc, faceD < 0.5 ? vec3(0.55, 0.15, 0.95) : vec3(0.0, 0.55, 0.85),
                 lineFace * inPaint);
      }
    }
    gl_FragColor = vec4(dc, 1.0);
    #include <colorspace_fragment>
    return;
  }

  // ── 정반사를 마지막에 칠한다 (위 계산의 결과)
  c = mix(c, uApex, clamp(sp, 0.0, 1.0) * uSpecAmt * vDetail);


  // ── 근경 톤 그라데이션 ────────────────────────────────────────────────────
  // 사용자 : *"이제 카메라 값이 올라갔으니까 **그라데이션처럼 점점 어둡게** 해서
  //   밝게 표현이 가능한가?"*
  //
  // ⚠⚠ **그게 이 팔레트에서 유일하게 남은 손잡이다.** 하늘을 넣어도 물은 평균 +5.8 레벨밖에
  //   안 올랐다 — 배경이 246 이라 위로 올릴 여지가 없기 때문이다. 불변식 14 :
  //   *"흰 종이 위에서 밝게 = 선 지우기다."* 흰 돛이 밝아 보이게 하려면 **주변을 낮춘다.**
  //
  // ⚠ **가까운 쪽만 낮춘다.** 먼 쪽은 그대로 둔다 — 수평선이 배경으로 녹아드는 것이
  //   이 화면의 구성이고(uFade0/uFade1), 원경을 어둡게 하면 그 이음매가 드러난다.
  //   물리적으로도 이 방향이 맞다 : 발밑은 내려다보는 각이라 프레넬이 낮아 하늘이 적게 실리고,
  //   멀수록 스치는 각이라 하늘이 많이 실려 밝다. 프레넬 항이 하려던 일을 폭만 키운 것이다.
  // ⚠ 검정으로 곱하지 않고 **차가운 깊은 물색으로 섞는다.** 곱하면 채도까지 죽어
  //   종이에 뚫린 회색 구멍이 된다.
  // ⚠⚠ 처음에 uTrough 로 섞었더니 **거의 안 보였다** (근경 평균 204.0 → 200.6, 3레벨).
  //   바다 색 셋이 240·229·212 로 **28레벨 폭** 안에 다 들어 있어서, 그 안의 색으로
  //   섞는 한 그라데이션은 만들어지지 않는다. 그래서 CONFIG.color.seaDeep 을 따로 뒀다.
  // ⚠ uToneAmt = 0 이면 비트 단위 롤백.
  if (uToneAmt > 0.0) {
    float dv = length(vW.xz - uCam);
    float g = 1.0 - smoothstep(uToneDist.x, uToneDist.y, dv);   // 가까울수록 1
    c = mix(c, uToneCol, g * g * uToneAmt);
  }

  // ── 태양 반짝임 (HDR, 2026-09-25 · S15P21E203-435) — params.js 의 glint 묶음 주석
  // ⚠ 섞지 않고 **더한다** — 위 정반사(mix → uApex)는 금빛에서 멈추는 칠이라 빛이 못 된다 (화면 최댓값 1.16 · 블룸 문턱 1.40)
  // ⚠ 톤 그라데이션 **뒤**다 — 그 층은 물의 몸을 누르는 붓질이고, 빛까지 누르면 근경의 윤슬이 죽는다
  // ⚠ 가까이는 반짝임 법선(Ns — glitter 노이즈 포함), 멀리는 너울 법선만 — 원경에서 노이즈 알갱이가 화소 밑으로 내려가면
  //   윤슬이 아니라 끓는 점이 된다. 흔들림을 걷은 만큼 로브를 넓히고 봉우리를 낮춘다 ((n+2)/(n0+2) — 에너지 보존)
  if (uGlintAmt > 0.0) {
    float dG = length(vW.xz - uCam);
    float farG = smoothstep(uGlintDist.x, uGlintDist.y, dG);
    vec3 Ng = normalize(mix(Ns, normalize(vec3(-vGradW.x, 1.0, -vGradW.y)), farG));
    float nE = mix(uGlintShine.x, uGlintShine.y, farG);
    float lobe = pow(max(dot(Ng, Hv), 0.0), nE) * (nE + 2.0) / (uGlintShine.x + 2.0);
    // 프레넬 (Schlick, 물 F0 0.02) — 스치는 각일수록 더 비친다. 수평선 쪽 빛길이 여기서 선다
    float fr = 0.02 + 0.98 * pow(1.0 - clamp(dot(Ng, V), 0.0, 1.0), 5.0);
    // ⚠ 먼 빛길은 uGlintFarK 로 한 번 더 누른다 — 넓어진 로브가 통째로 블룸 문턱을 넘으면 배 뒤가 한 덩어리로 뿌옇게 번진다
    float kG = lobe * fr * mix(1.0, uGlintFarK, farG) * uGlintAmt * uGlintHot * shLit;   // ⚠ 배 그늘에서는 죽는다 (정반사 sp 와 같다)
    // 심은 주광색 흰빛, 약한 쪽은 해의 색 (시간대 — 저녁 복숭아 · 밤 달빛)
    c += mix(uSkySun, uGlintCore, smoothstep(uGlintWhite.x, uGlintWhite.y, kG)) * kG;
  }

  vec2 d = abs(vUv - 0.5) * 2.0;
  float vis = (1.0 - smoothstep(0.76, 0.98, max(d.x, d.y)))
            * (1.0 - smoothstep(uFade0, uFade1, length(vW.xz - uCam)));

  // ── 원경 안개 : 물이 사라진 자리는 **그 방향의 하늘색**이다 ([3단계], 2026-09-10)
  // ⚠ 여기는 템플릿 리터럴 안이다 — 주석에도 백틱을 쓰지 않는다 (실제로 한 번 죽였다).
  // ⚠⚠ 이 메시는 불투명하다 — vis 가 0 이어도 무언가를 칠한다. 예전엔 uBg 하나였는데
  //   하늘은 태양 로브 때문에 같은 자리에서 249~250 이라, **물 메시가 하늘 위에 3~4레벨
  //   어두운 판으로 떠 있었다.** 그 판의 경계는 UV 가장자리(정사각형)라 44px 출렁인다.
  //   [3단계] 산을 하늘에 그리면 그 선에서 잘리므로, 산보다 이걸 먼저 고친다.
  // ⭐ 스카이 스피어와 **같은 함수·같은 방향**이라 구조적으로 이어진다 (stage.js 의 vDir 도
  //   카메라→픽셀 방향이고, 여기 시선도 카메라→이 점이다). 갈라질 방법이 없다.
  // ⚠ uFadeSky 는 stageAmount 를 곱해서 들어온다 — 하늘을 끄면 자동으로 uBg 로 돌아온다.
  vec3 far = mix(uBg, skyColor(normalize(vW - cameraPosition), uLightDir3), uFadeSky);
  gl_FragColor = vec4(mix(far, c, vis), 1.0);
  #include <colorspace_fragment>
}`;

// ───────── 수면 메시 — 배 곁만 촘촘한 격자 (2026-09-27, S15P21E203-435 · 최적화) ─────────
// 이유와 실측은 config.js 의 sim.meshNear 주석. 모양은 THREE.PlaneGeometry 와 **정점 배치 규약이 같다** (XY 평면 · 위 행부터 · 같은 감김 ·
//   uv = 위치 / domain + 0.5) — 셰이더 · 시뮬 · 거품 조회가 uv 로 시뮬 텍스처를 읽으므로, uv 가 위치의 1차 함수인 한 격자 간격이 달라도 그대로 맞는다.
// 축 하나의 좌표 : 가운데(배)에서 meshNear 까지는 domain / seg 간격 그대로, 그 밖은 칸마다 meshGrow 배 — 끝(domain / 2)에 **정확히** 닿도록 배율을 풀어 맞춘다.
//   ⚠ 가로 · 세로를 따로 굽힌다 — 격자 모양(행 · 열)이 그대로라 인덱스도 그대로다. 대각선 먼 쪽은 두 축이 다 성기고 축을 따라 먼 쪽은 한 축만 성기다
//     (카메라가 그 축을 따라 볼 때 옆 간격은 촘촘하고 깊이 간격만 성기다 — 원경에서 깊이 쪽이 화면에 훨씬 빨리 눌리므로 맞는 쪽이다)
// ⚠ meshNear 가 반 변(domain / 2) 이상이면 예전 균일 격자 그대로 (PlaneGeometry — 비트 단위 롤백)
function meshAxis(D, seg, near, grow) {
  const R = D / 2, h = D / seg;
  const nIn = Math.max(1, Math.min(Math.round(near / h), Math.floor(R / h + 1e-9)));   // ⚠ 반올림으로 끝(R)을 넘지 않게
  const r0 = nIn * h;
  const rest = R - r0;
  const half = [];
  for (let i = 0; i <= nIn; i++) half.push(i * h);
  if (rest > 1e-6) {
    // 바깥 칸 간격 h·q¹ … h·qⁿ 의 합이 rest 가 되게 : n 은 grow 로 어림하고 q 를 이분법으로 맞춘다
    const g = Math.max(1.0001, grow);
    const n = Math.max(1, Math.ceil(Math.log(1 + rest * (g - 1) / h) / Math.log(g)));
    const sum = (q) => h * q * (Math.pow(q, n) - 1) / (q - 1);
    let lo = 1.0000001, hi = 2.0;
    for (let k = 0; k < 60; k++) { const m = (lo + hi) / 2; if (sum(m) > rest) hi = m; else lo = m; }
    const q = (lo + hi) / 2;
    let x = r0, s = h;
    for (let k = 1; k <= n; k++) { s *= q; x += s; half.push(k === n ? R : x); }
  }
  // 음수 쪽을 거울로 붙인다 — 가운데(0) 한 번
  const out = [];
  for (let i = half.length - 1; i > 0; i--) out.push(-half[i]);
  for (let i = 0; i < half.length; i++) out.push(half[i]);
  return out;
}
function waterGeometry(seg) {
  const S = CONFIG.sim, D = S.domain;
  const near = S.meshNear === undefined ? D : S.meshNear;
  if (near >= D / 2) return new THREE.PlaneGeometry(D, D, seg, seg);
  const xs = meshAxis(D, seg, near, S.meshGrow === undefined ? 1.04 : S.meshGrow);
  const n = xs.length, cells = n - 1;
  const pos = new Float32Array(n * n * 3), nrm = new Float32Array(n * n * 3), uv = new Float32Array(n * n * 2);
  // 위 행(y = +D/2)부터 — PlaneGeometry 와 같은 순서
  for (let iy = 0; iy < n; iy++) {
    const y = xs[n - 1 - iy];
    for (let ix = 0; ix < n; ix++) {
      const x = xs[ix], k = iy * n + ix;
      pos[k * 3] = x; pos[k * 3 + 1] = y; pos[k * 3 + 2] = 0;
      nrm[k * 3 + 2] = 1;
      uv[k * 2] = x / D + 0.5; uv[k * 2 + 1] = y / D + 0.5;
    }
  }
  const idx = new Uint32Array(cells * cells * 6);
  let t = 0;
  for (let iy = 0; iy < cells; iy++) for (let ix = 0; ix < cells; ix++) {
    const a = ix + n * iy, b = ix + n * (iy + 1), c = (ix + 1) + n * (iy + 1), d = (ix + 1) + n * iy;
    idx[t++] = a; idx[t++] = b; idx[t++] = d;
    idx[t++] = b; idx[t++] = c; idx[t++] = d;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  // ⚠⚠ PlaneGeometry 의 parameters 를 그대로 단다 — seamark.js 가 water().mesh.geometry.parameters.width 로 물의 반 변을 읽는다
  //   (바다 클릭 화살의 가장자리 페이드). 없으면 화살이 떠 있는 내내 tick 이 seamark.update 에서 던져 그리기가 멈췄다 (클릭마다 ~0.9초 정지).
  //   ⚠ 칸 수는 맞지만 간격은 고르지 않다 — width / widthSegments 로 칸 너비를 셈하지 말 것
  g.parameters = { width: D, height: D, widthSegments: cells, heightSegments: cells };
  return g;
}

// opts.mesh — 수면 메시 분할 (품질 단계 · quality.js). 없으면 CONFIG.sim.mesh
export function createWater(scene, tex, opts = {}) {
  const S = CONFIG.sim;
  // ⚠ 팔레트 캐시는 syncPalette 안의 _palKey 가 들고 있다 (테마 + tone). 여기 tone 변수는 없앴다
  let boatObj = null;         // setBoat() 로 받는다 — 반사가 향할 대상
  let sunShadow = null;       // setSunShadow() 로 받는다 — 그림자를 드리우는 해 쪽 주광 (배 그림자 ② · 역광 바다가 '지금 해 쪽 주광이 켜졌나' 로도 본다)
  let frontAz = 0, lightAz = 0;   // 앞 빛(setLight)의 방위 · 지금 쓰는 명암 방위 (update 의 역광 바다)
  const uni = {
    uH: { value: tex },
    uHScale: { value: S.height },
    uTexel: { value: new THREE.Vector2(1 / S.res, 1 / S.res) },
    uCell: { value: S.domain / S.res },
    // ⚠⚠ **사본이 아니라 공유다** — stage.js 가 같은 value 객체를 가져간다.
    //   하늘 값을 한 곳에서 갱신하면 물·하늘이 같이 따라온다 (sky.js 주석)
    ...SKY_UNIFORMS,
    uBg: { value: new THREE.Color(CONFIG.color.bg) },
    uFadeSky: { value: 1 },   // update() 가 waterFadeSky × stageAmount 로 민다
    uBase: { value: new THREE.Color(CONFIG.color.waterBase) },
    uMid: { value: new THREE.Color(CONFIG.color.waterMid) },
    uTrough: { value: new THREE.Color(CONFIG.color.waterTrough) },
    uTrans: { value: new THREE.Color(CONFIG.color.transmission) },
    uFloorLine: { value: new THREE.Color(CONFIG.color.floorLine) },   // ⚠ 등고선(line.color)과 별개 축이다
    uFloorAmt: { value: P.floorAmount },
    uFloorNear: { value: new THREE.Vector2(7, 14) },
    uFloorK: { value: P.floorScale },
    uFloorW: { value: P.floorWidth },
    uMicroA: { value: P.microA },
    uMicroWarp: { value: P.microWarp },
    uMicroB: { value: P.microB },
    // ⚠ 배열 유니폼이 아니라 vec4 다섯 개다 (위 uMicroD0 선언의 ⚠ 참고). 값만 덮어쓴다
    uMicroD0: { value: new THREE.Vector4() },
    uMicroD1: { value: new THREE.Vector4() },
    uMicroD2: { value: new THREE.Vector4() },
    uMicroD3: { value: new THREE.Vector4() },
    uMicroD4: { value: new THREE.Vector4() },
    uEnvMicro: { value: P.envMicro },
    // 정반사 전용 태양. 씬 광원과 다른 자리다 (config.js sun 주석 참고)
    uLightDir3: { value: new THREE.Vector3(...CONFIG.sun).normalize() },
    uSpecAmt: { value: P.specAmount },
    // 태양 반짝임 (HDR) — update() 가 매 프레임 params 에서 다시 민다
    uGlintAmt: { value: 0 }, uGlintHot: { value: 0 }, uGlintFarK: { value: 1 },
    uGlintShine: { value: new THREE.Vector2(700, 40) }, uGlintDist: { value: new THREE.Vector2(28, 71) },
    uGlintWhite: { value: new THREE.Vector2(0.6, 2.4) }, uGlintCore: { value: new THREE.Color('#F4F8FF') },
    uSkyAmt: { value: P.skyAmount },
    uShadowAmt: { value: P.shadowAmount }, uShadowIn: { value: P.shadowSoft },
    uShadowKnee: { value: P.shadowKnee },
    uHullAmt: { value: P.hullFoam }, uHullTaper: { value: 0 },
    uHullBand: { value: P.hullBand }, uHullPush: { value: P.hullPush },
    uHullInner: { value: P.hullInner }, uContactLift: { value: P.contactLift },
    uHullDrift: { value: P.hullDrift }, uHullSwell: { value: P.hullSwell },
    uHullOuter: { value: P.hullOuter },
    uReflMirror: { value: P.reflectMirror },
    uSmearFade: { value: P.reflectTail },
    uHullLap: { value: P.hullLap }, uHullHit: { value: P.hullHit },
    uHullBead: { value: P.hullBead }, uHullCull: { value: P.hullCull },
    uBoatY: { value: 0 },
    uSubReach: { value: P.subReach },
    uHullG: { value: new THREE.Vector4(1, 1, 1, 0.1) },
    uHullT: { value: new THREE.Vector4(0, 0.1, 1, 0) },
    uHullTilt: { value: new THREE.Vector2(0, 0) },
    uShadowOcc: { value: P.shadowOcclude },
    uShadowSize: { value: new THREE.Vector2(1, 1) },
    uBoatDir: { value: new THREE.Vector2(0, 1) },
    uShadowCol: { value: new THREE.Color(CONFIG.color.boatShadow) },
    // 배 그림자 ② — 해 쪽 주광의 그림자 맵 (setSunShadow 로 받은 빛을 update() 가 매 프레임 싣는다 · x = 0 이면 안 돈다)
    uSunSh: { value: null },
    uSunShMat: { value: new THREE.Matrix4() },
    uSunShK: { value: new THREE.Vector4(0, 0, 0, 0) },
    uSunShSpan: { value: new THREE.Vector4(1, 1, 1, 0) },
    uSunShReach: { value: new THREE.Vector2(4, 14) },
    uContactAmt: { value: P.contactAmount },
    uContactSize: { value: new THREE.Vector2(1, 1) },
    uSmearK: { value: P.reflectSmear },
    uBoatUv: { value: new THREE.Vector2(0.5, 0.5) },
    uToneAmt: { value: P.toneAmount },
    uToneDist: { value: new THREE.Vector2(P.toneNear, P.toneFar) },
    uToneCol: { value: new THREE.Color(CONFIG.color.seaDeep) },
    uGlitter: { value: P.glitter },
    uGlitOct2: { value: P.glitterOct2 },
    uShine: { value: P.shine },
    uGlitCell: { value: P.glitterCell },
    uRefract: { value: P.refract },
    uDepth: { value: P.floorDepth },
    uLightXZ: { value: new THREE.Vector2(1, 0) },   // setLight() 가 채운다
    uSteepK: { value: CONFIG.surface.steepK },      // 수면 전용 (grid.steepK 와 다르다 — config 주석 참고)
    uShade: { value: P.waterShade },
    uSpec: { value: P.waterSpec },
    uBoatPos: { value: new THREE.Vector3() },   // setBoat() 가 준 배를 update() 가 따라간다
    // 공중의 부표. syncMarks() 가 매 프레임 채운다 (marks.update 뒤에 불러야 한다)
    uMarkPos: { value: Array.from({ length: MARK_REFL_MAX }, () => new THREE.Vector4()) },
    uMarkCol: { value: Array.from({ length: MARK_REFL_MAX }, () => new THREE.Color()) },
    uMarkN: { value: 0 },
    uMarkRefl: { value: P.markReflect },
    uMarkSpread: { value: P.markReflSpread },
    uMarkFall: { value: P.markReflFall },
    uMarkGlow: { value: P.markReflGlow },
    uMarkCore: { value: P.markReflCore },
    uMarkAnchor: { value: P.markReflAnchor === undefined ? 1 : P.markReflAnchor },
    uRefl: { value: null },                     // reflect.js 가 찍은 배 그림
    uReflRise: { value: P.reflectRise },
    uReflBlur: { value: P.reflectBlur },
    uReflRipple: { value: P.reflectRipple },
    uReflPush: { value: P.reflectPush },
    uReflAim: { value: P.reflectAim },
    uWakeCol: { value: new THREE.Color(CONFIG.color.wake) },
    uWakeAmt: { value: P.wakeAmount },
    uWakeEdge: { value: P.wakeEdge },
    uFoamLo: { value: P.foamLo },
    uFoamCol: { value: new THREE.Color(CONFIG.color.foam) },
    uFoamWhite: { value: P.foamWhite },
    uFoamCell: { value: P.foamCell },
    uFoamThin: { value: P.foamThin },
    uFoamThick: { value: P.foamThick },
    uFoamEdge: { value: P.foamEdge },
    uFoamBubble: { value: P.foamBubble },
    uFoamNear: { value: P.foamNear },
    uFoamCull: { value: P.foamCull },
    uFoamFar: { value: P.foamFar },
    uFoamDrift: { value: P.foamDrift },
    uFoamWLo:     { value: P.foamWLo },      uFoamWHi:     { value: P.foamWHi },
    uFoamLH0:     { value: P.foamLiveH0 },   uFoamLH1:     { value: P.foamLiveH1 },
    uFoamLH2:     { value: P.foamLiveH2 },   uFoamLH3:     { value: P.foamLiveH3 },
    uFoamFace:    { value: P.foamFace },     uFoamFaceB:   { value: P.foamFaceBias },
    uFoamFaceSoft:{ value: P.foamFaceSoft }, uFoamFaceOut: { value: P.foamFaceOut },
    uFoamFaceS:   { value: P.oceanSwell * SLOPE_RMS },
    // 흰 거품 두 겹 (v0.60). ⚠ update() 의 push 와 같이 고친다
    uLineYield:    { value: P.lineYield },    uLineYieldSrc:   { value: P.lineYieldSrc },   uLineYieldK:     { value: P.lineYieldK },
    uFoamFaceKeep: { value: P.foamFaceKeep }, uFoamFaceKeepLo: { value: P.foamFaceKeepLo }, uFoamFaceKeepHi: { value: P.foamFaceKeepHi },
    uFoamKnee:     { value: P.foamKnee },     uLineFoamSrc:    { value: P.lineFoamSrc },
    uFoamShade:    { value: P.foamShade },    uFoamLace:       { value: P.foamLace },       uFoamLaceThin:   { value: P.foamLaceThin },
    // 파란 띠 밑 얇게 · 거품 군집 (v0.61). ⚠ update() 의 push 와 같이 고친다
    uFoamUnder:    { value: P.foamUnder },    uFoamTailLo:     { value: P.foamTailLo },     uFoamTailHi:     { value: P.foamTailHi },
    uFoamUnderA:   { value: P.foamUnderA },
    uFoamPatch:    { value: P.foamPatch },    uFoamPatchCell:  { value: P.foamPatchCell },  uFoamPatchLo:    { value: P.foamPatchLo },
    uFoamPatchHi:  { value: P.foamPatchHi },
    uFoamStripAt:  { value: P.foamStripAt },  uFoamStripW:     { value: P.foamStripW },
    uFoamReachUV:  { value: new THREE.Vector2() },   // update() 가 foamReach · uSwellDir · S.domain 으로 채운다
    // 쇄파 무리 (v0.60) — 검증 보기 15 만 쓴다. ⚠ sim.js 와 같은 값이라야 섬이 기억과 겹친다
    uFoamClumpCell: { value: P.foamClumpCell }, uFoamClumpStretch: { value: P.foamClumpStretch }, uFoamClumpFlow: { value: P.foamClumpFlow },
    // 반짝임 거품 (v0.12.1)
    uSparkAmt:  { value: P.sparkAmount }, uSparkH0:   { value: P.sparkH0 },
    uSparkH1:   { value: P.sparkH1 },     uSparkRise: { value: P.sparkRise },
    uSparkFace: { value: P.sparkFace },   uSparkFaceW:{ value: P.sparkFaceW },
    // ⚠ Drift 는 update() 와 **같은 식**이어야 한다 (위상속도 계수를 곱한 값)
    uSparkFaceB:{ value: P.sparkFaceB },  uSparkDrift:{ value: P.sparkDrift * swellPhaseC() },
    uSparkClump:{ value: P.sparkClump },  uSparkLo:   { value: P.sparkLo },
    uSparkHi:   { value: P.sparkHi },     uSparkCell: { value: P.sparkCell },
    uSparkJit:  { value: P.sparkJitter }, uSparkShine:{ value: P.sparkShine },
    uSparkDens: { value: P.sparkDens },
    uSparkCull: { value: P.sparkCull },
    uFoamFaceA:   { value: P.foamFaceAmt },  uFoamLive:    { value: P.foamLive },
    uFoamCalm:    { value: P.foamCalm },     uFoamWarp:    { value: P.foamWarp },
    uFoamRough:   { value: P.foamRough },    uFoamStretch: { value: P.foamStretch },
    uFoamFine:    { value: P.foamFine },     uFoamFineAmt: { value: P.foamFineAmt },
    uFoamAA:      { value: P.foamAA },
    uFoamHi2: { value: P.foamHi },
    uCrestFace: { value: P.crestFace },
    uCrestBias: { value: P.crestBias },
    uCrestEps: { value: P.crestEps === undefined ? 0 : P.crestEps },
    uApexAmt: { value: P.apexAmount },
    uApexH0: { value: P.apexH0 },
    uApexH1: { value: P.apexH1 },
    uSunLobe: { value: P.sunLobe },
    uSub: { value: null },
    uSubAmt: { value: P.subAmount },
    uSubRefract: { value: P.subRefract },
    uSubScatter: { value: P.subScatter },
    uSubCell: { value: P.subCell },
    uSubScatK: { value: P.subScatSlope },
    uSubEdge: { value: P.subEdge },
    uSubBreak: { value: P.subBreak },
    uSubDeepBlur: { value: P.subDeepBlur },
    uSubTint: { value: new THREE.Color(CONFIG.color.subTint) },
    uGlowAmt: { value: P.glowAmount },
    uGlowW: { value: P.glowWidth },
    uSeamAmt: { value: P.seamAmount },
    uSeamW: { value: P.seamWidth },
    uSeamH0: { value: P.seamH0 },
    uSeamH1: { value: P.seamH1 },
    uLineFoam: { value: P.lineFoam },
    uLineFoamHi: { value: P.lineFoamHi },
    uLineAmt: { value: P.lineAmount },
    uLineW: { value: P.lineWidth },
    uLineHalo: { value: P.lineHalo },
    uLineH0: { value: P.lineH0 },
    uLineH1: { value: P.lineH1 },
    uDebug: { value: 0 },
    uDbgEdge: { value: P.debugEdge },
    uSwellDir: { value: new THREE.Vector2(...swellMeanDir()) },
    uFoamBlur: { value: P.foamBlur },
    uWakeLo: { value: P.wakeLo },
    uWakeHi: { value: P.wakeHi },
    uScatter: { value: P.reflectScatter },
    uScatNear: { value: P.scatterNear },
    uScatFar: { value: P.scatterFar },
    uScatRamp: { value: P.scatterRamp },
    uScatCell: { value: P.scatterCell },
    uScatK: { value: P.scatterSlope },
    uReflAmt: { value: P.boatReflect },
    uReflFade: { value: P.reflectFade },
    uReflSharp: { value: P.reflectSharp },
    uViolet: { value: new THREE.Color(CONFIG.color.crestViolet) },
    uBlue: { value: new THREE.Color(CONFIG.color.crestBlue) },
    uApex: { value: new THREE.Color(CONFIG.color.crestApex) },
    uHNorm: { value: 1 },   // update() 가 진폭에서 계산한다
    uTime: { value: 0 },
    uWaveSpeed: { value: P.waveSpeed },
    uDetail0: { value: CONFIG.surface.detail0 },
    uDetail1: { value: CONFIG.surface.detail1 },
    uTimeQ: { value: 0 }, uSwellA: { value: P.oceanSwell },
    uCrossA: { value: P.oceanSwell * P.crossAmount },
    uRippleA: { value: P.ripple },
    uGerstner: { value: P.gerstner },
    // ── 군 포락선 (2026-09-06). ⚠ water.js · grid.js · sim.js 세 곳에 **같이** 넣는다.
    //    한 곳을 빠뜨리면 uEnvAmt 가 0 으로 들어가 그 층만 예전 동작이 되고,
    //    컴파일 에러는 안 난다 — 이 변경에서 유일하게 '말 없이 틀리는' 경로다
    uEnvAmt:   { value: P.envAmount }, uEnvLo:    { value: P.envLo },
    uEnvHi:    { value: P.envHi },     uEnvRLo:   { value: P.envRLo },
    uEnvRHi:   { value: P.envRHi },    uEnvBeta:  { value: P.envBeta },
    uEnvGerst: { value: P.envGerst },  uEnvSpeed: { value: P.envSpeed },
    uSwellOff: { value: new THREE.Vector2() },
    uFade0: { value: CONFIG.surface.fade0 }, uFade1: { value: CONFIG.surface.fade1 },
    uCam: { value: new THREE.Vector2(0, CONFIG.cam.zNear) },
  };

  bakeMicro(MICRO_SLOTS(uni));   // 첫 프레임 전에 한 번 굽는다

  let seg = Math.max(64, Math.round(opts.mesh || S.mesh));
  const mesh = new THREE.Mesh(
    waterGeometry(seg),
    new THREE.ShaderMaterial({ uniforms: uni, vertexShader: WATER_VERT, fragmentShader: WATER_FRAG })
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.z = S.centerZ;
  mesh.frustumCulled = false;
  scene.add(mesh);

  return {
    mesh, uni,
    // ⭐ 수면 메시 분할을 바꾼다 (품질 단계 — 512 · 384 · 256). 지오메트리만 갈아 끼운다 — 재질 · 셰이더는 그대로다.
    //   ⚠ 배의 부력은 이 메시를 안 본다 (swellCPU + sim.sampler) — 분할을 바꿔도 배는 같은 물에 뜬다.
    //   ⚠ 256 이면 주파장을 정점 ~19개로 그려 마루가 조금 각진다 (config.js sim.mesh 실측 주석) — low 의 대가다
    setMeshDetail(n) {
      const next = Math.max(64, Math.round(n || S.mesh));
      if (next === seg) return;
      seg = next;
      const old = mesh.geometry;
      mesh.geometry = waterGeometry(seg);
      old.dispose();
    },
    get meshDetail() { return seg; },
    // grid.js · spray.js 와 반드시 같은 벡터를 받는다
    setBoat(obj) { boatObj = obj; },
    // 배 그림자 ② — 그림자 맵을 읽을 빛 (main.js 의 sunLight). ⚠ 빛의 aim · 그림자 카메라는 main.js 가 쥔다 — 여기는 읽기만 한다
    setSunShadow(light) { sunShadow = light; },
    // reflect.js 가 찍은 그림과, 그 그림을 되읽을 행렬·평판 법선을 받는다
    setReflect(r) { uni.uRefl.value = r.texture; },

    // 물에 비칠 부표를 골라 유니폼에 싣는다.
    // ⚠ **marks.update() 뒤에 불러야 한다.** 부표의 씬 좌표가 그 안에서 갱신되기 때문이다.
    // ⚠ 가까운 것부터 MARK_REFL_MAX 개만 싣는다. 반사는 부표 근처 수면에만 나타나고,
    // 프래그먼트마다 도는 루프라 개수가 곧 비용이다
    syncMarks(marks) {
      uni.uMarkRefl.value = P.markReflect;
      uni.uMarkSpread.value = Math.max(1, P.markReflSpread);
      uni.uMarkFall.value = Math.max(0.2, P.markReflFall);
      uni.uMarkAnchor.value = P.markReflAnchor === undefined ? 1 : P.markReflAnchor;
      uni.uMarkGlow.value = P.markReflGlow;
      uni.uMarkCore.value = P.markReflCore;
      if (!P.markReflect || !P.showMarks) { uni.uMarkN.value = 0; return; }
      const near = marks.list
        .filter(m => m.on && m.root.visible)
        .sort((a, b) => (a.sx * a.sx + a.sz * a.sz) - (b.sx * b.sx + b.sz * b.sz))
        .slice(0, MARK_REFL_MAX);
      const r = CONFIG.mark.ballR * Math.max(0.05, P.markScale);
      near.forEach((m, i) => {
        uni.uMarkPos.value[i].set(m.sx, m.wy, m.sz, r);
        // ⚠ m.zone.color(= areas[].color) 를 쓰면 안 된다. 부표 색은 테마가 정하므로
        // 그쪽은 옛 원본 색에 멈춰 있다 — 테마를 은은하게 바꿔도 **물에 비친 것만 짙게
        // 남는다** (실제로 그랬다 : 재질 #cba0aa 인데 반사가 #d9738f). 재질 색을 그대로 쓴다
        uni.uMarkCol.value[i].copy(m.tint.color);
      });
      uni.uMarkN.value = near.length;
    },
    boatPos: null,   // main.js 가 reflect 에 넘길 위치 (update 가 채운다)
    // ⚠ 받는 것은 **앞 빛**(dirLight)의 방향이다. 실제로 쓰는 명암 방향은 update() 가 역광(seaBacklight)만큼 해 쪽으로 돌린 것이다 (아래 lightAz)
    setLight(dir) {
      frontAz = Math.atan2(dir.z, dir.x);
      lightAz = frontAz;
      uni.uLightXZ.value.set(Math.cos(frontAz), Math.sin(frontAz));
    },
    // 지금 쓰는 명암 방향의 각 (월드 xz) — grid.js 가 **같은 값**을 받아야 한다 (불변식 15 · main.js 틱이 넘긴다)
    get lightAz() { return lightAz; },
    update(sim, cam, t, camK) {
      // ── 바다의 밝기 한 손잡이 (waterTone).
      // ⚠ 이 프로젝트에서 **가장 크게 그림을 바꾸는 값**이다. 반짝임·발광이 보이느냐가
      // 여기서 정해진다 — 흰 반짝임은 주변보다 밝아야 읽히는데, 물이 종이만큼 밝으면
      // 얹을 자리가 없다 (내리기 전 실측 : 종이 233 · 물 p99 235 · 여유 20레벨).
      //   0.0 = config.color (원래 화면, **기본값**)   1.0 = config.colorDeep (짙은 바다)
      // 실측 물 p50 : 0.00 → 205 · 0.25 → 199 · 0.60 → 154 · 0.75 → 135 · 1.00 → 104
      // ⚠ 2026-09-03 에 0.75 로 갔다가 "너무 짙다" 로 0 으로 되돌렸다. 손잡이는 남긴다
      // ⚠ 테마와 tone 을 같이 본다 (위 syncPalette). 예전에는 tone 만 비교했는데,
      //   그대로 두면 **테마를 갈아타도 색이 안 바뀐다**
      syncPalette(uni);
      // ⭐⭐ 잠수 — **물에 비친 하늘도 같이 걷힌다** (2026-09-18, dive.js).
      //   ⚠⚠ 팔레트만 눕히면 화면이 거의 안 어두워진다 : 카메라가 수면으로 내려갈수록 시선이 스치는 각이
      //     되어 프레넬이 1 에 가까워지고, 그 자리를 `skyColor()` 가 **팔레트와 무관하게** 칠한다 (아래 uSkyAmt).
      //     실측(2026-09-18, 저녁 · k 1.0) : 이 항을 안 걷으면 짙은 물 위가 옅은 라벤더로 남는다.
      //   ⚠ 원경이 하늘로 녹는 몫(uFadeSky)도 **같은 값**으로 내린다 — 갈라지면 물끝에 밝은 띠가 한 줄 남는다.
      const Dv = diveNow();
      const diveSky = Dv ? 1 - (P.diveSkyOff === undefined ? 1 : P.diveSkyOff) * Dv.dim : 1;
      uni.uH.value = sim.texture;
      uni.uTime.value = t;   // 색의 흐름만 실시간 — 형태는 sim.qT 를 본다
      uni.uWaveSpeed.value = P.waveSpeed;
      // 진폭이 바뀌어도 마루의 색 위치가 흔들리지 않게, 매 프레임 정규화 계수를 다시 낸다.
      // 0.5 를 곱하는 이유 : 파고가 -A..+A 라 h = 0.5 + y/(2A) 로 0..1 에 들어간다
      // ⚠ swellAmplitude 안에 군 포락선의 E[E²] 가 들어 있다 (envMoments). 매 프레임 다시
      // 부르므로 envLo/envHi/envBeta 를 슬라이더로 흔들어도 uHNorm 이 **자동으로 따라온다**
      uni.uHNorm.value = 0.5 / Math.max(1e-4, swellAmplitude(P.oceanSwell, P.ripple));
      // 너울 위상 : 월드가 흐르는 만큼 반대로 밀어 파가 물과 같이 움직이게 한다
      uni.uTimeQ.value = sim.qT;
      uni.uSwellA.value = P.oceanSwell;
      uni.uCrossA.value = P.oceanSwell * P.crossAmount;
      uni.uRippleA.value = P.ripple;
      uni.uGerstner.value = P.gerstner;
      uni.uEnvAmt.value = P.envAmount;     uni.uEnvLo.value = P.envLo;
      uni.uEnvHi.value = P.envHi;          uni.uEnvRLo.value = P.envRLo;
      uni.uEnvRHi.value = P.envRHi;        uni.uEnvBeta.value = P.envBeta;
      uni.uEnvGerst.value = P.envGerst;    uni.uEnvSpeed.value = P.envSpeed;
      uni.uShade.value = P.waterShade;
      uni.uSpec.value = P.waterSpec;
      uni.uReflAmt.value = P.boatReflect;
      uni.uReflFade.value = P.reflectFade;
      uni.uReflRise.value = P.reflectRise;
      uni.uReflBlur.value = P.reflectBlur;
      uni.uReflRipple.value = P.reflectRipple;
      uni.uReflPush.value = P.reflectPush;
      uni.uReflAim.value = P.reflectAim;
      uni.uReflMirror.value = P.reflectMirror;
      uni.uSmearFade.value = P.reflectTail;
      uni.uWakeAmt.value = P.wakeAmount;
      uni.uWakeEdge.value = P.wakeEdge;
      uni.uFoamLo.value = P.foamLo;
      uni.uFoamWhite.value = P.foamWhite;
      uni.uFoamCell.value = P.foamCell;
      uni.uFoamThin.value = P.foamThin;
      uni.uFoamThick.value = P.foamThick;
      uni.uFoamEdge.value = P.foamEdge;
      uni.uFoamBubble.value = P.foamBubble;
      uni.uFoamNear.value = P.foamNear;
      uni.uFoamCull.value = P.foamCull;
      uni.uFoamFar.value = P.foamFar;
      // ⚠⚠ **foamDrift 는 "마루 속도의 몇 배" 다** (2026-09-06 에 의미를 바꿨다).
      //   1.0 = 마루와 정확히 같은 속도로 흐른다 · 0 = 물에 붙어 제자리.
      //   셰이더는 uFoamDrift × uWaveSpeed × uTimeQ 로 좌표를 미므로, 여기서 위상속도
      //   계수(ω/k)를 곱해 두면 셰이더를 안 고치고 의미만 바꿀 수 있다.
      //
      // ⚠⚠ **이건 물리적으로 틀린 쪽이고, 의도한 것이다.** 실제 거품은 물에 떠 있어서
      //   파가 그 밑을 지나간다 (스토크스 이류만 천천히 흐른다). 그래서 CLAUDE.md 와
      //   docs/파도-표현-개선안.md 3.3 은 "거품을 위상속도로 옮기지 마라 — 흰 무늬가
      //   마루에 붙어서 달린다" 고 적었다.
      //   그런데 2026-09-06 에 사용자가 **정확히 그것을 요구했다** :
      //   "파도를 타고 올라왔다가 내려오는 게 아니라 파도 위에 같이 움직여야 함.
      //    서퍼 생각하면 파도 위에 같이 존재해야 하는데" — 양식화된 랜딩이므로 따른다.
      //   물리로 되돌리려면 foamDrift 를 0.1 근처(스토크스)로 내린다.
      // ⚠ 계수는 BANDS 에서 뽑는다 (불변식 2). 셰이더에 1.386 을 직접 적으면 표를 고친
      //   날 거품만 옛 속도로 남는다. 검산 : 한 주기 4.81초에 3.20 = 주파장.
      uni.uFoamDrift.value = P.foamDrift * swellPhaseC();
      uni.uFoamWLo.value = P.foamWLo;         uni.uFoamWHi.value = P.foamWHi;
      uni.uFoamLH0.value = P.foamLiveH0;      uni.uFoamLH1.value = P.foamLiveH1;
      uni.uFoamLH2.value = P.foamLiveH2;      uni.uFoamLH3.value = P.foamLiveH3;
      uni.uFoamFace.value = P.foamFace;       uni.uFoamFaceB.value = P.foamFaceBias;
      uni.uFoamFaceSoft.value = P.foamFaceSoft;
      uni.uFoamFaceOut.value  = P.foamFaceOut;
      // ⚠ oceanSwell 은 라이브 슬라이더다 — vGradW 가 그만큼 커지므로 정규화도 따라간다
      uni.uFoamFaceS.value = P.oceanSwell * SLOPE_RMS;
      // 흰 거품 두 겹 (v0.60)
      uni.uLineYield.value = P.lineYield;       uni.uLineYieldSrc.value = P.lineYieldSrc;     uni.uLineYieldK.value = P.lineYieldK;
      uni.uFoamFaceKeep.value = P.foamFaceKeep; uni.uFoamFaceKeepLo.value = P.foamFaceKeepLo; uni.uFoamFaceKeepHi.value = P.foamFaceKeepHi;
      uni.uFoamKnee.value = P.foamKnee;         uni.uLineFoamSrc.value = P.lineFoamSrc;
      uni.uFoamShade.value = P.foamShade;       uni.uFoamLace.value = P.foamLace;             uni.uFoamLaceThin.value = P.foamLaceThin;
      // 파란 띠 밑 얇게 · 거품 군집 (v0.61)
      uni.uFoamUnder.value = P.foamUnder;       uni.uFoamTailLo.value = P.foamTailLo;         uni.uFoamTailHi.value = P.foamTailHi;
      uni.uFoamUnderA.value = P.foamUnderA;
      uni.uFoamPatch.value = P.foamPatch;       uni.uFoamPatchCell.value = P.foamPatchCell;   uni.uFoamPatchLo.value = P.foamPatchLo;
      uni.uFoamPatchHi.value = P.foamPatchHi;
      uni.uFoamStripAt.value = P.foamStripAt;   uni.uFoamStripW.value = P.foamStripW;
      // 파도 뒤쪽 기억 조회 — swell 좌표 Δp = −foamReach·dir → 기억 텍스처 Δu = −dir.x·d / domain · Δv = +dir.y·d / domain (v 는 swell z 와 반대 방향)
      uni.uFoamReachUV.value.set(-uni.uSwellDir.value.x * P.foamReach / S.domain, uni.uSwellDir.value.y * P.foamReach / S.domain);
      uni.uFoamClumpCell.value = P.foamClumpCell; uni.uFoamClumpStretch.value = P.foamClumpStretch; uni.uFoamClumpFlow.value = P.foamClumpFlow;
      // 반짝임 거품. ⚠ uSparkDrift 는 foamDrift 와 달리 위상속도 계수를 **여기서 안 곱한다** —
      //   셰이더가 uWaveSpeed 만 곱하므로, 1.0 을 '위상속도' 로 만들려면 여기서 곱해야 한다
      uni.uSparkAmt.value = P.sparkAmount;
      uni.uSparkH0.value = P.sparkH0;
      uni.uSparkH1.value = P.sparkH1;
      uni.uSparkRise.value = P.sparkRise;
      uni.uSparkFace.value = P.sparkFace;
      uni.uSparkFaceW.value = P.sparkFaceW;
      uni.uSparkFaceB.value = P.sparkFaceB;
      uni.uSparkDrift.value = P.sparkDrift * swellPhaseC();
      uni.uSparkClump.value = P.sparkClump;
      uni.uSparkLo.value = P.sparkLo;
      uni.uSparkHi.value = P.sparkHi;
      uni.uSparkCell.value = P.sparkCell;
      uni.uSparkJit.value = P.sparkJitter;
      uni.uSparkShine.value = P.sparkShine;
      uni.uSparkDens.value = P.sparkDens;
      uni.uSparkCull.value = P.sparkCull;
      uni.uFoamFaceA.value = P.foamFaceAmt;   uni.uFoamLive.value = P.foamLive;
      uni.uFoamCalm.value = P.foamCalm;       uni.uFoamWarp.value = P.foamWarp;
      uni.uFoamRough.value = P.foamRough;     uni.uFoamStretch.value = P.foamStretch;
      uni.uFoamFine.value = P.foamFine;       uni.uFoamFineAmt.value = P.foamFineAmt;
      uni.uFoamAA.value = P.foamAA;
      uni.uFoamHi2.value = P.foamHi;
      uni.uCrestFace.value = P.crestFace;
      uni.uCrestBias.value = P.crestBias;
      uni.uCrestEps.value = P.crestEps === undefined ? 0 : P.crestEps;
      uni.uApexAmt.value = P.apexAmount;
      uni.uApexH0.value = P.apexH0;
      uni.uApexH1.value = P.apexH1;
      uni.uSunLobe.value = P.sunLobe;
      uni.uSubAmt.value = P.subAmount;
      uni.uSubRefract.value = P.subRefract;
      uni.uSubScatter.value = P.subScatter;
      uni.uSubCell.value = P.subCell;
      uni.uSubScatK.value = P.subScatSlope;
      uni.uSubEdge.value = P.subEdge;
      uni.uSubBreak.value = P.subBreak;
      uni.uSubDeepBlur.value = P.subDeepBlur;
      uni.uGlowAmt.value = P.glowAmount;
      uni.uGlowW.value = P.glowWidth;
      uni.uSeamAmt.value = P.seamAmount;
      uni.uSeamW.value = P.seamWidth;
      uni.uSeamH0.value = P.seamH0;
      uni.uSeamH1.value = P.seamH1;
      uni.uLineFoam.value = P.lineFoam;
      uni.uLineFoamHi.value = P.lineFoamHi;
      uni.uLineAmt.value = P.lineAmount;
      uni.uLineW.value = P.lineWidth;
      uni.uLineHalo.value = P.lineHalo;
      uni.uLineH0.value = P.lineH0;
      uni.uLineH1.value = P.lineH1;
      uni.uDebug.value = P.debugView | 0;
      uni.uDbgEdge.value = P.debugEdge;
      uni.uFoamBlur.value = P.foamBlur;
      uni.uWakeLo.value = P.wakeLo;
      uni.uWakeHi.value = P.wakeHi;
      uni.uScatter.value = P.reflectScatter;
      uni.uScatNear.value = P.scatterNear;
      uni.uScatFar.value = P.scatterFar;
      uni.uScatRamp.value = P.scatterRamp;
      uni.uScatCell.value = P.scatterCell;
      uni.uScatK.value = P.scatterSlope;
      uni.uReflSharp.value = P.reflectSharp;
      // 배는 x = z = 0 에 고정돼 있고 세계가 그 밑으로 흐른다. y 만 부력을 따라 움직인다
      if (boatObj) {
        uni.uBoatPos.value.set(boatObj.position.x, boatObj.position.y + P.reflectRise, boatObj.position.z);
        // 배의 **화면 좌표**. 비침을 세로로 늘일 때의 고정점이다 (uSmearK).
        // ⚠ 안 채우면 0.5 로 남아 화면 한가운데를 축으로 늘어난다 — 배에서 떨어져 나간다.
        // ⚠ 렌더에 실제로 쓰는 카메라(cam)로 투영한다. 자유·항공 시점도 같이 따라와야 한다
        _bp.copy(uni.uBoatPos.value).project(cam);
        uni.uBoatUv.value.set(_bp.x * 0.5 + 0.5, _bp.y * 0.5 + 0.5);
        // 배의 앞 방향(xz). ⚠ 진행 방향은 로컬 −z 다 (불변식 0-2)
        // ⚠⚠⚠ **부호가 뒤집혀 있었다** (2026-09-09, 사용자 지적 : *"배에 적용되는 파도 거품이
        //   배 선두에 생기고 있는것임 (…) 배 후미에 생겨야한다"*).
        //   `main.js` 가 이미 경고해 둔 그것이다 — *"2026-09-08 이전에는 이게 맞아 보였다:
        //   GLB 뱃머리가 +z 로 뒤집혀 있어서 두 오류가 서로 상쇄했다. 뱃머리를 바로잡으면
        //   (GLB_YAW) 이쪽도 같이 뒤집어야 한다."* GLB_YAW 는 고쳤는데 여기가 안 따라왔다.
        //   ⚠ 실측 (pivot 로컬 좌표, 갑판 높이 0.9~1.4 의 z 별 선체 폭) :
        //       z −2:0.67 · −1:1.13 · 0:1.40 · +1:1.43 · +2:1.33 · **+3:0.08**
        //     **+z 에서 갑판이 한 점으로 모인다 = 거기가 뱃머리다.**
        //   ⚠⚠ **용골 대역(y<0.2)으로 재면 반대로 나온다** (z −2 가 0.24 로 가장 좁다) —
        //     그건 뱃머리가 아니라 **러더**다. 처음에 그걸로 오판했다. 폭을 잴 때는 y 를 가른다.
        //   ⚠ 다른 두 소비자(그림자·접촉 그림자)는 uBoatDir 을 **대칭 타원의 축**으로만 쓰므로
        //     부호가 바뀌어도 그림이 안 변한다. 앞뒤 비대칭을 쓰는 곳은 선체 거품(hullTaper) 하나다.
        uni.uBoatDir.value.set(Math.sin(boatObj.rotation.y), Math.cos(boatObj.rotation.y));
        // ⚠ 접촉 거품이 쓰는 **날것의** 배 높이. uBoatPos.y 에는 reflectRise 가 더해져
        //   있어서 그걸 쓰면 반사 슬라이더가 흘수선을 조용히 옮긴다
        uni.uBoatY.value = boatObj.position.y;
        // 피치·롤을 공칭 흘수로 나눠 [1/월드] 로 만든다.
        // ⚠⚠ **한 프레임 낡았고 boatFps 계단이다** — water.update 가 boat.update 보다
        //   먼저 돌고, 자세는 boatFps 게이트 안에서만 바뀐다. 그대로 실으면 띠가 초당
        //   8번 튄다. 여기서 눌러 준다 (v0.11.1 '거품이 직전 프레임의 바다를 보고 있었다'
        //   와 같은 자리다)
        // ⚠⚠ **단위를 나누지 않는다** (2026-09-06 정정). 처음에 공칭 흘수로 나눠 실었는데
        //   그건 틀렸다 : hdep 은 **월드 길이**이고 hfw 도 월드 길이라, 곱해지는 자세 항은
        //   **라디안(무차원)** 이라야 결과가 월드 길이가 된다. 흘수 0.28 로 나누면 기울기
        //   항만 **3.6배** 부풀어서, 배가 조금만 기울어도 흘수 게이트가 한쪽 끝에서 포화한다.
        //   사용자 : *"선체가 기울어지면서 살짝씩 그 띠가 심하게 보인다."* — 그 원인이 이것이다.
        // ⚠ hullTiltK 로 더 눌러 쓸 수 있게 열어 둔다 (1.0 = 소각 근사 그대로).
        _hT.set(boatObj.rotation.x * P.hullTiltK, boatObj.rotation.z * P.hullTiltK);
        uni.uHullTilt.value.lerp(_hT, 0.25);
      }
      uni.uFloorAmt.value = P.floorAmount;
      uni.uFloorK.value = P.floorScale;
      uni.uFloorW.value = P.floorWidth;
      uni.uMicroA.value = P.microA;
      uni.uMicroWarp.value = P.microWarp;
      uni.uMicroB.value = P.microB;
      bakeMicro(MICRO_SLOTS(uni));   // 방향·파수를 다시 굽는다
      bakeSun(uni.uLightDir3.value); // 수면 태양 (sunRot / sunTilt)
      // ⭐⭐ **역광 바다** (2026-09-27, S15P21E203-435 · 사용자 결정 : *"역광 100%로 적용해줘"*) — 명암 방향(uLightXZ)을 **보이는 해 쪽**으로 돌린다.
      //   예전에는 앞 빛(dirLight · 카메라 쪽)이었다 — 하늘 · 배 · 그림자는 해를 등지는데(불변식 35) 파도만 앞에서 빛을 받았다.
      //   해 쪽으로 돌리면 카메라를 보는 파도 면이 그늘지고(명암 식 hc = h + uShade·lit·0.16 에서 lit < 0) 해를 향한 마루선이 또렷해진다.
      //   시안 (같은 장면 · 화면 아래 62% 의 밝기 평균 / 표준편차) : 앞 빛 142 / 29.2 · 60% 138.6 / 31.3 · **100% 136.1 / 32.9** · 100% + 명암 2.6 135 / 33.6
      //   ⚠ 해 쪽 주광이 켜진 시간대(저녁 · 밤)만 — 낮은 앞 빛 그대로다 (불변식 35 의 '낮은 예전 그대로' · sunShadow 의 세기로 가른다)
      //   ⚠ 가운데 값은 방위를 **짧은 쪽으로** 돌린 것이다 (0.5 면 옆에서 비친다) · 0 = 앞 빛 그대로 (비트 단위 롤백)
      //   ⚠ 해는 bakeSun 이 매 프레임 굽는다(sunRot · sunTilt) — 그래서 여기서 매 프레임 따라간다
      {
        const key = sunShadow && sunShadow.intensity > 0 ? 1 : 0;
        const tb = Math.min(1, Math.max(0, P.seaBacklight === undefined ? 0 : P.seaBacklight)) * key;
        let d = Math.atan2(uni.uLightDir3.value.z, uni.uLightDir3.value.x) - frontAz;
        while (d > Math.PI) d -= 2 * Math.PI;
        while (d < -Math.PI) d += 2 * Math.PI;
        lightAz = frontAz + d * tb;
        uni.uLightXZ.value.set(Math.cos(lightAz), Math.sin(lightAz));
      }
      uni.uEnvMicro.value = P.envMicro;
      uni.uSpecAmt.value = P.specAmount;
      // 태양 반짝임 (HDR) — ⚠ 거리는 camDist 를 탄다 (아래 kD — 페이드 · LOD 와 같은 이유) · 그래서 거리 두 값은 kD 를 구한 뒤에 민다
      // ⚠ 잠수 동안 같이 눕는다 — 더하는 빛이라 팔레트가 짙어져도 제 밝기로 남아 **짙은 물 위에 흰 빛길만** 뜬다 (uApex 와 같은 함정 · syncPalette)
      uni.uGlintAmt.value = (P.glintAmount === undefined ? 0 : P.glintAmount) * (Dv ? 1 - Dv.dim : 1);
      uni.uGlintHot.value = P.glintHot === undefined ? 0 : P.glintHot;
      uni.uGlintFarK.value = P.glintFarK === undefined ? 1 : P.glintFarK;
      uni.uGlintShine.value.set(Math.max(1, P.glintShine === undefined ? 700 : P.glintShine),
                                Math.max(1, P.glintShineFar === undefined ? 40 : P.glintShineFar));
      uni.uGlintWhite.value.set(P.glintWhite0 === undefined ? 0.6 : P.glintWhite0,
                                Math.max((P.glintWhite0 === undefined ? 0.6 : P.glintWhite0) + 1e-3, P.glintWhite1 === undefined ? 2.4 : P.glintWhite1));
      if (P.glintCore !== undefined) uni.uGlintCore.value.set(P.glintCore);
      uni.uSkyAmt.value = P.skyAmount * diveSky;   // ⭐ 잠수 — 물에 비친 하늘 (위 diveSky 주석)
      uni.uShadowAmt.value = P.shadowAmount;
      uni.uShadowIn.value = P.shadowSoft;
      uni.uShadowKnee.value = P.shadowKnee;
      // ── 선체 접촉 거품의 흘수선 타원.
      // ⚠⚠ **여기 숫자를 직접 적지 않는다.** CONFIG.boat.lengthW 와 P.boatLift 에서
      //   파생시켜야, 배 크기나 흘수를 바꿀 때 이 층만 조용히 옛 축척에 남는 일이 없다.
      // ⚠⚠ **살아 있는 흘수를 쓰지 않는다.** boat.js 가 속도에 따라 배를 들어 올리므로
      //   부스트에서 흘수가 음수가 된다 — 살아 있는 값을 쓰면 **거품이 가장 많아야 할
      //   순간에 층이 통째로 꺼진다.** 공칭값(boatLift)으로 기하를 세우고, 순간의 출렁임은
      //   아래 uHullTilt(피치·롤)가 맡는다.
      {
        const S2 = CONFIG.boat.lengthW / 2;                 // 모델 길이 2 → 월드 배율
        const dm = Math.min(0.149, Math.max(0.004, Math.max(0, -P.boatLift) / S2));
        // a(반길이)는 **닫힌식이다.** boat.js 의 용골 곡선 keelF 를 흘수 dm 으로 역산한다 :
        //   keel(u) = 0.150·(1 − sin(pi·u)^0.62)  →  sin(pi·u0) = (1 − dm/0.150)^(1/0.62)
        const kk = Math.pow(Math.max(0, 1 - dm / 0.150), 1 / 0.62);
        const a  = S2 * (1 - 2 * Math.asin(Math.min(1, kk)) / Math.PI);
        // ⚠ b(반폭)·taper 는 같은 곡선에 맞춘 **피팅**이다. 3자리를 믿지 말고 검증 보기 13
        //   에서 실제 선체 실루엣과 맞춘 뒤 hullSize 로 흡수한다
        const b  = S2 * 0.4390 * Math.pow(dm, 0.3386);
        const aa = Math.max(0.05, a * P.hullSize), bb = Math.max(0.02, b * P.hullSize);
        uni.uHullTaper.value = 0.7900 * Math.pow(dm, 0.3293) * P.hullTaper;
        // 도달반경 : 발자국 + 띠 + 밀기 + 꼬리 + 여유 1.5
        // ⚠ dB 는 3D 거리이고 uBoatPos.y 에 reflectRise 가 섞여 있어 수평거리보다 항상 크다.
        //   조이면 파고에서 띠 끝이 잘린다
        uni.uHullG.value.set(1 / aa, 1 / bb,
          aa + 2 * (P.hullBand + Math.abs(P.hullPush)) + P.hullTail * 6.0 + 1.5,
          Math.max(0.02, P.hullLapW));
        // ⚠ w = **공칭 흘수.** 접촉 그림자가 '배가 얼마나 들렸나' 를 재는 기준점이다 —
        //   이걸 더해야 평소(물에 앉아 있을 때) clift 가 0 이 된다
        uni.uHullT.value.set(P.hullTail, P.hullTailLo, Math.max(0.2, P.hullLane),
                             Math.max(0.02, -P.boatLift));
        uni.uHullAmt.value = P.hullFoam;   uni.uHullBand.value = P.hullBand;
        uni.uHullPush.value = P.hullPush;  uni.uHullLap.value  = P.hullLap;
        uni.uHullHit.value = P.hullHit;    uni.uHullBead.value = P.hullBead;
        uni.uHullCull.value = P.hullCull;
        uni.uHullInner.value = P.hullInner;
        uni.uHullOuter.value = P.hullOuter;
        uni.uHullDrift.value = P.hullDrift;
        uni.uHullSwell.value = P.hullSwell;
        uni.uContactLift.value = P.contactLift;
        uni.uSubReach.value = P.subReach;
      }
      uni.uShadowOcc.value = P.shadowOcclude;
      uni.uContactAmt.value = P.contactAmount;
      uni.uContactSize.value.set(CONFIG.boat.lengthW * 0.52 * P.contactSize,
                                 CONFIG.boat.lengthW * 0.20 * P.contactSize);
      uni.uSmearK.value = P.reflectSmear;
      uni.uToneAmt.value = P.toneAmount;
      uni.uToneDist.value.set(P.toneNear, P.toneFar);
      // ⚠ 발자국은 배 길이에서 파생시킨다 — CONFIG.boat.lengthW 를 바꾸면 같이 따라온다
      // ⚠⚠ **선체보다 넉넉히 커야 한다.** 처음에 선체 실루엣과 같은 크기(0.5×0.17)로
      //   뒀더니 그림자가 통째로 **선체 뒤에 가려져** 화면에서 바뀐 픽셀이 160개,
      //   최대 3레벨이었다 — 사실상 안 보였다. 실측 곡선 (밝기 낮춘 픽셀 / 최대) :
      //     0.50×0.17 →    160 / 3      0.75×0.32 →  5,638 / 14
      //     1.00×0.42 → 15,621 / 21     1.30×0.55 → 32,636 / 25
      //   보이는 것은 **선체 밖으로 삐져나온 부분뿐**이라 발자국을 배 길이의 2배로 잡는다
      uni.uShadowSize.value.set(CONFIG.boat.lengthW * 1.00 * P.shadowSize,
                                CONFIG.boat.lengthW * 0.42 * P.shadowSize);
      // 배 그림자 ② — 해 쪽 주광이 **지금 그림자를 드리우고 있을 때만** 읽는다 (낮은 앞 빛이 드리운다 · applyTime).
      //   ⚠ 맵은 첫 그림자 렌더에서 생기고 크기를 바꾸면 새로 만들어진다 — 매 프레임 다시 잡는다.
      //   ⚠ 행렬은 **참조로** 문다 — three 가 그림자 패스(같은 render 안, 물보다 먼저)에서 갱신한 값이 그대로 올라간다
      {
        const L = sunShadow, amt = P.waterSunShadow === undefined ? 0 : P.waterSunShadow;
        const on = amt > 0 && P.boatShadow > 0 && L && L.castShadow && L.intensity > 0 && L.shadow.map;
        uni.uSunShK.value.x = on ? amt * (Dv ? 1 - Dv.dim : 1) : 0;
        // ⚠ ②가 돌면 선체 **발자국(①)은 쉰다** — 발자국은 드리운 그림자를 타원 하나로 흉내 낸 것이라, 진짜 그림자와 같이 두면
        //   배 곁이 두 겹으로 어두워진다. 광원이 없는 접촉 그림자(주변 차폐)는 그대로 둔다. 낮 · low 단계는 발자국 그대로다
        if (on) uni.uShadowAmt.value = 0;
        if (on) {
          const sc = L.shadow.camera, range = Math.max(1e-3, sc.far - sc.near);
          uni.uSunSh.value = L.shadow.map.texture;
          uni.uSunShMat.value = L.shadow.matrix;
          uni.uSunShK.value.set(uni.uSunShK.value.x, (P.waterSunShadowBias === undefined ? 0.03 : P.waterSunShadowBias) / range,
            P.waterSunShadowSoft === undefined ? 0.03 : P.waterSunShadowSoft, P.waterSunShadowSoft0 === undefined ? 0.05 : P.waterSunShadowSoft0);
          // 배(겨누는 점)의 깊이 — 그림자 카메라는 겨누는 점에서 빛 쪽으로 L.position − target 만큼 떨어져 있다
          const aim = L.position.distanceTo(L.target.position);
          uni.uSunShSpan.value.set(sc.right - sc.left, sc.top - sc.bottom, range, (aim - sc.near) / range);
          const r0 = P.waterSunShadowReach0 === undefined ? 6 : P.waterSunShadowReach0;
          uni.uSunShReach.value.set(r0, Math.max(r0 + 0.5, P.waterSunShadowReach1 === undefined ? 22 : P.waterSunShadowReach1));
        }
      }
      uni.uGlitter.value = P.glitter;
      uni.uGlitOct2.value = P.glitterOct2;
      uni.uShine.value = P.shine;
      uni.uGlitCell.value = P.glitterCell;
      uni.uRefract.value = P.refract;
      uni.uDepth.value = P.floorDepth;
      uni.uSwellOff.value.set(sim.qScroll.x, -sim.qScroll.z);
      // 거리 페이드의 원점은 카메라의 실제 월드 XZ 다. x 를 0 으로 굳히면 카메라를 옆으로
      // 옮기거나 Top View 로 올리는 순간 원경이 비대칭으로 지워진다
      uni.uCam.value.set(cam.position.x, cam.position.z);
      // ⚠ 항공뷰(검증용)에서는 거리 LOD 를 끈다. 안 끄면 카메라 바로 아래만 잔물결이
      // 살아 동심원 무늬가 생기고, 그게 방향 판정을 오염시킨다 — 검증 도구가 거짓말을 한다
      // ⚠ 카메라가 물러난 만큼 페이드·LOD 를 같이 민다 (camDist). 안 밀면 물러나도
      // 새로 보이는 바다가 흰 여백에 먼저 지워져서 화면이 안 넓어진다
      // ⚠ main.js 가 존 전환으로 **보간한 값**을 넘긴다 ([5단계]). 안 넘어오면 예전대로
      //   P.camDist 를 쓴다 — 카메라와 페이드가 같은 값을 봐야 화면상 물끝이 상쇄된다 (§23-1)
      const kD = Math.max(0.2, camK === undefined ? P.camDist : camK);
      // ⚠ detailK — 품질 단계 low 가 0.6 으로 당긴다 (먼 물이 일찍 잔잔해진다 · 거리로 걸러지는 층이 그만큼 일찍 안 돈다)
      const dK = Math.max(0.1, P.detailK === undefined ? 1 : P.detailK);
      uni.uDetail0.value = P.topView ? 1e5 : CONFIG.surface.detail0 * kD * dK;
      uni.uDetail1.value = P.topView ? 2e5 : CONFIG.surface.detail1 * kD * dK;
      uni.uGlintDist.value.set((P.glintNear === undefined ? 7 : P.glintNear) * kD,
                               Math.max((P.glintNear === undefined ? 7 : P.glintNear) + 0.5, P.glintFar === undefined ? 18 : P.glintFar) * kD);
      // ⚠ 바닥 격자의 근경 창도 같이 민다 — 안 밀면 카메라를 물릴 때 조용히 사라진다
      uni.uFloorNear.value.set(7.0 * kD, 14.0 * kD);
      // ⚠ params 가 CONFIG 의 사본이다 — 없으면 CONFIG 로 떨어진다 (하늘 값 셋과 같은 패턴).
      //   확정하면 CONFIG 쪽을 고치고 여기 사본은 그대로 둔다
      const wf0 = P.waterFade0 !== undefined ? P.waterFade0 : CONFIG.surface.fade0;
      const wf1 = P.waterFade1 !== undefined ? P.waterFade1 : CONFIG.surface.fade1;
      uni.uFade0.value = wf0 * kD;
      // ⚠ smoothstep 은 edge0 >= edge1 이면 무너진다 (경계가 하드 컷이 된다).
      //   슬라이더 둘이 독립이라 뒤집힐 수 있으므로 최소 폭 0.5 를 남긴다
      uni.uFade1.value = Math.max(wf1, wf0 + 0.5) * kD;
      // ⭐ 지평선 빛띠의 자리 — 바다가 다 녹는 거리가 곧 화면 속 바다 끝이다 (sky.js `syncHorizonGlow`). 녹는 거리 · 카메라 높이가 바뀌는 곳이 여기라 여기서 민다
      syncHorizonGlow(cam.position.y, uni.uFade1.value, P);
      // ⚠ 하늘이 없으면 하늘색으로 녹을 수도 없다 — stageAmount 를 곱해 둘을 묶는다.
      //   그래서 `stageAmount = 0` 한 값이 여전히 예전 화면으로 정확히 되돌린다
      const fs = P.waterFadeSky !== undefined ? P.waterFadeSky : 1;
      // ⭐ 잠수 — 하늘이 지워지는 만큼(stage.js · 위 diveSky 와 **같은 값**) 물끝도 하늘 대신 `uBg` 로 녹는다
      uni.uFadeSky.value = fs * (P.stageAmount === undefined ? 1 : P.stageAmount) * diveSky;
    },

    dispose() {
      scene.remove(mesh);
      mesh.geometry.dispose();
      mesh.material.dispose();
    }
  };
}
