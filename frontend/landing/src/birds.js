import * as THREE from 'three';
import { PARAMS as P } from './params.js';
import { CONFIG } from './config.js';
import { clamp, D2R } from './util.js';
import { SKY_UNIFORMS, skyColorCPU } from './sky.js';

// ───────── 새 무리 — 하늘을 채운다 (2026-09-20) ─────────
// 구름과 같은 갈래로 들어왔다 (사용자 결정 : *"구름 + 새 무리"*). 돌고래(`pod.js`)가 바다를
// 채운 자리를 하늘에서 되풀이한다 — 그 파일의 규율을 그대로 따르고, 다른 점만 아래에 적는다.
//
// ⚠⚠ **에셋이 없다 — 지오메트리를 코드로 세운다.** 구름을 함수로 간 것과 같은 자리다.
//   돌고래는 GLB 가 이미 있었고(40KB) 몸의 굴곡이 실루엣을 만들지만, 이 새는 화면에서
//   **날개 두 장의 윤곽**이 전부다 (실측 : 거리 60월드 · 날개폭 1.2월드 → 화면 약 17px).
//   그 크기에서 모델링이 주는 것이 없다. 무게 0 · 로드 대기 0 · 라이선스 0 이 덤이다.
//   ⚠ 새를 **가까이** 끌어오게 되면 이 전제가 깨진다. 그때 GLB 를 다시 본다.
//
// ⚠⚠ **색은 팔레트에서 안 고른다 — 제 뒤의 하늘을 어둡게 한 것이다.**
//   실루엣이란 원래 그런 것이고, 그래서 `CONFIG.times` 에 새 칸을 만들 필요가 없다
//   (구름이 시간대 표를 안 쓴 것과 같은 선택 — sky.js `syncSky` 주석).
//   카메라에서 새로 향하는 방향이 곧 그 새가 가리고 있는 하늘의 방향이므로,
//   `skyColorCPU(그 방향)` 이 **바로 뒤의 하늘색**이다. 거기에 `birdDark` 를 곱한다.
//   ⚠ 낮·저녁·밤이 저절로 따라온다 (낮 246 × 0.45 = 111 · 저녁 220 × 0.45 = 99 ·
//     밤 60 × 0.45 = 27 — 어느 바탕에서도 바탕보다 어둡다). 불변식 14 의 *"빛은 그늘로만"* 그대로다.
//   ⚠⚠ 곱셈이라 **밤에 실루엣이 뒤집히지 않는다** — pod.js 가 낮의 회색(#8A8F94)을 밤에 그대로 두어
//     선형 휘도가 4.9배 밝은 얼룩이 됐던 자리다. 고정 색을 쓰지 않으면 그 실수를 할 수 없다.
//   ⚠ 새 위로 구름이 지나가면 새도 같이 어두워진다 — `skyColorCPU` 가 구름을 포함하기 때문이고,
//     그것이 맞다 (가린 것의 색을 따르는 것이 실루엣이다).
//
// ⚠⚠ **멀어지면 알파가 아니라 `birdDark` 가 1 로 간다** — 즉 **새가 하늘 그 자체가 된다.**
//   0 에서 정확히 만나므로 경계에 값이 남을 수 없고(불변식 19), 반투명 정렬 문제도 없다.
//   pod.js 는 색 녹임과 알파를 따로 뒀지만(원경색이 수평선 색이라 중간 거리에서 얼룩이 남았다),
//   여기서는 녹아드는 목적지가 **그 방향의 하늘 그 자체**라 그 문제가 생기지 않는다.
//
// ⚠⚠ **방위는 카메라 기준이다** (pod.js 머리 주석의 실측 그대로) — 이 씬의 카메라는 배를 따라
//   돌지 않고 `camYaw` 로 씬에 고정돼 있다. 월드에 무작위로 방위를 뿌리면 화면에서 어디로 갈지가
//   운에 맡겨진다. `birdBearing` 은 *"카메라에서 똑바로 멀어지는 방향"* 에서 몇 도 틀 것인가다.
// ⚠⚠ **몸이 보는 방향과 가는 방향은 같아야 한다.** 씬 좌표 규약이 `(x − scroll.x, z + scroll.z)` 라
//   (불변식 0-2) 아래 `wx`·`wz` 는 **둘 다 −** 다. 하나만 뒤집으면 새가 옆걸음질한다.
//
// ⚠⚠ **시계는 틱의 실시간 `t` 다** (2026-09-26, S15P21E203-435 — 불변식 1 이 층마다 고르라고 한 그 선택을 바꿨다).
//   처음에는 pod.js 를 따라 물의 시계(`sim.qT`)를 탔는데, qT 는 그 `t` 를 **시뮬 게이트(30Hz)마다 떠 온 계단**이다.
//   사용자 : *"바다위에 새를 좀 더 부드럽게 움직여야"*. 실측 (120Hz 로 밀어) : 새가 세 프레임 멈췄다가 **한 번에 12px** 뛰었다.
//   새는 물에 안 비치고(레이어 0 만 · 아래) 물과 닿지도 않아 물의 계단을 따를 까닭이 없다 (돌고래도 같은 날 몸의 움직임을 `t` 로 옮겼다 — pod.js).
//   ⚠ 무상태는 그대로다 — dt 를 적분하지 않고 `t` 에서 바로 낸다. `t` 는 틱이 dt(최대 0.05)를 쌓은 값이라 탭이 쉬었다 와도 안 뛴다.
//   ⚠ `t` 가 안 넘어오면 예전처럼 qT 로 떨어진다. 이 모듈에는 상태가 **없다**.
//
// ⚠ **날갯짓은 정점 셰이더가 한다** (pod.js 의 휨 · boat.js 의 돛과 같은 규율). 날개를 몸의
//   진행축(로컬 z)에 대해 돌리고, 각을 날개 길이 위치 u 의 연속 함수로 둔다 — 깃 끝이 가장 크게 친다.
//   ⚠ 그래서 날개를 **길이축으로 마디내야** 한다 (pod.js 의 `sliceZ` 와 같은 이유 :
//     정점이 있는 자리에서만 휜다). 한 장을 네 마디로 끊었다 — 새 한 마리 삼각형 **16개**다.
//
// ⚠ **레이어는 기본(0)만이다.** 반사(2) · 물속 · 발광(3) 패스에 일부러 안 넣는다 —
//   하늘에 떠 있어 반사 패스의 클리핑 평면(`reflectSlice`) 위이고, 씬을 한 번 더 그리는 값만 나간다.
// ⚠ 부팅 신호(`bootReport`)를 안 보낸다 — 기다릴 로드가 아예 없다.
// ⚠ 무리는 `InstancedMesh` 하나다 — **드로우콜 1개**, 몇 마리든 같다 (pod.js 와 같다).

const MAX = 24;         // 미리 잡아 두는 자리 수. `birdCount` 는 이 안에서만 움직인다
const MAX_FLOCKS = 4;   // 무리 원점의 최대 개수
const SEG = 4;          // 날개 한 장의 마디 수 (위 머리 주석)
const HALF = 0.5;       // 반 날개폭 — 지오메트리를 **날개폭 1** 로 정규화한다

/** 재현 가능한 난수 — 새로고침마다 무리가 다른 자리에 서면 값을 판정할 수 없다 (pod.js 와 같다) */
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 날개 윤곽 — 반 날개폭 위치 u(0 뿌리 ~ 1 깃 끝)에서 앞끝·뒤끝의 z.
// ⚠ 진행 방향이 로컬 **−z** 다 (불변식 0-2) — 그래서 앞끝이 음수 쪽이다.
// ⚠ u=0 의 시위가 곧 **몸통**이다 (0.46). 따로 몸을 세우지 않는다 — 이 크기에서는 안 읽히고
//   삼각형만 는다. u=1 에서 0.02 로 좁혀 깃 끝을 뾰족하게 둔다.
const LE = [-0.26, -0.14, -0.10, -0.04, 0.03];   // 앞끝 (u = 0, .25, .5, .75, 1)
const TE = [0.20, 0.10, 0.07, 0.05, 0.05];       // 뒤끝
const lerpAt = (tbl, u) => {
  const x = clamp(u, 0, 1) * (tbl.length - 1), i = Math.min(tbl.length - 2, Math.floor(x));
  return tbl[i] + (tbl[i + 1] - tbl[i]) * (x - i);
};

/**
 * 새 한 마리 — 날개 두 장, 각 `SEG` 마디. 인덱스 없는 지오메트리다 (정점 96개라 아낄 게 없다).
 * ⚠ 법선을 안 만든다 — 이 재질은 조명을 안 받는다 (실루엣이다).
 */
function buildBird() {
  const pos = [];
  const quad = (a, b, c, d) => { pos.push(...a, ...b, ...c, ...a, ...c, ...d); };
  for (const side of [-1, 1]) {
    for (let i = 0; i < SEG; i++) {
      const u0 = i / SEG, u1 = (i + 1) / SEG;
      const x0 = side * u0 * HALF, x1 = side * u1 * HALF;
      const l0 = lerpAt(LE, u0), t0 = lerpAt(TE, u0);
      const l1 = lerpAt(LE, u1), t1 = lerpAt(TE, u1);
      // ⚠ 감기 순서를 좌우로 뒤집는다 — 한쪽만 맞추면 반대 날개가 뒷면이 된다.
      //   재질이 `DoubleSide` 라 지금은 안 드러나지만, 면을 쓰게 되는 날 조용히 틀린다
      if (side > 0) quad([x0, 0, l0], [x1, 0, l1], [x1, 0, t1], [x0, 0, t0]);
      else quad([x0, 0, t0], [x1, 0, t1], [x1, 0, l1], [x0, 0, l0]);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  return g;
}

// 날갯짓 — 날개를 진행축(로컬 z)에 대해 돌린다.
// ⚠ 좌우가 **같은 방향으로** 올라가야 한다. z 축 회전은 x 의 부호에 따라 y 가 반대로 가므로
//   각에 `sign(x)` 를 곱한다 (안 곱하면 한쪽은 올라가고 한쪽은 내려가 프로펠러가 된다).
// ⚠ 각을 `pow(u, uFlap.z)` 로 깃 끝에 쏠리게 한다 — 뿌리가 안 움직이고 끝이 친다 (pod.js 의 꼬리 쏠림).
const VERT = `
attribute float aPhase;   // 마리마다의 날갯짓 위상
attribute float aBeat;    // 날갯짓의 세기 (0 = 활공 · 1 = 한창 칠 때) — 묶음의 앞뒤에서 부드럽게 오르내린다
attribute vec3 aCol;      // 실루엣 색 — CPU 가 제 뒤 하늘에서 낸다
uniform vec3 uFlap;       // x 진폭(라디안) · y 안 씀 · z 깃 끝 쏠림 지수
varying vec3 vCol;
void main(){
  vCol = aCol;
  vec3 p = position;
  float u = clamp(abs(p.x) / ${HALF.toFixed(3)}, 0.0, 1.0);
  float s = p.x >= 0.0 ? 1.0 : -1.0;
  // ⚠ 활공 중에도 날개를 살짝 위로 접어 둔다 (0.18) — 완전히 평평하면 판때기로 읽힌다
  float a = s * (0.18 + uFlap.x * aBeat * sin(aPhase)) * pow(u, uFlap.z);
  float ca = cos(a), sa = sin(a);
  vec3 q = vec3(p.x * ca - p.y * sa, p.x * sa + p.y * ca, p.z);
  gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(q, 1.0);
}`;

const FRAG = `
varying vec3 vCol;
void main(){
  gl_FragColor = vec4(vCol, 1.0);
  #include <colorspace_fragment>
}`;

/**
 * @param scene 씬
 * ⚠ pod.js 와 달리 `waterUni` 를 안 받는다 — 녹아드는 목적지가 물의 원경색(`uBg`)이 아니라
 *   **그 방향의 하늘**이라 물을 참조할 일이 없다 (머리 주석).
 */
export function createBirds(scene) {
  const group = new THREE.Group();
  group.name = 'birds';
  scene.add(group);

  const geo = buildBird();
  const uni = { uFlap: { value: new THREE.Vector3(0.9, 0, 2.0) } };
  const mat = new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    uniforms: uni,
    side: THREE.DoubleSide,   // 날개가 한 겹이라 아래에서도 보여야 한다
    fog: false
  });
  const mesh = new THREE.InstancedMesh(geo, mat, MAX);
  mesh.frustumCulled = false;   // ⚠ 인스턴스가 흩어져 있다 — 원본 바운딩으로 자르면 무리가 통째로 사라진다
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  const aPhase = new THREE.InstancedBufferAttribute(new Float32Array(MAX), 1);
  const aBeat = new THREE.InstancedBufferAttribute(new Float32Array(MAX), 1);
  const aCol = new THREE.InstancedBufferAttribute(new Float32Array(MAX * 3), 3);
  aPhase.setUsage(THREE.DynamicDrawUsage);
  aBeat.setUsage(THREE.DynamicDrawUsage);
  aCol.setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute('aPhase', aPhase);
  geo.setAttribute('aBeat', aBeat);
  geo.setAttribute('aCol', aCol);
  group.add(mesh);

  // 자리표 — 무상태 계산이라 매 프레임 안 만든다 (pod.js 와 같은 규율)
  const R = rng(0xB19D5);
  const slots = Array.from({ length: MAX }, (_, i) => ({
    flock: i % MAX_FLOCKS,
    ox: (R() - 0.5) * 2,      // 무리 안의 자리 (birdSpread 를 곱한다)
    oz: (R() - 0.5) * 2,
    oy: (R() - 0.5) * 2,      // 높이 흔들기 (birdHighVary 를 곱한다)
    // ⚠ 뽑는 순서를 바꾸지 않는다 — 여기 뒤의 무리 원점까지 난수 하나로 이어져 배치가 통째로 바뀐다 (params 의 birdCount 주석 : 180장을 훑어 고른 배치)
    ph: R(),                  // 날갯짓 빠르기의 마리별 편차 (± 8%). ⚠ 예전에는 날갯짓 위상이었다 — 위상은 이제 묶음의 시작에 묶인다
    rest: R(),                // 날갯짓 묶음의 위상 — 무리가 한 몸처럼 치면 기계로 읽힌다
    sz: 0.8 + R() * 0.4       // 크기 편차
  }));
  const flocks = Array.from({ length: MAX_FLOCKS }, (_, g) => ({
    x: (R() - 0.5) * CONFIG.area.wrapZ,
    z: (R() - 0.5) * CONFIG.area.wrapZ,
    side: g % 2 ? -1 : 1,     // 무리마다 화면 좌우로 갈라 지난다
    vary: R() - 0.5,          // 방위 흔들기 (birdBearingVary 를 곱한다)
    high: R()                 // 무리의 높이 자리 (0~1)
  }));

  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), Vp = new THREE.Vector3();
  const Vs = new THREE.Vector3(), E = new THREE.Euler();
  const Z = new THREE.Vector3(0, 0, 0), S0 = new THREE.Vector3(0, 0, 0);
  const sunV = new THREE.Vector3();

  return {
    group,
    mesh,

    update(sim, { scroll, cam, hide, sunDir, t }) {
      const amt = P.birdAmount === undefined ? 1 : P.birdAmount;
      // ⚠ 0 = **비트 단위 롤백** (stageAmount · podAmount · cloudAmount 와 같은 패턴)
      if (amt <= 0) { group.visible = false; return; }
      group.visible = true;

      const n = Math.min(MAX, Math.max(0, Math.round(P.birdCount === undefined ? 14 : P.birdCount)));
      const fN = Math.min(MAX_FLOCKS, Math.max(1, Math.round(P.birdFlocks === undefined ? 3 : P.birdFlocks)));
      const span = Math.max(0.1, P.birdSize === undefined ? 1.2 : P.birdSize);
      const spread = Math.max(0, P.birdSpread === undefined ? 7 : P.birdSpread);
      const high = P.birdHigh === undefined ? 16 : P.birdHigh;
      const highVary = Math.max(0, P.birdHighVary === undefined ? 7 : P.birdHighVary);
      const speed = P.birdSpeed === undefined ? 5.5 : P.birdSpeed;
      const flapAmp = Math.max(0, P.birdFlap === undefined ? 0.9 : P.birdFlap);
      const flapHz = Math.max(0.05, P.birdFlapHz === undefined ? 2.4 : P.birdFlapHz);
      const glide = clamp(P.birdGlide === undefined ? 0.45 : P.birdGlide, 0, 0.95);
      // ⚠ 정수로 둔다 — 날개가 가운데(sin 0)에서 치기 시작해 가운데서 멎는다 (pod.js 의 podBeats 와 같은 이유)
      const beats = Math.max(1, Math.round(P.birdBeats === undefined ? 3 : P.birdBeats));
      const dark = clamp(P.birdDark === undefined ? 0.45 : P.birdDark, 0.02, 1);
      const cool = clamp(P.birdCool === undefined ? 0.3 : P.birdCool, 0, 1);
      const near = Math.max(0, P.birdNear === undefined ? 22 : P.birdNear);
      const hideK = clamp(hide === undefined ? 0 : hide, 0, 1);

      const WZ = CONFIG.area.wrapZ;
      const wrapP = (v) => (((v + WZ / 2) % WZ) + WZ) % WZ - WZ / 2;
      // ⚠ 페이드 끝은 **타일 반지름**을 못 넘는다 — 거기서 아직 보이면 이음매에서 자리가 WZ 만큼 튄다
      //   (pod.js 가 같은 자리에서 적어 둔 것). 숫자를 두 곳에 적지 않으려고 여기서 자른다
      const fade1 = Math.min(WZ * 0.5, Math.max(4, P.birdFade1 === undefined ? 130 : P.birdFade1));
      const fade0 = clamp(P.birdFade0 === undefined ? 70 : P.birdFade0, 0, fade1 - 1);

      uni.uFlap.value.set(flapAmp, 0, Math.max(0.2, P.birdFlapExp === undefined ? 2.0 : P.birdFlapExp));

      const yaw0 = (P.camYaw === undefined ? -52.1 : P.camYaw) * D2R;
      const bear = (P.birdBearing === undefined ? 40 : P.birdBearing) * D2R;
      const bvary = (P.birdBearingVary === undefined ? 22 : P.birdBearingVary) * D2R;

      const T = t === undefined ? sim.qT : t;   // 시계 (머리 주석)
      const S = sunDir ? [sunDir.x, sunDir.y, sunDir.z] : (sunV.set(...CONFIG.sun).normalize(), [sunV.x, sunV.y, sunV.z]);
      const ZEN = SKY_UNIFORMS.uSkyZen.value;

      let drawn = 0;
      for (let i = 0; i < n; i++) {
        const s = slots[i], F = flocks[s.flock % fN];
        // 무리의 방위 — 카메라에서 똑바로 멀어지는 방향에서 튼다 (머리 주석)
        const H = yaw0 + F.side * bear + F.vary * bvary;
        const sinH = Math.sin(H), cosH = Math.cos(H);
        const run = T * speed;
        // ⚠ 둘 다 **−** 다 — 보는 방향 그대로 나아간다 (머리 주석의 부호 규약)
        const wx = wrapP(F.x - sinH * run + s.ox * spread);
        const wz = wrapP(F.z - cosH * run + s.oz * spread);
        // 씬 좌표 (불변식 0-2 : 월드 → 씬 은 `x − scroll.x` · `z + scroll.z`)
        const sx = wrapP(wx - scroll.x), sz = wrapP(wz + scroll.z);
        // ⚠⚠⚠ **높이는 절대 고도가 아니라 카메라에서 얼마나 위인가다.**
        //   `cameraPose` 의 카메라 높이가 **고정이 아니기** 때문이다 — 속도(`s`)에 따라 물러나고,
        //   쉬는 자세로 천천히 수렴한다 (수렴값 y **10.30** · pitch −24.15°).
        //   절대 고도로 두면 카메라가 그보다 높은 순간 새가 **수평선 아래**, 곧 바다 위에 선다.
        //   ⚠⚠ 실제로 첫 시안이 그랬다 (birdHigh 9 < 카메라 10.30) — 수렴하지 않은 카메라(y 5.68)에서
        //     값을 고른 탓이다. **구도를 재는 값은 카메라가 수렴한 뒤에 정한다.**
        //   카메라 기준으로 두면 고도 = atan(birdHigh / 거리) 라 카메라가 오르내려도 띠 안에 남는다.
        //   ⚠ 물리적으로는 새가 카메라를 따라 오르내리는 셈이다 — 틀을 맞추는 값이지 움직임이 아니다.
        const sy = cam.position.y + high + (F.high - 0.5) * highVary + s.oy * highVary * 0.5;

        // ── 게이트 셋을 곱한다 (pod.js 와 같은 규율). 전부 0 에서 만난다 (불변식 19)
        // ⚠⚠ 거리는 **배(씬 원점 = 타일의 중심)** 에서 잰다. 카메라에서 재면 이음매와 자가 어긋나
        //   페이드가 끝나기 전에 자리가 wrapZ 만큼 튀는 새가 생긴다 (pod.js 와 같은 규약).
        const dB = Math.hypot(sx, sz);
        //  ① 거리 — 멀면 하늘에 녹는다
        let k = 1 - clamp((dB - fade0) / (fade1 - fade0), 0, 1);
        //  ② 배 둘레 — 너무 가까우면 화면을 가로질러 커진다
        k *= clamp(dB / Math.max(1e-3, near), 0, 1);
        //  ③ 연출 — 존 구도 · 향수 고르기 · 이동 안개가 넘기는 값
        k *= 1 - hideK;
        if (k <= 0) continue;

        // 실루엣 색 = **제 뒤 하늘** × birdDark. 멀수록 dark 가 1 로 가 하늘 그 자체가 된다
        Vp.set(sx, sy, sz);
        Vs.copy(Vp).sub(cam.position).normalize();
        const back = skyColorCPU(Vs.x, Vs.y, Vs.z, S);
        const kd = 1 - (1 - dark) * k;     // k=1 → dark · k=0 → 1 (= 하늘)
        const kc = cool * k;
        const o = drawn * 3;
        for (let c = 0; c < 3; c++) {
          const zc = c === 0 ? ZEN.r : c === 1 ? ZEN.g : ZEN.b;
          aCol.array[o + c] = (back[c] + (zc - back[c]) * kc) * kd;
        }

        // 날갯짓 — **몇 번 치고 길게 활공한다** (갈매기). 한 묶음 = `beats` 번 + 그 뒤 활공 (몫 `glide`).
        // ⚠⚠ 예전에는 세기(`aBeat`)가 0/1 로 끊기고 위상이 묶음과 따로 돌아, 치다가 멎는 순간 날개 끝이 **한 프레임에 0.742 라디안(42°)** 튀었다.
        //   그리고 묶음이 날갯짓 한 번 + 활공 0.34초라 0.76초마다 그렇게 튀었다 (실측 2026-09-26).
        //   ① 위상을 묶음의 시작에서 0 부터 센다 — 정수 번 치고 끝나므로 날개가 가운데서 멎는다
        //   ② 세기를 앞 ¼ 번 동안 올리고 뒤 ½ 번 동안 내린다 — 날개가 움직이기 시작하는 속도도 0 에서 출발한다
        //   ⚠ 위상이 묶음 안에서만 커서 float32 속성이 오래 켜 둬도 무뎌지지 않는다 (예전 값은 시계와 같이 끝없이 컸다)
        const hz = flapHz * (0.92 + 0.16 * s.ph);           // 마리마다 조금씩 달리 친다 — 같이 시작한 새도 곧 어긋난다
        const beat1 = 1 / hz, flapDur = beats * beat1;
        const boutDur = flapDur / (1 - glide);
        const tau = ((T + s.rest * boutDur) % boutDur + boutDur) % boutDur;   // 묶음 안의 시각
        let beat = 0, phase = 0;
        if (tau < flapDur) {
          phase = tau * hz * Math.PI * 2;
          const up = clamp(tau / (0.25 * beat1), 0, 1), dn = clamp((flapDur - tau) / (0.5 * beat1), 0, 1);
          beat = up * up * (3 - 2 * up) * dn * dn * (3 - 2 * dn);
        }
        aBeat.array[drawn] = beat;
        aPhase.array[drawn] = phase;

        E.set(0, H, 0);
        Q.setFromEuler(E);
        const sc = span * s.sz;
        M.compose(Vp, Q, S0.set(sc, sc, sc));
        mesh.setMatrixAt(drawn, M);
        drawn++;
      }
      // 남은 자리는 크기 0 으로 접는다 (퇴화 삼각형 — 드로우콜은 그대로 1개다)
      for (let i = drawn; i < MAX; i++) { M.compose(Z, Q, S0.set(0, 0, 0)); mesh.setMatrixAt(i, M); }
      mesh.count = MAX;
      mesh.instanceMatrix.needsUpdate = true;
      aPhase.needsUpdate = true; aBeat.needsUpdate = true; aCol.needsUpdate = true;
    },

    dispose() {
      group.remove(mesh);
      mesh.dispose();
      geo.dispose();
      mat.dispose();
      scene.remove(group);
    }
  };
}
