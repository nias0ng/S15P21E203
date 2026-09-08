import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useNavigate } from 'react-router'

import {
  MapPointPopover,
  MiniMap,
  mapPointsQuery,
  ScentMap,
  SimilarExplorer,
  tasteAreaQuery,
  VoyageLog,
  voyageLogQuery,
  type MapPoint,
} from '@/features/map'
// 진열대 저장은 진열대 도메인의 어휘입니다. 화면에서 두 도메인을 조합합니다.
import { ShelfSaveModal } from '@/features/shelf'
import { ROUTES } from '@/shared/config/routes'
import { useToast } from '@/shared/hooks/useToast'
import { Button } from '@/shared/ui/Button'
import { EmptyState } from '@/shared/ui/EmptyState'
import { Input } from '@/shared/ui/Input'
import { PageFallback } from '@/shared/ui/PageFallback'
import { Toast } from '@/shared/ui/Toast'

/**
 * 랜딩 · 향 지도 (와이어프레임 A01 · A02 · A03 — MAP-01 · 05 · 06 · 07 · 08 · 24)
 *
 * 세 화면이 한 경로입니다. 와이어프레임 주석대로 포인트를 눌러도 화면 전환이 없고
 * 지도 위에 팝오버만 뜨며(A02), 주변 향 탐색도 같은 화면에서 이어집니다(A03).
 *
 * 와이어프레임 주석:
 * - 입력하고 [찾기] — 별도 입력 화면 없이 바로 결과로
 * - 검은 원 = 나를 위한 추천 (개인화 추천 REC-12 · REC-13 은 별도 화면 없이 여기 표시)
 * - 데이터 없음 / 로드 실패 시 빈 지도를 띄우지 않고 안내 박스를 대신 표시
 * - 향해 일지는 지도 위에 계속 떠 있다
 *
 * ⚠️ 지도 라이브러리 미정. ScentMap 이 SVG 자리표시자이고 확대는 배율만 바뀝니다.
 * 팬 · 클러스터링 · 실제 좌표계는 라이브러리를 정한 뒤 작업해야 합니다.
 */
export default function HomePage() {
  const navigate = useNavigate()

  const points = useQuery(mapPointsQuery())
  const log = useQuery(voyageLogQuery())
  const tasteArea = useQuery(tasteAreaQuery())

  const [keyword, setKeyword] = useState('')
  const [zoom, setZoom] = useState(1)
  const [selected, setSelected] = useState<MapPoint | null>(null)
  const [similarOf, setSimilarOf] = useState<MapPoint | null>(null)
  const [shelfSaveOpen, setShelfSaveOpen] = useState(false)
  const { showToast, toastProps } = useToast()

  if (points.isPending) return <PageFallback />

  // 빈 지도를 띄우지 않고 안내 박스를 대신 표시합니다
  if (points.isError || (points.data?.length ?? 0) === 0) {
    return (
      <EmptyState
        title="향 지도를 불러오지 못했습니다"
        description="잠시 후 다시 시도해 주세요."
        action={
          <Button variant="outline" onClick={() => points.refetch()}>
            다시 시도
          </Button>
        }
      />
    )
  }

  const items = points.data ?? []
  const similar = similarOf
    ? items.filter(
        (item) =>
          item.region === similarOf.region &&
          item.perfumeId !== similarOf.perfumeId,
      )
    : []

  return (
    <div className="space-y-4">
      <h1 className="sr-only">향 지도</h1>

      {/* 별도 입력 화면 없이 바로 결과로 갑니다 */}
      <form
        className="flex items-start gap-2"
        onSubmit={(event) => {
          event.preventDefault()
          const trimmed = keyword.trim()
          if (!trimmed) return
          navigate(`${ROUTES.RECOMMEND}?q=${encodeURIComponent(trimmed)}`)
        }}
      >
        <div className="flex-1">
          <Input
            label="어떤 향을 찾고 계신가요"
            hideLabel
            placeholder="어떤 향을 찾고 계신가요"
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
          />
        </div>
        <Button type="submit">찾기</Button>
      </form>

      <div className="relative">
        <div className="h-[32rem]">
          <ScentMap
            points={items}
            tasteArea={tasteArea.data}
            selectedId={selected?.perfumeId ?? null}
            zoom={zoom}
            onSelectPoint={(point) => {
              setSelected(point)
              setSimilarOf(null)
            }}
            onSelectBackground={() => setSelected(null)}
          />
        </div>

        {/* 포인트를 눌러도 화면 전환이 없고 팝오버만 뜹니다 (A02) */}
        {selected && (
          <MapPointPopover
            point={selected}
            onClose={() => setSelected(null)}
            // 팝오버는 열어 둔 채 모달만 띄웁니다. 취소하면 고른 포인트가 그대로 남습니다.
            onSave={() => setShelfSaveOpen(true)}
            onExploreSimilar={() => {
              setSimilarOf(selected)
              setSelected(null)
            }}
          />
        )}

        {/* 향해 일지는 지도 위에 계속 떠 있습니다 */}
        <div className="absolute top-3 right-3">
          <VoyageLog entries={log.data ?? []} />
        </div>

        <div className="absolute bottom-3 left-3 w-40">
          <MiniMap
            points={items}
            viewport={{
              x: 50 - 50 / zoom,
              y: 50 - 50 / zoom,
              width: 100 / zoom,
              height: 100 / zoom,
            }}
            highlightedId={selected?.perfumeId ?? null}
          />
        </div>

        <div className="absolute right-3 bottom-3 flex flex-col gap-1">
          <Button
            variant="outline"
            size="icon"
            aria-label="확대"
            onClick={() => setZoom((prev) => Math.min(3, prev + 0.5))}
          >
            +
          </Button>
          <Button
            variant="outline"
            size="icon"
            aria-label="축소"
            onClick={() => setZoom((prev) => Math.max(1, prev - 0.5))}
          >
            −
          </Button>
        </div>
      </div>

      <p className="text-ink-muted text-[10.5px]">
        검은 원은 나를 위한 추천 영역입니다.
      </p>

      {/* 주변 향 탐색 (A03) — 같은 화면에서 이어집니다 */}
      {similarOf && (
        <SimilarExplorer
          center={similarOf}
          similar={similar}
          onPick={(point) => setSimilarOf(point)}
        />
      )}

      <ShelfSaveModal
        open={shelfSaveOpen}
        onClose={() => setShelfSaveOpen(false)}
        onSave={() => {
          // TODO: SHF-01 진열대 저장 API 연결 (백엔드 진열대 API 미구현)
          setShelfSaveOpen(false)
          showToast('진열대에 저장했습니다')
        }}
      />

      <Toast {...toastProps} />
    </div>
  )
}
