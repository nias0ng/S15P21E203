/**
 * 컬렉션 모달의 종이 — 공용 `Modal` 의 `className` 으로 넘깁니다.
 *
 * 바탕 · 그림자는 `collection-cabinet.css` 의 `.collection-sheet` 가 칠하고, 머리 · 발의 가르는 선은
 * 모달이 유틸리티(`border-line`)로 긋는 선이라 같은 유틸리티로 색만 종이 선으로 바꿉니다 — CSS 파일의
 * 규칙(components 층)은 유틸리티를 못 이깁니다.
 *
 * 본문(모달의 가운데 div)은 **남는 높이만 쓰는 세로 흐름**입니다. 창이 낮으면(노트북 창 1536 x 730 등)
 * 본문 안의 고르는 칸이 줄어들어, 모달 전체가 스크롤되며 [만들기] · [담기] 단추가 아래로 숨지 않습니다.
 * 고르는 칸 · 그 위 칸들이 줄어들 수 있게 이어 주는 것은 각 모달 쪽입니다(`min-h-0` · `flex-1`).
 */
export const COLLECTION_SHEET =
  'collection-sheet [&>footer]:border-[var(--hairline)] [&>header]:border-[var(--hairline)] [&>div]:flex [&>div]:min-h-0 [&>div]:flex-1 [&>div]:flex-col'

/**
 * 향수를 고르는 모달의 폭(1920 에서 720). 공용 모달의 510 에서는 고르는 칸이 네 개 76 폭이라 이름이
 * 다섯 글자에서 잘립니다. 좁은 화면은 모달의 `max-w` 가 막습니다.
 */
export const PICK_SHEET_WIDTH = 'w-180'
