import * as THREE from 'three';
import { CONFIG } from './config.js';
import { PARAMS as P } from './params.js';
import { swellCPU } from './swell.js';
import { clamp } from './util.js';
import { PERFUMES } from './perfumes-data.js';
import { scentMap } from './scentmap.js';
import { EASE } from './phase.js';
import { GLOW_LAYER } from './bloom.js';
import { timeNow } from './times.js';

// ⭐ **몸통이 스스로 빛나 보이게 하는 한 줄** (2026-09-11 오후, `markSelfLit`). MeshStandardMaterial 의 발광에
//   **시선 음영**을 곱한다 — 가운데(N·V = 1)가 밝고 가장자리(0)는 uRim 배. 조명 없이도 **구**로 읽힌다.
//   ⚠ 균일한 발광은 납짝한 원이 된다 (params.js markEnv 주석 — 스크린샷으로 확인했던 것). 그래서 조명 대신 시선으로 입체를 낸다.
//   ⚠ uRim 1 이면 곱하는 인자가 정확히 1 이다 (예전과 비트 단위로 같다). 유니폼은 **모든 부표가 공유**한다 —
//     onBeforeCompile 함수와 캐시 키가 같아 프로그램도 하나다.
//   ⚠ flatShading 이라 normal 이 면마다 하나다 — 면마다 한 톤이라 배와 같은 각진 결로 빛난다
// ⭐⭐ **태양** (2026-09-11 밤, `markSun`) — 가운데가 **흰색으로 달아오르고** 테두리에 향조 색이 남는다. 전등·태양이 그렇게 보인다
//   (가운데는 눈·센서가 포화해 흰색, 색은 테두리와 번짐에 있다). 위의 시선 음영은 반대였다 — 가운데가 향조 색이고 1 아래라
//   **흰 종이보다 어두운 색 공**이었다 (params.js markSun 주석의 실측).
//   ⚠ 1 − e^−x 로 채널마다 **부드럽게** 포화시킨다. 딱 자르면(min 1) 가운데부터 납작한 흰 원판이 된다 (markGlowBody 1.5 위 · markGlow 7.0).
//   ⚠ 흰 심은 **매끈한 법선**(vSunN — 정점 법선 보간)으로 낸다. flatShading 법선이면 면마다 한 톤이라 심이 계단으로 끊긴다.
//     빛(조명) 쪽은 여전히 면 법선이다 — 윤곽과 햇빛 몫은 배와 같은 각진 결 그대로
//   ⚠ uSun 0 이면 예전 식 그대로다 (else 쪽)
const GLOW_UNI = { uCore: { value: 1.6 }, uRim: { value: 1 }, uSun: { value: 0 }, uSunHot: { value: 9 }, uSunEdge: { value: 2.0 }, uSunCore: { value: 0.4 } };
function patchSelfLit(sh) {
  sh.uniforms.uCore = GLOW_UNI.uCore;
  sh.uniforms.uRim = GLOW_UNI.uRim;
  sh.uniforms.uSun = GLOW_UNI.uSun;
  sh.uniforms.uSunHot = GLOW_UNI.uSunHot;
  sh.uniforms.uSunEdge = GLOW_UNI.uSunEdge;
  sh.uniforms.uSunCore = GLOW_UNI.uSunCore;
  sh.vertexShader = sh.vertexShader
    .replace('#include <common>', '#include <common>\nvarying vec3 vSunN;')
    .replace('#include <defaultnormal_vertex>', '#include <defaultnormal_vertex>\nvSunN = transformedNormal;');
  sh.fragmentShader = sh.fragmentShader
    .replace('#include <common>', '#include <common>\nuniform float uCore;\nuniform float uRim;\n' +
      'uniform float uSun;\nuniform float uSunHot;\nuniform float uSunEdge;\nuniform float uSunCore;\nvarying vec3 vSunN;')
    .replace('#include <emissivemap_fragment>', [
      '#include <emissivemap_fragment>',
      '{',
      '  vec3 vdir = isOrthographic ? vec3(0.0, 0.0, 1.0) : normalize(vViewPosition);',
      '  if (uSun > 0.5) {',
      // 몸통 전체는 향조 색(uSunEdge)으로 빛나고, 가운데에 **흰 빛**(uSunHot)이 가우스로 얹힌다.
      //   ⚠ 흰 심을 향조 색의 곱으로 내면 가장 약한 채널이 심의 색을 정한다 — 분홍은 G 가 0.16 이라 9 배로도 255,228,236 에 멈췄다 (실측).
      //     흰 빛을 **더해야** 어느 향조든 가운데가 흰색이 된다
      //   rho2 = 화면에서 본 몸통 가운데로부터의 거리² (0 가운데 · 1 윤곽). uSunCore = 흰 심의 반지름 (몸통 대비)
      //   ⚠ 흰 빛도 페이드를 따른다 — diffuseColor.a(= opacity) 로 받는다. 배를 가려 비치는 부표(markBlockAlpha)도 흰 빛이 같이 준다
      '    float nds = clamp(abs(dot(normalize(vSunN), vdir)), 0.0, 1.0);',
      '    float rho2 = 1.0 - nds * nds;',
      '    float spot = exp(-rho2 / max(uSunCore * uSunCore, 1e-4));',
      '    vec3 e = totalEmissiveRadiance * uSunEdge + vec3(uSunHot * spot * diffuseColor.a);',
      '    totalEmissiveRadiance = 1.0 - exp(-e);',
      '  } else {',
      '    float ndv = clamp(abs(dot(normal, vdir)), 0.0, 1.0);',
      '    totalEmissiveRadiance *= mix(uRim, 1.0, pow(ndv, uCore));',
      '  }',
      '}'
    ].join('\n'));
}

// ───────── 향수 부표 ─────────
// 향 지도 위의 향수 하나가 부표 하나다 (MAP-05). 클릭하면 기본 정보 카드가 뜬다.
//
// **zones.js 와 무엇이 다른가.** zones 는 '향 계열의 영역'(점 구름 + 라벨)이고 여기는
// '그 안에 떠 있는 개별 향수'다. 둘은 좌표 변환(wrapP)과 거리 페이드 커브만 공유한다.
// ⚠ 그래서 좌표계를 유한 공간으로 바꿀 때 **두 곳을 같이** 고쳐야 한다 (작업계획 [4단계]).
//
// ⚠⚠ **높이를 `sim.sampler()` 로 구할 수 없다.** 그건 배 주변 16텍셀만 읽는 동기 GPU
// 리드백이다 — cell 이 domain/res = 110/640 = 0.172 이므로 창의 폭이 **±1.4 단위**다.
// 수십 단위 떨어진 부표는 그 창 밖이라 언제나 가장자리 값이 나온다(= 배를 따라다니는 높이).
// 부표는 해석적 너울(swellCPU)만 본다. 리드백이 없어 더 싸고, 배가 만든 항적 잔물결은
// 이 거리에서 어차피 안 보인다.
//
// ⚠⚠ **부표는 파도를 타지 않는다** (2026-09-03, 사용자 결정 : "특정 높이의 공중에").
// `markHeight` 라는 절대 높이에 가만히 떠 있다 — 그래서 파도가 흘러도 부표는 안 흔들리고,
// 물의 움직임과 지도 표지의 움직임이 눈에 분리된다. 물에 뜨던 시절의 흔적 :
//   · 높이·기울기를 배와 같은 게이트(boatFps)에서 돌렸다 → 이제 y 가 상수라 게이트가 필요 없다
//   · 기울기(markTilt)는 구라서 어차피 안 보였다 → v0.9.1 에서 걷어냈다
// ⚠ 다만 **선택 링만은 수면에 앉는다.** 공중의 구와 물 위의 링 사이 간격이 곧 '높이'를
// 읽게 해 주고, 링이 "이 지점" 을 가리키는 표지가 된다. 그래서 `swellCPU` 는 **고른 하나**
// 에 대해서만 게이트 안에서 부른다.
//
// ⚠ **가로 위치는 매 프레임 민다.** 그건 파도가 아니라 배가 나아간 양이고,
// 배의 방향(rotation.y)을 끊지 않는 것과 같은 이유다.

// ⭐ 인기 순위 → 크기 단계 (2026-09-12, CONFIG.mark.rankTiers · params.markRankSize). 순위가 표보다 크면 마지막 단계다
const TIERS = ((CONFIG.mark && CONFIG.mark.rankTiers) || []).slice().sort((a, b) => a.upTo - b.upTo);
function tierAt(rank) {
  if (!TIERS.length || !(rank > 0)) return null;
  for (const t of TIERS) if (rank <= t.upTo) return t;
  return TIERS[TIERS.length - 1];
}
export function tierOf(rank) { const t = tierAt(rank); return t ? t.k : 1; }
// ⭐ 같은 표의 **밝기** 단계 (2026-09-12 오후, params.markRankLight). update 가 불투명도에 곱한다
export function litOf(rank) { const t = tierAt(rank); return t && t.lit !== undefined ? t.lit : 1; }

// 시드 고정 RNG (mulberry32). 새로고침해도 부표가 같은 자리에 있어야 한다 —
// 클릭해 본 향수가 다음 로드에서 딴 데 있으면 그건 지도가 아니다
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 부표를 흩는다. **순환 타일(area.wrapZ) 전체를 고르게 채운다.**
//
// ⚠ 처음에는 원점 중심의 원판에 뿌렸는데, 그러면 타일 안에 빈 자리가 남아서 항해 중
// 화면에 부표가 하나도 없는 구간이 생긴다. 실측 (항로 80지점, 총 24개) :
//   원판 반경 34 → 평균 3.9개  최대 9  **빈 화면 8%**
//   원판 반경 20 → 평균 4.3개  최대 16  **빈 화면 37%** (뭉쳤다 비었다 한다)
//   타일 전체   → 평균 3.3개  최대 6   **빈 화면 0%**
// 평균은 원판이 조금 높지만 그건 뭉쳐서 나온 값이다. 고르게 만나는 쪽을 택했다.
//
// 피하는 것 두 가지 :
//   · 서로 너무 가까운 것 — 한 클릭에 둘이 겹치면 무엇을 골랐는지 알 수 없다
//   · 출항 지점 바로 위 — 배와 겹쳐서 첫 화면이 지저분해진다
// ⚠ 최소 간격도 타일을 감아서 잰다. 안 그러면 타일 경계를 사이에 둔 둘이 붙어 버린다
// ⚠⚠ **반사 시험용 배치** (2026-09-06). 흩뿌리기로는 반사가 **맞는지 틀리는지 판정할 수
//   없다** — 자리가 불규칙하면 상이 어긋나 있어도 그게 어긋난 건지 원래 그런 건지 모른다.
//   그래서 거리와 높이를 **규칙적으로** 깐다 :
//     · 열(column) = 좌우.  같은 거리에 나란히 → 상의 **좌우 정렬**을 본다
//     · 행(row)    = 원근.  뒤로 갈수록 멀어짐 → 반사의 **거리 감쇠·거칠기**를 본다
//     · 높이       = 행을 따라 **선형 램프**.  높이가 반사 길이를 정하므로 사다리로 읽힌다
//   ⚠ 난수를 한 번도 안 쓴다. 같은 그림이 항상 나와야 A/B 가 성립한다.
function testRig(n, tile) {
  const out = [], dy = [];
  const COLS = 4;
  const rows = Math.max(1, Math.ceil(n / COLS));
  // ⚠⚠ 간격은 **반사가 살아 있는 거리 안**에 들어와야 한다. 처음에 타일의 0.16/0.20 으로
  //   깔았더니 4열 × 8행이 42 × 123 월드가 되어 대부분이 화면 밖이었다 — 시험대가 아니다.
  //   reflectFade(14 월드)를 넘어가면 반사가 이미 죽어서 볼 것이 없다.
  //   ⚠ 그래도 숫자를 직접 적지 않고 타일에서 파생시킨다 (불변식 2) — markTile 을 바꾸면
  //     시험대도 같이 따라온다. 지금 값(타일 88)에서 13 × 23 월드다.
  // ⚠ 아래 두 값 중 **큰 쪽**을 쓴다 : 타일에서 파생된 간격과, 부표가 안 겹칠 최소 간격.
  //   반지름의 5배면 구 사이에 제 지름 1.5개만큼 빈다 — 반사를 하나씩 떼어 볼 수 있다.
  const rad = CONFIG.mark.ballR * Math.max(0.05, P.markScale);
  const gapX = Math.max(tile * 0.050, rad * 5.0);
  const gapZ = Math.max(tile * 0.038, rad * 5.0);
  for (let i = 0; i < n; i++) {
    const c = i % COLS, rIdx = Math.floor(i / COLS);
    out.push([(c - (COLS - 1) / 2) * gapX, -(rIdx - (rows - 1) / 2) * gapZ]);
    // 높이 램프 : 앞줄이 낮고 뒷줄이 높다. −1 ~ +1 (배치 코드가 쓰는 것과 같은 범위)
    dy.push(rows > 1 ? (rIdx / (rows - 1)) * 2 - 1 : 0);
  }
  return { out, dy };
}

function scatter(n, tile, seed) {
  const r = rng(seed), out = [];
  const MIN = 4.5, HOME = 4.5;
  const wrapP = (v) => (((v + tile / 2) % tile) + tile) % tile - tile / 2;
  for (let i = 0; i < n; i++) {
    let x = 0, z = 0;
    for (let k = 0; k < 80; k++) {
      x = (r() - 0.5) * tile; z = (r() - 0.5) * tile;
      if (Math.hypot(x, z) < HOME) continue;
      if (out.every(p => Math.hypot(wrapP(p[0] - x), wrapP(p[1] - z)) > MIN)) break;
    }
    out.push([x, z]);
  }
  return out;
}

export function createMarks(scene) {
  const M = CONFIG.mark;
  const A = CONFIG.area;
  // ⚠⚠ **부표 목록이 두 벌이다** (2026-09-11). 앞의 32개는 예전 더미(토러스에 흩뿌림),
  //   뒤의 200개는 향수 지도 CSV(유한 좌표, scentmap.js). `markMap` 이 어느 쪽을 켤지 정한다.
  //   메시를 둘 다 미리 만들어 두는 이유 : 비교 패널 [원본] 으로 **런타임에 오가야** 판정이 된다.
  //   ⚠ 안 켜진 쪽은 m.on = false 라 갱신 루프에서 바로 빠진다 — 비용은 목록 순회뿐이다.
  const LEGACY = CONFIG.scents.map(s => ({ ...s, src: 'legacy' }));
  const FAMS = Object.fromEntries(CONFIG.families.map(f => [f.key, f]));
  const MAPPED = PERFUMES.map((p, j) => {
    const f = FAMS[p.family] || CONFIG.families[0];
    // 카드(MAP-05)에 들어갈 글자. ⚠ CSV 에는 노트가 없다 — 카드는 '—' 로 둔다 (ui.js 규약 :
    //   *"제공 가능한 정보만 표시한다"*). 향조는 카드 위쪽 라벨(zone.name)이 이미 보여 준다
    // ⚠ v0.32.0 : 지도에서는 **향조가 곧 존**이다 (areas.js) — zone 키가 향조 키다
    // ⭐ 한글 판매명 (2026-09-12, markNameKo) — data/perfume_names_ko.csv 에서 생성기가 붙였다. name · sub 는 **영문 원본 그대로** 두고
    //   한글은 따로 싣는다 (카드가 둘 다 보여 준다 — 한글 제목 밑에 영문 원명). labelKo 는 부표 위 이름표용 짧은 이름이다 (농도·연도를 뗐다)
    return { src: 'map', j, zone: f.key, fam: f, name: p.name, sub: p.brand + (p.year ? ' · ' + p.year : ''), notes: '', perfume: p,
      nameKo: p.nameKo || p.name, labelKo: p.labelKo || p.nameKo || p.name,
      subKo: (p.brandKo || p.brand) + (p.year ? ' · ' + p.year : ''), rank: p.rank,
      // 카드 이미지 주소 (2026-09-14, v0.64.0 — ui.js showScent). ⚠ 아직 데이터에 없다 — 생성기나 호스트(백엔드 imageUrl)가 p.img 를 실으면 카드에 뜬다
      img: p.img || '' };
  });
  const POOL = [...LEGACY, ...MAPPED];
  const LEGACY_N = LEGACY.length;

  const group = new THREE.Group();
  group.frustumCulled = false;
  scene.add(group);

  // ── 지오메트리는 전부 공유한다. 부표마다 다른 것은 재질(계열 색·투명도)뿐이다.
  // 분할을 낮게 둔다 — flatShading 과 합쳐져 면이 각져서 배와 같은 결이 된다.
  // 매끈한 구로 두면 색 그라데이션 덩어리가 되어 이 팔레트에서 혼자 튄다
  // ⚠ 2026-09-11 밤 : 위 두 줄은 **markRound 0** 의 이유다. 기본은 매끈한 구(ballRound)다 — 스스로 빛나게 된 뒤로
  //   10각형 윤곽과 면마다 끊기는 톤이 전등이 아니라 보석으로 읽혔다 (사용자 : *"그냥 원형으로"*). paint() 가 바꿔 끼운다
  const geo = {
    ball: new THREE.SphereGeometry(M.ballR, M.segW, M.segH),
    ballRound: new THREE.IcosahedronGeometry(M.ballR, M.roundDetail === undefined ? 12 : M.roundDetail),
    hit: new THREE.SphereGeometry(M.hitR, 6, 4),
    ring: new THREE.RingGeometry(M.ringR, M.ringR + M.ringW, 40)
  };


  // 히트박스 재질은 하나를 공유한다. material.visible = false 면 렌더 목록에 안 들어가지만
  // ⚠ 오브젝트 자체는 살아 있어 Raycaster 에는 그대로 잡힌다. object.visible 로 끄면 안 된다 —
  // three 버전에 따라 레이캐스트에서 통째로 빠져서 클릭이 죽는다
  const hitMat = new THREE.MeshBasicMaterial({ color: 0xC0553F, wireframe: true, visible: false });

  // 테마 색을 고른다. ⚠ `areas[].color` 는 더 이상 안 본다 — 향조는 장소가 아니라
  // 부표의 색이 됐고, 그 색은 `CONFIG.markThemes` 가 정한다 (콘솔에서 넘긴다)
  const themeOf = () => CONFIG.markThemes[clamp(Math.round(P.markTheme), 0, CONFIG.markThemes.length - 1)];
  const colorOf = (zoneKey) => themeOf().colors[zoneKey] || '#AAAAAA';
  // ⚠ 향조 아홉의 색은 `CONFIG.families` 에 **테마 1 기준 한 벌**만 있다. 다른 테마는 여기서 파생시킨다 —
  //   예전 표(markThemes)가 0 → 3 으로 '종이 쪽 → 짙게 → 원본(채도 높음)' 순이었던 것을 흉내 낸다.
  //   ⚠ 손으로 고른 표만큼 정확하지는 않다. 테마를 확정하면 families 에 네 벌을 적는 쪽이 낫다
  const PAPER = new THREE.Color(CONFIG.color.bg), DEEP = new THREE.Color('#3C3A36'), INK = new THREE.Color('#2A2A2A');
  const _hsl = {};
  const famColor = (hex) => {
    const c = new THREE.Color(hex);
    const th = clamp(Math.round(P.markTheme), 0, 3);
    if (th === 0) c.lerp(PAPER, 0.42);
    else if (th === 2) c.lerp(DEEP, 0.20);
    else if (th === 3) { c.getHSL(_hsl); c.setHSL(_hsl.h, Math.min(1, _hsl.s * 1.7), _hsl.l * 0.92); }
    return c;
  };
  // 카드·링의 글자색. ⚠ 부표 색 그대로는 종이 위 글자로 너무 옅다 (#CBA0AA 는 배경 대비 약 1.9:1) —
  //   같은 계열을 먹 쪽으로 눌러 쓴다 (titleColor 를 따로 둔 것과 같은 이유)
  const inkOf = (hex) => '#' + new THREE.Color(hex).lerp(INK, 0.42).getHexString();

  const list = POOL.map((s, i) => {
    // ⚠ 지도 향수의 zone 은 **향조 그 자체**다 (v0.32.0). 카드 라벨 'CITRUS' 와 [이 향의 해역으로] 가
    //   같은 곳을 가리킨다 (v0.31.0 에는 'fresh' 존으로 갔다). 글자색만 먹 쪽으로 누른다 (inkOf)
    const zone = s.src === 'map'
      ? { key: s.fam.key, name: s.fam.name, color: inkOf(s.fam.color), area: s.fam }
      : (CONFIG.areas.find(a => a.key === s.zone) || CONFIG.areas[0]);
    const root = new THREE.Group();
    // 재질은 부표마다 따로 갖는다 — 거리 페이드가 opacity 라서 공유하면 전부 같이 사라진다.
    // ⚠ 색은 계열 색 그대로다. 흰 종이로 두면 흰 물 위에서 통째로 안 읽힌다 —
    // 네 조각짜리 옛 형태에서도 실제로 읽히던 것은 색 띠와 꼭대기뿐이었다
    const tint = new THREE.MeshStandardMaterial({
      color: s.src === 'map' ? famColor(s.fam.color) : new THREE.Color(colorOf(zone.key)),
      roughness: 0.86, metalness: 0, flatShading: true, transparent: true
    });
    tint.onBeforeCompile = patchSelfLit;
    tint.customProgramCacheKey = () => 'markSelfLit2';
    // root 의 원점이 곧 구의 중심이다 (= params.markHeight 높이)
    const ball = new THREE.Mesh(geo.ball, tint);
    root.add(ball);
    // ⭐ **발광 쌍둥이** (2026-09-11 오후). 같은 구를 순색으로 — 레이어 3 에만 있어 본 카메라에는 안 찍히고,
    //   bloom.js 의 GlowPass 가 이것만 모아 번짐을 낸다 (부표만 번지는 블룸). 색 = 향조 색 × exposure (HDR 가능).
    //   ⚠ 반사 패스(레이어 2)에 안 들어가게 noReflect 를 단다 (reflect.js add 가 건너뛴다)
    //   ⚠ 조명·안개·톤 매핑을 안 탄다 — 발광원은 **순색**이라야 번짐이 향조 색을 지닌다
    // ⚠⚠ **transparent — 불투명도가 곧 몸통 마스크의 세기다** (2026-09-11 밤). GlowPass 는 이 쌍둥이가 원천 타깃에 쓴 **알파**를
    //   몸통 마스크로 쓴다 (번짐을 몸통 위에서 걷는다). 예전에는 불투명이라 페이드 1% 짜리 먼 부표도 알파 1 을 써서 **이웃 부표의 번짐에
    //   원판 모양 구멍**을 뚫었다 — 흰 종이 위에서는 번짐이 옅어 안 보였고, 밤바다에서 수평선의 **어두운 원판**으로 드러났다
    //   (실측 : 쌍둥이를 끄자 그 자리가 98,88,113 → 171,128,153 으로 **밝아졌다**). 색은 페이드 없이 두고 불투명도가 곱한다 — 번짐 세기는 예전과 같다
    const glowMat = new THREE.MeshBasicMaterial({ color: 0x000000, fog: false, toneMapped: false, transparent: true });
    const glow = new THREE.Mesh(geo.ball, glowMat);
    glow.layers.set(GLOW_LAYER);
    glow.userData.noReflect = true;
    glow.frustumCulled = true;
    root.add(glow);

    // 히트박스 — 보이는 것(작은 구)과 클릭 대상(큰 구)을 분리한다.
    // 모바일 터치 정확도와 원경 클릭이 이 하나로 같이 해결된다
    const hit = new THREE.Mesh(geo.hit, hitMat);
    hit.layers.enable(1);   // 레이캐스터가 이 레이어만 본다 → 수면 메시가 절대 안 걸린다
    root.add(hit);

    group.add(root);
    const m = {
      ...s, i, zone,
      root, tint, hit, glow, glowMat, ball,
      base: new THREE.Color(),   // 발광 쌍둥이의 바탕색 = 향조 색의 채도를 markGlowSat 배 올린 것 (선형). paint() 가 채운다
      x: 0, z: 0,        // 월드 좌표 (배치에서 채운다)
      dy: 0,             // 높이 흔들기 (−1..1). 배치에서 한 번 정해지고 안 바뀐다
      sx: 0, sz: 0,      // 씬 좌표 (매 프레임 갱신)
      wy: 0,             // 이 부표가 떠 있는 높이 (markHeight + 흔들기)
      sy: 0,             // 그 자리의 **수면** 높이. 선택 링만 쓴다
      on: false, fade: 0,
      // 인기 순위 크기 (2026-09-12) — k0 = 순위 단계 배율 (layoutMap 이 채운다, 예전 더미는 1) · kNow = 지금 몸통에 걸린 배율 ·
      //   rw = 지금 몸통의 **월드 반지름** (이름표 자리 · 링). ⚠ 히트박스(hit)는 단계 배율을 안 탄다 — 작은 부표도 누르기 쉬워야 한다
      //   ⭐ 2026-09-13 저녁 (markHitFit 1) : 히트박스가 몸통을 따른다 — 몸통 × markHitK · 화면 최소 markHitMinPx (update 가 hit.scale 을 맞춘다). 위 줄은 markHitFit 0
      k0: 1, kNow: 1, rw: 0, lit0: 1
    };
    hit.userData.mark = m;
    return m;
  });

  // 선택 링은 하나뿐이다 — 고른 부표 밑으로 옮겨 다닌다
  const ringMat = new THREE.MeshBasicMaterial({
    transparent: true, opacity: 0.85, depthWrite: false, side: THREE.DoubleSide
  });
  const ring = new THREE.Mesh(geo.ring, ringMat);
  ring.rotation.x = -Math.PI / 2;
  ring.renderOrder = 6;
  ring.visible = false;
  group.add(ring);

  const ray = new THREE.Raycaster();
  ray.layers.set(1);
  const ndc = new THREE.Vector2();
  const hitList = list.map(m => m.hit);
  const _hv = new THREE.Vector3(), _pv = new THREE.Vector3();   // 히트박스 크기 · 겹침 고르기 (markHitFit — update · pick)

  let selected = null;
  let laidKey = '', laidTheme = -1;
  let laidAdd = false;   // 부표를 더해서 그리는 중인가 (시간대 — update 의 marksAdd 주석)
  // 배치를 다시 해야 하는 값들. ⚠ 새 배치 손잡이를 만들면 여기에 넣는다 — 안 넣으면 슬라이더가 안 먹는다
  const layoutKey = () => [
    P.markMap >= 0.5 ? 1 : 0, Math.round(P.markCount), P.markTile, P.markLayout >= 0.5,
    Math.round(P.markLiftN), P.markLiftH, P.mapSize, P.mapMinGap, P.mapFlipY, Math.round(P.mapCount)
  ].join('|');
  // 지금 켜진 지도 (markMap 1 일 때만). 존 대표 지점을 zones.js 가 여기서 읽는다
  let map = null;

  // ── 향수 고르기 (2026-09-11, v0.32.0). 사용자 : *"해당 향수를 클릭하면 주변 부표가 가라앉고 배의
  //   좌표값 제일 가까운 추천 향수 12개를 연출 구도에 맞게 쉽게 클릭할 수 있도록 바다 위에 떠오르게"*.
  //   in  : 전부 가라앉는다(0 → sink) · 고른 12개는 riseAt 에 **슬롯 자리로 옮겨** 물속에서 솟는다(outBack)
  //   out : 12개가 슬롯에서 가라앉고 · riseAt 부터 모두가 **제 좌표에서** 다시 떠오른다
  //   ⚠ 슬롯은 main.js 가 **연출 구도의 최종 카메라**로 계산해 준다 (씬 좌표 = 배 기준). 카메라가 옮겨 가는
  //     동안에도 부표는 제자리에서 솟고, 카메라가 도착하면 화면의 슬롯에 앉는다 — 매 프레임 지금 카메라로
  //     다시 계산하면 트윈 동안 부표가 물 위를 **미끄러진다**.
  //   ⚠ 12개는 **배에서** 가장 가까운 것이다 (사용자 말 그대로). 누른 향수가 그 안에 없으면 12번째를 그걸로 바꾼다.
  //   ⚠ 슬롯 짝짓기는 **화면의 좌우 순서를 지킨다** — 실제 자리의 화면 x 로 정렬해 슬롯(화면 x 순)에 붙인다.
  //     아무렇게나 붙이면 왼쪽에 있던 것이 오른쪽에서 솟아 '어디 있던 향수인지' 가 끊긴다.
  let focus = null;   // { mode: 'in' | 'out', t, slots: Map(m → {x, y, z, sx}), clicked }
  const DEPTH = 1.5;  // 가라앉는 깊이 (수면 아래, 월드). 부표 반지름(1.02)보다 깊어야 물에 다 잠긴다
  const FT = () => {
    const spreadSink = Math.max(0, P.focusSinkSpread === undefined ? 0.5 : P.focusSinkSpread);
    const spreadRise = Math.max(0, P.focusRiseSpread === undefined ? 0.55 : P.focusRiseSpread);
    const inOut = (P.focusSinkEase === undefined ? 1 : P.focusSinkEase) >= 0.5;
    return {
      sink: Math.max(0.05, P.focusSinkT === undefined ? 0.45 : P.focusSinkT),
      riseAt: Math.max(0, P.focusRiseAt === undefined ? 0.35 : P.focusRiseAt),
      rise: Math.max(0.05, P.focusRiseT === undefined ? 0.8 : P.focusRiseT),
      spreadSink, spreadRise, inOut,
      jitter: clamp(P.focusSpreadJitter === undefined ? 0.25 : P.focusSpreadJitter, 0, 1),
      // ⚠ 셋 다 꺼져 있으면 예전과 **값 단위로** 같아야 한다 (비교 패널 [원본]) — 아래 갱신이 이걸 보고 예전 식을 탄다
      staggered: spreadSink > 0 || spreadRise > 0 || inOut
    };
  };

  // ⭐⭐ **부표마다 시차** (2026-09-13, focusSinkSpread · focusRiseSpread) — 사용자 : *"부표가 일정하게 내려갔다가 사라지는데
  //   각 부표도 ease in out 값을 줘서 극적 연출"*. 한꺼번에 움직이면 기계처럼 읽힌다. 그런데 **아무렇게나** 늦추면 소란스럽다 —
  //   순서에 뜻을 준다 :
  //     들어갈 때 · 나머지 : **누른 부표에서 가까운 것부터** 물결처럼 잠긴다 (누른 자리가 돌을 던진 자리다)
  //     들어갈 때 · 12개   : **앞(깊이 비율 0)에서 뒤로** 차례로 솟는다 — 무리가 바다 뒤쪽으로 뻗어 나가는 순서다
  //     나갈 때 · 12개     : **뒤에서부터** 잠긴다 (들어올 때의 반대)
  //     나갈 때 · 모두     : **누른 자리에서 바깥으로** 다시 떠오른다
  //   ⚠ 무작위 몫(focusSpreadJitter)은 부표마다 **고정된** 값이다 (번호로 만든 해시) — 같은 향수를 누르면 같은 순서다
  //   ⚠ 시차는 **누를 때 · 접을 때 한 번** 정한다 — 매 프레임 다시 재면 배가 움직이는 동안 순서가 바뀐다
  const RIPPLE = 60;   // 물결에 줄 세울 부표의 반경 — **배에서** (월드). 연출 구도에서 보일 수 있는 부표가 대략 이 안이다
  // 물결 순서 (0 먼저 · 1 나중) — 배 둘레 RIPPLE 안의 부표를 **누른 자리에서 가까운 차례로 줄 세워** 0~1 로 편다.
  //   ⚠⚠ 거리를 반경으로 나누면 안 된다 — 누른 자리 이웃은 12개가 다 차지해서 나머지가 **전부 반경 밖**에 몰리고
  //     같은 최대 시차를 받아 **한꺼번에** 잠겼다 (실측 2026-09-13 : 배 둘레 60 월드 안 다섯이 전부 누른 자리에서 40 밖 ·
  //     0.47~0.57초). 순위로 펴면 주변이 성기든 빽빽하든 시차 폭 전체를 쓴다. 줄에 못 든 부표는 1 (가장 늦게)
  function rippleOrder(f, withSlots) {
    const pool = list.filter(q => q.on && (withSlots || !f.slots.has(q)) && Math.hypot(q.x - f.bx, q.z - f.bz) < RIPPLE);
    pool.sort((a, b) => Math.hypot(a.x - f.cx, a.z - f.cz) - Math.hypot(b.x - f.cx, b.z - f.cz));
    const o = new Map();
    pool.forEach((q, i) => o.set(q, pool.length > 1 ? i / (pool.length - 1) : 0));
    return o;
  }
  const jitOf = (q) => { const h = Math.sin(((q.i || 0) + 1) * 12.9898) * 43758.5453; return h - Math.floor(h); };
  const orderMix = (o, q, J) => (1 - J) * clamp(o, 0, 1) + J * jitOf(q);
  // 12개의 솟는 순서 (0 앞 · 1 뒤) — 깊이 배치가 준 깊이 비율(slot.t). 없으면(흩기) 배(씬 원점)에서의 거리
  function riseOrder(slots) {
    const v = new Map();
    let mx = 1e-6;
    for (const [q, sl] of slots) { const o = sl.t !== undefined ? sl.t : Math.hypot(sl.x, sl.z); v.set(q, o); mx = Math.max(mx, o); }
    for (const [q, o] of v) v.set(q, o / mx);
    return v;
  }
  function staggerIn(f) {
    const ft = FT(), d = new Map(), ro = riseOrder(f.slots), rip = rippleOrder(f, false);
    for (const q of list) {
      if (!q.on) continue;
      if (f.slots.has(q)) d.set(q, ft.spreadRise * orderMix(ro.get(q), q, ft.jitter));
      else d.set(q, ft.spreadSink * orderMix(rip.has(q) ? rip.get(q) : 1, q, ft.jitter));
    }
    f.dIn = d;
  }
  function staggerOut(f) {
    const ft = FT(), down = new Map(), up = new Map(), ro = riseOrder(f.slots);
    for (const [q] of f.slots) down.set(q, ft.spreadSink * orderMix(1 - ro.get(q), q, ft.jitter));
    // 다시 떠오르는 줄에는 **12개의 제 자리도** 넣는다 — 그것들이 누른 자리에 가장 가깝다
    const rip = rippleOrder(f, true);
    for (const q of list) if (q.on) up.set(q, ft.spreadRise * orderMix(rip.has(q) ? rip.get(q) : 1, q, ft.jitter));
    f.dDown = down; f.dUp = up;
    // ⚠ 모두가 떠오르기 시작하는 때를 **잠기는 시차만큼** 미룬다 — 안 미루면 뒤늦게 잠기는 12개가 떠오르는 차례에 걸려
    //   슬롯에서 제 좌표로 **순간이동**한다
    f.riseAtOut = ft.riseAt + ft.spreadSink;
  }

  // 배치. 배치 손잡이가 바뀌면 다시 깐다 (패널에서 슬라이더를 끌면 즉시 다시 깔린다)
  function layout() {
    laidKey = layoutKey();
    focus = null;   // ⚠ 배치가 바뀌면 슬롯 짝이 무의미해진다 — 향수 고르기를 접는다
    if (P.markMap >= 0.5) { layoutMap(); return; }
    map = null;
    list.forEach(m => { if (m.src === 'map') { m.on = false; m.root.visible = false; m.fade = 0; } });
    layoutLegacy();
  }

  // ── 향수 지도 (2026-09-11). 자리는 scentmap.js 가 정한다 — 여기서는 옮겨 담기만 한다
  function layoutMap() {
    map = scentMap({ size: Math.max(40, P.mapSize), minGap: Math.max(0, P.mapMinGap), flipY: P.mapFlipY });
    // ⚠ 개수는 **순위로** 자른다 (korea_selection_rank). 앞의 77개가 화해 지도 편입분이고
    //   나머지 123개는 구매 데이터로 채운 것이다 (CSV 의 basis 열)
    const nMax = clamp(Math.round(P.mapCount === undefined ? 200 : P.mapCount), 0, map.points.length);
    // 높이 흔들기 — 예전과 같은 규칙 (배치와 다른 시드). ⚠ 켜지든 말든 **모든 향수에 대해 한 번씩**
    //   뽑는다. 켜진 것만 뽑으면 mapCount 를 바꿀 때마다 나머지의 높이가 바뀐다
    const r = rng(77003);
    list.forEach(m => {
      if (m.src !== 'map') { m.on = false; m.root.visible = false; m.fade = 0; return; }
      const p = map.points[m.j];
      const dy = r() * 2 - 1;
      m.on = p.rank <= nMax;
      m.k0 = tierOf(p.rank);     // 인기 순위 크기 단계 (update 가 markRankSize 로 켜고 끈다)
      m.lit0 = litOf(p.rank);    // 인기 순위 밝기 단계 (update 가 markRankLight 로 켜고 끈다)
      if (m.on) { m.x = p.x; m.z = p.z; m.dy = dy; m.lift = 0; }
      else { m.root.visible = false; m.fade = 0; }
    });
    if (selected && !selected.on) api.clearSelect();
  }

  function layoutLegacy() {
    const MAX = LEGACY_N;
    const n = clamp(Math.round(P.markCount), 0, MAX);
    const tile = Math.max(8, P.markTile);
    // ⚠ markLayout 1 = 반사 시험대. 난수 없이 격자로 깐다 (위 testRig 주석 참고)
    const rig = P.markLayout >= 0.5 ? testRig(n, tile) : null;
    const pos = rig ? rig.out : scatter(n, tile, 20260903);
    // 높이 흔들기용 시드 RNG. ⚠ 배치와 **같은 시드를 쓰면 안 된다** — 자리와 높이가
    // 같은 수열에서 나오면 규칙이 눈에 보인다 (오른쪽으로 갈수록 높아지는 식)
    const r = rng(77003);
    // ⚠ 예전 32개만 돈다 (지도 향수는 layout() 이 이미 껐다). 앞에 있으므로 i 가 곧 예전 번호다
    list.forEach((m, i) => {
      if (m.src !== 'legacy') return;
      m.on = i < n;
      if (m.on) {
        m.x = pos[i][0]; m.z = pos[i][1];
        // ⚠ 전부 같은 높이면 '자로 재서 걸어 놓은 것' 으로 보인다 (사용자 지적).
        // 값은 부표마다 고정이다 — 매 프레임 흔들면 그건 부유지 배치가 아니다
        // ⚠ 시험대에서는 높이도 **규칙**이라야 한다. 난수를 섞으면 사다리가 안 읽힌다
        m.dy = rig ? rig.dy[i] : (r() * 2 - 1);
        // ⚠⚠ **몇 개만 띄운다** (2026-09-07). 사용자 : *"혹시 몇 개의 오브젝트만 위로
        //   띄워 볼래?"*
        //   ⚠ 난수로 고르지 않는다 — 배치를 다시 깔 때마다 다른 것이 뜨면 A/B 가 안 된다.
        //     **일정 간격(stride)으로** 고르므로 같은 markLiftN 이면 늘 같은 것이 뜬다.
        //   ⚠ 앞에서부터 n 개를 고르면 시험대에서 **한 줄이 통째로** 뜬다 (열이 3 이므로).
        //     간격으로 고르면 화면에 골고루 흩어져서 비교가 된다.
        const liftN = Math.max(0, Math.round(P.markLiftN));
        const stride = liftN > 0 ? Math.max(1, Math.round(n / liftN)) : 0;
        m.lift = (liftN > 0 && i % stride === 0 && Math.floor(i / stride) < liftN)
          ? P.markLiftH : 0;
      } else { m.root.visible = false; m.fade = 0; }
    });
    if (selected && !selected.on) api.clearSelect();
  }

  // 칠을 다시 해야 하는 값들. ⚠ 알베도 배율(markAlbedo)도 여기 든다 — 슬라이더를 끌면 즉시 다시 칠한다
  const sunOn = () => (P.markSelfLit === undefined ? 1 : P.markSelfLit) >= 0.5 && (P.markSun === undefined ? 1 : P.markSun) >= 0.5;
  const roundOn = () => (P.markRound === undefined ? 1 : P.markRound) >= 0.5;
  const paintKey = () => [Math.round(P.markTheme), (P.markSelfLit === undefined ? 1 : P.markSelfLit) >= 0.5 ? 1 : 0,
    P.markAlbedo === undefined ? 1 : P.markAlbedo, P.markGlowSat === undefined ? 1 : P.markGlowSat, sunOn() ? 1 : 0, roundOn() ? 1 : 0].join('|');
  const _gh = {};
  // 테마가 바뀌면 재질 색만 다시 칠한다 (지오메트리·배치는 그대로)
  function paint() {
    // ⭐ 스스로 빛날 때(markSelfLit)는 **햇빛이 칠하는 몫(알베도)을 줄인다** — 사용자 : *"지금 햇빛에 반사되어 빛 표현이
    //   되고 있는데 향수 부표 자체가 빛나는 표현이 들어가야함"*. 발광은 그대로 향조 색이다 (아래 emissive)
    const selfLit = (P.markSelfLit === undefined ? 1 : P.markSelfLit) >= 0.5;
    const alb = selfLit ? (P.markAlbedo === undefined ? 1 : P.markAlbedo) : 1;
    // ⭐ 모양 (markRound) — 몸통 · 발광 쌍둥이를 같은 지오메트리로 바꿔 끼운다 (반사 패스는 몸통을 그대로 그리므로 따라온다).
    //   ⚠ flatShading 은 프로그램 정의라 바뀔 때만 needsUpdate — 매번 걸면 부표마다 다시 컴파일한다
    const round = roundOn(), bg = round ? geo.ballRound : geo.ball;
    list.forEach(m => {
      m.ball.geometry = bg; m.glow.geometry = bg;
      if (m.tint.flatShading === round) { m.tint.flatShading = !round; m.tint.needsUpdate = true; }
      // ⚠ 지도 향수는 **향조 색**(families), 예전 더미는 **존 색**(markThemes)이다
      const c = m.src === 'map' ? famColor(m.fam.color) : new THREE.Color(colorOf(m.zone.key));
      // ⚠ 발광 쌍둥이(번짐의 원천)는 **채도를 올린 색**이다 (markGlowSat). 향조 색이 전부 옅은 파스텔
      //   (#CBA0AA · #A38F7C · #95B4C0 …)이라 빛으로 번지면 흰 종이 위에서 그냥 **흰 빛**이 된다. 몸통은 원래 색 그대로다
      m.base.copy(c);
      c.getHSL(_gh);
      m.base.setHSL(_gh.h, Math.min(1, _gh.s * (P.markGlowSat === undefined ? 1 : P.markGlowSat)), _gh.l);
      m.tint.color.copy(c).multiplyScalar(alb);
      // ⚠⚠ **발광색은 몸통색과 같다** (2026-09-07). 사용자 : *"부표에 bloom 을 줘봐,
      //   각자 색상을 가지고 있는 값으로."*
      //   ⚠ 블룸(bloom.js)은 **전역 후처리**라 밝은 곳이면 어디든 번진다. 물이 이미
      //     213~236 이라 문턱을 낮추면 화면 전체가 번지고, 그건 흰 종이 위에서 그림을
      //     지우는 것이다 (불변식 14, bloom.js 주석이 같은 경고를 한다).
      //   ⚠ 그래서 **부표를 물보다 밝게 만들어** 높은 문턱을 혼자 넘게 한다. 발광은
      //     조명을 안 타므로 emissive 값이 그대로 화면 밝기가 된다 — 문턱 위로 올릴 수 있다.
      //   ⚠ 색을 여기서 정하지 않는다. 몸통과 **같은 colorOf** 를 쓴다 — 계열 색이 하나의
      //     출처(CONFIG.markThemes)에서 나와야 몸통과 후광이 안 갈라진다 (불변식 2).
      // ⭐ 태양(markSun)일 때는 발광이 **번짐과 같은 채도 올린 색**(m.base)이다 — 가운데는 어차피 흰색으로 녹고,
      //   색은 테두리에만 남으므로 옅은 파스텔 그대로면 테두리까지 희끄무레해진다. 출처는 여전히 같은 향조 색 하나다
      m.tint.emissive.copy(sunOn() ? m.base : c);
    });
    laidTheme = paintKey();
  }

  const api = {
    group, list,
    get selected() { return selected; },
    // 지금 켜진 향 지도 (markMap 0 이면 null). 미니맵이 여기서 받는다
    get map() { return map; },
    // 그 존(= 향조)의 대표 향수 자리(월드). 지도가 꺼져 있으면 null — zones.js 가 예전 좌표로 돌아간다
    anchorOf(zoneKey) { return map && zoneKey ? (map.familyAnchors[String(zoneKey).toUpperCase()] || null) : null; },

    // ── 향수 고르기 (위 focus 주석) ─────────────────────────────────────────
    // 들어가 있거나 들어가는 중인가. ⚠ 나가는 중('out')은 false — 새로 누르면 다시 들어갈 수 있다
    get focusing() { return !!focus && focus.mode === 'in'; },
    // 나가는 애니메이션까지 포함해 아직 무언가 움직이는가 (main.js 가 카메라를 이걸로 민다)
    get focusActive() { return !!focus; },
    inFocus(m) { return !!focus && focus.mode === 'in' && focus.slots.has(m); },
    // 지금 고르기의 중심(누른 향수). 나가는 중이면 null — [주변 향 탐색]이 이미 중심인 향을 다시 띄우지 않게 본다 (v0.68.0 — main.js canExplore)
    get focusCenter() { return focus && focus.mode === 'in' ? focus.clicked : null; },

    // m = 누른 향수 · boatX/boatZ = 배의 **월드** 좌표 · slots = [{x,y,z (씬), sx (화면 x)}]
    // toScreen(x, y, z) = 최종 연출 카메라로 씬 좌표를 화면에 투영 (슬롯 짝짓기용)
    // place(set, m) = (선택) 자리를 **향수마다** 정하는 배치기 → Map(향수 → 슬롯). 주면 화면 x 순서 짝짓기 대신 그 결과를 쓴다
    //   ⭐ 2026-09-13 : 깊이 배치(main.js focusDepthPlace)가 이걸 준다 — 누가 누구와 이어지는지에 따라 자리가
    //     달라서 '몇 번째 슬롯' 으로는 못 정한다. ⚠ 고르는 12개(배에서 가까운 순 + 누른 것)는 **여기서** 정한다 — 그대로다
    focusOn(m, { boatX, boatZ, slots, toScreen, place }) {
      if (!map || !m || m.src !== 'map' || ((!slots || !slots.length) && !place)) return false;
      // ⭐ 다시 띄우기 (2026-09-15, v0.68.0 — main.js exploreAround · [주변 향 탐색]). 들어가 있는 고르기를 새 중심으로 바꾸면 앞 슬롯을 기억해 둔다 —
      //   떠 있던 12개가 **그 자리에서** 잠기게 (아래 틱). ⚠ 나가는 중('out')에서 새로 누른 것은 예전 그대로다
      const prev = focus && focus.mode === 'in' ? focus.slots : null;
      const n = clamp(Math.round(P.focusCount === undefined ? 12 : P.focusCount), 1, place ? 24 : slots.length);
      const d2 = (q) => (q.x - boatX) ** 2 + (q.z - boatZ) ** 2;
      const set = list.filter(q => q.on && q.src === 'map').sort((a, b) => d2(a) - d2(b)).slice(0, n);
      if (!set.includes(m)) set[set.length - 1] = m;
      if (place) {
        const pl = place(set, m);
        if (pl && pl.size === set.length) { focus = { mode: 'in', t: 0, slots: pl, clicked: m, cx: m.x, cz: m.z, bx: boatX, bz: boatZ, prev }; staggerIn(focus); return true; }
        if (!slots || !slots.length) return false;   // 배치기가 실패하고 되돌아갈 슬롯도 없으면 들어가지 않는다
      }
      // 화면 좌우 순서를 지킨다 — 지금 자리(씬 = 월드 − 배)를 최종 카메라로 투영한 x 로 정렬
      const scr = new Map(set.map(q => [q, toScreen(q.x - boatX, P.markHeight, q.z - boatZ).x]));
      set.sort((a, b) => scr.get(a) - scr.get(b));
      const sl = slots.slice(0, set.length).sort((a, b) => a.sx - b.sx);
      focus = { mode: 'in', t: 0, slots: new Map(set.map((q, i) => [q, sl[i]])), clicked: m, cx: m.x, cz: m.z, bx: boatX, bz: boatZ, prev };
      staggerIn(focus);
      return true;
    },
    focusOff() { if (focus && focus.mode === 'in') { focus.mode = 'out'; focus.t = 0; staggerOut(focus); } },

    // ⭐ 부표 이름표 (2026-09-12, markLabels) — 지금 보이는 부표 **전부**. main.js 가 몸통 꼭대기를 투영해 ui.showMarkLabels 로 넘긴다.
    //   x·y·z = 몸통 중심(씬) · r = 몸통 월드 반지름 · a = 보이는 정도 · pri = 겹칠 때의 우선(작을수록 먼저 — 고른 부표 →
    //   향수 고르기의 12개 → 인기 순위) · top = TOP 10 (글자를 조금 굵게)
    //   ⚠ 글자는 markNameKo 를 따른다 — 지도 향수는 한글 짧은 이름(labelKo), 꺼져 있으면 영문 원본
    labelItems() {
      const out = [];
      const ko = (P.markNameKo === undefined ? 1 : P.markNameKo) >= 0.5;
      for (const m of list) {
        if (!m.on || !m.root.visible || m.fade < 0.03) continue;
        const inSlot = !!focus && focus.slots.has(m);
        const text = m.src === 'map' && ko ? m.labelKo : m.name;
        const rank = m.rank || 999;
        out.push({ m, x: m.sx, y: m.wy, z: m.sz, r: m.rw, a: m.fade, text,
          pri: (m === selected ? -2000 : 0) + (inSlot ? -1000 : 0) + rank, top: rank <= 10 });
      }
      return out;
    },

    // ⭐ 유사 연결선 (2026-09-12 오후, links.js) — 향수 고르기의 12개를 **유사도 자료와 함께** 넘긴다.
    //   ⭐⭐ 2026-09-14 (v0.62.0) : 유사도는 **데이터 neighbors**(`perfume.nb` — 닮은 향수 10개)다. 짝을 재는 식은 links.js `linkSim` · `linkDiff` 하나다.
    //     `focusLinkBasis 0` 이면 예전처럼 향 지도 좌표(`perfume.mx/my`, CSV 원본 0~1) 거리다 — 그때도 월드 좌표(m.x/m.z)가 아니라
    //     **원본 좌표로 잰다** (mapSize·겹침 풀기(mapMinGap)가 섞이면 화면 설정에 따라 이웃 순서가 조금 달라진다)
    //   ⚠ x·y·z 는 **지금 자리**다 (슬롯이 아니라) — 솟는 동안 선이 부표를 따라 자란다
    //   ⚠ 슬롯에 서 있을 때만 넘긴다 (focusItems 와 같은 문지기) — 나갈 때 제 좌표로 돌아간 부표를 이으면 선이 바다를 가로지른다
    linkItems() {
      if (!focus) return null;
      const out = [];
      // ⭐⭐ **어느 색을 줄 것인가** (2026-09-12 저녁, `focusLinkSrc`). 1 = 발광색 · 0 = 몸통색(예전).
      //   ⚠⚠ 몸통색(`m.tint.color`)은 향조 색에 **알베도 0.22** 를 곱한 것이다 (`paint()`) — 스스로
      //     빛나는 부표라 햇빛 몫을 줄여 놓은 값이지, 눈에 보이는 색이 아니다. 그걸 선에 그대로 쓰니
      //     CITRUS 가 #d4be2c 가 아니라 **#615932** 로 나가 아홉 향조가 회갈색으로 뭉쳤다 (실측).
      //   ⭐ 화면에서 부표로 보이는 것은 **발광 쌍둥이의 색**(`m.base`)이다 — 그래서 발광색을 주는 쪽이
      //     불변식 2(선과 부표가 갈라질 수 없다)를 **더 잘** 지킨다. 출처는 여전히 같은 향조 색 하나다.
      const srcGlow = (P.focusLinkSrc === undefined ? 1 : P.focusLinkSrc) >= 0.5;
      for (const [m, s] of focus.slots) {
        const p = m.perfume;
        // ⚠ 2026-09-13 : **아직 물속인 것도 넘긴다** (a = 0). 12개가 시차를 두고 솟으므로, 보이는 것만 넘기면
        //   부표가 하나 뜰 때마다 목록이 바뀌어 links.js 가 무리를 다시 짜고 **선이 처음부터 다시 그어졌다**.
        //   보이는지는 links.js 가 변마다 본다 (양 끝이 떠오른 뒤에 뻗는다)
        if (!p || m.sx !== s.x) continue;
        // ⚠ `col` 은 **색 참조**다 (복사하지 않는다 — 매 프레임 도는 자리라 할당을 안 만든다).
        //   links.js 는 읽기만 한다. 색을 여기서 새로 계산하지 않는 것이 요점이다 —
        //   `paint()` 가 정한 그 색이라야 선과 부표가 갈라질 수 없다 (불변식 2 의 규율)
        out.push({ id: p.id, nb: p.nb, mx: p.mx, my: p.my, x: m.sx, y: m.wy, z: m.sz, a: m.fade, r: m.rw,
                   col: srcGlow ? m.base : m.tint.color, clicked: m === focus.clicked });
      }
      return out;
    },

    // 떠 있는 12개의 자리 (DOM 라벨용). a = 보이는 정도 0..1
    focusItems() {
      if (!focus) return [];
      const out = [];
      for (const [m, s] of focus.slots) {
        if (!m.root.visible || m.fade < 0.02 || m.sx !== s.x) continue;   // 슬롯에 서 있을 때만
        out.push({ m, x: s.x, y: m.wy, z: s.z, a: m.fade });
      }
      return out;
    },

    update(sim, { scroll, stepped, cam, dt = 0, viewH = 0 }) {
      group.visible = P.showMarks;
      if (!P.showMarks) return;
      if (layoutKey() !== laidKey) layout();
      if (paintKey() !== laidTheme) paint();
      hitMat.visible = P.showMarkHits;
      // ── 스스로 빛남 · 발광 쌍둥이 · 반투명 (2026-09-11 오후) — 값은 params.js 의 markSelfLit 묶음
      const selfLit = (P.markSelfLit === undefined ? 1 : P.markSelfLit) >= 0.5;
      GLOW_UNI.uRim.value = selfLit ? (P.markRim === undefined ? 0.45 : P.markRim) : 1;   // 1 = 예전 (곱하는 인자 1)
      GLOW_UNI.uCore.value = Math.max(0.05, P.markCore === undefined ? 1.6 : P.markCore);
      // 태양 (2026-09-11 밤) — 위 patchSelfLit 주석. ⚠ markSelfLit 0(예전 경로)이면 같이 꺼진다
      const sun = sunOn();
      GLOW_UNI.uSun.value = sun ? 1 : 0;
      GLOW_UNI.uSunHot.value = P.markSunHot === undefined ? 9 : P.markSunHot;
      GLOW_UNI.uSunEdge.value = P.markSunEdge === undefined ? 2.0 : P.markSunEdge;
      GLOW_UNI.uSunCore.value = Math.max(0.02, P.markSunCore === undefined ? 0.4 : P.markSunCore);
      // ⭐ 시간대 (2026-09-11 밤 — 시안) — 저녁·밤에는 태양 부표를 **더해서** 그린다 (CONFIG.times 의 marksAdd).
      //   거리 페이드가 바탕과 **섞는** 대신 빛을 **더하므로** 멀어지는 부표가 회색 원판이 아니라 옅어지는 빛이 된다.
      //   ⚠ 낮(흰 종이)에는 끈다 — 더할 자리가 없다. ⚠ blending 은 그리기 상태라 다시 컴파일하지 않는다. 바뀔 때만 칠한다
      const TM = timeNow();
      const add = sun && !!(TM && TM.marksAdd);
      if (add !== laidAdd) {
        laidAdd = add;
        for (const m of list) m.tint.blending = add ? THREE.AdditiveBlending : THREE.NormalBlending;
      }
      const gBody = P.markGlowBody === undefined ? 0.95 : P.markGlowBody;
      const glowOn = selfLit && (P.markBloom || 0) > 0;
      const gExp = P.markBloomExposure === undefined ? 1.6 : P.markBloomExposure;
      // ⚠ 태양은 멀어도 반투명이 아니다 (markSunSolid) — 반투명은 빛을 흐리게 하지 않고 바탕과 섞는다 (params.js 주석).
      //   markAlphaFar · markGlowFar 값 자체는 v0.34.0 그대로 두고 여기서 건너뛴다 — 비교 패널 두 묶음이 같은 키를 잡지 않게
      const sunSolid = sun && (P.markSunSolid === undefined ? 1 : P.markSunSolid) >= 0.5;
      const aFar = sunSolid ? 1 : clamp(P.markAlphaFar === undefined ? 1 : P.markAlphaFar, 0, 1);
      const gFar = sunSolid ? 1 : clamp(P.markGlowFar === undefined ? 1 : P.markGlowFar, 0, 1);
      const r0 = P.markSolidR0 === undefined ? 8 : P.markSolidR0;
      const r1 = Math.max(r0 + 0.01, P.markSolidR1 === undefined ? 18 : P.markSolidR1);
      // ⭐ **배를 가리는 부표는 비친다** (2026-09-11 오후). 도착 연출(존 구도)에서 카메라가 배에 바짝 붙으면 배 둘레의 부표가
      //   카메라 앞에 크게 서서 **배를 통째로 덮었다** (돛대 끝만 보였다 — 화면으로 확인). 게임에서 주인공을 가리는 벽을
      //   비치게 하는 것과 같다 : 카메라 → 배(0, 1.5, 0) 선분에 가까운 부표만 markBlockAlpha 까지 흐려진다.
      //   ⚠ 배 **뒤**의 부표는 안 흐린다 (선분 밖) · 1 이면 끈다
      const blockA = clamp(P.markBlockAlpha === undefined ? 1 : P.markBlockAlpha, 0, 1);
      const cpx = cam ? cam.position.x : 0, cpy = cam ? cam.position.y : 0, cpz = cam ? cam.position.z : 0;
      const sgx = -cpx, sgy = 1.5 - cpy, sgz = -cpz, sgL2 = sgx * sgx + sgy * sgy + sgz * sgz || 1;
      // ⚠ 아래 sc 는 이 뒤에서 선언된다 (TDZ) — 여기서는 식을 그대로 쓴다
      const blockR = 3.2 + CONFIG.mark.ballR * Math.max(0.05, P.markScale);   // 배 반폭·돛 둘레 + 부표 반지름

      const WZ = A.wrapZ;
      const wrapP = (v) => (((v + WZ / 2) % WZ) + WZ) % WZ - WZ / 2;
      const sc = Math.max(0.05, P.markScale);
      const rankOn = (P.markRankSize === undefined ? 1 : P.markRankSize) >= 0.5;
      // 인기 순위 밝기의 세기 (2026-09-12 오후) — 0 이면 표를 안 본다. 아래 litK 가 부표마다 곱한다
      const litAmt = Math.max(0, P.markRankLight === undefined ? 1 : P.markRankLight);
      const hy = P.markHeight, hv = P.markHeightVary;
      // ⭐ 부표 누르기 (2026-09-13 저녁, markHitFit) — 히트박스 = 몸통 × markHitK, 화면에서 최소 markHitMinPx. 아래 m.rw 뒤에서 부표마다 맞춘다
      const hitFit = (P.markHitFit === undefined ? 1 : P.markHitFit) >= 0.5 && !!cam;
      const hitK = Math.max(0.5, P.markHitK === undefined ? 1.8 : P.markHitK);
      const hitMinPx = Math.max(0, P.markHitMinPx === undefined ? 16 : P.markHitMinPx);
      const hitVH = viewH || window.innerHeight || 1;
      const ce = cam ? cam.matrixWorld.elements : null;   // 카메라 위쪽 (월드) = 행렬 둘째 열

      // ── 향수 고르기의 시계. ⚠ 게이트를 걸지 않는다 — 가라앉고 솟는 것은 부표의 **가로 위치**처럼
      //   매 프레임 움직여야 한다 (부표는 원래 파도를 안 타므로 물의 게이트와 무관하다, 불변식 17)
      const ft = FT();
      if (focus) {
        focus.t += dt;
        // ⚠ 끝은 **마지막 부표가 다 떠오른 뒤**다 — 시차만큼 늦다 (안 늦추면 바깥의 부표가 떠오르다 말고 멈춘다)
        if (focus.mode === 'out' && focus.t >= (focus.riseAtOut === undefined ? ft.riseAt : focus.riseAtOut) + ft.rise + ft.spreadRise) focus = null;
      }

      // ⚠ 항공뷰(개발 전용)에서는 **지도 전체**를 본다 — 거리 페이드를 끈다. 안 끄면 배에서 38 월드
      //   밖이 전부 사라져, 항공뷰를 아무리 넓혀도 지도가 배 둘레 한 줌으로만 보인다.
      //   (water.js 가 항공뷰에서 거리 LOD 를 끄는 것과 같은 이유 — 검증 도구가 거짓말을 하면 안 된다)
      const overview = !!P.topView;
      for (const m of list) {
        if (!m.on) continue;
        // ── 가로 위치 : 매 프레임. 이건 파도가 아니라 배가 나아간 양이다
        // ⚠⚠ **지도 향수는 감지 않는다** (유한 좌표 — scentmap.js). 감으면 지도 반대편 향수가
        //   토러스 주기(wrapZ 100)마다 **배 앞에 되풀이해 나타난다**
        const flat = m.src === 'map';
        const sx = flat ? m.x - scroll.x : wrapP(m.x - scroll.x);
        const sz = flat ? m.z + scroll.z : wrapP(m.z + scroll.z);
        m.sx = sx; m.sz = sz;
        const dist = Math.hypot(sx, sz);
        m.fade = overview ? 1 : 1 - clamp((dist - A.fade0) / (A.fade1 - A.fade0), 0, 1);
        // ⚠⚠ **카메라 바로 앞의 부표는 화면을 가린다.** 위의 fade0/fade1 은 배까지의
        // 거리라 원경만 막는다 — 카메라 앞은 못 막는다. 평소(camDist 1)에는 카메라가
        // 배에 붙어 있어 문제가 안 됐는데, **camDist 를 올리면 카메라가 뒤로 가면서
        // 근경 타일이 프레임에 들어와 구 하나가 화면을 덮는다** (1.4 에서 이미 심각).
        // ⚠ fade 를 0 으로 만들면 root.visible 이 false 가 되고, 히트박스가 그 자식이라
        //   Raycaster 에도 안 잡힌다 — 안 보이는 부표를 클릭하는 일이 없다.
        if (cam && !overview) {
          const cd = Math.hypot(sx - cam.position.x, sz - cam.position.z);
          const n0 = Math.max(0.1, P.markNear);
          m.fade = Math.min(m.fade, clamp((cd - n0 * 0.45) / (n0 * 0.55), 0, 1));
        }
        // 높이는 파도를 안 탄다. 다만 부표마다 다르다 — 전부 같은 높이면 이상하다
        // ⚠ m.lift 는 layout() 이 정한 '띄운 것' 의 높이다 (0 이면 그대로 반쯤 잠긴다)
        const base = hy + m.dy * hv + (m.lift || 0);
        m.wy = base;
        // ── 향수 고르기 (위 focus 주석). 슬롯에 선 12개는 자리·높이·페이드를 **슬롯이** 정한다
        //   ⭐ 2026-09-13 : 부표마다 시차(focus.dIn · dDown · dUp)와 잠기는 곡선(focusSinkEase)이 붙었다 — 위 staggerIn/Out 주석
        if (focus) {
          const slot = focus.slots.get(m), tt = focus.t;
          const sinkE = ft.inOut ? EASE.inOutCubic : EASE.inCubic;
          if (focus.mode === 'in') {
            const dl = (focus.dIn && focus.dIn.get(m)) || 0;
            if (slot && tt >= ft.riseAt) {
              // 12개 — 앞에서 뒤로 차례로 솟는다. ⚠ 제 차례 전에는 **슬롯 자리 물속**에서 기다린다 (k 0 = 깊이 DEPTH · 페이드 0)
              const k = clamp((tt - ft.riseAt - dl) / ft.rise, 0, 1);
              m.sx = slot.x; m.sz = slot.z;
              m.wy = -DEPTH + (slot.y + DEPTH) * EASE.outBack(k);   // 물에서 튀어나온 관성 (타이포와 같은 커브)
              m.fade = clamp(k * 1.8, 0, 1);
            } else {
              // ⚠ 12개는 시차 없이 **riseAt 안에 다 잠긴다** — 덜 잠긴 채 슬롯으로 옮겨지면 순간이동이 보인다.
              //   예전에는 riseAt(0.35) 이 sink(0.45) 보다 짧아 **절반쯤 보이는 채로** 옮겨졌는데, 모두 한꺼번에라 안 들켰다
              //   (시차가 켜지면 들킨다 — 그래서 켜졌을 때만 줄인다. 꺼져 있으면 예전 식 그대로)
              const ps = focus.prev && focus.prev.get(m);
              if (ps) {
                // ⭐ 다시 띄우기 ([주변 향 탐색], v0.68.0 — focusOn 의 prev) : 앞 고르기의 슬롯에 서 있던 부표는 **그 자리에서** 잠긴다.
                //   위에서 제 좌표(sx · sz)를 먼저 받았으므로 슬롯으로 되돌린다 — 안 그러면 떠 있던 12개가 한 프레임에 흩어진다. 잠기는 식은 나갈 때의 슬롯과 같다
                const k = sinkE(clamp(tt / Math.min(ft.sink, Math.max(0.05, ft.riseAt)), 0, 1));
                m.sx = ps.x; m.sz = ps.z;
                m.wy = ps.y - (ps.y + DEPTH) * k;
                m.fade = 1 - k;
              } else {
                const dur = slot && ft.staggered ? Math.min(ft.sink, Math.max(0.05, ft.riseAt)) : ft.sink;
                const k = sinkE(clamp((tt - (slot ? 0 : dl)) / dur, 0, 1));
                m.wy = base - (base + DEPTH) * k;
                m.fade *= 1 - k;
              }
            }
          } else {
            const rAt = focus.riseAtOut === undefined ? ft.riseAt : focus.riseAtOut;
            if (slot && tt < rAt) {
              // 나갈 때 : 12개가 슬롯에서 **뒤에서부터** 가라앉는다
              const dl = (focus.dDown && focus.dDown.get(m)) || 0;
              const k = sinkE(clamp((tt - dl) / Math.min(ft.sink, ft.riseAt || ft.sink), 0, 1));
              m.sx = slot.x; m.sz = slot.z;
              m.wy = slot.y - (slot.y + DEPTH) * k;
              m.fade = 1 - k;
            } else if (tt < rAt) {
              m.wy = -DEPTH; m.fade = 0;   // 들어올 때 가라앉은 채로 기다린다
            } else {
              // 모두가 제 좌표에서 다시 떠오른다 — **누른 자리에서 바깥으로** (오버슈트 없이 — 돌아오는 것은 조용해야 한다)
              const dl = (focus.dUp && focus.dUp.get(m)) || 0;
              const k = EASE.outCubic(clamp((tt - rAt - dl) / ft.rise, 0, 1));
              m.wy = base - (base + DEPTH) * (1 - k);
              m.fade *= k;
            }
          }
        }
        m.root.visible = m.fade > 0.004;
        if (!m.root.visible) continue;
        m.root.position.set(m.sx, m.wy, m.sz);
        m.root.scale.setScalar(sc);
        // ⭐ 인기 순위 크기 (2026-09-12, markRankSize) — **몸통 · 발광 쌍둥이만** 줄인다. 히트박스는 root 의 sc 그대로라
        //   작은 부표도 누르는 자리는 같다 (markHitFit 0 일 때 — 1 이면 바로 아래에서 히트박스가 몸통을 따른다). ⚠ 둘을 같이 바꾼다 — 하나만 줄이면 번짐이 몸통보다 큰 원에서 난다
        const kk = rankOn ? m.k0 : 1;
        if (m.kNow !== kk) { m.kNow = kk; m.ball.scale.setScalar(kk); m.glow.scale.setScalar(kk); }
        m.rw = CONFIG.mark.ballR * sc * kk;
        // ⭐ 히트박스 크기 (markHitFit) — 몸통의 화면 반지름을 투영으로 재고(카메라 위쪽으로 rw 올린 점), 몸통 × K 와 화면 최소 px 중 큰 쪽.
        //   ⚠ 예전(0)에는 root 의 sc 만 따르는 고정 구(0.95 × sc)라 순위 단계로 줄어든 몸통을 안 따라갔다
        if (hitFit) {
          _hv.set(m.sx, m.wy, m.sz).project(cam);
          const y0 = _hv.y;
          _hv.set(m.sx + ce[4] * m.rw, m.wy + ce[5] * m.rw, m.sz + ce[6] * m.rw).project(cam);
          const bodyPx = Math.max(0.5, Math.abs(_hv.y - y0) * 0.5 * hitVH);
          const hs = m.rw * Math.max(hitK, hitMinPx / bodyPx) / (CONFIG.mark.hitR * sc);
          if (Math.abs(m.hit.scale.x - hs) > 1e-3) m.hit.scale.setScalar(hs);
        } else if (m.hit.scale.x !== 1) m.hit.scale.setScalar(1);
        // ⭐ **배가 가까이 지날 때만 불투명** (2026-09-11 오후, 사용자 : *"부표의 반투명으로 … 배가 근처에 지나갈때만
        //   불투명으로"*). near = 배에서 가까운 정도 — 부표의 **씬 좌표가 곧 배 기준**이다 (배가 원점, 불변식 0-2).
        //   ⚠ 향수 고르기에 떠오른 12개와 고른 부표는 언제나 불투명이다 — 누를 대상이 흐리면 안 된다
        //   ⚠ markAlphaFar 1 이면 예전과 같다 (opacity = fade)
        const solid = m === selected || (!!focus && focus.slots.has(m));
        let near = 1;
        if (!solid) { const u = clamp((Math.hypot(m.sx, m.sz) - r0) / (r1 - r0), 0, 1); near = 1 - u * u * (3 - 2 * u); }
        // 시선 가림 — 카메라→배 선분까지의 거리 (위 blockA 주석). t 가 0..1 이면 카메라와 배 **사이**다
        let blk = 1;
        if (blockA < 1 && cam && !overview && !solid) {
          const qx = m.sx - cpx, qy = m.wy - cpy, qz = m.sz - cpz;
          const t = (qx * sgx + qy * sgy + qz * sgz) / sgL2;
          if (t > 0 && t < 1) {
            const dx = qx - sgx * t, dy = qy - sgy * t, dz = qz - sgz * t;
            const u = clamp(Math.sqrt(dx * dx + dy * dy + dz * dz) / blockR, 0, 1);
            blk = blockA + (1 - blockA) * (u * u * (3 - 2 * u));
          }
        }
        // ⭐ 인기 순위 밝기 (2026-09-12 오후, markRankLight) — 크기와 **같은 표**(rankTiers.lit)를 불투명도에 곱한다.
        //   실효 = 1 − (1 − lit) × 세기. 0 이면 전부 1 이라 예전과 비트 단위로 같다
        //   ⚠ 흰 종이 위에서는 위로 못 올라가므로 '밝게' 를 **아래로** 낸다 (config.js rankTiers 주석)
        //   ⚠ 고르기의 12개·고른 부표도 같이 옅어진다 — 그게 이 요청의 목적이다 (*"이럴땐 인기순서대로 밝게"*).
        //     누를 자리는 밝기와 무관하다 (히트박스는 몸통 크기를 따르고 · markHitFit 0 이면 root 의 sc 만 — 불변식 26)
        const litK = litAmt > 0 ? clamp(1 - (1 - (m.lit0 || 1)) * litAmt, 0.05, 1) : 1;
        m.tint.opacity = m.fade * (aFar + (1 - aFar) * near) * blk * litK;
        // ⚠ 후광도 거리와 함께 죽는다. 안 그러면 멀어져 사라진 부표의 빛만 남는다
        //   ⚠ 스스로 빛날 때는 몸통 발광이 markGlowBody 다 — 1 아래에 둬서 **색을 지킨다** (번짐은 쌍둥이가 낸다)
        //   ⚠ 태양일 때는 1 × 페이드다 — 세기(가운데 · 테두리)는 셰이더가 markSunHot · markSunEdge 로 곱한다
        m.tint.emissiveIntensity = (sun ? 1 : selfLit ? gBody : P.markGlow) * m.fade;
        // 발광 쌍둥이 — 향조 색 × exposure × (멀면 markGlowFar) · 불투명도 = 페이드 × 비침 (몸통과 같은 보임 — 위 glowMat 주석)
        //   ⚠ 원천 타깃은 0 으로 지워져 있어 NormalBlending 의 결과 색 = 색 × 불투명도 — 예전의 '색 × 페이드 × 비침' 과 같다
        m.glow.visible = glowOn;
        if (glowOn) {
          m.glowMat.color.copy(m.base).multiplyScalar(gExp * (gFar + (1 - gFar) * near));
          m.glowMat.opacity = m.fade * blk * litK;   // 번짐도 같이 옅어진다 (몸통만 옅으면 후광만 남는다)
        }
      }

      // 링은 고른 부표를 따라간다. 멀어져 사라지면 선택도 놓는다 (카드가 유령처럼 남지 않게)
      // ⚠ 향수 고르기 중인 12개는 빼고 본다 — 가라앉았다 슬롯에서 솟는 사이에 페이드가 0 을 지나가서,
      //   이 줄이 그 순간 선택을 놓고 **카드가 닫힌다**
      const held = focus && selected && focus.slots.has(selected);
      if (selected && !held && (!selected.on || selected.fade <= 0.004)) api.clearSelect();
      // ⚠ 2026-09-12 : `markRing` 0 이 기본이다 (사용자 지시). 값이 0 이면 아예 안 그린다 —
      //   아래 수면 높이 계산(게이트 안의 swellCPU)도 같이 건너뛴다
      const rk = P.markRing === undefined ? 1 : P.markRing;
      ring.visible = !!selected && rk > 0.004;
      if (selected && ring.visible) {
        // ⚠ 링만은 **수면**에 앉는다. 공중의 구와 물 위의 링 사이 간격이 높이를 읽게 한다.
        // 수면 높이는 물과 같은 양자화된 시각·위치로 구해야 한다 (불변식 1) —
        // 배와 글자 그대로 같은 식이고, 고른 하나에 대해서만 게이트 안에서 부른다
        if (stepped) {
          selected.sy = swellCPU(
            selected.sx + sim.qScroll.x, selected.sz - sim.qScroll.z,
            sim.qT * P.waveSpeed, P.oceanSwell, P.ripple, P.gerstner
          );
        }
        ring.position.set(selected.sx, selected.sy + 0.03, selected.sz);
        ring.scale.setScalar(sc * (selected.kNow || 1));   // 링도 몸통 크기를 따른다 (인기 순위 단계)
        ringMat.opacity = 0.85 * selected.fade * rk;
      }
    },

    // ── Raycaster. **pointerup(클릭)에서만 부른다** — 렌더 루프에서 부르지 않는다.
    // ⚠ 대상은 히트박스 배열뿐이다. 수면 메시(512² = 52만 삼각형)를 넣으면 클릭 한 번이
    // 프레임을 통째로 잡아먹는다. 레이어 1 로 한 번 더 막아 둔다
    pick(cam, nx, ny) {
      if (!P.showMarks) return null;
      ndc.set(nx, ny);
      ray.setFromCamera(ndc, cam);
      const hits = ray.intersectObjects(hitList, false);
      // 예전 (markHitFit 0) — 광선에서 가장 가까운(카메라 쪽) 것
      if ((P.markHitFit === undefined ? 1 : P.markHitFit) < 0.5) {
        for (const h of hits) {
          const m = h.object.userData.mark;
          if (m && m.on && m.fade > 0.004) return m;
        }
        return null;
      }
      // ⭐⭐ 겹친 히트박스 고르기 (2026-09-13 저녁) — 앞의 큰 구가 뒤의 부표를 누르는 클릭을 가로챘다 (실측 : 시실리 중심을 누르면 옆의 블루 탈리스만).
      //   ① 커서가 **몸통 위**에 있는 부표 — 여럿이면 앞의 것 (화면에 위로 그려진 것)  ② 없으면 **몸통 가장자리가 커서에 가장 가까운** 부표.
      //   거리는 NDC 세로 단위로 잰다 — 가로는 종횡비를 곱해 같은 단위로 맞춘다 (항공뷰의 직교 카메라는 종횡비가 없어 1 — 개발 전용)
      const asp = cam.aspect || 1, ce = cam.matrixWorld.elements;
      let inBody = null, inZ = Infinity, near = null, nearGap = Infinity;
      for (const h of hits) {
        const m = h.object.userData.mark;
        if (!m || !m.on || m.fade <= 0.004) continue;
        const p = m.root.position;
        _pv.copy(p).project(cam);
        const cx = _pv.x, cy = _pv.y, cz = _pv.z;
        _pv.set(p.x + ce[4] * m.rw, p.y + ce[5] * m.rw, p.z + ce[6] * m.rw).project(cam);
        const br = Math.abs(_pv.y - cy);
        const d = Math.hypot((nx - cx) * asp, ny - cy);
        if (d <= br) { if (cz < inZ) { inZ = cz; inBody = m; } }
        else if (d - br < nearGap) { nearGap = d - br; near = m; }
      }
      return inBody || near;
    },

    select(m) {
      selected = m || null;
      if (selected) ringMat.color.set(selected.zone.color);
      return selected;
    },

    clearSelect() { selected = null; ring.visible = false; },

    apply() { layout(); paint(); },

    dispose() {
      scene.remove(group);
      Object.values(geo).forEach(g => g.dispose());
      list.forEach(m => { m.tint.dispose(); m.glowMat.dispose(); });
      hitMat.dispose();
      ringMat.dispose();
    }
  };

  layout();
  paint();
  return api;
}
