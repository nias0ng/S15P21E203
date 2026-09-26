/**
 * 새 탭 · 새 창으로 여는 누름인가 — 보조키(⌘ · Ctrl · Shift · Alt)를 쥐고 눌렀는가.
 *
 * 링크를 가로채 전환을 거는 자리(헤더의 잠수 · 로고, 3D 의 선실 말풍선)가 먼저 묻습니다. 그런
 * 누름까지 가로채면 링크가 링크이기를 그만둡니다 — 새 탭으로 열려던 사람이 이 탭에서 전환을 봅니다.
 *
 * @param event 누름. React · DOM 어느 쪽이든 보조키 넷만 봅니다
 * @returns 보조키를 하나라도 쥐었으면 true — 가로채지 말고 브라우저에 맡깁니다
 */
export const opensElsewhere = (
  event: Pick<MouseEvent, 'metaKey' | 'ctrlKey' | 'shiftKey' | 'altKey'>,
): boolean => event.metaKey || event.ctrlKey || event.shiftKey || event.altKey
