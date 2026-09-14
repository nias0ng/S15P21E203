import { cn } from '@/shared/lib/cn'
import { Badge } from '@/shared/ui/Badge'
import { Button } from '@/shared/ui/Button'
import { PANEL } from '@/shared/ui/panel'
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
    <section className={cn(PANEL, 'flex flex-col gap-6 sm:flex-row')}>
      {/*
        상세 응답의 images 는 배열이고 대표 이미지는 첫 번째 원소입니다.

        contain 입니다. cover 로 두면 240x288 칸에 맞추느라 세로로 긴 병의
        위아래가 잘려서, 뚜껑도 바닥도 없는 몸통만 보였습니다. 향수는 병
        실루엣이 곧 정체성이라 상세 화면에서 잘리면 안 됩니다.

        살짝 가라앉은 판을 깔고 여백을 줍니다. 구역 바탕과 같은 색으로 두면
        흰 배경 제품 사진이 어디서 시작하고 끝나는지 보이지 않습니다.
      */}
      <Thumbnail
        src={perfume.images[0] ?? null}
        fallback="대표 이미지"
        fit="contain"
        className="bg-surface-sunken/35 rounded-card h-72 w-60 shrink-0 border-transparent p-4"
      />

      <div className="space-y-3">
        {/* 검색은 brandName 문자열, 상세는 brand 객체입니다 */}
        <p className="text-ink-muted text-caption">{perfume.brand?.name}</p>
        <h1 className="text-display font-serif font-semibold">
          {perfume.nameKo ?? perfume.name}
        </h1>

        {perfume.concentration && (
          <div className="flex flex-wrap gap-2">
            <Badge tone="outline">{perfume.concentration}</Badge>
          </div>
        )}

        <div>
          <Button onClick={onSaveToShelf}>진열대에 저장</Button>
          <p className="text-ink-muted text-caption mt-2">
            진열대 저장은 분류 선택이 필수입니다.
          </p>
        </div>
      </div>
    </section>
  )
}
