import * as THREE from 'three';
import { CONFIG } from './config.js';
import { PARAMS, PARAM_RANGES } from './params.js';
import { createBloom } from './bloom.js';
import { createSubmerged } from './submerged.js';
import { lerp, clamp, wrapPi } from './util.js';
import { createUI } from './ui.js';
import { bootNow, bootReport, callHost, hostMove, hostSearch, perfumeRef, setHost, setHostNotice } from './host.js';   // 카드의 서비스 동작 · 검색창이 앱(호스트)으로 나가는 문 (v0.68.0) · 부팅 신호 (v0.75.0)
import { createInput } from './input.js';
import { createSim } from './sim.js';
import { createWater } from './water.js';
import { createGrids } from './grid.js';
import { createSpray } from './spray.js';
import { createBoat } from './boat.js';
import { createPod } from './pod.js';
import { createReflect } from './reflect.js';
import { createZones } from './zones.js';
import { createMarks } from './marks.js';
import { createLinks, linkEdges, linkDiff } from './links.js';
import { createSeaMark } from './seamark.js';
import { createStage } from './stage.js';
import { createPhase, EASE } from './phase.js';
import { createTravel } from './travel.js';
import { diveNow, setDive, disposeDive, diveReport } from './dive.js';   // 잠수 — 진열대로 넘어가는 전환 (2026-09-18). 진행도는 앱 커튼이 넘긴다 (PB.dive)
import { createMinimap } from './minimap.js';
import { createChart } from './chart.js';
import { areaOf, findArea } from './areas.js';
import { createTitle } from './title.js';
import { createGate } from './gate.js';
import { scentMapReport } from './scentmap.js';
// PB 로 내보내 GLSL 사본과 대조할 수 있게 한다.
// ⚠ swellAmplitude / gerstnerLoopLimit / swellEnvCPU 도 같이 내보낸다 — 안 그러면
//   "롤백이 비트 단위인가 / 루프 한계가 얼마인가" 를 콘솔에서 확인할 방법이 없다
import { swellCPU, swellEnvCPU, swellAmplitude, gerstnerLoopLimit } from './swell.js';
// 시간·길이 계약. 배의 속도와 선회는 여기서 나온다 — 파도와 같은 시계를 쓰기 위해서다
import * as oceanClock from './ocean-clock.js';
// 하늘. ⚠ **파일이 아니라 함수다** — 물은 GLSL 로 직접 부르고, 배·부표는 이걸 구운
//   환경맵을 scene.environment 로 읽는다. 둘이 **같은 하늘**을 봐야 한 장면이 된다
import { bakeEnvironment, syncSky, tickSky } from './sky.js';
import { timeNow, timeKey } from './times.js';
const { groundSpeed, turnRate } = oceanClock;

// ───────── 향을 찾는 종이배 ─────────
// 카메라는 월드에 고정이다. 도는 것은 배뿐이고, 물은 배 아래를 흘러간다(이류).
// 그래서 scroll 은 "배의 위치"이자 "월드가 흐른 양"이다. 두 뜻이 같은 값이다.

const P = PARAMS;
// ⭐ 부팅 신호 ② (v0.75.0) — import 가 전부 평가됐다. 앱의 로딩 커튼이 듣는다 (host.js bootReport)
bootReport('script');
// 앱(호스트)이 띄운 창이 열려 있는 수 (2026-09-15, v0.68.0 — holdWhile). 0 보다 크면 누르기 · 호버 · ESC · 스페이스를 안 받는다.
//   ⚠ 입력을 만들기 전인 여기에 선언한다 — onPick · updateHover · onKeyExit 가 읽는다 (TDZ)
let hostHold = 0;

// zones · marks 는 아래에서 만들어진다. 화살표 함수라 호출 시점에 이름이 풀린다
const ui = createUI({
  // ⭐ 검색바 · 카드의 '이 향의 해역으로' · 미니맵이 **같은 길**로 간다 (goRegion → travel, v0.32.0).
  //   향수 지도에서는 lead → 흰 안개 → 목표 앞 → 도착 연출. 예전(토러스)에서는 옛 자동 조타 그대로
  // ⭐ 검색창도 앱으로 (2026-09-15, v0.68.0 — host.js hostSearch). 앱이 search 를 주면 검색어만 넘기고(팀 프론트 = A06 자연어 추천) 해역 이동은 안 한다 · 없으면 예전 그대로
  onSearch: (q) => { if (!hostSearch(q)) goSearch(q); },
  onSail: () => { const m = marks.selected; if (m) goRegion(m.zone.key); },
  // ⭐ 카드의 서비스 동작 세 가지 (2026-09-15, v0.68.0 — cardActions · host.js). 프론트 HomePage 팝오버(A02)와 같은 셋 — 무엇을 할지는 아래 cardAction
  onCardAction: (act) => cardAction(act),
  // ⚠⚠ 2026-09-11 오후 : 카드의 × 는 **말풍선만** 닫는다 — 향수 고르기의 12개는 그대로 떠 있다.
  //   예전(좌하단 카드)에는 같이 접었다 (*"카드가 없는데 12개만 떠 있으면 무엇을 고른 건지 모른다"*).
  //   말풍선은 누른 부표 옆에 붙어 **이웃 칸을 덮을 수 있어서**, × 가 12개까지 거두면 덮였던 향수를 누를 길이 없다.
  //   12개를 거두는 문은 그대로 셋이다 — 빈 바다 · ESC · 방향키
  //   ⚠ 비교 패널 [원본](cardBubble 0 — 좌하단 카드)에서는 예전처럼 같이 접는다
  onCloseCard: () => {
    marks.clearSelect();
    // ⚠ 돌아갈 곳도 같이 지운다 (2026-09-12 저녁) — 안 지우면 호버가 벗어날 때
    //   **× 로 닫은 카드가 되살아난다** (updateHover 가 clickMark 로 복귀시키므로)
    clickMark = null; hoverMark = null;
    if (marks.focusing && (P.cardBubble === undefined ? 1 : P.cardBubble) < 0.5) marks.focusOff();
  }
});
// 앱(호스트)이 안 붙은 단독 화면에서는 [자세히 보기] · [진열대에 저장] 을 경고 한 줄로 알린다 (host.js DEFAULTS — v0.68.0)
setHostNotice((title, sub) => ui.warn(title, sub));
const el = ui.mount;
const W = () => el.clientWidth || 1;
const H = () => el.clientHeight || 1;

const renderer = new THREE.WebGLRenderer({ antialias: true });
// ⚠⚠ **배가 드리우는 그림자** (2026-09-09). 물에는 안 드리운다 — 수면은 커스텀 셰이더라
//   three 의 그림자를 안 받고, 그쪽은 이미 shadowAmount/contactAmount 세 겹이 따로 있다.
//   여기서 얻는 것은 **돛이 갑판에, 난간이 선체에** 지는 그림자다.
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(W(), H());
el.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(CONFIG.color.bg);
// ⚠ 배·부표는 MeshStandardMaterial 이라 이걸 자동으로 반사한다. 물은 안 읽는다
//   (커스텀 ShaderMaterial 이라 — 명세 8.2). 물 쪽은 water.js 가 같은 함수를 직접 부른다.
// ⚠ 한 번만 굽는다. 매 프레임 도는 것이 아니다
// ⚠⚠ **하늘 값이 바뀌면 다시 굽는다** (2026-09-09, skyBand/skyBroadA/skyZenith 가 런타임 값이 됐다).
//   안 굽으면 **배·부표만 예전 하늘을 반사하는** 상태가 된다 — sky.js 가 경고한 바로 그것이다.
//   ⚠ PMREM 이 끼어 수십 ms 걸리므로 **값이 실제로 바뀜을 때만** 돌린다 (key 비교)
let _skyKey = '';
function applySky() {
  const key = syncSky(P);
  if (key === _skyKey) return;
  _skyKey = key;
  const old = scene.environment;
  scene.environment = bakeEnvironment(renderer);
  if (old) old.dispose();
}
applySky();
const cam = new THREE.PerspectiveCamera(CONFIG.cam.fovNear, W() / H(), 0.1, 400);

// ── 항공뷰 카메라 (개발 전용, 검증용). 본 카메라를 옮기는 게 아니라 따로 둔다.
//
// ⚠ **직교여야 한다.** 원근으로 위에서 내려다보면 화면 가장자리로 갈수록 방향과 크기가
// 휘어서, "이 층이 마루선을 따라 눕는가" 를 판정할 수 없다. 실제로 원근 부감으로 재다가
// 거품 방향을 한 번 오판했다. 직교면 화면 각도가 곧 월드 각도다.
//
// ⚠ 이 카메라를 쓸 때는 water.js 가 거리 LOD 를 끈다 — 안 그러면 카메라 바로 아래만
// 잔물결이 살아서 동심원 무늬가 생기고, 그게 방향 측정을 오염시킨다
const topCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 400);
// 물에는 조명이 닿지 않는다 (수면은 배경색으로만 칠한다). 이 두 조명은 종이배 전용이다
const hemiLight = new THREE.HemisphereLight(0xffffff, 0xe9e5d9, 1.35);
const dirLight = new THREE.DirectionalLight(0xffffff, 2.2);
// 종이배 전용 광원. 앞쪽 위에서 받아야 흰 종이로 보인다
dirLight.position.set(-5, 5, 3.5);
// ⚠ 그림자 카메라는 **배 한 척만** 담으면 된다 (배 길이 5 월드). 넓게 잡으면 1024² 를
//   허공에 흩어 써서 돛대 그림자가 계단이 된다. near/far 도 조인다
dirLight.castShadow = true;
dirLight.shadow.mapSize.set(1024, 1024);
{
  const sc = dirLight.shadow.camera;
  sc.left = -4.5; sc.right = 4.5; sc.top = 4.5; sc.bottom = -4.5;
  sc.near = 0.5; sc.far = 24;
  sc.updateProjectionMatrix();
  // ⚠ bias 는 그림자 여드름(acne)을, normalBias 는 얇은 면(돛·난간)의 자기 그림자를 막는다
  dirLight.shadow.bias = -0.0008;
  dirLight.shadow.normalBias = 0.02;
}
scene.add(hemiLight, dirLight);

// ⭐ 시간대 (2026-09-11 밤 — 시안, `params.sceneTime`). 조명 · 배경 · `<html data-time>` · 하늘을 한 번에 바꾼다.
//   표는 **CONFIG.times 하나**이고 times.js 의 timeNow() 로 받는다 (낮 = null → 아래 원래 값 그대로 = 비트 단위 롤백).
//   ⚠ 조명은 배 · 부표 몸통 · 타이포 반사가 받는다. 물은 커스텀 셰이더라 조명 대신 **팔레트**가 바뀐다 (water.js syncPalette)
//   ⚠ 바뀔 때만 돈다 — applySky 가 환경맵(PMREM)을 다시 굽는 데 수십 ms 다
const LIGHT0 = { hemiSky: hemiLight.color.clone(), hemiGround: hemiLight.groundColor.clone(), hemi: hemiLight.intensity,
                 dir: dirLight.color.clone(), dirI: dirLight.intensity };
// 시간대 표가 정한 배경색 (잠수가 이 값에서 짙은 바다색으로 간다 — applyDiveBg)
const _bgBase = new THREE.Color(CONFIG.color.bg);
let _timeKey = null;
function applyTime() {
  const k = timeKey();
  if (k === _timeKey) return;
  _timeKey = k;
  const T = timeNow(), L = T && T.light;
  if (L) {
    hemiLight.color.set(L.hemiSky); hemiLight.groundColor.set(L.hemiGround); hemiLight.intensity = L.hemi;
    dirLight.color.set(L.dir); dirLight.intensity = L.dirI;
  } else {
    hemiLight.color.copy(LIGHT0.hemiSky); hemiLight.groundColor.copy(LIGHT0.hemiGround); hemiLight.intensity = LIGHT0.hemi;
    dirLight.color.copy(LIGHT0.dir); dirLight.intensity = LIGHT0.dirI;
  }
  scene.background.set(T ? T.bg : CONFIG.color.bg);
  _bgBase.copy(scene.background);   // 잠수가 여기서부터 짙은 바다색으로 간다 (아래 applyDiveBg)
  // 글자색 변수 (index.html <style>). 낮이면 속성을 지운다 — 인라인의 예전 값이 그대로 산다
  if (T && T.ui) document.documentElement.dataset.time = T.ui;
  else delete document.documentElement.dataset.time;
  applySky();
}
applyTime();

// ⭐ 잠수 — 배경색이 짙은 바다색으로 눕는다 (2026-09-18, dive.js).
// ⚠⚠ `applyTime()` 은 **시간대가 바뀔 때만** 배경을 쓰므로, 잠수가 매 프레임 덮으면 끝난 뒤에 되돌릴 사람이 없다.
//   그래서 그 표의 값을 `_bgBase` 에 챙겨 두고, 잠수 중에만 섞어 덮고 **끝나는 프레임에 한 번** 되돌린다.
//   ⚠ 물(`uBg`) · 하늘(stage) 은 자기 update 안에서 같은 일을 한다 — 셋이 같은 `dim` 을 보므로 갈라지지 않는다
let _bgDived = false;
function applyDiveBg() {
  const D = diveNow();
  if (D) {
    scene.background.copy(_bgBase).lerp(D.deep, D.dim);   // ⚠ `dim` 에 diveDim 이 이미 들어 있다 (dive.js)
    _bgDived = true;
  } else if (_bgDived) {
    scene.background.copy(_bgBase);
    _bgDived = false;
  }
}

const sim = createSim(renderer);
const water = createWater(scene, sim.texture);
const grids = createGrids(scene, sim.texture);
const spray = createSpray(scene);
const boat = createBoat(scene);
// 수면에 비치는 배. 예전의 타원 그림자를 대신한다.
// reflect.js 가 거울 카메라로 배만 찍고, water.js 가 그 그림을 되읽는다 —
// ⚠ 되읽는 좌표는 화면이 아니라 '파도 법선으로 튕긴 광선이 배에 닿은 지점'이다
const reflect = createReflect(renderer, scene, boat, [hemiLight, dirLight]);
water.setBoat(boat.pivot);
water.setReflect(reflect);
// 돌고래 무리 — 원경을 채운다 (2026-09-18). ⚠ 반사·물속·발광 패스에 **안 넣는다** (pod.js 머리 주석) —
// 씬을 한 번 더 그리는 값은 그대로 나가는데 원경이라 반사에는 거의 안 보이고, 반사 패스의
// 클리핑 평면(reflectSlice)이 점프 꼭대기를 어차피 자른다. GLB 는 podAmount > 0 일 때 처음으로 받는다
// ⚠ 원경색(uBg)을 **참조로** 넘긴다 — 멀어지는 돌고래가 물과 **같은 색**으로 녹어야 한다.
//   복사하면 시간대가 바뀌는 순간 둘째 수평선이 생긴다 (stage.js 가 태양 유니폼을 참조로 받는 것과 같은 규율)
const pod = createPod(scene, water.uni);
// 화면에 그리는 하늘. ⚠⚠ **water 뒤에 만든다** — 태양 유니폼(`uLightDir3`)을 **참조로**
// 공유해서 물과 하늘이 갈라질 수 없게 한다 (stage.js 주석의 실측 : 태양이 세 곳에서
// 80.8°·125.7° 로 어긋나 있었다). 복사하면 그 순간 넷째 태양이 생긴다
const stage = createStage(scene, water.uni.uLightDir3);
// ⚠⚠ 연출 상태머신 ([4단계]). **씬을 모르는 중립 층이라 인자가 없다** — cue 만 채운다.
//   지금 이 cue 를 읽는 소비자는 하나도 없다 (title·gate 는 [6·7단계], 카메라 전환은 [5단계]).
const phase = createPhase();
// ⚠ [6단계]. cue.rise 를 읽는 두 번째 소비자다. 씬만 받고 다른 층은 모른다
const title = createTitle(scene);
reflect.add(title.mesh);   // ⭐ 물에 비친다 (위 reflect.add(marks.group) 옆 주석 참고)
// [7단계] 좌우 윙. ⚠ title 과 같은 규약 — cue 와 카메라만 받고 씬의 다른 층을 모른다
const gate = createGate(scene);
// ⭐⭐ **진입점** (§10-1, 2026-09-10). 카드의 '이 향의 해역으로' 는 이미 자동 조타를 걸고
//   있었다 — 거기에 **도착** 을 이어 붙이면 부표 클릭 → 카드 → 버튼 → 항해 → 존 화면이 된다.
//   ⭐ 검색바("우디" 를 친다)도 같은 길로 들어온다. 진입 경로를 두 벌 만들지 않는다.
//   ⚠ 지나쳐 버린 것은 도착이 아니다 — zones.js 가 그 둘을 가른다.
const zones = createZones({
  // ⭐ 도착 연출은 zoneHold 초 머물다 **스스로 걷힌다** (v0.32.0, 사용자 : *"몇초 후 사라지게"*).
  //   ⚠ 연출이 아직 나가는 중(busy)이면 enter 가 거절된다 — 떠날 때 leave() 를 부르고 1.8초 뒤에
  //     도착하는 흐름이 정확히 그 틈에 걸린다. 그래서 거절되면 **미뤄 뒀다가** 틱에서 다시 건다
  // ⚠ Shift 바다 누르기(sea)의 목표는 해역이 아니다 — 닿으면 조용히 선다 (존 연출을 안 건다)
  onArrive: (a) => { if (a && !a.sea) arriveAt(a.key); },
  // ⭐ 향 지도가 켜져 있으면 그 존의 대표 향수 자리로 간다 (scentmap.js 의 메도이드).
  //   미니맵이 찍은 **임의의 자리**(custom)는 그 좌표 그대로 간다.
  //   ⚠ marks 는 아래에서 만들어진다 — 화살표라 **부를 때** 이름이 풀린다 (위 createUI 와 같은 이유)
  targetOf: (a) => (a.custom ? a : marks.anchorOf(a.key))
});
// 향 계열의 '영역'은 zones, 그 안에 떠 있는 '향수 하나하나'는 marks 다 (MAP-05)
const marks = createMarks(scene);
// ⭐ 유사 향수 연결선 (2026-09-12 오후) — 향수 고르기의 12개를 유사도(향 지도 좌표)로 잇는다. 자세한 것은 links.js
//   ⚠ 반사 패스에 등록하지 않는다 (links.js 머리 주석)
const links = createLinks(scene);
// ⭐ 바다 누르기 표시 — 누른 자리로 모여드는 수면 화살표 넷 (2026-09-13 밤, v0.59.0). 자세한 것은 seamark.js
//   ⚠ 반사 패스에 등록하지 않는다 · water 는 화살표로 넘긴다 (부를 때 이름이 풀린다 — 위 createUI 와 같은 이유)
const seamark = createSeaMark({ scene, water: () => water });
// ⚠ 평면 반사 패스에 부표를 등록한다 (reflect 가 marks 보다 먼저 만들어지므로 여기서).
//   ⚠ 물·그리드는 절대 넣지 않는다 — 거울이 거울을 비춘다
reflect.add(marks.group);
// ⭐ 수면 타이포도 물에 비친다 (2026-09-10, 사용자 요청). 등록은 **레이어 비트**라 런타임
//   비용이 0 이고, 반사 패스에 드로우콜 1 · 삼각형 2 가 는다.
//   ⚠ 타이포는 title 이 만들어지는 자리(위)에서 이미 등록했다.
// ⚠⚠ **좌우 윙(gate)은 넣지 않는다.** 판이 `depthTest:false` + `renderOrder 20` 이라
//   반사 타깃에서도 모든 것 앞에 그려져 **반사를 통째로 덮는다.** §11 의
//   *"본 카메라에 매달린 물체는 엉뚱한 곳에 선다"* 가 그 얘기다.
//   ⚠ 타이포는 카메라에서 자리를 **파생**시킬 뿐 월드에 실재하므로 거울 카메라에서도 제자리다.
// 물과 배가 같은 곳에서 빛을 받게 한다. 지금까지 물의 분광·반짝임에는 광원 개념이 없었고
// 배만 dirLight 를 받고 있었다 — 이 한 줄이 둘을 같은 빛 아래로 묶는다
const lightDir = dirLight.position.clone().normalize();
grids.setLight(lightDir);
spray.setLight(lightDir);
water.setLight(lightDir);
// 입력은 캔버스 영역(#mount)에만 붙인다. 검색바·DRIFT 미터는 형제 요소 —
// 여기에 stage 를 넘기면 검색창 드래그가 조타로 새고 자동 조타가 취소된다
// ⚠ onPick 은 **클릭(드래그가 아닌 누름)에서만** 불린다. input.js 가 그 둘을 가른다.
// 레이캐스트는 여기서만 돈다 — 렌더 루프에 넣으면 프레임마다 히트박스를 훑게 된다
const input = createInput(ui.mount, {
  // 사람이 방향키를 잡으면 자동 조타 · 먼 곳 이동(lead) · 향수 고르기를 놓는다.
  // ⚠ 향수 고르기의 12개는 **배 기준 씬 좌표**에 서 있어 배를 따라다닌다 — 몰고 가면 이상하므로 접는다
  onManual: () => {
    zones.clearAuto();
    travel.cancel();
    pendingSea = null;   // 연출이 걷히길 기다리던 바다 떠나기도 놓는다 (seaGo)
    pendingTravel = null;   // 먼 곳 이동도 (startTravel)
    if (marks.focusing) { marks.focusOff(); marks.clearSelect(); clickMark = null; }
  },
  onPick: (nx, ny, e) => {
    if (hostHold) return;   // ⚠ 앱이 띄운 창(진열대 저장 모달)이 열려 있는 동안은 고르지 않는다 (v0.68.0 — holdWhile)
    // ⚠⚠ **전환 중에는 고르지 않는다** (§9-4). phase 쪽 가드는 이미 있어서 cue.zone 이
    //   찢어지진 않지만, 여기서 막지 않으면 트윈이 도는 동안 카드가 바뀌어 **화면과 카드가
    //   서로 다른 향을 가리킨다.** 안개가 덮여 있는 동안도 같다
    if (phase.cue.busy || travel.busy) return;
    const m = marks.pick(view, nx, ny);
    // ⭐ **빈 바다** → 그 자리로 부스트 자동 조타 (seaGo). 부표 위의 누름은 예전 그대로 고르기다.
    //   2026-09-13 밤 (seaClickGo) : **Shift 없이** 누르기만 해도 간다 — v0.57.0 은 Shift 를 눌러야 갔다 (사용자 요청을 잘못 읽었다 · CHANGELOG v0.58.0).
    //   seaClickGo 0 이면 v0.57.0 그대로 Shift 누름만 (seaShiftGo). 하늘을 눌렀으면(수면과 안 만난다) false 라 아래 예전 누르기로 간다
    const seaClick = (P.seaClickGo === undefined ? 1 : P.seaClickGo) >= 0.5;
    const seaShift = !!(e && e.shiftKey) && (P.seaShiftGo === undefined ? 1 : P.seaShiftGo) >= 0.5;
    // ⭐⭐ **향수 고르기(12개 연출) 중 빈 곳을 누르면 연출만 끝낸다** (2026-09-15, v0.65.0 — focusSeaEnds). 사용자 : *"향수 부표 클릭시 12개가 잘보이게 뜨는
    //   구도 연출 시에 마우스로 빈 공간을 클릭하면 이동 및 가속이 아니라 연출 종료로 변경"*. 가라앉은 부표(12개 밖)를 누른 것도 빈 곳이다 — 화면에 안 보인다.
    //   ⚠ Shift 누름도 같다 · 부표를 눌러 걸린 항해(pickSail)는 놓지 않는다 — 연출이 끝나면 누른 향수 곁으로 가던 길을 간다
    //   0 = v0.64.0 (12개를 접고 누른 자리로 부스트 항해 — seaGo)
    if (marks.focusing && (!m || !marks.inFocus(m)) && (P.focusSeaEnds === undefined ? 1 : P.focusSeaEnds) >= 0.5) {
      marks.focusOff(); marks.clearSelect(); clickMark = null; hoverMark = null;
      return;
    }
    if (!m && (seaClick || seaShift) && seaGo(nx, ny)) return;
    // ── 향수 고르기 중 : 떠오른 12개만 받는다. 빈 바다를 누르면 접는다
    if (marks.focusing) {
      if (m && marks.inFocus(m)) { marks.select(m); clickMark = m; hoverMark = m; hoverX = nx; hoverY = ny; }
      else if (!m) { marks.focusOff(); marks.clearSelect(); clickMark = null; hoverMark = null; }
      return;
    }
    if (!m) { marks.clearSelect(); clickMark = null; hoverMark = null; return; }
    marks.select(m);
    // ⚠ 누른 것이 곧 지금 호버다 — 안 맞추면 다음 프레임에 카드가 한 번 깜빡인다.
    //   좌표까지 같이 집어야 **12개가 솟는 동안** 마우스가 가만히 있어도 카드가 안 밀린다
    hoverMark = m; hoverX = nx; hoverY = ny; clickMark = m;
    // ⭐ 향수 지도의 부표를 누르면 **주변이 가라앉고 가까운 12개가 떠오른다** (v0.32.0).
    //   ⚠ 존 연출 중에는 안 한다 — 같은 구도를 두 층이 동시에 잡는다 (연출은 몇 초 뒤 스스로 걷힌다)
    if ((P.focusOn === undefined ? 1 : P.focusOn) >= 0.5 && m.src === 'map' && !phase.cue.zone) {
      pickSail(m);   // ⭐ v0.65.0 — 가속을 멈추고 누른 향수 곁으로 (연출보다 먼저 — 12개 자리는 속도 0 카메라로 잡는다)
      startFocus(m);
      // ⭐⭐ **앱에 알린다 — 이 향을 새 중심으로 12개를 다시 띄웠다** (2026-09-16, host.js `exploreSimilar` · 불변식 32).
      //   v0.74.2 에서 카드의 [주변 향 탐색] 단추를 뺐다 (부표 누르기가 곧 그 동작이라 같은 일을 두 번 내놓고 있었다) — 그래서 알림도 **여기서** 나간다.
      //   ⚠ 12개 **안**의 부표를 누른 것은 위에서 먼저 return 한다 (고르기만 하고 중심은 안 바뀐다) — 그때는 안 알린다. 알림의 뜻이 '새 중심' 이라야 앱이 셀 수 있다.
      //   ⚠ **알림만이다** — 앱이 Promise 를 줘도 `holdWhile` 로 입력을 잠그지 않는다. 엔진이 이미 한 일이라 기다릴 것이 없다 ([진열대에 저장]과 다른 점).
      const exRef = perfumeRef(m);
      if (exRef) callHost('exploreSimilar', exRef);
      // ⭐ **들른 향수** (2026-09-18, v0.75.12 — 향해 일지). 서버는 향수를 고른 이동을 **언제나** 남기고,
      //   지금 구역의 진입 줄에 그 향수를 매단다 (ExplorationController — 새 줄이 되지 않는다).
      //   ⚠ 좌표는 부표의 정규화 자리(mx · my)다 — `perfumeId` 가 있으면 서버가 제 좌표로 덮어쓴다
      if (exRef) hostMove({ perfumeId: exRef.perfumeId, x: exRef.mx, y: exRef.my, regionKey: exRef.family });
    }
  }
});

// ⭐⭐ **마우스를 올리면 말풍선이 뜬다** (2026-09-12 저녁, `cardHover`. 사용자 : *"그냥 향수 마우스
//   오버했을때도 그렇게 띄우게 해주면됨"*). 클릭은 그대로 **추천 12개**다 — 호버가 미리보기를 맡는다.
// ⚠⚠ `input.js` 를 건드리지 않는다. `state.mx/my` 가 이미 매 pointermove 마다 NDC 로 갱신되고 있다
//   (마우스 패럴랙스가 쓰던 것). 그것을 **프레임당 한 번** 읽으므로, 초당 수백 번 오는 pointermove
//   마다 레이캐스트하는 일이 없다 — 스로틀을 따로 두지 않아도 되는 이유다.
// ⚠ 호버는 **미리보기**다. 마우스가 벗어나면 **클릭으로 고른 향수로 돌아간다** — 그래야 12개를
//   훑어보다 마우스를 치워도 누른 향수가 남는다 (선택 링을 껐으므로 이 카드가 '무엇을 눌렀는가' 를
//   말하는 유일한 자리다 — v0.39.1).
//   ⚠⚠ 처음엔 돌아갈 대상을 '호버가 시작될 때의 selected' 로 잡았는데 **틀렸다** — 부표에서 부표로
//     이어서 옮기면 호버가 한 번도 '시작' 되지 않아 값이 갱신되지 않는다. 실측 : 12개를 셋 훑고
//     빈 곳으로 치우니 누른 향수가 아니라 **null** 로 돌아갔다. 클릭이 정하는 값이라야 한다.
// ⚠ ESC 로 닫은 뒤 마우스가 그 부표 위에 그대로 있어도 **다시 띄우지 않는다** (`next === hoverMark`
//   에서 끊긴다) — 안 그러면 닫히지 않는 카드가 된다.
// ⚠⚠ **마우스가 실제로 움직였을 때만** 다시 판정한다. 안 그러면 부표가 마우스 쪽으로 들어오는 것만으로
//   카드가 바뀐다 — 실측 : 부표를 눌렀더니 12개가 솟아오르며 마우스 아래로 들어온 **다른 향수**가
//   누른 향수의 카드를 밀어냈다 (누른 것은 Light Blue 인데 카드는 Saint Moritz 였다).
//   마우스를 조금만 움직이면 바로 갱신되므로 호버가 굼떠지지는 않는다.
let hoverMark = null, clickMark = null, hoverX = NaN, hoverY = NaN;
let _miniHidden = false;   // 존 연출 중 미니맵 숨김 (zoneMiniHide — tick). ⚠ tick 보다 먼저 선언한다 (TDZ)
let seaBlockT = 0;         // Shift 바다 누르기가 경계에 막혀 있던 시간 (tick). ⚠ 같은 이유로 여기서 선언한다

// ───────── 배가 든 해역이 바뀌면 앱에 알린다 (2026-09-18, v0.75.12) — 향해 일지 ─────────
// 앱은 이것을 받아 `PUT /map/exploration/me` 를 부른다 (host.js `hostMove`). 일지 한 줄이 "○○ 구역 진입"
// 이므로 **바뀌는 순간**이 곧 한 줄이다 — 매 프레임 보내면 서버가 같은 구역을 몇백 번 받는다.
// ⚠⚠ `zones.onArrive` 로는 모자라다 — 그건 **자동 조타 목표에 닿았을 때**만 뜬다. 방향키로 자유 항해하면
//   영영 안 온다 (사용자 : *"향 영역으로 이동했을때 향해 일지가 작성 안되고 있음"*).
// ⚠ 해역은 `map.regionAt` (가장 가까운 향수의 향조 — 향수들로 나눈 보로노이)이다. 200개 순회라
//   **REGION_MS 마다 한 번**만 돈다 (같은 틱의 `navDist` 도 200개를 도므로 두 배가 되지 않게).
// ⚠ 갈 수 있는 바다 **밖**이면 보내지 않는다 — 배가 경계에 붙어 미끄러지는 동안 값이 흔들린다.
// ⚠ 좌표는 `map.toNorm` 이 낸 정규화 좌표다 (불변식 21). 첫 해역도 한 줄이다 (배가 그 바다에서 시작한다).
const REGION_MS = 400;
let regionKey = null, regionT = -1e9;
function reportRegion(t) {
  const map = marks.map;
  if (!map || t - regionT < REGION_MS / 1000) return;
  regionT = t;
  const wx = nav.scroll.x, wz = -nav.scroll.z;
  if (!map.inNav(wx, wz, 0)) return;
  const reg = map.regionAt(wx, wz);
  if (!reg || reg.key === regionKey) return;
  const [nx, ny] = map.toNorm(wx, wz);
  // ⚠ perfumeId 는 **DB 번호**라 엔진 데이터에 아직 없다 (불변식 32 · 지금은 늘 null) — 그동안은 좌표로 간다.
  //   좌표만 오면 서버는 '빈 바다로 간 이동' 으로 보고 **향 영역이 바뀐 경우에만** 기록한다. 여기가 정확히 그 순간이다
  const told = hostMove({ x: nx, y: ny, regionKey: reg.key, regionName: reg.name, perfumeId: null });
  // ⚠⚠ **알린 뒤에만 기억한다.** 첫 틱은 호스트(앱)가 `window.PB` 를 찾아 붙기 **전**이라 아무 데도 안 간다 —
  //   그때 기억해 버리면 배가 그 해역을 떠날 때까지 영영 다시 안 알리고, 첫 해역이 일지에서 통째로 빠진다
  //   (실측 2026-09-18 : 앱을 열자마자 `hostMove` 가 false 로 한 번 돌고 그대로 잠겼다).
  if (told) regionKey = reg.key;
}
// ⭐ 호버 카드의 틈 (2026-09-15, v0.65.0 — cardHoverBridge). hoverGrace = 부표와 카드 밖으로 나간 앱 시각 (−1 = 유예 없음) ·
//   hoverOnCard = 이번 프레임에 마우스가 떠 있는 카드 위다 (틱의 setScentPeek 가 읽는다 — 카드 위면 통과를 끄고 진하게)
let hoverGrace = -1, hoverOnCard = false;
function updateHover(view) {
  if ((P.cardHover === undefined ? 1 : P.cardHover) < 0.5) { hoverMark = null; hoverOnCard = false; return; }
  // ⚠ 전환·안개·존 연출 중에는 안 한다 — onPick 과 같은 가드다 (§9-4).
  //   존 연출 중에 카드가 뜨면 정보 블록과 같은 자리를 두 층이 잡는다
  if (phase.cue.busy || travel.busy || phase.cue.zone) return;
  if (hostHold) return;   // 앱 창이 열려 있는 동안 카드를 바꾸지 않는다 — 닫히면 고른 향수 그대로다 (v0.68.0)
  const mx = input.state.mx, my = input.state.my;
  // ⭐⭐ **카드 위 · 부표와 카드 사이의 틈** (2026-09-15, v0.65.0 — cardHoverBridge). 사용자 : *"향수 부표 마우스 오버시 모달창과 마우스 이동이 끊김
  //   옆 모달창에 마우스를 올리면 그 사이 공백으로 모달창이 사라지고있음"*.
  //   원인 둘 : ① 부표 히트박스를 벗어나는 첫 프레임에 호버를 놓았다 — 카드는 부표 가장자리에서 14px 밖에 서므로 건너는 동안 반드시 빈 곳을 지난다
  //   ② 카드 위에서도 레이캐스트가 **카드 뒤의** 바다 · 부표를 집어 카드를 닫거나 바꿨다 (누른 카드도 뒤의 부표로 바뀌었다)
  //   · 떠 있는 카드 위(꼬리 여유 8px)면 뒤를 안 집는다 — 누른 카드든 호버 카드든
  //   · 호버 카드의 부표에서 벗어나도 **부표와 카드를 함께 두른 상자** 안이면 건너는 중이라 둔다 · 밖으로 나가면 cardHoverGrace(0.35초) 뒤에 놓는다
  //   ⚠ 유예 동안은 마우스가 멈춰 있어도 매 프레임 다시 잰다 (시계가 흘러야 놓인다) — 짧아서 레이캐스트 몫은 작다
  //   0 = v0.64.0 (벗어나는 첫 프레임에 놓는다)
  const bridge = (P.cardHoverBridge === undefined ? 1 : P.cardHoverBridge) >= 0.5;
  const hpx = input.state.px, hpy = input.state.py;
  hoverOnCard = bridge && !!shownMark && ui.scentCardHit(hpx, hpy, 8);
  if (hoverOnCard) { hoverX = mx; hoverY = my; hoverGrace = -1; return; }
  if (mx === hoverX && my === hoverY && hoverGrace < 0) return;
  hoverX = mx; hoverY = my;
  const m = marks.pick(view, mx, my);
  // 고르기 중에는 **떠오른 12개만** 받는다 — 가라앉은 것은 눌러도 안 되는 것과 같아야 한다
  const next = (m && (!marks.focusing || marks.inFocus(m))) ? m : null;
  if (bridge && !next && hoverMark && shownMark === hoverMark) {
    if (ui.scentZoneHit(hpx, hpy, 8)) { hoverGrace = -1; return; }
    if (hoverGrace < 0) hoverGrace = t;
    if (t - hoverGrace < (P.cardHoverGrace === undefined ? 0.35 : P.cardHoverGrace)) return;
  }
  hoverGrace = -1;
  if (next === hoverMark) return;
  hoverMark = next;
  // ⭐⭐ **카드는 누를 때만 뜬다** (2026-09-18) — 사용자 : *"일단 카드 자동으로 열리는거 삭제하셈 안그래도
  //   이거 다시 디벨롭 올릴때 삭제 예정이었음"*. 부표 위를 **지나가기만 해도** 카드가 열려 화면 절반이 덮였다.
  //   ⚠ 고르기(클릭) · 카드 위 호버 다리(cardHoverBridge)는 그대로다 — **여는 방아쇠만** 뺐다.
  //   ⚠ `markHoverCard 1` 이면 예전과 비트 단위로 같다 (되돌릴 수 있게 둔다)
  const hoverCard = (PARAMS.markHoverCard === undefined ? 0 : PARAMS.markHoverCard) >= 0.5;
  if (next && hoverCard) marks.select(next);
  // 벗어났다 — 클릭으로 고른 것이 아직 화면에 있으면 그리로 돌아간다
  else if (clickMark && clickMark.on && clickMark.fade > 0.02) marks.select(clickMark);
  else marks.clearSelect();
}

// 픽셀 밀도 페이드가 쓸 실제 버퍼 해상도. 드라이버가 clamp 할 수 있으니 getSize 기준
function syncRes() {
  const sz = renderer.getSize(new THREE.Vector2());
  const pr = renderer.getPixelRatio();
  spray.setPixelRatio(pr);
  grids.setRes(sz.x * pr, sz.y * pr);
}

// 리사이즈에 반응해야 하는 것들을 한 줄에 모은다. 새 층을 붙일 때 여기 등록만 하면 된다
const resizeCbs = [syncRes];
function onResize(fn) {
  resizeCbs.push(fn);
  return () => { const i = resizeCbs.indexOf(fn); if (i >= 0) resizeCbs.splice(i, 1); };
}
syncRes();
// ⚠ onResize 는 resizeCbs 가 선언된 뒤에만 부를 수 있다 (TDZ)
onResize(() => reflect.resize());
const submerged = createSubmerged(renderer, scene, boat, [hemiLight, dirLight]);
water.uni.uSub.value = submerged.texture;
onResize(() => submerged.resize());
// ⭐ occluder — 부표 번짐(GlowPass)을 가리는 것. 배 뒤의 부표가 돛을 뚫고 번지면 안 된다 (2026-09-11 오후)
const bloom = createBloom(renderer, W(), H(), { occluder: boat.pivot });
onResize(() => bloom.resize(W(), H()));
// ⚠ 연결선의 굵기는 **화면 px** 라 창 크기를 알아야 한다 (LineMaterial.resolution — links.js)
links.resize(W(), H());
onResize(() => links.resize(W(), H()));

const nav = { scroll: { x: 0, z: 0 }, speed: CONFIG.speed.idle, head: 0, headV: 0, latV: 0 };
// 이번 프레임에 씬을 그린 카메라. 클릭 레이캐스트가 이걸 봐야 항공뷰에서도 좌표가 맞는다
let view = cam;
// 카드는 marks.selected 를 그대로 비춘다. 상태를 두 곳에 두지 않기 위한 거울 하나
let shownMark = null;
const clock = new THREE.Clock();

// 존 구도에서 시선을 밀 때 쓰는 축들. ⚠ 매 프레임 새로 만들지 않는다 (GC 압력)
const UP_Y = new THREE.Vector3(0, 1, 0);
const _dir = new THREE.Vector3(), _rgt = new THREE.Vector3();
const _upv = new THREE.Vector3(), _tgt = new THREE.Vector3();
// [8단계] 마우스 패럴랙스. camBase = 패럴랙스로 밀기 **전**의 카메라 자리 (gate.js 가 읽는다)
const camBase = new THREE.Vector3();
// ⚠⚠ **회전도 같이 기억한다.** 위치만 기억하고 축은 지금 카메라에서 뽑으면, 카메라가
//   평행이동할 때 lookAt 이 회전을 바꾸고 판이 **그 새 축으로 다시 배치돼 이중으로 움직인다.**
//   그게 우글거림의 정체였다 (2026-09-10).
const camBaseQ = new THREE.Quaternion();
// inspecting 에 머문 시간. 전환이 끝나고 **조금 지난 뒤**에 패럴랙스를 켠다
let paHold = 0;
let paX = 0, paY = 0;
// 패럴랙스가 살아 있는 정도. ⚠ cue.look 이 아니다 — 전환이 **끝난 뒤**에만 켠다
let paGate = 0;
// 커브·게이트까지 먹인 패럴랙스 값 (−1..1). gate.js 가 **기울기**에도 쓴다
let paSx = 0, paSy = 0;

// ── 카메라 자세 (패럴랙스 **전**) — cl = 존 구도 섞임 0..1 · s = 속도 0..1 (2026-09-11 에 함수로 뺐다).
// ⚠⚠ 틱과 향수 고르기의 **슬롯 계산이 같은 함수**를 부른다. 식을 두 곳에 적으면 12개가 화면의 제자리에서
//   비켜 앉는다 (불변식 2 와 같은 규율). 식 자체는 예전 카메라 블록 그대로다 — 주석은 틱 쪽에 남겨 뒀다
const _pose = { pos: new THREE.Vector3(), tgt: new THREE.Vector3(), rgt: new THREE.Vector3(), upv: new THREE.Vector3(), fwdH: new THREE.Vector3(), fov: 45, kD: 1, hW: 1 };
// 존에 들어갈 때 배가 돌기 시작한 각 (zoneShipYaw). 한 번 붙잡아 두고 swing 으로 섞는다 — null 이면 아직 안 잡았다
let _zoneYawFrom = null;
// ⭐⭐ 배가 씬 원점을 벗어난 양 (존 연출의 등장 · 정박). **자리를 놓는 곳과 물을 읽는 곳이 같이 봐야 해서** 여기 둔다.
//   ⚠ `sim.update` 는 카메라 블록보다 **먼저** 돌아서 한 프레임 전 값을 쓴다 — 시뮬 게이트가 30fps 라 그 지연은 화면에 안 드러난다.
const _shipOff = { x: 0, z: 0 };
// 그 이동의 **속도**를 배의 속도 단위(0~1 · 1 = 부스트)로 바꾼 값. 항적 · 물보라 · 흘수 눌림이 이걸 탄다 —
// ⚠ 안 넘기면 배는 옮겨지는데 `mv` 가 0 이라 물이 아무 반응을 안 한다 (연출 중 nav.speed 는 0 이다)
let _shipMv = 0;
// 시작 자리에 다 놓였는가 (그 뒤로는 속도로 민다) · 퇴장에서 0 으로 되돌릴 기준값
let _shipRun = false;
const _shipHold = { x: 0, z: 0 };
// ⭐⭐ 배의 시작 자리를 재는 **존 구도** 카메라 (2026-09-16). 배가 놓이는 때는 0.30s 인데 그때 카메라는 아직 **항해 구도**라,
//   그 자리(`_pose`)로 재면 어긋난다 — 실측 : hW(항해) = 1.65 × hW(존) 이라 `zoneShipOut` 0.46 이 존 구도에서는 **0.76** 이 되어 화면 밖이었다.
//   방향(rgt · fwdH)도 camYaw −52.1 → zoneYaw −30 으로 22° 다르다. 그래서 크기 · 방향 **둘 다** 존 구도에서 받는다.
const _poseZ = { pos: new THREE.Vector3(), tgt: new THREE.Vector3(), rgt: new THREE.Vector3(), upv: new THREE.Vector3(), fwdH: new THREE.Vector3(), fov: 45, kD: 1, hW: 1 };
// 지난 프레임의 연출 상태 — `leaving` → `sailing` 으로 넘어가는 **그 한 프레임**을 잡으려고 둔다
let _prevPhase = 'sailing';
// 세로로 긴 창(휴대폰)에서는 배를 옆으로 미는 몫을 0 까지 줄인다 (2026-09-11 오후 · 아래 zoneLookX 주석).
// ⚠ cameraPose 와 틱의 **배 등장**이 같이 읽는다 — 식을 두 곳에 적지 않는다 (불변식 2).
const lookRsp = (aspect) =>
  (PARAMS.uiResponsive === undefined ? 1 : PARAMS.uiResponsive) >= 0.5 ? clamp((aspect - 0.9) / 0.7, 0, 1) : 1;

// ⭐ `out.hW` 를 같이 낸다 (2026-09-16) — look 점 거리에서의 **화면 반폭(월드)**. 배를 화면 비율로 옮길 때 쓴다 (틱의 배 등장).
//   ⚠ 카메라 식은 안 바뀌었다 — 값 하나를 더 실어 보낼 뿐이다.
function cameraPose(cl, s, aspect, out) {
  const camZ = lerp(CONFIG.cam.zNear, CONFIG.cam.zFar, s);
  const camY = lerp(CONFIG.cam.yNear, CONFIG.cam.yFar, s);
  const kD = Math.max(0.2, lerp(PARAMS.camDist, PARAMS.zoneDist, cl));
  const L = CONFIG.cam.look;
  const yaw = lerp(PARAMS.camYaw, PARAMS.zoneYaw, cl) * Math.PI / 180;
  const pitch = lerp(PARAMS.camPitch, PARAMS.zonePitch, cl) * Math.PI / 180;
  const baseDist = Math.hypot(camZ - L[2], camY - L[1]) * kD;
  const cpit = Math.cos(pitch);
  out.pos.set(L[0] + baseDist * cpit * Math.sin(yaw),
              L[1] + baseDist * Math.sin(pitch),
              L[2] + baseDist * cpit * Math.cos(yaw));
  out.fov = lerp(CONFIG.cam.fovNear, CONFIG.cam.fovFar, s);
  out.kD = kD;
  _dir.set(L[0] - out.pos.x, L[1] - out.pos.y, L[2] - out.pos.z).normalize();
  out.rgt.crossVectors(_dir, UP_Y).normalize();
  out.upv.crossVectors(out.rgt, _dir);
  // 수평 전방 — 배를 카메라 쪽으로 당기면 화면 **아래**로 내려온다 (구도가 내려다보는 각이라). 등장의 대각선 성분이 쓴다
  out.fwdH.set(_dir.x, 0, _dir.z).normalize();
  // ⭐ 반응형 (2026-09-11 오후) — 세로로 긴 창(휴대폰)에서는 정보 블록이 **위에 가로로** 서므로 오른쪽을 비울 까닭이 없다.
  //   배를 왼쪽으로 미는 양(zoneLookX)을 창 비율 1.6 → 0.9 사이에서 0 까지 줄인다 (세로 비율 lookY 는 그대로).
  //   ⚠ uiResponsive 0 이면 예전 그대로 · 넓은 창(비율 1.6 이상)은 **비트 단위로** 예전과 같다
  const rsp = lookRsp(aspect);
  const lx = (PARAMS.zoneLookX === undefined ? 0 : PARAMS.zoneLookX) * cl * rsp;
  const ly = (PARAMS.zoneLookY === undefined ? 0 : PARAMS.zoneLookY) * cl;
  const hH = Math.tan(out.fov * 0.5 * Math.PI / 180) * baseDist;
  out.hW = hH * aspect;   // look 점 거리에서의 화면 반폭(월드) — 배를 '화면 반폭 대비 비율' 로 옮길 때 쓴다
  out.tgt.set(L[0], L[1], L[2]);
  if (lx !== 0 || ly !== 0) {
    out.tgt.addScaledVector(out.rgt, lx * out.hW).addScaledVector(out.upv, ly * hH);
  }
  return out;
}

// ── 먼 곳 이동 · 미니맵 · 향수 고르기 (2026-09-11, v0.32.0)
// ⚠⚠ tick() **보다 먼저** 만든다 — 루프가 첫 프레임부터 부른다 (위 campanel 의 TDZ 교훈)
const travel = createTravel({ nav, zones, pivotOf: () => boat.pivot });
// ⭐ onBlocked — 미니맵의 바깥(범위 밖 · 2026-09-13 부터 `--pb-void` 한 색)을 누르면 가지 않고 경고만 (2026-09-11 오후)
const minimap = createMinimap({ onPick: (t) => startTravel(t), onBlocked: () => ui.warn('범위 없음', '이 너머는 갈 수 없는 해역입니다') });
// ⭐⭐ 전체 화면 해도 (2026-09-12 저녁, v0.48.0 — chart.js). 미니맵 머리말의 [확대] 가 연다.
//   ⚠ 미니맵 **뒤에** 만든다 — 안개 격자를 그쪽에서 읽는다 (기록의 주인은 미니맵이다).
//   ⚠ 누르는 뜻은 미니맵과 **같다** (해역 이름 · 향수 · 빈 바다 → 그리로 떠난다 · 범위 밖 → 경고).
//     해도는 거기에 '향수 점을 직접 누르기' 한 갈래를 더한 것뿐이다
const chart = createChart({
  onPick: (t) => startTravel(t),
  onBlocked: () => ui.warn('범위 없음', '이 너머는 갈 수 없는 해역입니다'),
  minimap
});
// 도착했는데 연출이 아직 나가는 중(busy)이라 거절된 존. 틱에서 다시 건다 (zones 의 onArrive 주석)
let pendingArrive = null;
// 연출 중에 누른 바다 — 연출이 다 걷히면(sailing) 틱이 부스트 조타를 건다 (seaGo 주석 · seaGoAfterZone). 직접 조타 · 다른 떠나기가 오면 버린다
let pendingSea = null;
// 연출 중에 고른 먼 곳 이동 (카드 '이 향의 해역으로' · 검색창 · 해도) — 들어오는 중이면 다 들어온 순간 퇴장을 걸고, 다 걷히면 틱이 travel.start 를 건다 (startTravel 주석 · travelAfterZone)
let pendingTravel = null;
// ⭐ 클릭 항해의 **일반 속도** (스로틀 0..1) — 자동 조타가 가속이 아닐 때의 값. 예전 틱의 숫자 0.72 를 이름으로 뺐다 (2026-09-15, v0.65.0 · 값은 그대로)
const SAIL_NORMAL = 0.72;
// 지금 속도가 일반(0) ~ 최대 가속(1) 사이 어디인가. 일반보다 느리면 음수
function sailBoostK() { return (nav.speed - SAIL_NORMAL) / Math.max(1e-4, CONFIG.speed.boost - SAIL_NORMAL); }
// ⭐⭐ **클릭 항해 중 ESC · 스페이스 — 가속 ↔ 일반 속도** (2026-09-15, v0.65.0 — sailBoostKeys). 사용자 : *"클릭 이동 시에 esc 나 스페이스를 누르면 가속이 멈추고
//   일반 속도로 항해한다 아마 무작위로 누르는 사람이 있어서 어지러울 수 있는데 일반 속도로 도착하기전에는 가속을 다시 할 수 없게 해주고 반대로 최대 가속에
//   도달해야만 일반 가속으로 변경 가능하게"*.
//   · 가속 → 일반 : 속도가 최대 가속에 닿은 뒤(sailBoostK ≥ 0.97)에만 · ESC · 스페이스 둘 다
//   · 일반 → 가속 : 속도가 일반 속도로 다 내려온 뒤(≤ 0.03)에만 · 스페이스만 (ESC 는 켜지 않는다) · 향수 고르기 중에는 안 켠다 (pickSail 의 고정된 화면)
//   · 감속 중에 새로 누른 바다도 가속 없이 간다 (seaGo 의 coasting)
//   ⚠ 막힌 누름은 **버린다** — 쌓아 두면 무작위로 누른 것이 나중에 튀어나와 더 어지럽다
//   ⚠ 클릭 항해(바다 · 부표 — zones.auto 의 sea · pick)에만 뜻이 있다 · 방향키 Shift 가속 · 검색 · 먼 곳 이동은 건드리지 않는다
//   돌려주는 값 = 이 키를 먹었는가 (스페이스의 기본 동작 — 페이지 스크롤 — 을 막을지)
function sailBoostKey(toggle) {
  if ((P.sailBoostKeys === undefined ? 1 : P.sailBoostKeys) < 0.5) return false;
  const a = zones.auto;
  if (!a || !(a.sea || a.pick)) return false;
  const k = sailBoostK();
  if (a.boost) { if (k >= 0.97) a.boost = false; return true; }
  if (!toggle) return false;
  if (!marks.focusing && k <= 0.03) a.boost = true;
  return true;
}
// ⭐⭐ **부표를 누르면 가속을 멈추고, 누른 향수 곁으로 일반 속도로 간다** (2026-09-15, v0.65.0 — pickSail · 틱의 focusCamStill). 사용자 : *"향수 부표가 많이
//   겹쳐있을때 가속을하고있으면 시점이 바뀌어서 너무 겹쳐 보이는 상태로 유지되는데 그게 아니라 향수 부표를 클릭하면 즉시 가속을 멈춰야함 고정된 화면에서 일반
//   이동을 하고 연출동안에는 12개의 부표들은 움직이지 않겠지만 연출이 끝나면 최초 눌렸던 향수 근처에 이동하고 있거나 시간 뒤에 이동이 완료되어있어야함"*.
//   원인 : 12개의 자리는 **속도 0 카메라**(focusCamera)로 잡는데, 틱의 카메라는 속도만큼 물러나 · 올라가 · 화각이 넓어진다 (cameraPose 의 s) —
//     가속 중에 누르면 둘이 갈라져 12개가 겹쳐 보인 채 남았다.
//   · 가속을 끈다 (클릭 항해의 boost · 휠 가속) · 연출 동안 카메라는 속도를 안 탄다 (틱의 focusCamStill — 배는 가도 12개는 배 기준 씬 좌표라 화면에 선 채다)
//   · 클릭 항해 중이었거나 속도가 남아 있으면 목표를 **누른 향수 곁**으로 바꾼다 — 일반 속도 · 도착 반경 pickSailArrive (선회 반경 × 1.3 아래로 안 내린다 — seaGo 와 같은 까닭) ·
//     닿아도 존 연출은 없다 (sea). 고르기 중에 12개 안의 다른 향수를 눌러도 목표는 **처음 누른 향수**다 (onPick 의 고르기 갈래는 여기를 안 부른다)
//   ⚠ pickSail 1 = 움직이는 중일 때만 · 2 = 서 있어도 늘 그 향수 곁으로 · 0 = v0.64.0
//   ⚠ 먼 곳 이동(흰 안개 · lead)과 검색 · 해역 자동 조타는 목표를 안 바꾼다 — 가속만 끈다
function pickSail(m) {
  const mode = P.pickSail === undefined ? 1 : P.pickSail;
  if (mode < 0.5 || !marks.map || !m || m.src !== 'map') return;
  input.state.wheel = 0;
  const a = zones.auto;
  if (a && a.boost) a.boost = false;
  if (travel.target || travel.busy || (a && !(a.sea || a.pick))) return;
  const moving = !!a || nav.speed > 0.2;
  if (mode < 1.5 && !moving) return;
  const vN = groundSpeed(SAIL_NORMAL);
  const arrive = Math.max(P.pickSailArrive === undefined ? 8 : P.pickSailArrive, vN / Math.max(1e-4, turnRate(vN)) * 1.3);
  pendingSea = null;
  seaBlockT = 0;
  zones.goTo({ key: null, name: m.nameKo || m.name, x: m.x, z: m.z, custom: true, sea: true, pick: true, boost: false, arrive });
}
function arriveAt(key) {
  if (!phase.enter(key, { hold: P.zoneHold })) pendingArrive = key;
}
// 향수 고르기의 카메라 섞임 (선형 진행 0..1 — 틱이 이징을 먹인다)
let focusT = 0;
let focusLabelsOn = false;
const _fc = new THREE.PerspectiveCamera();
const _pose2 = { pos: new THREE.Vector3(), tgt: new THREE.Vector3(), rgt: new THREE.Vector3(), upv: new THREE.Vector3(), fwdH: new THREE.Vector3(), fov: 45, kD: 1, hW: 1 };
const _v3 = new THREE.Vector3();
// 말풍선이 피할 것들 (배 · 다른 부표의 화면 자리). ⚠ 매 프레임 새 배열을 만들지 않는다
const _obs = [];

// 떠나기. ⚠ 들어가 있는 연출·향수 고르기는 접고 떠난다 — 안 접으면 안개 뒤에서 두 층이 같은 카메라를 잡는다
function startTravel(target) {
  if (!target || travel.busy) return false;
  if (marks.focusing) { marks.focusOff(); marks.clearSelect(); clickMark = null; }
  pendingArrive = null;
  pendingSea = null;   // 먼 곳 이동이 이긴다 — 연출이 걷히길 기다리던 바다 떠나기는 버린다 (seaGo)
  // ⭐⭐ 연출 중이면 **연출이 다 걷힌 뒤에** 떠난다 (2026-09-14, travelAfterZone) — 카드 '이 향의 해역으로' · 검색창 · 해도가 이 길로 온다.
  //   사용자 : *"카드랑 검색도 연출이 끝나고 출발하게"*. 확인 받은 해석 : 떠나기는 연출을 끝으로 건너뛰지 않는다 — **남은 머묾을 버리고 퇴장 연출(1.9초)을
  //   처음부터** 자연스럽게 재생하고, 다 걷힌 뒤(sailing · 전환 없음) 먼 곳 이동을 시작한다.
  //   들어오는 중(entering)이면 **다 들어온 순간 머묾 없이 곧장** 퇴장한다 (사용자 선택 — 입장을 끊으면 퇴장 커브가 가득 찬 값에서 시작해 튄다).
  //   이미 나가는 중(leaving)이면 그 퇴장이 끝나길 기다린다. 목표는 pendingTravel 에 맡기고 틱이 건다 (pendingSea 옆)
  //   ⚠ 바다 누르기(seaGo)와 같은 까닭이다 — 같이 걸면 퇴장 트윈과 달리기(lead)의 속도에 따른 카메라 후퇴가 겹친다
  const ph = phase.cue.phase;
  if (phase.cue.zone && ph !== 'sailing' && (P.travelAfterZone === undefined ? 1 : P.travelAfterZone) >= 0.5) {
    if (ph === 'inspecting' && !phase.cue.busy) phase.leave();
    zones.clearAuto();
    pendingTravel = target;
    return true;
  }
  if (phase.cue.zone && !phase.cue.busy) phase.leave();
  pendingTravel = null;
  return travel.start(target);
}
// ⭐⭐ Shift + 빈 바다 누르기 → 그 자리로 **부스트 자동 조타** (2026-09-13, seaShiftGo). 사용자 : *"미니맵이 아닌 일반 바다를 클릭했을때
//   shift 를 누른상태로 빠르게 이동할수 있게해줘"*. '빠르게' 는 흰 안개 전환(startTravel)이 아니라 **부스트 속도로 직접 항해**다 (사용자 선택 —
//   눈에 보이는 바다는 가까워서 안개로 건너뛸 거리가 아니다). 향수 고르기 중이면 12개를 접고 바로 떠난다 (사용자 선택).
//   존 연출 중이면 걷고 떠난다 (startTravel 과 같다). 방향키를 잡으면 놓는다 (onManual → zones.clearAuto).
// ⭐ 2026-09-13 밤 (v0.58.0, seaClickGo) : **Shift 없이 누르기만 해도** 여기로 온다. 사용자 : *"마우스로 일반 화면 영역을 클릭하면 그 곳으로 움직이는
//   설정하게 해줘 클릭했을때 움직이면 shift 가속상태로"* — 'Shift' 는 누르는 조건이 아니라 **움직이는 상태**(부스트)였다
// ⚠ 누른 자리는 **수면 평면(y 0) 투영**이다 — 레이캐스터에 수면 메시(52만 삼각형)를 넣지 않는다 (marks.js pick 주석).
//   파도 높이만큼 어긋난다 — 카메라가 낮아 비스듬히 볼수록(먼 바다) 커진다. 크기는 아직 재지 않았다 (2026-09-13)
// ⚠ 씬 → 월드 : 배가 씬 원점이고 월드 위치가 (scroll.x, −scroll.z) 다 (불변식 0-2) → 월드 x = 씬 x + scroll.x · 월드 z = 씬 z − scroll.z
// ⚠⚠ 도착 반경은 **선회 반경보다 커야** 한다. 목표가 선회원 안(배 바로 옆)이면 방위각 조타가 뱃머리를 영영 못 맞추고 맴도는데,
//   맴도는 원은 목표를 선회 반경 안으로 지나가므로 반경 ≥ 선회 반경이면 반드시 닿는다 (× 1.3 은 각속도가 천천히 붙는 몫 — turnLerp)
// ⚠ 갈 수 있는 바다 밖을 누르면 가지 않고 '범위 없음' — 미니맵 · 해도와 같은 판정(그린 경계 그대로 · inNav 여유 0)이다
const _seaRay = new THREE.Raycaster(), _seaPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const _seaHit = new THREE.Vector3(), _seaNdc = new THREE.Vector2();
function seaGo(nx, ny) {
  if (!marks.map) return false;                                        // 향수 지도가 아니면(토러스) 예전 누르기 그대로
  _seaNdc.set(nx, ny);
  _seaRay.setFromCamera(_seaNdc, view);
  if (!_seaRay.ray.intersectPlane(_seaPlane, _seaHit)) return false;   // 하늘을 눌렀다
  const wx = _seaHit.x + nav.scroll.x, wz = _seaHit.z - nav.scroll.z;
  if (!marks.map.inNav(wx, wz, 0)) { ui.warn('범위 없음', '이 너머는 갈 수 없는 해역입니다'); return true; }
  // ⚠ 선택은 고르기 밖에서도 놓는다 (v0.58.0) — 빈 바다 누르기의 원래 뜻이 '선택을 놓는다' 다. 존 연출 중에 부표를 눌러 연 카드
  //   (연출 중에는 12개가 안 솟는다)가 바다를 누른 뒤에도 남아 배를 따라 떠 있었다
  if (marks.focusing) marks.focusOff();
  marks.clearSelect(); clickMark = null; hoverMark = null;
  // ⭐⭐ 연출 중이면 **연출이 다 걷힌 뒤에** 떠난다 (2026-09-14, seaGoAfterZone). 사용자 : *"연출 구도에서 마우스 클릭하고 빠져나올 때 바로 가속이 걸려서
  //   화면이 움찔거리며 연출을 빠져나옴 · 연출이 전부 걷히고 가속이 시작되어야한다"* · *"기본 화면일 때는 바로 가속해도 상관없음"*.
  //   걷히는 1.9초 동안 부스트가 같이 걸리면 카메라가 퇴장 트윈과 **속도에 따른 후퇴 · 상승 · 화각**(cameraPose 의 s)을 한꺼번에 탄다.
  //   그래서 목표를 pendingSea 에 맡겨 두고 틱이 'sailing' 을 확인한 순간 건다 (미뤄 둔 도착 pendingArrive 옆).
  //   ⚠ onPick 이 전환 중(busy) 누름을 이미 막으므로 여기 오는 연출은 늘 inspecting 이다
  const inZone = !!phase.cue.zone && phase.cue.phase === 'inspecting';
  // ⭐⭐ **연출 중 빈 바다 누름 = 연출 종료만. 떠나지 않는다** (2026-09-16, `zoneSeaEnds`).
  //   사용자 : *"그냥 한번클릭은 그 연출 즉시 종료로 만들어주고"*. 12개 고르기의 `focusSeaEnds`(v0.65.0)와 **같은 규약**이다 —
  //   연출이 떠 있을 때 누름의 뜻은 '떠난다' 가 아니라 **'이 화면을 닫는다'** 다.
  //   ⚠ 0 이면 v0.73.0 (연출이 걷힌 뒤 누른 자리로 부스트 — 아래 seaGoAfterZone 주석 그대로)
  const zoneEnds = inZone && (P.zoneSeaEnds === undefined ? 1 : P.zoneSeaEnds) >= 0.5;
  if (phase.cue.zone && !phase.cue.busy) phase.leave();
  travel.cancel();
  pendingArrive = null;
  pendingTravel = null;   // 새로 누른 바다가 이긴다 — 연출이 걷히길 기다리던 먼 곳 이동은 버린다 (startTravel)
  seaBlockT = 0;
  if (zoneEnds) {
    // 닫기만 한다 — 목표도 안 잡고 네 줄기(seamark)도 안 띄운다. 빨려 드는 줄기는 '그리로 간다' 는 대답이라 안 가는데 띄우면 거짓말이다
    pendingSea = null;
    zones.clearAuto();
    return true;
  }
  const vB = groundSpeed(CONFIG.speed.boost);
  const rTurn = vB / Math.max(1e-4, turnRate(vB));
  const arrive = Math.max(P.seaGoArrive === undefined ? 3 : P.seaGoArrive, rTurn * 1.3);
  // ⚠ custom : zones 의 targetOf 가 x·z 를 그대로 간다 · 미니맵 · 해도가 '가는 곳' 으로 그린다 (tick 의 tgt)
  // ⭐ 감속 중에는 가속을 다시 켜지 않는다 (2026-09-15, v0.65.0 — sailBoostKeys) — ESC · 스페이스 · 부표 누르기로 일반 속도로 바꾼 클릭 항해가 아직 다 내려오지 않았다
  const cur = zones.auto;
  const coasting = (P.sailBoostKeys === undefined ? 1 : P.sailBoostKeys) >= 0.5 && !!cur && !!(cur.sea || cur.pick) && !cur.boost && sailBoostK() > 0.03;
  const target = { key: null, name: '바다', x: wx, z: wz, custom: true, sea: true, boost: !coasting, arrive };
  if (inZone && (P.seaGoAfterZone === undefined ? 1 : P.seaGoAfterZone) >= 0.5) {
    zones.clearAuto();
    pendingSea = target;
  } else {
    pendingSea = null;
    zones.goTo(target);
  }
  // ⭐ 누른 자리로 빨려 드는 네 줄기 (v0.59.0 — seamark.js) — 떠나기를 미뤄도 **누른 순간** 띄운다 (누름을 받았다는 대답).
  //   ⚠ 범위 밖(위의 경고)에는 안 띄운다 — 가지 않는 곳이다
  seamark.show(wx, wz);
  return true;
}
// 존(= 향조) 이름으로 떠나기. 향수 지도가 꺼져 있으면(토러스) 옛 자동 조타 그대로
function goRegion(key) {
  const a = areaOf(key);
  if (!a) return;
  const an = marks.anchorOf(a.key);
  if (!an) { zones.search(a.key); return; }
  startTravel({ key: a.key, name: a.name, x: an.x, z: an.z, custom: true });
}
function goSearch(q) { const a = findArea(q); if (a) goRegion(a.key); }

// 연출 구도(cl = 1)의 **최종** 카메라 — 속도 0 · 패럴랙스 없음. 슬롯은 이 카메라로 잡는다
//   (marks.js 의 focus 주석 : 지금 카메라로 매 프레임 다시 잡으면 트윈 동안 부표가 미끄러진다)
function focusCamera() {
  cameraPose(1, 0, cam.aspect, _pose2);
  _fc.fov = _pose2.fov; _fc.aspect = cam.aspect; _fc.near = cam.near; _fc.far = cam.far;
  _fc.updateProjectionMatrix();
  _fc.position.copy(_pose2.pos); _fc.up.set(0, 1, 0); _fc.lookAt(_pose2.tgt);
  _fc.updateMatrixWorld(true);
  return _fc;
}
// 슬롯 : 가로는 화면 비율(focusX0~X1)의 **방위각**, 깊이는 카메라에서 **같은 수평 거리**(focusDist),
//   높이는 줄마다 focusHiY(맨 윗줄) → focusLoY(맨 아랫줄). focusCols 칸씩 줄을 채우고 **홀수 줄은 반 칸 엇갈린다**.
//   ⚠⚠ 처음에는 화면 비율 좌표를 수면 높이 평면에 투영했다 — 연출 구도는 거의 수평을 봐서(수평선 화면 30%)
//     윗줄 광선이 평면과 **못 만나** 34 월드 하늘(높이 5.3)에 작게(반지름 28px) 떴고, 아랫줄은 18 월드로
//     가까워 50px 로 부풀어 이웃과 닿았다 (실측, 1440×731). 거리를 고정하면 **크기가 고르다**.
//   ⚠ 줄 사이를 **높이로** 가른다 — 같은 높이의 먼·가까운 줄은 화면에서 1° 차이라 겹친다 (수평선 근처 원근)
//   ⚠ 오른쪽 끝(focusX1)은 미니맵(우하단)을 비켜야 이름표가 안 가려진다
function focusSlots(fc) {
  const n = clamp(Math.round(P.focusCount === undefined ? 12 : P.focusCount), 1, 24);
  // ⭐ 반응형 (2026-09-11 오후) — 세로로 긴 창(비율 1.1 아래)에서는 화면 오른쪽 30% 에 4칸이 안 들어간다 (휴대폰 폭이면 칸당 30px).
  //   화면 가로 10~90% 에 3칸씩으로 편다 (12개면 4줄). ⚠ uiResponsive 0 이면 예전 그대로
  const narrow = (P.uiResponsive === undefined ? 1 : P.uiResponsive) >= 0.5 && fc.aspect < 1.1;
  const cols = narrow ? 3 : clamp(Math.round(P.focusCols === undefined ? 4 : P.focusCols), 1, 8);
  const rows = Math.ceil(n / cols);
  const x0 = narrow ? 0.10 : P.focusX0, x1 = narrow ? 0.90 : P.focusX1, d = P.focusDist === undefined ? 26 : P.focusDist;
  const yHi = P.focusHiY === undefined ? 5.8 : P.focusHiY, yLo = P.focusLoY === undefined ? 2.2 : P.focusLoY;
  const out = [];
  for (let r = 0, left = n; r < rows; r++) {
    const y = rows > 1 ? yHi + (yLo - yHi) * r / (rows - 1) : (yHi + yLo) * 0.5;
    const stag = r % 2 ? 0.5 : 0;
    const cN = Math.min(cols, left);
    left -= cN;
    for (let c = 0; c < cN; c++) {
      // 엇갈린 줄까지 폭 안에 들어오게 반 칸을 남겨 둔다
      const u = x0 + (x1 - x0) * (c + stag) / Math.max(1, cols - 1 + (rows > 1 ? 0.5 : 0));
      _v3.set(u * 2 - 1, 0, 0.5).unproject(fc).sub(fc.position);
      const hn = Math.hypot(_v3.x, _v3.z) || 1;
      out.push({ x: fc.position.x + _v3.x / hn * d, y, z: fc.position.z + _v3.z / hn * d, sx: u });
    }
  }
  return out;
}
// ⭐ 흩기 (2026-09-12, focusScatter) — 사용자 : *"12개 나열식이 아니라 적당히 근처에 랜덤하게 잘 클릭할 수 있게 떠있어야함"*.
//   같은 방식(방위각 · 수평 거리 · 높이)으로 슬롯을 내되 **자리를 흩는다** — 가장 먼 후보 고르기 (Mitchell) :
//   후보 32개를 뽑아 이미 놓인 슬롯들과 **화면에서** 가장 먼 것을 고른다. 거리는 가로 focusGapX · 세로 focusGapY 의 타원 —
//   부표 **위**에 이름표가 뜨므로 가로를 이름표 폭만큼 넓게 잰다 (세로로 붙으면 이름표가 위 부표를 가린다).
//   ⚠ 시드 = 누른 향수의 id — 같은 향수를 누르면 같은 배치, 다른 향수면 다른 배치다 (완전 무작위면 다시 눌렀을 때 자리가 튄다)
//   ⚠ 미니맵 · 검색바 자리는 후보에서 뺀다 (DOM 상자 + 이름표 여유). 깊이도 ±focusJitterD 흔들어 크기가 조금씩 다르다
//   ⚠ 짝짓기(marks.focusOn)는 그대로 **화면 x 순서**다 — 슬롯의 sx 가 곧 방위각 비율이다
const _v3s = new THREE.Vector3();
const _box = new THREE.Box3();   // 배의 경계 상자 (focusAvoidBoat — 누를 때마다 다시 잰다)
// 호스트 헤더가 무대 위에 겹친 높이 (CSS px, 2026-09-15 v0.69.0 — hostTop). 3D 는 그 뒤까지 그리지만 그 띠의 UI · 부표는 가려지고 못 누른다
function hostTopPx() { return clamp(P.hostTop === undefined ? 0 : P.hostTop, 0, 240); }
// 피할 상자 (CSS px) — 흩기와 깊이 배치가 **같이** 쓴다 (2026-09-13 에 흩기에서 꺼냈다 — 두 곳에 적지 않는다)
function focusKeepBoxes(fc, W0, H0) {
  // 피할 상자 (CSS px) — 미니맵 · 검색바. 이름표가 부표 위로 뜨므로 위쪽 여유를 더 둔다
  const keep = [];
  // ⭐ 호스트 헤더 띠 (v0.69.0, hostTop) — 화면 폭 전체 · 헤더 아래 40px(이름표 몫)까지. 흩기는 부표 중심을 이 띠에서 뺀다.
  //   `band` — 깊이 배치는 이 상자를 겹침 벌점으로 안 본다 (옆으로 비켜서는 못 벗어나는 띠라 비끼기 후보만 헛돈다) · 화면 밖 검사가 위 끝으로 본다
  const ht = hostTopPx();
  if (ht > 0) keep.push({ x0: -1e5, x1: W0 + 1e5, y0: -1e5, y1: ht + 40, band: true });
  const st = ui.stage.getBoundingClientRect();
  for (const id of ['minimap', 'search-input']) {
    const el = document.getElementById(id);
    if (!el || getComputedStyle(el).visibility === 'hidden') continue;
    const r = el.getBoundingClientRect();
    if (r.width > 0) keep.push({ x0: r.left - st.left - 40, x1: r.right - st.left + 40, y0: r.top - st.top - 30, y1: r.bottom - st.top + 40 });
  }
  // ⭐ 배 피하기 (2026-09-12 오후, focusAvoidBoat) — 사용자 : *"화면에 좀 더 골고루 퍼져있어야함"* 으로 영역을 화면 전부로
  //   넓힌 대신, 존 구도에서 왼쪽 아래에 크게 앉는 **배(돛 끝까지)** 를 후보에서 뺀다. 안 빼면 돛 위에 부표가 겹쳐 선다.
  //   ⚠ 배는 씬 원점이다 (불변식 0-2 — 배가 원점이고 부표가 흘러간다). 경계 상자를 **누를 때마다** 다시 잰다 (뱃머리가 돌아 있으므로).
  //     Box3.setFromObject 는 무겁지만 여기는 클릭 한 번에 한 번이다 (매 프레임이 아니다)
  //   ⚠ 위쪽 여유를 더 준다 — 이름표가 부표 **위**에 뜨므로 돛 바로 위 부표는 글자가 돛에 걸린다
  const avoid = Math.max(0, P.focusAvoidBoat === undefined ? 1 : P.focusAvoidBoat);
  if (avoid > 0 && boat && boat.pivot) {
    _box.setFromObject(boat.pivot);
    if (!_box.isEmpty()) {
      let bx0 = 1e9, bx1 = -1e9, by0 = 1e9, by1 = -1e9;
      for (let i = 0; i < 8; i++) {
        _v3.set(i & 1 ? _box.max.x : _box.min.x, i & 2 ? _box.max.y : _box.min.y, i & 4 ? _box.max.z : _box.min.z).project(fc);
        const px = (_v3.x * 0.5 + 0.5) * W0, py = (-_v3.y * 0.5 + 0.5) * H0;
        bx0 = Math.min(bx0, px); bx1 = Math.max(bx1, px); by0 = Math.min(by0, py); by1 = Math.max(by1, py);
      }
      // ⭐⭐ 2026-09-13 저녁 (focusBoatClear) — 여유를 **창 폭에 비례**하는 focusBoatPad 로 넓힌다 (예전 18px 고정).
      //   사용자 : *"배가 부표를 가리지않도록 더 넓게 구성해야함"*. 이름표 몫(부표 위)은 깊이 배치가 부표마다 따로 잰다 (boatHit)
      //   ⚠ `boat: true` 표시 — 깊이 배치는 이 상자를 중심점이 아니라 **몸통 · 이름표**로 검사한다
      if ((P.focusBoatClear === undefined ? 1 : P.focusBoatClear) >= 0.5) {
        const pad = Math.max(0, P.focusBoatPad === undefined ? 28 : P.focusBoatPad) * avoid * W0 / 1440;
        keep.push({ x0: bx0 - pad, x1: bx1 + pad, y0: by0 - pad, y1: by1 + pad * 0.5, boat: true });
      } else {
        const mgx = 18 * avoid, mgy = 14 * avoid;
        keep.push({ x0: bx0 - mgx, x1: bx1 + mgx, y0: by0 - mgy - 26 * avoid, y1: by1 + mgy });
      }
    }
  }
  return keep;
}
function focusScatterSlots(fc, n, seed) {
  const narrow = (P.uiResponsive === undefined ? 1 : P.uiResponsive) >= 0.5 && fc.aspect < 1.1;
  const x0 = narrow ? 0.08 : (P.focusScX0 === undefined ? 0.44 : P.focusScX0);
  const x1 = narrow ? 0.92 : (P.focusScX1 === undefined ? 0.86 : P.focusScX1);
  const yHi = P.focusScHiY === undefined ? 6.2 : P.focusScHiY, yLo = P.focusScLoY === undefined ? 1.8 : P.focusScLoY;
  const d = P.focusDist === undefined ? 26 : P.focusDist, jd = P.focusJitterD === undefined ? 5 : P.focusJitterD;
  const W0 = W(), H0 = H();
  const gx = (P.focusGapX === undefined ? 120 : P.focusGapX) * W0 / 1440, gy = (P.focusGapY === undefined ? 58 : P.focusGapY) * H0 / 731;
  const keep = focusKeepBoxes(fc, W0, H0);
  let s = (seed >>> 0) || 1;
  const rnd = () => { s = (s + 0x6D2B79F5) >>> 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const out = [], scr = [];
  for (let i = 0; i < n; i++) {
    let best = null, bestS = -1;
    for (let c = 0; c < 32; c++) {
      const u = x0 + (x1 - x0) * rnd();
      const y = yLo + (yHi - yLo) * rnd();
      const dd = d + (rnd() * 2 - 1) * jd;
      _v3.set(u * 2 - 1, 0, 0.5).unproject(fc).sub(fc.position);
      const hn = Math.hypot(_v3.x, _v3.z) || 1;
      const px = fc.position.x + _v3.x / hn * dd, pz = fc.position.z + _v3.z / hn * dd;
      _v3s.set(px, y, pz).project(fc);
      const sx = (_v3s.x * 0.5 + 0.5) * W0, sy = (-_v3s.y * 0.5 + 0.5) * H0;
      if (keep.some(k => sx > k.x0 && sx < k.x1 && sy > k.y0 && sy < k.y1)) continue;
      let sc = 1e9;
      for (const q of scr) { const ex = (sx - q.x) / gx, ey = (sy - q.y) / gy; sc = Math.min(sc, ex * ex + ey * ey); }
      if (sc > bestS) { bestS = sc; best = { x: px, y, z: pz, sx: u, px: sx, py: sy }; }
    }
    if (!best) { // 후보가 전부 피할 상자 안이면 (아주 좁은 창) 영역 가운데에 둔다
      _v3.set((x0 + x1) - 1, 0, 0.5).unproject(fc).sub(fc.position);
      const hn = Math.hypot(_v3.x, _v3.z) || 1;
      best = { x: fc.position.x + _v3.x / hn * d, y: (yHi + yLo) * 0.5, z: fc.position.z + _v3.z / hn * d, sx: (x0 + x1) * 0.5, px: 0, py: 0 };
    }
    out.push({ x: best.x, y: best.y, z: best.z, sx: best.sx });
    scr.push({ x: best.px, y: best.py });
  }
  return out;
}
// ⭐⭐ **깊이 배치** (2026-09-13, focusDepth) — 사용자 : *"12개 부표 연결 차이가 많이나면 가로로 길게 이어지게하는게아니라
//   뒤로길게 바다 뒷쪽으로 길게 이어지게 구성해줘 일직선으로 뒤로 선을 이어지게 만들면 부표에 가려 안보이게 되니"*.
//   ① 무리를 **선과 같은 식**으로 짠다 (links.js `linkEdges` — 두 곳에 적으면 배치가 가정한 무리와 그려지는 선이 갈라진다)
//   ② 무리마다 **뿌리**를 고른다 — 누른 향수가 들어 있으면 그것, 아니면 누른 향수와 가장 비슷한 것
//   ③ 뿌리에서 너비 우선으로 내려가며 **이어진 짝의 차이(지도 거리)를 쌓는다** — 쌓인 차이가 곧 **깊이**다.
//      그래서 차이가 큰 짝일수록 뒤 부표가 멀리 서고, 선이 가로가 아니라 **바다 뒤쪽으로** 길게 뻗는다
//      (뿌리 자신도 누른 향수와 다른 만큼 조금 뒤로 선다 — focusDepthRoot)
//   ④ ⚠⚠⚠ **'뒤' 는 카메라 앞 방향과 평행이다 — 카메라에서 뻗는 방사선이 아니다.** 원근에서 평행선은 소실점으로 모이므로
//      왼쪽 줄기는 오른쪽으로, 오른쪽 줄기는 왼쪽으로 **수평선의 소실점을 향해 길게** 뻗는다.
//      둘째 판은 방위각(화면 x)을 지킨 채 물러나게 했다 — 뒤 부표가 앞 부표 **바로 위**에 설 뿐이라
//      차이가 가장 큰 선이 화면에서 **57px** 이었다 (실측 1920×1080). 방향은 맞았는데 짧았다
//   ⑤ ⚠⚠ **높이도 깊이를 따른다** — 실측 : 연출 카메라 높이 3.87 에서 거리 20 → 52 로 물러날 때 화면 세로 이동이
//      높이 1.5 **99px** · 3.0 **37px** · 6.0 **−90px** 이다. 눈높이 근처에서는 깊이가 화면에서 **안 움직인다**.
//      첫 시안은 흩기의 높이 띠(1.5~6.8)를 그대로 써서 높이 차가 깊이를 덮고 **가로로 읽혔다**.
//      그래서 줄기마다 눈 아래(바다 · YNear → YFar) 아니면 눈 위(하늘 · YHiNear → YHiFar)로 **갈라** 세운다
//   ⑥ 무리마다 **화면 가로 줄기**를 하나씩 준다 — 지금 화면 좌우 순서대로 (예전 짝짓기와 같은 규율). 줄기는 뿌리의 자리다.
//      좌우 순서로 **바다 · 하늘을 번갈아** 준다 — 바다만 쓰면 12개가 수평선 아래 165px 띠에 몰렸다 (셋째 판).
//      누른 향수의 무리는 늘 바다 쪽이다
//   ⑦ **가운데 줄기는 바깥으로 비스듬히 물러난다** (focusDepthYaw) — 소실점 바로 앞은 원근이 옆으로 벌려 주지 않아
//      곧게 위로만 서고 선이 짧았다 (셋째 판 : 차이가 가장 큰 선 **75px**)
//   ⑧ ⚠⚠ **옆 비끼기는 선이 보이는 데 모자란 만큼만, 이미 벌어진 쪽으로** — 곧게 뒤로 서면 뒤 부표가 앞 부표에 겹쳐
//      **선이 가린다** (사용자가 먼저 짚었다). ⚠ 셋째 판은 방향을 지그재그로 고정해서 원근이 벌려 준 쪽과 **반대로** 밀었고,
//      도쿄 피그 → 세인트모리츠 가 부모 위에 얹혔다 (몸통 사이 −9px). 가지가 여럿일 때만 정해진 쪽으로 벌린다
//   ⑨ 자리 다듬기 — 목표 둘레 후보 중 간격 · 피할 상자 · **선이 부표에 가리지 않는가**를 가장 잘 지키는 것을 고른다
//   ⚠ 선이 없는 향수(혼자인 무리)는 뿌리의 규칙만 탄다 — 누른 향수와 다를수록 조금 뒤다
//   ⚠ 시드 = 누른 향수의 id (흩기와 같은 규율 — 같은 향수를 누르면 같은 배치)
//   ⚠ 반환 = Map(향수 → {x, y, z(씬), sx}) — marks.focusOn 이 그대로 슬롯으로 쓴다. 검사는 `PB.focusPlan()`
let lastFocusPlan = null;
function focusDepthPlace(fc, set, clicked, seed, boatX, boatZ) {
  const n = set.length;
  if (!n) return null;
  const mode = P.focusLinkMode || 0;
  const maxN = Math.max(2, Math.round(P.focusLinkMax === undefined ? 4 : P.focusLinkMax));
  const items = set.map(q => ({ id: q.perfume ? q.perfume.id : -1, nb: q.perfume ? q.perfume.nb : null,
    mx: q.perfume ? q.perfume.mx : 0, my: q.perfume ? q.perfume.my : 0, clicked: q === clicked }));
  const edges = linkEdges(items, mode, maxN);
  // 인접 목록 — 무게는 두 향수의 **차이**다 (linkEdges 의 d 는 제곱이다).
  //   ⭐ v0.62.0 : 기준은 focusLinkBasis 다 — neighbors 면 1 − 유사도 · 0 이면 예전처럼 지도 거리 (links.js `linkDiff`)
  const adj = set.map(() => []);
  for (const [i, j, d2] of edges) { const w = Math.sqrt(d2); adj[i].push([j, w]); adj[j].push([i, w]); }
  const ci = set.indexOf(clicked);
  // 누른 향수와의 차이 — 뿌리 고르기 · 깊이 점수가 읽는다. ⚠ 선과 **같은 식**(linkDiff)이라야 쌓인 차이(cum)와 같은 눈금이다
  const dClick = (i) => (ci < 0 || i === ci ? 0 : linkDiff(items[i], items[ci]));
  // ── 무리 (연결 성분)
  const comp = new Array(n).fill(-1), groups = [];
  for (let i = 0; i < n; i++) {
    if (comp[i] >= 0) continue;
    const g = [], st = [i];
    comp[i] = groups.length;
    while (st.length) {
      const q = st.pop();
      g.push(q);
      for (const [j] of adj[q]) if (comp[j] < 0) { comp[j] = groups.length; st.push(j); }
    }
    groups.push(g);
  }
  // ── 뿌리 → 너비 우선 : 부모 · 쌓인 차이 · 단 · 자식
  const par = new Array(n).fill(-1), cum = new Array(n).fill(0), lvl = new Array(n).fill(0), kids = set.map(() => []);
  const roots = groups.map((g) => {
    const r = g.includes(ci) ? ci : g.reduce((best, i) => (dClick(i) < dClick(best) ? i : best), g[0]);
    const seen = new Set([r]), qu = [r];
    while (qu.length) {
      const q = qu.shift();
      // ⚠ 가까운 짝부터 내려간다 — 자식 순서가 비끼는 방향을 정하므로 누를 때마다 같아야 한다
      for (const [j, w] of adj[q].slice().sort((x, y) => x[1] - y[1])) {
        if (seen.has(j)) continue;
        seen.add(j); par[j] = q; cum[j] = cum[q] + w; lvl[j] = lvl[q] + 1; kids[q].push(j); qu.push(j);
      }
    }
    return r;
  });
  // ── 깊이. 점수 = 뿌리가 누른 향수와 다른 몫 + 쌓인 차이. 가장 큰 점수가 far 에 선다
  const num = (v, d) => (v === undefined ? d : v);
  const near = Math.max(4, num(P.focusDepthNear, 16));
  const far = Math.max(near + 1, num(P.focusDepthFar, 80));
  const rootK = Math.max(0, num(P.focusDepthRoot, 0.3));
  const yN = Math.max(0.5, num(P.focusDepthYNear, 1.6)), yF = Math.max(0.5, num(P.focusDepthYFar, 2.8));
  const yHN = Math.max(0.5, num(P.focusDepthYHiNear, 6.4)), yHF = Math.max(0.5, num(P.focusDepthYHiFar, 5.2));
  const sideMin = Math.max(0, num(P.focusDepthSide, 0.018));
  const yawMax = Math.max(0, num(P.focusDepthYaw, 24)) * Math.PI / 180;
  const score = set.map((_, i) => dClick(roots[comp[i]]) * rootK + cum[i]);
  const sMax = Math.max(1e-6, ...score);
  const tOf = (i) => score[i] / sMax;
  const depthOf = (i) => near + (far - near) * tOf(i);
  // ── 줄기 (무리마다 화면 가로 한 칸). 지금 화면 좌우 순서대로 늘어놓고, 옆으로 벌어지는 무리일수록 넓게 준다
  const narrow = (P.uiResponsive === undefined ? 1 : P.uiResponsive) >= 0.5 && fc.aspect < 1.1;
  // ⭐⭐ 배를 비켜 넓게 (2026-09-13 저녁, focusBoatClear) — 영역을 넓히고(focusDepthX0/X1) 배 기둥을 건너뛴다 (아래 laneU)
  const clear = (P.focusBoatClear === undefined ? 1 : P.focusBoatClear) >= 0.5;
  const x0 = narrow ? 0.08 : clear ? num(P.focusDepthX0, 0.06) : num(P.focusScX0, 0.14);
  const x1 = narrow ? 0.92 : clear ? num(P.focusDepthX1, 0.94) : num(P.focusScX1, 0.90);
  const W0 = W(), H0 = H();
  const keep = focusKeepBoxes(fc, W0, H0);
  // 배 상자 (CSS px) — focusBoatClear 일 때만 따로 다룬다. 꺼져 있으면 null 이고 예전처럼 중심점 검사에 섞인다
  const boatK = clear && !narrow ? (keep.find(k => k.boat) || null) : null;
  const nowX = (i) => { _v3.set(set[i].x - boatX, P.markHeight, set[i].z - boatZ).project(fc); return _v3.x; };
  const order = groups.map((_, gi) => gi).sort((ga, gb) => nowX(roots[ga]) - nowX(roots[gb]));
  const breadth = (gi) => {
    let wide = 0;
    for (const i of groups[gi]) wide = Math.max(wide, lvl[i], kids[i].length);
    return 1 + Math.min(3, wide);
  };
  const tot = order.reduce((acc, gi) => acc + breadth(gi), 0) || 1;
  // ⭐ 줄기 자리를 **배 기둥을 건너뛴 띠**에 나눠 준다 (focusBoatClear). 좌우 빈 곳을 이어 붙인 길이 위에 비율로 놓고 되펼친다 —
  //   좌우 순서는 그대로다. ⚠ 배 상자가 없으면 빈 곳 = 영역 전체라 예전 식과 값 단위로 같다.
  //   실측 (1440×780, 라임 바질 앤 만다린) : 예전에는 왼쪽 무리가 뒤로 물러나며 소실점(720px) 쪽 — 배 상자(372~682px) 안에 셋이 섰다
  const gapL = boatK ? clamp(boatK.x0 / W0, x0, x1) : x1, gapR = boatK ? clamp(boatK.x1 / W0, x0, x1) : x1;
  const freeL = gapL - x0, freeR = x1 - gapR;
  const laneU = (q) => { const p = q * (freeL + freeR); return p <= freeL ? x0 + p : gapR + (p - freeL); };
  const laneC = new Array(groups.length);
  for (let acc = 0, t = 0; t < order.length; t++) {
    const gi = order[t], bw = breadth(gi);
    laneC[gi] = laneU((acc + bw / 2) / tot);
    acc += bw;
  }
  // 바다 · 하늘 — 좌우 순서로 번갈아. ⚠ 누른 향수의 무리는 늘 바다 쪽이 되게 짝을 맞춘다
  const sky = new Array(groups.length).fill(false);
  {
    const ct = ci >= 0 ? order.indexOf(comp[ci]) : -1;
    const flip = ct >= 0 && ct % 2 === 1;
    order.forEach((gi, t) => { sky[gi] = (t % 2 === 1) !== flip; });
  }
  const heightOf = (i) => (sky[comp[i]] ? yHN + (yHF - yHN) * tOf(i) : yN + (yF - yN) * tOf(i));
  // 가운데 줄기 비틀기 — 가운데일수록 크게, 화면 가로 ±60% 밖은 0. 방향은 **바깥쪽** (가운데면 좌우 순서로 번갈아)
  const tanYaw = groups.map((_, gi) => {
    const ndc = laneC[gi] * 2 - 1;
    const w = 1 - Math.min(1, Math.abs(ndc) / 0.6);
    const sg = Math.abs(ndc) >= 0.08 ? Math.sign(ndc) : (order.indexOf(gi) % 2 ? 1 : -1);
    return Math.tan(yawMax * w) * sg;
  });
  // ── 비끼는 방향 (가지가 여럿일 때만 쓴다). 가지 하나면 원근이 벌려 준 쪽을 따른다
  const sgnOf = new Array(n).fill(1), magOf = new Array(n).fill(1), dir = new Array(n).fill(1);
  groups.forEach((g, gi) => {
    const qu = [roots[gi]];
    while (qu.length) {
      const q = qu.shift(), ks = kids[q], k = ks.length;
      ks.forEach((j, t) => {
        const sgn = (t % 2 ? 1 : -1) * dir[q];
        dir[j] = sgn; sgnOf[j] = sgn; magOf[j] = k === 1 ? 1 : 1 + Math.floor(t / 2);
        qu.push(j);
      });
    }
  });
  // ── 카메라의 **수평 앞 · 오른쪽** 단위 벡터. '뒤로' 는 앞 방향으로 평행하게 물러나는 것이다 (④)
  const cx = fc.position.x, cz = fc.position.z;
  fc.getWorldDirection(_v3);
  { const hn = Math.hypot(_v3.x, _v3.z) || 1; _v3.set(_v3.x / hn, 0, _v3.z / hn); }
  const fx = _v3.x, fz = _v3.z;
  let rx = -fz, rz = fx;
  const toScr = (x, y, z) => { _v3s.set(x, y, z).project(fc); return [(_v3s.x * 0.5 + 0.5) * W0, (-_v3s.y * 0.5 + 0.5) * H0]; };
  // 오른쪽의 부호와 '옆 1 월드가 화면 가로 몇 px 인가' 를 투영으로 잰다 (식으로 풀지 않는다 — 연출 구도의 기울기까지 들어간다)
  const REF = 20;
  const pxAt = (f, l, y) => toScr(cx + fx * f + rx * l, y, cz + fz * f + rz * l);
  const c0 = pxAt(REF, 0, 2)[0], c1 = pxAt(REF, 1, 2)[0];
  if (c1 < c0) { rx = -rx; rz = -rz; }
  const pxPerWorld = Math.max(1e-3, Math.abs(c1 - c0));        // 앞 거리 REF 에서 옆 1 월드의 화면 px
  const latFor = (px, f) => px / pxPerWorld * (f / REF);          // 화면 px 만큼 옆으로 → 앞 거리 f 에서의 월드 옆 거리
  const posOf = (f, l, y) => [cx + fx * f + rx * l, y, cz + fz * f + rz * l];
  const vpx = pxAt(REF, 0, 2)[0];                                  // 소실점의 화면 x
  const latForU = (u, f) => latFor(u * W0 - vpx, f);
  // ── 자리 다듬기
  const gx = num(P.focusGapX, 120) * W0 / 1440, gy = num(P.focusGapY, 58) * H0 / 731;
  // ⭐ 배 상자 검사 (focusBoatClear) — 중심점이 아니라 **몸통과 그 위 이름표**가 상자에 걸리는가.
  //   이름표는 가운데 정렬이라 짧은 이름도 반폭 34px(1440 기준)은 차지한다고 본다
  const LBL = 24;
  const lblW = (r) => Math.max(r, 34 * W0 / 1440);
  const boatHit = (px, py, r) => !!boatK && px + lblW(r) > boatK.x0 && px - lblW(r) < boatK.x1 && py + r > boatK.y0 && py - r - LBL < boatK.y1;
  // 배 상자 **반대쪽 바깥**까지 옆으로 밀 화면 px (배 가운데보다 왼쪽이면 왼쪽으로)
  const boatPush = (px, r) => {
    const cxB = (boatK.x0 + boatK.x1) * 0.5;
    return px < cxB ? boatK.x0 - (px + lblW(r)) - 2 : boatK.x1 - (px - lblW(r)) + 2;
  };
  // 선분이 상자를 지나가는가 (Liang–Barsky)
  const segHitsBox = (ax, ay, bx, by, k) => {
    let t0 = 0, t1 = 1;
    const dx = bx - ax, dy = by - ay;
    for (const [p, q] of [[-dx, ax - k.x0], [dx, k.x1 - ax], [-dy, ay - k.y0], [dy, k.y1 - ay]]) {
      if (p === 0) { if (q < 0) return false; continue; }
      const t = q / p;
      if (p < 0) { if (t > t1) return false; if (t > t0) t0 = t; } else { if (t < t0) return false; if (t < t1) t1 = t; }
    }
    return true;
  };
  let s = (seed >>> 0) || 1;
  const rnd = () => { s = (s + 0x6D2B79F5) >>> 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  // 부표 몸통의 화면 반지름 (px) — 몸통 월드 반지름을 그 자리에서 위로 올려 투영한 차이
  const radPx = (i, x, y, z) => {
    const rw = set[i].rw || CONFIG.mark.ballR * Math.max(0.05, P.markScale);
    const p0 = toScr(x, y, z), p1 = toScr(x, y + rw, z);
    return Math.max(1, Math.abs(p0[1] - p1[1]));
  };
  // 점과 선분 사이 거리 (화면 px)
  const segDist = (px, py, ax, ay, bx, by) => {
    const vx = bx - ax, vy = by - ay, L2 = vx * vx + vy * vy || 1;
    const t = Math.max(0, Math.min(1, ((px - ax) * vx + (py - ay) * vy) / L2));
    return Math.hypot(ax + vx * t - px, ay + vy * t - py);
  };
  const JD = 0.04;   // 후보 깊이 흔들기 (비율)
  // ⭐⭐ 화면 안 · 겹침 (2026-09-14, v0.63.0 — focusDepthFit). 사용자 : *"너무 향수끼리 겹치는 경우가 많음 좌우로 약간 넓혀 배치해야하고
  //   화면 자체를 벗어나는 경우가 있음"*. 실측 v0.62.0 (1181×628 · 부표 200개를 차례로 누름 + 무작위 바다 200곳) :
  //   화면 밖 부표가 있는 장면 **44.5%** (전부 가지 · 좌우 · 첫 판에서 235개 중 211개는 중심까지 밖) · 몸통 겹침 64.3% · 이름표 겹침 94.3% (겹친 이름표는 하나가 숨는다).
  //   → fit 1 · spread 1.25 (같은 로드 · 같은 400장면) : 화면 밖 0 · 몸통 겹침 0 · 이름표 겹침 1.8% · 미니맵 침범 26.8% → 0 · 이웃 간격 65.8 → 84.1px (CHANGELOG v0.63.0)
  //   ① 가지 후보가 목표 둘레 **±1.2% 폭**만 흔들어서, 목표가 화면 밖이면 후보가 전부 걸러지고 '목표 그대로' 로 떨어졌다 → 화면 밖
  //   ② 화면 검사가 **중심점**만 봤다 (몸통 반지름 · 이름표 폭을 안 봤다)
  //   ③ 간격은 점수(최대 3.6)였지 금지가 아니었다 — 겹친 자리밖에 없으면 겹친 채 섰다
  //   1 이면 : 몸통 + 이름표 상자를 화면 여유(focusDepthMargin) 안으로 **옆으로 당기고**, 배를 비켜 민 쪽이 화면 밖이면 **반대쪽**으로 비키고,
  //   몸통 겹침 · 이름표 겹침 · 검색창/미니맵은 크게 깎고(거의 금지), 가까운 후보가 다 나쁘면 **넓게 · 반대쪽 비끼기**까지 본다.
  //   가지의 옆 비끼기는 이름표가 세로로 안 비켜 있으면 **두 이름표 반폭**까지 벌리고, focusDepthSpread 배 넓힌다 (*"좌우로 약간 넓혀"*).
  //   ⚠ 0 이면 v0.62.0 그대로다 — 아래 `else` 갈래의 후보 반복문은 손대지 않았다
  const fit = (P.focusDepthFit === undefined ? 1 : P.focusDepthFit) >= 0.5;
  const spreadK = fit ? Math.max(0.5, num(P.focusDepthSpread, 1.25)) : 1;
  const mg = Math.max(6, num(P.focusDepthMargin, 12) * W0 / 1440);
  const topBand = hostTopPx();   // 화면 밖 검사의 위 끝 — 호스트 헤더가 가린 띠 (v0.69.0 · 0 이면 예전 그대로)
  const koName = (P.markNameKo === undefined ? 1 : P.markNameKo) >= 0.5;
  // 이름표 크기 — 이름표 겹침 판정(tick 의 labelItems → ui.labelWidth · labelHeight)과 **같은 식**이다. 가운데 정렬 · 몸통 꼭대기(r × 1.1) 위
  const lab = set.map(q => {
    const top = (q.rank || 999) <= 10, text = (q.src === 'map' && koName ? q.labelKo : q.name) || '';
    return { w: ui.labelWidth(text, top), h: ui.labelHeight(top) };
  });
  const labBox = (i, px, py, r) => ({ x0: px - lab[i].w * 0.5 - 4, x1: px + lab[i].w * 0.5 + 4, y0: py - r * 1.1 - lab[i].h - 4, y1: py - r * 1.1 });
  const bodyBox = (px, py, r) => ({ x0: px - r, x1: px + r, y0: py - r, y1: py + r });
  const boxHit = (a, b) => a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0;
  // 몸통 + 이름표를 감싼 상자
  const ext = (i, px, py, r) => { const lb = labBox(i, px, py, r); return { x0: Math.min(px - r, lb.x0), x1: Math.max(px + r, lb.x1), y0: lb.y0, y1: py + r }; };
  // 화면 여유 안으로 **옆으로** 당긴다 — 앞 거리 · 높이는 안 바꾼다 (깊이가 뜻이다). 원근이라 두세 번 고친다
  const pullIn = (i, f, l, y) => {
    let [x, , z] = posOf(f, l, y), [px, py] = toScr(x, y, z), r = radPx(i, x, y, z);
    for (let k = 0; k < 3; k++) {
      const e = ext(i, px, py, r);
      const dx = e.x0 < mg ? mg - e.x0 : e.x1 > W0 - mg ? (W0 - mg) - e.x1 : 0;
      if (Math.abs(dx) < 0.5) break;
      l += latFor(dx, f); [x, , z] = posOf(f, l, y); [px, py] = toScr(x, y, z); r = radPx(i, x, y, z);
    }
    return { l, x, z, px, py, r };
  };
  const idx = set.map((_, i) => i).sort((a, b) => score[a] - score[b]);   // 앞에서 뒤로 — 부모가 늘 자식보다 먼저 선다
  const out = new Map(), placed = [];
  const at = (i) => placed.find(q => q.i === i);
  for (const i of idx) {
    const fT = depthOf(i), yT = heightOf(i);
    const p = par[i] >= 0 ? at(par[i]) : null;
    let l0, JL, tries, lFlip = null;
    if (!p) {
      // 뿌리 — 줄기 가운데에 선다. ⚠ 배·미니맵 상자에 걸리기 쉬워 후보를 넓게 · 많이 본다
      l0 = latForU(laneC[comp[i]], fT); JL = latFor(0.05 * W0, fT); tries = 48;
    } else {
      // ⭐ 부모의 옆 거리에서 **평행하게**(가운데 줄기는 비스듬히) 물러난 자리 — 원근이 소실점 쪽으로 옮겨 준다.
      //   두 몸통 사이에 보이는 선이 28px 남으려면 중심끼리 need 만큼 떨어져야 한다 — 모자라면 **이미 벌어진 쪽으로** 더 민다
      const drift = (fT - p.f) * tanYaw[comp[i]];
      const [ax, ay, az] = posOf(fT, p.l + drift, yT);
      const [qx, qy] = toScr(ax, ay, az);
      const r0 = radPx(i, ax, ay, az);
      const need = (r0 + p.r) * 1.15 + 28;
      const v = qy - p.py, hx0 = qx - p.px;
      const sib = kids[par[i]].length > 1;
      // 가지가 여럿이면 정해진 쪽으로 벌린다 (형제가 한쪽으로 몰리지 않게) · 곧게 섰으면 지그재그 · 아니면 벌어진 쪽
      const side = (sib || Math.abs(hx0) < 6) ? sgnOf[i] : Math.sign(hx0);
      let hxT = Math.max(Math.abs(hx0), Math.sqrt(Math.max(0, need * need - v * v)), sideMin * W0) * (sib ? magOf[i] : 1);
      if (fit) {
        // 이름표끼리 — 세로로 안 비켜 있으면 가로로 **두 이름표 반폭**만큼은 떨어져야 이름이 안 숨는다
        const vL = Math.abs((qy - r0 * 1.1) - (p.py - p.r * 1.1));
        if (vL < (lab[i].h + lab[par[i]].h) * 0.5 + 8) hxT = Math.max(hxT, (lab[i].w + lab[par[i]].w) * 0.5 + 10);
        hxT *= spreadK;
        lFlip = p.l + drift + latFor(-side * hxT - hx0, fT);   // 반대쪽 비끼기 — 넓은 후보의 반이 이 둘레를 본다
      }
      l0 = p.l + drift + latFor(side * hxT - hx0, fT);
      JL = latFor(0.012 * W0, fT); tries = 28;
    }
    let best = null, bestS = -Infinity;
    if (fit) {
      const JLw = latFor(0.07 * W0 * spreadK, fT), T = tries + 24;
      // 후보 하나를 잰다 — 옆 거리 l1 에서 시작해 화면 안으로 당기고, 배를 비키고, 점수를 매긴다.
      //   conflict = 겹친 상자 하나(검색창 · 미니맵 · 놓인 부표의 몸통+이름표)의 가로 범위 — 아래에서 그 양옆으로 비킨 후보를 따로 잰다
      //   stepPen = 비킨 몫의 벌점 (조금만 — 겹침을 피할 때만 이긴다)
      const evalAt = (lc, f, y, l1, stepPen) => {
        let { l, x, z, px, py, r } = pullIn(i, f, l1, y);
        let bad = 0, conflict = null;
        // 배 상자 — 걸리면 배 바깥으로 민다. 민 쪽이 화면 밖이면 **반대쪽**으로 (좁은 창에서는 배 한쪽 빈 곳이 모자라다)
        if (boatHit(px, py, r)) {
          const hw = lblW(r), cxB = (boatK.x0 + boatK.x1) * 0.5;
          const toL = boatK.x0 - (px + hw) - 2, toR = boatK.x1 - (px - hw) + 2;
          let moved = false;
          for (const dx of (px < cxB ? [toL, toR] : [toR, toL])) {
            const q = pullIn(i, f, l + latFor(dx, f), y), e2 = ext(i, q.px, q.py, q.r);
            if (!boatHit(q.px, q.py, q.r) && e2.x0 >= mg - 1 && e2.x1 <= W0 - mg + 1) { ({ l, x, z, px, py, r } = q); moved = true; break; }
          }
          if (!moved) bad += 60;
        }
        const e = ext(i, px, py, r);
        if (e.x0 < mg - 1 || e.x1 > W0 - mg + 1 || e.y0 < topBand || e.y1 > H0) bad += 100;         // 화면 밖 (위 끝 = 호스트 헤더 아래)
        for (const k of keep) if (k !== boatK && !k.band && boxHit(e, k)) { bad += 40; conflict = conflict || k; }   // 검색창 · 미니맵 (헤더 띠는 위 줄이 본다)
        const lb = labBox(i, px, py, r), bb = bodyBox(px, py, r);
        let sep = 4;
        for (const q of placed) {
          const qlb = labBox(q.i, q.px, q.py, q.r), qbb = bodyBox(q.px, q.py, q.r);
          let hit = false;
          if (Math.hypot(px - q.px, py - q.py) < (r + q.r) * 1.1 + 3) { bad += 50; hit = true; }   // 몸통끼리
          if (boxHit(lb, qlb)) { bad += 8; hit = true; }                                          // 이름표끼리 — 겹치면 하나가 숨는다
          if (boxHit(lb, qbb) || boxHit(bb, qlb)) { bad += 5; hit = true; }                         // 이름표가 다른 부표를 덮는다
          if (hit && !conflict) conflict = { x0: Math.min(qlb.x0, qbb.x0), x1: Math.max(qlb.x1, qbb.x1) };
          const ex = (px - q.px) / gx, ey = (py - q.py) / gy; sep = Math.min(sep, Math.sqrt(ex * ex + ey * ey));
        }
        let sc = Math.min(sep, 1.2) * 3 - bad - stepPen;
        // 목표에서 벗어난 만큼 깎되 상한을 둔다 — 넓게 · 반대쪽으로 가는 후보는 겹침을 피할 때만 이긴다
        sc -= Math.min(2.4, Math.abs(lc - l0) / (JL || 1) * 0.25) + Math.min(1.2, Math.abs(f - fT) / (fT * JD) * 0.4);
        if (p) {
          if (Math.hypot(px - p.px, py - p.py) - (r + p.r) * 1.15 < 28) sc -= 4;
          for (const q of placed) if (q.i !== p.i && segDist(q.px, q.py, p.px, p.py, px, py) < q.r * 1.4) sc -= 3;
          if (boatK && segHitsBox(p.px, p.py, px, py, boatK)) sc -= 6;
        }
        for (const q of placed) {
          if (q.parent < 0) continue;
          const pp = at(q.parent);
          if (pp && segDist(px, py, pp.px, pp.py, q.px, q.py) < r * 1.4) sc -= 3;
        }
        return { sc, x, y, z, f, l, px, py, r, e, conflict };
      };
      for (let c = 0; c < T; c++) {
        // 0 = 목표 · 1 ~ tries−1 = 둘레 좁게 (예전과 같은 폭) · 그 뒤 = 넓게 (가지는 반을 반대쪽 비끼기 둘레에서)
        const wide = c >= tries;
        const base = wide && lFlip !== null && c % 2 ? lFlip : l0;
        const lc = c === 0 ? l0 : base + (rnd() * 2 - 1) * (wide ? JLw : JL);
        const f = c === 0 ? fT : fT * (1 + (rnd() * 2 - 1) * JD * (wide ? 2 : 1));
        const y = c === 0 ? yT : yT + (rnd() * 2 - 1) * 0.12;
        const a = evalAt(lc, f, y, lc, 0);
        if (a.sc > bestS) { bestS = a.sc; best = a; }
        // ⭐ 겹친 상자가 있으면 그 상자 **양옆**으로 비킨 자리도 잰다 (가까운 쪽부터) — 넓은 흔들기가 우연히 찾기를 기다리지 않는다.
        //   실측 (spread 1.5 · 이 비키기 전) : 남은 검색창 · 미니맵 침범 13.5% 가 전부 **미니맵 위 가장자리에 걸친 몸통**이었다 (오른쪽 바다 줄기)
        if (a.conflict) {
          const k = a.conflict;
          const dxs = [k.x0 - a.e.x1 - 2, k.x1 - a.e.x0 + 2].sort((u, v) => Math.abs(u) - Math.abs(v));
          for (const dx of dxs) {
            const b = evalAt(lc, f, y, a.l + latFor(dx, f), Math.min(2, Math.abs(dx) / (0.1 * W0)));
            if (b.sc > bestS) { bestS = b.sc; best = b; }
          }
        }
      }
    } else for (let c = 0; c < tries; c++) {
      // 첫 후보는 목표 그대로, 나머지는 둘레를 흔든다 (높이는 깊이가 정하므로 아주 조금만)
      const lc = c === 0 ? l0 : l0 + (rnd() * 2 - 1) * JL;
      const f = c === 0 ? fT : fT * (1 + (rnd() * 2 - 1) * JD);
      const y = c === 0 ? yT : yT + (rnd() * 2 - 1) * 0.12;
      let l = lc;
      let [x, , z] = posOf(f, l, y);
      let [px, py] = toScr(x, y, z);
      let r = radPx(i, x, y, z);
      // ⭐⭐ focusBoatClear — 몸통 · 이름표가 배 상자에 걸리면 **배 반대쪽 바깥으로** 민다 (한 번). 그래도 걸리면 버린다.
      //   왼쪽 줄기는 뒤로 물러날수록 소실점(배 바로 옆)으로 모이므로, 여기서 배를 **돌아서** 선다
      if (boatHit(px, py, r)) {
        l += latFor(boatPush(px, r), f);
        [x, , z] = posOf(f, l, y); [px, py] = toScr(x, y, z); r = radPx(i, x, y, z);
        if (boatHit(px, py, r)) continue;
      }
      if (px < W0 * x0 * 0.5 || px > W0 * (1 - (1 - x1) * 0.5) || py < 0 || py > H0) continue;
      if (keep.some(k => k !== boatK && px > k.x0 && px < k.x1 && py > k.y0 && py < k.y1)) continue;
      // 간격 — 놓인 부표들과의 화면 타원 거리 (1 이상이면 이름표까지 떨어졌다)
      let sep = 4;
      for (const q of placed) { const ex = (px - q.px) / gx, ey = (py - q.py) / gy; sep = Math.min(sep, Math.sqrt(ex * ex + ey * ey)); }
      let sc = Math.min(sep, 1.2) * 3;
      // 목표에서 벗어난 만큼 깎는다 — 줄기 모양(뒤로 뻗기)이 흩어지지 않게
      sc -= Math.abs(lc - l0) / (JL || 1) * 0.6 + Math.abs(f - fT) / (fT * JD) * 0.4;   // ⚠ 배를 비켜 민 몫(l − lc)은 안 깎는다
      if (p) {
        // ⚠⚠ 선이 **앞 부표에 가리지 않는가** — 두 몸통 사이에 보이는 선이 28px 은 남아야 한다
        if (Math.hypot(px - p.px, py - p.py) - (r + p.r) * 1.15 < 28) sc -= 4;
        // 이 선이 **다른 부표**를 지나가면 그 부표에 가린다
        for (const q of placed) if (q.i !== p.i && segDist(q.px, q.py, p.px, p.py, px, py) < q.r * 1.4) sc -= 3;
        // ⭐ focusBoatClear — 이 선이 **배 상자**를 지나가면 배에 가린다
        if (boatK && segHitsBox(p.px, p.py, px, py, boatK)) sc -= 6;
      }
      // 이미 정해진 선(놓인 부표 ↔ 그 부모)을 **이 부표가** 가리는가
      for (const q of placed) {
        if (q.parent < 0) continue;
        const pp = at(q.parent);
        if (pp && segDist(px, py, pp.px, pp.py, q.px, q.py) < r * 1.4) sc -= 3;
      }
      if (sc > bestS) { bestS = sc; best = { x, y, z, f, l, px, py, r }; }
    }
    if (!best) {   // 후보가 전부 화면 밖 · 피할 상자 안이면 목표 그대로 둔다 (아주 좁은 창)
      let l = l0;
      let [x, y, z] = posOf(fT, l, yT);
      let [px, py] = toScr(x, y, z);
      // ⭐ focusBoatClear — 목표가 배 상자 안이면 그래도 배 바깥으로는 민다 (가려진 부표는 누를 수 없다)
      if (boatHit(px, py, radPx(i, x, y, z))) {
        l += latFor(boatPush(px, radPx(i, x, y, z)), fT);
        [x, y, z] = posOf(fT, l, yT); [px, py] = toScr(x, y, z);
      }
      best = { x, y, z, f: fT, l, px, py, r: radPx(i, x, y, z) };
    }
    placed.push({ i, parent: par[i], f: best.f, l: best.l, px: best.px, py: best.py, r: best.r });
    // t = 깊이 비율 (0 앞 · 1 가장 뒤) — marks.js 가 **솟는 순서**로 쓴다 (앞에서 뒤로 차례로 솟는다)
    out.set(set[i], { x: best.x, y: best.y, z: best.z, sx: best.px / W0, t: tOf(i) });
  }
  // 검사용 기록 (PB.focusPlan()) — 무리 · 뿌리 · 깊이 · 높이 · 화면 자리
  lastFocusPlan = {
    n, groups: groups.length, roots: roots.map(r => set[r].labelKo || set[r].name),
    near, far, yN, yF, yHN, yHF, sideMin, vanishX: Math.round(vpx), x0, x1,
    boat: boatK ? [boatK.x0, boatK.y0, boatK.x1, boatK.y1].map(Math.round) : null,
    items: set.map((q, i) => {
      const pl = at(i), sl = out.get(q);
      return { name: q.labelKo || q.name, fam: q.perfume ? q.perfume.family : '', root: roots.includes(i), sky: sky[comp[i]],
        parent: par[i] >= 0 ? (set[par[i]].labelKo || set[par[i]].name) : null,
        diff: par[i] >= 0 ? +(cum[i] - cum[par[i]]).toFixed(4) : 0, depth: +depthOf(i).toFixed(1), y: +sl.y.toFixed(2),
        px: Math.round(pl.px), py: Math.round(pl.py), r: +pl.r.toFixed(1) };
    }),
    edges: edges.map(([i, j, d2]) => [set[i].labelKo || set[i].name, set[j].labelKo || set[j].name, +Math.sqrt(d2).toFixed(4)])
  };
  return out;
}
function startFocus(m) {
  const fc = focusCamera();
  const scatter = (P.focusScatter === undefined ? 1 : P.focusScatter) >= 0.5;
  const n = clamp(Math.round(P.focusCount === undefined ? 12 : P.focusCount), 1, 24);
  const seed = (m.perfume && m.perfume.id) || (m.i + 1);
  // ⚠ 흩기 슬롯은 **되돌아갈 자리**로도 쓴다 — 깊이 배치가 실패하면 marks 가 이 슬롯으로 짝짓는다
  const slots = scatter ? focusScatterSlots(fc, n, seed) : focusSlots(fc);
  const toScreen = (x, y, z) => { _v3.set(x, y, z).project(fc); return { x: _v3.x, y: _v3.y }; };
  // ⚠ 배의 **월드** 좌표 = (scroll.x, −scroll.z) — 불변식 0-2
  const bx = nav.scroll.x, bz = -nav.scroll.z;
  const depth = (P.focusDepth === undefined ? 1 : P.focusDepth) >= 0.5;
  const place = depth ? (set, clicked) => focusDepthPlace(fc, set, clicked, seed, bx, bz) : null;
  marks.focusOn(m, { boatX: bx, boatZ: bz, slots, toScreen, place });
}

// ⭐⭐ **카드의 서비스 동작 세 가지** (2026-09-15, v0.68.0 — `cardActions` · host.js). 사용자 : *"현재 향수 … 누르게된다면 자세히 보기, 진열대에 저장, 주변 향 탐색 이 있는데
//   … 디자인을 제외한 해당 로직을 three js 기반만 있는 페이지에 미리 적용해 두려고한다"*. 프론트 HomePage 팝오버(A02)의 셋을 **같은 뜻**으로 옮겼다.
//   대상은 카드가 비추는 향수(marks.selected)다 — '이 향의 해역으로'(onSail)와 같다
//   · [자세히 보기]  → 앱으로 (A10 화면 이동). 엔진은 아무것도 안 바꾼다
//   · [진열대에 저장] → 앱으로 (A11 분류 모달). 카드 · 고른 향수 · 12개는 그대로 — 앱이 Promise 를 돌려주면 닫힐 때까지 입력을 잠근다 (holdWhile)
//   ⚠⚠ **[주변 향 탐색] 은 2026-09-16 에 카드에서 뺐다** (v0.74.2). 부표를 누르는 것이 곧 그 동작이라 같은 일을 두 번 내놓고 있었다 —
//     엔진이 12개를 다시 띄우는 것도, 앱에 `exploreSimilar` 를 알리는 것도 이제 **onPick 의 부표 갈래**가 한다 (위 startFocus 옆).
//     그래서 여기 있던 `explore` 갈래와 `canExplore` · `exploreAround` 도 같이 걷었다 — 부를 곳이 없어졌다.
function cardAction(act) {
  if ((P.cardActions === undefined ? 1 : P.cardActions) < 0.5 || hostHold) return;
  const m = marks.selected, ref = perfumeRef(m);
  if (!ref) return;
  if (act === 'detail') callHost('openDetail', ref);
  else if (act === 'save') holdWhile(callHost('saveToShelf', ref));
}
// 앱이 띄운 창이 닫힐 때까지 입력(방향키 · Shift · 휠 · 누르기)을 잠근다 — 호버 · ESC · 스페이스는 hostHold 를 본다.
//   ⚠ 모달 위 방향키가 새면 onManual 이 12개와 고른 향수를 거둔다 — 프론트는 *"취소하면 고른 포인트가 그대로 남습니다"* 다
//   ⚠ 거절(reject)도 닫힘으로 푼다 — 안 풀면 입력이 영영 잠긴다
function holdWhile(ret) {
  if (!ret || typeof ret.then !== 'function') return;
  hostHold++;
  input.setHold(true);
  const done = () => { hostHold = Math.max(0, hostHold - 1); if (!hostHold) input.setHold(false); };
  ret.then(done, done);
}
// ───────── 잠수 (2026-09-18, dive.js) — 앱 커튼이 진행도를 넘기는 문 ─────────
// 앱 : 헤더 '진열대' 를 누르면 커튼이 시계를 쥐고 매 프레임 `PB.dive(k)` 로 0 → 1 을 민다 (k = 1 이 화면을 다 덮은 순간).
//   그 뒤 앱이 `/shelf` 로 옮겨 가며 엔진은 통째로 사라지므로, 엔진 쪽에서 되돌릴 일은 **취소했을 때**뿐이다.
// ⚠ 잠수 동안 입력을 잠근다 — 방향키로 배를 몰면 카메라가 잠수 트윈과 조타를 같이 탄다.
//   ⚠⚠ 잠금은 `hostHold` **세는 자물쇠**를 같이 쓴다 (holdWhile 과 같은 것). 직접 `input.setHold(false)` 로
//     풀면 모달이 걸어 둔 잠금까지 같이 풀린다.
// ⚠ 혼자 볼 때 : `PB.dive(0.6)` 으로 중간 장면을 세워 두고 `PB.dive(0)` 으로 되돌린다. `PB.diveReport()` 가 값 한 줄.
let _diveHeld = false;
function hostDive(k) {
  setDive(k);
  const on = !!diveNow();
  if (on === _diveHeld) return;
  _diveHeld = on;
  if (on) { hostHold++; input.setHold(true); }
  else { hostHold = Math.max(0, hostHold - 1); if (!hostHold) input.setHold(false); }
}

// 미니맵의 '지금 화면' 부채꼴 (배 기준 월드 x·z). 화면 테두리 16점을 부표 높이 평면에 투영하고
//   부표 거리 페이드(38) 밖은 잘라 낸다 — 부표가 뜰 수 있는 곳이 곧 '보이는 바다' 다
const _footPts = [];
function footprint(c) {
  _footPts.length = 0;
  const R = CONFIG.area.fade1, y = P.markHeight;
  const edge = [];
  for (let i = 0; i < 4; i++) edge.push([-1 + i * 0.5, 1]);   // 위
  for (let i = 0; i < 4; i++) edge.push([1, 1 - i * 0.5]);    // 오른쪽
  for (let i = 0; i < 4; i++) edge.push([1 - i * 0.5, -1]);   // 아래
  for (let i = 0; i < 4; i++) edge.push([-1, -1 + i * 0.5]);  // 왼쪽
  for (const [u, v] of edge) {
    _v3.set(u, v, 0.5).unproject(c).sub(c.position).normalize();
    let d = 1e3;
    if (_v3.y < -1e-4) d = (c.position.y - y) / -_v3.y;
    let px = c.position.x + _v3.x * d, pz = c.position.z + _v3.z * d;
    const r = Math.hypot(px, pz);
    if (r > R) { px *= R / r; pz *= R / r; }
    _footPts.push([+px.toFixed(1), +pz.toFixed(1)]);
  }
  return _footPts;
}

let raf = 0;
// 마지막 '범위 없음' 경고의 앱 시각 (tick 의 범위 블록이 3초에 한 번만 띄운다)
let boundWarnT = -1e9;
// 시각을 직접 누적한다. clock.elapsedTime 은 탭이 숨겨진 동안의 실시간을 그대로 먹어서
// 복귀 프레임에 너울 위상이 텔레포트한다 — dt 를 클램프해도 t 가 막히지 않으면 소용없다
let t = 0;

function tick() {
  raf = requestAnimationFrame(tick);
  const dt = Math.min(0.05, clock.getDelta());
  t += dt;
  const M = CONFIG.move;

  // ── 속도
  let target = CONFIG.speed.idle;
  if (input.state.fwd) target = input.state.boost ? CONFIG.speed.boost : CONFIG.speed.cruise;
  if (input.state.back) target = 0;
  if (input.state.wheel > 0) {
    target = Math.max(target, input.state.wheel);
    input.state.wheel = Math.max(0, input.state.wheel - dt * CONFIG.speed.wheelDecay);
  }
  // ⚠ Shift 바다 누르기(boost)는 부스트 속도로 간다 — 그 밖의 자동 조타(검색 · 먼 곳 이동의 lead)는 예전 0.72 그대로
  if (zones.auto) target = Math.max(target, zones.auto.boost ? CONFIG.speed.boost : SAIL_NORMAL);
  // ⭐ **가속은 예전 그대로, 감속은 관성으로 미끄러지게** (2026-09-14, speedGlide). 사용자 : *"클릭 했을때나 키보드로 이동이 멈추었을때 속도 값이 빠르게 0으로
  //   떨어지는데 출발하는 속도는 빨라도 멈췄을때는 급브레이크를 잡아도 제동이 관성에의해 미끄러지듯이 … 지금보다는 천천히 감속되게"*.
  //   ⚠ 예전 식은 **프레임당** lerp 0.04 라 화면 주사율을 탔다 — 5% 까지 120fps 0.61초 · 60fps 1.22초. 감속만 **초 단위 시간 상수**(speedGlideTau)로 바꿔 주사율과 무관하게 한다.
  //   ⚠ 가속 쪽은 건드리지 않는다 (*"출발하는 속도는 빨라도"*) · ↓ 키(목표 0)도 같은 관성으로 미끄러진다 (*"급브레이크를 잡아도"*)
  //   ⚠ 속도는 카메라 후퇴 · 상승 · 화각(cameraPose 의 s) · 항적에도 들어간다 — 그것들도 같이 천천히 돌아온다
  if ((P.speedGlide === undefined ? 1 : P.speedGlide) >= 0.5 && target < nav.speed) {
    const tau = Math.max(0.05, P.speedGlideTau === undefined ? 0.8 : P.speedGlideTau);
    nav.speed += (target - nav.speed) * (1 - Math.exp(-dt / tau));
  } else {
    nav.speed += (target - nav.speed) * CONFIG.cam.lerp;
  }
  const s = nav.speed;

  // ── 방향을 먼저 돌리고, 배는 그 방향으로만 나아간다 — 옆으로 미끄러지지 않는다
  // ⚠⚠ **지상속도는 파도의 위상속도를 단위로 잰다** (2026-09-06, ocean-clock.js).
  //   월드/초를 직접 적으면 waveSpeed 를 건드릴 때마다 배와 파도가 조용히 갈라진다 —
  //   실제로 갈라져 있었고(순항 v/cp = 6.27, 배가 파도를 6배 추월), 사용자가 말한
  //   "보이는 느낌과 움직이는 흐름의 이질감" 이 그것이었다.
  //   ⚠ M.scrollBoost 는 이제 clockUnified = 0 인 롤백 경로에서만 쓰인다
  const vFwd = groundSpeed(s);
  // ⚠⚠ **오른쪽 키가 −head 다.** head 를 올리면 뱃머리(로컬 −z)가 월드 −x 로 돈다
  //   (R_y(+θ) 는 −z 를 −x 쪽으로 보낸다). 카메라가 −x·+z 에 서 있어서 월드 −x 는 **화면 왼쪽**이다.
  //   실측 (뱃머리의 화면 각도) : head 0 → 149.3° · head +0.35 → 165.8° (반시계 = 왼쪽으로 감).
  //   ⚠ 2026-09-08 이전에는 이게 맞아 보였다 — GLB 뱃머리가 +z 로 뒤집혀 있어서 **두 오류가
  //     서로 상쇄**했기 때문이다. 뱃머리를 바로잡으면(GLB_YAW) 이쪽도 같이 뒤집어야 한다.
  //   ⚠ 손 조타 부호는 head → 뱃머리 → 화면각으로만 정해지고 **vX 와 무관하다.**
  //     자동 조타는 다르다 — vX 와 한 묶음이고 오차도 접어야 한다. 아래 블록 참고.
  let sx = (input.state.left ? 1 : 0) - (input.state.right ? 1 : 0);
  if (zones.auto) {
    // ⚠⚠ **부호가 vX 와 한 묶음이다** (불변식 0-2-1 과 같은 함정이 한 번 더). 배의 월드 x 속도는
    //   scroll.x′ = vX = −vFwd·sin h 다. 목표가 씬 +x(ax > 0)에 있으면 scroll.x 를 **키워야**
    //   하므로 sin h < 0, 즉 head 가 **음수**로 가야 한다. 그래서 오차에 −가 붙는다.
    //   ⚠ 예전 `zones.auto.x - nav.scroll.x` 는 **거울난 vX(+sin)와 짝이 맞아서** 맞아 보였던 것이다.
    //     vX 만 고치고 이 줄을 두면 양의 되먹임이 되어 배가 목표에서 영원히 멀어진다.
    // ⭐ 향 지도(유한 좌표)에서는 **목표의 방위각**으로 돈다 (zones.bearing). 아래 예전 식은 목표가
    //   늘 북쪽에 있다고 가정해서 **배 뒤의 목표에 영원히 못 간다** — 토러스에서만 맞던 식이다.
    //   ⚠ 부호는 예전 식과 작은 각에서 같다 (zones.js 의 bearing 주석). 뒤집지 않는다
    const brg = zones.bearing(nav.scroll);
    const want = brg !== null ? brg : clamp((nav.scroll.x - zones.auto.x) * 0.05, -0.8, 0.8);
    // ⚠⚠ **각도 오차는 반드시 [−π, π] 로 접는다.** want 는 ±0.8 로 묶여 있는데 nav.head 는
    //   무한 누적된다 (몇 바퀴 돌면 −10.9 rad 같은 값이 된다 — 실측). 그냥 빼면 오차가
    //   몇 바퀴어치로 나와 sx 가 ±1 에 **포화된 채 고정**되고, 배가 최단 경로 대신
    //   **먼 쪽으로 몇 바퀴를 돈다.**
    //   실측 (head −647° 에서 검색바로 FLORAL 조타) : sx 가 내내 +1 로 포화된 채 한 방향으로만
    //   돌았고, 목표가 먼저 풀리지 않았다면 **+648°** 를 돌 참이었다.
    //   사용자가 본 *"회전하면 어느 순간 뱃머리 뒷부분으로 앞을 간다"* 가 이것이다.
    //   ⚠ 이 버그는 **head 가 ±0.8 밖으로 벗어난 뒤에만** 보인다. 새로고침 직후엔 head = 0 이라
    //     멀쩡해 보이고, 한참 조타한 뒤에야 드러난다 — 그래서 재현이 들쭉날쭉했다.
    //   ⚠ head 자체를 감싸지는 않는다 — boat.js 의 시각 요 보간이 ±π 경계에서 튄다.
    sx = clamp(wrapPi(want - nav.head) * 2, -1, 1);
  }
  // ⚠ 각속도가 아니라 **선회 반경**을 보존한다. 속도만 줄이고 turnRate 를 그대로 두면
  //   배가 제자리에서 팽이처럼 돈다 (ω = v/R, ocean-clock.js 의 turnRate)
  nav.headV += (sx * turnRate(vFwd) - nav.headV) * M.turnLerp;   // 각속도 자체가 천천히 붙고 천천히 풀린다
  // ⚠ 드래그 조타는 2026-09-06 에 걷어냈다 (input.js 주석). 방향은 방향키·자동 조타만 바꾼다
  nav.head += nav.headV * dt;
  // ⚠⚠ **vX 는 −sin 이다.** 뱃머리의 월드 방향은 R_y(head)·(0,0,−1) = (−sin h, −cos h) 인데,
  //   scroll 을 읽는 **일곱 소비자가 전부** 배의 월드 위치를 (scroll.x, −scroll.z) 로 인코딩한다
  //   (marks.js `m.x - scroll.x` / `m.z + scroll.z` · zones.js:45 · grid.js · sim.js uSwellOff ·
  //    water.js · boat.js 부력 · sim.js 이류). 그러면 배의 실제 진행 방향은 (vX, −vZ) 다.
  //   +sin 이면 그게 (sin h, −cos h) 가 되어 **뱃머리와 z축 거울**이 된다.
  //   두 방향의 각도차 = 정확히 2·head 다 (dot = −cos 2h). 실측 (실제 그려지는 부표의 흐름) :
  //     head    0° : dot −1.00  정상          head  −46° : dot +0.07  옆으로 게걸음
  //     head  −91° : dot +1.00  **선미로 전진**  head −181° : dot −0.99  정상
  //   한 바퀴에 정상 2회·완전 반대 2회가 번갈아 난다. 사용자가 본
  //   *"어느 방향에서는 정면인데 회전하면 어느 순간 뱃머리 뒷부분으로 앞을 간다"* 가 이것이다.
  //   ⚠⚠ **head = 0 에서 재면 절대 못 잡는다** — sin 0 = 0 이라 두 식이 같다. 불변식 0-2 의
  //     옛 실측("부표가 +z 로 −16.04 → −15.40")이 head 0 에서만 이뤄져 이 거울을 놓쳤다.
  //     방향을 재는 검사는 반드시 head 를 ±90° 로 돌려 놓고 한다.
  let vZ = vFwd * Math.cos(nav.head), vX = -vFwd * Math.sin(nav.head);
  // ⭐ **범위 — 갈 수 있는 바다의 끝** (2026-09-11 오후, 사용자 : *"갈 수 없는 영역은 갈 수 없다는 "범위 없음" 경고"*).
  //   향수 지도(유한)의 사각형 + mapMargin 밖으로 나가는 **속도 성분**을 막는다. 가장자리 앞 EDGE_SOFT 월드에서부터 바깥쪽
  //   속도를 남은 거리에 비례해 줄여 **부드럽게 선다** — 벽에 부딪혀 튕기지 않고 벽을 따라 미끄러진다.
  //   ⚠⚠ 위치가 아니라 **속도**를 막는다. 시뮬은 속도로 이류하므로(sim.js) 막힌 만큼 vX·vZ 도 같이 줄여 넘겨야
  //     배는 서 있는데 물만 흘러가는 일이 없다. mv(항적 세기)도 같은 비로 줄인다 — 벽 앞에서 거품만 쌓이지 않게.
  //   ⚠ 좌표 규약 (불변식 0-2) : 배의 월드 위치 = (scroll.x, −scroll.z) · 월드 속도 = (vX, −vZ)
  //   ⚠ 자동 조타·먼 곳 이동의 목표는 전부 지도 **안**이라 여기에 안 걸린다
  let blockK = 1;
  if (marks.map && (P.mapBound === undefined ? 1 : P.mapBound) >= 0.5 && vFwd > 1e-4) {
    // ⚠⚠ **2026-09-12 저녁 : 사각형이 아니라 향수에서 잰 거리다** (scentmap.js `navDist`).
    //   사용자 : *"미니맵을 네모나게 움직이는게 끝이 아니라 … 향수가 밀집되어있는 공간 주변으로도 못나가게"*.
    // ⭐ **바깥으로 가는 성분만 깎는다.** 속도 전체를 줄이면 경계에 붙었을 때 **안쪽으로도 못 간다** —
    //   갇힌다. 이렇게 하면 경계를 **따라 미끄러지고** 안쪽은 언제나 자유롭다.
    // ⚠ 좌표 규약 (불변식 0-2) : 월드 속도 = (vX, −vZ). 그래서 월드에서 재고 월드로 되돌린다
    const wx = nav.scroll.x, wz = -nav.scroll.z;
    const nd = marks.map.navDist(wx, wz);
    const EDGE_SOFT = 8;
    const room = marks.map.navReach - nd.d;        // 경계까지 남은 여유 (음수면 이미 밖)
    if (room < EDGE_SOFT) {
      const wvx = vX, wvz = -vZ;
      const out = wvx * nd.ux + wvz * nd.uz;       // 바깥으로 가는 몫
      if (out > 0) {
        const k = Math.max(0, room) / EDGE_SOFT;   // 여유가 0 이면 k 0 = 바깥 성분을 통째로 없앤다
        const cut = out * (1 - k);
        const nvx = wvx - nd.ux * cut, nvz = wvz - nd.uz * cut;
        const was = Math.hypot(wvx, wvz), now = Math.hypot(nvx, nvz);
        vX = nvx; vZ = -nvz;
        blockK = was > 1e-6 ? now / was : 1;
      }
    }
    // 경고 — 바깥으로 거의 막혔을 때(원래 속도의 60% 아래) 한 번. ⚠ 벽에 계속 밀면 매 프레임 여기 온다 — 3초에 한 번만
    if (blockK < 0.6 && t - boundWarnT > 3) { boundWarnT = t; ui.warn('범위 없음', '이 너머는 갈 수 없는 해역입니다'); }
  }
  // ⭐ Shift 바다 누르기가 경계에 막혀 1.5초 넘게 미끄러지기만 하면 놓는다 — 목표는 안쪽이어도 곧은 뱃길이 바깥을 스칠 수 있다
  //   (갈 수 있는 바다가 원들의 합집합이라 오목한 곳이 있다). 안 놓으면 벽에 대고 영영 밀며 3초마다 경고가 뜬다
  if (zones.auto && zones.auto.sea && blockK < 0.6) {
    seaBlockT += dt;
    if (seaBlockT > 1.5) { zones.clearAuto(); seaBlockT = 0; }
  } else seaBlockT = 0;
  nav.scroll.z += vZ * dt;
  nav.scroll.x += vX * dt;
  reportRegion(t);
  nav.latV += (vX - nav.latV) * 0.08;
  // ⭐ `_shipMv` — 존 연출에서 배가 씬 안을 실제로 가로지르는 속도 (2026-09-16). 그게 없으면 배만 옮겨지고
  //   물은 가만히 있다 (연출 중 nav.speed 는 0 이라 항적 · 물보라 · 흘수가 전부 죽는다). ⚠ 한 프레임 전 값이다 (아래 카메라 블록이 채운다)
  const mv = Math.min(1, Math.max(s, Math.abs(nav.latV) / M.strafe, _shipMv)) * blockK;

  // 마우스 패럴랙스 목표를 부드럽게 따라간다. ⚠ 즉시 따라가면 손떨림이 그대로 화면에 나온다
  {
    const k = PARAMS.parallaxEase === undefined ? 0.08 : PARAMS.parallaxEase;
    paX += ((input.state.mx || 0) - paX) * k;
    paY += ((input.state.my || 0) - paY) * k;
    // ⚠⚠ **전환이 다 끝나고 조금 지난 뒤에 산다.** 트윈이 도는 동안 같이 걸리면 두 움직임이
    //   섞이고, 끝나자마자 켜도 관성이 겹쳐 보인다 — `parallaxDelay` 만큼 쉬었다 켠다
    if (phase.cue.phase === 'inspecting') paHold += dt; else paHold = 0;
    const dly = PARAMS.parallaxDelay === undefined ? 0.35 : PARAMS.parallaxDelay;
    const want = paHold > dly ? 1 : 0;
    paGate += (want - paGate) * (want ? 0.045 : 0.25);
  }

  // ── 먼 곳 이동 (v0.32.0). ⚠ 물·카메라보다 **먼저** 민다 — 안개 꼭대기에서 배를 옮기면(순간이동)
  //   이번 프레임의 시뮬·카메라·부표가 **새 자리**를 봐야 한 프레임도 옛 자리가 비치지 않는다
  travel.update(dt);

  // ── 연출 상태머신. ⚠ 카메라·물보다 **먼저** 민다 — 곧 그들이 이 값을 읽는다 ([5단계]~).
  //   ⚠ 게이트를 안 건다 (phase.js 주석). 카메라는 매 프레임 움직여야 한다
  phase.update(dt);
  // 미뤄 둔 도착 (zones 의 onArrive 주석). ⚠ 같은 존에 이미 들어가 있으면 버린다
  if (pendingArrive && !phase.cue.busy) {
    const k = pendingArrive;
    pendingArrive = null;
    if (!(phase.cue.phase === 'inspecting' && phase.cue.zone === k)) phase.enter(k, { hold: P.zoneHold });
  }
  // 미뤄 둔 바다 떠나기 (seaGo 주석) — 연출이 **다 걷힌 뒤**(sailing · 전환 없음)에야 부스트 조타를 건다
  if (pendingSea && phase.cue.phase === 'sailing' && !phase.cue.busy) {
    zones.goTo(pendingSea);
    pendingSea = null;
    seaBlockT = 0;
  }
  // 미뤄 둔 먼 곳 이동 (startTravel 주석) — 들어오는 중이었으면 **다 들어온 순간 머묾 없이** 퇴장을 걸고, 다 걷히면(sailing) 떠난다
  //   ⚠ phase.update 뒤라 입장 · 퇴장이 끝난 **바로 그 프레임**에 걸린다
  if (pendingTravel && !phase.cue.busy) {
    if (phase.cue.phase === 'inspecting') phase.leave();
    else if (phase.cue.phase === 'sailing') { travel.start(pendingTravel); pendingTravel = null; }
  }

  // ── 향수 고르기의 카메라 섞임. ⚠ 존 연출과 **같은 구도**(cue.look → zoneYaw/Pitch/Dist/LookX/Y)를 쓴다 —
  //   사용자 : *"연출 구도에 맞게 쉽게 클릭할 수 있도록"*. 들어갈 때 1.4초 · 나올 때 1.1초, inOutCubic
  {
    const want = marks.focusActive && marks.focusing ? 1 : 0;
    const dur = want ? (P.focusCamIn === undefined ? 1.4 : P.focusCamIn) : (P.focusCamOut === undefined ? 1.1 : P.focusCamOut);
    focusT = clamp(focusT + (want ? dt : -dt) / Math.max(0.05, dur), 0, 1);
  }

  // ── 물
  // ⭐ 배가 씬 원점을 벗어나 있으면 뱃머리 그립 · 항적이 나는 자리도 같이 옮긴다 (2026-09-16 — 존 연출의 등장 · 정박).
  //   ⚠ `_shipOff` 는 아래 카메라 블록이 채우므로 여기서는 **한 프레임 전** 값이다 (시뮬 게이트 30fps — 안 드러난다)
  sim.update(dt, t, { vX, vZ, mv, scrollX: nav.scroll.x, scrollZ: nav.scroll.z, boatX: _shipOff.x, boatZ: _shipOff.z });

  // ── 카메라. 월드에 고정 — 속도에 따라 후퇴 / 상승 / 화각 확대
  //   ⚠ 계산은 위의 `cameraPose()` 에 있다 (2026-09-11 — 향수 고르기 슬롯이 같은 식을 써야 해서 뺐다).
  //     아래 주석들은 그 식의 **이유**라 여기 그대로 둔다
  // ⚠ camDist — **look 점을 기준으로 같은 방향선 위에서 물러난다** (1 = 기존 구도).
  // 방향을 안 바꾸고 거리만 키우므로 구도는 그대로고 화면에 담기는 바다만 넓어진다.
  // 레퍼런스(threejswaterpro)와의 가장 큰 차이가 이것이었다 — 그쪽은 수평선까지 담아서
  // 근경의 어색함이 원경에 묻히는데, 우리는 항상 근경만 보여준다 (2026-09-05 분석).
  // ⚠ 물러나면 **거리 페이드와 LOD 도 같이 밀어야 한다** — water.js update() 참고.
  //   안 밀면 새로 보이게 된 원경이 흰 여백에 먼저 먹혀 아무것도 안 늘어난다.
  // ⚠⚠ **[5단계] : 여기가 연출이 카메라를 잡는 유일한 지점이다** (2026-09-10).
  //   `cue.look` 0 = 항해 구도 · 1 = 존 구도. phase.js 가 §3 표대로 그 값을 민다.
  //   ⚠ 트윈을 여기서 짜지 않는다 — 커브는 전부 phase.js 의 TL 에 있다. 여기는 **읽기만** 한다.
  // ⭐ 향수 고르기(v0.32.0)도 같은 존 구도로 간다 — 둘 중 큰 쪽. 둘은 동시에 안 켜진다 (main 의 onPick 가드)
  const cl = Math.max(phase.cue.look, EASE.inOutCubic(focusT));
  // ⭐ 향수 고르기 동안 카메라는 **속도를 안 탄다** (2026-09-15, v0.65.0 — focusCamStill · pickSail 주석). 12개의 자리는 속도 0 카메라(focusCamera)로 잡았으므로
  //   섞임(focusT)만큼 속도의 몫(후퇴 · 상승 · 화각)을 뺀다 — 배는 일반 속도로 가도 화면이 선다. 존 연출은 그대로 · 0 = v0.64.0
  const sCam = (P.focusCamStill === undefined ? 1 : P.focusCamStill) >= 0.5 ? s * (1 - EASE.inOutCubic(focusT)) : s;
  cameraPose(cl, sCam, cam.aspect, _pose);
  // ⭐⭐ **잠수** (2026-09-18, dive.js) — 카메라가 고개를 숙이며 수면으로 다가간다.
  //   ⚠⚠ **여기 한 곳에서만 건다.** `cameraPose()` 안에 넣으면 존 구도 카메라(`_poseZ`)와 향수 고르기 슬롯(focusCamera)도
  //     같이 잠겨, 연출 중에 잠수를 걸면 배가 놓인 자리와 12개의 자리가 통째로 어긋난다.
  //   ⚠ 수면(y 0)을 뚫지 않는다 — `diveEndY` 위에 서고 그 앞에 앱 커튼이 덮는다 (dive.js 머리 주석).
  //   ⚠ 패럴랙스 축(`_pose.rgt · upv`)은 잠수 전 방향 그대로 둔다 — 1초 동안 커튼 아래에서 감지 않는 차이고,
  //     다시 풀면 `cameraPose` 의 식을 여기에 한 번 더 적게 된다 (불변식 2).
  {
    const D = diveNow();
    if (D) {
      const d = D.cam;
      // 시선이 물속으로 내려간다 — 내려다보는 각이 깊어진다
      _pose.tgt.y -= (P.diveLookY === undefined ? 0 : P.diveLookY) * d;
      // 수면 쪽으로 내려앉는다
      _pose.pos.y += ((P.diveEndY === undefined ? 2 : P.diveEndY) - _pose.pos.y) * d;
      // look 점 쪽으로 **수평으로만** 당긴다 (높이는 바로 위에서 이미 정했다)
      const kIn = 1 - (1 - (P.diveDist === undefined ? 1 : P.diveDist)) * d;
      _pose.pos.x = _pose.tgt.x + (_pose.pos.x - _pose.tgt.x) * kIn;
      _pose.pos.z = _pose.tgt.z + (_pose.pos.z - _pose.tgt.z) * kIn;
      _pose.fov += (P.diveFov === undefined ? 0 : P.diveFov) * d;
    }
  }
  // ⭐⭐ **배 등장 · 정박** (2026-09-16, `zoneBoatEnter`) — 존 연출에서 배가 화면 밖 왼쪽으로 빠졌다가 왼쪽에 정박한다.
  //   ⚠⚠ **카메라는 안 건드린다.** 처음에는 시선 목표(zoneLookX)를 밀어서 했는데 바다 · 부표 · 게이트가 통째로 흔들렸다
  //     (사용자 : *"지금 카메라가 너무 출렁이는데"*). 그래서 **배만** 카메라의 오른쪽 축(−rgt)으로 민다.
  //   ⚠ `boat.js` 는 pivot 의 **y 만** 쓴다(부력) — x · z 는 여기가 주인이다.
  //   ⚠ 배에 딸린 층은 따라온다 — 물의 `uBoatPos`(water.setBoat 가 pivot 을 잡는다) · 반사 · 물보라 · 잠긴 선체 · 배 피할 상자.
  //   ⚠⚠ **따라오지 않는 것 : 시뮬의 뱃머리 그립과 항적이다** (sim.js 의 `BOW_Z` 는 텍스처 원점에 박혀 있다).
  //     존 연출에서는 배가 이미 서 있어 새 항적이 안 나므로 남은 자국이 옅어질 뿐이다 — 움직이는 중에 이 값을 켜지 않는다.
  //   ⚠ 단위는 zoneLookX 와 같은 **화면 반폭 대비 비율**이다 (`_pose.hW` 가 월드로 바꾼다).
  //   ⭐⭐ **등장은 대각선이다** (2026-09-16 사용자 : *"왼쪽에서 수평으로 등장하는게아니라 … 왼쪽 하단에서 대각선으로"*).
  //     세로 성분은 배를 **카메라 쪽으로 당겨서** 낸다 — 구도가 내려다보는 각이라 가까울수록 화면 아래고, 원근으로 크게도 보인다.
  //     ⚠ 배의 y 를 직접 내리지 않는다 — 그건 부력이 정하고(boat.js), 건드리면 물에 잠기거나 뜬다.
  //     ⚠ 정박 자리의 깊이 성분은 0 이다 — 들어오는 동안만 가까웠다가 제 깊이로 물러난다.
  //   ⭐⭐ **자리를 타임라인으로 정하지 않는다 — 속도로 민다** (2026-09-16 사용자 : *"시간 맞추기 위해 중간에 멈추는데 … 시간 제한 두지 말고 앞으로 움직여"*).
  //     타임라인으로 자리를 정하면 끝점에서 **반드시 감속해 선다.** 그래서 `swing` 은 **시작 자리에 놓기만** 하고,
  //     그 뒤로는 매 프레임 뱃머리 방향으로 `zoneShipSpeed × 부스트` 만큼 나아간다 — 끝나는 지점이 없다.
  {
    const rsp = lookRsp(cam.aspect);
    const c = phase.cue;
    const pX = _shipOff.x, pZ = _shipOff.z;
    // ⚠⚠ **존 구도 카메라를 따로 받는다** (`_poseZ`) — 배가 놓이는 때(0.30s)의 카메라는 아직 항해 구도이고,
    //   뱃머리가 바라볼 방향도 존 구도 기준이어야 전환 중에 안 흔들린다 (아래 boat.update 의 각도 블록이 같이 쓴다).
    cameraPose(1, 0, cam.aspect, _poseZ);
    if (c.phase === 'entering' || c.phase === 'inspecting') {
      if (!_shipRun) {
        // 시작 자리 — swing 이 0 → 1 로 놓는다 (순간이동 방지). 세로 몫은 카메라 쪽으로 당겨서 낸다 (화면 아래 · 원근으로 크게)
        // ⚠ 카메라가 들어오는 2초 동안 배의 **화면** 자리는 조금 움직인다 (월드 자리는 고정인데 카메라가 당겨지므로) — 앉고 나면 잰 그 자리다.
        const dx = (P.zoneShipOut === undefined ? 0 : P.zoneShipOut) * c.swing * rsp * _poseZ.hW;
        const dz = (P.zoneShipOutY === undefined ? 0 : P.zoneShipOutY) * c.swing * rsp * _poseZ.hW;
        _shipOff.x = -dx * _poseZ.rgt.x - dz * _poseZ.fwdH.x;
        _shipOff.z = -dx * _poseZ.rgt.z - dz * _poseZ.fwdH.z;
        if (c.swing >= 1) _shipRun = true;
      } else {
        // ⚠ 뱃머리는 로컬 −z 라 씬 방향이 `(−sin h, −cos h)` 다 (불변식 0-2). 그 방향이 곧 글자 쪽이라 화면에서 **대각선**으로 읽힌다
        const v = (P.zoneShipSpeed === undefined ? 0 : P.zoneShipSpeed) * groundSpeed(1) * dt;
        const hd = boat.pivot.rotation.y;
        _shipOff.x += -Math.sin(hd) * v;
        _shipOff.z += -Math.cos(hd) * v;
        // ⚠⚠ 스펀지 안에 묶는다 — 중심에서 `domain × 0.29` 를 넘으면 **항적이 태어나자마자 먹힌다** (sim.js 의 주입점 주석). 여유를 두고 0.26
        const r = Math.hypot(_shipOff.x, _shipOff.z), lim = CONFIG.sim.domain * 0.26;
        if (r > lim) { _shipOff.x *= lim / r; _shipOff.z *= lim / r; }
      }
      _shipHold.x = _shipOff.x; _shipHold.z = _shipOff.z;
    } else if (c.phase === 'leaving') {
      // 나아간 만큼을 swing(1 → 0)으로 되돌린다 — 끝이 `look` 과 같아 카메라 복귀와 함께 선다
      _shipOff.x = _shipHold.x * c.swing;
      _shipOff.z = _shipHold.z * c.swing;
    } else {
      _shipOff.x = 0; _shipOff.z = 0; _shipRun = false;
    }
    boat.pivot.position.x = _shipOff.x;
    boat.pivot.position.z = _shipOff.z;
    // 이동한 만큼을 **배의 속도 단위**로 바꾼다 (`groundSpeed(1)` = 부스트의 월드/초) — 숫자를 손으로 적지 않는다 (불변식 0-1)
    _shipMv = dt > 1e-4
      ? clamp(Math.hypot(_shipOff.x - pX, _shipOff.z - pZ) / dt / Math.max(1e-4, groundSpeed(1)), 0, 1)
      : 0;
  }
  // ⭐ 잠수는 이 값을 줄여 **원경을 가까이 당긴다** — 물이 짙은 바다색에 더 빨리 먹힌다 (dive.js · `diveFade`).
  //   ⚠ 물의 거리 페이드 · LOD 가 전부 이 하나를 곱해 따라오므로(§23-1) 카메라와 물이 갈라지지 않는다
  let kD = _pose.kD;
  {
    const D = diveNow();
    if (D) kD *= 1 - (1 - (P.diveFade === undefined ? 1 : P.diveFade)) * D.dim;
  }
  // ⚠⚠ **camYaw — look 점을 축으로 카메라를 옆으로 돌린다** (2026-09-06, 세일보트와 같이 들어왔다).
  //   배의 진행 방향은 로컬 −z 라 뱃머리가 화면 안쪽을 향한다. 예전 종이배는 길이축이 로컬 x
  //   였으므로 그 구도에서 **옆모습**이 보였는데, 뱃머리가 있는 배를 제대로 놓으니 같은
  //   카메라가 **정선미 뷰**가 됐다 — 돛이 옆날로 서서 세일보트로 안 읽힌다.
  //   0 = 예전 구도(정선미) · 26도 = 선미 쿼터. 배가 아니라 카메라를 돌리는 이유는,
  //   배를 돌리면 물리적으로 게걸음(leeway)이 되고 항적·뱃머리 파가 어긋나기 때문이다.
  //   ⚠ uCam(grid·water)과 reflect 는 이미 카메라의 **실제** XZ 를 쓴다 (불변식 9). 안전하다
  // ⚠⚠ **구면 좌표다** (2026-09-06). 사용자 : "자유를 클릭했을 때 나타나는 뷰가 제일
  //   안정적으로 보임. 이걸 기본 세팅으로." 자유 시점(freecam)의 HOME 이 pitch 0.30 rad
  //   = **17.2도 내려다보기**인데, 예전 본 카메라는 yNear/zNear 에서 나오는 각이 **12.1도**
  //   뿐이었다 — 수면을 거의 스치듯 봤다.
  //   ⚠ 각(camPitch·camYaw)과 거리를 **분리**한다. 예전에는 높이(camY)와 거리(camZ)를 따로
  //     lerp 해서 각이 속도에 따라 조용히 바뀌었다. 이제 거리만 속도를 타고 각은 고정이다.
  //   ⚠ 속도에 따른 후퇴는 그대로 산다 — camY·camZ 가 둘 다 커지므로 baseDist 가 커진다.
  //   camPitch 12.1 이면 예전 구도와 정확히 같다 (검산 : atan(2.00/9.30) = 12.14도).
  cam.position.copy(_pose.pos);
  cam.fov = _pose.fov;
  cam.updateProjectionMatrix();

  // 시선 축 셋. ⚠ 여기서는 아직 `cam.matrixWorld` 를 못 쓴다 — lookAt 전이라 낡은 값이다
  _rgt.copy(_pose.rgt);
  _upv.copy(_pose.upv);

  // ⭐⭐ **[8단계] 마우스 패럴랙스** (2026-09-10). 카메라를 **평행이동**한다 — 회전이 아니다.
  //   회전은 깊이와 무관하게 화면 전체를 같은 각도로 밀지만, 평행이동은 가까운 것을 더 많이
  //   움직인다. 그것이 시차다. 그래서 암석·배·타이포·물끝이 **거리 순서대로 알아서** 어긋난다.
  // ⚠⚠ `camBase` 는 밀기 **전**의 자리다. gate.js 가 이걸 기준으로 판을 놓아야 판이 화면에서
  //   어긋난다 — 지금 카메라에 붙이면 판이 카메라를 따라다녀 **아무것도 안 움직인다.**
  // ⚠ 자유 시점에서는 끈다. 그쪽은 사용자가 직접 카메라를 모는 화면이다
  // ⚠⚠ **존에서는 배가 화면 정중앙이 아니다** (2026-09-10). 예전에는 언제나 `look` 을 그대로
  //   봐서 배가 **늘 한가운데**였다 — 그게 존 화면을 밋밋하게 만들고 있었다.
  //   ⭐ 배가 아니라 **시선 목표**를 화면 기준으로 민다 (이유는 params.js 의 zoneLookX 주석).
  //   ⚠ 목표는 패럴랙스와 무관하다 — 그래서 **먼저** 낸다 (cameraPose 가 이미 냈다)
  _tgt.copy(_pose.tgt);

  // ⭐⭐ **기준 상태를 먼저 굳힌다** — 위치와 **회전 둘 다**. gate.js 가 이 상태에 판을 세우고,
  //   카메라만 그 자리에서 벗어난다. 그래야 판이 **카메라가 움직인 만큼만** 화면에서 밀린다.
  //   ⚠ 예전에는 위치만 기억하고 축은 최종 카메라에서 뽑았다 — 평행이동이 lookAt 을 통해
  //     회전까지 바꾸므로 판이 이중으로 움직였고, 그게 **우글거림**이었다.
  camBase.copy(cam.position);
  cam.lookAt(_tgt);
  camBaseQ.copy(cam.quaternion);

  if (!PARAMS.freeView && paGate > 0.001) {
    // ⚠ 선형이 아니라 |v|^curve — 화면 중앙을 지날 때 방향이 딱 바뀌는 것을 눕힌다
    const cv = PARAMS.parallaxCurve === undefined ? 1.7 : PARAMS.parallaxCurve;
    const sh = (v) => (v < 0 ? -1 : 1) * Math.pow(Math.abs(v) > 1 ? 1 : Math.abs(v), cv);
    paSx = sh(paX) * paGate;
    paSy = sh(paY) * paGate;
    const ax = PARAMS.parallaxAmount === undefined ? 0 : PARAMS.parallaxAmount;
    const ay = PARAMS.parallaxAmountY === undefined ? 0 : PARAMS.parallaxAmountY;
    cam.position.addScaledVector(_rgt, paSx * ax).addScaledVector(_upv, paSy * ay);
    // ⚠⚠⚠ **여기서 `lookAt` 을 다시 부르지 않는다** (2026-09-10, 두 번째 정정).
    //   옮긴 뒤 같은 목표를 다시 보면 **카메라가 회전한다.** 그건 시차(parallax)가 아니라
    //   팬(pan)이고, 월드에 고정된 층은 그 회전만큼 화면에서 통째로 밀린다 —
    //   수면 타이포가 마우스를 고정해도 **프레임마다 기어가던**(실측 4프레임에 7.07px)
    //   이유가 이것이었다. 시차는 **평행이동만**으로 난다.
    //   ⭐ 회전을 고정하면 : 카메라와 같이 움직이는 층(타이포)은 화면에서 **완전히 멈추고**,
    //     월드에 선 층(물·배·부표)만 거리에 따라 어긋난다. 그게 우리가 원하던 그림이다.
    //   ⚠ 대가 — 카메라가 옆으로 가도 배를 계속 정면으로 보지는 않는다. 배가 화면에서
    //     조금 밀리는데, 그것이 시차의 정상 동작이다.
  } else { paSx = 0; paSy = 0; }

  // 항공뷰를 쓰는 동안에는 이 카메라가 씬을 그린다. 본 카메라는 그대로 두므로
  // 끄면 원래 구도로 그대로 돌아온다
  view = PARAMS.topView ? topCam : cam;
  if (PARAMS.topView) {
    const half = Math.max(1, PARAMS.topSize) * 0.5, a = W() / H();
    topCam.left = -half * a; topCam.right = half * a;
    topCam.top = half; topCam.bottom = -half;
    topCam.near = 0.1; topCam.far = 400;
    topCam.position.set(0, 60, 0);
    // ⚠ 바로 아래를 볼 때 up 이 시선과 평행하면 lookAt 이 무너진다. up 을 -z 로 준다.
    // topTurn 으로 화면을 돌려 마루선을 화면 수평에 맞출 수 있다 (읽기 편해진다)
    const r = PARAMS.topTurn * Math.PI / 180;
    topCam.up.set(Math.sin(r), 0, -Math.cos(r));
    topCam.lookAt(0, 0, 0);
    topCam.updateProjectionMatrix();
  }

  // 시간대가 바뀌었으면 조명 · 배경 · 하늘 (콘솔에서 sceneTime 만 바꾸고 apply 를 안 불러도 따라온다. 평소에는 비교 한 번)
  applyTime();
  // ⭐ 구름이 흐른다 (2026-09-20). ⚠ 유니폼 객체 하나를 밀면 물·하늘이 같이 따라온다 (sky.js 규율) —
  //   그래서 부르는 자리도 **하나**다.
  // ⚠⚠ 시계는 **물의 것(`sim.qT`)이다** (불변식 1 · pod.js 와 같은 선택). 구름은 물에 비쳐서
  //   읽히므로 물과 다른 시계를 타면 둘이 조용히 어긋난다. 실시간 t 를 쓰면 탭이 쉬었다 온 프레임에
  //   구름만 건너뛴다 — 실측 2026-09-20 : 펌프 600프레임에서 qT 는 20.1초인데 t 는 5.2초였다
  tickSky(sim.qT);
  // ⚠ 씬을 실제로 그리는 카메라(view)를 넘긴다 — 하늘 구가 그 카메라를 중심으로 서야 한다.
  //   항공뷰·자유 시점에서도 하늘이 따라온다
  stage.update(view);
  // ⭐ 배경색 — 잠수 중에는 짙은 바다색으로 (applyTime 바로 뒤 · 위 applyDiveBg 주석)
  applyDiveBg();
  // ⚠ 카메라에서 좌표를 파생시키므로 **본 카메라(cam)** 를 넘긴다 — view(항공뷰·자유시점)가
  //   아니다. 그래야 개발 시점으로 옮겨도 글자가 제자리에 서서 검증이 된다 (§11)
  // ⭐ 천장 — 우측 정보 블록 아래끝 + 18px (2026-09-11 오후, titleCeil). title.js 는 DOM 을 모르므로 여기서 재서 넘긴다
  {
    const zr = phase.cue.zone ? ui.zoneInfoRect() : null;
    // ⚠ camBase 를 같이 넘긴다 — 천장(글자 크기)은 패럴랙스 **전** 카메라로 푼다 (2026-09-14, title.js 천장 주석 · titleCeilBase)
    title.update(phase.cue, cam, sim, camBaseQ, zr ? { y: zr.y1 + 18, x0: zr.x0, x1: zr.x1, W: W(), H: H() } : null, camBase);
  }
  gate.update(phase.cue, cam, camBase, camBaseQ, paSx, paSy);
  // 우측 존 정보 블록 + 좌하단 존 표시. ⚠ 마지막 cue 소비자다 (§6 접근성의 DOM 제목)
  // ⭐ 도착 연출이면 머묾 시계의 **남은 비율**을 같이 넘긴다 — 제목 옆 선이 줄어든다 (2026-09-11 오후)
  {
    const c = phase.cue;
    ui.showZone(c.zone, c.ui, c.hold > 0 ? 1 - c.holdT / c.hold : -1);
    // ⭐ 존 연출 중에는 미니맵이 옅어져 사라진다 (2026-09-13 저녁, zoneMiniHide). 사용자 : *"연출이 시작되었을 때 미니맵을 잠시 꺼줘 …
    //   opacity 값을 조절해서 사라졌다가 나타났으면"*. 들어갈 때(entering) 사라지기 시작해 머무는 동안 숨고, 나갈 때(leaving) 다시 나타난다.
    //   ⚠ opacity 는 index.html 의 CSS transition(0.45s)이 민다 — 프레임이 느려도 부드럽다. 바뀔 때만 쓴다.
    //   ⚠ visibility 는 minimap.js 가 쥐고 있어(지도가 아니면 숨긴다) 건드리지 않는다 — 대신 숨은 동안 누르기를 막는다
    {
      const hide = (P.zoneMiniHide === undefined ? 1 : P.zoneMiniHide) >= 0.5 && (c.phase === 'entering' || c.phase === 'inspecting');
      if (hide !== _miniHidden) {
        _miniHidden = hide;
        const mm = document.getElementById('minimap');
        if (mm) { mm.style.opacity = hide ? '0' : ''; mm.style.pointerEvents = hide ? 'none' : ''; }
      }
    }
    // 정보 블록에 마우스를 올린 동안 머묾 시계를 세운다 (사용자 : *"마우스를 올린 동안에는 머물게"*).
    //   ⚠ 다음 프레임의 phase.update 가 이걸 본다 — 한 프레임 늦는 것은 사람 눈에 안 보인다
    phase.pauseHold((P.zoneHoldHover === undefined ? 1 : P.zoneHoldHover) >= 0.5 && ui.zoneHover);
  }
  // ⚠⚠ **보간된 kD 를 넘긴다.** 물의 거리 페이드가 camDist 를 곱해 따라오는데, 그 상쇄는
  //   카메라와 **같은 값**을 볼 때만 성립한다 (§23-1). 한쪽만 보간하면 전환 중 원경이 부푼다
  water.update(sim, view, t, kD);
  grids.update(sim, t, view, nav.scroll);
  spray.update(sim, t, boat);
  // ⭐⭐ 존 연출에서 **뱃머리가 글자를 바라본다** (2026-09-16, `zoneShipYaw`). 사용자 : *"뱃머리가 글자를 바라보며 들어와야함 근데 대각선으로"*.
  //   ⚠⚠ 평행이동만 시키면 배가 옆으로 미끄러지는 **게걸음(드리프트)** 으로 보인다 — 각을 같이 줘야 '들어온다' 로 읽힌다.
  //   ⚠ `nav.head` 자체는 **안 건드린다** (불변식 0-2-2 — 누적각이라 여기서 감싸거나 더하면 시각 요 보간과 자동 조타가 어긋난다).
  //     boat.js 에 **넘기는 값**에만 더한다. 조타 · 항적 · 부력은 그대로 nav.head 를 쓴다.
  //   ⚠ boat.js 가 0.05/프레임으로 좇으므로 각이 **서서히** 돈다 — 그 선회가 들어오는 동안의 움직임으로 읽힌다.
  //   ⚠ 섞는 것은 `swing` 이다 (dock 이 아니다) — 배가 화면 밖으로 나가는 동안 이미 돌아서, **돌아선 채로 들어온다.**
  //   ⚠⚠ **각은 카메라 기준 절대값이다 — `nav.head` 에 상대 각을 더하지 않는다.** 더하면 *어느 방향에서 존에 들어왔느냐*에 따라
  //     뱃머리가 매번 달라진다 (처음에 그렇게 짰다가 고쳤다). 구도는 카메라에 고정이므로 기준도 카메라여야 한다.
  //     `atan2(−fwdH.x, −fwdH.z)` 가 뱃머리를 **화면 안쪽**으로 놓는 각이고(불변식 0-2 : 뱃머리 = 로컬 −z), 거기에 zoneShipYaw 를 더한다.
  //   ⚠ 섞기는 `wrapPi` 로 **최단 경로**를 쓴다 (불변식 0-2-2 — 누적각과 유한각을 그냥 빼면 몇 바퀴어치가 나온다).
  //   ⚠⚠ **`nav.head` 를 실제로 돌린다 — 시각만 돌리지 않는다.** 시각만 돌리면 나갈 때 그 각이 풀리면서 배가 **빙글빙글 돈다**
  //     (2026-09-16 사용자 : *"원래 화면으로 돌아갈때도 그냥 그 방향을 보고 있어야할 것같음 지금 무슨 빙글빙글 돈다"*).
  //     존을 나가면 배는 **바라보던 그 방향으로** 항해를 이어간다 — 그게 '돌아선 채로 떠난다' 로 읽힌다.
  //   ⚠ 들어올 때(`entering`)만 돌린다. 시작 각을 한 번 붙잡아 두고(`_zoneYawFrom`) swing 으로 섞으므로 프레임마다 다시 당기지 않는다.
  //     나갈 때는 `want` 가 카메라를 따라 움직이는데 그걸 좇으면 또 돌아버린다 — 그래서 `leaving` 에서는 건드리지 않는다.
  //   ⚠ 더하는 몫은 `wrapPi` 로 잰 **최단 경로**다 (불변식 0-2-2 — 누적각 nav.head 에 유한각을 그냥 넣으면 몇 바퀴가 된다).
  //   ⚠ 바라볼 방향은 **존 구도**(`_poseZ`)에서 받는다 — 전환 중 카메라(`_pose`)로 재면 목표각이 22° 따라 움직여 배가 그걸 좇는다.
  const cph = phase.cue.phase;
  if (cph === 'entering' && _zoneYawFrom === null) {
    // ⭐⭐ **각은 한 프레임에 맞춘다 — 서서히 돌리지 않는다** (2026-09-16 사용자 : *"자꾸 뱃머리 억지로 틀리고있는게 내눈에 딱보이는데"*
    //   · *"흰색 화면으로 전환과 동시에 배가 그 방향으로 회전을 해두면 안되나?"*).
    //   ⚠⚠ `travel.js` 의 순간이동과 **같은 규약**이다 (그 파일 57~63행) — `nav.head` 를 등가각으로 놓고
    //     `pivot.rotation.y` 를 **직접** 써서 boat.js 의 시각 요 보간(0.05/프레임)을 건너뛴다. 거기 주석 그대로 *"안개 속에서 이미 돌아 있어야 한다"*.
    //   ⚠ 먼 곳 이동(미니맵 · 카드 · 검색)으로 들어오면 **흰 안개가 이 순간을 덮는다** (travel.js 의 fogIn → fogOut).
    //     배로 직접 들어오면 덮개가 없지만, 한 프레임이라 예전처럼 **트는 과정이 보이지는 않는다.**
    //   ⚠ 등가각으로 넣는다 — `nav.head` 는 무한 누적값이라 `atan2` 결과를 그냥 넣으면 몇 바퀴가 된다 (불변식 0-2-2).
    const faceIn = Math.atan2(-_poseZ.fwdH.x, -_poseZ.fwdH.z);
    const want = faceIn + (P.zoneShipYaw === undefined ? 0 : P.zoneShipYaw) * (Math.PI / 180);
    nav.head += wrapPi(want - nav.head);
    nav.headV = 0;
    boat.pivot.rotation.y = nav.head;
    _zoneYawFrom = nav.head;   // 이번 진입에서 이미 맞췄다는 표시 (null 이 아니면 다시 안 한다)
  } else if (_prevPhase === 'leaving' && cph === 'sailing') {
    // ⭐⭐ **연출이 끝나는 그대로 각도를 유지한다** (2026-09-16 사용자 : *"연출 끝나는 그대로 배 각도가 유지되어있으면 될듯함"*).
    //   화면에 보이던 각(`pivot.rotation.y`)을 그대로 항해 각으로 삼는다 — 되감을 것도, 좇아갈 것도 남지 않는다.
    //   ⚠ `nav.head` 는 무한 누적값이라 `atan2` 결과를 그냥 넣으면 몇 바퀴가 된다 — **등가각**으로 넣는다 (불변식 0-2-2 · travel.js 의 순간이동과 같은 규약).
    //   ⚠ 각속도도 0 으로 — 남아 있으면 항해를 이어가며 그만큼 더 돈다.
    nav.head += wrapPi(boat.pivot.rotation.y - nav.head);
    nav.headV = 0;
    _zoneYawFrom = null;
  } else if (cph === 'sailing') _zoneYawFrom = null;
  _prevPhase = cph;
  boat.update(sim, { t, s, mv, head: nav.head, headV: nav.headV, offX: _shipOff.x, offZ: _shipOff.z });
  zones.update({ head: nav.head, scroll: nav.scroll });
  // ⚠ boat.update 뒤여야 한다 — 부표의 부유가 배와 같은 게이트(boat.stepped)를 탄다
  marks.update(sim, { scroll: nav.scroll, stepped: boat.stepped, cam, dt, viewH: H() });
  // ⚠ marks.update 뒤여야 한다 — 부표의 씬 좌표를 읽어 물 셰이더에 싣는다 (반사)
  water.syncMarks(marks);
  // ⚠ 같은 이유로 marks.update 뒤다 — 연결선은 부표의 **지금 자리**를 잇는다 (솟는 동안 같이 자란다)
  links.update(marks.linkItems(), dt);   // ⚠ dt 로 '하나씩 뻗는' 시계를 돌린다 (links.js)
  // 바다 누르기 화살표 — 누른 월드 자리를 이번 프레임 scroll 로 씬에 옮기고 수면 높이에 앉힌다 (seamark.js). 떠 있지 않으면 곧장 돌아온다
  seamark.update({ dt, scroll: nav.scroll, sim, cam: view });
  // 돌고래 무리. ⚠ 시계는 물의 것(sim.qT)이라 dt 를 안 넘긴다 (pod.js)
  // ⚠⚠ `hide` 는 **연출이 비키라고 넘기는 값 하나**다 — 돌고래는 연출을 모른다 (dive.js 와 같은 규율).
  //   `cl` 은 존 구도와 향수 고르기를 이미 합친 클로즈업 블렌드(위 1530줄)이고, 거기에 이동 안개를 얹는다.
  //   배 근처는 부표 · 항적 · 이름표로 붐비는 데다 클로즈업에서 돌고래가 화면을 가린다 (사용자 지적).
  pod.update(sim, { scroll: nav.scroll, cam, hide: Math.max(cl, travel.fog) });
  // ⚠ 아래 둘은 이번 프레임 카메라로 투영한다 — 행렬을 먼저 갱신한다 (안 하면 한 프레임 늦어 라벨이 떤다.
  //   카메라는 씬에 안 들어 있어 render 전까지 matrixWorld 가 지난 프레임 값이다)
  cam.updateMatrixWorld();
  // ── 부표 이름표 (2026-09-12, markLabels) — 사용자 : *"오브젝트 위에는 항상 작은 향수 이름이 떠있어야함"*.
  //   보이는 부표 **전부의 위**에 작은 이름. 향수 고르기의 12개도 같은 이름표다 (예전에는 그 12개의 밑에만 있었다).
  //   ⚠ 겹치면 **인기 순위가 낮은 쪽이 비킨다** (markLabelDeclutter) — 고른 부표 → 고르기의 12개 → 순위 순으로 자리를 차지한다.
  //     비키는 것은 부표마다 보임(m.lbl)을 부드럽게 좇는다 — 카메라가 움직일 때 겹침 경계에서 깜빡이지 않게
  //   ⚠ 개발 시점(항공뷰 · 자유 시점)에서는 끈다 — 본 카메라로 투영하므로 자리가 틀린다
  //   ⚠ 이동 안개가 덮는 동안은 같이 옅어진다 — 이름표는 DOM 에서 안개 **위**에 있다 (travel.fog)
  const allLabels = (P.markLabels === undefined ? 1 : P.markLabels) >= 0.5;
  if (allLabels && P.showMarks && !P.topView && !P.freeView) {
    const fogK = 1 - travel.fog, W0 = W(), H0 = H();
    const decl = (P.markLabelDeclutter === undefined ? 1 : P.markLabelDeclutter) >= 0.5;
    const kL = Math.min(1, (dt || 0.016) * 9);
    const items = [];
    for (const it of marks.labelItems()) {
      // 몸통 **꼭대기** 조금 위 — 반지름이 순위마다 다르다 (it.r)
      _v3.set(it.x, it.y + it.r * 1.1, it.z).project(cam);
      if (_v3.z > 1) continue;
      const x = (_v3.x * 0.5 + 0.5) * W0, y = (-_v3.y * 0.5 + 0.5) * H0 - 2;
      if (x < -90 || x > W0 + 90 || y < -30 || y > H0 + 30) continue;
      items.push({ m: it.m, x, y, text: it.text, top: it.top, up: true, pri: it.pri, a: it.a * fogK });
    }
    items.sort((p, q) => p.pri - q.pri);
    const placed = [];
    for (const L of items) {
      let want = 1;
      if (decl && L.a > 0.08) {
        const w = ui.labelWidth(L.text, L.top), h = ui.labelHeight(L.top);
        const r = { x0: L.x - w * 0.5 - 4, x1: L.x + w * 0.5 + 4, y0: L.y - h - 2, y1: L.y + 2 };
        if (placed.some(q => r.x0 < q.x1 && r.x1 > q.x0 && r.y0 < q.y1 && r.y1 > q.y0)) want = 0;
        else placed.push(r);
      }
      L.m.lbl = L.m.lbl === undefined ? want : L.m.lbl + (want - L.m.lbl) * kL;
      L.a *= L.m.lbl;
    }
    ui.showMarkLabels(items);
    focusLabelsOn = true;
  } else if (!allLabels && marks.focusActive) {
    // 예전 (markLabels 0) — 향수 고르기의 12개 **밑**에만. 부표 반지름만큼 내려 투영한다
    const ko = (P.markNameKo === undefined ? 1 : P.markNameKo) >= 0.5;
    const items = marks.focusItems().map(it => {
      _v3.set(it.x, it.y - (it.m.rw || CONFIG.mark.ballR * Math.max(0.05, P.markScale)) * 1.25, it.z).project(cam);
      return { x: (_v3.x * 0.5 + 0.5) * W(), y: (-_v3.y * 0.5 + 0.5) * H() + 4, name: ko && it.m.labelKo ? it.m.labelKo : it.m.name, a: it.a };
    });
    ui.showFocusLabels(items);
    focusLabelsOn = true;
  } else if (focusLabelsOn) { ui.showMarkLabels([]); focusLabelsOn = false; }
  // ── 미니맵 (v0.32.0). 향수 지도가 꺼져 있으면 숨는다. ⚠ 배의 월드 위치 = (scroll.x, −scroll.z)
  {
    const tgt = travel.target || (zones.auto && zones.auto.custom ? zones.auto : null)
      || pendingSea   // 연출이 걷히길 기다리는 바다 떠나기도 '가는 곳' 으로 그린다 (seaGo)
      || pendingTravel   // 연출이 걷히길 기다리는 먼 곳 이동도 (startTravel)
      || (zones.auto ? marks.anchorOf(zones.auto.key) : null);
    const mmArg = { map: marks.map, boat: { x: nav.scroll.x, z: -nav.scroll.z, head: nav.head }, target: tgt, foot: footprint(cam) };
    minimap.update(mmArg);
    // ⚠ 해도는 **같은 값**을 받는다 (자기 좌표를 따로 만들지 않는다 — 불변식 21).
    //   닫혀 있으면 값만 갈아 두고 그리지 않으므로 프레임 비용이 없다
    chart.update(mmArg);
  }
  // ⭐ 마우스 호버 → 말풍선 (2026-09-12 저녁). ⚠ 아래 카드 갱신 **바로 앞**이라야 같은 프레임에 반영된다
  updateHover(view);
  // 고른 부표가 멀어져 사라지면 marks 가 선택을 스스로 놓는다. 카드도 여기서 같이 닫힌다
  // ⭐⭐ **카드는 제 부표의 잠김 · 솟음을 같이 탄다** (2026-09-16, `cardFollowFade`).
  //   사용자 : *"12개 씬에 부표가 내려갈때 같이 내려갔다가 같이 올라오게"* · *"너무 창이 억지로 이동한게 보이니까 연관성이 떨어짐"*.
  //   고르기에 들고 날 때 부표는 한 번 **잠겼다가 새 슬롯에서 솟는다** (불변식 31). 카드를 그대로 두면 그동안
  //   화면을 **가로질러 새 자리로 미끄러진다** — 무엇에 딸린 창인지 흐려진다. 그래서 부표가 잠기면 카드도 접고, 다시 솟으면 같이 뜬다.
  //   ⚠ `marks.selected` 는 안 건드린다 (선택 링 · 이름표 우선순위가 그걸 읽는다) — **카드만** 따라간다.
  //   ⚠ 잠김 · 솟음은 한 방향으로만 가므로 문턱 하나로 충분하다 (되돌아오며 깜빡일 구간이 없다). 0 이면 예전처럼 안 따라간다
  const fMin = P.cardFollowFade === undefined ? 0.35 : P.cardFollowFade;
  const selM = marks.selected;
  const wantCard = (selM && (fMin <= 0 || (selM.on && selM.fade >= fMin))) ? selM : null;
  if (wantCard !== shownMark) {
    shownMark = wantCard;
    if (shownMark) ui.showScent(shownMark); else ui.hideScent();
  }
  // 카드의 서비스 동작 단추 (v0.68.0) — 지도 향수가 아니면 둘 다 쉰다. ⚠ ui 가 바뀔 때만 쓴다
  //   ⚠ [주변 향 탐색]이 빠지면서(v0.74.2) 인자가 하나가 됐다 — 남은 둘은 같은 조건이다
  if (shownMark) ui.setScentActions(shownMark.src === 'map' && !!shownMark.perfume && !hostHold);
  // ⭐ 호버 미리보기 카드는 마우스를 통과시킨다 (2026-09-13 저녁, cardPeek) — 카드 밑에 가린 부표에도 바로 마우스를 올릴 수 있게.
  //   ⚠ 누른 향수의 카드(clickMark)는 그대로 받는다 — × · '이 향의 해역으로' 를 눌러야 하고, 통과시키면 카드 누름이 빈 바다 누름이 된다
  //   ⭐ v0.65.0 : 마우스가 그 카드 위에 올라오면 통과를 끄고 진하게 — × · '이 향의 해역으로' 를 누를 수 있다 (updateHover 의 hoverOnCard).
  //     통과를 켠 채 두면 카드 위 누름이 빈 바다 누름이 되어 배가 떠난다
  ui.setScentPeek((P.cardPeek === undefined ? 1 : P.cardPeek) >= 0.5 && !!shownMark && shownMark === hoverMark && hoverMark !== clickMark && !hoverOnCard);
  // ⭐ 말풍선 카드의 자리 (2026-09-11 오후). 고른 부표를 **이번 프레임 카메라**로 투영해 넘긴다 — 부표가 흐르면 따라간다.
  //   ⚠ 부표의 root 는 씬 좌표다 (marks.group 이 원점) · 화면 반지름은 구 위쪽 한 점을 같이 투영해서 잰다
  //     (fov 를 쓰지 않는다 — 항공뷰는 직교라 fov 가 없다, reflect.js 의 NaN 교훈)
  if (shownMark) {
    const rp = shownMark.root.position;
    view.updateMatrixWorld();
    _v3.copy(rp).project(view);
    const x = (_v3.x * 0.5 + 0.5) * W(), y = (-_v3.y * 0.5 + 0.5) * H();
    const R = CONFIG.mark.ballR * Math.max(0.05, P.markScale);
    const e = view.matrixWorld.elements;   // 카메라의 위 방향 (월드) = 행렬 둘째 열
    _v3.set(rp.x + e[4] * R, rp.y + e[5] * R, rp.z + e[6] * R).project(view);
    const r = Math.abs((-_v3.y * 0.5 + 0.5) * H() - y);
    // 가리면 안 되는 것들 (ui.placeScent 가 덜 가리는 쪽으로 연다) — 배(가중 3)와 화면에 뜬 다른 부표.
    //   ⚠ 배는 한 점이 아니라 **돛 높이까지** 선다 — 배 중심과 돛 중간(높이 4) 두 점으로 넣는다
    _obs.length = 0;
    for (const hy of [0.8, 4.0]) {
      _v3.set(boat.pivot.position.x, hy, boat.pivot.position.z).project(view);
      _obs.push({ x: (_v3.x * 0.5 + 0.5) * W(), y: (-_v3.y * 0.5 + 0.5) * H(), r: 40, w: 3 });
    }
    for (const q of marks.list) {
      if (q === shownMark || !q.on || !q.root.visible || q.fade < 0.3) continue;
      _v3.copy(q.root.position).project(view);
      if (_v3.z > 1 || _v3.x < -1.1 || _v3.x > 1.1 || _v3.y < -1.1 || _v3.y > 1.1) continue;
      _obs.push({ x: (_v3.x * 0.5 + 0.5) * W(), y: (-_v3.y * 0.5 + 0.5) * H(), r: r, w: 1 });
    }
    ui.placeScent({ x, y, r, obs: _obs, bubble: (P.cardBubble === undefined ? 1 : P.cardBubble) >= 0.5 });
  }
  ui.setDrift(s);
  // 반사를 먼저 찍는다 (배와 같은 게이트라 8fps). 본 렌더가 그 그림을 되읽는다
  submerged.update(view, boat.stepped);
  reflect.update(view, water.uni.uBoatPos.value, boat.stepped);
  bloom.render(scene, view);
}
tick();
// ⭐ 부팅 신호 ③ (v0.75.0) — 첫 장이 그려졌다 (셰이더 컴파일 포함). 배 GLB 는 아직 오는 중일 수 있다 (boat.js 가 따로 알린다)
bootReport('frame');

// 리사이즈는 rAF 로 디바운스한다 — 드래그로 창을 늘리면 ResizeObserver 가 프레임마다 터지고,
// setSize 는 백버퍼를 재할당한다. 모니터를 옮기면 devicePixelRatio 도 바뀌므로 같이 다시 잡는다
let resizeRaf = 0;
function applyResize() {
  resizeRaf = 0;
  const w = W(), h = H();
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(w, h);
  cam.aspect = w / h;
  cam.updateProjectionMatrix();
  resizeCbs.forEach(fn => fn(w, h));
}
const ro = new ResizeObserver(() => {
  if (!resizeRaf) resizeRaf = requestAnimationFrame(applyResize);
});
ro.observe(el);

// 탭이 숨으면 루프를 멈춘다. 복귀할 때 getDelta() 로 그동안 쌓인 시간을 버려야
// 첫 프레임에 dt 가 통째로 들어오지 않는다
function onVisibility() {
  if (document.hidden) {
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
  } else if (!raf) {
    clock.getDelta();
    raf = requestAnimationFrame(tick);
  }
}
document.addEventListener('visibilitychange', onVisibility);

// ⭐ 반응형 끄기/켜기 (uiResponsive). <html data-fixed> 가 붙으면 index.html 의 CSS 변수가 전부 빠져 예전 px 로 돌아간다.
//   ⚠ 자리가 바뀌므로 창 크기 변화처럼 알린다 — 미니맵(캔버스 폭)·말풍선(피할 자리)·타이포 천장(정보 블록 자리)이 다시 잰다
let _fixedOn = null;
function applyResponsive() {
  const fixed = (P.uiResponsive === undefined ? 1 : P.uiResponsive) < 0.5;
  if (fixed === _fixedOn) return;
  _fixedOn = fixed;
  document.documentElement.toggleAttribute('data-fixed', fixed);
  window.dispatchEvent(new Event('resize'));
}
applyResponsive();

// ⭐⭐ 저녁 카드 · 저녁 미니맵 (2026-09-13 저녁, cardEve · minimapEve). <html data-card-eve> · <html data-mini-eve> 가 index.html 의 토큰을 켠다.
//   ⚠ 속성이 없으면 인라인의 예전 값이다 (반응형 · 시간대와 같은 규약 — 불변식 23 · 25). 카드 바탕의 불투명도(cardGlassA)는 CSS 변수로 넣는다.
//   미니맵 캔버스는 minimap.js 가 속성이 바뀐 것을 보고 색을 다시 읽는다
let _cardEveOn = null, _miniEveOn = null, _cardGlassA = null, _cardPeekA = null, _cardPeekMs = null, _cardBtnNavy = null, _cardRuleSolid = null, _cardImg = null, _infoCenter = null, _siteHeader = null, _cardActions = null;
let _warnEveOn = null, _warnLine = null, _warnDrop = null, _searchDrop = null, _infoDescK = null, _hostTop = null;
function applyUiEve() {
  const root = document.documentElement;
  const ce = (P.cardEve === undefined ? 1 : P.cardEve) >= 0.5;
  if (ce !== _cardEveOn) { _cardEveOn = ce; root.toggleAttribute('data-card-eve', ce); }
  const a = clamp(P.cardGlassA === undefined ? 0.86 : P.cardGlassA, 0, 1);   // v0.64.0 : 0.58 → 0.74 · v0.65.0 : → 0.86
  if (a !== _cardGlassA) { _cardGlassA = a; root.style.setProperty('--pb-card-a', String(a)); }
  const pa = clamp(P.cardPeekA === undefined ? 0.65 : P.cardPeekA, 0, 1);
  if (pa !== _cardPeekA) { _cardPeekA = pa; root.style.setProperty('--pb-card-peek', String(pa)); }
  // ⭐ 미리보기 ↔ 진한 카드가 **서서히** 바뀌는 시간 (2026-09-16). 트랜지션은 카드 상자 · 꼬리의 인라인에 걸려 있고 길이만 여기서 준다
  const pms = Math.round(clamp(P.cardPeekMs === undefined ? 200 : P.cardPeekMs, 0, 1200));
  if (pms !== _cardPeekMs) { _cardPeekMs = pms; root.style.setProperty('--pb-card-peek-ms', pms + 'ms'); }
  // 해역 버튼 색 (2026-09-13 저녁) — 1 짙은 남색 · 0 브론즈 (v0.53.0 첫 시안). ⚠ 색을 인라인으로 넣지 않는다 — <html> 인라인은 종이 카드([원본])까지 덮는다
  const navy = (P.cardBtnNavy === undefined ? 1 : P.cardBtnNavy) >= 0.5;
  if (navy !== _cardBtnNavy) { _cardBtnNavy = navy; root.toggleAttribute('data-card-btn-bronze', !navy); }
  // 구분선 (2026-09-13 저녁) — 1 불투명 상아색 · 0 옅게 (v0.53.0 의 18%)
  const ruleSolid = (P.cardRuleSolid === undefined ? 1 : P.cardRuleSolid) >= 0.5;
  if (ruleSolid !== _cardRuleSolid) { _cardRuleSolid = ruleSolid; root.toggleAttribute('data-card-rule-faint', !ruleSolid); }
  // 향수 이미지 자리 (2026-09-14, v0.64.0) — 1 향조 줄과 제목 사이에 자리 · 0 v0.63.0 (자리 없음). 자리 · 크기라서 종이 카드([원본] cardEve 0)에도 같이 선다.
  //   ⚠ 켜고 끄면 카드 높이가 바뀐다 — 창 크기 변화처럼 알려 떠 있는 말풍선이 높이를 다시 잰다 (ui.js onWinResize → measureAvoid). 처음 한 번은 안 알린다
  const cimg = (P.cardImg === undefined ? 1 : P.cardImg) >= 0.5;
  if (cimg !== _cardImg) { const first = _cardImg === null; _cardImg = cimg; root.toggleAttribute('data-card-img', cimg); if (!first) window.dispatchEvent(new Event('resize')); }
  // 카드의 서비스 동작 단추 줄 (2026-09-15, v0.68.0) — 1 [자세히 보기] · [진열대에 저장] · [주변 향 탐색] · 0 v0.67.0 (없음). 카드 높이가 바뀌므로 cardImg 처럼 알린다
  const cact = (P.cardActions === undefined ? 1 : P.cardActions) >= 0.5;
  if (cact !== _cardActions) { const first = _cardActions === null; _cardActions = cact; root.toggleAttribute('data-card-actions', cact); if (!first) window.dispatchEvent(new Event('resize')); }
  // ⭐⭐ 사이트 헤더 자리 (2026-09-15, v0.66.0) — 1 자리표시 헤더 90px 아래에 무대 · 0 v0.65.0 (무대가 창 전체). index.html 의 사이트 헤더 주석.
  //   ⚠ 무대 크기가 바뀐다 — 창 크기 변화처럼 알린다 (렌더러는 #mount 의 ResizeObserver 가 따라오고 · 입력의 상자 캐시 · 말풍선 피할 자리는 resize 가 다시 잰다).
  //   처음에도 알린다 — <html> 에 속성을 미리 적어 첫 칠은 이미 헤더 아래지만, 그 전에 잡힌 캐시가 있을 수 있다
  const sh = (P.siteHeader === undefined ? 1 : P.siteHeader) >= 0.5;
  if (sh !== _siteHeader) { _siteHeader = sh; root.toggleAttribute('data-site-header', sh); window.dispatchEvent(new Event('resize')); }
  // 향조 정보 블록 자리 (2026-09-13 저녁) — 1 수면 타이포 위 가운데 · 0 우측 위.
  //   ⚠ 자리가 바뀌므로 창 크기 변화처럼 알린다 — 타이포 천장이 블록 아래끝을 다시 잰다 (ui.zoneInfoRect)
  const ic = (P.zoneInfoCenter === undefined ? 1 : P.zoneInfoCenter) >= 0.5;
  if (ic !== _infoCenter) { _infoCenter = ic; root.toggleAttribute('data-info-center', ic); window.dispatchEvent(new Event('resize')); }
  const me = (P.minimapEve === undefined ? 1 : P.minimapEve) >= 0.5;
  if (me !== _miniEveOn) { _miniEveOn = me; root.toggleAttribute('data-mini-eve', me); }
  // 경고 토스트 (2026-09-13) — 1 저녁 유리 알약 · 0 예전 종이 한 줄. 밑줄(warnLine)은 저녁 판에서만 뜻이 있다 (종이 판은 밑줄 토큰이 없다)
  const we = (P.warnEve === undefined ? 1 : P.warnEve) >= 0.5;
  if (we !== _warnEveOn) { _warnEveOn = we; root.toggleAttribute('data-warn-eve', we); }
  const wl = (P.warnLine === undefined ? 1 : P.warnLine) >= 0.5;
  if (wl !== _warnLine) { _warnLine = wl; root.toggleAttribute('data-warn-noline', !wl); }
  // 토스트 자리 내림 (2026-09-13 밤, v0.58.0) — 반응형 단계의 --pb-warn-top 에 **더한다** (단계마다 같은 만큼 내려간다). 0 = v0.57.0 자리
  //   ⚠ 자리라서 <html> 인라인 변수로 넣는다 — 색과 달리 종이 판([원본] warnEve 0)에도 같이 걸리는 것이 맞다
  const wd = clamp(P.warnDrop === undefined ? 24 : P.warnDrop, 0, 200);
  if (wd !== _warnDrop) { _warnDrop = wd; root.style.setProperty('--pb-warn-drop', wd + 'px'); }
  // ⭐ 검색창 · 정보 블록 · 경고 토스트 내림 · 설명 글자 배율 (2026-09-15, v0.67.0 — searchDrop · infoDescK). 반응형 단계 값에 **더하고 · 곱한다** (단계마다 같은 만큼).
  //   ⚠ 정보 블록 아래끝 + 18px 이 수면 타이포의 천장이다 — 자리 · 크기가 바뀌면 창 크기 변화처럼 알려 천장과 말풍선 피할 자리를 다시 잰다 (처음 한 번은 안 알린다)
  // ⭐⭐ 호스트 헤더 (2026-09-15, v0.69.0 — hostTop) : 앱 헤더가 무대 위에 겹친 높이만큼 **더 내린다** (searchDrop 에 더한다 — 검색창 · 정보 블록 · 경고 토스트가 같이 간다).
  //   해도 판은 --pb-host-top 으로 그 아래에 서고, 향수 고르기는 focusKeepBoxes · 깊이 배치의 화면 검사가 그 띠를 뺀다. ⚠ 무대 크기는 안 바뀐다 (siteHeader 와 다르다)
  const ht = hostTopPx();
  if (ht !== _hostTop) { _hostTop = ht; root.style.setProperty('--pb-host-top', ht + 'px'); }
  const sd = clamp(P.searchDrop === undefined ? 40 : P.searchDrop, 0, 240) + ht;
  if (sd !== _searchDrop) { const first = _searchDrop === null; _searchDrop = sd; root.style.setProperty('--pb-search-drop', sd + 'px'); if (!first) window.dispatchEvent(new Event('resize')); }
  const dk = clamp(P.infoDescK === undefined ? 1.15 : P.infoDescK, 0.5, 2);
  if (dk !== _infoDescK) { const first = _infoDescK === null; _infoDescK = dk; root.style.setProperty('--pb-info-desc-k', String(dk)); if (!first) window.dispatchEvent(new Event('resize')); }
}
applyUiEve();

// 콘솔에서 값을 만지기 위한 핸들. PB.params.lineOpacity = 0.4; PB.apply();
function apply() {
  applyResponsive();
  applyUiEve();
  applyTime();    // 시간대 → 조명 · 배경 · 글자색 · 하늘 (바뀔 때만)
  applySky();     // ⚠ 하늘 값 → 유니폼·CPU·환경맵. 바뀔 때만 다시 굽는다
  applyShadow();  // ⚠ 그림자 켜고 끄기. 바뀔 때만 재질을 다시 컴파일한다
  sim.apply();
  grids.apply();
  spray.apply();
  marks.apply();
  stage.apply();
  title.apply();
  gate.apply();
  boat.syncModel();   // 종이배 ↔ GLB. ⚠ update() 에만 두면 rAF 가 멈춘 환경에서 안 바뀐다
  applyEnv();
}

// ⚠⚠ **배·부표만 밝아지는 문제의 손잡이.** 하늘을 넣고 실측했더니 :
//     환경맵(배·부표) 픽셀 35,312 · 평균 **+51.4** 레벨
//     하늘 반사(물)   픽셀 486,501 · 평균 **+5.8**  레벨
//   사용자 : *"지금 환경 설정으로 부표, 배만 밝은 상태임"* — 숫자가 그대로 그 말이다.
//   원인은 버그가 아니라 **경로가 다르기 때문**이다 : IBL 은 확산면에 하늘 조도를 통째로
//   더하는데, 물은 프레넬로 **20% 만** 섞는다 (카메라 17도에서 F≈0.20). 9배 차이가 난다.
// ⚠ 그래서 물을 올리는 게 아니라 **배를 내린다** — 흰 종이 팔레트에서 위로 올릴 여지는
//   246 까지뿐이고, 거기서 더 밝히면 형태가 사라진다 (불변식 14).
// ⚠ 재질을 만드는 파일(boat.js·marks.js)마다 적지 않고 **여기서 한 번에** 훑는다 —
//   흩어 두면 새 메시를 추가할 때마다 조용히 빠진다 (거품 진폭에서 실제로 겪었다).
// ⚠ 그림자를 켜고 끄면 **재질을 다시 컴파일해야 한다.** 값이 바뀔 때만 돈다
let _shadowOn = null;
function applyShadow() {
  const on = P.boatShadow > 0;
  if (on === _shadowOn) return;
  _shadowOn = on;
  renderer.shadowMap.enabled = on;
  boat.pivot.traverse(o => {
    if (!o.isMesh) return;
    const m = o.material;
    for (const mm of Array.isArray(m) ? m : [m]) if (mm) mm.needsUpdate = true;
  });
}

function applyEnv() {
  // ⚠⚠ **부표는 따로 간다** (2026-09-09) — IBL 이 하늘 방향으로 부표를 기울어 밝혀서
  //   "햇빛 쪽만 빛난다" 가 된다. 부표는 `markEnv`, 나머지(배)는 `envIntensity`.
  //   ⚠ 부표 재질은 부표마다 따로라(marks.js) Set 으로 모아 둔 뒤 한 번에 가른다
  const markMats = new Set();
  marks.group.traverse(o => {
    const mm = o.material;
    if (!mm) return;
    for (const x of Array.isArray(mm) ? mm : [mm]) markMats.add(x);
  });
  scene.traverse(o => {
    const m = o.material;
    if (!m) return;
    for (const mm of Array.isArray(m) ? m : [m]) {
      if (mm.isMeshStandardMaterial) mm.envMapIntensity = markMats.has(mm) ? P.markEnv : P.envIntensity;
    }
  });
}
applyEnv();
applyShadow();
// ── 존에서 나가기. ⚠ 들어가는 것은 자동 조타 도착이 걸지만 **나오는 것은 사람이 건다** —
//   아직 화면에 [닫기] 가 없으므로 우선 ESC 하나다 (§10-1 의 남은 갈래).
//   ⚠ busy 중에는 무시한다. 트윈 도중에 leave 를 부르면 되감기로 읽힌다 (§3 : 퇴장은 역순이 아니다)
const onKeyExit = (e) => {
  if (hostHold) return;   // ⚠ 앱 창(진열대 저장 모달)의 ESC · 스페이스는 그쪽 몫이다 — 여기서도 받으면 12개와 고른 향수가 거둬진다 (v0.68.0)
  // ⭐ 스페이스 — 클릭 항해의 가속 ↔ 일반 속도 (2026-09-15, v0.65.0 — sailBoostKey 주석). ⚠ 입력창 · 버튼 위의 스페이스는 그쪽 몫이다 (글자 · 누르기) ·
  //   누르고 있어 되풀이되는 키는 먹기만 한다 (잠금이 풀리는 순간마다 저절로 뒤집히지 않게)
  if (e.code === 'Space' || e.key === ' ') {
    const tg = e.target, tag = tg && tg.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || tag === 'BUTTON' || (tg && tg.isContentEditable)) return;
    const on = (P.sailBoostKeys === undefined ? 1 : P.sailBoostKeys) >= 0.5 && !!zones.auto && !!(zones.auto.sea || zones.auto.pick);
    if (on && (e.repeat || sailBoostKey(true))) e.preventDefault();
    return;
  }
  if (e.key !== 'Escape') return;
  // 향수 고르기가 먼저다 — 떠 있는 12개를 거두고 끝낸다 (연출까지 한 번에 나가지 않는다)
  if (marks.focusing) { marks.focusOff(); marks.clearSelect(); clickMark = null; return; }
  if (phase.cue.zone) { if (!phase.cue.busy) phase.leave(); return; }
  // ⭐ 그다음이 클릭 항해의 가속 끄기 (v0.65.0 — sailBoostKey) — 고르기도 존 연출도 없을 때만. 최대 가속에 닿기 전이면 아무 일도 없다
  sailBoostKey(false);
};
window.addEventListener('keydown', onKeyExit);

window.PB = { submerged, bloom, topCam, stage, phase, title, gate, input, travel, minimap, chart, dive: hostDive, diveReport, goRegion, startTravel, startFocus, setHost, boot: bootNow, focusPlan: () => lastFocusPlan, params: P, ranges: PARAM_RANGES, apply, onResize, dispose: disposeAll, reflect, swellCPU, sim, water, grids, spray, boat, pod, zones, marks, scene, cam, renderer, nav, swellEnvCPU, swellAmplitude, gerstnerLoopLimit, clock: oceanClock, links, seamark, seaPending: () => pendingSea, travelPending: () => pendingTravel,
  // ⭐ 반응형 검산 (2026-09-11 오후) — 제품 UI 상자들의 자리 · 서로 겹침 · 화면 밖 · 스크롤 · 수면 타이포 꼭대기와 정보 블록의 간격.
  //   ⚠ 창 크기를 바꾼 뒤에는 **스크린샷 한 장으로 먼저 칠하고** 부른다 (숨긴 패널에서는 ResizeObserver 가 안 불린다 — 교훈 ⑧)
  layout: () => layoutReport(),
  // 향 지도 (2026-09-11). PB.scentMap.report() — 지도 크기 · 겹침 풀기 · 부스트 횡단 시간 한 줄
  scentMap: {
    report: () => scentMapReport({ size: P.mapSize, minGap: P.mapMinGap, flipY: P.mapFlipY }),
    get: () => marks.map
  } };

// PB.layout() — 위 주석. 제품 UI 만 본다 (개발 패널은 solo 로 숨기고 잰다)
function layoutReport() {
  const st = ui.stage.getBoundingClientRect();
  const box = (el) => {
    if (!el) return null;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none') return null;
    const r = el.getBoundingClientRect();
    return { x0: Math.round(r.left - st.left), y0: Math.round(r.top - st.top), x1: Math.round(r.right - st.left), y1: Math.round(r.bottom - st.top) };
  };
  const $ = (id) => document.getElementById(id);
  const boxes = {
    search: box($('search-input') && $('search-input').parentElement), info: box($('zone-info')), mark: box($('zone-mark')),
    mini: box($('minimap')), drift: box($('drift-fill') && $('drift-fill').parentElement.parentElement),
    help: box($('drift-help')), card: box($('scent-card'))
  };
  const ks = Object.keys(boxes).filter(k => boxes[k]);
  const overlaps = [];
  for (let i = 0; i < ks.length; i++) for (let j = i + 1; j < ks.length; j++) {
    const a = boxes[ks[i]], b = boxes[ks[j]];
    const ox = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0), oy = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0);
    if (ox > 0 && oy > 0) overlaps.push(`${ks[i]}×${ks[j]} ${ox}×${oy}`);
  }
  const offscreen = ks.filter(k => { const b = boxes[k]; return b.x0 < 0 || b.y0 < 0 || b.x1 > st.width + 0.5 || b.y1 > st.height + 0.5; });
  let titleTop = null;
  if (title.mesh.visible) {
    const m = title.mesh, gv = title.uni.uGlyphV.value;
    _v3.set(m.position.x, m.position.y + (gv.y - 0.5) * m.scale.y, m.position.z).project(cam);
    const ty = (-_v3.y * 0.5 + 0.5) * st.height;
    _v3.set(m.position.x, m.position.y + (gv.x - 0.5) * m.scale.y, m.position.z).project(cam);
    const by = (-_v3.y * 0.5 + 0.5) * st.height;
    titleTop = { top: Math.round(ty), glyphPx: Math.round(by - ty), ceilK: +title.ceilK.toFixed(3), gapToInfo: boxes.info ? Math.round(ty - boxes.info.y1) : null };
  }
  return {
    viewport: [innerWidth, innerHeight], buffer: [renderer.domElement.width, renderer.domElement.height], aspect: +cam.aspect.toFixed(3),
    scroll: document.documentElement.scrollHeight > document.documentElement.clientHeight + 1,
    overlaps, offscreen, title: titleTop, boxes
  };
}

// HMR 과 언마운트가 같은 경로를 쓴다. 여기를 갈라 두면 한쪽만 정리돼 640² 렌더타깃 2장이
// 저장할 때마다 쌓인다 (약 6.5MB/회)
function disposeAll() {
  if (raf) { cancelAnimationFrame(raf); raf = 0; }
  if (resizeRaf) { cancelAnimationFrame(resizeRaf); resizeRaf = 0; }
  ro.disconnect();
  document.removeEventListener('visibilitychange', onVisibility);
  submerged.dispose();
  bloom.dispose();   // ⚠ 새 모듈은 여기 등록한다 (불변식 10)
  input.dispose();
  ui.dispose();
  marks.dispose();   // ⚠ 새 모듈은 여기 등록한다 (불변식 10)
  links.dispose();
  seamark.dispose();
  pod.dispose();
  zones.dispose();
  boat.dispose();
  spray.dispose();
  grids.dispose();
  reflect.dispose();
  water.dispose();
  sim.dispose();
  scene.remove(hemiLight, dirLight);   // 씬을 완전히 비워 둔다 — 남으면 재마운트 때 중복된다
  title.dispose();
  gate.dispose();
  travel.dispose();    // ⚠ 안개를 걷어 둔다 — HMR 뒤에 흰 화면이 남으면 "바다가 날아갔다" 로 오진한다
  hostDive(0);         // ⚠ 잠수를 풀어 둔다 — `<html data-dive>` 가 남으면 엔진 UI 가 영영 안 보인다 (불변식 10)
  disposeDive();
  chart.dispose();     // ⚠ 미니맵보다 먼저 — 안개 격자를 그쪽에서 읽는다
  minimap.dispose();   // (향수 고르기 라벨은 ui.dispose() 가 거둔다)
  window.removeEventListener('keydown', onKeyExit);
  phase.dispose();
  stage.dispose();   // ⚠ window 의 H 키 리스너를 여기서 뗀다 (HMR 마다 쌓인다)
  renderer.dispose();
  el.innerHTML = '';
}

if (import.meta.hot) import.meta.hot.dispose(disposeAll);
