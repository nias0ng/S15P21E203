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
export function nameWithoutBrand(name: string, brand: string): string {
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
 *   벽감 높이 = 위 테두리·천장 23 + 병 위 여유 + 채움 병 + 병 발치부터 아래끝 15
 *   진열장 자리 = 벽감 + 매달린 이름표 자리 85(줄 5 + 태그 65 + 그림자 15)
 *
 * 벽감은 **병이 벽감을 꽉 채운다고 칠 때(채움 병)** 의 크기로 잡습니다. 병 위 여유는
 * 그 높이의 10%(최소 30)입니다.
 *
 * 실제 병 사진은 그 벽감 높이의 70%(BOTTLE_PER_CASE)로 줄여 세웁니다. 채움 병 그대로
 * (벽감의 85%) 세우면 병이 너무 크게 보이고, 넓은 병은 칸 폭을 다 써서 옆 병과 어깨가
 * 붙습니다. 벽감 높이는 채움 병으로 정하므로 사진을 줄여도 화면 구성은 그대로이고,
 * 사진은 object-contain 이라 비율을 지킨 채 줄어듭니다. 줄인 병이 마우스를 올려
 * 1.06 배로 자라도 천장까지는 넉넉히 남습니다.
 */
const HANG = 85
const CASE_CHROME = 38
const HEADROOM = 0.1
const MIN_HEADROOM = 30
const BOTTLE_PER_CASE = 0.7

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
 * 실제 칸 폭 — 병 사진 높이의 0.55 배로 촘촘히 세웁니다. 1920 에서 칸 225, 창 전체 여덟 칸
 * (패널에 가리지 않는 자리에 여섯 칸 반). 가는 병은 높이를 다 쓰고, 넓은 플라콘은 칸 폭에
 * 맞춰 조금 낮아집니다.
 */
const SLOT_PER_BOTTLE = 0.55
const MAX_SLOTS = 12

export type ShelfMetrics = {
  /** 창 전체 — 상세 패널 밑까지 — 에 서는 칸 수(이름표 벽 칸 포함) */
  visible: number
  /**
   * 상세 패널에 가리지 않는 자리에 온전히 들어가는 칸 수. 고른 병을 들이는 자리 · 벽 끝 ·
   * 칩 켜짐(가리지 않는 자리의 가운데)을 이 칸 수로 셉니다.
   */
  clear: number
  /** 칸 하나의 폭(px). 창 폭을 칸 수로 나눈 값이라 끝자리 규칙 밖입니다 */
  pitch: number
  /** 병 사진 칸 높이(px). 벽감 높이의 70% 입니다 */
  bottle: number
  /** 벽감 높이(px) */
  caseHeight: number
}

/**
 * 진열장 자리의 크기로 치수를 정합니다.
 *
 *   width       창 전체 폭(상세 패널 밑까지)
 *   height      진열장 자리 높이
 *   clearWidth  패널에 가리지 않는 폭(창 폭 − 패널 − 간격 20)
 *
 * 1920 x 1080 → 1800 x 780 · 가리지 않는 폭 1440 → 벽감 605 · 병 420 · 칸 225 ·
 * 창 전체 여덟 칸 · 가리지 않는 칸 여섯.
 * 병 · 벽감 높이는 끝자리를 5 로 맞춥니다. 칸 폭만은 창 폭을 나눈 값이라 그대로 둡니다
 * — 반올림하면 칸 수 x 칸 폭이 창 폭과 어긋나 끝 병이 창 경계에 걸립니다.
 */
export function shelfMetrics(
  width: number,
  height: number,
  clearWidth = width,
): ShelfMetrics {
  // 아직 크기를 못 쟀을 때(첫 그림 · 테스트 환경) 벽감 345 기준으로 둡니다
  if (width <= 0 || height <= 0) {
    return { visible: 7, clear: 7, pitch: 200, bottle: 240, caseHeight: 345 }
  }
  const span = clamp(clearWidth, 1, width)

  // ── 벽감 높이 (위 설명 — 채움 병)
  const room = height - HANG - CASE_CHROME
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
    floor5(height - HANG),
  )
  const bottle = floor5(caseHeight * BOTTLE_PER_CASE)

  // ── 칸 — 병 사진 폭에 맞춰 촘촘히, 창 전체를 칸 수로 나눕니다
  const visible = clamp(
    Math.round(width / (bottle * SLOT_PER_BOTTLE)),
    MIN_VISIBLE,
    MAX_SLOTS,
  )
  const pitch = width / visible
  // 딱 맞아떨어지는 칸이 부동소수 오차로 하나 덜 세어지지 않게 조금 여유를 둡니다
  const clear = clamp(Math.floor(span / pitch + 1e-6), 1, visible)

  return { visible, clear, pitch, bottle, caseHeight }
}

/** 진열장 자리에서 벽감 아래로 매달린 이름표가 쓰는 높이 */
export const SHELF_HANG = HANG

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
 * 패널 높이는 두 자리 중 하나에 맞춥니다. 줄인 내용이 벽감에 들면 벽감 높이, 하한에
 * 걸려 안 들면 벽감 + 매달린 이름표 자리(진열장 자리 전체)입니다. 그 사이 아무 데서나
 * 끝나면 패널 아랫선이 벽감에도 이름표에도 맞지 않아 어정쩡합니다.
 *
 * 패널 폭과 벽감 높이는 서로를 정합니다. 패널이 좁아지면 가리지 않는 폭이 넓어지고, 벽감
 * 높이는 그 폭으로 셉니다(shelfMetrics). 그래서 화면 폭에 비례한 폭에서 시작해 폭이 더
 * 바뀌지 않을 때까지 맞춰 봅니다. 벽감 높이를 셀 때 쓰는 칸 수가 바뀌는 경계에서는 폭이
 * 두 값 사이를 오갈 수 있어서 네 번까지만 맞춥니다. 배율은 마지막에 센 벽감 높이로 정하므로
 * 그때도 패널 높이는 벽감과 맞습니다.
 */
const PANEL_WIDTH = 340
const PANEL_CASE = 605
const PANEL_GAP = 20
const PANEL_PASSES = 4
/** 글자가 읽히는 하한. 이보다 작게 줄여야 하는 화면은 배치를 바꿉니다 */
export const PANEL_MIN_SCALE = 0.85
/**
 * 패널 내용 높이(1920 규격). 실측 528(이름 한 줄)에 이름 · 소개가 한 줄씩 더 접힐
 * 자리를 더했습니다. 줄인 내용이 벽감에 드는지 가를 때만 씁니다.
 */
const PANEL_CONTENT = 560
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
  /** 상세 패널 최소 높이(px) — 벽감 높이, 또는 벽감 + 이름표 자리 */
  panelHeight: number
  /** 패널에 가리지 않는 폭(px) — 창 폭 − 패널 폭 − 간격 20. 패널을 얹지 않으면 창 폭 */
  clearWidth: number
}

/**
 * 진열장 자리의 크기로 벽 치수와 상세 패널 크기를 함께 정합니다.
 *
 *   1920 x 1080 → 자리 1800 x 800 → 패널 340 x 605 · 배율 1 · 가리지 않는 폭 1440 · 벽감 605
 *   1440 x 780  → 자리 1340 x 500 → 패널 289 x 500 · 배율 0.85(하한) · 벽감 415
 */
export function shelfLayout(
  width: number,
  height: number,
  { panel = true }: ShelfLayoutOptions = {},
): ShelfLayout {
  if (!panel) {
    return {
      ...shelfMetrics(width, height),
      panelWidth: 0,
      panelScale: 1,
      panelHeight: 0,
      clearWidth: Math.max(0, width),
    }
  }
  // 아직 크기를 못 쟀을 때는 패널을 줄이지 않습니다. ShelfWall 은 재기 전에 패널을 숨깁니다
  if (width <= 0 || height <= 0) {
    const metrics = shelfMetrics(width, height)
    return {
      ...metrics,
      panelWidth: PANEL_WIDTH,
      panelScale: 1,
      panelHeight: metrics.caseHeight,
      clearWidth: Math.max(0, width - PANEL_WIDTH - PANEL_GAP),
    }
  }

  const scaleOf = (caseHeight: number) =>
    clamp(caseHeight / PANEL_CASE, PANEL_MIN_SCALE, 1)
  const metricsFor = (panelWidth: number) =>
    shelfMetrics(width, height, width - panelWidth - PANEL_GAP)

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
    panelHeight:
      PANEL_CONTENT * panelScale <= metrics.caseHeight
        ? metrics.caseHeight
        : metrics.caseHeight + HANG,
    clearWidth: width - panelWidth - PANEL_GAP,
  }
}

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
  /**
   * 벽감 뒤에 비워 두는 벽 칸 수. 병이 적어 이 분류가 한 화면을 못 채우면, 이 분류의
   * 첫머리에 섰을 때 다음 분류가 화면(상세 패널 밑 포함)에 비치지 않도록 벽을 비웁니다.
   * 마지막 분류 뒤에는 다음 분류가 없어서 두지 않습니다.
   */
  gap: number
}

export type WallLayout = {
  sections: WallSection[]
  /** 끝 벽까지 합친 칸 수 */
  total: number
}

/**
 * `visible` 은 창 전체(상세 패널 밑까지)의 칸 수입니다. 주면, 이름표 벽 + 벽감이 한 화면을
 * 못 채우는 분류 뒤에 빈 벽(`gap`)을 둬서 다음 분류가 창 밖에서 시작하게 합니다.
 */
export function layoutWall(sections: ShelfSection[], visible = 0): WallLayout {
  let at = 0
  const placed = sections.map((section, index) => {
    const plaque = at
    const start = plaque + 1
    const span = Math.max(1, section.items.length)
    const last = index === sections.length - 1
    const gap = last ? 0 : Math.max(0, visible - 1 - span)
    at = start + span + gap
    return { ...section, plaque, start, span, gap }
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
