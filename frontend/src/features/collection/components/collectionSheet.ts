/**
 * 컬렉션 모달의 종이 — 공용 `Modal` 의 `className` 으로 넘깁니다.
 *
 * 바탕 · 그림자는 `collection-cabinet.css` 의 `.collection-sheet` 가 칠하고, 머리 · 발의 가르는 선은
 * 모달이 유틸리티(`border-line`)로 긋는 선이라 같은 유틸리티로 색만 종이 선으로 바꿉니다 — CSS 파일의
 * 규칙(components 층)은 유틸리티를 못 이깁니다.
 */
export const COLLECTION_SHEET =
  'collection-sheet [&>footer]:border-[var(--hairline)] [&>header]:border-[var(--hairline)]'

/**
 * 향수를 고르는 모달의 폭(1920 에서 720). 공용 모달의 510 에서는 고르는 칸이 네 개 76 폭이라 이름이
 * 다섯 글자에서 잘립니다. 좁은 화면은 모달의 `max-w` 가 막습니다.
 */
export const PICK_SHEET_WIDTH = 'w-180'
