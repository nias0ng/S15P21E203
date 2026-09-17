import { cn } from '@/shared/lib/cn'
import { GLASS_PANEL } from '@/shared/ui/panel'

import type { SeasonStatistic } from '../types'

import { SeasonRatingChart } from './SeasonRatingChart'

type Props = {
  seasons: SeasonStatistic[]
  isPending?: boolean
}

/**
 * 향수 상세 ③ 계절별 평가 (와이어프레임 A10 — DTL-14)
 *
 * **읽기 전용입니다.** 계절 등록은 후기 작성 화면으로 옮겼습니다(DTL-16) —
 * 남들의 집계를 보는 이 구역에 등록까지 두면 입구가 둘이 됩니다.
 *
 * 후기가 없는 향수도 네 계절이 0 으로 옵니다. 그때도 도넛 네 개를 그립니다 —
 * 구역을 통째로 숨기면 아래 구역들이 위아래로 움직여 눈이 자리를 다시 찾습니다.
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
