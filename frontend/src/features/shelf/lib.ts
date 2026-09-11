import type { PerfumeOption, ShelfItem, ShelfSection } from './types'

/**
 * 진열대 향수를 "고를 수 있는 향수" 모양으로 바꿉니다.
 *
 * 진열대 등록 모달(A15)과 컬렉션 향수 추가 모달(A19)이 똑같은 네 필드를 받는데,
 * 두 모달이 서로 다른 도메인에 있어서 화면(pages)마다 같은 map 을 손으로 적고
 * 있었습니다. 필드가 하나 늘면 두 화면을 다 찾아 고쳐야 하고, 한쪽만 고치면
 * 모달이 조용히 빈 값을 받습니다.
 *
 * 함수를 진열대 도메인에 두는 이유: 후보를 만들어 내는 쪽이 언제나 진열대이기
 * 때문입니다. "진열대에 없는 향수는 컬렉션에 추가할 수 없다"(A19 주석)가 그 규칙이고,
 * 이 함수가 그 규칙의 유일한 통로입니다.
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
 * 메모를 마지막으로 쓴 날을 `YYYY.MM.DD` 로 적습니다.
 *
 * 백엔드는 UTC ISO 를 주는데 그대로 보여주면 `2026-08-20T00:00:00Z` 가 화면에
 * 그대로 찍힙니다. **보는 사람의 지역 날짜**로 옮겨서 적습니다 — UTC 로 자르면
 * 한국에서 밤 9시 이후에 쓴 메모가 다음 날로 보입니다.
 *
 * `shared/lib` 이 아니라 여기 두는 이유: 지금 부르는 곳이 진열대 한 곳뿐입니다.
 * 두 번째 도메인이 같은 표기를 쓰게 되면 그때 `shared/lib` 으로 올립니다
 * (CLAUDE.md — "예상해서 미리 shared 에 올리지 않습니다").
 */
export function formatShelfDate(iso: string | null): string | null {
  if (!iso) return null
  const at = new Date(iso)
  if (Number.isNaN(at.getTime())) return null

  const pad = (value: number) => String(value).padStart(2, '0')
  return `${at.getFullYear()}.${pad(at.getMonth() + 1)}.${pad(at.getDate())}`
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
  const angle = Math.min(limit, Math.max(-limit, swing.angle + speed * dt))
  return { angle, speed }
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value))
const floor5 = (value: number) => Math.floor(value / 5) * 5
const ceil5 = (value: number) => Math.ceil(value / 5) * 5

/*
 * ── 진열장 치수 ─────────────────────────────────────────────
 *
 * 벽감 높이는 화면이 남긴 세로 공간을 채우고, 한 화면의 칸 수는 가로 폭이 정합니다.
 * 머리말 부제와 하단 문구를 걷어낸 만큼 진열장이 커지도록, 치수를 고정값이 아니라
 * 진열장 자리의 크기에서 계산합니다.
 *
 *   벽감 높이 = 위 테두리·천장 23 + 병 위 여유 + 병 + 병 발치부터 아래끝 15
 *   진열장 자리 = 벽감 + 매달린 이름표 자리 85(줄 5 + 태그 65 + 그림자 15)
 *
 * 병 위 여유는 병 높이의 10%(최소 30)입니다. 마우스를 올리면 병이 1.06 배로 자라는데
 * 그만큼은 천장 아래에 남아야 합니다.
 */
const HANG = 85
const CASE_CHROME = 38
const HEADROOM = 0.1
const MIN_HEADROOM = 30

/**
 * 칸 폭과 병 높이의 비율. 칸 폭이 병 높이의 0.6 배쯤일 때 가는 병은 높이를 다 쓰고,
 * 넓은 플라콘은 폭에 맞춰 조금 낮아집니다(시안의 칸도 이 비율입니다).
 * 병 높이는 칸 폭의 1.8 배를 넘기지 않습니다 — 넘기면 대부분의 병이 폭에 막혀
 * 키만 큰 빈 칸이 됩니다.
 */
const PITCH_PER_BOTTLE = 0.6
const MAX_BOTTLE_PER_PITCH = 1.8

/**
 * 한 화면의 칸 수. 다섯 칸을 바라되, 칸 폭이 200px 아래로 내려가면 줄입니다.
 * 이름표 벽도 칸 하나를 쓰므로 다섯 칸이면 병이 적어도 넷은 보입니다.
 */
const PREFERRED_VISIBLE = 5
const MIN_PITCH = 200
const MIN_VISIBLE = 3
const MAX_VISIBLE = 9

export type ShelfMetrics = {
  /** 한 화면에 서는 칸 수(이름표 벽 칸 포함) */
  visible: number
  /** 칸 하나의 폭(px). 창 폭을 칸 수로 나눈 값이라 끝자리 규칙 밖입니다 */
  pitch: number
  /** 병 칸 높이(px) */
  bottle: number
  /** 벽감 높이(px) */
  caseHeight: number
}

/**
 * 진열장 자리의 폭 · 높이로 치수를 정합니다.
 *
 * 1920 x 1080 에서 진열장 자리는 1440 x 780 입니다 → 다섯 칸(288) · 병 515 · 벽감 605.
 * 병 · 벽감 높이는 끝자리를 5 로 맞춥니다. 칸 폭만은 창 폭을 나눈 값이라 그대로 둡니다
 * — 반올림하면 칸 수 x 칸 폭이 창 폭과 어긋나 끝 병이 창 경계에 걸립니다.
 */
export function shelfMetrics(width: number, height: number): ShelfMetrics {
  // 아직 크기를 못 쟀을 때(첫 그림 · 테스트 환경) 예전 치수로 둡니다
  if (width <= 0 || height <= 0) {
    return { visible: 7, pitch: 200, bottle: 280, caseHeight: 345 }
  }

  const room = height - HANG - CASE_CHROME
  const tallest = Math.min(room / (1 + HEADROOM), room - MIN_HEADROOM)

  const preferred = Math.round(width / (tallest * PITCH_PER_BOTTLE))
  const roomy = Math.min(PREFERRED_VISIBLE, Math.floor(width / MIN_PITCH))
  const visible = clamp(Math.max(preferred, roomy), MIN_VISIBLE, MAX_VISIBLE)
  const pitch = width / visible

  const bottle = Math.max(
    100,
    floor5(Math.min(tallest, pitch * MAX_BOTTLE_PER_PITCH)),
  )
  const headroom = Math.max(MIN_HEADROOM, bottle * HEADROOM)
  const caseHeight = Math.min(
    ceil5(CASE_CHROME + headroom + bottle),
    floor5(height - HANG),
  )

  return { visible, pitch, bottle, caseHeight }
}

/** 진열장 자리에서 벽감 아래로 매달린 이름표가 쓰는 높이 */
export const SHELF_HANG = HANG

/*
 * ── 벽 한 줄의 칸 배치 ──────────────────────────────────────
 *
 * 분류마다 [이름표 벽][벽감] 을 붙이고 맨 끝에 벽 한 칸을 더 둡니다.
 *
 *   이름표 벽 · 보유 중 벽감(5) · 이름표 벽 · 시향해 봄 벽감(17) · 이름표 벽 · 보유 희망 벽감(3) · 끝 벽
 *
 * **이름표 벽도 병과 같은 폭(한 칸)입니다.** 벽감 사이 벽 폭이 칸 폭과 다르면, 두 벽감에
 * 걸쳐 멈췄을 때 한쪽 끝 병이 창 경계에 걸립니다. 전부 같은 폭이면 칸 수만큼 끊어 멈추는
 * 것만으로 창 양 끝에 병이 걸리지 않습니다.
 * 이름표 벽의 좌우 가장자리는 이웃 벽감의 옆벽이 차지하고, 가운데에 분류 이름이 섭니다.
 * 끝 벽은 마지막 벽감의 오른쪽 옆벽이 설 자리입니다.
 */
export type WallSection = ShelfSection & {
  /** 이름표 벽의 칸 순서 */
  plaque: number
  /** 벽감 첫 칸의 순서 */
  start: number
  /** 벽감이 차지하는 칸 수. 비어 있어도 "비어 있음" 을 적을 한 칸은 둡니다 */
  span: number
}

export type WallLayout = {
  sections: WallSection[]
  /** 끝 벽까지 합친 칸 수 */
  total: number
}

export function layoutWall(sections: ShelfSection[]): WallLayout {
  let at = 0
  const placed = sections.map((section) => {
    const plaque = at
    const start = plaque + 1
    const span = Math.max(1, section.items.length)
    at = start + span
    return { ...section, plaque, start, span }
  })
  return { sections: placed, total: at + 1 }
}

/**
 * 칸 위치(소수)에 걸친 분류. 이름표 벽은 뒤따르는 벽감의 분류로 칩니다.
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
 * 휠이 멈춘 뒤 설 자리(칸 순서). 창 왼쪽 끝을 칸 경계에 맞춰서, 창 양 끝에 병이
 * 걸리지 않게 합니다.
 *
 * 가장 가까운 경계로만 붙이면 휠을 한 칸(마우스 휠 한 번 ≒ 반 칸) 굴렸을 때 제자리로
 * 되돌아와 휠이 안 먹는 것처럼 느껴집니다. 그래서 **굴린 쪽으로** 다음 병이 조금만
 * (칸 폭의 12%) 들어와도 그 병을 마저 들여 세웁니다 — 넘어가던 병은 끝까지 보여 줍니다.
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
