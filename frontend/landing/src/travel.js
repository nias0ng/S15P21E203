import { PARAMS as P } from './params.js';
import { EASE } from './phase.js';

// ───────── 먼 곳 이동 — 흰 안개 전환 (2026-09-11, v0.32.0) ─────────
// 사용자 : *"미니맵을 지금 디자인에 맞게 구현하고 1,2초 내에 그 영역에 도착하지 못하면 (…) 알맞은
//   트랜지션으로 그 영역 오브젝트 앞에 빠르게 움직일"* · *"흰 안개로"*.
//
// ⚠⚠ 배는 느리다 — 파도 위상속도에 묶여 있다 (불변식 0-1). 자동 조타 1.27 · 부스트 1.71 월드/초라
//   1~2초면 **배 한 척(5 월드)도 못 간다.** 그래서 화면 밖 목표면 사실상 언제나 전환이다. 순서 :
//     lead    뱃머리를 목표로 돌려 travelLead 초 달린다 — **방향을 보여 준다**. 그 안에 닿으면 그걸로 끝
//     fogIn   흰 안개가 덮는다
//     (꼭대기) 배를 목표 앞 travelStandoff 월드에 **뱃머리를 목표로** 세운다 — 순간이동
//     fogOut  안개가 걷힌다. standoff 가 도착 반경(travelArrive) 안이라 zones 가 곧바로 도착을 알리고,
//             존 연출이 **안개 속에서 시작해 안개가 걷히며 드러난다**
//
// ⭐ 순간이동이 안전한 이유 : 시뮬은 스크롤 차가 아니라 **속도**로 이류시킨다 (sim.js 의 acc).
//   위치를 한 번에 수백 월드 옮겨도 항적 텍스처가 밀리지 않는다 (v0.31.0 에 화면으로 확인).
// ⚠ 안개는 **DOM** 이다 (index.html 의 #fog) — 3D 위 · UI 아래. 셰이더 안개로 하면 배·부표는 안 덮인다
//   (그 둘은 물 셰이더의 원경 안개를 안 탄다).
// ⚠ 이 파일은 THREE 를 모른다. nav · zones · DOM 만 만진다 (phase.js 와 같은 규율).

export function createTravel({ nav, zones, pivotOf }) {
  const fog = document.getElementById('fog');
  const st = { mode: 'idle', t: 0, target: null };
  let lastQ = -1;

  // 안개 짙기 0..1. ⚠ 값이 실제로 달라질 때만 스타일을 쓴다 (0.5% 단위) — ui.js 와 같은 가드
  const setFog = (a) => {
    a = a < 0 ? 0 : a > 1 ? 1 : a;
    const q = Math.round(a * 200);
    if (q === lastQ || !fog) return;
    lastQ = q;
    fog.style.opacity = a.toFixed(3);
    fog.style.visibility = a > 0.002 ? 'visible' : 'hidden';
    // 뒤를 흐린다 — 안개 **속으로** 들어가는 느낌. ⚠ 전 화면 backdrop-filter 는 비싸다 — 전환 동안만 켜진다
    const blur = (a * (P.travelFogBlur === undefined ? 10 : P.travelFogBlur)).toFixed(1);
    fog.style.backdropFilter = a > 0.002 ? `blur(${blur}px)` : 'none';
    fog.style.webkitBackdropFilter = fog.style.backdropFilter;
  };
  // 배(월드) → 목표 거리. ⚠ scroll 은 배의 월드 위치를 (scroll.x, −scroll.z) 로 인코딩한다 (불변식 0-2)
  const distTo = (tg) => Math.hypot(tg.x - nav.scroll.x, tg.z + nav.scroll.z);

  function teleport() {
    const tg = st.target;
    if (!tg) return;
    // 지금 자리에서 목표를 향하는 방향. 그 반대쪽으로 standoff 만큼 물러난 자리에 선다 —
    //   **오던 방향 그대로** 목표 앞에 닿은 것처럼 보여야 한다 (옆에서 불쑥 나타나면 순간이동이 티난다)
    const bx = nav.scroll.x, bz = -nav.scroll.z;
    let ux = tg.x - bx, uz = tg.z - bz;
    const n = Math.hypot(ux, uz) || 1;
    ux /= n; uz /= n;
    const so = P.travelStandoff === undefined ? 8 : P.travelStandoff;
    const px = tg.x - ux * so, pz = tg.z - uz * so;
    nav.scroll.x = px; nav.scroll.z = -pz;
    // 뱃머리 (−sin h, −cos h) 를 (ux, uz) 에 맞춘다 → h = atan2(−ux, −uz)  (zones.bearing 과 같은 식)
    const h = Math.atan2(-ux, -uz);
    // ⚠⚠ head 는 **무한 누적**이다 (불변식 0-2-2). 새 각을 지금 head 에 가장 가까운 등가각으로 맞춘다 —
    //   안 그러면 boat.js 의 시각 요 보간이 몇 바퀴를 돈다 (안개가 걷힌 뒤에도 배가 팽이처럼 돈다)
    const k = Math.round((nav.head - h) / (2 * Math.PI));
    nav.head = h + k * 2 * Math.PI;
    nav.headV = 0;
    const pv = pivotOf && pivotOf();
    if (pv) pv.rotation.y = nav.head;   // 시각 요 보간을 기다리지 않는다 — 안개 속에서 이미 돌아 있어야 한다
  }

  const api = {
    get mode() { return st.mode; },
    get target() { return st.target; },
    // 안개가 덮여 있는 동안 — 이때는 새 명령(클릭·미니맵)을 받지 않는다
    get busy() { return st.mode === 'fogIn' || st.mode === 'fogOut'; },
    // 지금 안개 짙기 0..1 (0.5% 단위). ⚠ 부표 이름표는 DOM 에서 안개 **위**에 있다 — 이 값만큼 같이 옅어진다 (main.js)
    get fog() { return lastQ < 0 ? 0 : lastQ / 200; },

    // target = { key, name, x, z, custom: true } — 월드 좌표 (scentmap 과 같은 규약)
    start(target) {
      if (api.busy || !target) return false;
      st.target = target; st.mode = 'lead'; st.t = 0;
      zones.goTo(target);   // 방위각 조타 · 도착 판정은 zones 가 한다 (존과 같은 길)
      return true;
    },

    // 사람이 키로 조타를 가져가면 lead 만 놓는다. ⚠ 안개 중에는 놓지 않는다 — 반쯤 덮인 채 멈춘다
    cancel() { if (st.mode === 'lead') { st.mode = 'idle'; st.target = null; } },

    update(dt) {
      if (st.mode === 'idle') return;
      st.t += dt;
      if (st.mode === 'lead') {
        // 도착했거나(zones 가 목표를 놓았다) 사람이 조타를 뺏었다
        if (!zones.auto || zones.auto !== st.target) { st.mode = 'idle'; st.target = null; return; }
        const fogOn = (P.travelFog === undefined ? 1 : P.travelFog) >= 0.5;
        const lead = P.travelLead === undefined ? 1.2 : P.travelLead;
        const arrive = P.travelArrive === undefined ? 10 : P.travelArrive;
        if (fogOn && st.t >= lead && distTo(st.target) > arrive) { st.mode = 'fogIn'; st.t = 0; }
      } else if (st.mode === 'fogIn') {
        const d = Math.max(0.05, P.travelFogIn === undefined ? 0.6 : P.travelFogIn);
        setFog(EASE.inOutCubic(Math.min(1, st.t / d)));
        if (st.t >= d) { teleport(); st.mode = 'fogOut'; st.t = 0; }
      } else if (st.mode === 'fogOut') {
        const d = Math.max(0.05, P.travelFogOut === undefined ? 0.9 : P.travelFogOut);
        setFog(1 - EASE.inOutCubic(Math.min(1, st.t / d)));
        if (st.t >= d) { setFog(0); st.mode = 'idle'; st.target = null; }
      }
    },

    report() {
      return `${st.mode}${st.target ? ' → ' + st.target.name + ' (' + distTo(st.target).toFixed(1) + ' 월드)' : ''}  t=${st.t.toFixed(2)}`;
    },

    // DOM 만 만진다. ⚠ 안개를 걷어 둔다 — HMR 뒤에 흰 화면이 남으면 "바다가 날아갔다" 로 오진한다
    dispose() { lastQ = -1; setFog(0); st.mode = 'idle'; st.target = null; }
  };
  return api;
}
