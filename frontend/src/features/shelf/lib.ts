import type { PerfumeOption, ShelfItem, ShelfSection } from './types'

/**
 * 진열대 향수를 "고를 수 있는 향수" 모양으로 바꿉니다.
 *
 * 등록 모달(A15)과 컬렉션 추가 모달(A19)이 같은 네 필드를 받습니다. 화면마다 map 을
 * 손으로 적으면 한쪽만 고쳤을 때 모달이 조용히 빈 값을 받습니다.
 */
export function toPerfumeOption(item: ShelfItem): PerfumeOption {
  return {
    perfumeId: item.perfumeId,
    name: item.name,
    brand: item.brand,
    thumbnailUrl: item.thumbnailUrl,
  }
}

/**
 * 메모를 마지막으로 쓴 날을 `YYYY.MM.DD` 로.
 *
 * 백엔드가 UTC ISO 를 주는데 **보는 사람의 지역 날짜**로 옮깁니다 — UTC 로 자르면
 * 한국에서 밤 9시 이후에 쓴 메모가 다음 날로 보입니다.
 */
export function formatShelfDate(iso: string | null): string | null {
  if (!iso) return null
  const at = new Date(iso)
  if (Number.isNaN(at.getTime())) return null

  const pad = (value: number) => String(value).padStart(2, '0')
  return `${at.getFullYear()}.${pad(at.getMonth() + 1)}.${pad(at.getDate())}`
}

/**
 * 향수 이름 앞에 붙은 브랜드를 뗍니다. 이름표는 첫 줄에 브랜드를 따로 적어서, 이름에도
 * 브랜드가 붙어 있으면 "조말론 / 조 말론 우드 세이지 앤 씨 솔트" 처럼 같은 말이 두 번 보입니다.
 *
 *   ('조 말론 우드 세이지 앤 씨 솔트', '조말론') → '우드 세이지 앤 씨 솔트'  띄어쓰기가 달라도 같은 브랜드
 *   ('입생로랑 리브르', '입생로랑뷰티')          → '리브르'                  브랜드의 앞부분만 적힌 경우
 *   ('디올 미스 디올', '디올')                   → '미스 디올'               앞에서 한 번만
 *   ('블루 드 샤넬', '샤넬')                     → 그대로                    브랜드로 시작하지 않음
 *
 * 앞 낱말을 이어 붙인 것이 브랜드(띄어쓰기 · 대소문자 무시)의 앞부분이고, 브랜드의 절반
 * (최소 두 글자) 이상일 때만 뗍니다. 한두 글자가 우연히 겹친 이름까지 자르지 않으려는 것입니다.
 * 이름이 브랜드뿐이면 비우지 않고 그대로 둡니다.
 */
export function nameWithoutBrand(name: string, brand: string | null): string {
  // 브랜드를 모르면 뗄 것도 없습니다
  if (brand === null) return name

  const key = brand.replace(/\s+/g, '').toLowerCase()
  const words = name.trim().split(/\s+/)
  const least = Math.max(2, Math.ceil(key.length / 2))

  let joined = ''
  let cut = 0
  // 마지막 낱말은 남깁니다 — 이름이 통째로 사라지면 안 됩니다
  for (let at = 0; at < words.length - 1; at += 1) {
    joined += words[at]?.toLowerCase() ?? ''
    if (!key.startsWith(joined)) break
    if (joined.length >= least) cut = at + 1
  }
  return cut > 0 ? words.slice(cut).join(' ') : name
}

/** 줄에 매달린 이름표 하나의 흔들림 */
export type Swing = {
  /** 기울기(라디안). 양수면 시계 방향 — 태그 아랫단이 왼쪽으로 갑니다 */
  angle: number
  /** 각속도(라디안/초) */
  speed: number
}

export type SwingOptions = {
  /** 고유 진동수(라디안/초) = 2π / 주기 */
  omega: number
  /** 감쇠비. 0 이면 영원히 흔들리고, 1 이면 한 번도 안 넘어가고 멈춥니다 */
  damping: number
  /** 매단 점의 가속도(px/s²)를 각가속도로 바꾸는 비율 */
  gain: number
  /** 기울기 한도(라디안) */
  limit: number
}

/**
 * 줄에 매달린 이름표를 한 프레임만큼 흔듭니다(감쇠 진자).
 *
 * 매단 점(병 발치)이 옆으로 가속하면 태그는 관성 때문에 뒤처져 반대쪽으로 기울고,
 * 줄이 다시 끌어당겨 몇 번 오가다 멈춥니다.
 *
 *   θ'' = −ω²θ − 2ζωθ' + k·a     (a: 매단 점의 가속도, 오른쪽이 +)
 *
 * a > 0(오른쪽으로 가속)이면 θ 가 커져 아랫단이 왼쪽으로 뒤처집니다.
 * 속도를 먼저 갱신하고 그 속도로 각도를 옮깁니다(반암시적 오일러). 순서를 바꾸면
 * 프레임이 조금만 길어져도 흔들림이 점점 커져 발산합니다.
 *
 * 기울기는 `limit` 에서 멈추고, 그때 바깥으로 가던 속도는 버립니다. 버리지 않으면 한도에 붙어 있는
 * 동안에도 속도가 계속 쌓여서, 미는 힘이 사라진 뒤에도 한참 한도에 붙어 버티다 뒤늦게 튕깁니다.
 */
export function swingStep(
  swing: Swing,
  accel: number,
  dt: number,
  { omega, damping, gain, limit }: SwingOptions,
): Swing {
  const force =
    -omega * omega * swing.angle -
    2 * damping * omega * swing.speed +
    gain * accel
  const speed = swing.speed + force * dt
  const angle = swing.angle + speed * dt
  if (Math.abs(angle) <= limit) return { angle, speed }
  const edge = Math.sign(angle) * limit
  return {
    angle: edge,
    speed: Math.sign(speed) === Math.sign(edge) ? 0 : speed,
  }
}

/** 무대가 바뀔 때 이름표를 들어 올리는 바람 — 진열대가 위로 빠질 때(leave) · 돌아올 때(arrive) */
export type GustDirection = 'leave' | 'arrive'

/**
 * 바람 세기 곡선의 마디(초, 바람을 일으킨 순간부터).
 *
 *   from  공기가 따라 움직이기 시작합니다. 그전에는 0
 *   peak  sin² 로 차올라 가장 셉니다(1)
 *   hold  가장 센 채로 버팁니다
 *   end   cos² 로 잦아들어 0
 *
 * 떠날 때는 무대가 빠지는 동안(450ms) 세고 길게 붑니다. 돌아올 때는 무대가 서기 전에 잦아들어서,
 * 태그가 떨어지며 벽을 한 번 치고 가라앉는 것까지 화면에서 보입니다.
 */
export const LIFT_ENVELOPE: Record<
  GustDirection,
  { from: number; peak: number; hold: number; end: number }
> = {
  leave: { from: 0.04, peak: 0.18, hold: 0.26, end: 0.52 },
  arrive: { from: 0.04, peak: 0.12, hold: 0.2, end: 0.43 },
}

/** 바람을 일으킨 뒤 t 초의 바람 세기(0 ~ 1). 마디는 LIFT_ENVELOPE 입니다 */
export function liftEnvelope(t: number, direction: GustDirection): number {
  const { from, peak, hold, end } = LIFT_ENVELOPE[direction]
  if (t <= from || t >= end) return 0
  if (t < peak) {
    return Math.sin((Math.PI / 2) * ((t - from) / (peak - from))) ** 2
  }
  if (t <= hold) return 1
  return Math.cos((Math.PI / 2) * ((t - hold) / (end - hold))) ** 2
}

/** 태그 하나가 바람을 받는 모양 */
export type LiftTag = {
  /** 세기 배율(0.85 ~ 1.15) */
  gain: number
  /** 난류 위상(라디안) */
  phase: number
  /** 바람이 늦게 닿는 시간(초) */
  lag: number
}

/**
 * 바람을 일으킨 뒤 t 초에 태그를 들어 올리려는 기울기(라디안) — liftStep 의 target 입니다.
 *
 *   세기 × 태그 배율 × 바람 세기 곡선(t − 늦음) × (1 + 난류)
 *
 * 난류는 서로 어긋난 빠른 떨림 두 개(초당 6.3 번 12% · 9.7 번 7%)입니다. 태그마다 위상이 달라 이웃끼리
 * 파르르 떠는 박자가 겹치지 않습니다. 곡선은 늦게 닿는 만큼 밀리지만 난류는 밀리지 않습니다 — 같은
 * 바람 속의 떨림이라서입니다.
 */
export function liftTarget(
  t: number,
  direction: GustDirection,
  strength: number,
  { gain, phase, lag }: LiftTag,
): number {
  const turbulence =
    0.12 * Math.sin(2 * Math.PI * 6.3 * t + phase) +
    0.07 * Math.sin(2 * Math.PI * 9.7 * t + 2 * phase)
  return strength * gain * liftEnvelope(t - lag, direction) * (1 + turbulence)
}

export type LiftOptions = {
  /** 고유 진동수(라디안/초) = 2π / 주기 */
  omega: number
  /** 감쇠비 */
  damping: number
  /** 벽에 닿는 기울기(라디안, 음수). 이보다 뒤로 넘어가지 않습니다 */
  floor: number
  /** 벽을 치고 되튈 때 남는 속도의 비율 */
  bounce: number
}

/**
 * 바람에 들린 이름표를 한 걸음(`dt` 초)만큼 굴립니다(앞뒤로 흔들리는 감쇠 진자). 기울기가 양수면
 * 태그 아랫단이 보는 사람 쪽으로 들립니다(CSS 의 rotateX).
 *
 *   θ'' = −ω²(θ − target) − 2ζω·θ'
 *
 * 바람은 태그가 쉬고 싶은 기울기(target)를 옮기고, 태그는 조금 늦게 따라가다 바람이 그치면 몇 번
 * 오가며 제자리로 돌아옵니다. swingStep 과 같이 속도를 먼저 갱신합니다(반암시적 오일러).
 * 태그는 벽 앞에 매달려 있어 `floor` 보다 뒤로 가지 않고, 닿으면 속도를 `bounce` 만큼 남겨 되튑니다 —
 * 들렸던 종이가 떨어지며 벽을 톡 치는 모습입니다.
 */
export function liftStep(
  lift: Swing,
  target: number,
  dt: number,
  { omega, damping, floor, bounce }: LiftOptions,
): Swing {
  const force =
    -omega * omega * (lift.angle - target) - 2 * damping * omega * lift.speed
  const speed = lift.speed + force * dt
  const angle = lift.angle + speed * dt
  if (angle < floor) return { angle: floor, speed: -bounce * speed }
  return { angle, speed }
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value))
const floor5 = (value: number) => Math.floor(value / 5) * 5
const ceil5 = (value: number) => Math.ceil(value / 5) * 5
const round5 = (value: number) => Math.round(value / 5) * 5

/** 벽을 멈출 칸으로 끌어당기는 용수철의 상태 */
export type Spring = {
  /** 창 왼쪽 끝의 위치(칸, 소수) */
  position: number
  /** 속도(칸/초). 양수면 다음 병 쪽으로 갑니다 */
  velocity: number
}

export type SpringOptions = {
  /** 고유 진동수(라디안/초). 클수록 빨리 붙습니다 */
  omega: number
  /** 감쇠비. 1 이면 넘어가지 않고 붙고, 1 보다 조금 작으면 살짝 넘었다 돌아와 딸깍 걸립니다 */
  damping: number
  /** 속도 한도(칸/초) */
  maxSpeed: number
}

/**
 * 벽을 멈출 칸(`dest`)으로 한 걸음(`dt` 초)만큼 끌어당깁니다(감쇠 용수철).
 *
 *   x'' = −ω²(x − dest) − 2ζω·x'
 *
 * swingStep 과 같이 속도를 먼저 갱신하고 그 속도로 위치를 옮깁니다(반암시적 오일러).
 * 목적지가 바뀌어도 속도는 그대로 이어받습니다 — 휠을 연달아 굴리거나 흐르던 중에 굴려도
 * 속도가 뚝 튀거나 섰다가 다시 출발하지 않습니다. 속도는 `maxSpeed` 로 묶어서, 여러 칸을
 * 한꺼번에 쌓아도 한 프레임에 건너뛰는 거리가 커지지 않습니다.
 */
export function springStep(
  spring: Spring,
  dest: number,
  dt: number,
  { omega, damping, maxSpeed }: SpringOptions,
): Spring {
  const force =
    -omega * omega * (spring.position - dest) -
    2 * damping * omega * spring.velocity
  const velocity = clamp(spring.velocity + force * dt, -maxSpeed, maxSpeed)
  return { position: spring.position + velocity * dt, velocity }
}

/*
 * ── 진열장 치수 ─────────────────────────────────────────────
 *
 * 벽감 높이는 화면이 남긴 세로 공간을 채우고, 한 화면의 칸 수는 가로 폭이 정합니다.
 * 머리말 부제와 하단 문구를 걷어낸 만큼 진열장이 커지도록, 치수를 고정값이 아니라
 * 진열장 자리의 크기에서 계산합니다.
 *
 *   벽감 높이 = 위 테두리·천장 23 + 병 위 여유 + 채움 병 + 병 발치부터 아래끝 15
 *   진열장 자리 = 벽감 + 매달린 이름표 자리(줄 + 태그 + 그림자 15 — 아래 "매달린 이름표 자리")
 *
 * 벽감은 **병이 벽감을 꽉 채운다고 칠 때(채움 병)** 의 크기로 잡습니다. 병 위 여유는
 * 그 높이의 10%(최소 30)입니다.
 *
 * 실제 병 사진은 그 벽감 높이의 60%(BOTTLE_PER_CASE)로 줄여 세웁니다. 채움 병 그대로
 * (벽감의 85%) 세우면 병이 너무 크게 보이고, 넓은 병은 칸 폭을 다 써서 옆 병과 어깨가
 * 붙습니다. 칸 폭이 병 높이를 따라 정해져서(SLOT_PER_BOTTLE) 병을 줄이면 한 화면에 서는 병이
 * 늡니다 — 70% 에서 60% 로 줄여 1920 x 1080 에서 분류 첫머리 병이 다섯 → 여섯입니다. 벽감 높이는 채움 병으로 정하므로 사진을 줄여도 화면 구성은 그대로이고,
 * 사진은 object-contain 이라 비율을 지킨 채 줄어듭니다. 줄인 병이 마우스를 올려
 * 1.06 배로 자라도 천장까지는 넉넉히 남습니다.
 */
const CASE_CHROME = 38
const HEADROOM = 0.1
const MIN_HEADROOM = 30
const BOTTLE_PER_CASE = 0.6

/**
 * 벽감 높이를 정하는 셈 — 칸 폭과 채움 병 높이의 비율. 채움 병 높이는 칸 폭의 1.8 배를
 * 넘기지 않습니다. 예전 "패널에 가리지 않는 폭에 다섯 칸" 배치에서 벽감 높이를 정하던
 * 식이고, 칸을 촘촘히 바꾼 뒤에도 벽감 높이를 그대로 두려고 이 셈으로만 남겨 둡니다.
 */
const PITCH_PER_BOTTLE = 0.6
const MAX_BOTTLE_PER_PITCH = 1.8

/**
 * 벽감 높이를 정할 때 세는 칸 수. 가리지 않는 폭에 다섯 칸을 바라되, 칸 폭이 200px
 * 아래로 내려가면 줄입니다. **벽감 높이에만** 씁니다 — 실제 칸은 아래 SLOT_PER_BOTTLE 로
 * 촘촘히 나눕니다.
 */
const PREFERRED_VISIBLE = 5
const MIN_PITCH = 200
const MIN_VISIBLE = 3
const MAX_VISIBLE = 9

/**
 * 바라는 칸 폭 — 병 사진 높이의 0.55 배로 촘촘히 세웁니다. 가는 병은 높이를 다 쓰고, 넓은
 * 플라콘은 칸 폭에 맞춰 조금 낮아집니다. 실제 칸 폭은 창(쌓는 배치)이나 패널 왼쪽 끝까지의 폭
 * (아래 "칸이 패널 경계에 섭니다")을 칸 수로 나눈 값이라 이보다 조금 넓거나 좁습니다.
 */
const SLOT_PER_BOTTLE = 0.55
const MAX_SLOTS = 12

/**
 * 칸 폭의 하한. 칸은 병 사진을 따라 촘촘해지는데, 110 보다 좁으면 이름표 벽의 현판(맨 벽 =
 * 칸 폭 − 옆벽 66)과 매달린 태그(칸 폭의 75%)가 칸에 들지 않습니다. 그때는 칸을 늘리지 않고
 * 칸 폭을 지킵니다 — 이름표 자리가 커져 병이 조금 작아진 휴대폰(412 · 430 · 540 · 560)에서
 * 칸이 하나 늘어 칸 폭이 93 · 100 까지 좁아지던 것을 막습니다.
 * 창이 칸 셋(MIN_VISIBLE)에도 모자라는 아주 좁은 휴대폰(320)에서는 칸 셋이 먼저입니다.
 */
const MIN_SLOT_PITCH = 110

/*
 * ── 칸이 패널 경계에 섭니다 ─────────────────────────────────
 *
 * 패널을 얹는 배치에서는 창 전체가 아니라 **창 왼쪽 끝부터 패널 왼쪽 끝까지**를 칸으로 나눕니다.
 *
 *   가리지 않는 칸 = ⌈패널 왼쪽 끝 / 바라는 칸 폭(병 x 0.55)⌉ — 다섯 ~ 열둘, 칸 폭 110 이상
 *   칸 폭          = 패널 왼쪽 끝 / 가리지 않는 칸
 *
 * 벽의 칸이 전부 같은 폭이라, 창 왼쪽 끝이 칸 경계에 멈추면 패널 왼쪽 끝도 늘 칸 경계에 옵니다.
 * 예전에는 창 전체를 칸으로 나눠서 패널 왼쪽 끝이 칸 하나를 46~116px 파고들었고, 멈출 때마다
 * 병 하나가 패널에 반쯤 가렸습니다.
 *
 * 올림(ceil)으로 셉니다. 칸이 바라는 폭보다 조금(1920 에서 10%) 좁아지는 대신, 이름표 벽을 두 칸
 * 기둥으로 넓혀도(layoutWall) 분류 첫머리에 병 다섯이 그대로 섭니다. 내림으로 세면 칸이 넓어져
 * 1440 · 1280 에서 병이 넷으로 줍니다.
 *
 * 창 오른쪽 끝(패널 밑)은 칸 경계에 오지 않습니다. 그래서 창에 걸치는 칸(visible)과 창 안에
 * 온전히 드는 칸(whole)을 따로 세고, 그 사이에 걸린 칸은 탭 순서에서 뺍니다(slotView).
 *
 *   1920 x 1080  패널 340 · 패널 왼쪽 끝 1460 → 가리지 않는 칸 여덟 · 칸 182.5 · 창에 걸치는 칸 열 · 온전한 칸 아홉
 *   1562 x 914   패널 289 · 패널 왼쪽 끝 1153 → 가리지 않는 칸 여덟 · 칸 144.13 · 열하나 · 열
 *
 * 패널을 얹지 않는 쌓는 배치는 예전처럼 창 전체를 칸으로 나눕니다. 창 양 끝이 칸 경계입니다.
 */
const MIN_CLEAR_WITH_PANEL = 5

/**
 * 이름표 벽을 두 칸 기둥으로 세우는 가리지 않는 칸 수(layoutWall). 패널을 얹는 배치는 늘 다섯
 * 이상이라 두 칸이고, 쌓는 배치는 768(칸 다섯)에서 두 칸 · 휴대폰(칸 셋)에서 한 칸입니다 —
 * 칸 셋에 두 칸 기둥을 세우면 분류 첫머리에 병이 하나만 섭니다.
 */
const PLAQUE_SPAN_MIN_CLEAR = 5

/*
 * ── 매달린 이름표 자리 ───────────────────────────────────────
 *
 * 이름표는 벽감 아래끝(선반 아랫면)에 줄로 매달린 종이 태그입니다. 고정값이 아니라 칸 폭과
 * 벽감 높이에서 셉니다 — 시안(벽감 440)의 태그 150 x 125 · 줄 25 비율을 따릅니다.
 *
 *   태그 폭     = 칸 폭 x 0.75       이웃 태그와의 사이가 칸 폭의 1/4 남습니다
 *   태그 높이   = 태그 폭 x 0.64 (최소 80) — 브랜드 한 줄 + 한글 이름 두 줄이 드는 높이
 *   줄          = 벽감 높이 x 25/440 (최소 15) — 선반 아랫면에서 태그 윗변까지
 *   이름표 자리 = 줄 + 태그 높이 + 그림자 여유 15
 *
 * 태그 크기를 벽감 높이가 아니라 칸 폭에서 세는 이유: 태그가 옆 칸으로 넘어가면 안 되는
 * 쪽이 먼저 걸립니다. 1920 의 칸은 시안보다 촘촘해서(칸 폭 / 벽감 0.37, 시안 0.45) 벽감
 * 높이에 맞추면 태그 폭이 칸을 넘습니다.
 *
 * 1920 x 1080 에서 태그 135 x 85 · 줄 35 · 이름표 자리 135 이고, 벽감은 605 그대로입니다
 * (그 화면의 벽감 높이는 세로가 아니라 가리지 않는 폭에 걸려 있습니다).
 *
 * 이름표 자리와 벽감 높이는 서로를 정합니다. 이름표 자리가 크면 벽감이 낮아지고, 벽감이
 * 낮으면 병 · 칸 폭이 작아져 태그도 작아집니다. 그래서 85 에서 시작해 5 씩 늘리며, 그 자리로
 * 센 치수의 이름표가 그 자리에 드는 첫 값에서 멈춥니다. 자리를 늘릴수록 필요한 높이는 줄기만
 * 해서 값이 오가지 않습니다. 진열장 자리의 절반(MAX_HANG_SHARE)에 닿으면 더 늘리지 않고
 * 태그를 그 안에 줄여 넣습니다 — 가로로 아주 긴 창에서 태그가 벽감을 밀어내지 않게.
 *
 * 이름표 자리만큼 세로가 짧은 화면에서는 벽감이 낮아집니다(1920 x 950 에서 예전 고정 이름표 자리 85 일 때 585 → 535).
 * 벽감을 더 지키려면 TAG_PER_PITCH · CORD_PER_CASE 를 줄이거나 MAX_HANG_SHARE 를 낮춥니다.
 */
const TAG_PER_PITCH = 0.75
/**
 * 태그 높이 / 태그 폭. 브랜드 한 줄 + 한글 이름 두 줄이 드는 높이입니다. 예전에는 영문 이름 · 부향률까지
 * 네 줄이라 0.83(시안 150 x 125)이었습니다.
 */
const TAG_ASPECT = 0.64
/**
 * 태그 높이의 하한. 좁은 태그는 글자가 하한(브랜드 10 · 이름 12)에서 멈춰 폭에 비례해 줄이면 두 줄 이름이
 * 모자랍니다 — 폭 120 ~ 130 태그에 아일릿 · 테두리선 · 여백까지 77 ~ 80px 가 필요합니다.
 */
const TAG_MIN_HEIGHT = 80
const CORD_PER_CASE = 25 / 440
const MIN_CORD = 15
/** 태그 아래 그림자가 진열장 자리 안에 들도록 비워 두는 높이 */
const HANG_SHADOW = 15
/** 이름표 자리를 찾기 시작하는 높이 — 예전 고정값(줄 5 + 태그 65 + 그림자 15) */
const MIN_HANG = 85
const MAX_HANG_SHARE = 0.5

/**
 * 태그 글자가 시안 크기로 서는 태그 폭. 태그가 이보다 좁으면 글자를 함께 줄이는 배율(--tag-scale)의
 * 기준입니다. 칸을 패널 경계에 맞춘 뒤로 1920 x 1080 의 태그는 155 라 글자도 0.91 배로 섭니다.
 */
export const TAG_WIDTH = 170

export type ShelfMetrics = {
  /**
   * 창에 걸치는 칸 수 — 상세 패널 밑까지, 창 오른쪽 끝에 걸린 칸도 셉니다(이름표 벽 칸 포함).
   * 창 밖 병 감추기(slotView)에 씁니다.
   */
  visible: number
  /** 창 안에 온전히 드는 칸 수. 패널을 얹지 않으면 visible 과 같습니다 */
  whole: number
  /**
   * 상세 패널에 가리지 않는 자리에 드는 칸 수. 패널을 얹으면 이 칸 수 x 칸 폭이 곧 패널 왼쪽
   * 끝입니다(위 "칸이 패널 경계에 섭니다"). 고른 병을 들이는 자리 · 벽 끝 · 칩 켜짐(가리지 않는
   * 자리의 가운데) · 분류 사이 빈 벽 · 멈출 수 있는 자리를 이 칸 수로 셉니다.
   */
  clear: number
  /** 칸 하나의 폭(px). 창 폭(또는 패널 왼쪽 끝까지의 폭)을 칸 수로 나눈 값이라 끝자리 규칙 밖입니다 */
  pitch: number
  /** 병 사진 칸 높이(px). 벽감 높이의 60% 입니다 */
  bottle: number
  /** 벽감 높이(px) */
  caseHeight: number
  /** 벽감 아래로 매달린 이름표 자리 높이(px) — 줄 + 태그 높이 + 그림자 여유 15 */
  hang: number
  /** 줄 길이(px) — 선반 아랫면(벽감 아래끝)에서 태그 윗변까지 */
  cord: number
  /** 이름표 태그 폭(px). 칸 폭보다 10px 이상 좁습니다 */
  tagWidth: number
  /** 이름표 태그 높이(px) */
  tagHeight: number
}

type WallMetrics = Pick<
  ShelfMetrics,
  'visible' | 'whole' | 'clear' | 'pitch' | 'bottle' | 'caseHeight'
>
type HangMetrics = Pick<
  ShelfMetrics,
  'hang' | 'cord' | 'tagWidth' | 'tagHeight'
>

/** 아직 크기를 못 쟀을 때(첫 그림 · 테스트 환경)의 벽 — 벽감 345 기준 */
const UNMEASURED: WallMetrics = {
  visible: 7,
  whole: 7,
  clear: 7,
  pitch: 200,
  bottle: 240,
  caseHeight: 345,
}

/** 벽 치수에 맞는 이름표 크기와 그 자리 높이(위 "매달린 이름표 자리") */
function hangFor({ pitch, caseHeight }: WallMetrics): HangMetrics {
  const tagWidth = round5(pitch * TAG_PER_PITCH)
  const tagHeight = Math.max(TAG_MIN_HEIGHT, round5(tagWidth * TAG_ASPECT))
  const cord = Math.max(MIN_CORD, round5(caseHeight * CORD_PER_CASE))
  return { hang: cord + tagHeight + HANG_SHADOW, cord, tagWidth, tagHeight }
}

/**
 * 진열장 자리의 크기로 치수를 정합니다.
 *
 *   width       창 전체 폭(상세 패널 밑까지)
 *   height      진열장 자리 높이
 *   clearWidth  벽감 높이를 셀 때 쓰는 가리지 않는 폭(창 폭 − 패널 − 간격 20)
 *   panelWidth  상세 패널 폭. 주면 패널 왼쪽 끝을 칸 경계로 두고 칸을 나눕니다
 *               (위 "칸이 패널 경계에 섭니다"). 주지 않으면 창 전체를 나눕니다
 *
 * 1920 x 1080 → 1800 x 800 · 패널 340 → 벽감 605 · 병 360 · 칸 182.5 · 가리지 않는 칸 여덟 ·
 * 창에 걸치는 칸 열 · 이름표 자리 135(줄 35 + 태그 135 x 85 + 15).
 * 병 · 벽감 높이는 끝자리를 5 로 맞춥니다. 칸 폭만은 폭을 나눈 값이라 그대로 둡니다
 * — 반올림하면 칸 수 x 칸 폭이 창 폭(패널 왼쪽 끝)과 어긋나 끝 병이 경계에 걸립니다.
 */
export function shelfMetrics(
  width: number,
  height: number,
  clearWidth = width,
  panelWidth = 0,
): ShelfMetrics {
  if (width <= 0 || height <= 0) {
    return { ...UNMEASURED, ...hangFor(UNMEASURED) }
  }
  const span = clamp(clearWidth, 1, width)
  const most = Math.max(MIN_HANG, floor5(height * MAX_HANG_SHARE))
  const measure = (hang: number) =>
    measureWall(width, height, span, hang, panelWidth)

  // 이름표가 드는 첫 자리를 찾습니다(위 "매달린 이름표 자리")
  let reserved = MIN_HANG
  let wall = measure(reserved)
  let hang = hangFor(wall)
  while (hang.hang > reserved && reserved < most) {
    reserved += 5
    wall = measure(reserved)
    hang = hangFor(wall)
  }
  // 한도에 걸렸습니다. 자리는 그대로 두고 태그를 같은 비율로 줄여 넣습니다
  if (hang.hang > reserved) {
    const tagHeight = Math.max(0, reserved - hang.cord - HANG_SHADOW)
    hang = {
      hang: hang.cord + tagHeight + HANG_SHADOW,
      cord: hang.cord,
      tagWidth: Math.min(hang.tagWidth, round5(tagHeight / TAG_ASPECT)),
      tagHeight,
    }
  }
  return { ...wall, ...hang }
}

/** 이름표 자리 높이(hang)를 정해 두고 센 벽감 · 병 · 칸 */
function measureWall(
  width: number,
  height: number,
  span: number,
  hang: number,
  panelWidth: number,
): WallMetrics {
  // ── 벽감 높이 (위 설명 — 채움 병)
  const room = height - hang - CASE_CHROME
  const tallest = Math.min(room / (1 + HEADROOM), room - MIN_HEADROOM)
  const preferred = Math.round(span / (tallest * PITCH_PER_BOTTLE))
  const roomy = Math.min(PREFERRED_VISIBLE, Math.floor(span / MIN_PITCH))
  const standing = clamp(Math.max(preferred, roomy), MIN_VISIBLE, MAX_VISIBLE)
  const filling = Math.max(
    100,
    floor5(Math.min(tallest, (span / standing) * MAX_BOTTLE_PER_PITCH)),
  )
  const headroom = Math.max(MIN_HEADROOM, filling * HEADROOM)
  const caseHeight = Math.min(
    ceil5(CASE_CHROME + headroom + filling),
    floor5(height - hang),
  )
  const bottle = floor5(caseHeight * BOTTLE_PER_CASE)

  // ── 칸 — 병 사진 폭에 맞춰 촘촘히 나눕니다. 칸 폭의 하한(MIN_SLOT_PITCH)은 지킵니다
  const ideal = bottle * SLOT_PER_BOTTLE
  const edge = width - panelWidth
  if (panelWidth > 0 && edge > 0) {
    // 패널 왼쪽 끝까지를 나눕니다(위 "칸이 패널 경계에 섭니다"). 딱 맞아떨어지는 칸이 부동소수
    // 오차로 하나 더(올림) · 덜(내림) 세어지지 않게 조금 여유를 둡니다
    const clear = clamp(
      Math.min(
        Math.ceil(edge / ideal - 1e-6),
        Math.floor(edge / MIN_SLOT_PITCH),
      ),
      MIN_CLEAR_WITH_PANEL,
      MAX_SLOTS,
    )
    const pitch = edge / clear
    return {
      visible: Math.ceil(width / pitch - 1e-6),
      whole: Math.floor(width / pitch + 1e-6),
      clear,
      pitch,
      bottle,
      caseHeight,
    }
  }

  // 쌓는 배치 — 창 전체를 칸 수로 나눕니다
  const visible = clamp(
    Math.min(Math.round(width / ideal), Math.floor(width / MIN_SLOT_PITCH)),
    MIN_VISIBLE,
    MAX_SLOTS,
  )
  const pitch = width / visible
  // 딱 맞아떨어지는 칸이 부동소수 오차로 하나 덜 세어지지 않게 조금 여유를 둡니다
  const clear = clamp(Math.floor(span / pitch + 1e-6), 1, visible)

  return { visible, whole: visible, clear, pitch, bottle, caseHeight }
}

/*
 * ── 상세 패널 ───────────────────────────────────────────────
 *
 * 넓은 화면에서 상세 패널은 벽 오른쪽 위에 얹힙니다. 1920 x 1080 에서는 벽감이 605 이고
 * 패널이 시안 크기(폭 340)로 섭니다. 화면이 작아져 벽감이 낮아지면 패널도 통째로
 * 줄어듭니다 — 폭 · 여백 · 사진 · 글자 · 단추가 전부 `벽감 높이 / 605` 배입니다.
 *
 * 다만 **글자가 읽히는 하한(0.85 배 — 작은 글자 12px 가 10px 남짓)** 아래로는 줄이지
 * 않습니다. 그보다 작게 줄여야 하는 화면은 억지로 줄이지 않고 배치를 바꿉니다 — 패널을
 * 벽 아래로 내리는 쌓는 배치(MyShelfPage)입니다.
 *
 * 패널 높이는 늘 벽감 + 매달린 이름표 자리(진열장 자리 전체)입니다. 예전에는 줄인 내용이
 * 벽감에 들면 벽감 높이에서 끝냈는데, 이름표가 시안 크기로 커지면서 패널 밑으로 옆 병의
 * 이름표가 줄지어 드러났습니다 — 한 화면에 두 분류가 걸려 보입니다. 시안도 패널이
 * 이름표 아랫선까지 내려옵니다.
 *
 * 패널 폭과 벽감 높이는 서로를 정합니다. 패널이 좁아지면 가리지 않는 폭이 넓어지고, 벽감
 * 높이는 그 폭으로 셉니다(shelfMetrics). 그래서 화면 폭에 비례한 폭에서 시작해 폭이 더
 * 바뀌지 않을 때까지 맞춰 봅니다. 벽감 높이를 셀 때 쓰는 칸 수가 바뀌는 경계에서는 폭이
 * 두 값 사이를 오갈 수 있어서 네 번까지만 맞춥니다. 배율은 마지막에 센 벽감 높이로 정하므로
 * 그때도 패널 높이는 벽감과 맞습니다.
 */
/**
 * 패널 폭. **시안과 눈으로 맞춘 값입니다.**
 *
 * 시안은 카드가 화면 폭의 17%(1920 에서 326)에 가로 : 세로 1 : 2.26 인 가늘고 긴
 * 모양입니다. 그 비만 좇아 340 까지 줄였더니 이번에는 안쪽이 좁아 글자와 원을 시안
 * 크기로 못 키웠습니다 — 시안은 카드가 좁은 대신 안쪽 요소가 큽니다. 390 은 그 둘의
 * 절충입니다(비 1 : 1.9).
 *
 * ⚠️ 한때 455 였습니다. "패널 폭 = 매달린 이름표(현판)의 세로 길이"
 * (605 x 0.75 = 454 → 0/5 규칙으로 455)로 맞춰 두면 화면이 작아져도 두 길이가 같이
 * 간다는 규칙이었는데, 눈으로 보면 카드가 벽을 반쯤 덮었습니다.
 * **그 규칙은 이제 성립하지 않습니다** — 현판과 패널은 서로 다른 길이입니다.
 * 폭을 다시 만질 때 현판을 맞춰야 한다고 생각하지 마세요.
 *
 * 폭을 줄일 때의 바닥은 375 근처입니다. 그 아래로는 카드 안쪽 폭이 가장 긴 향수명
 * (`Eau de Parfum Orpheon`)보다 좁아져 이름이 두 줄로 꺾입니다.
 */
const PANEL_WIDTH = 365
const PANEL_CASE = 605
/**
 * 벽감 높이를 셀 때 패널 옆에 비워 두는 간격. 벽감 높이에만 씁니다 — 칸은 패널 왼쪽 끝까지
 * 나눕니다(위 "칸이 패널 경계에 섭니다").
 */
const PANEL_GAP = 20

/**
 * 패널을 이름표 아랫선보다 이만큼 짧게 끊습니다.
 *
 * 원래는 벽감 + 이름표 자리를 꽉 채웠는데, 그러면 카드가 이름표 아랫선까지 내려와
 * 세로로 길어 보입니다. 조금 덜어 내면 옆 이름표의 아래 끝만 살짝 드러나고 카드는
 * 한 단 짧아집니다.
 *
 * 처음에 30 이었는데 15 로 줄였습니다 — 카드 안에 병 사진을 크게 넣으면서 세로가
 * 더 필요해졌고, 이 값이 곧 카드 높이라 여기서 15 를 돌려주는 게 유일한 방법입니다.
 * 이름표 끝은 여전히 드러납니다.
 */
const PANEL_TRIM = 15
const PANEL_PASSES = 4
/** 글자가 읽히는 하한. 이보다 작게 줄여야 하는 화면은 배치를 바꿉니다 */
export const PANEL_MIN_SCALE = 0.85
/** 1920 규격의 본문 폭(화면 틀 1920 − 좌우 여백 60 x 2). 패널 폭을 처음 어림할 때만 씁니다 */
const FRAME_WIDTH = 1800

export type ShelfLayoutOptions = {
  /** 상세 패널을 벽 위에 얹는가. 쌓는 배치에서는 패널이 벽 아래에 따로 서서 false 입니다 */
  panel?: boolean
}

export type ShelfLayout = ShelfMetrics & {
  /** 상세 패널 폭(px). 1920 규격에서 340, 패널을 얹지 않으면 0 */
  panelWidth: number
  /** 상세 패널 배율 — 벽감 높이 / 605 를 0.85 ~ 1 사이로 */
  panelScale: number
  /** 상세 패널 최소 높이(px) — 벽감 + 매달린 이름표 자리 */
  panelHeight: number
  /**
   * 패널에 가리지 않는 폭(px) — 가리지 않는 칸 x 칸 폭이라 창 폭 − 패널 폭과 같습니다(패널 왼쪽 끝).
   * 패널을 얹지 않으면 창 폭
   */
  clearWidth: number
  /** 이름표 벽 기둥 하나의 칸 수 — 가리지 않는 칸이 다섯 이상이면 2, 아니면 1(PLAQUE_SPAN_MIN_CLEAR) */
  plaqueSpan: number
}

/**
 * 진열장 자리의 크기로 벽 치수와 상세 패널 크기를 함께 정합니다.
 *
 *   1920 x 1080 → 자리 1800 x 800 → 패널 340 x 740 · 배율 1 · 가리지 않는 폭 1460(칸 여덟) · 벽감 605 + 이름표 자리 135
 *   1440 x 780  → 자리 1340 x 500 → 패널 289 x 500 · 배율 0.85(하한) · 벽감 385 + 이름표 자리 115
 */
export function shelfLayout(
  width: number,
  height: number,
  { panel = true }: ShelfLayoutOptions = {},
): ShelfLayout {
  const spanOf = (clear: number) => (clear >= PLAQUE_SPAN_MIN_CLEAR ? 2 : 1)
  if (!panel) {
    const metrics = shelfMetrics(width, height)
    return {
      ...metrics,
      panelWidth: 0,
      panelScale: 1,
      panelHeight: 0,
      clearWidth: Math.max(0, width),
      plaqueSpan: spanOf(metrics.clear),
    }
  }
  // 아직 크기를 못 쟀을 때는 패널을 줄이지 않습니다. ShelfWall 은 재기 전에 패널을 숨깁니다
  if (width <= 0 || height <= 0) {
    const metrics = shelfMetrics(width, height)
    return {
      ...metrics,
      panelWidth: PANEL_WIDTH,
      panelScale: 1,
      panelHeight: metrics.caseHeight + metrics.hang - PANEL_TRIM,
      clearWidth: Math.max(0, width - PANEL_WIDTH),
      plaqueSpan: spanOf(metrics.clear),
    }
  }

  const scaleOf = (caseHeight: number) =>
    clamp(caseHeight / PANEL_CASE, PANEL_MIN_SCALE, 1)
  const metricsFor = (panelWidth: number) =>
    shelfMetrics(width, height, width - panelWidth - PANEL_GAP, panelWidth)

  let panelWidth = Math.round(
    PANEL_WIDTH * clamp(width / FRAME_WIDTH, PANEL_MIN_SCALE, 1),
  )
  let metrics = metricsFor(panelWidth)
  for (let pass = 0; pass < PANEL_PASSES; pass += 1) {
    const next = Math.round(PANEL_WIDTH * scaleOf(metrics.caseHeight))
    if (next === panelWidth) break
    panelWidth = next
    metrics = metricsFor(panelWidth)
  }

  const panelScale = scaleOf(metrics.caseHeight)
  return {
    ...metrics,
    panelWidth,
    panelScale,
    panelHeight: metrics.caseHeight + metrics.hang - PANEL_TRIM,
    clearWidth: metrics.clear * metrics.pitch,
    plaqueSpan: spanOf(metrics.clear),
  }
}

/*
 * ── 벽 한 줄의 칸 배치 ──────────────────────────────────────
 *
 * 분류마다 [이름표 벽][벽감][빈 벽] 을 붙이고, 맨 끝에 "처음으로" 현판을 둡니다.
 *
 *   이름표 벽 · 보유 중 벽감(5) · 이름표 벽 · 시향해 봄 벽감(17) · 이름표 벽 · 보유 희망 벽감(3) · 처음으로
 *
 * **벽 한 줄의 칸 폭이 전부 같습니다.** 벽감 사이 벽 폭이 칸 폭의 배수가 아니면, 두 벽감에
 * 걸쳐 멈췄을 때 한쪽 끝 병이 창 경계에 걸립니다. 전부 칸 단위면 칸 수만큼 끊어 멈추는
 * 것만으로 창 양 끝에 병이 걸리지 않습니다.
 *
 * **이름표 벽은 두 칸 기둥입니다**(가리지 않는 칸이 다섯 이상일 때 — PLAQUE_SPAN_MIN_CLEAR).
 * 기둥 좌우 가장자리 33px 씩은 이웃 벽감의 옆벽이 차지해서, 한 칸짜리 벽에서는 현판이 90px
 * 남짓으로 좁고 옆벽과 7px 남짓밖에 떨어지지 않았습니다. 두 칸이면 현판이 시안 비율(벽감의
 * 29% x 75%)로 서고 옆벽과 55~90px 떨어집니다(plaqueMetrics).
 * 기둥은 두 칸이지만 한 덩어리입니다. 창 왼쪽 끝이나 패널 경계가 기둥 한가운데를 가르는 자리에는
 * 멈추지 않습니다(wallStops).
 *
 * 맨 끝 기둥은 **"처음으로" 현판**입니다. 첫 분류(보유 중)의 이름 · 개수를 적고, 누르면 벽이 맨
 * 앞으로 흐릅니다. 예전 끝 벽 자리를 대신해, 기둥의 첫 33px 은 마지막 벽감의 오른쪽 옆벽이 씁니다.
 * 분류가 아니라서 칩 · 페이저 · 창 가운데 분류(sectionAt)에는 끼지 않습니다.
 */
export type WallSection = ShelfSection & {
  /** 이름표 벽 기둥의 첫 칸 순서 */
  plaque: number
  /** 벽감 첫 칸의 순서 */
  start: number
  /** 벽감이 차지하는 칸 수. 비어 있어도 "비어 있음" 을 적을 한 칸은 둡니다 */
  span: number
  /**
   * 벽감 뒤에 비워 두는 벽 칸 수(아래 layoutWall). 병이 적은 분류의 첫머리에 섰을 때 다음
   * 기둥이 패널 바로 왼쪽에 서도록 벽을 비우고, 두 칸 기둥이 패널 경계에 걸리지 않게 한 칸을
   * 비우기도 합니다. 마지막 분류 뒤(다음 기둥이 "처음으로" 현판)도 같은 셈입니다.
   */
  gap: number
}

export type WallLayout = {
  sections: WallSection[]
  /** "처음으로" 현판 기둥의 첫 칸 순서 */
  back: number
  /** "처음으로" 기둥까지 합친 칸 수 */
  total: number
  /** 이름표 벽 기둥 하나의 칸 수(1 또는 2) */
  plaqueSpan: number
}

/**
 * `clear` 는 패널에 가리지 않는 칸 수(쌓는 배치에서는 창 전체 칸 수), `plaqueSpan` 은 이름표 벽
 * 기둥의 칸 수(K)입니다. 분류마다 벽감 뒤에 빈 벽(`gap`)을 이렇게 둡니다. 마지막 분류도 같습니다.
 *
 *   짧은 분류     이름표 + 병 + 다음 기둥이 가리지 않는 자리에 드는 분류
 *                 빈 벽 = 가리지 않는 칸 − K − (K + 병 칸 수)
 *                 그 분류의 첫머리에 서면 다음 기둥이 가리지 않는 자리의 마지막 K 칸 — 패널 바로 왼쪽에 붙습니다
 *   한 칸 모자람  두 칸 기둥에서 이름표 + 병이 가리지 않는 칸보다 하나 적거나 많은 분류 → 빈 벽 한 칸
 *   · 넘침        다음 기둥이 패널 경계에 반쯤 걸리지 않고, 막힌 멈출 자리가 둘 붙어 생기지 않습니다
 *   그 밖         빈 벽 없음 — 병을 훑어 끝에 닿을 때 다음 기둥이 따라 들어옵니다
 *
 * 짧은 분류의 첫머리에서는 빈 벽이 한 화면씩 크게 벌어지지 않고, 두 분류의 병이 한 화면에 섞여
 * 서지도 않으면서, 다음 분류가 거기 있다는 게 보이고 누르면 그리로 흐릅니다. 가리지 않는 칸
 * 일곱에서 병 둘인 분류는 빈 벽 하나 — 이름표 두 칸 · 병 둘 · 빈 벽 · 다음 이름표 두 칸이
 * 서고, 다음 현판이 패널 바로 왼쪽에 섭니다. 병이 넷 이상이면 가리지 않는 자리를 병으로 채우고
 * 다음 기둥은 패널 밑에서 비칩니다.
 *
 * 마지막 분류 뒤의 "처음으로" 기둥은 벽 끝(max)에서 늘 패널 바로 왼쪽에 붙습니다.
 * K 가 1 이면 짧은 분류의 식이 예전 그대로(가리지 않는 칸 − 2 − 병 칸 수)입니다.
 */
export function layoutWall(
  sections: ShelfSection[],
  clear = 0,
  plaqueSpan = 1,
): WallLayout {
  // NOTE: 0 을 받습니다 — 현판이 트랙 밖(왼쪽 메뉴)에 선 배치에는 벽에 기둥 칸이 없습니다
  const column = Math.max(0, plaqueSpan)
  let at = 0
  const placed = sections.map((section) => {
    const plaque = at
    const start = plaque + column
    const span = Math.max(1, section.items.length)
    const used = column + span
    const gap =
      used + column <= clear
        ? clear - column - used
        : column > 1 && Math.abs(used - clear) === 1
          ? 1
          : 0
    at = start + span + gap
    return { ...section, plaque, start, span, gap }
  })
  return {
    sections: placed,
    back: at,
    total: at + column,
    plaqueSpan: column,
  }
}

/**
 * 창 왼쪽 끝이 멈출 수 있는 칸들(작은 순서부터, 0 ~ max).
 *
 * 이름표 벽 기둥(분류 현판 · "처음으로" 현판)은 두 칸이 한 덩어리입니다. 기둥 가운데를 창 경계가
 * 가르면 현판이 반으로 잘려 보여서, 그렇게 되는 자리를 뺍니다. 기둥 C 의 k 번째 칸(0 < k < K)마다
 *
 *   C + k          창 왼쪽 끝이 기둥을 가름
 *   C + k − clear  패널 왼쪽 끝(쌓는 배치에서는 창 오른쪽 끝)이 기둥을 가름
 *
 * 0 · max · 분류 현판 자리는 언제나 멈출 수 있습니다(칩 · 이름표 벽이 가는 곳). 막힌 자리는 거의
 * 늘 떨어져 있어 휠 한 번이 막힌 자리를 건너 두 칸을 가도 어색하지 않습니다. 가리지 않는 칸 다섯에
 * 병 하나 이하인 분류가 둘 이어질 때만 막힌 자리가 붙어 세 칸을 건너뜁니다.
 * 한 칸 기둥(K 1)이면 막힌 자리가 없습니다.
 *
 *   병 [5, 17, 3] · 가리지 않는 칸 일곱 → 1 · 8 · 20 · 25 가 막힘 (max 26)
 */
export function wallStops(
  layout: WallLayout,
  clear: number,
  max: number,
): number[] {
  const blocked = new Set<number>()
  const columns = [...layout.sections.map(({ plaque }) => plaque), layout.back]
  for (const column of columns) {
    for (let k = 1; k < layout.plaqueSpan; k += 1) {
      blocked.add(column + k)
      blocked.add(column + k - clear)
    }
  }
  const stops: number[] = []
  for (let at = 0; at <= max; at += 1) {
    if (!blocked.has(at)) stops.push(at)
  }
  return stops
}

/**
 * `from` 에서 `direction` 쪽으로 처음 만나는 멈출 자리(`from` 자신 포함). 그쪽으로 더 없으면
 * 벽 끝의 멈출 자리입니다. 방향이 0 이면 오른쪽으로 찾습니다.
 */
export function nextStop(
  stops: readonly number[],
  from: number,
  direction: number,
): number {
  const first = stops[0]
  const last = stops.at(-1)
  if (first === undefined || last === undefined) return Math.max(0, from)
  if (direction < 0) {
    for (let at = stops.length - 1; at >= 0; at -= 1) {
      const stop = stops[at] ?? first
      if (stop <= from) return stop
    }
    return first
  }
  for (const stop of stops) {
    if (stop >= from) return stop
  }
  return last
}

/** `at` 이 멈출 수 있는 자리면 그대로, 막힌 자리면 `direction` 쪽의 다음 멈출 자리 */
export function nearStop(
  stops: readonly number[],
  at: number,
  direction: number,
): number {
  return stops.includes(at) ? at : nextStop(stops, at, direction)
}

export type SlotView = {
  /** 창 밖 — 탭 순서와 낭독기에서 뺍니다 */
  hidden: boolean
  /** 창 끝에 걸친 칸 — 걸친 채 비치지만 탭 순서와 낭독기에서는 뺍니다 */
  edge: boolean
}

/**
 * 멈춘 창에서 칸 하나(`at`)의 처지. 칸 순서와 창 경계는 같은 기준(벽 첫 칸 또는 벽감 첫 칸)으로 줍니다.
 *
 *   winFrom   창 왼쪽 끝 칸
 *   winTo     창에 걸치는 칸의 끝(winFrom + visible). 이 칸부터 창 밖입니다
 *   edgeFrom  창 오른쪽 끝에 걸린 칸(winFrom + whole). 걸린 칸이 없으면 winTo 와 같습니다
 *
 * 창 끝에 걸친 칸은 창 왼쪽 바로 앞 칸 하나와, 오른쪽 끝에 걸린 칸(패널 밑) · 그다음 칸(여백의 페이드
 * 구간)입니다 — 많아야 셋. 예전에는 이 칸들을 멈출 때 투명하게 지웠는데, 창 끝에서 병이 스르르
 * 사라져 보여서 지금은 걸친 채 둡니다. 반쯤 가린 병에 포커스가 가지 않게만 합니다.
 */
export function slotView(
  at: number,
  winFrom: number,
  winTo: number,
  edgeFrom: number,
): SlotView {
  return {
    hidden: at < winFrom || at >= winTo,
    edge: at === winFrom - 1 || (at >= edgeFrom && at <= winTo),
  }
}

/**
 * 칸 위치(소수)에 걸친 분류. 이름표 벽은 뒤따르는 벽감의 분류로 칩니다("처음으로" 기둥은 마지막 분류).
 * 창 가운데가 어느 분류에 있는지로 칩의 켜짐을 정할 때 씁니다.
 */
export function sectionAt(
  sections: WallSection[],
  position: number,
): WallSection | undefined {
  let found = sections[0]
  for (const section of sections) {
    if (section.plaque <= position) found = section
  }
  return found
}

/**
 * 손가락으로 끌다 뗀 뒤 설 자리(칸 순서). 창 왼쪽 끝을 칸 경계에 맞춰서, 창 양 끝에 병이
 * 걸리지 않게 합니다. 휠은 한 번에 한 칸씩 정수 칸으로만 가서 이 셈을 거치지 않습니다(wheelStop).
 *
 * 가장 가까운 경계로만 붙이면 반 칸쯤 끌고 뗐을 때 제자리로 되돌아와 끌기가 안 먹는 것처럼
 * 느껴집니다. 그래서 **민 쪽으로** 다음 병이 조금만(칸 폭의 12%) 들어와도 그 병을 마저 들여
 * 세웁니다 — 넘어가던 병은 끝까지 보여 줍니다.
 */
const SNAP_BIAS = 0.12

export function snapStart(
  position: number,
  direction: number,
  max: number,
): number {
  const base = Math.floor(position)
  const fraction = position - base
  let next = Math.round(position)
  if (direction > 0) next = fraction > SNAP_BIAS ? base + 1 : base
  if (direction < 0) next = fraction < 1 - SNAP_BIAS ? base : base + 1
  return clamp(next, 0, max)
}

/*
 * ── 휠 한 번 = 한 칸 ─────────────────────────────────────────
 *
 * 휠이 보내는 값은 기기마다 다릅니다. 윈도 마우스는 한 번에 100(배율 · 확대에 따라 66.7 · 120 · 150),
 * 파이어폭스는 줄 단위이거나 50 안팎, 맥 마우스는 작은 값이 드문드문, 트랙패드는 16ms 마다 1 ~ 30px
 * 씩 흘러오고 손을 뗀 뒤에도 관성으로 1 ~ 2초 더 옵니다. 예전에는 굴린 px 을 칸 폭으로 나눠 흘려서
 * 휠 한 번이 칸 폭에 따라 0.5 ~ 1.3 칸이었고, 빠르게 두 번 굴리면 한 칸만 가기도 했습니다.
 *
 * 그래서 휠 이벤트 **하나가 많아야 한 칸**이 되도록 셉니다(meterWheel). 위에서부터 처음 맞는 것:
 *
 *   줄 · 쪽 단위(deltaMode 1 · 2)        한 칸
 *   40px 이상                            한 칸 — 마우스 휠 한 번, 파이어폭스 한 번
 *   40ms 넘게 조용하다 온 3px 이상        한 칸 — 맥 마우스의 한 번, 트랙패드로 밀기 시작한 첫 이벤트
 *   그 밖(트랙패드 흐름)                 모아 두었다가 칸 폭의 절반(60 ~ 120px)이 찰 때마다 한 칸.
 *                                        방향이 바뀌거나 250ms 조용하면 모은 것을 버립니다
 *
 * 값에 배율을 곱하지 않고 100 으로 나누지도 않습니다 — 확대 · 화면 배율에 따라 한 번이 66.7 이나
 * 150 으로 오기도 합니다. 1645 x 914(칸 폭 177)에서 트랙패드로 4px 씩 40번(160px) 밀면 첫 이벤트로
 * 한 칸, 모은 156px 이 88px 을 넘어 한 칸 — 두 칸입니다.
 */
const WHEEL_NOTCH_PX = 40
const WHEEL_TICK_GAP_MS = 40
const WHEEL_TICK_MIN_PX = 3
const WHEEL_GESTURE_MS = 250
const WHEEL_PIXEL_SHARE = 0.5
const WHEEL_PIXEL_MIN = 60
const WHEEL_PIXEL_MAX = 120

/** 휠 계량기. 칸이 되지 못한 트랙패드 흐름을 모아 둡니다 */
export type WheelMeter = {
  /** 아직 칸이 되지 못하고 모인 px(방향 부호 포함) */
  pending: number
  /** 마지막 휠 이벤트의 시각(ms, event.timeStamp) */
  lastAt: number
}

/** 아직 굴린 적 없는 계량기 */
export const WHEEL_IDLE: WheelMeter = { pending: 0, lastAt: -Infinity }

export type WheelInput = {
  /** 굴린 값 — 가로 · 세로 중 큰 쪽 그대로. 양수면 다음 병 쪽입니다 */
  delta: number
  /** WheelEvent.deltaMode(0 px · 1 줄 · 2 쪽) */
  deltaMode: number
  /** event.timeStamp(ms) */
  time: number
  /** 칸 폭(px) */
  pitch: number
}

/** 휠 이벤트 하나를 칸으로 셉니다(위 "휠 한 번 = 한 칸"). 한 이벤트가 두 칸 이상이 되지 않습니다 */
export function meterWheel(
  meter: WheelMeter,
  { delta, deltaMode, time, pitch }: WheelInput,
): { step: -1 | 0 | 1; meter: WheelMeter } {
  if (!delta) return { step: 0, meter }
  const sign = delta > 0 ? 1 : -1
  const size = Math.abs(delta)
  const gap = time - meter.lastAt
  if (
    deltaMode !== 0 ||
    size >= WHEEL_NOTCH_PX ||
    (gap >= WHEEL_TICK_GAP_MS && size >= WHEEL_TICK_MIN_PX)
  ) {
    return { step: sign, meter: { pending: 0, lastAt: time } }
  }
  const kept =
    gap < WHEEL_GESTURE_MS && Math.sign(meter.pending) === sign
      ? meter.pending
      : 0
  const pending = kept + delta
  const threshold = clamp(
    pitch * WHEEL_PIXEL_SHARE,
    WHEEL_PIXEL_MIN,
    WHEEL_PIXEL_MAX,
  )
  if (Math.abs(pending) < threshold) {
    return { step: 0, meter: { pending, lastAt: time } }
  }
  return {
    step: sign,
    meter: { pending: pending - sign * threshold, lastAt: time },
  }
}

/** 흐르는 벽이 목적지와 이만큼(칸) 가까우면 이미 닿은 것으로 봅니다 */
const STEP_EPS = 0.02

/**
 * 휠 한 칸(`step` ±1)을 받았을 때 벽이 향할 멈출 자리.
 *
 *   같은 쪽으로 흐르는 중   목적지에서 한 칸 더 — 연달아 굴린 만큼 쌓입니다
 *   서 있거나 반대로 굴림   지금 자리에서 그쪽 다음 칸 경계 — 흐르던 벽이 곧바로 돌아섭니다
 *
 * 막힌 자리(wallStops)는 건너뜁니다 — 이름표 벽 기둥은 휠 한 번에 통째로 지나갑니다. 벽 끝이면
 * 목적지가 그대로입니다(부르는 쪽이 아무것도 하지 않습니다).
 *
 *   병 [5, 17, 3] · 가리지 않는 칸 일곱: 0 에서 한 번 → 2 (1 막힘) · 7 에서 앞으로 → 9 · 뒤로 → 6
 */
export function wheelStop(
  stops: readonly number[],
  {
    position,
    dest,
    moving,
  }: { position: number; dest: number; moving: boolean },
  step: -1 | 1,
): number {
  const heading =
    Math.abs(dest - position) <= STEP_EPS ? 0 : Math.sign(dest - position)
  if (moving && heading === step) return nextStop(stops, dest + step, step)
  const from =
    step > 0
      ? Math.floor(position + STEP_EPS) + 1
      : Math.ceil(position - STEP_EPS) - 1
  return nextStop(stops, from, step)
}

/**
 * 칸 하나(index)가 창 밖이면 창을 최소한만 옮겨 들입니다. 이미 보이면 그대로입니다.
 * 왼쪽으로 들일 때는 앞의 칸을 `lead` 만큼 더 보여 줍니다 — 벽감 첫 병이면 그 앞의
 * 이름표 벽까지 보여서 어느 분류로 넘어왔는지 알 수 있습니다.
 */
export function revealStart(
  start: number,
  visible: number,
  index: number,
  max: number,
  lead = 0,
): number {
  if (index < start) return clamp(index - lead, 0, max)
  if (index >= start + visible) return clamp(index - visible + 1, 0, max)
  return start
}

/**
 * 고른 병(칸 순서 `index`)을 패널에 가리지 않는 자리(`clear` 칸)에 들일 때 창 왼쪽 끝이 설 칸.
 * 하단 페이저로 한 병씩 넘길 때 ShelfWall 이 씁니다.
 *
 *   이미 가리지 않는 자리에 있다          움직이지 않습니다
 *   보던 분류 안에서 왼쪽으로 옮긴다      최소한만 옮깁니다(revealStart) — 첫 병이면 이름표 벽 기둥까지
 *                                         (`lead`, 기본은 기둥 칸 수)
 *   오른쪽으로 · 다른 분류로 넘어간다     병을 가리지 않는 자리의 오른쪽 끝에 두되, 창 왼쪽 끝이
 *                                         그 분류의 이름표 벽보다 앞으로 나가지 않습니다
 *
 * 구한 자리가 막힌 자리(wallStops)면 옮기던 쪽의 다음 멈출 자리로 갑니다 — 왼쪽으로 들일 때는
 * 왼쪽으로, 오른쪽 · 다른 분류로 넘어갈 때는 오른쪽으로. 막힌 자리는 떨어져 있고 기둥 한 칸만큼만
 * 비켜서서, 고른 병은 늘 가리지 않는 자리 안에 남습니다.
 *
 * "보던 분류" 는 칩과 같이 가리지 않는 자리 가운데에 걸린 분류입니다(sectionAt).
 *
 * 분류를 넘어갈 때도 최소한만 옮기면 두 분류의 병이 한 화면에 섞여 섭니다. 병이 둘인 분류의
 * 끝 병에서 다음 분류의 첫 병으로 넘기면 창이 한 칸만 밀려 앞 분류의 병 둘 · 빈 벽 · 다음
 * 이름표 · 첫 병이 함께 섰고, 칩은 앞 분류에 켜진 채 패널은 다음 분류의 향수를 보였습니다.
 * 이름표 벽보다 앞으로 나가지 않으면 앞 분류의 병이 창에 남지 않고, 병을 오른쪽 끝에 두면 뒤
 * 분류의 병도 들어오지 않습니다 — 짧은 분류 뒤에는 다음 이름표까지 빈 벽이 있고, 긴 분류는
 * 병으로 가리지 않는 자리를 채웁니다(layoutWall).
 */
export function revealItem(
  sections: WallSection[],
  from: number,
  clear: number,
  index: number,
  max: number,
  stops: readonly number[],
  lead?: number,
): number {
  if (index >= from && index < from + clear) return from
  const target = sectionAt(sections, index)
  if (!target) return from
  const viewing = sectionAt(sections, from + clear / 2)
  if (index < from && viewing?.category === target.category) {
    const column = lead ?? target.start - target.plaque
    const left = revealStart(
      from,
      clear,
      index,
      max,
      index === target.start ? column : 0,
    )
    return nearStop(stops, left, -1)
  }
  const right = clamp(Math.max(target.plaque, index - clear + 1), 0, max)
  return nearStop(stops, right, 1)
}

/*
 * ── 이름표 벽의 현판 ─────────────────────────────────────────
 *
 * 벽감 앞 이름표 벽 기둥(두 칸, 휴대폰은 한 칸 — layoutWall)에 붙여 둔 종이 판입니다.
 * 옆변은 곧고, 윗변은 양 모서리를 안으로 둥글게 파낸 어깨에서 가운데로 부드럽게 솟는 아치이며,
 * 아래 모서리는 둥급니다. 벽감 높이의 가운데에 섭니다.
 *
 *   폭   = 맨 벽 폭(기둥 폭 − 좌우 옆벽 33 x 2) x 0.9 — 옆벽과 5px 이상 띄우고, 벽감 높이의 29% 이하.
 *          30 아래로는 줄이지 않되, 맨 벽이 그보다 좁은 휴대폰(320)에서도 옆벽에 겹치지는 않습니다
 *   높이 = 벽감 높이 x 0.75 — 폭의 3.2 배 이하(분류 이름을 세로로 세우면 110 이상)
 *
 * 시안(벽감 440)의 현판은 128 x 330, 벽감 높이의 29% x 75% 입니다. 두 칸 기둥이면 1024 이상 모든
 * 화면(과 768)에서 폭이 벽감의 29% 에 걸려 시안 비율로 섭니다. 한 칸 기둥(휴대폰)은 폭이 맨 벽에 먼저
 * 걸려서, 높이를 폭의 3.2 배로 묶어 가늘고 긴 막대가 되지 않게 합니다.
 *
 * 옆벽과의 여백은 (맨 벽 − 폭) / 2 이고, 기둥이 패널 바로 왼쪽에 서면 패널까지는 거기에 33 을 더합니다.
 *
 *   1920 x 1080  칸 182.5 · 벽감 605 → 현판 175 x 455 · 옆벽과 62 · 패널까지 95
 *   1562 x 914   칸 144.13 · 벽감 485 → 현판 140 x 365 · 옆벽과 41 · 패널까지 74
 *   1280 x 720   칸 111.38 · 벽감 345 → 현판 100 x 260 · 옆벽과 28 · 패널까지 61
 *
 * 윗변 · 모서리 · 안쪽 테두리선은 폭에 비례합니다. 1920 x 1080 에서 모서리 파임 12 · 아치 25 ·
 * 아래 모서리 25 · 안쪽 테두리선 6 입니다. 꼭대기에 꽂던 황동 핀은 걷었습니다(S15P21E203-431).
 *
 * 폭이 좁아지면 적는 것을 줄입니다(PlaqueDetail).
 *
 *   full      100 이상   분류 이름 · 짧은 선 · 개수 · 영문 설명 — 두 칸 기둥은 늘 여기입니다
 *   compact   70 이상    영문 설명을 뺍니다 — 한 칸 기둥인 좁은 태블릿
 *   vertical  그 아래    분류 이름을 세로로 세웁니다 — 휴대폰. 가로로는 12px 글자가 한 줄에 안 듭니다
 *
 * 폭 · 높이 · 모양을 바꿀 때는 아래 상수만 고칩니다. 옆벽에 닿지 않는지 · 끝자리 규칙을
 * 지키는지는 테스트가 화면 크기마다 봅니다.
 */
/**
 * 이름표 벽 기둥 좌우를 이웃 벽감의 옆벽 · 입구 테두리가 차지하는 폭.
 * ⚠️ shelf-display.css 의 --track-inset(--bevel 3 + --wall 30)과 같은 값이어야 합니다.
 */
const PLAQUE_SIDE = 33
const PLAQUE_MARGIN = 5
const PLAQUE_WALL_SHARE = 0.9
const PLAQUE_WIDTH_PER_CASE = 0.29
const PLAQUE_MIN_WIDTH = 30
const PLAQUE_HEIGHT_PER_CASE = 0.75
const PLAQUE_MAX_ASPECT = 3.2
/**
 * 분류 이름을 세로로 세운 현판(vertical)의 높이 하한. 다섯 자("시향해 봄" 12px) · 짧은 선 · 개수
 * 14px 이 90 남짓이라, 어깨 아래 · 안쪽 테두리선 안에 넣으려면 110 입니다. 폭의 3.2 배로만 자르면
 * 폭 30 현판(360 휴대폰)이 95 가 되어 글자가 어깨와 아래 테두리선에 걸립니다.
 */
const PLAQUE_VERTICAL_MIN_HEIGHT = 110
/** 모양 — 전부 현판 폭에 곱합니다 */
const PLAQUE_NOTCH = 0.07
const PLAQUE_ARCH = 0.14
const PLAQUE_CORNER = 0.14
/** 네모 판(메뉴판)의 모서리 반지름 — 짧은 변 대비. 네모로 읽히도록 현판보다 훨씬 작습니다 */
const PLATE_CORNER = 0.05
const PLAQUE_INSET = 0.035
/**
 * 네모 판(메뉴판)의 글자 자리 윗여백 — 안쪽 테두리선에서. 좁은 판의 좌우 · 아래 여백(shelf-display.css 의
 * .shelf-plaque-text, 테두리선 + 5)과 같아 글자가 판 가운데에 섭니다
 */
const PLATE_TEXT_TOP = 5
/** 적는 것을 줄이는 폭(위 PlaqueDetail) */
const PLAQUE_CAPTION_MIN_WIDTH = 100
const PLAQUE_ACROSS_MIN_WIDTH = 70

export type PlaqueDetail = 'full' | 'compact' | 'vertical'

/** 현판 윤곽을 그리는 치수(px) */
export type PlaqueOutline = {
  width: number
  height: number
  /** 윗모서리를 안으로 파낸 원호의 반지름 */
  notch: number
  /** 어깨에서 가운데 꼭대기까지 솟는 높이 */
  arch: number
  /** 아래 모서리 반지름 */
  corner: number
}

export type PlaqueMetrics = PlaqueOutline & {
  /**
   * 글자가 시작하는 높이 — 어깨를 올린 현판은 옆변이 끝나는 어깨(모서리 파임 + 아치), 네모 판은 안쪽
   * 테두리선 바로 아래입니다
   */
  crown: number
  /** 바깥선에서 안쪽 테두리선까지 */
  inset: number
  detail: PlaqueDetail
  /** 종이를 오리는 clip-path */
  shape: string
  /** 바깥 가장자리 1px 띠 · 그 안쪽의 빛 받는 1px 띠 */
  edgeRing: string
  rimRing: string
  /** 안쪽 테두리선 1px · 그 안쪽에 앉는 옅은 빛 1px */
  lineRing: string
  glintRing: string
  /** 키보드 포커스 링 — 가장자리 안쪽 2.5px */
  focusRing: string
}

/**
 * 현판 윤곽을 안쪽으로 `d` 만큼 들인 경로(SVG path 문법, 현판 왼쪽 위가 원점).
 *
 * 윤곽은 원호와 직선으로만 그립니다. 원호를 안쪽으로 들인 선은 **같은 중심의 원호**라,
 * 반지름만 d 만큼 바꾸면 바깥선과 어디서나 똑같은 간격으로 따라 도는 선이 됩니다
 * (베지어 곡선이면 들인 선을 어림할 수밖에 없어 간격이 곳곳에서 벌어집니다).
 *
 *   모서리 파임  중심이 옆변 위 끝 바깥(0, arch)인 오목한 원호 → 반지름 notch + d
 *   아치        두 어깨와 꼭대기(가운데, 0)를 지나는 볼록한 원호 → 반지름 R − d
 *   아래 모서리  볼록한 원호 → 반지름 corner − d
 *
 * 들인 선에서 파임과 아치가 만나는 어깨 점은 두 원의 교점으로 다시 구합니다.
 */
export function plaquePath(
  { width: w, height: h, notch, arch, corner }: PlaqueOutline,
  d = 0,
): string {
  const f = (value: number) => +value.toFixed(2)
  const half = w / 2
  // 아치 원 — 두 어깨(notch, arch)와 꼭대기(half, 0)를 지납니다
  const reach = half - notch
  const radius = (reach * reach + arch * arch) / (2 * arch)
  const notchR = notch + d
  const archR = radius - d
  const cornerR = corner - d

  // 들인 옆변(x = d)이 파임 원과 만나는 높이
  const side = arch + Math.sqrt(notchR * notchR - d * d)

  // 파임 원(중심 0, arch)과 아치 원(중심 half, radius)의 두 교점 중 오른쪽 것 — 왼쪽 어깨
  const dx = half
  const dy = radius - arch
  const between = Math.hypot(dx, dy)
  const along =
    (notchR * notchR - archR * archR + between * between) / (2 * between)
  const across = Math.sqrt(Math.max(0, notchR * notchR - along * along))
  const shoulderX = (along * dx + across * dy) / between
  const shoulderY = arch + (along * dy - across * dx) / between

  return (
    `M${f(d)} ${f(h - corner)}V${f(side)}` +
    `A${f(notchR)} ${f(notchR)} 0 0 0 ${f(shoulderX)} ${f(shoulderY)}` +
    `A${f(archR)} ${f(archR)} 0 0 1 ${f(w - shoulderX)} ${f(shoulderY)}` +
    `A${f(notchR)} ${f(notchR)} 0 0 0 ${f(w - d)} ${f(side)}` +
    `V${f(h - corner)}A${f(cornerR)} ${f(cornerR)} 0 0 1 ${f(w - corner)} ${f(h - d)}` +
    `H${f(corner)}A${f(cornerR)} ${f(cornerR)} 0 0 1 ${f(d)} ${f(h - corner)}Z`
  )
}

/**
 * 칸 폭 · 벽감 높이 · 기둥 칸 수(`span`)에 맞는 현판 치수와 모양(위 "이름표 벽의 현판").
 *
 * 모양은 CSS clip-path 값으로 줍니다. 띠(ring)는 바깥 윤곽과 안쪽으로 들인 윤곽을
 * evenodd 로 겹친 것이라, 둘 사이만 칠해져 윤곽을 따라 도는 선이 됩니다. border 로 두르면
 * 네모가 되고, SVG 선으로 그리면 선마다 그러데이션 id 를 따로 달아야 해서입니다.
 */
/**
 * 네모 판의 윤곽을 안쪽으로 `d` 만큼 들인 경로 (S15P21E203-417).
 *
 * 왼쪽 분류 메뉴판이 쓰는 모양입니다. 원호로 어깨를 올리는 `plaquePath` 와 달리 모서리만
 * 둥근 네모라, 들인 선은 반지름을 그만큼 줄인 같은 네모입니다 — 바깥선과 어디서나 똑같은
 * 간격으로 따라 돕니다(테두리 네 겹이 이 성질에 기댑니다).
 *
 * 반지름이 0 이 되면 원호는 직선으로 그려집니다(SVG 규약) — 따로 가르지 않습니다.
 */
export function platePath(
  { width: w, height: h, corner }: PlaqueOutline,
  d = 0,
): string {
  const r = Math.max(0, corner - d)
  const x1 = d
  const y1 = d
  const x2 = w - d
  const y2 = h - d
  return [
    `M${x1 + r} ${y1}`,
    `H${x2 - r}`,
    `A${r} ${r} 0 0 1 ${x2} ${y1 + r}`,
    `V${y2 - r}`,
    `A${r} ${r} 0 0 1 ${x2 - r} ${y2}`,
    `H${x1 + r}`,
    `A${r} ${r} 0 0 1 ${x1} ${y2 - r}`,
    `V${y1 + r}`,
    `A${r} ${r} 0 0 1 ${x1 + r} ${y1}`,
    'Z',
  ].join('')
}

export function plaqueMetrics(
  pitch: number,
  caseHeight: number,
  span = 1,
  /**
   * 판을 자리에 맞추는 값들 (S15P21E203-417). 아무것도 주지 않으면 예전 그대로입니다.
   *
   *   maxHeight     높이 상한(px). 왼쪽에 셋을 쌓는 메뉴판처럼 낮게 만들 때 줍니다
   *   maxWidth      폭 상한(px)
   *   widthPerCase  폭을 벽감 높이에 묶는 비율. 메뉴판은 기둥 폭을 다 쓰므로 Infinity 를 주어
   *                 이 굴레를 풀고, 남은 굴레(맨 벽 폭)가 폭을 정하게 합니다
   *   plate         어깨를 올리지 않고 **모서리만 둥근 네모**로 그립니다 (메뉴판)
   */
  fit: {
    maxHeight?: number
    maxWidth?: number
    widthPerCase?: number
    plate?: boolean
  } = {},
): PlaqueMetrics {
  /*
   * 판이 설 수 있는 맨 벽 폭. 벽 안에 기둥으로 선 현판은 좌우로 벽감의 옆벽이 들어올
   * 자리(PLAQUE_SIDE)를 비워 둬야 하지만, 네모 판은 벽 밖 메뉴라 그 자리가 필요 없습니다.
   */
  const wall = pitch * span - (fit.plate ? 0 : PLAQUE_SIDE * 2)
  const width = Math.max(
    // 하한 30 도 맨 벽보다 넓게 두지는 않습니다 — 옆벽에 겹칩니다(320 휴대폰)
    Math.min(PLAQUE_MIN_WIDTH, floor5(wall)),
    floor5(
      Math.min(
        wall - PLAQUE_MARGIN * 2,
        wall * PLAQUE_WALL_SHARE,
        caseHeight * (fit.widthPerCase ?? PLAQUE_WIDTH_PER_CASE),
        fit.maxWidth ?? Infinity,
      ),
    ),
  )
  const detail: PlaqueDetail =
    width >= PLAQUE_CAPTION_MIN_WIDTH
      ? 'full'
      : width >= PLAQUE_ACROSS_MIN_WIDTH
        ? 'compact'
        : 'vertical'
  const height = Math.min(
    round5(caseHeight * PLAQUE_HEIGHT_PER_CASE),
    Math.max(
      floor5(width * PLAQUE_MAX_ASPECT),
      detail === 'vertical' ? PLAQUE_VERTICAL_MIN_HEIGHT : 0,
    ),
    floor5(fit.maxHeight ?? Infinity),
  )
  /*
   * 모서리 파임 · 아치 · 아래 모서리의 비율을 재는 기준 — **짧은 변**입니다.
   *
   * 세로로 긴 판(지금까지의 분류 현판)은 짧은 변이 곧 폭이라 예전과 값이 같습니다. 가로로 누운
   * 메뉴판에서만 달라집니다 — 폭을 기준으로 두면 아치(폭의 14%)가 낮은 판의 3분의 1을 먹어
   * 현판이 아니라 반원 딱지가 됩니다. 짧은 변으로 재면 눕혀도 같은 형태로 읽힙니다.
   */
  const base = Math.min(width, height)
  const inset = Math.max(3, Math.round(base * PLAQUE_INSET))
  // 네모 판은 모서리를 파지도 어깨를 올리지도 않습니다
  const notch = fit.plate ? 0 : Math.max(3, Math.round(base * PLAQUE_NOTCH))
  const arch = fit.plate ? 0 : Math.max(6, Math.round(base * PLAQUE_ARCH))
  // 안쪽 빛 띠(inset + 2)까지 들여도 아래 모서리 원호가 남아야 합니다
  const corner = fit.plate
    ? Math.max(inset + 2, Math.round(base * PLATE_CORNER))
    : Math.max(inset + 3, Math.round(base * PLAQUE_CORNER))
  /*
   * 글자가 시작하는 높이. 어깨를 올린 현판은 어깨 아래, 어깨가 없는 네모 판은 안쪽 테두리선 바로
   * 아래입니다 — 0 으로 두면 글자가 판 꼭대기의 테두리선에 붙습니다. 네모 판 위를 비워 두던 핀 자리는
   * 핀을 걷으며 없앴습니다(판 가운데에 글자가 섭니다).
   */
  const crown = fit.plate ? inset + PLATE_TEXT_TOP : notch + arch

  const outline = { width, height, notch, arch, corner }
  const draw = fit.plate ? platePath : plaquePath
  const ring = (from: number, to: number) =>
    `path(evenodd, "${draw(outline, from)} ${draw(outline, to)}")`

  return {
    ...outline,
    crown,
    inset,
    detail,
    shape: `path("${draw(outline)}")`,
    edgeRing: ring(0, 1),
    rimRing: ring(1, 2),
    lineRing: ring(inset, inset + 1),
    glintRing: ring(inset + 1, inset + 2),
    focusRing: ring(0, 2.5),
  }
}

/*
 * ── 이름표 태그의 모양 ───────────────────────────────────────
 *
 * 매달린 이름표(크기는 위 "매달린 이름표 자리")는 네 모서리를 안으로 둥글게 파낸 표(ticket)
 * 모양 종이입니다. 가장자리 안쪽에 윤곽을 따라 도는 가는 테두리선이 있고, 윗가운데에 줄을 꿴
 * 황동 아일릿이, 선반 아랫면에는 줄을 건 황동 고리가 박혀 있습니다. 전부 태그 폭에 비례합니다.
 *
 *   모서리 파임  태그 폭 x 10/170 (최소 4)
 *   테두리선     가장자리에서 태그 폭 x 5/170 안쪽 (최소 3)
 *   아일릿       지름 태그 폭 x 10/170 (최소 6). 윗변은 테두리선 간격의 두 배 — 테두리선 아래에 앉습니다
 *   선반 고리    폭 태그 폭 x 10/170 (짝수, 최소 6). 높이는 그 절반인 반구입니다
 *
 * 1920 x 1080(태그 135 x 85)에서 파임 8 · 테두리선 4 · 아일릿 8(윗변 8) · 고리 8 입니다.
 *
 * 글자는 브랜드와 한글 이름 두 가지입니다. 태그가 아주 낮아지면 한글 이름을 한 줄로 줄입니다
 * (TagDetail). 폭이 아니라 **높이**로 가릅니다 — 글자는 태그 폭을 따라 줄다가 읽히는 하한(한글
 * 이름 12px)에서 멈춰서, 좁은 태그에서 먼저 모자라는 것은 줄을 쌓을 높이입니다.
 *
 *   two-line  70 이상   브랜드 · 한글 이름(두 줄까지) — 태그가 최소 80 으로 서서 거의 늘 이쪽입니다
 *   one-line  그 아래   한글 이름을 한 줄로 줄입니다(말줄임) — 이름표 자리 한도에 걸려 태그를 줄여 넣은 창
 *
 * 예전에는 영문 이름 · 부향률까지 네 줄이라 태그 높이에 따라 네 단계(full · no-kind · brief · one-line)로
 * 줄을 뺐습니다. 두 가지만 적으면서 태그 높이를 두 줄이 드는 높이로 잡아(TAG_MIN_HEIGHT) 단계가 둘로
 * 줄었습니다.
 *
 * 모양 · 문턱을 바꿀 때는 아래 상수만 고칩니다. 1920 치수의 끝자리와 줄 수는 테스트가 봅니다.
 */
const TAG_NOTCH = 10 / TAG_WIDTH
const TAG_INSET = 5 / TAG_WIDTH
const TAG_EYELET = 10 / TAG_WIDTH
const TAG_BEAD = 10 / TAG_WIDTH
/** 이름을 두 줄까지 적는 태그 높이(위 TagDetail) */
const TAG_TWO_LINE_MIN_HEIGHT = 70

export type TagDetail = 'two-line' | 'one-line'

/** 이름표 태그를 그리는 치수(px)와 모양 */
export type TagMetrics = {
  /** 네 모서리를 안으로 파낸 원호의 반지름 */
  notch: number
  /** 바깥선에서 안쪽 테두리선까지 */
  inset: number
  /** 아일릿 지름 */
  eyelet: number
  /** 아일릿 윗변의 높이(태그 윗변 기준) */
  eyeletTop: number
  /** 선반 고리 폭. 높이는 절반입니다 */
  bead: number
  detail: TagDetail
  /** 종이를 오리는 clip-path */
  shape: string
  /** 바깥 가장자리 1px 띠 */
  edgeRing: string
  /** 안쪽 테두리선 1px */
  lineRing: string
  /** 키보드 포커스 링 — 가장자리 안쪽 2px */
  focusRing: string
}

/**
 * 네 모서리를 파낸 표 윤곽을 안쪽으로 `d` 만큼 들인 경로(SVG path 문법, 태그 왼쪽 위가 원점).
 *
 * 파낸 모서리는 중심이 태그 모서리인 원호입니다. 윤곽을 안쪽으로 들이면 같은 중심에서 반지름만
 * notch + d 로 커진 원호가 되고, 들인 변(x = d · y = d)과 만나는 자리까지 그립니다. 그래서
 * 바깥선과 어디서나 똑같은 간격으로 따라 도는 선이 됩니다.
 */
export function ticketPath(
  width: number,
  height: number,
  notch: number,
  d = 0,
): string {
  const f = (value: number) => +value.toFixed(2)
  const radius = notch + d
  // 들인 변이 모서리 원과 만나는 자리 — 태그 모서리에서 변을 따라 잰 거리
  const reach = Math.sqrt(Math.max(0, radius * radius - d * d))
  const arc = `A${f(radius)} ${f(radius)} 0 0 0`
  return (
    `M${f(reach)} ${f(d)}H${f(width - reach)}${arc} ${f(width - d)} ${f(reach)}` +
    `V${f(height - reach)}${arc} ${f(width - reach)} ${f(height - d)}` +
    `H${f(reach)}${arc} ${f(d)} ${f(height - reach)}` +
    `V${f(reach)}${arc} ${f(reach)} ${f(d)}Z`
  )
}

/**
 * 태그 폭 · 높이에 맞는 이름표 모양(위 "이름표 태그의 모양").
 *
 * 현판(plaqueMetrics)과 같은 방법입니다 — 모양은 CSS clip-path 값으로 주고, 띠(ring)는 바깥
 * 윤곽과 안쪽으로 들인 윤곽을 evenodd 로 겹쳐 둘 사이만 칠합니다. border 로 두르면 파낸 모서리를
 * 따라 돌지 못합니다.
 */
export function tagMetrics(width: number, height: number): TagMetrics {
  const notch = Math.max(4, Math.round(width * TAG_NOTCH))
  const inset = Math.max(3, Math.round(width * TAG_INSET))
  const eyelet = Math.max(6, Math.round(width * TAG_EYELET))
  // 반구 높이(폭의 절반)가 온 픽셀이 되게 짝수로 둡니다
  const bead = Math.max(6, 2 * Math.round((width * TAG_BEAD) / 2))
  const ring = (from: number, to: number) =>
    `path(evenodd, "${ticketPath(width, height, notch, from)} ${ticketPath(width, height, notch, to)}")`

  return {
    notch,
    inset,
    eyelet,
    eyeletTop: inset * 2,
    bead,
    detail: height >= TAG_TWO_LINE_MIN_HEIGHT ? 'two-line' : 'one-line',
    shape: `path("${ticketPath(width, height, notch)}")`,
    edgeRing: ring(0, 1),
    lineRing: ring(inset, inset + 1),
    focusRing: ring(0, 2),
  }
}

/*
 * ── 옆벽의 문 (S15P21E203-431) ─────────────────────────────────
 *
 * 벽감 좌우 옆벽에 병이 드나드는 아치 문을 냅니다. 문이 없을 때는 병이 뒷벽과 옆벽이 만나는
 * 접힘선에서 칼로 자른 듯 끊겼습니다 — 옆벽은 병이 가는 방향과 수직이라 그 **뒤로** 갈 수가 없는데,
 * 멀쩡한 벽 틈으로 미끄러져 들어가는 것처럼 보였습니다.
 *
 * 이제 병은 접힘선을 지나 옆벽 앞을 지나가다가, 병이 선 깊이에서 옆벽 면을 뚫고 문 안 그늘로 들어가
 * 문 앞기둥(옆벽 중 입구 쪽 조각)에 가려 사라집니다.
 *
 *   깊이   0 입구 ── 앞기둥 ── 문 앞 가장자리 ── 병이 벽 면을 지남 ── 문 뒤 가장자리 ── 1 접힘선
 *               (가림)       DOOR_FRONT        floorFront / floor      DOOR_BACK
 *
 * 벽감은 한 점 투시입니다. 옆벽의 위 · 아래 가장자리가 천장 · 바닥 모서리를 따라 소실점으로 모이므로
 * 옆벽에 선 문도 깊이마다 같은 비율로 줄여 그립니다(`scale`). 그래서 문은 사다리꼴 위에 아치를 얹은
 * 모양이고, 아치의 꼭대기도 깊이를 따라 기웁니다.
 *
 * 문 높이는 병 사진 칸 높이에서 셉니다 — 아치가 시작하는 높이가 병의 1.06 배입니다. 병이 문설주에
 * 걸리지 않고 들어가 보여야 "병이 들어갈 구멍" 으로 읽힙니다. 아치는 **문 폭에 맞춘 반타원**입니다 —
 * 문설주에서 곧게 일어서 둥글게 넘어갑니다. 예전에는 병 높이의 0.2 배를 사인 곡선으로 솟게 해서, 폭
 * 34 에 높이 66 인 뾰족한 머리가 문설주와 꺾여 만나 윗부분이 찌그러져 보였습니다.
 *
 * 모양 · 깊이를 바꿀 때는 아래 상수만 고칩니다. 문이 천장 모서리를 넘지 않는지는 테스트가 봅니다.
 */

/**
 * 벽감 면의 치수(px). ⚠️ shelf-display.css 의 `.shelf-window` 에 적힌 --bevel · --ceil · --wall ·
 * --floor · --floor-front 와 **한 벌**입니다 — 문 윤곽은 이 값으로 셈하고 면은 CSS 가 그려서, 한쪽만
 * 고치면 문이 옆벽에서 어긋납니다(lib.test.ts 가 둘을 맞대 봅니다).
 *
 * 옆벽 45 는 소실점이 벽감 가운데에 오는 폭입니다 — 소실점은 천장 · 바닥 모서리가 만나는 높이(벽감의
 * 40%)에 있고, 거기서 옆벽 폭 = 벽감 폭의 절반 x (천장 + 바닥) / 벽감 높이 입니다. 1920 x 1080
 * (1100 x 605) · 1294 x 697(645 x 355) 둘 다 45 언저리입니다. 30 이던 때는 옆벽이 얇게 누워 문이 설
 * 자리가 없었습니다.
 */
export const NICHE_FACES = {
  bevel: 3,
  ceil: 20,
  wall: 45,
  floor: 30,
  floorFront: 12,
} as const

/**
 * 벽감 뒷벽(양 옆벽 사이)에 **온전히** 드는 칸 수 — 멈춘 벽에서 병이 옆벽의 문에 걸리지 않고 다 보이는
 * 칸입니다(S15P21E203-431). 벽 끝 · 멈출 자리 · 고른 병 들이기 · 한 번에 넘기는 칸을 이 수로 셉니다.
 *
 * 치수(shelfMetrics)의 "가리지 않는 칸" 은 창 폭(패널 왼쪽 끝까지)을 칸 폭으로 나눈 수라 옆벽 두 장 ·
 * 입구 테두리 · 창 여백을 모릅니다. 그 수로 벽 끝을 세면 마지막 병이 오른쪽 옆벽의 문에 반쯤 걸린 채
 * 섰습니다(1784 x 957 · 보유 중 8 병 — 여덟째 병이 절반만 보임). 벽감 폭을 아직 모르면 null 입니다.
 *
 * @param nicheWidth 벽감 폭(px) — 창(ShelfWall 의 section) 폭입니다
 * @param pitch 칸 폭(px)
 */
export function nicheSlots(nicheWidth: number, pitch: number): number | null {
  if (nicheWidth <= 0 || pitch <= 0) return null
  const { bevel, wall } = NICHE_FACES
  // 딱 맞아떨어지는 칸이 부동소수 오차로 하나 덜 세어지지 않게 조금 여유를 둡니다
  return Math.max(
    1,
    Math.floor((nicheWidth - 2 * (bevel + wall)) / pitch + 1e-6),
  )
}

/** 문 앞 · 뒤 가장자리의 깊이(옆벽 폭 대비, 0 이 입구). 앞기둥은 입구에서 12% 입니다 */
const DOOR_FRONT = 0.12
const DOOR_BACK = 0.88
/** 아치가 시작하는 높이 — 병 사진 칸 높이 대비 */
const DOOR_SPRING = 1.06
/**
 * 아치가 솟는 높이 — 화면에서의 문 폭(앞 · 뒤 가장자리 사이) 대비. 반원(0.5)보다 조금 높여, 옆벽이 누운
 * 만큼 좁아 보이는 둥근 머리로 둡니다
 */
const DOOR_RISE = 0.7
/** 아치를 꺾은선으로 나누는 수 — 각도로 고르게 나눠, 문설주에서 일어서는 양 끝이 촘촘합니다 */
const DOOR_ARCH_STEPS = 16

export type DoorMetrics = {
  /** 옆벽 앞끝에서 문 앞 가장자리까지(px). 병은 여기서 앞기둥에 가려 사라집니다 */
  front: number
  /** 옆벽 앞끝에서 병이 옆벽 면을 지나는 자리까지(px). 여기부터 병이 문 안 그늘에 듭니다 */
  plane: number
  /** 옆벽 앞끝에서 문 뒤 가장자리까지(px). 문설주의 두께가 빛을 받는 자리입니다 */
  back: number
  /**
   * 옆벽 면 상자 위끝에서 아치 꼭대기까지(px). 문 안은 벽감과 같은 모래라 깊이를 그늘로만 내는데,
   * 아치 밑 그늘이 여기서 시작합니다(shelf-display.css 의 .shelf-door-hole)
   */
  top: number
  /**
   * 문 윤곽 — 왼쪽 옆벽 면 상자(벽감에서 입구 테두리를 뺀 상자의 왼쪽 옆벽 폭) 기준 clip-path.
   * 오른쪽 옆벽은 같은 윤곽을 좌우로 뒤집어 씁니다(shelf-display.css 의 .shelf-door-right).
   */
  shape: string
}

/**
 * 벽감 높이 · 병 사진 칸 높이에 맞는 옆벽 문(위 "옆벽의 문").
 *
 * @param caseHeight 벽감 높이(px, --case-h)
 * @param bottle 병 사진 칸 높이(px, --bottle-h)
 */
export function doorMetrics(caseHeight: number, bottle: number): DoorMetrics {
  const { bevel, ceil, wall, floor, floorFront } = NICHE_FACES
  const f = (value: number) => +value.toFixed(2)
  // 면 상자 높이 — 옆벽 앞끝(입구)의 높이입니다
  const face = Math.max(1, caseHeight - bevel * 2)
  const floorAt = (depth: number) => face - floor * depth
  const ceilingAt = (depth: number) => ceil * depth
  // 깊이 d 에서 입구의 1px 이 몇 px 로 줄어드는가 — 그 깊이의 옆벽 높이 / 입구 높이
  const scale = (depth: number) => (floorAt(depth) - ceilingAt(depth)) / face
  const spring = bottle * DOOR_SPRING
  const rise = wall * (DOOR_BACK - DOOR_FRONT) * DOOR_RISE
  /*
   * 바닥에서 height 만큼 올라간 벽 위의 점. 아치 꼭대기가 천장 모서리에 닿으면(병이 벽감을 거의
   * 채우는 좁고 낮은 창) 모서리 조금 아래에서 멈춥니다 — 문이 천장까지 뚫리면 옆벽이 두 조각이 됩니다.
   */
  const point = (depth: number, height: number): [x: number, y: number] => {
    const highest = ceilingAt(depth) + 4
    const y = Math.max(highest, floorAt(depth) - height * scale(depth))
    return [wall * depth, y]
  }
  const at = ([x, y]: [number, number]) => `${f(x)} ${f(y)}`

  // 반타원 — 뒤 가장자리(0)에서 앞 가장자리(π)까지 각도로 나눕니다
  const arch = Array.from({ length: DOOR_ARCH_STEPS + 1 }, (_, step) => {
    const angle = (Math.PI * step) / DOOR_ARCH_STEPS
    const t = (1 - Math.cos(angle)) / 2
    const depth = DOOR_BACK + (DOOR_FRONT - DOOR_BACK) * t
    return point(depth, spring + rise * Math.sin(angle))
  })
  const path = [
    `M${at(point(DOOR_FRONT, 0))}`,
    `L${at(point(DOOR_BACK, 0))}`,
    ...arch.map((p) => `L${at(p)}`),
    'Z',
  ].join('')

  return {
    front: f(wall * DOOR_FRONT),
    plane: f(wall * (floorFront / floor)),
    back: f(wall * DOOR_BACK),
    top: f(Math.min(...arch.map(([, y]) => y))),
    shape: `path("${path}")`,
  }
}
