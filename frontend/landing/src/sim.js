import * as THREE from 'three';
import { CONFIG } from './config.js';
import { PARAMS as P } from './params.js';
import { lerp, clamp, toUv, h2f } from './util.js';
import { SWELL_MAIN, FOAM_CLUMP, swellEnvCPU } from './swell.js';
// 선체가 물을 붙잡는 자리 · 부력 프로브 창의 중심. **뱃머리 쪽**이라 부호가 진행 방향을 따른다.
// ⚠ 뱃머리는 로컬 −z 다 (불변식 0-2). 2026-09-08 이전엔 +0.15 였는데, 그때는 GLB 뱃머리가
//   +z 로 뒤집혀 있었다 — 바로잡으면서 이쪽도 같이 뒤집는다 (불변식 0-2-1).
const BOW_Z = -0.15;


// ───────── 수면 파동 시뮬레이션 ─────────
// 노이즈가 아니라 실제 파동방정식을 핑퐁 렌더타깃으로 푼다.
// 텍스처 채널 : x = 높이, y = 속도, z = 항적, w = 부서짐(거품)
//
// 손대기 전에 알아야 하는 것
//  · c ≥ 0.5 는 발산한다. 파를 크게 하려면 c 가 아니라 sim.height 나 PARAMS.swell 을 올린다.
//  · 물리 타임스텝(step)과 갱신 리듬(PARAMS.simFps)은 다른 것이다. step 을 키우면
//    스텝당 감쇠가 초당 감쇠를 약화시켜 누적 발산한다. 느리게 보이고 싶으면 simFps 를 내린다.
//  · 이류(advection)는 정수 텍셀 단위로만 민다. 소수로 밀면 매 스텝 바이리니어 보간이
//    걸려 잔물결이 전부 뭉개진다.
//  · 가장자리 스펀지가 uv 0.29 부터 진폭을 깎는다. 파면을 그 밖에서 낳으면 태어나자마자 먹힌다.

const SIM_VERT = `
varying vec2 vUv;
void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

// 높이맵 한 스텝. x = 높이, y = 속도
const SIM_FRAG = `
precision highp float;
` + SWELL_MAIN + FOAM_CLUMP + `
uniform sampler2D uPrev;
uniform float uDomain;         // 이 격자가 덮는 월드 크기 (텍셀 → 월드 좌표 변환용)
uniform float uFoamDecay, uFoamSteep, uFoamHigh;
uniform float uFoamFront, uFoamFrontW;
// v0.60 쇄파 무리. ⚠ 칸 · 비 · 흐름(uFoamClumpCell/Stretch/Flow)은 FOAM_CLUMP 가 선언한다 — 여기 다시 적으면 중복 선언 에러다
uniform float uFoamClump, uFoamClumpSpan, uFoamClumpQLo, uFoamClumpQHi;
uniform vec2 uTexel;
uniform vec2 uShift;   // 배가 나아간 만큼 수면을 뒤로 흘려보냄 (이류)
uniform float uC, uDamp;
uniform vec4 uBow;     // xy = uv 위치, z = uv 반경, w = 붙잡는 정도
uniform vec4 uAmb;     // xy = 파면 중심(uv), z = 두께, w = 진폭
uniform vec2 uAmbDir;  // 파면의 법선 (단위벡터, uv 공간)
uniform float uAmbLen; // 파면 길이 (uv)
uniform float uBowDepth;
uniform float uTrailDecay;
varying vec2 vUv;
void main(){
  vec2 uv = vUv + uShift;
  vec4 h = texture2D(uPrev, uv);
  float n = texture2D(uPrev, uv + vec2(0.0, uTexel.y)).x;
  float s = texture2D(uPrev, uv - vec2(0.0, uTexel.y)).x;
  float e = texture2D(uPrev, uv + vec2(uTexel.x, 0.0)).x;
  float w = texture2D(uPrev, uv - vec2(uTexel.x, 0.0)).x;
  h.y = (h.y + (n + s + e + w - 4.0 * h.x) * uC) * uDamp;
  h.x += h.y;
  // 흡수층(sponge). 가장자리로 갈수록 매 스텝 조금씩 깎아 파도가 벽에 닿기 전에 소멸한다
  vec2 d = abs(vUv - 0.5) * 2.0;
  h.xy *= 1.0 - 0.32 * smoothstep(0.58, 1.0, max(d.x, d.y));
  h.z *= uTrailDecay * (1.0 - 0.10 * smoothstep(0.58, 1.0, max(d.x, d.y)));  // 항적 채널

  // ── 부서짐(거품) 채널. **이 바다에서 기억을 갖는 두 번째 층이다.**
  //
  // ⚠ 마루의 흰색을 '지금 높이가 임계를 넘었는가'로 그리면 등고선의 얇은 뚜껑이 된다
  // (실제로 그랬다). 거품은 부서진 **자리를 기억**했다가 흩어지는 물질이라야 한다.
  // 그래서 여기서 기록하고 감쇠시킨다 — water.js 는 읽기만 한다.
  //
  // ⚠ 시뮬은 자기 높이만 안다. 화면의 큰 파도는 해석적 너울이라, 그걸 안 보면 마루가
  // 부서지는 것을 통째로 놓친다 (옛 물보라가 죽어 있던 이유가 정확히 이것이다).
  // 그래서 주파 하나를 여기서 같이 푼다
  // ⚠⚠ **uv.y 는 월드 z 와 반대 방향이다** (water.js:35, grid.js 와 같은 규칙).
  // 이걸 안 뒤집고 (vUv - 0.5) 를 그대로 너울에 넘겼더니, 거품이 **좌우로 뒤집힌 바다**의
  // 너울을 보게 됐다 — −45도 너울이 +45도가 되어 거품 줄기가 마루선이 아니라
  // **너울이 가는 방향**으로 누웠다. 정확히 90도 어긋난 것이다.
  // 실측(부감 + 검증 보기) : 마루선 135.8도인데 거품 39.1도, 앞뒤 면은 140.2도로 정상이었다.
  // 불변식 0 이 경고하는 "거품이 마루가 아닌 자리에 남는다" 가 이것이다.
  // uSwellOff 는 이미 (qScroll.x, −qScroll.z) 라 맞다 — 틀린 것은 바탕 좌표뿐이었다
  vec2 wpos = vec2(vUv.x - 0.5, 0.5 - vUv.y) * uDomain + uSwellOff;
  vec3 sm = swellMain(wpos);                                // x·y 는 진폭으로 정규화돼 있다
  // 시뮬 교란도 같은 자로 재서 더한다 — 안 그러면 두 항의 단위가 다르다
  float tot = sm.x + h.x / max(uSwellA * 1.18, 1e-4);
  // ⚠ '가파르고 **동시에** 높은 곳'으로 잡으면 안 된다. 정현파에서 가장 가파른 곳(영교차)과
  // 가장 높은 곳(마루)은 **위상이 90도 어긋나** 있어서, 둘의 곱은 구조적으로 거의 0 이다.
  // 실제로 임계를 0.70 → 0.85 로 올리자 점유가 35% → 0% 로 절벽처럼 떨어졌다.
  // 그래서 **높이가 주 조건**이고 가파름은 가중치다 — 마루에서 나되, 앞면이 선 마루에서 더 난다
  // ⚠⚠ **앞면 가중** (2026-09-06). sm.z 는 부호 있는 기울기다 — 음수가 앞면이다.
  //   예전에는 length() 만 봐서 거품이 마루 **앞뒤 대칭**으로 태어났고, 그래서 화면에서
  //   "파도를 타고 올라왔다가 내려오는" 것처럼 보였다 (사용자 지적 : "양면으로 생긴다").
  //   실제 백파는 파가 나아가는 쪽 **앞면**에서 부서져 쏟아진다.
  // ⚠ **칼이 아니라 치우침이다.** 뒷면을 0 으로 만들면 거품이 통째로 사라진다 —
  //   water.js 의 앞면 항이 같은 실수를 피한 것과 같은 이유다. uFoamFront 는 뒷면을
  //   얼마나 깎을지이고, 1.0 이어도 뒷면이 (1−uFoamFront) 만큼 남는 게 아니라 0 이 되므로
  //   슬라이더 상한을 0.9 로 막았다.
  // ⚠ 여기서 깎으면 **기억(h.w)에 남는 양 자체**가 줄어든다. water.js 의 앞뒤 치우침은
  //   이미 태어난 거품을 칠할 때만 쓰는 것이라 서로 겹치지 않는다 — 여기가 근본이다.
  float front = 1.0 - smoothstep(-uFoamFrontW, uFoamFrontW, sm.z);
  float hr = smoothstep(uFoamHigh, min(1.15, uFoamHigh + 0.25), tot);
  float br = hr
           * (0.35 + 0.65 * smoothstep(uFoamSteep, min(1.15, uFoamSteep + 0.4), sm.y))
           * mix(1.0 - uFoamFront, 1.0, front);
  // ── 쇄파 무리 (v0.60). 사용자 : "일자로 생성되는게아니라 … 상당히 무작위하게 파도 거품군들이 생김" (높은 파도 로직은 유지)
  // ⚠⚠ 판정이 주파 네 대역뿐이라 마루선 방향 최단 변조가 16.7 월드(맥놀이)였다 — 한 마루가 foamHigh 를 넘으면 통째로 부서졌다
  // ⚠ 곱하는 감쇠기가 아니라 국소 진폭에 비례하는 통과 확률이다. 섬 안은 1 · 밖은 0 (창 0.12)
  //   · hr = 0 (foamHigh 아래) 이면 이 블록을 안 탄다 — br 이 거기서 정확히 0 이다 (불변식 19)
  //   · 진폭이 foamHigh + span 이상이면 pc = 1 이라 문턱(QLo~QHi) 대부분을 넘는다. 가장 높은 마루는 길게 부서진다
  // ⚠⚠ amp 는 tot(순간 높이)만이 아니라 국소 진폭 length(sm.xy) 다 — 마루 단면에서 거의 일정해 섬이 단면 전체를 켜고 끈다 (불변식 13).
  //   tot 와 max 를 잡는 것은 파면(amb) · 선체가 올린 몫(h.x)을 잃지 않기 위해서다. 해석 너울만 보면 그 탄생이 통째로 꺼진다
  // ⚠ 같은 난수를 water.js 칠하기 게이트에 곱하지 않는다 — 기억 위를 미끄러지는 도장이 된다 (불변식 0). 난수는 탄생에만 쓴다
  // ⚠ uFoamClump 0 → 분기를 안 타 위 br 그대로다 (hr 로 뺐어도 곱 순서가 원래와 같다 — 비트 단위)
  if (uFoamClump > 0.0 && hr > 0.0) {
    float amp  = max(length(sm.xy), tot);
    float pc   = smoothstep(uFoamHigh, uFoamHigh + max(uFoamClumpSpan, 0.05), amp);
    float qc   = mix(uFoamClumpQLo, uFoamClumpQHi, foamClumpQ(wpos));
    float gate = smoothstep(qc, qc + 0.12, pc);
    br *= mix(1.0, gate, uFoamClump);
  }
  h.w = max(h.w * uFoamDecay * (1.0 - 0.10 * smoothstep(0.58, 1.0, max(d.x, d.y))), br);
  // 교란은 점이 아니라 파면(front). 법선 방향은 가우시안, 파면 방향은 4제곱 —
  // 가운데가 평평하고 끝만 떨어져 선으로 읽힌다 (가우시안이면 양 끝이 뾰족해져 다시 점이 된다)
  vec2 rel = vUv - uAmb.xy;
  float across = dot(rel, uAmbDir);
  float along  = dot(rel, vec2(-uAmbDir.y, uAmbDir.x));
  float fa = across / max(uAmb.z, 1e-4);
  float fl = along / max(uAmbLen, 1e-4);
  h.x += exp(-fa * fa) * exp(-fl * fl * fl * fl) * uAmb.w;
  // 선체는 더하는 게 아니라 '붙잡는다'. 누적되지 않고 흘수만큼 파인 상태를 유지
  float bd = distance(vUv, uBow.xy) / max(uBow.z, 1e-4);
  float grip = clamp(exp(-bd * bd) * uBow.w, 0.0, 1.0);
  h.x = mix(h.x, uBowDepth, grip);
  h.y = mix(h.y, 0.0, grip);
  h.z = max(h.z, grip);
  gl_FragColor = h;
}`;

export function createSim(renderer) {
  const S = CONFIG.sim;
  const cell = S.domain / S.res;

  const rtOpts = {
    type: THREE.HalfFloatType, format: THREE.RGBAFormat,
    minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter,
    wrapS: THREE.ClampToEdgeWrapping, wrapT: THREE.ClampToEdgeWrapping,
    depthBuffer: false, stencilBuffer: false
  };
  let rtA = new THREE.WebGLRenderTarget(S.res, S.res, rtOpts);
  let rtB = new THREE.WebGLRenderTarget(S.res, S.res, rtOpts);

  const uni = {
    uPrev: { value: null },
    uTexel: { value: new THREE.Vector2(1 / S.res, 1 / S.res) },
    uShift: { value: new THREE.Vector2() },
    uC: { value: S.c }, uDamp: { value: S.damping },
    uBow: { value: new THREE.Vector4(0.5, 0.5, 0.02, 0) },
    uAmb: { value: new THREE.Vector4(0.5, 0.5, 0.05, 0) },
    uAmbDir: { value: new THREE.Vector2(0, 1) },
    uAmbLen: { value: S.ambLen / S.domain },
    uBowDepth: { value: S.bowDepth },
    uTrailDecay: { value: lerp(0.985, 0.9995, P.trailLife) },
    uDomain: { value: S.domain },
    uSwellOff: { value: new THREE.Vector2() },
    uTimeQ: { value: 0 }, uSwellA: { value: P.oceanSwell }, uWaveSpeed: { value: P.waveSpeed },
    uCrossA: { value: P.oceanSwell * P.crossAmount },
    // ── 군 포락선 (2026-09-06). ⚠⚠ **여기를 빠뜨리면 조용히 어긋난다** — uEnvAmt 가 0 으로
    //    들어가 거품만 예전 동작이 되고 컴파일 에러는 안 난다. debugView 3 으로 확인한다.
    // ⚠ uEnvGerst 는 SWELL_MAIN 에서 안 쓰이므로 three 가 로케이션을 못 찾고 조용히
    //   건너뛴다 — 정상이다. 표 하나에서 생성되니 같이 넘긴다
    uEnvAmt:   { value: P.envAmount }, uEnvLo:    { value: P.envLo },
    uEnvHi:    { value: P.envHi },     uEnvRLo:   { value: P.envRLo },
    uEnvRHi:   { value: P.envRHi },    uEnvBeta:  { value: P.envBeta },
    uEnvGerst: { value: P.envGerst },  uEnvSpeed: { value: P.envSpeed },
    uFoamDecay: { value: P.foamDecay },
    uFoamSteep: { value: P.foamSteep },
    uFoamHigh: { value: P.foamHigh },
    uFoamFront: { value: P.foamFront }, uFoamFrontW: { value: P.foamFrontW },
    // ── 쇄파 무리 (v0.60). ⚠⚠ update() 의 push 도 같이 넣는다 — 빠뜨리면 0 으로 들어가 조용히 예전 동작이 된다. 확인은 debugView 15 로 한다
    uFoamClump: { value: P.foamClump },         uFoamClumpSpan: { value: P.foamClumpSpan },
    uFoamClumpQLo: { value: P.foamClumpQLo },   uFoamClumpQHi: { value: P.foamClumpQHi },
    uFoamClumpCell: { value: P.foamClumpCell }, uFoamClumpStretch: { value: P.foamClumpStretch },
    uFoamClumpFlow: { value: P.foamClumpFlow }, uFoamCross: { value: P.foamCross }
  };

  const simScene = new THREE.Scene();
  const simCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const simQuad = new THREE.Mesh(
    new THREE.PlaneGeometry(2, 2),
    new THREE.ShaderMaterial({ uniforms: uni, vertexShader: SIM_VERT, fragmentShader: SIM_FRAG })
  );
  simScene.add(simQuad);
  // 렌더타깃 초기화. 클리어 색은 renderer 전역 상태라 반드시 되돌린다 —
  // 안 되돌리면 나중에 붙는 RT·컴포저가 흰 여백이 아니라 투명 검정으로 클리어된다
  const prevClear = renderer.getClearColor(new THREE.Color());
  const prevAlpha = renderer.getClearAlpha();
  renderer.setClearColor(0x000000, 0);
  for (const rt of [rtA, rtB]) { renderer.setRenderTarget(rt); renderer.clear(); }
  renderer.setRenderTarget(null);
  renderer.setClearColor(prevClear, prevAlpha);

  const acc = { x: 0, z: 0 };   // 이류 잔여 (정수 텍셀만 밀고 소수는 다음 스텝으로)
  let simAcc = 0, gate = 0, ambT = 0, ambNext = 0;
  let seaDir = Math.random() * Math.PI * 2;   // 바다의 주방향. 파면들이 여기서 갈라진다
  const probe = new Uint16Array(16 * 16 * 4);
  let probeOK = true;

  const api = {
    cell,
    uni,
    stepped: false,       // 이번 프레임에 물이 갱신됐는가
    qT: 0,                // 물이 마지막으로 갱신된 시각
    qScroll: { x: 0, z: 0 },  // 그때의 항해 위치. 너울 위상과 부력이 같은 값을 봐야 한다
    // ⚠ 이류 잔여(읽기 전용). 텍스처는 **정수 텍셀만** 밀고 소수는 여기 쌓인다 —
    //   쌓인 것이 1 을 넘는 순간 한 텍셀(0.172 월드 ≈ 화면 3px)이 툭 밀린다.
    //   2026-09-12 저녁 '수면 움찔' 진단에서 이 값을 프레임마다 봐야 해서 내보낸다 (framegrab)
    get adv() { return { x: acc.x, z: acc.z }; },
    get texture() { return rtA.texture; },

    update(dt, t, { vX, vZ, mv, scrollX, scrollZ }) {
      const [bu, bv] = toUv(0, BOW_Z);
      uni.uBow.value.set(bu, bv, S.bowR / S.domain, S.bowGrip);
      // 멈춰 있으면 흘수만 살짝, 움직일수록 깊게 누른다
      uni.uBowDepth.value = P.bowDepth * (0.12 + 0.88 * mv);

      // 물의 갱신 시점만 게이트로 막는다. 물리(step / c / damping / 스펀지)는 그대로
      gate += dt;
      const gI = 1 / Math.max(1, P.simFps);
      const stepNow = gate >= gI;
      if (stepNow) {
        gate = Math.min(gate - gI, gI);   // 탭 복귀 시 폭주 방지
        simAcc = Math.min(simAcc + gI, S.step * S.maxSteps);
      }

      // ══ 이번 갱신의 시각·좌표·파라미터를 **루프보다 먼저** 확정한다 ══
      //
      // ⚠⚠ 2026-09-06 수정. 예전에는 이 블록이 while 루프 **뒤에** 있었다. 그래서 거품을
      //   계산하는 렌더(아래 renderer.render)가 **직전 갱신의 시각·스크롤·파라미터**를 보고
      //   돌았다. 마지막에 값이 같아져도 이미 계산된 텍스처가 그 값을 쓴 것은 아니다.
      //   (docs/파도-표현-개선안.md 5.1 이 지적한 것)
      //
      //   실측한 지연 (12Hz 게이트 = 83.3ms, 주파 ω 2.7211 · waveSpeed 0.48) :
      //     · 위상  0.1088 rad = 월드 0.055 = 시뮬 텍셀의 **0.32배**  ← 정지에서는 작다
      //     · 스크롤 정지 표류(0.136/s) 0.011 월드 = 0.07텍셀        ← 무시할 만하다
      //     · 스크롤 **전속(9.1/s) 0.758 월드 = 4.4텍셀**            ← 속도가 붙으면 커진다
      //   즉 이 버그는 **항해할수록 거품이 어긋난다.** 정지 화면으로는 잘 안 보인다.
      //
      // ⚠ 시각뿐 아니라 uSwellA·uWaveSpeed·uEnv*·uFoam* 도 같이 앞으로 왔다. 이것들도
      //   렌더 뒤에 밀려 있어서, 슬라이더를 만지면 시뮬이 한 주기 동안 옛 값으로 돌았다.
      // ⚠ swellEnvCPU 를 부르는 파면 진폭(아래 ambE)도 api.qT 를 본다 — 그래서 이 블록이
      //   루프 앞이라야 파면도 **이번 시각**의 포락선을 본다.
      // ⚠ 거품 채널이 보는 너울의 시각·위상은 **water.js 와 글자 그대로 같아야 한다.**
      //   어긋나면 거품이 마루가 아닌 자리에 남는다 (불변식 0).
      api.stepped = stepNow;
      if (stepNow) {
        api.qT = t;                   // 물의 '현재 시각' 고정
        api.qScroll.x = scrollX;
        api.qScroll.z = scrollZ;
      }
      uni.uTimeQ.value = api.qT;
      uni.uSwellOff.value.set(api.qScroll.x, -api.qScroll.z);
      uni.uSwellA.value = P.oceanSwell;
      uni.uCrossA.value = P.oceanSwell * P.crossAmount;
      uni.uWaveSpeed.value = P.waveSpeed;
      uni.uEnvAmt.value = P.envAmount;     uni.uEnvLo.value = P.envLo;
      uni.uEnvHi.value = P.envHi;          uni.uEnvRLo.value = P.envRLo;
      uni.uEnvRHi.value = P.envRHi;        uni.uEnvBeta.value = P.envBeta;
      uni.uEnvGerst.value = P.envGerst;    uni.uEnvSpeed.value = P.envSpeed;
      uni.uFoamDecay.value = P.foamDecay;
      uni.uFoamSteep.value = P.foamSteep;
      uni.uFoamHigh.value = P.foamHigh;
      uni.uFoamFront.value = P.foamFront;
      uni.uFoamFrontW.value = P.foamFrontW;
      // 쇄파 무리 (v0.60) — 루프 **앞**에서 민다 (위 2026-09-06 주석과 같은 이유)
      uni.uFoamClump.value = P.foamClump;          uni.uFoamClumpSpan.value = P.foamClumpSpan;
      uni.uFoamClumpQLo.value = P.foamClumpQLo;    uni.uFoamClumpQHi.value = P.foamClumpQHi;
      uni.uFoamClumpCell.value = P.foamClumpCell;  uni.uFoamClumpStretch.value = P.foamClumpStretch;
      uni.uFoamClumpFlow.value = P.foamClumpFlow;  uni.uFoamCross.value = P.foamCross;

      while (simAcc >= S.step) {
        simAcc -= S.step;
        acc.x += vX * S.step / cell;
        acc.z += vZ * S.step / cell;
        const nX = Math.trunc(acc.x), nZ = Math.trunc(acc.z);
        acc.x -= nX; acc.z -= nZ;
        uni.uShift.value.set(nX / S.res, nZ / S.res);

        // 파면은 드물게, 진행 방향의 반대쪽 가장자리에서 인다. 프레임이 아니라 경과 시간 기준
        seaDir += S.seaTurn * S.step;              // 주방향 자체는 아주 천천히 돈다
        ambT += S.step;
        const ambIv = Math.max(0.02, P.ambInterval);
        if (ambNext <= 0) ambNext = ambIv;
        // ⚠⚠ **간격이 고정이면 파도가 같은 박자로 태어난다** (2026-09-05 사용자 지적 :
        // "꽤나 빠른 좁은 간격으로 파도가 사라지고 일정거리만큼 이동하면 사라지는걸 반복").
        // 방향·위치는 원래 랜덤이었는데 **박자와 크기가 고정**이라 복제처럼 읽혔다.
        // 매번 다음 간격을 새로 뽑는다 — ambVary 가 흔드는 폭이다 (0 이면 예전 동작 그대로)
        if (ambT >= ambNext) {
          ambT = 0;
          ambNext = ambIv * (1 + P.ambVary * (Math.random() * 1.4 - 0.7));
          // 방향 : 주방향에서 ±ambSpread 안쪽 — 파면들이 대체로 나란해져 바다에 결이 생긴다.
          // 다만 전부 나란하면 서로 지나가지 않아 상호간섭이 없다 — 일부를 교차 방향으로.
          const cross = Math.random() < P.crossSwell;
          const ang = seaDir + (cross ? S.crossAngle : 0)
            + (Math.random() * 2 - 1) * S.ambSpread;
          const dx = Math.cos(ang), dz = Math.sin(ang);
          // 위치 : -방향 쪽 가장자리. 흡수층(uv 0.29)보다 안쪽에서 나야 태어나자마자 먹히지 않는다
          const r = S.ambEdge * (0.78 + Math.random() * 0.22);
          const q = (Math.random() * 2 - 1) * S.ambEdge * 0.85;
          let ox = -dx * r - dz * q, oz = -dz * r + dx * q;
          const olen = Math.hypot(ox, oz) || 1;
          if (olen > S.ambEdge) { ox *= S.ambEdge / olen; oz *= S.ambEdge / olen; }
          // ── 크기·세기의 분산.
          // 예전에는 **모든 파면이 정확히 같은 크기·같은 진폭**이었다 (랜덤은 부호뿐).
          // 파고는 실제로 **레일리 분포**를 따른다 (파도-물리.md 3-4) — 대부분 작고 가끔 크다.
          // 큰 파면은 **더 길고 두껍게도** 만든다(√k). 그래야 작은 것들을 덮으며 지나간다.
          //
          // ⚠⚠ **꼬리를 1.6 에서 자른다.** 진폭은 발산과 직결된다 (CLAUDE.md : 물리 수치).
          // ambVary 를 올리면 최대 진폭이 오늘의 1.6배까지 간다 — 올릴 때는 30초 방치
          // 테스트를 같이 한다 (작업계획 6-1). ambVary = 0 이면 정확히 예전 동작이다.
          const ray = Math.min(1.6, Math.sqrt(-2 * Math.log(1 - Math.random())) / 1.2533);
          const k = 1 + P.ambVary * (ray - 1);     // 평균 1
          const sz = Math.sqrt(k);
          // ⚠⚠ **파면 진폭에도 군 포락선을 건다** (2026-09-06). 이게 없으면
          //   tot = sm.x + h.x/(uSwellA·1.18) 의 **뒤 항이 변조되지 않아**, 잔잔한 구역에도
          //   똑같은 크기의 파면이 똑같은 박자로 지나가고 거기서 거품이 난다.
          //   그러면 "잔잔한 영역"이 절반만 만들어진다 (사용자 요구 1번).
          //   실측 (거친/잔잔 평균 br) : 안 걸면 7.1배 · 걸면 **19.5배**.
          // ⚠ 비용 0 이다 — 초당 2.5회, CPU 프로브 한 번이다 (셰이더가 아니다).
          // ⚠ 파면이 태어난 자리의 포락선을 본다. 파면은 30초에 걸쳐 도메인을 가로지르므로
          //   근사지만, 파면도 군도 같은 바다를 따라 흐르므로 방향이 맞다.
          // 좌표 규약은 SIM_FRAG 의 wpos 와 같다 : (u−0.5, 0.5−v)·domain + uSwellOff
          const ambE = swellEnvCPU(ox * S.domain + api.qScroll.x,
                                   -oz * S.domain - api.qScroll.z, api.qT * P.waveSpeed).es;
          uni.uAmbDir.value.set(dx, dz);
          uni.uAmbLen.value = P.ambLength * sz / S.domain;
          uni.uAmb.value.set(0.5 + ox, 0.5 + oz, S.ambR * sz / S.domain,
            (Math.random() < 0.5 ? -1 : 1) * P.swell * (0.35 + 0.65 * mv)
              * (cross ? S.crossAmp : 1) * k * ambE);
        } else {
          uni.uAmb.value.w = 0;
        }

        uni.uPrev.value = rtA.texture;
        renderer.setRenderTarget(rtB);
        renderer.render(simScene, simCam);
        renderer.setRenderTarget(null);
        const tmp = rtA; rtA = rtB; rtB = tmp;
      }

    },

    // 부력용. 선수 주변 16×16 텍셀을 한 번 읽고, 월드 오프셋 → 높이 함수를 돌려준다.
    // 읽기가 막힌 환경(일부 드라이버)에서는 null — 호출부는 너울만으로 자세를 잡는다.
    sampler() {
      if (!probeOK) return null;
      const PB = 16;
      const [bu, bv] = toUv(0, BOW_Z);
      const cx = bu * S.res, cy = bv * S.res;
      const px = clamp(Math.round(cx) - PB / 2, 0, S.res - PB);
      const py = clamp(Math.round(cy) - PB / 2, 0, S.res - PB);
      try {
        renderer.readRenderTargetPixels(rtA, px, py, PB, PB, probe);
      } catch (e) {
        probeOK = false;
        return null;
      }
      return (ox, oz) => {
        const ix = Math.round(cx - px + ox / cell), iy = Math.round(cy - py - oz / cell);
        const i = (clamp(iy, 0, PB - 1) * PB + clamp(ix, 0, PB - 1)) * 4;
        return h2f(probe[i]) * S.height;
      };
    },

    // 거품 기억(.w) 전체를 읽는다 — 개발 전용 측정 도우미 (v0.60).
    // ⚠ 매 프레임 부르지 않는다 (불변식 11 · 동기 리드백 640² × 4 × 2바이트 = 1.6MB). 문 A · 깜빡임 측정 전용
    // ⚠ 행 0 이 uv.y 0 이다 — 월드 z 와 반대 방향 (SIM_FRAG 의 wpos 규약)
    readFoam() {
      const n = S.res * S.res;
      const buf = new Uint16Array(n * 4);
      try {
        renderer.readRenderTargetPixels(rtA, 0, 0, S.res, S.res, buf);
      } catch (e) {
        return null;
      }
      const w = new Float32Array(n);
      for (let i = 0; i < n; i++) w[i] = h2f(buf[i * 4 + 3]);
      return { w, res: S.res, cell, qT: api.qT };
    },

    apply() {
      uni.uTrailDecay.value = lerp(0.985, 0.9995, P.trailLife);
    },

    // 렌더타깃 2장(640² half × 2 ≈ 6.5MB)과 핑퐁용 풀스크린 쿼드까지 같이 버린다
    dispose() {
      rtA.dispose(); rtB.dispose();
      simQuad.geometry.dispose();
      simQuad.material.dispose();
      simScene.remove(simQuad);
    }
  };

  return api;
}
