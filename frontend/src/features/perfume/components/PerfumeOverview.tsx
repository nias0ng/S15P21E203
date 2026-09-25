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
        /* NOTE: 향수병이 투명 PNG 라 상자 색이 비치는데 토큰은 어두운 방에서 뒤집혀, 색 토큰이 아니라 `bg-white` 입니다 */
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
