// ───────── 파라미터 패널 (개발 전용) ─────────
// main.js 가 import.meta.env.DEV 일 때만 붙인다. 프로덕션 번들에는 들어가지 않는다 (perf.js 와 같다).
//
// lil-gui 를 쓰지 않는 이유 : 필요한 것이 "PARAM_RANGES 를 그대로 슬라이더로 펴는 것" 하나뿐인데
// 그 대가로 의존성과 자체 클래스 체계가 따라 들어온다. 이 프로젝트는 스타일을 인라인으로만 쓴다.
//
// 이 패널의 목적은 '값을 찾는 것'이지 '값을 저장하는 것'이 아니다. 그래서 [복사] 가 있다 —
// 마음에 드는 조합을 params.js 에 그대로 붙일 수 있는 형태로 내보낸다. 찾은 값은 파일에 적어야
// 한다. 패널에서 만진 값은 새로고침하면 사라진다.
//
// ⚠ 여기서 만드는 입력은 키 이벤트를 반드시 가둬야 한다. input.js 가 keydown 을 window 에서
// 타깃 가드 없이 받고 방향키에 preventDefault 를 걸기 때문에, 안 가두면 슬라이더를 방향키로
// 조절하는 순간 배가 같이 돌고 슬라이더는 안 움직인다.

// 어떤 값이 어느 묶음에 들어가는가. 여기 없는 파라미터는 자동으로 '기타' 로 모인다 —
// params.js 에 값을 추가하고 여기를 잊어도 패널에서 사라지지는 않는다.
//
// ⚠⚠ **셋째 칸은 부제다** — 이 묶음이 무슨 표현이고 무엇을 조심할지 한 줄로 적는다
//   (2026-09-07, 사용자 : *"값이 너무 많아져서 구별하기가 힘들다. 어떤 표현이 들어간거고
//   어떤 값을 올리고 내려야하는지 디테일하게"*). 예전에는 10묶음이었고 '마루 색' 한 칸에
//   50개가 들어 있었다. 지금은 **28묶음 × 2~19개**다.
// ⚠ 쪼갤 때 기준은 파일이 아니라 **화면에 보이는 표현**이다. 같은 water.js 에서 나와도
//   거품의 '양' 과 '무늬' 와 '흰색' 은 만지는 목적이 달라서 따로 둔다.
// ⚠⚠ **줄 하나하나의 설명은 여기 적지 않는다.** params.js 의 주석이 유일한 출처이고
//   패널이 그것을 읽어 붙인다 (아래 loadDocs). 두 곳에 적으면 반드시 갈라진다 — 불변식 2 와
//   같은 규율이다. 설명을 고치고 싶으면 **params.js 의 그 줄 주석**을 고친다.
const GROUPS = [
  ['파도 · 형태', ['oceanSwell', 'waveSpeed', 'gerstner', 'ripple', 'crossAmount', 'swell', 'crossSwell',
                 'ambInterval', 'ambLength', 'ambVary', 'simFps'],
   '파고와 파장. 무엇을 만지든 여기부터 본다. ⚠ waveSpeed 는 속도가 아니라 축척이다'],
  ['파도 · 군 포락선', ['envAmount', 'envLo', 'envHi', 'envRLo', 'envRHi', 'envBeta', 'envGerst', 'envSpeed', 'envMicro'],
   '거친 구역과 잔잔한 구역을 만든다. envAmount 0 이면 예전 바다로 정확히 복귀'],
  ['수면 · 바탕색', ['waterTheme', 'waterTone', 'waterShade', 'waterSpec'],
   '물의 색선과 밝기. waterTheme 이 팔레트(0 종이·1 에메랄드·2 심해·3 자수정), waterTone 이 그 안의 자리'],
  ['수면 · 원경 페이드', ['waterFade0', 'waterFade1', 'waterFadeSky'],
   '물이 배경색으로 사라지는 거리. ⚠ camDist(3.96)를 곱한 것이 월드 거리다 — 20/40 이면 79/158. ' +
   '⚠⚠ 20/40 에서는 거의 안 듣는다 (물 메시가 106 에서 끝난다) — 실제로 지우는 건 UV 가장자리 페이드이고 그건 정사각형이다'],
  ['수면 · 잔결', ['microA', 'microB', 'microWarp', 'microRot', 'microSpread', 'microScale'],
   '법선만 흔드는 미세 물결. ⚠ 최종 화면에선 은은하다 — 검증은 debugView 11 로 한다'],
  ['연출 · 수면 타이포', ['titleAmount', 'titleDist', 'titleWidth', 'titleLift', 'titleSoft', 'titleSpacing',
                     'titleGrad', 'titleGradEnd'],
   '향조 이름이 수면에서 솟는다 (title.js). 자산 0 — 웹폰트를 캔버스에 굽는다. ' +
   '⚠ cue.rise 가 0 이면 안 보인다 — PB.phase.snap("inspecting","woody") 으로 고정하고 만진다'],
  ['연출 · 존 구도', ['zoneYaw', 'zonePitch', 'zoneDist'],
   'cue.look 이 1 일 때의 카메라. ⚠ 확인하려면 PB.phase.snap("inspecting") 으로 고정하고 민다 — ' +
   'sailing 에서는 look 이 0 이라 안 바뀐다. ⚠⚠ zoneYaw 는 음수를 유지한다 (불변식 0-4)'],
  ['연출 · 상태머신', ['phaseAmount', 'phaseSpeed'],
   'phase.js 가 cue 를 채운다. ⚠ 소비자가 아직 없어 **화면은 안 바뀐다** — 판정은 콘솔이다 (PB.phase.report())'],
  ['무대 · 하늘', ['stageAmount', 'skyBand', 'skyBroadA'],
   '화면에 그리는 하늘 (stage.js). 0 이면 예전 배경색 하나로 정확히 복귀. ⚠ 색은 sky.js 의 SKY 표에만 있다'],
  ['수면 · 하늘 반사와 톤', ['skyAmount', 'envIntensity', 'markEnv', 'toneAmount', 'toneNear', 'toneFar'],
   '스치는 각일수록 세진다. 하늘이 물보다 밝아 이 항은 밝히는 쪽으로만 작용한다'],
  ['정반사 · 반짝임', ['sunRot', 'sunTilt', 'specAmount', 'glitter', 'glitterCell', 'glitterOct2',
                 'shine', 'glintAmount', 'glintScatter', 'sunLobe'],
   '해가 물에 부딪혀 튀는 점. ⚠ 빛 무리의 **자리**는 sunRot/sunTilt 가 정한다 (맨 앞 둘)'],
  ['거품 · 양과 수명', ['foamDecay', 'foamSteep', 'foamHigh', 'foamLo', 'foamHi', 'foamLive', 'foamCalm',
                 'foamLiveH0', 'foamLiveH1', 'foamLiveH2', 'foamLiveH3', 'foamWLo', 'foamWHi', 'foamFront', 'foamFrontW'],
   '언제 생기고 얼마나 남는가. ⚠ 이 바다에서 기억을 갖는 유일한 채널(.w) 이다'],
  ['거품 · 무리', ['foamClump', 'foamClumpSpan', 'foamClumpQLo', 'foamClumpQHi', 'foamClumpCell', 'foamClumpStretch', 'foamClumpFlow', 'foamCross'],
   '같은 마루 안에서 어느 구간이 부서지는가. ⚠ 태어나는 쪽(sim.js br)이다 — 칠하는 게이트가 아니다. 검증 보기 15 + topView'],
  ['거품 · 무늬', ['foamCell', 'foamWarp', 'foamRough', 'foamStretch', 'foamFine', 'foamFineAmt',
                 'foamThin', 'foamThick', 'foamEdge', 'foamBubble', 'foamBlur', 'foamAA', 'foamDrift',
                 'foamShade', 'foamLace', 'foamLaceThin'],
   'worley 세포의 생김새. 알갱이로 읽히느냐 색면으로 뭉치느냐가 여기서 갈린다'],
  ['거품 · 흰색과 게이트', ['foamWhite', 'foamNear', 'foamFar', 'foamCull', 'foamFace', 'foamFaceBias',
                 'foamFaceAmt', 'foamFaceSoft', 'foamFaceOut',
                 'lineYield', 'lineYieldSrc', 'lineYieldK', 'foamFaceKeep', 'foamFaceKeepLo', 'foamFaceKeepHi', 'foamKnee', 'lineFoamSrc'],
   '어디에 칠할지 자르는 값. ⚠ 게이트를 곱으로 쌓지 않는다 — 셋이면 몇 레벨로 죽는다'],
  ['거품 · 파란 띠 밑 · 군집', ['foamUnder', 'foamStripAt', 'foamStripW', 'foamReach', 'foamTailLo', 'foamTailHi', 'foamUnderA', 'foamPatch', 'foamPatchCell', 'foamPatchLo', 'foamPatchHi'],
   '칠하는 쪽만 (v0.61). 뒷면(오로라 파랑 밑)에만 · 오래된 꼬리 자르기 · 은은함 · 가득한 곳과 기포 자리. 탄생(sim.js)은 그대로'],
  // ⚠ 반짝임 거품은 흰 거품(foamWhite)과 **서로를 지우는** 관계다. 한쪽을 올리기 전에
  //   다른 쪽을 먼저 본다. 같은 정반사 식이라 값도 비슷해 보이지만 층은 다르다
  ['반짝임 거품', ['sparkAmount', 'sparkH0', 'sparkH1', 'sparkRise', 'sparkFace', 'sparkFaceW', 'sparkFaceB',
                 'sparkDrift', 'sparkClump', 'sparkLo', 'sparkHi', 'sparkDens', 'sparkCull', 'sparkCell',
                 'sparkJitter', 'sparkShine'],
   '거품 알갱이가 빛을 튕긴다. ⚠ 흰 거품과 서로를 지운다 — 한쪽만 보고 올리지 않는다'],
  ['마루 · 색 (오로라)', ['iriAmount', 'crestFace', 'crestBias', 'crest', 'apexAmount', 'apexH0', 'apexH1'],
   '보라 → 아이스블루 → 백색. ⚠ 크기는 iriAmount × foamAmount 가 같이 정한다'],
  ['마루 · 선', ['lineAmount', 'lineWidth', 'lineHalo', 'lineH0', 'lineH1', 'lineFoam', 'lineFoamHi',
                 'glowAmount', 'glowWidth'],
   '능선을 **어둡게** 긋는다. 마루는 바탕이 222~228 이라 밝게 그릴 여지가 없다'],
  ['마루 · 이음매', ['seamAmount', 'seamWidth', 'seamH0', 'seamH1'],
   '두 색이 만나는 자리의 흰 발광. ⚠ 블룸은 이것을 못 골라낸다'],
  ['배 · 그림자', ['boatShadow', 'shadowAmount', 'shadowSize', 'shadowSoft', 'shadowKnee', 'shadowOcclude',
                 'contactAmount', 'contactSize', 'contactLift'],
   '배와 물을 붙이는 세 겹. ⚠ 합치면 그 순간 예전의 발밑 타원이 된다 (불변식 0-3-2)'],
  ['배 · 선체 거품', ['hullFoam', 'hullSize', 'hullBand', 'hullOuter', 'hullInner', 'hullTiltK', 'hullDrift',
                 'hullSwell', 'hullPush', 'hullTaper', 'hullLap', 'hullLapW', 'hullHit', 'hullBead',
                 'hullTail', 'hullTailLo', 'hullLane', 'hullCull'],
   '배가 물을 가르는 자리. ⚠ 흰 거품 게이트 **밖**이라 foamWhite 0 으로 안 꺼진다'],
  ['배 · 물에 비침', ['boatReflect', 'reflectSlice', 'reflectAim', 'reflectMirror', 'reflectFade', 'reflectBlur',
                 'reflectFill', 'reflectSharp', 'reflectRipple', 'reflectPush', 'reflectRise',
                 'reflectSmear', 'reflectTail', 'reflectScatter', 'scatterNear', 'scatterFar', 'scatterRamp',
                 'scatterCell', 'scatterSlope'],
   '렌더타깃 평면 반사. 레이어 2 에 든 것이 비친다. ⚠ 롤백값이 0 이 아닌 것이 셋 있다'],
  ['배 · 잠긴 선체', ['subAmount', 'subRefract', 'subScatter', 'subCell', 'subScatSlope', 'subBreak', 'subEdge',
                 'subFadeIn', 'subDepthK', 'subDeepFade', 'subDeepBlur', 'subLift', 'subReach',
                 'boatLift', 'boatRise', 'bowDepth'],
   '물에 잠긴 부분이 비쳐 보인다. subReach 가 거리 게이트 (화면 해시 −20% 를 번 자리)'],
  ['물보라 · 항적', ['sprayAmount', 'sprayHit', 'sprayLaunch', 'spraySpread', 'sprayGrav', 'sprayLife',
                 'sprayLift', 'sprayFade', 'wakeAmount', 'wakeEdge', 'wakeLo', 'wakeHi',
                 'trailLife', 'trailEmphasis'],
   '배가 남기는 것. 항적은 거품과 함께 기억을 갖는 채널(.z) 이다'],
  // ⚠ 시간 계약을 맨 앞에 둔다 — 배의 속도가 파도의 위상속도에서 나오므로 여기 손잡이는
  //   배만의 값이 아니라 **배와 파도의 관계**다 (ocean-clock.js). 만지기 전에 clock.report()
  ['배 · 움직임과 시계', ['boatModel', 'boatGlbLift', 'boatPaperTone', 'sailWind', 'sailWindRest', 'sailWindFreq', 'sailWindSpeed', 'sailWindGust', 'sailWindDir', 'sailWindCross', 'sailWindTilt', 'sailFlip', 'sailSpec', 'sailTone', 'boatMetal', 'boatRough', 'metalAmount', 'metalMetalness', 'metalRough', 'boatNormal', 'paperAmount', 'paperScale', 'paperShade', 'paperVary', 'clockUnified', 'driftCp', 'boostCp', 'driftSpeed', 'turnRadius', 'turnRate',
                 'turnFloor', 'buoyancy', 'rightLimit', 'rightLead', 'rightDamp', 'boatFps'],
   '속도는 월드/초가 아니라 **위상속도의 배수**다. ⚠ 속도를 줄이면 선회 반경을 보존한다'],
  ['카메라', ['camYaw', 'camPitch', 'camDist'],
   '구도. ⚠ camPitch 에 반사 세기가 크게 걸리고 프레넬이라 튜닝으로 못 넘는다'],
  ['향수 지도', ['markMap', 'mapSize', 'mapCount', 'mapMinGap', 'mapFlipY'],
   '향수 지도 CSV 200개를 유한 좌표에 깐다 (scentmap.js). markMap 0 = 예전 더미 32개 토러스. ' +
   '⚠ 지도 전체는 항공뷰(topView)에서 본다 — 거기서는 거리 페이드가 꺼진다'],
  ['항해 · 미니맵 · 먼 곳 이동', ['minimapOn', 'travelFog', 'travelLead', 'travelFogIn', 'travelFogOut', 'travelFogBlur',
                     'travelStandoff', 'travelArrive', 'zoneHold'],
   '미니맵을 누르면 lead 초 달려 보고, 못 닿으면 흰 안개 → 목표 앞에 세운다 (travel.js). ' +
   '⚠ standoff < arrive 라야 안개 뒤에서 도착 연출이 시작된다. zoneHold 0 = 연출이 ESC 까지 머문다'],
  ['향수 고르기', ['focusOn', 'focusCount', 'focusSinkT', 'focusRiseAt', 'focusRiseT', 'focusCamIn', 'focusCamOut',
                'focusCols', 'focusX0', 'focusX1', 'focusDist', 'focusHiY', 'focusLoY'],
   '부표를 누르면 주변이 가라앉고 배에서 가까운 12개가 연출 구도의 빈 자리에 솟는다 (marks.js focus). ' +
   '⚠ 슬롯은 최종 카메라의 화면 비율 좌표다 — 누를 때 한 번 잡으므로 값을 바꾸면 다시 눌러야 보인다'],
  ['향수 부표', ['showMarks', 'markTheme', 'markCount', 'markLayout', 'markTile', 'markScale', 'markGlow',
                 'markLiftN', 'markLiftH', 'markHeight', 'markHeightVary', 'markNear', 'markReflect',
                 'markReflSpread', 'markReflFall', 'markReflAnchor', 'markReflGlow', 'markReflCore', 'showMarkHits'],
   '향수 하나가 부표 하나. ⚠ markReflect 는 2026-09-09 부터 **0** 이다 — 반사는 평면 패스가 맡고, markRefl* 다섯은 그래서 무효'],
  ['물속 · 바닥', ['floorAmount', 'floorDepth', 'floorScale', 'floorWidth', 'refract'],
   '얕은 물의 바닥 무늬와 굴절'],
  ['그리드 · 선', ['showGrid', 'lineOpacity', 'lineContrast', 'gridWave', 'shatterAmount', 'lightAmount', 'reflect'],
   '기본은 꺼져 있다. ⚠ 다시 켜기 전에 이것이 무엇을 덮는지 먼저 본다 (불변식 12)'],
  ['후처리 · 블룸', ['bloomAmount', 'bloomThreshold', 'bloomRadius'],
   '유일한 후처리. ⚠ 문턱 창이 칼날처럼 좁다 (0.85 면 76% 가 날아가고 0.955 면 무반응)'],
  ['계측 · 개발 전용', ['debugView', 'debugEdge', 'freeView', 'freeFov', 'topView', 'topSize', 'topTurn', 'showProbes'],
   '화면에 나가지 않는다. 층이 **어디에** 서 있는지는 여기로 본다']
];

// ───────── 층 켜고 끄기 ─────────
// "이 얼룩이 어느 층에서 나오는가" 를 손으로 좁히는 도구다. 지금까지 콘솔에서
// `PB.params.foamAmount = 0` 같은 식으로 하던 것을 그대로 UI 로 옮겼다.
//
// ⚠ 셰이더에 스위치를 새로 넣지 않는다. 각 층을 **구동하는 파라미터를 0 으로 눌러** 끈다.
// 그래야 층이 늘어나도 여기 한 줄만 추가하면 되고, 셰이더 분기가 안 늘어난다.
// 끈 동안의 원래 값은 stash 에 넣어 두고, 다시 켜면 그대로 되돌린다 —
// [복사] 와 '바뀐 값' 표시도 stash 쪽(진짜 값)을 본다. 안 그러면 꺼 둔 층이
// 0 으로 params.js 에 복사돼 버린다.
const LAYERS = [
  ['수면 명암',   ['waterShade']],
  ['수면 반사광', ['waterSpec']],
  ['미세 잔물결', ['microA', 'microB']],
  // ⚠ envMicro 를 여기 넣지 않는다 — 잔결의 **세기**가 아니라 '잔잔한 구역에서만 키우는 비율'
  //   이라, 미세 잔물결을 끄면 어차피 같이 꺼진다 (곱해지는 항이다)
  ['군 포락선',   ['envAmount']],
  ['교차 너울',   ['crossAmount']],
  ['물속 · 바닥', ['floorAmount', 'refract']],
  ['하늘 반사',   ['skyAmount']],
  ['배 그림자',   ['shadowAmount']],
  ['접촉 그림자', ['contactAmount']],
  ['근경 톤',     ['toneAmount']],
  ['정반사',      ['specAmount']],
  ['반짝임',      ['glitter']],
  ['항적',        ['wakeAmount']],
  ['배 반사',     ['boatReflect']],
  // ⚠ iriWater 와 foamAmount 를 **따로 적지 않는다.** 둘은 같은 항에 곱해지는 하나의
  // 손잡이라, 나눠 놓으면 서로 다른 층인 것처럼 보인다. 실제로 그렇게 적어 놨다가
  // 두 스위치가 소수점까지 똑같은 값을 내는데도 별개 층으로 읽고 범인을 잘못 짚었다
  ['마루 색 (오로라)', ['iriAmount']],
  ['잠긴 선체', ['subAmount', 'subRefract', 'subScatter', 'subCell', 'subScatSlope', 'subBreak', 'subEdge', 'subFadeIn', 'subDepthK', 'subDeepFade', 'subDeepBlur', 'subLift']],
  ['블룸',      ['bloomAmount', 'bloomThreshold', 'bloomRadius']],
  ['마루 선',    ['lineAmount']],
  ['흰 거품',    ['foamWhite']],
  ['반짝임 거품', ['sparkAmount']],
  ['부표 반사',  ['markReflect']],
  ['물보라',      ['sprayAmount']]
];

// step 에서 표시할 소수 자리를 정한다 (0.005 → 3자리)
const decimals = (step) => {
  const s = String(step);
  const i = s.indexOf('.');
  return i < 0 ? 0 : s.length - i - 1;
};

export function createTweaks(stage, { params, ranges, apply }) {
  // ⚠ PARAMS 와 PARAM_RANGES 가 어긋나면 조용히 망가진다. 범위에만 있고 값이 없으면
  // 그 파라미터는 undefined 로 유니폼에 실려 NaN 이 되고, 그 층이 통째로 안 그려진다.
  // 실제로 그렇게 반사가 죽은 채 커밋된 적이 있다 — 패널에도 안 보여서 눈치채기 어려웠다
  const missing = Object.keys(ranges).filter(k => !(k in params));
  const unranged = Object.keys(params).filter(k => !(k in ranges) && typeof params[k] !== 'boolean');
  if (missing.length) console.error('[tweaks] PARAM_RANGES 에만 있고 PARAMS 에 없음 →', missing.join(', '));
  if (unranged.length) console.warn('[tweaks] PARAMS 에 있는데 범위가 없어 슬라이더가 안 생김 →', unranged.join(', '));

  const DEFAULTS = { ...params };              // [되돌리기] 와 [복사] 의 기준
  const rows = [];                             // { key, sync(), el }
  const stash = {};                            // 꺼 둔 층의 원래 값 (키 → 값)
  const trueVal = k => (k in stash ? stash[k] : params[k]);

  const box = document.createElement('div');
  box.style.cssText =
    'position:absolute;top:8px;right:8px;width:264px;max-height:calc(100vh - 24px);' +
    'display:flex;flex-direction:column;z-index:50;' +
    'font:11px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace;color:#1A1A1A;' +
    'background:rgba(255,255,255,.86);backdrop-filter:blur(6px);' +
    'border:1px solid rgba(0,0,0,.12);border-radius:6px;box-shadow:0 2px 12px rgba(0,0,0,.07)';

  // ── 머리 : 접기 / 되돌리기 / 복사
  const head = document.createElement('div');
  head.style.cssText = 'display:flex;align-items:center;gap:6px;padding:6px 8px;' +
    'border-bottom:1px solid rgba(0,0,0,.10);flex:none';
  const title = document.createElement('button');
  title.textContent = '▾ 파라미터';
  title.style.cssText = 'flex:1;text-align:left;font:inherit;font-weight:600;cursor:pointer;' +
    'background:none;border:0;padding:0;color:inherit';
  const mkBtn = (label, hint) => {
    const b = document.createElement('button');
    b.textContent = label; b.title = hint;
    b.style.cssText = 'font:inherit;cursor:pointer;background:#fff;color:inherit;' +
      'border:1px solid rgba(0,0,0,.18);border-radius:3px;padding:1px 6px';
    return b;
  };
  const copyBtn = mkBtn('복사', '기본값에서 바뀐 값만 params.js 에 붙일 형태로 클립보드에 담는다');
  const resetBtn = mkBtn('되돌리기', '이 페이지를 연 시점의 값으로 전부 되돌린다');
  head.append(title, resetBtn, copyBtn);

  // ── 걸러보기
  const filterWrap = document.createElement('div');
  filterWrap.style.cssText = 'padding:6px 8px;border-bottom:1px solid rgba(0,0,0,.10);flex:none';
  const filter = document.createElement('input');
  filter.placeholder = '이름으로 걸러보기';
  filter.style.cssText = 'width:100%;box-sizing:border-box;font:inherit;padding:3px 5px;' +
    'border:1px solid rgba(0,0,0,.18);border-radius:3px;background:#fff;color:inherit';
  filterWrap.appendChild(filter);

  // ── 층 켜고 끄기 (걸러보기의 영향을 안 받는 고정 블록)
  const layerBox = document.createElement('div');
  layerBox.style.cssText = 'padding:5px 8px 7px;border-bottom:1px solid rgba(0,0,0,.10);flex:none';

  const body = document.createElement('div');
  body.style.cssText = 'overflow-y:auto;padding:2px 8px 8px;flex:1 1 auto';

  box.append(head, filterWrap, layerBox, body);

  // ── 한 줄 만들기
  const addRow = (parent, key) => {
    const val = params[key];
    const rng = ranges[key];
    if (typeof val !== 'boolean' && !rng) return;   // 범위도 없고 불리언도 아니면 그릴 수 없다

    const row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;gap:5px;padding:1px 0';
    const name = document.createElement('label');
    name.textContent = key;
    name.title = key;
    // ⚠ 이름을 누르면 설명이 펴진다 (2026-09-07). 그래서 cursor 가 default 가 아니라 pointer 다
    name.style.cssText = 'flex:0 0 92px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;' +
      'opacity:.78;cursor:pointer';
    row.appendChild(name);

    let sync;
    if (typeof val === 'boolean') {
      const cb = document.createElement('input');
      cb.type = 'checkbox'; cb.checked = val;
      cb.style.cssText = 'margin:0;cursor:pointer';
      cb.addEventListener('change', () => { params[key] = cb.checked; apply(); mark(); });
      row.appendChild(cb);
      sync = () => { cb.checked = trueVal(key); };
    } else {
      const [min, max, step] = rng;
      const d = decimals(step);
      const sl = document.createElement('input');
      sl.type = 'range'; sl.min = min; sl.max = max; sl.step = step; sl.value = val;
      sl.style.cssText = 'flex:1 1 auto;min-width:0;margin:0;cursor:pointer;accent-color:#5A6B7A';
      const num = document.createElement('input');
      num.type = 'number'; num.min = min; num.max = max; num.step = step;
      num.value = Number(val).toFixed(d);
      num.style.cssText = 'flex:0 0 56px;font:inherit;text-align:right;padding:1px 3px;' +
        'border:1px solid rgba(0,0,0,.15);border-radius:3px;background:#fff;color:inherit';
      // 슬라이더는 범위 안, 숫자칸은 범위 밖도 허용한다 — 한계를 넘겨봐야 알 수 있는 값이 있다
      const set = (v, from) => {
        if (!Number.isFinite(v)) return;
        if (key in stash) stash[key] = v; else params[key] = v;
        if (from !== 'slider') sl.value = v;
        if (from !== 'number') num.value = v.toFixed(d);
        apply(); mark();
      };
      sl.addEventListener('input', () => set(parseFloat(sl.value), 'slider'));
      num.addEventListener('input', () => set(parseFloat(num.value), 'number'));
      row.append(sl, num);
      sync = () => {
        const v = trueVal(key);
        sl.value = v; num.value = Number(v).toFixed(d);
        // 꺼 둔 층의 슬라이더는 만질 수 없다 — 만져 봐야 0 에 덮여 아무 일도 안 일어난다
        const off = key in stash;
        row.style.opacity = off ? '.35' : '1';
        sl.disabled = num.disabled = off;
      };
    }

    row.dataset.key = key.toLowerCase();

    // ── 설명 칸. 이름을 누르면 이 줄 밑에 펴진다
    // ⚠ 글은 여기서 짓지 않는다 — **params.js 의 주석**을 읽어 채운다 (아래 loadDocs).
    //   범위와 기본값은 ranges·DEFAULTS 에서 나오므로 주석이 없는 값에도 뜬다.
    // ⚠ 높이를 묶는다. params.js 의 주석은 짧지 않다 — gerstner 하나가 화면 절반을 덮었다.
    //   넘치면 이 칸 안에서 스크롤한다 (툴팁에는 전문이 그대로 있다)
    const doc = document.createElement('div');
    doc.style.cssText = 'display:none;margin:0 0 3px 0;padding:3px 5px;white-space:pre-wrap;' +
      'line-height:1.4;opacity:.72;background:rgba(0,0,0,.035);border-radius:3px;font-size:10px;' +
      'max-height:11em;overflow-y:auto';
    name.addEventListener('click', () => {
      doc.style.display = doc.style.display === 'none' ? '' : 'none';
    });

    // ⚠ 줄과 설명을 한 칸(cell)으로 묶는다. 걸러보기가 이 칸 하나만 숨기면 되고,
    //   묶음이 비었는지 세는 것도 칸 단위라 설명이 펴져 있어도 안 헷갈린다
    const cell = document.createElement('div');
    cell.append(row, doc);
    parent.appendChild(cell);
    rows.push({ key, sync, el: cell, name, doc });
  };

  // ── 묶음별로 펼친다. 어디에도 안 적힌 값은 '기타' 로 모은다
  // ⚠ 묶음마다 접힌다 (2026-09-07). 24묶음을 다 펴 두면 예전과 같아지므로 **기본은 닫힘**이고,
  //   대신 **부제는 접혀 있어도 보인다** — 어디를 열지 그걸 읽고 정하라는 뜻이다.
  //   머리에 그 묶음의 값 개수를 적는다.
  const listed = new Set(GROUPS.flatMap(([, ks]) => ks));
  const rest = Object.keys(params).filter(k => !listed.has(k));
  const groups = GROUPS.concat([['기타', rest,
    '묶음 표에 안 적힌 값. ⚠ 여기 뜨면 tweaks.js 의 GROUPS 에 넣어 준다']]);
  const sections = [];
  for (const [label, keys, note] of groups) {
    const usable = keys.filter(k => k in params);
    if (!usable.length) continue;
    const h = document.createElement('button');
    h.style.cssText = 'display:block;width:100%;text-align:left;margin:8px 0 2px;font:inherit;' +
      'font-weight:600;opacity:.6;background:none;border:0;color:inherit;cursor:pointer;' +
      'border-bottom:1px solid rgba(0,0,0,.08);padding:0 0 2px';
    const sub = document.createElement('div');            // 부제 : 무슨 표현인가
    sub.textContent = note || '';
    sub.style.cssText = 'margin:0 0 3px;opacity:.5;line-height:1.35;font-size:10px' +
      (note ? '' : ';display:none');
    const wrap = document.createElement('div');
    let open = false;
    const setOpen = v => {
      open = v;
      h.textContent = (open ? '▾ ' : '▸ ') + label + '  ' + usable.length;
      wrap.style.display = open ? '' : 'none';
    };
    setOpen(false);
    h.addEventListener('click', () => setOpen(!open));
    body.append(h, sub, wrap);
    usable.forEach(k => addRow(wrap, k));
    sections.push({ h, sub, wrap, setOpen, isOpen: () => open });
  }

  // 기본값에서 바뀐 줄에 표시를 남긴다 — 무엇을 만졌는지가 눈에 보여야 되돌릴 수 있다
  const mark = () => {
    for (const r of rows) {
      const changed = trueVal(r.key) !== DEFAULTS[r.key];
      r.name.style.opacity = changed ? '1' : '.78';
      r.name.style.fontWeight = changed ? '700' : '400';
      r.name.style.color = changed ? '#8A4A6A' : 'inherit';
    }
  };
  mark();

  // ── 층 UI. 체크박스는 그 층 하나를 끄고, [단독] 은 그 층만 남긴다
  const layerOn = new Map(LAYERS.map(([n]) => [n, true]));
  const layerRows = [];

  const setLayer = (name, on) => {
    if (layerOn.get(name) === on) return;
    layerOn.set(name, on);
    for (const [n, keys] of LAYERS) {
      if (n !== name) continue;
      for (const k of keys) {
        if (!(k in params)) continue;
        if (on) { if (k in stash) { params[k] = stash[k]; delete stash[k]; } }
        else if (!(k in stash)) { stash[k] = params[k]; params[k] = 0; }
      }
    }
  };
  const refresh = () => { layerRows.forEach(f => f()); rows.forEach(r => r.sync()); apply(); mark(); syncLayerHead(); };

  // ⚠ 머리를 눌러 층 목록만 접는다 (2026-09-07, 사용자 : *"너무 길어서 이 환경에서 확인
  //   안 됨"*). 층이 22줄이라 그 아래 묶음들이 화면 밖으로 밀려났다.
  //   ⚠ **기본이 닫힘**이다. 대신 접혀 있어도 꺼진 층 수를 머리에 적어 상태를 잃지 않는다 —
  //     안 그러면 층을 꺼 둔 것을 잊고 "이 효과가 왜 안 보이지" 로 헤맨다.
  //   ⚠ 파라미터 묶음(body)은 안 건드렸다. 걸러보기가 이미 그 몫을 한다.
  const lHead = document.createElement('button');
  lHead.style.cssText = 'display:block;width:100%;text-align:left;font:inherit;font-weight:600;' +
    'opacity:.55;margin-bottom:3px;cursor:pointer;background:none;border:0;padding:0;color:inherit';
  layerBox.appendChild(lHead);

  const layerList = document.createElement('div');   // 접는 대상은 이 칸뿐이다
  layerBox.appendChild(layerList);

  let layersOpen = false;
  const syncLayerHead = () => {
    const off = LAYERS.filter(([n]) => layerOn.has(n) && !layerOn.get(n)).length;
    lHead.textContent = (layersOpen ? '▾' : '▸') + ' 층 켜고 끄기' + (off ? ' (' + off + ' 꺼짐)' : '');
    lHead.style.color = off ? '#8A4A6A' : 'inherit';   // 바뀐 파라미터 표시와 같은 색
    lHead.style.opacity = off ? '.9' : '.55';
    layerList.style.display = layersOpen ? '' : 'none';
  };
  lHead.addEventListener('click', () => { layersOpen = !layersOpen; syncLayerHead(); });

  for (const [name, keys] of LAYERS) {
    if (!keys.some(k => k in params)) continue;    // 없는 파라미터를 가리키면 줄을 안 만든다
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;gap:5px;padding:1px 0';
    const cb = document.createElement('input');
    cb.type = 'checkbox'; cb.checked = true;
    cb.style.cssText = 'margin:0;cursor:pointer';
    const lb = document.createElement('label');
    lb.textContent = name;
    lb.style.cssText = 'flex:1 1 auto;cursor:pointer;opacity:.85';
    lb.addEventListener('click', () => { cb.checked = !cb.checked; cb.dispatchEvent(new Event('change')); });
    const solo = mkBtn('단독', '이 층만 남기고 나머지를 전부 끈다. 한 번 더 누르면 전부 켠다');
    solo.style.cssText += ';padding:0 4px;font-size:10px;opacity:.7';

    cb.addEventListener('change', () => { setLayer(name, cb.checked); refresh(); });
    solo.addEventListener('click', () => {
      // 이미 이 층만 켜져 있으면 전부 켠다 (되돌리기 겸용)
      const alone = layerOn.get(name) && LAYERS.every(([n]) => n === name || !layerOn.get(n));
      for (const [n] of LAYERS) setLayer(n, alone ? true : n === name);
      refresh();
    });
    row.append(cb, lb, solo);
    layerList.appendChild(row);
    layerRows.push(() => {
      const on = layerOn.get(name);
      cb.checked = on;
      lb.style.opacity = on ? '.85' : '.4';
      lb.style.textDecoration = on ? 'none' : 'line-through';
    });
  }
  syncLayerHead();   // 머리 글자와 접힘 상태를 첫 그림에 맞춘다

  // ── 걸러보기 : 이름에 든 글자로 줄과 빈 묶음을 같이 숨긴다
  // ⚠ 묶음이 기본으로 접혀 있으므로, **찾는 동안은 전부 펴고** 검색어를 지우면 원래 접힘
  //   상태로 되돌린다. 안 그러면 걸러도 아무것도 안 보여서 "검색이 고장났다" 로 읽힌다
  let filtering = false;
  const savedOpen = new Map();
  filter.addEventListener('input', () => {
    const q = filter.value.trim().toLowerCase();
    if (q && !filtering) {
      filtering = true;
      sections.forEach((s, i) => { savedOpen.set(i, s.isOpen()); s.setOpen(true); });
    } else if (!q && filtering) {
      filtering = false;
      sections.forEach((s, i) => s.setOpen(!!savedOpen.get(i)));
    }
    for (const r of rows) r.el.style.display = (!q || r.key.toLowerCase().includes(q)) ? '' : 'none';
    for (const s of sections) {
      const any = [...s.wrap.children].some(c => c.style.display !== 'none');
      s.h.style.display = any ? '' : 'none';
      s.sub.style.display = (any && s.sub.textContent) ? '' : 'none';
      s.wrap.style.display = (any && s.isOpen()) ? '' : 'none';
    }
  });

  // ── 줄마다의 설명 : **params.js 의 주석이 유일한 출처다**
  // 여기에 설명을 따로 적지 않는 이유는 불변식 2 와 같다 — 두 곳에 적으면 갈라지고,
  // 갈라진 뒤에는 어느 쪽이 맞는지 아무도 모른다. params.js 의 그 줄 주석을 고치면 여기 뜬다.
  // ⚠ 범위와 기본값은 주석이 없는 값에도 뜬다. "지금 값이 범위의 어디쯤인가" 가
  //   올릴지 내릴지의 첫 단서다.
  const fmtDoc = (key, desc) => {
    const rng = ranges[key];
    const head = rng
      ? '범위 ' + rng[0] + ' ~ ' + rng[1] + '  ·  기본 ' + DEFAULTS[key]
      : '기본 ' + DEFAULTS[key];
    return desc ? head + '\n' + desc : head;
  };
  const applyDocs = (docs) => {
    for (const r of rows) {
      const desc = docs[r.key];
      const text = fmtDoc(r.key, desc);
      r.doc.textContent = text;
      r.name.title = r.key + '\n' + text;
      if (desc) {                                   // 설명이 있는 값은 점선 밑줄로 알린다
        r.name.style.textDecoration = 'underline dotted';
        r.name.style.textDecorationColor = 'rgba(0,0,0,.28)';
      }
    }
  };
  applyDocs({});                                    // 먼저 범위·기본값만 채운다

  // ⚠⚠ dev 에서만 읽는다. 소스를 번들에 넣지 않으려고 import 가 아니라 fetch 이고,
  //   경로를 **문자열 그대로** 적는다. 다음 둘은 실측으로 확인한 함정이다 :
  //     import '...?raw'                       → 125KB 문자열이 번들에 남는다
  //     fetch(new URL('./params.js', import.meta.url))
  //         → Vite 가 이것을 **애셋으로 보고** params.js 를 통째로 dist 에 복사한다
  //           (실제로 dist/assets/params-*.js 125.41 kB 가 나왔다)
  //   지금 형태는 dev 서버가 이 경로로 소스를 서빙하고, 빌드에서는 404 라 catch 로 넘어간다.
  //   실패해도 조용히 넘어간다 — 설명이 없을 뿐 패널은 그대로 쓴다.
  const parseDocs = (src) => {
    const s0 = src.indexOf('export const PARAMS');
    const e0 = src.indexOf('export const PARAM_RANGES');
    const bodySrc = src.slice(s0 < 0 ? 0 : s0, e0 > s0 ? e0 : src.length);
    const out = {};
    let block = [];
    for (const raw of bodySrc.split('\n')) {
      const line = raw.replace(/\s+$/, '');
      const c = line.match(/^\s*\/\/ ?(.*)$/);
      if (c) { block.push(c[1]); continue; }         // 값 바로 위에 쌓인 주석 블록
      const m = line.match(/^ {2}([A-Za-z][A-Za-z0-9]*)\s*:/);
      if (m) {
        const i = line.indexOf('//');
        const tail = i > 0 ? line.slice(i + 2).trim() : '';
        const parts = [];
        if (tail) parts.push(tail);
        if (block.length) parts.push(block.join(' '));
        if (parts.length && !(m[1] in out)) out[m[1]] = parts.join('\n');
      }
      block = [];                                    // 값 줄이든 빈 줄이든 블록은 여기서 끊긴다
    }
    return out;
  };
  if (import.meta.env && import.meta.env.DEV) {
    fetch('/src/params.js')
      .then(r => (r.ok ? r.text() : ''))
      .then(src => { if (src) applyDocs(parseDocs(src)); })
      .catch(() => {});
  }

  let open = true;
  title.addEventListener('click', () => {
    open = !open;
    title.textContent = (open ? '▾' : '▸') + ' 파라미터';
    filterWrap.style.display = layerBox.style.display = open ? '' : 'none';
    body.style.display = open ? '' : 'none';
  });

  resetBtn.addEventListener('click', () => {
    for (const k of Object.keys(stash)) delete stash[k];   // 꺼 둔 층도 같이 되살린다
    LAYERS.forEach(([n]) => layerOn.set(n, true));
    Object.assign(params, DEFAULTS);
    refresh();
  });

  copyBtn.addEventListener('click', async () => {
    const changed = rows
      .filter(r => trueVal(r.key) !== DEFAULTS[r.key])
      .map(r => `  ${r.key}: ${typeof trueVal(r.key) === 'boolean' ? trueVal(r.key) : +Number(trueVal(r.key)).toFixed(4)},`);
    const text = changed.length
      ? changed.join('\n')
      : '// 기본값에서 바뀐 것이 없다';
    try {
      await navigator.clipboard.writeText(text);
      copyBtn.textContent = `${changed.length}개 복사됨`;
    } catch {
      // 클립보드가 막힌 환경(비보안 컨텍스트 등)에서는 콘솔로 내보낸다
      console.log(text);
      copyBtn.textContent = '콘솔에 출력';
    }
    setTimeout(() => { copyBtn.textContent = '복사'; }, 1400);
  });

  // ⚠ 키를 여기서 가둔다. 안 그러면 방향키가 input.js 까지 가서 배를 돌리고,
  // 거기서 preventDefault 를 맞아 슬라이더 자신은 안 움직인다
  const swallow = e => e.stopPropagation();
  box.addEventListener('keydown', swallow);
  box.addEventListener('keyup', swallow);

  stage.appendChild(box);

  return {
    el: box,
    // 콘솔에서 값을 바꾼 뒤 패널을 맞추고 싶을 때 (PB.tweaks.sync())
    sync() { rows.forEach(r => r.sync()); mark(); },
    // 콘솔에서 : PB.tweaks.layer('마루 색', false) / PB.tweaks.solo('정반사')
    layer(name, on) { setLayer(name, on); refresh(); },
    solo(name) { LAYERS.forEach(([n]) => setLayer(n, n === name)); refresh(); },
    allOn() { LAYERS.forEach(([n]) => setLayer(n, true)); refresh(); },
    dispose() {
      box.removeEventListener('keydown', swallow);
      box.removeEventListener('keyup', swallow);
      box.remove();
    }
  };
}
