import { Link } from 'react-router'

import { cn } from '@/shared/lib/cn'

type TileCardProps = {
  /** 카드를 누르면 갈 곳 */
  to: string
  /**
   * 이미지 자리. 호출하는 쪽이 `Thumbnail` 을 직접 넘깁니다.
   *
   * 이미지 URL 하나를 받게 하지 않은 이유는 컬렉션이 썸네일 **세 장**을 나란히
   * 보여주기 때문입니다. 높이도 도메인마다 다릅니다(노트 h-20 · 브랜드 h-24 ·
   * 컬렉션 h-14). 여기서 정하면 셋 중 둘이 예외가 됩니다.
   */
  media: React.ReactNode
  /** 한 줄로 줄여서 보여줍니다 */
  title: string
  /** 브랜드의 "향수 N개" 처럼 제목 아래 한 줄. 없으면 그리지 않습니다 */
  caption?: React.ReactNode
  className?: string
}

/**
 * 격자에 반복되는 타일 카드 (와이어프레임 A34 브랜드 · A35 노트 · A13 컬렉션)
 *
 * 세 도메인이 같은 클래스 문자열을 복사해 쓰고 있어서 공용으로 올렸습니다
 * (S15P21E203-167). `features/a` 는 `features/b` 를 import 할 수 없으므로
 * `shared/ui` 에 두고, 도메인 타입을 받지 않고 필요한 값만 낱개로 받습니다.
 *
 * 향수 카드는 배지 · 하단 동작 영역이 따로 있어 `PerfumeCard` 로 남깁니다.
 */
export function TileCard({
  to,
  media,
  title,
  caption,
  className,
}: TileCardProps) {
  return (
    <Link
      to={to}
      className={cn(
        'border-line bg-surface-card rounded-card flex flex-col gap-2 border p-3',
        'transition-[transform,box-shadow] duration-200 ease-out',
        'hover:shadow-raised hover:-translate-y-1',
        className,
      )}
    >
      {media}
      <span className="text-ink text-heading truncate font-serif font-semibold">
        {title}
      </span>
      {caption && (
        <span className="text-ink-muted text-caption block">{caption}</span>
      )}
    </Link>
  )
}
