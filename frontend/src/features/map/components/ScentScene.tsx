import { useEffect, useRef, useState } from 'react'

import { cn } from '@/shared/lib/cn'
import { useDiveStore } from '@/shared/store/diveStore'
import type { GraphicsMode, SceneQuality } from '@/shared/store/graphicsStore'

import { setBoatAnchorSource, type BoatAnchor } from '../lib/boatAnchor'
import {
  parseBootMessage,
  snapshotEvents,
  type SceneBootEvent,
  type SceneBootSnapshot,
} from '../lib/bootProgress'
import { engineSrc, parseSceneQuality } from '../lib/sceneQuality'

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
  /** 한글이 없으면 엔진이 영문 원명으로 채워 보냅니다 (host.js `perfumeRef`) — 브랜드도 같습니다 */
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
  /** 안 주면 엔진의 기본(아무 일 없음)으로 갑니다 — 12개는 엔진이 이미 다시 띄웁니다 */
  exploreSimilar?: (perfume: ScenePerfumeRef) => void
  search: (query: string) => void
  moveBoat: (move: SceneMove) => void
  openCabin: () => Promise<void>
  /** 엔진이 말풍선을 닫아 달라고 합니다 — 3D 아무 데나 누르면 옵니다 (팝오버의 규약) */
  closeCabin: () => void
  /** 품질 단계가 바뀌었습니다 (엔진 `host.js` 의 `hostQuality`) — 모양은 `parseSceneQuality` 가 좁힙니다 */
  quality: (info: unknown) => void
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
   * 선실로 들어가기 진행도 0~1 (엔진 `landing/src/cabin-in.js` · `PB.cabinIn`) — 카메라가 배를
   * 향해 곧게 줌인합니다. **시계는 앱 커튼이 쥡니다**(`shared/ui/DiveCurtain` 의 cabin).
   *
   * 돌려주는 것은 **배 가운데의 화면 자리**(iframe 기준 CSS px)입니다 — 커튼이 거기서 구름을 번지게
   * 합니다. `on` 이 false 면 엔진이 아직 그 자리를 못 쟀습니다.
   * ⚠️ 없을 수 있습니다 — 그 기능 전 엔진 빌드입니다. 그때는 커튼이 화면 가운데서 혼자 번집니다.
   */
  cabinIn?: (k: number) => { x: number; y: number; on: boolean }
  /**
   * 배 — 여기서 읽는 것은 `screen`(배의 화면 자리) 하나입니다. 선실 말풍선이 매 프레임 꺼내
   * 제 자리를 잡습니다 (`lib/boatAnchor`). 엔진이 매 프레임 채웁니다.
   */
  boat?: { screen?: BoatAnchor }
  /**
   * 배를 그 자리에 놓습니다 — 메인에 들어올 때 **한 번** (엔진 `main.js` 의 `startAt`).
   *
   * ⚠️ 좌표는 **정규화 0~1** 입니다 (백엔드 `perfume_map_points` · 엔진 `scentmap.toWorld` 와 같은
   * 공간). `features/taste/api.ts` 의 `getScentVectors` 는 100 을 곱하지만(SVG viewBox 가 100×100)
   * 여기로 넘기는 것은 **안 곱한 쪽**입니다.
   *
   * ⚠️⚠️ `land` 가 **연출을 가릅니다.** 없으면 좌표에 그대로 놓고 조용히 시작하고(재방문),
   * `true` 면 목표 앞에 뱃머리를 돌려 세우고 그 해역 연출을 겁니다(취향 테스트 직후).
   *
   * ⚠️ 없을 수 있습니다 — 그 기능 전 엔진 빌드입니다. 그때는 예전처럼 원점에서 시작합니다.
   */
  startAt?: (
    pos: { x: number; y: number },
    opts?: { land?: boolean },
  ) => boolean
  /**
   * 배가 지금 떠 있는 정규화 좌표 — 메인을 **떠날 때** 한 번 읽어 서버에 남깁니다
   * (엔진 `main.js` 의 `boatAt`). 지도가 아직 없으면 null 입니다.
   */
  boatAt?: () => { x: number; y: number } | null
  /**
   * 그래픽 품질 단계 (엔진 `landing/src/quality.js` · `PB.quality`). `get` 은 지금 단계,
   * `set` 은 그래픽 설정을 겁니다 — 고정 단계면 엔진이 더 움직이지 않습니다.
   *
   * NOTE: 없을 수 있습니다 — 그 기능 전 엔진 빌드입니다. 그때는 설정 단추만 남고 엔진은 늘 같은 화면입니다.
   */
  quality?: { get: () => unknown; set: (mode: GraphicsMode) => boolean }
  /**
   * 그 향수의 부표로 배를 몰고 가서, 닿으면 **그 부표를 누른 것처럼** 고릅니다 (엔진 `main.js` 의
   * `goPerfume` · v0.82.0). 먼 곳이면 해도 · 미니맵과 같은 안개 전환을 탑니다.
   * 돌려주는 값은 '떠났는가' 입니다 — 지도에 없는 향수이거나 안개 전환 중이면 false 입니다.
   */
  goPerfume?: (fragranticaId: number) => boolean
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
  onOpenCabin: () => Promise<void>
  /**
   * 엔진이 말풍선을 닫아 달라고 합니다 — 3D 아무 데나 누르면(배를 다시 눌러도) 옵니다.
   * 팝오버라 배경 클릭으로 닫히는데, 그 클릭을 받는 것이 iframe 안의 엔진이라 이 길이 필요합니다.
   */
  onCloseCabin: () => void
  /**
   * 앱이 3D 위에 겹쳐 올린 것(유리판 헤더)이 가리는 위쪽 높이 — **CSS 길이**입니다
   * (`'var(--header-h)'`). 엔진은 3D 를 그 뒤까지 그대로 그리고, 검색창 · 정보 블록 ·
   * 해도만 그 아래로 내리며 향수 고르기의 12개를 그 띠에 세우지 않습니다 (paperboat `hostTop`).
   *
   * ⚠️ **px 숫자가 아닙니다.** 헤더 높이는 `--spacing` 을 타 화면 폭 · 배율을 따라 줄어듭니다
   * (1920 에서 90 · 1536 에서 72). 90 을 숫자로 넘기면 1536 에서 18px 이 어긋나 검색창 ·
   * 해도가 헤더 밑에 붕 뜹니다. 여기로 넘긴 길이를 **상자 하나에 재어** px 로 바꿔 엔진에
   * 넘기고, 화면이 바뀌면 다시 넘깁니다 (아래 probe).
   */
  coveredTop?: string
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
   * 엔진의 **향수 카드가 떠 있는지** (2026-10-01 · 엔진 `<html data-card>` · v0.87.0). 좁은 화면에서 3D 위에 얹은
   * 앱 UI(향해 일지 · 의견 단추)가 카드 아랫단을 덮어, 그동안 비키려고 듣습니다.
   */
  onCardChange?: (open: boolean) => void
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
   * 배를 **시작할 자리** (정규화 0~1). 주면 배가 원점이 아니라 거기서 시작합니다.
   *
   * 서버의 **한 칸**(`exploration_state`)에서 옵니다 — 취향 테스트가 처음 한 번 떨어뜨리고,
   * 그 뒤로는 메인을 떠날 때마다 마지막 자리가 덮어씁니다
   * (`docs/배-자리와-향해일지-0921.md` §A-2).
   *
   * ⚠️⚠️ **엔진이 붙은 뒤 딱 한 번만 넘깁니다.** 항해 중에 다시 부르면 배가 되돌아갑니다.
   * ⚠️ 비로그인이면 401 이라 없습니다 — 예전처럼 원점에서 시작합니다.
   */
  start?: { x: number; y: number } | null
  /**
   * **취향 테스트를 막 마치고 왔는가.** 그때만 배가 착륙 구도(목표 앞 · 뱃머리를 돌려)로 서고
   * 그 해역 연출이 바로 걸립니다 (`docs/취향-출발점과-영역-진입-0921.md` §A).
   *
   * ⚠️⚠️ 자리(`start`)만으로는 못 가립니다 — 취향 출발점도 마지막 항해 자리도 **같은 칸**에서
   * 같은 모양으로 오기 때문입니다. 가르는 것은 *어떻게 들어왔는가* 이고, 그건 `HomePage` 가
   * 라우터 state 로 받습니다 (첫 로그인 직후 한 번뿐인 길입니다).
   */
  landing?: boolean
  /**
   * 메인을 **떠나는 순간** 배가 있던 정규화 좌표를 알려 줍니다 (`§A-1`).
   *
   * ⚠️ 여기서 보낸 요청은 SPA 화면 전환에서만 돕니다 — 브라우저를 강제로 닫으면 안 갑니다.
   * ⚠️ 엔진이 아직 안 떴거나 지도가 없으면 안 부릅니다.
   */
  onLeave?: (pos: { x: number; y: number }) => void
  /**
   * 그래픽 설정 (`auto` · `high` · `mid` · `low` — 그래픽 설정 단추). 처음 값은 엔진 주소에
   * `?quality=` 로 실려 렌더러를 만들 때 읽히고, 그 뒤에 바뀌면 엔진에 바로 겁니다.
   */
  quality?: GraphicsMode
  /** 엔진의 지금 품질 단계 — 붙을 때 한 번, 단계가 바뀔 때마다 옵니다 (자동으로 내렸을 때도) */
  onQuality?: (quality: SceneQuality) => void
  /**
   * **이 향수의 부표로 가서 고릅니다** — 이름 검색(`MapSearchModal`)에서 향수를 골랐을 때입니다.
   * 엔진이 붙어 있지 않으면 붙는 대로 갑니다.
   *
   * ⚠️ `seq` 가 바뀔 때마다 한 번 갑니다 — 같은 향수를 두 번 골라도 두 번 가야 해서(그새 배를
   * 몰았을 수 있습니다) 향수 번호만으로는 못 가립니다.
   */
  seek?: { fragranticaId: number; seq: number } | null
  /**
   * 엔진이 그 향수로 못 갔습니다 — 지도에 없는 향수이거나, 그 기능 전 엔진 빌드이거나, 안개 전환 중입니다.
   * 화면이 다른 길(향수 상세)로 보낼 자리입니다.
   */
  onSeekMiss?: (fragranticaId: number) => void
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
  coveredTop = '0px',
  onNightChange,
  onChartChange,
  onCardChange,
  onBoot,
  onMove,
  start,
  landing,
  onLeave,
  quality = 'auto',
  onQuality,
  seek,
  onSeekMiss,
  className,
}: Props) {
  const frame = useRef<HTMLIFrameElement>(null)
  /** 엔진 주소에 싣는 처음 설정 — 주소는 한 번만 넣으므로 그때의 값만 씁니다 (그 뒤는 아래 effect 가 겁니다) */
  const initialQuality = useRef(quality)
  const probe = useRef<HTMLDivElement>(null)
  /** 붙어 있는 엔진 (`window.PB`). 아래 두 효과가 나눠 쓰므로 ref 에 둡니다 */
  const handle = useRef<EngineHandle | null>(null)
  const [ready, setReady] = useState(false)

  /**
   * 헤더가 가리는 높이를 **잰** px (위 `coveredTop` 머리말).
   *
   * 값이 아니라 상자를 재는 까닭: `--header-h` 는 `calc(var(--spacing) * 22.5)` 라
   * `getComputedStyle` 이 계산식을 그대로 돌려줍니다. 상자 하나를 그 높이로 세워 두면
   * 화면 폭 · 배율이 바뀔 때마다 ResizeObserver 가 새 px 을 물어옵니다.
   */
  const [covered, setCovered] = useState(0)
  useEffect(() => {
    const el = probe.current
    if (!el) return
    // `observe()` 는 붙는 순간 한 번 부르므로 첫 값도 여기로 옵니다
    const watch = new ResizeObserver(() =>
      setCovered(Math.round(el.getBoundingClientRect().height)),
    )
    watch.observe(el)
    return () => watch.disconnect()
  }, [coveredTop])

  // 엔진에는 처리기를 한 번만 꽂습니다. 렌더마다 새로 만들어지는 props 는 여기서 최신 것으로 부릅니다
  const latest = useRef({
    onOpenDetail,
    onSaveToShelf,
    onOpenCabin,
    onCloseCabin,
    covered,
    onNightChange,
    onChartChange,
    onCardChange,
    onBoot,
    onMove,
    onLeave,
    onQuality,
    onSeekMiss,
  })
  useEffect(() => {
    latest.current = {
      onOpenDetail,
      onSaveToShelf,
      onOpenCabin,
      onCloseCabin,
      covered,
      onNightChange,
      onChartChange,
      onCardChange,
      onBoot,
      onMove,
      onLeave,
      onQuality,
      onSeekMiss,
    }
  })

  /*
   * 창 크기 · 화면 배율이 바뀌어 헤더가 줄면 엔진에도 다시 알립니다 — 안 알리면 검색창 ·
   * 해도가 옛 헤더 높이에 남습니다. `PB.apply()` 는 **바뀐 값만** 다시 거는 손잡이라
   * (엔진 `main.js` 의 `applyUiEve`) 같은 값으로 불러도 아무 일도 하지 않습니다.
   *
   * ⚠️ `ready` 를 같이 보는 것은 **엔진이 붙는 순간**을 잡으려는 것입니다 — 그때 `covered`
   *   는 이미 정해져 있어 이 효과가 다시 돌 일이 없습니다.
   */
  useEffect(() => {
    const engine = handle.current
    if (!engine) return
    engine.params.hostTop = covered
    engine.apply()
  }, [covered, ready])

  /*
   * 배의 시작 자리는 **엔진이 붙은 뒤 딱 한 번** 넘깁니다 (아래 별도 effect).
   * ⚠️ 다른 처리기처럼 `latest` 에 담아 `attach` 안에서 부르면, 자리 쿼리가 엔진보다 늦게 오는
   *   경우에 영영 못 넘깁니다 — `ready` 와 `start` 가 **둘 다 갖춰지면** 도는 effect 로 뺐습니다.
   *   두 번 부르는 것은 `started` 가 막습니다 (항해 중에 부르면 배가 되돌아갑니다).
   */
  const started = useRef(false)

  /*
   * 엔진 알약 숨기기. 메인 검색은 방식이 둘(자연어 추천 · 지도 향수 찾기)이고 답이 모달인데,
   * 엔진은 iframe 안이라 라우터도 모달도 몰라 검색창은 앱이 그립니다(`SceneSearchBar`).
   * 3D · 설명문구 · 해도는 그대로 엔진이 그립니다.
   *
   * ⚠️ 엔진 DOM 을 직접 건드리는 **유일한 자리**입니다. 엔진에 끄는 입구
   * (`params.searchBar` 같은 것)가 생기면 그걸로 바꾸세요 — 엔진 `index.html` 의 마크업 모양에
   * 기대고 있어서, 못 찾으면 **조용히 아무 일도 하지 않습니다**(알약 둘이 겹쳐 보입니다).
   * 끄는 입구로 바꿀 때도 **자리는 남겨야** 합니다 (아래 `visibility` 머리말).
   *
   * 엔진이 붙은 뒤(`ready`)에 겁니다 — 그 전에는 iframe 문서에
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
      /*
       * ⚠️ **`display:none` 이 아니라 `visibility:hidden` 입니다.**
       *
       * 엔진은 향수 카드를 띄울 때 제 검색창 아래로만 세웁니다 — 그 자리를 알약의
       * `getBoundingClientRect()` 로 잽니다 (`landing/src/ui.js` 의 `measureAvoid`
       * → `avoid.top`). `display:none` 이면 그 상자가 **0 이 되어** 금지 띠가
       * 12px 로 주저앉고, 카드가 앱 검색창 **뒤로** 올라옵니다 (2026-09-22 사용자 :
       * *"향수 카드가 검색창 뒤로 보여져"*).
       *
       * iframe 안팎이라 z-index 로는 못 올립니다 — 스태킹이 아니라 문서가 다릅니다
       * (`HomePage` 의 해도 머리말과 같은 사정). 그래서 **카드를 올리는 대신 엔진이
       * 그 띠를 계속 피하게** 둡니다. `visibility:hidden` 은 상자를 남기므로 알약이
       * 보이지 않아도 금지 띠는 그대로입니다.
       *
       * 재는 자리와 앱 검색창의 자리가 같다는 전제입니다 — `SceneSearchBar` 가
       * 일부러 엔진 값에 맞춰 서 있습니다(그 컴포넌트 머리말). 1920 에서 둘 다 y 120~170.
       *
       * ⚠️ 1536 에서는 앱 알약만 `--spacing` 을 타 96~136 으로 줄고 엔진 상자는 102~152 에
       *   남습니다. 금지 띠가 앱 알약보다 **아래로 넓은** 쪽이라 카드는 그대로 비켜섭니다 —
       *   반대로(엔진이 더 위) 갈라지면 카드가 앱 알약 뒤로 올라옵니다.
       *
       * ⚠️ 칸은 `position:absolute` 라 되살아나도 다른 엔진 UI 를 안 밀고,
       * `pointer-events:none` 이라 3D 도 안 가립니다 — 둘 다 화면에서 확인했습니다.
       */
      if (band) band.style.visibility = 'hidden'
    }

    apply()
    // iframe 이 다시 뜨면(HMR · 새로고침) 엔진 DOM 도 새것이라 다시 겁니다.
    // `ready` 는 처음 한 번만 true 가 되므로 그것만 봐서는 놓칩니다
    el.addEventListener('load', apply)
    return () => el.removeEventListener('load', apply)
  }, [ready])

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
      handle.current = engine

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
      engine.params.hostTop = latest.current.covered
      engine.apply()
      engine.setHost({
        openDetail: (perfume) => latest.current.onOpenDetail(perfume),
        saveToShelf: (perfume) => latest.current.onSaveToShelf(perfume),
        // 검색창은 앱이 그립니다(위 알약 숨기기). 빈 처리기라도 있어야 엔진이 제 검색으로
        // 해역을 떠나지 않습니다 (host.js `hostSearch`)
        search: () => {},
        // 배가 든 해역이 바뀌었거나 향수를 골랐습니다 — 향해 일지가 받습니다 (host.js `hostMove`)
        moveBoat: (move) => latest.current.onMove?.(move),
        // 배를 눌렀습니다 — 선실 알림 판 (2026-09-21 · host.js `hostCabin`)
        openCabin: () => latest.current.onOpenCabin(),
        // 3D 아무 데나 누르면 말풍선을 닫습니다 (팝오버 — 엔진 host.js `hostCabin(false)`)
        closeCabin: () => latest.current.onCloseCabin(),
        // 품질 단계가 바뀌었습니다 — 자동 내림 · 올림 · 설정 변경 (host.js `hostQuality`)
        quality: (info) => {
          const next = parseSceneQuality(info)
          if (next) latest.current.onQuality?.(next)
        },
      })
      // 시작 단계는 처리기를 꽂기 **전에** 정해졌으므로 따라잡습니다 (부팅 신호의 `boot()` 와 같은 사정)
      const startQuality = parseSceneQuality(engine.quality?.get())
      if (startQuality) latest.current.onQuality?.(startQuality)
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
          data-card   향수 카드가 떠 있는가 (2026-10-01 — 위 onCardChange 머리말)
        ⚠️ 관찰자는 하나입니다 — 둘 다 같은 요소의 속성이라 나눌 이유가 없습니다.
      */
      timeWatch?.disconnect()
      const html = el.contentDocument?.documentElement
      if (html) {
        const report = () => {
          latest.current.onNightChange?.(html.dataset.time === 'night')
          latest.current.onChartChange?.(html.dataset.chart !== undefined)
          latest.current.onCardChange?.(html.dataset.card !== undefined)
        }
        report()
        timeWatch = new MutationObserver(report)
        timeWatch.observe(html, {
          attributes: true,
          attributeFilter: ['data-time', 'data-chart', 'data-card'],
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
      /*
        선실로 들어가기 — 진열대로 넘어가는 전환의 엔진 문입니다 (잠수와 같은 자리 · 같은 까닭).
        엔진은 배의 화면 자리를 **iframe 기준**으로 주므로, 커튼(화면 전체에 고정)이 쓰도록 iframe 의
        자리를 더해 뷰포트 기준으로 바꿉니다. 메인은 iframe 이 화면을 꽉 채워 대개 0 이지만, 그것을
        믿고 빼 두면 틀이 바뀌는 날 구름이 배 옆에서 번집니다.
        ⚠️ 엔진에 `cabinIn` 이 없으면 꽂지 않습니다 (커튼만 화면 가운데서 번집니다).
      */
      useDiveStore.getState().setCabinEngine(
        typeof engine.cabinIn === 'function'
          ? (k: number) => {
              const at = engine.cabinIn?.(k)
              if (!at?.on) return null
              const box = el.getBoundingClientRect()
              return { x: box.left + at.x, y: box.top + at.y }
            }
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
        el.src = engineSrc(ENGINE_SRC, initialQuality.current)
      })
    })
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('message', onMessage)
      el.removeEventListener('load', onLoad)
      window.clearTimeout(timer)
      timeWatch?.disconnect()
      /*
        ⭐ **떠나기 직전에 배가 있던 자리를 알립니다** (`onLeave` · §A-1). setHost 를 풀기 전에
        읽습니다 — 순서가 바뀌어도 값은 같지만, "엔진이 아직 살아 있을 때 읽는다" 를 코드가
        보이게 둡니다.
        ⚠️ 엔진이 안 떴거나(`boatAt` 없음) 지도가 아직 없으면(null) 조용히 건너뜁니다.
      */
      const last = attached?.boatAt?.()
      if (last) latest.current.onLeave?.(last)

      attached?.setHost(null)
      handle.current = null
      // 엔진이 사라집니다 — 커튼은 이제 혼자 차오릅니다 (잠수로 떠나는 길이 바로 이 경로입니다)
      useDiveStore.getState().setEngine(null)
      useDiveStore.getState().setCabinEngine(null)
      setBoatAnchorSource(null)
    }
  }, [])

  /*
   * 저장된 자리에서 배를 시작합니다 (`start` prop · §A-2).
   *
   * ⚠️⚠️ **한 번만 부릅니다** — `started` 가 막습니다. 항해 중에 다시 부르면 배가 되돌아갑니다.
   * ⚠️ 엔진과 `start` 중 늦게 오는 쪽을 기다립니다 (둘 다 의존성에 있습니다).
   * ⚠️ `landing` 이면 착륙 구도 + 해역 연출로, 아니면 조용히 그 자리에 놓습니다 (엔진 `startAt`).
   * ⚠️ 엔진에 `startAt` 이 없으면(그 기능 전 빌드) 조용히 지나갑니다 — 원점에서 시작합니다.
   *
   * NOTE: **자리가 늦게 오면 배가 눈에 보이게 순간이동합니다.** 보통은 안 그렇습니다 —
   * 실측(2026-09-23)으로 엔진이 붙는 2.05초에 배가 놓이고 로딩 커튼은 5.28초에 걷혀
   * **3.2초 여유**가 있으며, 배가 원점에 있는 프레임은 한 장도 관측되지 않았습니다.
   * 다만 `GET /map/exploration/me` 가 느려 커튼이 걷힌 뒤에 오면 그 순간이동이 보입니다.
   * 그래도 **놓습니다** — 자리를 잇는 것이 이 기능의 전부라, 한 번의 튐보다 원점에서
   * 시작해 버리는 쪽이 나쁩니다. 막으려면 여기에 커튼 상태 조건을 더하면 됩니다.
   */
  useEffect(() => {
    const engine = handle.current
    if (!ready || !engine || !start || started.current) return
    if (typeof engine.startAt !== 'function') return
    started.current = true
    engine.startAt(start, { land: landing })
  }, [ready, start, landing])

  /*
   * 그래픽 설정이 바뀌면 엔진에 겁니다. 엔진이 붙는 순간에도 한 번 맞춥니다 — 주소에 실은 처음
   * 값과 지금 값이 다를 수 있습니다(엔진이 뜨는 동안 설정을 바꾼 경우).
   * 엔진의 모드가 이미 같으면 부르지 않습니다 — 자동에서 `set('auto')` 를 또 부르면 판정 창이 비워집니다.
   */
  useEffect(() => {
    const engine = handle.current?.quality
    if (!ready || !engine) return
    if (parseSceneQuality(engine.get())?.mode === quality) return
    engine.set(quality)
  }, [ready, quality])

  /*
   * 이름 검색에서 고른 향수로 갑니다 (위 `seek` 머리말). 한 번 간 `seq` 는 다시 안 갑니다 —
   * 엔진이 다시 붙어 `ready` 가 흔들려도 배가 같은 향수로 또 떠나지 않게.
   */
  const sought = useRef<number | null>(null)
  useEffect(() => {
    const engine = handle.current
    if (!ready || !engine || !seek || sought.current === seek.seq) return
    sought.current = seek.seq
    const went = engine.goPerfume?.(seek.fragranticaId) ?? false
    if (!went) latest.current.onSeekMiss?.(seek.fragranticaId)
  }, [ready, seek])

  return (
    <>
      {/*
        헤더가 가리는 높이를 재는 자 (위 `covered` 머리말). 폭이 0 이고 안 보이므로 3D 도
        다른 UI 도 가리지 않습니다.
        ⚠️ `display:none` 은 안 됩니다 — 상자가 없어져 ResizeObserver 가 불리지 않습니다.
      */}
      <div
        ref={probe}
        aria-hidden
        className="pointer-events-none invisible absolute top-0 left-0 w-0"
        style={{ height: coveredTop }}
      />

      {/* 준비되면 짧게 드러납니다 — 로딩 커튼이 걷힐 때 그 뒤에서 이미 그려져 있고, 커튼 없이 뜰 때도 툭 나타나지 않습니다 */}
      {/* 주소(src)는 위 effect 가 두 장 뒤에 넣습니다 */}
      <iframe
        ref={frame}
        title="향 지도"
        className={cn(
          'block size-full border-0 transition-opacity duration-300',
          ready ? 'opacity-100' : 'opacity-0',
          className,
        )}
      />
    </>
  )
}
