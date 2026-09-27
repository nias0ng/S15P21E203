import * as THREE from 'three';
import { CONFIG } from './config.js';
import { timeNow } from './times.js';
import { swellMeanDir } from './swell.js';   // 바람 = 너울의 진폭가중 평균 방향 (숫자를 두 번 적지 않는다 · 불변식 2)

// ───────── 하늘 ─────────
// **파일이 아니라 함수다.**
//
// ⚠⚠⚠ **2026-09-20 정정 — 여기 적혀 있던 전제 하나가 낡았다.**
//   *"이 리포지토리에는 텍스처·HDR·GLB 가 한 장도 없다 (거품 무늬도 worley, 배도 코드로 세웠다)"* 는
//   **더 이상 사실이 아니다.** `public/landing/` 에 실측 (2026-09-20) :
//     `boat_v2.glb` **8.3MB** (boat.js) · `dolphin.glb` 40KB (pod.js) · `gate-left/right.webp` 215KB
//     → 합계 **8.2MB**. *"번들 전체가 625KB"* 는 **JS 번들**의 수이고 에셋의 분모가 아니다.
//   그래서 아래 ③(무게)은 **이제 혼자서는 근거가 안 된다** — HDR 1~10MB 는 이미 실려 있는 8.3MB 옆에서
//   결정적이지 않다. 그래도 결론은 그대로다 : ①②가 무게와 **무관하게** 성립하기 때문이다.
//   ⚠ 무게를 근거로 들 때는 **JS 번들인지 에셋 페이로드인지 먼저 밝힌다.**
//
// ⚠⚠ **왜 HDRI 를 안 쓰는가** — ①②가 본론이고 ③은 곁들이다 :
//   ① 물에는 어차피 안 먹는다. water.js 는 커스텀 ShaderMaterial 이라 scene.environment 를
//      자동으로 읽지 않는다 (명세 8.2). 손으로 샘플할 거면 함수가 더 싸다 —
//      큐브맵 페치 대신 산술 몇 줄이고, 픽셀당 해시가 이미 비용인 상황에서 페치를 안 늘린다.
//   ② 팔레트가 싸운다. 우리 색은 좁게 통제된 종이 톤인데 HDRI 는 자기 색을 통째로 들고 온다.
//   ③ 무게. HDR 한 장이 1~10MB + PMREM 프리필터 — ⚠ 위 정정 참고.
//
// ⭐ **2026-09-20 : 구름도 같은 이유로 함수다** (사용자 결정 — 에셋 빌보드와 견준 뒤).
//   ①이 결정적이었다 : 구름을 판때기로 세우면 **물이 그것을 반사하지 않는다.** 이 바다에서
//   구름은 하늘에도 뜨지만 **물에 비쳐서도** 읽히고(수평선 아래 스치는 각이라 프레넬이 세다),
//   그 둘이 같은 구름이라야 한 장면이 된다. 아래 `skyCloud` 참고.
//   ⚠ 구도 실측과 비용 표는 `params.js` 의 구름 묶음 주석에 있다.
//   ⚠⚠ 화면에 드는 하늘은 여전히 **수평선 위 6.1°** 다 (무대 문서 §12-9·§14-3 그대로 — 2026-09-20 재확인).
//     구름의 대부분은 그 위, 즉 **화면 밖**에 산다. 그래도 그리는 이유는 **물이 그것을 반사하기** 때문이다.
//
// ⚠⚠ **하늘의 역할은 "밝게 하기" 가 아니라 "방향마다 다르게 하기" 다.**
//   지금까지 scene.background 는 **플랫 색 하나**였고 scene.environment 는 아예 없었다.
//   물이 반사할 것이 한 가지 색뿐이면 아무리 정반사를 잘 짜도 **모든 방향이 같은 밝기**다.
//   명세 8.2 : *"하늘을 화면에 그리지 않더라도 반사에 사용할 방향별 하늘 조도는 필요하다.
//   흰 배경색 하나를 모든 방향의 동일한 빛으로 대체하면 반사 변화가 약해진다."*
//
// ⚠ 사용자 결정 (2026-09-06) : **흰 종이 톤을 유지한다.** 레퍼런스의 석양으로 가지 않는다 —
//   그건 불변식 *"배경과 바다를 둘 다 따뜻하게 만들지 않는다"* 와 정면으로 부딪힌다.
//   그래서 이 하늘은 전부 종이 팔레트 안(232~250)에 있고, 변화의 폭이 좁은 대신
//   **방향에 따라 확실히 갈린다.**
//
// ⚠⚠ **소비자가 둘인데 같은 하늘을 봐야 한다** (불변식 15 와 같은 요구) :
//   · water.js  — 반사 광선 Rr 로 아래 GLSL 을 직접 호출한다
//   · 배 · 부표 — MeshStandardMaterial 이라 scene.environment 가 자동으로 먹는다.
//                 그 환경맵을 **파일이 아니라 이 함수를 구워서** 만든다 (bakeEnvironment).
//   둘이 다른 하늘을 반사하면 그 순간 같은 장면에 있는 것으로 안 읽힌다.

// 지평선은 **배경색 그대로** 둔다 — 그래야 원경에서 물이 배경으로 이어져 녹아든다.
// 천정은 반 톤 차갑고 어둡다 (실제 하늘도 위가 어둡고 지평선이 밝다).
// ⚠ 천정을 지평선보다 밝게 두지 않는다. 뒤집으면 위를 보는 면이 더 밝아져
//   '물 위에 흰 판이 떠 있는' 것처럼 읽힌다.
// ⚠⚠ **이 표가 기준선(원본)이다.** 2026-09-09 부터 셋(`zenith`·`band`·`broadA`)은 런타임에
//   만질 수 있지만(`params.skyZenith` / `skyBand` / `skyBroadA`), 여기 값은 **안 바꾼다** —
//   `compare.js` 의 [원본] 이 이 값으로 되돌아온다. 값을 확정하면 그때 params 쪽을 고친다.
export const SKY = {
  horizon: '#F6F5F2',   // = CONFIG.color.bg. 246
  zenith:  '#E7EBF1',   // 232, 차가운 쪽
  sun:     '#FFFDF6',   // 태양 로브의 색 (따뜻한 흰)
  // 지평선 → 천정 전이의 폭. 작으면 띠가 생기고, 크면 변화가 안 읽힌다
  // ⚠⚠ **화면에 하늘을 그리기 시작한 뒤(2026-09-09) 이 값이 제일 중요한 손잡이가 됐다.**
  //   `camPitch` 15.4 에서 화면에 보이는 하늘은 **지평선 위 6.1° 뿐**인데 0.55 는 ≈33° 라
  //   그라디언트의 10% 만 화면에 든다 — 천정이 어두운 효과가 거의 안 나타난다.
  //   실측은 `docs/무대와-존-연출.md` §14-3
  //   ⚠ 2026-09-20 재확인 : **위 6.1° 는 지금도 맞다.** (한 번 37% · 15.65° 로 읽고 문서가 낡았다고
  //     적었는데, 그건 `cameraPose` 가 **아직 수렴하지 않은** 카메라에서 잰 값이었다 — params.js 구름 묶음 주석)
  //   ⚠ 저녁(sceneTime 1)은 이 값을 **안 본다** — 시간대 표의 band 0.16 이 이긴다.
  band: 0.55,
  // 태양 로브 : 넓고 옅은 무리 + 좁은 심. 후처리 블룸이 없으니 발광은 이 둘로 흉내 낸다
  broadK: 6.0,  broadA: 0.10,
  tightK: 240.0, tightA: 0.55,
  // ── 구름 (2026-09-20) — 모양을 정하는 아홉은 `params.cloud*` 다. 여기 셋은 **안 만지는 값**이고
  //   `broadK`·`tightK` 와 같은 자리다 (셰이더에 상수로 굳는다).
  // ⚠⚠ **이 값을 올리면 세로 기둥이 생긴다** (2026-09-20 실측, 첫 시안 0.045 = 2.6°).
  //   클램프가 걸린 구간에서는 투영이 **고도와 무관**해져 노이즈가 한 열에서 같은 값이 되고,
  //   그것이 화면에서는 수평선으로 흘러내리는 **세로 커튼**으로 보인다 (구름이 아니다).
  //   0.012(0.7°)로 내려 극단만 막고, 그 위는 안개(`params.cloudLow`)가 덮는다 —
  //   §14-4 가 적어 둔 *"화면을 만드는 것은 실루엣과 그 사이의 안개"* 와 같은 답이다.
  cloudMinY: 0.012,   // 투영을 이 고도(0.7°)에서 멈춘다 — 지평선에서 결이 무한히 압축되는 것을 막는다
  cloudOct2: 2.7,     // 둘째 옥타브의 주파수 배율. ⚠ 정수로 두지 않는다 (격자가 겹쳐 줄이 생긴다)
  cloudW2: 0.38,      // 둘째 옥타브의 몫 (첫째는 1 − 이 값)
  // ⚠⚠ **에일리어싱 문턱** (2026-09-20). w = 픽셀 하나가 덮는 p 의 크기이고 결 하나가 p 1단위다.
  //   나이퀴스트는 w = 0.5 (결 하나에 표본 둘) — 그 앞에서 미리 녹이기 시작한다.
  //   ⚠ 취향 값이 아니라 **표본화 한계**다. params 로 빼지 않는다
  cloudAA0: 0.25, cloudAA1: 0.60,
  // ── 지평선 빛띠 (2026-09-26, S15P21E203-435) — 세기 · 색은 시간대 표(`CONFIG.times[].sky.glow · glowWhite`), 자리는 물이 민다 (`syncHorizonGlow`)
  glowRise: 0.75,     // 바다가 녹는 거리의 이 몫부터 빛띠가 차오른다 (1 = 다 녹은 자리) — 먼 바다가 빛띠로 녹아든다
  glowAz: 0.45        // 해 반대쪽의 세기 (해 쪽 1) — 해가 진 쪽 수평선이 더 밝다
};

const f = (n) => Number(n).toFixed(5);
const c3 = (hex) => { const c = new THREE.Color(hex); return [c.r, c.g, c.b]; };
const gv = (a) => `vec3(${f(a[0])}, ${f(a[1])}, ${f(a[2])})`;

const HOR = c3(SKY.horizon), ZEN = c3(SKY.zenith), SUN = c3(SKY.sun);
// 낮의 지평선·태양색 — 셰이더에 상수로 굳어 있던 **그 숫자 그대로**(소수 다섯째 자리)를 유니폼에 싣는다.
//   그래서 sceneTime 0 은 예전 GLSL 리터럴과 같은 값을 본다
const HOR_DAY = HOR.map(v => +f(v)), SUN_DAY = SUN.map(v => +f(v));

// ⚠⚠⚠ **런타임에 만지는 셋은 유니폼으로 뺐다** (2026-09-09).
//   나머지(로브 지수)는 여전히 셰이더에 상수로 굳어 있다 — 안 만지는 값이다.
//   ⭐ 2026-09-11 밤 : 지평선색·태양색도 유니폼이 됐다 — 시간대(times.js)가 바꾼다. 낮에는 예전 상수 그대로다
//   ⚠ **소비자가 이 객체를 spread 로 가져간다** (`water.js`·`stage.js`). 얕은 복사지만
//     `value` 는 같은 객체를 가리키므로 **한 곳만 갱신하면 둘 다 따라온다** — 갈라질 수 없다.
//     복사본을 만들면 그 순간 규율이 깨진다.
export const SKY_UNIFORMS = {
  uSkyZen:  { value: new THREE.Color(SKY.zenith) },
  uSkyTune: { value: new THREE.Vector2(SKY.band, SKY.broadA) },   // x = band, y = broadA
  uSkyHor:  { value: new THREE.Color(...HOR_DAY) },
  uSkySun:  { value: new THREE.Color(...SUN_DAY) },
  // ⭐ 구름 (2026-09-20). 아홉 값을 vec4 둘 + vec2 하나로 **묶어서** 싣는다 —
  //   소비자가 둘(water · stage)이라 유니폼 하나를 늘리면 셰이더 둘이 같이 늘어난다.
  // ⚠ x(세기)를 0 으로 두고 시작한다. `syncSky` 가 params 에서 채운다
  uCloudA: { value: new THREE.Vector4(0, 0.52, 0.30, 0.55) },     // 세기 · 덮임 문턱 · 가장자리 부드러움 · 그늘
  uCloudB: { value: new THREE.Vector4(0.5, 0.012, 0.12, 0.20) },  // 결 크기 · 아래 페이드 끝 · 위 페이드 시작 · 위 페이드 끝
  // ⚠ xy = **바람이 민 거리(월드 xz)** · z = 해 쪽 가장자리 · w = 위로 갈수록 짙어지는 배수. tickSky 가 xy 를 민다
  uCloudC: { value: new THREE.Vector4(0, 0, 0.10, 1.8) },
  // ⭐ 지평선 빛띠 (2026-09-26). 색 × 세기는 syncSky 가(시간대 · 낮은 0 이라 이 층이 없다), 자리는 syncHorizonGlow 가 매 프레임 채운다
  uHorGlowCol: { value: new THREE.Color(0, 0, 0) },
  uHorGlowGeo: { value: new THREE.Vector3(-0.108, 0.035, 0.044) }   // x = 바다 끝의 고도(sin) · y = 그 아래로 차오르는 폭 · z = 위로 옅어지는 폭(1/e)
};

// params 의 override 를 유니폼과 CPU 양쪽에 밀어 넣는다.
// ⚠ **여기가 유일한 통로다.** GLSL·CPU·환경맵이 전부 이 함수를 거친 값을 본다
// ⚠ 시간대(sceneTime)가 켜져 있으면 **하늘 값 셋(params)을 건너뛰고** 표의 값을 쓴다 (times.js)
export function syncSky(P) {
  const T = timeNow(), S = T && T.sky;
  const zen = S ? S.zenith : ((P && P.skyZenith) || SKY.zenith);
  const band = S ? S.band : ((P && P.skyBand !== undefined) ? P.skyBand : SKY.band);
  const broadA = S ? S.broadA : ((P && P.skyBroadA !== undefined) ? P.skyBroadA : SKY.broadA);
  SKY_UNIFORMS.uSkyZen.value.set(zen);
  SKY_UNIFORMS.uSkyTune.value.set(band, broadA);
  const z = c3(zen);
  ZEN[0] = z[0]; ZEN[1] = z[1]; ZEN[2] = z[2];   // CPU 사본도 같은 값으로
  const h = S ? c3(S.horizon) : c3(SKY.horizon), s = S ? c3(S.sun) : c3(SKY.sun);
  for (let k = 0; k < 3; k++) { HOR[k] = h[k]; SUN[k] = s[k]; }
  if (S) { SKY_UNIFORMS.uSkyHor.value.setRGB(h[0], h[1], h[2]); SKY_UNIFORMS.uSkySun.value.setRGB(s[0], s[1], s[2]); }
  else { SKY_UNIFORMS.uSkyHor.value.setRGB(...HOR_DAY); SKY_UNIFORMS.uSkySun.value.setRGB(...SUN_DAY); }
  CPU.band = band; CPU.broadA = broadA;
  // ⭐ 구름 (2026-09-20) — **시간대 표(`CONFIG.times`)에 없다.** 모양은 `params.cloud*` 하나로
  //   세 시간대가 같이 쓰고, **색은 이 함수가 이미 시간대에서 받은 값**이 정한다 :
  //   그늘은 `uSkyZen`(저녁 #5E5E92) · 해 쪽 가장자리는 `uSkySun`(저녁 #FFB27A).
  //   ⚠ 그래서 저녁·밤으로 바꾸면 구름 **색만** 따라가고 모양은 그대로다 — 의도한 것이다.
  //     표에 구름 칸을 더하면 `config.js` 를 읽는 자리가 하나 늘고, 새 하늘 값마다 표 셋을
  //     같이 채워야 한다 (불변식 25 가 경고하는 *"한 층만 낮에 남는다"* 의 씨앗이다).
  const cA = SKY_UNIFORMS.uCloudA.value, cB = SKY_UNIFORMS.uCloudB.value;
  const pv = (k, d) => (P && P[k] !== undefined) ? P[k] : d;
  cA.set(pv('cloudAmount', 0), pv('cloudCover', 0.52), pv('cloudSoft', 0.30), pv('cloudShade', 0.55));
  cB.set(pv('cloudScale', 0.5), pv('cloudLow', 0.012), pv('cloudTop0', 0.12), pv('cloudTop1', 0.20));
  SKY_UNIFORMS.uCloudC.value.z = pv('cloudRim', 0.10);
  SKY_UNIFORMS.uCloudC.value.w = pv('cloudBase', 1.8);
  CPU.drift = pv('cloudDrift', 0.02);
  // ⭐ 지평선 빛띠의 색 — 태양색을 흰빛 쪽으로 옅게 한다 (glowWhite). 저녁 수평선은 R 이 이미 255 라
  //   태양색(주황)을 그대로 더하면 밝아지지 않고 **채도만 오른다** (2026-09-26 실측 — 세기 0.25 에서 +8 레벨뿐이었다)
  const gA = (S && S.glow ? S.glow : 0) * pv('skyGlowK', 1), gW = S && S.glowWhite !== undefined ? S.glowWhite : 0.5;
  SKY_UNIFORMS.uHorGlowCol.value.setRGB((s[0] + (1 - s[0]) * gW) * gA, (s[1] + (1 - s[1]) * gW) * gA, (s[2] + (1 - s[2]) * gW) * gA);
  // 환경맵을 다시 구울지 판정할 열쇠.
  // ⚠ 구름 값도 넣는다 — 안 넣으면 **배·부표만 구름 없는 하늘을 반사한다** (이 파일이 경고한 그것).
  // ⚠⚠ 흐른 거리(uCloudC.x)는 **안 넣는다.** 넣으면 PMREM 이 매 프레임 돈다 (수십 ms) — tickSky 주석 참고
  return (S ? S.horizon + '/' + S.sun + '/' : '') + zen + '/' + band + '/' + broadA
       + '/' + cA.toArray().join(',') + '/' + cB.toArray().join(',') + '/' + SKY_UNIFORMS.uCloudC.value.z + '/' + SKY_UNIFORMS.uCloudC.value.w
       + '/' + SKY_UNIFORMS.uHorGlowCol.value.getHexString();
}

// ⭐ 지평선 빛띠의 자리 (2026-09-26, S15P21E203-435) — 물이 매 프레임 부른다 (water.js `update` · 녹는 거리를 정한 바로 뒤).
//   바다가 다 녹는 수평 거리(`uFade1`)를 카메라 높이에서 본 고도가 곧 **화면 속 바다 끝**이다 — 항해 −6.2° · 존 · 선실 줌인 −3.9°.
//   ⚠⚠ 참 수평선(고도 0)에 걸지 않는다 — 바다는 그보다 아래서 끝나 사이에 빈 띠가 생긴다 (landing/CLAUDE.md "하지 않는 것")
//   ⚠ 환경맵 열쇠(syncSky 의 반환값)에는 안 넣는다 — 넣으면 카메라가 움직일 때마다 PMREM 이 돈다 (수십 ms)
export function syncHorizonGlow(camY, fadeEnd, P) {
  const y = Math.max(0.05, camY), D = Math.max(1, fadeEnd);
  const yE = -y / Math.hypot(y, D), y0 = -y / Math.hypot(y, D * SKY.glowRise);
  const h = ((P && P.skyGlowH !== undefined) ? P.skyGlowH : 2.5) * Math.PI / 180;
  SKY_UNIFORMS.uHorGlowGeo.value.set(yE, Math.max(1e-4, yE - y0), Math.max(1e-4, Math.sin(h)));
}

// ⭐ 구름이 흐른다 (2026-09-20). main.js 의 틱이 **물의 시각(`sim.qT`)** 으로 부른다.
// ⚠ 불변식 1 그대로다 — 구름은 하늘에 있지만 **물에 비쳐서** 읽히므로, 물과 다른 시계를 타면
//   같은 구름의 두 모습이 조용히 어긋난다 (pod.js 가 `sim.qT` 를 고른 것과 같은 이유).
// ⚠ 미는 자리가 **하나**여야 한다 — `stage.js` 는 `sim` 을 모르고 이 유니폼 객체를 공유만 한다.
// ⚠⚠ **환경맵은 이 값을 안 따라온다** — 굽는 데 PMREM 이 수십 ms 라 매 프레임 못 돈다.
//   그래서 배·부표가 반사하는 구름은 **마지막으로 구운 순간에 멈춰 있다.** 그래도 갈라져 보이지
//   않는 이유는 PMREM 이 거칠기별로 흐려 놓아 **구름 모양이 거기서는 아예 안 읽히기** 때문이다
//   (이 파일의 규율은 *"둘이 다른 하늘을 반사하면 같은 장면으로 안 읽힌다"* — 읽히지 않는 것은 갈라질 수 없다).
//   ⚠ 구름을 **거울 같은 재질**에 비추게 되면 이 전제가 깨진다. 그때 다시 본다.
// ⚠ `cloudDrift 0` 이면 값이 안 움직여 환경맵과 글자 그대로 같다.
export function tickSky(t) {
  const k = t * CPU.drift;
  SKY_UNIFORMS.uCloudC.value.x = WIND[0] * k;
  SKY_UNIFORMS.uCloudC.value.y = WIND[1] * k;
}

// CPU 쪽이 보는 지금 값 (syncSky 가 갱신한다)
// ⚠ 구름은 여기 사본을 안 둔다 — `skyColorCPU` 가 `SKY_UNIFORMS` 를 **직접** 읽는다.
//   사본이 없으면 갈라질 자리도 없다 (band·broadA 가 사본인 것은 그쪽이 먼저 있었기 때문이다).
const CPU = { band: SKY.band, broadA: SKY.broadA, drift: 0 };
// 구름 결의 크기 — 유니폼이 쥐고 있다 (표본 폭을 낼 때 쓴다)
const P_SCALE = () => SKY_UNIFORMS.uCloudB.value.x;
// ⚠⚠ **바람의 방향은 파도의 방향이다** (2026-09-20 사용자 : *"파도가 치는 방향이 바람의 방향"*).
//   그래서 여기서 정하지 않고 `swell.js` 의 진폭가중 평균 방향을 그대로 받는다 — `BANDS` 를 바꾸면
//   구름이 같이 돈다 (불변식 2 : 같은 것을 두 곳에 적지 않는다).
const WIND = swellMeanDir();

// ⚠ GLSL 과 CPU 사본은 **이 한 표에서 생성된다** (swell.js 의 BANDS 와 같은 규율).
//   셰이더에 색을 직접 적으면 구운 환경맵과 물이 조용히 갈라진다.
export const SKY_GLSL = `
uniform vec3 uSkyZen;
uniform vec2 uSkyTune;   // x = 지평선→천정 전이 폭 · y = 넓은 태양 무리의 세기
uniform vec3 uSkyHor;    // 지평선색 (낮 = 예전 상수 그대로 · 시간대가 바꾼다)
uniform vec3 uSkySun;    // 태양(밤에는 달) 로브의 색
uniform vec4 uCloudA;    // 구름 : 세기 · 덮임 문턱 · 가장자리 부드러움 · 그늘
uniform vec4 uCloudB;    // 구름 : 결 크기 · 아래 페이드 끝 · 위 페이드 시작 · 위 페이드 끝
uniform vec4 uCloudC;    // 구름 : xy = 바람이 민 거리(월드 xz) · z = 해 쪽 가장자리 · w = 위쪽 그늘 배수
uniform vec3 uHorGlowCol; // 지평선 빛띠 : 색 × 세기 (0 이면 이 층이 없다 — 낮)
uniform vec3 uHorGlowGeo; // 지평선 빛띠 : x = 바다 끝의 고도(sin) · y = 그 아래로 차오르는 폭 · z = 위로 옅어지는 폭

// ⚠⚠ **water.js 의 hash2 와 다른 함수다** — 범위가 [0,1] 이다 (그쪽은 [−0.5,+0.5],
//   CLAUDE.md 가 한 층을 죽였다고 적어 둔 바로 그 함정). 이름을 나눈 이유는 둘이다 :
//   ① SKY_GLSL 은 WATER_FRAG 에서 hash2 **앞에** 끼어든다 — GLSL 은 선언이 먼저라 못 부른다.
//   ② 같은 이름으로 두면 재정의 오류다.
float skyH(vec2 c){ return fract(sin(dot(c, vec2(12.9898, 78.233))) * 43758.5453); }
float skyVN(vec2 p){
  vec2 i = floor(p), f2 = p - i;
  f2 = f2 * f2 * (3.0 - 2.0 * f2);
  return mix(mix(skyH(i),                  skyH(i + vec2(1.0, 0.0)), f2.x),
             mix(skyH(i + vec2(0.0, 1.0)), skyH(i + vec2(1.0, 1.0)), f2.x), f2.y);
}
// 방향 → 구름 농도 [0,1].
// ⚠⚠ **지평선에서 0 에서 만난다** (불변식 19). 물이 사라지는 자리는 skyColor(아래쪽 방향) =
//   구름 없는 지평선색이라, 구름이 값을 남긴 채 수평선에 닿으면 **그 선이 그림의 일부로 보인다.**
// ⚠ 위에서도 닫는다 — 닫는 자리가 **곧 비용의 상한**이다. 물의 반사 광선은 화면 바닥에서
//   고도 26.1° 까지 서므로, 위 페이드 끝을 내리면 그만큼 물이 이 함수를 건너뛴다.
//   실측 : 끝 0.18 이면 노이즈가 도는 넓이가 화면의 40.7% · 0.42 면 100% 다.
//   자세한 표는 params.js 의 구름 묶음 주석.
float skyCloud(vec3 d){
  // ⚠⚠⚠ **p 와 w 를 분기 밖에서 낸다.** fwidth 는 도함수라 **분기 안에서는 미정의**다 —
  //   띠 밖에서 먼저 return 한 뒤에 재면 띠 경계의 쿼드에서 값이 튄다 (경계에 선이 생긴다).
  vec2 p = d.xz * (uCloudB.x / max(d.y, ${f(SKY.cloudMinY)})) - uCloudC.xy;
  // 픽셀 하나가 덮는 p 의 크기. 결 하나가 p 1단위이므로 w 가 0.5 를 넘으면 나이퀴스트를 넘긴다
  float w = max(fwidth(p.x), fwidth(p.y));
  float band = smoothstep(0.0, max(1e-4, uCloudB.y), d.y)
             * (1.0 - smoothstep(uCloudB.z, max(uCloudB.z + 1e-4, uCloudB.w), d.y));
  if (band <= 0.0) return 0.0;
  // ⚠⚠ **결이 픽셀보다 잘아지면 점표본이 깜빡인다** (2026-09-20 사용자 : *"구름의 선이 너무 얇아져서
  //   지파이팅현상"*). 화각이 속도를 타기 때문에(fov 43 → 54) 가속하면 그 문턱이 위로 올라온다 —
  //   실측 : 고도 2° 에서 결이 쉴 때 2.2px · 가속 1.7px.
  //   그래서 잔 옥타브부터 **평균(0.5)으로 녹인다.** 둘째 옥타브는 주파수가 배라 저절로 먼저 죽는다.
  //   grid.js 가 지평선 모아레를 밀도 페이드로 막는 것과 같은 장치다.
  float lod1 = 1.0 - smoothstep(${f(SKY.cloudAA0)}, ${f(SKY.cloudAA1)}, w);
  float lod2 = 1.0 - smoothstep(${f(SKY.cloudAA0)}, ${f(SKY.cloudAA1)}, w * ${f(SKY.cloudOct2)});
  float n = mix(0.5, skyVN(p), lod1) * ${f(1 - SKY.cloudW2)}
          + mix(0.5, skyVN(p * ${f(SKY.cloudOct2)} + 31.4), lod2) * ${f(SKY.cloudW2)};
  return band * smoothstep(uCloudA.y, uCloudA.y + max(1e-4, uCloudA.z), n);
}
// 방향(단위벡터) → 하늘 색. ⚠ 텍스처가 아니라 함수다 (sky.js 주석 참고)
vec3 skyColor(vec3 d, vec3 sunDir){
  // 위를 볼수록 천정색. 아래(수평선 밑)로는 지평선색을 유지한다 —
  // ⚠ 물이 아래를 반사하는 일은 거의 없지만, 0 으로 떨어뜨리면 스치는 각에서 검게 샌다
  float up = clamp(d.y, 0.0, 1.0);
  // ⚠ band 가 0 이면 smoothstep 의 두 끝이 같아져 미정의다. 바닥을 깐다
  vec3 col = mix(uSkyHor, uSkyZen, smoothstep(0.0, max(1e-4, uSkyTune.x), up));
  // 태양 로브. 넓은 무리 + 좁은 심 (블룸이 없으니 발광은 이 둘로 흉내 낸다)
  float s = max(dot(d, sunDir), 0.0);
  col += uSkySun * (uSkyTune.y * pow(s, ${f(SKY.broadK)})
                     + ${f(SKY.tightA)} * pow(s, ${f(SKY.tightK)}));
  // ⭐ 지평선 빛띠 (2026-09-26, S15P21E203-435) — **바다가 다 녹는 자리 바로 위가 가장 밝고** 위로 옅어진다.
  //   해가 화면 위 바깥(고도 14.4°)이라 넓은 무리가 위쪽 하늘만 밝혀, 하늘이 바다 쪽으로 갈수록 오히려 어두웠다 (210 → 199).
  //   ⚠ 먼 바다가 녹아드는 색도 이 함수다 — 녹는 거리의 뒤쪽(glowRise)부터 차올라 바다가 빛띠로 녹는다 (선이 안 생긴다)
  //   ⚠ 구름 앞에 둔다 — 구름이 빛띠까지 같이 누른다 (태양 로브와 같은 까닭)
  if (uHorGlowCol.r + uHorGlowCol.g + uHorGlowCol.b > 0.0) {
    float gRise = smoothstep(uHorGlowGeo.x - uHorGlowGeo.y, uHorGlowGeo.x, d.y);
    float gFall = exp(-max(d.y - uHorGlowGeo.x, 0.0) / uHorGlowGeo.z);
    vec2 gD = normalize(d.xz + vec2(1e-5, 0.0)), gS = normalize(sunDir.xz + vec2(1e-5, 0.0));
    float gAz = mix(${f(SKY.glowAz)}, 1.0, pow(max(dot(gD, gS), 0.0), 2.0));
    col += uHorGlowCol * (gRise * gFall * gAz);
  }
  // ⭐ 구름 — **태양 로브 뒤에 얹는다.** 구름은 해를 가리는 물건이라 로브까지 같이 눌러야 한다.
  // ⚠⚠ **어둡게 그린다.** 저녁 수평선의 R 은 이미 255 라 밝힐 여지가 없고(실측 : 고도 0.05° 에서
  //   255,202,164 · 3.06° 에서 249,189,163), 태양이 카메라 정면 12° 라 이 구름은 **역광**이다.
  //   몸은 천정색(저녁 = 보랏빛 남색) 쪽으로 눕고, 해 쪽 가장자리만 옅게 데워진다.
  //   불변식 14 *"빛은 그늘로만 그린다"* 가 흰 종이가 아니라 **채널 포화** 때문에 다시 나온 자리다.
  // ⚠ 가장자리는 cl * (1 - cl) 이다 — 농도 0.5 에서 최대라 덩어리 **테두리**에만 걸린다.
  if (uCloudA.x > 0.0) {
    float cl = skyCloud(d);
    // ⚠⚠ **위로 갈수록 짙다** (2026-09-20 사용자 : *"내 윗쪽의 구름은 햇빛을 거의 안받으니"*).
    //   올려다보면 구름의 **밑면**이 보이고 그 면은 그늘이다. 수평선 쪽은 햇빛 받는 옆면이 보여 옅다.
    //   램프의 끝을 uCloudB.z(위 페이드 시작)로 둔다 — 보이는 하늘을 딱 덮는 자라 숫자를 새로 안 만든다.
    float shade = uCloudA.w * mix(1.0, uCloudC.w, smoothstep(0.0, max(1e-4, uCloudB.z), d.y));
    col = mix(col, uSkyZen, clamp(cl * shade * uCloudA.x, 0.0, 1.0));
    col += uSkySun * (uCloudC.z * uCloudA.x * cl * (1.0 - cl) * pow(s, 3.0));
  }
  return col;
}`;

// ── 구름의 CPU 사본 ──
// ⚠⚠ 위 GLSL 의 `skyH` · `skyVN` · `skyCloud` 와 **글자 그대로 같은 식**이다.
//   갈라지면 배·부표의 환경맵만 다른 구름을 반사한다 (`swell.js` 의 GPU/CPU 규율과 같은 자리).
// ⚠ `fract(sin(x) * 43758.5453)` 은 GPU 의 float32 와 JS 의 float64 에서 **끝자리가 다르다.**
//   값이 완전히 갈리는 해시라 환경맵의 구름 무늬는 화면의 것과 픽셀 단위로 같지 않다 —
//   PMREM 이 흐려 놓아 모양이 안 읽히므로 이것은 문제가 아니다 (tickSky 주석의 같은 이유).
//   ⚠⚠ **그래서 이 식으로 화면과 환경맵을 대조하지 않는다.** 대조할 것은 *덮인 몫*이지 무늬가 아니다.
const fr = (x) => x - Math.floor(x);
const skyHJ = (cx, cy) => fr(Math.sin(cx * 12.9898 + cy * 78.233) * 43758.5453);
function skyVNJ(px, py) {
  const ix = Math.floor(px), iy = Math.floor(py);
  let fx = px - ix, fy = py - iy;
  fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy);
  const a = skyHJ(ix, iy), b = skyHJ(ix + 1, iy), c = skyHJ(ix, iy + 1), d = skyHJ(ix + 1, iy + 1);
  const ab = a + (b - a) * fx, cd = c + (d - c) * fx;   // = mix(mix(a,b,f.x), mix(c,d,f.x), f.y)
  return ab + (cd - ab) * fy;
}
const sstep = (e0, e1, x) => { const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };
function skyCloudCPU(dx, dy, dz, w) {
  const A = SKY_UNIFORMS.uCloudA.value, B = SKY_UNIFORMS.uCloudB.value, C = SKY_UNIFORMS.uCloudC.value;
  const band = sstep(0, Math.max(1e-4, B.y), dy) * (1 - sstep(B.z, Math.max(B.z + 1e-4, B.w), dy));
  if (band <= 0) return 0;
  const k = B.x / Math.max(dy, SKY.cloudMinY);
  const px = dx * k - C.x, py = dz * k - C.y;   // ⚠ GLSL 과 같이 **뺀다**
  // ⚠⚠ **여기에는 도함수가 없다 — 표본 폭(w)을 부르는 쪽이 넘긴다.**
  //   GLSL 은 화면 픽셀에서 `fwidth(p)` 로 재고, 환경맵은 텍셀에서 잰다 (bakeEnvironment).
  //   같은 식에 **각자의 표본 폭**을 넣는 것이지 갈라지는 것이 아니다 —
  //   둘 다 *"내 표본보다 잔 결은 평균으로 녹인다"* 를 한다.
  //   ⚠ 안 넘기면 0 = 밴드리밋 없음(무한 해상도)이다. 화면을 예측하려고 이 함수를 부를 때는
  //     그 화면의 픽셀당 p 변화를 재서 넘겨야 GLSL 과 같은 그림이 나온다.
  const lod1 = 1 - sstep(SKY.cloudAA0, SKY.cloudAA1, w);
  const lod2 = 1 - sstep(SKY.cloudAA0, SKY.cloudAA1, w * SKY.cloudOct2);
  const n1 = 0.5 + (skyVNJ(px, py) - 0.5) * lod1;
  const n2 = 0.5 + (skyVNJ(px * SKY.cloudOct2 + 31.4, py * SKY.cloudOct2 + 31.4) - 0.5) * lod2;
  const n = n1 * (1 - SKY.cloudW2) + n2 * SKY.cloudW2;
  return band * sstep(A.y, A.y + Math.max(1e-4, A.z), n);
}

// CPU 사본. ⚠ 위 GLSL 과 **글자 그대로 같은 식**이다 (환경맵을 굽는 데 쓴다)
export function skyColorCPU(dx, dy, dz, sun, w = 0) {
  const up = Math.min(1, Math.max(0, dy));
  const bd = Math.max(1e-4, CPU.band);
  const t = up <= 0 ? 0 : up >= bd ? 1
    : (() => { const x = up / bd; return x * x * (3 - 2 * x); })();
  const s = Math.max(0, dx * sun[0] + dy * sun[1] + dz * sun[2]);
  const lobe = CPU.broadA * Math.pow(s, SKY.broadK) + SKY.tightA * Math.pow(s, SKY.tightK);
  const out = [
    HOR[0] + (ZEN[0] - HOR[0]) * t + SUN[0] * lobe,
    HOR[1] + (ZEN[1] - HOR[1]) * t + SUN[1] * lobe,
    HOR[2] + (ZEN[2] - HOR[2]) * t + SUN[2] * lobe
  ];
  // ⭐ 지평선 빛띠 — GLSL 과 같은 식 · 같은 자리 (로브 뒤 · 구름 앞)
  const gc = SKY_UNIFORMS.uHorGlowCol.value;
  if (gc.r + gc.g + gc.b > 0) {
    const G = SKY_UNIFORMS.uHorGlowGeo.value;
    const rise = sstep(G.x - G.y, G.x, dy), fall = Math.exp(-Math.max(dy - G.x, 0) / G.z);
    const hx = dx + 1e-5, sx = sun[0] + 1e-5;
    const cd = Math.max(0, (hx * sx + dz * sun[2]) / (Math.hypot(hx, dz) * Math.hypot(sx, sun[2])));
    const k = rise * fall * (SKY.glowAz + (1 - SKY.glowAz) * cd * cd);
    out[0] += gc.r * k; out[1] += gc.g * k; out[2] += gc.b * k;
  }
  // ⭐ 구름 — GLSL 과 같은 순서(로브 뒤)여야 한다. 구름이 로브를 누르는 것이 이 층의 뜻이다
  const A = SKY_UNIFORMS.uCloudA.value;
  if (A.x > 0) {
    const cl = skyCloudCPU(dx, dy, dz, w);
    const B = SKY_UNIFORMS.uCloudB.value, C = SKY_UNIFORMS.uCloudC.value;
    const shade = A.w * (1 + (C.w - 1) * sstep(0, Math.max(1e-4, B.z), dy));   // ⚠ GLSL 의 mix 와 같은 식
    const sh = Math.min(1, Math.max(0, cl * shade * A.x)), rim = C.z * A.x * cl * (1 - cl) * Math.pow(s, 3);
    for (let k = 0; k < 3; k++) out[k] = out[k] + (ZEN[k] - out[k]) * sh + SUN[k] * rim;
  }
  return out;
}

// ── 환경맵을 굽는다 ──
// 배·부표(MeshStandardMaterial)가 scene.environment 로 자동으로 읽는다.
// ⚠ 64² 로 충분하다. 이 하늘은 태양 로브 말고는 저주파라 크게 구울 이유가 없고,
//   PMREM 이 어차피 거칠기별로 흐린 단계를 만든다.
// ⚠ 한 번만 굽는다 (하늘 상수를 바꿀 때만 다시). 매 프레임 도는 것이 아니다.
// ⚠⚠ **등장방형 DataTexture 로 굽는다.** 처음에는 CubeTexture 에 plain object
//   `{data, width, height}` 여섯 장을 넣었는데 **업로드가 안 됐다** — PMREM 은 통과해서
//   336×256 텍스처가 나왔지만 `envMapIntensity` 를 20 배로 올려도 **화면이 한 픽셀도
//   안 바뀌었다** (그렇게 검증했다). three 의 확실한 raw 경로는 DataTexture 다.
// ⚠ 이 함수는 **한 번만** 돈다 (하늘 상수를 바꿀 때만 다시). 매 프레임이 아니다.
export function bakeEnvironment(renderer, W = 128) {
  const H = W >> 1;
  // ⚠ 구름의 표본 폭을 **이번에 굽는 크기**에서 낸다 (skyCloudCPU 의 w · 숫자를 두 곳에 안 적는다).
  //   텍셀 하나의 극각이 π/H 이고 p 의 반경이 scale/dy 이므로, 그 미분이 텍셀당 p 변화다.
  // ⚠⚠ 128×64 는 텍셀이 2.8° 라 **고도 20° 아래의 구름은 여기서 통째로 녹는다.**
  //   PMREM 이 어차피 거칠기별로 흐려 모양이 안 읽히므로 문제가 아니다 — 에일리어싱한
  //   쓰레기 값을 굽는 것보다 낫다. ⚠ 환경맵을 크게 굽게 되면 이 전제를 다시 본다.
  const texRad = Math.PI / H;
  const sun = new THREE.Vector3(...CONFIG.sun).normalize();
  const S = [sun.x, sun.y, sun.z];
  const data = new Uint8Array(W * H * 4);
  for (let y = 0; y < H; y++) {
    // v=0 이 위(천정), v=1 이 아래. theta 는 천정에서 잰 극각
    const th = ((y + 0.5) / H) * Math.PI;
    const st = Math.sin(th), ct = Math.cos(th);
    for (let x = 0; x < W; x++) {
      const ph = ((x + 0.5) / W) * Math.PI * 2;
      const cw = texRad * (P_SCALE() / Math.max(ct * ct, SKY.cloudMinY * SKY.cloudMinY));
      const col = skyColorCPU(st * Math.sin(ph), ct, st * Math.cos(ph), S, cw);
      const i = (y * W + x) * 4;
      // ⚠ 선형 → sRGB. 텍스처를 SRGBColorSpace 로 표시하므로 여기서 인코딩한다.
      //   안 하면 환경 반사만 유독 어둡게 나온다
      for (let k = 0; k < 3; k++) {
        const v = Math.max(0, Math.min(1, col[k]));
        const e = v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055;
        data[i + k] = Math.round(e * 255);
      }
      data[i + 3] = 255;
    }
  }
  const tex = new THREE.DataTexture(data, W, H, THREE.RGBAFormat);
  tex.mapping = THREE.EquirectangularReflectionMapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();
  const env = pmrem.fromEquirectangular(tex).texture;
  pmrem.dispose();
  tex.dispose();
  return env;
}
