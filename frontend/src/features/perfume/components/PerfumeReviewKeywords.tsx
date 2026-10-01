import { useTranslation } from 'react-i18next'

import { Badge } from '@/shared/ui/Badge'

import type { ReviewKeyword } from '../types'

type Props = {
  keywords: ReviewKeyword[]
}

export function PerfumeReviewKeywords({ keywords }: Props) {
  const { t } = useTranslation('perfume')

  if (keywords.length === 0) return null

  return (
    <div className="space-y-2.5">
      <p className="text-ink-muted text-caption">{t('keywords.caption')}</p>
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
