import { PARAMS as P } from './params.js';
import { SKY } from './sky.js';

// ───────── 원본 비교 패널 (개발 전용) ─────────
// 좌하단, 시점 패널 위에 쌓인다. **"이 작업 전에는 어떤 화면이었나" 를 한 번 눌러 되돌아가는 곳**이다.
// ⚠ 우측은 tweaks 패널이 화면 높이를 다 쓸 수 있어 겹친다 (실제로 겹쳤다).
//
// ⚠⚠ 사용자 지시 (2026-09-09) : *"혹시 모르니까 원래대로 돌아 갈 수 있는 패널도 만들고
//   앞으로 진행하는 루트는 모두 원래 값과 비교할 수 있는 패널을 추가하셈"*.
//   그래서 이 파일의 핵심은 UI 가 아니라 **아래 `BASELINES` 표**다 —
//   새 작업을 시작할 때 여기 한 줄을 먼저 적는다. 그게 롤백 지도의 실행 가능한 판본이다.
//
// ⚠ `tweaks` 의 [되돌리기] 와 다르다. 그쪽은 **페이지를 연 시점**으로 전부 되돌리는 것이고,
//   여기는 **작업 전 값**으로 묶음별로 오간다. 켠 채로 A/B 를 반복할 수 있어야 판정이 된다.
//
// ⚠ 되돌린 동안의 '지금 값' 은 `stash` 가 들고 있다가 다시 누르면 그대로 복원한다
//   (`tweaks.js` 의 층 끄기와 같은 패턴). 그래서 왕복해도 값을 잃지 않는다.
//
// ⚠⚠ **[원본] 값(values)의 키는 한 묶음만 잡는다** (2026-09-11 밤). '전부 원본' 은 모든 묶음이 각자 [원본] 에 있는지로
//   판정하므로, 두 묶음이 같은 키를 서로 다른 값으로 잡으면 **영영 '전부 원본 상태' 로 판정되지 않고** 두 번째 누름이 되돌리지 못한다
//   (v0.36.0 에서 '부표 발광'(markAlphaFar 1) · '부표 태양'(0.42)이 실제로 그랬다). 새 작업이 다른 묶음의 [원본] 키를 바꿔야 하면
//   그 키는 두고 **새 스위치**를 만들어 코드에서 건너뛴다 (markSunSolid 가 markAlphaFar 를 건너뛰는 것처럼). 시안(presets)끼리는 겹쳐도 된다.
//   검사 : 이 표를 읽어 [원본] 키가 두 묶음에 걸친 것을 찾는다 — 겹치는 키가 0 이어야 한다.
//   ⚠ 시안(presets)의 키는 그 묶음 values 키의 부분집합이어야 한다. values 밖의 키를 시안이 바꾸면 [원본] · 전부 원본이 그 키를 되돌리지 못한 채 원본으로 칠해진다 (v0.60 검토).
//     ⚠ 기존 묶음의 시안 310곳은 이 규칙 전에 만들어져 어긋난다 (v0.60 기준 — 고치지 않았다). 새 묶음부터 지킨다.

// ⚠⚠⚠ **여기 값은 "그 작업을 하기 전" 의 값이다.** 지금 params.js 의 값이 아니다.
//   ⚠ 하늘 값 셋은 `sky.js` 의 `SKY` 표에서 가져온다 — 숫자를 여기 또 적으면 갈라진다.
const BASELINES = [
  {
    name: '시점', hint: '2026-09-09 이전 구도. 수평선이 화면 위로 4.1% 벗어나 있었다',
    label: 'camPitch 23.1°',
    values: { camPitch: 23.1 }
  },
  {
    name: '하늘', hint: 'stage.js 이전 — 하늘을 안 그리던 화면 (배경색 #F6F5F2 플랫 하나)',
    label: '안 그림',
    values: { stageAmount: 0 }
  },
  {
    name: '하늘 값', hint: 'sky.js 의 SKY 표 그대로. 2026-09-06 에 반사용으로 정해진 값이다',
    label: '표 그대로',
    values: { skyBand: SKY.band, skyBroadA: SKY.broadA, skyZenith: SKY.zenith },
    // ⚠ 시안. 수치 근거는 `docs/무대와-존-연출.md` §14-3 (배경 246 대비 화면 맨 위)
    presets: [
      { label: 'A', hint: 'band 0.12 — 그라디언트를 화면에 보이는 6° 안으로. 맨 위 −4레벨',
        values: { skyBand: 0.12, skyBroadA: SKY.broadA, skyZenith: SKY.zenith } },
      { label: 'A+B', hint: 'A + 천정 #D2DCE8. 맨 위 −22.9레벨, 하늘 안 명암 폭 37',
        values: { skyBand: 0.12, skyBroadA: SKY.broadA, skyZenith: '#D2DCE8' } },
      { label: '+C', hint: 'A+B + 넓은 태양 무리 0.04. 맨 위 −29.8레벨. ⚠ 물의 빛 무리도 옅어진다',
        values: { skyBand: 0.12, skyBroadA: 0.04, skyZenith: '#D2DCE8' } }
    ]
  },
  {
    name: '시간대',
    hint: '2026-09-11 밤 — 사용자 : "밤바다 또는 저녁 시안 만들어봐". 기본은 **낮(종이) 그대로**다 — 시안만 붙였다. ' +
          '흰 종이 위에서는 부표 번짐이 더할 자리가 9 레벨뿐이라(v0.36.1) 바탕을 내린 화면을 본다. ' +
          '하늘 · 물 · 조명 · 암석 · 타이포 · 글자색이 한 번에 바뀐다 (CONFIG.times — 표 하나)',
    label: '낮 (종이)',
    values: { sceneTime: 0 },
    presets: [
      { label: '저녁', hint: '해 진 직후 — 수평선은 복숭아빛, 위로 갈수록 보랏빛 남색. 물은 차가운 보랏빛 회청 (배경만 따뜻하다 — 불변식)',
        values: { sceneTime: 1 } },
      { label: '밤', hint: '밤바다 — 남색 하늘 · 먹빛 물 · 달빛(푸른 흰빛) 반짝임 길. 부표 번짐이 물 위에 빛을 더할 자리가 가장 넓다',
        values: { sceneTime: 2 } }
    ]
  },
  {
    name: '부표 빛', hint: '2026-09-09 이전 — 발광 3.0 으로 날아가고, 해석적 반사가 발밑에 따로 맺혔고, IBL(0.35)이 하늘 방향으로 기울였다',
    label: 'glow 3.0 · 발밑',
    values: { markGlow: 3.0, markReflect: 0.45, markReflAnchor: 0, markEnv: 0.35, bloomRadius: 0.60, bloomAmount: 0.90 },
    presets: [
      { label: '자리만', hint: '밝기는 예전 그대로, 반사 자리만 평면 패스에 맞춘다',
        values: { markGlow: 3.0, markReflect: 0.45, markReflAnchor: 1, markEnv: 0.35, bloomRadius: 0.60, bloomAmount: 0.90 } },
      { label: '1.5', hint: '더 차분하게. 반사가 문턱을 거의 안 넘어 번짐이 거의 없다',
        values: { markGlow: 1.5, markReflect: 0, markReflAnchor: 1, markEnv: 0, bloomRadius: 0.60, bloomAmount: 0.90 } },
      { label: '은은', hint: 'glow 2.0 으로 문턱은 넘되 반경·세기를 낮춰 번짐을 거둔다',
        values: { markGlow: 2.0, markReflect: 0, markReflAnchor: 1, markEnv: 0, bloomRadius: 0.30, bloomAmount: 0.55 } },
      { label: '발광 3.0', hint: 'HalfFloat 로 바꾸면서 생긴 선택 — 부표와 반사가 같이 뿌옇게 빛난다',
        values: { markGlow: 3.0, markReflect: 0, markReflAnchor: 1, markEnv: 0, bloomRadius: 0.60, bloomAmount: 0.90 } }
    ]
  },
  {
    name: '부표 발광',
    hint: '2026-09-11 오후 이전 — 부표가 햇빛을 받은 쪽만 밝았고(알베도 그대로 · 방향광), 번짐은 **전역 블룸**(문턱 1.40)이라 ' +
          '햇빛 쪽이 문턱을 넘을 때만 조금 번졌다. 올리면 향조 색이 가운데부터 흰색으로 날아갔다 (7.0 에서 겪었다). ' +
          '지금은 부표가 스스로 빛나고(발광 + 시선 음영) **부표만 번지는 블룸**이 색을 지킨다 · 멀면 반투명, 배가 가까이 지날 때만 불투명',
    label: '햇빛 쪽만',
    values: { markSelfLit: 0, markBloom: 0, markAlphaFar: 1, markBlockAlpha: 1 },
    // ⚠ 시안의 값은 three.js unreal_bloom 예제의 GUI 와 같은 뜻이다 — threshold · strength · radius · exposure(= 발광원 세기)
    presets: [
      { label: '기본', hint: '✅ 지금 값 — 스스로 빛남 · 부표 블룸 (exposure 2.6 · strength 1.25 · radius 0.6) · 멀면 반투명',
        values: { markSelfLit: 1, markBloom: 1.25, markAlphaFar: 0.42, markBlockAlpha: 0.22, markBloomExposure: 2.6, markBloomRadius: 0.6, markGlowBody: 1.3, markBloomKnee: 0.6, markBloomCore: 0.85 } },
      { label: '은은', hint: 'exposure 1.6 · strength 1.0 · radius 0.55 — 번짐이 몸통 테두리에만 얇게',
        values: { markSelfLit: 1, markBloom: 1.0, markAlphaFar: 0.42, markBlockAlpha: 0.22, markBloomExposure: 1.6, markBloomRadius: 0.55, markGlowBody: 1.2, markBloomKnee: 0.6, markBloomCore: 0.85 } },
      { label: '강하게', hint: 'exposure 3.2 · strength 1.4 · radius 0.7 — 둘레가 향조 색 안개로 물든다. 촘촘한 해역(FLORAL)에서는 화면이 분홍빛이 된다',
        values: { markSelfLit: 1, markBloom: 1.4, markAlphaFar: 0.42, markBlockAlpha: 0.22, markBloomExposure: 3.2, markBloomRadius: 0.7, markGlowBody: 1.35, markBloomKnee: 0.6, markBloomCore: 0.85 } },
      { label: '불투명', hint: '발광·블룸은 기본 · 반투명만 끈다 (전부 불투명)',
        values: { markSelfLit: 1, markBloom: 1.25, markAlphaFar: 1, markBlockAlpha: 0.22, markBloomExposure: 2.6, markBloomRadius: 0.6, markGlowBody: 1.3, markBloomKnee: 0.6, markBloomCore: 0.85 } },
      { label: '번짐 없이', hint: '스스로 빛나기만 · 부표 블룸을 끈다',
        values: { markSelfLit: 1, markBloom: 0, markAlphaFar: 0.42, markBlockAlpha: 0.22, markBloomExposure: 2.6, markBloomRadius: 0.6, markGlowBody: 1.3, markBloomKnee: 0.6, markBloomCore: 0.85 } },
      // ⭐ 2026-09-11 밤 — 사용자가 준 three.js webgl_postprocessing_unreal_bloom_selective 예제의 값 그대로 (threejs.org 최신판에서 읽었다).
      //   예제 : threshold 0 · strength 1 · radius 0.5 · exposure 1 · 합성 base + bloom × strength (누르지 않고 물체 위에도 더한다).
      //   ⚠ 예제의 exposure 는 **화면 전체 톤 매핑**(NeutralToneMapping, toneMappingExposure = exposure⁴)이다 — 이 화면은 톤 매핑이 없어
      //     대응하는 값이 없다. 여기 markBloomExposure 는 발광원(쌍둥이 구)의 세기 배율이라 뜻이 다르다 → 2.6 그대로 둔다.
      //   ⚠⚠ 예제가 빛나 보이는 것은 **검은 배경** 덕이다 — 예제 화면 실측 : 분홍 구 몸통 251,150,204, 번짐이 테두리 밖에서
      //     190,87,153 → 35px 밖 123,77,128 (배경 0). 번짐이 120~190 레벨을 더할 자리가 있다. 흰 종이(246)는 9 레벨뿐이라
      //     같은 값이 이 화면에서는 **흰 원판**(태양 몸통) 또는 **분홍 풍선**(색 몸통)이 된다 (나란히 찍어 확인했다)
      { label: '예제 값', hint: 'three.js unreal_bloom_selective 예제 그대로 — threshold 0 · strength 1 · radius 0.5 · 번짐을 누르지 않고(knee 0) 몸통 위에도 더한다(core 0). ' +
          '⚠ 흰 종이 위에서는 몸통이 흰 원판이 된다 (예제는 검은 배경이라 번짐이 120~190 레벨을 더한다). 예제처럼 색 몸통으로 보려면 \'부표 태양\' [원본] 을 같이 누른다',
        values: { markSelfLit: 1, markBloom: 1.0, markAlphaFar: 0.42, markBlockAlpha: 0.22, markBloomExposure: 2.6, markBloomRadius: 0.5, markGlowBody: 1.3, markBloomThreshold: 0, markBloomKnee: 0, markBloomCore: 0 } }
    ]
  },
  {
    name: '부표 크기',
    hint: '2026-09-12 이전 — 부표가 전부 같은 크기(markScale 3.0 · 반지름 1.02 월드 = 배 길이의 40%)였다. ' +
          '사용자 : "인기 순위로 오브젝트 크기를 계산해서 나눠야함 … 지금 오브젝트들이 전체적으로 너무 큼". ' +
          '지금은 전체를 줄이고(2.0) 인기 순위(korea_selection_rank) 네 단계로 나눈다 — TOP 10 · 11~30 · 31~77(화해 편입분) · 78~200',
    label: '전부 3.0',
    values: { markScale: 3.0, markRankSize: 0 },
    presets: [
      { label: '기본', hint: '✅ 지금 값 — 전체 2.0 · 순위 네 단계 (1.00 · 0.80 · 0.64 · 0.50)', values: { markScale: 2.0, markRankSize: 1 } },
      { label: '조금 크게', hint: '전체 2.4 · 순위 네 단계', values: { markScale: 2.4, markRankSize: 1 } },
      { label: '더 작게', hint: '전체 1.6 · 순위 네 단계 — 78위 아래가 반지름 0.27 월드', values: { markScale: 1.6, markRankSize: 1 } },
      { label: '단계 없이', hint: '전체 2.0 · 모두 같은 크기 (순위 무시)', values: { markScale: 2.0, markRankSize: 0 } }
    ]
  },
  {
    name: '부표 누르기',
    hint: '2026-09-13 저녁 이전 — 히트박스가 월드 반지름 1.9 고정(0.95 × markScale)이라 순위 단계로 줄어든 몸통을 안 따라갔고 ' +
          '(가장 작은 부표에서 몸통의 5.6배), 겹치면 **카메라 쪽 것**이 잡혔다 (1440×780 실측 : 시실리 중심을 누르면 5번 중 4번 옆의 블루 탈리스만). ' +
          '사용자 : "부표 선택시에 겹쳐있는 경우 생각보다 클릭이 어렵군". 지금은 몸통 × 1.8 · 화면 최소 16px, 겹치면 커서가 올라간 몸통 → 가장자리가 가장 가까운 부표',
    label: '큰 구 · 앞의 것',
    values: { markHitFit: 0 },
    presets: [
      { label: '기본', hint: '✅ 지금 값 — 몸통 × 1.8 · 최소 16px', values: { markHitFit: 1, markHitK: 1.8, markHitMinPx: 16 } },
      { label: '조금 크게', hint: '몸통 × 2.2 · 최소 20px', values: { markHitFit: 1, markHitK: 2.2, markHitMinPx: 20 } },
      { label: '더 작게', hint: '몸통 × 1.5 · 최소 12px — 겹침은 가장 적고 먼 부표는 누르기 어려워진다', values: { markHitFit: 1, markHitK: 1.5, markHitMinPx: 12 } }
    ]
  },
  {
    name: '부표 이름표',
    hint: '2026-09-12 이전 — 향수 이름은 향수 고르기의 12개 **밑**에만 떴다. ' +
          '사용자 : "오브젝트 위에는 항상 작은 향수 이름이 떠있어야함". 지금은 보이는 부표 **전부의 위**에 작은 이름이 뜬다 — ' +
          '겹치면 인기 순위가 낮은 쪽이 비킨다(옅어진다)',
    label: '고르기에만',
    values: { markLabels: 0 },
    presets: [
      { label: '기본', hint: '✅ 지금 값 — 전부 위에 · 겹치면 순위 낮은 쪽이 비킨다', values: { markLabels: 1, markLabelDeclutter: 1 } },
      { label: '겹쳐도 전부', hint: '비키지 않는다 — 촘촘한 해역에서 글자가 포개진다', values: { markLabels: 1, markLabelDeclutter: 0 } }
    ]
  },
  {
    name: '한글 이름',
    hint: '2026-09-12 이전 — 이름표 · 카드가 CSV 의 영문 이름(Fragrantica) 그대로였다. ' +
          '사용자 : "영어로 향수 이름이 적혀있다면 한글로 다시 정확히 번역해서". 지금은 국내 판매명 표기(음역) — data/perfume_names_ko.csv',
    label: '영문',
    values: { markNameKo: 0 },
    presets: [{ label: '기본', hint: '✅ 지금 값 — 한글 판매명 · 카드에 영문 원명을 작게 같이', values: { markNameKo: 1 } }]
  },
  {
    name: '고르기 흩기',
    hint: '2026-09-12 이전 — 향수 고르기의 12개가 4칸 × 3줄 **격자**로 떴다. ' +
          '사용자 : "12개 나열식이 아니라 적당히 근처에 랜덤하게 잘 클릭할 수 있게 떠있어야함". ' +
          '지금은 같은 영역에 **흩어져** 뜬다 — 누른 향수마다 다른 배치(시드) · 서로 누르기 좋게 간격을 지킨다 · 깊이도 조금씩 다르다',
    label: '격자',
    values: { focusScatter: 0 },
    presets: [{ label: '기본', hint: '✅ 지금 값 — 흩어짐 · 이름표 폭만큼 간격', values: { focusScatter: 1 } }]
  },
  {
    name: '고르기 퍼짐',
    hint: '2026-09-12 오후 이전 — 흩기 영역이 화면 **오른쪽 절반**(가로 0.44~0.86)뿐이었다. 존 구도에서 배가 왼쪽 아래에 크게 앉아 ' +
          '그쪽을 통째로 비워 둔 값이다. 사용자 : *"화면에 좀 더 골고루 퍼져있어야함"*. ' +
          '지금은 화면 거의 전부(0.14~0.90)에 흩고, 대신 **배·돛 자리를 후보에서 뺀다** (미니맵 · 검색바와 같은 방식)',
    label: '오른쪽 절반',
    values: { focusScX0: 0.44, focusScX1: 0.86, focusScHiY: 6.2, focusScLoY: 1.8, focusAvoidBoat: 0 },
    presets: [
      { label: '기본', hint: '✅ 지금 값 — 가로 0.14~0.90 · 높이 6.8~1.5 · 배를 피한다',
        values: { focusScX0: 0.14, focusScX1: 0.90, focusScHiY: 6.8, focusScLoY: 1.5, focusAvoidBoat: 1 } },
      { label: '더 넓게', hint: '가로 0.06~0.95 · 높이 7.4~1.2 — 화면 끝까지 편다. 가장자리 이름표가 잘릴 수 있다',
        values: { focusScX0: 0.06, focusScX1: 0.95, focusScHiY: 7.4, focusScLoY: 1.2, focusAvoidBoat: 1 } },
      { label: '배 안 피하고', hint: '넓게 펴되 배를 안 피한다 — 돛 위에도 부표가 선다 (피하기의 몫을 보는 대조)',
        values: { focusScX0: 0.14, focusScX1: 0.90, focusScHiY: 6.8, focusScLoY: 1.5, focusAvoidBoat: 0 } }
    ]
  },
  {
    name: '배 비켜 넓게',
    hint: '2026-09-13 저녁 이전 — 깊이 배치의 왼쪽 줄기가 뒤로 물러나며 소실점 쪽, 곧 **배 바로 뒤로 모여** 부표가 배에 가렸다 ' +
          '(1440×780 실측 : 12개 중 셋이 배 상자 안 · 하나는 돛에 완전히 가림). 사용자 : "배가 부표를 가리지않도록 더 넓게 구성해야함". ' +
          '지금은 줄기를 배 기둥을 건너뛰어 좌우 빈 곳에 나눠 주고, 몸통·이름표가 배에 걸리면 배 반대쪽으로 민다 (부표를 다시 눌러야 보인다)',
    label: '배 뒤로 모임',
    values: { focusBoatClear: 0 },
    presets: [
      { label: '기본', hint: '✅ 지금 값 — 배 둘레 여유 28px · 영역 0.06~0.94',
        values: { focusBoatClear: 1, focusBoatPad: 28, focusDepthX0: 0.06, focusDepthX1: 0.94 } },
      { label: '더 띄우기', hint: '여유 56px — 배와 부표 사이를 두 배로 띄운다',
        values: { focusBoatClear: 1, focusBoatPad: 56, focusDepthX0: 0.06, focusDepthX1: 0.94 } },
      { label: '영역 예전', hint: '배는 비키되 영역은 예전(0.14~0.90) — 넓힌 몫을 보는 대조',
        values: { focusBoatClear: 1, focusBoatPad: 28, focusDepthX0: 0.14, focusDepthX1: 0.90 } }
    ]
  },
  {
    name: '인기 밝기',
    hint: '2026-09-12 오후 이전 — 부표 밝기가 인기 순위와 무관했다 (크기만 단계로 나뉘었다). ' +
          '사용자 : *"인기순서대로 밝게 표현"*. 크기와 **같은 표**(CONFIG.mark.rankTiers)의 밝기 배율을 불투명도에 곱한다. ' +
          '⚠ 흰 종이 위에서는 바탕보다 밝아질 수 없어(끝까지 L* 3.5) 실제로는 **순위가 낮을수록 옅어지는** 방향이다',
    label: '전부 같은 밝기',
    values: { markRankLight: 0 },
    presets: [
      { label: '기본', hint: '✅ 지금 값 — 1.00 · 0.86 · 0.72 · 0.60 (표 그대로)', values: { markRankLight: 1 } },
      { label: '은은', hint: '표의 절반만 — 차이가 옅다', values: { markRankLight: 0.5 } },
      { label: '세게', hint: '표의 1.6배 — 78위 아래가 거의 사라진다', values: { markRankLight: 1.6 } }
    ]
  },
  {
    name: '유사 연결선',
    hint: '2026-09-12 오후 — 새로 생겼다. 사용자 : *"제일 유사한 향수끼리 3개 4개를 연결하는 선이 이어졌으면"*. ' +
          '유사도는 **향 지도 좌표**(mx·my — CSV 가 준 그 좌표가 곧 유사도다)이고, 향수 고르기의 12개 안에서만 잇는다. ' +
          '가까운 것끼리 3~4개 **무리**로 묶어 무리 안에서만 이었다 (무리끼리는 안 잇는다 — 전부 이으면 그물이 된다)',
    label: '선 없음',
    values: { focusLinks: 0 },
    presets: [
      { label: '기본', hint: '✅ 지금 값 (2026-09-12 저녁) — 3~4개 무리 · 중앙값보다 먼 짝은 안 잇는다 · ' +
        '**발광색**(부표가 빛나는 그 색) · 굵기 3.6px · 진하기 0.85 · 후광 0.35 · 천천히 또렷이. ⚠ 굵기는 **1920×1080 에서** 고른 값이다',
        values: { focusLinks: 1, focusLinkMode: 0, focusLinkMax: 4, focusLinkCut: 1, focusLinkSrc: 1, focusLinkTint: 1,
                  focusLinkW: 3.6, focusLinkA: 0.85, focusLinkGrow: 0.30, focusLinkStep: 0.14, focusLinkSim: 0.45,
                  focusLinkGlow: 0.35, focusLinkGlowW: 1.9 } },
      { label: '누른 것 중심', hint: '무리 대신 **누른 향수**에서 가장 비슷한 넷으로 뻗는다 (별 모양)', values: { focusLinks: 1, focusLinkMode: 1, focusLinkMax: 4, focusLinkCut: 1 } },
      { label: '셋씩', hint: '무리 크기를 3 으로 — 무리가 더 많아지고 선이 짧다', values: { focusLinks: 1, focusLinkMode: 0, focusLinkMax: 3, focusLinkCut: 1 } },
      { label: '가까운 것만', hint: '문턱을 절반으로 (중앙값 × 0.5) — 정말 비슷한 짝만 남는다. 혼자인 향수가 늘어난다', values: { focusLinks: 1, focusLinkMode: 0, focusLinkMax: 4, focusLinkCut: 0.5 } },
      { label: '몸통색 (09-12 오후)', hint: '⚠ 예전 색 — 향조 색에 **알베도 0.22** 를 곱한 **몸통색**을 쓴다 (`focusLinkSrc` 0). ' +
        'CITRUS 가 #d4be2c 가 아니라 **#615932** 로 나가 아홉 향조가 전부 어두운 회갈색으로 뭉친다. 그래서 발광색으로 바꿨다',
        values: { focusLinkSrc: 0, focusLinkTint: 0.7, focusLinkW: 2.4, focusLinkA: 0.5 } },
      { label: '색 없이', hint: '2026-09-12 이전 — 시간대 색 하나 (양 끝이 같은 색이라 그라데이션이 없다)', values: { focusLinkTint: 0, focusLinkSrc: 0, focusLinkW: 1.6 } },
      { label: '더 굵게', hint: '5px — 1920 에서도 얇게 읽히면 여기부터. ⚠ 굵기는 CSS px 이라 창이 넓어질수록 상대적으로 얇아진다', values: { focusLinkW: 5 } },
      { label: '가늘게', hint: '2.4px — 09-12 오후의 값. 1920 폭에서는 실처럼 얇았다', values: { focusLinkW: 2.4 } },
      { label: '은은하게', hint: '진하기 0.5 — 09-12 오후의 값. 광선보다 먹선에 가깝다', values: { focusLinkA: 0.5 } },
      { label: '한꺼번에', hint: '2026-09-12 이전 동작 — 선이 **다 같이** 켜진다 (뻗는 모션 없음 · 유사도 차이 없음)', values: { focusLinkGrow: 0.01, focusLinkStep: 0, focusLinkSim: 0 } },
      { label: '빠르게 (09-12 오후)', hint: '변당 0.18s · 시차 0.07s — 저녁에 **천천히 또렷이** 로 바꾸기 전의 기본값', values: { focusLinkGrow: 0.18, focusLinkStep: 0.07, focusLinkSim: 0.55 } },
      { label: '아주 빠르게', hint: '변당 0.10s · 시차 0.04s — 후두둑 이어진다', values: { focusLinkGrow: 0.10, focusLinkStep: 0.04, focusLinkSim: 0.55 } },
      { label: '후광 없이', hint: '후광 한 겹을 통째로 뺀다 — v0.39.2 까지의 동작. 선은 그냥 선이다', values: { focusLinkGlow: 0 } },
      { label: '후광 짙게', hint: '본선 진하기의 60% 로 깔린다 — 광선이 두꺼워 보인다', values: { focusLinkGlow: 0.6 } },
      { label: '후광 넓게', hint: '후광 굵기를 본선의 2.8배로 — 심은 그대로인데 둘레가 넓게 퍼진다', values: { focusLinkGlowW: 2.8 } },
      { label: '후광 좁게', hint: '후광 굵기를 본선의 1.3배로 — 테두리를 얇게', values: { focusLinkGlowW: 1.3 } },
      { label: '색 빠짐 세게', hint: '덜 비슷한 짝의 채도를 더 뺀다 (0.8). ⚠ 흰색으로 날아가지는 않는다 — 회색이 될 뿐이다', values: { focusLinkSim: 0.8 } },
      { label: '색 빠짐 없이', hint: '유사도와 무관하게 **전부 같은 채도** — 어느 짝이 더 비슷한지는 화면에서 사라진다', values: { focusLinkSim: 0 } }
    ]
  },
  {
    name: '수면 움찔 (진단)',
    hint: '2026-09-12 저녁 — 사용자 : *"debugView 7 에서는 미세한 파동이 파도방향과는 다르게 움찔거린다"*. ' +
          '⚠⚠ **`debugView 7`(구역)을 켜고** 누른다. **무엇을 끄면 움찔거림이 사라지는지**로 범인을 가르는 묶음이다. ' +
          '이미 배제된 것 : 시각은 완벽 동기(`uTimeQ === sim.qT`, 증분 0/0.0334) · ' +
          '배 이동으로 인한 격자↔너울 어긋남은 0.002 월드 = **화면 0.03~0.06px** 로 육안 범위 밖이다. ' +
          '남은 후보 : 잔결 다섯이 **사방으로 흩어져**(방향이 전부 다르다) 30fps 스텝마다 위상이 **파장의 1.9~3.1%** 씩 튄다',
    label: '원본',
    values: { microA: 0.024, microB: 0.013, simFps: 30, boatFps: 30 },
    presets: [
      { label: '잔결 끔', hint: '잔결 진폭을 0 으로. **여기서 움찔거림이 사라지면 범인은 잔결이다.** ⚠ 물 표면이 밋밋해진다 — 진단용이다', values: { microA: 0, microB: 0 } },
      { label: '잔결 절반', hint: '진폭만 절반. 사라지진 않고 **약해지기만** 하면 역시 잔결이 관여한다는 뜻이다', values: { microA: 0.012, microB: 0.0065 } },
      { label: '⭐ 물만 60 (범인)', hint: '**`simFps` 만 60 · `boatFps` 는 30 그대로.** 2026-09-12 저녁 실측으로 **이것이 범인이었다** — ' +
        '화면은 160fps 로 그려지는데 물은 30fps 라 4프레임 중 3프레임이 **완전히 정지**해 있었다 (변화량 중앙값 **0**). ' +
        '60 으로 올리면 갱신 패턴이 `010101…` 로 규칙적이 되고 정지 프레임이 75% → 25%, 점프 크기가 **−36%** 다. ' +
        '⚠ `boatFps` 를 같이 올리지 않는 것이 요점이다 — 그쪽이 `sim.sampler()` 동기 리드백 빈도다 (불변식 11). 비용은 6.2 → 7.2ms',
        values: { simFps: 60, boatFps: 30 } },
      { label: '둘 다 60 (비쌈)', hint: '⚠ `boatFps` 까지 60 — 리드백이 2배가 된다. 움찔에는 도움이 안 되고 비용만 는다 (CLAUDE.md 조작 바 항목)', values: { simFps: 60, boatFps: 60 } },
      { label: '게이트 12/8 (원래 질감)', hint: 'CLAUDE.md 가 말하는 **의도된 컷아웃 질감**. 여기서 더 심해지면 게이트가 관여한다는 증거다', values: { simFps: 12, boatFps: 8 } }
    ]
  },
  {
    name: '배 표류',
    hint: '2026-09-12 저녁 — 사용자가 **배를 세웠다** (*"부표는 움직이면안댐 미세하게 자꾸 떠다님 … ' +
          '배가 움직인다면 배를 고정시키고"*). 배는 원점에 고정이고 **세상이 흐르는** 구조라, ' +
          '표류가 화면에서는 **부표가 떠다니는 것**으로 보인다 (실측 초당 0.133 월드). ' +
          '⚠ 방향키를 누르면 그대로 나아간다 — 멈춘 것은 **가만히 있을 때의 표류**뿐이다. ' +
          '⚠⚠ `driftSpeed` 가 아니라 **`driftCp`** 다 — 전자는 `clockUnified 0` 인 롤백 경로에서만 쓰인다',
    label: '원본 (흐름 0.06)',
    values: { driftCp: 0.06 },
    presets: [
      { label: '세움', hint: '✅ 지금 값 — `driftCp` 0. 가만히 두면 배가 제자리에 선다. ⚠ 항적과 뱃머리 거품이 거의 안 생긴다 (파도는 그대로 산다)', values: { driftCp: 0 } },
      { label: '아주 느리게', hint: '0.02 — 흐르긴 하는데 눈에 잘 안 띄는 정도', values: { driftCp: 0.02 } },
      { label: '빠르게', hint: '0.12 — 원본의 두 배. 바다가 확실히 흐른다', values: { driftCp: 0.12 } }
    ]
  },
  {
    name: '선택 링',
    hint: '2026-09-12 이전 — 고른 부표 **발밑 수면**에 얇은 원(RingGeometry)이 누웠다. ' +
          '불변식 17 이 *"선택 링만은 수면에 앉는다 — 그 간격이 높이를 읽게 하고 이 지점을 가리킨다"* 고 한 그것이다. ' +
          '⚠ 사용자 지시(2026-09-12)로 **껐다** — 이제 그 일은 유사 연결선이 한다',
    label: '링 있음',
    values: { markRing: 1 },
    presets: [
      { label: '옅게', hint: '지우지 않고 0.35 로 남긴다 — 높이 단서는 두고 존재감만 줄인다', values: { markRing: 0.35 } }
    ]
  },
  {
    name: '부표 모양',
    hint: '2026-09-11 밤 이전 — 10×7 분할 구 + flatShading (배와 같은 각진 결). 윤곽이 10각형이고 면마다 한 톤이었다. ' +
          '지금은 매끈한 구 — IcosahedronGeometry(분할 12) + 매끈한 음영 (three.js unreal_bloom_selective 예제와 같은 형태, 그쪽은 분할 15)',
    label: '각진 10×7',
    values: { markRound: 0 },
    presets: [{ label: '기본', hint: '✅ 지금 값 — 매끈한 구 (분할 12 · 300px 반지름에서 윤곽 오차 약 0.4px)', values: { markRound: 1 } }]
  },
  {
    name: '부표 태양',
    hint: '2026-09-11 밤 이전 (v0.34.0) — 몸통이 1 아래에서 향조 색을 지켰다. 가운데가 분홍(255,194,208 · 휘도 0.64)이라 ' +
          '흰 종이(0.91)보다 **어두웠고**, 멀면 반투명(0.42)이라 흰 하늘 위에서는 회색 유령이 됐다. ' +
          '지금은 가운데에 흰 빛이 얹혀 흰색으로 달아오르고 테두리에 향조 색이 남는다 (전등·태양처럼) · 반투명 없음',
    label: '색 공',
    // ⚠ [원본] 에 markAlphaFar 를 넣지 않는다 — '부표 발광' [원본] 이 이미 그 키를 1 로 잡고 있다 (머리 주석의 '키 겹침').
    //   태양의 반투명 없음은 markSunSolid 가 맡고, markSun 0 이면 v0.34.0 의 반투명(0.42)이 저절로 돌아온다
    values: { markSun: 0, markSunSolid: 1 },
    presets: [
      { label: '기본', hint: '✅ 지금 값 — 흰 빛 9 · 흰 심 반지름 0.40 · 향조 색 2.0 · 반투명 없음',
        values: { markSun: 1, markSunHot: 9, markSunEdge: 2.0, markSunCore: 0.40, markSunSolid: 1 } },
      { label: '은은', hint: '흰 빛 4 · 흰 심 0.28 — 흰 심이 작고 향조 색 몫이 크다',
        values: { markSun: 1, markSunHot: 4, markSunEdge: 1.6, markSunCore: 0.28, markSunSolid: 1 } },
      { label: '강하게', hint: '흰 빛 16 · 흰 심 0.60 — 흰 심이 몸통 대부분을 덮는다. 향조 색은 테두리와 번짐에만',
        values: { markSun: 1, markSunHot: 16, markSunEdge: 2.4, markSunCore: 0.60, markSunSolid: 1 } },
      { label: '반투명 유지', hint: '태양 기본 + v0.34.0 의 거리 반투명(markAlphaFar 0.42 · markGlowFar 0.6)',
        values: { markSun: 1, markSunHot: 9, markSunEdge: 2.0, markSunCore: 0.40, markSunSolid: 0 } }
    ]
  },
  {
    name: '배 그림자', hint: '2026-09-09 이전 — 배가 그림자를 드리우지 않았다 (boat.js 가 castShadow 를 명시적으로 껐다)',
    label: '없음',
    values: { boatShadow: 0 }
  },
  {
    name: '종이', hint: '2026-09-09 이전 — 텍스처가 하나도 없었고 배 전체가 한 가지 흰색이었다 (돛대도 묻혔다)',
    label: '맵·색 없음',
    values: { paperAmount: 0, paperShade: 0, paperVary: 0, metalAmount: 0 },
    presets: [
      { label: '결만', hint: '결은 있고 선실 색 단계는 끈다',
        values: { paperAmount: 1, paperScale: 7, boatNormal: 1.8, paperShade: 0, paperVary: 1 } },
      { label: '곱게', hint: '결이 고와 거의 안 보인다 (2026-09-09 첫 값)',
        values: { paperAmount: 1, paperScale: 14, boatNormal: 1.8, paperShade: 1, paperVary: 1 } },
      { label: '색 진하게', hint: '선실 색 단계를 1.3배로 — 안쪽이 더 짙어진다',
        values: { paperAmount: 1, paperScale: 7, boatNormal: 1.8, paperShade: 1.3, paperVary: 1 } },
      { label: '한 결', hint: '결을 흔지 않는다 — 배 전체가 한 장의 종이로 읽힌다',
        values: { paperAmount: 1, paperScale: 7, boatNormal: 1.8, paperShade: 1, paperVary: 0 } }
    ]
  },
  {
    name: '원경 페이드',
    hint: '[2단계] 이전 — 거리 페이드가 물 메시 밖(79/158)이라 24% 만 진행된 채 잘렸다. ' +
          '물끝이 한 픽셀에 22레벨 떨어지는 하드 엣지고, 그 경계가 정사각형이라 ∩ 아치가 35px 진다',
    label: '20/40 · 안 듦',
    values: { waterFade0: 20, waterFade1: 40 },
    // ⚠ 수치 근거는 `docs/무대와-존-연출.md` §19 (1280×720 · 파도 4상태 평균 · 수평선 y 108).
    //   ⚠ 아치는 어떤 값에서도 0 이 안 된다 — **아치 = 원경띠 × (좌÷중 − 1)** 이고
    //     좌÷중 은 원형에 가까워져도 1.09 아래로 안 내려간다. 더 내리면 띠가 넓어져 곱이 커진다
    presets: [
      { label: '12/24', hint: '✅ 지금 값 (2026-09-09 확정). 물끝 224 · 원경띠 116 · 아치 18 — ' +
                              '하드 엣지가 그라디언트로 바뀌는 지점이면서 띠를 116px 로 묶는다',
        values: { waterFade0: 12, waterFade1: 24 } },
      { label: '11/22', hint: '⭐ 아치 최소 14px. 물끝 234 · 원경띠 126 — 좌우 끝이 중앙의 1.08배로 거의 평평하다',
        values: { waterFade0: 11, waterFade1: 22 } },
      { label: '10/20', hint: '아치는 14px 로 같고 물끝이 247 까지 내려온다. 원경띠 139px — 원경이 들어갈 자리가 가장 넓다',
        values: { waterFade0: 10, waterFade1: 20 } },
      { label: '9/18', hint: '⚠ 아치가 다시 19 로 커지고 흔들림이 10px 로 뛴다. 부표 순서가 뒤집히는 9.6 에 붙어 있다',
        values: { waterFade0: 9, waterFade1: 18 } }
    ]
  },
  {
    name: '원경 안개',
    hint: '[3단계] 이전 — 물이 사라진 자리를 배경색(#F6F5F2) 하나로 칠했다. 하늘이 태양 로브 때문에 249~250 이라 ' +
          '물 메시가 하늘 위에 3레벨 어두운 판으로 떠 있었고, 그 경계가 정사각형이라 좌우로 44px 출렁였다',
    label: '배경색으로',
    values: { waterFadeSky: 0 }
  },
  {
    name: '연출',
    hint: '[4단계] 이전 — 상태머신이 없었다. phaseAmount 0 이면 cue 가 전부 0 에 고정되고 ' +
          'enter/leave 를 불러도 아무 값도 안 흐른다 (지금은 소비자가 없어 화면은 어차피 같다)',
    label: '상태머신 없음',
    values: { phaseAmount: 0 },
    presets: [
      { label: '¼배속', hint: '전환을 4배 느리게 — 값이 흐르는 것을 눈으로 따라갈 수 있다',
        values: { phaseAmount: 1, phaseSpeed: 0.25 } },
      { label: '½배속', hint: '2배 느리게',
        values: { phaseAmount: 1, phaseSpeed: 0.5 } },
      { label: '제속도', hint: '§3 표 그대로 (진입 1.20s · 퇴장 1.30s)',
        values: { phaseAmount: 1, phaseSpeed: 1 } }
    ]
  },
  {
    name: '존 구도',
    hint: '[5단계] 이전 — 존 구도가 항해 구도와 같았다 (전환해도 카메라가 안 움직인다). ' +
          '⚠ 이 [원본] 은 화면을 안 바꾼다. sailing 상태에서는 어차피 항해 구도이기 때문이다 — ' +
          'PB.phase.snap("inspecting") 으로 존 상태에 고정하고 눌러야 차이가 보인다',
    label: '항해와 같음',
    values: { zoneYaw: -52.1, zonePitch: 15.4, zoneDist: 3.96 },
    // ⚠⚠ camYaw 는 **음수를 유지한다** — 불변식 0-4 : 양수면 카메라가 배의 그늘진 쪽에 선다
    // ⭐ zoneLookX/Y 는 배를 화면 한쪽으로 미는 값이다. 0/0 이면 배가 정중앙 (09-10 이전 동작)
    presets: [
      { label: '기본', hint: '배가 왼쪽 아래에 크게 — 사용자가 화면 보고 고른 값 (09-10)',
        values: { zoneYaw: -30, zonePitch: 9.0, zoneDist: 2.4, zoneLookX: 0.30, zoneLookY: 0.35 } },
      { label: '한가운데', hint: '09-10 이전 구도 — 배가 정중앙, 멀다. 밋밋해서 바꾼 그 화면이다',
        values: { zoneYaw: -30, zonePitch: 9.0, zoneDist: 4.6, zoneLookX: 0, zoneLookY: 0 } },
      { label: '더 극적', hint: 'dist 2.0 · 더 아래로. 돛대가 화면을 뚫고 올라간다',
        values: { zoneYaw: -30, zonePitch: 9.0, zoneDist: 2.0, zoneLookX: 0.30, zoneLookY: 0.45 } },
      { label: '정면', hint: 'yaw −12 로 거의 정면. ⚠ 돛이 옆날로 설 수 있다 (불변식 0-4)',
        values: { zoneYaw: -12, zonePitch: 9.0, zoneDist: 2.4, zoneLookX: 0.30, zoneLookY: 0.35 } }
    ]
  },
  {
    name: '좌우 윙',
    hint: '[7단계] 이전 — 좌우 암석이 없었다. ⚠ sailing 에서는 cue.openL/openR 이 0 이라 어차피 안 보인다 — PB.phase.snap("inspecting","woody") 으로 고정하고 눌러야 차이가 보인다',
    label: '없음',
    values: { gateAmount: 0 },
    presets: [
      { label: '기본', hint: '거리 16 · 폭 화면의 58% · 아래로 0.06 — 사용자가 화면 보고 고른 값 (09-10)',
        values: { gateAmount: 1, gateDist: 16, gateWidth: 0.58, gateDrop: 0.06, gateOpacity: 1 } },
      { label: '작게', hint: '폭 0.45 — 아래 모서리에만 걸린다. 바다는 넓지만 프레임이 아니라 장식이 된다',
        values: { gateAmount: 1, gateDist: 16, gateWidth: 0.45, gateDrop: 0.06, gateOpacity: 1 } },
      { label: '크게', hint: '폭 0.70 — 아래쪽 시야가 좁아진다. ⚠ 레퍼런스 실측은 0.85 였는데 화면에선 과했다',
        values: { gateAmount: 1, gateDist: 16, gateWidth: 0.70, gateDrop: 0.06, gateOpacity: 1 } },
      { label: '가깝게', hint: '거리 8 — 판이 커지고 마우스 패럴랙스([8단계])가 세진다',
        values: { gateAmount: 1, gateDist: 8, gateWidth: 0.58, gateDrop: 0.06, gateOpacity: 1 } },
      { label: '아래로', hint: 'drop 0.22 — 암석이 화면 밑으로 내려가 수평선 쪽이 열린다',
        values: { gateAmount: 1, gateDist: 16, gateWidth: 0.58, gateDrop: 0.22, gateOpacity: 1 } }
    ]
  },
  {
    name: '마우스 패럴랙스',
    hint: '[8단계] 이전 — 마우스를 움직여도 화면이 안 따라왔다. ⚠ 존에서만 걸린다 (cue.look 을 곱한다) — ' +
          'PB.phase.snap("inspecting","woody") 으로 고정하고 마우스를 움직여야 차이가 보인다',
    label: '없음',
    values: { parallaxAmount: 0 },
    presets: [
      { label: '기본', hint: '카메라가 0.35 월드까지 평행이동 · 따라가기 0.08',
        values: { parallaxAmount: 0.35, parallaxEase: 0.08 } },
      { label: '약하게', hint: '0.18 — 있는 듯 없는 듯. 깊이는 살고 어지럽지 않다',
        values: { parallaxAmount: 0.18, parallaxEase: 0.08 } },
      { label: '세게', hint: '0.7 — 깊이가 확실해진다. ⚠ 판이 그만큼 밀리므로 가장자리 여유도 같이 커진다',
        values: { parallaxAmount: 0.7, parallaxEase: 0.08 } },
      { label: '즉시', hint: 'ease 1 — 스무딩 없이 손을 그대로 따라간다. ⚠ 손떨림이 화면에 나온다 (측정용)',
        values: { parallaxAmount: 0.35, parallaxEase: 1 } }
    ]
  },
  {
    name: '수면 타이포',
    hint: '[6단계] 이전 — 향조 이름이 없었다. ⚠ sailing 에서는 cue.rise 가 0 이라 어차피 안 보인다 — ' +
          'PB.phase.snap("inspecting","woody") 으로 고정하고 눌러야 차이가 보인다',
    label: '없음',
    values: { titleAmount: 0 },
    // ⚠ 크기·자간은 아래 '타이포 크기' 행으로 옮겼다 (2026-09-11). 여기는 **자리**의 시안이다.
    //   예전 '크게'(폭 96)는 지금 기본(100)보다 작아져서 뺐다
    // ⚠⚠ 2026-09-11 오후 : titleWidth 는 이제 **거리 82 에서의 폭**이다 (title.js REF_DIST) — 거리를 바꿔도
    //   화면 크기가 그대로다. 그래서 예전에 월드 폭으로 적었던 '멀리'(95 · 80) · '깊이 잠기게'(70 · 59) 는
    //   **같은 화면 크기가 되도록** 82 기준으로 옮겨 적었다 (80 × 82/95 = 69 · 59 × 82/70 = 69)
    presets: [
      { label: '기본', hint: '✅ 지금 값 (09-11 오후) — 거리 43 (물끝 안쪽) · 폭 95 (화면의 76.5%) · 밑동이 0.1 만큼 잠긴다',
        values: { titleAmount: 1, titleDist: 43, titleWidth: 95, titleLift: -0.10, titleSoft: 0.45 } },
      { label: '멀리', hint: '거리 95 — 물끝 바깥이라 흰 안개 위에 선다 (첫 기본값이었다)',
        values: { titleAmount: 1, titleDist: 95, titleWidth: 69, titleLift: 0, titleSoft: 0.35 } },
      { label: '파도 타기', hint: 'followWave 1 — 글자가 너울을 탄다 (09-10 이전 동작). ⚠ 출렁여서 읽기 어렵다',
        values: { titleAmount: 1, titleDist: 43, titleWidth: 95, titleLift: -0.10, titleSoft: 0.45, titleFollowWave: 1 } },
      { label: '깊이 잠기게', hint: 'lift −0.18 · soft 0.6 — 물에서 막 나온 것처럼 보인다',
        values: { titleAmount: 1, titleDist: 43, titleWidth: 69, titleLift: -0.18, titleSoft: 0.6 } }
    ]
  },
  {
    name: '타이포 자리',
    hint: '2026-09-11 오후 이전 — 거리 82. zoneDist 가 4.6 → 2.4 로 당겨지며 물끝(24 × kD)이 57.6 월드가 됐는데 ' +
          '글자는 그 24 월드 바깥에 남아 **흰 안개 띠 위에** 섰다 (§24-10). 지금은 물끝 안쪽이다 (사용자 결정 ②). ' +
          '⚠ sailing 에서는 안 보인다 — PB.phase.snap("inspecting","WOODY") 로 고정하고 눌러야 차이가 보인다',
    label: '82 · 물끝 바깥',
    values: { titleDist: 82, titleReflect: 1 },
    // ⚠ 폭은 안 건드린다 — 거리 82 기준 폭이라 거리만 바꿔도 화면 크기가 같다 (title.js REF_DIST)
    // ⚠ 반사 세기(titleReflect)를 같이 묶는다 — 당기자 비친 글자가 큰 먹 글씨 띠로 드러나서 같이 들어온 값이다
    presets: [
      { label: '기본', hint: '✅ 지금 값 — 43 · 반사 0.35. 물이 반쯤 옅어지는 자리 (존의 물 페이드 28.8 → 57.6). 밑동이 파도 뒤로 들고 난다',
        values: { titleDist: 43, titleReflect: 0.35 } },
      { label: '반사 그대로', hint: '43 · 반사 1 — 비친 글자가 배와 같은 세기. 뒤집힌 글씨가 수면에 크게 깔린다',
        values: { titleDist: 43, titleReflect: 1 } },
      { label: '더 가까이', hint: '36 — 물이 더 진하다 (페이드 25%). ⚠ 배(≈23)와 13 월드 차라 시차가 커진다',
        values: { titleDist: 36, titleReflect: 0.35 } },
      { label: '물끝', hint: '55 — 물이 거의 다 사라지는 자리. 안개 띠가 얇게 남는다',
        values: { titleDist: 55, titleReflect: 0.35 } }
    ]
  },
  {
    name: '타이포 크기',
    hint: '2026-09-11 이전 — 폭 85 (글자가 화면의 68%) · 자간 0.10. ⚠ sailing 에서는 안 보인다 — ' +
          'PB.phase.snap("inspecting","woody") 으로 고정하고 눌러야 차이가 보인다',
    label: '85 · 0.10',
    values: { titleWidth: 85, titleSpacing: 0.10 },
    // ⚠ 자간을 좁히면 글자가 **저절로 커진다** — 굽기가 글자 줄을 캔버스 폭에 맞추기 때문이다
    //   (params.js 의 titleSpacing 주석). '좁게만' 이 조금 커 보이는 것은 정상이다
    // ⚠⚠ 위로는 우측 정보 블록(노트 줄)이 천장이다 — 간격 실측표는 params.js 의 titleWidth 주석
    presets: [
      { label: '기본', hint: '✅ 지금 값 (09-11) — 폭 95 · 자간 0.04. 글자 높이 +19% · 노트 줄과 15px (1440×731)',
        values: { titleWidth: 95, titleSpacing: 0.04 } },
      { label: '더 크게', hint: '폭 100 · 자간 0.04 — 글자 높이 +25%. ⚠ 1440×731 에서 Y 가 노트 줄 6px 밑까지 올라온다',
        values: { titleWidth: 100, titleSpacing: 0.04 } },
      { label: '크게만', hint: '폭 95 · 자간 0.10 그대로',
        values: { titleWidth: 95, titleSpacing: 0.10 } },
      { label: '좁게만', hint: '폭 85 그대로 · 자간 0.04 — 그래도 글자가 5.9% 커진다',
        values: { titleWidth: 85, titleSpacing: 0.04 } },
      { label: '자간 0', hint: '폭 95 · 자간 0 — 글자가 거의 붙는다',
        values: { titleWidth: 95, titleSpacing: 0 } }
    ]
  },
  {
    name: '타이포 천장',
    hint: '2026-09-11 오후 이전 — 글자가 화면 **폭**만 따라 커져서, 넓고 낮은 창(1366×650)에서는 우측 정보 블록의 노트 줄을 덮었다 (−21px). ' +
          '지금은 글자 꼭대기가 정보 블록 아래끝 + 18px 을 못 넘는다 — 밑동은 수면에 그대로 두고 글자가 작아진다. ' +
          '⚠ sailing 에서는 안 보인다 — PB.phase.snap("inspecting","WOODY") 로 고정하고 창 높이를 바꿔 본다',
    label: '천장 없음',
    values: { titleCeil: 0 },
    presets: [{ label: '기본', hint: '✅ 지금 값 — 정보 블록 아래끝 + 18px', values: { titleCeil: 1 } }]
  },
  {
    name: '천장과 마우스',
    hint: '2026-09-14 이전 — 존 연출에서 마우스를 위아래로 움직이면(특히 하늘 쪽) 수면 글자가 작아졌다 커졌다 했다 (1196×627 에서 마우스 세로 +1 이면 0.30 배). ' +
          '사용자 : "연출 장면 폰트 있을때 왜 마우스를 하늘에 있는 마우스위치에 따라 작아지고 커지는거지? 그거 없애야함". ' +
          '원인은 천장 풀이가 패럴랙스로 옮기기 전의 카메라 행렬과 옮긴 뒤의 카메라 위치를 섞어 쓴 것이다. 지금은 패럴랙스 전 카메라로 풀어 크기가 마우스와 무관하다 ' +
          '(글자 자리의 패럴랙스는 그대로). ⚠ 천장이 걸리는 창(낮은 창)에서 존에 들어가 마우스를 하늘 쪽으로 올려 본다',
    label: '마우스 따라 크기',
    values: { titleCeilBase: 0 },
    presets: [{ label: '기본', hint: '✅ 지금 값 — 패럴랙스 전 카메라로 크기를 정한다', values: { titleCeilBase: 1 } }]
  },
  {
    name: '반응형',
    hint: '2026-09-11 오후 이전 — 검색바 520px · 정보 블록 300px · 미니맵 236px 이 **px 고정**이라 작은 창에서 서로 겹치고 ' +
          '휴대폰 폭에서는 화면 밖으로 나갔다. 지금은 창 폭·높이 단계마다 크기와 여백이 줄어든다 (index.html 의 CSS 변수)',
    label: '고정 px',
    values: { uiResponsive: 0 },
    presets: [{ label: '기본', hint: '✅ 지금 값 — 1280 · 1024 · 760 폭 / 700 · 560 높이 단계', values: { uiResponsive: 1 } }]
  },
  {
    name: '그라데이션',
    hint: '2026-09-11 이전 — 글자가 위아래로 균일한 색이었다. 지금은 밑동이 옅고 위로 갈수록 짙다 (알파). ' +
          '⚠ sailing 에서는 안 보인다 — PB.phase.snap("inspecting","woody") 으로 고정하고 눌러야 차이가 보인다',
    label: '균일',
    values: { titleGrad: 0, titleGradEnd: 0.85 },
    presets: [
      { label: '기본', hint: '✅ 지금 값 — 밑동 30% 에서 글리프 높이 85% 지점까지 짙어진다',
        values: { titleGrad: 0.7, titleGradEnd: 0.85 } },
      { label: '약하게', hint: '밑동 60% — 그라데이션이 있는 듯 없는 듯',
        values: { titleGrad: 0.4, titleGradEnd: 0.85 } },
      { label: '세게', hint: '밑동 10% · 꼭대기까지 — 글자가 안개에서 솟는 것처럼 보인다',
        values: { titleGrad: 0.9, titleGradEnd: 1.0 } },
      { label: '밑동만', hint: '글리프 아래 45% 에서만 옅어지고 윗부분은 균일하다',
        values: { titleGrad: 0.8, titleGradEnd: 0.45 } }
    ]
  },
  {
    name: '향수 지도',
    hint: '2026-09-11 이전 — 더미 향수 32개를 88×88 타일에 흩뿌려 토러스로 끝없이 되풀이했다 (어디서나 12개 남짓). ' +
          '⚠ 지도 전체는 항공뷰에서 본다 (PB.params.topView = true · topSize 300) — 거기서는 거리 페이드가 꺼진다',
    label: '더미 32 · 토러스',
    values: { markMap: 0 },
    presets: [
      { label: '기본', hint: '✅ 지금 값 — 가로 320 월드. 무리 안은 예전만큼 차고 무리 사이는 빈 바다',
        values: { markMap: 1, mapSize: 320, mapCount: 200 } },
      { label: '촘촘', hint: '가로 240 — 무리 안이 빽빽하다 (겹침 풀기가 더 많이 민다)',
        values: { markMap: 1, mapSize: 240, mapCount: 200 } },
      { label: '넓게', hint: '가로 420 — 무리 안에서도 부표가 드문드문하다. 더 큰 바다',
        values: { markMap: 1, mapSize: 420, mapCount: 200 } },
      { label: '편입분만', hint: '가로 320 · 화해 지도 편입분 77개만 (순위 1~77)',
        values: { markMap: 1, mapSize: 320, mapCount: 77 } }
    ]
  },
  {
    name: '도착 연출',
    hint: '2026-09-11 이전 — 도착하면 존 연출이 ESC 를 누를 때까지 머물렀다. 지금은 몇 초 뒤 스스로 걷힌다 ' +
          '(사용자 : "해당 영역에 도착하면 좌우 연출이 시작되고 몇초 후 사라지게")',
    label: 'ESC 까지',
    values: { zoneHold: 0 },
    presets: [
      { label: '기본', hint: '✅ 지금 값 (09-11 오후) — 5초 머문다 (들어오는 2.0초 · 나가는 1.9초는 따로). 사용자 : "5초 뒤에는 걷히게"',
        values: { zoneHold: 5 } },
      { label: '3.5', hint: 'v0.32.0 의 값 — 3.5초', values: { zoneHold: 3.5 } },
      { label: '짧게', hint: '2초', values: { zoneHold: 2 } },
      { label: '길게', hint: '8초', values: { zoneHold: 8 } }
    ]
  },
  {
    name: '호버 머묾',
    hint: '2026-09-11 오후 이전 (v0.32.0) — 정보 블록에 마우스를 올려도 시간이 흘러 읽는 도중에 걷혔다. ' +
          '지금은 올려 둔 동안 멈추고, 떼면 최소 1.5초를 남기고 다시 흐른다 (사용자 : "마우스를 올린 동안에는 머물게"). ' +
          '⚠ 도착 연출에만 걸린다 — PB.phase.enter("WOODY", { hold: 5 }) 로 확인한다',
    label: '호버 무시',
    values: { zoneHoldHover: 0 },
    presets: [{ label: '기본', hint: '✅ 지금 값 — 우측 정보 블록 · 좌하단 존 표시에 올려 둔 동안 멈춘다', values: { zoneHoldHover: 1 } }]
  },
  {
    name: '먼 곳 이동',
    hint: '2026-09-11 이전 — 목표까지 끝까지 항해했다 (지도 가로 320 을 부스트로 3분). ' +
          '지금은 1.2초 달려 보고 못 닿으면 흰 안개가 덮이고 목표 앞에 선다',
    label: '끝까지 항해',
    values: { travelFog: 0 },
    presets: [
      { label: '기본', hint: '✅ 지금 값 — 1.2초 달린 뒤 안개 0.6초 · 걷힘 0.9초', values: { travelFog: 1, travelLead: 1.2, travelFogIn: 0.6, travelFogOut: 0.9 } },
      { label: '바로', hint: '0.3초만 달리고 곧장 안개', values: { travelFog: 1, travelLead: 0.3, travelFogIn: 0.6, travelFogOut: 0.9 } },
      { label: '느긋이', hint: '2초 달리고 안개도 천천히 (1.0 · 1.4초)', values: { travelFog: 1, travelLead: 2.0, travelFogIn: 1.0, travelFogOut: 1.4 } }
    ]
  },
  {
    name: '연출 중 떠나기 (카드 · 검색)',
    hint: '2026-09-14 이전 — 존 연출 중에 부표 카드의 "이 향의 해역으로" 나 검색창으로 떠나면 퇴장 연출과 먼 곳 이동의 달리기가 같이 시작했다 ' +
          '(들어오는 중이면 퇴장도 못 하고 달리기만 시작했다). 사용자 : "카드랑 검색도 연출이 끝나고 출발하게". ' +
          '지금은 남은 머묾을 버리고 퇴장 연출을 처음부터 재생한 뒤, 다 걷히면 떠난다 — 들어오는 중이면 다 들어온 순간 곧장 퇴장한다. ' +
          '보려면 존에 머무는 동안 검색창에 다른 향조를 친다',
    label: '바로 달리기',
    values: { travelAfterZone: 0 },
    presets: [{ label: '기본', hint: '✅ 지금 값 — 연출이 다 걷힌 뒤 이동', values: { travelAfterZone: 1 } }]
  },
  {
    name: '감속 관성',
    hint: '2026-09-14 이전 — 배가 멈출 때(바다 누르기 도착 · 방향키를 뗌 · ↓ 제동) 가속과 같은 빠르기로 감속해 속도가 빠르게 0 으로 떨어졌다 ' +
          '(프레임당 0.04 라 120fps 에서 5% 까지 0.61초). 사용자 : "출발하는 속도는 빨라도 멈췄을때는 급브레이크를 잡아도 제동이 관성에의해 미끄러지듯이 … 지금보다는 천천히 감속되게". ' +
          '지금은 감속만 시간 상수 0.8초로 미끄러진다 (5% 까지 약 2.4초 · 화면 주사율과 무관). 가속은 그대로. 보려면 ↑ 로 달리다 뗀다',
    label: '빠른 감속',
    values: { speedGlide: 0 },
    presets: [
      { label: '기본', hint: '✅ 지금 값 — 시간 상수 0.8초 (5% 까지 약 2.4초)', values: { speedGlide: 1, speedGlideTau: 0.8 } },
      { label: '조금만', hint: '0.45초 — 5% 까지 약 1.3초', values: { speedGlide: 1, speedGlideTau: 0.45 } },
      { label: '더 미끄럽게', hint: '1.4초 — 5% 까지 약 4.2초', values: { speedGlide: 1, speedGlideTau: 1.4 } }
    ]
  },
  {
    name: '바다 누르기',
    hint: '2026-09-13 밤 이전 (v0.57.0) — 빈 바다로 가려면 Shift 를 누른 채 눌러야 했고, 그냥 누르면 선택만 놓았다. ' +
          '사용자 : "뭔가 착각한 것 같은데 마우스로 일반 화면 영역을 클릭하면 그 곳으로 움직이는 설정하게 해줘 클릭했을때 움직이면 shift 가속상태로". ' +
          '지금은 Shift 없이 빈 바다를 누르기만 해도 그 자리로 부스트 속도로 간다 (Shift 를 눌러도 같다 · 끌기는 누름이 아니다 · 하늘을 누르면 예전처럼 선택만 놓는다). ' +
          '제자리에서 선택만 놓으려면 ESC · 카드 ×',
    label: 'Shift 를 눌러야',
    values: { seaClickGo: 0 },
    presets: [{ label: '기본', hint: '✅ 지금 값 — 누르면 그 자리로 부스트 항해', values: { seaClickGo: 1 } }]
  },
  {
    name: '누른 자리 화살표',
    hint: '2026-09-13 밤 이전 (v0.58.0) — 바다를 눌러도 누른 자리에 아무 표시가 없었다 (가는 곳은 미니맵에만). ' +
          '사용자 : "눌렸을때 화살표가 바다와 각도가 수평으로 게임에서 가고있다는 애니메이션 … 밝은 노란색으로". ' +
          '네 번째 설명 : "하나를 좁게 U자 형태가 위아래 뒤집혀지게 다이빙을 그리듯이 지나가는데 … 패스 처음 값에는 화살표가 있고 … 패스 끝값이 화살표를 ' +
          '따라가다가 어느 짧은 특정 길이에서 끝나며 한점으로 빨려가듯이" (앞의 곧은 화살은 "작살이 던지듯이" 이상했다). ' +
          '지금은 누른 자리에 고리와 점이 뜨고, 대각선 네 방향의 수면에서 촉이 좁은 ∩ 길을 달리고 짧은 꼬리가 따라가다 점으로 빨려 든다 ' +
          '(약 0.54초 한 번 · 저녁은 밝은 금빛을 더한다). 보려면 빈 바다를 누른다',
    label: '표시 없음',
    values: { seaMark: 0 },
    presets: [
      { label: '기본', hint: '✅ 지금 값 — 원근 · 빠르기 1.3 (0.54초) · 대각선 · 반지름 2.6 · 높이 0.9 · 꼬리 0.4 · 굵기 0.12 · 고리',
        values: { seaMark: 1, seaMarkPersp: 1, seaMarkDur: 0.7, seaMarkSpeed: 1.3, seaMarkDiag: 1, seaMarkSize: 2.6, seaMarkArc: 0.9, seaMarkTrail: 0.4, seaMarkWidth: 0.12, seaMarkDot: 1 } },
      { label: '같은 크기', hint: '먼 바다를 눌러도 화면 크기가 같다 (원근 적용 전)',
        values: { seaMark: 1, seaMarkPersp: 0, seaMarkFar: 1, seaMarkDur: 0.7, seaMarkSpeed: 1.3, seaMarkDiag: 1, seaMarkSize: 2.6, seaMarkArc: 0.9, seaMarkTrail: 0.4, seaMarkWidth: 0.12, seaMarkDot: 1 } },
      { label: '높이 1.15', hint: '길 높이 1.15 — 이번에 낮추기 전',
        values: { seaMark: 1, seaMarkPersp: 1, seaMarkDur: 0.7, seaMarkSpeed: 1.3, seaMarkDiag: 1, seaMarkSize: 2.6, seaMarkArc: 1.15, seaMarkTrail: 0.4, seaMarkWidth: 0.12, seaMarkDot: 1 } },
      { label: '더 낮게', hint: '길 높이 0.6 — 수면을 스치듯 넘는다',
        values: { seaMark: 1, seaMarkPersp: 1, seaMarkDur: 0.7, seaMarkSpeed: 1.3, seaMarkDiag: 1, seaMarkSize: 2.6, seaMarkArc: 0.6, seaMarkTrail: 0.4, seaMarkWidth: 0.12, seaMarkDot: 1 } },
      { label: '십자 방향', hint: '화면 좌우 · 앞뒤에서 온다',
        values: { seaMark: 1, seaMarkPersp: 1, seaMarkDur: 0.7, seaMarkSpeed: 1.3, seaMarkDiag: 0, seaMarkSize: 2.6, seaMarkArc: 0.9, seaMarkTrail: 0.4, seaMarkWidth: 0.12, seaMarkDot: 1 } },
      { label: '긴 꼬리', hint: '꼬리 0.6 — 길의 절반 넘게 따라온다',
        values: { seaMark: 1, seaMarkPersp: 1, seaMarkDur: 0.7, seaMarkSpeed: 1.3, seaMarkDiag: 1, seaMarkSize: 2.6, seaMarkArc: 0.9, seaMarkTrail: 0.6, seaMarkWidth: 0.12, seaMarkDot: 1 } },
      { label: '짧은 꼬리', hint: '꼬리 0.25 — 촉 뒤에 짧게',
        values: { seaMark: 1, seaMarkPersp: 1, seaMarkDur: 0.7, seaMarkSpeed: 1.3, seaMarkDiag: 1, seaMarkSize: 2.6, seaMarkArc: 0.9, seaMarkTrail: 0.25, seaMarkWidth: 0.12, seaMarkDot: 1 } },
      { label: '굵게', hint: '굵기 0.2',
        values: { seaMark: 1, seaMarkPersp: 1, seaMarkDur: 0.7, seaMarkSpeed: 1.3, seaMarkDiag: 1, seaMarkSize: 2.6, seaMarkArc: 0.9, seaMarkTrail: 0.4, seaMarkWidth: 0.2, seaMarkDot: 1 } },
      { label: '조금 느리게', hint: '빠르기 1 (0.7초)',
        values: { seaMark: 1, seaMarkPersp: 1, seaMarkDur: 0.7, seaMarkSpeed: 1, seaMarkDiag: 1, seaMarkSize: 2.6, seaMarkArc: 0.9, seaMarkTrail: 0.4, seaMarkWidth: 0.12, seaMarkDot: 1 } },
      { label: '느리게', hint: '빠르기 0.7 (1.0초) — 길을 따라가는 것이 눈에 잘 들어온다',
        values: { seaMark: 1, seaMarkPersp: 1, seaMarkDur: 0.7, seaMarkSpeed: 0.7, seaMarkDiag: 1, seaMarkSize: 2.6, seaMarkArc: 0.9, seaMarkTrail: 0.4, seaMarkWidth: 0.12, seaMarkDot: 1 } },
      { label: '고리 없이', hint: '고리 · 점을 빼고 줄기만',
        values: { seaMark: 1, seaMarkPersp: 1, seaMarkDur: 0.7, seaMarkSpeed: 1.3, seaMarkDiag: 1, seaMarkSize: 2.6, seaMarkArc: 0.9, seaMarkTrail: 0.4, seaMarkWidth: 0.12, seaMarkDot: 0 } }
    ]
  },
  {
    name: '누른 자리 고리',
    hint: '2026-09-14 이전 — 누른 자리의 고리가 점과 한 장이라, 줄기가 빨려 드는 동안 같이 오므라들었다가 끝에서 사라졌다. ' +
          '사용자 : "클릭 했을때 원형이 표시되는데 원형이 커지면서 불투명도 값으로 은은하게 사라지게해". ' +
          '지금은 고리가 누른 순간 떠서 0.9초 동안 2.6배로 퍼지며 은은하게 옅어진다 (점은 줄기가 빨려 들 때까지 남는다). 보려면 빈 바다를 누른다',
    label: '같이 오므라듦',
    values: { seaMarkRipple: 0 },
    presets: [
      { label: '기본', hint: '✅ 지금 값 — 0.9초 · 2.6배', values: { seaMarkRipple: 1, seaMarkRingDur: 0.9, seaMarkRingGrow: 2.6 } },
      { label: '크게 퍼짐', hint: '3.8배까지', values: { seaMarkRipple: 1, seaMarkRingDur: 0.9, seaMarkRingGrow: 3.8 } },
      { label: '천천히', hint: '1.4초 — 더 은은하다', values: { seaMarkRipple: 1, seaMarkRingDur: 1.4, seaMarkRingGrow: 2.6 } },
      { label: '짧게', hint: '0.6초', values: { seaMarkRipple: 1, seaMarkRingDur: 0.6, seaMarkRingGrow: 2.6 } }
    ]
  },
  {
    name: '바다 누르기 (Shift)',
    hint: '2026-09-13 이전 — 빈 바다를 누르면 선택을 놓을 뿐이었다 (Shift 를 눌러도 같다). 멀리 가려면 미니맵을 눌러야 했다. ' +
          '사용자 : "미니맵이 아닌 일반 바다를 클릭했을때 shift 를 누른상태로 빠르게 이동할수 있게해줘". ' +
          '지금은 Shift 를 누른 채 바다를 누르면 그 자리로 부스트 속도로 뱃머리를 돌려 간다 (흰 안개 없음 · 향수 고르기 중이면 12개를 접고 · 닿으면 선다). ' +
          'Shift 없이 누르면 예전 그대로 · 방향키를 잡으면 멈춘다. ⚠ 바로 위 묶음(바다 누르기)이 켜져 있으면 Shift 없이도 가므로, 이 [원본] 은 그쪽 [원본] 과 같이 눌러야 보인다',
    label: 'Shift 무시',
    values: { seaShiftGo: 0 },
    presets: [
      { label: '기본', hint: '✅ 지금 값 — 부스트 자동 조타 · 도착 반경 3 월드 (선회 반경 × 1.3 아래로는 안 내려간다)', values: { seaShiftGo: 1, seaGoArrive: 3 } },
      { label: '넓게 멈춤', hint: '도착 반경 8 월드 — 누른 자리 한 척 반 앞에서 선다', values: { seaShiftGo: 1, seaGoArrive: 8 } }
    ]
  },
  {
    name: '연출 중 바다 누르기',
    hint: '2026-09-14 이전 — 존 연출 중에 바다를 누르면 연출이 걷히기 시작하는 순간 부스트가 같이 걸려, 퇴장 트윈과 속도에 따른 카메라 후퇴가 겹쳐 화면이 움찔거렸다. ' +
          '사용자 : "연출 구도에서 마우스 클릭하고 빠져나올 때 바로 가속이 걸려서 화면이 움찔거리며 연출을 빠져나옴 … 연출이 전부 걷히고 가속이 시작되어야한다". ' +
          '지금은 누르면 연출만 걷히고(화살표는 바로 뜬다), 다 걷힌 뒤에 부스트로 떠난다. 기본 화면에서 누르면 예전처럼 바로 떠난다. ' +
          '보려면 존에 들어가(개발 바 연출 행 · 미니맵 해역) 머무는 동안 빈 바다를 누른다',
    label: '바로 가속',
    values: { seaGoAfterZone: 0 },
    presets: [{ label: '기본', hint: '✅ 지금 값 — 연출이 다 걷힌 뒤 가속', values: { seaGoAfterZone: 1 } }]
  },
  {
    name: '부표 누르면 가속 멈춤',
    hint: '2026-09-15 (v0.65.0) 이전 — 가속 중에 부표를 누르면 가속한 채 12개가 떴다. 12개 자리는 속도 0 카메라로 잡는데 화면 카메라는 속도만큼 물러나 겹쳐 보였다. ' +
          '사용자 : "향수 부표를 클릭하면 즉시 가속을 멈춰야함 고정된 화면에서 일반 이동을 하고 … 연출이 끝나면 최초 눌렸던 향수 근처에". ' +
          '지금은 누르는 순간 가속을 끄고, 연출 동안 카메라는 속도를 안 타며, 클릭 항해 중이었으면 누른 향수 곁으로 일반 속도로 간다 (보려면 빈 바다를 눌러 가속 중에 부표를 누른다)',
    label: '가속한 채',
    values: { pickSail: 0, focusCamStill: 0 },
    presets: [
      { label: '기본', hint: '✅ 지금 값 — 움직이는 중일 때만 누른 향수 곁으로', values: { pickSail: 1, focusCamStill: 1 } },
      { label: '늘 곁으로', hint: '서 있어도 부표를 누르면 그 향수 곁으로 일반 속도로 간다', values: { pickSail: 2, focusCamStill: 1 } }
    ]
  },
  {
    name: '연출 중 빈 곳',
    hint: '2026-09-15 (v0.65.0) 이전 — 12개 연출 중에 빈 바다를 누르면 12개를 접고 그 자리로 부스트 항해했다. ' +
          '사용자 : "마우스로 빈 공간을 클릭하면 이동 및 가속이 아니라 연출 종료로 변경". 지금은 연출만 끝난다 (가라앉은 부표를 누른 것도 빈 곳 · 부표를 눌러 걸린 항해는 그대로 간다)',
    label: '접고 항해',
    values: { focusSeaEnds: 0 },
    presets: [{ label: '기본', hint: '✅ 지금 값 — 연출만 끝낸다', values: { focusSeaEnds: 1 } }]
  },
  {
    name: '가속 키 (ESC · 스페이스)',
    hint: '2026-09-15 (v0.65.0) 이전 — 클릭 항해의 가속을 멈출 키가 없었다. 사용자 : "esc 나 스페이스를 누르면 가속이 멈추고 일반 속도로 항해 … 일반 속도로 도착하기전에는 가속을 다시 할 수 없게 … 최대 가속에 도달해야만 일반으로". ' +
          '지금은 ESC · 스페이스로 가속을 끄고(최대 가속에 닿은 뒤에만) 스페이스로 다시 켠다(일반 속도로 다 내려온 뒤에만 · 12개 연출 중에는 안 켠다). 감속 중에 누른 바다도 가속 없이 간다',
    label: '키 없음',
    values: { sailBoostKeys: 0 },
    presets: [{ label: '기본', hint: '✅ 지금 값 — 잠금 있는 가속 ↔ 일반', values: { sailBoostKeys: 1 } }]
  },
  {
    name: '향수 고르기',
    hint: '2026-09-11 이전 — 부표를 누르면 카드만 떴다. 지금은 주변이 가라앉고 배에서 가까운 12개가 연출 구도에 솟는다 ' +
          '(값을 바꾸면 부표를 다시 눌러야 보인다)',
    label: '카드만',
    values: { focusOn: 0 },
    presets: [
      { label: '기본', hint: '✅ 지금 값 — 12개 · 두 줄 엇갈림', values: { focusOn: 1, focusCount: 12 } },
      { label: '8개', hint: '8개 — 한 줄에 넷씩, 더 크게 벌어진다', values: { focusOn: 1, focusCount: 8 } }
    ]
  },
  {
    name: '말풍선 카드',
    hint: '2026-09-11 오후 이전 — 향수 카드가 왼쪽 최하단에 고정으로 떴다. 지금은 누른 부표 **바로 옆**에 말풍선으로 붙어 ' +
          '부표를 따라다니고, 꼬리가 부표를 가리키며 튀어나오듯 등장한다 (사용자 : "해당 향수 오브젝트 바로 옆에 … 말풍선 형태로")',
    label: '좌하단 고정',
    values: { cardBubble: 0 },
    presets: [{ label: '기본', hint: '✅ 지금 값 — 부표 오른쪽 (자리가 없으면 왼쪽) · 등장 0.38초', values: { cardBubble: 1 } }]
  },
  {
    name: '카드 저녁',
    hint: '2026-09-13 저녁 이전 — 향수 카드가 낮의 종이 카드였다 (거의 불투명한 흰 바탕 0.95 · 먹 테두리 · 먹 버튼). ' +
          '마우스를 올려 뜬 카드가 뒤의 부표를 가려 다음 부표가 어디 떠 있는지 안 보였다. 사용자 : "약간만 분위기를 지금 저녁 느낌으로" · ' +
          '"투명도가 설정없어서 다음 부표가 어디떠있는지 가리는". 지금은 저녁 유리 — 뒤의 부표가 비친다 (카드를 다시 띄워야 향조 글자색이 바뀐다)',
    label: '종이 카드',
    values: { cardEve: 0 },
    presets: [
      { label: '기본', hint: '✅ 지금 값 — 저녁 유리 · 불투명도 0.86 (v0.65.0 — v0.64.0 0.74 · 그 전 0.58)', values: { cardEve: 1, cardGlassA: 0.86 } },
      { label: '더 비치게', hint: '불투명도 0.42 — 부표가 더 또렷이 비친다. 밝은 하늘 앞에서 글자가 약해진다', values: { cardEve: 1, cardGlassA: 0.42 } },
      { label: '진하게', hint: '불투명도 0.94 — 거의 불투명 · 뒤의 부표가 안 비친다', values: { cardEve: 1, cardGlassA: 0.94 } }
    ]
  },
  {
    name: '호버 카드 통과',
    hint: '2026-09-13 저녁 이전 — 마우스를 올려 뜬 미리보기 카드가 마우스를 막고 누른 카드와 같은 진하기라, 카드 밑 부표를 보지도 올리지도 못했다. ' +
          '지금은 미리보기 카드를 마우스가 지나가고 더 비친다 (저녁 카드일 때 불투명도 × 0.65 · 흐림 1.5px). 누른 향수의 카드는 그대로 × · "이 향의 해역으로" 를 누를 수 있다',
    label: '막음',
    values: { cardPeek: 0 },
    presets: [
      { label: '기본', hint: '✅ 지금 값 — 미리보기만 통과 · 진하기 × 0.65', values: { cardPeek: 1, cardPeekA: 0.65 } },
      { label: '같은 진하기', hint: '통과만 하고 진하기는 누른 카드와 같다', values: { cardPeek: 1, cardPeekA: 1 } },
      { label: '더 옅게', hint: '진하기 × 0.45 — 부표가 가장 또렷하다. 글자는 약해진다', values: { cardPeek: 1, cardPeekA: 0.45 } }
    ]
  },
  {
    name: '카드 버튼',
    hint: '2026-09-13 저녁 (v0.53.0) — 저녁 카드의 "이 향의 해역으로" 버튼이 브론즈 알약이었다 (상아색 글자와 대비 약 3.0:1). ' +
          '사용자 : "이부분 버튼 색상을 짙은 남색으로 만들어볼래?". 지금은 짙은 남색 #1E2947 (대비 약 13.7:1 — 두 색만으로 계산)',
    label: '브론즈',
    values: { cardBtnNavy: 0 },
    presets: [{ label: '기본', hint: '✅ 지금 값 — 짙은 남색', values: { cardBtnNavy: 1 } }]
  },
  {
    name: '카드 구분선',
    hint: '2026-09-13 저녁 (v0.53.0) — 저녁 카드의 제목과 NOTES 사이 구분선이 상아색 18%로 옅었고, 카드가 뜰 때마다 밝아졌다가 옅어졌다 ' +
          '(등장 애니메이션이 줄의 opacity 를 0→1 로 밀어 제 opacity 0.18 을 덮었다). 사용자 : "일정하게 불투명하게 만들자". ' +
          '지금은 불투명한 상아색 선이고, 옅게 할 때도 opacity 가 아니라 색 알파라 등장 중에 튀지 않는다',
    label: '옅게 (0.18)',
    values: { cardRuleSolid: 0 },
    presets: [{ label: '기본', hint: '✅ 지금 값 — 불투명 상아색 선', values: { cardRuleSolid: 1 } }]
  },
  {
    name: '카드 진하기',
    hint: '2026-09-14 (v0.64.0) 이전 — 저녁 카드 바탕의 불투명도가 0.58 이었다 (v0.53.0). 사용자 : "지금 모달창이 너무 불투명도가 너무 낮음 조금 더 올려주고" → 0.74 · ' +
          '다음 날 "부표 모달 창을 더 진하게" → 0.86 (v0.65.0). 호버 미리보기는 여기에 × 0.65 라 같이 오른다 (0.38 → 0.48 → 0.56). ⚠ 경고 토스트(0.80)보다 진하다',
    label: '0.58',
    values: { cardGlassA: 0.58 },
    presets: [
      { label: '기본', hint: '✅ 지금 값 — 불투명도 0.86 (v0.65.0)', values: { cardGlassA: 0.86 } },
      { label: '0.74', hint: 'v0.64.0 — 한 단 옅게', values: { cardGlassA: 0.74 } },
      { label: '더 진하게', hint: '불투명도 0.94 — 거의 불투명', values: { cardGlassA: 0.94 } }
    ]
  },
  {
    name: '카드 이미지 자리',
    hint: '2026-09-14 (v0.64.0) 이전 — 카드에 그림 자리가 없었다. 사용자 : "카드에 이미지 자리 넣고". ' +
          '지금은 향조 줄과 제목 사이에 안쪽 폭 가득 · 높이 150px (낮은 창 112 · 84px) 자리. 향수 데이터에 img 가 없으면 병 윤곽 자리표시가 뜬다',
    label: '없음',
    values: { cardImg: 0 },
    presets: [{ label: '기본', hint: '✅ 지금 값 — 자리 150px · 그림은 비율 유지(contain)', values: { cardImg: 1 } }]
  },
  {
    name: '호버 카드 틈',
    hint: '2026-09-15 (v0.65.0) 이전 — 부표에 마우스를 올려 뜬 카드로 마우스를 옮기면 부표와 카드 사이 빈 곳에서 카드가 사라졌다. 카드 위에서도 뒤의 부표를 집어 카드가 바뀌었다. ' +
          '사용자 : "옆 모달창에 마우스를 올리면 그 사이 공백으로 모달창이 사라지고있음". 지금은 부표와 카드를 함께 두른 상자 안이면 카드가 남고, 카드 위로 올라가면 진해지며 × · 버튼을 누를 수 있다 (밖으로 나가면 0.35초 뒤에 닫힌다)',
    label: '끊김',
    values: { cardHoverBridge: 0 },
    presets: [{ label: '기본', hint: '✅ 지금 값 — 틈을 건너도 남고 카드 위에서 누를 수 있다', values: { cardHoverBridge: 1 } }]
  },
  {
    name: '카드 서비스 동작',
    hint: '2026-09-15 (v0.68.0) 이전 — 카드의 단추는 "이 향의 해역으로" 하나였다. 사용자 : "자세히 보기, 진열대에 저장, 주변 향 탐색 … 디자인을 제외한 해당 로직을 … 미리 적용". ' +
          '지금은 그 위에 글자 단추 한 줄 — 앞의 둘은 앱(host.js)으로 나가고(단독이면 경고 한 줄), 주변 향 탐색은 카드의 향을 새 중심으로 12개를 다시 띄운다 (디자인 전 자리)',
    label: '없음',
    values: { cardActions: 0 },
    presets: [{ label: '기본', hint: '✅ 지금 값 — 서비스 동작 세 단추', values: { cardActions: 1 } }]
  },
  {
    name: '사이트 헤더',
    hint: '2026-09-15 (v0.66.0) 이전 — 무대가 창 전체였다. 사용자 : "90px 정도의 헤더가 추가될 예정임 그래서 해당 공간 만큼 채팅 및 연출 문구를 아래로 내려서 해당 헤더 공간을 확보해야함". ' +
          '지금은 자리표시 헤더(시안 그림 · 누르면 아무 일 없음) 90px 아래 남은 높이에 무대 전체가 선다 — 검색창 · 정보 블록 · 수면 타이포 · 카드 · 해도가 같이 내려간다',
    label: '없음 (창 전체)',
    values: { siteHeader: 0 },
    presets: [{ label: '기본', hint: '✅ 지금 값 — 헤더 90px (좁은 창 64px)', values: { siteHeader: 1 } }]
  },
  {
    name: '검색창 · 정보 블록 자리 · 설명 글자',
    hint: '2026-09-15 (v0.67.0) 이전 — 검색창이 무대 위끝에서 44px(헤더 바로 밑) · 정보 블록은 그 36px 아래 · 설명 13px 였다. 사용자 : "지금 이 검색창과 문구가 더 아래 왔으면 좋곘고 설명문구 크기가 조금 더 커졌으면 좋겠음". ' +
          '⭐ 2026-09-16 에 내림을 **0 으로 되돌렸다** — 검색창을 앱의 향해 일지 판 윗변(무대 기준 120)에 맞췄다. v0.67.0 의 40 은 hostTop 90 이 더해지면서 두 번 내려간 셈이었다. ' +
          '남은 몫은 index.html 의 --pb-search-top 44 → 30 이 맡는다 (이 값은 음수가 안 된다). 그래서 지금 이 묶음이 [원본] 과 다른 것은 **설명 글자 배율뿐**이다 (× 1.15 = 13 → 15px). ' +
          '⚠ 정보 블록 아래끝이 수면 타이포의 천장이라 내리면 큰 글자가 작아진다 (보려면 존에 들어간다)',
    label: '위 · 13px',
    values: { searchDrop: 0, infoDescK: 1 },
    presets: [
      { label: '기본', hint: '✅ 지금 값 — 안 내림(향해 일지 판 윗변에 맞춤) · 설명 × 1.15', values: { searchDrop: 0, infoDescK: 1.15 } },
      { label: '40px 내림', hint: 'v0.67.0 ~ v0.72.0 의 자리 — hostTop 과 합쳐 130px 내려가 있었다', values: { searchDrop: 40, infoDescK: 1.15 } },
      { label: '더 아래', hint: '64px 내림 · 설명 × 1.15', values: { searchDrop: 64, infoDescK: 1.15 } },
      { label: '더 크게', hint: '안 내림 · 설명 × 1.3 (17px)', values: { searchDrop: 0, infoDescK: 1.3 } }
    ]
  },
  {
    name: '미니맵',
    hint: '2026-09-11 이전 — 미니맵이 없었다',
    label: '없음',
    values: { minimapOn: 0 },
    presets: [{ label: '기본', hint: '✅ 지금 값 — 우하단', values: { minimapOn: 1 } }]
  },
  {
    name: '미니맵 저녁',
    hint: '2026-09-13 저녁 이전 — 미니맵이 상아색 종이 판(v0.47.0)이라 저녁 바다 위에서 낮 느낌이 남았다. 사용자 : "미니맵도 마찬가지". ' +
          '지금은 저녁 유리 판 · 밝은 글자 · 어두운 테두리 · 한 단 내린 갈 수 없는 바다 — 색은 index.html 의 html[data-mini-eve] 한 곳',
    label: '상아색 판',
    values: { minimapEve: 0 },
    presets: [{ label: '기본', hint: '✅ 지금 값 — 저녁 유리 판', values: { minimapEve: 1 } }]
  },
  {
    name: '연출 중 미니맵',
    hint: '2026-09-13 저녁 이전 — 존 연출(좌우 암석 · 수면 타이포 · 향조 정보) 동안에도 우하단 미니맵이 그대로 떠 있었다. ' +
          '사용자 : "연출이 시작되었을 때 미니맵을 잠시 꺼줘 … opacity 값을 조절해서 사라졌다가 나타났으면". ' +
          '지금은 들어갈 때 0.45초에 옅어져 사라지고, 나갈 때 다시 나타난다 (숨은 동안 누르기도 막는다)',
    label: '늘 보임',
    values: { zoneMiniHide: 0 },
    presets: [{ label: '기본', hint: '✅ 지금 값 — 연출 중 숨김', values: { zoneMiniHide: 1 } }]
  },
  {
    name: '향조 정보 자리',
    hint: '2026-09-13 저녁 이전 — 향조 이름 · 설명 · 노트 블록이 화면 우측 위(1440×780 에서 x 1084~1384 · y 104~223)에 섰다. ' +
          '사용자 : "향 설명이 폰트 위에 나타났다가 사라지게 해야할듯 좀 더 잘보이게? 오른쪽 위에 UI 가 만들어질 것 같아서". ' +
          '지금은 수면 타이포 위 가운데 — 검색바 아래 + 36px · 폭 560 · 가운데 정렬 · 글자 뒤 옅은 그늘 · 아래에서 떠오른다 (존에 들어가야 보인다)',
    label: '우측 위',
    values: { zoneInfoCenter: 0 },
    presets: [{ label: '기본', hint: '✅ 지금 값 — 타이포 위 가운데', values: { zoneInfoCenter: 1 } }]
  },
  {
    name: '범위 없음',
    hint: '2026-09-11 오후 이전 — 향수 지도는 유한한데 바다는 끝이 없어 지도 밖으로 끝없이 항해할 수 있었다. ' +
          '지금은 지도 가장자리에서 여유 20 월드 너머로 못 가고 "범위 없음" 경고가 뜬다. 미니맵의 바깥(한 색)을 눌러도 같다 ' +
          '(사용자 : "갈 수 없는 영역은 갈 수 없다는 범위 없음 경고를 띄우면")',
    label: '끝없이',
    values: { mapBound: 0 },
    presets: [
      { label: '기본', hint: '✅ 지금 값 — 지도 가장자리 + 20 월드', values: { mapBound: 1, mapMargin: 20 } },
      { label: '좁게', hint: '가장자리 + 8 월드 — 맨 바깥 향수 바로 너머에서 막힌다', values: { mapBound: 1, mapMargin: 8 } }
    ]
  },
  {
    name: '경고 토스트',
    hint: '2026-09-13 이전 — "범위 없음" 경고가 낮의 종이 한 줄이었다 (거의 불투명한 흰 바탕 0.95 · 먹 테두리 · 각진 모서리). ' +
          '사용자 : "토스트 디자인도 현재 디자인에 맞게". 지금은 저녁 유리 알약 · 브론즈 진입 금지 표지 · 떠 있는 동안 줄어드는 브론즈 밑줄. ' +
          '보려면 미니맵의 바깥(한 색)이나 해도의 범위 밖을 누른다. ⚠ 해도 밑에 깔려 안 보이던 것(z-index)은 [원본]에서도 고쳤다 — 모양이 아니라 버그라서',
    label: '종이 한 줄',
    values: { warnEve: 0 },
    presets: [
      { label: '기본', hint: '✅ 지금 값 — 저녁 유리 알약 · 남은 시간 밑줄', values: { warnEve: 1, warnLine: 1 } },
      { label: '밑줄 없음', hint: '알약과 표지만 — 남은 시간 밑줄을 뺀다', values: { warnEve: 1, warnLine: 0 } }
    ]
  },
  {
    name: '토스트 자리',
    hint: '2026-09-13 밤 이전 (v0.57.0) — 경고 토스트가 검색바 바로 밑(기본 창에서 12px 아래)에 붙어 떴다. 사용자 : "토스트 조금 아래 띄워주고". ' +
          '지금은 24px 내려 검색바 아래 36px — 존 정보 블록이 검색바에서 떨어진 간격과 같다. 창 크기 단계마다 같은 만큼 내려간다. ' +
          '보려면 미니맵의 바깥(한 색)을 누른다',
    label: '검색바 바로 밑',
    values: { warnDrop: 0 },
    presets: [
      { label: '기본', hint: '✅ 지금 값 — 24px 내림 (검색바 아래 36px)', values: { warnDrop: 24 } },
      { label: '더 아래', hint: '48px 내림 (검색바 아래 60px)', values: { warnDrop: 48 } }
    ]
  },
  {
    name: '미니맵 안개',
    hint: '2026-09-11 오후 이전 — 미니맵 전체가 밝았다. 지금은 게임처럼 **지나온 바다만 밝고** 나머지는 어둡다. ' +
          '향수 점과 해역 이름은 안개 위에 그대로 보인다 (사용자 : "지나온 항해한 영역만 밝게 … 어떤 영역, 어떤 향수 위치는 전부 보이게"). ' +
          '탐색 기록은 이 브라우저에 남는다 — 지우기 : PB.minimap.resetFog()',
    label: '안개 없음',
    values: { minimapFog: 0 },
    presets: [
      { label: '기본', hint: '✅ 지금 값 — 배 둘레 반경 26 월드를 밝힌다', values: { minimapFog: 1, minimapRevealR: 26 } },
      { label: '넓게', hint: '반경 40 — 부표가 뜨는 거리(38)만큼', values: { minimapFog: 1, minimapRevealR: 40 } }
    ]
  },
  {
    name: '돛 반사',
    hint: '2026-09-11 이전 — 돛이 선체와 같은 금속기(0.15)·정반사를 받고 알베도가 거의 순백이었다. ' +
          '배 방향에 따라 돛 픽셀의 최대 86% 가 1.0 을 넘어 순백으로 잘렸다 (배를 돌려 가며 봐야 드러난다)',
    label: '반사 · 순백',
    values: { sailSpec: 1, sailTone: 1 },
    // ⚠⚠ '무광만' 은 **오히려 더 하얗다** — 금속기 0.15 가 확산광을 0.85 배로 누르고 있었기 때문이다.
    //   끄는 것과 톤을 내리는 것이 한 묶음이라는 것을 보여 주려고 일부러 남긴 시안이다
    presets: [
      { label: '기본', hint: '✅ 지금 값 (09-15 사용자 지시 · 예전 이름 "무광만") — 무광 · 톤 1. ⚠ 가장 하얀 쪽이다 (09-11 실측 잘림 99%). 금속기가 누르던 15% 가 돌아온다',
        values: { sailSpec: 0, sailTone: 1 } },
      { label: '09-11 톤', hint: '무광 · 톤 0.78 — 배를 한 바퀴 돌려도 잘림 최대 6% (예전 80%) · 블룸 0%',
        values: { sailSpec: 0, sailTone: 0.78 } },
      { label: '밝게', hint: '무광 · 톤 0.85 — 가장 심한 방향에서 잘림 61%',
        values: { sailSpec: 0, sailTone: 0.85 } },
      { label: '차분히', hint: '무광 · 톤 0.72 — 잘림 0%. 그늘진 쪽이 조금 더 회색으로 간다',
        values: { sailSpec: 0, sailTone: 0.72 } }
    ]
  },
  {
    name: '선체 톤',
    hint: '2026-09-11 오후 이전 — 선체(Boat)가 금속기 0.15 · 정반사 · 거의 순백(#f8f7f7) 알베도라 배 방향에 따라 ' +
          '선체 픽셀의 15~35% 가 1.0 을 넘어 순백으로 잘렸고, 돛만 내린 뒤로는 선체가 돛보다 밝았다 (사용자 : "선체 톤도 돛처럼")',
    label: '반사 · 순백',
    values: { hullSpec: 1, hullTone: 1 },
    // ⚠ 돛과 같은 이유로 **끄는 것(hullSpec)과 톤(hullTone)이 한 묶음**이다 — 반사만 끄면 확산광이 돌아와 더 하얘진다
    presets: [
      { label: '기본', hint: '✅ 지금 값 — 무광 · 톤 0.75. 배를 한 바퀴 돌려도 잘림 최악 5.7% · 평균 0.9% (예전 42.7% · 20.8%)',
        values: { hullSpec: 0, hullTone: 0.75 } },
      { label: '무광만', hint: '반사만 끈다 — ⚠ 돛과 같은 이유로 더 하얘진다 (잘림 평균 20.8% → 68.1%)', values: { hullSpec: 0, hullTone: 1 } },
      { label: '돛과 같게', hint: '무광 · 톤 0.78 — 돛과 같은 배율. ⚠ 300° 햇빛 면이 통째로 잘린다 (41.6%)', values: { hullSpec: 0, hullTone: 0.78 } },
      { label: '차분히', hint: '무광 · 톤 0.70 — 잘림 0%. 선체가 돛보다 어두운 방향이 9/12', values: { hullSpec: 0, hullTone: 0.70 } }
    ]
  },
  {
    name: '흰 거품 두 겹',
    hint: '2026-09-14 이전 (v0.59.6) — 한 마루의 흰 거품이 두 줄로 갈라졌다. 마루선 층(보라·블루 무리 + 금빛 이음매·발광)이 흰 거품 **위에** 칠해져 능선을 덮었고 (측정 : 흐린 두 겹의 56%), ' +
          '앞뒤 창이 뒷면 전체를 ×0.15 로 눌러 짙은 꼬리를 갈랐다 (22%). 사용자 : "거품이 2겹으로 나뉘어지는 현상이 있음". ' +
          '보려면 저녁 · 개발 바 끄기에서 선체거품·반짝임거품을 끄고 검증 보기 14 (빨강과 파랑의 모양이 같아야 한다)',
    label: '갈라짐',
    values: { lineYield: 0, lineYieldSrc: 1, lineYieldK: 0.10, foamFaceKeep: 0, foamFaceKeepLo: 0.15, foamFaceKeepHi: 0.55, foamFaceAmt: 0.85, foamKnee: 0, lineFoamSrc: 0 },
    presets: [
      { label: '기본', hint: '✅ 기억만큼 비키기 0.85 · 짙은 뒷면 남김', values: { lineYield: 0.85, lineYieldSrc: 1, lineYieldK: 0.10, foamFaceKeep: 1, foamFaceKeepLo: 0.15, foamFaceKeepHi: 0.55, foamFaceAmt: 0.85, foamKnee: 0, lineFoamSrc: 0 } },
      { label: '선만 비킴', hint: 'H6_line 만 — 능선의 틈과 금빛·보라 테가 같이 사라지면 주 원인 확인', values: { lineYield: 0.85, lineYieldSrc: 1, lineYieldK: 0.10, foamFaceKeep: 0, foamFaceKeepLo: 0.15, foamFaceKeepHi: 0.55, foamFaceAmt: 0.85, foamKnee: 0, lineFoamSrc: 0 } },
      { label: '선만 (kF)', hint: '비키는 양을 kF 로 — 뒷면 어깨에 테가 남는지 기억 원천과 비교', values: { lineYield: 0.85, lineYieldSrc: 0, lineYieldK: 0.10, foamFaceKeep: 0, foamFaceKeepLo: 0.15, foamFaceKeepHi: 0.55, foamFaceAmt: 0.85, foamKnee: 0, lineFoamSrc: 0 } },
      { label: '짙은 뒷면만', hint: 'H2 만 — 뒷면의 짙은 꼬리가 한 덩어리로 이어지는지', values: { lineYield: 0, lineYieldSrc: 1, lineYieldK: 0.10, foamFaceKeep: 1, foamFaceKeepLo: 0.15, foamFaceKeepHi: 0.55, foamFaceAmt: 0.85, foamKnee: 0, lineFoamSrc: 0 } },
      { label: '비킴 0.6', hint: '기본에서 비키기만 0.6 — 짙은 능선 오로라를 더 남긴다', values: { lineYield: 0.6, lineYieldSrc: 1, lineYieldK: 0.10, foamFaceKeep: 1, foamFaceKeepLo: 0.15, foamFaceKeepHi: 0.55, foamFaceAmt: 0.85, foamKnee: 0, lineFoamSrc: 0 } },
      { label: '완전히 비킴', hint: '비키기 1.0 — ⚠ 거품 짙은 능선의 오로라가 통째로 빠진다', values: { lineYield: 1, lineYieldSrc: 1, lineYieldK: 0.10, foamFaceKeep: 1, foamFaceKeepLo: 0.15, foamFaceKeepHi: 0.55, foamFaceAmt: 0.85, foamKnee: 0, lineFoamSrc: 0 } },
      { label: '+무릎·곡선', hint: '기본 + 무릎 1 + 마루선 나이 곡선 공유 — ⚠ 흰색 잉크가 준다', values: { lineYield: 0.85, lineYieldSrc: 1, lineYieldK: 0.10, foamFaceKeep: 1, foamFaceKeepLo: 0.15, foamFaceKeepHi: 0.55, foamFaceAmt: 0.85, foamKnee: 1, lineFoamSrc: 1 } },
      { label: '원경 덜 비킴', hint: '기본에서 lineYieldK 만 0.35 (첫 구현값) — 배에서 18 월드 너머 능선에서 금빛 이음매가 흰 덩어리를 다시 두 띠로 가르는지', values: { lineYield: 0.85, lineYieldSrc: 1, lineYieldK: 0.35, foamFaceKeep: 1, foamFaceKeepLo: 0.15, foamFaceKeepHi: 0.55, foamFaceAmt: 0.85, foamKnee: 0, lineFoamSrc: 0 } },
      { label: '뒷면 덜 누름', hint: '짙은 뒷면 남김 대신 앞뒤 누르기 자체를 0.5 로 — 면적 비교용', values: { lineYield: 0.85, lineYieldSrc: 1, lineYieldK: 0.10, foamFaceKeep: 0, foamFaceKeepLo: 0.15, foamFaceKeepHi: 0.55, foamFaceAmt: 0.5, foamKnee: 0, lineFoamSrc: 0 } }
    ]
  },
  {
    name: '거품 무리',
    hint: '2026-09-14 이전 — 탄생 판정(sim.js br)이 주파 네 대역 높이만 봐서 마루선 방향 최단 변조가 16.7 월드(주파장의 2.1배)였다. ' +
          '한 마루가 foamHigh 를 넘으면 마루선을 따라 통째로 부서져 일자 띠가 됐다. 사용자 : "일자로 생성되는게아니라 … 상당히 무작위하게 파도 거품군들이 생김". ' +
          '시안을 켜면 같은 높이 문턱 위에서 국소 진폭이 클수록 넓게, 문턱 근처는 드문 섬으로만 부서진다 (군속도로 흐르는 결맞은 난수). ' +
          '⚠ 기본값은 아직 끔 — 문 A (기억 자체가 일자인지) 측정 전이다. 검증 보기 15 + topView',
    label: '마루 통째로',
    values: { foamClump: 0, foamCross: 0, foamClumpSpan: 0.80, foamClumpQLo: -0.2, foamClumpQHi: 0.88, foamClumpCell: 3.0, foamClumpStretch: 1.4, foamClumpFlow: 0.5 },
    presets: [
      { label: '기본', hint: '무리 1 · 교차 없음 — 문 B (JS 재현) 통과한 탄생 0.73 · 진폭에 단조. ⚠ 문 A 통과 뒤 기본값으로 올린다', values: { foamClump: 1, foamCross: 0, foamClumpSpan: 0.80, foamClumpQLo: -0.2, foamClumpQHi: 0.88, foamClumpCell: 3.0, foamClumpStretch: 1.4, foamClumpFlow: 0.5 } },
      { label: '+교차', hint: '기본 + 교차 너울 0.85 — ⚠ 시뮬 삼각함수 +50%', values: { foamClump: 1, foamCross: 0.85, foamClumpSpan: 0.80, foamClumpQLo: -0.2, foamClumpQHi: 0.88, foamClumpCell: 3.0, foamClumpStretch: 1.4, foamClumpFlow: 0.5 } },
      { label: '교차만', hint: '난수 없이 교차 너울만 — 해시 0', values: { foamClump: 0, foamCross: 0.85, foamClumpSpan: 0.80, foamClumpQLo: -0.2, foamClumpQHi: 0.88, foamClumpCell: 3.0, foamClumpStretch: 1.4, foamClumpFlow: 0.5 } },
      { label: '넉넉히', hint: '폭 0.60 · 문턱 −0.2~0.8 · 칸 3.6 — 무리가 길고 많다 (문 B 통과 0.86)', values: { foamClump: 1, foamCross: 0, foamClumpSpan: 0.60, foamClumpQLo: -0.2, foamClumpQHi: 0.8, foamClumpCell: 3.6, foamClumpStretch: 1.4, foamClumpFlow: 0.5 } },
      { label: '드물게', hint: '폭 0.80 · 문턱 0.1~1.0 — 가장 높은 마루만 길게 (문 B 통과 0.56)', values: { foamClump: 1, foamCross: 0, foamClumpSpan: 0.80, foamClumpQLo: 0.1, foamClumpQHi: 1.0, foamClumpCell: 3.0, foamClumpStretch: 1.4, foamClumpFlow: 0.5 } }
    ]
  },
  {
    name: '거품 단면',
    hint: '2026-09-14 이전 — 짙은 곳이든 옅은 곳이든 벽이 0.30~0.48 이라 같은 크기 구멍이 도장처럼 찍혔고, 거품은 파도 음영과 무관한 흰 칠이었다. ' +
          '시안을 켜면 짙은 기억은 흰 바탕에 잔 구멍, 옅은 꼬리는 큰 구멍 레이스이고, 그늘 쪽은 회청이다. 보려면 저녁 · 선체거품·반짝임거품 끄기',
    label: '평평한 흰 칠',
    values: { foamShade: 0, foamLace: 0, foamLaceThin: 0.35 },
    presets: [
      { label: '기본', hint: '✅ 지금 값 — 아직 켜지 않았다 (1·2단계 확정 뒤 결정)', values: { foamShade: 0, foamLace: 0, foamLaceThin: 0.35 } },
      { label: '명암', hint: '곡면 명암 0.35', values: { foamShade: 0.35, foamLace: 0, foamLaceThin: 0.35 } },
      { label: '레이스', hint: '짙은 곳 잔 구멍 · 꼬리 큰 구멍 (foamLace 1)', values: { foamShade: 0, foamLace: 1, foamLaceThin: 0.35 } },
      { label: '전부', hint: '명암 + 레이스', values: { foamShade: 0.35, foamLace: 1, foamLaceThin: 0.35 } }
    ]
  },
  {
    name: '거품 파란 띠 밑',
    hint: '2026-09-14 이전 (v0.60) — 흰 거품이 파도 한가운데(뒷면 경사 중턱)에 넓은 흰 판으로 칠해졌다 (foamWhite 4.5 에서 포화). ' +
          '사용자 : "너무 파도 한가운데에서 완만하게 너무 넓게 파도 밑으로 퍼지게 … 무작위 군집 … 파도 오로라에서 파란색 부분을 담당하는 그 밑으로 은은하게 얇게". ' +
          '기본 시안은 오로라 파란 무리가 옅어지는 가장자리에만 얇게 칠하고(그 마루 앞뒤 1.6 · 3.2 월드에 기억이 있을 때) 군집 노이즈로 가득한 곳과 빈 곳을 가른다. ' +
          '보려면 저녁 · 개발 바 끄기에서 선체거품·반짝임거품을 끄고 10초 이상',
    label: '넓은 흰 판',
    values: { foamUnder: 0, foamPatch: 0, foamStripAt: 0.22, foamStripW: 0.35, foamReach: 1.6, foamTailLo: 0.20, foamTailHi: 0.50, foamUnderA: 0.75, foamPatchCell: 2.4, foamPatchLo: 0.35, foamPatchHi: 0.70 },
    presets: [
      { label: '기본', hint: '✅ 파란 띠 바로 밑 얇게 · 은은하게 (불투명 0.75) · 군집', values: { foamUnder: 1, foamPatch: 1, foamStripAt: 0.22, foamStripW: 0.35, foamReach: 1.6, foamTailLo: 0.20, foamTailHi: 0.50, foamUnderA: 0.75, foamPatchCell: 2.4, foamPatchLo: 0.35, foamPatchHi: 0.70 } },
      { label: '띠만', hint: '군집 없이 — 띠가 파란 무리에 붙는 자리를 본다', values: { foamUnder: 1, foamPatch: 0, foamStripAt: 0.22, foamStripW: 0.35, foamReach: 1.6, foamTailLo: 0.20, foamTailHi: 0.50, foamUnderA: 0.75, foamPatchCell: 2.4, foamPatchLo: 0.35, foamPatchHi: 0.70 } },
      { label: '군집만', hint: '예전 넓은 거품에 군집만 — 가득한 곳 / 기포 자리', values: { foamUnder: 0, foamPatch: 1, foamStripAt: 0.22, foamStripW: 0.35, foamReach: 1.6, foamTailLo: 0.20, foamTailHi: 0.50, foamUnderA: 0.75, foamPatchCell: 2.4, foamPatchLo: 0.35, foamPatchHi: 0.70 } },
      { label: '파랑 속으로', hint: '띠 자리 0.35 — 파란 무리에 더 붙고 더 얇다 (면적 0.20%)', values: { foamUnder: 1, foamPatch: 1, foamStripAt: 0.35, foamStripW: 0.30, foamReach: 1.6, foamTailLo: 0.20, foamTailHi: 0.50, foamUnderA: 0.75, foamPatchCell: 2.4, foamPatchLo: 0.35, foamPatchHi: 0.70 } },
      { label: '바깥 · 넓게', hint: '띠 자리 0.15 · 폭 0.45 — 파랑에서 조금 떨어져 넓다', values: { foamUnder: 1, foamPatch: 1, foamStripAt: 0.15, foamStripW: 0.45, foamReach: 1.6, foamTailLo: 0.20, foamTailHi: 0.50, foamUnderA: 0.75, foamPatchCell: 2.4, foamPatchLo: 0.35, foamPatchHi: 0.70 } },
      { label: '진하게', hint: '기본에서 불투명 1.0 · 빈 곳 적게 (군집 0.25~0.60)', values: { foamUnder: 1, foamPatch: 1, foamStripAt: 0.22, foamStripW: 0.35, foamReach: 1.6, foamTailLo: 0.20, foamTailHi: 0.50, foamUnderA: 1.0, foamPatchCell: 2.4, foamPatchLo: 0.25, foamPatchHi: 0.60 } }
    ]
  },
  {
    name: '유사 연결선 기준',
    hint: '2026-09-14 (v0.62.0) — 유사도를 **데이터 neighbors**(닮은 향수 10개 · 백엔드 perfume_neighbors 와 같은 목록)로 바꿨다. ' +
          '사용자 : *"백엔드에 있는 자료가 더 좋을듯"*. [원본] 은 예전의 **향 지도 좌표(mx·my) 거리** — 두 기준의 가까운 10개는 평균 43.1% 만 겹친다. ' +
          '12개를 고르는 것(배에서 가까운 순)은 그대로다 — 무리 모양과 깊이 배치만 달라진다',
    label: '지도 거리',
    values: { focusLinkBasis: 0 }
  },
  {
    name: '고르기 화면 안 · 겹침',
    hint: '2026-09-14 (v0.63.0) — 12개가 화면 밖으로 나가거나 서로 겹치던 것. 사용자 : *"너무 향수끼리 겹치는 경우가 많음 좌우로 약간 넓혀 배치해야하고 화면 자체를 벗어나는 경우가 있음"*. ' +
          '[원본] 은 v0.62.0 — 가지 후보를 목표 둘레 ±1.2% 폭만 흔들고, 화면 검사를 중심점으로만 했다 (화면 밖 부표가 있는 장면 44.5% · 몸통 겹침 64.3% · 이름표 겹침 94.3%)',
    label: '예전 (겹침 · 밖)',
    values: { focusDepthFit: 0 }
  }
];

const same = (a, b) => (typeof a === 'number' && typeof b === 'number')
  ? Math.abs(a - b) < 1e-6 : a === b;

export function createCompare(stage, { apply, tweaks, viewbar, campanel } = {}) {
  const box = document.createElement('div');
  box.style.cssText =
    'width:238px;padding:6px 8px;' +   // ⚠ 자리는 main.js 의 dock 이 정한다

    'background:rgba(248,247,243,0.90);border:1px solid rgba(26,26,26,0.18);border-radius:4px;' +
    'font:11px/1.5 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;color:#1A1A1A;' +
    'display:flex;flex-direction:column;gap:4px';

  const head = document.createElement('div');
  head.style.cssText = 'display:flex;align-items:center;gap:6px';
  const title = document.createElement('button');
  title.style.cssText = 'flex:1;text-align:left;font:inherit;font-weight:600;cursor:pointer;' +
    'background:none;border:0;padding:0;color:inherit';
  title.title = '눌러서 접었다 편다';
  head.appendChild(title);

  const body = document.createElement('div');
  body.style.cssText = 'flex-direction:column;gap:4px';
  body.style.display = 'flex';

  const rows = [];
  const stash = new Map();   // 묶음 → 되돌리기 전의 값들

  const mkBtn = (label, hint) => {
    const b = document.createElement('button');
    b.textContent = label;
    if (hint) b.title = hint;
    b.style.cssText = 'font:inherit;cursor:pointer;border-radius:3px;padding:1px 5px;' +
      'border:1px solid rgba(26,26,26,0.20);background:#fff;color:inherit';
    b.addEventListener('keydown', e => e.stopPropagation());
    return b;
  };
  const paint = (b, on) => {
    b.style.background = on ? '#1A1A1A' : '#fff';
    b.style.color = on ? '#F6F5F2' : '#1A1A1A';
    b.style.borderColor = on ? '#1A1A1A' : 'rgba(26,26,26,0.20)';
  };
  const setAll = (vals) => { for (const k in vals) P[k] = vals[k]; };
  // 지금 값이 이 값 묶음과 같은가
  const isAt = (vals) => Object.keys(vals).every(k => same(P[k], vals[k]));

  for (const B of BASELINES) {
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;gap:3px;flex-wrap:wrap';
    const t = document.createElement('span');
    t.textContent = B.name;
    t.title = B.hint;
    t.style.cssText = 'width:52px;flex:none;opacity:.62';
    row.appendChild(t);

    const btns = [];
    // [원본] — 누르면 기준선으로, 다시 누르면 stash 에서 복원
    const orig = mkBtn('원본', B.hint + '  ·  ' + B.label);
    orig.addEventListener('click', () => {
      if (isAt(B.values)) {
        const s = stash.get(B.name);
        if (s) setAll(s);            // 되돌아왔던 것을 다시 지금 값으로
      } else {
        stash.set(B.name, Object.fromEntries(Object.keys(B.values).map(k => [k, P[k]])));
        setAll(B.values);
      }
      syncAll();
    });
    row.appendChild(orig);
    btns.push({ el: orig, at: () => isAt(B.values) });

    for (const pre of (B.presets || [])) {
      const b = mkBtn(pre.label, pre.hint);
      b.addEventListener('click', () => {
        if (!stash.has(B.name)) stash.set(B.name, Object.fromEntries(Object.keys(B.values).map(k => [k, P[k]])));
        setAll(pre.values);
        syncAll();
      });
      row.appendChild(b);
      btns.push({ el: b, at: () => isAt(pre.values) });
    }

    // 지금 상태 한 줄
    const note = document.createElement('span');
    note.style.cssText = 'width:100%;padding-left:55px;opacity:.55;font-size:10px';
    body.appendChild(row);
    body.appendChild(note);
    rows.push({ B, btns, note });
  }

  // ── 전부
  const all = document.createElement('div');
  all.style.cssText = 'display:flex;gap:3px;padding-top:3px;border-top:1px solid rgba(26,26,26,0.12)';
  const allOrig = mkBtn('전부 원본', '모든 묶음을 작업 전 값으로. 다시 누르면 각자 되돌아온다');
  allOrig.addEventListener('click', () => {
    const everyAt = BASELINES.every(B => isAt(B.values));
    for (const B of BASELINES) {
      if (everyAt) { const s = stash.get(B.name); if (s) setAll(s); }
      else {
        if (!isAt(B.values)) stash.set(B.name, Object.fromEntries(Object.keys(B.values).map(k => [k, P[k]])));
        setAll(B.values);
      }
    }
    syncAll();
  });
  all.appendChild(allOrig);
  body.appendChild(all);

  box.append(head, body);

  // ⚠ **기본이 접힘이다.** 좌측은 viewbar(top 150px 부터 아래로 자란다)와 시점 패널이
  //   이미 써서, 셋을 다 펴면 720px 창에서 겹친다 (실측). 접혀도 제목에
  //   'n개 되돌림' 이 남으므로 상태를 잃지 않는다 (tweaks 가 같은 이유로 하는 것)
  let folded = true;
  body.style.display = 'none';
  const paintTitle = () => {
    const n = BASELINES.filter(B => isAt(B.values)).length;
    title.textContent = (folded ? '▸' : '▾') + ' 원본 비교' + (n ? '  · ' + n + '개 원본' : '  · 전부 바뀜');
  };
  title.addEventListener('click', () => {
    folded = !folded;
    body.style.display = folded ? 'none' : 'flex';
    paintTitle();
  });
  title.addEventListener('keydown', e => e.stopPropagation());

  function syncAll() {
    for (const r of rows) {
      r.btns.forEach(b => paint(b.el, b.at()));
      const at = r.btns.find(b => b.at());
      r.note.textContent = at ? (at.el.textContent === '원본' ? '지금 : ' + r.B.label : '지금 : ' + at.el.textContent + ' 시안') : '';
    }
    paint(allOrig, BASELINES.every(B => isAt(B.values)));
    paintTitle();
    if (campanel) campanel.sync();
    if (viewbar) viewbar.sync();
    if (tweaks) tweaks.sync();
    if (apply) apply();
  }

  syncAll();

  return {
    el: box,
    mount() { stage.appendChild(box); },
    sync: syncAll,
    dispose() { box.remove(); }
  };
}
