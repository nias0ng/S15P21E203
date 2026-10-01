import { useEffect, useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { cn } from '@/shared/lib/cn'
import {
  useGraphicsStore,
  type GraphicsMode,
} from '@/shared/store/graphicsStore'

import { inkLink, type Ink } from './tone'

// 이름 · 안내는 번역 묶음(layout 의 graphics.mode)에 두고 그릴 때 풉니다
const GRAPHICS_MODES: readonly GraphicsMode[] = [
  'auto',
  'high',
  'mid',
  'low',
  'min',
]

function GearIcon() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinejoin="round"
      className="size-5"
    >
      {/* 이 8개 · 바깥 반지름 8.1 · 안 6.2 — 선 굵기(1.4)를 더해도 20 칸 안에 듭니다 */}
      <path d="M8.40 4.01L8.59 2.02L11.41 2.02L11.60 4.01A6.2 6.2 0 0 1 13.10 4.63L14.65 3.36L16.64 5.35L15.37 6.90A6.2 6.2 0 0 1 15.99 8.40L17.98 8.59L17.98 11.41L15.99 11.60A6.2 6.2 0 0 1 15.37 13.10L16.64 14.65L14.65 16.64L13.10 15.37A6.2 6.2 0 0 1 11.60 15.99L11.41 17.98L8.59 17.98L8.40 15.99A6.2 6.2 0 0 1 6.90 15.37L5.35 16.64L3.36 14.65L4.63 13.10A6.2 6.2 0 0 1 4.01 11.60L2.02 11.41L2.02 8.59L4.01 8.40A6.2 6.2 0 0 1 4.63 6.90L3.36 5.35L5.35 3.36L6.90 4.63A6.2 6.2 0 0 1 8.40 4.01Z" />
      <circle cx="10" cy="10" r="2.5" />
    </svg>
  )
}

/**
 * 메인 3D 의 그래픽 설정 (S15P21E203-435) — 헤더의 톱니바퀴. 자동 · 높음 · 보통 · 낮음 · 최저.
 *
 * 처음은 자동입니다. 엔진이 GPU 를 보고 시작 단계를 고르고(내장 그래픽이면 낮음), 끊기면 한 단계씩
 * 내립니다. 여기서 고르면 그 단계에 **고정**되고 엔진은 더 움직이지 않습니다.
 * 설정과 엔진의 지금 단계는 `graphicsStore` 가 쥡니다 — 엔진과 잇는 것은 메인(`useSceneQuality`)입니다.
 *
 * NOTE: 3D 를 누르면 닫힙니다 — 그 누름은 iframe 안이라 이 문서의 `pointerdown` 으로 오지 않고,
 * 포커스가 iframe 으로 넘어가며 창의 `blur` 로 옵니다 (`CabinBubble` 과 같은 사정). 그래서
 * 다른 헤더 메뉴의 `useDismissable` 을 쓰지 않습니다.
 */
export function GraphicsMenu({ ink }: { ink: Ink }) {
  const { t } = useTranslation('layout')
  const mode = useGraphicsStore((state) => state.mode)
  const setMode = useGraphicsStore((state) => state.setMode)
  const quality = useGraphicsStore((state) => state.quality)
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const panelId = useId()

  useEffect(() => {
    if (!open) return

    const close = () => setOpen(false)
    const onPointerDown = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) close()
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      close()
      trigger.current?.focus()
    }

    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    window.addEventListener('blur', close)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('blur', close)
    }
  }, [open])

  const integrated =
    quality?.gpuClass === 'integrated' || quality?.gpuClass === 'software'

  return (
    <div ref={root} className="relative">
      <button
        ref={trigger}
        type="button"
        aria-label={t('graphics.trigger')}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-controls={panelId}
        onClick={() => setOpen(!open)}
        className={cn('block', inkLink(ink), open && ink.open)}
      >
        <GearIcon />
      </button>

      {open && (
        <div
          id={panelId}
          role="dialog"
          aria-label={t('graphics.title')}
          // 글자색을 판에 한 번 겁니다 — 제목 · 안내문은 줄(ink.item)이 아니라 헤더 바탕의 색을 따라야 합니다
          className={cn(
            'absolute top-full right-0 z-30 mt-2.5 w-65 border py-1.25',
            ink.menu,
            ink.text,
          )}
        >
          <fieldset>
            <legend className="text-caption px-2.5 pt-1.25 pb-1.25 opacity-70">
              {t('graphics.title')}
            </legend>
            {GRAPHICS_MODES.map((optionMode) => {
              const live =
                optionMode === 'auto' && mode === 'auto' && quality
                  ? t(
                      integrated ? 'graphics.liveIntegrated' : 'graphics.live',
                      {
                        tier: t(`graphics.tier.${quality.tier}`),
                      },
                    )
                  : null
              return (
                <label
                  key={optionMode}
                  className={cn(
                    'flex cursor-pointer items-start gap-2.5 px-2.5 py-1.25',
                    ink.item,
                    // 라디오는 가려 두었으니 키보드 초점은 줄에 그립니다 — 글자색 링이라 두 바탕 모두에 맞습니다
                    'has-focus-visible:ring-1 has-focus-visible:ring-current has-focus-visible:ring-inset',
                  )}
                >
                  <input
                    type="radio"
                    name={panelId}
                    value={optionMode}
                    checked={mode === optionMode}
                    onChange={() => setMode(optionMode)}
                    className="peer sr-only"
                  />
                  <span
                    aria-hidden
                    className="mt-1.25 size-2.5 shrink-0 rounded-full border border-current peer-checked:bg-current"
                  />
                  <span>
                    <span className="text-caption block">
                      {t(`graphics.mode.${optionMode}.label`)}
                      {optionMode === 'auto' && (
                        <span className="opacity-60">
                          {' '}
                          {t('graphics.recommended')}
                        </span>
                      )}
                    </span>
                    <span className="block text-[11px] leading-snug opacity-70">
                      {live ?? t(`graphics.mode.${optionMode}.hint`)}
                    </span>
                  </span>
                </label>
              )
            })}
          </fieldset>

          {integrated && (
            <p
              className={cn(
                'mt-1.25 border-t px-2.5 pt-2.5 pb-1.25 text-[11px] leading-snug opacity-70',
                ink.itemRule,
              )}
            >
              {t('graphics.integratedTip')}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
