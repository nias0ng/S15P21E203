import * as THREE from 'three';
import { PARAMS as P } from './params.js';
import { timeNow, timeKey } from './times.js';

// ───────── [7단계] 좌우 윙 — 존에 들어갈 때 좌우에서 닫히는 근경 프레임 ─────────
// `docs/무대와-존-연출.md` §5 · §22 · `docs/존-좌우윙-3층-0921.md`.
// **연출을 여기서 짜지 않는다** — 커브는 전부 `phase.js` 의 `TL` 표에 있고 이 파일은
// `cue.openLmid … cue.openRnear` **여섯 값을 읽기만** 한다. 0 = 화면 밖 · 1 = 들어온 상태.
//
// ⭐⭐ **2026-09-21 : 한 층에서 세 층이 됐다.** 예전 주석이 적어 둔 사정 —
//   *"자산은 좌 1장 · 우 1장이다 … 실제로 온 두 장은 서로 비대칭이라 반전이 안 된다. 그래서 지금은 한 층이다"* —
//   이 향조별 6판(좌우 × 근경·중경·원경)이 오면서 풀렸다. §5 가 설계한 멀티플레인을 이제 실제로 세운다.
//
// ⚠ 개별 hover 는 넣지 않는다 (§5). 프레임은 배경이고, 반응하면 누를 수 있다는 힌트가 된다.
//   카메라 하나만 움직이면 6판이 전부 다른 속도로 움직이므로 판마다 코드를 쓸 이유가 없다.

// ───────── 자산 표 ─────────
// ⚠ 경로는 `vite public/`. `base: './'` 라 **앞에 슬래시를 붙이지 않는다** (boat.js 와 같은 규약).
//
// ⚠⚠ **3층 자산이 있는 향조는 여기 적힌 아홉이다** (`public/landing/gate/<향조>-<측>-<층>.webp` · 54판).
//   ⭐ 우디는 2026-09-21 오전에 한 번 빠졌다가 같은 날 들어왔다 — 처음 받은 원본에서 `우디 왼쪽 맨앞` 이
//     `우디 왼쪽 맨뒤` 와 **바이트 단위로 같은 파일**이었고(md5 8b58ee1a…), 사용자가 새 그림을 다시 줬다.
// ⚠ 여기 없는 키(예전 4존 표의 `fresh`)는 아래 예전 자산 **중경 한 층**으로 떨어진다 — 404 를 내지 않는다.
const LAYERED = new Set(['floral', 'fruity', 'green', 'citrus', 'aquatic', 'amber', 'gourmand', 'musk', 'woody']);

// 화면 좌우. ⚠ `sign` 은 화면 좌우이지 월드가 아니다 — 카메라의 right 축에 곱한다.
const SIDES = [{ key: 'left', sign: -1 }, { key: 'right', sign: 1 }];

// 층. **이 표가 공간감의 전부다** (§3-1) — 판은 `camBase` 에서 `fwd × dist` 에 서고, 카메라가
// 마우스로 `off` 만큼 밀리면 화면에서 어긋나는 각이 `off / dist` 다. 그래서 **움직이는 양 = 1/dist** 이고,
// 여기서는 그 양을 **가중치 `pw` 로 직접 적고** 거리를 `gateDist / pw` 로 역산한다.
//
// ⚠⚠⚠ **맨앞이 가장 적게 움직인다 — 교과서의 멀티플레인과 반대다** (2026-09-21, 사용자 지시 :
//   *"맨 앞에 배치되어있는 이미지는 거의 움직이면 안될듯함 하단에 바다가 자꾸 삐져나와보임 ·
//   그 가중치 만큼 뒤로 갈수록 더 움직이면 될듯"*).
//   까닭은 이 자산의 생김새다 — `near` 는 화면 **아래 모서리를 막는 판**이라, 그것이 움직이면
//   막고 있던 자리에서 바다가 드러난다. 물리적 원근보다 **프레임이 안 새는 것**이 먼저다.
//   ⚠ 그래서 `near` 가 카메라에서 **가장 멀리**(dist 57) 서는데 그리기는 **맨 앞**이다 (아래 order).
//     깊이를 안 읽으므로(`depthTest:false`) 모순이 아니다 — 헷갈리기 쉬우니 여기 적어 둔다.
//   ⭐ `dist` 를 바꿔도 **화면에서의 크기는 안 변한다** — 폭을 그 거리에서의 화면 비율로 내기 때문이다.
//     정하는 것은 **시차와 기울기**뿐이다.
//   ⚠ `order` 가 곧 앞뒤다 — renderOrder 가 순서를 고정한다 (near 가 마지막 = 맨 앞).
//   ⚠ **층별 크기 배수가 없다.** 크기는 아래 원고 캔버스에서 그대로 나온다 (CANVAS 주석).
const LAYERS = [
  { key: 'far',  order: 0, pw: () => num(P.gateMoveFar,  1.00) },
  { key: 'mid',  order: 1, pw: () => num(P.gateMoveMid,  0.50) },
  { key: 'near', order: 2, pw: () => num(P.gateMoveNear, 0.15) }
];

// ───────── ⭐⭐⭐ 원고 캔버스 — **크기와 자리는 여기서 나온다** ─────────
// 2026-09-21 사용자 : *"이 이미지가 하단에 잘려있는 이유가 연출 이미지를 만들때 **1920 x 1080** 에
//   왼쪽 이미지는 **왼쪽 하단**에 배치하고 오른쪽 이미지는 **오른쪽 하단**에 딱 맞게
//   연출 구도를 이미 다 만들어두었음"*.
//
// ⭐ 그래서 **원본 PNG 의 픽셀 크기가 곧 그 캔버스 안에서의 배치 크기다.** 잘라 낸 상자가
//   내용에 딱 맞고(알파 경계 실측 : 좌판은 왼쪽·아래 변에, 우판은 오른쪽·아래 변에 0px 로 닿는다)
//   바깥쪽 아래 모서리에 뿌리를 두므로, **크기만 알면 구도가 그대로 복원된다.**
//   검증 : 54장 중 1920 이나 1080 을 넘는 것이 **하나도 없고**, `green-right-far` 가 **정확히 1080** 이다
//   (캔버스 위아래를 꽉 채운 판).
//
// ⚠⚠⚠ **그래서 변환할 때 줄이지 않는다.** 2026-09-21 오전에는 긴 변 1280 으로 줄였는데, 그러면
//   `img.width/height` 가 더 이상 원고 좌표가 아니라 **구도 정보가 통째로 사라진다.**
//   지금은 원본 해상도 그대로 넣는다 (54판 4.2MB — 줄였을 때 4.0MB 와 큰 차이가 없다).
//
// 화면에 앉히는 법은 CSS 의 `background-size: cover` 와 같다 — 캔버스가 화면을 **덮는** 배율을 쓰고,
// 넘치는 쪽은 안쪽·위쪽으로 흘린다. 그래야 어느 비율에서도 바깥 모서리가 안 빈다
// (사용자 : *"연출시에 외곽에 이미지가 가득차게"*).
//   ⚠ 16:9 에서는 가로·세로 배율이 같아 원고 구도가 **픽셀 단위로** 재현된다.
const CANVAS_W = 1920, CANVAS_H = 1080;

const D2R = Math.PI / 180;
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const num = (v, d) => (v === undefined ? d : v);

// 향조 · 측 · 층 → 파일. 3층 자산이 없으면 **중경 한 층만** 예전 그림으로 세운다 (위 LAYERED 주석)
function urlOf(fam, side, layer) {
  if (LAYERED.has(fam)) return `gate/${fam}-${side}-${layer}.webp`;
  return layer === 'mid' ? `gate-${side}.webp` : null;
}

export function createGate(scene) {
  const loader = new THREE.TextureLoader();
  const geo = new THREE.PlaneGeometry(1, 1);
  const wings = [];

  // ── 판 여섯. **메시는 한 번만 만들고 텍스처만 갈아 끼운다** — 존을 옮길 때마다 씬을 고치면
  //   드로우콜 순서가 흔들리고 `dispose` 누락이 쌓인다 (불변식 10).
  for (const s of SIDES) {
    for (const L of LAYERS) {
      // ⚠⚠ `map` 을 **null 로 시작한다** — 텍스처가 오기 전에는 비율을 모르고, 모르는 채로 세우면
      //   한 프레임이 찌그러진 채 뜬다. 아래 update 가 `img.width` 를 확인한 뒤에만 보인다.
      const mat = new THREE.MeshBasicMaterial({
        map: null, transparent: true, depthTest: false, depthWrite: false,
        fog: false, toneMapped: false, side: THREE.DoubleSide
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.frustumCulled = false;   // 카메라에서 좌표를 파생시키므로 항상 앞에 있다
      // ⚠ 수면 타이포(renderOrder 0)보다 **뒤에 그린다 = 앞에 온다.** 근경이 제일 나중이다
      mesh.renderOrder = 20 + L.order;
      mesh.visible = false;
      scene.add(mesh);
      wings.push({
        id: `${s.key}-${L.key}`,
        side: s.key, sign: s.sign, layer: L.key, order: L.order, pw: L.pw,
        // `cue` 에서 읽을 이름. phase.js 의 `OPEN_KEYS` 와 글자 그대로 같아야 한다
        cueKey: `open${s.key === 'left' ? 'L' : 'R'}${L.key}`,
        // 아이들 sway 의 위상. 판마다 달라야 여섯이 한 덩어리로 안 흔들린다 (§5 : *"위상이 다른 아주 느린 sway"*)
        phase: wings.length * 1.7,
        mesh, mat
      });
    }
  }

  // ───────── 향조별 텍스처 — **존에 들어갈 때만 받는다** (§3-3) ─────────
  // ⚠⚠ 48판을 다 올리면 GPU 가 1.2GB 다 (1280×900 RGBA 한 장이 약 4.6MB · 밉맵까지 6MB 남짓).
  //   최근 `gateCache` 개 향조만 남기고 나머지는 버린다 — 12판이면 55MB 남짓이다.
  const packs = new Map();   // 향조키(소문자) → { fam, used, tex: { 'left-far': Texture|null, … } }
  let useClock = 0;          // LRU 순서. 큰 쪽이 최근이다
  let cur = null, curFam = '';

  function makeTex(url) {
    // ⚠⚠ `colorSpace` 를 안 주면 sRGB 이미지가 선형으로 읽혀 **눈에 띄게 밝고 뿌옇게** 뜬다.
    const tex = loader.load(url, undefined, undefined, () => {
      console.warn('[gate] 텍스처를 못 읽었다 :', url);
    });
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    tex.generateMipmaps = true;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    return tex;
  }

  // ⚠ 쓰고 있는 향조는 `used` 가 늘 가장 커서 절대 안 버려진다 (keep ≥ 1 이므로)
  function trim() {
    const keep = Math.max(1, Math.round(num(P.gateCache, 2)));
    while (packs.size > keep) {
      let old = null;
      for (const p of packs.values()) if (!old || p.used < old.used) old = p;
      if (!old) break;
      for (const k in old.tex) if (old.tex[k]) old.tex[k].dispose();
      packs.delete(old.fam);
    }
  }

  // 향조 6판을 만들어(또는 캐시에서 꺼내) 돌려준다. ⚠ 키 비교는 대소문자를 안 가린다 (areas.js 와 같은 규약)
  function packOf(key) {
    const fam = String(key || '').toLowerCase();
    if (!fam) return null;
    let p = packs.get(fam);
    if (p) { p.used = ++useClock; return p; }
    p = { fam, used: ++useClock, tex: {} };
    for (const w of wings) {
      const url = urlOf(fam, w.side, w.layer);
      p.tex[w.id] = url ? makeTex(url) : null;
    }
    packs.set(fam, p);
    trim();
    return p;
  }

  // 매 프레임 새로 만들지 않는다 (GC 압력). 카메라 축을 담아 두는 그릇이다
  const right = new THREE.Vector3(), up = new THREE.Vector3(), fwd = new THREE.Vector3();
  const off = new THREE.Vector3();   // 패럴랙스로 카메라가 기준에서 벗어난 양
  let tintKey = '';                  // 암석 색조를 마지막으로 칠한 시간대 (update 주석)

  return {
    wings, meshes: wings.map(w => w.mesh),

    // ⭐ 미리 받아 둔다 — `main.js` 의 `arriveAt`(연출 시작)과 `startTravel`(먼 곳 이동 목표)이 부른다.
    //   안개 전환이 1~2초라 그동안 받으면 **연출이 시작될 때 이미 와 있다** (§3-3).
    //   ⚠ 이미 있으면 LRU 순서만 올리고 끝난다 — 매 프레임 불러도 싸다.
    preload(key) { if (key) packOf(key); },

    // ⚠ cue 와 카메라만 받는다. 씬의 다른 층을 모른다 (title.js 와 같은 규약)
    // ⚠⚠ `camBase` 는 **[8단계] 패럴랙스로 밀기 전**의 카메라 자리다 (main.js). 판을 이 자리에
    //   놓아야 카메라가 밀린 만큼 판이 화면에서 어긋난다 — 그게 시차다.
    //   지금 카메라에 붙이면 판이 카메라를 따라다녀서 **아무것도 안 움직인다.**
    // ⚠ `paSx/paSy` 는 커브·게이트까지 먹인 패럴랙스 값(−1..1)이다. 판을 **기울이는 데** 쓴다
    update(cue, cam, camBase, camBaseQ, paSx, paSy) {
      // ── 재질 색 (텍스처에 **곱해진다**). 바뀔 때만 칠한다
      // ⚠⚠⚠ **기본은 흰색 — 원본 색 그대로다** (2026-09-21, 사용자 : *"오브젝트가 지금 그림자의
      //   영향을 받고 있어서 매우 어둡게 표현되고있음 · 원본의 색상을 그대로 표현되었으면"*).
      //   범인은 조명이 아니었다 (`MeshBasicMaterial` 이라 빛을 아예 안 받는다) — `CONFIG.times[].gateTint`
      //   였다. 저녁 `#9C8290` 은 텍스처를 **RGB 61% / 51% / 56%** 로 누르고 밤 `#394056` 은 **22% / 25% / 34%** 다.
      //   그 값은 2026-09-11 에 **암석 한 장**에 맞춰 고른 것이고(주석도 *"암석 — 역광에 선 보랏빛 그늘"*),
      //   잎·꽃·과일이 온 지금은 안 맞는다. 그래서 `gateTimeTint` 로 빼고 **기본을 0 으로 둔다.**
      //   ⚠ 1 로 올리면 예전과 비트 단위로 같다 — 시간대 색조가 다시 필요해지면 그때 `times.js` 의
      //     값부터 이 자산에 맞춰 다시 고른다. 지금 값을 그대로 켜지 않는다.
      const tintK = num(P.gateTimeTint, 0);
      const tKey = timeKey() + '|' + tintK;
      if (tKey !== tintKey) {
        tintKey = tKey;
        const T = timeNow();
        const c = new THREE.Color(0xffffff);
        if (tintK > 0 && T && T.gateTint) c.lerp(new THREE.Color(T.gateTint), Math.min(1, tintK));
        for (const w of wings) w.mat.color.copy(c);
      }

      // ── 이 존의 6판을 쥔다. ⚠ 항해로 돌아가도 **버리지 않는다** — 같은 존에 다시 들어올 때
      //   다시 받으면 첫 판이 빈 채로 뜬다. 버리는 것은 `trim()`(LRU) 의 일이다.
      if (cue.zone) {
        const fam = String(cue.zone).toLowerCase();
        if (fam !== curFam) { cur = packOf(fam); curFam = fam; }
        else if (cur) cur.used = ++useClock;
      }

      const amt = num(P.gateAmount, 1);
      const scaleK = num(P.gateScale, 1);
      const drop = num(P.gateDrop, 0.004);
      const bleed = num(P.gateBleed, 0.02);
      const sx = paSx || 0, sy = paSy || 0;
      const tiltB = num(P.gateTilt, 14) * D2R;
      const tiltM = num(P.gateTiltMouse, 12) * D2R;
      const op = num(P.gateOpacity, 1);
      // 깊이의 자. 층 거리는 `gateDist / pw` 다 — `pw` 가 곧 **화면에서 움직이는 양**이다 (LAYERS 주석)
      const distBase = num(P.gateDist, 16);
      // ⚠ 아이들 sway 는 **실시간**이다 (불변식 1 의 예외 — 물 현상이 아니라 살아 있는 느낌이다.
      //   phase.js 가 실시간 dt 를 쓰는 것과 같은 이유). 진폭이 0.2° 안팎이라 시계가 갈라져도 안 드러난다
      const swayA = num(P.gateSway, 0.18) * D2R;
      const swaySp = num(P.gateSwaySpeed, 0.08);
      const tNow = performance.now() * 0.001;

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
      // 화면 반폭·반높이가 **거리의 몇 배**인가 — 기울기 보정에 쓴다. ⚠ 거리에 안 의존한다 (층마다 같다)
      const tanA = Math.tan(cam.fov * 0.5 * D2R) * cam.aspect;
      const tanB = Math.tan(cam.fov * 0.5 * D2R);

      for (const wg of wings) {
        const open = clamp01(cue[wg.cueKey]);
        const tex = cur ? cur.tex[wg.id] : null;
        const img = tex && tex.image;
        // ⚠ `cue.zone` 이 없으면 항해 중이다. 값이 0 이어도 판을 씬에서 빼 둔다 (드로우콜 절약)
        // ⚠⚠ **아직 안 온 판은 조용히 쉰다** — 비율을 모르면 세울 수 없다. 우디의 네 판이 지금 그 상태다
        const on = amt > 0 && open > 0.001 && !!cue.zone && !!img && img.width > 0;
        wg.mesh.visible = on;
        if (!on) continue;

        // ⚠ `map` 을 갈아 끼우면 **프로그램 정의(MAP)가 바뀔 수 있다** — null ↔ 텍스처가 그렇다.
        //   그래서 바뀔 때만 `needsUpdate` 를 건다 (매번 걸면 존을 옮길 때마다 여섯을 다시 컴파일한다).
        if (wg.mat.map !== tex) { wg.mat.map = tex; wg.mat.needsUpdate = true; }

        const pw = Math.max(0.01, wg.pw());
        const dist = distBase / pw;
        // ── 그 거리에서 화면이 월드로 얼마인가
        const halfH = tanB * dist;
        const halfW = tanA * dist;
        // ⭐⭐⭐ **크기는 원고 캔버스에서 그대로 나온다** (CANVAS 주석) — 원본 px 이 곧 1920×1080 안의
        //   배치 크기이므로, 캔버스가 화면을 **덮는** 배율(cover)을 한 번 내고 거기에 픽셀 수를 곱한다.
        //   ⚠ `gateWidth` · `gateMinH` · 층별 크기 배수는 전부 없앴다 — 손으로 정하던 값이 원고에 이미 있다.
        //   ⚠ 배율은 **가로·세로 중 큰 쪽**이라 16:9 보다 납작하거나 길쭉한 창에서도 바깥 모서리가 안 빈다.
        //     대신 그만큼 원고가 화면 밖으로 넘치는데, 넘치는 쪽은 **안쪽·위쪽**이라 바깥 모서리 구도는 그대로다.
        //   ⚠ 판마다 `dist` 가 달라 `halfW/halfH` 가 다르지만, 배율은 **화면 비율에서 나오므로 층이 달라도 같다** —
        //     그래서 세 층의 상대 크기가 원고 그대로 유지된다 (거리가 크기를 안 바꾼다는 위 규칙과 같은 말이다).
        const s = Math.max(2 * halfW / CANVAS_W, 2 * halfH / CANVAS_H) * scaleK;
        const w = img.width * s;
        const h = img.height * s;

        // ── 기울기 (fake 3D). 기본은 **안쪽으로**, 마우스는 좌우에 **같은 방향**으로 더한다 —
        //   그래서 마우스가 한가운데 있어도 두 판이 이미 꺾여 있고, 움직이면 한쪽은 더 닫히고
        //   반대쪽은 펴진다. 레퍼런스(tinkerfx parallax-card)의 두 회전과 같은 규칙이다.
        //   ⭐ 마우스로 꺾이는 양은 **움직이는 양과 같은 비**를 탄다 (`pw`) — 덜 움직이는 판은 덜 꺾인다.
        //     ⚠ 새 파라미터를 만들지 않는다. `pw` 하나에서 파생시킨다 (불변식 2 와 같은 규율)
        //   ⚠ 세로 회전은 0.6 배로 눌러 쓴다 — 아래 판이 들리면 수면과의 접합이 티난다
        const kT = pw;
        // ⭐ 아이들 sway — §5 : *"판마다 위상이 다른 아주 느린 sway 한 줄(진폭 0.2° 안팎)이면 된다.
        //   인터랙션이 아니라 아이들 모션이라 비용이 사실상 0 이다."* 0 이면 예전과 비트 단위로 같다
        const sway = swayA * Math.sin(2 * Math.PI * swaySp * tNow + wg.phase);
        const tY = wg.sign * tiltB + sx * tiltM * kT + sway;
        const tX = -sy * tiltM * kT * 0.6;
        // ⚠⚠ **기울면 바깥 가장자리가 카메라에서 멀어져 화면 안쪽으로 당겨진다.** 그대로 두면
        //   그 자리에 배경이 드러난다. 필요한 여유는 해석적으로 나온다 —
        //   판 폭 대비 `0.5(1−cos θ) + 0.5·(halfW/dist)·|sin θ|` 다. 첫 항은 폭이 줄어드는 몫,
        //   둘째 항은 멀어져서 작아 보이는 몫. 그래서 기울기를 키워도 여백이 안 생긴다.
        const needX = 0.5 * (1 - Math.cos(tY)) + 0.5 * tanA * Math.abs(Math.sin(tY));
        const needY = 0.5 * (1 - Math.cos(tX)) + 0.5 * tanB * Math.abs(Math.sin(tX));
        // ⚠⚠⚠ **기울면 바깥 아래 모서리가 화면 아래에서 떠오른다** (2026-09-21 실측, 1920×1080 :
        //   사용자 *"바다 모서리 및 하단 띄워져서 부분이 자꾸 보임 · 조금 이미지를 하단으로 내려야하나?"*).
        //   판이 **제 가운데를 축으로** 도니 바깥 모서리가 카메라에서 멀어지고, 멀어진 만큼 투영이
        //   작아져 아래 변이 위로 당겨진다. `needX` 가 가로로 하는 보정의 **세로 짝**이 없었다.
        //   실측 (GREEN · 바깥 아래 모서리가 화면 아래 1080 에서 뜬 px) :
        //     기울기 14° → far **+12.5** · mid **+36.0** · near **+18.6**   ← 그 틈으로 바다가 보인다
        //     기울기  0° → far  −57.8 · mid  −22.8 · near  −5.3            ← 전부 화면 아래로 내려간다
        //   ⚠ 카메라 높이·피치 탓이 아니다. 기울기만 0 으로 놓으면 틈이 사라진다 — 위 두 줄이 그 증거다.
        //
        //   바깥 모서리의 깊이는 `dist + sign·(w/2)·sin(tY)` 다 (로컬 +x 의 전방 성분이 sin tY,
        //   바깥쪽 로컬 x 가 `sign·w/2`). 그 깊이에서 화면 아래는 `halfH × depth/dist` 이므로
        //   **더 내려야 할 양 = halfH × (w / 2dist) × sign·sin(tY)** 다. 해석적이라 기울기를 키워도 안 샌다.
        //   ⚠⚠ **절댓값이 아니다** — 마우스가 판을 반대로 꺾으면 바깥 모서리가 오히려 **가까워져**
        //     저절로 아래로 내려간다. 그때까지 내리면 그림 밑동만 더 잘린다 (`needR` 과 같은 한쪽 보정).
        const needD = Math.max(0, wg.sign * Math.sin(tY)) * w / (2 * dist);
        // ── 가로 : open=1 이면 판의 바깥 가장자리가 화면 가장자리를 `gateBleed` 만큼 **넘고**,
        //   open=0 이면 판이 통째로 화면 밖이다. 그 사이를 그대로 잇는다.
        //   ⚠⚠ **이 자산은 바깥 여백이 0px 이다** (§1-1 : 내용이 바깥 변에 딱 닿는다) — §5 가 요구한
        //     *"바깥쪽 최소 15% 여백"* 이 없다. 그래서 `gateBleed` 기본값이 0.05 → **0.02** 다.
        //     키우면 틈이 아니라 **그림이 잘린다.**
        // ⚠⚠ **절댓값이 아니다.** `|offR|` 로 보정하면 마우스가 화면 중앙을 지날 때 보정량이
        //   V 자로 꺾인다 — 미분이 끊기고, 그게 판이 **우글거리는** 또 한 원인이었다.
        //   판이 밀려서 가장자리가 드러나는 것은 **한쪽 방향뿐**이다 : 카메라가 오른쪽으로 가면
        //   판은 화면 왼쪽으로 밀리므로 **우판**이 위험하고 좌판은 오히려 안전해진다.
        //   ⭐ `w` 로 나누므로 **먼 판일수록 보정이 작다** — 화면에서 덜 밀리는 것과 정확히 같은 비다.
        const needR = Math.max(0, wg.sign * offR) / w;
        const x = wg.sign * (halfW + w * (bleed + needR + needX) - w * (open - 0.5));
        // ── 세로 : 판 아래 가장자리를 화면 아래에 맞추고 `gateDrop` 만큼 더 내린다.
        //   ⚠⚠ 이 자산은 **아래 여백도 0px** 이라 `gateDrop` 기본값이 0.06 → **0** 이다.
        //     0.06 이면 풀·잎의 밑동이 6% 잘린다 (예전 우디 판은 아래가 암석이라 잘려도 티가 안 났다).
        //   ⚠ 세로도 같은 이유로 한쪽만 — 카메라가 **내려갈 때**(offU < 0) 판이 화면 위로
        //     밀려 아래가 뜬다. 올라갈 때는 저절로 안전하다
        const y = -halfH + h * 0.5 - drop * 2 * halfH - Math.max(0, -offU) - h * needY - halfH * needD;

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

    // ⚠ 매 프레임 갱신되는 값(위치·크기·opacity)은 update 가 쓴다. 여기는 재질 쪽과 캐시 크기만 본다
    apply() {
      const op = num(P.gateOpacity, 1);
      for (const wg of wings) wg.mat.opacity = op;
      trim();
    },

    dispose() {
      for (const wg of wings) {
        scene.remove(wg.mesh);
        wg.mat.dispose();
      }
      for (const p of packs.values()) for (const k in p.tex) if (p.tex[k]) p.tex[k].dispose();
      packs.clear();
      cur = null; curFam = '';
      geo.dispose();
    }
  };
}
