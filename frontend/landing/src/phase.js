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
//
// ⭐⭐ **2026-09-21 : 윙이 3층이 되면서 트랙이 둘에서 여섯이 됐다** (`docs/존-좌우윙-3층-0921.md` §2).
//   사용자 : *"왼쪽 2, 오른쪽 2, 왼쪽 3, 오른쪽 3, 왼쪽 1, 오른쪽 1 순서로 좌우에서 시작하면 됨"*
//   (1 = 맨앞 `near` · 2 = 중앙 `mid` · 3 = 맨뒤 `far`) → **중앙 → 맨뒤 → 맨앞**, 층마다 왼쪽 먼저.
//   ⚠⚠ **층 시차(0.30s)가 좌우 시차(0.18s)보다 커야 한다.** 작으면 시작 시각이
//     `좌중(0) → 좌뒤(0.18) → 우중(0.22)` 로 뒤섞여 **요청한 순서가 깨진다.** 그래서 예전의
//     좌우 0.22 를 0.18 로 되돌리고 층을 0.30 으로 벌렸다 — 여섯이 엄밀히 커지는 유일한 배분이다.
// ⚠ 타이포는 **가장 빠르고 가장 짧게** 간다 — 프레임이 닫히는 동안 그 안에서 솟아 **먼저
//   멈춘다.** 셋이 같이 끝나면 슬라이드쇼가 된다.
const TL = {
  // 항해 → 존. 총 2.00s
  // ⚠⚠ **2026-09-10 에 전체를 늦췄다** (1.20 → 2.00s). 사용자 : *"그렇게 빠르게 진행할
  //   필요는 없음 전체적으로"*. 시차도 0.14 → **0.22s** 로 같이 늘렸다 — 전체가 느려지면
  //   같은 시차는 상대적으로 짧아져 *"순서대로 좌, 우로"* 가 안 읽힌다.
  enter: {
    look:  [0.00, 2.00, 'inOutCubic'],   // 카메라 구도
    // 좌우 윙 3층 — 판 하나가 드는 시간은 **1.10s 로 같고** 시작만 0.18 · 0.30 으로 벌어진다.
    // ⚠ 마지막 판이 1.88s 에 서므로 `look`(2.00)이 여전히 가장 늦다 — **ENTER_DUR 은 2.00s 그대로다**
    openLmid:  [0.00, 1.10, 'outCubic'],   // 좌 중앙 (사용자 표기 2)
    openRmid:  [0.18, 1.28, 'outCubic'],   // 우 중앙 — ⚠ 0.18s 좌우 시차
    openLfar:  [0.30, 1.40, 'outCubic'],   // 좌 맨뒤 (3) — ⚠ 0.30s 층 시차
    openRfar:  [0.48, 1.58, 'outCubic'],   // 우 맨뒤
    openLnear: [0.60, 1.70, 'outCubic'],   // 좌 맨앞 (1)
    openRnear: [0.78, 1.88, 'outCubic'],   // 우 맨앞
    dim:   [0.15, 1.00, 'outQuad'],      // 원경 안개가 짙어진다
    rise:  [0.55, 1.45, 'outBack'],      // 수면 타이포
    ui:    [1.20, 1.85, 'outQuad'],      // 우측 향조 정보 · 좌하단 03 ZONE
    // ⭐⭐ 배 (2026-09-16, `zoneBoatEnter`). 사용자 : *"왼쪽 하단에서 대각선으로 등장"* · *"뱃머리가 글자를 바라보며 들어와야함"*.
    //   이 트랙은 배를 **시작 자리에 놓기만** 한다 (0.30s). 그 뒤의 움직임은 타임라인이 아니라 **속도**다 —
    //   main.js 가 뱃머리 방향으로 `zoneShipSpeed`(부스트 대비 비율)만큼 매 프레임 민다. **끝나는 지점이 없다.**
    //   ⚠⚠ 예전에는 `dock` 트랙이 정박 자리까지 `inOutCubic` 으로 데려갔는데, 그 곡선은 끝에서 **감속해 서고**
    //     머무는 5초 동안 완전히 멈춰 있었다 (2026-09-16 사용자 : *"시간 맞추기 위해 중간에 멈추는데 … 시간 제한 두지 말고 앞으로 움직여"*).
    //     타임라인으로 자리를 정하면 **반드시** 끝점에서 선다 — 그래서 자리를 타임라인에서 뺐다.
    //   ⭐ 그 덕에 ENTER_DUR 이 2.00s 그대로다 (`look` 이 가장 늦다) — 연출은 2초에 서고 배는 머무는 동안에도 계속 나아간다.
    swing: [0.00, 0.30, 'outCubic']
  },
  // 존 → 항해. 총 1.90s (2026-09-10 에 1.30 → 1.90)
  // ⚠⚠ **들어온 순서의 역순이 아니다** (§3). 역순으로 재생하면 "되감기" 로 읽힌다.
  //   타이포가 **먼저** 가라앉고, 좌우가 **같이** 열리고, 카메라가 **마지막에** 돌아온다.
  //   ⚠ 그래서 퇴장에는 좌우 시차가 없다 — 닫힐 때만 순서가 있다.
  leave: {
    rise:  [0.00, 0.60, 'inCubic'],
    ui:    [0.00, 0.40, 'outQuad'],
    // ⚠ 여섯이 **같이** 나간다 — 층 시차도 안 넣는다. 나가는 3층은 어차피 `dist` 가 달라 서로 다른
    //   속도로 미끄러지므로 공간감은 유지된다 (`docs/존-좌우윙-3층-0921.md` §2-2)
    openLmid:  [0.25, 1.20, 'inCubic'],
    openRmid:  [0.25, 1.20, 'inCubic'],
    openLfar:  [0.25, 1.20, 'inCubic'],
    openRfar:  [0.25, 1.20, 'inCubic'],
    openLnear: [0.25, 1.20, 'inCubic'],
    openRnear: [0.25, 1.20, 'inCubic'],
    dim:   [0.25, 1.10, 'outQuad'],
    look:  [0.45, 1.90, 'inOutCubic'],
    // ⚠ 배 — 나아간 만큼(main.js 가 쌓아 둔 오프셋)을 이 값으로 곱해 **0 으로 되돌린다.** 끝(1.90s)이 `look` 과 같아서
    //   카메라가 항해 구도로 돌아오는 것과 배가 제자리에 서는 것이 함께 끝난다 (2026-09-16 사용자 : *"끝날때 쯤에 맞춰서 배를 중앙으로"*).
    //   ⚠ 시차를 두면 배가 밖으로 다시 나갔다가 돌아와 '튕겨 돌아가는' 것으로 보였다 — 한 트랙으로 곧장 온다.
    swing: [0.30, 1.90, 'inOutCubic']
  }
};

// ⚠ 새 필드를 넣으려면 KEYS 와 TL 양쪽에 같이 넣는다 — 한쪽만 넣으면 조용히 0 으로 남는다
export const OPEN_KEYS = ['openLmid', 'openRmid', 'openLfar', 'openRfar', 'openLnear', 'openRnear'];
// ───────── ⭐⭐ 짧은 연출 — 항해하다 해역에 들어섰을 때 (2026-09-21, 브랜치 378) ─────────
// 사용자 : *"일반적인 클릭이 아닌 배의 위치가 해당 영역에 진입했을때도 **지금과 다른 짧은 연출**이
//   이루어져야함"*. 설계는 `frontend/docs/취향-출발점과-영역-진입-0921.md` §B 다.
//
// ⚠⚠⚠ **빠른 재생이 아니라 다른 종류다.** 위 표를 짧게 돌리면 카메라가 존 구도로 돌고 배가 정박하는데,
//   그건 *몰고 있는 배가 제멋대로 서는 것*이다. 그래서 **`look` 과 `swing` 이 이 표에 없다.**
//   ⭐ 트랙이 표에서 빠지면 `track(undefined)` 가 0 을 돌려주므로, 카메라·배는 **끄는 코드가 아니라
//     적지 않는 것**으로 빠진다 — 소비자(main.js 카메라 블록 · `_shipOff`)는 한 줄도 안 바뀐다.
// ⚠ 윙은 끝까지 안 닫힌다 — 값이 `zoneBriefOpen`(기본 0.45) 배로 눌린다 (update 에서 곱한다).
//   가장자리에서 살짝 드는 정도라 항해 시야를 안 막는다.
// ⚠ 좌우 · 층 순서는 긴 연출과 **같다** (좌중 → 우중 → 좌뒤 → 우뒤 → 좌앞 → 우앞). 시차만 0.10 · 0.18s 로 좁혔다 —
//   1초 안에 여섯이 다 들어와야 하므로 0.18 · 0.30 을 그대로 쓰면 마지막 판이 끝에 걸린다.
const TL_BRIEF = {
  enter: {
    dim:       [0.00, 0.50, 'outQuad'],
    openLmid:  [0.00, 0.55, 'outCubic'],
    openRmid:  [0.10, 0.65, 'outCubic'],
    openLfar:  [0.18, 0.73, 'outCubic'],
    openRfar:  [0.28, 0.83, 'outCubic'],
    openLnear: [0.36, 0.91, 'outCubic'],
    openRnear: [0.46, 1.01, 'outCubic'],
    rise:      [0.25, 0.85, 'outBack'],
    ui:        [0.45, 1.00, 'outQuad']
  },
  // ⚠ 퇴장은 긴 연출과 같은 규율 — 역순이 아니고 좌우 시차도 없다 (§3). 여섯이 같이 나간다
  leave: {
    rise:      [0.00, 0.35, 'inCubic'],
    ui:        [0.00, 0.28, 'outQuad'],
    openLmid:  [0.10, 0.70, 'inCubic'],
    openRmid:  [0.10, 0.70, 'inCubic'],
    openLfar:  [0.10, 0.70, 'inCubic'],
    openRfar:  [0.10, 0.70, 'inCubic'],
    openLnear: [0.10, 0.70, 'inCubic'],
    openRnear: [0.10, 0.70, 'inCubic'],
    dim:       [0.10, 0.60, 'outQuad']
  }
};

const KEYS = ['look', ...OPEN_KEYS, 'dim', 'rise', 'ui', 'swing'];
const OPEN_SET = new Set(OPEN_KEYS);
// ⭐ 머묾 시계를 멈췄다가 다시 흐를 때 **최소한 남겨 두는 초** (2026-09-11 오후, `pauseHold`).
//   정보 블록을 다 읽고 마우스를 떼는 순간 닫히면 쫓겨나는 느낌이다 — 뗀 뒤에도 이만큼은 머문다.
//   ⚠ 남은 시간이 이미 더 길면 건드리지 않는다 (호버가 시계를 **늘리지는** 않는다)
const HOLD_AFTER = 1.5;
const dur = (tl) => KEYS.reduce((m, k) => tl[k] ? Math.max(m, tl[k][1]) : m, 0);
const ENTER_DUR = dur(TL.enter), LEAVE_DUR = dur(TL.leave);
const BRIEF_ENTER_DUR = dur(TL_BRIEF.enter), BRIEF_LEAVE_DUR = dur(TL_BRIEF.leave);

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const num = (v, d) => (v === undefined ? d : v);

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
    // ⭐⭐ **짧은 연출인가** (2026-09-21 — 항해하다 해역에 들어섰을 때 · TL_BRIEF 주석).
    //   카메라·배가 안 움직이고 윙이 살짝만 든다. ⚠ main.js 의 **상호작용 가드가 이걸 본다** —
    //   `cue.zone` 만으로 막으면 항해 중에 부표 고르기·호버가 몇 초씩 죽는다 (문서 §B-3).
    brief: false,
    // ⭐ 도착 연출의 **머무는 시간**(초, 2026-09-11 · v0.32.0). 0 이면 ESC 까지 머문다 (예전 동작).
    //   사용자 : *"해당 영역에 도착하면 좌우 연출이 시작되고 몇초 후 사라지게"*. holdT 는 inspecting 에서 흐른 초
    hold: 0, holdT: 0,
    // 머묾 시계가 멈춰 있는가 (2026-09-11 오후). 사용자 : *"마우스를 올린 동안에는 머물게하고 5초 뒤에는 걷히게"*.
    //   ⚠ 이 층은 DOM 을 모른다 — 누가 멈추는지(main.js 가 ui 의 호버를 보고) 모르고 **멈춤만** 받는다
    holdPaused: false,
    look: 0, dim: 0, rise: 0, ui: 0,
    // 좌우 윙 3층 (0 = 화면 밖 · 1 = 들어온 상태). ⚠ gate.js 가 `open<측><층>` 이름 그대로 읽는다
    openLmid: 0, openRmid: 0, openLfar: 0, openRfar: 0, openLnear: 0, openRnear: 0,
    // 배 — swing 1 = 시작 자리에 놓였다 (그 뒤 움직임은 main.js 가 속도로 민다) · 0 = 항해 자리
    swing: 0
  };

  const setAll = (v) => { for (const k of KEYS) cue[k] = v; };

  // 지금 쓰는 타임라인 한 쌍
  const tlOf = () => (cue.brief ? TL_BRIEF : TL);
  // 그 타임라인에서 트랙 하나의 **멈춰 있을 때의 값**. ⚠⚠ 예전에는 `setAll(amt)` 로 전부 1 이었는데,
  //   짧은 연출에는 `look`·`swing` 이 아예 없어서 그러면 **카메라가 1 로 튀어 존 구도로 순간이동한다.**
  //   표에 있으면 amt · 없으면 0 이다 — 트랙을 안 적는 것만으로 층이 빠지는 규약(TL_BRIEF 주석)의 짝이다.
  const steadyOf = (amt) => {
    const tl = tlOf().enter;
    for (const k of KEYS) cue[k] = tl[k] ? amt * briefK(k) : 0;
  };
  // 짧은 연출에서 윙을 눌러 두는 배수. 다른 키와 긴 연출은 1 이다
  const briefK = (k) => (cue.brief && OPEN_SET.has(k) ? clamp01(num(P.zoneBriefOpen, 0.45)) : 1);

  const api = {
    cue,

    // 존으로 들어간다. zone 은 향조 키 (`CONFIG.areas[].key`)
    // ⚠ 전환 중에는 무시한다 — §9-4 : *"전환 중 재클릭이면 cue 가 두 향조 사이에서 찢어진다."*
    //   다른 향조로 갈아타려면 leave() 가 끝난 뒤 다시 부른다.
    // opts.hold (초) — 들어온 뒤 이만큼 머물다 **스스로 나간다** (도착 연출). 없으면 ESC 까지 머문다
    //   ⚠ 개발 바 '연출' 행은 hold 없이 부른다 — 시안을 볼 때 저절로 닫히면 못 본다
    // ⭐ opts.brief — **짧은 연출**로 든다 (항해하다 해역에 들어섰을 때 · TL_BRIEF 주석).
    //   카메라·배를 안 건드리고 윙이 살짝만 들었다 짧게 나간다
    enter(zone, opts) {
      if (cue.busy) return false;
      if (cue.phase === 'inspecting' && cue.zone === zone) return false;
      cue.zone = zone ?? cue.zone;
      // ⚠ 종류는 **들어가는 순간에만** 정한다 — 도중에 바뀌면 타임라인이 갈려 값이 튄다
      cue.brief = !!(opts && opts.brief);
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

    // ⭐⭐ **짧은 연출을 비킨다** (2026-09-21) — 누르거나 방향키를 잡으면 부른다 (main.js).
    //   `leave()` 와 다른 점 둘 : ① **들어오는 중에도** 나간다 ② 짧은 연출에만 듣는다.
    //   ⚠ 자발적인 행동이 우선이라는 규율은 `travelAfterZone`(v0.59.5)과 같은 방향이다.
    //   ⚠⚠ 들어오는 중에 끊으면 퇴장 커브가 **지금 값보다 큰 값에서** 시작해 한 번 튄다 —
    //     그래서 흐른 시각을 **퇴장 쪽으로 옮겨 심는다** (진행도가 같은 지점에서 이어 받는다).
    //   돌려주는 값 = 실제로 비켰는가 (부르는 쪽이 굳이 볼 일은 없다)
    dismiss() {
      if (!cue.brief || !cue.zone) return false;
      if (cue.phase === 'leaving') return false;
      if (cue.phase === 'entering') {
        // 들어온 만큼(0~1)을 퇴장의 **남은 만큼**으로 읽는다 — 덜 들어왔으면 덜 나간다
        const k = Math.min(1, cue.t / Math.max(1e-4, BRIEF_ENTER_DUR));
        cue.t = BRIEF_LEAVE_DUR * (1 - k);
      } else {
        cue.t = 0;
      }
      cue.phase = 'leaving'; cue.p = 0; cue.busy = true;
      cue.hold = 0; cue.holdT = 0;
      return true;
    },

    // ⚠ 트윈 없이 즉시 그 상태로 (검증·초기화용)
    snap(phase, zone = null) {
      cue.phase = phase; cue.t = 0; cue.p = phase === 'inspecting' ? 1 : 0; cue.busy = false;
      cue.hold = 0; cue.holdT = 0;   // ⚠ 값 잡으려고 고정한 상태가 저절로 풀리면 안 된다
      cue.brief = false;             // ⚠ 값 잡는 용도라 늘 **긴 연출**로 세운다 (짧은 것은 enter 로만 든다)
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
        const T = tlOf();
        const tl = ph === 'entering' ? T.enter : T.leave;
        const total = cue.brief
          ? (ph === 'entering' ? BRIEF_ENTER_DUR : BRIEF_LEAVE_DUR)
          : (ph === 'entering' ? ENTER_DUR : LEAVE_DUR);
        cue.p = Math.min(1, cue.t / total);
        for (const k of KEYS) {
          // ⚠⚠ 커브를 **amt 가 아니라 그 트랙의 꼭대기**에 곱한다. 짧은 연출은 `look`·`swing` 이
          //   표에 없어 꼭대기가 0 이고 윙은 `zoneBriefOpen` 배로 눌려 있다 — amt 로 곱하면
          //   퇴장(1 − v)에서 카메라가 1 로 튄다 (steadyOf 주석과 같은 이야기다)
          const top = T.enter[k] ? amt * briefK(k) : 0;
          const v = track(tl[k], cue.t);
          // 퇴장은 같은 커브를 꼭대기 → 0 으로 읽는다
          cue[k] = (ph === 'entering' ? v : 1 - v) * top;
        }
        if (cue.t >= total) {
          cue.phase = ph === 'entering' ? 'inspecting' : 'sailing';
          cue.busy = false; cue.t = 0; cue.p = 1;
          if (ph === 'entering') steadyOf(amt); else setAll(0);
          if (cue.phase === 'sailing') { cue.zone = null; cue.brief = false; }
        }
      } else {
        // 정지 상태. ⚠ amt 를 곱해 둬야 슬라이더를 내렸을 때 inspecting 도 같이 옅어진다
        if (ph === 'inspecting') steadyOf(amt); else setAll(0);
        cue.p = 1; cue.busy = false;
      }
      return cue;
    },

    // 콘솔 검증용 한 줄 (§8 의 판정 기준)
    report() {
      const f = (v) => v.toFixed(3);
      // 등장 순서대로 읽는다 (좌중 · 우중 · 좌뒤 · 우뒤 · 좌앞 · 우앞) — 화면에서 본 순서와 같은 줄이라야 검산이 된다
      return `${cue.phase}${cue.zone ? ' · ' + cue.zone : ''}${cue.brief ? ' (짧게)' : ''}  t=${f(cue.t)} p=${f(cue.p)}  ` +
             `look=${f(cue.look)} open=${OPEN_KEYS.map(k => f(cue[k])).join('/')} ` +
             `dim=${f(cue.dim)} rise=${f(cue.rise)} ui=${f(cue.ui)} ` +
             `swing=${f(cue.swing)}` +
             (cue.hold > 0 ? `  hold ${f(cue.holdT)}/${f(cue.hold)}${cue.holdPaused ? ' (멈춤)' : ''}` : '');
    },

    // 이 층은 GPU 자원이 없다. 규율상 둔다 (불변식 10)
    dispose() { setAll(0); cue.phase = 'sailing'; cue.zone = null; cue.busy = false; cue.brief = false; cue.hold = 0; cue.holdT = 0; cue.holdPaused = false; }
  };

  return api;
}

// 문서·검증에서 인용할 때 여기서 가져온다 (숫자를 손으로 옮겨 적지 않는다)
export const PHASE_DUR = { enter: ENTER_DUR, leave: LEAVE_DUR, briefEnter: BRIEF_ENTER_DUR, briefLeave: BRIEF_LEAVE_DUR };
