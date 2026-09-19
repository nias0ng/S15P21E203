import { cn } from '@/shared/lib/cn'
import { GLASS_PANEL } from '@/shared/ui/panel'

import type { SeasonStatistic } from '../types'

import { SeasonRatingChart } from './SeasonRatingChart'

type Props = {
  seasons: SeasonStatistic[]
  isPending?: boolean
}

/**
 * 향수 상세 ③ 계절별 평가 (A10 — DTL-14). **읽기 전용입니다** — 계절 등록은 후기
 * 작성 화면으로 옮겼습니다(DTL-16). 후기가 없어도 네 계절이 0 으로 와서 도넛은
 * 그대로 그립니다(숨기면 아래 구역이 위아래로 움직입니다).
 */
export function PerfumeSeasonRatings({ seasons, isPending = false }: Props) {
  return (
    <section className={cn(GLASS_PANEL, 'space-y-3.75')}>
      <h2 className="text-ink text-title font-serif font-semibold">
        계절별 평가
      </h2>
      {/* 불러오는 중에도 0% 도넛을 그립니다. 값만 바뀌므로 자리가 흔들리지 않습니다. */}
      <SeasonRatingChart seasons={isPending ? [] : seasons} />
    </section>
  )
}
