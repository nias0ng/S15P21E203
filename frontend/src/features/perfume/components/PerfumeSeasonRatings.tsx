import { cn } from '@/shared/lib/cn'
import { PANEL } from '@/shared/ui/panel'

import type { SeasonRating } from '../types'

import { SeasonRatingChart } from './SeasonRatingChart'

/**
 * ⚠️ 계절별 평가(DTL-14)가 백엔드 응답에 아직 없습니다. 와이어프레임을 눈으로
 * 확인할 수 있도록 그 화면의 수치를 그대로 넣어두었습니다.
 * API 가 준비되면 이 상수를 지우고 ratings 를 응답 값으로 받으세요.
 */
const PLACEHOLDER_SEASON_RATINGS: SeasonRating[] = [
  { season: 'SPRING', percentage: 40 },
  { season: 'SUMMER', percentage: 12 },
  { season: 'AUTUMN', percentage: 38 },
  { season: 'WINTER', percentage: 10 },
]

type Props = {
  /** 없으면 와이어프레임 자리표시자 수치를 씁니다. 백엔드 연결 시 넘겨주세요. */
  ratings?: SeasonRating[]
}

/**
 * 향수 상세 ③ 계절별 평가 (와이어프레임 A10 — DTL-14)
 *
 * **읽기 전용입니다.** 예전에는 이 구역에 [계절 등록] 단추가 있어 모달이 떴는데,
 * 계절 등록은 후기 작성 화면(A24a)의 한 항목으로 옮겼습니다(DTL-16). 내가 이
 * 향을 어느 계절에 맡았는지는 후기와 같은 순간에 남기는 값이라, 남들의 집계를
 * 보는 이 구역에서 따로 등록하면 두 개의 서로 다른 입구가 생깁니다.
 */
export function PerfumeSeasonRatings({ ratings }: Props) {
  return (
    <section className={cn(PANEL, 'space-y-4')}>
      <h2 className="text-ink text-sm font-bold">계절별 평가</h2>
      <SeasonRatingChart ratings={ratings ?? PLACEHOLDER_SEASON_RATINGS} />
    </section>
  )
}
