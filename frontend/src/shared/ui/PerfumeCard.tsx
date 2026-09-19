import { Link, type LinkProps } from 'react-router'

import { cn } from '@/shared/lib/cn'
import { BottleSilhouette } from '@/shared/ui/BottleSilhouette'
import { Thumbnail } from '@/shared/ui/Thumbnail'

type PerfumeCardProps = {
  /** 크게 적는 이름. 한국어 이름이 있으면 그걸 넘기세요 */
  name: string
  /**
   * 큰 이름 바로 아래 작게 적는 다른 이름. 무엇이 위로 갈지는 부르는 쪽이 정합니다.
   *
   * `name` 과 같으면 안 적습니다 — 한쪽 이름이 없는 향수는 부르는 쪽이
   * `name={a ?? b} subName={b}` 으로 넘기게 되는데, 그때 두 값이 같아져 같은
   * 글자가 두 줄로 겹칩니다.
   */
  subName?: string | null
  /** 브랜드명. 브랜드가 없는 향수는 null 이라 줄을 그리지 않습니다 */
  brand?: string | null
  /**
   * 사진 왼쪽 위에 얹는 순위(1부터). 없으면 안 그립니다.
   *
   * 줄 세운 목록에서만 넘기세요 — 숫자가 붙는 순간 사람은 순위로 읽습니다.
   */
  rank?: number
  /** 대표 이미지. 없으면 병 실루엣을 대신 세웁니다 */
  thumbnailUrl?: string | null
  /** 카드를 누르면 갈 곳. 없으면 링크가 아닌 그냥 카드가 됩니다. */
  to?: string
  /**
   * 이동할 때 함께 실어 보낼 값(react-router `Link` 의 state).
   *
   * 향수 상세가 들어온 길을 여기서 받습니다(`perfumeViewState`). 카드는 그 뜻을
   * 모르고 그대로 전달만 합니다.
   */
  state?: LinkProps['state']
  className?: string
}

/**
 * 사진이 놓이는 칸.
 *
 * 사진과 실루엣이 **같은 값을 써야** 합니다. 다르면 사진 있는 카드와 없는 카드의
 * 높이가 갈려 격자 한 줄이 들쭉날쭉해집니다.
 */
const SLOT = 'aspect-square w-full px-7.5 pt-3.75 pb-5'

/**
 * 향수 카드 (와이어프레임 A33 · A09 · A13 · A17 · C02 공용)
 *
 * 여러 도메인(향수 · 진열대 · 컬렉션 · 커뮤니티)이 같은 카드를 쓰는데
 * features/a 는 features/b 를 import 할 수 없으므로 shared/ui 에 둡니다.
 * 그래서 도메인 타입(PerfumeSummary)을 받지 않고 필요한 값만 낱개로 받습니다.
 * 도메인 타입을 여기서 알게 되면 ESLint 가 막습니다.
 *
 * 원어 이름을 같이 적는 이유: 예전에는 원어 이름만 한 줄 적었는데, 한국어로 찾는
 * 사람이 카드에서 이름을 못 읽었습니다.
 */
export function PerfumeCard({
  name,
  subName,
  brand,
  rank,
  thumbnailUrl,
  to,
  state,
  className,
}: PerfumeCardProps) {
  const body = (
    <>
      {/*
        예전에는 높이 110px 짜리 가로로 납작한 칸에 `cover` 로 채워서, 3:4 세로
        사진(카탈로그가 전부 432 x 577 입니다)의 위아래가 잘려 병목과 바닥만
        남았습니다. 어느 향순지 알아볼 수 없는 그림이었습니다.

        `bare` 로 사진 뒤 상자를 지웁니다 — 예전에는 사진 자리에 bone(#E8E1D6)
        바탕이 깔려 카드 안에 또 다른 네모가 있었습니다.

        그림자는 `drop-shadow` 입니다. box-shadow 는 네모난 상자 둘레에 지는데,
        병 사진은 배경이 투명이라 네모 그림자가 병과 따로 놉니다.
      */}
      <div className="relative w-full">
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
              'drop-shadow-[0_6px_8px_rgb(0_0_0/0.18)] saturate-125',
            )}
          />
        ) : (
          <BottleSilhouette className={cn(SLOT, 'text-ink-muted/30')} />
        )}

        {/*
          순위 동그라미. 색은 line-soft(bone)입니다 — 처음에 surface-card(#fefcf8)로
          깔았더니 **카드 바탕이 같은 흰색이라 동그라미가 아예 안 보였습니다.**

          숫자만 두면 낭독기가 "1" 이라고만 읽어 무엇의 1 인지 알 수 없습니다.
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

      <div className="min-h-13.5 w-full space-y-0.5">
        {/*
          이름이 한 줄이어도 두 줄 높이를 차지합니다(min-h) — 길이에 따라 아래
          원어명 · 브랜드 줄이 카드마다 다른 높이에 서면 격자가 어긋납니다.
        */}
        <p className="text-ink text-body line-clamp-2 font-serif leading-tight font-semibold">
          {name}
        </p>

        {subName && subName !== name && (
          <p className="text-ink-muted text-caption truncate">{subName}</p>
        )}

        {brand && <p className="text-ink text-caption truncate">{brand}</p>}
      </div>
    </>
  )

  /*
    `h-full` 이 격자에서 카드 높이를 맞춥니다. 없으면 이름이 두 줄인 향수가 하나
    섞였을 때 그 줄에서 그 카드만 테두리가 길어집니다.
  */
  const shell = cn(
    'border-line bg-surface-card rounded-card flex h-full flex-col gap-1.25 border p-2.5',
    className,
  )

  /*
   * `data-slot` 은 **화면 테마가 붙잡을 자리 이름**입니다.
   *
   * 이 카드는 여러 화면에서 쓰는 공용인데 화면마다 결이 다릅니다 — 향수 목록은
   * 어두운 방의 유리판 위라 카드도 유리여야 하고, 컬렉션은 종이 위라 그대로입니다.
   * 화면별 모양을 prop 으로 받으면 화면이 늘 때마다 이 파일을 고치게 됩니다.
   * 이름만 달아 두면 각 화면의 CSS 가 자기 결에 맞게 덮습니다
   * (styles/scent-display.css 의 .scent-glass).
   */

  return (
    <article className={cn('flex h-full flex-col', !to && shell)}>
      {to ? (
        <Link
          to={to}
          state={state}
          data-slot="card"
          className={cn(
            shell,
            'flex-1',
            'transition-[transform,box-shadow] duration-200 ease-out',
            'hover:shadow-raised hover:-translate-y-1.25',
          )}
        >
          {body}
        </Link>
      ) : (
        body
      )}
    </article>
  )
}
