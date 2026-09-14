import { cn } from '@/shared/lib/cn'

/**
 * 돋보기. 아이콘 하나 때문에 라이브러리를 붙이지 않습니다.
 * 늘 장식입니다 — 옆에 "검색" 글자나 aria-label 이 이미 있습니다.
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
