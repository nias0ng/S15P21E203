import { cn } from '@/shared/lib/cn'

/**
 * 향수병 실루엣 (사진이 없을 때 대신 세우는 모양)
 *
 * **사진이 없는 것이 드문 일이 아닙니다** — 사진은 저장소에 없고(`.gitignore`)
 * 카탈로그도 표본 600건 중 88건에만 있습니다.
 *
 * **색을 정하지 않습니다**(`currentColor`) — `text-[var(--niche-floor)]` 가 이
 * 파일에 박혀 있던 때, 다른 화면에서 쓰면 진열대 색이 따라왔습니다.
 * `preserveAspectRatio="xMidYMax meet"` 이라 늘 **바닥에 붙어 가운데** 섭니다.
 */
export function BottleSilhouette({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 64"
      preserveAspectRatio="xMidYMax meet"
      aria-hidden
      className={cn('shrink-0', className)}
    >
      <path
        fill="currentColor"
        d="M13 2h6v7c0 2 6 4 6 9v44a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V18c0-5 6-7 6-9V2Z"
      />
    </svg>
  )
}
