/*
 * 그래픽 설정의 낱말(모드 · 단계 · GPU 부류)은 `shared/store/graphicsStore` 에 있습니다 — 고르는 자리가
 * 헤더의 톱니바퀴라 헤더도 읽어야 합니다. 여기에는 엔진과 주고받는 일(모양 좁히기 · 주소 · 안내 판정)만 둡니다.
 */
import {
  isGraphicsMode,
  type GpuClass,
  type GraphicsMode,
  type GraphicsTier,
  type QualityNotice,
  type QualityReason,
  type SceneQuality,
} from '@/shared/store/graphicsStore'

const TIERS: readonly GraphicsTier[] = ['high', 'mid', 'low', 'min']
const REASONS: readonly QualityReason[] = [
  'start',
  'down',
  'up',
  'user',
  'slow',
]
const GPU_CLASSES: readonly GpuClass[] = [
  'discrete',
  'integrated',
  'apple',
  'software',
  'unknown',
]

const oneOf = <T extends string>(
  list: readonly T[],
  value: unknown,
): value is T =>
  typeof value === 'string' && (list as readonly string[]).includes(value)

/**
 * 엔진이 넘긴 품질 정보(`host.js` 의 `hostQuality` · `PB.quality.get()`)를 좁힙니다.
 *
 * @param raw iframe 너머에서 온 값 — 모양을 믿지 않습니다
 * @returns 모양이 맞으면 `SceneQuality`, 아니면 null (그 기능 전 엔진 빌드도 null 입니다)
 */
export function parseSceneQuality(raw: unknown): SceneQuality | null {
  if (typeof raw !== 'object' || raw === null) return null
  const { mode, tier, reason, gpu } = raw as Record<string, unknown>
  if (!isGraphicsMode(mode) || !oneOf(TIERS, tier)) return null
  const cls =
    typeof gpu === 'object' && gpu !== null
      ? (gpu as Record<string, unknown>).cls
      : undefined
  return {
    mode,
    tier,
    reason: oneOf(REASONS, reason) ? reason : 'start',
    gpuClass: oneOf(GPU_CLASSES, cls) ? cls : 'unknown',
  }
}

/**
 * 엔진 페이지 주소. 고정 단계면 `?quality=` 를 붙입니다.
 *
 * 엔진은 렌더러를 만들 때 이 값을 읽습니다 — `window.PB` 가 열리기 전이라 처리기로는
 * 늦습니다. `auto` 는 붙이지 않습니다(엔진의 기본값입니다).
 */
export function engineSrc(base: string, mode: GraphicsMode): string {
  return mode === 'auto' ? base : `${base}?quality=${mode}`
}

export const NOTICE_MESSAGE: Record<QualityNotice, string> = {
  startLow:
    '내장 그래픽이라 가벼운 화면으로 시작했습니다. 오른쪽 위 톱니바퀴에서 바꿀 수 있습니다',
  down: '화면이 끊겨 그래픽을 한 단계 낮췄습니다',
  slow: '전원을 연결하거나 Windows 그래픽 설정에서 브라우저를 고성능으로 두면 더 부드럽습니다',
}

/**
 * 이 품질 정보가 사람에게 알릴 일인가.
 *
 * 자동으로 **낮게** 시작했거나(내장 GPU 는 낮음 · 소프트웨어 GPU 는 최저), 자동으로 내렸거나, 가장 낮은 단계에서도
 * 느릴 때만 알립니다. 올라간 것은 알리지 않습니다 — 화면이 좋아진 것은 보면 압니다.
 *
 * @returns 알릴 것, 없으면 null. 한 번 알린 것을 다시 알릴지는 부르는 쪽이 정합니다
 */
export function qualityNotice(quality: SceneQuality): QualityNotice | null {
  if (quality.reason === 'down') return 'down'
  if (quality.reason === 'slow') return 'slow'
  if (
    quality.reason === 'start' &&
    quality.mode === 'auto' &&
    (quality.tier === 'low' || quality.tier === 'min') &&
    (quality.gpuClass === 'integrated' || quality.gpuClass === 'software')
  ) {
    return 'startLow'
  }
  return null
}
