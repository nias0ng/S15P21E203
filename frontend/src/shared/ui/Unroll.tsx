import { UNROLL, useUnroll } from '@/shared/hooks/useUnroll'
import { cn } from '@/shared/lib/cn'

/**
 * 족자처럼 위에서 아래로 풀리는 칸. `useUnroll` 을 쓰는 곳마다 같은 두 겹(재는 종이 ·
 * 높이를 늘리는 칸)을 적고 있어 한 벌로 묶었습니다.
 *
 * NOTE: **마운트될 때 한 번 풀립니다.** 닫혀 있을 때 DOM 에 남겨 두면 다음에 열 때 다시
 * 풀리지 않으니, 부르는 쪽이 조건부로 렌더하거나 `key` 로 새로 세웁니다.
 *
 * @param props.children 풀릴 내용
 * @returns 높이가 0 에서 내용 높이까지 늘어나는 칸
 */
export function Unroll({ children }: { children: React.ReactNode }) {
  const { bodyRef, style, inert } = useUnroll()

  return (
    <div
      className={cn(
        'overflow-hidden transition-[height] motion-reduce:transition-none',
        UNROLL,
      )}
      style={style}
      inert={inert}
    >
      <div ref={bodyRef}>{children}</div>
    </div>
  )
}
