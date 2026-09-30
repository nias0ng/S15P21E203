import { useTranslation } from 'react-i18next'

import { localizedName } from '@/shared/i18n/locale'
import { useLocale } from '@/shared/store/localeStore'
import { Badge } from '@/shared/ui/Badge'
import { Button } from '@/shared/ui/Button'
import { Thumbnail } from '@/shared/ui/Thumbnail'

import { GENDER_TEXT } from '../types'
import type { PerfumeDetail } from '../types'

type Props = {
  perfume: PerfumeDetail
  inShelf: boolean
  shelfPending?: boolean
  onShelfAction: () => void
  aside?: React.ReactNode
}

export function PerfumeOverview({
  perfume,
  inShelf,
  shelfPending = false,
  onShelfAction,
  aside,
}: Props) {
  const { t } = useTranslation('perfume')
  const locale = useLocale()
  const title = localizedName(locale, perfume.name, perfume.nameKo)

  // 제목이 한국어 이름일 때만 원래 이름을 받쳐 적습니다
  const meta = [
    title !== perfume.name ? perfume.name : null,
    perfume.gender ? GENDER_TEXT[perfume.gender] : null,
  ].filter((part): part is string => typeof part === 'string')

  return (
    <section className="flex flex-col gap-7.5 sm:flex-row">
      <Thumbnail
        src={perfume.images[0] ?? null}
        fallback={t('overview.imageFallback')}
        fit="contain"
        className="h-100 w-75 shrink-0 bg-white"
      />

      <div className="flex flex-1 flex-col gap-6.25">
        <div className="space-y-2.5">
          <div className="space-y-0.5">
            <p className="text-ink-muted text-caption">{perfume.brand?.name}</p>

            {meta.length > 0 && (
              <p className="text-ink-muted text-caption">{meta.join(' · ')}</p>
            )}
          </div>

          <h1 className="text-ink text-display font-serif font-semibold">
            {title}
          </h1>

          {perfume.concentration && (
            <div className="flex flex-wrap gap-1.25">
              <Badge tone="outline">{perfume.concentration}</Badge>
            </div>
          )}

          <Button
            variant={inShelf ? 'outline' : 'primary'}
            isLoading={shelfPending}
            onClick={onShelfAction}
          >
            {inShelf ? t('overview.shelfRemove') : t('overview.shelfSave')}
          </Button>
        </div>

        {aside}
      </div>
    </section>
  )
}
