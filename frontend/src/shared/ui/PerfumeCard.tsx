import { Link, type LinkProps } from 'react-router'

import { cn } from '@/shared/lib/cn'
import { BottleSilhouette } from '@/shared/ui/BottleSilhouette'
import { Thumbnail } from '@/shared/ui/Thumbnail'

type PerfumeCardProps = {
  name: string
  subName?: string | null
  rank?: number
  thumbnailUrl?: string | null
  to: string
  state?: LinkProps['state']
}

const SLOT = 'aspect-square w-full px-7.5 pt-3.75 pb-5'

/**
 * 병이 앉는 판 (노트 · 브랜드 카드의 이미지 판과 같은 자리).
 *
 * NOTE: **흰색으로 못 박습니다.** 카탈로그 사진은 배경을 지운 PNG 인데 지우개가
 * 병의 흰 부분(라벨 · 유리 반사 · 뚜껑 하이라이트)까지 같이 먹은 장이 많습니다 —
 * 어두운 방의 카드 위에 그대로 두면 그 자리가 구멍처럼 뚫려 보입니다.
 * 브랜드 로고 판(`features/brand/plate.ts`)과 같은 까닭이라, 판 위 실루엣 색도
 * 역할 토큰을 못 씁니다(어두운 방에서 밝은 색으로 뒤집혀 흰 판에서 사라집니다).
 */
const PLATE = 'rounded-image border border-black/5 bg-white'

export function PerfumeCard({
  name,
  subName,
  rank,
  thumbnailUrl,
  to,
  state,
}: PerfumeCardProps) {
  const body = (
    <>
      <div className={cn(PLATE, 'relative w-full')}>
        {thumbnailUrl ? (
          <Thumbnail
            src={thumbnailUrl}
            fit="contain"
            bare
            className={cn(
              SLOT,
              'drop-shadow-[0_2px_2px_rgb(0_0_0/0.16),0_9px_12px_rgb(0_0_0/0.22)]',
              'saturate-125',
            )}
          />
        ) : (
          <BottleSilhouette className={cn(SLOT, 'text-charcoal-soft/25')} />
        )}

        {rank != null && (
          <span
            data-slot="rank"
            className={cn(
              'absolute top-0 left-0 flex size-7.5 items-center justify-center',
              'bg-line-soft/85 text-ink text-caption rounded-full font-medium backdrop-blur-sm',
            )}
          >
            <span aria-hidden>{rank}</span>
            <span className="sr-only">인기 {rank}위</span>
          </span>
        )}
      </div>

      <div className="min-h-13.5 w-full space-y-0.5 px-0.75">
        <p className="text-ink text-body line-clamp-2 font-serif leading-tight font-semibold">
          {name}
        </p>

        {subName && subName !== name && (
          <p className="text-ink-muted text-caption truncate">{subName}</p>
        )}
      </div>
    </>
  )

  return (
    <article className="flex h-full flex-col">
      <Link
        to={to}
        state={state}
        data-slot="card"
        className={cn(
          'border-line bg-surface-card rounded-card flex h-full flex-col gap-1.25 border p-2.5',
          'flex-1',
          'transition-[transform,box-shadow] duration-200 ease-out',
          'hover:shadow-raised hover:-translate-y-1.25',
        )}
      >
        {body}
      </Link>
    </article>
  )
}
