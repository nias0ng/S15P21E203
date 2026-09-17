import { Badge } from '@/shared/ui/Badge'

import type { ReviewKeyword } from '../types'

type Props = {
  keywords: ReviewKeyword[]
}

/**
 * 후기에서 자주 나온 향 표현 (A10 — DTL)
 *
 * **표현이 없으면 아무것도 그리지 않습니다.** 지금은 키워드를 적재하는 코드가 없어
 * 모든 향수가 빈 배열입니다 — 적재가 도는 날 화면을 손대지 않아도 나타납니다.
 *
 * ⚠️ 퍼센트의 분모는 **향을 언급한 후기**입니다(키워드가 하나라도 뽑힌 후기).
 * 이 향수의 전체 후기가 아닙니다. 그래서 문구에 그 사실을 적습니다 — "후기 중 62%"
 * 로 읽히면 실제보다 큰 숫자를 말하게 됩니다.
 *
 * 합이 100 을 넘습니다(후기 하나에서 여러 표현이 나옵니다). 원형 차트나 누적 막대에
 * 쓰지 마세요.
 */
export function PerfumeReviewKeywords({ keywords }: Props) {
  if (keywords.length === 0) return null

  return (
    <div className="space-y-2.5">
      <p className="text-ink-muted text-caption">
        향을 언급한 후기에서 자주 나온 표현
      </p>
      <ul className="flex flex-wrap gap-2.5">
        {keywords.map((item) => (
          <li key={item.keyword}>
            <Badge tone="neutral">
              {item.keyword} {item.percentage}%
            </Badge>
          </li>
        ))}
      </ul>
    </div>
  )
}
