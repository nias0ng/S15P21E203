import { SegmentedFilter } from '@/shared/ui/SegmentedFilter'

import {
  GENDER_FILTERS,
  SHELF_FILTERS,
  type GenderFilter,
  type ShelfFilter,
} from '../types'

type PerfumeFiltersProps = {
  shelf: ShelfFilter | null
  gender: GenderFilter | null
  onShelfChange: (next: ShelfFilter | null) => void
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
  shelf,
  gender,
  onShelfChange,
  onGenderChange,
}: PerfumeFiltersProps) {
  return (
    <div className="space-y-4">
      <SegmentedFilter
        label="많은 사람이 담은 기준 필터"
        options={SHELF_FILTERS}
        value={shelf}
        onChange={onShelfChange}
      />
      <SegmentedFilter
        label="향의 성별"
        options={GENDER_FILTERS}
        value={gender}
        onChange={onGenderChange}
      />
    </div>
  )
}
