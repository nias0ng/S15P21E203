import { useQuery } from '@tanstack/react-query'
import { useRef, useState } from 'react'
import { useNavigate } from 'react-router'

import {
  ScentScene,
  VoyageLog,
  voyageLogQuery,
  type ScenePerfumeRef,
} from '@/features/map'
// 진열대 저장은 진열대 도메인의 어휘입니다. 화면에서 두 도메인을 조합합니다.
import {
  ShelfRegisterModal,
  ShelfRegisterPartialError,
  useShelfActions,
} from '@/features/shelf'
import { isApiError } from '@/shared/api/http'
import { ROUTES, toPerfumeDetail } from '@/shared/config/routes'
import { useToast } from '@/shared/hooks/useToast'
import { useIsLoggedIn } from '@/shared/store/authStore'
import { LoginRequiredDialog } from '@/shared/ui/LoginRequiredDialog'
import { Toast } from '@/shared/ui/Toast'

/**
 * 랜딩 · 향 지도 (와이어프레임 A01 · A02 · A03 — MAP-01 · 05 · 06 · 07 · 24)
 *
 * **화면 전체가 3D 향 지도입니다** (paperboat 엔진 — ScentScene). 검색창 · 미니맵 · 향수
 * 카드(A02) · 주변 향 12개(A03)는 엔진이 그리고, 앱은 엔진이 넘기는 것만 받습니다.
 *
 *   [자세히 보기]  → A10 향수 상세로 이동
 *   [진열대에 저장] → 등록 모달 2단계(A15). 카드 · 고른 향수는 그대로 남습니다
 *   검색창        → A06 자연어 추천 (`/recommend?q=`)
 *
 * 향해 일지(MAP-24)는 다른 화면의 데이터와 맞추기 쉽도록 엔진이 아니라 앱이 3D 위에 얹습니다.
 *
 * ⚠️ 취향 영역(MAP-08)은 엔진에 아직 없습니다.
 */
export default function HomePage() {
  const navigate = useNavigate()
  const log = useQuery(voyageLogQuery())

  /** 지도 카드에서 담으려는 향수. 모달이 이름 · 브랜드를 보여주는 데 씁니다 */
  const [saving, setSaving] = useState<ScenePerfumeRef | null>(null)
  const [loginOpen, setLoginOpen] = useState(false)
  // 엔진이 기다리는 저장 모달의 끝. 모달이 닫히면(취소 · 저장) 불러 3D 입력 잠금을 풉니다
  const releaseSave = useRef<(() => void) | null>(null)
  const { showToast, toastProps } = useToast()
  const isLoggedIn = useIsLoggedIn()
  const actions = useShelfActions()

  /** 3D 입력 잠금을 풉니다. 어떤 길로 끝나든 반드시 한 번은 불러야 합니다 */
  const release = () => {
    releaseSave.current?.()
    releaseSave.current = null
  }

  const closeShelfSave = () => {
    setSaving(null)
    release()
  }

  return (
    // 헤더(GlobalHeader 의 h-22.5 = 90px) 아래 남은 높이를 3D 가 채웁니다
    <div className="relative h-[calc(100dvh_-_90px)] min-h-120">
      <h1 className="sr-only">향 지도</h1>

      <ScentScene
        className="absolute inset-0"
        onOpenDetail={(perfume) => {
          // ⚠️ 엔진 데이터에는 아직 DB perfumeId 가 없습니다(fragrantica_id 뿐). 없으면 이름으로 검색 결과(A09)에 보냅니다
          navigate(
            perfume.perfumeId === null
              ? `${ROUTES.PERFUME_SEARCH}?keyword=${encodeURIComponent(perfume.nameKo)}`
              : toPerfumeDetail(perfume.perfumeId),
          )
        }}
        onSaveToShelf={(perfume) =>
          new Promise<void>((resolve) => {
            releaseSave.current = resolve

            /*
              ⚠️ 엔진 데이터에는 아직 DB perfumeId 가 없을 수 있습니다
              (fragrantica_id 뿐). 없으면 담을 수가 없어 — 서버가 받는 것은 DB
              번호입니다 — 모달을 열지 않고 사정을 알려주고 끝냅니다. 모달을 열어
              분류까지 고르게 한 뒤 실패시키면 한 일이 버려집니다.
            */
            if (perfume.perfumeId === null) {
              showToast('이 향수는 아직 진열대에 담을 수 없습니다')
              resolve()
              releaseSave.current = null
              return
            }

            // 비로그인이면 저장 모달 대신 로그인 유도입니다 (공통 규칙 C01)
            if (!isLoggedIn) {
              setLoginOpen(true)
              return
            }

            setSaving(perfume)
          })
        }
        onSearch={(query) => {
          // 별도 입력 화면 없이 바로 결과로 갑니다
          const trimmed = query.trim()
          if (!trimmed) return
          navigate(`${ROUTES.RECOMMEND}?q=${encodeURIComponent(trimmed)}`)
        }}
      />

      {/* 향해 일지 — 3D 위 왼쪽 위에 계속 떠 있습니다 */}
      <div className="absolute top-5 left-5">
        <VoyageLog entries={log.data ?? []} />
      </div>

      {/*
        향수 상세 · 진열대 화면과 **같은 등록 모달**입니다. 지도 카드도 어떤 향수인지
        이미 알고 있어 `preselected` 로 1단계를 건너뜁니다. 들어온 입구마다 적을 수
        있는 값이 다르면 사용자가 같은 기능을 다르게 배웁니다.
      */}
      <ShelfRegisterModal
        open={saving !== null}
        onClose={closeShelfSave}
        options={[]}
        onSearch={() => {}}
        preselected={
          saving === null || saving.perfumeId === null
            ? undefined
            : {
                perfumeId: saving.perfumeId,
                name: saving.nameKo || saving.name,
                brand: saving.brandKo || saving.brand,
              }
        }
        onSubmit={(input) => {
          closeShelfSave()
          actions.register.mutate(input, {
            onSuccess: () => showToast('진열대에 저장했습니다'),
            onError: (error) =>
              showToast(
                error instanceof ShelfRegisterPartialError
                  ? `진열대에 담았지만 ${error.missing.join(' · ')}은(는) 저장하지 못했습니다`
                  : isApiError(error)
                    ? error.message
                    : '진열대에 저장하지 못했습니다.',
              ),
          })
        }}
      />

      {/* 로그인하러 떠나도 3D 입력 잠금은 풀어 둡니다 */}
      <LoginRequiredDialog
        open={loginOpen}
        onClose={() => {
          setLoginOpen(false)
          release()
        }}
        redirectTo={ROUTES.HOME}
      />

      <Toast {...toastProps} />
    </div>
  )
}
