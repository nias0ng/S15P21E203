import { useEffect, useRef, useState } from 'react'

import { cn } from '@/shared/lib/cn'

import { isBootFinishing, type SceneBootState } from '../lib/bootProgress'

/**
 * 메인(3D 향 지도)의 로딩 커튼 — **거의 흰 화면이 가운데 한 점에서 번지며 걷힙니다.**
 *
 * 2026-09-18 사용자 : *"처음 웹페이지 들어올때 그냥 약간 아이보리 화면에서 가운데서 구름 걷히듯이
 * 하는 효과만 간단하게 넣자 1초 정도만"* · *"1~2초로하고 아이보리보단 약간의 흰색에 가까운 걸로
 * 가야함 완전 흰색은 눈아프고"* · *"커튼 처럼 좌우로 열리는데 점에서 확장되듯"*.
 *
 * ⚠️ '향해' 글자를 가운데에 작게 두고 같이 커지게 해 봤다가 **바로 걷어냈습니다** (2026-09-18,
 * 사용자 : *"이거 방금 봤는데 너무 이상함"*). 검은 글자가 드러난 바다 위로 부풀어 올라 겉돕니다 —
 * 다시 넣자고 먼저 제안하지 않습니다.
 *
 * 그전(v0.75.x)에는 향 원 세 개 + 붓글씨 '향해' + 굴러가는 퍼센트에 최소 4.2초였는데, 사용자 지시로
 * **전부 지웠습니다** (*"원래 있던거 다 지우고 그냥 구름 걷힌다는거임"*). 그때 쓰던 순수 모듈
 * (`lib/bootWordmark.ts` · `lib/bootCounter.ts`)과 테스트, 퍼센트용 Noto Serif KR 900 글꼴 링크,
 * `--color-dusk-peach` · `--color-dusk-lilac` 토큰도 같이 지웠습니다.
 * 되살릴 일이 생기면 커밋 `05b7de7` 에 그대로 있습니다.
 *
 * ⚠️ **첫 진입의 그림은 여기가 아니라 `index.html` 의 `#boot` 입니다** — React 가 뜨기 전부터
 * 칠해져 있어야 흰 화면이 한 번 비치지 않습니다. 이 컴포넌트는 그때 `#boot` 를 이어받아
 * **언제 걷을지만** 정하고, 앱 안에서 다시 들어올 때(`revisit`)만 직접 구름을 그립니다.
 * 두 곳의 색 · 치수 · 시간이 같아야 첫 진입과 재진입이 같아 보입니다 (`scene-boot.css`).
 *
 * ⚠️ 걷는 때는 **rAF 로 봅니다.** 엔진이 메인 스레드를 막는 동안 `setTimeout` 은 늦게 오고,
 * 그만큼 커튼이 더 오래 남습니다 — 막힘이 풀린 첫 장에 곧바로 판정해야 합니다.
 */

/** 걷어도 되는 것을 알고 나서 이만큼 멈춥니다 — 곧바로 걷으면 툭 끊깁니다 */
const HOLD_MS = 120
/** 구름이 갈라지는 시간. ⚠️ `index.html` 의 `--boot-lift` · `scene-boot.css` 와 **같은 값**이어야 합니다 */
const LEAVE_MS = 1000

type Props = {
  /** 지금 부팅 상태 — 매 장 읽습니다 (useSceneBoot 의 getState) */
  getState: () => SceneBootState
  /** 커튼이 다 걷혔습니다 — 화면에서 내려도 됩니다 */
  onDone: () => void
  /**
   * 걷기 시작했습니다 = **엔진이 다 떴습니다.** 진열대에서 떠올라 들어올 때 잠수 커튼이
   * 이것을 준비 신호로 씁니다 (`HomePage`) — 다 걷힐 때까지(1초) 기다리면 그만큼 늦습니다.
   */
  onLeaving?: () => void
  /**
   * 비켜 있습니다 — 잠수 커튼이 이미 화면을 덮고 있을 때입니다.
   * ⚠ 언마운트가 아니라 **숨기기**입니다. 걷는 때를 재는 일(getState · onDone)은 그대로 해야
   *   준비 신호가 오고, 떠오르기가 끝난 뒤 이 커튼도 제대로 내려갑니다.
   */
  hidden?: boolean
}

export function SceneBootCurtain({
  getState,
  onDone,
  onLeaving,
  hidden,
}: Props) {
  // 첫 진입이면 index.html 의 정적 커튼(#boot)이 이미 칠하고 있습니다
  const [adopted] = useState(() => document.getElementById('boot') !== null)
  const revisit = !adopted
  const [leaving, setLeaving] = useState(false)
  const latestDone = useRef(onDone)
  useEffect(() => {
    latestDone.current = onDone
  })

  // #boot 이어받기 — 걷힐 때까지 그대로 두고, 커튼이 사라지면 지웁니다
  useEffect(() => {
    const stub = adopted ? document.getElementById('boot') : null
    if (!stub) return
    // 이어받았다는 표시 — index.html 의 안전장치가 먼저 걷지 않게 합니다
    stub.dataset.adopted = 'true'
    return () => {
      // 개발 모드(StrictMode)는 마운트를 한 번 걷었다 다시 세웁니다 — 정말 사라졌을 때만 지웁니다
      window.setTimeout(() => {
        if (!document.querySelector('.scene-boot')) stub.remove()
      }, 0)
    }
  }, [adopted])

  // 걷어도 되는 때를 기다립니다 (엔진이 다 떴고 최소 표시 시간도 지났음)
  useEffect(() => {
    let alive = true
    let raf = 0
    let timer = 0
    const tick = () => {
      if (!alive) return
      if (isBootFinishing(getState(), performance.now())) {
        timer = window.setTimeout(() => setLeaving(true), HOLD_MS)
        return
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => {
      alive = false
      cancelAnimationFrame(raf)
      window.clearTimeout(timer)
    }
  }, [getState])

  const latestLeaving = useRef(onLeaving)
  useEffect(() => {
    latestLeaving.current = onLeaving
  })

  // 걷기 — 첫 진입이면 #boot 의 구름도 같이 갈라집니다
  useEffect(() => {
    if (!leaving) return
    latestLeaving.current?.()
    document.getElementById('boot')?.classList.add('is-leaving')
    const timer = window.setTimeout(() => latestDone.current(), LEAVE_MS)
    return () => window.clearTimeout(timer)
  }, [leaving])

  return (
    <div
      aria-hidden="true"
      className={cn(
        'scene-boot fixed inset-0 z-100',
        leaving && 'is-leaving',
        // 잠수 커튼이 덮고 있는 동안은 비킵니다 — 물 밑에서 아이보리 구름이 갈라지면 두 겹이 됩니다
        hidden && 'pointer-events-none opacity-0',
      )}
    >
      {revisit && (
        <i className="scene-boot-veil">
          <i className="scene-boot-drift" />
        </i>
      )}
    </div>
  )
}
