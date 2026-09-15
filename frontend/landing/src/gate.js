import * as THREE from 'three';
import { PARAMS as P } from './params.js';
import { timeNow, timeKey } from './times.js';

// ───────── [7단계] 좌우 윙 — 존에 들어갈 때 좌우에서 닫히는 근경 프레임 ─────────
// `docs/무대와-존-연출.md` §5 · §22. **연출을 여기서 짜지 않는다** — 커브는 전부 `phase.js`
// 의 `TL` 표에 있고 이 파일은 `cue.openL / cue.openR` 을 **읽기만** 한다.
//   0 = 화면 밖 · 1 = 들어온 상태.
// ⚠ 진입에만 **0.22s 시차**가 있다 (좌 → 우, 2026-09-10 에 0.14 에서 늘렸다). 퇴장에는 없다 — 그게 *"순서대로 좌, 우로"* 의
//   전부이고, 시차를 여기서 다시 만들면 두 곳에서 흔들린다.
//
// ⚠⚠ **자산은 좌 1장 · 우 1장이다** (사용자 제공, 2026-09-10). §5 는 근경·중경·원경 3층을
//   좌우로 반전해 6판을 세우자고 했지만, 실제로 온 두 장은 **서로 비대칭**이라 반전이 안 된다.
//   그래서 지금은 **한 층**이다. 층을 늘리려면 `SRC` 에 줄을 더하면 된다 — `depth` 가 작을수록
//   카메라에 가깝고, [8단계] 마우스 패럴랙스가 그만큼 더 많이 움직이게 된다.
//   ⚠ 한 층뿐이라 §5 가 경고한 *"판자로 읽힌다"* 위험이 남아 있다. 다만 이 두 장은 그림 안에
//     이미 근경 암석과 흐린 배경이 같이 들어 있어 한동안은 버틴다.
//
// ⚠ 개별 hover 는 넣지 않는다 (§5). 프레임은 배경이고, 반응하면 누를 수 있다는 힌트가 된다.

// 좌우 판. ⚠ `sign` 은 화면 좌우이지 월드가 아니다 — 카메라의 right 축에 곱한다.
// ⚠ 경로는 `vite public/`. `base: './'` 라 **앞에 슬래시를 붙이지 않는다** (boat.js 와 같은 규약).
const SRC = [
  { key: 'left',  url: 'gate-left.webp',  sign: -1, depth: 1 },
  { key: 'right', url: 'gate-right.webp', sign:  1, depth: 1 }
];

// 두 장 다 1536×1024 다. 판의 높이는 폭과 이 비에서 나온다 — 이미지를 바꾸면 여기도 바꾼다.
const IMG_ASPECT = 1536 / 1024;
const D2R = Math.PI / 180;
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

export function createGate(scene) {
  const loader = new THREE.TextureLoader();
  const geo = new THREE.PlaneGeometry(1, 1);
  const wings = [];

  for (const s of SRC) {
    // ⚠⚠ `colorSpace` 를 안 주면 sRGB 이미지가 선형으로 읽혀 **눈에 띄게 밝고 뿌옇게** 뜬다.
    //   같은 함정을 렌더타깃에서 한 번 밟았다 (§2 : 배경 246 이 235 로 읽혔다).
    const tex = loader.load(s.url, undefined, undefined, () => {
      console.warn('[gate] 텍스처를 못 읽었다 :', s.url);
    });
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    tex.generateMipmaps = true;
    tex.minFilter = THREE.LinearMipmapLinearFilter;

    // ⚠⚠ **깊이를 읽지 않는다.** 판은 카메라를 마주보는 수직면이라 수평인 물과 **교차**하고,
    //   깊이를 읽으면 그 교차선이 화면에 그대로 나온다. 근경 프레임은 언제나 앞이므로
    //   `depthTest:false` + `renderOrder` 로 순서를 고정한다.
    //   ⚠ 그래서 배가 판 앞으로 지나갈 수 없다 — 의도한 것이다 (프레임이니까).
    const mat = new THREE.MeshBasicMaterial({
      map: tex, transparent: true, depthTest: false, depthWrite: false,
      fog: false, toneMapped: false, side: THREE.DoubleSide
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.frustumCulled = false;   // 카메라에서 좌표를 파생시키므로 항상 앞에 있다
    // ⚠ 수면 타이포(renderOrder 0)보다 **뒤에 그린다 = 앞에 온다.** 암석이 근경이다.
    mesh.renderOrder = 20 + s.depth;
    mesh.visible = false;
    scene.add(mesh);
    wings.push({ ...s, mesh, mat, tex });
  }

  // 매 프레임 새로 만들지 않는다 (GC 압력). 카메라 축을 담아 두는 그릇이다
  const right = new THREE.Vector3(), up = new THREE.Vector3(), fwd = new THREE.Vector3();
  const off = new THREE.Vector3();   // 패럴랙스로 카메라가 기준에서 벗어난 양
  let tintKey = '';                  // 암석 색조를 마지막으로 칠한 시간대 (update 주석)

  return {
    wings, meshes: wings.map(w => w.mesh),

    // ⚠ cue 와 카메라만 받는다. 씬의 다른 층을 모른다 (title.js 와 같은 규약)
    // ⚠⚠ `camBase` 는 **[8단계] 패럴랙스로 밀기 전**의 카메라 자리다 (main.js). 판을 이 자리에
    //   놓아야 카메라가 밀린 만큼 판이 화면에서 어긋난다 — 그게 시차다.
    //   지금 카메라에 붙이면 판이 카메라를 따라다녀서 **아무것도 안 움직인다.**
    // ⚠ `paSx/paSy` 는 커브·게이트까지 먹인 패럴랙스 값(−1..1)이다. 판을 **기울이는 데** 쓴다
    update(cue, cam, camBase, camBaseQ, paSx, paSy) {
      // ⭐ 시간대 (2026-09-11 밤 — 시안) — 암석 사진은 낮빛으로 찍혀 있다. 재질 색(텍스처에 곱해진다)으로 그 시간의 그늘에 담근다.
      //   낮 = 흰색(곱하는 인자 1 — 예전 그대로). 바뀔 때만 칠한다
      if (timeKey() !== tintKey) {
        tintKey = timeKey();
        const T = timeNow();
        for (const wg of wings) wg.mat.color.set(T && T.gateTint ? T.gateTint : 0xffffff);
      }
      const amt = P.gateAmount === undefined ? 1 : P.gateAmount;
      const dist = P.gateDist === undefined ? 16 : P.gateDist;
      const frac = P.gateWidth === undefined ? 0.58 : P.gateWidth;
      const drop = P.gateDrop === undefined ? 0.06 : P.gateDrop;
      const bleed = P.gateBleed === undefined ? 0.05 : P.gateBleed;
      const sx = paSx || 0, sy = paSy || 0;
      const tiltB = (P.gateTilt === undefined ? 14 : P.gateTilt) * D2R;
      const tiltM = (P.gateTiltMouse === undefined ? 12 : P.gateTiltMouse) * D2R;
      const op = P.gateOpacity === undefined ? 1 : P.gateOpacity;

      // ── 그 거리에서 화면이 월드로 얼마인가. ⭐ **폭을 여기서 낸다** — 그래서 `gateWidth` 는
      //   창 비율이 어떻든 *"화면 폭의 몇 %"* 라는 뜻 하나를 유지한다.
      //   `titleWidth` 가 월드라서 1:1 창에서 107% 로 잘렸던 것(§23-4-b)을 여기서는 안 밟는다.
      const halfH = Math.tan(cam.fov * 0.5 * D2R) * dist;
      const halfW = halfH * cam.aspect;
      // ⚠⚠ **폭만 보면 세로로 긴 창에서 아래를 못 덮는다** (2026-09-10). `gateWidth` 는 화면
      //   **폭** 대비라 1:1 창에서 판 높이가 화면의 39% 밖에 안 됐다 — 아래 모서리에만 걸린다.
      //   높이 하한을 같이 두고 **둘 중 큰 쪽**을 쓴다 : 와이드에서는 폭이, 세로로 긴 창에서는
      //   이쪽이 이긴다. 그래서 어느 비율에서도 프레임이 성립한다.
      const minH = P.gateMinH === undefined ? 0.55 : P.gateMinH;
      const w = Math.max(2 * halfW * frac, 2 * halfH * minH * IMG_ASPECT);
      const h = w / IMG_ASPECT;

      // ⚠⚠ 축을 **기준 회전**에서 뽑는다 (`camBaseQ`). 최종 카메라에서 뽑으면, 평행이동이
      //   lookAt 을 통해 회전까지 바꾸므로 판이 **그 새 축으로 다시 배치돼 이중으로 움직인다.**
      //   2026-09-10 에 그것이 우글거림의 정체로 드러났다.
      if (camBaseQ) {
        right.set(1, 0, 0).applyQuaternion(camBaseQ);
        up.set(0, 1, 0).applyQuaternion(camBaseQ);
        fwd.set(0, 0, -1).applyQuaternion(camBaseQ);
      } else {
        const m = cam.matrixWorld.elements;
        right.set(m[0], m[1], m[2]);
        up.set(m[4], m[5], m[6]);
        fwd.set(-m[8], -m[9], -m[10]);
      }

      // ⭐ 판은 **패럴랙스 이전 자리**에 선다. 그만큼 화면에서 어긋난다
      const base = camBase || cam.position;
      off.subVectors(cam.position, base);
      const offR = off.dot(right), offU = off.dot(up);
      // 판 거리에서 화면 반폭·반높이가 거리의 몇 배인가 — 기울기 보정에 쓴다
      const tanA = halfW / dist, tanB = halfH / dist;

      for (const wg of wings) {
        const open = clamp01(wg.key === 'left' ? cue.openL : cue.openR);
        // ⚠ `cue.zone` 이 없으면 항해 중이다. 값이 0 이어도 판을 씬에서 빼 둔다 (드로우콜 절약)
        const on = amt > 0 && open > 0.001 && !!cue.zone;
        wg.mesh.visible = on;
        if (!on) continue;

        // ── 가로 : open=1 이면 판의 바깥 가장자리가 화면 가장자리를 `gateBleed` 만큼 **넘고**,
        //   open=0 이면 판이 통째로 화면 밖이다. 그 사이를 그대로 잇는다.
        //   ⚠⚠ 넘겨 두는 이유 — 딱 맞추면 이징의 **마지막 1% 가 틈으로 보인다** (2026-09-10).
        //   ⚠ 이미지의 바깥쪽 여백(§5 : 최소 15%)이 이 계산을 받쳐 준다 — 여백이 없으면
        //     open=1 에서 잘린 단면이 보인다.
        // ⚠⚠ **밀린 만큼 여유를 더 준다** (2026-09-10). 사용자 : *"왼쪽 오른쪽 빈 여백이
        //   생겨서 보이지 않게 잘 설정해야 함"*. 패럴랙스가 판을 화면에서 미는데, 고정 `bleed`
        //   만으로는 그 이동을 못 덮어 가장자리에 배경이 드러난다.
        //   ⭐ 미는 양을 **여기서 알 수 있으므로**(offR/offU) 필요한 만큼만 자동으로 더한다 —
        //     손으로 넉넉히 잡아 두면 패럴랙스를 키울 때마다 다시 잡아야 한다.
        // ── 기울기 (fake 3D). 기본은 **안쪽으로**, 마우스는 좌우에 **같은 방향**으로 더한다 —
        //   그래서 마우스가 한가운데 있어도 두 판이 이미 꺾여 있고, 움직이면 한쪽은 더 닫히고
        //   반대쪽은 펴진다. 레퍼런스(tinkerfx parallax-card)의 두 회전과 같은 규칙이다.
        //   ⚠ 세로 회전은 0.6 배로 눌러 쓴다 — 아래 판이 들리면 수면과의 접합이 티난다
        const tY = wg.sign * tiltB + sx * tiltM;
        const tX = -sy * tiltM * 0.6;
        // ⚠⚠ **기울면 바깥 가장자리가 카메라에서 멀어져 화면 안쪽으로 당겨진다.** 그대로 두면
        //   그 자리에 배경이 드러난다. 필요한 여유는 해석적으로 나온다 —
        //   판 폭 대비 `0.5(1−cos θ) + 0.5·(halfW/dist)·|sin θ|` 다. 첫 항은 폭이 줄어드는 몫,
        //   둘째 항은 멀어져서 작아 보이는 몫. 그래서 기울기를 키워도 여백이 안 생긴다.
        const needX = 0.5 * (1 - Math.cos(tY)) + 0.5 * tanA * Math.abs(Math.sin(tY));
        const needY = 0.5 * (1 - Math.cos(tX)) + 0.5 * tanB * Math.abs(Math.sin(tX));
        // ⚠⚠ **절댓값이 아니다.** `|offR|` 로 보정하면 마우스가 화면 중앙을 지날 때 보정량이
        //   V 자로 꺾인다 — 미분이 끊기고, 그게 판이 **우글거리는** 또 한 원인이었다.
        //   판이 밀려서 가장자리가 드러나는 것은 **한쪽 방향뿐**이다 : 카메라가 오른쪽으로 가면
        //   판은 화면 왼쪽으로 밀리므로 **우판**이 위험하고 좌판은 오히려 안전해진다.
        const needR = Math.max(0, wg.sign * offR) / w;
        const x = wg.sign * (halfW + w * (bleed + needR + needX) - w * (open - 0.5));
        // ── 세로 : 판 아래 가장자리를 화면 아래에 맞추고 `gateDrop` 만큼 더 내린다.
        //   ⚠ 세로도 같은 이유로 밀린 만큼 더 내린다 (카메라가 내려가면 판이 화면 위로 밀린다)
        //   ⚠ 세로도 같은 이유로 한쪽만 — 카메라가 **내려갈 때**(offU < 0) 판이 화면 위로
        //     밀려 아래가 뜬다. 올라갈 때는 저절로 안전하다
        const y = -halfH + h * 0.5 - drop * 2 * halfH - Math.max(0, -offU) - h * needY;

        wg.mesh.position.copy(base)
          .addScaledVector(fwd, dist)
          .addScaledVector(right, x)
          .addScaledVector(up, y);
        // ⚠ **기준 회전**을 쓴다 (축과 같은 것이라야 판이 제자리에 선다). 그 자리에서 꺾는다
        wg.mesh.quaternion.copy(camBaseQ || cam.quaternion);
        wg.mesh.rotateY(tY);
        wg.mesh.rotateX(tX);
        wg.mesh.scale.set(w, h, 1);
        wg.mat.opacity = op;
      }
    },

    // ⚠ 매 프레임 갱신되는 값(위치·크기·opacity)은 update 가 쓴다. 여기는 재질 쪽만 본다
    apply() {
      const op = P.gateOpacity === undefined ? 1 : P.gateOpacity;
      for (const wg of wings) wg.mat.opacity = op;
    },

    dispose() {
      for (const wg of wings) {
        scene.remove(wg.mesh);
        wg.mat.dispose();
        wg.tex.dispose();
      }
      geo.dispose();
    }
  };
}
