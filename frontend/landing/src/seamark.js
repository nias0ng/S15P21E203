import * as THREE from 'three';
import { PARAMS as P } from './params.js';
import { timeNow } from './times.js';
import { swellCPU } from './swell.js';

// ───────── 바다 누르기 표시 — 한 점으로 빨려 드는 네 줄기 (2026-09-13 밤, v0.59.0 · params.seaMark) ─────────
// 사용자 (네 번째 설명 — 앞의 시안은 전부 버렸다) : *"4방향을 제작하는데 일단 처음 지시했던 한점에 모이는 형태는 맞고 하나를 좁게 U자 형태가
//   위아래 뒤집혀지게 다이빙을 그리듯이 지나가는데 이걸 하나의 패스라고 생각한다면 패스 처음 값에는 화살표가 있고 그 패스의 시작점이 화살표라
//   생각하고 패스 끝값이 화살표를 따라가다가 어느 짧은 특정 길이에서 끝나며 한점으로 빨려가듯이 표현해야함 · 지금은 마치 작살이 던지듯이
//   표현해두었는데 몹시 이상함"*. 결정 (앞서 물어서 받았다) : 누른 순간만 한 번.
//
// ⭐ 줄기 하나 = **길(패스) 위를 달리는 짧은 구간**
//   · 길은 바깥 자리(반지름 R)의 수면에서 곧게 솟아 좁은 ∩ 를 그리고 가운데 점으로 곧게 내리꽂힌다
//     (3차 베지어 — 조절점 둘이 양 끝의 바로 위, 높이 hc = seaMarkArc·R / 0.75 → 꼭대기 = seaMarkArc·R)
//   · 구간의 **앞끝이 화살촉**이고, 뒤끝은 촉을 따라가는 **짧은 꼬리**다 (길이 = 길 전체의 seaMarkTrail)
//   · 촉이 점에 닿으면 멈추고, 꼬리가 마저 따라 들어와 **점으로 빨려 들며** 사라진다 — 촉도 꼬리가 줄어드는 만큼 작아진다
//   · 고리는 누른 순간 떠서 **퍼지며 은은하게 옅어진다** (2026-09-14, seaMarkRipple — 제 시계 seaMarkRingDur 라 줄기보다 오래 남는다). 점은 줄기가 빨려 들 때까지 남는다
//   · 달리기는 처음에도 멈춰 있지 않고(속도 0.35) 끝으로 갈수록 빨라진다 (빨려 드는 느낌 — 끝 속도 1.65)
//   · 한 번의 길이 = seaMarkDur ÷ seaMarkSpeed (기본 0.7 ÷ 1.3 ≈ 0.54초 — 사용자 : *"속도 0.7로 낮춰주고"* → 0.7배를 보고 *"1.3으로해줘"*, 물어서 받았다 : 빠르기 1.3배)
// ⚠⚠ 버린 시안 셋 — 다시 가지 않는다 (CHANGELOG v0.59.0) :
//   ① 수면에 누운 쉐브론이 미끄러져 모이기 ② 날아가는 방향을 따라 머리를 들었다 박는 화살 한 자루 ③ 각도가 고정된 긴 화살이 포물선으로 날아와 꽂히기.
//   ②③ 은 *"작살이 던지듯이"* 보였다 — **몸통이 곧은 막대가 아니라 길을 따라 휘는 꼬리**라야 한다.
// ⚠ 꼬리는 **카메라를 보는 띠**다 — 표본마다 옆 방향 = (카메라 쪽 × 접선). 촉도 같은 두 축으로 눕혀서 꼬리의 앞끝과 촉의 밑변이 어긋나지 않는다.
// ⚠ 길은 **길이로 다시 매긴 표**에서 읽는다 — 베지어 매개변수 그대로 달리면 곧은 다리와 꼭대기에서 꼬리 길이가 달라진다.
// ⚠ 네 꼬리는 **한 메시(그리기 1)** 다 — 띠 넷을 한 버퍼에 담아 매 프레임 정점만 고친다. 촉 넷 · 과녁 하나를 더해 그리기 6 (떠 있는 동안만).
// ⚠ 네 방향은 대각선(화면 기준 좌상 · 우상 · 좌하 · 우하 — seaMarkDiag 0 이면 좌우 · 앞뒤)이고 camYaw(−52°) 에 맞춘다.
// ⚠ 과녁(고리 + 점)만 수면에 눕는다 — 높이는 선택 링(marks.js)과 같은 식이다 (불변식 1 · 2). 길의 바닥 높이도 그 점의 높이다.
// ⚠ 자리는 **월드 좌표**로 쥐고 매 프레임 씬 좌표로 옮긴다 (불변식 0-2 — 씬 x = 월드 x − scroll.x · 씬 z = 월드 z + scroll.z).
// ⚠ 끝에 값이 남지 않는다 (불변식 19) — 꼬리 끝 알파 0 · 띠의 옆 가장자리는 투명으로 녹는 단면 그림 · 촉과 과녁은 부드러운 그림이고 진하기가 0 에서 끝나며,
//   물이 녹아 사라지는 곳(메시 가장자리 · 원경 페이드)에서는 **물과 같은 두 항**으로 같이 옅어진다 (water.js 의 vis).
// ⚠ 시간대 표를 따른다 (불변식 25) — 저녁 · 밤(marksAdd)은 **더해서** 빛으로 (색 = 표의 seaMark), 낮은 흰 종이 위라 **섞어서** 짙은 금빛 (DAY).
// ⚠ 시계는 **실시간 dt** 다 — 물 현상이 아니라 누른 것에 대한 반응이다 (links.js · phase.js 와 같은 예외).
// ⚠ 반사 패스(레이어 2)에 안 넣는다 — 레이어 0 에만 있다. 부표 번짐(GlowPass, 레이어 3)도 안 탄다.
// ⚠ 크기는 **원근을 따른다** (2026-09-14, seaMarkPersp) — 사용자 : *"먼거리를 클릭해도 같은 크기로 연출되고 있긴함 같은 원근을 적용해서 멀리 찍을 수록 작게
//   배 가까이 찍을 수록 원래 크기로 돌아와야"*. 배보다 먼 자리는 월드 크기 그대로라 원근대로 작아지고, 배보다 **가까운** 자리는 월드 크기를 거리 비만큼 줄여
//   화면 크기를 원래대로 둔다 (그냥 두면 카메라 쪽으로 가까울수록 커진다). seaMarkPersp 0 이면 예전 — seaMarkFar 로 어디서나 같은 화면 크기.

const DAY = '#9A7424';   // 낮 (흰 종이 위) — 섞어서 그리는 짙은 금빛
const EVE = '#FFE08A';   // 시간대 표에 seaMark 가 없을 때
const SEG = 20;          // 꼬리 한 줄기의 마디 수
const PROF = 64;         // 길 모양 표의 표본 수
const P_END = 0.86;      // 꼬리까지 점에 빨려 드는 진행 (p). 나머지는 과녁이 오므라들며 옅어진다
const HEAD_TIP = 0.41;   // 촉 그림의 끝이 판 가운데에서 떨어진 몫 (판 폭 1 기준 — 그림 x 58/64). 촉 끝이 길의 앞끝에 오게 판을 뒤로 민다

function smooth(a, b, x) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}
// 달리기 — 처음 속도 0.35 · 끝 속도 1.65 (끝으로 갈수록 빨라진다). easeInv 는 그 역함수
function ease(x) { return 0.35 * x + 0.65 * x * x; }
function easeInv(y) { return (-0.35 + Math.sqrt(0.1225 + 2.6 * y)) / 1.3; }

function canvasTex(c) {
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
// 꼬리 띠의 단면 — 가운데가 짙고 양옆 가장자리에서 0 (그림의 세로가 띠의 폭 방향)
function profileTexture() {
  const c = document.createElement('canvas');
  c.width = 4;
  c.height = 64;
  const g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 0, 64);
  gr.addColorStop(0, 'rgba(255,255,255,0)');
  gr.addColorStop(0.3, 'rgba(255,255,255,0.85)');
  gr.addColorStop(0.5, 'rgba(255,255,255,1)');
  gr.addColorStop(0.7, 'rgba(255,255,255,0.85)');
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, 4, 64);
  return canvasTex(c);
}
// 화살촉 — 뒤가 파인 삼각형, 끝이 판 로컬 +x. ⚠ 판 가장자리에 안 닿는다 (여유 4~8px — 불변식 19)
function headTexture() {
  const N = 64, c = document.createElement('canvas');
  c.width = c.height = N;
  const g = c.getContext('2d');
  g.fillStyle = '#fff';
  g.shadowColor = '#fff';
  g.shadowBlur = 2;
  g.beginPath();
  g.moveTo(58, 32);
  g.lineTo(12, 10);
  g.lineTo(22, 32);
  g.lineTo(12, 54);
  g.closePath();
  g.fill();
  return canvasTex(c);
}
// 과녁 — 얇은 고리와 가운데 점을 **따로** 그린다 (2026-09-14 — 고리만 퍼지며 옅어지게). 둘 다 같은 판 크기에서 예전 한 장의 자리 그대로다
//   (고리 반지름 0.36 · 점 반지름 0.085 · 여유 약 0.1) — 그래서 퍼짐을 끄면(seaMarkRipple 0) 예전 과녁 한 장과 같다
function ringTexture() {
  const N = 128, c = document.createElement('canvas');
  c.width = c.height = N;
  const g = c.getContext('2d');
  g.strokeStyle = '#fff';
  g.shadowColor = '#fff';
  g.shadowBlur = 2;
  g.lineWidth = N * 0.05;
  g.beginPath();
  g.arc(N / 2, N / 2, N * 0.36, 0, Math.PI * 2);
  g.stroke();
  return canvasTex(c);
}
function dotTexture() {
  const N = 128, c = document.createElement('canvas');
  c.width = c.height = N;
  const g = c.getContext('2d');
  g.fillStyle = '#fff';
  g.shadowColor = '#fff';
  g.shadowBlur = 2;
  g.beginPath();
  g.arc(N / 2, N / 2, N * 0.085, 0, Math.PI * 2);
  g.fill();
  return canvasTex(c);
}

// water : () => water — 물의 거리 페이드 유니폼과 메시 자리를 읽는다 (화살표라 부를 때 이름이 풀린다)
export function createSeaMark({ scene, water }) {
  const profTex = profileTexture(), headTex = headTexture(), ringTex = ringTexture(), dotTex = dotTexture();
  const common = { color: EVE, transparent: true, opacity: 1, depthWrite: false, fog: false, toneMapped: false, side: THREE.DoubleSide };

  // ── 꼬리 넷 — 한 버퍼. 줄기마다 (SEG + 1) 쌍의 정점 (옆 두 개씩)
  const NV = 4 * (SEG + 1) * 2;
  const pos = new Float32Array(NV * 3), col = new Float32Array(NV * 4), uv = new Float32Array(NV * 2);
  const index = [];
  for (let k = 0; k < 4; k++) {
    const b = k * (SEG + 1) * 2;
    for (let j = 0; j <= SEG; j++) {
      const a = b + j * 2;
      uv[a * 2] = j / SEG; uv[a * 2 + 1] = 0;
      uv[(a + 1) * 2] = j / SEG; uv[(a + 1) * 2 + 1] = 1;
    }
    for (let j = 0; j < SEG; j++) {
      const a = b + j * 2;
      index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }
  const trailGeo = new THREE.BufferGeometry();
  const posAttr = new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage);
  const colAttr = new THREE.BufferAttribute(col, 4).setUsage(THREE.DynamicDrawUsage);   // ⚠ 4 성분이라야 정점 알파가 산다 (three 가 vertexAlphas 를 켠다)
  trailGeo.setAttribute('position', posAttr);
  trailGeo.setAttribute('color', colAttr);
  trailGeo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  trailGeo.setIndex(index);
  const trailMat = new THREE.MeshBasicMaterial({ ...common, map: profTex, vertexColors: true });
  const trail = new THREE.Mesh(trailGeo, trailMat);
  trail.frustumCulled = false;   // ⚠ 정점을 매 프레임 옮긴다 — 처음 잡힌 경계구(원점 한 점)로 잘리면 안 된다
  trail.renderOrder = 8;

  // ── 촉 넷 — XY 판, 촉 끝 +x · 법선 +z. 방향은 꼬리의 앞끝과 같은 두 축으로 잡는다
  const headGeo = new THREE.PlaneGeometry(1, 1);
  const headMat = new THREE.MeshBasicMaterial({ ...common, map: headTex });
  const heads = [];
  // ── 과녁 — 수면에 눕는다. ⚠ 너울 식에 없는 잔물결 · 수면 메시 정점 간격의 오차에 잠기지 않게 깊이만 앞으로 당긴다
  const ringGeo = new THREE.PlaneGeometry(1, 1);
  ringGeo.rotateX(-Math.PI / 2);
  const ringMat = new THREE.MeshBasicMaterial({ ...common, map: ringTex, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.renderOrder = 7;   // 선택 링(marks.js 6) 다음
  // 가운데 점 — 고리와 같은 판(ringGeo)을 같이 쓴다. 재질만 따로라 진하기 · 크기를 따로 민다
  const dotMat = new THREE.MeshBasicMaterial({ ...common, map: dotTex, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 });
  const dot = new THREE.Mesh(ringGeo, dotMat);
  dot.renderOrder = 7;

  const group = new THREE.Group();
  group.visible = false;
  group.add(ring, trail);
  for (let k = 0; k < 4; k++) {
    const m = new THREE.Mesh(headGeo, headMat);
    m.renderOrder = 9;
    group.add(m);
    heads.push(m);
  }
  group.add(dot);   // ⚠ 맨 뒤에 넣는다 — 앞의 순서(고리 0 · 꼬리 1 · 촉 2~5)를 바꾸지 않는다
  scene.add(group);

  // 길 모양 표 — 가운데에서의 가로 거리 r · 높이 y · 누적 길이. update 가 매 프레임 R 로 다시 채운다 (R 이 카메라 거리를 탄다)
  const tabR = new Float32Array(PROF + 1), tabY = new Float32Array(PROF + 1), tabL = new Float32Array(PROF + 1);
  function buildPath(R, hc) {
    let len = 0, pr = R, py = 0;
    for (let i = 0; i <= PROF; i++) {
      const s = i / PROF, m = 1 - s;
      const r = R * (m * m * m + 3 * m * m * s);   // 바깥 끝(A)과 그 위 조절점(A′)의 무게 — 가운데 쪽 둘은 r = 0
      const y = hc * 3 * s * m;                     // 조절점 둘의 높이 hc — 꼭대기 0.75·hc
      if (i > 0) len += Math.hypot(r - pr, y - py);
      tabR[i] = r; tabY[i] = y; tabL[i] = len;
      pr = r; py = y;
    }
    return len;
  }
  // 길이 몫 l(0..1) 의 자리와 단위 접선 (r · y 성분) — 표를 선형으로 읽는다
  const smp = { r: 0, y: 0, dr: 0, dy: 0 };
  function sample(l, total) {
    const L = Math.min(1, Math.max(0, l)) * total;
    let lo = 0, hi = PROF;
    while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (tabL[mid] <= L) lo = mid; else hi = mid; }
    const seg = Math.max(1e-9, tabL[lo + 1] - tabL[lo]);
    const f = Math.min(1, Math.max(0, (L - tabL[lo]) / seg));
    smp.r = tabR[lo] + (tabR[lo + 1] - tabR[lo]) * f;
    smp.y = tabY[lo] + (tabY[lo + 1] - tabY[lo]) * f;
    smp.dr = (tabR[lo + 1] - tabR[lo]) / seg;
    smp.dy = (tabY[lo + 1] - tabY[lo]) / seg;
  }

  let on = false, wx = 0, wz = 0, age = 0;
  let pinP = null;                  // 멈춰 보기 (pin) — 시안 확인용
  let laidAdd = null, laidCol = '';
  let last = null;                  // report() 용
  const base = new THREE.Color(EVE);
  const _f = new THREE.Vector3(), _t = new THREE.Vector3(), _s = new THREE.Vector3(), _n = new THREE.Vector3(), _c = new THREE.Vector3();
  const _m = new THREE.Matrix4();
  const off = () => { on = false; group.visible = false; };

  return {
    group,
    get active() { return on; },
    // 누른 자리 (월드 좌표). 이미 떠 있으면 새 자리에서 처음부터
    show(x, z) {
      if ((P.seaMark === undefined ? 1 : P.seaMark) < 0.5) return;
      wx = x; wz = z; age = 0; on = true;
    },
    hide: off,
    // ⭐ 진행을 p(0..1)에 멈춘다 — null 이면 풀린다. rAF 가 느린 창에서 한 장면을 보려고 둔다 (PB.seamark.pin(0.5))
    pin(p) { pinP = p === null || p === undefined ? null : Math.min(0.999, Math.max(0, p)); },
    report() { return last; },

    update({ dt, scroll, sim, cam }) {
      if (!on) return;
      age += dt;
      const speed = Math.min(3, Math.max(0.1, P.seaMarkSpeed === undefined ? 1.3 : P.seaMarkSpeed));
      const dur = Math.max(0.1, P.seaMarkDur === undefined ? 0.7 : P.seaMarkDur) / speed;
      // ⭐ 고리는 제 시계(q)로 간다 (seaMarkRipple) — 줄기(p)와 고리가 **둘 다** 끝나야 끈다. 멈춰 보기(pin)는 줄기 진행을 고리 시계로 옮겨 쓴다
      const ripple = (P.seaMarkRipple === undefined ? 1 : P.seaMarkRipple) >= 0.5;
      const ringDur = ripple ? Math.max(0.1, P.seaMarkRingDur === undefined ? 0.9 : P.seaMarkRingDur) : dur;
      const p = pinP !== null ? pinP : age / dur;
      const q = pinP !== null ? pinP * dur / ringDur : age / ringDur;
      if ((p >= 1 && q >= 1) || (P.seaMark === undefined ? 1 : P.seaMark) < 0.5) { off(); return; }

      // 시간대 — 저녁 · 밤은 더하고 낮은 섞는다. ⚠ blending 은 그리기 상태라 다시 컴파일하지 않는다 (marks.js 와 같다)
      const T = timeNow(), add = !!(T && T.marksAdd);
      if (add !== laidAdd) {
        laidAdd = add;
        trailMat.blending = headMat.blending = ringMat.blending = dotMat.blending = add ? THREE.AdditiveBlending : THREE.NormalBlending;
      }
      const colHex = add ? (T.seaMark || EVE) : DAY;
      if (colHex !== laidCol) { laidCol = colHex; base.set(colHex); trailMat.color.copy(base); headMat.color.copy(base); }

      // 씬 좌표 (불변식 0-2)
      const cx = wx - scroll.x, cz = wz + scroll.z;
      // 화면 가로축 — 카메라 앞 방향 (fx, fz) 의 오른쪽은 (−fz, fx)
      cam.getWorldDirection(_f);
      const fl = Math.hypot(_f.x, _f.z) || 1;
      const rx = -_f.z / fl, rz = _f.x / fl;
      const yaw0 = Math.atan2(-rz, rx);   // R_y(yaw0) 가 (1, 0, 0) 을 화면 오른쪽으로 보낸다
      // 크기 — 카메라가 배(씬 원점)를 보는 거리에서 seaMarkSize (= 원래 크기).
      //   원근(seaMarkPersp 1) : 배보다 먼 자리는 월드 크기 그대로(kd 1 → 원근대로 작아진다) · 가까운 자리는 거리 비만큼 줄여 화면 크기를 원래대로
      //   예전(0) : 거리 비의 seaMarkFar 제곱만큼 키워 어디서나 같은 화면 크기
      const cp = cam.position;
      const ref = Math.max(1, cp.length());
      const dist = Math.hypot(cx - cp.x, cp.y, cz - cp.z);
      const persp = (P.seaMarkPersp === undefined ? 1 : P.seaMarkPersp) >= 0.5;
      const far = P.seaMarkFar === undefined ? 1 : P.seaMarkFar;
      const kd = persp
        ? Math.min(1, Math.max(0.5, dist / ref))
        : Math.pow(Math.min(3, Math.max(0.5, dist / ref)), far);
      const R = (P.seaMarkSize === undefined ? 2.6 : P.seaMarkSize) * kd;
      // 물이 녹아 사라지는 곳에서는 같이 옅어진다 — water.js 의 vis 와 같은 두 항 (메시 가장자리 · 원경 페이드)
      let vis = 1;
      const W = water && water();
      if (W && W.mesh && W.uni) {
        const half = W.mesh.geometry.parameters.width / 2;
        const edge = Math.max(Math.abs(cx - W.mesh.position.x), Math.abs(cz - W.mesh.position.z)) / half;
        vis *= 1 - smooth(0.76, 0.98, edge);
        vis *= 1 - smooth(W.uni.uFade0.value, W.uni.uFade1.value, Math.hypot(cx - cp.x, cz - cp.z));
      }
      const A = (add ? 0.95 : 0.9) * vis;
      // ⚠ 선택 링(marks.js)과 같은 식 — 물과 같은 양자화 시각 · 위치 (불변식 1). 길의 바닥도 이 높이다
      const lift = P.seaMarkLift === undefined ? 0.08 : P.seaMarkLift;
      const sy = swellCPU(cx + sim.qScroll.x, cz - sim.qScroll.z, sim.qT * P.waveSpeed, P.oceanSwell, P.ripple, P.gerstner) + lift;

      // ── 달리기 — 가상의 앞끝 v 가 0 → (1 + 꼬리 길이). 촉 = min(1, v) · 꼬리 끝 = v − 꼬리 길이.
      //   그래서 처음에는 꼬리가 바깥 수면에서 자라 나오고, 끝에서는 촉이 점에 멈춘 채 꼬리가 줄어들며 빨려 든다
      const trailL = Math.min(0.95, Math.max(0.05, P.seaMarkTrail === undefined ? 0.4 : P.seaMarkTrail));
      const arc = P.seaMarkArc === undefined ? 0.9 : P.seaMarkArc;
      const total = buildPath(R, arc * R / 0.75);
      const v = (1 + trailL) * ease(Math.min(1, p / P_END));
      const lh = Math.min(1, v), lt = Math.min(1, Math.max(0, v - trailL));
      const span = lh - lt;
      const headK = smooth(0, 1, span / trailL);   // 솟아 나올 때 자라고 빨려 들 때 줄어든다
      const pArrive = P_END * easeInv(1 / (1 + trailL));   // 촉이 점에 닿는 진행

      // ── 과녁의 점 — 처음 10% 에 떠오르고, 꼬리가 빨려 드는 동안 오므라들며, 다 빨려 든 순간 번쩍 · 그 뒤 0 으로 녹는다
      const ringOn = (P.seaMarkDot === undefined ? 1 : P.seaMarkDot) >= 0.5;
      const absorb = smooth(pArrive, P_END, p);
      const flash = Math.max(0, 1 - Math.abs(p - P_END) / 0.1);
      const dotA = ringOn ? A * smooth(0, 0.1, p) * (1 - smooth(P_END, 1, p)) : 0;
      const dotS = R * 0.42 * (1 - 0.35 * absorb);
      dotMat.opacity = dotA;
      dotMat.color.copy(base).multiplyScalar(1 + 0.9 * flash);
      dot.position.set(cx, sy, cz);
      dot.scale.setScalar(dotS);
      dot.visible = dotA > 0.002;
      // ── 과녁의 고리 — ⭐ 누른 순간 떠서 **퍼지며 은은하게 옅어진다** (2026-09-14, seaMarkRipple). 사용자 : *"클릭 했을때 원형이 표시되는데
      //   원형이 커지면서 불투명도 값으로 은은하게 사라지게해"*. 제 시계 q(seaMarkRingDur)로 간다 — 줄기보다 오래 남아 물결처럼 번진다.
      //   크기는 outCubic 으로 1 → seaMarkRingGrow 배 (처음에 빨리 퍼지고 끝에서 느려진다) · 진하기는 6% 에 떠올라 (1 − q)^1.6 으로 녹는다 (끝에서 0 — 불변식 19)
      //   ⚠ 퍼짐을 끄면(0) 점과 같은 시계 · 같은 크기 · 같은 번쩍임 — 예전 과녁 한 장과 같다
      let ringA, ringS;
      if (ripple) {
        const qq = Math.min(1, Math.max(0, q));
        const grow = Math.max(1, P.seaMarkRingGrow === undefined ? 2.6 : P.seaMarkRingGrow);
        ringA = ringOn ? A * smooth(0, 0.06, qq) * Math.pow(1 - qq, 1.6) : 0;
        ringS = R * 0.42 * (1 + (grow - 1) * (1 - Math.pow(1 - qq, 3)));
        ringMat.color.copy(base);
      } else {
        ringA = dotA;
        ringS = dotS;
        ringMat.color.copy(base).multiplyScalar(1 + 0.9 * flash);
      }
      ringMat.opacity = ringA;
      ring.position.set(cx, sy, cz);
      ring.scale.setScalar(ringS);
      ring.visible = ringA > 0.002;

      // ── 꼬리 · 촉
      const wHalf = R * (P.seaMarkWidth === undefined ? 0.12 : P.seaMarkWidth) * 0.5;
      const hs = R * 0.34 * headK;
      const diag = (P.seaMarkDiag === undefined ? 1 : P.seaMarkDiag) >= 0.5;
      const live = span > 1e-4 && A > 0.002;
      for (let k = 0; k < 4; k++) {
        const yaw = yaw0 + (diag ? Math.PI / 4 : 0) + k * Math.PI / 2;
        const ox = Math.cos(yaw), oz = -Math.sin(yaw);   // 이 길이 출발하는 바깥 방향 = R_y(yaw)·(1, 0, 0)
        const vb = k * (SEG + 1) * 2;
        let hx = cx, hy = sy, hz = cz;
        for (let j = 0; j <= SEG; j++) {
          const f = j / SEG;                 // 0 꼬리 끝 → 1 촉
          sample(lt + span * f, total);
          const x = cx + ox * smp.r, y = sy + smp.y, z = cz + oz * smp.r;
          // 접선 (월드) — r 이 줄어드는 쪽이 가운데
          _t.set(ox * smp.dr, smp.dy, oz * smp.dr);
          if (_t.lengthSq() < 1e-12) _t.set(-ox, 0, -oz);
          _t.normalize();
          // 옆 = 카메라 쪽 × 접선 (띠가 카메라를 본다)
          _c.set(cp.x - x, cp.y - y, cp.z - z).normalize();
          _s.crossVectors(_c, _t);
          if (_s.lengthSq() < 1e-10) _s.set(oz, 0, -ox);
          _s.normalize();
          const w = live ? wHalf * Math.pow(f, 0.6) : 0;   // 촉 쪽이 굵고 꼬리 끝에서 0
          const a = vb + j * 2;
          pos[a * 3] = x - _s.x * w; pos[a * 3 + 1] = y - _s.y * w; pos[a * 3 + 2] = z - _s.z * w;
          pos[(a + 1) * 3] = x + _s.x * w; pos[(a + 1) * 3 + 1] = y + _s.y * w; pos[(a + 1) * 3 + 2] = z + _s.z * w;
          const al = live ? A * Math.pow(f, 0.9) : 0;      // 꼬리 끝 알파 0 (불변식 19)
          col[a * 4] = col[a * 4 + 1] = col[a * 4 + 2] = 1; col[a * 4 + 3] = al;
          col[(a + 1) * 4] = col[(a + 1) * 4 + 1] = col[(a + 1) * 4 + 2] = 1; col[(a + 1) * 4 + 3] = al;
          if (j === SEG) { hx = x; hy = y; hz = z; }
        }
        // 촉 — 꼬리 앞끝의 접선(_t) · 옆(_s) 그대로. 법선 n = t × s 가 카메라 쪽이다 (s = c × t 이므로)
        const m = heads[k];
        _n.crossVectors(_t, _s);
        _m.makeBasis(_t, _s, _n);
        m.quaternion.setFromRotationMatrix(_m);
        m.position.set(hx - _t.x * HEAD_TIP * hs, hy - _t.y * HEAD_TIP * hs, hz - _t.z * HEAD_TIP * hs);
        m.scale.setScalar(Math.max(1e-4, hs));
        m.visible = live && headK > 0.01;
      }
      posAttr.needsUpdate = true;
      colAttr.needsUpdate = true;
      headMat.opacity = A;
      trail.visible = live;
      group.visible = ring.visible || dot.visible || live;
      last = {
        p: +p.toFixed(3), q: +q.toFixed(3), v: +v.toFixed(3), head: +lh.toFixed(3), tail: +lt.toFixed(3), headK: +headK.toFixed(2),
        pArrive: +pArrive.toFixed(3), ring: +ringA.toFixed(3), ringScale: +(ringS / (R * 0.42)).toFixed(2), ringWorldR: +(ringS * 0.36).toFixed(3),
        dot: +dotA.toFixed(3), dotScale: +(dotS / (R * 0.42)).toFixed(2), flash: +flash.toFixed(2),
        sec: +dur.toFixed(2), persp, kd: +kd.toFixed(3), distRatio: +(dist / ref).toFixed(3), R: +R.toFixed(2), apex: +(arc * R).toFixed(2), pathLen: +total.toFixed(2), diag, vis: +vis.toFixed(3),
        add, color: colHex, scene: [+cx.toFixed(2), +cz.toFixed(2)], world: [+wx.toFixed(2), +wz.toFixed(2)], sea: +sy.toFixed(3)
      };
    },

    dispose() {
      scene.remove(group);
      trailGeo.dispose();
      headGeo.dispose();
      ringGeo.dispose();
      trailMat.dispose();
      headMat.dispose();
      ringMat.dispose();
      dotMat.dispose();
      profTex.dispose();
      headTex.dispose();
      ringTex.dispose();
      dotTex.dispose();
    }
  };
}
