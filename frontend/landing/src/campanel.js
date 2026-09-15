import { PARAMS as P, PARAM_RANGES as RANGES } from './params.js';
import { CONFIG } from './config.js';
import { horizonNDC, pitchForHorizon, clamp, D2R } from './util.js';

// ───────── 시점 패널 (개발 전용) ─────────
// 좌하단. **수평선이 화면 어디에 있는지를 실시간으로 보여 주는 것**이 이 패널의 존재 이유다.
//
// ⚠⚠ 왜 `viewbar.js` 에 안 넣는가. 그쪽은 **검증 보기·부하 스위치·프레임 게이트**를 모아 둔
//   곳이라 카메라 줄이 그 사이에 끼어 있었다. 2026-09-09 부터 수평선이 구도의 핵심 변수가
//   됐는데(`docs/무대와-존-연출.md` §12), 그걸 세 줄 아래 버튼 하나로 두면 매번 찾게 된다.
//   ⚠ viewbar 의 카메라 줄은 **그대로 남겼다** — 항공/자유/앞면/뒷면은 성격이 다른 스위치이고,
//     '이 자리로' 는 freecam 과 짝이라 거기 있어야 한다. 여기는 **각과 거리만** 만진다.
//
// ⚠ `tweaks` 패널과 **같은 값을 만진다.** 슬라이더를 움직일 때마다 `tweaks.sync()` 와
//   `viewbar.sync()` 를 부른다 — 안 부르면 세 UI 가 서로 다른 숫자를 보여 주고,
//   그때부터 판정이 거짓말을 한다 (viewbar.js 가 같은 이유로 하는 것).
//
// ⚠⚠ **[화면만] 이 이 패널의 두 번째 이유다.** 측정·스크린샷을 할 때 개발 UI 넷이 화면의
//   절반을 덮는다. 예전에는 콘솔에서 `querySelectorAll` 로 하나씩 숨겼는데, 그러면
//   **되돌릴 때 원래 display 값을 잃는다** (tweaks 는 flex 다). 여기서 기억했다가 돌려준다.

// 수평선을 화면 세로 몇 % 에 둘 것인가. ⚠ 정지 화각(fovNear) 기준이다 —
// fov 가 속도에 따라 43↔54 로 변하므로 달리면 수평선이 내려온다 (§12-3).
const PRESETS = [0.10, 0.15, 0.20, 0.25];

export function createCampanel(stage, { tweaks, viewbar, perf, apply } = {}) {
  const box = document.createElement('div');
  box.style.cssText =
    'width:238px;padding:6px 8px;' +   // ⚠ 자리는 main.js 의 dock 이 정한다 (compare 와 세로로 쌓인다)

    'background:rgba(248,247,243,0.90);border:1px solid rgba(26,26,26,0.18);border-radius:4px;' +
    'font:11px/1.5 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;color:#1A1A1A;' +
    'display:flex;flex-direction:column;gap:5px;font-variant-numeric:tabular-nums';

  // ── 머리 : 제목(클릭하면 접힌다) + [화면만]
  const head = document.createElement('div');
  head.style.cssText = 'display:flex;align-items:center;gap:6px';
  const title = document.createElement('button');
  title.style.cssText = 'flex:1;text-align:left;font:inherit;font-weight:600;cursor:pointer;' +
    'background:none;border:0;padding:0;color:inherit';
  title.title = '눌러서 접었다 편다';
  const soloBtn = document.createElement('button');
  soloBtn.textContent = '화면만';
  soloBtn.title = '개발 UI 를 전부 숨긴다 (계측 HUD · 조작 바 · 파라미터 · 이 패널). ' +
    '다시 켜려면 H 키 또는 콘솔에서 PB.solo(false)';
  soloBtn.style.cssText = 'font:inherit;cursor:pointer;background:#fff;color:inherit;' +
    'border:1px solid rgba(26,26,26,0.20);border-radius:3px;padding:1px 6px';
  head.append(title, soloBtn);

  // ── 몸통 (접기 대상). ⚠ display 를 cssText 에 넣지 않는다 — 접었다 펼 때 지우면 되도록
  const body = document.createElement('div');
  body.style.cssText = 'flex-direction:column;gap:5px';
  body.style.display = 'flex';

  // ── 수평선 게이지. 화면을 세로 막대 하나로 줄여 놓고 두 선을 긋는다
  const gaugeWrap = document.createElement('div');
  gaugeWrap.style.cssText = 'display:flex;gap:8px;align-items:stretch';
  const gauge = document.createElement('div');
  gauge.style.cssText = 'position:relative;width:52px;flex:none;height:74px;border-radius:2px;' +
    'border:1px solid rgba(26,26,26,0.22);overflow:hidden;background:#FBFAF7';
  const skyFill = document.createElement('div');     // 하늘
  skyFill.style.cssText = 'position:absolute;left:0;right:0;top:0;background:rgba(120,150,180,0.14)';
  const bandFill = document.createElement('div');    // 원경 띠
  bandFill.style.cssText = 'position:absolute;left:0;right:0;background:rgba(150,160,150,0.20)';
  const seaFill = document.createElement('div');     // 바다
  seaFill.style.cssText = 'position:absolute;left:0;right:0;bottom:0;background:rgba(90,120,150,0.30)';
  const hLine = document.createElement('div');       // 수평선
  hLine.style.cssText = 'position:absolute;left:0;right:0;height:1px;background:#1A1A1A';
  const wLine = document.createElement('div');       // 물끝
  wLine.style.cssText = 'position:absolute;left:0;right:0;height:0;' +
    'border-top:1px dashed rgba(26,26,26,0.55)';
  gauge.append(skyFill, bandFill, seaFill, hLine, wLine);

  const readout = document.createElement('div');
  readout.style.cssText = 'flex:1;white-space:pre;line-height:1.55;opacity:.9';
  gaugeWrap.append(gauge, readout);

  // ── 프리셋 : 수평선을 화면 N% 로
  const rowPreset = document.createElement('div');
  rowPreset.style.cssText = 'display:flex;align-items:center;gap:3px;flex-wrap:wrap';
  const pLabel = document.createElement('span');
  pLabel.textContent = '수평선';
  pLabel.style.cssText = 'width:34px;flex:none;opacity:.62';
  rowPreset.appendChild(pLabel);

  const sliders = [];   // { key, sync() }

  const mkBtn = (row, label, isOn, onClick, hint) => {
    const b = document.createElement('button');
    b.textContent = label;
    if (hint) b.title = hint;
    b.style.cssText = 'font:inherit;cursor:pointer;border-radius:3px;padding:1px 5px;' +
      'border:1px solid rgba(26,26,26,0.20);background:#fff;color:inherit';
    const paint = () => {
      const on = isOn();
      b.style.background = on ? '#1A1A1A' : '#fff';
      b.style.color = on ? '#F6F5F2' : '#1A1A1A';
      b.style.borderColor = on ? '#1A1A1A' : 'rgba(26,26,26,0.20)';
    };
    b.addEventListener('click', () => { onClick(); syncAll(); });
    b.addEventListener('keydown', e => e.stopPropagation());   // 방향키가 조타로 새지 않게
    row.appendChild(b);
    sliders.push({ sync: paint });
    paint();
    return b;
  };

  // 정지 화각 기준으로 pitch 를 역산한다 (§12-3 : 달리면 fov 가 커져 수평선이 내려온다)
  const FOV0 = CONFIG.cam.fovNear;
  for (const frac of PRESETS) {
    const want = +pitchForHorizon(frac, FOV0).toFixed(1);
    mkBtn(rowPreset, (frac * 100).toFixed(0) + '%',
      () => Math.abs(P.camPitch - want) < 0.05,
      () => { P.camPitch = want; },
      '수평선을 화면 세로 ' + (frac * 100).toFixed(0) + '% 에 둔다 → camPitch ' + want + '° (정지 화각 기준)');
  }
  mkBtn(rowPreset, '밖', () => horizonNDC(P.camPitch, FOV0) > 1,
    () => { P.camPitch = 23.1; },
    '2026-09-09 이전 구도 (camPitch 23.1°). 수평선이 화면 위로 4.1% 벗어난다');

  // ── 슬라이더 세 줄
  const mkSlider = (key, label, hint) => {
    const [lo, hi, step] = RANGES[key] || [0, 1, 0.01];
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;gap:5px';
    const t = document.createElement('span');
    t.textContent = label;
    t.style.cssText = 'width:34px;flex:none;opacity:.62';
    t.title = hint || '';
    const s = document.createElement('input');
    s.type = 'range'; s.min = lo; s.max = hi; s.step = step; s.value = P[key];
    s.style.cssText = 'flex:1;min-width:0;height:14px;accent-color:#1A1A1A';
    const v = document.createElement('span');
    v.style.cssText = 'width:44px;flex:none;text-align:right';
    const paint = () => { s.value = P[key]; v.textContent = (+P[key]).toFixed(step < 0.1 ? 2 : 1); };
    s.addEventListener('input', () => { P[key] = +s.value; paint(); syncAll(); });
    // ⚠ 방향키를 여기서 먹는다 — 안 그러면 슬라이더를 잡은 채 배가 돌아간다
    s.addEventListener('keydown', e => e.stopPropagation());
    row.append(t, s, v);
    body.appendChild(row);
    sliders.push({ sync: paint });
    paint();
  };

  body.append(gaugeWrap, rowPreset);
  mkSlider('camPitch', '내림', '내려다보는 각(도). 수평선 위치를 정하는 값이다');
  mkSlider('camYaw', '좌우', 'look 점을 축으로 옆으로 돈 각(도)');
  mkSlider('camDist', '거리', 'look 점에서 물러난 배율. ⚠ 물의 원경 페이드가 여기 딸려 온다 (water.js)');

  box.append(head, body);

  // ── 접기
  let folded = false;
  const paintTitle = (txt) => { title.textContent = (folded ? '▸' : '▾') + ' 시점' + (txt || ''); };
  title.addEventListener('click', () => {
    folded = !folded;
    body.style.display = folded ? 'none' : 'flex';
    paintTitle(lastSummary);
  });
  title.addEventListener('keydown', e => e.stopPropagation());

  // ── [화면만] — 개발 UI 를 통째로 숨긴다
  // ⚠⚠ **원래 display 를 기억했다가 돌려준다.** tweaks 는 `display:flex` 라 그냥 '' 로 지우면
  //   cssText 에 있던 flex 까지 같이 사라져 레이아웃이 깨진다 (인라인 스타일 하나이기 때문).
  let soloOn = false;
  const kept = new Map();
  // ⚠ 늦게 만들어지는 패널(compare.js)은 addSoloTarget 으로 뒤에 등록한다
  const extra = [];
  const targets = () => [perf && perf.el, viewbar && viewbar.el, tweaks && tweaks.el, box, ...extra].filter(Boolean);
  function solo(on) {
    const next = (on === undefined) ? !soloOn : !!on;
    if (next === soloOn) return soloOn;
    soloOn = next;
    for (const el of targets()) {
      if (soloOn) { kept.set(el, el.style.display); el.style.display = 'none'; }
      else { el.style.display = kept.has(el) ? kept.get(el) : ''; }
    }
    return soloOn;
  }
  soloBtn.addEventListener('click', () => {
    solo(true);
    console.log('[campanel] 개발 UI 를 숨겼다. 되돌리려면 H 키 또는 PB.solo(false)');
  });
  soloBtn.addEventListener('keydown', e => e.stopPropagation());

  // H 로 껐다 켠다. ⚠ 입력칸 안에서는 무시한다 — 검색창·필터에 h 를 못 치면 안 된다
  const onKey = (e) => {
    if (e.key !== 'h' && e.key !== 'H') return;
    const t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
    solo();
  };
  window.addEventListener('keydown', onKey);

  function syncAll() {
    sliders.forEach(s => s.sync());
    if (viewbar) viewbar.sync();
    if (tweaks) tweaks.sync();
    if (apply) apply();
  }

  // ── 매 프레임 : 수평선과 물끝이 화면 어디인가
  // ⚠ 값이 안 바뀌면 DOM 을 안 건드린다. 이 패널이 측정을 흔들면 안 된다
  const H = CONFIG.sim.domain * 0.5;      // 수면 메시 반경 (55)
  let lastKey = '', lastSummary = '';
  paintTitle('');

  function update(cam, canvasH) {
    if (soloOn || !cam) return;
    const fov = cam.fov;
    // 수평선
    const hn = horizonNDC(P.camPitch, fov);
    const hFrac = (1 - hn) / 2;                        // 0 = 화면 위, 1 = 아래
    // 물끝 — 카메라 전방으로 메시 정사각형과 만나는 거리 (⚠ 화면 **중앙 열** 기준이다.
    // 좌우로 갈수록 가까워져 실제로는 아치가 된다 — §12-4)
    const m = cam.matrixWorld.elements;
    const fx = -m[8], fz = -m[10];
    const hl = Math.hypot(fx, fz) || 1e-6;
    const dx = fx / hl, dz = fz / hl;
    const cx = cam.position.x, cz = cam.position.z;
    const tx = dx > 1e-6 ? (H - cx) / dx : dx < -1e-6 ? (-H - cx) / dx : Infinity;
    const tz = dz > 1e-6 ? (H - cz) / dz : dz < -1e-6 ? (-H - cz) / dz : Infinity;
    const d = Math.max(0.01, Math.min(tx, tz));
    const wn = Math.tan(P.camPitch * D2R - Math.atan(cam.position.y / d)) / Math.tan(fov * 0.5 * D2R);
    const wFrac = (1 - wn) / 2;

    const key = hFrac.toFixed(4) + '|' + wFrac.toFixed(4) + '|' + fov.toFixed(1) + '|' + (canvasH | 0);
    if (key === lastKey) return;
    lastKey = key;

    // ⚠ 게이지의 **실제** 안쪽 높이. `index.html` 이 `* { box-sizing: border-box }` 라
    //   cssText 의 74px 에는 테두리 1px 두 줄이 포함돼 있다 — 그걸 쓰면 선이 2px 어긋난다
    const H_PX = gauge.clientHeight || 72;
    const cl = (f) => clamp(f, 0, 1);
    const 밖 = hn > 1;
    // 실제 캔버스에서 몇 px 인가. ⚠ px 는 캔버스 높이에 비례하므로 **비율이 기준**이고
    //   px 는 눈으로 대조하기 위한 덤이다 (docs/무대와-존-연출.md §12 머리말)
    const px = (f) => canvasH ? ' ' + Math.round(f * canvasH) + 'px' : '';

    skyFill.style.height = (cl(hFrac) * H_PX) + 'px';
    bandFill.style.top = (cl(hFrac) * H_PX) + 'px';
    bandFill.style.height = Math.max(0, (cl(wFrac) - cl(hFrac)) * H_PX) + 'px';
    seaFill.style.height = Math.max(0, (1 - cl(wFrac)) * H_PX) + 'px';
    hLine.style.top = (cl(hFrac) * H_PX) + 'px';
    hLine.style.background = 밖 ? '#C0392B' : '#1A1A1A';
    hLine.style.opacity = 밖 ? '0.55' : '1';
    wLine.style.top = (cl(wFrac) * H_PX) + 'px';

    const pct = (f) => (f * 100).toFixed(1) + '%';
    readout.textContent =
      (밖 ? '수평선 ⚠ 화면 밖\n       ' + pct(hFrac) + px(hFrac)
          : '수평선 ' + pct(hFrac) + px(hFrac)) +
      '\n원경 띠 ' + ((wFrac - hFrac) * 100).toFixed(1) + '%' + px(wFrac - hFrac) +
      '\n물끝   ' + pct(wFrac) + px(wFrac) +
      '\n화각   ' + fov.toFixed(1) + '°';
    lastSummary = 밖 ? ' · 수평선 화면 밖' : ' · 수평선 ' + pct(hFrac);
    if (folded) paintTitle(lastSummary);
  }

  return {
    el: box,
    mount() { stage.appendChild(box); },
    update,
    // 콘솔이나 다른 UI 에서 값을 바꿨을 때 슬라이더를 맞춘다
    sync() { sliders.forEach(s => s.sync()); },
    // ⚠⚠ **측정 전에 이걸 부른다.** PB.solo(true) 로도 부를 수 있다
    solo,
    // ⚠ [화면만] 이 같이 숨길 패널을 뒤에 추가한다 (생성 순서 때문에 생성자로 못 받는 것)
    addSoloTarget(el) { if (el && !extra.includes(el)) extra.push(el); },
    get isSolo() { return soloOn; },
    fold(v) { folded = (v === undefined) ? !folded : !!v; body.style.display = folded ? 'none' : 'flex'; paintTitle(lastSummary); return folded; },
    dispose() { window.removeEventListener('keydown', onKey); box.remove(); }
  };
}
