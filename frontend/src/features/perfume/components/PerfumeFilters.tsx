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
 * 위 줄은 **전체 사용자 집계** 기준, 아래 줄은 향의 성별. 겹쳐 걸 수 있어 상태를
 * 따로 두고, 아무것도 안 고른 상태가 기본이라 둘 다 null 로 시작합니다.
 */
export function PerfumeFilters({
  shelf,
  gender,
  onShelfChange,
  onGenderChange,
}: PerfumeFiltersProps) {
  // 본문 폭까지 늘이면 칸 하나가 370px 이라 두 글자 라벨이 허허벌판에 놓입니다
  return (
    <div className="max-w-92 space-y-2.5">
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
