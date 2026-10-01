import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

interface AnsweredFeedbackState {
  /** 만족도를 남긴 추천의 손잡이. 같은 추천을 다시 펼쳐도 다시 묻지 않습니다 */
  answered: string[]
  /** 답을 남겼습니다(이미 남겼다는 409 도 같습니다). 이 손잡이는 끝입니다 */
  markAnswered: (token: string) => void
}

/**
 * 만족도를 남긴 추천 (NLR-08).
 *
 * 설문은 결과창 **안의 한 줄**입니다(`NlrFeedbackInline`) — 결과를 닫을 때마다 따로 뜨던 설문 창은
 * 2026-10-01 에 걷었습니다(메인 사용성 테스트 7명 중 6명이 "닫을 때마다 끼어든다" · "그동안 다음 검색이
 * 막힌다" 고 했습니다). 그래서 들고 있을 것은 **답한 손잡이**뿐입니다 — 상세에 다녀와 같은 결과를 다시
 * 펼쳤을 때(`openRecommendation`) 한 번 답한 것을 또 묻지 않으려는 것입니다.
 *
 * `sessionStorage` 에 남기는 까닭: 상세에서 새로고침해도 이어져야 하고, 탭을 닫으면 같이 사라지는 것이
 * 맞습니다. 이름(`hyanghae-nlr-feedback`)은 예전 설문 창의 저장소와 같고, 판을 올려 예전 값을 버립니다.
 */
export const useAnsweredFeedbackStore = create<AnsweredFeedbackState>()(
  persist(
    (set) => ({
      answered: [],
      markAnswered: (token) =>
        set((state) =>
          state.answered.includes(token)
            ? state
            : // 한 세션에 스무 번이면 충분합니다 — 손잡이를 끝없이 쌓을 자리가 아닙니다
              { answered: [...state.answered, token].slice(-20) },
        ),
    }),
    {
      name: 'hyanghae-nlr-feedback',
      storage: createJSONStorage(() => sessionStorage),
      // 예전 판(설문 창의 pending · settled)은 버립니다 — 건너뛴 손잡이도 섞여 있어 '답했다' 로 못 읽습니다
      version: 2,
      migrate: () => ({ answered: [] }),
      partialize: ({ answered }) => ({ answered }),
    },
  ),
)
