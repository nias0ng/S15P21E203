import * as THREE from 'three';
import { PARAMS as P } from './params.js';
import { CONFIG } from './config.js';
import { swellCPU } from './swell.js';
import { areaOf } from './areas.js';
import { timeNow } from './times.js';

// ───────── 수면 타이포 ([6단계], 2026-09-10) ─────────
// 설계는 `docs/무대와-존-연출.md` §6. 향조 이름이 **수면에서 솟는다.**
//
// ⭐ **자산 0 바이트다.** 웹폰트 → Canvas 2D → CanvasTexture → 3D 평면.
//   이미지 넉 장을 뽑지 않는다 (향조가 늘면 다시 뽑아야 하고 무겁다). 텍스처는 **1장을
//   재사용**한다 — 한 번에 한 향조만 보이므로 존이 바뀔 때 같은 캔버스에 다시 굽는다.
//
// ⚠⚠ **폰트 로딩에서 반드시 한 번 문다** (§6). `document.fonts` 를 안 기다리고 그리면
//   **폴백 폰트로 구워지고**, 텍스처는 이미 GPU 에 올라갔으므로 폰트가 나중에 도착해도
//   화면은 영원히 폴백이다. 새로고침하면 캐시 덕에 맞게 나와서 **재현이 들쭉날쭉하다.**
//   → 여기서는 그것보다 한 걸음 더 간다 : 일단 굽고, **폰트가 도착하면 한 번 더 굽는다.**
//     그러면 네트워크가 느리거나 실패해도 글자가 안 보이는 일이 없고, 도착하면 저절로 교정된다.
//
// ⚠⚠ **`cam` 의 자식으로 붙이지 않는다** (§11). 카메라에서 **좌표를 파생**시킨다 —
//   그래야 반사(별도 카메라로 씬을 다시 그린다)와 항공뷰에서 제자리에 선다.
//
// ⚠ **워터라인 클리핑은 CPU 너울로 낸다.** §6 은 `sim.texture` 를 읽는 B안을 권했지만,
//   이 층은 **원경(물끝 근처)에 거의 정지해** 있어서 페치 없이 `swellCPU()` 한 번이면
//   같은 취지를 이룬다 — *"물과 무관하게 움직이는 층은 스티커로 읽힌다"* 의 반대편.
//   ⚠⚠ 대가는 클리핑 선이 **직선**이라는 것이다 (글자 폭 전체가 같은 높이에서 잘린다).
//     원경이라 안 보일 것으로 보고 시작한다 — 티나면 다중 샘플이나 B안으로 올린다.
//   ⚠ `swellCPU` 는 `BANDS` 에서 파생되므로 불변식 2 를 안 건드린다. 식을 여기 옮겨 적지 않는다.
//
// ⚠ **솟는 높이는 물의 시각(`sim.qT`)을 탄다** (§6 · README 규칙 2). 실시간이면 이 층만
//   매끄럽게 미끄러져 *"배는 끊기는데 글자만 부드러운"* 부조화가 난다.
//
// ⚠ 접근성 (§6) — 이 타이포는 **순전히 장식**이다. 같은 글자가 우측 정보 블록의 DOM 제목으로
//   한 번 더 있어야 한다 (`CLAUDE.md` : *"텍스트는 전부 DOM 에 둔다"*). 레퍼런스도 그렇게 한다.

// ⚠⚠ **이 둘을 바꾸면 `index.html` 의 구글 폰트 링크도 같이 고친다.** 두 곳에 적혀 있고
//   하나만 고치면 조용히 폴백으로 구워진다 (그때도 화면에는 글자가 나오므로 안 들킨다).
// ⚠⚠ **2026-09-10 : Anton → Cormorant Garamond** (사용자 지정). 굵은 산세리프에서 가는
//   세리프로 바뀌었다. 300~700 이 따로 있는 static 폰트이므로 링크의 `wght@400` 과 아래
//   WEIGHT 가 **같은 숫자**라야 한다 — 다르면 브라우저가 합성한다.
// ⚠ URL 에서는 공백이 `+` 다 (`Cormorant+Garamond`). 여기서는 따옴표로 감싸므로 공백 그대로다.
// ⚠⚠ 세리프는 산세리프보다 **가늘다.** 흰 물 위에서 사라지지 않도록 색을 충분히 어둡게
//   유지한다 (불변식 14) — 아래 `colorOf` 가 존별로 고른다.
// ⚠⚠ **폭으로 폴백을 판정하지 마라.** v0.22.0 이 세운 그 방법은 Anton 에서만 통했다 —
//   Cormorant Garamond 는 폴백(Pretendard)과 `WOODY` 폭이 **9.6px** 밖에 안 달라서
//   폴백으로 구워져도 못 알아챈다. `document.fonts.check` 와 화면으로 본다.
const FONT = 'Cormorant Garamond';
const WEIGHT = 500;   // ⚠ index.html 링크의 `wght@500` 과 **같은 숫자**라야 한다 (2026-09-10)
const GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
// ⚠ 한글은 Anton 에 없다. `index.html` 이 이미 받고 있는 Pretendard 로 떨어뜨린다 —
//   시스템 폰트 스택이 아니므로 §6 의 *"OS 마다 다르게 나온다"* 에 걸리지 않는다.
//   ⚠ 세로 실측(한글 292 · 라틴 244)은 **Jost 때 값**이다. Anton 은 좁고 길어 다르다 —
//     위치는 굽고 나서 glyphFrac 을 실측하므로 그래도 맞는다
const STACK = (ready) => (ready ? `"${FONT}", ` : '') + 'Pretendard, sans-serif';
// 글자가 캔버스에서 차지할 최대 폭. ⚠ 넘으면 잘린다 — 아래에서 자동으로 줄인다
const MAX_FRAC = 0.92;
// ⚠⚠ `titleWidth` 를 잡은 기준 종횡비 (§24 : *"fov 43 · **16:9** 에서 화면 폭 = 1.40 × dist"*).
//   아래 배치에서 실제 aspect 로 되돌려 곱한다 — 이유는 그 자리 주석.
const ASPECT0 = 16 / 9;
// ⚠⚠ `titleWidth` 는 **이 거리에서의 월드 폭**이다 (2026-09-11 오후). 거리를 바꾸면 폭을 같은 비로 곱한다 —
//   그래서 `titleDist` 는 글자를 **깊이로만** 옮기고 화면 크기는 그대로 둔다.
//   예전에는 폭이 월드 고정이라 거리 82 → 43 으로 당기면 글자가 두 배가 되고, '타이포 크기' 시안(85·95·100)이
//   전부 어긋났다. 82 는 v0.21.0 ~ v0.30.0 의 거리다 — 거기서는 예전과 **비트 단위로 같다**
const REF_DIST = 82;
// 천장 배율의 범위 — 줄이기만 하고(≤ 1), 너무 작아져 안 읽히게 되기 전(0.3)에 멈춘다
const clampK = (k) => (k > 1 ? 1 : k < 0.3 ? 0.3 : k);
// ⚠ 2048×512 RGBA ≈ 4MB. 1장 재사용이라 이걸로 끝이다.
//   ⚠ 4K·dpr2 에서는 부족하다 (§6 은 화면 폭에서 역산하라고 한다) — 그때 키운다.
const TEX_W = 2048, TEX_H = 512;

const VERT = `
varying vec2 vUv;
varying vec3 vW;
void main(){
  vUv = uv;
  vW = (modelMatrix * vec4(position, 1.0)).xyz;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

// ⚠ 캔버스는 **알파 마스크**로만 쓴다 (흰 글자). 색은 여기서 준다 —
//   그래야 색을 바꿀 때 다시 굽지 않아도 되고, 굽는 것과 칠하는 것이 안 섞인다
// ⚠ 아래 FRAG 는 템플릿 리터럴이다 — 그 안의 GLSL 주석에도 백틱을 쓰지 않는다 (빌드가 죽는다)
const FRAG = `
uniform sampler2D uMap;
uniform vec3 uColor;
uniform float uAmount;
uniform float uWaterY;   // 이 자리의 수면 월드 y (CPU 너울)
uniform float uSoft;     // 워터라인 경계 폭 (월드)
uniform float uGrad;     // 밑동이 옅어지는 정도. 0 = 균일 (예전 그대로)
uniform float uGradEnd;  // 글리프 높이의 어디서 완전히 짙어지는가 (0 밑동 ~ 1 꼭대기)
uniform vec2 uGlyphV;    // 글리프의 세로 범위 (uv.y 밑동, 꼭대기). 굽기가 잰다
varying vec2 vUv;
varying vec3 vW;
void main(){
  float a = texture2D(uMap, vUv).a * uAmount;
  // ⚠ 수면 **아래**는 지운다. 이것이 "물에서 솟는다" 의 전부다
  a *= smoothstep(uWaterY - uSoft, uWaterY + uSoft, vW.y);
  // ── 아래에서 위로 짙어진다 (2026-09-11). 색이 아니라 **알파**로 낸다 —
  //   글자 뒤는 거의 밝은 하늘이라 알파를 내리면 곧 옅은 색이 된다.
  //   ⚠ 기준은 평면이 아니라 **글리프**다 (titleLift 와 같은 규약). 글리프는 텍스처 세로의
  //     61% 만 쓴다 (실측 0.195~0.805) — 평면 uv 로 걸면 그라데이션의 약 40% 가 허공에서 소비된다
  float gy = clamp((vUv.y - uGlyphV.x) / max(uGlyphV.y - uGlyphV.x, 1e-4), 0.0, 1.0);
  a *= 1.0 - uGrad * (1.0 - smoothstep(0.0, max(uGradEnd, 1e-3), gy));
  if (a < 0.004) discard;
  gl_FragColor = vec4(uColor, a);
  #include <colorspace_fragment>
}`;

export function createTitle(scene) {
  const _f = new THREE.Vector3();   // 기준 전방을 담아 두는 그릇 (매 프레임 새로 안 만든다)
  const _p = new THREE.Vector3(), _d = new THREE.Vector3();   // 천장 계산용 (투영 · 광선)
  const _bc = new THREE.PerspectiveCamera();   // 천장 계산용 기준 카메라 (패럴랙스 전 — camBase · camBaseQ 로 행렬을 새로 만든다)
  let ceilK = 1;   // 마지막 천장 배율 (콘솔 report 용)
  const canvas = document.createElement('canvas');
  canvas.width = TEX_W; canvas.height = TEX_H;
  const ctx = canvas.getContext('2d');

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;

  const uni = {
    uMap: { value: tex },
    uColor: { value: new THREE.Color(CONFIG.color.text) },
    uAmount: { value: 0 },
    uWaterY: { value: 0 },
    uSoft: { value: 0.35 },
    uGrad: { value: 0 },
    uGradEnd: { value: 0.85 },
    // ⚠ 굽기 전의 자리표시값. draw() 가 실제 글리프 범위로 덮어쓴다
    uGlyphV: { value: new THREE.Vector2(0.25, 0.75) }
  };

  const geo = new THREE.PlaneGeometry(1, 1);
  const mat = new THREE.ShaderMaterial({
    vertexShader: VERT, fragmentShader: FRAG, uniforms: uni,
    transparent: true,
    // ⚠ 깊이는 **읽되 쓰지 않는다.** 읽어야 배가 글자 앞을 지나고(§8 판정 기준),
    //   안 써야 반투명 가장자리가 뒤에 오는 것을 깎지 않는다
    depthTest: true, depthWrite: false,
    side: THREE.DoubleSide, fog: false
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;   // 카메라에서 좌표를 파생시키므로 항상 앞에 있다
  mesh.visible = false;
  mesh.renderOrder = 5;         // 물 뒤, DOM 앞
  scene.add(mesh);
  // ⭐ **반사 패스에서만 옅게** (2026-09-11 오후, `titleReflect`). 글자를 물끝 안쪽(43)으로 당기자 물에 비친
  //   글자가 **뒤집힌 큰 먹 글씨 띠**가 되어 수면을 덮었다 — 82 에서는 물이 옅어 거의 안 보이던 상이다.
  //   반사 카메라는 레이어 2 만 본다(reflect.js) → 레이어 0 이 없으면 반사 패스다.
  //   ⚠ 유니폼은 그리기 직전(onBeforeRender)에 바꾼다 — 패스마다 재질 유니폼이 다시 올라가므로 두 패스가 안 섞인다
  //   ⚠ 1 이면 예전과 같다 (배와 같은 세기). 본 패스의 값은 update() 가 정한 amount 그대로다
  let amountMain = 0;
  mesh.onBeforeRender = (r, s, camera) => {
    const refl = !(camera.layers.mask & 1);
    const k = P.titleReflect === undefined ? 1 : P.titleReflect;
    uni.uAmount.value = refl ? amountMain * k : amountMain;
  };

  // ── 캔버스에 굽는다 ─────────────────────────────────────────────
  let bakedKey = '';
  let fontReady = false;
  // ⚠⚠ 글리프가 캔버스 세로에서 실제로 차지하는 비율. **굽기가 재서 채운다.**
  //   이게 없으면 `titleLift` 가 "평면" 기준이 되는데, 평면에는 글자 위아래로 빈 여백이 있어서
  //   *"밑동을 수면에 걸친다"* 가 계산으로 안 나온다 (실측 : 하단이 수면보다 1.76 월드 위였다).
  // ⚠ `measureText` 의 actualBoundingBox 로는 부족했다 — 실제 픽셀과 **5.8% 어긋나** lift 0
  //   에서 0.273 월드가 남았다. **구운 캔버스를 직접 훑는다** (굽기는 존이 바뀔 때만이라 싸다).
  let glyphFrac = 0.5, glyphMid = 0.5;

  // ⚠ `ctx.letterSpacing` 은 최신 브라우저만 지원한다. 한 글자씩 놓아 **어디서나 같게** 만든다
  function draw(text) {
    const fam = STACK(fontReady);
    const spacing = P.titleSpacing === undefined ? 0.18 : P.titleSpacing;
    // 주어진 크기로 한 줄을 배치했을 때의 글자 폭·자간을 낸다
    const layout = (sz) => {
      ctx.font = `${WEIGHT} ${sz}px ${fam}`;
      const chars = [...text];
      const adv = chars.map(c => ctx.measureText(c).width);
      const gap = sz * spacing;
      const total = adv.reduce((a, b) => a + b, 0) + gap * Math.max(0, chars.length - 1);
      return { chars, adv, gap, total };
    };
    let size = TEX_H * 0.62;
    let L = layout(size);
    // ⚠⚠ **긴 이름은 캔버스를 넘어 잘린다.** 실측 (2026-09-10) :
    //     MEDITERRANEAN 99.9% · OCEANIC BREEZE 97% · '시트러스 블라썸' 99.9% → 전부 좌우가 잘렸다.
    //   폭도 자간도 `size` 에 **선형**이라 비례로 한 번 줄이면 정확히 맞는다.
    //   ⚠ 그래서 긴 이름은 글자가 작아진다 — 잘리는 것보다 낫고, 화면 폭은 일정하게 유지된다
    // ⚠⚠ **폭에 맞춘다 — 줄이기만 하지 않고 키우기도 한다** (2026-09-10, Anton 으로 바꾸며).
    //   예전에는 `if (L.total > maxW)` 라 **넘칠 때만** 줄였다. 그래서 기본 크기(TEX_H*0.62)가
    //   그대로 남는 **좁은 폰트는 텍스처를 절반만 채운다** — Anton 은 52% 였고(실측),
    //   화면에서 평면은 60% 인데 글자는 32% 로 나왔다. `titleWidth` 의 뜻이 그만큼 어긋난다.
    const maxW = TEX_W * MAX_FRAC;
    size *= maxW / L.total; L = layout(size);
    // ⚠ 그다음 **세로**를 본다. 폭을 채우려 키운 글자가 캔버스 높이를 넘을 수 있다 (Anton 처럼
    //   키가 큰 폰트·한글). 넘친 만큼만 되돌린다 — 그러면 폭은 92% 아래로 남는다.
    const pm = ctx.measureText(text || 'H');
    const gH = (pm.actualBoundingBoxAscent || size * 0.72) + (pm.actualBoundingBoxDescent || 0);
    const maxH = TEX_H * MAX_FRAC;
    if (gH > maxH) { size *= maxH / gH; L = layout(size); }

    ctx.clearRect(0, 0, TEX_W, TEX_H);
    ctx.textAlign = 'center';
    // ⚠⚠ `middle` 을 쓰지 않는다 — em 박스 기준이라 대문자만 쓸 때 글리프가 아래로 치우친다
    //   (실측 : 글리프 하단이 캔버스의 0.752 지점). **실제 글리프 박스를 재서 중앙에 맞춘다.**
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = '#fff';        // ⚠ 알파 마스크다 — 색은 셰이더가 준다
    const mm = ctx.measureText(text || 'H');
    const asc = mm.actualBoundingBoxAscent || size * 0.72;
    const desc = mm.actualBoundingBoxDescent || 0;
    const baseY = TEX_H * 0.5 + (asc - desc) * 0.5;   // 글리프 박스의 중앙 = 캔버스 중앙
    let x = (TEX_W - L.total) * 0.5;
    for (let i = 0; i < L.chars.length; i++) {
      ctx.fillText(L.chars[i], x + L.adv[i] * 0.5, baseY);
      x += L.adv[i] + L.gap;
    }
    // ⚠⚠ 구운 뒤 **실제 글리프 세로 범위**를 잰다. 이것이 `titleLift` 의 기준이 된다
    let t = TEX_H, b = -1;
    const img = ctx.getImageData(0, 0, TEX_W, TEX_H).data;
    for (let y = 0; y < TEX_H; y++) {
      for (let x = 0; x < TEX_W; x += 8) {
        if (img[(y * TEX_W + x) * 4 + 3] > 24) { if (y < t) t = y; if (y > b) b = y; break; }
      }
    }
    if (b > t) { glyphFrac = (b - t + 1) / TEX_H; glyphMid = (t + b + 1) * 0.5 / TEX_H; }
    // ⚠ 같은 범위를 그라데이션에도 준다. 캔버스는 **위가 0**, uv 는 **아래가 0** 이다
    //   (CanvasTexture 의 flipY 가 기본 true) — 그래서 1 에서 뺀다
    uni.uGlyphV.value.set(1 - glyphMid - glyphFrac * 0.5, 1 - glyphMid + glyphFrac * 0.5);
    tex.needsUpdate = true;
  }

  function bake(text, force) {
    const key = text + '|' + fontReady + '|' + (P.titleSpacing ?? 0.18);
    if (!force && key === bakedKey) return;
    bakedKey = key;
    draw(text);
  }

  // ⚠⚠ 폰트를 기다린다. 실패해도 **막지 않는다** — 폴백으로 굽고 도착하면 다시 굽는다
  (async () => {
    try { await document.fonts.load(`${WEIGHT} 100px "${FONT}"`, GLYPHS); } catch (e) { /* 폴백 유지 */ }
    try { await document.fonts.ready; } catch (e) { /* 폴백 유지 */ }
    fontReady = document.fonts && document.fonts.check(`${WEIGHT} 100px "${FONT}"`);
    if (bakedKey) bake(bakedKey.split('|')[0], true);   // 이미 구운 것이 있으면 다시 굽는다
  })();

  // ⚠⚠ **존마다 글자 색이 다르다** (2026-09-10, 사용자 요청). 부표 색(`areas[].color`)을
  //   **그대로 쓰지 않는다** — 채도가 높아 대형 타이포에서는 화면을 통째로 물들인다.
  //   같은 계열을 어둡게 눌러 둔 `areas[].titleColor` 를 따로 두고 그것을 읽는다.
  // ⚠ 없으면 `params.titleColor` 로 떨어진다 — 존이 늘어나도 화면이 안 깨진다
  // ⚠ 존 표는 areas.js 에서 받는다 — 향수 지도에서는 향조 아홉이다 (v0.32.0)
  let lastZone = '';
  // ⭐ 시간대 (2026-09-11 밤 — 시안) — 밤에는 향조 색을 달빛 쪽으로 밝힌다 (남색 하늘 위에 짙은 글자는 안 읽힌다).
  //   색은 남는다 (lift 0.72 — 전부 흰색으로 가면 존마다 색이 다르다는 것이 사라진다). 낮이면 원래 색 그대로
  const _tc = new THREE.Color(), _tc2 = new THREE.Color();
  const colorOf = (zone) => {
    if (zone) lastZone = zone;
    const z = areaOf(zone || lastZone);
    const c = (z && z.titleColor) || P.titleColor || CONFIG.color.text;
    const T = timeNow(), L = T && T.title;
    if (!L || !(L.lift > 0)) return c;
    return '#' + _tc.set(c).lerp(_tc2.set(L.to), L.lift).getHexString();
  };

  // 향조 키 → 화면에 쓸 글자. ⚠ 존 표의 name 을 그대로 쓴다 (두 곳에 적지 않는다)
  const labelOf = (zone) => {
    const a = areaOf(zone);
    return (a ? a.name : (zone || '')).toUpperCase();
  };

  return {
    mesh, uni,
    // 마지막 프레임의 천장 배율 (1 = 안 줄였다). 콘솔 검증용
    get ceilK() { return ceilK; },

    // ⚠ cue 와 카메라만 받는다. 씬의 다른 층을 모른다
    // ceil (선택) = { y, x0, x1, W, H } — 글자 꼭대기가 넘으면 안 되는 화면 줄(CSS px, 위가 0)과 그 가로 범위.
    //   ⚠ DOM 을 모르므로 main.js 가 정보 블록의 자리를 재서 넘긴다 (title.js 는 숫자만 받는다)
    // camBase (선택) = 패럴랙스로 밀기 **전**의 카메라 자리 — 천장은 이 자리와 camBaseQ 로 푼다 (아래 천장 주석)
    update(cue, cam, sim, camBaseQ, ceil, camBase) {
      const amt = P.titleAmount === undefined ? 1 : P.titleAmount;
      const on = amt > 0 && cue.rise > 0.001 && !!cue.zone;
      mesh.visible = on;
      if (!on) return;

      bake(labelOf(cue.zone));

      // ── 자리 : 카메라에서 파생한다 (§11). cam 의 자식이 아니다
      // ⚠⚠ **방향은 `camBaseQ`(패럴랙스 **전** 회전)에서 뽑는다** (2026-09-10). 최종 카메라에서
      //   뽑으면, 패럴랙스가 카메라를 평행이동할 때 `lookAt` 이 방향을 미세하게 돌리고
      //   **82 월드 떨어진 글자가 그 각도를 증폭한다** — 마우스를 고정해도 프레임마다 기어간다
      //   (실측 : 4프레임에 x 0.068 · z 0.038 월드). 사용자가 본 *"부들부들 떨림"* 이 그것이다.
      //   ⭐ 위치의 기준점은 **최종 `cam.position`** 그대로다 — 카메라와 **같이** 움직여야
      //     화면에서 제자리에 머문다. 방향만 얼리면 패럴랙스가 글자에서 사라진다.
      let ux, uz;
      if (camBaseQ) {
        _f.set(0, 0, -1).applyQuaternion(camBaseQ);
        const n0 = Math.hypot(_f.x, _f.z) || 1;
        ux = _f.x / n0; uz = _f.z / n0;
      } else {
        const m = cam.matrixWorld.elements;
        const fx = -m[8], fz = -m[10];
        const n = Math.hypot(fx, fz) || 1;
        ux = fx / n; uz = fz / n;
      }
      const dist = P.titleDist === undefined ? 95 : P.titleDist;
      const cx = cam.position.x + ux * dist;
      const cz = cam.position.z + uz * dist;

      // ── 그 자리의 수면 높이. ⚠⚠ **boat.js 와 글자 그대로 같은 호출이어야 한다** —
      //   물은 `qScroll` 로 흐르므로 월드 좌표에 그만큼 보정하고(불변식 0-2 의 비대칭 규약 :
      //   x 는 +, z 는 −), 시각은 `sim.qT × waveSpeed` 다. 하나라도 빠지면 글자가 물과
      //   **다른 바다**를 보게 되어 클리핑이 어긋난다
      const wyRaw = swellCPU(cx + sim.qScroll.x, cz - sim.qScroll.z,
                          sim.qT * P.waveSpeed, P.oceanSwell, P.ripple, P.gerstner);
      // ⚠⚠ **파도를 따라갈지 말지** (2026-09-10, 사용자 : *"폰트가 파도를 따라 안 움직이게
      //   해 줘"*). 0 이면 평균 수면(y = 0)에 **고정**된다 — 글자는 가만히 있고 파도만 그
      //   앞뒤로 흐른다. 1 이면 예전처럼 글자가 너울을 탄다.
      // ⚠⚠ 이 값 하나가 **메시 높이와 워터라인 클리핑 둘 다**를 정한다. 둘이 같은 값이라야
      //   밑동이 정확히 수면에 걸린다 — 한쪽만 고정하면 글자가 물에서 떠오르거나 잠긴다.
      // ⚠ 호출 자체는 남겨 둔다 (되돌릴 수 있게). 프레임당 한 번이라 비용은 무시할 수준이고,
      //   `boat.js` 와 **글자 그대로 같은 호출**이어야 한다는 위 규약도 그대로 지켜진다.
      const wy = wyRaw * (P.titleFollowWave === undefined ? 0 : P.titleFollowWave);
      uni.uWaterY.value = wy;

      // ── 크기. 폭은 월드, 높이는 텍스처 비율에서 나온다
      // ⚠⚠ **화면 폭은 종횡비를 탄다** (2026-09-10 수정, §23-4-b). `titleWidth` 69 는
      //   *"16:9 에서 화면 폭의 60%"* 로 잡은 값인데, 화면 폭(월드)은
      //   `2 · dist · tan(fov/2) · **aspect**` 라 창이 좁아지면 같이 줄어든다.
      //   폭을 월드 고정으로 두면 그만큼 글자가 부푼다 — 실측 : 1.41 비율에서 **77%**,
      //   1:1 에서 **107% — 잘린다.** 실제로 좁은 창에서 `WOODY` 의 `Y` 가 화면 밖으로 나갔다.
      //   그래서 기준 16:9 대비 비로 곱해 **어떤 창에서도 화면 폭의 같은 비율**을 유지한다.
      //   ⚠ 되돌리려면 `* aspectFix` 만 지운다 — `titleWidth` 의 뜻은 16:9 기준 그대로다.
      const aspectFix = (cam.aspect || ASPECT0) / ASPECT0;
      // ⚠ 거리 보정 — 위 REF_DIST 주석. 화면 폭(월드)이 dist 에 비례하므로 같은 비로 곱하면 화면 비율이 유지된다
      let w = (P.titleWidth === undefined ? 80 : P.titleWidth) * aspectFix * (dist / REF_DIST);
      let h = w * (TEX_H / TEX_W);
      const lift = P.titleLift === undefined ? 0 : P.titleLift;
      // ⭐⭐ **천장** (2026-09-11 오후, `titleCeil`). 밑동은 수면에 서 있어 글자는 **위로만** 자란다 — 그래서 넓고 낮은 창에서
      //   우측 정보 블록을 덮었다 (1366×650 에서 −21px). 글자 꼭대기가 ceil.y 를 넘으면 **밑동은 두고 전체를 줄인다.**
      //   풀이 : 카메라에서 화면 (글자 가운데 x, ceil.y) 로 광선을 쏘아 **글자 평면**(카메라를 마주보는 세로면)과 만나는
      //   높이 yCeil 을 얻는다. rise = 1 일 때 꼭대기 = wy + 배율 × 글리프높이 × (1 + lift) 이므로 배율이 곧 나온다.
      //   ⚠ 줄이기만 한다 (배율 ≤ 1) · 너무 작아지지 않게 0.3 에서 멈춘다 · 가로로 안 겹치면 천장이 없다
      ceilK = 1;
      if (ceil && ceil.H > 0 && (P.titleCeil === undefined ? 1 : P.titleCeil) >= 0.5) {
        const need = h * glyphFrac * (1 + lift);   // rise = 1 에서 글리프 꼭대기가 수면 위로 오르는 높이 (배율 1)
        // ⚠⚠⚠ **천장은 패럴랙스 전 카메라로 푼다** (2026-09-14, titleCeilBase). 사용자 : *"연출 장면 폰트 있을때 왜 마우스를 하늘에 있는
        //   마우스위치에 따라 작아지고 커지는거지? 그거 없애야함"*. 실측 (1196×627 · WOODY · 다른 값은 그대로 두고 마우스만) :
        //   세로 −1 → 배율 1.00 · 0 → 0.97 · +1 → **0.30**. 카메라는 0.1 월드만 올라갔는데 글자가 3분의 1 이 됐다 — 기하가 아니라 **행렬이 어긋난** 탓이었다.
        //   main.js 의 `cam.lookAt` 이 그 순간(패럴랙스 **전**) 위치로 `matrixWorld` 를 굳히고 패럴랙스는 `position` 만 옮긴다 —
        //   틱 끝의 `cam.updateMatrixWorld()` 까지 둘이 어긋나 있다. 예전 식은 `unproject(cam)`(행렬 — 옮기기 전)에서 `cam.position`(옮긴 뒤)을 뺐다.
        //   되돌린 점이 카메라 앞 **0.4 월드**(NDC z 0.5 · near 0.1 · far 400)라 0.1 월드 어긋남이 광선 방향 **약 14°** 가 됐다.
        //   ⭐ 기준 카메라(camBase · camBaseQ)로 행렬을 **새로** 만들어 풀면 둘이 어긋날 수 없고, 크기가 마우스와 **무관**하다.
        //     글자의 **자리**는 여전히 최종 카메라를 따라 패럴랙스를 탄다 (위 '자리' 주석) — 없애는 것은 크기의 흔들림뿐이다.
        //   ⚠ titleCeilBase 0 이면 예전 식 그대로다 (비교 패널 [원본]) — cc = cam · bx, bz = cx, cz
        const useBase = !!(camBase && camBaseQ) && (P.titleCeilBase === undefined ? 1 : P.titleCeilBase) >= 0.5;
        let cc = cam, bx = cx, bz = cz;
        if (useBase) {
          _bc.projectionMatrix.copy(cam.projectionMatrix);
          _bc.projectionMatrixInverse.copy(cam.projectionMatrixInverse);
          _bc.position.copy(camBase);
          _bc.quaternion.copy(camBaseQ);
          _bc.updateMatrixWorld(true);   // matrixWorld · matrixWorldInverse 를 이 자리 · 회전으로
          cc = _bc; bx = camBase.x + ux * dist; bz = camBase.z + uz * dist;
        }
        _p.set(bx, wy, bz).project(cc);
        // 글자의 화면 가로 범위 (글자는 평면 폭의 MAX_FRAC 만 쓴다) — 정보 블록과 가로로 겹칠 때만 천장이 있다
        const halfPx = (() => { _d.set(bx + uz * w * MAX_FRAC * 0.5, wy, bz - ux * w * MAX_FRAC * 0.5).project(cc); return Math.abs(_d.x - _p.x) * 0.5 * ceil.W; })();
        const midPx = (_p.x * 0.5 + 0.5) * ceil.W;
        if (need > 1e-6 && ceil.x0 < midPx + halfPx && ceil.x1 > midPx - halfPx) {
          _d.set(_p.x, 1 - 2 * ceil.y / ceil.H, 0.5).unproject(cc).sub(cc.position).normalize();
          // 글자 평면 : (bx, ·, bz) 를 지나고 법선이 카메라 쪽 수평 (−ux, 0, −uz)
          const den = -(_d.x * ux + _d.z * uz);
          if (Math.abs(den) > 1e-6) {
            const tt = -((bx - cc.position.x) * ux + (bz - cc.position.z) * uz) / den;
            if (tt > 0) {
              const yCeil = cc.position.y + _d.y * tt;
              ceilK = clampK((yCeil - wy) / need);
              w *= ceilK; h *= ceilK;
            }
          }
        }
      }
      mesh.scale.set(w, h, 1);

      // ── 솟는다. ⚠⚠ `cue.rise` 는 easeOutBack 이라 **1.099 까지 넘긴다** (§22-3).
      //   높이에 곱하는 것은 괜찮다 — 살짝 더 솟았다 돌아오는 관성이 된다.
      //   ⚠ 알파(uAmount)에는 clamp 를 건다. 안 걸면 1 을 넘어 외삽된다.
      //
      // ⭐ 기준은 **평면이 아니라 글리프**다 (glyphFrac). 그래서 `titleLift` 의 뜻이 하나다 —
      //   **rise=1 일 때 글리프 밑동이 수면 위로 뜨는 양** (글리프 높이 대비).
      //     0 이면 밑동이 딱 수면에 걸리고, 음수면 잠긴다.
      //   rise=0 이면 글리프가 수면 아래로 완전히 내려가 안 보인다.
      const gh = h * glyphFrac;
      // ⚠ 글리프 중심이 평면 중심과 정확히 같지는 않다 (굽기가 잰 glyphMid). 그만큼 보정한다
      const midOff = h * (0.5 - glyphMid);
      mesh.position.set(cx, wy + gh * (cue.rise * (1 + lift) - 0.5) - midOff, cz);
      // ⚠⚠ **법선이 카메라를 향해야 한다.** PlaneGeometry 는 +z 를 보므로 `atan2(ux, uz)` 는
      //   평면을 카메라 **반대쪽**으로 돌린다 — DoubleSide 라 뒷면이 보이고 **글자가 좌우로
      //   뒤집힌다** (실제로 화면에 YDOOW 로 나왔다). 카메라로 오는 방향은 (−ux, −uz) 다
      mesh.rotation.set(0, Math.atan2(-ux, -uz), 0);

      amountMain = Math.min(1, cue.rise) * amt;
      uni.uAmount.value = amountMain;   // ⚠ 패스별 값은 위 onBeforeRender 가 다시 쓴다 (반사만 titleReflect 배)
      uni.uSoft.value = P.titleSoft === undefined ? 0.35 : P.titleSoft;
      // ⚠ 0 이면 예전 그대로다 (비트 단위 롤백) — 곱하는 인자가 정확히 1 이 된다
      uni.uGrad.value = P.titleGrad === undefined ? 0 : P.titleGrad;
      uni.uGradEnd.value = P.titleGradEnd === undefined ? 0.85 : P.titleGradEnd;
      uni.uColor.value.set(colorOf(cue.zone));
    },

    apply() {
      if (bakedKey) bake(bakedKey.split('|')[0], true);
      uni.uColor.value.set(colorOf(lastZone));
    },

    dispose() {
      scene.remove(mesh);
      geo.dispose(); mat.dispose(); tex.dispose();
    }
  };
}
