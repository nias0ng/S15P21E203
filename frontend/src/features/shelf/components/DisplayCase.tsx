import { memo } from 'react'

import { BottleSilhouette } from '@/shared/ui/BottleSilhouette'

import { nameWithoutBrand, slotView } from '../lib'
import type { ShelfItem } from '../types'

type Props = {
  items: ShelfItem[]
  /** 벽감이 차지하는 칸 수. 비어 있어도 1 입니다 */
  span: number
  selectedId: number | null
  /** 병을 눌렀을 때. 벽감이 memo 라 늘 같은 함수를 받아야 합니다(ShelfWall) */
  onSelect: (item: ShelfItem) => void
  /*
   * 멈춘 창의 경계 — 이 벽감 첫 칸을 0 으로 센 칸 순서입니다(lib.ts 의 slotView).
   * 함수가 아니라 수로 받습니다. ShelfWall 이 −2 ~ 칸 수 + 1 로 좁혀 넘겨서, 창에서 먼 벽감은
   * 창이 옮겨 가도 같은 값을 받습니다.
   */
  /** 창 왼쪽 끝 칸 */
  winFrom: number
  /** 창에 걸치는 칸의 끝. 이 칸부터 창 밖입니다 */
  winTo: number
  /** 창 오른쪽 끝(패널 밑)에 걸린 칸. 걸린 칸이 없으면 winTo 와 같습니다 */
  edgeFrom: number
  /*
   * 첫 화면 병 — 크기를 잰 첫 그림에서 창에 걸친 칸과 그때 고른 병입니다. 칸 순서는 창 경계와 같이
   * 이 벽감 첫 칸이 0 이고, ShelfWall 이 한 번 정해 다시 바꾸지 않습니다.
   */
  /** 첫 화면의 첫 칸 */
  priorityFrom: number
  /** 첫 화면의 끝 칸(이 칸까지 첫 화면입니다) */
  priorityTo: number
  /** 첫 화면을 그릴 때 고른 병 */
  priorityId: number | null
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
 * 벽감 하나 — 분류 하나의 병들이 서는 자리 (와이어프레임 A13 재디자인 시안)
 *
 * 벽을 파낸 벽감에 향수병을 세워 둡니다. 벽감은 **면 단위로** 나뉘어 있습니다 —
 * 뒷벽 · 천장 · 좌우 벽 · 바닥 · 입구 테두리가 각자 한 겹이고, 면마다의 모양과
 * 명도는 `../shelf-display.css` 가 그립니다. 배치·간격은 여기 Tailwind 입니다.
 *
 * **벽감 폭은 병 수만큼입니다.** 칸 하나가 병 하나이고, 이 상자의 폭이 곧 뒷벽 폭입니다.
 * 좌우 옆벽과 입구 테두리(--track-inset)는 상자 밖으로 삐져나와 이웃한 이름표 벽 칸에
 * 걸칩니다 — ShelfWall 이 이름표 벽을 plaqueSpan 칸 폭(가리지 않는 칸이 다섯 이상이면 두 칸 기둥,
 * 휴대폰처럼 좁으면 한 칸)으로 두고, 그 가장자리를 옆벽 자리로 비워 둡니다. 그래서 벽 한 줄이
 * 전부 같은 칸 격자 위에 서고, 칸 단위로 끊어 멈출 수 있습니다.
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
 *
 * **memo 입니다.** 벽이 설 때마다 ShelfWall 이 다시 그려지는데, 받는 값이 전부 수 · 문자열 · 늘 같은
 * 함수라 창 경계가 바뀌지 않은 벽감(창에서 먼 벽감)은 다시 그리지 않습니다. 벽감 하나에 병 층이
 * 수십 겹이라, 설 때마다 벽 전체를 다시 그리면 그 프레임이 늘어져 병이 깜빡였습니다.
 */
export const DisplayCase = memo(function DisplayCase({
  items,
  span,
  selectedId,
  onSelect,
  winFrom,
  winTo,
  edgeFrom,
  priorityFrom,
  priorityTo,
  priorityId,
}: Props) {
  return (
    <div
      className="relative h-full shrink-0"
      style={{ width: `calc(var(--pitch) * ${span})` }}
    >
      {/*
        향수가 없으면 이 칸은 비워 둡니다. "비어 있다" 는 한 칸 폭에 적으면 벽감 첫머리에 붙은 작은
        글씨가 되어, 벽이 벽감 한가운데에 따로 세웁니다(ShelfWall 의 빈 분류 안내).
      */}
      {items.length > 0 && (
        /*
          병 줄. 아래끝이 병 발치(--base-inset)라 병이 바닥 가운데쯤 섭니다. 이름표는
          선반 아랫면(벽감 아래끝) 아래로 매달려 이 줄 밖으로 내려가는데, ShelfWall 창의
          마스크가 그만큼(--hang) 아래로 열려 있습니다.
        */
        <div
          className="shelf-bottles absolute inset-x-0 top-0 bottom-[var(--base-inset)] grid items-end"
          style={{
            gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))`,
          }}
        >
          {items.map((item, at) => {
            const selected = item.shelfItemId === selectedId
            const { hidden, edge } = slotView(at, winFrom, winTo, edgeFrom)
            const firstScreen =
              (at >= priorityFrom && at <= priorityTo) ||
              item.shelfItemId === priorityId
            return (
              <button
                key={item.shelfItemId}
                type="button"
                aria-pressed={selected}
                onClick={() => onSelect(item)}
                title={`${item.name} · ${item.brand}`}
                // 창 밖 병과 창 끝에 걸친 병. 탭 순서와 낭독기에서 빼고 누르지도 못합니다 —
                // 걸친 병은 패널 밑 · 화면 여백의 페이드에 반쯤 가려 있어 거기로 포커스가 가지 않게.
                // 걸친 병을 지우지는 않습니다 — 창 마스크의 페이드를 따라 걸친 채 비칩니다
                inert={hidden || edge}
                // 겹치는 순위. 왼쪽 병일수록 앞이라 그 그림자가 오른쪽 병 위에
                // 떨어집니다. 층마다의 z-index 는 shelf-display.css 의
                // .shelf-slot 이 이 값으로 계산합니다.
                style={{ '--order': items.length - at } as React.CSSProperties}
                // ⚠️ 이 버튼에 z-index · transform · opacity · container-type
                // 처럼 쌓임 맥락을 만드는 걸 걸지 마세요. 그림자가 이 칸 안에
                // 갇혀 옆 병 위로 못 올라가고, 걸고 풀 때마다 그림자가 툭
                // 사라졌다 생깁니다(shelf-display.css 의 .shelf-slot).
                // 포커스 링은 버튼이 아니라 이름표에 둡니다(CSS 의 .shelf-tag-edge).
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

                  사진이 있는 상자에는 data-photo 를 겁니다. 사진을 풀 때까지(data-ready 가
                  붙기 전) CSS 가 병 층 · 바닥 그림자를 투명하게 두었다가 한 번만 드러냅니다.
                  data-ready 는 React 가 아니라 useBottlePreload 가 DOM 에 직접 겁니다.
                */}
                <span
                  data-photo={item.thumbnailUrl ? '' : undefined}
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
                        // 사진은 전부 처음부터 받습니다 — lazy 면 벽이 흐르는 중에 창 끝에서
                        // 받기 시작해 병이 빈 채로 들어옵니다. 첫 화면 병은 먼저 받아 그 자리에서
                        // 풀고, 나머지는 뒤에 받아 따로 풉니다(useBottlePreload 가 가까운 병부터
                        // 차례로 풀어 둡니다). 처음 그린 뒤로는 바꾸지 않습니다.
                        loading="eager"
                        fetchPriority={firstScreen ? 'high' : 'low'}
                        decoding={firstScreen ? 'sync' : 'async'}
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
                    <BottleSilhouette className="shelf-bottle-layer relative h-full max-w-full text-[var(--niche-floor)]" />
                  )}
                </span>
                {/*
                  이름표. 선반 아랫면(벽감 아래끝)에 꼰 줄로 매달린 표 모양 종이 태그입니다.

                  병과 **같은 칸(버튼) 안에** 둡니다. 병 → 줄 → 태그가 한 덩어리로
                  벽을 따라 흐르고, 태그를 눌러도 병을 고른 것과 같습니다.

                  선반 고리(shelf-tag-hook)는 선반에 박혀 있어 흔들리지 않습니다. 매달린
                  묶음(shelf-tag-hanger)만 줄이 고리에 걸린 점(벽감 아래끝, 병 칸 가운데)을
                  회전축으로 둡니다. 벽이 옆으로 흐를 때 useTagSwing 이 이 묶음을 흔듭니다.
                  줄에 매단 장식을 더할 때도 이 묶음 안에 넣으면 같이 흔들립니다.

                  종이는 여러 겹입니다 — 그림자 · 종이 · 가장자리 · 안쪽 테두리선 · 아일릿.
                  모양(파낸 모서리)은 ShelfWall 이 넣는 clip-path 윤곽이고(lib.ts 의
                  "이름표 태그의 모양"), 칠은 shelf-display.css 가 합니다.

                  글자는 브랜드와 한글 이름 두 가지만 적습니다. 예전에는 영문 이름 · 부향률까지
                  네 줄이었는데 이름표가 병보다 눈에 띄어 간소화했습니다.
                  아주 낮은 태그에서는 이름을 한 줄로 줄입니다(ShelfWall 이 트랙에 거는
                  data-tag-detail).

                  버튼의 이름(낭독기)은 "한글 브랜드 + 한글 이름" 입니다.
                */}
                <span aria-hidden className="shelf-tag-hook" />
                <span className="shelf-tag-hanger">
                  <span className="shelf-tag">
                    <span aria-hidden className="shelf-tag-shadow" />
                    <span aria-hidden className="shelf-tag-paper" />
                    <span aria-hidden className="shelf-tag-edge" />
                    <span aria-hidden className="shelf-tag-line" />
                    <span aria-hidden className="shelf-tag-eyelet" />
                    <span className="shelf-tag-brand font-serif font-semibold">
                      {item.brand}
                    </span>
                    {/*
                      낭독기 이름에서 브랜드와 이름 사이를 띄웁니다. 태그가 grid 라 공백만
                      있는 글자 조각은 화면에 자리를 차지하지 않습니다.
                    */}{' '}
                    <span className="shelf-tag-names">
                      {/*
                        두 줄까지만 적습니다(아주 낮은 태그는 한 줄 — 줄 수는 CSS 의
                        .shelf-tag-name). 태그 높이가 못 박혀 있어 넘치면 아래 줄이
                        태그 밖으로 밀려납니다. 이름 앞의 브랜드는 뗍니다 — 윗줄에
                        브랜드가 이미 있습니다. 전체 이름은 병에 마우스를 올리면 뜨는
                        title 에 남습니다.
                      */}
                      {/*
                        한국어 이름이 오면 그것을, 아직 안 오면 영문 이름을 적습니다
                        (`ShelfItem.nameKo` 주석 — 목록 응답에 추가를 요청해 둔 값입니다).
                        브랜드를 떼는 일은 영문 이름에만 뜻이 있습니다 — 한국어 이름은
                        앞에 브랜드가 붙어 오지 않습니다.
                      */}
                      <span className="shelf-tag-name font-serif font-semibold">
                        {item.nameKo ?? nameWithoutBrand(item.name, item.brand)}
                      </span>
                    </span>
                  </span>
                  {/* 태그보다 뒤에 둡니다 — 아일릿 구멍까지 줄이 종이 앞으로 지나갑니다 */}
                  <span aria-hidden className="shelf-tag-cord" />
                </span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
})

/**
 * 사진이 없는 향수 자리.
 *
 * 목 · 어깨 · 몸통을 한 덩어리로 그립니다. 네모 자리표시자를 쓰지 않는 이유는
 * 이 자리에 들어올 것이 배경 투명 PNG 라서입니다 — 네모를 그려 두면 사진이 들어온
 * 뒤와 없을 때의 인상이 완전히 달라집니다.
 */
