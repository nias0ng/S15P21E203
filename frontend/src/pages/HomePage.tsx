import { useQuery } from '@tanstack/react-query'
import { useRef, useState } from 'react'
import { useNavigate } from 'react-router'

import { ScentScene, VoyageLog, voyageLogQuery } from '@/features/map'
// 진열대 저장은 진열대 도메인의 어휘입니다. 화면에서 두 도메인을 조합합니다.
import { ShelfSaveModal } from '@/features/shelf'
import { ROUTES, toPerfumeDetail } from '@/shared/config/routes'
import { useToast } from '@/shared/hooks/useToast'
import { Toast } from '@/shared/ui/Toast'

/**
 * 랜딩 · 향 지도 (와이어프레임 A01 · A02 · A03 — MAP-01 · 05 · 06 · 07 · 24)
 *
 * **화면 전체가 3D 향 지도입니다** (paperboat 엔진 — ScentScene). 검색창 · 미니맵 · 향수
 * 카드(A02) · 주변 향 12개(A03)는 엔진이 그리고, 앱은 엔진이 넘기는 것만 받습니다.
 *
 *   [자세히 보기]  → A10 향수 상세로 이동
 *   [진열대에 저장] → 분류 모달(A11). 카드 · 고른 향수는 그대로 남습니다
 *   검색창        → A06 자연어 추천 (`/recommend?q=`)
 *
 * 향해 일지(MAP-24)는 다른 화면의 데이터와 맞추기 쉽도록 엔진이 아니라 앱이 3D 위에 얹습니다.
 *
 * ⚠️ 취향 영역(MAP-08)은 엔진에 아직 없습니다.
 */
export default function HomePage() {
  const navigate = useNavigate()
  const log = useQuery(voyageLogQuery())

  const [shelfSaveOpen, setShelfSaveOpen] = useState(false)
  // 엔진이 기다리는 저장 모달의 끝. 모달이 닫히면(취소 · 저장) 불러 3D 입력 잠금을 풉니다
  const releaseSave = useRef<(() => void) | null>(null)
  const { showToast, toastProps } = useToast()

  const closeShelfSave = () => {
    setShelfSaveOpen(false)
    releaseSave.current?.()
    releaseSave.current = null
  }

  return (
    /*
     * 3D 가 화면 맨 위부터 끝까지 채웁니다 — 헤더(GlobalHeader)는 그 위에 유리판으로 뜹니다.
     * 바탕의 남색은 3D 가 뜨기 전 자리입니다. 비워 두면 종이(ivory) 위에 남색 유리판이 앉아
     * 헤더의 상아색 글자가 흐려집니다.
     */
    <div className="bg-surface-night relative h-dvh min-h-120">
      <h1 className="sr-only">향 지도</h1>

      <ScentScene
        className="absolute inset-0"
        // 유리판 헤더(GlobalHeader 의 h-22.5 = 90px)가 3D 위를 가리는 높이 — 엔진이 검색창 · 해도를 그 아래로 내립니다
        coveredTop={90}
        onOpenDetail={(perfume) => {
          // ⚠️ 엔진 데이터에는 아직 DB perfumeId 가 없습니다(fragrantica_id 뿐). 없으면 이름으로 검색 결과(A09)에 보냅니다
          navigate(
            perfume.perfumeId === null
              ? `${ROUTES.PERFUME_SEARCH}?keyword=${encodeURIComponent(perfume.nameKo)}`
              : toPerfumeDetail(perfume.perfumeId),
          )
        }}
        onSaveToShelf={() =>
          new Promise<void>((resolve) => {
            releaseSave.current = resolve
            setShelfSaveOpen(true)
          })
        }
        onSearch={(query) => {
          // 별도 입력 화면 없이 바로 결과로 갑니다
          const trimmed = query.trim()
          if (!trimmed) return
          navigate(`${ROUTES.RECOMMEND}?q=${encodeURIComponent(trimmed)}`)
        }}
      />

      {/* 향해 일지 — 3D 위 왼쪽 위에 계속 떠 있습니다. 유리판 헤더(90px) 아래 20px */}
      <div className="absolute top-27.5 left-5">
        <VoyageLog entries={log.data ?? []} />
      </div>

      <ShelfSaveModal
        open={shelfSaveOpen}
        onClose={closeShelfSave}
        onSave={() => {
          // TODO: SHF-01 진열대 저장 API 연결 (백엔드 진열대 API 미구현)
          closeShelfSave()
          showToast('진열대에 저장했습니다')
        }}
      />

      <Toast {...toastProps} />
    </div>
  )
}
