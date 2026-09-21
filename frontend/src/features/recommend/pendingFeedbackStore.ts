import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

interface PendingFeedbackState {
  /** 아직 답하지 않은 설문의 손잡이. `null` 이면 물을 것이 없습니다 */
  token: string | null
  /** 답했거나 건너뛴 손잡이. 같은 추천을 다시 열어도 또 묻지 않습니다 */
  settled: string[]
  /**
   * 지금은 접어 둔 상태. 메인으로 돌아오면 `resume()` 이 펴서 다시 묻습니다.
   * NOTE: 저장하지 않습니다 — 접은 것은 "이번 화면에서만" 이라 새로고침하면 다시 물어야 합니다.
   */
  snoozed: boolean

  /** 결과 모달을 닫았습니다. 아직 답하지 않은 추천이면 설문을 걸어 둡니다 */
  hold: (token: string) => void
  /** 답했거나 건너뛰었습니다. 이 손잡이는 끝입니다 */
  settle: (token: string) => void
  /** 답하지 않은 채 창을 닫았습니다(× · Esc · 배경). 걸어 둔 것은 그대로 둡니다 */
  snooze: () => void
  /** 메인 화면이 다시 섰습니다. 접어 둔 설문을 폅니다 */
  resume: () => void
}

/**
 * 아직 답하지 않은 추천 만족도 설문 (NLR-08).
 *
 * 화면 상태가 아니라 **스토어**인 까닭: 결과에서 [자세히 보기]를 누르면 상세로 넘어가며
 * `HomePage` 가 통째로 언마운트됩니다. 설문을 `RecommendModal` 안에 들고 있으면 그 순간
 * 같이 사라져, 메인으로 돌아와도 물을 것이 남지 않습니다.
 *
 * `sessionStorage` 에 남기는 까닭: 상세 화면에서 새로고침하거나 그 주소를 그대로 다시 열면
 * 모듈 변수는 초기화됩니다. 탭을 닫으면 같이 사라지는 것이 맞습니다 — 며칠 뒤에 다시 와서
 * 그때의 추천이 어땠는지 묻는 것은 답을 못 받거나, 받아도 못 믿을 답입니다.
 *
 * NOTE: `shared/store/` 가 아니라 도메인 안입니다. 꽂는 곳(`RecommendModal`)과 읽는 곳
 * (`HomePage` 의 `NlrFeedbackModal`)이 추천 도메인과 그것을 조합하는 화면뿐입니다.
 */
export const usePendingFeedbackStore = create<PendingFeedbackState>()(
  persist(
    (set, get) => ({
      token: null,
      settled: [],
      snoozed: false,

      hold: (token) => {
        if (get().settled.includes(token)) return
        set({ token, snoozed: false })
      },
      settle: (token) =>
        set((state) => ({
          token: null,
          snoozed: false,
          // 한 세션에 스무 번이면 충분합니다 — 손잡이를 끝없이 쌓을 자리가 아닙니다
          settled: [...state.settled, token].slice(-20),
        })),
      snooze: () => set({ snoozed: true }),
      resume: () => set({ snoozed: false }),
    }),
    {
      name: 'hyanghae-nlr-feedback',
      storage: createJSONStorage(() => sessionStorage),
      // 접어 둔 것은 이번 화면에서만입니다 — 새로고침하면 다시 물어야 합니다
      partialize: ({ token, settled }) => ({ token, settled }),
    },
  ),
)
