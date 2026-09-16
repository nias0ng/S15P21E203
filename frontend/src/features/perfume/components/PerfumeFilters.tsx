import { cn } from '@/shared/lib/cn'

import {
  GENDER_FILTERS,
  RANKING_FILTERS,
  type GenderFilter,
  type RankingFilter,
} from '../types'

type PerfumeFiltersProps = {
  ranking: RankingFilter | null
  gender: GenderFilter | null
  onRankingChange: (next: RankingFilter | null) => void
  onGenderChange: (next: GenderFilter | null) => void
}

/**
 * 향수 목록 필터 (와이어프레임 A33 — 유리판 시안)
 *
 * - 위 세 개는 **전체 사용자 집계** 기준(많은 사람이 보유 · 희망 · 조회한 향수),
 *   뒤 세 개는 향의 성별. 앞뒤는 **겹쳐 걸 수 있습니다**
 * - 아무것도 고르지 않은 상태가 기본 → 둘 다 null 로 시작하고, 고른 것을 다시
 *   누르면 해제됩니다
 *
 * **여섯 개를 한 줄에 늘어놓되 가운데를 선으로 가릅니다.** 시안이 한 줄인데,
 * 선이 없으면 "여섯 중 하나" 로 읽힙니다 — 실제로는 서로 다른 두 필터라 하나씩
 * 동시에 걸 수 있습니다. 두 줄로 나누면 그 뜻은 분명해지지만 시안과 멀어져서,
 * 줄은 하나로 두고 선으로만 가릅니다.
 *
 * 공용 `SegmentedFilter` 를 쓰지 않습니다. 그쪽은 칸을 고르게 나눠 채우는 한 덩이
 * (알약 안의 알약)이고, 여기는 낱개 알약이 흩어져 서는 모양이라 배치가 다릅니다.
 */
export function PerfumeFilters({
  ranking,
  gender,
  onRankingChange,
  onGenderChange,
}: PerfumeFiltersProps) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-2.5">
      <FilterGroup
        label="많은 사람이 담은 기준 필터"
        options={RANKING_FILTERS}
        value={ranking}
        onChange={onRankingChange}
      />

      {/* 두 필터를 눈으로 가릅니다. 좁은 화면에서 줄이 접히면 가를 것이 없어 숨깁니다 */}
      <span
        aria-hidden
        className="bg-line mx-1.25 hidden h-5 w-px shrink-0 sm:block"
      />

      <FilterGroup
        label="향의 성별"
        options={GENDER_FILTERS}
        value={gender}
        onChange={onGenderChange}
      />
    </div>
  )
}

function FilterGroup<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string
  options: readonly { value: T; label: string }[]
  value: T | null
  onChange: (next: T | null) => void
}) {
  return (
    // 눌린 상태를 aria-pressed 로 알리므로 group 으로 묶어 이름을 붙입니다
    <div role="group" aria-label={label} className="flex items-center gap-2.5">
      {options.map((option) => {
        const selected = value === option.value

        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(selected ? null : option.value)}
            className={cn(
              'scent-pill text-caption rounded-full px-6.25 py-1.75',
              'text-ink transition-colors duration-120 ease-out',
              'focus-visible:ring-accent outline-none focus-visible:ring-2',
            )}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
