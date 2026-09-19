import { Badge } from '@/shared/ui/Badge'

import type { ReviewKeyword } from '../types'

type Props = {
  keywords: ReviewKeyword[]
}

/**
 * 후기에서 자주 나온 향 표현 (A10). **표현이 없으면 안 그립니다** — 지금은 적재
 * 코드가 없어 전부 빈 배열입니다. ⚠️ 퍼센트의 분모는 **향을 언급한 후기**이고
 * 합이 100 을 넘으니 원형 차트에 쓰지 마세요.
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
