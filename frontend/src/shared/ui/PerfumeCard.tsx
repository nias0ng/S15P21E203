import { Link } from 'react-router'

import { cn } from '@/shared/lib/cn'
import { Thumbnail } from '@/shared/ui/Thumbnail'

type PerfumeCardProps = {
  /** 크게 적는 이름. 한국어 이름이 있으면 그걸 넘기세요 */
  name: string
  /**
   * 큰 이름 아래 작게 적는 원어 이름.
   *
   * `name` 과 같으면 안 적습니다 — 한국어 이름이 없는 향수는 부르는 쪽이
   * `name={nameKo ?? name} nameOriginal={name}` 으로 넘기게 되는데, 그때 두 값이
   * 같아져 같은 글자가 두 줄로 겹칩니다. 그 판정을 여기서 한 번만 합니다.
   */
  nameOriginal?: string | null
  /** 브랜드명. 브랜드가 없는 향수는 null 이라 줄을 그리지 않습니다 */
  brand?: string | null
  /** 대표 이미지. 없으면 와이어프레임처럼 "이미지" 자리표시자를 그립니다. */
  thumbnailUrl?: string | null
  /** 카드를 누르면 갈 곳. 없으면 링크가 아닌 그냥 카드가 됩니다. */
  to?: string
  /** 향 계열 · 보유 중 같은 배지 (Badge 컴포넌트를 넘겨주세요) */
  badges?: React.ReactNode
  /** 카드 하단 동작 영역 — 진열대의 [대표 향수로 지정] 같은 것 */
  footer?: React.ReactNode
  className?: string
}

/**
 * 향수 카드 (와이어프레임 A33 · A09 · A13 · A17 · C02 공용)
 *
 * 여러 도메인(향수 · 진열대 · 컬렉션 · 커뮤니티)이 같은 카드를 쓰는데
 * features/a 는 features/b 를 import 할 수 없으므로 shared/ui 에 둡니다.
 * 그래서 도메인 타입(PerfumeSummary)을 받지 않고 필요한 값만 낱개로 받습니다.
 * 도메인 타입을 여기서 알게 되면 ESLint 가 막습니다.
 *
 * 글은 **세 줄**입니다 — 한국어 이름(크게) · 원어 이름(작게) · 브랜드.
 * 예전에는 원어 이름만 한 줄 적었는데, 한국어로 찾는 사람이 카드에서 이름을
 * 못 읽었습니다. 원어 이름을 지우지 않는 이유는 병에 적힌 글자가 그것이라
 * 매장·검색 결과와 맞춰 보는 단서이기 때문입니다.
 */
export function PerfumeCard({
  name,
  nameOriginal,
  brand,
  thumbnailUrl,
  to,
  badges,
  footer,
  className,
}: PerfumeCardProps) {
  const body = (
    <>
      {/*
        **병이 잘리지 않게 세로로 긴 칸에 통째로 넣습니다.**

        예전에는 높이 110px 짜리 가로로 납작한 칸에 `cover` 로 채워서, 3:4 세로
        사진(카탈로그가 전부 432 x 577 입니다)의 위아래가 잘려 병목과 바닥만 남았습니다.
        어느 향순지 알아볼 수 없는 그림이었습니다.

        `aspect-[3/4]` 로 사진과 같은 비를 잡고 `contain` 으로 담습니다. 비가 같아
        여백이 거의 안 생기고, 3:4 가 아닌 사진이 섞여 들어와도 잘리는 대신 남는
        자리가 바탕으로 보입니다. 고정 px 이 아니라 비율이라 열 수(4열 · 5열)나
        화면 폭이 달라져도 따라갑니다.

        `bare` 로 사진 뒤 상자를 지웁니다 — 카드 바탕 하나만 남습니다. 예전에는
        사진 자리에 bone(#E8E1D6) 바탕이 깔려 카드 안에 또 다른 네모가 있었습니다.

        그림자는 `drop-shadow` 입니다. box-shadow 는 네모난 상자 둘레에 지는데,
        병 사진은 배경이 투명이라 **네모 그림자가 병과 따로 놉니다.**
        drop-shadow 는 알파를 따라가 병 실루엣 모양으로 집니다.

        ⚠️ 진열대의 그림자를 옮겨 온 것이 **아닙니다.** 진열대는 접지 · 바닥 · 뒷벽
        세 겹을 벽감 치수(`--pitch` · `--floor-gap`)로 계산해 병을 바닥에 세웁니다.
        평평한 카드에는 바닥이 없어 그 장치가 성립하지 않고, 도메인 CSS 를 shared
        로 끌고 와야 합니다. 여기서는 "병 모양 그림자" 라는 결과만 맞춥니다.
      */}
      <Thumbnail
        src={thumbnailUrl}
        fallback="이미지"
        fit="contain"
        bare
        className={cn(
          'aspect-[3/4] w-full',
          // 그림자는 **사진일 때만** 겁니다. 자리표시자는 네모난 상자라 drop-shadow 가
          // 병 실루엣이 아니라 네모 둘레에 져서, 빈 상자가 종이 위에 떠 보입니다.
          thumbnailUrl && 'drop-shadow-lg',
        )}
      />

      <div className="w-full space-y-0.5">
        {/*
          한 줄로 자르지 않고 두 줄까지 받습니다(line-clamp-2). 한국어 향수명은
          "우드 세이지 앤 씨 솔트" 처럼 긴 것이 많아, 카드 폭(1440 에서 5열이면
          안쪽 255px)에서 한 줄로 자르면 뒤가 통째로 사라집니다.

          **이름이 한 줄이어도 두 줄 높이를 차지합니다**(min-h). 이름 길이에 따라
          아래 원어명·브랜드 줄이 카드마다 다른 높이에 서면 격자 한 줄이 들쭉날쭉해
          보입니다. 20px x leading-tight(1.25) = 25px, 두 줄이라 50 입니다.
        */}
        <p className="text-ink text-title line-clamp-2 min-h-12.5 font-serif leading-tight font-semibold">
          {name}
        </p>

        {/*
          원어 이름. 브랜드 줄과 같은 크기이고 색만 한 단 옅습니다.
          활자 스케일이 "body 와 caption 은 1px 차이라 크기로 위계를 만들지 않는다 —
          위계는 색이 만든다" 라고 정해 두어서, 이 둘의 구분도 색으로 합니다.
        */}
        {nameOriginal && nameOriginal !== name && (
          <p className="text-ink-muted text-caption truncate" lang="en">
            {nameOriginal}
          </p>
        )}

        {brand && <p className="text-ink text-caption truncate">{brand}</p>}
      </div>

      {badges && <div className="flex flex-wrap gap-1.25">{badges}</div>}
    </>
  )

  /*
    **`h-full` 이 격자에서 카드 높이를 맞춥니다.**

    격자 칸(li)은 줄에서 가장 높은 칸에 맞춰 늘어나는데, 그 안의 카드가 내용 높이
    그대로면 칸만 늘고 카드는 짧게 남습니다. 이름이 두 줄인 향수가 하나 섞이면 그
    줄에서 그 카드만 테두리가 길어져 크기가 제각각으로 보였습니다.
  */
  const shell = cn(
    'border-line bg-surface-card rounded-card flex h-full flex-col gap-2.5 border p-2.5',
    className,
  )

  return (
    // 하단 동작 영역이 있으면 카드가 그 위를 채웁니다 — h-full 만 주면 footer 가 넘칩니다
    <article className={cn('flex h-full flex-col', !to && shell)}>
      {to ? (
        <Link
          to={to}
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
      {footer && <div className="mt-2.5">{footer}</div>}
    </article>
  )
}
