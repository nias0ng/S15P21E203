import { CONFIG } from './config.js';

// ───────── 입력 ─────────
// ← → 로 방향, ↑ 또는 휠↑ 로 나아가기. 360도 열려 있다. ⚠ 2026-09-22 : Shift 가속은 안내문에서 뺐다 — cruise 와 boost 가 둘 다 1.0 이라 Shift 가 속도를 안 바꾼다 (config.js speed). 휠도 목표를 1.0 까지만 올리므로 순항 중에는 보탬이 없다
//
// ⚠⚠ **드래그 조타는 2026-09-06 에 걷어냈다** (사용자 지시 : "마우스 드래그했을 때 선체가
//   회전하는 걸 삭제, 코드를 완전히 삭제"). `dragDX` · `takeDrag()` · `CONFIG.move.dragK` ·
//   `dragTurn` 이 전부 사라졌다. 되살리려면 그 넷을 같이 되살려야 한다.
//   ⚠ 아래 SLOP(클릭/드래그 구분)은 **남겼다.** 조타가 없어도 여전히 필요하다 —
//     이게 없으면 화면을 끌었을 때 그 끝점에서 부표가 잘못 선택된다.
// onManual : 사용자가 직접 조타하는 순간 자동 조타를 놓기 위한 훅.
// onPick   : 클릭(= 드래그가 아닌 누름)이 끝난 자리. NDC 로 준다 — Raycaster 가 그대로 먹는다.
//
// ⚠⚠ **클릭과 드래그는 여기서 갈린다.** 예전에는 `pointerdown` 이 곧 드래그 시작이자
// 자동 조타 해제였다. 그 상태로 클릭할 오브젝트를 얹으면 두 가지가 같이 깨진다 :
//   · 향수를 고르려고 누를 때마다 자동 항해가 끊긴다
//   · 손이 조금 흔들린 클릭이 그대로 조타로 샌다
// 그래서 누름을 **보류**했다가, 이동거리가 SLOP 을 넘은 첫 순간에만 드래그로 승격한다.
// 넘지 않고 떼면 클릭이다.
//
// ⚠ 이동량을 `e.movementX` 가 아니라 clientX 차분으로 낸다. 어차피 SLOP 판정에 절대 좌표가
// 필요하고, movementX 는 터치에서 브라우저마다 안 채워 주는 곳이 있다.
//
// 모바일에는 아직 가속 수단이 없다 (터치 드래그는 방향만). TODO.md 참고.

const SLOP = 6;   // 이 픽셀을 넘어야 드래그다. 그 아래는 클릭

export function createInput(el, { onManual, onPick } = {}) {
  const state = {
    left: false, right: false, fwd: false, back: false, boost: false,
    wheel: 0,      // 루프에서 감쇠한다
    // 마우스 NDC (−1..1). ⚠ 누르지 않아도 갱신된다 — [8단계] 패럴랙스가 읽는다
    mx: 0, my: 0,
    // 마우스 자리 — 이 요소(#mount = #stage) 기준 CSS px. 호버 카드의 틈 판정이 읽는다 (2026-09-15, v0.65.0 — main.js updateHover). 아직 안 움직였으면 NaN
    px: NaN, py: NaN
  };
  const drag = { on: false };
  // 보류 중인 누름. id 가 null 이면 누르고 있지 않다
  const hold = { id: null, x0: 0, y0: 0, x: 0, y: 0 };
  // ⚠ 자유 시점(freecam.js)이 켜지면 휠 가속을 세운다 — 안 그러면 줌과 가속이 겹친다.
  // ⚠ 방향키는 살려 둔다 (자유 시점으로 보면서 배를 몰 수 있어야 쓸모가 있다).
  //   클릭 판정도 그대로 산다. 드래그 조타는 아예 없어졌다 (위 참고)
  let steer = true;
  // ⭐ 앱(호스트)이 띄운 창이 열려 있는 동안 (2026-09-15, v0.68.0 — main.js holdWhile · 진열대 저장 모달). 키 · 누르기 · 휠을 **안 받는다**.
  //   ⚠ steer 와 따로 둔다 — 자유 시점이 steer 를 끄고 켜므로 섞으면 창이 열린 채로 휠이 되살아난다. 마우스 자리(mx · my · px · py)는 계속 갱신한다
  let held = false;
  const manual = () => onManual && onManual();

  const dn = e => {
    if (held) return;
    if (e.key === 'ArrowLeft') state.left = true;
    if (e.key === 'ArrowRight') state.right = true;
    if (e.key === 'ArrowUp') state.fwd = true;
    if (e.key === 'ArrowDown') state.back = true;
    if (e.key === 'Shift') state.boost = true;
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) { manual(); e.preventDefault(); }
  };
  const up = e => {
    if (e.key === 'ArrowLeft') state.left = false;
    if (e.key === 'ArrowRight') state.right = false;
    if (e.key === 'ArrowUp') state.fwd = false;
    if (e.key === 'ArrowDown') state.back = false;
    if (e.key === 'Shift') state.boost = false;
  };

  // 누름은 일단 보류한다 — 조타도, 자동 조타 해제도 아직 하지 않는다
  const pd = e => {
    if (held) return;   // 창 뒤 캔버스를 누른 것이 고르기 · 바다 떠나기가 되지 않게
    hold.id = e.pointerId;
    hold.x0 = hold.x = e.clientX;
    hold.y0 = hold.y = e.clientY;
    drag.on = false;
    el.setPointerCapture?.(e.pointerId);
  };

  // ⚠ rect 는 캐시한다. pointermove 마다 getBoundingClientRect 를 부르면 그때마다 레이아웃을
  //   강제로 계산하게 되고, 마우스는 초당 수십~수백 번 움직인다
  let rectC = null;
  const rectOf = () => (rectC || (rectC = el.getBoundingClientRect()));
  const dropRect = () => { rectC = null; };

  const pm = e => {
    // ⚠⚠ **이 블록은 hold 와 무관하다** (2026-09-10, [8단계] 마우스 패럴랙스).
    //   아래 조기 return 은 '누르고 있을 때' 만 통과하는데, 패럴랙스는 **누르지 않아도**
    //   따라가야 한다. 그래서 return 앞에 둔다.
    const r = rectOf();
    if (r.width > 0 && r.height > 0) {
      state.mx = ((e.clientX - r.left) / r.width) * 2 - 1;
      state.my = -((e.clientY - r.top) / r.height) * 2 + 1;
      state.px = e.clientX - r.left;
      state.py = e.clientY - r.top;
    }
    if (hold.id === null || e.pointerId !== hold.id) return;
    hold.x = e.clientX; hold.y = e.clientY;
    // SLOP 을 넘으면 '클릭이 아님' 으로 표시할 뿐이다. 조타는 하지 않는다 —
    // ⚠ 그래서 드래그는 자동 조타도 안 놓는다. 아무 일도 일어나지 않는 동작이 됐다
    if (!drag.on && Math.hypot(e.clientX - hold.x0, e.clientY - hold.y0) >= SLOP) drag.on = true;
  };

  const pu = e => {
    if (hold.id === null || e.pointerId !== hold.id) return;
    // SLOP 을 한 번도 안 넘겼으면 클릭이다. 자동 조타는 건드리지 않는다 —
    // 향수를 고르는 것과 배를 모는 것은 다른 행동이다
    // ⭐ 이벤트도 같이 넘긴다 (2026-09-13) — main.js 가 `e.shiftKey` 로 Shift 바다 누르기를 가른다.
    //   ⚠ `state.boost`(keydown)로 읽지 않는다 — 창이 초점을 잃은 동안 뗀 Shift 는 keyup 이 안 와서 켜진 채 남는다
    if (!drag.on && onPick) {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) {
        onPick(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1, e);
      }
    }
    hold.id = null;
    drag.on = false;
  };

  // 터치가 시스템 제스처에 뺏기면 누름이 영영 안 끝난다 — 여기서 같이 푼다
  const pc = e => {
    if (e.pointerId !== hold.id) return;
    hold.id = null;
    drag.on = false;
  };

  const wh = e => { if (!steer || held) return; e.preventDefault(); if (e.deltaY < 0) state.wheel = Math.min(1, state.wheel + 0.22); };

  window.addEventListener('keydown', dn);
  window.addEventListener('keyup', up);
  el.addEventListener('pointerdown', pd);
  window.addEventListener('pointermove', pm);
  window.addEventListener('pointerup', pu);
  window.addEventListener('pointercancel', pc);
  el.addEventListener('wheel', wh, { passive: false });
  window.addEventListener('resize', dropRect);
  window.addEventListener('scroll', dropRect, true);

  return {
    state,
    // 자유 시점이 켜지는 동안 휠 가속을 세운다 (freecam.js 주석 참고)
    setSteer(v) { steer = !!v; if (!v) state.wheel = 0; },
    // 앱 창이 열리고 닫힐 때 (위 held). 잠글 때 누르고 있던 방향키 · Shift · 휠 · 보류 중인 누름을 놓는다 — 안 놓으면 창이 열린 채 배가 계속 돈다
    setHold(v) { held = !!v; if (held) { state.left = state.right = state.fwd = state.back = state.boost = false; state.wheel = 0; hold.id = null; drag.on = false; } },
    dispose() {
      window.removeEventListener('keydown', dn);
      window.removeEventListener('keyup', up);
      el.removeEventListener('pointerdown', pd);
      window.removeEventListener('pointermove', pm);
      window.removeEventListener('pointerup', pu);
      window.removeEventListener('pointercancel', pc);
      el.removeEventListener('wheel', wh);
      window.removeEventListener('resize', dropRect);
      window.removeEventListener('scroll', dropRect, true);
    }
  };
}
