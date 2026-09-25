import { Link, type LinkProps } from 'react-router'

import { cn } from '@/shared/lib/cn'
import { BottleSilhouette } from '@/shared/ui/BottleSilhouette'
import { Thumbnail } from '@/shared/ui/Thumbnail'

type PerfumeCardProps = {
  /** 크게 적는 이름. 한국어 이름이 있으면 그걸 넘기세요 */
  name: string
  /**
   * 큰 이름 아래 작게 적는 다른 이름. `name` 과 같으면 안 적습니다 — 부르는 쪽이
   * `name={a ?? b} subName={b}` 로 넘기면 두 값이 같아져 두 줄로 겹칩니다.
   */
  subName?: string | null
  /** 사진 왼쪽 위에 얹는 순위(1부터). 줄 세운 목록에서만 넘기세요 */
  rank?: number
  /** 대표 이미지. 없으면 병 실루엣을 대신 세웁니다 */
  thumbnailUrl?: string | null
  /** 카드를 누르면 갈 곳 */
  to: string
  /** 이동할 때 함께 실어 보낼 값. 향수 상세가 들어온 길을 여기서 받습니다 */
  state?: LinkProps['state']
}

/** 사진이 놓이는 칸. **사진과 실루엣이 같은 값을 써야** 격자가 안 어긋납니다 */
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

/**
 * 향수 카드 (A33 · A09 · A13 · A17 · C02 공용). 도메인 타입을 받지 않고 낱개로
 * 받습니다 — `shared` 가 `features` 를 알면 ESLint 가 막습니다.
 */
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
      {/*
        예전에는 납작한 칸에 `cover` 라 3:4 세로 사진(카탈로그가 전부 432 x 577)의
        위아래가 잘려 병목과 바닥만 남았습니다. 그림자는 `drop-shadow` 입니다 —
        병 사진은 배경이 투명이라 box-shadow 의 네모 그림자가 병과 따로 놉니다.

        판은 사진이 있든 없든 똑같이 깝니다 — 한쪽만 깔면 격자에 흰 칸과 빈 칸이 섞입니다.
      */}
      <div className={cn(PLATE, 'relative w-full')}>
        {/*
          사진이 없으면 병 실루엣을 대신 세웁니다 — 카탈로그 표본 600건 중 88건에만
          사진이 있어, "이미지" 라고 적힌 네모를 두면 화면이 고장 난 것처럼 읽힙니다.
        */}
        {thumbnailUrl ? (
          <Thumbnail
            src={thumbnailUrl}
            fit="contain"
            bare
            className={cn(
              SLOT,
              /*
                두 겹입니다 — 앞의 짧고 진한 겹이 병을 판에 붙이고(접지), 뒤의 넓은 겹이
                띄웁니다. 한 겹만 쓰던 값(0 6px 8px / .18)은 연보라 카드 위에서 맞춘
                것이라 **흰 판에서는 묻혀** 병이 배경과 안 떨어졌습니다.
              */
              'drop-shadow-[0_2px_2px_rgb(0_0_0/0.16),0_9px_12px_rgb(0_0_0/0.22)]',
              'saturate-125',
            )}
          />
        ) : (
          <BottleSilhouette className={cn(SLOT, 'text-charcoal-soft/25')} />
        )}

        {/*
          순위 동그라미. 색은 line-soft(bone)입니다 — surface-card 로 깔았더니
          **카드 바탕이 같은 흰색이라 아예 안 보였습니다.**
        */}
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

      {/*
        좌우 3px 은 `px-[3px]` 이 아니라 기준자(`--spacing`)를 탑니다 — 박아 두면
        1536 에서 판과 사진은 0.8 배로 줄어드는데 이 들여쓰기만 안 줄어듭니다.
      */}
      <div className="min-h-13.5 w-full space-y-0.5 px-0.75">
        {/* 이름이 한 줄이어도 두 줄 높이를 차지합니다 — 격자가 어긋납니다 */}
        <p className="text-ink text-body line-clamp-2 font-serif leading-tight font-semibold">
          {name}
        </p>

        {subName && subName !== name && (
          <p className="text-ink-muted text-caption truncate">{subName}</p>
        )}
      </div>
    </>
  )

  /* `data-slot` 은 화면 테마가 붙잡을 자리 이름 — docs/어두운-방-유리판.md */

  return (
    <article className="flex h-full flex-col">
      <Link
        to={to}
        state={state}
        data-slot="card"
        className={cn(
          /* `h-full` 이 없으면 이름이 두 줄인 카드만 테두리가 길어집니다 */
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
