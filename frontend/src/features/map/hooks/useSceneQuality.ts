import { useCallback, useEffect, useState } from 'react'

import {
  useGraphicsStore,
  type QualityNotice,
  type SceneQuality,
} from '@/shared/store/graphicsStore'

import { NOTICE_MESSAGE, qualityNotice } from '../lib/sceneQuality'

/**
 * 메인 3D 의 그래픽 설정을 엔진과 잇습니다 — 사람이 고른 설정을 넘기고, 엔진이 알려 온 지금 단계를
 * `graphicsStore` 에 적습니다. 헤더의 톱니바퀴(`GraphicsMenu`)가 그 둘을 읽고 씁니다.
 *
 * 알릴 것(내장 그래픽이라 낮게 시작 · 자동으로 내림 · 가장 낮은 단계에서도 느림)은 기기마다
 * 한 번씩만 `notify` 로 넘깁니다.
 *
 * @param notify 알릴 말을 받습니다 (화면의 토스트). 렌더마다 새로 만들지 마세요
 * @param ready 로딩 커튼이 걷혔는가. 그 전에 온 안내는 걷힐 때까지 쥐고 있습니다 —
 *   엔진은 커튼 뒤에서 시작 단계를 알리는데, 3초짜리 토스트가 커튼 밑에서 끝나 버립니다
 * @returns `mode` (사람이 고른 설정), `onQuality` (`ScentScene` 에 꽂습니다)
 */
export function useSceneQuality(
  notify: (message: string) => void,
  ready: boolean,
) {
  const mode = useGraphicsStore((state) => state.mode)
  const calm = useGraphicsStore((state) => state.calm)
  const told = useGraphicsStore((state) => state.told)
  const [pending, setPending] = useState<QualityNotice | null>(null)

  const onQuality = useCallback((next: SceneQuality) => {
    useGraphicsStore.getState().setQuality(next)
    const notice = qualityNotice(next)
    if (notice) setPending(notice)
  }, [])

  // 메인을 떠나면 엔진도 사라집니다 — 헤더가 없는 엔진의 단계를 적어 두지 않게 비웁니다
  useEffect(() => () => useGraphicsStore.getState().setQuality(null), [])

  useEffect(() => {
    if (!ready || !pending || told.includes(pending)) return
    useGraphicsStore.getState().markTold(pending)
    notify(NOTICE_MESSAGE[pending])
  }, [ready, pending, told, notify])

  return { mode, calm, onQuality }
}
