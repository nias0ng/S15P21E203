import { PARAMS as P } from './params.js';
import { CONFIG } from './config.js';
import { swellMeanDir } from './swell.js';
import { areasNow } from './areas.js';

// ───────── 좌상단 조작 바 (개발 전용) ─────────
// 계측 HUD(perf.js) 바로 밑에 붙는다. 자주 쓰는 세 가지를 우측 패널까지 안 가고 누른다 :
//   ① 검증 보기(debugView) · ② 카메라(항공·자유) · ③ 프레임 게이트
//
// ⚠⚠ **왜 perf.js 에 안 넣는가.** 그 파일의 규칙이 *"여기서 재는 값은 전부 '읽기'다.
//   씬 상태를 바꾸는 코드를 이 파일에 넣지 않는다"* 이다. 계측기가 계측 대상을 건드리면
//   그 측정을 못 믿는다. 그래서 같은 자리에 **다른 모듈**로 붙인다.
//
// ⚠ 우측 tweaks 패널과 **같은 값을 만진다.** 누를 때마다 tweaks.sync() 를 불러 슬라이더를
//   맞춘다 — 안 부르면 두 UI 가 서로 다른 숫자를 보여 주고, 그때부터 판정이 거짓말을 한다.
//
// ⚠ 계측 HUD 는 pointer-events:none 이라 이 바를 안 가린다. 위치만 겹치지 않게 둔다.

// debugView 의 번호와 이름. ⚠ params.js 의 주석 · water.js 의 uDebug 분기와 **같이** 고친다 —
// 셋이 갈라지면 "3번이 뭐였더라" 를 코드에서 다시 찾아야 한다 (이번에 실제로 그랬다)
const VIEWS = [
  [0, '끄기'], [1, '노멀'], [2, '높이'], [3, '거품'], [4, '앞뒤'], [5, '항적'],
  [6, '마루색'], [7, '구역'], [8, '외곽'], [9, '게이트'], [10, '포락선'], [11, '잔결'], [12, '비용'],
  [13, '선체거품'], [14, '겹침'], [15, '무리']
];

// ⚠ 게이트 프리셋. **기본은 12/8 이고 그게 의도된 질감이다** (CLAUDE.md :
//   "프레임 게이트를 없애고 60fps 로 바꾸지 않는다"). 여기 60 은 **비교용 스위치**이지
//   새 기본값이 아니다 — 끄면 정확히 12/8 로 돌아온다.
// ⚠⚠ 60 은 공짜가 아니다 : boatFps 가 곧 `sim.sampler()`(동기 GPU 리드백) 호출 빈도다.
//   8 → 60 이면 리드백이 7.5배가 되고, 그 스톨이 프레임 상한을 잡는다.
//   simFps 60 은 시뮬 스텝을 5배로 돌린다. **FPS 가 올라가는 스위치가 아니라 내려가는
//   스위치일 수 있다** — 누른 뒤 HUD 의 GPU·rAF 를 같이 본다.
const GATES = [
  ['질감 12/8', 12, 8],   // 기본 (컷아웃)
  ['30/30', 30, 30],
  ['60/60', 60, 60]
];

export function createViewbar(stage, { tweaks, apply, freecam, phase }) {
  const box = document.createElement('div');
  box.style.cssText =
    // ⚠ 호스트 헤더(hostTop — 앱의 유리판 헤더 90px)가 무대 위를 가리므로 그만큼 내린다 (2026-09-16, D). 단독 실행이면 0 이라 예전 자리다
    'position:absolute;top:calc(var(--pb-host-top,0px) + 150px);left:12px;z-index:51;padding:6px 8px;' +
    'background:rgba(248,247,243,0.86);border:1px solid rgba(26,26,26,0.18);border-radius:4px;' +
    'font:11px/1.5 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;color:#1A1A1A;' +
    'display:flex;flex-direction:column;gap:4px;max-width:322px';

  // ── 머리 : 제목(누르면 접힌다). ⚠ campanel·compare 와 **같은 규약**이다 — 좌측 패널 셋이
  //   서로 다른 방식으로 접히면 어느 것이 접히는지 매번 눌러 봐야 한다.
  const head = document.createElement('div');
  head.style.cssText = 'display:flex;align-items:center;gap:6px';
  const title = document.createElement('button');
  title.style.cssText = 'flex:1;text-align:left;font:inherit;font-weight:600;cursor:pointer;' +
    'background:none;border:0;padding:0;color:inherit';
  title.title = '눌러서 접었다 편다';
  head.appendChild(title);

  // ── 몸통 (접기 대상 · 스크롤 대상)
  // ⚠⚠ **overflow 를 box 가 아니라 여기에 준다.** box 에 주면 머리까지 같이 스크롤돼서
  //   접는 버튼이 위로 사라진다.
  // ⚠ display 를 cssText 에 넣지 않는다 — 접었다 펼 때 지우면 되도록 (campanel 과 같은 이유)
  const body = document.createElement('div');
  body.style.cssText = 'flex-direction:column;gap:4px;' +
    'max-height:calc(100vh - 210px);overflow-y:auto;overflow-x:hidden;overscroll-behavior:contain';
  body.style.display = 'flex';
  box.append(head, body);

  const rows = [];   // { sync() }

  const mkRow = (label) => {
    const r = document.createElement('div');
    r.style.cssText = 'display:flex;align-items:center;gap:3px;flex-wrap:wrap';
    const t = document.createElement('span');
    t.textContent = label;
    t.style.cssText = 'width:34px;flex:none;opacity:.62';
    r.appendChild(t);
    body.appendChild(r);
    return r;
  };

  // 눌린 상태를 색으로 보여 주는 작은 버튼
  const mkBtn = (row, label, isOn, onClick, title) => {
    const b = document.createElement('button');
    b.textContent = label;
    if (title) b.title = title;
    b.style.cssText = 'font:inherit;cursor:pointer;border-radius:3px;padding:1px 5px;' +
      'border:1px solid rgba(26,26,26,0.20);background:#fff;color:inherit';
    const paint = () => {
      const on = isOn();
      b.style.background = on ? '#1A1A1A' : '#fff';
      b.style.color = on ? '#F6F5F2' : '#1A1A1A';
      b.style.borderColor = on ? '#1A1A1A' : 'rgba(26,26,26,0.20)';
    };
    b.addEventListener('click', () => {
      onClick();
      // ⚠ 우측 패널의 슬라이더까지 맞춘다. 안 맞추면 두 UI 가 다른 값을 보여 준다
      rows.forEach(r => r.sync());
      if (tweaks) tweaks.sync();
    });
    // ⚠ 방향키가 배를 돌리지 않게 가둔다 (tweaks.js 가 같은 이유로 하는 것)
    b.addEventListener('keydown', e => e.stopPropagation());
    row.appendChild(b);
    rows.push({ sync: paint });
    paint();
    return b;
  };

  // ── 검증 보기
  const rV = mkRow('검증');
  for (const [n, name] of VIEWS) {
    mkBtn(rV, n === 0 ? '끄기' : String(n) + ' ' + name,
      () => P.debugView === n, () => { P.debugView = n; },
      'PB.params.debugView = ' + n);
  }

  // ── 카메라. ⚠ 항공(topView)은 직교라 방향을 재고, 자유(freeView)는 높이를 본다.
  //   CLAUDE.md : 기본 카메라는 수면을 스치듯 봐서 **방향도 높이도 판정할 수 없다.**
  const rC = mkRow('카메라');
  mkBtn(rC, '기본', () => !P.topView && !P.freeView,
    () => { P.topView = false; P.freeView = false; });
  mkBtn(rC, '항공', () => P.topView && !P.freeView,
    () => { P.freeView = false; P.topView = true; }, '직교 부감. 방향을 잴 때는 반드시 이걸로 본다');
  mkBtn(rC, '자유', () => P.freeView,
    () => { P.topView = false; P.freeView = true; }, '드래그 궤도 · 휠 줌 (조타는 선다)');
  // ⚠⚠ **앞면(선단) 쪽에서 보는 시점.** 사용자 : *"지금 기본 시점에서는 파도가 뒷면 밖에
  //   보이지 않으니 파도거품이 모이는 앞면 쪽에서 확인하는 게 좋을 듯"*.
  //   너울은 −z 로 나아가므로 **앞면은 카메라 반대편**이다 — 기본 yaw −26° 에서는 뒷면만 보인다.
  //   앞면을 보려면 카메라가 진행 방향(+d) 쪽에 서야 한다 :
  //     cam ∝ (cos p·sin yaw, ·, cos p·cos yaw) 이므로 (sin yaw, cos yaw) ∝ d
  //     → yaw = atan2(d.x, d.z) = **135.8°** (지금 BANDS 에서)
  // ⚠ 숫자를 적지 않는다 — BANDS 를 돌리면 같이 따라와야 한다 (불변식 2)
  const FRONT_YAW = Math.atan2(swellMeanDir()[0], swellMeanDir()[1]) * 180 / Math.PI;
  mkBtn(rC, '앞면', () => Math.abs(P.camYaw - FRONT_YAW) < 0.6,
    () => { P.topView = false; P.freeView = false; P.camYaw = +FRONT_YAW.toFixed(1); },
    '거품이 모이는 선단 쪽에서 본다 (yaw ' + FRONT_YAW.toFixed(1) + '도). 다시 기본으로는 아래 뒷면');
  mkBtn(rC, '뒷면', () => Math.abs(P.camYaw + 26) < 0.6,
    () => { P.topView = false; P.freeView = false; P.camYaw = -26; }, '기본 구도 (yaw −26도)');
  mkBtn(rC, '프로브', () => P.showProbes,
    () => { P.showProbes = !P.showProbes; }, '배가 읽었다고 믿는 수면 높이');
  // ⭐ 프레임 잡기 (2026-09-12 저녁) — 움찔거림은 프레임 **사이**라 실시간으로는 못 본다.
  //   ⚠ **토글**이다 : 한 번 누르면 계속 잡고(링버퍼), 다시 누르면 **직전 90장**을 연다.
  //     부스트(Shift)를 누르고 있는 손으로 버튼을 못 누르므로 **G 키**도 같은 일을 한다
  mkBtn(rC, '프레임 잡기', () => !!(window.PB && window.PB.grab && window.PB.grab.armed),
    () => { const g = window.PB && window.PB.grab; if (!g) return; if (g.armed) g.stop(); else g.arm(); },
    '누르면 계속 잡는다 → 움찔을 본 뒤 다시 누르면 직전 90장을 연다 (G 키도 같다). ' +
    '뷰어 : ← → 한 장씩 · Shift 로 열 장씩 · D 차이 보기 · Space 느린 재생 · ESC');

  // ⚠⚠ **자유 시점에서 찾은 구도를 기본 카메라 값으로 옮긴다** (2026-09-07, 사용자 :
  //   *"자유 시점에서 움직일때 현재 값을 기본으로 쓰고 싶다"*).
  //   자유 시점(freecam)과 본 카메라는 **둘 다 look 점을 도는 궤도**라 각을 그대로 옮길 수 있다.
  //   거리만 단위가 다르다 — 본 카메라의 camDist 는 월드 거리가 아니라 **배율**이고,
  //   1.0 일 때의 거리가 hypot(zNear − look.z, yNear − look.y) 다 (정지 기준).
  //   ⚠ 속도가 붙으면 카메라가 뒤로 물러나므로(camY·camZ 가 lerp 된다) **배를 세우고** 누른다.
  //   ⚠ freecam 의 target 을 Shift 드래그로 옮겼다면 그 평행이동은 못 옮긴다 — 본 카메라는
  //     언제나 CONFIG.cam.look 을 본다. 궤도만 맞고 중심은 안 맞는다.
  //   누르면 자유 시점이 꺼지고 그 구도가 본 카메라로 재현된다. 값을 파일에 남기려면
  //   그다음 우측 패널의 [복사] 를 누른다 (바뀐 값만 params.js 형태로 나온다).
  const BASE_DIST = Math.hypot(CONFIG.cam.zNear - CONFIG.cam.look[2],
                               CONFIG.cam.yNear - CONFIG.cam.look[1]);
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  mkBtn(rC, '이 자리로', () => false,
    () => {
      if (!freecam || !P.freeView) return;      // 자유 시점일 때만 뜻이 있다
      const s = freecam.dump();
      P.camYaw   = +clamp(s.yaw   * 180 / Math.PI, -90, 90).toFixed(1);
      P.camPitch = +clamp(s.pitch * 180 / Math.PI, 4, 70).toFixed(1);
      P.camDist  = +clamp(s.dist / BASE_DIST, 0.6, 5).toFixed(2);
      P.freeView = false; P.topView = false;
    },
    '자유 시점의 지금 구도를 기본 카메라(camYaw·camPitch·camDist)로 옮긴다. ' +
    '⚠ 배를 세우고 누른다 — 속도가 붙으면 거리가 달라진다. 그 뒤 우측 [복사] 로 값을 얻는다');

  // ── 부표. ⚠ 반사를 검증하려면 **껐다 켰다**와 **규칙적인 배치**가 둘 다 필요하다.
  //   흩뿌리기로는 상이 어긋나 있어도 그게 어긋난 건지 원래 그런 건지 알 수 없다.
  const rM = mkRow('부표');
  mkBtn(rM, '켜기', () => P.showMarks,
    () => { P.showMarks = !P.showMarks; }, '부표를 통째로 껐다 켠다 (배치는 유지된다)');
  mkBtn(rM, '시험대', () => P.markLayout >= 0.5,
    () => { P.markLayout = P.markLayout >= 0.5 ? 0 : 1; },
    '열=좌우 · 행=원근 · 높이=선형 램프. 반사가 사다리로 읽힌다. 다시 누르면 흩뿌리기');
  mkBtn(rM, '반사', () => P.markReflect > 0,
    () => { P.markReflect = P.markReflect > 0 ? 0 : 0.9; },
    '부표의 해석적 반사 (픽셀마다 구 6개 교차)');

  // ── 부하 프리셋
  // ⚠⚠ **2026-09-06 : 사용자가 "GPU 사용량이 엄청 증가했다, 그래픽카드 소리가 장난이 아님".**
  //   이번 세션에 프래그먼트당 해시가 **4 → 38 (9.5배)** 로 늘었고, 그 코드가 도는 **면적**도
  //   camDist 1.4 → 3.24 로 **5.4배**가 됐다. 곱하면 수면 셰이더 일이 수십 배다.
  //   ⚠ 무엇이 얼마인지는 **보이는 창의 HUD 로만** 잴 수 있다 — 숨겨진 패널에서는 수면
  //     셰이더를 통째로 꺼도 GPU 시간이 안 변한다(1.81ms 고정). 그 숫자는 못 믿는다.
  //   그래서 값을 임의로 되돌리지 않고 **끄는 스위치**를 준다. 눌러 보고 HUD 를 본다.
  const HEAVY = {
    // [이름, 되돌릴 값들, 무엇을 아끼는가]
    거품: [{ foamWhite: 0 }, 'worley 두 겹 = 픽셀당 해시 22회 (굵은 13 + 잔 9)'],
    // ⚠ 이 층은 foamWhite 게이트 **밖**이라 '거품' 스위치로는 안 꺼진다. 따로 둔다
    선체거품: [{ hullFoam: 0 }, '선체 접촉 띠. 배 근처에서만 해시 13회 — 먼 픽셀은 공짜'],
    반짝임거품: [{ sparkAmount: 0 }, '값 노이즈 2회 = 해시 8회'],
    잔결: [{ microA: 0, microB: 0 }, '코사인 5 + 워프 해시 4회'],
    부표반사: [{ markReflect: 0 }, '픽셀마다 구 6개 루프'],
    배반사: [{ boatReflect: 0 }, '⚠ 씬을 한 번 더 그린다 (별도 렌더 패스)'],
    잠긴선체: [{ subAmount: 0 }, '⚠ 씬을 한 번 더 그린다'],
    원경: [{ camDist: 1.6 }, 'camDist 3.24 → 1.6 : LOD 면적 1/4. **구도가 바뀐다**']
  };
  const rL = mkRow('끄기');
  const heavyBak = {};
  for (const name in HEAVY) {
    const [set, why] = HEAVY[name];
    mkBtn(rL, name,
      () => Object.keys(set).every(k => P[k] === set[k]),
      () => {
        const on = Object.keys(set).every(k => P[k] === set[k]);
        if (on) { for (const k in set) if (k in heavyBak) P[k] = heavyBak[k]; }
        else    { for (const k in set) { heavyBak[k] = P[k]; P[k] = set[k]; } }
        if (apply) apply();
      }, why);
  }
  // ⚠ 한 번에 전부. 다시 누르면 원래대로 — 끈 값은 heavyBak 에 남는다
  mkBtn(rL, '전부',
    () => Object.values(HEAVY).every(([set]) => Object.keys(set).every(k => P[k] === set[k])),
    () => {
      const allOff = Object.values(HEAVY).every(([set]) => Object.keys(set).every(k => P[k] === set[k]));
      for (const name in HEAVY) {
        const [set] = HEAVY[name];
        if (allOff) { for (const k in set) if (k in heavyBak) P[k] = heavyBak[k]; }
        else { for (const k in set) { if (!(k in heavyBak)) heavyBak[k] = P[k]; P[k] = set[k]; } }
      }
      if (apply) apply();
    }, '무거운 층을 한 번에 껐다 켰다 한다 — 어느 것이 범인인지 좁힐 때');

  // ── 프레임 게이트
  const rF = mkRow('프레임');
  for (const [name, sf, bf] of GATES) {
    mkBtn(rF, name, () => P.simFps === sf && P.boatFps === bf,
      () => { P.simFps = sf; P.boatFps = bf; },
      '물 ' + sf + 'fps · 배 ' + bf + 'fps' +
      (bf > 8 ? ' — ⚠ boatFps 가 곧 동기 GPU 리드백 빈도다. HUD 의 GPU·rAF 를 같이 본다' : ''));
  }

  // ── 연출 ([4]~[7]단계, 2026-09-10)
  // ⚠⚠ **자동 조타 도착을 기다리지 않고 즉시 건다.** 진짜 문은 카드의 [이 향의 해역으로] →
  //   항해 → 도착이지만(v0.23.0), 시안을 볼 때마다 배를 몰고 갈 수는 없다.
  //   사용자 (2026-09-10) : *"일단 빠르게 시안 확인하기 위해서 즉시 애니메이션을 보고 싶은데"*.
  // ⚠ 그래서 이 행은 **개발 전용 지름길**이다. 진입점을 여기로 바꾼 것이 아니다.
  const rP = mkRow('연출');
  // ⚠ 존 표는 areas.js 에서 받는다 — 향수 지도(markMap 1)면 향조 아홉이다 (v0.32.0).
  //   ⚠ 행은 **붙일 때 한 번** 만든다 — 실행 중에 markMap 을 바꾸면 이 행은 옛 표 그대로다 (개발 전용이라 둔다)
  for (const a of areasNow()) {
    mkBtn(rP, a.name,
      () => !!phase && phase.cue.zone === a.key && phase.cue.phase !== 'sailing',
      () => phase && phase.enter(a.key),
      a.name + ' 존으로 들어간다 (1.20s) — 좌 → 우 0.14s 시차로 암석이 닫히고 타이포가 솟는다');
  }
  mkBtn(rP, '나가기', () => false, () => phase && phase.leave(),
    '존에서 나온다 (1.30s). ESC 와 같다. ⚠ 역순이 아니다 — 타이포가 먼저 가라앉고 좌우가 같이 열린다');
  mkBtn(rP, '느리게', () => P.phaseSpeed < 1,
    () => { P.phaseSpeed = P.phaseSpeed < 1 ? 1 : 0.25; },
    '전환을 4배 느리게 (phaseSpeed 0.25) — 값이 흐르는 것을 눈으로 따라갈 수 있다');

  // ── 접기. ⚠ 접히는 것은 **몸통뿐**이고 머리는 남는다 — 다시 펼 자리가 있어야 한다
  let folded = false;
  const paintTitle = () => { title.textContent = (folded ? '▸' : '▾') + ' 개발 바'; };
  const setFold = (on) => {
    folded = !!on;
    body.style.display = folded ? 'none' : 'flex';
    paintTitle();
  };
  title.addEventListener('click', () => setFold(!folded));
  // ⚠ 이 패널 위에서 친 키가 씬의 단축키로 새지 않게 한다 (campanel 과 같은 처리)
  title.addEventListener('keydown', e => e.stopPropagation());
  paintTitle();

  return {
    el: box,
    // 좌하단 dock 이 이 패널 **아래**에 천장을 맞춘다 (main.js 의 syncDock). 접으면 dock 이 커진다
    fold: setFold,
    get folded() { return folded; },
    mount() { stage.appendChild(box); },
    // 콘솔이나 우측 패널에서 값을 바꿨을 때 버튼 색을 맞춘다
    sync() { rows.forEach(r => r.sync()); },
    dispose() { box.remove(); }
  };
}
