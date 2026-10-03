/*
 * 그래픽 설정의 낱말(모드 · 단계 · GPU 부류)은 `shared/store/graphicsStore` 에 있습니다 — 고르는 자리가
 * 헤더의 톱니바퀴라 헤더도 읽어야 합니다. 여기에는 엔진과 주고받는 일(모양 좁히기 · 주소 · 안내 판정)만 둡니다.
 */
import { i18n } from '@/shared/i18n'
import type { Locale } from '@/shared/i18n/locale'
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
 * 엔진 페이지 주소. 고정 단계면 `?quality=` 를, 언어를 주면 `lang=` 을 붙입니다.
 *
 * 엔진은 렌더러를 만들 때 이 값을 읽습니다 — `window.PB` 가 열리기 전이라 처리기로는
 * 늦습니다. `auto` 는 붙이지 않습니다(엔진의 기본값입니다). 언어도 첫 글자를 그리기 전에
 * 정해져야 해서 주소에 싣습니다 — 뜬 뒤에 바뀐 언어는 `PB.setLang` 으로 겁니다.
 */
export function engineSrc(
  base: string,
  mode: GraphicsMode,
  lang?: Locale,
): string {
  const params = new URLSearchParams()
  if (mode !== 'auto') params.set('quality', mode)
  if (lang) params.set('lang', lang)
  const query = params.toString()
  return query ? `${base}?${query}` : base
}

/**
 * 알릴 것의 문구 — 지금 화면 언어로 **부를 때** 고릅니다. 표로 두면 모듈을 읽을 때의 언어로 굳습니다.
 */
export function noticeMessage(notice: QualityNotice): string {
  return i18n.t(`map:quality.${notice}`)
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
