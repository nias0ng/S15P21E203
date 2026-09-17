import { PillFilter } from '@/shared/ui/PillFilter'

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
 * 알약 하나하나는 공용 `PillFilter` 입니다 — 브랜드 정렬이 같은 모양을 쓰게 되면서
 * `shared/ui` 로 올렸습니다.
 */
export function PerfumeFilters({
  ranking,
  gender,
  onRankingChange,
  onGenderChange,
}: PerfumeFiltersProps) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-2.5">
      <PillFilter
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

      <PillFilter
        label="향의 성별"
        options={GENDER_FILTERS}
        value={gender}
        onChange={onGenderChange}
      />
    </div>
  )
}
