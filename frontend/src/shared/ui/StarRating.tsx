import { useRef } from 'react'
import { useTranslation } from 'react-i18next'

import { cn } from '@/shared/lib/cn'

type StarRatingProps = {
  label: string
  value: number | null
  onChange: (next: number) => void
  showValue?: boolean
  size?: RatingSize
  className?: string
}

type RatingSize = 'md' | 'lg'

const CIRCLE_SIZE: Record<RatingSize, string> = {
  md: 'size-3.75',
  lg: 'size-5',
}

const CIRCLES = 5

const VALUES = [1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5]

/**
 * 취향 적합도 (A15 — SHF-12 · DTL-18 · DTL-19). 0.5 단위이고 별이 아니라 원
 * NOTE: 라디오 그룹이라 화살표 키 이동을 직접 처리합니다 — `role="radio"` 만으로는 안 움직입니다.
 */
export function StarRating({
  label,
  value,
  onChange,
  showValue = true,
  size = 'md',
  className,
}: StarRatingProps) {
  const { t } = useTranslation('layout')
  const refs = useRef<(HTMLButtonElement | null)[]>([])

  const checkedIndex = VALUES.indexOf(value ?? NaN)

  const moveTo = (index: number) => {
    const clamped = Math.min(VALUES.length - 1, Math.max(0, index))
    onChange(VALUES[clamped]!)
    refs.current[clamped]?.focus()
  }

  const handleKeyDown = (event: React.KeyboardEvent) => {
    const from = checkedIndex === -1 ? 0 : checkedIndex

    switch (event.key) {
      case 'ArrowLeft':
      case 'ArrowUp':
        event.preventDefault()
        moveTo(from - 1)
        break
      case 'ArrowRight':
      case 'ArrowDown':
        event.preventDefault()
        moveTo(from + 1)
        break
      case 'Home':
        event.preventDefault()
        moveTo(0)
        break
      case 'End':
        event.preventDefault()
        moveTo(VALUES.length - 1)
        break
    }
  }

  return (
    <span
      role="radiogroup"
      aria-label={label}
      onKeyDown={handleKeyDown}
      className={cn('inline-flex items-center gap-1.25', className)}
    >
      <span className="flex items-center gap-1.25">
        {Array.from({ length: CIRCLES }, (_, index) => {
          const fill = fillOf(value, index)
          const half = index === 0 ? null : index + 0.5
          const full = index + 1

          return (
            <span key={index} className="relative inline-flex">
              <RatingCircle fill={fill} size={size} />

              {half !== null && (
                <HitArea
                  ref={(node) => {
                    refs.current[VALUES.indexOf(half)] = node
                  }}
                  score={half}
                  checked={value === half}
                  anyChecked={checkedIndex !== -1}
                  first={false}
                  onSelect={onChange}
                  className="left-0 w-1/2"
                />
              )}

              <HitArea
                ref={(node) => {
                  refs.current[VALUES.indexOf(full)] = node
                }}
                score={full}
                checked={value === full}
                anyChecked={checkedIndex !== -1}
                first={index === 0}
                onSelect={onChange}
                className={index === 0 ? 'left-0 w-full' : 'right-0 w-1/2'}
              />
            </span>
          )
        })}
      </span>

      <span
        className={cn(
          'text-ink-muted text-caption ml-1.25',
          !showValue && 'sr-only',
        )}
      >
        {value === null ? t('starRating.unrated') : `${value} / ${CIRCLES}`}
      </span>
    </span>
  )
}

function HitArea({
  ref,
  score,
  checked,
  anyChecked,
  first,
  onSelect,
  className,
}: {
  ref: (node: HTMLButtonElement | null) => void
  score: number
  checked: boolean
  anyChecked: boolean
  first: boolean
  onSelect: (next: number) => void
  className?: string
}) {
  const { t } = useTranslation('layout')

  return (
    <button
      ref={ref}
      type="button"
      role="radio"
      aria-checked={checked}
      aria-label={t('starRating.score', { max: CIRCLES, score })}
      tabIndex={checked || (!anyChecked && first) ? 0 : -1}
      onClick={() => onSelect(score)}
      className={cn(
        'focus-visible:ring-accent-deep absolute inset-y-0 rounded-full outline-none focus-visible:ring-2',
        className,
      )}
    />
  )
}

function fillOf(
  value: number | null,
  index: number,
): 'full' | 'half' | 'empty' {
  const score = value ?? 0
  if (score >= index + 1) return 'full'
  if (score >= index + 0.5) return 'half'
  return 'empty'
}

function RatingCircle({
  fill,
  size,
}: {
  fill: 'full' | 'half' | 'empty'
  size: RatingSize
}) {
  return (
    <svg
      viewBox="0 0 20 20"
      aria-hidden
      className={cn('shrink-0', CIRCLE_SIZE[size])}
    >
      {fill === 'full' ? (
        <circle cx="10" cy="10" r="8" className="fill-current" />
      ) : (
        <>
          <circle
            cx="10"
            cy="10"
            r="7.25"
            className="fill-none stroke-current opacity-30"
            strokeWidth="1.5"
          />
          {fill === 'half' && (
            <path d="M10 2 A8 8 0 0 0 10 18 Z" className="fill-current" />
          )}
        </>
      )}
    </svg>
  )
}
