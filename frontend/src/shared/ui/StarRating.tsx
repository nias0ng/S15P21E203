import { useRef } from 'react'

import { cn } from '@/shared/lib/cn'

type StarRatingProps = {
  /** 무엇에 대한 점수인지 (화면에 보이지 않습니다) */
  label: string
  /** 1.0 ~ 5.0 을 0.5 단위로. 아직 안 매겼으면 null */
  value: number | null
  /** 읽기 전용이면 넘기지 마세요 */
  onChange?: (next: number) => void
  /** 숫자를 옆에 적을지. 카드처럼 원만 보여주는 자리에서는 끕니다 */
  showValue?: boolean
  /** 원 지름. 기본 md(15px) / lg(20px) — 카드 한 장을 크게 보여주는 자리 */
  size?: RatingSize
  className?: string
}

type RatingSize = 'md' | 'lg'

/** 원 지름. 활자가 아니라 그림이라 활자 스케일을 안 씁니다 */
const CIRCLE_SIZE: Record<RatingSize, string> = {
  md: 'size-3.75',
  lg: 'size-5',
}

/** 원 개수. 백엔드가 1.0~5.0 만 받습니다(`@DecimalMin("1.0") @DecimalMax("5.0")`) */
const CIRCLES = 5

/** 고를 수 있는 값. 열이 아니라 아홉입니다 — 0.5 를 보내면 백엔드가 400 입니다 */
const VALUES = [1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5]

/**
 * 취향 적합도 (A15 — SHF-12 · DTL-18 · DTL-19). 0.5 단위이고 **별이 아니라 원**입니다.
 *
 * NOTE: 라디오 그룹이라 화살표 키 이동을 직접 처리합니다 — `role="radio"` 만으로는
 * 안 움직입니다.
 */
export function StarRating({
  label,
  value,
  onChange,
  showValue = true,
  size = 'md',
  className,
}: StarRatingProps) {
  if (!onChange) {
    return (
      <span className={cn('inline-flex items-center gap-1.25', className)}>
        <span aria-hidden className="flex items-center gap-1.25">
          {Array.from({ length: CIRCLES }, (_, index) => (
            <RatingCircle key={index} fill={fillOf(value, index)} size={size} />
          ))}
        </span>
        {/* 그림이 aria-hidden 이라 값은 글자로 한 번 읽힙니다 */}
        <span
          className={cn('text-ink-muted text-caption', !showValue && 'sr-only')}
        >
          {value === null ? '아직 매기지 않음' : `${value} / ${CIRCLES}`}
        </span>
      </span>
    )
  }

  return (
    <EditableRating
      label={label}
      value={value}
      onChange={onChange}
      showValue={showValue}
      size={size}
      className={className}
    />
  )
}

function EditableRating({
  label,
  value,
  onChange,
  showValue,
  size,
  className,
}: Required<
  Pick<StarRatingProps, 'label' | 'onChange' | 'showValue' | 'size'>
> & {
  value: number | null
  className?: string
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([])

  const checkedIndex = VALUES.indexOf(value ?? NaN)

  /** 화살표로 옮긴 자리에 값과 포커스를 함께 둡니다 — 라디오 그룹의 약속입니다 */
  const moveTo = (index: number) => {
    const clamped = Math.min(VALUES.length - 1, Math.max(0, index))
    onChange(VALUES[clamped]!)
    refs.current[clamped]?.focus()
  }

  const handleKeyDown = (event: React.KeyboardEvent) => {
    // 아직 아무것도 안 골랐으면 첫 값에서 시작합니다
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
          // 원 하나가 (index + 0.5, index + 1) 두 값을 맡습니다. 첫 원만 왼쪽 반이 없습니다
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
        {value === null ? '아직 매기지 않음' : `${value} / ${CIRCLES}`}
      </span>
    </span>
  )
}

/** 누르는 자리. 원을 직접 단추로 만들면 반쪽을 누를 수가 없어 투명한 칸을 얹습니다 */
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
  /** 아무것도 안 골랐을 때 탭이 여기로 들어옵니다 */
  first: boolean
  onSelect: (next: number) => void
  className?: string
}) {
  return (
    <button
      ref={ref}
      type="button"
      role="radio"
      aria-checked={checked}
      aria-label={`${CIRCLES}점 중 ${score}점`}
      // 라디오 그룹은 통째로 탭 한 번에 들어오고 안에서는 화살표로 움직입니다
      tabIndex={checked || (!anyChecked && first) ? 0 : -1}
      onClick={() => onSelect(score)}
      className={cn(
        'focus-visible:ring-accent-deep absolute inset-y-0 rounded-full outline-none focus-visible:ring-2',
        className,
      )}
    />
  )
}

/** 원 하나가 얼마나 찼는지. 4.5 면 다섯 번째 원이 반만 찹니다 */
function fillOf(
  value: number | null,
  index: number,
): 'full' | 'half' | 'empty' {
  const score = value ?? 0
  if (score >= index + 1) return 'full'
  if (score >= index + 0.5) return 'half'
  return 'empty'
}

/**
 * 원 하나. 글자(`●`)가 아니라 SVG 인 것은 반만 채우려면 도형을 잘라야 해서입니다.
 *
 * NOTE: 색은 `currentColor` 입니다. 못 박으면 색을 따로 쓰는 화면에서 원만 떠 보입니다.
 */
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
