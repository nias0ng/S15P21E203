import { useEffect, useRef, useState } from 'react'

import { cn } from '@/shared/lib/cn'
import { useDiveStore } from '@/shared/store/diveStore'

import { setBoatAnchorSource, type BoatAnchor } from '../lib/boatAnchor'
import {
  parseBootMessage,
  snapshotEvents,
  type SceneBootEvent,
  type SceneBootSnapshot,
} from '../lib/bootProgress'

/**
 * 3D 향 지도가 카드 · 검색창에서 앱으로 넘기는 향수 한 개
 * (paperboat `src/host.js` 의 perfumeRef).
 *
 * ⚠️ 엔진의 향수 id 는 fragrantica_id 입니다. DB 의 perfumeId 는 백엔드 지도 API 를
 * 엔진 데이터로 넣어 주기 전까지 null 입니다.
 */
export interface ScenePerfumeRef {
  fragranticaId: number
  perfumeId: number | null
  name: string
  nameKo: string
  brand: string
  brandKo: string
  /** 향 계열 9코드 (CITRUS · FLORAL · WOODY …) */
  family: string
  /** 향 지도 좌표 0~1 */
  mx: number
  my: number
  /** 닮은 향수 10개 — 백엔드 /perfumes/{id}/neighbors 와 같은 목록 */
  neighbors: { fragranticaId: number; similarity: number }[]
}

/** 엔진에 꽂는 처리기 (host.js 의 setHost) */
/**
 * 배가 옮겨 간 자리 (엔진 `host.js` 의 `moveBoat`) — 해역이 바뀔 때와 향수를 고를 때 옵니다.
 *
 * ⚠️ `x` · `y` 는 **정규화 좌표**입니다 (엔진 `scentmap.toNorm()` · 백엔드 `perfume_map_points`
 * 와 같은 공간). 월드 좌표가 아닙니다.
 * ⚠️ `perfumeId` 는 DB 번호라 엔진 데이터에 아직 없어 늘 null 입니다 — 그동안은 좌표로 갑니다.
 */
export interface SceneMove {
  perfumeId: number | null
  x: number
  y: number
  /** 해역(향조) 코드 · 이름 — 화면이 쓰지는 않고 무엇이 왔는지 읽을 때 씁니다 */
  regionKey?: string
  regionName?: string
}

interface EngineHost {
  openDetail: (perfume: ScenePerfumeRef) => void
  saveToShelf: (perfume: ScenePerfumeRef) => Promise<void>
  exploreSimilar: (perfume: ScenePerfumeRef) => void
  search: (query: string) => void
  moveBoat: (move: SceneMove) => void
  openCabin: () => Promise<void>
  /** 엔진이 말풍선을 닫아 달라고 합니다 — 3D 아무 데나 누르면 옵니다 (팝오버의 규약) */
  closeCabin: () => void
}

/** iframe 안 엔진이 여는 손잡이 — paperboat main.js 의 window.PB 중 여기서 쓰는 것만 */
interface EngineHandle {
  setHost: (host: EngineHost | null) => void
  params: Record<string, number>
  apply: () => void
  /** 지금까지의 부팅 단계 — postMessage 를 놓친 앱이 따라잡습니다 (host.js bootNow) */
  boot?: () => SceneBootSnapshot
  /**
   * 잠수 진행도 0~1 (엔진 `landing/src/dive.js` · `PB.dive`) — 카메라가 수면으로 내려가고
   * 물 · 하늘이 짙은 바다색으로 눕습니다. **시계는 앱 커튼이 쥡니다**(`shared/ui/DiveCurtain`).
   *
   * ⚠️ 없을 수 있습니다 — 잠수가 없던 엔진 빌드입니다. 그때는 커튼만 차오릅니다.
   */
  dive?: (k: number) => void
  /**
   * 배 — 여기서 읽는 것은 `screen`(배의 화면 자리) 하나입니다. 선실 말풍선이 매 프레임 꺼내
   * 제 자리를 잡습니다 (`lib/boatAnchor`). 엔진이 매 프레임 채웁니다.
   */
  boat?: { screen?: BoatAnchor }
  /**
   * 배를 **취향 테스트가 고른 자리**에서 출발시킵니다 (엔진 `main.js` 의 `startAt`).
   *
   * ⚠️ 좌표는 **정규화 0~1** 입니다 (백엔드 `perfume_map_points` · 엔진 `scentmap.toWorld` 와 같은 공간).
   * `features/taste/api.ts` 의 `getScentVectors` 는 100 을 곱하지만 `getMyTasteTest` 는 안 곱합니다 —
   * 여기로 넘기는 것은 **안 곱한 쪽**입니다.
   *
   * ⚠️ 없을 수 있습니다 — 그 기능이 없던 엔진 빌드입니다. 그때는 예전처럼 원점에서 시작합니다.
   */
  startAt?: (pos: { x: number; y: number }) => boolean
}

type Props = {
  /** [자세히 보기] */
  onOpenDetail: (perfume: ScenePerfumeRef) => void
  /**
   * [진열대에 저장]. 돌려준 Promise 가 끝날 때까지 엔진이 입력을 잠급니다 —
   * 모달 위에서 누른 방향키가 배를 돌리지 않게, 모달이 닫히면(취소 · 저장) resolve 하세요.
   */
  onSaveToShelf: (perfume: ScenePerfumeRef) => Promise<void>
  /**
   * **배를 눌렀습니다** — 배 옆에 선실 말풍선을 띄울 자리입니다 (2026-09-21 · `CabinBubble`).
   *
   * 인자가 없습니다 — 배는 한 척이라 어느 배인지 가릴 일이 없습니다(엔진 `host.js` 의 `openCabin`).
   * 돌려준 Promise 가 **'말풍선이 닫혔다'** 입니다 — 엔진이 그걸로 떠 있는지를 셉니다. 어떤 길로
   * 닫히든(문을 골랐든 · Esc 든 · 3D 를 눌렀든) 한 번은 resolve 하세요.
   *
   * ⚠️ [진열대에 저장]과 달리 **엔진 입력을 안 잠급니다** — 판이 아니라 말풍선이라 뒤의 바다가
   * 살아 있어야 합니다. 3D 누름은 잠기는 대신 `onCloseCabin` 으로 옵니다.
   */
  onOpenCabin?: () => Promise<void>
  /**
   * 엔진이 말풍선을 닫아 달라고 합니다 — 3D 아무 데나 누르면(배를 다시 눌러도) 옵니다.
   * 팝오버라 배경 클릭으로 닫히는데, 그 클릭을 받는 것이 iframe 안의 엔진이라 이 길이 필요합니다.
   */
  onCloseCabin?: () => void
  /**
   * 엔진 화면 위의 검색창.
   *
   * ⚠️ `hideEngineSearch` 로 엔진 알약을 숨기면 **여기로 아무것도 오지 않습니다** —
   * 검색을 앱이 직접 받고 있다는 뜻입니다 (메인은 그쪽입니다 · `SceneSearchBar`).
   */
  onSearch?: (query: string) => void
  /**
   * 엔진이 그리는 검색창을 숨깁니다. 앱이 그 자리에 자기 검색창을 얹을 때 씁니다.
   *
   * 왜 필요한가: 메인 검색은 방식이 둘(자연어 추천 · 지도 향수 찾기)이고 결과가
   * 모달인데, 엔진은 iframe 안이라 라우터도 모달도 모릅니다. 그래서 알약만 앱으로
   * 올리고 엔진 쪽은 숨깁니다. 3D · 설명문구 · 해도는 그대로 엔진이 그립니다.
   *
   * ⚠️ 엔진 DOM 을 직접 건드리는 **유일한 자리**입니다. 엔진에 끄는 입구
   * (`params.searchBar` 같은 것)가 생기면 그걸로 바꾸세요 — 그때까지는 알약을 감싼
   * 칸을 찾아 `display:none` 합니다. 엔진 `index.html` 의 마크업 모양에 기대고
   * 있어서, 못 찾으면 **조용히 아무 일도 하지 않습니다**(알약 둘이 겹쳐 보입니다).
   */
  hideEngineSearch?: boolean
  /**
   * 앱이 3D 위에 겹쳐 올린 것(유리판 헤더)이 가리는 위쪽 높이(px).
   * 엔진은 3D 를 그 뒤까지 그대로 그리고, 검색창 · 정보 블록 · 해도만 그 아래로 내리며
   * 향수 고르기의 12개를 그 띠에 세우지 않습니다 (paperboat `hostTop`).
   */
  coveredTop?: number
  /**
   * 엔진의 하늘이 밤인지 알려 줍니다 — 엔진이 붙을 때 한 번, 시간대가 바뀔 때마다.
   * 엔진은 iframe 문서에 `<html data-time="dusk|night">` 을 답니다 (없으면 낮 · paperboat 불변식 25).
   */
  onNightChange?: (night: boolean) => void
  /**
   * 엔진의 **전체 화면 해도**가 열렸는지 (2026-09-21 · `landing/src/chart.js`).
   *
   * ⚠️⚠️ **해도는 3D 위에 얹은 앱 UI 를 못 덮습니다 — 문서가 다르기 때문입니다.** 해도는 iframe
   * 안이고 검색창 · 향해 일지 · 선실 말풍선은 iframe **밖**(부모 문서)이라, 엔진이 z-index 를
   * 아무리 올려도 그 위로 못 올라갑니다. 그래서 덮는 대신 **앱이 비킵니다** — 잠수 전환에서
   * 같은 UI 가 비키는 것과 같은 장치입니다(`HomePage` 의 `DIVE_FADE`).
   * ⚠️ 유리판 헤더는 비키지 않습니다 — 해도가 `hostTop` 만큼 그 아래에 서는 것이 원래 설계입니다.
   */
  onChartChange?: (open: boolean) => void
  /**
   * 엔진의 부팅 단계 (host.js `bootReport` — html → script → frame → boat-bytes → boat).
   * 로딩 커튼(SceneBootCurtain)이 퍼센트를 미는 데 씁니다. 배 GLB 진행은 초당 수십 번 옵니다.
   */
  onBoot?: (event: SceneBootEvent) => void
  /**
   * 배가 든 해역이 바뀌었거나(자유 항해 · 먼 곳 이동 둘 다) 향수를 골랐습니다 — 향해 일지(MAP-24)가
   * 이걸 받아 `PUT /map/exploration/me` 를 부릅니다. 기록할지는 서버가 정합니다.
   */
  onMove?: (move: SceneMove) => void
  /**
   * **취향 테스트가 고른 출발점** (정규화 0~1). 주면 배가 원점이 아니라 그 향수 곁에서 시작하고,
   * 그 해역 연출이 바로 걸립니다 (`frontend/docs/취향-출발점과-영역-진입-0921.md` §A).
   *
   * ⚠️⚠️ **엔진이 붙는 순간 딱 한 번만 넘깁니다.** 항해 중에 다시 부르면 배가 출발점으로 되돌아갑니다 —
   * 그래서 `latest` ref 가 아니라 **마운트 때 값**을 씁니다. 쿼리가 늦게 와서 그때 없었으면
   * 그 세션은 원점에서 시작합니다(로딩 커튼이 5초 안팎이라 보통은 제때 옵니다).
   * ⚠️ 비로그인이면 `GET /users/me/taste-test` 가 401 이라 없습니다 — 예전 동작 그대로입니다.
   */
  start?: { x: number; y: number } | null
  className?: string
}

/** 엔진 페이지 — landing/index.html (vite.config.ts 의 두 번째 입구 · 원본은 paperboat 에서 옮겼습니다) */
const ENGINE_SRC = '/landing/index.html'
/** 엔진이 window.PB 를 열 때까지 다시 보는 간격(ms) · 횟수 — 배 모델(8MB)을 받는 동안 기다립니다 */
const POLL_MS = 100
const POLL_LIMIT = 600

/**
 * 3D 향 지도 (A01 · A02 · A03 — paperboat 엔진)
 *
 * ⚠️ 엔진을 **iframe 으로** 띄웁니다. 엔진이 페이지 전역 CSS · `<html>` 속성 · window 키
 * 입력 · WebGL 렌더러를 직접 잡고 있어서, 앱 문서에 섞으면 헤더 · 모달 · 포커스 링과
 * 부딪칩니다. 엔진에 켜고 끄는 입구(mountPaperboat)가 생기면 이 컴포넌트 안만 바꾸면
 * 됩니다 — 바깥 props 는 그대로 둡니다.
 *
 * 같은 출처라 iframe 의 window.PB 에 처리기를 바로 꽂습니다(host.js 경계). 엔진이 준비될
 * 때까지는 투명하게 두어, 엔진의 자리표시 헤더가 한 번 비치는 것을 막습니다.
 */
export function ScentScene({
  onOpenDetail,
  onSaveToShelf,
  onOpenCabin,
  onCloseCabin,
  onSearch,
  hideEngineSearch = false,
  coveredTop = 0,
  onNightChange,
  onChartChange,
  onBoot,
  onMove,
  start,
  className,
}: Props) {
  const frame = useRef<HTMLIFrameElement>(null)
  const [ready, setReady] = useState(false)

  /*
   * 출발점은 **엔진이 붙은 뒤 딱 한 번** 넘깁니다 (아래 별도 effect).
   * ⚠️ 다른 처리기들처럼 `latest` ref 에 담아 `attach` 안에서 부르면, 취향 쿼리가 엔진보다
   * 늦게 오는 경우에 영영 못 넘깁니다 — 그래서 `ready` 와 `start` 둘 다 갖춰지면 도는
   * effect 로 따로 뺐습니다. 두 번 부르는 것은 `started` 가 막습니다
   * (항해 중에 다시 부르면 배가 출발점으로 되돌아갑니다).
   */
  const engineRef = useRef<EngineHandle | null>(null)
  const started = useRef(false)

  // 엔진에는 처리기를 한 번만 꽂습니다. 렌더마다 새로 만들어지는 props 는 여기서 최신 것으로 부릅니다
  const latest = useRef({
    onOpenDetail,
    onSaveToShelf,
    onOpenCabin,
    onCloseCabin,
    onSearch,
    coveredTop,
    onNightChange,
    onChartChange,
    onBoot,
    onMove,
  })
  useEffect(() => {
    latest.current = {
      onOpenDetail,
      onSaveToShelf,
      onOpenCabin,
      onCloseCabin,
      onSearch,
      coveredTop,
      onNightChange,
      onChartChange,
      onBoot,
      onMove,
    }
  })

  /*
   * 엔진 알약 숨기기. 엔진이 붙은 뒤(`ready`)에 겁니다 — 그 전에는 iframe 문서에
   * 알약이 아직 없습니다. `ready` 는 엔진이 새로 뜰 때마다 false → true 로 도니
   * iframe 이 다시 불러와도 따라옵니다.
   */
  useEffect(() => {
    const el = frame.current
    if (!el) return

    const apply = () => {
      const input = el.contentDocument?.getElementById('search-input')
      // 알약(`div`)을 감싼 **가운데 정렬 칸**까지 숨깁니다 — 알약만 숨기면 빈 칸이 남고,
      // 그 칸은 `pointer-events:none` 이라 3D 를 가리지는 않지만 자리를 계속 잡습니다
      const band = input?.parentElement?.parentElement
      if (band) band.style.display = hideEngineSearch ? 'none' : ''
    }

    apply()
    // iframe 이 다시 뜨면(HMR · 새로고침) 엔진 DOM 도 새것이라 다시 겁니다.
    // `ready` 는 처음 한 번만 true 가 되므로 그것만 봐서는 놓칩니다
    el.addEventListener('load', apply)
    return () => el.removeEventListener('load', apply)
  }, [ready, hideEngineSearch])

  useEffect(() => {
    const el = frame.current
    if (!el) return

    let timer = 0
    let tries = 0
    let attached: EngineHandle | null = null
    let timeWatch: MutationObserver | null = null

    // 부팅 신호 — 엔진이 window.PB 를 열기 **전**(html · script · frame)에도 오므로 postMessage 로 받습니다.
    // 같은 출처의, 이 iframe 이 보낸 것만 듣습니다 (Vite HMR 등 다른 메시지는 모양이 달라 걸러집니다)
    const onMessage = (event: MessageEvent) => {
      if (
        event.source !== el.contentWindow ||
        event.origin !== window.location.origin
      ) {
        return
      }
      const boot = parseBootMessage(event.data)
      if (boot) latest.current.onBoot?.(boot)
    }
    window.addEventListener('message', onMessage)

    // iframe 이 다시 불러오면 엔진도 새로 뜨고 PB 도 새것이라, 불러올 때마다 다시 찾습니다
    const attach = () => {
      const engine = (
        el.contentWindow as (Window & { PB?: EngineHandle }) | null
      )?.PB
      if (!engine) {
        if (tries++ < POLL_LIMIT) timer = window.setTimeout(attach, POLL_MS)
        return
      }
      if (engine === attached) return
      attached = engine

      // 놓친 부팅 신호 따라잡기 — 이미 받은 단계는 커튼 쪽에서 무시하므로 겹쳐도 됩니다
      const snapshot = engine.boot?.()
      if (snapshot) {
        for (const boot of snapshotEvents(snapshot)) {
          latest.current.onBoot?.(boot)
        }
      }

      // 엔진의 자리표시 헤더(v0.66.0)는 끕니다 — 무대를 헤더만큼 줄이는 방식이라 3D 가 앱의 유리판 헤더
      // 뒤까지 안 깔립니다. 대신 앱 헤더가 가리는 높이를 알려 검색창 · 해도를 그 아래로 내립니다
      engine.params.siteHeader = 0
      engine.params.hostTop = latest.current.coveredTop
      engine.apply()
      // 출발점을 넘길 effect 가 이걸 봅니다 (위 startRef 주석)
      engineRef.current = engine
      engine.setHost({
        openDetail: (perfume) => latest.current.onOpenDetail(perfume),
        saveToShelf: (perfume) => latest.current.onSaveToShelf(perfume),
        exploreSimilar: () => {
          // 엔진이 카드의 향을 새 중심으로 12개를 다시 띄웁니다 — 앱이 더 할 일은 없습니다
        },
        // 앱이 검색을 직접 받고 있으면(`hideEngineSearch`) 엔진 알약이 없어 오지 않습니다
        search: (query) => latest.current.onSearch?.(query),
        // 배가 든 해역이 바뀌었거나 향수를 골랐습니다 — 향해 일지가 받습니다 (host.js `hostMove`)
        moveBoat: (move) => latest.current.onMove?.(move),
        /*
          배를 눌렀습니다 — 선실 알림 판 (2026-09-21 · host.js `hostCabin`).
          ⚠️ 화면이 처리기를 안 주면 **곧바로 resolve 합니다.** 엔진은 돌려받은 Promise 가
            끝날 때까지 입력을 잠그므로, 여기서 안 풀면 배를 한 번 누른 뒤로 방향키가 죽습니다
        */
        openCabin: () => latest.current.onOpenCabin?.() ?? Promise.resolve(),
        // 3D 아무 데나 누르면 말풍선을 닫습니다 (팝오버 — 엔진 host.js `hostCabin(false)`)
        closeCabin: () => latest.current.onCloseCabin?.(),
      })
      /*
        선실 말풍선이 배를 따라다니려면 배의 화면 자리를 **매 프레임** 읽어야 합니다.
        값을 나르는 것이 아니라 **읽는 길**을 꽂습니다 — 60fps 값을 React 상태로 올리면
        초당 60번 화면 전체가 다시 그려집니다 (`lib/boatAnchor` 의 ⚠⚠).
      */
      setBoatAnchorSource(() => engine.boat?.screen ?? null)
      /*
        엔진이 iframe 문서의 <html> 속성으로 알리는 것들을 지켜봅니다.
          data-time   시간대 (밤이면 헤더가 남색 유리)
          data-chart  전체 화면 해도가 열렸는가 (2026-09-21 — 위 onChartChange 머리말)
        ⚠️ 관찰자는 하나입니다 — 둘 다 같은 요소의 속성이라 나눌 이유가 없습니다.
      */
      timeWatch?.disconnect()
      const html = el.contentDocument?.documentElement
      if (html) {
        const report = () => {
          latest.current.onNightChange?.(html.dataset.time === 'night')
          latest.current.onChartChange?.(html.dataset.chart !== undefined)
        }
        report()
        timeWatch = new MutationObserver(report)
        timeWatch.observe(html, {
          attributes: true,
          attributeFilter: ['data-time', 'data-chart'],
        })
      }
      /*
        잠수 — 진열대로 넘어가는 전환에 커튼이 매 장 진행도를 밀 수 있게 엔진의 문을 꽂습니다
        (`shared/store/diveStore`). 커튼은 껍데기(RootLayout)에 있어 이 화면이 사라진 뒤에도
        살아 있으므로, 화면(HomePage)을 거치지 않고 여기서 바로 잇습니다 — `setHost` 와 같은
        엔진 경계입니다. ⚠️ 엔진에 `dive` 가 없으면 꽂지 않습니다 (커튼만 올라옵니다).
      */
      useDiveStore
        .getState()
        .setEngine(
          typeof engine.dive === 'function'
            ? (k: number) => engine.dive?.(k)
            : null,
        )
      setReady(true)
      // 들어오자마자 방향키로 배를 몰 수 있게 포커스를 엔진으로 넘깁니다
      el.contentWindow?.focus()
    }
    const onLoad = () => {
      window.clearTimeout(timer)
      tries = 0
      attach()
    }

    el.addEventListener('load', onLoad)
    timer = window.setTimeout(attach, POLL_MS)
    // 엔진은 두 장 뒤에 부릅니다 — 로딩 커튼(원 · 퍼센트)이 먼저 한 번 칠해져 합성 스레드로 넘어가야, 엔진이 뜨며
    // 메인 스레드를 1~3초 막는 동안에도 커튼이 움직입니다. 늦어지는 건 30ms 남짓입니다 (2026-09-17 실측)
    let raf = requestAnimationFrame(() => {
      raf = requestAnimationFrame(() => {
        el.src = ENGINE_SRC
      })
    })
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('message', onMessage)
      el.removeEventListener('load', onLoad)
      window.clearTimeout(timer)
      timeWatch?.disconnect()
      attached?.setHost(null)
      // 엔진이 사라집니다 — 커튼은 이제 혼자 차오릅니다 (잠수로 떠나는 길이 바로 이 경로입니다)
      useDiveStore.getState().setEngine(null)
      setBoatAnchorSource(null)
      engineRef.current = null
    }
  }, [])

  /*
   * 취향 테스트가 고른 출발점 — 배를 그 향수 곁에 놓고 그 해역 연출을 겁니다 (`start` prop · §A).
   *
   * ⚠️⚠️ **한 번만 부릅니다.** 항해 중에 다시 부르면 배가 출발점으로 되돌아갑니다 — `started` 가 막습니다.
   * ⚠️ 엔진과 `start` 중 늦게 오는 쪽을 기다립니다. 보통은 쿼리가 먼저지만, 느린 회선에서
   * 순서가 뒤집혀도 이 effect 가 다시 돌아 잡습니다.
   * ⚠️ 엔진에 `startAt` 이 없으면(그 기능 전 빌드) 조용히 지나갑니다 — 예전처럼 원점에서 시작합니다.
   */
  useEffect(() => {
    const engine = engineRef.current
    if (!ready || !engine || !start || started.current) return
    if (typeof engine.startAt !== 'function') return
    started.current = true
    engine.startAt(start)
  }, [ready, start])

  return (
    // 준비되면 짧게 드러납니다 — 로딩 커튼이 걷힐 때 그 뒤에서 이미 그려져 있고, 커튼 없이 뜰 때도 툭 나타나지 않습니다
    // 주소(src)는 위 effect 가 두 장 뒤에 넣습니다
    <iframe
      ref={frame}
      title="향 지도"
      className={cn(
        'block size-full border-0 transition-opacity duration-300',
        ready ? 'opacity-100' : 'opacity-0',
        className,
      )}
    />
  )
}
