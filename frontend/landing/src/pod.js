import * as THREE from 'three';
import { PARAMS as P } from './params.js';
import { CONFIG } from './config.js';
import { swellCPU } from './swell.js';
import { clamp, D2R } from './util.js';
import { timeNow } from './times.js';   // 시간대 표 — 몸 색이 낮/저녁/밤을 따라간다

// ───────── 돌고래 무리 — 원경을 채운다 (2026-09-18) ─────────
// 사용자 : *"바다 위로 뛰어오르는 돌고래를 작은 로우 폴리 glb (로) 외부 바다 밀도를 조금 손 보려고함.
//   입부터 꼬리까지 일자리깅을 임의로 설정할 수 있으면 휘게 만들어서 수면위를 점프하며 헤엄치는걸
//   만들건데 최대한 무리 안가게 만들려고함"*.
//
// ⚠⚠ **뼈대(스킨)를 쓰지 않는다 — 이 모델의 리깅으로는 몸이 안 휜다.** 원본을 실측한 결과다
//   (`public/landing/dolphin.glb` · 40,320바이트 · 정점 317 · 삼각형 314) :
//     · 뼈 6개 중 5개만 쓰이고 **몸통을 따라가는 뼈가 없다** —
//       Head 가 z −127..−42 의 정점 150개를 통째로 쥐고(앞 1/3 이 통뼈), Center 는 z 110..117 의 64개,
//       Tail 은 z 134..143 의 28개뿐이다. 그 사이를 이을 뼈가 없다.
//     · **정점 75개는 가중치가 아예 0 이다** (z −48..6.5 · y 최대 59.5 — 몸통 중간과 등지느러미).
//       three.js 의 GPU 스키닝은 가중치 합이 0 이면 그 정점을 원점으로 끌어당긴다 —
//       이 뼈대를 그대로 돌리면 **등지느러미가 몸 안으로 함몰된다.** 내장 애니메이션(Take 001,
//       81키 2.667초)도 같은 뼈대를 쓴다. 그래서 스킨 · 애니메이션 · 카메라 · 조명 노드를 다 버리고
//       메시 한 장만 꺼낸다 (바인드 포즈 = 정지 포즈다).
//
// ⚠⚠ **그리고 지오메트리를 한 번 쪼갠다 — 이게 진짜 벽이었다.** 원본은 길이축을 따라 정점 고리가
//   26개뿐이고 **z 6.5 와 110 사이 108단위(몸 길이의 40%)에 정점이 하나도 없다.** 삼각형 314개 중
//   136개가 40단위 이상을 걸치고 가장 긴 10개는 115단위(43%)를 한 장으로 건너뛴다.
//   뼈로 휘든 셰이더로 휘든 **정점이 있는 자리에서만 휜다** — 그대로 휘면 곡선이 아니라 접힌 자국이 하나 생긴다.
//   로드할 때 딱 한 번 길이축으로 잘라 마디를 만든다 (아래 `sliceZ`).
//   ⚠ 실측 (2026-09-18, 브라우저에서 만들어진 지오메트리를 그대로 재서) :
//     · 삼각형 314 → **2,558** · 정점 317 → **7,674** · 길이축 고리 26 → **50** · 최대 걸침 43% → **4.2%**
//     · 기본 휨(podBendAmp 0.10)을 걸었을 때 **이웃 고리 사이의 최대 꺾임 각 28.7° → 9.5°**
//       (= 원본이었다면 몸통 한가운데가 28.7° 로 접혔다. 그게 '곡선이 아니라 접힌 자국'이다)
//     · 마디를 32 로 올리면 9.6° → 7.5° 인데 삼각형이 3,330 이다. 원경에 뜨는 크기에서는 안 보여 24 로 끊었다
//
// ⚠ **휨은 CPU 가 아니라 정점 셰이더가 한다** — boat.js 의 돛 바람과 같은 규율
//   (*"CPU 로 정점을 갱신하지 않는다 … GPU 에서 민다"*). 휨을 정규화된 길이축 자리 u 의
//   **연속 함수**로 두었으므로 "입부터 꼬리까지 임의로 설정하는 일자 리깅" 이 곧 이 함수다 —
//   관절 개수는 마디 수(24)만큼이고, 손잡이는 `podBendAmp` · `podBendWaves` · `podBendExp` 셋이다.
//
// ⚠⚠ **꼬리질 축은 무리마다 다르다** (인스턴스 속성 aK.w — 메시도 재질도 하나다).
//   · 뛰는 무리 = **세로**. 돌고래는 포유류라 꼬리를 위아래로 친다 (지느러미가 수평인 것도 그 때문이다).
//   · 유영 무리 = **좌우**. 생물학이 아니라 **시점**이 정한다 — 이 카메라는 수면을 내려다보므로
//     위아래 움직임이 원근에 눌려 거의 안 보이고, 좌우로 쳐야 화면에 남는다
//     (사용자 : *"꼬리를 위아래가 아니라 좌우로 흔들어야함"*).
//
// ⚠⚠ **진행 방향은 카메라가 정한다 — 이 씬의 카메라는 배를 따라 돌지 않는다.** (2026-09-18 실측 :
//   `nav.head` 를 90° 돌려도 카메라 방위는 127.9° 그대로였다. `cameraPose` 가 `PARAMS.camYaw` 로
//   **씬 좌표에 고정**하고 배만 그 밑에서 돈다.) 그래서 무리의 방위를 월드에 무작위로 뿌리면
//   **화면에서 어디로 갈지가 운에 맡겨진다** — 사용자 지적 *"화면으로 점프했는데 오른쪽으로 이동하고 있음"*.
//   여기서는 방위를 **카메라 기준**으로 잡는다 : `podBearing` 은 *"카메라에서 똑바로 멀어지는 방향"* 에서
//   몇 도 틀 것인가다 (0 = 화면 안쪽으로 곧장 · 90 = 화면을 가로지름). 무리마다 좌우로 갈라 지난다.
//   ⚠ 유도 : `cameraPose` 는 카메라를 `look + d·(sin yaw, ·, cos yaw)` 에 놓고 그 점을 본다 →
//     시선(수평) = −(sin yaw, cos yaw). 로컬 −z 가 코이므로 `rotation.y = H` 인 몸이 보는 방향은
//     (−sin H, −cos H) 다. **둘이 같아지는 값이 H = camYaw** 다 (실측 −52.1° ↔ 카메라 시선 (0.79, −0.61) · 일치).
//
// ⚠⚠ **몸이 보는 방향과 가는 방향은 같아야 한다.** 씬 좌표 규약이 `(x − scroll.x, z + scroll.z)` 라
//   자리를 `+sin H` 로 밀면 몸은 `−sin H` 를 보는데 **옆걸음질**한다 (부호 하나로 갈라진다).
//   그래서 아래 `wx`·`wz` 는 둘 다 **−** 다 — 보는 방향 그대로 나아간다.
//
// ⚠⚠ **공중에 있는 시간은 중력이 정한다 — 손잡이가 아니다.** 2026-09-18 이전에는 '주기 중 물 밖에
//   있는 몫'(podAir)이 손잡이였는데, 그 값으로 역산한 중력이 **3.5** (실제의 1/2.8)였다 —
//   사용자 : *"돌고래가 너무 느리게 점프함 약간 중력이 너무 약하다고해야하나"*. 바로 그 항이다.
//   지금은 포물선 하나를 중력에서 푼다 : 꼭대기 h 까지 올랐다 내려오는 시간 **t = 2√(2h/g)** ·
//   그동안 덮는 가로 거리 **D = podSpeed × t** · 솟는 각 **tan θ = √(2gh) / podSpeed**.
//   ⚠ 크기 편차가 붙은 마리는 호가 통째로 커지므로 공중 시간도 **√크기 배**다 (같은 중력이다).
//     ⚠⚠ 그 크기는 **거리가 정한다** (2026-09-19 · update 의 `szAt`) — 멀수록 작은 쪽으로 쏠린다.
//       고정 편차 + 원경 보정이 겹쳐 «먼 마리가 화면에서 더 큰» 상태였다 (경위는 szAt 주석).
//   ⚠ 1 월드 ≈ 1 m 로 읽는다 (배 길이 lengthW 5.0 = 5m 급 요트) — 그래서 9.8 이 뜻을 갖는다.
//
// ⚠ **들어갈 때는 꼬리까지 다 잠긴 뒤에 지운다.** 포물선을 양 끝으로 `m` 만큼 늘려, 몸이 가장 길게
//   삐져나오는 자세에서도 물 밑으로 다 들어간 다음 꺼진다 (아래 `MARGIN`). 수면 메시는 **앞면만 · 불투명**이라
//   (dive.js 머리 주석) 물 밑의 몸은 물이 가려 준다 — 잠기는 동안 자연스럽게 깎여 사라진다.
//
// ⚠⚠ **한 번 떠올라 1~3번 뛰고 잠수한다.** 영원히 같은 자리에서 등속으로 뛰면 오래 볼수록 기계처럼 읽힌다 —
//   실제 돌고래도 떠올라 두세 번 뛰고 깊이 잠수(sounding)했다가 한참 뒤에 나온다.
//   `podLeaps` 번 뛰고 `podRest` 주기를 쉬는 **묶음 주기**다 (마리마다 씨앗에서 1~podLeaps 를 뽑는다).
//   ⚠ 쉬는 구간으로 넘어가는 순간은 **이미 물속**이다 (한 주기의 그리는 창이 0.58 이라 끝은 언제나 물 밑) — 튀지 않는다.
//   ⚠ 무리는 쉬는 동안에도 계속 헤엄치므로 다음엔 조금 앞에서 떠오른다.
//   ⚠ **성능 때문이 아니다** — 안 보이는 인스턴스는 크기 0(퇴화 삼각형)이라 값이 0 이다. 순전히 연출이다.
//
// ⚠⚠ **배와 카메라 사이에는 뜨지 않는다 — 연출은 배 뒤에서 한다.** (사용자 : *"배와 화면 사이에는 연출을
//   줄여야함 배 뒷편으로 연출이 주로 이루어져야하고"*). 배 둘레는 부표 · 항적 · 물보라 · 이름표가 이미 붐비고,
//   부표를 누르거나 존에 들어가면 **카메라가 클로즈업**해 돌고래가 화면을 가린다.
//   그래서 게이트가 셋이다 (전부 곱한다) :
//     · `podNear`   배에서 이만큼 안쪽이면 안 뜬다 (`podFade0` 까지 서서히 올라온다)
//     · `podBehind` 배(씬 원점)에서 잰 **카메라 전방 성분**이 양수여야 한다 = 배보다 뒤. 그 띠의 폭이다
//     · `hide`      연출이 넘기는 값 — 존 구도 · 향수 고르기(`cl`) · 이동 안개(`travel.fog`)
//   ⚠⚠ **막는 방법은 지우기가 아니라 잠기기다.** 게이트가 덜 열린 만큼 호를 **물 밑으로 내린다** —
//     수면이 불투명하게 가려 주므로 **경계에서 튀지 않는다** (알파로 지우면 반투명 유령이 지나간다).
//     다 잠긴 뒤에야 크기 0 으로 꺼진다.
//
// ⚠ **이동(안개)이 걷히면 처음부터 다시 재생한다** (사용자 : *"항해 지도를 눌러서 이동했을때는 전체 다시
//   돌고래 애니메이션 재생이라 생각하면 됨"*). 화면을 다 덮은 뒤 걷힐 때 시계 원점을 옮긴다 —
//   ⚠ 이것만이 이 모듈의 유일한 상태다 (`_tOff`). 덮인 동안 지나간 묶음을 버리는 값 하나다.
//
// ⚠ **원경의 돌고래는 거의 실루엣이다** (사용자 : *"바다 멀리서는 조금 자주 보이면 좋을 듯한데 거의 실루엣 형태로"*).
//   빛을 받은 색을 **알베도(= podColor) 쪽으로 눕혀** 실루엣을 만든다 (`podFlat` 1 이면 완전히 무광 한 색).
//   ⚠ 조명을 **끄는** 게 아니라 결과를 눕히는 것이라, 0 이면 예전과 비트 단위로 같다.
//   ⚠ 평평해져도 **휨은 여전히 읽힌다** — 꼬리가 오르내리면 실루엣의 윤곽 자체가 바뀐다.
//
// ⚠ **원경은 물과 같은 색으로 녹는다.** 거리 페이드(부표와 같은 커브)를 알파가 아니라 **색 섞기**로 준다 —
//   불투명한 채로 원경색에 다가가므로 정렬 문제가 없다. 그 원경색은 물의 `uBg` 를 **참조로** 받는다
//   (stage.js 가 태양 유니폼을 참조로 받는 것과 같은 규율 — 복사하면 그 순간 둘째 수평선이 생긴다).
//   ⚠ 페이드 구간은 **부표와 따로 간다** (`podFade0/1`) — 부표는 고르는 물건이라 가까워야 하지만
//     돌고래는 *"멀리서 자주"* 라 훨씬 멀리까지 살아 있어야 한다. 녹는 커브도 `podHazeExp` 로 늦춰
//     구간의 대부분에서 실루엣이 읽히고 **끝에서만** 물에 잠기게 한다.
//   ⚠⚠ **페이드 끝은 타일 반지름(wrapZ/2 = 50)을 넘을 수 없다.** 거리는 이음매를 건너도 연속이지만
//     (좌표 부호만 뒤집혀 √ 안이 같다) **자리는 100 만큼 튄다** — 거기서 아직 보이면 순간이동이 보인다.
//     그래서 아래에서 wrapZ 에서 잘라 낸다 (숫자를 두 곳에 적지 않는다).
//
// ⚠⚠ **수면 바로 밑을 유영하는 무리는 등지느러미만 내놓는다 — 물 밑을 그리지 않는다.**
//   처음에는 물의 **투과 채널**(submerged.js)에 얹었다. 돌아가긴 했지만 값이 비쌌다 —
//   패스 하나 · 배 둘레 `subReach` 안에서만 · 반해상도 · 물 셰이더에 깃발까지 넣어야 했고,
//   흩는 폭이 **수면 바로 밑의 큰 덩어리(선체)** 기준이라 몸집을 6.5월드까지 키워야 형체가 남았다
//   (사용자 : *"형체도 못알아보겠는데? 이거 일렁임이 너무 심함"* → *"정말 아래에서 유영한다는 느낌을
//   잘 표현할 필요는 없는데 다른 방법은?"*). 그래서 그 길을 **되돌리고** 이리로 왔다.
//   ⚠⚠ **수면 메시가 불투명하고 깊이를 쓴다** — 몸을 수면 바로 아래 두면 **물이 알아서 가려 준다.**
//     지느러미와 등 윗선만 내놓으면 그게 곧 "바로 밑에서 헤엄치는 돌고래" 다.
//     ⚠ 뛰는 무리가 물에 들어갈 때 꼬리까지 물이 깎아 주는 것을 이미 실측했다 (꺼질 때 수면 위 0.027).
//   얻는 것 : **패스 0 · 드로우콜 0** (뛰는 무리와 **같은 메시 · 같은 재질**에 자리만 더한다) ·
//     거리 제약 없음 (`subReach` 를 안 탄다) · 파도가 오르내리면 가려지는 선도 같이 움직인다.
//   ⚠ 지느러미 끝은 몸 중심에서 위로 `FIN_TOP × 몸길이` 다 (지오메트리에서 실측한다) — 그만큼 내려 두고
//     `podSwimFin` 만큼 내민다. `podSwimBob` 이 그 값을 오르내리게 해, 음수가 되면 통째로 잠겼다 다시 나온다.
//
// ⚠ 무리는 `InstancedMesh` 하나다 — **드로우콜 1개**, 몇 마리든 같다.
//   (이 저장소에서 `InstancedMesh` 를 쓰는 첫 자리다.)
//   ⚠ 실측 (2026-09-18 · 1431×862 · `renderer.info` 를 프레임마다 모아서 · podAmount 1 ↔ 0 비교) :
//     드로우콜 139.9 → **140.8 (+0.9)** · 삼각형 1,695,048 → **1,710,396 (+15,348 · +0.9%)**.
//     프레임당 CPU 는 `swellCPU` 를 **보이는 마리 수만큼**만 부른다 (배의 부력이 5번 부르는 것보다 적다).
//
// ⚠⚠ **시계는 물의 시계다** (`sim.qT`). dt 를 적분하지 않는다 — 점프 진행도도 무리의 자리도
//   `qT` 에서 바로 계산하는 **무상태**라, 탭이 쉬었다 돌아와도 물과 어긋나지 않는다 (불변식 1).
//   ⚠ 그래서 `camYaw` 를 **개발 중에 돌리면 무리의 자리가 한 번 튄다** (방위가 자리 적분에 들어 있다).
//     항해 중에 바뀌는 값이 아니라 그냥 둔다 — 존 구도의 `zoneYaw` 는 카메라만 돌리고 이 값을 안 건드린다.
//
// ⚠ **레이어는 기본(0)만이다.** 반사(reflect.js 레이어 2) · 물속(submerged.js) · 발광(bloom.js) 패스에
//   일부러 안 넣는다 — 원경이라 반사에 거의 안 보이는데 씬을 한 번 더 그리는 값은 그대로 나가고,
//   반사 패스는 전역 클리핑 평면 하나(`reflectSlice`)를 쓰고 있어 **점프 꼭대기가 어차피 잘린다.**
//
// ⚠ 부팅 신호(`bootReport`)를 보내지 않는다 — 앱의 로딩 커튼이 이 장식을 기다리면 안 된다.
//   배 GLB(8.3MB)와 달리 40KB 라 조용히 늦게 와도 티가 안 난다.
//
// 📌 **출처 표기 의무** : 이 모델은 CC-BY-4.0 (mano1creative · Sketchfab) 이다.
//   GLB 안 `asset.extras` 에 저자 · 라이선스 · 원본 주소가 들어 있다 (지우지 않는다).
//   서비스로 나가기 전에 **화면 어딘가에 크레딧 한 줄**이 필요하다 — 아직 이 저장소에 그 자리가 없다.

const GLB_URL = 'dolphin.glb';   // vite public/landing — base './' 라 상대 경로로 둔다 (boat.js 와 같다)

// 길이축 마디 수. ⚠ 숫자를 취향으로 적지 않았다 — 위 머리 주석의 실측 표에서 골랐다.
// 16 은 최대 걸침이 6% 로 남고, 32 는 3% 인데 삼각형이 3,330 이다. 원경에 작게 뜨는 물건이라 24 로 끊는다
const SEG = 24;
// 미리 잡아 두는 자리 수. `podCount` 는 이 안에서만 움직인다 — 슬라이더를 돌려도 메시를 다시 안 만든다.
// ⚠ 12 → 20 (2026-09-18) : 묶음 주기가 생기며 한 마리가 보이는 시간이 1/2.5 로 줄어 머릿수로 메운다.
//   ⚠ 20 → 26 (2026-09-18) : 유영 무리가 **같은 메시의 뒷자리**를 쓴다 (뛰는 20 + 유영 6).
//   인스턴스 하나는 2,558 삼각형이라 26 마리 = 66.5k = 씬(170만)의 3.9% 다
const MAX = 26;
// 무리 원점의 최대 개수 (`podGroups` 가 이 안에서 고른다)
const MAX_GROUPS = 6;

/** 재현 가능한 난수 — 새로고침마다 무리가 다른 자리에 서면 값을 판정할 수 없다 (marks.layout 과 같은 이유) */
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * 길이축(z)을 `seg` 등분해 삼각형을 자른다. **로드할 때 한 번만 돈다.**
 *
 * ⚠ 평면마다 전체를 다시 도는 게 아니라 **그 삼각형이 실제로 지나는 평면만** 자른다 —
 *   안 그러면 삼각형 314개 × 평면 23개 = 헛일 7,222번이다 (실제로 필요한 것은 그 일부다).
 * ⚠ 결과는 **인덱스 없는** 지오메트리다. 7.7k 정점 × (위치+법선) = 184KB — 인덱스를 아껴서 얻을 게 없다.
 */
function sliceZ(geo, seg) {
  const pos = geo.attributes.position, nrm = geo.attributes.normal, index = geo.index;
  const count = index ? index.count : pos.count;
  const at = (i) => {
    const k = index ? index.getX(i) : i;
    return { p: [pos.getX(k), pos.getY(k), pos.getZ(k)], n: [nrm.getX(k), nrm.getY(k), nrm.getZ(k)] };
  };
  const mix = (a, b, t) => ({
    p: [a.p[0] + (b.p[0] - a.p[0]) * t, a.p[1] + (b.p[1] - a.p[1]) * t, a.p[2] + (b.p[2] - a.p[2]) * t],
    n: [a.n[0] + (b.n[0] - a.n[0]) * t, a.n[1] + (b.n[1] - a.n[1]) * t, a.n[2] + (b.n[2] - a.n[2]) * t]
  });

  geo.computeBoundingBox();
  const z0 = geo.boundingBox.min.z, step = (geo.boundingBox.max.z - z0) / seg;
  const outP = [], outN = [];

  for (let i = 0; i < count; i += 3) {
    const tri = [at(i), at(i + 1), at(i + 2)];
    let polys = [tri];
    const zs = [tri[0].p[2], tri[1].p[2], tri[2].p[2]];
    const c0 = Math.max(1, Math.floor((Math.min(...zs) - z0) / step) + 1);
    const c1 = Math.min(seg - 1, Math.ceil((Math.max(...zs) - z0) / step) - 1);
    for (let c = c0; c <= c1; c++) {
      const z = z0 + c * step;
      const next = [];
      for (const poly of polys) {
        const lo = [], hi = [];
        for (let k = 0; k < poly.length; k++) {
          const a = poly[k], b = poly[(k + 1) % poly.length];
          const da = a.p[2] - z, db = b.p[2] - z;
          if (da <= 0) lo.push(a);
          if (da >= 0) hi.push(a);
          if ((da < 0 && db > 0) || (da > 0 && db < 0)) {
            const m = mix(a, b, da / (da - db));
            lo.push(m); hi.push(m);
          }
        }
        if (lo.length >= 3) next.push(lo);
        if (hi.length >= 3) next.push(hi);
      }
      polys = next;
    }
    // 볼록 다각형이므로 부채꼴로 삼각화한다
    for (const poly of polys)
      for (let k = 1; k + 1 < poly.length; k++)
        for (const v of [poly[0], poly[k], poly[k + 1]]) { outP.push(v.p[0], v.p[1], v.p[2]); outN.push(v.n[0], v.n[1], v.n[2]); }
  }

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(outP, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(outN, 3));
  return g;
}

/**
 * GLB 의 메시 한 장 → 길이 1 로 정규화하고 마디를 낸 지오메트리.
 *
 * ⚠⚠ **크기도 방향도 손으로 적지 않는다 — 실측해서 맞춘다** (boat.js 의 규율).
 *   원본 정점 좌표는 269.5 단위이고, 위쪽 래퍼 행렬 두 장(Sketchfab_model · Dolphin.fbx)이
 *   서로 상쇄돼 항등이라 로컬축이 그대로 월드축이다 — 그래도 곱해서 굽는다 (모델이 바뀌면 따라온다).
 * ⚠ 코가 **−z** 다 (실측 : Head 뼈가 쥔 정점의 z 평균 −79.6 · Tail 은 +138.1).
 *   배와 같은 규약이라(불변식 0-2 : 진행 방향 = 로컬 −z) 돌릴 것이 없다.
 */
function buildGeometry(mesh) {
  mesh.updateWorldMatrix(true, false);
  const geo = mesh.geometry.clone();
  geo.applyMatrix4(mesh.matrixWorld);
  // 스킨 흔적을 떨군다 — 이 지오메트리는 이제 뼈를 모른다
  geo.deleteAttribute('skinIndex');
  geo.deleteAttribute('skinWeight');
  geo.deleteAttribute('uv');          // 텍스처가 없는 모델이다 (재질이 baseColorFactor 한 색)

  geo.computeBoundingBox();
  const bb = geo.boundingBox, c = bb.getCenter(new THREE.Vector3());
  const len = Math.max(bb.max.z - bb.min.z, 1e-6);
  geo.translate(-c.x, -c.y, -c.z);
  geo.scale(1 / len, 1 / len, 1 / len);   // 길이 1 — 월드 크기는 podSize 하나가 정한다

  const out = sliceZ(geo, SEG);
  geo.dispose();
  out.computeBoundingBox();
  return out;
}

/**
 * @param scene
 * @param waterUni 물의 유니폼 묶음(`water.uni`). **참조로** 받는다 — 복사하면 물과 갈라진다.
 *   읽는 것은 둘이다 : 원경색 `uBg` · **거리 LOD** `uDetail0/1` (아래 detailAt 주석).
 */
export function createPod(scene, waterUni) {
  const group = new THREE.Group();
  group.name = 'pod';
  scene.add(group);

  let mesh = null, mat = null, geo = null, aK = null, aQ = null;
  // 지느러미 끝이 몸 중심에서 위로 얼마인가 (몸길이 1 기준). build 에서 지오메트리로 잰다
  let FIN_TOP = 0.165;
  let loading = false, failed = false;
  // ⚠ 이 모듈의 **유일한 상태** — 화면이 다 덮인 뒤 걷힐 때 옮기는 시계 원점 (위 머리 주석)
  let _tOff = 0, _hidePrev = 0;
  // 몸이 물 밑으로 다 들어가는 데 필요한 깊이 (몸 길이 1 기준). 지오메트리에서 낸다 — 아래 build()
  let BODY_R = 0.53;

  // 자리표 — 로드 전에 미리 뽑아 둔다 (무상태 계산이라 매 프레임 안 만든다)
  const R = rng(0x5D01F1);
  const slots = Array.from({ length: MAX }, (_, i) => ({
    grp: i % MAX_GROUPS,
    ox: (R() - 0.5) * 2,          // 무리 안의 자리 (podSpread 를 곱한다)
    oz: (R() - 0.5) * 2,
    ph: R(),                      // 점프 위상 — 한 무리 안에서도 차례로 뛴다
    lr: R(),                      // 한 묶음에 몇 번 뛰나 (podLeaps 를 곱해 1~podLeaps)
    // ⚠ 크기 **자체**가 아니라 편차 안의 **자리(0~1)** 다 — 실제 크기는 거리와 함께 update 의 szAt 이 푼다.
    //   (뽑는 횟수는 예전과 같다 — 여기서 하나 더 뽑거나 덜 뽑으면 아래 무리 자리가 통째로 갈린다)
    u: R()
  }));
  // 유영 무리 — 뛰는 무리와 **다른 자리**에 흩는다 (같은 씨앗 줄기에서 이어 뽑는다)
  const sSlots = Array.from({ length: 12 }, (_, i) => ({
    grp: i % MAX_GROUPS,
    ox: (R() - 0.5) * 2, oz: (R() - 0.5) * 2,
    ph: R(),                      // 오르내리는 위상
    u: R()                        // 크기 편차의 자리 — 뛰는 무리와 **같은 자**로 푼다 (szAt)
  }));
  const groups = Array.from({ length: MAX_GROUPS }, (_, g) => ({
    x: (R() - 0.5) * CONFIG.area.wrapZ,   // 타일 전체에 고르게 흩는다 (marks.layout 과 같은 규약)
    z: (R() - 0.5) * CONFIG.area.wrapZ,
    side: g % 2 ? -1 : 1,                 // 무리마다 화면 좌우로 갈라 지난다
    vary: R() - 0.5                       // 방위 흔들기 (podBearingVary 를 곱한다)
  }));
  // 유영 무리의 원점 — 같은 타일에 따로 흩는다 (뛰는 무리와 겹쳐 서면 한쪽만 붐빈다)
  const sGroups = Array.from({ length: MAX_GROUPS }, (_, g) => ({
    x: (R() - 0.5) * CONFIG.area.wrapZ,
    z: (R() - 0.5) * CONFIG.area.wrapZ,
    side: g % 2 ? -1 : 1,
    vary: R() - 0.5
  }));

  // 셰이더가 보는 값. ⚠ 유니폼 객체는 **참조로** 재질에 물린다 — 매 프레임 새로 만들지 않는다
  const uni = {
    uBend: { value: new THREE.Vector3(0.10, 1.15, 2.2) },   // x 진폭 · y 몸을 지나는 물결 수 · z 꼬리 쏠림 지수
    uSpan: { value: new THREE.Vector2(0, 1) },              // 길이축 [z최소, 1/(z최대−z최소)]
    uAirK: { value: 0.35 },                                 // 공중에서 몸이 펴지는 정도 (1 = 안 편다)
    // ⚠ 등·배 배색 (countershading). 돌고래는 등이 짙고 배가 밝다 — **회색 덩어리가 돌고래로 읽히게 하는 한 수**다.
    //   `uBodyY` 는 몸의 로컬 y 를 0(배)~1(등) 로 펴는 자다 (지오메트리에서 낸다).
    uBellyC: { value: new THREE.Color(0xB8BCC0) },
    uBodyY: { value: 3.03 },
    // ⚠ 물의 원경색을 **그 객체 그대로** 쓴다 (water.js 가 매 프레임 제자리에서 고친다)
    uFar: { value: waterUni ? waterUni.uBg.value : new THREE.Color(0xBFA898) }
  };

  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(0, 0, 0, 'YXZ');
  const _p = new THREE.Vector3(), _s = new THREE.Vector3();
  const _col = new THREE.Color(), _white = new THREE.Color(0xFFFFFF);
  let _colHex = '';

  /**
   * 몸 색. ⚠⚠ **시간대를 따라간다** (`CONFIG.times[i].pod` · times.js 의 규율 :
   *   *"표를 모듈마다 따로 읽으면 한 층만 낮에 남는다"*). 낮은 표가 비어 있어 `podColor` 를 쓴다.
   *   ⚠ 밤 바탕(#39425E)보다 **어두워야** 실루엣이 안 뒤집힌다 — 낮의 회색을 그대로 두면 3.7배 밝다.
   * ⚠ 문자열이라 파싱을 캐시한다 (dive.js 의 deepColor 와 같은 자리)
   */
  const bodyColor = () => {
    const TM = timeNow();
    const hex = (TM && TM.pod) || (P.podColor === undefined ? '#8A8F94' : P.podColor);
    if (hex !== _colHex) { _colHex = hex; _col.set(hex); }
    return _col;
  };

  const build = (src) => {
    geo = buildGeometry(src);
    const bb = geo.boundingBox;
    uni.uSpan.value.set(bb.min.z, 1 / Math.max(1e-6, bb.max.z - bb.min.z));
    // 몸을 길이축 둘레로 감싸는 반지름 — 어떤 자세로 기울어도 이만큼 내려가면 다 잠긴다
    BODY_R = Math.hypot(0.5 * (bb.max.z - bb.min.z), Math.max(Math.abs(bb.min.y), Math.abs(bb.max.y)));
    // 지느러미 끝 — 이만큼 내려 두어야 등만 내놓을 수 있다 (숫자를 적지 않는다)
    FIN_TOP = bb.max.y;
    // 등·배 자 — 몸의 로컬 y 를 0(배)~1(등) 로 편다 (숫자를 적지 않는다)
    uni.uBodyY.value = 0.5 / Math.max(1e-6, FIN_TOP);

    // ⚠⚠ **반투명이다** — 사라질 때 알파로 지운다 (사용자 : *"뭔가 뚝 끊기듯 사라지니 이상함"*).
    //   예전에는 물의 **원경색**(uBg)으로만 녹였는데, 그건 수평선 색이라 **중간 거리 바다 위에서는 안 사라진다** —
    //   페이드 끝까지 원경색 얼룩으로 남아 있다가 툭 꺼졌다. 색 녹임(원근)과 알파(사라짐)는 다른 일이다.
    //   ⚠ `depthWrite` 는 켜 둔다 — 몸은 속이 찬 물체라 서로 가려야 한다. 알파가 1 이 아닌 구간은
    //     페이드 끝(화면에서 몇 px)뿐이라 정렬 문제가 드러나지 않는다.
    //   ⚠ 물은 불투명이라 **먼저** 그려진다 — 물 밑의 몸은 깊이 검사에서 그대로 걸린다 (가려짐은 안 바뀐다).
    mat = new THREE.MeshStandardMaterial({ color: bodyColor().clone(), roughness: 0.78, metalness: 0.0,
      transparent: true, depthWrite: true });
    // ⚠⚠ 늦게 오는 GLB 는 main.js 의 `applyEnv()` 순회를 **놓친다** — 여기서 직접 맞춘다
    //   (boat.js 에서 이 줄이 빠져 GLB 만 3배 밝게 빛난 적이 있다)
    mat.envMapIntensity = P.envIntensity;

    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uBend = uni.uBend;
      sh.uniforms.uSpan = uni.uSpan;
      sh.uniforms.uAirK = uni.uAirK;
      sh.uniforms.uFar = uni.uFar;
      sh.uniforms.uBellyC = uni.uBellyC;
      sh.uniforms.uBodyY = uni.uBodyY;
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', `#include <common>
          attribute vec4 aK;      // x 공중에 뜬 정도 0~1 · y 꼬리질 위상 · z 원경에 녹은 정도 · w **꼬리질 축** (0 세로 · 1 좌우)
          uniform vec3 uBend;
          uniform vec2 uSpan;
          uniform float uAirK, uBodyY;
          attribute vec2 aQ;      // x 눕히는 정도(거리별) · y 알파 — 둘 다 마리마다 다르다
          varying float vHaze, vFlat, vAlpha, vBelly;
          float bW, bLat;         // 변위, 그리고 그 변위를 어느 축에 줄 것인가
          float bcX, bsX, bcY, bsY;   // 단면을 돌릴 cos · sin (가로축 · 세로축)`)
        // ⚠⚠ **법선이 위치보다 먼저다** (three 의 정점 셰이더 순서 : beginnormal → … → begin_vertex).
        //   그래서 휨을 여기서 다 풀고, 아래 begin_vertex 는 그 값을 쓰기만 한다
        .replace('#include <beginnormal_vertex>', `
          vHaze = aK.z;
          vFlat = aQ.x; vAlpha = aQ.y;
          // 등·배 자리 : 0 = 배 · 1 = 등 (uBodyY 가 몸의 로컬 y 를 그 범위로 편다)
          vBelly = clamp(position.y * uBodyY + 0.5, 0.0, 1.0);
          // ── 몸통 휨 : 길이축 자리 u(0 = 코 · 1 = 꼬리) 하나만 보는 연속 함수다
          float u = clamp((position.z - uSpan.x) * uSpan.y, 0.0, 1.0);
          // 꼬리로 갈수록 크게 — 코는 거의 안 움직인다 (머리가 점프 궤적 위에 그대로 있어야 한다)
          float amp = uBend.x * mix(1.0, uAirK, aK.x);
          float a = pow(u, uBend.z);
          float ph = 6.2831853 * (uBend.y * u - aK.y);
          bW = amp * a * sin(ph);
          // 기울기 dw/dz — 단면을 이만큼 돌린다. ⚠ 안 돌리면 몸통이 늘어나 보인다
          float dw = amp * uSpan.y * (uBend.z * pow(u, max(uBend.z - 1.0, 0.0)) * sin(ph)
                                    + a * 6.2831853 * uBend.y * cos(ph));
          float bC = inversesqrt(1.0 + dw * dw);
          float bS = dw * bC;
          // ⚠⚠ **꼬리질 축이 둘이다.** 뛰는 무리는 **세로** — 돌고래는 포유류라 꼬리를 위아래로 친다.
          //   유영 무리는 **좌우**다 (사용자 : *"꼬리를 위아래가 아니라 좌우로 흔들어야함"*) —
          //   이 씬의 카메라는 수면을 **내려다보므로** 위아래 움직임이 원근에 눌려 거의 안 보인다.
          //   좌우로 치면 그 움직임이 화면에 그대로 남는다. 생물학이 아니라 **시점**이 정하는 축이다.
          //   ⚠ 재질도 메시도 하나다 — 인스턴스 속성 하나(aK.w)로 갈린다.
          bLat = aK.w;
          bcY = mix(bC, 1.0, bLat); bsY = mix(bS, 0.0, bLat);
          bcX = mix(1.0, bC, bLat); bsX = mix(0.0, bS, bLat);
          vec3 objectNormal = vec3(normal.x * bcX + bS * bLat * normal.z,
                                   normal.y * bcY + bS * (1.0 - bLat) * normal.z,
                                   normal.z * bC - normal.y * bsY - normal.x * bsX);
          #ifdef USE_TANGENT
            vec3 objectTangent = vec3( tangent.xyz );
          #endif`)
        .replace('#include <begin_vertex>', `
          vec3 transformed = vec3(position.x * bcX + bW * bLat,
                                  position.y * bcY + bW * (1.0 - bLat),
                                  position.z - position.y * bsY - position.x * bsX);`);
      // ⚠ 원경으로 녹이는 것은 **알파가 아니라 색 섞기**다 — 불투명한 채로 물의 원경색에 다가간다.
      //   투명을 쓰면 정렬이 필요해지고, 파도 · 부표와 그리는 차례를 다투게 된다
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', `#include <common>
          uniform vec3 uFar, uBellyC;
          varying float vHaze, vFlat, vAlpha, vBelly;`)
        // ⚠ 등·배 배색은 **눕히기보다 먼저**다 — 눕히기가 이 알베도로 섞으므로 두 길이 같은 색을 본다
        .replace('#include <color_fragment>', `#include <color_fragment>
          diffuseColor.rgb = mix(uBellyC, diffuseColor.rgb, vBelly);`)
        // ⚠ 차례가 있다 : **먼저 눕히고(실루엣) 그다음 녹인다(원경).** 뒤집으면 멀리 있는 것이
        //   물빛에 녹은 뒤 다시 제 색으로 눕혀져 원경 페이드가 듣지 않는다
        .replace('#include <opaque_fragment>', `#include <opaque_fragment>
          gl_FragColor.rgb = mix(gl_FragColor.rgb, diffuseColor.rgb, vFlat);
          gl_FragColor.rgb = mix(gl_FragColor.rgb, uFar, vHaze);
          gl_FragColor.a = vAlpha;`);
    };

    mesh = new THREE.InstancedMesh(geo, mat, MAX);
    mesh.frustumCulled = false;     // ⚠ 인스턴스가 제각기 흩어져 있다 — 원본 바운딩으로 자르면 무리가 통째로 사라진다
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    aK = new THREE.InstancedBufferAttribute(new Float32Array(MAX * 4), 4);
    aK.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('aK', aK);
    aQ = new THREE.InstancedBufferAttribute(new Float32Array(MAX * 2), 2);
    aQ.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('aQ', aQ);
    mesh.count = 0;                 // 첫 update 가 정한다 — 그 전에는 한 마리도 안 그린다
    group.add(mesh);

  };

  const load = () => {
    if (loading || failed) return;
    loading = true;
    import('three/examples/jsm/loaders/GLTFLoader.js').then(({ GLTFLoader }) => {
      new GLTFLoader().load(GLB_URL, (gltf) => {
        let src = null;
        gltf.scene.traverse(o => { if (!src && o.isMesh) src = o; });
        if (!src) { failed = true; console.warn('돌고래 GLB 에 메시가 없다'); return; }
        build(src);
      }, undefined, (e) => { failed = true; console.warn('돌고래 GLB 로드 실패:', e); });
    }).catch(e => { failed = true; console.warn('GLTFLoader 를 못 불렀다:', e); });
  };

  return {
    group,

    /**
     * @param sim     물 시뮬 (qT · qScroll 을 읽는다 — 물과 같은 시계·자리)
     * @param scroll  항해 위치 (`nav.scroll`). 씬 좌표 = (x − scroll.x, z + scroll.z) · 불변식 0-2
     * @param cam     본 카메라 — '배보다 뒤인가' 를 이 시선으로 잰다 (없으면 `camYaw` 로 대신한다)
     * @param hide    연출이 비키라고 넘기는 값 0~1 (`max(cl, travel.fog)`). 1 이면 전부 물 밑이다
     */
    update(sim, { scroll, cam, hide }) {
      const amt = P.podAmount === undefined ? 1 : P.podAmount;
      const sAmt = P.podSwim === undefined ? 1 : P.podSwim;
      // ⚠⚠ **`podAmount` 는 뛰는 무리만 끈다.** 유영 무리는 `podSwim` 이 따로 쥔다 —
      //   여기서 함께 return 하면 `podAmount 0` 이 유영 무리까지 조용히 죽인다 (실제로 그랬다).
      //   둘 다 0 이어야 통째로 쉰다. ⚠ 0 이면 **비트 단위 롤백**이다 (diveAmount · stageAmount 와 같은 패턴)
      if (amt <= 0 && sAmt <= 0) { group.visible = false; return; }
      group.visible = true;
      if (!mesh) { load(); return; }

      const n = amt <= 0 ? 0 : Math.min(MAX, Math.max(0, Math.round(P.podCount === undefined ? 6 : P.podCount)));
      const gN = Math.min(MAX_GROUPS, Math.max(1, Math.round(P.podGroups === undefined ? 3 : P.podGroups)));
      const size = (P.podSize === undefined ? 0.7 : P.podSize) * CONFIG.boat.lengthW;
      const spread = P.podSpread === undefined ? 5 : P.podSpread;
      const speed = P.podSpeed === undefined ? 2.6 : P.podSpeed;
      const period = Math.max(0.5, P.podPeriod === undefined ? 4.2 : P.podPeriod);
      const high = Math.max(1e-3, P.podHeight === undefined ? 0.9 : P.podHeight);
      const grav = Math.max(0.1, P.podGravity === undefined ? 9.8 : P.podGravity);
      // 공중에 있는 시간 — **중력이 정한다** (위 머리 주석). 크기 편차는 마리마다 아래에서 √ 로 붙인다
      const tAir = 2 * Math.sqrt(2 * high / grav);
      // ⚠⚠ **배수다 (0~1 이 아니다).** 1 = 물의 안개와 똑같이 — 아래 hazeAt
      const haze = Math.max(0, P.podHaze === undefined ? 1 : P.podHaze);
      const hazeExp = Math.max(0.2, P.podHazeExp === undefined ? 1 : P.podHazeExp);
      const leaps = Math.max(1, Math.round(P.podLeaps === undefined ? 3 : P.podLeaps));
      const rest = Math.max(0, P.podRest === undefined ? 3 : P.podRest);
      const near = Math.max(0, P.podNear === undefined ? 16 : P.podNear);
      const behind = Math.max(0.5, P.podBehind === undefined ? 12 : P.podBehind);
      const hideK = clamp(hide === undefined ? 0 : hide, 0, 1);
      // 방위는 카메라 기준이다 (머리 주석) — camYaw 가 '카메라에서 똑바로 멀어지는' 값이고 거기서 튼다
      const yaw0 = (P.camYaw === undefined ? -52.1 : P.camYaw) * D2R;
      const bear = (P.podBearing === undefined ? 55 : P.podBearing) * D2R;
      const bvary = (P.podBearingVary === undefined ? 30 : P.podBearingVary) * D2R;
      const WZ = CONFIG.area.wrapZ;
      const wrapP = (v) => (((v + WZ / 2) % WZ) + WZ) % WZ - WZ / 2;
      // ⚠ 끝은 타일 반지름에서 자른다 (위 머리 주석의 이음매 순간이동)
      const fade1 = Math.min(WZ * 0.5, Math.max(2, P.podFade1 === undefined ? 48 : P.podFade1));
      const fade0 = clamp(P.podFade0 === undefined ? 26 : P.podFade0, 0, fade1 - 1);

      uni.uBend.value.set(
        P.podBendAmp === undefined ? 0.10 : P.podBendAmp,
        P.podBendWaves === undefined ? 1.15 : P.podBendWaves,
        Math.max(0.2, P.podBendExp === undefined ? 2.2 : P.podBendExp));
      uni.uAirK.value = clamp(P.podBendAir === undefined ? 0.35 : P.podBendAir, 0, 1);
      // ── 거리로 함께 푸는 세 규칙 (fade 1 = 가깝다 · 0 = 페이드 끝). 아래 두 고리에서 같은 식을 쓴다
      //   ⚠⚠ **사라짐은 알파다.** 예전에는 원경색으로만 녹였는데 그 색은 **수평선 색**이라 중간 거리
      //     바다 위에서는 안 사라지고 얼룩으로 남았다가 툭 꺼졌다 (사용자 : *"뚝 끊기듯 사라지니 이상함"*).
      //     색 녹임(`podHaze` · 공기원근)과 사라짐(`podFadeOut` · 알파)은 다른 일이라 따로 둔다.
      //   ⚠ 눕히기는 **거리의 함수**다 — 가까우면 빛을 받고 멀수록 납작한 그림자가 된다 (디테일이 거리와 함께 죽는다).
      //   ⚠ 크기는 원근보다 **조금 크게** 잡는다 — 이 씬의 페이드 구간이 카메라로부터 58~84 라
      //     제대로 된 원근으로는 몸이 10px 안팎이다 (영화·게임에서 쓰는 눈속임이다).
      const flatFar = clamp(P.podFlat === undefined ? 0.85 : P.podFlat, 0, 1);
      const flatNear = clamp(P.podFlatNear === undefined ? 0.35 : P.podFlatNear, 0, 1);
      // ⚠ **음수를 허용한다** — 0 이 정직한 원근이고 음수는 그보다 더 작게 (과장된 원근).
      //   −1 이면 몸이 사라지므로 −0.9 에서 자른다
      const sizeFar = Math.max(-0.9, P.podSizeFar === undefined ? -0.1 : P.podSizeFar);
      const fadeOut = clamp(P.podFadeOut === undefined ? 0.35 : P.podFadeOut, 0.02, 1);
      // ── 크기 편차를 **거리에서 푼다** (2026-09-19)
      //   ⚠⚠ **편차를 거리와 떼어 두면 원근이 뒤집힌다.** 예전에는 마리마다 0.82~1.18 을 고정으로 들고
      //     있었고 거기에 원경 보정(sizeFar)이 곱해져, 페이드 끝의 큰 마리가 가까운 작은 마리보다
      //     **화면에서 1.59배 컸다** — 카메라 거리는 58 → 84 로 1.45배밖에 안 멀어지는데 몸이 1.89배가 됐다.
      //     사용자 : *"멀리있어도 그런 오브젝트 사이즈에대한 편차의 랜덤한 값때문에 멀리있는 돌고래가 너무 크게 보임.
      //     배 기준에서 멀리 있는 오브젝트는 확실히 작은 돌고래 오브젝트가 생성되었으면 좋겠음"*.
      //   그래서 슬롯이 든 것은 **편차의 자리(S.u · 0~1)뿐**이고 크기는 여기서 거리와 함께 난다 :
      //   멀수록 자리를 작은 쪽으로 당기므로 **폭과 중심이 같이 내려간다** (podSizeVaryFar 1 = 끝에서는 늘 최소).
      //   ⚠ 두 무리가 **같은 자**를 쓴다 (예전에는 뛰는 무리 ±0.18 · 유영 무리 ±0.15 로 갈려 있었다).
      //   ⚠ 거리의 연속 함수다 — 한 마리가 헤엄쳐 멀어지는 동안 값이 천천히 따라 내려간다 (튀는 지점이 없다).
      //   실측 (화면에서 잰 것 · 1280×630 · 스크롤 169자리 × 시계 12점 · 표본 3천) :
      //     **배로부터의 거리별 평균 화면 크기가 52.5 → 29.6px 로 단조 감소한다 (먼 쪽 ÷ 가까운 쪽 0.56).**
      //     예전 셋에서는 53 → 58px 로 **늘었다** (1.08). ⚠ 이 수는 원경 보정 −0.1 · 안개를 물에 묶은 뒤의 값이다.
      //   ⚠⚠ **그래도 «먼 한 마리가 가까운 한 마리보다 크게» 보이는 짝은 남는다 (실측 2.06배 → 1.44배).**
      //     남은 것은 크기 규칙이 아니라 **자리**에서 온다 — 배로부터 같은 거리라도 배 뒤 반원에 흩어지므로
      //     카메라 거리가 √(35.8² + d²) ~ (35.8 + d) 로 **1.4배까지 갈린다** (머리 주석의 함정 : 화면 픽셀을
      //     정하는 것은 배가 아니라 카메라 거리다). 그 몫까지 지우려면 fade 를 카메라 거리에서 재야 한다.
      const vary = clamp(P.podSizeVary === undefined ? 0.18 : P.podSizeVary, 0, 0.6);
      const varyFar = clamp(P.podSizeVaryFar === undefined ? 1 : P.podSizeVaryFar, 0, 1);
      const szAt = (u, fade) => 1 - vary + 2 * vary * u * (1 - varyFar * (1 - fade));
      mat.color.copy(bodyColor());
      // 배 색 — 몸 색을 흰 쪽으로 당긴다. ⚠ 시간대가 바뀌면 몸 색이 바뀌므로 **매 프레임 다시 섞는다**
      uni.uBellyC.value.copy(mat.color).lerp(_white, clamp(P.podBelly === undefined ? 0.45 : P.podBelly, 0, 1));
      mat.envMapIntensity = P.envIntensity;

      // ⚠ 화면을 다 덮었다가 걷히는 순간 **처음부터 다시 재생**한다 (위 머리 주석)
      if (_hidePrev > 0.99 && hideK <= 0.99) _tOff = sim.qT;
      _hidePrev = hideK;
      const t = sim.qT - _tOff;

      // 카메라 전방(수평). 배가 씬 원점이므로 자리의 이 성분이 양수면 **배보다 뒤**다 (불변식 0-2)
      let fwdX, fwdZ;
      if (cam) { const e = cam.matrixWorld.elements; fwdX = -e[8]; fwdZ = -e[10]; }
      else { fwdX = -Math.sin(yaw0); fwdZ = -Math.cos(yaw0); }
      const fl = Math.hypot(fwdX, fwdZ) || 1; fwdX /= fl; fwdZ /= fl;

      // ⚠⚠ **물의 거리 LOD 를 CPU 도 같이 본다.** 물은 카메라에서 멀어질수록 잔물결 대역을 서서히 끈다
      //   (water.js 정점 셰이더의 `detail` — 원경에서는 파장이 한 픽셀 밑이라 그릴수록 손해다).
      //   그런데 `swellCPU` 는 기본이 detail 1 이라 **원경에서 CPU 만 더 높은 수면을 본다** —
      //   그만큼 몸이 떠올라 사용자에게 *"거리가 멀어지니 높은 파도에서 유영하는게 보인다"* 로 보였다.
      //   ⚠ 문턱은 물의 유니폼을 **그대로** 읽는다 (`uDetail0/1` · 카메라 거리 배율 kD 와 항공뷰가 이미 들어 있다).
      //     숫자를 여기 적으면 카메라를 물릴 때 둘이 조용히 갈라진다 (stage.js 가 태양을 참조로 받는 것과 같은 규율).
      //   ⚠ 거리는 **카메라 기준**이다 — 물도 `uCam` 에서 잰다 (배 기준이 아니다).
      const dt0 = waterUni ? waterUni.uDetail0.value : 1e9;
      const dt1 = waterUni ? waterUni.uDetail1.value : 1e9 + 1;
      const camX = cam ? cam.position.x : 0, camZ = cam ? cam.position.z : 0;
      const detailAt = (x, z) => {
        const e = clamp((Math.hypot(x - camX, z - camZ) - dt0) / Math.max(1e-6, dt1 - dt0), 0, 1);
        return 1 - e * e * (3 - 2 * e);   // GLSL smoothstep 과 같은 식
      };
      // ⚠⚠ **원경 안개도 물과 같은 자로 잰다** (2026-09-19 · 위 detailAt 과 같은 규율).
      //   사용자 : *"메인페이지 바다가 멀리 떨어질 수록 뿌옇게 표현되고있는걸 돌고래에게도 더 크게 적용해서
      //   실루엣만 거의 보이게 해주면 좋음"*. 예전에는 돌고래만 제 커브(배로부터의 fade 의 제곱)를 썼고
      //   그게 **물의 절반**이었다 — 실측 : 배로부터 35(카메라 71)에서 물 0.50 vs 돌고래 0.25.
      //   바다만 멀어지고 돌고래는 안 멀어지니 원근이 안 읽힌 것이다.
      //   지금은 water.js 의 `vis` 와 **같은 식**이다 : smoothstep(uFade0, uFade1, 카메라 거리).
      //   ⚠ 숫자를 여기 적지 않는다 — 물은 uFade0/1 에 카메라 거리 배율(kD)을 이미 곱해 두었고,
      //     적는 순간 카메라를 물릴 때 둘이 조용히 갈라진다.
      //   ⚠ **거리는 카메라 기준이다** (배가 아니라) — 화면의 뿌옇기를 정하는 것이 그것이다.
      //   ⚠ 남은 갈림 하나 : 물은 그 자리에서 **하늘색**으로 녹고(water.js 의 far) 돌고래는 `uBg` 로 녹는다.
      //     수평선 근처에서는 거의 같지만 haze 가 1 에 닿으면 색이 갈린다 — 그래서 배수를 1.2 아래로 둔다.
      const hz0 = waterUni ? waterUni.uFade0.value : 47.5;
      const hz1 = waterUni ? waterUni.uFade1.value : 95;
      const hazeAt = (x, z) => {
        const e = clamp((Math.hypot(x - camX, z - camZ) - hz0) / Math.max(1e-6, hz1 - hz0), 0, 1);
        const sm = e * e * (3 - 2 * e);                      // GLSL smoothstep 과 같은 식 (물과 같다)
        return clamp((hazeExp === 1 ? sm : Math.pow(sm, hazeExp)) * haze, 0, 1);
      };
      // 물 밖으로 나오기 **전과 후**로 넘겨 잡는 몫. 몸이 어떤 자세로 기울어도 다 잠길 만큼 깊이 —
      //   포물선의 깊이 4m(1+m)·podHeight 가 몸 반지름(BODY_R × 크기)을 넘게 푼다.
      //   ⚠ 크기 편차(szAt)는 깊이와 몸에 똑같이 곱해져 약분된다 — 그래서 한 번만 푼다
      const MARGIN_BODY = 0.5 * (Math.sqrt(1 + BODY_R * size / high) - 1);

      for (let i = 0; i < n; i++) {
        const S = slots[i], G = groups[S.grp % gN];
        // 무리의 방위 : 카메라에서 멀어지는 방향(yaw0)에서 좌우로 튼다
        const head = yaw0 + G.side * bear + G.vary * bvary;
        const sinH = Math.sin(head), cosH = Math.cos(head);
        // ⚠⚠ **보는 방향 그대로 나아간다** — `rotation.y = head` 인 몸이 보는 방향이 (−sin, −cos) 라
        //   자리도 같은 부호로 민다. 부호 하나가 어긋나면 옆걸음질한다 (머리 주석)
        // ⚠ 자리도 **무상태**다 — qT 에서 바로 낸다 (적분하면 점프 위상과 조용히 갈라진다)
        const wx = G.x - sinH * speed * t + (S.ox * cosH - S.oz * sinH) * spread;
        const wz = G.z - cosH * speed * t + (S.ox * sinH + S.oz * cosH) * spread;
        const sx = wrapP(wx - scroll.x), sz = wrapP(wz + scroll.z);

        // 거리 페이드 — 돌고래 제 구간이다 (부표보다 훨씬 멀리). 0 이면 **계산을 더 안 한다** (물높이 표본이 여기서 걸린다)
        const dist = Math.hypot(sx, sz);
        const fade = 1 - clamp((dist - fade0) / (fade1 - fade0), 0, 1);
        if (fade <= 0.001) { _m.makeScale(0, 0, 0); mesh.setMatrixAt(i, _m); continue; }

        // ── 게이트 셋 (곱한다) : 배 둘레 비우기 · 배보다 뒤 · 연출이 비키라 한 만큼
        const gNear = clamp((dist - near) / Math.max(1, fade0 - near), 0, 1);
        const gBack = clamp((sx * fwdX + sz * fwdZ) / behind, 0, 1);
        const gate = gNear * gBack * (1 - hideK);

        // ── 묶음 주기 : N 번 뛰고 rest 주기를 쉰다 (마리마다 N 이 다르다)
        const N = 1 + Math.floor(S.lr * leaps);
        const cyc = N + rest;
        const c = (t / period + S.ph * cyc) % cyc;
        if (c >= N || gate <= 0.002) { _m.makeScale(0, 0, 0); mesh.setMatrixAt(i, _m); continue; }

        // 이 마리의 크기 — **거리에서 푼다** (위 szAt). 멀수록 작은 쪽으로 쏠린다
        const szI = szAt(S.u, fade);
        // 이 마리의 호 — 몸이 크면 통째로 커지므로 공중 시간은 √szI 배다 (중력은 같다).
        // ⚠ 그래서 **먼 마리는 낮게 뛴다** — 몸만 작아지고 호는 그대로면 몸 길이 대비 너무 높이 솟는다
        const rt = Math.sqrt(szI);
        const hgt = high * szI;                        // 꼭대기 높이
        const air = clamp(tAir * rt / period, 0.05, 0.95);   // 주기 중 물 밖에 있는 몫 — **derived**
        const leap = Math.max(1e-3, speed * tAir * rt);      // 그동안 덮는 가로 거리
        // ⚠ 잠기는 여유는 주기를 넘지 않게 자른다 (주기가 공중 시간에 가까우면 꼬리가 늦게 잠긴다)
        const MARGIN = Math.min(MARGIN_BODY, Math.max(0, (1 / air - 1) * 0.5));

        // 이 주기 안의 진행도
        const k = c - Math.floor(c);
        // 포물선 자리. 0 → 1 이 물 밖이고, 앞뒤로 MARGIN 만큼은 물 밑이다 (다 잠긴 뒤에 꺼진다)
        const ka = k / air - MARGIN;
        if (ka > 1 + MARGIN) { _m.makeScale(0, 0, 0); mesh.setMatrixAt(i, _m); continue; }

        const hop = 4 * ka * (1 - ka);              // 포물선 (꼭대기 1 · 양 끝 밖은 음수 = 물속)
        const wy = swellCPU(sx + sim.qScroll.x, sz - sim.qScroll.z,
          sim.qT * P.waveSpeed, P.oceanSwell, P.ripple, P.gerstner, detailAt(sx, sz));

        // 자세 : 코(−z)가 궤적의 접선을 본다. tan(pitch) = (세로 속도)/(가로 속도) = 4h(1−2ka)/D
        const pitch = Math.atan2(4 * hgt * (1 - 2 * ka), leap);
        _e.set(pitch, head, 0);
        _q.setFromEuler(_e);
        // ⚠ 게이트가 덜 열렸으면 호를 **물 밑으로 내린다** — 지우는 게 아니라 잠기는 것이라 경계에서 안 튄다.
        //   gate 0 이면 꼭대기조차 몸 반지름만큼 수면 아래다 (그 전에 이미 꺼지지만 거기까지 이어진다)
        _p.set(sx, wy + hop * hgt - (1 - gate) * (hgt + BODY_R * size * szI), sz);
        // 거리로 푸는 셋 — 눕히기 · 알파 · 크기 보정 (위 주석)
        const eF = clamp(fade / fadeOut, 0, 1);
        const alphaI = eF * eF * (3.0 - 2.0 * eF);       // smoothstep — 끝에서만 스르르 지운다
        const flatI = flatNear + (flatFar - flatNear) * (1 - fade);
        const sc = size * szI * (1 + sizeFar * (1 - fade));
        _s.set(sc, sc, sc);
        _m.compose(_p, _q, _s);
        mesh.setMatrixAt(i, _m);

        // 셰이더로 넘기는 셋. ⚠ 꼬리질 위상은 점프 주기에 **정수 배**로 물려 둔다 —
        //   그래야 주기가 감길 때 꼬리가 안 튄다 (튀는 순간이 물속이라 안 보이긴 한다)
        aK.array[i * 4] = clamp(hop, 0, 1);
        aK.array[i * 4 + 1] = k * Math.max(1, Math.round(P.podBeats === undefined ? 3 : P.podBeats)) + S.ph;
        // 멀수록 물의 원경색으로 녹는다 — **물과 같은 자**다 (위 hazeAt)
        aK.array[i * 4 + 2] = hazeAt(sx, sz);
        aK.array[i * 4 + 3] = 0;             // 꼬리질 축 — 뛰는 무리는 **세로** (포유류의 꼬리)
        aQ.array[i * 2] = flatI; aQ.array[i * 2 + 1] = alphaI;
      }


      // ───────── 수면 바로 밑을 유영하는 무리 — 등지느러미만 내놓는다 ─────────
      // ⚠ **뛰는 무리와 같은 메시의 뒷자리**를 쓴다 (n 번부터) — 재질도 드로우콜도 그대로다.
      //   물 밑의 몸은 불투명한 수면이 가려 준다 (머리 주석) — 그릴 것도, 패스도 없다.
      const sN = sAmt <= 0 ? 0 : Math.min(MAX - n, sSlots.length,
        Math.max(0, Math.round(P.podSwimCount === undefined ? 6 : P.podSwimCount)));
      if (sN > 0) {
        const sSpeed = P.podSwimSpeed === undefined ? 1.1 : P.podSwimSpeed;
        const sPeriod = Math.max(1, P.podSwimPeriod === undefined ? 6 : P.podSwimPeriod);
        const fin = P.podSwimFin === undefined ? 0.12 : P.podSwimFin;
        const bob = Math.max(0, P.podSwimBob === undefined ? 0.2 : P.podSwimBob);
        // ⚠⚠ **몸집도 속도도 뛰는 무리와 따로다** (사용자 : *"크기를 더 작게해서 조금 빠르게 바다를 지나가는 느낌"*).
        //   수면에 나오는 것은 등 한 줄이라 크게 만들어도 안 읽힌다 — 읽히는 것은 **움직임**이다.
        //   그래서 작게(배 길이의 0.45 = 2.25월드) · 빠르게(3.5 월드/초 · 배의 최고 속도는 1.0) 지나간다.
        const sSize = (P.podSwimSize === undefined ? 0.45 : P.podSwimSize) * CONFIG.boat.lengthW;
        const sBeat = P.podSwimBeat === undefined ? 2.2 : P.podSwimBeat;   // 초당 꼬리질 횟수
        const W2 = 2 * Math.PI / sPeriod;
        for (let j = 0; j < sN; j++) {
          const i = n + j, S = sSlots[j], G = sGroups[S.grp % gN];
          const head = yaw0 + G.side * bear + G.vary * bvary;
          const sinH = Math.sin(head), cosH = Math.cos(head);
          const wx = G.x - sinH * sSpeed * t + (S.ox * cosH - S.oz * sinH) * spread;
          const wz = G.z - cosH * sSpeed * t + (S.ox * sinH + S.oz * cosH) * spread;
          const sx = wrapP(wx - scroll.x), sz = wrapP(wz + scroll.z);
          const dist = Math.hypot(sx, sz);
          const fade = 1 - clamp((dist - fade0) / (fade1 - fade0), 0, 1);
          // ⚠⚠ **게이트가 뛰는 무리와 다르다 — 배 뒤 조건이 없고 둘레도 좁다.**
          //   그 둘은 *"배와 화면 사이에는 연출을 줄여야함"* 때문에 넣은 것인데, 여기 나오는 것은
          //   **지느러미와 등 한 줄**뿐이라 화면을 가리지 않는다. 오히려 배 가까이 있어야 보인다 —
          //   실측 : 내민 높이 0.9월드가 배로부터 20 에서 화면 15px 이다 (거리에 반비례한다).
          //   ⚠ 클로즈업·이동(hide)에는 뛰는 무리와 똑같이 비킨다 — 그때는 카메라가 수면에 바짝 붙는다.
          const sNear = Math.max(0, P.podSwimNear === undefined ? 8 : P.podSwimNear);
          const gate = clamp((dist - sNear) / Math.max(1, fade0 - sNear), 0, 1) * (1 - hideK);
          if (fade <= 0.001 || gate <= 0.002) { _m.makeScale(0, 0, 0); mesh.setMatrixAt(i, _m); continue; }
          const sea = swellCPU(sx + sim.qScroll.x, sz - sim.qScroll.z,
            sim.qT * P.waveSpeed, P.oceanSwell, P.ripple, P.gerstner, detailAt(sx, sz));
          const eF = clamp(fade / fadeOut, 0, 1);
          const alphaI = eF * eF * (3.0 - 2.0 * eF);
          const flatI = flatNear + (flatFar - flatNear) * (1 - fade);
          const sc = sSize * szAt(S.u, fade) * (1 + sizeFar * (1 - fade));
          // 수면 위로 내민 높이. ⚠ 음수면 통째로 잠긴다 — 물이 가려 주므로 **그대로 두면 된다**
          //   (숨 쉬러 올라왔다 내려가는 리듬이 여기서 공짜로 나온다).
          //   ⚠ 게이트가 덜 열렸으면 더 내린다 — 지우는 게 아니라 잠기는 것이라 경계에서 안 튄다
          const wob = Math.sin(W2 * t + S.ph * 6.2831853);
          // ⚠⚠ **몸이 물 위로 통째로 뜨지 않게 자른다** (사용자 : *"멀리서 유영하는 오브젝트가 물위에
          //   날아다니는 경우도 있음"*). 몸의 바닥은 중심에서 아래로 FIN_TOP × 몸길이이므로,
          //   내민 높이가 그 **두 배**를 넘으면 배 밑이 수면 위로 올라온다. 0.8 을 곱해 여유를 둔다.
          const outMax = 2 * FIN_TOP * sc * 0.8;
          const out = Math.min(fin + bob * wob, outMax) - (1 - gate) * (outMax + 0.4 * sc);
          // ⚠ **지느러미 끝을 기준으로 앉힌다** — 중심이 아니라 끝이 수면에서 out 만큼 나온다
          _p.set(sx, sea + out - FIN_TOP * sc, sz);
          // 자세 : 오르내리는 기울기. ⚠ 각을 잘라 둔다 — 속도가 0 에 가까우면 atan2 가 몸을 **수직으로 세운다**
          const pitch = clamp(Math.atan2(bob * W2 * Math.cos(W2 * t + S.ph * 6.2831853),
            Math.max(0.05, sSpeed)), -0.3, 0.3);
          _e.set(pitch, head, 0);
          _q.setFromEuler(_e);
          _s.set(sc, sc, sc);
          _m.compose(_p, _q, _s);
          mesh.setMatrixAt(i, _m);
          aK.array[i * 4] = 0;                 // 공중에 뜬 정도 — 늘 물속이라 0 (휨이 가장 크다)
          aK.array[i * 4 + 1] = t * sBeat + S.ph;   // ⚠ 오르내림(sPeriod)과 **따로 돈다** — 꼬리는 훨씬 빠르다
          aK.array[i * 4 + 2] = hazeAt(sx, sz);
          aK.array[i * 4 + 3] = 1;             // 꼬리질 축 — 유영 무리는 **좌우** (위에서 보면 그래야 읽힌다)
          aQ.array[i * 2] = flatI; aQ.array[i * 2 + 1] = alphaI;
        }
      }

      // ⚠ 안 보이는 마리도 **자리를 지킨다** (크기 0). 인스턴스를 건너뛰면 남은 것을 앞으로 당겨야 하는데,
      //   그러면 슬롯 i 와 aK[i] 가 어긋난다 — 크기 0 삼각형은 래스터라이저에서 그대로 버려진다
      mesh.count = n + sN;
      mesh.visible = (n + sN) > 0;
      mesh.instanceMatrix.needsUpdate = true;
      aK.needsUpdate = true;
      aQ.needsUpdate = true;                       // 인스턴스 4 float — 프레임당 416바이트가 전부다
    },

    /** ⚠ 새 모듈은 main.js 의 disposeAll 에 등록한다 (불변식 10) */
    dispose() {
      if (mesh) { group.remove(mesh); mesh.dispose(); }
      if (geo) geo.dispose();
      if (mat) mat.dispose();
      scene.remove(group);
      mesh = null; geo = null; mat = null; aK = null;
    }
  };
}
