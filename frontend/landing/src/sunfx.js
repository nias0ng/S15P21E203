import * as THREE from 'three';

// ───────── 역광 — 해 쪽 주광이 등 뒤에서 만드는 빛 두 가지 (2026-09-26, S15P21E203-435) ─────────
// 사용자 : *"역광의 실제 그림자 쉐이더라고 적용해서 역광을 더 극적으로 … 약간 색상만 변하게 한것 같은데"* → 역광 '중간안'.
//   ① 주광을 보이는 해에 둔다 (main.js 의 sunLight) — 카메라를 보는 면이 실제로 그늘이 된다. 그것만으로는 극적이지 않았다 :
//      돛은 얇은 천이라 해를 등지면 빛이 **비쳐야** 빛나고, 윤곽은 해를 향한 가장자리에만 걸려야 한다.
//   ② 그 둘을 여기서 낸다. 재질의 조명 계산은 그대로 두고 **나가는 빛(outgoingLight)에 더한다** :
//      · 윤곽 빛 — 시선에 스치는 가장자리(1 − N·V) 중 **해를 향한 쪽**(N·L)만. 둘레를 고르게 두르는 가짜 테두리가 아니다
//      · 투과 — 보는 면의 **뒤에서** 해가 비칠 때(−N·L) · 해 쪽을 볼수록 세다 (앞으로 흩어지는 빛 · V·L 의 거듭제곱)
//   ⚠ 단위는 three 의 램버트와 같다 (RECIPROCAL_PI) — 그래서 세기 손잡이가 '빛의 몇 할' 로 읽힌다.
//   ⚠ 해의 방향 · 세기는 **주광 그 자체**다 (main.js 가 sunLight 의 색 × 세기를 매 프레임 싣는다). 낮은 주광이 0 이라 이 층도 없다.
//   ⚠ 재질의 기존 onBeforeCompile(돛의 바람 · 돌고래의 휨)을 **감싸서** 잇는다 — 덮어쓰면 그 셰이더가 죽는다.
//   ⚠ 셰이더 코드는 모든 재질이 같고, 무엇을 얼마나 켤지는 **재질마다의 유니폼**(uSunFx)이 쥔다 —
//     three 는 onBeforeCompile 의 소스로 프로그램을 캐시하므로, 코드를 재질마다 달리 짜면 캐시가 섞인다.

// ⚠ 소비자(배 · 돌고래)가 **같은 객체**를 물린다 — 한 곳(main.js)만 갱신하면 다 따라온다 (sky.js 의 SKY_UNIFORMS 와 같은 규율)
export const SUN_FX = {
  uSunDirW: { value: new THREE.Vector3(0, 0.25, -1).normalize() },   // 해 쪽 (월드). main.js 가 물의 uLightDir3 를 **참조로** 물린다
  uSunRad: { value: new THREE.Color(0, 0, 0) }                         // 주광의 색 × 세기 (선형). 0 이면 이 층이 없다
};

// ⚠ 템플릿 리터럴이다 — GLSL 주석에 백틱을 쓰지 않는다 (빌드가 죽는다)
const GLSL = `
{
  vec3 sfL = normalize((viewMatrix * vec4(uSunDirW, 0.0)).xyz);   // 해 쪽 (뷰 공간)
  vec3 sfV = normalize(vViewPosition);                            // 이 점 → 카메라
  vec3 sfN = normalize(normal);                                   // 보는 면의 법선 (양면이면 카메라 쪽으로 뒤집혀 있다)
  float sfNV = clamp(dot(sfN, sfV), 0.0, 1.0);
  float sfNL = dot(sfN, sfL);
  // 윤곽 빛 — 스치는 가장자리 중 해를 향한 쪽
  float sfRim = pow(1.0 - sfNV, 3.0) * clamp(sfNL + 0.3, 0.0, 1.0);
  // 투과 — 해가 이 면의 뒤에 있을 때. 해 쪽을 볼수록 세다
  float sfBack = clamp(-sfNL, 0.0, 1.0);
  float sfFwd = pow(clamp(dot(-sfV, sfL), 0.0, 1.0), uSunFx.z);
  outgoingLight += uSunRad * RECIPROCAL_PI * diffuseColor.rgb
                 * (uSunFx.x * sfRim + uSunFx.y * sfBack * (0.3 + 0.7 * sfFwd));
}
`;

// 이 재질의 세기 유니폼 — x 윤곽 빛 · y 투과 · z 투과가 해 쪽으로 모이는 지수. 재질마다 하나다
const fxUniform = (m) => m.userData.sunFx || (m.userData.sunFx = { value: new THREE.Vector3(0, 0, 6) });
/** 세기 벡터를 돌려준다 — 부르는 쪽이 set(윤곽, 투과, 지수) 로 채운다 */
export const sunFxOf = (m) => fxUniform(m).value;

// ───────── 셰이더 덧대기 사슬 (2026-09-26 — 역광 · 정점 차폐가 같이 쓴다) ─────────
// 한 재질에 덧대는 층이 둘이다 (여기의 역광 · vertexao.js 의 차폐). 둘 다 onBeforeCompile 을 **감싸고**, 감싼 순서는 어느 쪽이 먼저여도 된다.
//   ⚠ 층마다 이름표(tag)를 사슬에 남긴다 — 같은 층을 두 번 감싸면 유니폼 선언이 겹쳐 셰이더가 죽는다.
//     누가 onBeforeCompile 을 통째로 새로 걸면(돛의 바람) 이름표도 같이 사라지므로, 다시 부르면 다시 감싼다.
//   ⚠ 캐시 열쇠는 **부를 때마다 지금의 사슬에서** 만든다 — 이름표들 + 맨 안쪽 원래 함수의 소스.
//     감쌀 때 적어 두면 사슬이 바뀐 뒤(바람을 새로 건 돛) 낡은 열쇠가 남아 다른 재질과 프로그램이 섞인다.
function programKey() {
  const f = this.onBeforeCompile, c = f && f.__chain;
  if (!c) return f ? f.toString() : '';   // three 의 기본값과 같다
  return c.tags.join('+') + '|' + (c.base ? c.base.toString() : '');
}
/**
 * 재질의 onBeforeCompile 에 hook(sh, renderer) 을 잇는다. 이미 그 이름표가 사슬에 있으면 아무것도 안 하고 false.
 * ⚠ hook 은 셰이더 문자열을 replace 로 고친다 — 같은 include 를 다른 층이 먼저 고쳐도 include 줄 자체는 남기므로 이어서 찾을 수 있다.
 */
export function chainShader(m, tag, hook) {
  const prev = m.onBeforeCompile;
  const pc = prev && prev.__chain;
  if (pc && pc.tags.includes(tag)) return false;
  const wrap = function (sh, r) {
    if (prev) prev.call(this, sh, r);
    hook(sh, r);
  };
  wrap.__chain = { tags: pc ? pc.tags.concat(tag) : [tag], base: pc ? pc.base : (prev || null) };
  m.onBeforeCompile = wrap;
  m.customProgramCacheKey = programKey;
  m.needsUpdate = true;
  return true;
}

/**
 * 재질에 역광을 잇는다. **여러 번 불러도 한 번만 감싼다** — 그 사이 누가 onBeforeCompile 을 새로 걸었으면
 * (돛의 바람 셰이더처럼 늦게 걸리는 것) 그것까지 다시 감싼다.
 * ⚠ MeshStandardMaterial · MeshPhysicalMaterial 만 — outgoingLight · normal · vViewPosition 을 쓴다.
 * ⚠ 기존 수정이 opaque_fragment **뒤**에 덧붙인 코드(돌고래의 눕히기 · 안개)는 그대로 뒤에 남는다 — 이 빛은 그 앞, 조명 결과에 더해진다
 */
export function ensureSunFx(m) {
  if (!m || !(m.isMeshStandardMaterial || m.isMeshPhysicalMaterial)) return;
  const fx = fxUniform(m);
  chainShader(m, 'sunfx', (sh) => {
    sh.uniforms.uSunDirW = SUN_FX.uSunDirW;
    sh.uniforms.uSunRad = SUN_FX.uSunRad;
    sh.uniforms.uSunFx = fx;
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
uniform vec3 uSunDirW, uSunRad, uSunFx;`)
      .replace('#include <opaque_fragment>', GLSL + `
#include <opaque_fragment>`);
  });
}
