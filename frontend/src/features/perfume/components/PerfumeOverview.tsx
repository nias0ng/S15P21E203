import { Link } from 'react-router'

import { toBrandDetail } from '@/shared/config/routes'
import { cn } from '@/shared/lib/cn'
import { Badge } from '@/shared/ui/Badge'
import { Button } from '@/shared/ui/Button'
import { FOCUS_RING } from '@/shared/ui/focusRing'
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
  const hasKoreanName = perfume.nameKo !== null

  const meta = [
    hasKoreanName ? perfume.name : null,
    perfume.gender ? GENDER_TEXT[perfume.gender] : null,
  ].filter((part): part is string => typeof part === 'string')

  return (
    <section className="flex flex-col gap-7.5 sm:flex-row">
      <Thumbnail
        src={perfume.images[0] ?? null}
        fallback="대표 이미지"
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
            {perfume.nameKo ?? perfume.name}
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
            {inShelf ? '진열대 해제' : '진열대 저장'}
          </Button>
        </div>

        {aside}
      </div>
    </section>
  )
}
