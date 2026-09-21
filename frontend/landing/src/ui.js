// ───────── 화면 UI ─────────
// index.html 의 DOM 을 잡아 3D 와 이어준다. 라벨은 zones.js 가 3D 좌표를 투영해 직접 움직인다.
// 향수 카드(MAP-05)는 marks.js 가 고른 부표를 main.js 가 여기로 넘겨 준다.
//
// ⚠⚠ **존 정보 블록도 여기다** (2026-09-10). 수면 타이포(title.js)는 캔버스에 굽는 **장식**이라
//   같은 글자가 DOM 제목으로 한 번 더 있어야 한다 — CLAUDE.md 의 *"텍스트는 전부 DOM 에 둔다"*,
//   설계 §6 접근성. 연출은 `cue.ui` 하나가 민다.

import { areasNow } from './areas.js';
import { PARAMS as P } from './params.js';

export function createUI({ onSearch, onSail, onCloseCard, onCardAction, onCabin }) {
  const $ = (id) => document.getElementById(id);

  const stage = $('stage');
  const mount = $('mount');
  const fill = $('drift-fill'), knob = $('drift-knob'), num = $('drift-num');
  const input = $('search-input'), button = $('search-button');

  // 향수 카드 — ⭐ 2026-09-11 오후부터 **말풍선**이다 (index.html 의 세 겹 주석)
  const card = $('scent-card');
  const bubble = $('scent-bubble'), tail = $('scent-tail');
  const rows = card ? [...card.querySelectorAll('[data-row]')] : [];
  const cName = $('scent-name'), cSub = $('scent-sub'), cNotes = $('scent-notes'), cNotesLabel = $('scent-notes-label');
  const cEn = $('scent-en');   // 영문 원명 (한글 제목 밑, 2026-09-12)
  const cZone = $('scent-zone'), cDot = $('scent-zone-dot');
  const cClose = $('scent-close'), cSail = $('scent-sail');
  // 카드의 서비스 동작 단추 줄 (2026-09-15, v0.68.0 — index.html #scent-actions · 켜기 <html data-card-actions>). 단추마다 data-act = detail · save · explore
  const cActs = $('scent-actions');
  const actBtns = cActs ? [...cActs.querySelectorAll('button[data-act]')] : [];
  // 향수 이미지 자리 (2026-09-14, v0.64.0 — cardImg · index.html #scent-img-slot). 주소는 향수 데이터의 `img` (marks.js 가 m.img 로 넘긴다).
  //   ⚠ 새 그림은 **다 불러온 뒤에** 보인다 — 바로 바꾸면 앞 향수의 그림이 잠깐 남는다. 못 불러온 주소는 기억하고 자리표시로 둔다
  //   ⚠ 처리기는 속성(onload · onerror)으로 단다 — 요소가 index.html 에 고정이라 다시 만들어도 쌓이지 않는다
  const cImg = $('scent-img'), cImgPh = $('scent-img-ph');
  const showImg = (on) => { if (cImg) cImg.style.display = on ? 'block' : 'none'; if (cImgPh) cImgPh.style.display = on ? 'none' : 'flex'; };
  if (cImg) {
    cImg.onload = () => { if (cImg.getAttribute('src')) showImg(true); };
    cImg.onerror = () => { cImg.dataset.bad = cImg.getAttribute('src') || ''; showImg(false); };
  }
  // 움직임을 줄이라는 설정이면 튀어나오지 않고 **옅어지기만** 한다 (접근성)
  const calm = () => !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  // 양끝이 느린 곡선. ⚠ phase.js 의 `inOutCubic` 과 **같은 곡선**이다 (그쪽은 함수, 여기는 WAAPI 라 베지어로 적는다) —
  //   연출과 카드가 다른 결로 움직이면 한 화면에서 두 손이 민 것처럼 보인다
  const EASE_IO = 'cubic-bezier(0.65, 0, 0.35, 1)';
  // #RRGGBB 두 색을 t 만큼 섞는다 (저녁 카드의 향조 글자색 — 부표 색을 상아색 쪽으로)
  const mixHex = (a, b, t) => {
    const p = (h) => { const n = parseInt(h.replace('#', ''), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
    const A = p(a), B = p(b);
    return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join('');
  };
  // ⭐ 어코드 동그라미 색 (v0.75.7 글자색 → v0.75.8 앞 동그라미) — 어코드가 속한 향조(해역)의 색 **계열**. 사용자 : *"전부 같은 색이 아니라 유사한 계열 색상"*.
  //   ⚠ v0.75.8 : 글자를 칠하고 굵게 한 것은 사용자가 *"너무 촌스러워서 차라리 앞에 O 동그라미 아이콘에 색상을 넣어줘"* — 글자는 카드 글자색 그대로 · 색은 동그라미에만.
  //   향조 색(CONFIG.families[].color · areasNow)의 HSL 에서 채도 × 1.5 · 명도 0.72 로 어두운 유리 위에서 또렷하게 하고,
  //   어코드 이름의 해시로 색상 ±12° · 채도 ±0.07 · 명도 ±0.05 를 흔든다 (같은 어코드는 어느 카드에서나 같은 색).
  //   ⚠ 대비 바닥 `floor` (동그라미는 그림이라 3:1) — 카드 바탕을 밝은 하늘이 비칠 때의 값(#473D4D, dusk 86% + 살구색 하늘 14%)으로 재고, 모자라면 상아색 쪽으로 20% 씩 밝힌다.
  //   향조를 모르면(예전 더미 · 표에 없는 어코드) '' · 낮 카드(종이)면 향조 제 색 그대로
  const ACCORD_BG = '#473D4D', ACCORD_IVORY = '#FBF3EA';
  const hexRgb = (h) => { const n = parseInt(h.replace('#', ''), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  const rgbHex = (a) => '#' + a.map(v => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0')).join('');
  const lumOf = (a) => { const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }; return 0.2126 * f(a[0]) + 0.7152 * f(a[1]) + 0.0722 * f(a[2]); };
  const contrastOf = (a, b) => { const x = lumOf(a), y = lumOf(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const hash01 = (s, k) => { let h = (2166136261 ^ k) >>> 0; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return (h % 1000) / 999; };
  const accordColor = (fam, name, floor) => {
    if (!fam) return '';
    const area = areasNow().find(a => String(a.key).toUpperCase() === fam);
    if (!area || !area.color) return '';
    if (!document.documentElement.hasAttribute('data-card-eve')) return area.color;
    const [r0, g0, b0] = hexRgb(area.color).map(v => v / 255);
    const mx = Math.max(r0, g0, b0), mn = Math.min(r0, g0, b0), l0 = (mx + mn) / 2;
    let h = 0, s = 0;
    if (mx !== mn) {
      const d = mx - mn;
      s = l0 > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
      h = (mx === r0 ? (g0 - b0) / d + (g0 < b0 ? 6 : 0) : mx === g0 ? (b0 - r0) / d + 2 : (r0 - g0) / d + 4) * 60;
    }
    const H = (h + (hash01(name, 1) - 0.5) * 24 + 360) % 360;
    const S = Math.min(1, Math.max(0, s * 1.5 + (hash01(name, 2) - 0.5) * 0.14));
    const L = Math.min(1, Math.max(0, 0.72 + (hash01(name, 3) - 0.5) * 0.10));
    const c = (1 - Math.abs(2 * L - 1)) * S, x = c * (1 - Math.abs((H / 60) % 2 - 1)), m0 = L - c / 2;
    const [r1, g1, b1] = H < 60 ? [c, x, 0] : H < 120 ? [x, c, 0] : H < 180 ? [0, c, x] : H < 240 ? [0, x, c] : H < 300 ? [x, 0, c] : [c, 0, x];
    let rgb = [(r1 + m0) * 255, (g1 + m0) * 255, (b1 + m0) * 255];
    const bg = hexRgb(ACCORD_BG), iv = hexRgb(ACCORD_IVORY);
    for (let i = 0; i < 8 && contrastOf(rgb, bg) < floor; i++) rgb = rgb.map((v, k) => v + (iv[k] - v) * 0.2);
    return rgbHex(rgb);
  };
  // 말풍선 상태. side = 부표의 어느 쪽에 서는가 (1 오른쪽 · −1 왼쪽)
  //   x · y = 자리 잡은 카드의 왼쪽 위 · ax · ay · ar = 가리키는 부표 (둘 다 #stage 기준 CSS px — 호버 카드의 틈 판정이 읽는다, v0.65.0). x 가 null 이면 아직 · 좌하단 고정
  const bub = { on: false, m: null, side: 1, w: 325, h: 280, key: '', tailKey: '', mode: '', anim: null, peek: false, x: null, y: 0, ax: 0, ay: 0, ar: 0 };
  // 피해야 할 자리 (CSS px, #stage 기준). ⚠ 매 프레임 재지 않는다 — 보일 때 · 창 크기가 바뀔 때만
  let avoid = { top: 110, mini: null };
  const measureAvoid = () => {
    const sr = stage.getBoundingClientRect();
    const sb = input ? input.parentElement.getBoundingClientRect() : null;
    const mm = document.getElementById('minimap');
    const mr = mm && mm.style.visibility !== 'hidden' ? mm.getBoundingClientRect() : null;
    avoid = {
      top: sb ? sb.bottom - sr.top + 12 : 110,
      mini: mr && mr.width > 0 ? { x0: mr.left - sr.left - 10, y0: mr.top - sr.top - 10, x1: mr.right - sr.left + 10, y1: mr.bottom - sr.top + 10 } : null
    };
    if (card) { bub.w = card.offsetWidth || 325; bub.h = card.offsetHeight || 280; }   // 325 = #scent-card 폭 대체값 (v0.75.11 — 어코드 한 줄)
  };
  const onWinResize = () => { if (bub.on) measureAvoid(); bub.key = ''; bub.tailKey = ''; };
  window.addEventListener('resize', onWinResize);
  // 꼬리 — dir 은 꼬리가 붙는 **가장자리** (L 왼쪽 · R 오른쪽 · T 위 · B 아래), at 은 그 가장자리를 따라 잰 자리(px).
  //   45° 돌린 정사각형의 **바깥 두 변**만 긋는다 — 그 두 변이 만나는 꼭짓점이 부표를 가리킨다
  //   (L : 왼·아래 변 → 왼쪽 꼭짓점 · R : 위·오른 → 오른쪽 · T : 왼·위 → 위 · B : 오른·아래 → 아래)
  const setTail = (dir, at, cw, ch) => {
    if (!tail) return;
    // ⭐ 저녁 카드 (2026-09-13 저녁, <html data-card-eve>) — 바탕이 비치므로 꼬리 정사각형이 상자와 겹친 **안쪽 절반이 두 번 칠해져 짙어진다**.
    //   바깥 삼각형만 남기고(clip-path — 돌리기 전 좌표라 두 선이 만나는 쪽 삼각형이다) 선도 카드 토큰으로 긋는다
    const eve = document.documentElement.hasAttribute('data-card-eve');
    const tk = dir + '|' + at + '|' + (eve ? 1 : 0);
    if (tk === bub.tailKey) return;
    bub.tailKey = tk;
    const s = tail.style, B = eve ? '1px solid var(--pb-card-tail-line, rgba(255,244,236,0.16))' : '1px solid #1A1A1A';
    s.clipPath = !eve ? '' : dir === 'L' ? 'polygon(0 0, 0 100%, 100% 100%)' : dir === 'R' ? 'polygon(0 0, 100% 0, 100% 100%)'
      : dir === 'T' ? 'polygon(0 0, 100% 0, 0 100%)' : 'polygon(100% 0, 100% 100%, 0 100%)';
    s.left = s.right = s.top = s.bottom = 'auto';
    s.marginTop = s.marginLeft = '0px';
    s.borderLeft = (dir === 'L' || dir === 'T') ? B : 'none';
    s.borderBottom = (dir === 'L' || dir === 'B') ? B : 'none';
    s.borderTop = (dir === 'R' || dir === 'T') ? B : 'none';
    s.borderRight = (dir === 'R' || dir === 'B') ? B : 'none';
    if (dir === 'L' || dir === 'R') { s[dir === 'L' ? 'left' : 'right'] = '-7px'; s.top = at + 'px'; s.marginTop = '-6.5px'; }
    else { s[dir === 'T' ? 'top' : 'bottom'] = '-7px'; s.left = at + 'px'; s.marginLeft = '-6.5px'; }
    // 튀어나오는 기준점 = 꼬리 끝
    if (bubble) bubble.style.transformOrigin =
      dir === 'L' ? `0px ${at}px` : dir === 'R' ? `${cw}px ${at}px` : dir === 'T' ? `${at}px 0px` : `${at}px ${ch}px`;
  };
  // 경고 한 줄 (범위 없음). 처음 부를 때 만든다
  let warnEl = null, warnAnim = null, warnLineAnim = null, warnTimer = 0;

  // ───────── 선실 — 배에 손을 올렸을 때 (2026-09-21, v0.79.0) ─────────
  // **배 아이콘 하나짜리 작은 방울**이다 — 배 옆구리에 꼬리를 대고 뜬다. 하는 말은 하나뿐이다 :
  // "이건 누를 수 있다". 글자는 없다 (2026-09-21 사용자 : *"작은 말풍선에 배 아이콘만 들어가있는
  // 식으로 클릭이 된다라는 표현만"*) — 무엇이 들어 있는지는 누른 뒤 앱 말풍선이 말한다.
  //
  // ⭐⭐ **방울 자체가 누르고 올릴 수 있는 것이다** (2026-09-21 사용자 : *"작은 말풍선에도 마우스
  //   호버기능이 있으면 좋겠음 호버해서 말풍선이 반응해야 사람들이 알아볼듯"*). 그래서 `<button>` 이고
  //   손을 올리면 놋쇠빛 테 · 번짐 · 한 뼘 커지기로 **반응한다.** 누르면 앱 말풍선이 이 방울에서 자란다.
  //
  // ⚠⚠ **누르는 상자가 보이는 방울보다 넓다 — 배와의 틈(약 19px)을 건너야 하기 때문이다.**
  //   배 히트박스 가장자리(약 +0.34r)와 방울(+0.55r + 8) 사이가 비어 있어, 방울로 마우스를 옮기는
  //   동안 레이캐스트가 배를 놓쳐 **방울이 깜빡이며 사라진다** (말풍선 카드의 `cardHoverBridge` 와
  //   같은 함정 · 불변식 24). 그래서 단추 상자를 배 쪽으로 PAD 만큼 늘리고, main.js 의 updateHover 가
  //   `cabinHovered()` 로 그 위에서는 다시 집지 않는다.
  // ⚠ 보이는 것은 안쪽 `span` 이다 — 단추는 투명한 손잡이일 뿐이다.
  // ⚠ `#stage` 의 **직계 자식**으로 붙인다 — 잠수 전환이 `html[data-dive] #stage > *:not(#mount)`
  //   한 줄로 엔진 UI 를 비키는데, 그 아래로 들어가야 배가 내려갈 때 같이 비킨다 (index.html).
  // ⚠ `#mount` 밖이라 이 단추 위의 누름은 input.js 로 안 간다 — 고르기 · 바다 떠나기가 안 걸린다
  // ⚠ z-index 는 카드(20)보다 **아래**다. 카드가 떠 있는데 방울이 그 위를 가리면 안 된다
  let cabinEl = null, cabinSkin = null, cabinTail = null;
  let cabinOn = false, cabinHot = false, cabinKey = '', cabinSide = 0, cabinTimer = 0;
  const CABIN_R = 34;      // 보이는 방울 한 변
  const CABIN_GAP = 8;     // 배 옆구리에서 방울까지 (꼬리가 지나는 틈)
  const CABIN_PAD = 20;    // 누르는 상자를 배 쪽으로 늘리는 몫 (위 ⚠⚠ 의 틈)
  const CABIN_EDGE = 6;    // 방울 바깥쪽 여유
  const CABIN_W = CABIN_PAD + CABIN_GAP + CABIN_R + CABIN_EDGE;
  const CABIN_H = CABIN_R + 12;
  // 배 마크 — 종이배 그림 한 장. **엔진 배의 실제 색 그대로다** (boat.js 의 hullMat · sailMat · sparMat).
  //   ⚠ 앱 말풍선의 배 아이콘(`features/map/components/CabinBubble`)과 **같은 그림 · 같은 색**이다.
  //     한쪽을 고치면 다른 쪽도 본다
  const CABIN_MARK = '<svg viewBox="0 0 170 160" width="22" height="22" aria-hidden="true">'
    + '<path d="M85 14 L85 104 L136 104 Z" fill="#ffffff"/>'
    + '<path d="M79 30 L79 104 L38 104 Z" fill="#f4f2ee"/>'
    + '<rect x="83" y="12" width="2.5" height="96" fill="#b9b4aa"/>'
    + '<path d="M22 108 L148 108 L124 138 L46 138 Z" fill="#dcd9d2"/>'
    + '<path d="M22 108 L148 108 L143 114 L27 114 Z" fill="#c9c4bb"/></svg>';
  const CABIN_LINE = 'var(--pb-cabin-line,rgba(249,246,239,0.22))';
  const CABIN_HOT = 'var(--pb-cabin-hot,rgba(217,190,134,0.7))';
  // 손을 올렸을 때의 반응 — 놋쇠빛 테 · 둘레 번짐 · 한 뼘 커지기. 칸의 호버와 같은 말투다
  const paintCabin = () => {
    if (!cabinSkin) return;
    cabinSkin.style.borderColor = cabinHot ? CABIN_HOT : CABIN_LINE;
    cabinSkin.style.boxShadow = cabinHot
      ? '0 4px 14px rgba(16,10,28,0.28),0 0 14px var(--pb-cabin-glow,rgba(217,190,134,0.4))'
      : '0 4px 14px rgba(16,10,28,0.28)';
    cabinSkin.style.transform = cabinHot ? 'scale(1.08)' : 'scale(1)';
  };
  const buildCabin = () => {
    cabinEl = document.createElement('button');
    cabinEl.type = 'button';
    cabinEl.setAttribute('aria-label', '선실 열기');
    cabinEl.style.cssText = 'position:absolute;left:0;top:0;z-index:18;box-sizing:border-box;'
      + 'width:' + CABIN_W + 'px;height:' + CABIN_H + 'px;padding:0;border:0;background:none;'
      + 'cursor:pointer;will-change:transform;visibility:hidden;opacity:0;';
    // 꼬리 — 45도 돌린 작은 정사각형. 방울 쪽 두 변은 지워 겹친 자리가 두 번 칠해지지 않게 한다
    //   (말풍선 카드의 setTail 과 같은 장치 · 불변식 24)
    cabinTail = document.createElement('span');
    cabinTail.style.cssText = 'position:absolute;top:50%;width:7px;height:7px;margin-top:-3.5px;'
      + 'border:1px solid ' + CABIN_LINE + ';background:var(--pb-cabin-bg,rgba(30,41,71,0.78));'
      + 'transform:rotate(45deg);pointer-events:none;';
    cabinSkin = document.createElement('span');
    cabinSkin.style.cssText = 'position:absolute;top:50%;box-sizing:border-box;'
      + 'width:' + CABIN_R + 'px;height:' + CABIN_R + 'px;margin-top:' + (-CABIN_R / 2) + 'px;'
      + 'border:1px solid ' + CABIN_LINE + ';border-radius:9px;'
      + 'background:var(--pb-cabin-bg,rgba(30,41,71,0.78));backdrop-filter:blur(6px);'
      + 'display:flex;align-items:center;justify-content:center;pointer-events:none;'
      + 'transition:border-color 120ms ease,box-shadow 120ms ease,transform 120ms ease;';
    cabinSkin.innerHTML = CABIN_MARK;
    cabinEl.appendChild(cabinTail);
    cabinEl.appendChild(cabinSkin);
    // ⚠ pointerenter/leave 다 (mouseover 가 아니다) — 안쪽 span 을 지날 때마다 켜졌다 꺼지지 않는다
    cabinEl.addEventListener('pointerenter', () => { cabinHot = true; paintCabin(); });
    cabinEl.addEventListener('pointerleave', () => { cabinHot = false; paintCabin(); });
    cabinEl.addEventListener('click', () => { if (onCabin) onCabin(); });
    paintCabin();
    stage.appendChild(cabinEl);
  };
  // 존 정보 블록 (우측) + 좌하단 존 표시
  const zInfo = $('zone-info'), zTitle = $('zone-title'), zDesc = $('zone-desc'), zNotes = $('zone-notes');
  const zMark = $('zone-mark'), zNo = $('zone-no'), zSub = $('zone-sub');
  const zTimer = $('zone-timer');
  let zKey = '', zQ = -1, zTq = -2;
  // ⭐ 정보 블록의 자리 (#stage 기준 CSS px) — 수면 타이포의 **천장**이 된다 (main.js → title.update).
  //   ⚠ 매 프레임 재지 않는다 — 크기가 바뀌거나(ResizeObserver) 창이 바뀔 때(반응형 CSS 가 자리를 옮긴다)만 다시 잰다.
  //   offset* 은 transform 을 안 탄다 — 페이드 중에 16px 밀려 있어도 **자리 잡은 뒤의** 자리를 준다
  //   ⚠ zInfo 선언 **뒤**에 둔다 (TDZ — 한 번 앞에 뒀다가 첫 줄에서 죽을 뻔했다)
  let zRect = null, zRectDirty = true;
  const zRO = window.ResizeObserver ? new ResizeObserver(() => { zRectDirty = true; }) : null;
  if (zRO && zInfo) zRO.observe(zInfo);
  const onZResize = () => { zRectDirty = true; };
  window.addEventListener('resize', onZResize);
  // ⭐ 정보 블록 호버 (2026-09-11 오후). main.js 가 이걸 보고 도착 연출의 머묾 시계를 세운다 (phase.pauseHold).
  //   ⚠ 두 블록을 따로 센다 — 한쪽에서 다른 쪽으로 곧장 옮기면 leave 가 enter 보다 늦게 올 수 있다
  let hoverN = 0;
  const onZEnter = () => { hoverN++; };
  const onZLeave = () => { hoverN = Math.max(0, hoverN - 1); };
  for (const z of [zInfo, zMark]) {
    z.addEventListener('pointerenter', onZEnter);
    z.addEventListener('pointerleave', onZLeave);
  }
  // 향수 고르기 라벨 (필요할 때 만든다)
  const focusBox = $('focus-labels');
  const focusEls = [];
  // 부표 이름표의 글자 (showMarkLabels). ⚠ 폭을 재는 캔버스와 **같은 글꼴**이어야 겹침 판정이 맞는다 — #stage 의 font-family 와 같다
  const LABEL_FS = 10.5, LABEL_FS_TOP = 11.5, LABEL_MAX = 140;
  const LABEL_FONT = 'Pretendard,-apple-system,BlinkMacSystemFont,system-ui,sans-serif';
  const measureCtx = document.createElement('canvas').getContext('2d');
  const labelW = new Map();   // 글자 → 폭 (한 번 재고 기억한다)

  const fire = () => onSearch(input.value);
  const onKey = e => {
    if (e.key === 'Enter') fire();
    e.stopPropagation();   // 방향키가 항해 조작으로 새지 않게
  };
  // 페이드가 끝난 뒤에야 visibility 를 끈다. 바로 끄면 사라지는 게 안 보이고,
  // 안 끄면 투명한 카드의 버튼이 탭 순서에 남는다 (키보드로 안 보이는 버튼에 들어간다)
  const FADE = 220;
  let hideTimer = 0;

  const closeCard = () => onCloseCard && onCloseCard();
  const sail = () => onSail && onSail();
  button.addEventListener('click', fire);
  input.addEventListener('keydown', onKey);
  cClose.addEventListener('click', closeCard);
  cSail.addEventListener('click', sail);
  // 한 줄에 처리기 하나 — 누른 단추의 data-act 만 main.js 로 넘긴다 (무엇을 할지는 main.js cardAction · host.js 가 정한다)
  const act = (e) => { const b = e.target.closest ? e.target.closest('button[data-act]') : null; if (b && !b.disabled && onCardAction) onCardAction(b.dataset.act); };
  if (cActs) cActs.addEventListener('click', act);

  return {
    stage, mount,
    // 정보 블록(우측 · 좌하단) 위에 마우스가 있는가
    get zoneHover() { return hoverN > 0; },
    // 우측 정보 블록의 자리 { x0, x1, y1 } (#stage 기준 CSS px). 타이포 천장용
    zoneInfoRect() {
      if (zRectDirty && zInfo) {
        zRectDirty = false;
        zRect = { x0: zInfo.offsetLeft, x1: zInfo.offsetLeft + zInfo.offsetWidth, y1: zInfo.offsetTop + zInfo.offsetHeight };
      }
      return zRect;
    },
    setDrift(s) {
      const pct = (Math.min(1, s) * 100).toFixed(1) + '%';
      fill.style.width = pct;
      knob.style.left = pct;
      num.textContent = s.toFixed(2);
    },

    // 명세의 "선택한 향수의 일부 정보가 없는 경우 제공 가능한 정보만 표시한다" —
    // 빈 칸은 지우지 않고 '—' 로 남긴다. 카드 높이가 튀지 않아야 한다
    // ⭐ 2026-09-11 오후 : 부표가 바뀔 때마다 **다시 튀어나온다** (말풍선). 자리는 placeScent 가 잡는다
    showScent(m) {
      if (!m) return;
      if (hideTimer) { clearTimeout(hideTimer); hideTimer = 0; }
      // ⭐ 한글 판매명 (2026-09-12, markNameKo) — 제목은 한글, 그 밑에 **영문 원명**을 작게 (같은 향수를 해외 이름으로도 찾을 수 있게).
      //   브랜드도 한글이다. 끄면 예전처럼 영문 제목 · 영문 브랜드 (원명 줄은 숨긴다)
      const ko = (P.markNameKo === undefined ? 1 : P.markNameKo) >= 0.5 && !!m.nameKo;
      cName.textContent = (ko ? m.nameKo : m.name) || '—';
      if (cEn) { cEn.textContent = ko && m.name !== m.nameKo ? m.name : ''; cEn.style.display = cEn.textContent ? '' : 'none'; }
      cSub.textContent = (ko ? m.subKo : m.sub) || '—';
      // ⭐ 어코드 상위 3개 (2026-09-17, v0.75.3 — 사용자 : *"어코드로 진행해줘 상위 3개만"*). 지도 향수의 이 줄은 **어코드**다 — 노트는 데이터가 없다 (marks.js).
      //   이름마다 nowrap 칸에 담고 가운뎃점은 앞 이름에 붙인다 — 줄은 점 뒤에서만 바뀐다 ('화이트 플로럴' 이 둘로 쪼개지지 않는다).
      //   markNameKo 0 이면 영문 이름. 어코드가 없는 부표(예전 더미)는 notes 글자 그대로 · 라벨 NOTES
      // ⭐⭐ 2026-09-18 (v0.75.8) : 어코드마다 **앞에 제 향조 색 동그라미**(accordColor — 같은 향조라도 어코드마다 조금씩 다르다) · 글자는 카드 글자색 · 보통 굵기.
      //   사용자 : *"폰트 굵기 색상 바꾸니까 너무 촌스러워서 차라리 앞에 O 동그라미 아이콘에 색상을 넣어줘"* (v0.75.7 은 글자를 칠하고 굵게 했다).
      //   동그라미가 이름을 가르므로 가운뎃점은 뺐다 — 사이는 #scent-notes 의 column-gap. 한 칸(동그라미 + 이름)은 안 쪼개지고 줄은 칸 사이에서만 바뀐다
      const acc = m.accords;
      if (acc && acc.length) {
        const koA = (P.markNameKo === undefined ? 1 : P.markNameKo) >= 0.5;
        cNotes.replaceChildren(...acc.map(a => {
          const item = document.createElement('span');
          // 동그라미 9px (v0.75.9 — 사용자 : *"동그라미 조금만 더 크게"* · 예전 7px 은 위 향조 라벨 점과 같은 크기였다) · 동그라미와 이름 사이 4px (v0.75.11 에 5 → 4 — 모든 카드를 한 줄로).
          //   칸들은 #scent-notes 가 한 줄 안에 고르게 벌린다 (space-evenly — index.html 주석)
          item.style.cssText = 'display:inline-flex;align-items:center;gap:var(--pb-card-accord-dot-gap,4px);white-space:nowrap;';
          const dot = document.createElement('span');
          dot.setAttribute('aria-hidden', 'true');
          dot.style.cssText = 'flex:none;width:var(--pb-card-accord-dot,9px);height:var(--pb-card-accord-dot,9px);border-radius:50%;';
          dot.style.background = accordColor(a.fam, a.en, 3) || 'var(--pb-card-ink-3, #8A8A8A)';
          const word = document.createElement('span');
          word.textContent = (koA ? a.ko : a.en) || a.en;
          item.append(dot, word);
          return item;
        }));
      } else cNotes.textContent = m.notes || '—';
      if (cNotesLabel) cNotesLabel.textContent = acc && acc.length ? 'ACCORDS' : 'NOTES';
      // 이미지 자리 (v0.64.0) — 주소가 있으면 그림, 없거나 못 불러온 주소면 자리표시. ⚠ 자리 높이는 CSS 가 고정한다 (그림이 늦게 떠도 카드 높이가 안 튄다)
      if (cImg) {
        const src = m.img || '';
        if (src && cImg.dataset.bad !== src) {
          if (cImg.getAttribute('src') !== src) { showImg(false); cImg.src = src; }
          else if (cImg.complete && cImg.naturalWidth > 0) showImg(true);
          cImg.alt = cName.textContent;
        } else { cImg.removeAttribute('src'); cImg.alt = ''; showImg(false); }
      }
      cZone.textContent = m.zone.name;
      // ⭐ 저녁 카드 (2026-09-13 저녁) — 어두운 유리 위에서는 먹 쪽으로 누른 글자색(marks.js inkOf)이 가라앉는다.
      //   향조의 **제 색**(부표 색)을 상아색 쪽으로 25% 밝혀 쓴다 (가장 어두운 WOODY #A38F7C 도 작은 대문자로 읽히게)
      const eveCard = document.documentElement.hasAttribute('data-card-eve');
      const zc = eveCard && m.zone.area && m.zone.area.color ? mixHex(m.zone.area.color, '#FBF3EA', 0.25) : m.zone.color;
      cZone.style.color = zc;
      cDot.style.background = zc;
      // ⭐ [이 향의 해역으로] 호버 물결은 **향조 색을 안 쓴다** (2026-09-18, v0.75.12 — 사용자 : *"내부는 그냥 흰색"* ·
      //   *"각 파트에있는 색상은 전부 이렇게 통일"*). v0.75.5 ~ v0.75.6 은 향수마다 --pb-sail-zone* 넷을 넣어
      //   물결과 그 위 글자색을 해역 색으로 칠했는데, 지금은 흰 파도라 넣을 값이 없다 (index.html #scent-sail).
      //   ⚠ 예전 값이 인라인에 남아 있을 수 있어 지운다 — 카드는 한 벌이라 향수를 바꿔도 같은 요소를 다시 쓴다.
      for (const k of ['--pb-sail-zone', '--pb-sail-zone-ink', '--pb-sail-zone-back', '--pb-sail-zone-back-ink']) {
        cSail.style.removeProperty(k);
      }
      card.style.visibility = 'visible';
      card.style.opacity = '1';
      card.style.pointerEvents = bub.peek ? 'none' : 'auto';
      bub.on = true; bub.m = m; bub.key = ''; bub.tailKey = ''; bub.fresh = true;
      measureAvoid();   // ⚠ 글자가 바뀌면 높이가 바뀐다 — 자리 잡기 전에 잰다
      // ── 등장. ⚠ transform-origin 은 **꼬리 끝**이다 — 말이 부표에서 뿜어져 나오는 것처럼 보여야 한다
      // ⭐⭐ 2026-09-16 : **오버슈트를 뺐다** (사용자 : *"너무 통통 튀듯이 함 약간 정적이듯이 해야할듯 양쪽 ease in out"*).
      //   예전은 `scale` 0.35 → **1.035**(제 크기를 넘겼다가) → 1 이라 튀어 올랐고, 커브도 `cubic-bezier(0.22, 0.9, 0.3, 1)` 로 **앞이 빨랐다**.
      //   지금은 시작 배율에서 1 로 **곧게** 가고 커브는 양끝이 느리다 (`EASE_IO` = phase.js 의 `inOutCubic` 과 같은 곡선).
      //   ⚠ 시작 배율도 0.35 → 0.92 다 — 작은 데서 확 커지는 것 자체가 '통통' 으로 읽힌다. 뿜어져 나오는 느낌은 transform-origin(꼬리 끝)이 계속 낸다.
      if (bub.anim) bub.anim.cancel();
      if (bubble && bubble.animate) {
        const oMs = P.cardOpenMs === undefined ? 300 : P.cardOpenMs;
        const oS = P.cardOpenScale === undefined ? 0.92 : P.cardOpenScale;
        bub.anim = calm()
          ? bubble.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 160, easing: 'ease-out' })
          : bubble.animate([
              { opacity: 0, transform: `scale(${oS})` },
              { opacity: 1, transform: 'scale(1)' }
            ], { duration: oMs, easing: EASE_IO });
        // 내용은 한 줄씩 떠오른다 (45ms 간격). ⚠ fill:'backwards' — 기다리는 동안 안 보여야 한다
        if (!calm()) rows.forEach((r, i) => r.animate(
          [{ opacity: 0, transform: 'translateY(4px)' }, { opacity: 1, transform: 'none' }],
          { duration: 260, delay: 110 + i * 45, easing: EASE_IO, fill: 'backwards' }));
      }
    },

    // 카드의 서비스 동작 단추를 켜고 끈다 (v0.68.0 — main.js 가 매 프레임 부른다). 지금은 [자세히 보기] · [진열대에 저장] 둘. ⚠ 바뀔 때만 쓴다
    //   ⚠ v0.74.2 에서 [주변 향 탐색]이 빠지면서 인자가 하나가 됐다 — 남은 둘은 같은 조건이라 갈래가 필요 없다
    setScentActions(service) {
      const off = !service;
      for (const b of actBtns) if (b.disabled !== off) b.disabled = off;
    },

    hideScent() {
      card.style.pointerEvents = 'none';
      bub.on = false; bub.m = null;
      if (hideTimer) clearTimeout(hideTimer);
      if (bub.anim) bub.anim.cancel();
      // ⭐ 2026-09-16 : 나갈 때도 **양끝이 느린 같은 곡선**이다 (예전 `ease-in` 은 끝에서 가속해 툭 끊겼다) · 줄어드는 폭도 0.9 → 0.96 으로 줄였다
      if (bubble && bubble.animate && card.style.visibility === 'visible') {
        bub.anim = bubble.animate([{ opacity: 1, transform: 'scale(1)' }, { opacity: 0, transform: 'scale(0.96)' }],
          { duration: calm() ? 120 : (P.cardOpenMs === undefined ? 300 : P.cardOpenMs) * 0.6, easing: EASE_IO, fill: 'forwards' });
      } else card.style.opacity = '0';
      hideTimer = setTimeout(() => {
        card.style.visibility = 'hidden'; card.style.opacity = '0'; hideTimer = 0;
        if (bub.anim) { bub.anim.cancel(); bub.anim = null; }
      }, FADE);
    },

    // ⭐ 호버 미리보기는 마우스를 통과시킨다 (2026-09-13 저녁, cardPeek — main.js 가 매 프레임 부른다. 바뀔 때만 쓴다).
    //   ⚠ 상자(인라인 pointer-events:auto)까지 같이 끈다 — 바깥 겹만 끄면 안쪽이 여전히 받는다
    setScentPeek(peek) {
      if (!card || bub.peek === peek) return;
      // ⚠⚠ **사라지는 중에는 안 바꾼다** (2026-09-16). 호버가 벗어나면 같은 프레임에 `hideScent()` 가 페이드를 걸고
      //   틱이 곧바로 `setScentPeek(false)` 를 부른다 — 그러면 카드가 **짙은 남색으로 튄 채** 사라진다
      //   (사용자 : *"부표 마우스 호버를 다른 곳에 놓았을때 순간적으로 검게 변했다가 사라짐"*).
      //   `hideScent` 가 `bub.on` 을 먼저 내리므로 여기서 걸러진다. 다시 뜰 때는 `showScent` 뒤에 틱이 같은 프레임에 제 값을 넣는다.
      if (!bub.on) return;
      bub.peek = peek;
      // 저녁 카드면 미리보기가 더 비치고 덜 흐리다 (index.html 의 #scent-card[data-peek] — 변수만 바꾼다)
      if (peek) card.dataset.peek = '1'; else delete card.dataset.peek;
      const boxEl = bubble && bubble.firstElementChild;
      if (boxEl) boxEl.style.pointerEvents = peek ? 'none' : 'auto';
      if (bub.on) card.style.pointerEvents = peek ? 'none' : 'auto';
    },

    // ⭐⭐ 호버 카드의 틈 (2026-09-15, v0.65.0 — main.js updateHover · cardHoverBridge). 사용자 : *"향수 부표 마우스 오버시 모달창과 마우스 이동이 끊김
    //   옆 모달창에 마우스를 올리면 그 사이 공백으로 모달창이 사라지고있음"*. x · y 는 #stage 기준 CSS px (input.state.px · py).
    //   ⚠ 호버 카드는 마우스를 통과시키므로(peek) DOM 이벤트로는 못 잰다 — 자리 잡기가 쓴 상자(bub.x · y · w · h)로 잰다 (레이아웃을 새로 읽지 않는다)
    //   scentCardHit = 카드 위인가 (pad = 꼬리 · 손떨림 여유) · scentZoneHit = 가리키는 부표와 카드를 **함께 두른 상자** 안인가 (틈을 건너는 중)
    scentCardHit(x, y, pad = 0) {
      if (!card || !bub.on || !Number.isFinite(x) || !Number.isFinite(y)) return false;
      if (bub.x === null) {
        const sr = stage.getBoundingClientRect(), r = card.getBoundingClientRect();
        return r.width > 0 && x >= r.left - sr.left - pad && x <= r.right - sr.left + pad && y >= r.top - sr.top - pad && y <= r.bottom - sr.top + pad;
      }
      return x >= bub.x - pad && x <= bub.x + bub.w + pad && y >= bub.y - pad && y <= bub.y + bub.h + pad;
    },
    scentZoneHit(x, y, pad = 0) {
      if (!card || !bub.on || bub.x === null || !Number.isFinite(x) || !Number.isFinite(y)) return false;
      const x0 = Math.min(bub.x, bub.ax - bub.ar), x1 = Math.max(bub.x + bub.w, bub.ax + bub.ar);
      const y0 = Math.min(bub.y, bub.ay - bub.ar), y1 = Math.max(bub.y + bub.h, bub.ay + bub.ar);
      return x >= x0 - pad && x <= x1 + pad && y >= y0 - pad && y <= y1 + pad;
    },

    // ── 말풍선 자리 (매 프레임, main.js). a = { x, y (부표 중심, CSS px), r (화면 반지름 px), obs (가리면 안 되는 것), bubble (0/1) }.
    //   부표 **오른쪽**에 서고, 자리가 없으면 왼쪽으로 뒤집는다. 위아래는 부표 높이에 맞추되 검색바 아래 ~ 화면 바닥 안.
    //   미니맵(우하단)과 겹치면 반대쪽으로, 거기도 막히면 미니맵 위로 올린다.
    // ⚠ 값이 바뀔 때만 스타일을 쓴다 (1px 단위) — showZone 과 같은 가드
    placeScent(a) {
      if (!card || !bub.on || !a) return;
      const W = stage.clientWidth || 1, H = stage.clientHeight || 1;
      if (!a.bubble) {
        // 예전 자리 (cardBubble 0) — index.html 이 원래 쓰던 left 40 · bottom 96
        if (bub.mode !== 'fixed') {
          bub.mode = 'fixed'; bub.key = '';
          card.style.left = '40px'; card.style.top = 'auto'; card.style.bottom = '96px';
          card.style.transform = 'none';
          if (tail) tail.style.display = 'none';
          if (bubble) bubble.style.transformOrigin = '0 100%';
        }
        bub.x = null;   // 좌하단 고정 카드는 틈 판정을 DOM 상자로 잰다 (v0.65.0 — scentCardHit)
        return;
      }
      if (bub.mode !== 'bubble') {
        bub.mode = 'bubble'; bub.key = ''; bub.tailKey = '';
        card.style.left = '0px'; card.style.top = '0px'; card.style.bottom = 'auto';
        if (tail) tail.style.display = '';
      }
      const gap = 14 + (a.r || 0);                    // 부표 가장자리에서 꼬리 끝까지
      const cw = bub.w, ch = bub.h, M = 12;
      const top0 = Math.max(M, avoid.top), bot0 = H - M;
      // ⭐ **좁은 창(휴대폰)** — 옆에 설 자리가 없다. 부표 **아래**(안 되면 위)에 가로 가운데로 서고 꼬리가 위/아래를 가리킨다
      //   (반응형, 2026-09-11 오후). 기준 : 말풍선 폭의 1.6 배 + 여백보다 좁은 창
      if (W < cw * 1.6 + 2 * M) {
        const below = a.y + gap, above = a.y - gap - ch;
        let y, dir;
        if (below + ch <= bot0) { y = below; dir = 'T'; }
        else if (above >= top0) { y = above; dir = 'B'; }
        else { y = Math.min(bot0 - ch, Math.max(top0, below)); dir = 'T'; }
        // ⚠ 이름표와 **같은 이유로 반올림하지 않는다** (아래 showMarkLabels 의 긴 주석). 카드도 부표에 붙어 다니므로
        //   정수 스냅은 부표가 천천히 흐를 때 카드만 1px 씩 튀게 만든다 — 꼬리가 부표를 못 따라간다.
        const x = Math.min(W - M - cw, Math.max(M, a.x - cw * 0.5));
        const key = x.toFixed(2) + ',' + y.toFixed(2);
        if (key !== bub.key) { bub.key = key; card.style.transform = `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0)`; }
        bub.x = x; bub.y = y; bub.ax = a.x; bub.ay = a.y; bub.ar = a.r || 0;
        // ⚠ 꼬리는 반올림을 **남긴다** — top/left 라 레이아웃을 다시 태운다 (transform 이 아니다).
        //   카드가 부표를 정확히 따라가면 이 오프셋은 거의 안 변하므로 1px 양자가 안 보인다.
        setTail(dir, Math.round(Math.min(cw - 18, Math.max(18, a.x - x))), cw, ch);
        return;
      }
      const fit = (side) => {
        const x = side > 0 ? a.x + gap : a.x - gap - cw;
        const y = Math.min(bot0 - ch, Math.max(top0, a.y - ch * 0.5));
        const inX = x >= M && x + cw <= W - M;
        const mi = avoid.mini;
        const hitMini = !!mi && x < mi.x1 && x + cw > mi.x0 && y < mi.y1 && y + ch > mi.y0;
        return { x, y, ok: inX && !hitMini, inX, hitMini };
      };
      // ⭐ **덜 가리는 쪽**으로 연다. 가리면 안 되는 것 = 배(가중 3 — 주인공이다) + 화면에 뜬 다른 부표들
      //   (향수 고르기의 12개가 특히 그렇다 — 가운데 칸 옆에 열면 이웃 칸을 덮어 못 누른다, 화면으로 확인).
      //   a.obs = [{ x, y, r, w }] (CSS px). 말풍선 사각형과 겹치는 것의 가중치 합이 점수다.
      // ⚠ 흔들림 방지 : 반대쪽이 **확실히 나을 때만**(점수 차 ≥ 1) · 마지막으로 뒤집고 0.6초가 지난 뒤에만 뒤집는다
      const cover = (g) => {
        let s = 0;
        for (const o of (a.obs || [])) {
          if (o.x + o.r > g.x && o.x - o.r < g.x + cw && o.y + o.r > g.y && o.y - o.r < g.y + ch) s += o.w || 1;
        }
        return s;
      };
      // ⚠ 막 떴을 때(fresh)는 히스테리시스 없이 **처음부터 나은 쪽**을 고른다 (동점이면 오른쪽)
      if (bub.fresh) {
        bub.fresh = false;
        const R = fit(1), L = fit(-1);
        const sc = (q) => (q.ok ? 0 : 100) + (q.inX ? 0 : 1000) + cover(q);
        bub.side = sc(L) < sc(R) ? -1 : 1;
      }
      let f = fit(bub.side);
      const g = fit(-bub.side);
      const now = performance.now();
      const better = (g.ok && !f.ok) || (!f.inX && g.inX) ||
        (g.ok && f.ok && cover(g) <= cover(f) - 1 && now - (bub.flipAt || 0) > 600);
      if (better) { f = g; bub.side = -bub.side; bub.flipAt = now; }
      // 둘 다 미니맵에 걸리면 미니맵 위로 올린다
      if (f.hitMini && avoid.mini) f.y = Math.max(top0, avoid.mini.y0 - ch);
      // ⚠ 반올림하지 않는다 (위 좁은 창 갈래와 같은 이유)
      const x = Math.min(W - M - cw, Math.max(M, f.x));
      const y = f.y;
      const key = x.toFixed(2) + ',' + y.toFixed(2);
      if (key !== bub.key) { bub.key = key; card.style.transform = `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0)`; }
      bub.x = x; bub.y = y; bub.ax = a.x; bub.ay = a.y; bub.ar = a.r || 0;
      // 꼬리 — 부표 쪽 가장자리, 부표 높이에. ⚠ 둥근 모서리(5px) 안으로 물린다
      setTail(bub.side > 0 ? 'L' : 'R', Math.round(Math.min(ch - 18, Math.max(18, a.y - y))), cw, ch);
    },

    // ── 경고 한 줄 (2026-09-11 오후). 지금은 **범위 없음** 하나다 — 사용자 : *"갈 수 없는 영역은 갈 수 없다는 "범위 없음"
    //   경고를 띄우면"*. 검색바 바로 아래 가운데에 떨어지듯 나타나 2.4초 뒤 스스로 걷힌다.
    //   ⚠ 이미 떠 있으면 다시 만들지 않고 **살짝 흔들어** 알린다 (벽에 계속 밀면 매 프레임 불린다 — main.js 가 3초에 한 번으로 거른다)
    //   ⚠ role="status" + aria-live — 화면을 못 보는 사람에게도 읽힌다
    //   ⭐ 2026-09-13 — **저녁 유리 알약** (`warnEve` → <html data-warn-eve>). 색 · 모양은 전부 `var(--pb-warn-…, 예전 값)` 이라
    //     속성이 없으면 값 단위로 예전 종이 한 줄이다 (카드 · 미니맵과 같은 규약 — 불변식 25). 토큰은 index.html 한 곳
    //   ⚠ z-index 는 **해도(#chart 40) 위**다 — 해도에서 범위 밖을 누르면 해도를 안 닫고 경고만 부른다. 예전 30 은 해도 밑에 깔려 안 보였다
    //     (그래서 [원본] 종이 한 줄에도 같이 적용된다 — 모양이 아니라 버그라서)
    warn(title, sub) {
      if (!warnEl) {
        warnEl = document.createElement('div');
        warnEl.setAttribute('role', 'status');
        warnEl.setAttribute('aria-live', 'polite');
        // ⭐ 2026-09-13 밤 (v0.58.0, warnDrop) : 자리를 **내렸다** — 사용자 : *"토스트 조금 아래 띄워주고"*. 반응형 단계(--pb-warn-top)에 main.js 가 넣는 --pb-warn-drop 을 더한다
        //   ⭐ v0.67.0 : 검색창을 내린 만큼(--pb-search-drop · searchDrop)도 더한다 — 검색창 밑 간격이 그대로다
        warnEl.style.cssText = 'position:absolute;left:50%;top:calc(var(--pb-warn-top,112px) + var(--pb-warn-drop,0px) + var(--pb-search-drop,0px));z-index:45;transform:translateX(-50%);' +
          'display:flex;align-items:center;gap:var(--pb-warn-gap,12px);padding:var(--pb-warn-pad,11px 18px);' +
          'border:var(--pb-warn-border,1px solid #1A1A1A);border-radius:var(--pb-warn-radius,5px);' +
          'background:var(--pb-warn-bg,rgba(246,245,242,0.95));backdrop-filter:var(--pb-warn-blur,blur(3px));' +
          'box-shadow:var(--pb-warn-shadow,0 8px 24px rgba(26,26,26,0.10));' +
          'pointer-events:none;visibility:hidden;white-space:nowrap;max-width:calc(100vw - 32px);';
        // 표지(진입 금지 — 검색창 돋보기와 같은 선 굵기 1.7) · 제목 · 세로 구분선 · 본문 · 남은 시간 밑줄. 표지와 밑줄은 저녁 판에서만 보인다
        warnEl.innerHTML =
          '<svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" ' +
            'style="display:var(--pb-warn-icon-d,none);flex:none;color:var(--pb-warn-accent,#1A1A1A);"><circle cx="12" cy="12" r="8.5"/><path d="M8 12h8"/></svg>' +
          '<span data-w="t" style="font-size:11px;font-weight:var(--pb-warn-title-w,700);letter-spacing:0.22em;color:var(--pb-warn-title,#1A1A1A);"></span>' +
          '<span style="flex:none;width:1px;height:12px;background:var(--pb-warn-rule,rgba(26,26,26,0.3));"></span>' +
          '<span data-w="s" style="font-size:12px;letter-spacing:0.02em;color:var(--pb-warn-ink-2,#3A3A3A);overflow:hidden;text-overflow:ellipsis;"></span>' +
          '<span data-w="l" aria-hidden="true" style="display:var(--pb-warn-line-d,none);position:absolute;left:22px;right:22px;bottom:-1px;height:1px;' +
            'background:var(--pb-warn-accent,#1A1A1A);transform-origin:center;transform:scaleX(0);"></span>';
        stage.appendChild(warnEl);
      }
      warnEl.querySelector('[data-w="t"]').textContent = title;
      warnEl.querySelector('[data-w="s"]').textContent = sub || '';
      const shown = warnEl.style.visibility === 'visible';
      warnEl.style.visibility = 'visible';
      if (warnAnim) warnAnim.cancel();
      if (warnEl.animate) {
        warnAnim = calm()
          ? warnEl.animate([{ opacity: 0 }, { opacity: 1, offset: 0.1 }, { opacity: 1, offset: 0.85 }, { opacity: 0 }],
              { duration: 2400, fill: 'forwards' })
          : warnEl.animate(shown
              ? [ // 이미 떠 있으면 흔든다
                  { opacity: 1, transform: 'translateX(-50%)' }, { transform: 'translateX(calc(-50% - 6px))', offset: 0.04 },
                  { transform: 'translateX(calc(-50% + 5px))', offset: 0.08 }, { transform: 'translateX(calc(-50% - 3px))', offset: 0.12 },
                  { opacity: 1, transform: 'translateX(-50%)', offset: 0.16 }, { opacity: 1, transform: 'translateX(-50%)', offset: 0.85 },
                  { opacity: 0, transform: 'translateX(-50%) translateY(-4px)' }]
              : [ // 처음 : 위에서 떨어지며 들어온다
                  { opacity: 0, transform: 'translateX(-50%) translateY(-10px)' }, { opacity: 1, transform: 'translateX(-50%)', offset: 0.1 },
                  { transform: 'translateX(calc(-50% - 5px))', offset: 0.14 }, { transform: 'translateX(calc(-50% + 4px))', offset: 0.18 },
                  { opacity: 1, transform: 'translateX(-50%)', offset: 0.22 }, { opacity: 1, transform: 'translateX(-50%)', offset: 0.85 },
                  { opacity: 0, transform: 'translateX(-50%) translateY(-4px)' }],
              { duration: 2400, easing: 'ease-out', fill: 'forwards' });
        warnAnim.onfinish = () => { if (warnEl) warnEl.style.visibility = 'hidden'; warnAnim = null; };
        // ⭐ 남은 시간 밑줄 (저녁 판) — 떠 있는 동안 가운데로 줄어든다 (존 정보 블록의 #zone-timer 와 같은 말투). 다시 부르면 처음부터.
        //   ⚠ 겉 상자와 **다른 요소**다 — 겉 상자의 transform 은 등장 · 흔들기가 쓴다 (transform 은 겹마다 하나 — 불변식 24)
        //   ⚠ 줄어드는 움직임이라 동작 줄이기(calm)에서는 안 민다 (scaleX 0 그대로 — 안 보인다)
        const line = warnEl.querySelector('[data-w="l"]');
        if (warnLineAnim) { warnLineAnim.cancel(); warnLineAnim = null; }
        if (line && !calm()) {
          warnLineAnim = line.animate(
            [{ transform: 'scaleX(1)' }, { transform: 'scaleX(1)', offset: 0.1 }, { transform: 'scaleX(0)', offset: 0.85 }, { transform: 'scaleX(0)' }],
            { duration: 2400, fill: 'forwards' });
        }
      } else {
        clearTimeout(warnTimer);
        warnTimer = setTimeout(() => { if (warnEl) warnEl.style.visibility = 'hidden'; }, 2400);
      }
    },
    get warning() { return !!warnEl && warnEl.style.visibility === 'visible'; },

    // ── 존 정보 블록. `cue.zone` 과 `cue.ui` 만 받는다 (title.js·gate.js 와 같은 규약)
    // ⚠⚠ **내용은 존이 바뀔 때만 다시 쓴다.** 매 프레임 textContent 를 건드리면 그때마다
    //   레이아웃이 무효화된다 — 글자가 안 바뀌어도 비용은 든다.
    // ⚠ 스타일도 **값이 실제로 달라질 때만** 쓴다 (1% 단위). campanel 이 쓰는 것과 같은 가드다.
    // left : 머묾 시계의 **남은 비율** 0..1 (도착 연출일 때만). 음수면 선을 숨긴다 (ESC 까지 머무는 연출)
    showZone(key, amount, left = -1) {
      const a = amount < 0 ? 0 : amount > 1 ? 1 : amount;
      const on = a > 0.002 && !!key;
      // ⭐ 남은 시간 선 (#zone-timer). ⚠ 값이 바뀔 때만 쓴다 (0.5% 단위) — 아래 showZone 과 같은 가드.
      //   ⚠ scaleX 라 레이아웃을 안 건드린다 (합성만)
      if (zTimer) {
        const tq = on && left >= 0 ? Math.round(Math.min(1, left) * 200) : -1;
        if (tq !== zTq) {
          zTq = tq;
          zTimer.style.transform = 'scaleX(' + (tq < 0 ? 0 : tq / 200).toFixed(3) + ')';
        }
      }
      if (on && key !== zKey) {
        zKey = key;
        // ⚠ 존 표는 areas.js 에서 받는다 — 향수 지도에서는 향조 아홉이다 (v0.32.0). 키는 대소문자를 안 가린다
        const list = areasNow(), kl = String(key).toLowerCase();
        const i = list.findIndex(x => x.key.toLowerCase() === kl);
        const z = list[i];
        if (z) {
          zTitle.textContent = z.name;
          // ⚠ desc 는 배열이다 — 줄 나눔은 여기서 정한다 (CSS `white-space:pre-line`)
          zDesc.textContent = (z.desc || []).join(String.fromCharCode(10));
          zNotes.textContent = (z.notes || []).join('  /  ');
          // ⚠ 번호는 **배열 순서에서 파생**시킨다. config 에 또 적으면 갈라진다
          zNo.textContent = String(i + 1).padStart(2, '0');
          zSub.textContent = z.name + ' ZONE';
        }
      }
      // ⚠ 숨는 순간 호버를 비운다. 커서가 가만히 있으면 브라우저에 따라 pointerleave 가 안 온다 —
      //   그러면 다음 도착이 **시작부터 멈춘 채** 머문다
      if (!on) hoverN = 0;
      const q = Math.round(a * 100);
      if (q === zQ) return;
      zQ = q;
      const vis = on ? 'visible' : 'hidden';
      zInfo.style.visibility = vis;
      zMark.style.visibility = vis;
      zInfo.style.opacity = a;
      zMark.style.opacity = a;
      // ⭐ 타이포 위 가운데 자리(2026-09-13 저녁, <html data-info-center> · 761px 이상)에서는 옆이 아니라 **아래에서 떠오른다**
      zInfo.style.transform = document.documentElement.hasAttribute('data-info-center') && window.innerWidth > 760
        ? 'translateY(' + ((1 - a) * 10).toFixed(1) + 'px)'
        : 'translateX(' + ((1 - a) * 16).toFixed(1) + 'px)';
      zMark.style.transform = 'translateY(' + ((1 - a) * 10).toFixed(1) + 'px)';
      if (!on) zKey = '';
    },

    // ── 부표 이름표 (2026-09-12, markLabels — 예전 '향수 고르기 라벨' v0.32.0 을 넓혔다).
    //   items = [{ x, y (화면 CSS px), text, a (0..1), up, top }]. 빈 배열이면 전부 숨긴다.
    //   up = 부표 **위**(x, y 가 이름표의 아래끝 가운데) · 아니면 예전처럼 **밑**(위끝 가운데) · top = TOP 10 (조금 크고 굵게)
    // ⚠ 텍스트는 DOM 에 둔다 (CLAUDE.md : *"캔버스에 그리면 SEO·스크린리더·복사·번역·확대를 잃는다"*).
    // ⚠ 매 프레임 불리므로 **값이 바뀔 때만** 스타일·글자를 쓴다 (showZone 과 같은 가드)
    // ⚠ 자리는 transform 한 줄로 민다 (left/top 을 매 프레임 바꾸면 레이아웃을 다시 계산한다 — 이름표가 수십 개다)
    showMarkLabels(items) {
      for (let i = 0; i < items.length; i++) {
        let el = focusEls[i];
        if (!el) {
          el = document.createElement('div');
          // ⚠ **한 줄 · 말줄임**이다 — 두 줄로 두니 'Chance Eau Tendre Eau de Parfum' 같은 이름이 다음 줄
          //   부표까지 내려와 겹쳤다 (화면으로 확인). 전체 이름은 누르면 카드가 보여 준다
          el.style.cssText = 'position:absolute;left:0;top:0;max-width:' + LABEL_MAX + 'px;will-change:transform;' +
            'text-align:center;line-height:1.35;letter-spacing:0.02em;color:var(--pb-ink,#1A1A1A);' +
            // ⚠ 시간대(index.html data-time)가 글자와 둘레 빛을 같이 뒤집는다 — 낮이면 예전 값 그대로
            'text-shadow:0 0 3px var(--pb-halo,rgba(246,245,242,0.95)),0 0 6px var(--pb-halo-2,rgba(246,245,242,0.8));' +
            'white-space:nowrap;overflow:hidden;text-overflow:ellipsis;';
          focusBox.appendChild(el);
          focusEls[i] = el;
          el._name = ''; el._q = ''; el._s = ''; el._a = -1;
        }
        const it = items[i];
        if (el._name !== it.text) { el.textContent = it.text; el._name = it.text; }
        const s = it.top ? 't' : 'n';
        if (el._s !== s) { el._s = s; el.style.fontSize = (it.top ? LABEL_FS_TOP : LABEL_FS) + 'px'; el.style.fontWeight = it.top ? '600' : '400'; }
        // ⚠⚠⚠ **자리를 반올림하지 않는다** (2026-09-16). 사용자 : *"속도가 빠르면 빠르게 따라가지 못하고 약간 떨림"*.
        //   예전에는 `Math.round` 로 정수 픽셀에 스냅했는데, **양자 1px 이 실제 이동보다 훨씬 컸다.**
        //   실측 (순항 · 60fps 환산한 프레임당 화면 이동) :
        //     Blue Talisman x **0.14px** · y 0.07px   │  Sicily x 0.28 · y 0.16  │  God of Fire x 1.12 · y 0.38
        //   0.14px 로 가는 이름표는 **일곱 프레임을 제자리에 있다가 1px 을 통째로 튄다.** 부표는 GPU 가
        //   서브픽셀로 미끄러지는데 글자만 계단으로 가니, 둘이 붙어 있지 않고 **떠는 것으로 보인다.**
        //   세로가 더 나쁘다 — 부표의 너울 부유가 프레임당 0.1px 안팎이라 스냅이 그걸 깜빡임으로 만든다.
        //   ⚠ GPU 와 무관한 문제다 (양자화라 프레임률·가속과 상관없다) — 크롬에서 가속을 켜도 남아 있던 이유다.
        // ⚠⚠ **translate3d 라야 한다.** 2D translate 는 글자를 픽셀 격자에 맞춰 **다시 래스터**하므로
        //   소수를 줘도 글자꼴이 프레임마다 미세하게 달라진다 (그 자체가 떨림이다). 3d 는 층을 하나 만들어
        //   **한 번 래스터한 글자를 옮기기만** 한다 — 위 will-change:transform 과 짝이다.
        // ⚠ 자리와 투명도의 문을 갈랐다 — 자리는 매 프레임 바뀌지만 투명도는 거의 안 바뀐다.
        //   예전처럼 한 열쇠에 묶으면 자리가 바뀔 때마다 opacity·visibility 까지 다시 쓴다.
        const q = it.x.toFixed(2) + ',' + it.y.toFixed(2) + (it.up ? 'u' : 'd');
        if (el._q !== q) {
          el._q = q;
          el.style.transform = 'translate3d(' + it.x.toFixed(2) + 'px,' + it.y.toFixed(2) + 'px,0) translate(-50%,' + (it.up ? '-100%' : '0') + ')';
        }
        const av = Math.round(it.a * 50);
        if (el._a !== av) {
          el._a = av;
          el.style.opacity = it.a.toFixed(2);
          el.style.visibility = it.a > 0.01 ? 'visible' : 'hidden';
        }
      }
      for (let i = items.length; i < focusEls.length; i++) {
        const el = focusEls[i];
        // ⚠ _a 도 같이 되돌린다 — 안 그러면 이 자리가 다시 쓰일 때 투명도 문이 '같다' 고 보고
        //   visibility 를 visible 로 안 돌려놔 **이름표가 안 보인다** (자리·투명도 문을 가르면서 생기는 함정).
        if (el._q !== 'off') { el._q = 'off'; el._a = -1; el.style.visibility = 'hidden'; }
      }
    },
    // 예전 이름 (향수 고르기의 12개 밑) — markLabels 0 에서 main.js 가 부른다
    showFocusLabels(items) { this.showMarkLabels(items.map(it => ({ x: it.x, y: it.y, text: it.name, a: it.a, up: false, top: false }))); },
    // 이름표 폭 (CSS px) — 겹침을 가르는 데 쓴다 (main.js). 캔버스로 한 번 재고 글자별로 기억한다
    labelWidth(text, top) {
      const k = (top ? 't' : 'n') + text;
      let w = labelW.get(k);
      if (w === undefined) {
        const fs = top ? LABEL_FS_TOP : LABEL_FS;
        measureCtx.font = (top ? '600 ' : '400 ') + fs + 'px ' + LABEL_FONT;
        w = Math.min(LABEL_MAX, measureCtx.measureText(text).width + 0.02 * fs * text.length + 2);
        labelW.set(k, w);
      }
      return w;
    },
    labelHeight(top) { return Math.ceil((top ? LABEL_FS_TOP : LABEL_FS) * 1.35); },

    // ── 배에 손을 올렸을 때 (2026-09-21, v0.79.0 — 선실). main.js 의 tick 이 매 프레임 부른다.
    //   ax · ay = 꼬리를 대는 점(배 옆구리) · side 1 오른쪽 · −1 왼쪽 — 전부 #stage 기준 CSS px.
    //   **앱의 선실 말풍선과 같은 점이다** (`PB.boat.screen`).
    //   x · y = 배(선체)의 화면 자리 · r = 배 길이 절반의 화면 반지름 (둘 다 #stage 기준 CSS px).
    //
    // ⚠⚠ **이 방울이 '누를 수 있다' 는 표시다.** 부표는 이름표가 늘 떠 있어 배우게 되지만,
    //   배는 여태 풍경이었다 — 빼면 기능이 숨는다 (같은 말을 커서가 한 번 더 한다 · main.js).
    // ⚠ 매 프레임 불린다 — 자리가 **바뀔 때만** 쓴다 (showMarkLabels 와 같은 가드).
    // ⚠ 자리는 transform 한 줄로 민다. left/top 을 매 프레임 바꾸면 레이아웃을 다시 계산한다
    // ⚠ 한 번도 손을 안 올렸으면 DOM 을 아예 안 만든다 (warn 과 같은 규약)
    setCabin(on, ax, ay, side, instant) {
      if (!on && !cabinEl) return;
      if (!cabinEl) buildCabin();
      if (on !== cabinOn) {
        cabinOn = on;
        // 움직임을 줄이라는 설정이면 즉시 (calm — 카드 · 토스트와 같은 규율)
        //   ⚠⚠ `instant` 는 **앱 말풍선이 이 방울에서 자라기 시작했다**는 뜻이다 (main.js 의 cabinOpen).
        //     옅어지며 사라지게 두면 자라는 말풍선과 두 겹이 겹쳐 유리가 한 번 짙어진다 — 그 순간이
        //     곧 '모핑' 이 끊기는 자리다. 그래서 그때만 한 프레임에 걷는다
        const ms = calm() || instant ? 0 : 140;
        clearTimeout(cabinTimer); cabinTimer = 0;
        cabinEl.style.transition = ms ? 'opacity ' + ms + 'ms ease' : 'none';
        if (on) cabinEl.style.visibility = 'visible';
        cabinEl.style.opacity = on ? '1' : '0';
        // ⚠ 숨길 때는 다 옅어진 **뒤에** 걷는다 — 곧바로 visibility 를 끄면 사라지는 모습이 없다
        if (!on) {
          cabinHot = false; paintCabin();   // 다시 뜰 때 호버가 켜진 채로 나타나지 않게
          const hide = () => { if (cabinEl) cabinEl.style.visibility = 'hidden'; cabinTimer = 0; };
          if (ms) cabinTimer = setTimeout(hide, ms); else hide();
        }
      }
      if (!on) return;
      // 단추 상자는 **꼬리 점에서 배 쪽으로 CABIN_PAD 만큼 물러나** 선다 (위 ⚠⚠ 의 틈 건너기).
      //   보이는 방울과 꼬리는 그 안에서 side 에 따라 좌우가 뒤집힌다
      const bx = side > 0 ? ax - CABIN_PAD : ax - (CABIN_W - CABIN_PAD);
      const by = ay - CABIN_H / 2;
      const key = bx.toFixed(1) + '|' + by.toFixed(1) + '|' + side;
      if (key === cabinKey) return;
      cabinKey = key;
      cabinEl.style.transform = 'translate3d(' + bx.toFixed(1) + 'px,' + by.toFixed(1) + 'px,0)';
      if (side === cabinSide) return;
      cabinSide = side;
      const inner = side > 0 ? 'left' : 'right', outer = side > 0 ? 'right' : 'left';
      cabinSkin.style[inner] = (CABIN_PAD + CABIN_GAP) + 'px';
      cabinSkin.style[outer] = 'auto';
      cabinTail.style[inner] = (CABIN_PAD + CABIN_GAP - 3.5) + 'px';
      cabinTail.style[outer] = 'auto';
      // 꼬리는 **방울 쪽 두 변**을 지운다 — 어느 쪽에 서느냐에 따라 지우는 변이 바뀐다
      cabinTail.style.borderTopWidth = side > 0 ? '0' : '1px';
      cabinTail.style.borderRightWidth = side > 0 ? '0' : '1px';
      cabinTail.style.borderBottomWidth = side > 0 ? '1px' : '0';
      cabinTail.style.borderLeftWidth = side > 0 ? '1px' : '0';
    },

    /**
     * 마우스가 **방울 위**인가 (2026-09-21). main.js 의 updateHover 가 읽는다 —
     * 그 위에서는 다시 집지 않고 호버를 그대로 둔다.
     *
     * ⚠⚠ 이것이 없으면 배에서 방울로 마우스를 옮기는 동안 **방울이 깜빡이며 사라진다** —
     * 둘 사이에 약 19px 의 빈 곳이 있어 레이캐스트가 배를 놓치기 때문이다 (위 머리말의 ⚠⚠).
     */
    cabinHovered() { return cabinOn && cabinHot; },

    dispose() {
      window.removeEventListener('resize', onWinResize);
      window.removeEventListener('resize', onZResize);
      if (zRO) zRO.disconnect();
      if (bub.anim) { bub.anim.cancel(); bub.anim = null; }
      if (warnAnim) { warnAnim.cancel(); warnAnim = null; }
      if (warnLineAnim) { warnLineAnim.cancel(); warnLineAnim = null; }
      clearTimeout(warnTimer);
      if (warnEl) { warnEl.remove(); warnEl = null; }
      clearTimeout(cabinTimer); cabinTimer = 0;
      if (cabinEl) { cabinEl.remove(); cabinEl = null; }
      if (cabinTail) { cabinTail.remove(); cabinTail = null; }
      cabinOn = false; cabinKey = '';
      for (const z of [zInfo, zMark]) {
        z.removeEventListener('pointerenter', onZEnter);
        z.removeEventListener('pointerleave', onZLeave);
      }
      focusEls.forEach(el => el.remove()); focusEls.length = 0;
      if (hideTimer) { clearTimeout(hideTimer); hideTimer = 0; }
      button.removeEventListener('click', fire);
      input.removeEventListener('keydown', onKey);
      cClose.removeEventListener('click', closeCard);
      cSail.removeEventListener('click', sail);
      if (cActs) cActs.removeEventListener('click', act);
    }
  };
}
