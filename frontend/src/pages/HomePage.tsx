import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router'

import {
  CabinBubble,
  MapSearchModal,
  SceneBootCurtain,
  SceneSearchBar,
  ScentScene,
  buildMapPerfumeLookup,
  buildPerfumeIdIndex,
  explorationStateQuery,
  mapPerfumePointsQuery,
  mapPerfumesQuery,
  useExplorationMove,
  useSaveBoatPosition,
  useSceneBoot,
  useSceneQuality,
  VoyageLog,
  voyageLogQuery,
  withMapPerfumes,
  type ScenePerfumeRef,
  type SceneSearchMode,
  type VoyageLogStatus,
} from '@/features/map'
import { RecommendModal, readOpenRecommendation } from '@/features/recommend'
// 진열대 저장은 진열대 도메인의 어휘입니다. 화면에서 두 도메인을 조합합니다.
import {
  ShelfRegisterModal,
  shelfItemsQuery,
  shelfRegisterErrorMessage,
  useShelfActions,
} from '@/features/shelf'
import { isApiError } from '@/shared/api/http'
import { isTasteLanding } from '@/shared/config/mapEntryState'
import { perfumeViewState } from '@/shared/config/perfumeViewSource'
import {
  ROUTES,
  toPerfumeDetail,
  toPerfumeSearch,
} from '@/shared/config/routes'
import { useDiveReady } from '@/shared/hooks/useDiveReady'
import { useToast } from '@/shared/hooks/useToast'
import { cn } from '@/shared/lib/cn'
import { diveDepthOf } from '@/shared/lib/diveTrack'
import { useIsLoggedIn } from '@/shared/store/authStore'
import {
  useDiveStore,
  useIsDiving,
  useIsRising,
} from '@/shared/store/diveStore'
import { useSceneCardStore } from '@/shared/store/sceneCardStore'
import { useSceneSkyStore } from '@/shared/store/sceneSkyStore'
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
 *
 * **검색창만 앱이 그립니다** (`SceneSearchBar` · 엔진 알약은 `ScentScene` 이 숨깁니다).
 * 방식이 둘이고 둘 다 답을 **모달**로 내놓기 때문입니다 — 엔진은 iframe 안이라 라우터도
 * 모달도 모릅니다.
 *
 *   자연어 → A06 추천 모달 (`RecommendModal`). 전에는 `/recommend?q=` 라는 별도 화면이었습니다
 *   이름   → 지도 향수 200개에서 찾기 (`MapSearchModal`) · 고르면 배가 그 부표로 가서 카드를 엽니다
 *
 * 향해 일지(MAP-24)는 다른 화면의 데이터와 맞추기 쉽도록 엔진이 아니라 앱이 3D 위에 얹습니다.
 *
 * **취향 테스트 결과는 배의 출발 자리입니다** (2026-09-21 · `tasteStart` → `ScentScene` 의 `start`).
 * 메인에 들어오면 배가 원점이 아니라 내 취향 향수 곁에서 시작하고 그 해역 연출이 바로 걸립니다
 * (`docs/취향-출발점과-영역-진입-0921.md`).
 *
 * ⚠️ 취향 **영역**(MAP-08 — 지도 위의 검은 원)은 아직 엔진에 없습니다. 출발점과 다른 것입니다.
 */
/*
 * 잠수(콘텐츠 화면으로)나 선실로 들어가기(진열대로)가 걸리면 3D 위에 얹은 **앱 UI 도 같이 비킵니다** —
 * 검색창 · 향해 일지. 엔진 안의 UI(미니맵 · 카드 · 부표 이름표)는 같은 때에 엔진이 비킵니다
 * (`landing/src/dive.js` · `cabin-in.js`).
 * 한쪽만 남으면 바다는 내려가는데 글자만 떠 있습니다.
 *
 * 커튼이 아래에서 차오르는데 이 둘은 위쪽이라 마지막까지 남습니다 — 그래서 따로 비켜야 합니다.
 */
const DIVE_FADE = 'transition-[opacity,visibility] duration-300 ease-out'

/*
 * ⚠⚠ **엔진의 전체 화면 해도가 열릴 때도 같은 둘이 비킵니다** (2026-09-21).
 *
 * 해도(`landing/src/chart.js`)는 iframe **안**이고 검색창 · 향해 일지는 iframe **밖**(이 문서)이라,
 * 엔진이 z-index 를 아무리 올려도 이 둘 위로 못 올라갑니다 — 스태킹이 아니라 **문서가 다릅니다.**
 * 그래서 덮는 대신 앱이 비킵니다 (2026-09-21 사용자 : *"검색창이 안가려지는데"*).
 *
 * ⚠️ 유리판 헤더는 그대로 둡니다 — 해도가 `hostTop` 만큼 그 아래에 서는 것이 원래 설계입니다(엔진 불변식 23).
 * ⚠️ 선실 말풍선은 여기서 안 비킵니다 — 해도를 열면 포커스가 iframe 으로 넘어가 제 `blur` 로 닫힙니다(`CabinBubble`).
 */

export default function HomePage() {
  const navigate = useNavigate()
  const location = useLocation()
  const diving = useIsDiving()
  /** 엔진의 전체 화면 해도가 열려 있는가 — 3D 위에 얹은 앱 UI 가 비킵니다 (위 DIVE_FADE 머리말) */
  const [chartOpen, setChartOpen] = useState(false)
  /*
   * 엔진의 향수 카드가 떠 있는가 (2026-10-01). 좁은 화면(940 아래)에서는 향해 일지가 왼쪽 아래로 내려가
   * 카드 아랫단('이 향의 해역으로')을 덮었습니다 — 카드가 떠 있는 동안은 비킵니다. 의견 단추(껍데기)는
   * `sceneCardStore` 로 같은 값을 받습니다. 메인을 떠나면 false 로 되돌립니다.
   */
  const [cardOpen, setCardOpen] = useState(false)
  const setSceneCard = useSceneCardStore((state) => state.setOpen)
  useEffect(() => {
    setSceneCard(cardOpen)
  }, [cardOpen, setSceneCard])
  useEffect(() => () => setSceneCard(false), [setSceneCard])
  /*
   * 진열대에서 **떠올라** 들어오는 중인가. 그동안 화면은 잠수 커튼(물)이 덮고 있으므로
   * 이 화면의 아이보리 로딩 커튼은 비킵니다 — 물 밑에서 구름이 갈라지면 걷히는 겹이 둘이 됩니다.
   */
  const rising = useIsRising()
  /*
   * 로딩 커튼이 **걷기 시작했다 = 엔진이 다 떴다.** 이것을 잠수 커튼의 준비 신호로 넘겨,
   * 물이 걷히면서 이미 떠오르는 중인 바다가 드러나게 합니다.
   * ⚠ 다 걷힐 때(boot.done)까지 기다리면 1초가 더 붙습니다 — 그 1초는 물 밑이라 안 보입니다.
   * ⚠ 잠수로 들어온 것이 아니면 아무 일도 안 일어납니다 (useDiveReady 머리말).
   */
  const [engineUp, setEngineUp] = useState(false)
  useDiveReady(engineUp)

  /**
   * 메인 검색 — 방식과, 방식별로 열린 답.
   *
   * 답을 하나의 `result` 로 묶지 않고 둘로 나눠 둡니다. 방식을 바꾸면 **뒤 결과가
   * 사라지는 게 아니라** 다음에 그 방식으로 검색할 때까지 그대로 닫혀 있습니다 —
   * 같은 말을 두 방식으로 해보는 것이 스왑 단추의 쓸모라, 한쪽을 지우면 방금 본
   * 추천이 없어집니다.
   */
  const [searchMode, setSearchMode] = useState<SceneSearchMode>('nl')
  /*
   * ⭐ **자연어로 찾은 말은 주소에도 남깁니다** (`/?q=` · 2026-10-01). 결과에서 상세로 갔다가 뒤로가기나
   * 상세의 '← 추천 결과' 로 돌아오면 이 화면이 처음부터 다시 서는데, 주소에 말이 남아 있어야 보던
   * 결과창을 다시 열 수 있습니다 — 전에는 결과 대신 설문만 떠서 다섯 개를 비교하려면 같은 말로 다시
   * 찾아야 했습니다(사용성 테스트 7명 중 6명).
   *   - 열려 있던 결과가 이 탭에 담겨 있으면(`readOpenRecommendation`) 서버에 다시 묻지 않고 그대로 섭니다.
   *   - 담긴 것이 없으면(다른 탭에서 연 주소 · 새로고침 뒤 저장소를 못 쓴 창) 그 말로 새로 찾습니다.
   * ⚠️ 주소는 **바꿔 끼웁니다**(replace) — 검색할 때마다 기록이 쌓이면 뒤로가기가 검색어를 하나씩 되돌립니다.
   * ⚠️ 마운트 때 한 번만 읽습니다 — 아래에서 결과창을 닫으면 주소의 말도 지웁니다.
   */
  const [searchParams, setSearchParams] = useSearchParams()
  const [nlQuery, setNlQuery] = useState<string | null>(() =>
    searchParams.get('q'),
  )
  const [restoredNl, setRestoredNl] = useState(() => {
    const q = searchParams.get('q')
    return q === null ? undefined : readOpenRecommendation(q)
  })
  const openNl = (query: string | null) => {
    setNlQuery(query)
    // ⚠️ 돌아와 다시 편 결과는 **그 한 번만** 씁니다. 닫은 뒤 같은 말로 찾으면 새 추천입니다 (`openRecommendation` 머리말)
    if (query === null) setRestoredNl(undefined)
    setSearchParams(
      (params) => {
        if (query === null) params.delete('q')
        else params.set('q', query)
        return params
      },
      { replace: true },
    )
  }
  const [mapKeyword, setMapKeyword] = useState<string | null>(null)
  /** 이름 검색에서 고른 향수 — 3D 가 그 부표로 갑니다 (`ScentScene` 의 `seek`) */
  const [seek, setSeek] = useState<{
    fragranticaId: number
    seq: number
  } | null>(null)

  /** 지도 카드에서 담으려는 향수. 모달이 이름 · 브랜드를 보여주는 데 씁니다 */
  const [saving, setSaving] = useState<
    (ScenePerfumeRef & { perfumeId: number }) | null
  >(null)
  const [loginOpen, setLoginOpen] = useState(false)
  // 엔진이 기다리는 저장 모달의 끝. 모달이 닫히면(취소 · 저장) 불러 3D 입력 잠금을 풉니다
  const releaseSave = useRef<(() => void) | null>(null)

  /** 배를 눌러 연 선실 말풍선 (2026-09-21) — 진열대 · 컬렉션 두 줄 */
  const [cabinOpen, setCabinOpen] = useState(false)
  /*
   * 엔진이 기다리는 말풍선의 끝. 엔진은 이 Promise 로 **말풍선이 떠 있는가**를 셉니다 —
   * 떠 있는 동안 3D 누름은 '고르기' 가 아니라 '닫기' 가 되기 때문입니다 (landing/src/main.js).
   * ⚠️ 저장 모달의 `releaseSave` 와 달리 입력 잠금을 푸는 것이 아닙니다 — 말풍선은 안 잠급니다.
   */
  const releaseCabin = useRef<(() => void) | null>(null)
  const { showToast, toastProps } = useToast()
  const isLoggedIn = useIsLoggedIn()
  const actions = useShelfActions()
  const startDive = useDiveStore((state) => state.start)

  /*
   * 말풍선이 열리면 진열대를 **미리 받아 둡니다** — 화면 청크와 목록. 줄을 고르면 선실로 들어가는
   * 동안 커튼 뒤에서 기다릴 것이 그만큼 줄어듭니다. 헤더 SHELF 에 손을 올릴 때 받는 것
   * (`app/layouts/header/useWarm`)과 같은 일입니다 — 진열대는 병 수백 개로 벽을 세우는 곳이라
   * 청크만 와 있어도 스피너로 섭니다.
   * ⚠️ 비로그인이면 안 받습니다 — 두 줄이 잠겨 있고, 목록은 401 입니다.
   */
  const queryClient = useQueryClient()
  useEffect(() => {
    if (!cabinOpen || !isLoggedIn) return
    void import('@/pages/MyShelfPage')
    void queryClient.prefetchQuery(shelfItemsQuery())
  }, [cabinOpen, isLoggedIn, queryClient])

  // 유리판 헤더의 글자색은 3D 하늘을 따릅니다 (밝은 하늘 먹색 · 밤하늘 상아색).
  // 화면을 떠나면 기본(dark — 3D 가 뜨기 전 남색 바탕에 맞는 상아색)으로 돌려놓습니다
  const setSky = useSceneSkyStore((state) => state.setSky)
  useEffect(() => () => setSky('dark'), [setSky])

  // 로딩 커튼 — 엔진의 부팅 신호(ScentScene onBoot)를 모아 커튼의 퍼센트를 밉니다.
  // 커튼이 걷히면(finish) 내립니다. 화면을 떠났다 돌아오면 엔진이 처음부터 다시 뜨므로 커튼도 다시 섭니다
  const boot = useSceneBoot()

  // 그래픽 설정 (S15P21E203-435) — 고르는 자리는 헤더의 톱니바퀴입니다(`GraphicsMenu`). 여기서는 엔진과 잇고,
  // 엔진이 내장 그래픽이라 낮게 시작했거나 스스로 내리면 커튼이 걷힌 뒤 한 번 알립니다
  const graphics = useSceneQuality(showToast, boot.done)

  // 향해 일지(MAP-24) — 배가 든 해역이 바뀌거나 향수를 고르면 서버에 남기고 일지를 다시 읽습니다.
  // 기록할지는 서버가 정합니다 (향수는 늘 · 빈 바다는 향 영역이 바뀐 경우만)
  const reportMove = useExplorationMove()

  /*
  /*
   * **취향 테스트를 막 마치고 왔는가** (`TasteTestPage` 가 실어 보낸 표).
   *
   * 배를 놓을 자리는 아래 `lastBoatAt` 하나뿐입니다 — 취향 결과도 마지막 항해 자리도 서버의
   * **같은 칸**에서 오기 때문입니다. 자리는 같고 **연출만 다릅니다.**
   *
   * ⚠️ **마운트 때 값만 씁니다** (게으른 초기값). 바로 아래에서 그 표를 히스토리에서 지우는데,
   *   지운 뒤에도 이번 진입에서는 살아 있어야 합니다.
   */
  const [landing] = useState(() => isTasteLanding(location.state))
  useEffect(() => {
    if (!landing) return
    // ⚠️ 표를 지웁니다 — 안 지우면 다른 화면에 갔다 **뒤로** 돌아올 때 착륙이 다시 걸립니다
    //   (히스토리 항목에 state 가 그대로 붙어 있습니다)
    navigate(ROUTES.HOME, { replace: true, state: null })
  }, [landing, navigate])

  /*
   * **배 자리를 이어 갑니다** (MAP-24 · `docs/배-자리와-향해일지-0921.md` §A).
   *
   * 들어올 때 마지막 자리를 읽어 배를 거기 놓고, 떠날 때 있던 자리를 한 번 남깁니다.
   * 저장은 백엔드가 예전부터 하고 있었는데(`PUT` 이 자리를 늘 덮어씁니다) **앱이 안 읽고
   * 있었습니다** — 그래서 늘 원점에서 시작했습니다.
   *
   * ⚠️ 비로그인이면 401 이라 `data` 가 없습니다 — 예전처럼 원점에서 시작합니다.
   * ⚠️ 한 번도 안 움직인 사람은 세 필드가 모두 null 인 200 입니다 (404 가 아닙니다).
   * ⚠️ 값이 같으면 같은 객체를 돌려줍니다 — `ScentScene` 의 출발점 effect 가 의존성으로 봅니다.
   */
  const boatState = useQuery(explorationStateQuery())
  const bx = boatState.data?.x ?? null
  const by = boatState.data?.y ?? null
  const lastBoatAt = useMemo(
    () => (bx !== null && by !== null ? { x: bx, y: by } : null),
    [bx, by],
  )
  const saveBoatAt = useSaveBoatPosition()

  /*
   * **엔진 좌표 → DB 향수 번호** (§B). 카드의 [자세히 보기] 와 [진열대에 저장] 이 씁니다 —
   * 엔진 데이터에는 DB 번호가 없어 둘 다 좌표로 찾습니다.
   *
   * ⚠️ 아직 안 왔으면 null 을 돌려줍니다 — [자세히 보기] 는 예전처럼 이름 검색으로 가고,
   *   [진열대에 저장] 은 담을 수 없다고 알립니다.
   *   지도를 여는 동안 조용히 받아 두므로 실제로 눌릴 때는 거의 늘 와 있습니다.
   */
  const perfumePoints = useQuery(mapPerfumePointsQuery())
  const perfumeIndex = useMemo(
    () => (perfumePoints.data ? buildPerfumeIdIndex(perfumePoints.data) : null),
    [perfumePoints.data],
  )
  const resolvePerfumeId = (perfume: ScenePerfumeRef) =>
    perfume.perfumeId ?? perfumeIndex?.at(perfume.mx, perfume.my) ?? null

  /*
   * 향해 일지. 향수는 **3D 와 같은 한글 이름 · 계열**로 채워 싣습니다 — API 는 번호와 DB 원명(대개
   * 영문)만 주고, 3D 는 엔진 데이터를 씁니다. 둘을 위 좌표 색인으로 잇습니다 (`lib/mapPerfumeLookup`).
   * 채울 재료(엔진 데이터 · 좌표)가 오는 동안은 일지도 불러오는 중으로 둡니다 — 영문이 먼저 떴다가
   * 한글로 바뀌지 않게. 재료를 못 받았으면 API 이름 그대로 싣습니다.
   */
  const log = useQuery(voyageLogQuery())
  const mapPerfumes = useQuery(mapPerfumesQuery())
  const perfumeLookup = useMemo(
    () =>
      perfumeIndex && mapPerfumes.data
        ? buildMapPerfumeLookup(perfumeIndex, mapPerfumes.data)
        : null,
    [perfumeIndex, mapPerfumes.data],
  )
  const logEntries = useMemo(
    () =>
      log.data && perfumeLookup
        ? withMapPerfumes(log.data, perfumeLookup)
        : (log.data ?? []),
    [log.data, perfumeLookup],
  )
  const namesPending = perfumePoints.isPending || mapPerfumes.isPending
  // 향해 일지 상태 — 비로그인(401)이면 로그인 안내. 개발 중 서버가 없으면 api 가 대체 일지를 줍니다
  const logStatus: VoyageLogStatus = log.isPending
    ? 'loading'
    : log.isError
      ? isApiError(log.error) && log.error.status === 401
        ? 'guest'
        : 'error'
      : namesPending
        ? 'loading'
        : 'ready'

  /** 3D 입력 잠금을 풉니다. 어떤 길로 끝나든 반드시 한 번은 불러야 합니다 */
  const release = () => {
    releaseSave.current?.()
    releaseSave.current = null
  }

  const closeShelfSave = () => {
    setSaving(null)
    release()
  }

  /*
   * 선실 말풍선을 닫습니다 — Esc · **3D 아무 데나 누르기**(엔진이 알립니다) · 줄을 골라
   * 떠날 때 모두 여기를 지납니다.
   * ⚠️ 줄을 고르면 화면이 통째로 바뀌지만 그래도 알립니다. 엔진은 iframe 째 사라지므로
   *   안 알려도 해롭지 않지만, "어떤 길로 끝나든 한 번은 알린다" 를 어기면 다음 사람이
   *   길 하나를 빠뜨립니다 (저장 모달의 `release` 와 같은 규율).
   */
  const closeCabin = () => {
    setCabinOpen(false)
    releaseCabin.current?.()
    releaseCabin.current = null
  }

  return (
    /*
     * 3D 가 화면 맨 위부터 끝까지 채웁니다 — 헤더(GlobalHeader)는 그 위에 유리판으로 뜹니다.
     * 바탕의 남색은 3D 가 뜨기 전 자리입니다. 비워 두면 종이(ivory) 위에 남색 유리판이 앉아
     * 헤더의 상아색 글자가 흐려집니다.
     */
    <div
      className="bg-surface-night relative h-dvh min-h-120"
      aria-busy={!boot.done}
    >
      <h1 className="sr-only">향 지도</h1>

      <ScentScene
        className="absolute inset-0"
        /*
          유리판 헤더(GlobalHeader 의 `--header-h`)가 3D 위를 가리는 높이 — 엔진이 검색창 ·
          해도를 그 아래로 내립니다.
          ⚠️ 숫자가 아니라 **계산되는 길이**를 넘깁니다. 헤더는 `--spacing` 을 타 1920 에서 90 ·
            1536 에서 72 라, 90 을 박으면 좁은 화면에서 18px 이 어긋납니다 (`ScentScene` 의 probe).
        */
        coveredTop="var(--header-h)"
        onNightChange={(night) => setSky(night ? 'dark' : 'light')}
        onChartChange={setChartOpen}
        onCardChange={setCardOpen}
        onBoot={boot.report}
        onMove={reportMove}
        quality={graphics.mode}
        onQuality={graphics.onQuality}
        start={lastBoatAt}
        landing={landing}
        onLeave={saveBoatAt}
        onOpenDetail={(perfume) => {
          /*
           * ⭐ **좌표로 DB 향수 번호를 찾습니다** (2026-09-21 · `lib/perfumeIdAt`).
           *
           * 엔진 데이터에는 DB 번호가 한 건도 없고 `fragrantica_id` 만 있어, 여태 이름으로
           * 검색 결과(A09)에 보내고 있었습니다. 엔진의 `mx`·`my` 와 `GET /map` 의 `x`·`y` 가
           * **같은 0~1 공간**이라(엔진 불변식 21) 좌표로 이을 수 있습니다.
           */
          const perfumeId = resolvePerfumeId(perfume)

          /*
           * ⭐ **향해 일지에 남깁니다** (MAP-24 · `docs/배-자리와-향해일지-0921.md` §B).
           * 사용자 : *"메인페이지에서만 자세히보기를 눌렸을때 기록되면댐"* — 그래서 **여기 한 곳**
           * 입니다. 다른 화면에서 향수 상세로 간 것은 안 남깁니다 (일지는 배가 지나온 자리입니다).
           * ⚠️ 서버는 향수를 고른 이동을 **언제나** 남깁니다. 좌표는 서버가 채우므로 안 보냅니다.
           */
          if (perfumeId !== null) reportMove({ perfumeId })

          navigate(
            perfumeId === null
              ? toPerfumeSearch(perfume.nameKo)
              : toPerfumeDetail(perfumeId),
            // 검색으로 돌려보내는 쪽은 향수 상세가 아니라 기록할 것이 없습니다
            perfumeId === null
              ? undefined
              : { state: perfumeViewState('SCENT_MAP') },
          )
        }}
        onSaveToShelf={(perfume) =>
          new Promise<void>((resolve) => {
            releaseSave.current = resolve
            const perfumeId = resolvePerfumeId(perfume)

            /*
              ⚠️ 엔진 데이터에는 DB perfumeId 가 없어(fragrantica_id 뿐) 좌표로
              찾습니다(위 onOpenDetail). 못 찾으면 담을 수가 없어 — 서버가 받는 것은 DB
              번호입니다 — 모달을 열지 않고 사정을 알려주고 끝냅니다. 모달을 열어
              분류까지 고르게 한 뒤 실패시키면 한 일이 버려집니다.
            */
            if (perfumeId === null) {
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

            setSaving({ ...perfume, perfumeId })
          })
        }
        /*
          배를 눌렀습니다 — 배 옆에 선실 말풍선 (2026-09-21). 돌려준 Promise 가 '닫혔다' 입니다.

          ⚠️ 비로그인이어도 **엽니다.** 두 줄이 잠긴 모양으로 서고 로그인 한 줄이 붙습니다
            (`CabinBubble` 의 `isLoggedIn` 머리말) — 여기서 `LoginRequiredDialog` 로 가로채면
            배를 눌렀는데 배와 무관한 창이 뜹니다.
        */
        onOpenCabin={() =>
          new Promise<void>((resolve) => {
            releaseCabin.current = resolve
            setCabinOpen(true)
          })
        }
        // 3D 를 눌렀습니다 — 말풍선은 팝오버라 배경을 누르면 닫힙니다 (엔진 host.js `closeCabin`)
        onCloseCabin={closeCabin}
        seek={seek}
        /*
          엔진이 그 부표로 못 갔습니다 (지도에 없거나 안개 전환 중) — 좌표로 DB 번호를 찾아 향수 상세로
          바로 갑니다. 번호도 못 찾으면 예전처럼 이름으로 향수 검색(A09)에 보냅니다.
          ⚠️ 향해 일지에는 안 남깁니다 — 일지는 메인에서 [자세히 보기]를 누른 것만 받습니다 (위 onOpenDetail)
        */
        onSeekMiss={(fragranticaId) => {
          const perfume = mapPerfumes.data?.find(
            (p) => p.fragranticaId === fragranticaId,
          )
          if (!perfume) return
          const perfumeId = perfumeIndex?.at(perfume.mx, perfume.my) ?? null
          navigate(
            perfumeId === null
              ? toPerfumeSearch(perfume.name)
              : toPerfumeDetail(perfumeId),
            // 상세의 '← 향 지도' 로 돌아오게 합니다 (지도에서 찾은 향수입니다)
            perfumeId === null
              ? undefined
              : { state: perfumeViewState('SCENT_MAP') },
          )
        }}
      />

      <SceneSearchBar
        className={cn(
          DIVE_FADE,
          (diving || chartOpen) && 'invisible opacity-0',
        )}
        mode={searchMode}
        onModeChange={setSearchMode}
        onSearch={(keyword, mode) => {
          if (mode === 'nl') openNl(keyword)
          else setMapKeyword(keyword)
        }}
        /*
          첫 소개는 화면이 비어 있을 때만 합니다 — 커튼 밑 · 결과창 뒤 · 해도 · 잠수 중에 펴면
          몇 초 만에 접혀 아무도 못 봅니다 (`SceneSearchBar` 의 introduce 머리말).
        */
        introduce={
          boot.done &&
          !diving &&
          !chartOpen &&
          nlQuery === null &&
          mapKeyword === null
        }
        // 헤더의 PERFUME 과 같은 잠수로 떠납니다 (`header/useDiveOut`)
        onBrowsePopular={() =>
          startDive(ROUTES.PERFUMES, 'dive', diveDepthOf(ROUTES.PERFUMES) ?? 0)
        }
      />

      {/*
        향해 일지 — 3D 위 왼쪽 위에 계속 떠 있습니다. 유리판 헤더 아래 30 · 왼쪽 30 —
        엔진 미니맵(SCENT MAP)이 오른쪽 아래 28px 에 서는 것과 마주 보게 둡니다

        ⚠ `top-30` 이 곧 "헤더(22.5) + 30" 입니다 — 둘 다 `--spacing` 을 타므로 한 숫자로 적힙니다.
          1920 에서 90+30=120 · 1536 에서 72+24=96 으로 헤더 아래 간격까지 같은 비율로 따라갑니다.

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
      <div
        className={cn(
          'absolute top-30 left-7.5 max-[940px]:top-auto max-[940px]:bottom-15',
          DIVE_FADE,
          (diving || chartOpen) && 'invisible opacity-0',
          // 좁은 화면에서 카드가 떠 있으면 비킵니다 (위 cardOpen 머리말) — 넓은 화면은 왼쪽 위라 카드와 안 겹칩니다
          cardOpen && 'max-[940px]:invisible max-[940px]:opacity-0',
        )}
      >
        <VoyageLog entries={logEntries} status={logStatus} />
      </div>

      {/*
        선실 — 배를 누르면 **배 옆에 뜨는 작은 말풍선** (진열대 · 컬렉션 두 줄).
        이 말풍선은 **선실로 들어가기**의 입구입니다 (2026-09-24) — 줄을 고르면 곧바로 옮겨 가지 않고,
        카메라가 배를 향해 줌인하는 동안 그 배에서 메인에 들어올 때의 구름이 스며 번져 덮고 진열대로 넘어갑니다
        (`shared/ui/DiveCurtain` 의 cabin · 엔진 `landing/src/cabin-in.js`). 헤더 SHELF 도 같은 전환입니다.

        ⚠️ **자리를 여기서 안 잡습니다.** 배를 따라다녀야 해서 말풍선이 제 rAF 안에서 엔진의
          배 화면 자리(`features/map` 의 `boatAnchor`)를 읽어 직접 씁니다 — 향해 일지 · 검색창처럼
          화면이 자리를 잡아 주는 UI 가 아닙니다.
        ⚠️ 그래서 **잠수 페이드(DIVE_FADE)도 안 겁니다.** 줄을 고르는 순간 말풍선이 먼저 닫히고, 커튼은
          그 위에서 덮습니다(z-100). 3D 를 떠나는 순간 화면째 사라집니다.
      */}
      <CabinBubble
        open={cabinOpen}
        onClose={closeCabin}
        isLoggedIn={isLoggedIn}
        onEnter={(to) => startDive(to, 'cabin')}
      />

      {/* 검색창의 두 방식이 내놓는 답. 뒤의 3D 는 그대로 돌아갑니다 */}
      <RecommendModal
        query={nlQuery}
        onClose={() => openNl(null)}
        restored={restoredNl}
      />

      <MapSearchModal
        keyword={mapKeyword}
        onClose={() => setMapKeyword(null)}
        onSelect={(perfume) => {
          setMapKeyword(null)
          /*
            ⭐ **지도에서 찾았으니 지도에서 보여 줍니다** (2026-10-01). 전에는 이름으로 향수 검색(A09)에
            보냈는데, 사용성 테스트 7명 모두가 "지도로 안 가고 다른 화면으로 튕긴다" 고 했고 거기서
            이름 표기가 달라 0건이 나오기도 했습니다. 이제 배가 그 부표 곁으로 가서 부표를 누른 것과
            같이 카드를 엽니다 — 자세히 보기 · 진열대 저장은 그 카드에서 이어집니다.
            못 가면 `onSeekMiss` 가 상세로 보냅니다.
          */
          setSeek((prev) => ({
            fragranticaId: perfume.fragranticaId,
            seq: (prev?.seq ?? 0) + 1,
          }))
        }}
      />

      {/*
        향수 상세 · 진열대 화면과 **같은 등록 모달**입니다. 지도 카드도 어떤 향수인지
        이미 알고 있어 `preselected` 로 1단계를 건너뜁니다. 들어온 입구마다 적을 수
        있는 값이 다르면 사용자가 같은 기능을 다르게 배웁니다. 값은 같고 판만 바다 위의
        것(`scene`)으로 갈아입습니다 — 엔진 카드 옆에 상아색 종이가 뜨면 다른 화면이 끼어든 것으로 읽힙니다.
      */}
      <ShelfRegisterModal
        scene
        open={saving !== null}
        onClose={closeShelfSave}
        preselected={
          saving === null
            ? undefined
            : {
                perfumeId: saving.perfumeId,
                name: saving.nameKo,
                brand: saving.brandKo,
              }
        }
        onSubmit={(input) => {
          closeShelfSave()
          actions.register.mutate(input, {
            onSuccess: () => showToast('진열대에 저장했습니다'),
            onError: (error) => showToast(shelfRegisterErrorMessage(error)),
          })
        }}
      />

      {/* 로그인하러 떠나도 3D 입력 잠금은 풀어 둡니다 */}
      <LoginRequiredDialog
        scene
        open={loginOpen}
        onClose={() => {
          setLoginOpen(false)
          release()
        }}
        redirectTo={ROUTES.HOME}
      />

      <Toast {...toastProps} />

      {/* 흰 커튼 · 짙은 점에서 터져 번지는 향 원 셋 · 굴러가는 퍼센트 — 헤더 · 토스트 위에 서고, 100% 뒤 걷히며 바다가 드러납니다 */}
      {!boot.done && (
        <SceneBootCurtain
          getState={boot.getState}
          onDone={boot.finish}
          onLeaving={() => setEngineUp(true)}
          hidden={rising}
        />
      )}
    </div>
  )
}
