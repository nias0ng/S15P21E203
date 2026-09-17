import { Link } from 'react-router'

import { cn } from '@/shared/lib/cn'
import { BottleSilhouette } from '@/shared/ui/BottleSilhouette'
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
  /**
   * 사진 왼쪽 위에 얹는 순위(1부터). 없으면 안 그립니다.
   *
   * "최근 인기 향수" 처럼 **줄 세운 목록에서만** 뜻이 있습니다. 검색 결과나 컬렉션은
   * 순서에 뜻이 없으므로 넘기지 마세요 — 숫자가 붙는 순간 사람은 순위로 읽습니다.
   */
  rank?: number
  /** 대표 이미지. 없으면 와이어프레임처럼 "이미지" 자리표시자를 그립니다. */
  thumbnailUrl?: string | null
  /** 카드를 누르면 갈 곳. 없으면 링크가 아닌 그냥 카드가 됩니다. */
  to?: string
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
/**
 * 사진이 놓이는 칸.
 *
 * 사진과 실루엣이 **같은 값을 써야** 합니다. 다르면 사진 있는 카드와 없는 카드의
 * 높이가 갈려 격자 한 줄이 들쭉날쭉해집니다.
 *
 * 좌우는 30 씩 들여 병을 작게 세웁니다. 병이 칸을 꽉 채우면 카드가 "사진 한 장" 이
 * 되어 병이 놓인 자리라는 인상이 사라지는데, 그건 좌우만으로 충분합니다.
 *
 * **위 15 · 아래 20 으로 아래가 더 넓습니다.** 병은 바닥에 놓인 물건이라 아래에
 * 자리가 조금 더 있어야 서 있는 것으로 읽힙니다 — 위아래가 같으면 공중에 뜬
 * 것처럼 보입니다. 그림자도 아래로 지므로 그 자리이기도 합니다. 위도 순위
 * 동그라미가 모서리에 앉을 자리만큼은 있어야 합니다.
 *
 * 칸이 정사각인 이유는 아래 사진 주석에 있습니다.
 */
const SLOT = 'aspect-square w-full px-7.5 pt-3.75 pb-5'

export function PerfumeCard({
  name,
  nameOriginal,
  brand,
  rank,
  thumbnailUrl,
  to,
  className,
}: PerfumeCardProps) {
  const body = (
    <>
      {/*
        **병이 잘리지 않게 세로로 긴 칸에 통째로 넣습니다.**

        예전에는 높이 110px 짜리 가로로 납작한 칸에 `cover` 로 채워서, 3:4 세로
        사진(카탈로그가 전부 432 x 577 입니다)의 위아래가 잘려 병목과 바닥만 남았습니다.
        어느 향순지 알아볼 수 없는 그림이었습니다.

        `contain` 으로 담아 잘리지 않게 하고, 칸 비율은 `aspect-square` 입니다.

        ⚠️ **사진과 같은 3:4 로 두면 안 됩니다.** 병을 작게 세우려고 좌우를 30 씩
        들여놨는데, 그러면 병이 폭에 갇혀 3:4 칸 안에서 위아래로 남는 자리가 크게
        생깁니다 — 칸은 3:4 여도 그 안의 **병**은 훨씬 홀쭉해집니다. 칸을 정사각으로
        잡으면 좌우 여백은 그대로 두면서 위아래 빈 띠만 걷힙니다.

        고정 px 이 아니라 비율이라 열 수(4열 · 5열)나 화면 폭이 달라져도 따라갑니다.

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
      <div className="relative w-full">
        {/*
          사진이 없으면 **병 실루엣**을 대신 세웁니다. "이미지" 라고 적힌 네모를
          두면 화면이 고장 난 것처럼 읽히는데, 사진 없는 향수는 드문 일이 아닙니다 —
          카탈로그 표본 600건 중 88건에만 사진이 있습니다.

          Thumbnail 의 자리표시자(상자 + "이미지")를 쓰지 않는 이유가 그것입니다.
          자리 크기는 사진과 **똑같이** 둡니다(아래 SLOT) — 다르면 사진 있는 카드와
          없는 카드의 격자가 어긋납니다.
        */}
        {thumbnailUrl ? (
          <Thumbnail
            src={thumbnailUrl}
            fit="contain"
            bare
            className={cn(
              SLOT,
              /*
              좌우는 30 씩 들여 병을 작게 세웁니다. 병이 칸을 꽉 채우면 카드가
              "사진 한 장" 이 되어 병이 놓인 자리라는 인상이 사라지는데, 그건
              좌우만으로 충분합니다. 위아래까지 30 을 두면 칸 안에 빈 띠가 생겨
              카드만 길어집니다.

              **위 15 · 아래 20 으로 아래가 더 넓습니다.** 병은 바닥에 놓인 물건이라
              아래에 자리가 조금 더 있어야 서 있는 것으로 읽힙니다 — 위아래가 같으면
              공중에 뜬 것처럼 보입니다. 그림자도 아래로 지므로 그 자리이기도 합니다.
              위도 순위 동그라미가 모서리에 앉을 자리만큼은 있어야 합니다.
            */
              /*
              값을 직접 적는 이유: Tailwind 눈금에 "lg 보다 멀리 지면서 조금만 더
              진한" 칸이 없습니다. xl 은 멀리 지는 대신 알파가 0.15 에서 0.1 로
              오히려 옅어집니다. 그래서 거리(6/8)와 진하기(0.18)를 따로 적습니다.
            */
              'drop-shadow-[0_6px_8px_rgb(0_0_0/0.18)]',
            )}
          />
        ) : (
          /*
            실루엣에는 그림자를 걸지 않습니다. 실루엣 자체가 그림자처럼 읽히는
            모양이라, 거기에 또 그림자를 지우면 무엇이 물체인지 흐려집니다.
            색은 옅은 먹색입니다 — 어두운 유리판 위에서도 밝은 종이 위에서도
            같은 자리(ink-muted)를 물려받습니다.
          */
          <BottleSilhouette className={cn(SLOT, 'text-ink-muted/30')} />
        )}

        {/*
          순위 동그라미.

          반투명입니다(backdrop-blur) — 불투명하게 채우면 병 위에 스티커를 붙인
          것처럼 보이고, 병이 왼쪽으로 치우친 사진에서는 병을 가립니다.
          비쳐 보이면 "사진 위에 얹힌 표시" 로 읽힙니다.

          색은 line-soft(bone)입니다. 처음에 surface-card(#fefcf8)로 깔았는데
          **카드 바탕이 같은 흰색이라 동그라미가 아예 안 보였습니다** — 사진이 없거나
          병이 가운데에만 있는 카드에서는 흰 위의 흰색이 됩니다. 종이 계열에서 한
          단 어두운 bone 이면 흰 카드 위에서도 테두리 없이 형태가 읽히고, 병 위에
          얹혀도 사진을 덮지 않습니다.

          숫자만 두면 낭독기가 "1" 이라고만 읽어 무엇의 1 인지 알 수 없습니다.
          보이는 숫자는 장식으로 감추고 뜻을 글자로 따로 적습니다.
        */}
        {rank != null && (
          <span
            // 화면 테마가 광택을 얹을 수 있게 자리 이름을 답니다(아래 data-slot 설명)
            data-slot="rank"
            className={cn(
              // 사진 칸의 왼쪽 위 모서리에 붙입니다. 카드 안쪽 여백(10)만큼만
              // 카드 테두리에서 떨어지고, 병은 사진 칸 안에서 15 들어와 있어 안 가립니다.
              'absolute top-0 left-0 flex size-7.5 items-center justify-center',
              'bg-line-soft/85 text-ink text-caption rounded-full font-medium backdrop-blur-sm',
            )}
          >
            <span aria-hidden>{rank}</span>
            <span className="sr-only">인기 {rank}위</span>
          </span>
        )}
      </div>

      <div className="w-full space-y-0.5">
        {/*
          한 줄로 자르지 않고 두 줄까지 받습니다(line-clamp-2). 한국어 향수명은
          "우드 세이지 앤 씨 솔트" 처럼 긴 것이 많아, 카드 폭(1440 에서 5열이면
          안쪽 255px)에서 한 줄로 자르면 뒤가 통째로 사라집니다.

          **이름이 한 줄이어도 두 줄 높이를 차지합니다**(min-h). 이름 길이에 따라
          아래 원어명·브랜드 줄이 카드마다 다른 높이에 서면 격자 한 줄이 들쭉날쭉해
          보입니다. 13px x leading-tight(1.25) = 17px, 두 줄이라 35 입니다.

          크기는 body(13)입니다. title(20) → caption(12) → heading(16) 을 거쳐
          내려온 값입니다. 노리던 것은 14 인데 활자 스케일이 다섯 단계로 끝나고
          그 사이에 칸이 없습니다 — `text-[14px]` 로 적으면 이 화면만 스케일 밖으로
          나가고, 스케일 주석이 바로 그런 임의값을 쓰지 말라고 못 박아 두었습니다.
          1px 차이라 body 를 씁니다.
        */}
        <p className="text-ink text-body line-clamp-2 min-h-8.75 font-serif leading-tight font-semibold">
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
    </>
  )

  /*
    **`h-full` 이 격자에서 카드 높이를 맞춥니다.**

    격자 칸(li)은 줄에서 가장 높은 칸에 맞춰 늘어나는데, 그 안의 카드가 내용 높이
    그대로면 칸만 늘고 카드는 짧게 남습니다. 이름이 두 줄인 향수가 하나 섞이면 그
    줄에서 그 카드만 테두리가 길어져 크기가 제각각으로 보였습니다.
  */
  const shell = cn(
    'border-line bg-surface-card rounded-card flex h-full flex-col gap-1.25 border p-2.5',
    className,
  )

  /*
   * `data-slot` 은 **화면 테마가 붙잡을 자리 이름**입니다.
   *
   * 이 카드는 여러 화면에서 쓰는 공용이고, 화면마다 결이 다릅니다 — 향수 목록은
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
