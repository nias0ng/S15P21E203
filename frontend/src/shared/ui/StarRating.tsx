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
  className?: string
}

/** 원 개수. 백엔드가 1.0~5.0 만 받습니다(`@DecimalMin("1.0") @DecimalMax("5.0")`) */
const CIRCLES = 5

/**
 * 고를 수 있는 값 아홉 개.
 *
 * **열이 아니라 아홉인 이유는 최소가 0.5 가 아니라 1.0 이라서입니다.** 0.5 를 보내면
 * 백엔드가 400 을 냅니다. 그래서 첫 원은 왼쪽 반이 따로 없고 원 하나가 통째로 1.0 입니다.
 */
const VALUES = [1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5]

/**
 * 취향 적합도 (와이어프레임 A15 — SHF-12 · DTL-18 · DTL-19)
 *
 * **별이 아니라 원입니다.** 진열대 카드 시안이 `● ● ● ● ○` 라 모양을 맞췄습니다.
 * 파일 이름은 `StarRating` 그대로 둡니다 — 이름을 바꾸면 import 하는 곳이 함께
 * 움직이는데, 지금 진열대 화면을 다른 사람이 만지고 있습니다. 정리는 따로 합니다.
 *
 * **0.5 단위입니다.** 예전에는 정수만 받았고 `'★'.repeat(4.5)` 가 소수를 버려
 * (오류가 나지 않고) 원이 네 개만 그려졌습니다. 조용히 틀리던 자리입니다.
 *
 * 라디오 그룹으로 만듭니다. 화살표 키 이동과 "9개 중 8번째" 안내가 여기에 달려
 * 있습니다. `role="radio"` 만으로는 화살표가 안 움직여서 직접 처리합니다.
 */
export function StarRating({
  label,
  value,
  onChange,
  showValue = true,
  className,
}: StarRatingProps) {
  if (!onChange) {
    return (
      <span className={cn('inline-flex items-center gap-1.25', className)}>
        <span aria-hidden className="flex items-center gap-1.25">
          {Array.from({ length: CIRCLES }, (_, index) => (
            <RatingCircle key={index} fill={fillOf(value, index)} />
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
      className={className}
    />
  )
}

function EditableRating({
  label,
  value,
  onChange,
  showValue,
  className,
}: Required<Pick<StarRatingProps, 'label' | 'onChange' | 'showValue'>> & {
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
          // 원 index 는 (index + 0.5, index + 1) 두 값을 맡습니다.
          // 첫 원만 왼쪽 반이 없습니다 — 0.5 는 백엔드가 안 받습니다.
          const half = index === 0 ? null : index + 0.5
          const full = index + 1

          return (
            <span key={index} className="relative inline-flex">
              <RatingCircle fill={fill} />

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
                // 첫 원은 반이 없어 원 전체가 1.0 입니다
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

/**
 * 누르는 자리. 원 위에 반쪽씩 겹쳐 둡니다.
 *
 * 그림이 아니라 이 투명한 칸이 단추입니다. 원을 직접 단추로 만들면 반쪽을 누를 수가
 * 없습니다.
 */
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

/** 원 하나가 얼마나 찼는지. 4.5 면 다섯 번째 원이 반만 찹니다. */
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
 * 원 하나.
 *
 * 글자(`●`)가 아니라 SVG 입니다. 반만 채우려면 도형을 잘라야 하는데 글자는 못 자릅니다.
 * 반원은 위에서 아래로 **왼쪽을 지나는** 호입니다(sweep 0).
 *
 * 색을 `currentColor`(fill-current · stroke-current)로 두는 이유: 이 원은 놓이는
 * 화면의 글자색을 따라야 합니다. 예전에는 `fill-ink` 로 못 박혀 있어서, 색을 따로
 * 쓰는 화면(진열대 상세 카드 — 따뜻한 먹색)에 얹으면 원만 차가운 먹색으로 떠
 * 보였습니다. 부르는 쪽이 색을 정할 수 있게 하면 진열대는 감싸는 곳의 색을 그대로
 * 물려받고, 기본 화면(body 가 text-ink)에서는 예전과 같은 색이 나옵니다.
 * 빈 원은 그 색을 옅게 깐 테두리입니다 — line 토큰(stonegray)과 거의 같은 명도입니다.
 */
function RatingCircle({ fill }: { fill: 'full' | 'half' | 'empty' }) {
  return (
    <svg viewBox="0 0 20 20" aria-hidden className="size-3.75 shrink-0">
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
