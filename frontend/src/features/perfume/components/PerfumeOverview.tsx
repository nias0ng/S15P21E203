import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'

import { toBrandDetail } from '@/shared/config/routes'
import { localizedName } from '@/shared/i18n/locale'
import { cn } from '@/shared/lib/cn'
import { useLocale } from '@/shared/store/localeStore'
import { Badge } from '@/shared/ui/Badge'
import { Button } from '@/shared/ui/Button'
import { FOCUS_RING } from '@/shared/ui/focusRing'
import { Thumbnail } from '@/shared/ui/Thumbnail'

import { readGenderFilter } from '../types'
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

  // 백엔드 컬럼이 제약 없는 VARCHAR(30) 이라 표에 없는 성별 값이면 아무것도 안 적습니다
  const gender = readGenderFilter(perfume.gender)

  // 제목이 한국어 이름일 때만 원래 이름을 받쳐 적습니다
  const meta = [
    title !== perfume.name ? perfume.name : null,
    gender ? t(`overview.gender.${gender}`) : null,
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
            {/*
              브랜드 이름은 브랜드 화면으로 가는 길입니다. 메뉴들이 서로 이어지지 않아 "각 메뉴가
              왜 있는지 모르겠다" 는 말을 들었습니다(지인 피드백 F22) — 향수를 보다 그 브랜드의
              다른 향수로 건너가는 것이 브랜드 메뉴가 쓰이는 가장 흔한 길입니다.
            */}
            {perfume.brand && (
              <p className="text-caption">
                <Link
                  to={toBrandDetail(perfume.brand.brandId)}
                  className={cn(
                    'text-ink-muted hover:text-ink rounded-card underline-offset-4 hover:underline',
                    FOCUS_RING,
                  )}
                >
                  {perfume.brand.name}
                </Link>
              </p>
            )}

            {meta.length > 0 && (
              <p className="text-ink-muted text-caption">{meta.join(' · ')}</p>
            )}
          </div>

          <h1 className="text-ink text-display font-serif font-semibold">
            {title}
          </h1>

          {(perfume.concentration || perfume.productionStatus) && (
            <div className="flex flex-wrap items-center gap-1.25">
              {perfume.concentration && (
                <Badge tone="outline">{perfume.concentration}</Badge>
              )}
              {/*
                단종은 막지 않고 적기만 합니다 — 이미 가진 사람이 진열대에 담고 후기를 씁니다
                (지인 피드백 F5). 응답의 확인일 · 근거는 화면에 내지 않습니다 — 사용자에게는
                '단종' 이면 충분하고, 근거는 단종 목록(ai/data/perfume_status.csv)을 고치는 팀이 봅니다.
              */}
              {perfume.productionStatus && (
                <Badge>{t('overview.discontinued')}</Badge>
              )}
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
