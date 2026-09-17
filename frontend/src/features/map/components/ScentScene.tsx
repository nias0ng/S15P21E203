import { useEffect, useRef, useState } from 'react'

import { cn } from '@/shared/lib/cn'

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
interface EngineHost {
  openDetail: (perfume: ScenePerfumeRef) => void
  saveToShelf: (perfume: ScenePerfumeRef) => Promise<void>
  exploreSimilar: (perfume: ScenePerfumeRef) => void
  search: (query: string) => void
}

/** iframe 안 엔진이 여는 손잡이 — paperboat main.js 의 window.PB 중 여기서 쓰는 것만 */
interface EngineHandle {
  setHost: (host: EngineHost | null) => void
  params: Record<string, number>
  apply: () => void
}

type Props = {
  /** [자세히 보기] */
  onOpenDetail: (perfume: ScenePerfumeRef) => void
  /**
   * [진열대에 저장]. 돌려준 Promise 가 끝날 때까지 엔진이 입력을 잠급니다 —
   * 모달 위에서 누른 방향키가 배를 돌리지 않게, 모달이 닫히면(취소 · 저장) resolve 하세요.
   */
  onSaveToShelf: (perfume: ScenePerfumeRef) => Promise<void>
  /** 엔진 화면 위의 검색창 */
  onSearch: (query: string) => void
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
  onSearch,
  coveredTop = 0,
  onNightChange,
  className,
}: Props) {
  const frame = useRef<HTMLIFrameElement>(null)
  const [ready, setReady] = useState(false)

  // 엔진에는 처리기를 한 번만 꽂습니다. 렌더마다 새로 만들어지는 props 는 여기서 최신 것으로 부릅니다
  const latest = useRef({
    onOpenDetail,
    onSaveToShelf,
    onSearch,
    coveredTop,
    onNightChange,
  })
  useEffect(() => {
    latest.current = {
      onOpenDetail,
      onSaveToShelf,
      onSearch,
      coveredTop,
      onNightChange,
    }
  })

  useEffect(() => {
    const el = frame.current
    if (!el) return

    let timer = 0
    let tries = 0
    let attached: EngineHandle | null = null
    let timeWatch: MutationObserver | null = null

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

      // 엔진의 자리표시 헤더(v0.66.0)는 끕니다 — 무대를 헤더만큼 줄이는 방식이라 3D 가 앱의 유리판 헤더
      // 뒤까지 안 깔립니다. 대신 앱 헤더가 가리는 높이를 알려 검색창 · 해도를 그 아래로 내립니다
      engine.params.siteHeader = 0
      engine.params.hostTop = latest.current.coveredTop
      engine.apply()
      engine.setHost({
        openDetail: (perfume) => latest.current.onOpenDetail(perfume),
        saveToShelf: (perfume) => latest.current.onSaveToShelf(perfume),
        exploreSimilar: () => {
          // 엔진이 카드의 향을 새 중심으로 12개를 다시 띄웁니다 — 앱이 더 할 일은 없습니다
        },
        search: (query) => latest.current.onSearch(query),
      })
      // 시간대 — 엔진이 iframe 문서의 <html data-time> 을 바꿉니다. 그 속성 하나만 지켜봅니다
      timeWatch?.disconnect()
      const html = el.contentDocument?.documentElement
      if (html) {
        const report = () =>
          latest.current.onNightChange?.(html.dataset.time === 'night')
        report()
        timeWatch = new MutationObserver(report)
        timeWatch.observe(html, {
          attributes: true,
          attributeFilter: ['data-time'],
        })
      }
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
    return () => {
      el.removeEventListener('load', onLoad)
      window.clearTimeout(timer)
      timeWatch?.disconnect()
      attached?.setHost(null)
    }
  }, [])

  return (
    <iframe
      ref={frame}
      src={ENGINE_SRC}
      title="향 지도"
      className={cn(
        'block size-full border-0',
        ready ? 'opacity-100' : 'opacity-0',
        className,
      )}
    />
  )
}
