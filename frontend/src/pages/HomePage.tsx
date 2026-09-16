import { useQuery } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'

import {
  ScentScene,
  VoyageLog,
  voyageLogQuery,
  type VoyageLogStatus,
} from '@/features/map'
// 진열대 저장은 진열대 도메인의 어휘입니다. 화면에서 두 도메인을 조합합니다.
import { ShelfSaveModal } from '@/features/shelf'
import { isApiError } from '@/shared/api/http'
import { ROUTES, toPerfumeDetail } from '@/shared/config/routes'
import { useToast } from '@/shared/hooks/useToast'
import { useSceneSkyStore } from '@/shared/store/sceneSkyStore'
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
  // 향해 일지 상태 — 비로그인(401)이면 로그인 안내. 개발 중 서버가 없으면 api 가 대체 일지를 줍니다
  const logStatus: VoyageLogStatus = log.isPending
    ? 'loading'
    : log.isError
      ? isApiError(log.error) && log.error.status === 401
        ? 'guest'
        : 'error'
      : 'ready'

  const [shelfSaveOpen, setShelfSaveOpen] = useState(false)
  // 엔진이 기다리는 저장 모달의 끝. 모달이 닫히면(취소 · 저장) 불러 3D 입력 잠금을 풉니다
  const releaseSave = useRef<(() => void) | null>(null)
  const { showToast, toastProps } = useToast()

  // 유리판 헤더의 글자색은 3D 하늘을 따릅니다 (밝은 하늘 먹색 · 밤하늘 상아색).
  // 화면을 떠나면 기본(dark — 3D 가 뜨기 전 남색 바탕에 맞는 상아색)으로 돌려놓습니다
  const setSky = useSceneSkyStore((state) => state.setSky)
  useEffect(() => () => setSky('dark'), [setSky])

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
        onNightChange={(night) => setSky(night ? 'dark' : 'light')}
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

      {/*
        향해 일지 — 3D 위 왼쪽 위에 계속 떠 있습니다. 유리판 헤더(90px) 아래 30 · 왼쪽 30 —
        엔진 미니맵(SCENT MAP)이 오른쪽 아래 28px 에 서는 것과 마주 보게 둡니다

        ⭐ 2026-09-16 : 엔진 검색창이 이 판의 **윗변(120)에 맞춰** 올라왔습니다 (`params.searchDrop` 40 → 0 ·
          `--pb-search-top` 44 → 30). 그래서 넓은 창에서는 판과 검색창이 **같은 높이로 나란히** 섭니다.

        ⚠ 폭 940 이하에서는 **왼쪽 아래**로 내려갑니다. 판 오른끝이 270 으로 고정인데 검색창은 가운데
          정렬이라, 그 단계(검색창 폭 400)에서 왼끝 `(창폭 − 400) / 2` 가 270 아래로 내려옵니다.
          윗변을 맞춘 뒤로는 세로가 **정확히 겹치므로** 접어 놔도 부딪힙니다.
          ⚠⚠ 검색창 **바로 밑**(182)도 안 됩니다 — 그 자리는 설명문구(`#zone-info`)가 씁니다.
            900 실측 : 설명문구 170~730 × 206~343 vs 판 30~270 × 182~226 = 100 × 20px 물림.
            검색창 · 설명문구 · 수면 타이포가 전부 위쪽에 모여 있어, 그 무리를 **통째로** 비킨다.
          bottom 60 은 DRIFT 바를 피한 값입니다 — 그 바는 좁은 창(760 이하)에서 왼쪽으로 옵니다
          (900 실측 : 가운데 295~605 / 588 실측 : 왼쪽 16~198 · y 697~712). 미니맵은 오른쪽 아래라 안 겹칩니다.
        ⚠⚠ 문턱 940 은 **엔진 값에서 나온 수**다 — 검색창 폭 400 인 단계에서 `(W − 400) / 2 = 270` 이 되는 폭.
          앱 기본값(md 768 · lg 1024)을 쓰면 어긋난다. 엔진의 `--pb-search-top` · `--pb-search-w` ·
          `--pb-search-h` · `searchDrop` · DRIFT 자리를 바꾸면 **여기 940 과 60 을 같이 본다** —
          앱이 엔진 좌표를 하드코딩하는 자리라, 근본은 엔진에 상자를 넘기는 문이다
          (`landing/docs/분할/C-연출UI.md` 의 D 요청).
      */}
      <div className="absolute top-30 left-7.5 max-[940px]:top-auto max-[940px]:bottom-15">
        <VoyageLog entries={log.data ?? []} status={logStatus} />
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
