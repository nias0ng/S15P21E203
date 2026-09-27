import * as THREE from 'three';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { FullScreenQuad } from 'three/examples/jsm/postprocessing/Pass.js';
import { PARAMS as P } from './params.js';

// ───────── 블룸 (후처리) ─────────
//
// ⚠ CLAUDE.md 는 오랫동안 "후처리를 임의로 추가하지 않는다" 였다. 이건 **사용자 결정**으로
// 들인 것이다 (2026-09-02). 이유 : 이 팔레트에서는 '번지는 빛' 을 다른 방법으로 못 만든다.
// 흰 종이 위 흰 물이라 마루의 흰 이음매가 248 이어도 주변이 213 이고, 그 차이로는
// 발광이 아니라 '조금 밝은 자국' 으로만 읽힌다.
//
// ⚠⚠ **이 바다에서 블룸의 문턱은 아주 높아야 한다.** 물이 이미 213~236 이라
// 일반적인 문턱(0.7~0.85)을 쓰면 화면 전체가 번지고, 그건 흰 종이 위에서
// **그림을 지우는 것**이다 (불변식 14). 흰 이음매(248)만 걸리는 자리를 실측으로 찾는다.
// ⚠⚠ 2026-09-25 실측 (저녁 · tone 0.85) : 물의 HDR 최댓값이 **1.16** 이고 휘도 1.40 을 넘는 픽셀이 **0%** 였다 —
//   전역 블룸은 비용만 쓰고 아무것도 번지게 하지 않았다. 지금 이 문턱을 넘는 것은 수면의 **태양 반짝임**(water.js `uGlintAmt`)뿐이다.
// ⭐⭐ **반짝임이 빽빽한 자리에서 번짐이 우윳빛 막이 됐다** (2026-09-26, S15P21E203-435). 사용자 : *"파도의 블룸값이 너무 쌘 느낌이 있어서
//   확대했을때 아예 바다 부분이 표현이 안되는 경우도 있음"*. 존 도착 · 선실 줌인처럼 태양 빛길이 화면을 채우는 구도에서 드러났다.
//   원인 둘 : ① 문턱을 넘은 픽셀은 **초과분이 아니라 밝기 전부**가 번진다 — 1.5 짜리 알갱이 수천 개가 1.5 씩 쌓인다
//             ② 더한 값이 1 을 넘으면 흰색으로 잘린다 (톤 매핑이 없다) — 0.8 인 물 위에서는 그 자리 결이 통째로 지워진다
//   ⚠ UnrealBloomPass 의 가산 합성은 알파(= 세기 × 밉 가중 합 3.0)를 **한 번 더** 곱한다 — 넓게 밝은 자리의 번짐은 세기² × 9 로 붙는다 (0.70 → 4.41배)
//   그래서 표준 처리 둘을 넣었다 (각각 0 이면 예전 식 그대로) :
//     bloomKnee — 문턱을 **넘은 만큼만** 번진다 (BRIGHT_FRAG · Unity · Blender 의 soft knee). ⚠ 폭은 문턱의 10% 안 — 넓히면 문턱이 사실상
//                 내려가 물(천장 1.16~1.25)이 통째로 번진다 (0.5 면 곡선이 휘도 0.7 부터 시작한다)
//     bloomKeep — 이미 밝은 곳에는 덜 더한다 (FINAL_FRAG · 1 이면 스크린 합성) — 어떤 구도에서도 물결이 흰색으로 잘려 없어지지 않는다
//   실측 (3200×1620 · 저녁 · high · 같은 장면의 블룸 켬 − 끔) — 번짐 = 12레벨 넘게 뜬 몫 · 잘림 = 결이 있던 곳(<240)이 흰색(≥250)이 된 몫
//     · 결 = 잔결(3×3 평균과의 차)이 남은 비 (1 = 그대로) :
//                              번짐            잘림             결
//     항해 (화면 아래 55%)      10.3 → 2.6%     0.48 → 0%        0.80 → 0.92
//     존 도착                   10.3 → 4.9%     1.48 → 0.12%     0.80 → 0.88
//     선실 줌인 0.5             14.1 → 4.3%     1.08 → 0.01%     0.81 → 0.91
//     배 앞 근경 빛길 (확대)     41.6 → 5.8%     1.15 → 0%        0.72 → 0.90
//     배 뒤 빛길 (확대)          53.7 → 18.3%    4.02 → 0.01%     0.64 → 0.84
//   ⚠ 세기(bloomAmount)는 0.70 → 0.80 으로 **올렸다** — 두 처리가 번짐을 1/3~1/4 로 줄여서, 가장 밝은 알갱이의 빛무리를 조금 되돌린 것이다.
//   ⚠ 입력 상한(clamp)도 시험했는데 초과분만 번지게 하면 거의 할 일이 없어 넣지 않았다 (1.0 에서 근경 번짐 6.0 → 5.3% 뿐).
//
// ⭐⭐ **부표만 번지는 블룸 — `GlowPass`** (2026-09-11 오후). 사용자 : *"향수 부표 자체가 빛나는 표현 … emission 값을 통해서
//   bloom … 흰색으로만 빛나는 경우가 생길텐데 (three.js unreal_bloom 예제)를 통해서 해당 값을 잘 조절해줬으면"*.
//   ⚠ 위의 전역 블룸으로는 **색을 지킬 수 없다.** 밝기 문턱으로 부표를 고르려면 부표가 물(천장 1.25)보다 밝아야 하는데,
//     채도 높은 색이 휘도 1.40 을 넘으려면 우세 채널이 3 을 넘어야 하고 → 톤 매핑이 없어 **채널별로 1 에서 잘려 흰색**이 된다.
//     markGlow 7.0 에서 실제로 그렇게 됐다 (params.js 주석). 문턱을 낮추면 물이 번진다 — 막다른 길이다.
//   ⭐ 그래서 **발광원을 따로 그린다** — 선택적 블룸 (three.js 의 unreal_bloom_selective 예제와 같은 생각) :
//     ① 부표마다 **쌍둥이 구**(레이어 3, 순색 × exposure)를 두고 그것만 반쪽 해상도 타깃에 그린다.
//        배는 먼저 **깊이만** 그린다(레이어 4) — 배 뒤의 부표가 돛을 뚫고 번지면 안 된다.
//     ② 그 타깃에 UnrealBloomPass 를 돌린다 (문턱 0 — 발광원이 부표뿐이라 물이 끼어들 수 없다).
//     ③ 번짐만 본 화면에 더한다. ⚠ 더한 값이 1 을 넘으면 **색상 비를 지키며** 1 로 맞춘다 — 채널별로 잘리면 흰색이다.
//        ⚠ 번짐은 몸통 **둘레**에만 얹는다 (markBloomCore) — 몸통 위에 얹으면 가운데부터 1 에 차서 원판이 된다 (실측).
//   ⚠ 부표의 **몸통**은 여전히 본 패스에서 제 재질로 그려진다 (marks.js). 몸통은 1 아래에서 색을 지키고, 번짐은 여기서 낸다 —
//     그래서 둘을 따로 조절할 수 있다 (예전에는 몸통 밝기가 곧 번짐의 문턱이라 한쪽을 올리면 다른 쪽이 날아갔다).
//   ⚠ 이것도 **블룸 하나**다 — 새 종류의 후처리가 아니라 같은 블룸의 발광원을 고른 것이다 (CLAUDE.md : 후처리는 블룸 하나만).
//
// ⭐⭐⭐ **MSAA 는 장면 한 장에만 건다** (2026-09-25, S15P21E203-435). 예전에는 EffectComposer 의 두 타깃이 **둘 다** MSAA 4 였고
//   (`rt.clone()` 이 samples 를 복사한다), 전역 블룸의 가산 합성 · 부표 번짐 합성 · OutputPass 가 전부 **전체 화면 한 장씩을 MSAA 타깃에 쓰고
//   다시 해석**했다. 실측 (Intel Arc 내장 · 2048×1356) : 풀스크린 사각형 한 장이 MSAA HalfFloat 타깃에 2.68ms · 보통 타깃에 0.87ms.
//   컴포저 전체 22.8ms 중 MSAA 몫이 ~11ms 였는데 장면만 MSAA 로 그리면 5.9ms 다 — 계단 줄이기가 필요한 것은 **장면의 윤곽**(돛 · 마스트 · 선체)뿐이다.
//   그래서 컴포저를 걷고 순서를 직접 쥔다 :
//     ① 장면 → `sceneRT` (HalfFloat · MSAA = 품질 단계 · `render()` 끝에서 three 가 한 번 해석한다)
//     ② 전역 블룸의 밉 사슬 (반쪽 해상도부터 · **마지막 가산 합성을 안 한다**)
//     ③ 부표 번짐의 원천 · 밉 사슬 (반쪽 · 4분의 1)
//     ④ **합성 한 번** → 화면 : 장면 + 전역 블룸 + 부표 번짐(색상 비 맞춤) + 출력 색공간 — 예전 가산 합성 · HALO_FRAG · OutputPass 를 한 셰이더로 합쳤다
//   ⚠ 식은 예전 셋을 **글자 그대로** 옮겼다 (가산 합성의 SRC_ALPHA · ONE 까지). 달라진 것은 중간 결과를 HalfFloat 타깃에 두 번 적던 반올림뿐이다.
//   ⚠ 그래서 화면 버퍼에는 MSAA 가 필요 없다 — main.js 가 `antialias: false` 로 만든다 (화면 × 4표본 버퍼가 통째로 빠진다).
//   ⚠ MSAA 표본 수는 `setSamples()` 로 바꾼다 (quality.js). 0 이면 계단이 남는 대신 장면 패스가 ~40% 가벼워진다.

// 레이어 — 0 본 화면 · 1 부표 히트박스(레이캐스트) · 2 반사·잠긴 선체 (reflect.js · submerged.js)
export const GLOW_LAYER = 3;   // 부표의 발광 쌍둥이. 본 카메라(레이어 0)에는 안 찍힌다
export const OCC_LAYER = 4;    // 발광을 가리는 것 (배). 매 프레임 GlowPass 가 켜 둔다 — GLB 가 늦게 와도 빠지지 않는다

const FINAL_VERT = `
varying vec2 vUv;
void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;

// ⚠ 템플릿 리터럴 안이다 — GLSL 주석에도 백틱을 쓰지 않는다 (빌드가 죽는다)
const FINAL_FRAG = `
uniform sampler2D tScene;
uniform sampler2D tBloom;
uniform sampler2D tHalo;
uniform sampler2D tSrc;
uniform float uBloomOn;
uniform float uBloomKeep;
uniform float uGlowOn;
uniform float uKnee;
uniform float uCoreCut;
uniform float uBodyKeep;
varying vec2 vUv;
void main(){
  vec4 base = texture2D(tScene, vUv);
  vec3 c = base.rgb;
  float a = base.a;
  // 전역 블룸 — UnrealBloomPass 의 마지막 가산 합성과 같은 식이다 (CopyShader × AdditiveBlending = SRC_ALPHA · ONE)
  if (uBloomOn > 0.5) {
    vec4 bl = texture2D(tBloom, vUv);
    vec3 b = bl.rgb * bl.a;
    // 이미 밝은 곳에는 덜 더한다 (bloomKeep · 1 이면 스크린 합성) — 1 에 차 흰색으로 잘리면 그 자리 물결이 지워진다
    if (uBloomKeep > 0.0) c += b * mix(vec3(1.0), clamp(1.0 - c, 0.0, 1.0), uBloomKeep);
    else c += b;
    a += bl.a * bl.a;
  }
  // 부표 번짐 — 예전 GlowPass 의 HALO_FRAG 그대로 (base = 장면 + 전역 블룸)
  if (uGlowOn > 0.5) {
    vec3 h = texture2D(tHalo, vUv).rgb;
    // 번짐은 몸통 **둘레**에만 — 몸통 위에 더하면 가운데까지 1 에 차서 음영이 사라진다 (납작한 원판, 실측 255,236,142 로 평평).
    //   발광원 타깃의 알파가 곧 몸통 마스크다 (쌍둥이 구가 알파 1 을 쓴다). uCoreCut 1 이면 몸통 위 번짐을 다 걷는다
    float src = texture2D(tSrc, vUv).a;
    h *= 1.0 - clamp(src, 0.0, 1.0) * uCoreCut;
    float hm = max(h.r, max(h.g, h.b));
    // 번짐을 누른다 — 우세 채널 기준 Reinhard 라 **색상 비가 그대로** 남는다 (채널별로 누르면 색이 빠진다)
    h /= 1.0 + hm * uKnee;
    c += h;
    // 더한 것이 1 을 넘으면 채널별로 잘리기 전에 **전체를 같은 비로** 1 에 맞춘다. 번짐이 있는 자리에서만 —
    //   번짐이 없으면 base 그대로다. 물의 마루처럼 원래 1 을 넘던 자리는 건드리지 않는다
    float cm = max(c.r, max(c.g, c.b));
    float k = smoothstep(0.0, 0.06, hm) * step(1.0, cm);
    // 태양(markSun)일 때는 **몸통 위에서는 맞추지 않는다** — 몸통의 흰 심은 HDR 이라(1.29,1.17,1.19 급) 같은 비로 1 에 맞추면
    //   다시 분홍(255,234,239)이 된다 (실측 — 번짐을 끄면 255,255,255). 흰 심은 흰색이어야 한다. uBodyKeep 0 이면 예전과 같다
    k *= 1.0 - clamp(src, 0.0, 1.0) * uBodyKeep;
    c = mix(c, c / max(cm, 1e-4), k);
  }
  gl_FragColor = vec4(c, a);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

// 전역 블룸의 밝은 곳 뽑기 — three 의 LuminosityHighPassShader 를 대신한다 (부표 번짐 GlowPass 는 예전 것 그대로).
//   uKnee 0 이면 예전과 같은 식이다 (문턱을 넘은 픽셀의 **밝기 전부**가 번진다 · 휘도도 예전의 601 계수)
//   uKnee > 0 : 문턱을 **넘은 만큼만** 번진다 (Unity · Blender 의 soft knee 와 같은 2차 곡선 — 폭은 문턱 × uKnee)
const BRIGHT_FRAG = `
uniform sampler2D tDiffuse;
uniform float uThresh;
uniform float uKnee;
varying vec2 vUv;
void main(){
  vec4 texel = texture2D(tDiffuse, vUv);
  float v = dot(texel.rgb, vec3(0.299, 0.587, 0.114));
  float w;
  if (uKnee > 0.0) {
    float k = uThresh * uKnee;
    float rq = clamp(v - uThresh + k, 0.0, 2.0 * k);
    w = max(rq * rq / (4.0 * k), v - uThresh) / max(v, 1e-4);
  } else {
    w = smoothstep(uThresh, uThresh + 0.01, v);
  }
  gl_FragColor = vec4(texel.rgb * w, texel.a * w);
}`;

// UnrealBloomPass.render 의 ① 밝은 곳 뽑기 ② 밉 흐림 ③ 밉 합치기만 돈다 — **마지막 가산 합성을 빼고** 합친 번짐 텍스처를 돌려준다.
//   ⚠ 순서 · 재질은 three r160 `UnrealBloomPass.render` 와 같다 (0.160.1 고정 — 내부 이름을 읽는다. GlowPass 는 예전부터
//     `renderTargetsHorizontal[0]` 을 읽고 있었다). three 를 올리면 여기부터 본다
//   bright : ① 을 대신할 재질 (전역 블룸의 BRIGHT_FRAG). 없으면 UnrealBloomPass 제 것을 쓴다
function bloomMips(bp, renderer, src, bright) {
  renderer.getClearColor(bp._oldClearColor);
  const oldAlpha = renderer.getClearAlpha(), oldAuto = renderer.autoClear;
  renderer.autoClear = false;
  renderer.setClearColor(bp.clearColor, 0);

  if (bright) {
    bright.uniforms.tDiffuse.value = src;
    bright.uniforms.uThresh.value = bp.threshold;
    bp.fsQuad.material = bright;
  } else {
    bp.highPassUniforms.tDiffuse.value = src;
    bp.highPassUniforms.luminosityThreshold.value = bp.threshold;
    bp.fsQuad.material = bp.materialHighPassFilter;
  }
  renderer.setRenderTarget(bp.renderTargetBright);
  renderer.clear();
  bp.fsQuad.render(renderer);

  let input = bp.renderTargetBright;
  for (let i = 0; i < bp.nMips; i++) {
    const m = bp.separableBlurMaterials[i];
    bp.fsQuad.material = m;
    m.uniforms.colorTexture.value = input.texture;
    m.uniforms.direction.value = UnrealBloomPass.BlurDirectionX;
    renderer.setRenderTarget(bp.renderTargetsHorizontal[i]);
    renderer.clear();
    bp.fsQuad.render(renderer);
    m.uniforms.colorTexture.value = bp.renderTargetsHorizontal[i].texture;
    m.uniforms.direction.value = UnrealBloomPass.BlurDirectionY;
    renderer.setRenderTarget(bp.renderTargetsVertical[i]);
    renderer.clear();
    bp.fsQuad.render(renderer);
    input = bp.renderTargetsVertical[i];
  }

  bp.fsQuad.material = bp.compositeMaterial;
  bp.compositeMaterial.uniforms.bloomStrength.value = bp.strength;
  bp.compositeMaterial.uniforms.bloomRadius.value = bp.radius;
  bp.compositeMaterial.uniforms.bloomTintColors.value = bp.bloomTintColors;
  renderer.setRenderTarget(bp.renderTargetsHorizontal[0]);
  renderer.clear();
  bp.fsQuad.render(renderer);

  renderer.setClearColor(bp._oldClearColor, oldAlpha);
  renderer.autoClear = oldAuto;
  return bp.renderTargetsHorizontal[0].texture;
}

// 부표 번짐의 원천 (① 배 깊이 → 쌍둥이 구) 과 그 번짐 (②). 합성은 createBloom 의 마지막 한 장이 한다
class GlowPass {
  constructor(w, h) {
    this.rt = new THREE.WebGLRenderTarget(Math.max(1, w), Math.max(1, h), { type: THREE.HalfFloatType, depthBuffer: true });
    this.rt.texture.generateMipmaps = false;
    // ⚠ 해상도는 발광원 타깃과 같게 준다 — UnrealBloomPass 가 안에서 다시 반으로 줄인다 (= 화면의 4분의 1)
    this.bloom = new UnrealBloomPass(new THREE.Vector2(Math.max(1, w), Math.max(1, h)), 1, 0.5, 0);
    this.depthMat = new THREE.MeshBasicMaterial({ colorWrite: false, side: THREE.DoubleSide });
    this.occluder = null;
    this._clear = new THREE.Color();
  }

  setSize(w, h) {
    // ⚠ 넘어오는 w·h 는 이미 픽셀비를 곱한 값이다 — 발광원은 그 반쪽이면 충분하다 (번질 것이다)
    const hw = Math.max(1, Math.round(w * 0.5)), hh = Math.max(1, Math.round(h * 0.5));
    this.rt.setSize(hw, hh);
    this.bloom.setSize(hw, hh);
  }

  // 돌려주는 것 : 번짐 텍스처 (4분의 1 해상도 합). 몸통 마스크는 this.rt.texture 의 알파다
  render(renderer, scene, cam) {
    const prevBg = scene.background, prevOverride = scene.overrideMaterial, prevMask = cam.layers.mask;
    const prevAuto = renderer.autoClear, prevShadow = renderer.shadowMap.autoUpdate;
    renderer.getClearColor(this._clear);
    const prevAlpha = renderer.getClearAlpha();
    // ⚠ 그림자 맵을 다시 굽지 않는다 — autoUpdate 가 켜져 있으면 render() 마다 1024² 를 새로 그린다
    renderer.shadowMap.autoUpdate = false;
    renderer.autoClear = false;
    scene.background = null;
    renderer.setRenderTarget(this.rt);
    renderer.setClearColor(0x000000, 0);
    renderer.clear(true, true, false);
    if (this.occluder) {
      // ⚠ 매 프레임 켠다 — GLB 는 늦게 오고 모델을 갈아 끼울 수도 있다 (비트 연산 몇 번이다)
      // ⭐ `userData.noOcclude` 는 끈다 (2026-09-27, 최적화 1) — 배의 가는 부품(난간 · 손잡이 · 조타석 …)은 반 해상도 깊이에서 몇 픽셀만 가리는데
      //   삼각형은 배의 53%(14.8만)였다. 매 프레임 도는 패스라 가장 크게 준다. 고르는 것은 boat.js 의 OCCLUDE_KEEP 이다
      this.occluder.traverse(o => { if (o.userData.noOcclude) o.layers.disable(OCC_LAYER); else o.layers.enable(OCC_LAYER); });
      cam.layers.set(OCC_LAYER);
      scene.overrideMaterial = this.depthMat;
      renderer.render(scene, cam);
      scene.overrideMaterial = prevOverride;
    }
    cam.layers.set(GLOW_LAYER);
    renderer.render(scene, cam);
    cam.layers.mask = prevMask;
    scene.background = prevBg;
    renderer.shadowMap.autoUpdate = prevShadow;
    renderer.setClearColor(this._clear, prevAlpha);
    renderer.autoClear = prevAuto;

    const b = this.bloom;
    b.strength = P.markBloom;
    b.radius = P.markBloomRadius === undefined ? 0.55 : P.markBloomRadius;
    b.threshold = P.markBloomThreshold === undefined ? 0 : P.markBloomThreshold;
    return bloomMips(b, renderer, this.rt.texture);
  }

  dispose() {
    this.rt.dispose();
    this.bloom.dispose();
    this.depthMat.dispose();
  }
}

// ⚠ W · H 는 예전 호출 모양을 지키려고 받기만 한다 — 크기는 늘 renderer 의 그리기 버퍼에서 잰다 (픽셀비가 품질 단계를 탄다)
export function createBloom(renderer, W, H, { occluder } = {}) {
  let sceneRT = null, bloomPass = null, glowPass = null, finalMat = null, finalQuad = null, brightMat = null;
  let samples = 4;
  const buf = new THREE.Vector2();

  const size = () => renderer.getDrawingBufferSize(buf);
  const build = () => {
    size();
    sceneRT = new THREE.WebGLRenderTarget(Math.max(1, buf.x), Math.max(1, buf.y), { type: THREE.HalfFloatType, samples });
    sceneRT.texture.generateMipmaps = false;
    bloomPass = new UnrealBloomPass(new THREE.Vector2(Math.max(1, buf.x), Math.max(1, buf.y)), 0.6, 0.4, 0.9);
    glowPass = new GlowPass(Math.round(buf.x * 0.5), Math.round(buf.y * 0.5));
    glowPass.occluder = occluder || null;
    brightMat = new THREE.ShaderMaterial({
      uniforms: { tDiffuse: { value: null }, uThresh: { value: 1 }, uKnee: { value: 0 } },
      vertexShader: FINAL_VERT, fragmentShader: BRIGHT_FRAG,
      depthTest: false, depthWrite: false
    });
    finalMat = new THREE.ShaderMaterial({
      uniforms: {
        tScene: { value: null }, tBloom: { value: null }, tHalo: { value: null }, tSrc: { value: null },
        uBloomOn: { value: 0 }, uBloomKeep: { value: 0 }, uGlowOn: { value: 0 },
        uKnee: { value: 0.6 }, uCoreCut: { value: 0.85 }, uBodyKeep: { value: 0 }
      },
      vertexShader: FINAL_VERT, fragmentShader: FINAL_FRAG,
      depthTest: false, depthWrite: false
    });
    finalQuad = new FullScreenQuad(finalMat);
  };

  return {
    get pass() { return bloomPass; },
    get glow() { return glowPass; },
    get target() { return sceneRT; },   // 계측용
    get samples() { return samples; },

    // 장면 패스의 MSAA 표본 수 (quality.js). ⚠ 타깃을 버려 다음 장에 새 표본 수로 다시 만든다 — 셰이더는 다시 안 만든다
    setSamples(n) {
      const s = Math.max(0, Math.round(n || 0));
      if (s === samples) return;
      samples = s;
      if (sceneRT) { sceneRT.samples = s; sceneRT.dispose(); }
    },

    // main.js 가 renderer.render 대신 이걸 부른다
    render(scene, cam) {
      const needGlobal = P.bloomAmount > 0;
      const needGlow = (P.markBloom || 0) > 0 && (P.markSelfLit === undefined ? 1 : P.markSelfLit) >= 0.5;
      // 블룸 둘 다 없고 계단 줄이기도 안 하면 화면에 바로 그린다 — 타깃 · 합성 비용이 0 이다
      if (!needGlobal && !needGlow && samples === 0) { renderer.setRenderTarget(null); renderer.render(scene, cam); return; }
      if (!sceneRT) build();

      renderer.setRenderTarget(sceneRT);
      renderer.render(scene, cam);

      const u = finalMat.uniforms;
      u.tScene.value = sceneRT.texture;
      u.uBloomOn.value = needGlobal ? 1 : 0;
      if (needGlobal) {
        bloomPass.strength = P.bloomAmount;
        bloomPass.threshold = P.bloomThreshold;
        bloomPass.radius = P.bloomRadius;
        brightMat.uniforms.uKnee.value = P.bloomKnee || 0;
        u.uBloomKeep.value = P.bloomKeep || 0;
        u.tBloom.value = bloomMips(bloomPass, renderer, sceneRT.texture, brightMat);
      }
      u.uGlowOn.value = needGlow ? 1 : 0;
      if (needGlow) {
        u.tHalo.value = glowPass.render(renderer, scene, cam);
        u.tSrc.value = glowPass.rt.texture;
        u.uKnee.value = P.markBloomKnee === undefined ? 0.6 : P.markBloomKnee;
        u.uCoreCut.value = P.markBloomCore === undefined ? 0.85 : P.markBloomCore;
        // 태양이면 몸통 위의 색상 비 맞춤을 건너뛴다 (FINAL_FRAG 주석) — marks.js 의 sunOn() 과 같은 조건
        const sun = (P.markSelfLit === undefined ? 1 : P.markSelfLit) >= 0.5 && (P.markSun === undefined ? 1 : P.markSun) >= 0.5;
        u.uBodyKeep.value = sun ? 1 : 0;
      }
      renderer.setRenderTarget(null);
      finalQuad.render(renderer);
    },

    // ⚠ 타깃은 **그리기 버퍼 크기**(CSS 크기 × 픽셀비)로 잡는다. main.js 의 applyResize 가 픽셀비를 바꾼 뒤에 부른다
    resize() {
      if (!sceneRT) return;
      size();
      sceneRT.setSize(Math.max(1, buf.x), Math.max(1, buf.y));
      bloomPass.setSize(Math.max(1, buf.x), Math.max(1, buf.y));
      glowPass.setSize(Math.max(1, buf.x), Math.max(1, buf.y));
    },

    dispose() {
      if (!sceneRT) return;
      sceneRT.dispose();
      bloomPass.dispose();
      glowPass.dispose();
      brightMat.dispose();
      finalMat.dispose();
      finalQuad.dispose();
      sceneRT = null; bloomPass = null; glowPass = null; finalMat = null; finalQuad = null; brightMat = null;
    }
  };
}
