import { Badge } from '@/shared/ui/Badge'
import { Button } from '@/shared/ui/Button'
import { Thumbnail } from '@/shared/ui/Thumbnail'

import type { PerfumeDetail } from '../types'

type Props = {
  perfume: PerfumeDetail
  /** [진열대에 저장] — 화면이 진열대 모달을 엽니다 */
  onSaveToShelf: () => void
}

/**
 * 향수 상세 ① 기본 정보 + 액션 (와이어프레임 A10 — DTL-01 · 02)
 *
 * 도메인 안이라 PerfumeDetail 타입을 그대로 받습니다. shared/ui 였다면 ESLint 가
 * 막았겠지만, 여기서는 도메인을 알아도 됩니다.
 */
export function PerfumeOverview({ perfume, onSaveToShelf }: Props) {
  return (
    <section className="flex flex-col gap-6 p-6 sm:flex-row">
      <Thumbnail
        src={perfume.thumbnailUrl}
        fallback="대표 이미지"
        className="h-72 w-60 shrink-0"
      />

      <div className="space-y-3">
        <p className="text-ink-muted text-xs">{perfume.brand}</p>
        <h1 className="text-2xl font-bold">{perfume.name}</h1>

        {/* ⚠️ scentFamily 는 백엔드가 아직 안 내려줍니다 */}
        {perfume.scentFamily && (
          <div className="flex flex-wrap gap-1.5">
            <Badge tone="outline">{perfume.scentFamily}</Badge>
          </div>
        )}

        <div>
          <Button onClick={onSaveToShelf}>진열대에 저장</Button>
          <p className="text-ink-muted mt-2 text-[10.5px]">
            진열대 저장은 분류 선택이 필수입니다.
          </p>
        </div>
      </div>
    </section>
  )
}
