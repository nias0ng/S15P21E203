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
 * **읽기 전용입니다.** 계절 등록은 후기 작성 화면으로 옮겼습니다(DTL-16) —
 * 남들의 집계를 보는 이 구역에 등록까지 두면 입구가 둘이 됩니다.
 */
export function PerfumeSeasonRatings({ ratings }: Props) {
  return (
    <section className="space-y-3.75 p-6.25">
      <h2 className="text-ink text-sm font-bold">계절별 평가</h2>
      <SeasonRatingChart ratings={ratings ?? PLACEHOLDER_SEASON_RATINGS} />
    </section>
  )
}
