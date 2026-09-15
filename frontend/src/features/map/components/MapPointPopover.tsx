import { toPerfumeDetail } from '@/shared/config/routes'
import { Badge } from '@/shared/ui/Badge'
import { Button } from '@/shared/ui/Button'
import { LinkButton } from '@/shared/ui/LinkButton'
import { Thumbnail } from '@/shared/ui/Thumbnail'

import type { MapPoint } from '../types'

type Props = {
  point: MapPoint
  onClose: () => void
  onSave: () => void
  onExploreSimilar: () => void
}

/**
 * 지도 포인트 상세 (와이어프레임 A02 — MAP-05 · MAP-07)
 *
 * 와이어프레임 주석이 명확합니다.
 * - 화면 전환 없음 — 지도는 그대로 있고 모달만 뜬다. 배경을 어둡게 덮지 않는다
 * - 모달은 선택한 포인트 옆에 붙는다 — × 또는 지도 빈 곳을 누르면 닫힌다
 * - [자세히 보기] → A10 전체 상세 / [주변 향 탐색] → A03
 *
 * 그래서 shared/ui 의 Modal(네이티브 dialog + 어두운 배경)을 쓰지 않습니다.
 * 지도를 가리지 않는 팝오버로 만듭니다.
 */
export function MapPointPopover({
  point,
  onClose,
  onSave,
  onExploreSimilar,
}: Props) {
  return (
    <div
      // 지도 배경 클릭으로 닫히는 동작과 겹치지 않게 이벤트를 여기서 멈춥니다
      onClick={(event) => event.stopPropagation()}
      className="border-line bg-surface-card absolute w-56.25 border p-2.5 shadow-lg"
      // 선택한 포인트 옆에 붙습니다
      style={{
        left: `calc(${point.x}% + 12px)`,
        top: `calc(${point.y}% - 12px)`,
      }}
    >
      <div className="flex items-start gap-2.5">
        <Thumbnail className="size-12.5 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-ink truncate text-xs font-bold">{point.name}</p>
          <p className="text-ink-muted truncate text-[10.5px]">{point.brand}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="닫기"
          className="text-ink-muted hover:text-ink shrink-0 text-sm leading-none"
        >
          <span aria-hidden>×</span>
        </button>
      </div>

      {/* TODO: 향 계열 · 노트 배지는 백엔드 응답이 붙으면 채웁니다 */}
      <div className="mt-2.5 flex flex-wrap gap-1.25">
        <Badge tone="outline">우디</Badge>
        <Badge tone="outline">아로마틱</Badge>
      </div>

      <div className="mt-2.5 space-y-1.25">
        <LinkButton
          to={toPerfumeDetail(point.perfumeId)}
          variant="outline"
          size="sm"
          fullWidth
        >
          자세히 보기
        </LinkButton>
        <Button variant="outline" size="sm" fullWidth onClick={onSave}>
          진열대에 저장
        </Button>
        <Button
          variant="outline"
          size="sm"
          fullWidth
          onClick={onExploreSimilar}
        >
          주변 향 탐색
        </Button>
      </div>
    </div>
  )
}
