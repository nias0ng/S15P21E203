import { cn } from '@/shared/lib/cn'

/**
 * 돋보기.
 *
 * 헤더(`app/layouts/GlobalHeader`)와 검색창(`shared/ui/SearchField`) 두 곳에서
 * 같은 모양을 쓰게 되어 올렸습니다. 아이콘 하나 때문에 라이브러리를 붙이지는
 * 않습니다 — 지금 앱에 필요한 아이콘은 이것 하나입니다.
 *
 * 늘 장식입니다(`aria-hidden`). 옆에 "검색" 이라는 글자나 aria-label 이 이미
 * 있어서, 아이콘까지 읽으면 낭독기가 같은 말을 두 번 합니다.
 */
export function SearchIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      className={cn('size-5', className)}
    >
      <circle cx="9" cy="9" r="5.75" />
      <path d="m13.5 13.5 4 4" />
    </svg>
  )
}
