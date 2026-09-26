import { Badge } from '@/shared/ui/Badge'

import type { ReviewKeyword } from '../types'

type Props = {
  keywords: ReviewKeyword[]
}

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
