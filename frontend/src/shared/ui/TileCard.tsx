import { Link } from 'react-router'

import { cn } from '@/shared/lib/cn'

type TileCardProps = {
  /** 카드를 누르면 갈 곳 */
  to: string
  /**
   * 이미지 자리. 호출하는 쪽이 `Thumbnail` 을 직접 넘깁니다 — 브랜드는 로고를 잘리지 않게,
   * 노트는 사진을 꽉 채우는 식으로 크기 잡는 방식이 도메인마다 다릅니다.
   */
  media: React.ReactNode
  /** 한 줄로 줄여서 보여줍니다 */
  title: string
  /** 브랜드의 "향수 N개" 처럼 제목 아래 한 줄. 없으면 그리지 않습니다 */
  caption?: React.ReactNode
  className?: string
}

/**
 * 격자에 반복되는 타일 카드 (A34 브랜드 · A35 노트). 도메인 타입을 받지 않고 낱개로
 * 받습니다 — 향수 카드는 배지 · 동작이 있어 따로이고, 내 컬렉션은 진열대 화면의 진열함
 * 격자(`features/collection` 의 `CollectionStrip`)라 따로입니다.
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
      /* 화면 테마가 붙잡을 자리 이름 — docs/어두운-방-유리판.md */
      data-slot="card"
      className={cn(
        'border-line bg-surface-card rounded-card flex flex-col gap-2.5 border p-2.5',
        'transition-[transform,box-shadow] duration-200 ease-out',
        'hover:shadow-raised hover:-translate-y-1.25',
        className,
      )}
    >
      {media}

      {/*
        묶음을 block 으로 두는 이유: `space-y-*` 는 형제에 margin-top 을 다는 방식이라
        안쪽 요소가 블록이어야 먹습니다. 제목의 `truncate` 도 마찬가지입니다.
      */}
      <span className="block space-y-0.5">
        <span className="text-ink text-heading block truncate font-serif font-semibold">
          {title}
        </span>
        {caption && (
          <span className="text-ink-muted text-caption block">{caption}</span>
        )}
      </span>
    </Link>
  )
}
