import * as THREE from 'three';
import { PARAMS as P } from './params.js';
import { clamp } from './util.js';

// ───────── 자유 시점 (개발 전용) ─────────
// main.js 가 import.meta.env.DEV 일 때만 붙인다. 프로덕션 번들에는 안 들어간다
// (perf.js · probes.js · tweaks.js 와 같다).
//
// **왜 필요한가.** 본 카메라는 월드에 고정이고 수면을 스치듯 본다. 그 구도에서는
//   · 부표가 정말 물 위에 떠 있는지 (높이·간격)
//   · 반사가 부표 **발밑**에 앉는지, 아니면 엉뚱한 데 찍히는지
//   · 파도의 실루엣이 뒤에서 어떻게 생겼는지
// 를 판정할 수 없다. 항공뷰(topView)는 직교라 방향을 재기엔 좋지만 높이를 못 본다.
// 자유 시점은 그 사이를 메운다 — 궤도를 돌며 옆에서·뒤에서·아래에서 본다.
//
// ⚠ OrbitControls 를 쓰지 않는다. 그건 자기 포인터 리스너를 캔버스에 직접 붙이는데,
// 이 프로젝트는 input.js 가 같은 요소에서 클릭/드래그를 이미 가르고 있어서 둘이 싸운다.
// 필요한 것은 궤도 하나뿐이라 직접 쓴다 (의존성도, 클래스 체계도 안 늘린다).
//
// ⚠⚠ **켜는 동안 input.js 의 조타를 세워 둔다** (`input.setSteer(false)`).
// 드래그가 배도 돌리고 카메라도 돌리면 아무것도 판정할 수 없고, 휠은 줌과 가속이 겹친다.
// 방향키는 살려 둔다 — 자유 시점으로 보면서 배를 몰 수 있어야 쓸모가 있다.
// 클릭(부표 고르기)도 그대로 산다. input.js 가 6px 문턱으로 클릭과 드래그를 가르므로,
// 궤도를 돈 뒤 손을 떼도 카드가 뜨지 않는다.

export function createFreecam(el, onEnable) {
  const cam = new THREE.PerspectiveCamera(50, 1, 0.1, 400);
  // 궤도의 중심은 배다. 이 씬에서 배는 늘 원점에 있으므로(월드가 흐른다) 원점을 돈다
  const st = {
    yaw: 0.55,        // 라디안. 0 이면 본 카메라와 같은 쪽(+z)에서 본다
    pitch: 0.30,      // 라디안. + 면 위에서 내려다본다
    dist: 15,
    target: new THREE.Vector3(0, 0.6, 0)
  };
  const HOME = { yaw: 0.55, pitch: 0.30, dist: 15, tx: 0, ty: 0.6, tz: 0 };

  let on = false;
  const drag = { id: null, x: 0, y: 0, pan: false };
  const right = new THREE.Vector3(), up = new THREE.Vector3(), fwd = new THREE.Vector3();

  const pd = (e) => {
    if (drag.id !== null) return;
    drag.id = e.pointerId; drag.x = e.clientX; drag.y = e.clientY;
    // Shift 나 가운데·오른쪽 버튼이면 중심을 옮긴다 (배가 아니라 부표를 들여다볼 때)
    drag.pan = e.shiftKey || e.button === 1 || e.button === 2;
    el.setPointerCapture?.(e.pointerId);
  };
  const pm = (e) => {
    if (drag.id === null || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    drag.x = e.clientX; drag.y = e.clientY;
    if (drag.pan) {
      // 화면 평면으로 민다. 멀수록 많이 움직여야 같은 화면 이동이 된다
      cam.matrixWorld.extractBasis(right, up, fwd);
      const k = st.dist * 0.0016;
      st.target.addScaledVector(right, -dx * k).addScaledVector(up, dy * k);
    } else {
      st.yaw -= dx * 0.006;
      // ⚠ 극을 넘기지 않는다. 넘기면 up 벡터가 뒤집혀 화면이 돈다
      st.pitch = clamp(st.pitch + dy * 0.006, -1.45, 1.45);
    }
  };
  const pu = (e) => { if (e.pointerId === drag.id) { drag.id = null; drag.pan = false; } };
  const wh = (e) => {
    e.preventDefault();
    st.dist = clamp(st.dist * (e.deltaY > 0 ? 1.12 : 0.893), 1.2, 160);
  };
  // 우클릭으로 팬할 때 브라우저 메뉴가 뜨지 않게
  const ctx = (e) => e.preventDefault();

  function bind(v) {
    if (v === on) return;
    on = v;
    if (v) {
      el.addEventListener('pointerdown', pd);
      window.addEventListener('pointermove', pm);
      window.addEventListener('pointerup', pu);
      el.addEventListener('wheel', wh, { passive: false });
      el.addEventListener('contextmenu', ctx);
    } else {
      el.removeEventListener('pointerdown', pd);
      window.removeEventListener('pointermove', pm);
      window.removeEventListener('pointerup', pu);
      el.removeEventListener('wheel', wh);
      el.removeEventListener('contextmenu', ctx);
      drag.id = null; drag.pan = false;
    }
    onEnable && onEnable(v);
  }

  const api = {
    cam, state: st,

    // 매 프레임. 켜져 있지 않으면 리스너도 안 붙어 있고 행렬도 안 만진다
    update(enabled, aspect) {
      bind(!!enabled);
      if (!on) return;
      const cp = Math.cos(st.pitch), sp = Math.sin(st.pitch);
      cam.position.set(
        st.target.x + Math.sin(st.yaw) * cp * st.dist,
        st.target.y + sp * st.dist,
        st.target.z + Math.cos(st.yaw) * cp * st.dist
      );
      cam.aspect = aspect;
      cam.fov = P.freeFov;
      cam.updateProjectionMatrix();
      cam.lookAt(st.target);
    },

    // 콘솔에서 :  PB.freecam.home()
    home() {
      st.yaw = HOME.yaw; st.pitch = HOME.pitch; st.dist = HOME.dist;
      st.target.set(HOME.tx, HOME.ty, HOME.tz);
    },

    // 지금 시점을 숫자로 (마음에 드는 각도를 적어 두고 싶을 때)
    dump() {
      return {
        yaw: +st.yaw.toFixed(3), pitch: +st.pitch.toFixed(3), dist: +st.dist.toFixed(2),
        target: [+st.target.x.toFixed(2), +st.target.y.toFixed(2), +st.target.z.toFixed(2)],
        fov: P.freeFov
      };
    },

    dispose() { bind(false); }
  };

  return api;
}
