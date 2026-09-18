import { useCallback, useRef, useState } from 'react'

import {
  applyBootEvent,
  createBootState,
  type SceneBootEvent,
  type SceneBootState,
} from '../lib/bootProgress'

/**
 * 엔진(ScentScene)의 부팅 신호를 모아 로딩 커튼(SceneBootCurtain)에 넘기는 상태.
 *
 * 진행 상태는 **React 상태가 아니라 ref** 에 둡니다. 배 GLB 진행 신호가 초당 수십 번 오는데
 * setState 로 받으면 화면(HomePage)이 그만큼 다시 그립니다. 커튼은 rAF 마다 `getState()` 로
 * 읽으므로 다시 그릴 이유가 없습니다. React 상태는 "끝났다" 하나뿐입니다.
 */
export function useSceneBoot() {
  // 첫 진입이면 index.html 의 정적 커튼(#boot)이 서 있습니다 — 그때(항해 시작)부터 세던 시계를 이어받습니다
  const [initial] = useState(() =>
    createBootState(
      performance.now(),
      document.getElementById('boot') !== null,
    ),
  )
  const state = useRef(initial)
  const [done, setDone] = useState(false)

  const report = useCallback((event: SceneBootEvent) => {
    state.current = applyBootEvent(state.current, event, performance.now())
  }, [])
  const getState = useCallback((): SceneBootState => state.current, [])
  const finish = useCallback(() => setDone(true), [])

  return { done, report, getState, finish }
}
