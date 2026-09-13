import { cn } from '@/shared/lib/cn'

import { nameWithoutBrand } from '../lib'
import type { ShelfItem } from '../types'

type Props = {
  items: ShelfItem[]
  /** 벽감이 차지하는 칸 수. 비어 있어도 1 입니다 */
  span: number
  selectedId: number | null
  onSelect: (item: ShelfItem) => void
  /** 창 밖이라 감출 병인가. `at` 은 이 벽감 안의 순서입니다 */
  isHidden: (at: number) => boolean
  /** 향수가 없을 때 벽감 안에 적는 말 */
  emptyMessage: string
}

/*
 * 병이 차지하는 칸 높이(--bottle-h). **모든 병이 같은 값입니다.** 진열장 자리 크기에서
 * 계산하고(lib.ts 의 shelfMetrics), ShelfWall 이 CSS 변수로 넣습니다.
 *
 * 예전에는 id 로 일곱 가지 높이를 돌려썼습니다. 자리표시자가 똑같은 실루엣이라
 * 높이라도 흔들어야 진열장처럼 보였기 때문입니다. 지금은 진짜 사진이 들어와서
 * 병마다 비율이 이미 다릅니다 — 넓은 플라콘(미스 디올·끌로에)은 object-contain 이
 * 폭에 맞추느라 저절로 낮아지고, 길쭉한 병(상탈 33·에르메스)은 높이를 다 씁니다.
 * 여기서 높이까지 흔들면 그 위에 가짜 편차가 한 겹 더 얹힙니다.
 */
const BOTTLE_HEIGHT = 'var(--bottle-h)'

/**
 * 마우스를 따라 벽감 안 조명이 몇 px 움직입니다.
 *
 * 위치를 -1~1 로 재서 CSS 변수(--px · --py)로만 넘기고, 얼마나 움직일지는
 * `shelf-display.css` 가 정합니다(조명 3px · 병 1.5px). 상태로 들지 않는 이유는
 * 마우스가 움직일 때마다 병 스물다섯 개가 다시 그려지기 때문입니다.
 *
 * 마우스만 따릅니다. 손가락으로 끄는 동안 조명이 따라오면 화면이 흔들려 보입니다.
 * 움직임을 줄이도록 설정한 사용자에게는 CSS 가 이 값을 무시합니다.
 */
function followPointer(event: React.PointerEvent<HTMLElement>) {
  if (event.pointerType !== 'mouse') return
  const box = event.currentTarget.getBoundingClientRect()
  const x = ((event.clientX - box.left) / box.width) * 2 - 1
  const y = ((event.clientY - box.top) / box.height) * 2 - 1
  event.currentTarget.style.setProperty('--px', x.toFixed(3))
  event.currentTarget.style.setProperty('--py', y.toFixed(3))
}

function resetPointer(event: React.PointerEvent<HTMLElement>) {
  event.currentTarget.style.setProperty('--px', '0')
  event.currentTarget.style.setProperty('--py', '0')
}

/**
 * 벽감 하나 — 분류 하나의 병들이 서는 자리 (와이어프레임 A13 재디자인 시안)
 *
 * 벽을 파낸 벽감에 향수병을 세워 둡니다. 벽감은 **면 단위로** 나뉘어 있습니다 —
 * 뒷벽 · 천장 · 좌우 벽 · 바닥 · 입구 테두리가 각자 한 겹이고, 면마다의 모양과
 * 명도는 `../shelf-display.css` 가 그립니다. 배치·간격은 여기 Tailwind 입니다.
 *
 * **벽감 폭은 병 수만큼입니다.** 칸 하나가 병 하나이고, 이 상자의 폭이 곧 뒷벽 폭입니다.
 * 좌우 옆벽과 입구 테두리(--track-inset)는 상자 밖으로 삐져나와 이웃한 이름표 벽 칸에
 * 걸칩니다 — ShelfWall 이 이름표 벽을 칸 하나 폭으로 두고, 그 가장자리를 옆벽 자리로
 * 비워 둡니다. 그래서 벽 한 줄의 칸 폭이 전부 같고, 칸 단위로 끊어 멈출 수 있습니다.
 *
 * 병은 바닥 가운데쯤 서 있고, 발치에 짧고 진한 접지 그림자를 둡니다. 그림자가
 * 벽에 지는 큰 그림자뿐이면 병이 떠 보입니다.
 *
 * 병 이미지는 배경이 투명한 PNG·WebP 입니다. 그래서 이미지 칸에 테두리나 배경을
 * 주지 않습니다 — 주면 투명 영역이 네모로 드러나 병이 상자에 든 것처럼 보입니다.
 *
 * 사진은 브랜드 저작물이라 커밋하지 않습니다(.gitignore). 그래서 **사진이 없는
 * 환경이 정상**입니다 — 갓 clone 한 팀원의 화면이 그렇습니다. 그때 아무것도 안 그리면
 * 진열장이 텅 빈 채로 보여서 화면이 고장 난 것처럼 읽히므로, 병 실루엣을 대신 세웁니다.
 */
export function DisplayCase({
  items,
  span,
  selectedId,
  onSelect,
  isHidden,
  emptyMessage,
}: Props) {
  return (
    <div
      className="relative h-full shrink-0"
      style={{ width: `calc(var(--pitch) * ${span})` }}
      onPointerMove={followPointer}
      onPointerLeave={resetPointer}
    >
      {/*
        벽감 면들. 순서가 곧 겹치는 순서입니다 — 뒷벽과 그 조명이 먼저 깔리고,
        천장·좌우 벽·바닥이 그 가장자리를 덮고, 입구 테두리를 두른 뒤 질감이 맨 위에서
        테두리까지 덮습니다(shelf-display.css 의 .shelf-niche-grain).
        전부 장식이라 낭독기에서 뺍니다.
      */}
      <div
        aria-hidden
        className="shelf-niche absolute -inset-x-[var(--track-inset)] top-0 h-[var(--case-h)]"
      >
        <div className="shelf-face shelf-niche-back" />
        <div className="shelf-face shelf-niche-light" />
        <div className="shelf-face shelf-niche-ceiling" />
        <div className="shelf-face shelf-niche-wall-left" />
        <div className="shelf-face shelf-niche-wall-right" />
        <div className="shelf-face shelf-niche-floor" />
        <div className="shelf-face shelf-niche-bevel" />
        <div className="shelf-face shelf-niche-grain" />
      </div>

      {items.length === 0 ? (
        <p className="shelf-muted text-caption absolute inset-0 flex items-center justify-center px-2.5 text-center">
          {emptyMessage}
        </p>
      ) : (
        /*
          병 줄. 아래끝이 병 발치(--base-inset)라 병이 바닥 가운데쯤 섭니다. 이름표는
          발치 아래로 매달려 이 줄 밖으로 내려가는데, ShelfWall 창의 마스크가 그만큼
          (--hang) 아래로 열려 있습니다.
        */
        <div
          className="shelf-bottles absolute inset-x-0 top-0 bottom-[var(--base-inset)] grid items-end"
          style={{
            gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))`,
          }}
        >
          {items.map((item, at) => {
            const selected = item.shelfItemId === selectedId
            return (
              <button
                key={item.shelfItemId}
                type="button"
                aria-pressed={selected}
                onClick={() => onSelect(item)}
                title={`${item.name} · ${item.brand}`}
                // 창 밖 병. 탭 순서에서 빠지고, CSS 가 이 속성을 보고 병을
                // **투명하게** 지웁니다(.shelf-slot[inert]). 잘라내면 창 경계에
                // 걸친 그림자까지 같이 잘려 세로줄이 생깁니다.
                inert={isHidden(at)}
                // 겹치는 순위. 왼쪽 병일수록 앞이라 그 그림자가 오른쪽 병 위에
                // 떨어집니다. 층마다의 z-index 는 shelf-display.css 의
                // .shelf-slot 이 이 값으로 계산합니다.
                style={{ '--order': items.length - at } as React.CSSProperties}
                // ⚠️ 이 버튼에 z-index · transform · opacity · container-type
                // 처럼 쌓임 맥락을 만드는 걸 걸지 마세요. 그림자가 이 칸 안에
                // 갇혀 옆 병 위로 못 올라가고, 걸고 풀 때마다 그림자가 툭
                // 사라졌다 생깁니다(shelf-display.css 의 .shelf-slot).
                // 포커스 링은 버튼이 아니라 이름표에 둡니다(CSS 의 .shelf-tag).
                // 버튼 상자는 병 칸이라, 여기에 링을 두르면 매달린 이름표는
                // 링 밖에 남습니다.
                className="shelf-slot relative flex h-full min-w-0 items-end justify-center outline-none"
              >
                {/*
                  사진과 실루엣이 같은 상자 · 같은 움직임 · 같은 접지 그림자를
                  갖습니다. 실루엣만 다르면 사진이 있는 환경과 없는 환경의
                  레이아웃이 달라져서, 사진이 없는 팀원은 다른 화면을 보게 됩니다.

                  빛을 종이 위에 덮으려면 겹칠 층이 이미지와 **똑같은 상자**를
                  가져야 합니다. object-contain 은 이미지를 상자 안에 레터박스로
                  앉히므로, 상자가 어긋나면 mask-size:contain 도 어긋납니다.
                  그래서 감싸는 span 을 둡니다 — 이 span 이 곧 이미지 상자이고,
                  그림자·그늘 층은 inset-0 으로 그 상자를 그대로 물려받습니다.
                  사진 URL(--bottle)도 여기 한 번 두고 층들이 물려받습니다.

                  마우스를 올리면 커지는 효과는 이 상자가 아니라 층마다 겁니다
                  (shelf-bottle-layer). 상자에 transform 을 걸면 쌓임 맥락이 생겨
                  그림자가 옆 병 위로 못 올라갑니다.
                */}
                <span
                  style={
                    {
                      height: BOTTLE_HEIGHT,
                      '--bottle': item.thumbnailUrl
                        ? `url("${item.thumbnailUrl}")`
                        : undefined,
                    } as React.CSSProperties
                  }
                  className="relative max-w-full"
                >
                  {/*
                    바닥 그림자 두 겹. 병 아랫단 실루엣을 뒤로 눕힌 그림자를 먼저
                    깔고, 발치 바로 밑의 짙은 접지 그림자를 그 위에 얹습니다.
                    눕힌 그림자는 사진의 실루엣으로 오리는 거라 사진이 있을 때만
                    그립니다 — 없으면 오릴 모양이 없어 네모가 그대로 깔립니다.
                  */}
                  {item.thumbnailUrl && (
                    <span aria-hidden className="shelf-bottle-floor" />
                  )}
                  <span aria-hidden className="shelf-bottle-contact" />
                  {item.thumbnailUrl ? (
                    <>
                      {/*
                        벽에 지는 그림자. drop-shadow 가 아니라 같은 실루엣을
                        옆으로 민 층입니다 — 병 둘레에 고르게 번지지 않고
                        광원 반대쪽(오른쪽)에만 떨어져야 공간이 읽힙니다.
                      */}
                      <span
                        aria-hidden
                        className="shelf-bottle-layer shelf-bottle-cast"
                      />
                      <img
                        src={item.thumbnailUrl}
                        alt=""
                        className="shelf-bottle-layer shelf-bottle-img relative h-full max-w-full object-contain object-bottom"
                      />
                      {/*
                        종이 표면에 앉는 그늘. 이미지 자신을 마스크로 써서 실루엣
                        밖으로 새지 않습니다 — 이게 없으면 종이가 균일한 흰색이라
                        아무리 바깥에 그림자를 깔아도 빛을 받는 물체로 안 읽힙니다.
                      */}
                      <span
                        aria-hidden
                        className="shelf-bottle-layer shelf-bottle-lit"
                      />
                      {/* 잘린 종이의 두께 — 빛을 받는 왼쪽·위 가장자리의 흰 선 */}
                      <span
                        aria-hidden
                        className="shelf-bottle-layer shelf-bottle-rim"
                      />
                    </>
                  ) : (
                    <BottleSilhouette className="shelf-bottle-layer relative h-full max-w-full" />
                  )}
                </span>
                {/*
                  이름표. 병 발치에 줄로 매달린 종이 태그입니다.

                  병과 **같은 칸(버튼) 안에** 둡니다. 병 → 줄 → 태그가 한 덩어리로
                  벽을 따라 흐르고, 태그를 눌러도 병을 고른 것과 같습니다.

                  매달린 묶음(shelf-tag-hanger)은 줄이 병에 걸린 점(발치 가운데)을
                  회전축으로 둡니다. 벽이 옆으로 흐를 때 useTagSwing 이 이 묶음을
                  흔듭니다. 줄에 매단 장식을 더할 때도 이 묶음 안에 넣으면 같이 흔들립니다.

                  버튼의 이름(낭독기)은 이 태그의 글자가 됩니다.
                */}
                <span className="shelf-tag-hanger">
                  <span className="shelf-tag">
                    {/* 가장자리 두께 — 왼쪽 위 빛 · 오른쪽 아래 그늘(CSS 의 .shelf-tag-bevel) */}
                    <span aria-hidden className="shelf-tag-bevel" />
                    <span aria-hidden className="shelf-tag-eyelet" />
                    <span className="shelf-muted text-caption block max-w-full truncate font-serif leading-snug">
                      {item.brand}
                    </span>
                    {/*
                      두 줄에 못 박습니다. 태그 높이가 이름마다 달라지면 줄 끝에
                      매달린 태그들의 아랫선이 들쭉날쭉해집니다.
                      이름 앞의 브랜드는 뗍니다 — 윗줄에 브랜드가 이미 있습니다.
                      전체 이름은 병에 마우스를 올리면 뜨는 title 에 남습니다.
                    */}
                    <span className="text-caption line-clamp-2 font-serif leading-snug">
                      {nameWithoutBrand(item.name, item.brand)}
                    </span>
                  </span>
                  <span aria-hidden className="shelf-tag-string" />
                </span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

/**
 * 사진이 없는 향수 자리.
 *
 * 목 · 어깨 · 몸통을 한 덩어리로 그립니다. 네모 자리표시자를 쓰지 않는 이유는
 * 이 자리에 들어올 것이 배경 투명 PNG 라서입니다 — 네모를 그려 두면 사진이 들어온
 * 뒤와 없을 때의 인상이 완전히 달라집니다.
 */
function BottleSilhouette({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 64"
      preserveAspectRatio="xMidYMax meet"
      aria-hidden
      className={cn('text-[var(--niche-floor)]', className)}
    >
      <path
        fill="currentColor"
        d="M13 2h6v7c0 2 6 4 6 9v44a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V18c0-5 6-7 6-9V2Z"
      />
    </svg>
  )
}
