import { cn } from '@/shared/lib/cn'

/**
 * 헤더가 앉는 바탕 — 어느 화면 위인지는 껍데기(RootLayout)가 정합니다.
 * surface 기본 · paper 진열대 종이 결 · glass 밤하늘 위 유리 · glassLight 밝은 하늘 위 유리
 */
export type HeaderTone = 'surface' | 'paper' | 'glass' | 'glassLight'

// 유리판(3D 향 지도 위). `fixed` 라 3D 가 헤더 뒤까지 깔립니다
export const GLASS = cn(
  'fixed inset-x-0',
  'before:pointer-events-none before:absolute before:inset-0 before:-z-10',
  'before:bg-linear-to-b before:to-transparent before:backdrop-blur-xs',
  'before:[mask-image:linear-gradient(to_bottom,black_40%,transparent)]',
)

/* 헤더 위 글자 · 선 · 펼침 메뉴의 색 */
export type Ink = {
  /** 유리판의 옅은 색 — 유리(glass · glassLight)에만 씁니다 */
  tint: string
  /** 글자 그림자. 상속되므로 헤더에 한 번 겁니다 */
  shadow: string
  text: string
  hover: string
  open: string
  ring: string
  menu: string
  item: string
  itemRule: string
  login: string
}

// 밤하늘 위 유리 — 상아색 글자가 최저 7.4:1, 먹색으로 두면 1.2:1 입니다
const GLASS_INK: Ink = {
  tint: 'before:from-surface-night/25',
  shadow: 'text-shadow-xs text-shadow-surface-night/40',
  text: 'text-surface',
  hover: 'hover:text-surface/70',
  open: 'text-surface/70',
  ring: 'focus-visible:ring-surface focus-visible:ring-offset-surface-night',
  menu: 'border-surface/15 bg-surface-night/90 shadow-overlay',
  item: 'text-surface hover:bg-surface/10',
  itemRule: 'border-surface/15',
  login: 'border-surface/40 text-surface hover:bg-surface/10',
}

// 밝은 하늘(낮 · 저녁) 위 유리 — 상아색 글자는 살구색 하늘이 비쳐 1.7:1 까지
// 떨어져 먹색 + 상아색 판(25%, 최저 6.4:1)으로 둡니다
const GLASS_LIGHT_INK: Ink = {
  tint: 'before:from-surface/25',
  shadow: 'text-shadow-xs text-shadow-surface/40',
  text: 'text-ink',
  hover: 'hover:text-ink/70',
  open: 'text-ink/70',
  ring: 'focus-visible:ring-accent-deep',
  menu: 'border-line bg-surface-card shadow-overlay',
  item: 'text-ink hover:bg-line-soft',
  itemRule: 'border-line',
  login: 'border-ink/40 text-ink hover:bg-surface/40',
}

const PAPER_INK: Ink = {
  ...GLASS_LIGHT_INK,
  tint: '',
  login: 'border-ink/40 text-ink hover:bg-line-soft',
}

/** 포커스 링 — 링 색은 바탕마다 ink.ring 으로 더합니다 */
export const FOCUS =
  'rounded-card outline-none focus-visible:ring-2 focus-visible:ring-offset-2'

export const inkOf = (tone: HeaderTone): Ink =>
  tone === 'glass'
    ? GLASS_INK
    : tone === 'glassLight'
      ? GLASS_LIGHT_INK
      : PAPER_INK

export const isGlass = (tone: HeaderTone) =>
  tone === 'glass' || tone === 'glassLight'
