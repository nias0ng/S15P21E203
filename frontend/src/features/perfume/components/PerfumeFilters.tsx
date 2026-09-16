import { SegmentedFilter } from '@/shared/ui/SegmentedFilter'

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
 * 향수 목록 필터 두 줄 (와이어프레임 A33)
 *
 * - 위 줄은 **전체 사용자 집계** 기준(많은 사람이 보유 · 희망 · 조회한 향수),
 *   아래 줄은 향의 성별. 위 줄은 로그인이 필요 없습니다
 * - 두 줄을 겹쳐 걸 수 있다 → 상태를 따로 관리합니다
 * - 아무 필터도 고르지 않은 상태가 기본 → 둘 다 null 로 시작합니다
 */
export function PerfumeFilters({
  ranking,
  gender,
  onRankingChange,
  onGenderChange,
}: PerfumeFiltersProps) {
  return (
    /*
      두 줄 다 폭을 본문 끝까지 늘리지 않습니다. 고를 것이 셋뿐이라 1440 을 다 쓰면
      칸 하나가 480px 이 되어, 누르는 자리보다 빈 자리가 훨씬 넓어집니다.
      같은 폭으로 맞춰 두 줄이 왼쪽에서 나란히 섭니다.
    */
    <div className="space-y-2.5">
      <SegmentedFilter
        className="max-w-[390px]"
        label="많은 사람이 담은 기준 필터"
        options={RANKING_FILTERS}
        value={ranking}
        onChange={onRankingChange}
      />
      <SegmentedFilter
        className="max-w-[390px]"
        label="향의 성별"
        options={GENDER_FILTERS}
        value={gender}
        onChange={onGenderChange}
      />
    </div>
  )
}
