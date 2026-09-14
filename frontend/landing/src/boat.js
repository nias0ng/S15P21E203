import * as THREE from 'three';
import { CONFIG } from './config.js';
import { PARAMS as P } from './params.js';
import { paperVariant, paperRescale } from './paper.js';
import { swellCPU } from './swell.js';
import { clamp, D2R } from './util.js';

// ───────── 종이배 ─────────
// 메시 생성은 createBoatMesh() 안에만 있다. GLB 로 교체하려면 이 함수만 바꾼다
// (GLTFLoader 로 로드 → 같은 스케일·중심으로 맞춘 Group 을 반환).
//
// 자세는 두 층이다 :
//   1. 부력 — 높이맵을 선체 4점에서 읽어 pitch·roll·y 를 실제 수면에 맞춘다
//   2. 아이들 모션 — 서로 다른 주기의 sin 을 그 위에 얹는다
// 배는 물과 다른 프레임으로 끊는다 (물 12 / 배 8 — 컷아웃 애니메이션의 질감).
// 방향(rotation.y)만은 끊지 않는다. 조작은 항상 60fps 로 반응해야 한다.

// ⚠⚠ **진행 방향은 로컬 −z 다.** 뱃머리를 어디에 둘지는 취향이 아니라 좌표계가 정한다 :
//   main.js 가 `pivot.rotation.y = head` 로 놓고, 배의 물 기준 속도는 (vX, −vZ) =
//   vFwd·(sin h, −cos h) 다. h=0 에서 −z 이고, 같은 회전이 로컬 −z 를 월드 −z 로 보낸다.
//   카메라가 −z 를 보므로 **뱃머리는 화면 안쪽(멀어지는 쪽)** 을 향한다.
//   ⚠ 2026-09-06 이전의 종이배는 길이축이 로컬 **x** 였다 — 즉 옆으로 가고 있었다.
//     좌우 대칭이라 아무도 몰랐지만, 뱃머리가 있는 배는 그대로 두면 옆걸음질한다.
//     `CONFIG.buoy.armX/armZ` 도 같은 전제로 잡혀 있어 roll/pitch 축이 뒤바뀌어 있었다.
//
// 좌표 규약 (정규화 모델. 아래에서 CONFIG.boat.lengthW 로 스케일한다) :
//   z : −1 = 뱃머리 · +1 = 선미      (길이 2)
//   x : 좌우 (폭)
//   y : 0 = 용골 바닥 (⚠ pivot 과 같은 높이다 — boatLift 가 여기서 흘수를 만든다)

// 단면을 용골에서 현측까지 훑는 표본. t^EXP 로 밑을 좁혀 V 바닥을 만든다
const NST = 15, NCS = 5, V_EXP = 1.9, BILGE = 0.72;

// 평면형(half-beam) · 현호(sheer) · 용골(keel). u : 0 = 뱃머리 → 1 = 선미
const planF = (u) => (u > 0.62
  ? 0.60 + 0.40 * Math.pow((1 - u) / 0.38, 0.85)     // 최대폭 → 트랜섬 (선미는 폭이 남는다)
  : Math.pow(u / 0.62, 0.55));                        // 뱃머리(한 점) → 최대폭
const sheerF = (u) => 0.105
  + 0.150 * Math.pow(Math.max(0, 0.42 - u) / 0.42, 1.7)    // 뱃머리가 크게 들린다
  + 0.050 * Math.pow(Math.max(0, u - 0.72) / 0.28, 1.6);   // 선미는 조금만
const keelF  = (u) => -0.012 - 0.150 * Math.pow(Math.sin(Math.PI * Math.min(1, Math.max(0, u))), 0.62);

// 삼각형 인덱스를 격자에서 뽑는다
function grid(idx, a, b, c, d) { idx.push(a, b, d, a, d, c); }

function hullGeometry() {
  const pos = [], idx = [];
  // 좌현/우현을 한 장의 격자로 편다 : j = 0..2·NCS 가 좌현 현측 → 용골 → 우현 현측
  const W = 2 * NCS + 1;
  for (let i = 0; i < NST; i++) {
    const u = i / (NST - 1);
    const z = -1 + 2 * u;                 // −1 뱃머리 → +1 선미
    const hb = Math.max(0.34 * planF(u), 0.010);
    const sh = sheerF(u), kd = keelF(u);
    for (let j = 0; j < W; j++) {
      const side = j < NCS ? -1 : 1;
      const t = Math.abs(j - NCS) / NCS;  // 0 = 용골, 1 = 현측
      pos.push(side * hb * Math.pow(t, BILGE), kd + (sh - kd) * Math.pow(t, V_EXP), z);
    }
  }
  for (let i = 0; i < NST - 1; i++)
    for (let j = 0; j < W - 1; j++)
      grid(idx, i * W + j, i * W + j + 1, (i + 1) * W + j, (i + 1) * W + j + 1);
  // 갑판 : 좌현 현측 ↔ 우현 현측을 잇는다. ⚠ 안 닫으면 위에서 볼 때 배 속이 보인다
  const deck0 = pos.length / 3;
  for (let i = 0; i < NST; i++) {
    const u = i / (NST - 1), z = -1 + 2 * u;
    const hb = Math.max(0.34 * planF(u), 0.010), sh = sheerF(u);
    pos.push(-hb, sh, z, hb, sh, z);
  }
  for (let i = 0; i < NST - 1; i++)
    grid(idx, deck0 + i * 2, deck0 + i * 2 + 1, deck0 + (i + 1) * 2, deck0 + (i + 1) * 2 + 1);
  // 트랜섬(선미 마감). 갑판과 용골 사이를 한 장으로 덮는다
  const tr0 = pos.length / 3;
  const hbT = Math.max(0.34 * planF(1), 0.010), shT = sheerF(1), kdT = keelF(1);
  for (let j = 0; j < W; j++) {
    const side = j < NCS ? -1 : 1, t = Math.abs(j - NCS) / NCS;
    pos.push(side * hbT * Math.pow(t, BILGE), kdT + (shT - kdT) * Math.pow(t, V_EXP), 1);
    pos.push(side * hbT * Math.pow(t, BILGE), shT, 1);
  }
  for (let j = 0; j < W - 1; j++)
    grid(idx, tr0 + j * 2, tr0 + j * 2 + 1, tr0 + (j + 1) * 2, tr0 + (j + 1) * 2 + 1);

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// 부푼 삼각돛. ⚠ 평면 삼각형으로 두면 종이 조각으로 보인다 — 한쪽으로 부풀려야 '바람을 받은'
// 것으로 읽힌다. head(꼭대기) · tack(앞 아래) · clew(뒤 아래) 세 점을 잇고 s·t 로 부푼다
// roach : 뒷변(리치)을 바깥으로 부풀린 양. ⚠ 이게 없으면 삼각돛이 꼭대기에서 **실오라기**가
//   되어 화면에서는 '마스트 위쪽이 비어 있는' 것으로 읽힌다 (실제로 그렇게 보였다).
//   실물 돛도 배튼을 넣어 여기를 볼록하게 만든다. 지브는 반대로 오목한 게 보통이라 0 이다
function sailGeometry(head, tack, clew, belly, roach = 0, N = 7) {
  const pos = [], idx = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N;                                     // 0 = 꼭대기 → 1 = 아래 변
    for (let k = 0; k <= N; k++) {
      const s = k / N;                                   // 아래 변 위의 위치
      const bx = tack[0] + (clew[0] - tack[0]) * s;
      const by = tack[1] + (clew[1] - tack[1]) * s;
      const bz = tack[2] + (clew[2] - tack[2]) * s;
      // 삼각형이므로 위로 갈수록 s 방향 폭이 0 으로 모인다
      let x = head[0] + (bx - head[0]) * t;
      let y = head[1] + (by - head[1]) * t;
      let z = head[2] + (bz - head[2]) * t;
      // 리치 쪽(s→1)만 tack→clew 방향으로 밀어낸다. 중간 높이에서 가장 볼록하다
      const r = roach * Math.sin(Math.PI * t) * s * s;
      x += (clew[0] - tack[0]) * r; y += (clew[1] - tack[1]) * r; z += (clew[2] - tack[2]) * r;
      pos.push(x, y, z + belly * Math.sin(Math.PI * s) * Math.pow(t, 0.55));
    }
  }
  for (let i = 0; i < N; i++)
    for (let k = 0; k < N; k++)
      grid(idx, i * (N + 1) + k, i * (N + 1) + k + 1, (i + 1) * (N + 1) + k, (i + 1) * (N + 1) + k + 1);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

const spar = (len, r, axis) => {
  const g = new THREE.CylinderGeometry(r, r * 1.15, len, 6, 1);
  if (axis === 'z') g.rotateX(Math.PI / 2);
  return g;
};

// 용골이 가장 깊은 지점. 이만큼 올려야 **y = 0 이 용골 바닥**이 된다
const KEEL_MIN = Math.min(...Array.from({ length: NST }, (_, i) => keelF(i / (NST - 1))));

export function createBoatMesh() {
  const g = new THREE.Group();
  // ⚠⚠ 안쪽 그룹을 KEEL_MIN 만큼 올린다. **로컬 y = 0 이 용골 바닥이어야 한다** —
  //   boat.js 의 좌표 규약이자 params.boatLift 가 흘수를 만드는 전제다 (음수 = 잠김).
  //   처음엔 이 보정을 빠뜨려 y=0 이 흘수선 근처에 있었고, boatLift −0.20 이 겹쳐
  //   **건현이 0.06 월드밖에 안 남아 선체가 통째로 잠겼다** (화면에서 얇은 조각으로 보였다)
  const inner = new THREE.Group();
  inner.position.y = -KEEL_MIN;
  g.add(inner);
  // ⚠ 선체와 돛을 **다른 흰색**으로 둔다. 같은 값이면 흰 종이 위에서 두 면이 한 덩어리로
  //   뭉쳐 실루엣만 남는다. 돛은 순백 · 선체는 반 톤 낮은 종이색 · 마스트만 확실히 어둡다
  const sailMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.96, metalness: 0, side: THREE.DoubleSide });
  // ⚠⚠ 선체를 **한 톤 더 내린다** (0xF0EEE9 → 0xDCD9D2). 실측 : 그 전에는 선체 226 · 돛 227~228 로
  //   **완전히 같은 밝기**였고, 둘이 한 덩어리로 뭉쳐 실루엣만 남았다 (배경 245 · 물 209).
  //   ⚠ 더 내리지 않는다 — 물이 209 라 그 아래로 가면 이번엔 물에 붙는다. 사이에 세운다
  const hullMat = new THREE.MeshStandardMaterial({ color: 0xDCD9D2, roughness: 0.90, metalness: 0, flatShading: true, side: THREE.DoubleSide });
  const sparMat = new THREE.MeshStandardMaterial({ color: 0xB9B4AA, roughness: 0.75, metalness: 0 });

  inner.add(new THREE.Mesh(hullGeometry(), hullMat));

  // 핀 킬 — 이게 있어야 '돛단배' 로 읽힌다 (없으면 노 젓는 배다). 대부분 물에 잠겨
  // submerged.js 가 옅게 그린다. ⚠ 얕게 둔다 — 깊으면 파도 골에서 통째로 드러난다
  const keel = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.20, 0.52), hullMat);
  keel.position.set(0, -0.14, 0.10);
  inner.add(keel);

  // 마스트 · 붐. 뱃머리 쪽(−z)으로 조금 나가 있다
  // ⚠⚠ **MTOP 은 화면이 정한다, 실물이 아니다.** 실제 13 m 요트의 마스트는 LOA 의 1.2~1.4배
  //   (16~18 m = 정규화 2.6~2.9) 인데, 그 높이는 이 카메라의 세로 화각(43도) 밖으로 나간다.
  //   2026-09-06 : 1.52 → **2.00** (월드 5.0 = LOA 의 1.0배). 사용자 : "돛 좀 더 크게".
  //   ⚠ 이보다 올리려면 camDist 를 같이 올려야 한다 — 안 올리면 마스트 꼭대기가 잘린다.
  //     화면 눈금 실측 : 근경에서 약 50 px / 월드 (1280×720, camDist 1.4).
  const MX = 0, MZ = -0.10, MTOP = 2.00, DECK = 0.15;
  // ⚠ 굵기도 같이 올린다 (0.018 → 0.026). 마스트가 길어지면 같은 굵기가 실처럼 보이고,
  //   원경에서 한 픽셀 밑으로 내려가면 점선으로 끊긴다
  const mast = new THREE.Mesh(spar(MTOP - DECK + 0.10, 0.026), sparMat);
  mast.position.set(MX, (MTOP + DECK) / 2, MZ);
  const boom = new THREE.Mesh(spar(1.12, 0.018, 'z'), sparMat);
  boom.position.set(MX + 0.05, DECK + 0.10, MZ + 0.58);
  boom.rotation.x = -0.05;
  inner.add(mast, boom);

  // 메인세일 (마스트 뒤) · 지브 (마스트 앞). 같은 쪽(+x)으로 부풀려 한 바람을 받게 한다
  // ⚠ belly 를 0 으로 두면 종이 조각이 된다. 부호가 서로 반대면 서로 맞바람이 된다
  // ⚠⚠ **부푼 방향은 −x 다 (좌현).** 광원이 (−5, 5, 3.5) 라 빛이 −x 에서 온다.
  //   +x 로 부풀리면 카메라(camYaw 로 돌린 쪽)가 늘 **그늘진 면**을 보게 되어 흰 돛이
  //   회색 판때기가 된다 — 실제로 그렇게 나왔다. 볼록한 쪽과 빛이 같은 쪽이라야 흰 종이다.
  //   ⚠ 그래서 camYaw 의 부호와 이 부호는 **짝이다.** 하나만 뒤집으면 다시 그늘을 본다
  // ⚠ 2026-09-06 : 돛을 키웠다. 메인 러프 1.26 → **1.74** · 풋 0.84 → **1.06** (면적 약 1.7배).
  //   ⚠ 클루(뒤 아래 끝)를 z 0.98 까지 뺐다 — 트랜섬(z=1.0) 바로 앞이다. 더 빼면 선미 밖으로
  //     나가 '배에 안 붙은 돛' 이 된다.
  //   ⚠ belly 도 같이 키운다. 돛이 커지는데 부푼 양이 그대로면 **평평해져서** 종이 조각으로
  //     되돌아간다 — 볼록함은 절대값이 아니라 크기 대비다
  const main = new THREE.Mesh(
    sailGeometry([MX, MTOP, MZ], [MX, DECK + 0.11, MZ + 0.02], [MX - 0.02, DECK + 0.16, MZ + 1.08], -0.150, 0.26), sailMat);
  const jib = new THREE.Mesh(
    sailGeometry([MX, MTOP - 0.24, MZ], [MX, DECK + 0.06, -0.97], [MX - 0.01, DECK + 0.22, MZ - 0.05], -0.100), sailMat);
  main.rotation.y = -0.16; jib.rotation.y = -0.16;
  inner.add(main, jib);

  // ⚠⚠ 크기는 **CONFIG.boat.lengthW 하나가 정한다** (모델 길이가 2 라 그 절반이 배율).
  //   ocean-clock.js 의 선체속도도 같은 값을 읽는다 — 여기 숫자를 직접 적으면 물리가 갈라진다
  g.scale.setScalar(CONFIG.boat.lengthW / 2);
  return g;
}

export function createBoat(scene) {
  const boat = createBoatMesh();
  const pivot = new THREE.Group();
  pivot.rotation.order = 'YXZ';
  pivot.add(boat);
  scene.add(pivot);

  // ───────── GLB 모델 (1단계 : 보기만 한다) ─────────
  // 외부 GLB 모델을 축·크기·높이만 맞춰 얹는다. PB.params.boatModel 로 종이배(0) ↔ GLB(1).
  //
  // ⚠⚠ **이건 아직 '보기' 다.** 부력 팔(CONFIG.buoy.armX/armZ) · 흘수(boatLift·bowDepth) ·
  //   반사 슬라이스(reflectSlice) · 잠긴 선체(submerged.js) 는 **종이배 형상 기준 그대로**다.
  //   물리와 그림이 갈라져 있는 상태이므로 이 값으로 무엇을 판정하지 않는다.
  //
  // 좌표 맞추기 (원본 바운딩박스 22.514 × 21.980 × 6.308, min.y −2.947) :
  //   ① 길이축이 **x** 다 → rotation.y 로 z 로 돌린다. 불변식 0-2 는 진행 방향이 로컬 −z 다.
  //      ⚠⚠ **부호를 눈으로 정하지 않는다 — 선체 폭으로 잰다.** 2026-09-08 까지 −π/2 였는데
  //        그러면 뱃머리가 **+z** 로 가서 배가 3주간 뒤로 항해했다 (사용자 지적).
  //        실측 (pivot 로컬, z 를 0.5 간격으로 묶어 최대 반폭) :
  //          z −2.5 : 0.59 · −1.0 : 0.72 · +1.0 : 0.55 · +1.5 : 0.41 · +2.0 : **0.24**
  //        폭이 0 으로 좁아지는 +z 쪽이 뱃머리다. 진행 방향이 −z 이므로 π 를 더해 뒤집는다.
  //   ② 스케일 = lengthW / 22.514. 종이배의 '모델 길이 2' 규약과 무관하게 **실측 길이**로 맞춘다.
  //   ③ y : 원본 min −2.947 을 0 으로 올린다 — 불변식 0-3 의 '로컬 y = 0 은 용골 바닥'.
  //      ⚠ 돛대 끝이 19.033 이라 스케일 후 약 4.9 다. reflectSlice 6.0 이 여전히 안 자른다.
  const GLB_URL = 'boat_v2.glb';   // vite public/ — base './' 라 상대 경로로 둔다
  const GLB_YAW = Math.PI / 2;        // 길이축 x → z. 부호는 위의 선체 폭 실측이 정한다
  const glbRoot = new THREE.Group();
  glbRoot.visible = false;
  pivot.add(glbRoot);
  let glbLoaded = false;
  const glbMats = [];
  let glbObj = null, glbBaseY = 0;   // 로드 때 계산한 기준 높이. boatGlbLift 가 여기에 더해진다

  // ───────── 돛의 바람 모션 ─────────
  // ⚠ CPU 로 정점을 갱신하지 않는다. 표준 재질에 onBeforeCompile 로 **정점 셰이더만 끼워**
  //   GPU 에서 민다 — 833정점이든 8만정점이든 비용이 같다.
  // ⚠ 시각은 uTimeQ(물의 시계)를 쓴다. 실시간 t 로 흔들면 파도와 따로 놀아
  //   컷아웃 질감이 깨진다 (불변식 1 : 새 층은 어느 시계를 볼지 먼저 정한다).
  // ⚠ 마스트에 붙은 쪽은 고정이고 자유단으로 갈수록 크게 흔들려야 한다. 그 축과 범위는
  //   **돛 메시의 로컬 바운딩박스에서 실측**한다 (숫자를 적지 않는다).
  const sailUni = {
    uWindT: { value: 0 },
    uWindAmp: { value: 0 },
    uWindFreq: { value: 0 },
    uSailSpan: { value: new THREE.Vector2(0, 1) },  // 마스크 축의 [고정단, 자유단]
    uSailFlip: { value: 0 }                         // 고정단이 반대쪽이면 1
  };
  // ⚠⚠ **가장 긴 로컬 축을 돛의 폭으로 삼으면 안 된다.** 이 모델은 로컬 z 가 가장 길지만(564.3)
  //   그 축이 월드에서는 **수직**이다 (실측 : 로컬 z → 월드 y). 그대로 쓰면 돛이 마스트가 아니라
  //   **밑동에서 접히고** 마스트에 붙은 앞선이 같이 흔들린다. 로컬 축과 월드 방향은 별개다.
  //   그래서 세 축을 전부 **실측**해서 고른다 :
  //     · 미는 방향  = 법선 절대값 평균이 가장 큰 축 (= 천의 face. 실측 y 0.866)
  //     · 폭(마스크) = 남은 둘 중 **월드에서 더 수평한** 축 (마스트가 수직이므로 그 직교가 폭이다)
  //     · 고정단     = 그 축의 두 끝 중 **마스트에 가까운** 쪽
  //   ⚠ 월드 수평도는 y 회전에 안 변한다 — 이 체인의 회전(GLB_YAW · pivot.rotation.y)이 전부
  //     y 축이라 로드 시점에 재도 안전하다.
  let sailAxis = 2;
  let sailAuto = 0;   // 실측으로 고른 고정단. params 의 sailFlip 이 이 위에 XOR 로 얹힌다
  let sailMesh = null, sailMat = null, mastNode = null;
  let sailPhase = 0, sailQPrev = 0;   // 나부낌 위상은 적분한다 (아래 update 의 ⚠⚠ 참고)
  // ⚠⚠ **돛의 로컬 좌표는 월드가 아니다.** 이 GLB 는 span 이 564.3 인데 월드로는 0.0093 배로
  //   줄어 들어온다. 그래서 진폭·주파수를 로컬 단위로 적으면 **모델을 바꾸는 순간 뜻이 조용히
  //   달라진다** (실측 : sailWind 6.0 = 월드 0.086 = 돛 크기의 1.6%. 거의 안 움직였다).
  //   두 손잡이를 여기서 잰 span 으로 정규화한다 — sailWind = 돛 길이의 몇 배 ·
  //   sailWindFreq = 돛을 가로지르는 물결의 개수. 그러면 모델이 바뀌어도 뜻이 안 변한다.
  let sailSpan = 1;
  // 돛의 축·폭·고정단을 실측해서 정점 셰이더를 끼운다.
  // ⚠ traverse **안**에서 부르지 않는다 — 마스트가 돛보다 늦게 순회될 수 있다.
  const setupSail = () => {
    if (!sailMesh || !sailMat) return false;
    const geo = sailMesh.geometry;
    geo.computeBoundingBox();
    const bb = geo.boundingBox;
    const mn = [bb.min.x, bb.min.y, bb.min.z], mx = [bb.max.x, bb.max.y, bb.max.z];

    // (1) 미는 방향 = 천의 face. 법선 절대값 평균이 가장 큰 축이다 (실측 y 0.866)
    const nr = geo.attributes.normal, N = nr.count;
    const acc = [0, 0, 0];
    for (let i = 0; i < N; i++) {
      acc[0] += Math.abs(nr.getX(i)); acc[1] += Math.abs(nr.getY(i)); acc[2] += Math.abs(nr.getZ(i));
    }
    const outAx = acc.indexOf(Math.max(...acc));

    // (2) 폭 = 남은 둘 중 **월드에서 더 수평한** 축. 마스트가 수직이라 그 직교가 돛의 폭이다
    sailMesh.updateWorldMatrix(true, false);
    const e = sailMesh.matrixWorld.elements;
    const worldTilt = (ax) => {                       // 이 로컬 축이 월드에서 얼마나 수직인가
      const v = [[e[0], e[1], e[2]], [e[4], e[5], e[6]], [e[8], e[9], e[10]]][ax];
      const len = Math.hypot(v[0], v[1], v[2]) || 1;
      return Math.abs(v[1]) / len;                    // 0 = 완전 수평 · 1 = 완전 수직
    };
    const rest = [0, 1, 2].filter(a => a !== outAx);
    const spanAx = worldTilt(rest[0]) <= worldTilt(rest[1]) ? rest[0] : rest[1];
    const pushAx = rest[0] === spanAx ? rest[1] : rest[0];

    // (3) 고정단 = 그 축의 두 끝 중 마스트에 가까운 쪽
    let flip = 0;
    if (mastNode) {
      mastNode.updateWorldMatrix(true, false);
      mastNode.geometry.computeBoundingBox();
      const mb = mastNode.geometry.boundingBox;
      const mc = new THREE.Vector3((mb.min.x + mb.max.x) / 2, (mb.min.y + mb.max.y) / 2,
        (mb.min.z + mb.max.z) / 2).applyMatrix4(mastNode.matrixWorld);
      const at = (v) => {
        const q = new THREE.Vector3();
        for (const k of [0, 1, 2]) q.setComponent(k, k === spanAx ? v : (mn[k] + mx[k]) / 2);
        return q.applyMatrix4(sailMesh.matrixWorld);
      };
      // 마스트에 가까운 끝이 lo 면 자유단은 hi (flip 0), 반대면 flip 1
      flip = at(mn[spanAx]).distanceTo(mc) <= at(mx[spanAx]).distanceTo(mc) ? 0 : 1;
    }

    sailAxis = spanAx; sailAuto = flip;
    sailUni.uSailSpan.value.set(mn[spanAx], mx[spanAx]);
    sailSpan = Math.max(mx[spanAx] - mn[spanAx], 1e-6);
    const AX = 'xyz'[spanAx], PU = 'xyz'[pushAx], OUT = 'xyz'[outAx];
    sailMat.onBeforeCompile = (sh) => {
      sh.uniforms.uWindT = sailUni.uWindT;
      sh.uniforms.uWindAmp = sailUni.uWindAmp;
      sh.uniforms.uWindFreq = sailUni.uWindFreq;
      sh.uniforms.uSailSpan = sailUni.uSailSpan;
      sh.uniforms.uSailFlip = sailUni.uSailFlip;
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>',
          '#include <common>\nuniform float uWindT, uWindAmp, uWindFreq, uSailFlip;\nuniform vec2 uSailSpan;')
        .replace('#include <begin_vertex>',
          '#include <begin_vertex>\n' +
          // 고정단 0 → 자유단 1. 제곱해서 마스트 쪽은 거의 안 움직이게 한다
          'float sMask = clamp((position.' + AX + ' - uSailSpan.x) / max(uSailSpan.y - uSailSpan.x, 1e-4), 0.0, 1.0);\n' +
          'sMask = mix(sMask, 1.0 - sMask, uSailFlip);\n' +
          'sMask *= sMask;\n' +
          // 두 방향의 파를 겹쳐 한 방향 물결이 안 되게 한다
          'float w = sin(position.' + AX + ' * uWindFreq + uWindT)\n' +
          '        + 0.55 * sin(position.' + PU + ' * uWindFreq * 1.7 - uWindT * 1.3);\n' +
          'transformed.' + OUT + ' += w * uWindAmp * sMask;');
    };
    sailMat.needsUpdate = true;
    console.log('[GLB] 돛 폭축=' + AX + ' 밀기=' + OUT + ' 물결=' + PU +
      ' · 폭 ' + sailSpan.toFixed(1) + ' · 고정단 ' + (flip ? 'hi' : 'lo') +
      (mastNode ? ' (마스트 실측)' : ' (마스트 못 찾음)'));
    return true;
  };

  const PAPER_COL = new THREE.Color(CONFIG.color.boatBody || '#DCD9D2');
  // 맵은 살아 있고 이 스칼라와 **곱해진다**. 0 이면 그 맵이 통째로 죽으므로 0 을 기본으로 두지 않는다
  // ⚠⚠ **종이를 입히지 않을 재질** (2026-09-09, 사용자 : *"mast, closed off 같은 철재
  //   표현을 제외하고"*). 이름으로 고른다 — GLB 의 재질이 26개인데 전부 이름이 붙어 있다.
  //   ⚠ 유리·창은 종이가 아니고, 밧줄·경첩·플랜지·나선·바퀴는 금속 부속이다.
  //   ⚠ GLB 를 갈아끼우면 이 목록을 같이 본다. 여기 없는 이름은 **전부 종이로 간주**한다
  const PAPER_SKIP = /mast|closed[ _]?off|hinge|flange|helix|rope|glass|window|edge/i;

  // ⚠⚠ **선실의 단계적 종이색** (2026-09-09, 사용자 : *"요소마다 전부 같은 짙은 종이색이
  //   아니라 단계적 종이색을 구성해봐"*).
  //   값은 `PAPER_DEEP` 쪽으로 얼마나 갔는가다 — 0 은 모델이 들고 온 색 그대로.
  //   ⚠ **순서에 뜻이 있다** : 바깥(하늘을 보는 난간)에서 안(선실 깊은 곳)으로 갈수록 짙다.
  //     빛이 덜 드는 곳이 어둡다는 것이 유일한 근거이고, 그래서 자리를 바꾸면 순서도 바뀐다.
  //   ⚠ 여기 없는 재질(Boat 선체·Veil 돛 등)은 **0** 이다 — 흰 종이로 남는다.
  //     선체까지 짙게 하면 '흰 종이 위 흰 물' 이 통째로 깨진다 (불변식 14)
  const PAPER_SHADE = {
    security:      0.20,   // 난간 — 가장 바깥. 하늘을 본다
    door:          0.34,
    handle:        0.40,
    ground:        0.46,   // 선실 바닥
    plank_table:   0.52,
    support_table: 0.52,
    support_wheel: 0.58,
    support_seat:  0.64,
    wheel:         0.70,
    pillow:        0.80,   // 선실에서 가장 안쪽
    // ⚠⚠ **아래 둘은 종이 결이 없다** (PAPER_SKIP 에 걸린다) — 사용자 : *"mast 랑 closed off 는
    //   종이질감이 아니라 색상을 더 진하게"*. 색과 질감이 **서로 독립**이라 표에만 넣으면 된다 :
    //   질감은 PAPER_SKIP 이, 색은 이 표가 각각 쥔다.
    //   ⚠ 철재라도 **같은 종이색 선**을 쓴다. 여기에 차가운 회색을 섞으면 배 안에서 이 둘만
    //     다른 재질로 튄다 — 한 장의 종이로 접은 배라는 전제가 깨진다
    mast:          0.58,   // 돛대. 흰 하늘을 등지고 서므로 진해야 형태가 읽힌다
    closedoff:     0.44,   // 선실 외벽. 면이 넓어(69k 삼각형) 너무 짙으면 배가 무거워진다
    // ⚠⚠ **선체와 돛은 아주 약간만** (2026-09-09, 사용자 : *"boat 부분도 약간의 무채색을
    //   약간만 짙게해서 너무 흰색을 통한 모델링 화이트홀 같은 현상이 있는데"*).
    //   순백(#ffffff)은 형태가 통째로 날아간다 — 조명이 어느 각도로 와도 255 에서 포화되니
    //   면끼리 구분이 안 선다. 몇 레벨만 내려도 램버트 음영이 살아난다.
    //   ⚠ 크게 내리지 않는다. 이 바다의 축은 여전히 '흰 종이 위 흰 물' 이다 (불변식 14)
    boat:          0.10,   // 선체
    veil:          0.05    // 돛 — 천이라 가장 옅다
  };
  // ⚠ 표에 없는 재질의 바닥값. **순백을 남기지 않기 위한 것**이다 — 화이트홀은 선체만의
  //   문제가 아니라 흰 부속 전부의 문제였다. 눈에 안 띄되 포화는 면하는 자리
  const PAPER_BASE = 0.06;
  // ⚠ 짙은 쪽 끝점. 종이 계열의 따뜻한 회색이다 — 이 바다에서 **배는 따뜻한 쪽**이고
  //   물은 전부 차갑다 (config.js 의 팔레트 규칙). 여기에 차가운 회색을 쓰면 배가 금속이 된다
  const PAPER_DEEP = new THREE.Color('#A79E8D');
  const shadeOf = (name) => {
    const k = String(name || '').toLowerCase().replace(/[^a-z_]/g, '');
    return (k in PAPER_SHADE) ? PAPER_SHADE[k] : PAPER_BASE;
  };

  const syncGlbMat = () => {
    const on = P.paperAmount > 0;
    const scale = Math.max(1, P.paperScale);
    const varyKey = String(P.paperVary);
    for (const m of glbMats) {
      // 원본 색 ↔ 종이 톤 사이를 섞는다. 0 이면 모델이 들고 온 색 그대로다
      // ⚠ 두 단계다 : ① 전체를 종이 톤으로 덮는 boatPaperTone(예전 동작) ②  선실 요소를
      //   자기 몫만큼 짙게 하는 PAPER_SHADE. ②는 paperShade 가 0 이면 통째로 꺼진다
      if (m.userData.origColor) {
        m.color.copy(m.userData.origColor).lerp(PAPER_COL, P.boatPaperTone);
        const sh = shadeOf(m.name) * P.paperShade;
        if (sh > 0) m.color.lerp(PAPER_DEEP, Math.min(1, sh));
      }
      // ⚠⚠ **금속은 종이의 여집합이다** — PAPER_SKIP 을 그대로 뒤집어 쓴다.
      //   목록을 두 번 적으면 반드시 갈라진다 (불변식 2 와 같은 규율)
      const 금속 = PAPER_SKIP.test(m.name || '');
      const k = 금속 ? Math.max(0, Math.min(1, P.metalAmount)) : 0;
      m.metalness = P.boatMetal + (P.metalMetalness - P.boatMetal) * k;
      m.roughness = P.boatRough + (P.metalRough  - P.boatRough)  * k;
      // ⚠⚠ **이 줄이 빠져서 GLB 만 3배 밝게 빛났다** (2026-09-07).
      //   GLTFLoader 가 만든 재질은 envMapIntensity 가 **기본 1.0** 인데, 종이배는 main.js 의
      //   applyEnv() 가 envIntensity(0.35)를 먹인다. GLB 는 **나중에 로드되므로 그 순회를
      //   놓친다** — 씬에 없던 물건은 applyEnv 가 못 만진다. 여기서 직접 맞춘다.
      m.envMapIntensity = P.envIntensity;
      // ⚠⚠ **돛(천)만 따로 간다** (2026-09-11, 사용자 : *"돛 천부분이 햇빛을 받아 반사가 심한 경우가
      //   있는 … 반사되는걸 끌 수 있나? 너무 흰색을 표현하고 있어서"*).
      //   실측 (1440×731 · 항해 구도 · 배 방향 30° 간격 한 바퀴 · HDR 선형값) : 돛 픽셀의 최대 **86%** 가
      //   1.0 을 넘어 **순백으로 잘렸다** (60°·240° 부근). 주범은 반사가 아니라 **확산광**이다 —
      //   거의 순백(#fcfbfb) 알베도에 방향광 2.2 + 반구광 1.35 + 환경 0.35 가 겹치고 톤 매핑이 없다.
      //   정반사는 번쩍이는 **점**(돛의 0.2~0.65%, 블룸 문턱 1.40 을 넘는 자리)만 만든다.
      // ⚠⚠⚠ 그래서 **반사만 끄면 오히려 더 하얘진다** (잘림 86% → 99%). 금속기 0.15 가 확산광을
      //   0.85 배로 누르고 있었기 때문이다 — 금속기를 빼면 그 15% 가 돌아온다.
      //   **끄는 것(sailSpec)과 톤을 내리는 것(sailTone)은 한 묶음이다.** 한쪽만 되돌리지 않는다.
      // ⚠ 둘 다 1 이면 예전과 비트 단위로 같다 (금속기 ×1 · 정반사 1 · 색 ×1).
      // ⚠ 이 GLB 의 돛은 `MeshPhysicalMaterial` 이다 (GLTFLoader). 그래서 `specularIntensity` 로
      //   정반사 층만 끌 수 있다 — 0 이면 직접광 하이라이트와 환경 반사가 같이 꺼지고
      //   확산광(환경의 확산 몫 포함)은 그대로 남는다. Standard 재질이면 금속기만 줄어든다.
      // ⚠ 종이배(boatModel 0)의 돛(`sailMat`, 위쪽)은 원래 금속기 0 · 거칠기 0.96 이라 여기서 안 만진다.
      if (/veil|sail|cloth/i.test(m.name || '')) {
        const sp = clamp(P.sailSpec === undefined ? 1 : P.sailSpec, 0, 1);
        m.metalness *= sp;
        // ⚠ 모델이 들고 온 값에 곱한다 (이 GLB 는 1). 그대로 대입하면 1 에서 원본과 갈라진다
        if (m.isMeshPhysicalMaterial) {
          if (m.userData.origSpec === undefined) m.userData.origSpec = m.specularIntensity;
          m.specularIntensity = m.userData.origSpec * sp;
        }
        if (m.userData.origColor) m.color.multiplyScalar(P.sailTone === undefined ? 1 : P.sailTone);
      }
      // ⭐ **선체(Boat)도 돛처럼** (2026-09-11 오후, 사용자 : *"선체 톤도 돛처럼 내리긴해야할듯"*).
      //   원인이 돛과 같다 — 거의 순백(#f8f7f7) 알베도 × (방향광 2.2 + 반구광 1.35 + 환경 0.35), 톤 매핑 없음.
      //   돛만 내려 두니 방향에 따라 **선체가 돛보다 밝았다** (60° 중앙값 선체 0.96 vs 돛 0.92, v0.30.1 에서 곁에서 잰 값).
      //   ⚠⚠ 돛과 같은 함정 : **반사만 끄면 더 하얘진다** (금속기가 확산광을 누르던 몫이 돌아온다). 둘은 한 묶음이다.
      //   ⚠ 이름이 정확히 'Boat' 인 재질만 — Security(난간) · Pot · Entrance 같은 흰 부속은 안 만진다 (PAPER_SHADE 가 이미 쥔다)
      //   ⚠ 둘 다 1 이면 비트 단위로 예전이다
      if (/^boat$/i.test(m.name || '')) {
        const sp = clamp(P.hullSpec === undefined ? 1 : P.hullSpec, 0, 1);
        m.metalness *= sp;
        if (m.isMeshPhysicalMaterial) {
          if (m.userData.origSpec === undefined) m.userData.origSpec = m.specularIntensity;
          m.specularIntensity = m.userData.origSpec * sp;
        }
        if (m.userData.origColor) m.color.multiplyScalar(P.hullTone === undefined ? 1 : P.hullTone);
      }
      // ── 종이 질감. ⚠⚠ **재질마다 결이 다르다** (2026-09-09, 사용자 : *"너무 많은 곳에
      //   일정한 비율로 되고 있는데"*). 텍스처는 clone 이라 GPU 이미지를 공유한다 — 26개가
      //   각자 들어도 VRAM 은 두 장이다. 방향·배율·이음매만 이름 해시로 흩는다.
      //   ⚠ clone 은 **한 번만** 만든다. scale 이 바뀌면 repeat 만 갱신한다 (드래그마다
      //     새로 만들면 그게 누수다). vary 가 바뀔 때만 다시 만든다
      const 종이 = on && !PAPER_SKIP.test(m.name || '');
      if (종이) {
        if (!m.userData.paperVar || m.userData.paperVaryKey !== varyKey) {
          m.userData.paperVar = paperVariant(m.name, 1, P.paperVary);
          m.userData.paperVaryKey = varyKey;
        }
        paperRescale(m.userData.paperVar, scale);
      }
      const wantN = 종이 ? m.userData.paperVar.normalMap : null;
      if (m.normalMap !== wantN) {
        m.normalMap = wantN;
        m.roughnessMap = 종이 ? m.userData.paperVar.roughnessMap : null;
        m.needsUpdate = true;
      }
      if (m.normalScale) m.normalScale.set(P.boatNormal, P.boatNormal);
      m.needsUpdate = true;
    }
    // ⚠⚠ **GLB 전용 흘수.** 종이배는 바닥이 평평해 최저점이 곧 흘수선이지만, 이 모델은
    //   최저점이 **킬(용골) 끝**이라 같은 높이에 두면 선체까지 잠긴다 (사용자 : *"배의 부력값을
    //   위로 더 올려서 맞춰야 함"*). 그래서 종이배와 같은 자리에 놓은 뒤 이 값만큼 띄운다.
    //   ⚠ boatLift 를 쓰면 안 된다 — 그건 종이배에도 걸려 둘이 같이 움직인다.
    if (glbObj) glbObj.position.y = glbBaseY + P.boatGlbLift;
  };

  const loadGLB = () => {
    if (glbLoaded) return;
    glbLoaded = true;
    import('three/examples/jsm/loaders/GLTFLoader.js').then(({ GLTFLoader }) => {
      new GLTFLoader().load(GLB_URL, (gltf) => {
        const o = gltf.scene;
        // ⚠⚠ **크기를 손으로 적지 않는다 — 실측해서 맞춘다.**
        //   accessor 의 min/max 로 읽은 22.514 는 **로컬 정점 좌표**이고, GLB 안의 중간 노드에
        //   자체 스케일이 걸려 있어 실제 월드 크기는 0.225 였다 (100배 차이. 실측으로 잡았다).
        //   그래서 회전을 먼저 걸고 Box3 로 잰 뒤 그 길이로 나눈다.
        o.rotation.y = GLB_YAW;                // 길이축 x → z 먼저
        o.updateWorldMatrix(true, true);
        const box = new THREE.Box3().setFromObject(o);
        const size = box.getSize(new THREE.Vector3());
        const len = Math.max(size.z, size.x, 1e-6);       // 회전 뒤라 z 가 길이축이다
        o.scale.multiplyScalar(CONFIG.boat.lengthW / len);
        // 스케일을 건 뒤 다시 재서 용골 바닥을 로컬 y = 0 으로 맞춘 다음,
        // **종이배의 용골 높이로 다시 내린다.**
        // ⚠⚠ 불변식 0-3 은 *"boat.js 의 로컬 y = 0 은 용골 바닥"* 이라고 적어 두었지만
        //   **실측하니 종이배의 로컬 용골은 −0.195 다** (0 이 아니다). 흘수(boatLift −0.28)가
        //   그 −0.195 를 전제로 잡혀 있으므로, GLB 를 y = 0 에 두면 **0.195 만큼 덜 잠긴다.**
        //   그래서 종이배의 용골을 그때그때 재서 같은 자리에 놓는다 — 숫자를 적지 않는 이유는
        //   종이배 모델이 바뀌면 이 값도 따라와야 하기 때문이다 (불변식 2 와 같은 규율).
        o.updateWorldMatrix(true, true);
        const box2 = new THREE.Box3().setFromObject(o);
        o.position.y -= box2.min.y;
        // ⚠ n.matrix 는 **직속 부모 기준**이라 중첩 그룹에서 누적이 안 된다 (그렇게 0.045 틀렸다).
        //   pivot 의 역행렬을 곱해 **pivot 로컬**로 통일한다.
        pivot.updateMatrixWorld(true);
        const invPivot = pivot.matrixWorld.clone().invert();
        const pbox = new THREE.Box3();
        boat.traverse(n => {
          if (!n.isMesh) return;
          n.geometry.computeBoundingBox();
          const m = n.matrixWorld.clone().premultiply(invPivot);
          pbox.union(n.geometry.boundingBox.clone().applyMatrix4(m));
        });
        if (isFinite(pbox.min.y)) o.position.y += pbox.min.y;   // 종이배와 같은 흘수로
        glbObj = o; glbBaseY = o.position.y;                    // 여기에 boatGlbLift 가 더해진다
        // ⚠⚠ **색만 종이 톤으로 덮고 나머지 맵은 살린다** (2026-09-07, 사용자 선택).
        //   이 바다는 '흰 종이 위 흰 물' 이 축이라(불변식 14) 사진 텍스처가 붙은 배는
        //   혼자 다른 그림이 된다. 그렇다고 재질을 통째로 갈면 형태의 디테일까지 잃는다.
        //   그래서 baseColor(map) **한 장만** 버리고 normal · roughness · metalness 는 남긴다.
        //   ⚠ 이 GLB 는 roughness/metalness/ao 가 **한 장을 공유한다** (표준 glTF 의 ORM 패킹).
        //     그래서 버릴 수 있는 것이 map 하나뿐이다 — 3장 → 2장.
        //   ⚠ aoMap 은 uv2(three 0.160 의 uv1)가 없어 **어차피 안 먹는다.** 떼어 둔다.
        //   ⚠ 원본은 metalness 1 · roughness 1 이다. 맵과 **곱해지는** 스칼라라 그대로 두면
        //     종이가 아니라 금속으로 읽힌다 — params 로 열어 둔다.
        o.traverse(n => {
          if (!n.isMesh) return;
          n.layers.enable(2);          // ⚠ 반사 패스는 레이어 2 만 찍는다 (reflect.js)
          // ⚠ 2026-09-09 : false → true. 실제 스위치는 renderer.shadowMap.enabled 다
          //   (params.boatShadow). 여기서 끄면 값을 켜도 안 나온다
          n.castShadow = true;
          n.receiveShadow = true;
          // ⚠⚠ **돛만 그림자를 안 받는다** (2026-09-09, 사용자 : *"veil 네이밍 된 부분만
          //   지금 점이 여러개 뜨고 있습니다"*). `Veil` 이 곧 **돛천**이다 (숨기면 돛이 사라진다).
          //   돛은 얇은 양면(side 2) 천이라 그림자를 받게 두면 **자기 자신에게** 얼룩이 진다 —
          //   sailWind 로 물결치는 굴곡이 자기 그림자를 만들어 원형 반점 몇 개로 나온다.
          //   ⚠ **castShadow 는 살려 둔다** — 돛이 갑판에 드리우는 그림자는 이 층의 핵심이다.
          //   ⚠ bias/normalBias 로 밀어내는 길도 있지만, 그러면 갑판 그림자가 같이 뜬다
          //     (peter-panning). 얇은 천은 자기 그림자를 안 받는 쪽이 옳다.
          if (/veil/i.test(n.name || '')) n.receiveShadow = false;
          const ms = Array.isArray(n.material) ? n.material : [n.material];
          ms.forEach(m => {
            m.map = null; m.aoMap = null;
            // ⚠ **모델이 들고 온 색을 보존한다.** 이 모델은 재질이 23개(Boat·Mast·Sail·Window·
            //   Rope·Pillow…)로 나뉘어 색이 각각 잡혀 있고 텍스처가 0장이라 **색이 재질에 직접**
            //   들어 있다. 예전에는 여기서 전부 종이 톤으로 덮어 그 구분을 뭉갰다.
            //   지금은 원본을 들고 있다가 boatPaperTone 으로 섞는다 (0 = 원래 색 · 1 = 종이 톤).
            m.userData.origColor = m.color.clone();
            // ⚠⚠ **선체가 투명 재질로 들어온다** (glTF 의 alphaMode BLEND → three 의
            //   transparent true · depthWrite false). 그래서 배 안쪽으로 **수면이 그대로 비쳤다**
            //   (사용자 : *"배 선체 모델링 내부에는 물이 안 보이게 할 수는 없나"*).
            //   면이 없는 게 아니다 — side 는 이미 DoubleSide 라 안쪽 면도 그려진다.
            //   **투명이라 뒤가 비친 것이지 모델링 구멍이 아니다.**
            //   baseColor 를 버린 이상 알파를 쓸 일이 없으므로 불투명으로 되돌린다.
            //   ⚠ depthWrite 가 false 면 깊이를 안 남겨 뒤 물체가 앞에 그려지기도 한다. 같이 켠다.
            m.transparent = false; m.opacity = 1; m.depthWrite = true;
            glbMats.push(m);

            // 돛(천)이면 바람 모션을 끼운다. 재질 이름으로 고른다 — 메시 이름은 Mesh.012 처럼
            // 의미가 없지만 재질은 Veil·Boat·Mast 로 나뉘어 있다
            if (/mast|pole|spar/i.test(m.name || '')) mastNode = n;
            if (/veil|sail|cloth/i.test(m.name || '')) { sailMesh = n; sailMat = m; }
          });
        });
        syncGlbMat();
        glbRoot.add(o);
        o.updateWorldMatrix(true, true);
        setupSail();   // ⚠ 월드행렬이 확정된 **뒤**라야 축의 수평도를 잰다
        const b3 = new THREE.Box3().setFromObject(o);
        console.log('[GLB] 맞춘 크기 x/y/z =',
          b3.getSize(new THREE.Vector3()).toArray().map(v => +v.toFixed(2)).join(' / '),
          '· 용골 y =', +b3.min.y.toFixed(3));
      }, undefined, (e) => { console.warn('GLB 로드 실패:', e); });
    });
  };

  // 종이배 ↔ GLB 전환. ⚠ 값이 바뀔 때만 만진다 (매 프레임 traverse 하지 않는다)
  let modelOn = -1;
  const syncModel = () => {
    const want = (P.boatModel || 0) >= 0.5 ? 1 : 0;
    if (want === modelOn) return;
    modelOn = want;
    if (want) loadGLB();
    boat.visible = !want;
    glbRoot.visible = !!want;
  };

  // 그림자는 없다. 예전에는 배 밑에 타원 하나를 깔았는데, 광원 방향과 무관하게 항상
  // 발밑에 붙어 있어서 '임의로 그린 얼룩'으로 보였다. 지금은 그 자리를 수면에 비치는
  // 실제 반사(reflect.js)가 대신한다 — 그건 파도를 따라 일렁인다.

  const buoy = { y: 0, rx: 0, rz: 0 };
  let btPrev = -1;
  let lean = 0;
  let pRx = 0, pRz = 0;   // 직전 목표 자세 — 위상 선행(파도보다 먼저 움직이기)에 쓴다

  const api = {
    pivot, mesh: boat,
    // ⚠ 모델 전환을 밖에서도 부를 수 있게 연다. update() 안에서만 돌면 **rAF 가 멈춘 환경
    //   (창이 가려짐 · 계측 중)에서 값을 바꿔도 아무 일이 안 일어난다** — 실제로 그렇게 헤맸다.
    //   main.js 의 apply() 가 이걸 부르므로 패널에서 바꾸면 즉시 반영된다.
    syncModel: () => { syncModel(); syncGlbMat(); },
    // 부력 프로브 [월드 x 오프셋, 월드 z 오프셋, 그 자리에서 읽은 수면 높이] × 5.
    // probes.js(개발 전용)가 이걸 그린다 — CPU 부력과 GPU 수면이 갈라졌는지 눈으로 보는 유일한 수단
    probes: [[0,0,0],[0,0,0],[0,0,0],[0,0,0],[0,0,0]],
    stepped: false,   // 이번 프레임에 배가 갱신됐는가 (sim.stepped 와 짝. perf.js 가 본다)

    update(sim, { t, s, mv, head, headV }) {
      syncModel();   // 종이배 ↔ GLB (값이 바뀔 때만 실제로 만진다)
      // 돛의 바람. ⚠ 물의 시계(sim.qT)를 쓴다 — 실시간 t 로 흔들면 파도와 따로 논다.
      //   ⚠ 이 갱신만은 boatFps 게이트 **밖**이다. 게이트에 걸면 천이 덜덜 떤다
      // ⚠⚠ **위상을 곱하지 않고 적분한다.** 예전엔 uWindT = qT × sailWindSpeed 였는데,
      //   그러면 속도 배수가 바뀌는 **순간 위상이 통째로 점프**한다 (qT 가 이미 커서 점프도 크다).
      //   배가 가속하는 내내 배수가 매 프레임 변하므로, 곱셈으로 두면 나부낌이 아니라 **떨림**이 된다.
      //   적분하면 배수가 변해도 위상은 이어지고 속도만 달라진다.
      // ⚠ s(nav.speed)는 main.js 가 이미 CONFIG.cam.lerp 로 매끄럽게 민다 (정지 0 · 순항 0.45 ·
      //   부스트 1.0). 그래서 '움직이면 점차 최대치로' 가 여기서 공짜다 — 따로 램프를 안 만든다.
      const dQ = Math.min(Math.max(sim.qT - sailQPrev, 0), 0.5);   // 리로드·되감기 방어
      sailQPrev = sim.qT;
      sailPhase += dQ * P.sailWindSpeed * (1.0 + P.sailWindGust * s);
      sailUni.uWindT.value = sailPhase;
      sailUni.uWindAmp.value = P.sailWind * sailSpan;                       // 돛 길이의 배수
      sailUni.uWindFreq.value = P.sailWindFreq * 2.0 * Math.PI / sailSpan;  // 돛을 가로지르는 물결 개수
      sailUni.uSailFlip.value = sailAuto ? 1 - P.sailFlip : P.sailFlip;   // 실측 고정단 위에 XOR
      const B = CONFIG.buoy, b = CONFIG.boat;

      // 게이트를 먼저 판정한다 — 아래 부력 블록 전체가 이 안에서만 돌아야 하기 때문
      const bFps = Math.max(1, P.boatFps);
      const bt = Math.floor(t * bFps) / bFps;
      const boatStep = bt !== btPrev;
      const bk = 60 / bFps;   // 건너뛴 프레임 수만큼 보간 계수 보정 — 60 이면 매끄러운 실시간과 동일

      // ── 부력 : 높이맵을 직접 읽어 선체 네 점의 수면 높이를 구한다.
      // sim.sampler() 는 동기 GPU 리드백이라 파이프라인을 멈춘다. 결과는 어차피 boatStep
      // 프레임에서만 쓰이므로 게이트 안에서만 부른다 — 밖에서 부르면 8fps 로 끊는 이득이
      // 사라지고 프레임 상한이 이 스톨에 묶인다
      if (boatStep) {
        const ch = Math.cos(head), sh = Math.sin(head);
        // ⚠ 축 주의 : armX 는 로컬 x = **폭**, armZ 가 로컬 z = **길이**다 (진행 방향이 −z).
        //   2026-09-06 이전 주석은 정반대로 적혀 있었다 — 종이배가 옆으로 가고 있었기 때문이다
        const aXx = B.armX * ch, aXz = -B.armX * sh;   // 선체 폭방향 (roll 을 만든다)
        const aZx = B.armZ * sh, aZz = B.armZ * ch;    // 선체 길이방향 (pitch 를 만든다)
        let hC = 0, hXp = 0, hXm = 0, hZp = 0, hZm = 0;
        const at = sim.sampler();
        if (at) {
          hC = at(0, 0); hXp = at(aXx, aXz); hXm = at(-aXx, -aXz);
          hZp = at(aZx, aZz); hZm = at(-aZx, -aZz);
        }
        // 부력도 물과 같은 양자화된 시각·위치를 봐야 한다 — 아니면 배가 잠기거나 뜬다
        // gerstner 를 같이 넘겨야 한다 — 켜면 GPU 는 정점을 옆으로도 밀고, CPU 는 그 역을 풀어
        // '이 월드 좌표의 수면 높이'를 낸다. 안 넘기면 배가 파도와 어긋난 자리에서 뜬다
        const sw = (ox, oz) => swellCPU(ox + sim.qScroll.x, oz - sim.qScroll.z, sim.qT * P.waveSpeed, P.oceanSwell, P.ripple, P.gerstner);
        hC += sw(0, 0);
        hXp += sw(aXx, aXz); hXm += sw(-aXx, -aXz);
        hZp += sw(aZx, aZz); hZm += sw(-aZx, -aZz);

        // 계측용으로 프로브를 그대로 남긴다 (probes.js 가 읽는다). 여기서 이미 구한 값이라
        // 공짜다 — 따로 재면 sim.sampler() 의 동기 리드백을 한 번 더 하게 된다
        api.probes[0][0] = 0;    api.probes[0][1] = 0;    api.probes[0][2] = hC;
        api.probes[1][0] = aXx;  api.probes[1][1] = aXz;  api.probes[1][2] = hXp;
        api.probes[2][0] = -aXx; api.probes[2][1] = -aXz; api.probes[2][2] = hXm;
        api.probes[3][0] = aZx;  api.probes[3][1] = aZz;  api.probes[3][2] = hZp;
        api.probes[4][0] = -aZx; api.probes[4][1] = -aZz; api.probes[4][2] = hZm;

        const bg = P.buoyancy;
        let tRz = Math.atan2(hXp - hXm, 2 * B.armX) * bg;
        let tRx = Math.atan2(hZm - hZp, 2 * B.armZ) * bg;

        // ── ① 복원력. 예전에는 배가 파도 기울기에 **그대로 누웠다** — 목표 자세가 곧
        // 수면의 기울기였다. 그래서 파도에 얹힌 종잇조각처럼 보였다.
        // 배는 복원력이 있어서 작은 파도는 따라가고 큰 파도에서는 버틴다.
        // tanh 가 정확히 그 성질이다 : 작은 각에서 선형, 큰 각에서 rightLimit 로 포화
        const lim = Math.max(1e-3, P.rightLimit * D2R);
        tRz = lim * Math.tanh(tRz / lim);
        tRx = lim * Math.tanh(tRx / lim);

        // ── ② 위상 선행. 실제 배는 마루에 올라타는 동안 이미 내려갈 준비를 한다 —
        // 파도 기하가 시키는 것보다 **먼저** 뱃머리를 내린다. 그게 '파도를 이겨낸다'로 보인다.
        // 목표의 변화율만큼 앞질러 둔다. 0 이면 파도를 그대로 따라가는 예전 동작이다
        const dRz = tRz - pRz, dRx = tRx - pRx;
        pRz = tRz; pRx = tRx;
        tRz += dRz * P.rightLead;
        tRx += dRx * P.rightLead;

        // 높이(상하)는 그대로 따라간다 — 버티는 것은 '기울기'지 '뜨고 가라앉는 것'이 아니다
        buoy.y += (hC * bg - buoy.y) * (1 - Math.pow(0.93, bk));
        buoy.rz += (tRz - buoy.rz) * (1 - Math.pow(P.rightDamp, bk));
        buoy.rx += (tRx - buoy.rx) * (1 - Math.pow(P.rightDamp, bk));
      }

      // ── 아이들 모션 (주기가 서로 다름) + 가속 시 앞으로 기울기. 파도 자세 위에 얹는다
      const tiltCap = CONFIG.move.tiltMax * D2R;
      const cap = (v) => clamp(v, -tiltCap, tiltCap);
      lean += (-headV * 0.5 - lean) * 0.02;
      if (boatStep) {
        btPrev = bt;
        pivot.rotation.x = cap((Math.sin(bt / b.pitchT * Math.PI * 2) * b.pitchDeg * 0.35 + b.speedPitchDeg * s) * D2R + buoy.rx);
        pivot.rotation.z = cap(Math.sin(bt / b.rollT * Math.PI * 2) * b.rollDeg * 0.35 * D2R + lean + buoy.rz);
        // 빨라질수록 너울이 커지므로 배도 그만큼 띄워 잠기지 않게
        // ⚠ **용골 바닥이 pivot 과 같은 높이다** (로컬 y = 0 — createBoatMesh 의 좌표 규약).
        // 그래서 boatLift 가 양수면 배가 수면 **위에** 떠 있고, 음수라야 흘수가 생긴다.
        // ⚠⚠ **상승량을 월드 값으로 적지 않는다 — 흘수의 비율로 적는다** (불변식 0-1 의 교훈).
        //   2026-09-08 까지 하드코딩 `0.42 * mv` 였다. 그건 종이배(선체 깊이 0.66) 시절 값인데
        //   지금 흘수는 |boatLift| = 0.24 뿐이라 **상승이 흘수의 1.8배**였다 — 부스트에서 배가
        //   수면 위 0.18 로 통째로 떠올라 바닥이 드러났다 (사용자 지적, 실측 선체 깊이 1.264).
        //   흘수에 곱하면 boatLift 를 바꿔도 따라오고, boatRise < 1 인 한 물 밖으로 안 나간다.
        pivot.position.y = buoy.y + Math.sin(bt / b.bobT * Math.PI * 2) * b.bobY * 0.4
          + P.boatLift + Math.abs(P.boatLift) * P.boatRise * mv;
      }
      // 방향은 끊지 않는다
      pivot.rotation.y += (head - pivot.rotation.y) * 0.05;
      api.stepped = boatStep;
    },

    dispose() {
      scene.remove(pivot);
      // 돛 두 장이 지오메트리를, 선체까지 셋이 재질을 공유한다 — 각각 한 번만 버린다
      const seen = new Set();
      const drop = (o) => {
        if (o.geometry && !seen.has(o.geometry)) { seen.add(o.geometry); o.geometry.dispose(); }
        if (o.material && !seen.has(o.material)) { seen.add(o.material); o.material.dispose(); }
      };
      pivot.traverse(drop);
    }
  };

  // ⚠ 초기값이 GLB(boatModel 1)면 여기서 바로 로드를 시작한다. update()·apply() 를 기다리면
  //   rAF 가 아직 안 돈 시점에는 아무 일도 안 일어나 "새로고침했는데 안 뜬다" 가 된다
  syncModel();

  return api;
}
