import { Link } from 'react-router'

import { cn } from '@/shared/lib/cn'

type TileCardProps = {
  /** 카드를 누르면 갈 곳 */
  to: string
  /**
   * 이미지 자리. URL 하나가 아니라 `Thumbnail` 을 통째로 받는 이유: 컬렉션은 썸네일
   * 세 장을 나란히 두고, 높이도 도메인마다 달라 여기서 정하면 둘이 예외가 됩니다.
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
 * 세 도메인이 쓰므로 도메인 타입을 받지 않고 필요한 값만 낱개로 받습니다.
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
