import { useEffect, useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useMediaQuery } from '@/shared/hooks/useMediaQuery'
import { cn } from '@/shared/lib/cn'
import { useTourStore } from '@/shared/store/tourStore'

import { inkLink, type Ink } from './tone'

// 뜻 풀이의 차례 — 화면에서 처음 마주치는 차례입니다. 말은 번역 묶음(tour 의 guide.terms)에 있습니다
const TERMS = ['buoy', 'zone', 'explored', 'chart', 'log', 'cabin'] as const

function QuestionIcon() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      className="size-5"
    >
      {/* 톱니바퀴(GraphicsMenu)의 바깥 반지름 8.1 과 같은 원 — 둘이 나란히 같은 크기로 섭니다 */}
      <circle cx="10" cy="10" r="8.1" />
      <path d="M7.75 7.75a2.25 2.25 0 1 1 3.2 2.05c-.6.3-.95.8-.95 1.45v.5" />
      <circle cx="10" cy="14.3" r="0.45" fill="currentColor" stroke="none" />
    </svg>
  )
}

/**
 * 메인 3D 의 이용 안내 — 헤더의 '?'. 조작법과 이 사이트가 쓰는 말(부표 · 해역 · 탐색 % …)을 풀고,
 * 첫 방문 안내를 처음부터 다시 겁니다 (`tourStore` 의 restart).
 *
 * 세계관 말(해역 · 해도 · 향해 일지 · 선실)이 설명 없이 기능 이름으로 쓰여 처음 온 사람이 뜻을 몰랐습니다
 * (사용성 테스트). 첫 방문 안내는 그 말이 처음 나오는 자리에서 한 번 풀고, 여기는 언제든 다시 보는 자리입니다.
 *
 * NOTE: 3D 를 누르면 닫힙니다 — 그 누름은 iframe 안이라 창의 `blur` 로 옵니다 (`GraphicsMenu` 와 같은 사정).
 */
export function GuideMenu({ ink }: { ink: Ink }) {
  const { t } = useTranslation('tour')
  const restart = useTourStore((state) => state.restart)
  // 손가락 기기는 미니맵을 두 번 눌러 떠나고 방향키가 없습니다 (엔진 minimap.js · index.html 의 .pb-help-keys)
  const touch = useMediaQuery('(pointer: coarse)')
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

  const controls = touch
    ? (['sea', 'buoy', 'minimapTouch'] as const)
    : (['sea', 'buoy', 'keys', 'minimap'] as const)

  return (
    <div ref={root} className="relative">
      <button
        ref={trigger}
        type="button"
        aria-label={t('guide.trigger')}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-controls={panelId}
        onClick={() => setOpen(!open)}
        className={cn('block', inkLink(ink), open && ink.open)}
      >
        <QuestionIcon />
      </button>

      {open && (
        <div
          id={panelId}
          role="dialog"
          aria-label={t('guide.title')}
          className={cn(
            'absolute top-full right-0 z-30 mt-2.5 w-80 border py-1.25',
            'max-h-[calc(100dvh-var(--header-h)-var(--spacing)*5)] overflow-y-auto',
            /*
              NOTE: 좁은 화면에서는 화면 양 여백 안에 폅니다. '?' 는 톱니바퀴 · 로그인 왼쪽이라, 단추에
              오른끝을 맞추면 판(320)이 390 폭에서 왼쪽으로 45px 넘쳤습니다. 헤더는 제 몸에 transform ·
              filter 가 없어(흐림은 ::before) 이 판의 fixed 가 화면을 기준으로 섭니다.
            */
            'max-sm:fixed max-sm:inset-x-[var(--gutter)] max-sm:top-[var(--header-h)] max-sm:mt-0 max-sm:w-auto',
            ink.menu,
            ink.text,
          )}
        >
          <section className="px-2.5 pt-1.25 pb-2.5">
            <h2 className="text-caption pb-1.25 opacity-70">
              {t('guide.controlsTitle')}
            </h2>
            <ul className="space-y-1">
              {controls.map((key) => (
                <li key={key} className="text-caption leading-snug break-keep">
                  {t(`guide.controls.${key}`)}
                </li>
              ))}
            </ul>
          </section>

          <section
            className={cn('border-t px-2.5 pt-2.5 pb-2.5', ink.itemRule)}
          >
            <h2 className="text-caption pb-1.25 opacity-70">
              {t('guide.termsTitle')}
            </h2>
            <dl className="space-y-1.5">
              {TERMS.map((key) => (
                <div key={key}>
                  <dt className="text-caption font-medium">
                    {t(`guide.terms.${key}.term`)}
                  </dt>
                  <dd className="text-[11px] leading-snug break-keep opacity-70">
                    {t(`guide.terms.${key}.desc`)}
                  </dd>
                </div>
              ))}
            </dl>
          </section>

          <button
            type="button"
            onClick={() => {
              restart()
              setOpen(false)
            }}
            className={cn(
              'text-caption block w-full border-t px-2.5 pt-2.5 pb-1.25 text-left',
              ink.itemRule,
              ink.item,
              'focus-visible:ring-1 focus-visible:ring-current focus-visible:outline-none focus-visible:ring-inset',
            )}
          >
            {t('guide.restart')}
          </button>
        </div>
      )}
    </div>
  )
}
