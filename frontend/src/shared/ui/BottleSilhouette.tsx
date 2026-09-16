import { cn } from '@/shared/lib/cn'

/**
 * 향수병 실루엣 (사진이 없을 때 대신 세우는 모양)
 *
 * 향수 사진은 브랜드 저작물이라 저장소에 없고(`.gitignore`), 카탈로그에도 사진이
 * 없는 향수가 많습니다. **사진이 없는 것이 드문 일이 아닙니다** — 갓 clone 한
 * 팀원의 화면이 그렇고, 실제 카탈로그도 표본 600건 중 88건에만 사진이 있습니다.
 *
 * 그 자리에 "이미지" 라고 적힌 네모를 두면 화면이 고장 난 것처럼 읽힙니다.
 * 같은 자리에 병 모양을 세우면 "이 향수의 사진이 아직 없다" 로 읽힙니다.
 *
 * **색을 정하지 않습니다**(`currentColor`). 진열대는 벽감 바닥색, 향수 카드는
 * 옅은 먹색으로 씁니다 — 놓이는 곳의 결이 달라서 부르는 쪽이 정합니다.
 * 진열대에 있을 때는 `text-[var(--niche-floor)]` 가 이 파일에 박혀 있어서
 * 다른 화면에서 쓰면 그 색이 따라왔습니다.
 *
 * `preserveAspectRatio="xMidYMax meet"` 이라 상자가 더 넓거나 높아도 **바닥에
 * 붙어 가운데** 섭니다. 병은 놓인 물건이라 상자 가운데에 뜨면 어색합니다.
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
