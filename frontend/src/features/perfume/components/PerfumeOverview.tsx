import { Badge } from '@/shared/ui/Badge'
import { Button } from '@/shared/ui/Button'
import { Thumbnail } from '@/shared/ui/Thumbnail'

import { GENDER_TEXT } from '../types'
import type { PerfumeDetail } from '../types'

type Props = {
  perfume: PerfumeDetail
  /** 비로그인이면 알 길이 없어 늘 false 입니다 — 그때 누르면 로그인 유도가 뜹니다 */
  inShelf: boolean
  /** 모르는 채로 [저장] 이면 이미 담은 향수인데 분류까지 고른 뒤 409 로 튕깁니다 */
  shelfPending?: boolean
  /** 담을지 뺄지는 화면이 정합니다 */
  onShelfAction: () => void
  /** 사진 오른쪽, 이름 아래에 놓을 것. 무엇이 올지는 화면이 정합니다 */
  aside?: React.ReactNode
}

/** 향수 상세 ① 기본 정보 + 액션. 판 없이 어둠에 바로 놓입니다 — docs/어두운-방-유리판.md */
export function PerfumeOverview({
  perfume,
  inShelf,
  shelfPending = false,
  onShelfAction,
  aside,
}: Props) {
  /* 영문 이름은 한국어 이름이 있을 때만 — 없으면 제목이 이미 영문입니다 */
  const hasKoreanName = perfume.nameKo !== null

  /* 둘 다 없을 수 있어 배열로 모아 잇습니다 — 직접 붙이면 가운뎃점만 남습니다 */
  const meta = [
    hasKoreanName ? perfume.name : null,
    perfume.gender ? GENDER_TEXT[perfume.gender] : null,
  ].filter((part): part is string => typeof part === 'string')

  return (
    <section className="flex flex-col gap-7.5 sm:flex-row">
      {/* `cover` 로 두면 세로로 긴 병 사진의 뚜껑과 바닥이 잘려 나갑니다 */}
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

          {/* 해제는 되돌릴 수 없습니다 — 메모 · 적합도가 함께 지워집니다 */}
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
