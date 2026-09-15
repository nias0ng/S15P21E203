import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { Pass, FullScreenQuad } from 'three/examples/jsm/postprocessing/Pass.js';
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
//
// ⚠ 꺼져 있으면(bloomAmount = 0) 컴포저를 아예 안 태운다. 켜고 끌 때 비용이 0 이어야
// "블룸 때문에 느려진 건가" 를 매번 다시 재지 않는다.
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
//   ⚠ 비용 : 배 깊이 한 번(반쪽 해상도) + 쌍둥이 구 수십 개 + 4분의 1 해상도 블룸 + 전체 화면 합성 한 번.
//     markBloom 0 이면 패스가 통째로 꺼진다 (enabled = false).

// 레이어 — 0 본 화면 · 1 부표 히트박스(레이캐스트) · 2 반사·잠긴 선체 (reflect.js · submerged.js)
export const GLOW_LAYER = 3;   // 부표의 발광 쌍둥이. 본 카메라(레이어 0)에는 안 찍힌다
export const OCC_LAYER = 4;    // 발광을 가리는 것 (배). 매 프레임 GlowPass 가 켜 둔다 — GLB 가 늦게 와도 빠지지 않는다

const HALO_VERT = `
varying vec2 vUv;
void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;

// ⚠ 템플릿 리터럴 안이다 — GLSL 주석에도 백틱을 쓰지 않는다 (빌드가 죽는다)
const HALO_FRAG = `
uniform sampler2D tBase;
uniform sampler2D tHalo;
uniform sampler2D tSrc;
uniform float uKnee;
uniform float uCoreCut;
uniform float uBodyKeep;
varying vec2 vUv;
void main(){
  vec4 base = texture2D(tBase, vUv);
  vec3 h = texture2D(tHalo, vUv).rgb;
  // 번짐은 몸통 **둘레**에만 — 몸통 위에 더하면 가운데까지 1 에 차서 음영이 사라진다 (납작한 원판, 실측 255,236,142 로 평평).
  //   발광원 타깃의 알파가 곧 몸통 마스크다 (쌍둥이 구가 알파 1 을 쓴다). uCoreCut 1 이면 몸통 위 번짐을 다 걷는다
  float src = texture2D(tSrc, vUv).a;
  h *= 1.0 - clamp(src, 0.0, 1.0) * uCoreCut;
  float hm = max(h.r, max(h.g, h.b));
  // 번짐을 누른다 — 우세 채널 기준 Reinhard 라 **색상 비가 그대로** 남는다 (채널별로 누르면 색이 빠진다)
  h /= 1.0 + hm * uKnee;
  vec3 c = base.rgb + h;
  // 더한 것이 1 을 넘으면 채널별로 잘리기 전에 **전체를 같은 비로** 1 에 맞춘다. 번짐이 있는 자리에서만 —
  //   번짐이 없으면 base 그대로다 (비트 단위). 물의 마루처럼 원래 1 을 넘던 자리는 건드리지 않는다
  float cm = max(c.r, max(c.g, c.b));
  float k = smoothstep(0.0, 0.06, hm) * step(1.0, cm);
  // 태양(markSun)일 때는 **몸통 위에서는 맞추지 않는다** — 몸통의 흰 심은 HDR 이라(1.29,1.17,1.19 급) 같은 비로 1 에 맞추면
  //   다시 분홍(255,234,239)이 된다 (실측 — 번짐을 끄면 255,255,255). 흰 심은 흰색이어야 한다. uBodyKeep 0 이면 예전과 같다
  k *= 1.0 - clamp(src, 0.0, 1.0) * uBodyKeep;
  c = mix(c, c / max(cm, 1e-4), k);
  gl_FragColor = vec4(c, base.a);
}`;

class GlowPass extends Pass {
  constructor(w, h) {
    super();
    this.needsSwap = true;          // 합성은 base 를 읽어 writeBuffer 에 쓴다 (색상 비 맞춤에 base 가 필요하다)
    this.scene = null; this.camera = null; this.occluder = null;
    this.rt = new THREE.WebGLRenderTarget(Math.max(1, w), Math.max(1, h), { type: THREE.HalfFloatType, depthBuffer: true });
    this.rt.texture.generateMipmaps = false;
    // ⚠ 해상도는 발광원 타깃과 같게 준다 — UnrealBloomPass 가 안에서 다시 반으로 줄인다 (= 화면의 4분의 1)
    this.bloom = new UnrealBloomPass(new THREE.Vector2(Math.max(1, w), Math.max(1, h)), 1, 0.5, 0);
    // ⚠ 블룸 패스의 **마지막 가산 합성을 끈다** — 원래는 번짐을 입력 타깃(this.rt) 위에 더하는데, 그러면 발광원 타깃이
    //   번짐으로 오염되어 몸통 마스크(알파)로 못 쓴다. 번짐은 renderTargetsHorizontal[0] 에서 따로 읽는다
    this.bloom.blendMaterial.colorWrite = false;
    this.depthMat = new THREE.MeshBasicMaterial({ colorWrite: false, side: THREE.DoubleSide });
    this.mat = new THREE.ShaderMaterial({
      uniforms: { tBase: { value: null }, tHalo: { value: null }, tSrc: { value: null }, uKnee: { value: 0.6 }, uCoreCut: { value: 0.85 }, uBodyKeep: { value: 0 } },
      vertexShader: HALO_VERT, fragmentShader: HALO_FRAG,
      depthTest: false, depthWrite: false
    });
    this.quad = new FullScreenQuad(this.mat);
    this._clear = new THREE.Color();
  }

  setSize(w, h) {
    // ⚠ 컴포저가 넘기는 w·h 는 이미 픽셀비를 곱한 값이다 — 발광원은 그 반쪽이면 충분하다 (번질 것이다)
    const hw = Math.max(1, Math.round(w * 0.5)), hh = Math.max(1, Math.round(h * 0.5));
    this.rt.setSize(hw, hh);
    this.bloom.setSize(hw, hh);
  }

  render(renderer, writeBuffer, readBuffer) {
    const scene = this.scene, cam = this.camera;
    if (!scene || !cam) return;
    // ── ① 발광원. 배 깊이 → 쌍둥이 구
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
      this.occluder.traverse(o => o.layers.enable(OCC_LAYER));
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

    // ── ② 번짐. ⚠ 마지막에 this.rt 위로 가산 합성까지 하지만 무해하다 — 우리는 번짐 타깃만 읽는다
    const b = this.bloom;
    b.strength = P.markBloom;
    b.radius = P.markBloomRadius === undefined ? 0.55 : P.markBloomRadius;
    b.threshold = P.markBloomThreshold === undefined ? 0 : P.markBloomThreshold;
    b.render(renderer, null, this.rt, 0, false);

    // ── ③ 합성 (base + 번짐 → writeBuffer)
    this.mat.uniforms.tBase.value = readBuffer.texture;
    this.mat.uniforms.tHalo.value = b.renderTargetsHorizontal[0].texture;
    this.mat.uniforms.tSrc.value = this.rt.texture;
    this.mat.uniforms.uKnee.value = P.markBloomKnee === undefined ? 0.6 : P.markBloomKnee;
    this.mat.uniforms.uCoreCut.value = P.markBloomCore === undefined ? 0.85 : P.markBloomCore;
    // 태양이면 몸통 위의 색상 비 맞춤을 건너뛴다 (HALO_FRAG 주석) — marks.js 의 sunOn() 과 같은 조건
    const sun = (P.markSelfLit === undefined ? 1 : P.markSelfLit) >= 0.5 && (P.markSun === undefined ? 1 : P.markSun) >= 0.5;
    this.mat.uniforms.uBodyKeep.value = sun ? 1 : 0;
    renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer);
    this.quad.render(renderer);

    renderer.setClearColor(this._clear, prevAlpha);
    renderer.autoClear = prevAuto;
  }

  dispose() {
    this.rt.dispose();
    this.bloom.dispose();
    this.depthMat.dispose();
    this.mat.dispose();
    this.quad.dispose();
  }
}

export function createBloom(renderer, W, H, { occluder } = {}) {
  let composer = null, bloomPass = null, renderPass = null, glowPass = null;
  let w = W, h = H;

  const build = (scene, cam) => {
    // ⚠⚠ **컴포저 렌더타깃을 직접 만들어 넘긴다 — 안 그러면 블룸을 켜는 순간 MSAA 가 사라진다.**
    //   main.js 는 renderer 를 antialias: true 로 만들지만 그건 **기본 프레임버퍼**의 MSAA 다.
    //   EffectComposer 가 스스로 만드는 타깃은 { type: HalfFloatType } 뿐이라 samples 가 0 이고
    //   (three r160 EffectComposer.js:27), 컴포저를 타는 순간 그 타깃에 그리므로 계단이 생긴다.
    //   선으로 그리는 이 화면에서는 돛·마스트·선체 윤곽이 바로 드러난다.
    //   ⚠ 이건 패스를 늘리는 게 아니라 **기존 타깃의 옵션**이라 "후처리는 블룸 하나만" 과 안 부딪힌다.
    const pr = renderer.getPixelRatio();
    const rt = new THREE.WebGLRenderTarget(w * pr, h * pr, { type: THREE.HalfFloatType, samples: 4 });
    composer = new EffectComposer(renderer, rt);
    renderPass = new RenderPass(scene, cam);
    bloomPass = new UnrealBloomPass(new THREE.Vector2(w, h), 0.6, 0.4, 0.9);
    glowPass = new GlowPass(Math.round(w * pr * 0.5), Math.round(h * pr * 0.5));
    glowPass.occluder = occluder || null;
    composer.addPass(renderPass);
    composer.addPass(bloomPass);
    // ⚠ 전역 블룸 **뒤**다 — 부표 번짐이 물의 번짐에 한 번 더 번지지 않게
    composer.addPass(glowPass);
    composer.addPass(new OutputPass());
    composer.setSize(w, h);
  };

  return {
    get pass() { return bloomPass; },
    get glow() { return glowPass; },

    // main.js 가 renderer.render 대신 이걸 부른다
    render(scene, cam) {
      const needGlobal = P.bloomAmount > 0;
      const needGlow = (P.markBloom || 0) > 0 && (P.markSelfLit === undefined ? 1 : P.markSelfLit) >= 0.5;
      if (!needGlobal && !needGlow) { renderer.render(scene, cam); return; }
      if (!composer) build(scene, cam);
      renderPass.scene = scene;
      renderPass.camera = cam;               // 항공뷰로 바꿔도 따라온다
      bloomPass.enabled = needGlobal;
      bloomPass.strength = P.bloomAmount;
      bloomPass.threshold = P.bloomThreshold;
      bloomPass.radius = P.bloomRadius;
      glowPass.enabled = needGlow;
      glowPass.scene = scene;
      glowPass.camera = cam;
      composer.render();
    },

    // ⚠ EffectComposer 는 픽셀비를 **생성자에서 한 번만** 읽는다 (r160 EffectComposer.js:19).
    //   모니터를 옮겨 renderer.setPixelRatio 가 바뀌면 블룸 켠 화면만 해상도가 어긋난다.
    resize(nw, nh) {
      w = nw; h = nh;
      if (!composer) return;
      composer.setPixelRatio(renderer.getPixelRatio());
      composer.setSize(nw, nh);
    },

    dispose() {
      if (!composer) return;
      composer.passes.forEach(p => p.dispose && p.dispose());
      composer.renderTarget1.dispose();
      composer.renderTarget2.dispose();
      composer = null; bloomPass = null; renderPass = null; glowPass = null;
    }
  };
}
