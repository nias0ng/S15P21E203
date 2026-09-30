import { useTranslation } from 'react-i18next'

import { cn } from '@/shared/lib/cn'
import { splitSentences } from '@/shared/lib/splitSentences'
import { GLASS_PANEL } from '@/shared/ui/panel'

type Props = {
  summary: string | null
  sourceReviewCount: number | null
  isPending?: boolean
}

export function PerfumeReviewSummary({
  summary,
  sourceReviewCount,
  isPending = false,
}: Props) {
  const { t } = useTranslation('perfume')

  return (
    <section className={cn(GLASS_PANEL, 'space-y-2.5')}>
      <h2 className="text-ink text-title font-serif font-semibold">
        {t('summary.title')}
      </h2>

      {isPending ? (
        <p className="text-ink-muted text-body">{t('summary.loading')}</p>
      ) : summary ? (
        <>
          <div className="text-ink text-body space-y-1.25">
            {splitSentences(summary).map((sentence, index) => (
              <p key={index}>{sentence}</p>
            ))}
          </div>
          {sourceReviewCount !== null && (
            <p className="text-ink-muted text-caption mt-5">
              {t('summary.source', { count: sourceReviewCount })}
            </p>
          )}
        </>
      ) : (
        <p className="text-ink-muted text-body">{t('summary.empty')}</p>
      )}
    </section>
  )
}
