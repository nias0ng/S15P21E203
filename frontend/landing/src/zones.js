import { CONFIG } from './config.js';
import { PARAMS as P } from './params.js';
import { findArea } from './areas.js';

// ───────── 향 영역 ─────────
// ⚠⚠ **화면에 아무것도 그리지 않는다** (2026-09-03, 사용자 지시 : "지금 향 영역이
// 표현되고있는걸 삭제하고"). 지워진 것은 세 층이다 :
//   · 점 구름 (Points 48개)        — v0.9.3
//   · 수면의 수채 얼룩 (uAreaPos)  — v0.9.4
//   · DOM 라벨 4개                 — v0.9.4
// 향조는 이제 **장소가 아니라 부표의 색**이다 (config.markThemes → marks.js).
//
// 남은 것은 **자동 조타 목표**뿐이다 — 검색바("프레시"를 치면 그쪽으로 뱃머리를 돌린다)와
// 향수 카드의 '이 향의 해역으로' 가 이 좌표를 쓴다.
// ⚠ 그래서 지금은 **보이지 않는 곳으로 향한다.** 유한 좌표계로 옮기면서(작업계획 [4단계])
// 그 자리에 무엇을 그릴지 다시 정해야 한다.
// ⭐ 2026-09-11 : 향 지도(`markMap 1`, scentmap.js)가 켜지면 목표가 **그 존의 대표 향수 자리**가 된다 —
//   이제 도착하면 부표들이 보인다. 예전 토러스 좌표(areas[].x/z)는 `markMap 0` 에서만 쓴다.

// targetOf(area) : 향 지도(유한 좌표)가 켜져 있으면 그 존의 대표 향수 자리 {x, z} 를 돌려준다
//   (marks.anchorOf). null 이면 예전처럼 areas[].x/z 를 **토러스로 감아서** 쓴다.
export function createZones({ onArrive, targetOf } = {}) {
  const A = CONFIG.area;
  // 자동 조타를 건 뒤 배가 목표를 **한 번이라도 앞에 뒀는가**.
  // ⚠ 이게 없으면 '지나쳐 버렸다' 판정이 자동 조타를 건 **그 프레임에** 참이 된다 —
  // 지금 바다는 토러스(wrapZ 100)라 z 가 −50 보다 먼 영역은 배 **뒤**에 나타나기 때문이다.
  // 실측 : FRESH(z −56) 는 감기면 +44.2 에 서고 앞방향 투영이 −44.3 이라 한 프레임에 풀렸다.
  // 네 계열 중 FRESH·AMBER 둘이 검색창에서도 이 증상이었다.
  let aimed = false;

  // 목표까지의 **씬 좌표 차** (배 → 목표). 지도면 감지 않고, 예전 토러스면 감는다
  const aimOf = (a, scroll) => {
    const t = targetOf ? targetOf(a) : null;
    if (t) return { ax: t.x - scroll.x, az: t.z + scroll.z, flat: true };
    const WZ = A.wrapZ;
    const wrapP = (v) => (((v + WZ / 2) % WZ) + WZ) % WZ - WZ / 2;
    return { ax: wrapP(a.x - scroll.x), az: wrapP(a.z + scroll.z), flat: false };
  };

  const api = {
    // 자동 조타 목표. 존 표의 원소(areas.js) 이거나, 미니맵이 찍은 **임의의 자리**
    //   { key, name, x, z, custom: true } 다 (travel.js · v0.32.0). custom 이면 x·z 를 그대로 간다
    auto: null,

    // 검색어 → 해당 향 영역으로 자동 조타. ⚠ 존 표는 areas.js 에서 받는다 (향수 지도면 향조 아홉)
    search(raw) {
      api.auto = findArea(raw);
      aimed = false;
      return api.auto;
    },

    // 임의의 목표로 건다 (travel.js). 도착 판정·방위각 조타는 존과 똑같이 탄다
    goTo(target) { api.auto = target || null; aimed = false; return api.auto; },

    clearAuto() { api.auto = null; aimed = false; },

    // ⭐ 향 지도에서는 목표의 **방위각**을 준다 (main.js 의 자동 조타가 쓴다). 예전 토러스면 null.
    // ⚠⚠ 예전 조타는 `(scroll.x − auto.x) × 0.05` 를 ±0.8 로 묶었다 — **목표가 늘 앞(북쪽)에 있다**고
    //   가정한 식이다. 토러스에서는 계속 북쪽으로 가면 z 가 감겨 언젠가 닿으니 맞았지만,
    //   유한 지도에서는 **배 뒤에 있는 목표에 영원히 못 간다.** 그래서 지도에서는 방위각으로 돈다.
    // ⚠ 부호 : 뱃머리의 월드 방향이 (−sin h, −cos h) 이므로(불변식 0-2) 목표 방향 (ax, az) 와 맞추면
    //   h = atan2(−ax, −az). 예전 식과 **작은 각에서 부호가 같다** (앞쪽 +x 목표 → 음의 head).
    bearing(scroll) {
      if (!api.auto) return null;
      const { ax, az, flat } = aimOf(api.auto, scroll);
      return flat ? Math.atan2(-ax, -az) : null;
    },

    update({ head, scroll }) {
      if (!api.auto) return;
      const a = api.auto;
      const { ax, az, flat } = aimOf(a, scroll);
      const fwd = ax * -Math.sin(head) + az * -Math.cos(head);
      // 도착했거나 지나쳐 버렸으면 자동 조타를 놓는다.
      // ⚠ '지나쳤다' 는 **한 번 향한 뒤에만** 뜻이 있다 (위 aimed 주석)
      if (fwd > 0) aimed = true;
      // ⚠ 도착 반경은 travel.js 와 **같은 값**이라야 한다 — 전환이 배를 이 반경 안(standoff)에 세우고,
      //   여기서 도착을 알려야 존 연출이 시작된다. 둘이 갈라지면 안개가 걷혀도 연출이 안 온다
      // ⭐ 목표가 제 도착 반경(`arrive`)을 가지면 그것을 쓴다 (2026-09-13) — Shift 바다 누르기(main.js `seaGo`)는 안개 전환이 아니라
      //   standoff 와 맞출 일이 없고, 10 월드면 누른 자리 두 척 앞에서 선다
      const R = a.arrive !== undefined ? a.arrive : (P.travelArrive === undefined ? 10 : P.travelArrive);
      const near = Math.hypot(ax, az) < R;
      // ⚠ 지도에서는 '지나쳤다' 가 없다 — 방위각으로 돌므로 지나쳐도 다시 돌아온다.
      //   토러스에서 뒤에 나타난 목표를 놓던 규칙이라, 지도에서 켜 두면 선회 중에 조타가 풀린다
      const passed = !flat && aimed && fwd < -6;
      // ⚠⚠ **도착과 지나침을 구분한다** (2026-09-10). 예전에는 둘 다 조용히 놓았는데,
      //   [7단계] 진입점이 *"도착했을 때"* 를 필요로 한다 (§9-9 : 자동 조타 도착과 **같은
      //   phase 로 묶으면** 연출을 두 번 안 만든다). 지나쳐 버린 것은 도착이 아니다.
      if (near || passed) {
        const target = api.auto;
        api.auto = null;
        aimed = false;
        if (near && onArrive) onArrive(target);
      }
    },

    // 씬에 아무것도 넣지 않으므로 버릴 GPU 자원이 없다.
    // ⚠ 여기에 메시를 다시 넣게 되면 이 함수부터 채운다 (불변식 10)
    dispose() {}
  };

  return api;
}
