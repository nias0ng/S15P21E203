import { PARAMS as P } from './params.js';

// ───────── 연출 상태머신 ([4단계], 2026-09-10) ─────────
// 설계는 `docs/무대와-존-연출.md` §2·§3·§7 이다. 이 파일은 그 §3 표의 실행 가능한 판본이다.
//
// ⚠⚠⚠ **THREE 를 import 하지 않는다. 씬도 카메라도 부표도 모른다.**
//   이 파일이 하는 일은 **중립 상태 객체 `cue` 하나를 시간에 따라 채우는 것**뿐이고,
//   층들(stage · title · gate · main.js 의 카메라 블록)이 매 프레임 그 값을 **읽기만** 한다.
//   작업계획 [5단계]의 규율 그대로 : *"절대 three 객체를 직접 트윈하지 마라. 중립 객체 하나만
//   몰고 렌더 루프가 그 값을 읽는 유일한 지점이 되게 한다."*
//   ⚠ 여기서 `scene.add` 나 `mesh.position` 을 만지고 싶어지면 그건 이 파일의 일이 아니다.
//
// ⚠⚠ **[4단계]는 연출이 아니라 값이다.** 지금 이 `cue` 를 읽는 소비자는 **하나도 없다** —
//   title.js·gate.js 는 [6·7단계]에 생기고, 카메라 전환은 [5단계]다. 그래서 이 단계의
//   판정 기준은 화면이 아니라 **콘솔**이다 (§8) : `PB.phase.enter('woody')` 로 값이 0→1 로
//   보간되는가. 화면이 안 바뀌는 것이 정상이고, 그게 이 층이 씬을 모른다는 증거다.
//
// ⚠ **GSAP 을 쓰지 않는다** (§7). 커브 여섯 개가 각 한 줄이고, 타임라인이라 해 봐야 아래
//   `TL` 표 한 장이라 `t` 하나에서 전부 파생된다. 이 리포의 의존성은 `three` 하나다.

// ───────── ease 커브 (§7 의 표) ─────────
// ⚠ `outBack` 의 오버슈트는 **타이포에만** 쓴다. 윙에 걸면 화면 밖에서 되돌아오는 게 보인다.
const BACK_C1 = 1.70158, BACK_C3 = BACK_C1 + 1;
export const EASE = {
  linear:     t => t,
  inOutCubic: t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
  outExpo:    t => t >= 1 ? 1 : 1 - Math.pow(2, -10 * t),
  outQuad:    t => 1 - (1 - t) * (1 - t),
  // ⚠⚠ **좌우 윙이 outExpo 를 쓰다가 틈이 보였다** (2026-09-10, 사용자 :
  //   *"너무 빠르게 등장하고 반동으로 인해서 좌우 틈새 여백이 보임"*).
  //   outExpo 는 t=0.1 에 이미 **50%**, t=0.5 에 **96.9%** 까지 간다 — 튀어나온 뒤
  //   **마지막 3% 를 남은 시간 내내** 좁힌다. 그 3% 가 화면에서는 가장자리의 틈이다.
  //   outCubic 은 t=0.5 에 87.5%, t=0.8 에 99.2% 로 **끝에서 덜 질질 끈다.**
  outCubic:   t => 1 - Math.pow(1 - t, 3),
  outBack:    t => 1 + BACK_C3 * Math.pow(t - 1, 3) + BACK_C1 * Math.pow(t - 1, 2),
  inCubic:    t => t * t * t
};

// ───────── 타임라인 — §3 표를 그대로 옮긴 것이다 ─────────
// 각 줄은 [시작초, 끝초, 커브]. 값은 그 구간에서 0 → 1 로 간다 (퇴장은 1 → 0 으로 뒤집는다).
//
// ⚠⚠ **좌우 0.14s 시차가 "순서대로" 의 전부다** (§3). 이보다 크면 두 동작으로 쪼개져 보이고,
//   0 이면 자동문이 된다. 이 한 숫자가 사용자 요청 *"하단 좌우 오브젝트가 순서대로 좌, 우로
//   등장하고"* 의 실행 가능한 판본이다.
// ⚠ 타이포는 **가장 빠르고 가장 짧게** 간다 — 프레임이 닫히는 동안 그 안에서 솟아 **먼저
//   멈춘다.** 셋이 같이 끝나면 슬라이드쇼가 된다.
const TL = {
  // 항해 → 존. 총 2.00s
  // ⚠⚠ **2026-09-10 에 전체를 늦췄다** (1.20 → 2.00s). 사용자 : *"그렇게 빠르게 진행할
  //   필요는 없음 전체적으로"*. 시차도 0.14 → **0.22s** 로 같이 늘렸다 — 전체가 느려지면
  //   같은 시차는 상대적으로 짧아져 *"순서대로 좌, 우로"* 가 안 읽힌다.
  enter: {
    look:  [0.00, 2.00, 'inOutCubic'],   // 카메라 구도
    openL: [0.00, 1.15, 'outCubic'],     // 좌 윙
    openR: [0.22, 1.40, 'outCubic'],     // 우 윙 — ⚠ 0.22s 시차
    dim:   [0.15, 1.00, 'outQuad'],      // 원경 안개가 짙어진다
    rise:  [0.55, 1.45, 'outBack'],      // 수면 타이포
    ui:    [1.20, 1.85, 'outQuad']       // 우측 향조 정보 · 좌하단 03 ZONE
  },
  // 존 → 항해. 총 1.90s (2026-09-10 에 1.30 → 1.90)
  // ⚠⚠ **들어온 순서의 역순이 아니다** (§3). 역순으로 재생하면 "되감기" 로 읽힌다.
  //   타이포가 **먼저** 가라앉고, 좌우가 **같이** 열리고, 카메라가 **마지막에** 돌아온다.
  //   ⚠ 그래서 퇴장에는 좌우 시차가 없다 — 닫힐 때만 순서가 있다.
  leave: {
    rise:  [0.00, 0.60, 'inCubic'],
    ui:    [0.00, 0.40, 'outQuad'],
    openL: [0.25, 1.20, 'inCubic'],
    openR: [0.25, 1.20, 'inCubic'],
    dim:   [0.25, 1.10, 'outQuad'],
    look:  [0.45, 1.90, 'inOutCubic']
  }
};

const KEYS = ['look', 'openL', 'openR', 'dim', 'rise', 'ui'];
// ⭐ 머묾 시계를 멈췄다가 다시 흐를 때 **최소한 남겨 두는 초** (2026-09-11 오후, `pauseHold`).
//   정보 블록을 다 읽고 마우스를 떼는 순간 닫히면 쫓겨나는 느낌이다 — 뗀 뒤에도 이만큼은 머문다.
//   ⚠ 남은 시간이 이미 더 길면 건드리지 않는다 (호버가 시계를 **늘리지는** 않는다)
const HOLD_AFTER = 1.5;
const dur = (tl) => KEYS.reduce((m, k) => tl[k] ? Math.max(m, tl[k][1]) : m, 0);
const ENTER_DUR = dur(TL.enter), LEAVE_DUR = dur(TL.leave);

// 한 줄의 값을 지금 시각에서 낸다. 구간 밖은 0 또는 1 로 물린다
function track(row, t) {
  if (!row) return 0;
  const [t0, t1, ease] = row;
  if (t <= t0) return 0;
  if (t >= t1) return 1;
  return EASE[ease]((t - t0) / (t1 - t0));
}

export function createPhase() {
  // ⚠⚠ **이 객체가 층들 사이의 유일한 통로다.** 소비자는 매 프레임 읽기만 한다.
  //   ⚠ 새 필드를 넣으려면 KEYS 와 TL 양쪽에 같이 넣는다 — 한쪽만 넣으면 조용히 0 으로 남는다.
  const cue = {
    zone: null,       // 어느 향조인가 (문자열). ⚠ **무엇이 진입을 일으켰는지는 모른다** (§10-1 이
                      //   미정이어도 이 단계가 진행되는 이유다 — 진입점은 나중에 붙인다)
    phase: 'sailing', // sailing · entering · inspecting · leaving
    t: 0,             // 지금 상태 안에서 흐른 초
    p: 0,             // 그 상태의 진행도 0~1 (전환이 아닌 상태에서는 1)
    busy: false,      // ⚠ 전환 중인가. input.js 가 이걸 보고 클릭을 막는다 (§9-4)
    // ⭐ 도착 연출의 **머무는 시간**(초, 2026-09-11 · v0.32.0). 0 이면 ESC 까지 머문다 (예전 동작).
    //   사용자 : *"해당 영역에 도착하면 좌우 연출이 시작되고 몇초 후 사라지게"*. holdT 는 inspecting 에서 흐른 초
    hold: 0, holdT: 0,
    // 머묾 시계가 멈춰 있는가 (2026-09-11 오후). 사용자 : *"마우스를 올린 동안에는 머물게하고 5초 뒤에는 걷히게"*.
    //   ⚠ 이 층은 DOM 을 모른다 — 누가 멈추는지(main.js 가 ui 의 호버를 보고) 모르고 **멈춤만** 받는다
    holdPaused: false,
    look: 0, openL: 0, openR: 0, dim: 0, rise: 0, ui: 0
  };

  const setAll = (v) => { for (const k of KEYS) cue[k] = v; };

  const api = {
    cue,

    // 존으로 들어간다. zone 은 향조 키 (`CONFIG.areas[].key`)
    // ⚠ 전환 중에는 무시한다 — §9-4 : *"전환 중 재클릭이면 cue 가 두 향조 사이에서 찢어진다."*
    //   다른 향조로 갈아타려면 leave() 가 끝난 뒤 다시 부른다.
    // opts.hold (초) — 들어온 뒤 이만큼 머물다 **스스로 나간다** (도착 연출). 없으면 ESC 까지 머문다
    //   ⚠ 개발 바 '연출' 행은 hold 없이 부른다 — 시안을 볼 때 저절로 닫히면 못 본다
    enter(zone, opts) {
      if (cue.busy) return false;
      if (cue.phase === 'inspecting' && cue.zone === zone) return false;
      cue.zone = zone ?? cue.zone;
      cue.phase = 'entering'; cue.t = 0; cue.p = 0; cue.busy = true;
      cue.hold = opts && opts.hold > 0 ? opts.hold : 0; cue.holdT = 0;
      return true;
    },

    // 머묾 시계를 멈춘다 / 다시 흐르게 한다. ⚠ 매 프레임 불러도 된다 — 바뀔 때만 일한다.
    //   다시 흐를 때 남은 시간이 HOLD_AFTER 보다 짧으면 그만큼으로 늘려 준다 (위 HOLD_AFTER 주석)
    pauseHold(on) {
      on = !!on;
      if (cue.holdPaused === on) return;
      cue.holdPaused = on;
      if (!on && cue.hold > 0) cue.holdT = Math.min(cue.holdT, Math.max(0, cue.hold - HOLD_AFTER));
    },

    // 항해로 돌아간다
    leave() {
      if (cue.busy) return false;
      if (cue.phase !== 'inspecting') return false;
      cue.phase = 'leaving'; cue.t = 0; cue.p = 0; cue.busy = true;
      return true;
    },

    // ⚠ 트윈 없이 즉시 그 상태로 (검증·초기화용)
    snap(phase, zone = null) {
      cue.phase = phase; cue.t = 0; cue.p = phase === 'inspecting' ? 1 : 0; cue.busy = false;
      cue.hold = 0; cue.holdT = 0;   // ⚠ 값 잡으려고 고정한 상태가 저절로 풀리면 안 된다
      if (zone !== null) cue.zone = zone;
      setAll(phase === 'inspecting' ? 1 : 0);
      if (phase === 'sailing') cue.zone = null;
    },

    // ⚠ 매 프레임 부른다. dt 는 초.
    //   ⚠⚠ **게이트를 걸지 않는다.** 카메라는 매 프레임 움직여야 하고, 물에 닿는 값(타이포
    //     높이 등)은 **소비자 쪽에서** 자기 게이트를 건다. 여기서 끊으면 카메라가 같이 끊긴다
    //     (§7 : *"GSAP 은 60fps 로 도는데 물은 12fps 다"* — 그 실수를 구조적으로 막는 자리다).
    update(dt) {
      // ⚠ phaseAmount 0 = 비트 단위 롤백. 상태머신이 아예 안 돈다
      const amt = P.phaseAmount === undefined ? 1 : P.phaseAmount;
      if (amt <= 0) { setAll(0); cue.busy = false; return cue; }

      const sp = Math.max(0.01, P.phaseSpeed === undefined ? 1 : P.phaseSpeed);
      // ⭐ 도착 연출은 머물다 **스스로 나간다** (v0.32.0). ⚠ 먼저 leave() 로 상태를 바꾸고 아래 트윈 경로를
      //   그대로 태운다 — 퇴장 연출(역순 아님, §3)을 따로 만들지 않는다
      if (cue.phase === 'inspecting' && cue.hold > 0) {
        // ⚠ 멈춰 있으면(마우스를 정보 블록에 올려 둔 동안) 시계가 안 간다 — pauseHold 주석
        if (!cue.holdPaused) cue.holdT += dt * sp;
        if (cue.holdT >= cue.hold) { cue.hold = 0; cue.holdT = 0; api.leave(); }
      }
      const ph = cue.phase;
      if (ph === 'entering' || ph === 'leaving') {
        cue.t += dt * sp;
        const tl = ph === 'entering' ? TL.enter : TL.leave;
        const total = ph === 'entering' ? ENTER_DUR : LEAVE_DUR;
        cue.p = Math.min(1, cue.t / total);
        for (const k of KEYS) {
          const v = track(tl[k], cue.t);
          // 퇴장은 같은 커브를 1 → 0 으로 읽는다
          cue[k] = (ph === 'entering' ? v : 1 - v) * amt;
        }
        if (cue.t >= total) {
          cue.phase = ph === 'entering' ? 'inspecting' : 'sailing';
          cue.busy = false; cue.t = 0; cue.p = 1;
          setAll(ph === 'entering' ? amt : 0);
          if (cue.phase === 'sailing') cue.zone = null;
        }
      } else {
        // 정지 상태. ⚠ amt 를 곱해 둬야 슬라이더를 내렸을 때 inspecting 도 같이 옅어진다
        setAll(ph === 'inspecting' ? amt : 0);
        cue.p = 1; cue.busy = false;
      }
      return cue;
    },

    // 콘솔 검증용 한 줄 (§8 의 판정 기준)
    report() {
      const f = (v) => v.toFixed(3);
      return `${cue.phase}${cue.zone ? ' · ' + cue.zone : ''}  t=${f(cue.t)} p=${f(cue.p)}  ` +
             `look=${f(cue.look)} open=${f(cue.openL)}/${f(cue.openR)} ` +
             `dim=${f(cue.dim)} rise=${f(cue.rise)} ui=${f(cue.ui)}` +
             (cue.hold > 0 ? `  hold ${f(cue.holdT)}/${f(cue.hold)}${cue.holdPaused ? ' (멈춤)' : ''}` : '');
    },

    // 이 층은 GPU 자원이 없다. 규율상 둔다 (불변식 10)
    dispose() { setAll(0); cue.phase = 'sailing'; cue.zone = null; cue.busy = false; cue.hold = 0; cue.holdT = 0; cue.holdPaused = false; }
  };

  return api;
}

// 문서·검증에서 인용할 때 여기서 가져온다 (숫자를 손으로 옮겨 적지 않는다)
export const PHASE_DUR = { enter: ENTER_DUR, leave: LEAVE_DUR };
