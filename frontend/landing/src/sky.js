import * as THREE from 'three';
import { CONFIG } from './config.js';
import { timeNow } from './times.js';

// ───────── 하늘 ─────────
// **파일이 아니라 함수다.** 이 리포지토리에는 텍스처·HDR·GLB 가 한 장도 없다
// (거품 무늬도 worley, 배도 코드로 세웠다). 하늘만 예외로 두지 않는다.
//
// ⚠⚠ **왜 HDRI 를 안 쓰는가** — 세 가지다 :
//   ① 물에는 어차피 안 먹는다. water.js 는 커스텀 ShaderMaterial 이라 scene.environment 를
//      자동으로 읽지 않는다 (명세 8.2). 손으로 샘플할 거면 함수가 더 싸다 —
//      큐브맵 페치 대신 산술 몇 줄이고, 픽셀당 해시가 이미 비용인 상황에서 페치를 안 늘린다.
//   ② 팔레트가 싸운다. 우리 색은 좁게 통제된 종이 톤인데 HDRI 는 자기 색을 통째로 들고 온다.
//   ③ 무게. HDR 한 장이 1~10MB + PMREM 프리필터. 지금 번들 전체가 625KB 다.
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
  band: 0.55,
  // 태양 로브 : 넓고 옅은 무리 + 좁은 심. 후처리 블룸이 없으니 발광은 이 둘로 흉내 낸다
  broadK: 6.0,  broadA: 0.10,
  tightK: 240.0, tightA: 0.55
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
  uSkySun:  { value: new THREE.Color(...SUN_DAY) }
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
  // 환경맵을 다시 구울지 판정할 열쇠
  return (S ? S.horizon + '/' + S.sun + '/' : '') + zen + '/' + band + '/' + broadA;
}
// CPU 쪽이 보는 지금 값 (syncSky 가 갱신한다)
const CPU = { band: SKY.band, broadA: SKY.broadA };

// ⚠ GLSL 과 CPU 사본은 **이 한 표에서 생성된다** (swell.js 의 BANDS 와 같은 규율).
//   셰이더에 색을 직접 적으면 구운 환경맵과 물이 조용히 갈라진다.
export const SKY_GLSL = `
uniform vec3 uSkyZen;
uniform vec2 uSkyTune;   // x = 지평선→천정 전이 폭 · y = 넓은 태양 무리의 세기
uniform vec3 uSkyHor;    // 지평선색 (낮 = 예전 상수 그대로 · 시간대가 바꾼다)
uniform vec3 uSkySun;    // 태양(밤에는 달) 로브의 색
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
  return col;
}`;

// CPU 사본. ⚠ 위 GLSL 과 **글자 그대로 같은 식**이다 (환경맵을 굽는 데 쓴다)
export function skyColorCPU(dx, dy, dz, sun) {
  const up = Math.min(1, Math.max(0, dy));
  const bd = Math.max(1e-4, CPU.band);
  const t = up <= 0 ? 0 : up >= bd ? 1
    : (() => { const x = up / bd; return x * x * (3 - 2 * x); })();
  const s = Math.max(0, dx * sun[0] + dy * sun[1] + dz * sun[2]);
  const lobe = CPU.broadA * Math.pow(s, SKY.broadK) + SKY.tightA * Math.pow(s, SKY.tightK);
  return [
    HOR[0] + (ZEN[0] - HOR[0]) * t + SUN[0] * lobe,
    HOR[1] + (ZEN[1] - HOR[1]) * t + SUN[1] * lobe,
    HOR[2] + (ZEN[2] - HOR[2]) * t + SUN[2] * lobe
  ];
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
  const sun = new THREE.Vector3(...CONFIG.sun).normalize();
  const S = [sun.x, sun.y, sun.z];
  const data = new Uint8Array(W * H * 4);
  for (let y = 0; y < H; y++) {
    // v=0 이 위(천정), v=1 이 아래. theta 는 천정에서 잰 극각
    const th = ((y + 0.5) / H) * Math.PI;
    const st = Math.sin(th), ct = Math.cos(th);
    for (let x = 0; x < W; x++) {
      const ph = ((x + 0.5) / W) * Math.PI * 2;
      const col = skyColorCPU(st * Math.sin(ph), ct, st * Math.cos(ph), S);
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
