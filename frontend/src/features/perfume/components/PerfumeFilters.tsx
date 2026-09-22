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
 * 향수 목록 필터 (A33). 앞 세 개는 **전체 사용자 집계**, 뒤 세 개는 향의 성별이고
 * 둘은 **겹쳐 걸 수 있습니다.** 가운데를 선으로 가르지 않으면 서로 다른 두 필터가
 * "여섯 중 하나" 로 읽힙니다.
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

      {/*
        좁은 화면에서 줄이 접히면 가를 것이 없어 숨깁니다.

        NOTE: 선 토큰(`bg-line`)이 아니라 흰색을 직접 씁니다 — 어두운 방의
        `--color-line` 은 0.22 라 알약 테두리보다 흐려서, 두 필터를 가르는 일을
        못 합니다. 0.45 는 `.scent-pill` 테두리 고리가 가장 밝은 데서 쓰는 값과
        같아, 알약과 같은 빛에서 난 선으로 읽힙니다.
      */}
      <span
        aria-hidden
        className="mx-1.25 hidden h-5 w-px shrink-0 bg-white/45 sm:block"
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
