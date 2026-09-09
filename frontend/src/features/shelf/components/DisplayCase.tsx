import { cn } from '@/shared/lib/cn'

import type { ShelfItem } from '../types'

type Props = {
  items: ShelfItem[]
  selectedId: number | null
  onSelect: (item: ShelfItem) => void
  className?: string
}

/*
 * 이 파일만 `@theme` 색 토큰을 벗어나 임의값(#e5dcce …)을 씁니다 — 시안 재현용 예외입니다.
 *
 * 왜: Museum Archive 토큰의 바탕은 ivory #f9f6ef · bone #e8e1d6 로, 레퍼런스 시안의
 * 진열장(프레임 #e5dcce / 벽감 #ddd2c2)보다 밝고 차갑습니다. 토큰만으로 칠하면
 * 프레임과 벽감의 명도 차가 사라져 "움푹 파인 벽감"이 평평한 상자로 보입니다.
 * 시안이 확정되면 이 색들을 `@theme` 의 --color-surface-* 로 올리고 여기서 지웁니다.
 * 색을 벗어난 대신 **활자 · 간격 · 전환 · 포커스는 규약 그대로** 둡니다
 * (text-caption / 4의 배수 / duration+ease / focus-visible:ring-accent-deep).
 *
 * 글자색까지 예외인 이유: --color-ink 는 #2f2f32(회청)라 크림 바탕 위에서 차게 뜹니다.
 * 시안의 글자는 따뜻한 #2f2a24 이고(바탕 #eee7dc 위 11.57:1), 보조 글자 #6b6252 는
 * 같은 바탕에서 4.89:1 로 본문 대비 기준(4.5:1)을 넘깁니다.
 */

/**
 * 병 뒤에 깔리는 찢어진 종이 조각의 윤곽.
 *
 * 손으로 찢은 종이는 같은 모양이 두 번 나오지 않습니다. 하나만 쓰면 복사한 티가 나서
 * 다섯 벌을 두고 `index % 길이` 로 돌려 씁니다. 렌더할 때마다 무작위로 만들지 않은
 * 이유는 목록이 다시 그려질 때 종이 모양이 바뀌면 화면이 떨리기 때문입니다.
 *
 * 한 변에 점을 열 개씩 둡니다(도합 37점). 점이 적으면 찢긴 게 아니라 오려낸 것처럼
 * 각져 보입니다. 흔들림은 x 3.6% · y 2.2% 로 다르게 잡았는데, 종이가 130×250 이라
 * 같은 %라도 세로가 두 배 더 튀기 때문입니다 — 픽셀로 보면 양쪽 다 4~5px 입니다.
 */
const TORN_PAPER_CLIPS = [
  'polygon(0% 0.9%, 11% 0%, 22% 1.8%, 33% 2%, 44% 1.3%, 56% 1%, 67% 0.9%, 78% 0.9%, 89% 1.2%, 100% 0.6%, 96.9% 11%, 97.2% 22%, 99.1% 33%, 99.6% 44%, 99.7% 56%, 98.4% 67%, 99% 78%, 98.4% 89%, 96.6% 100%, 89% 99.4%, 78% 99.9%, 67% 99.1%, 56% 97.8%, 44% 99.5%, 33% 98.8%, 22% 98.9%, 11% 98.5%, 0% 97.8%, 0.1% 89%, 1.5% 78%, 2.6% 67%, 0.1% 56%, 2.4% 44%, 2.4% 33%, 0.1% 22%, 0.3% 11%, 1% 0%)',
  'polygon(0% 0.2%, 11% 0.5%, 22% 0.9%, 33% 0.1%, 44% 0.5%, 56% 0.2%, 67% 0.6%, 78% 2.1%, 89% 2%, 100% 1.6%, 99.8% 11%, 99.7% 22%, 96.5% 33%, 97.6% 44%, 96.9% 56%, 98.3% 67%, 98.3% 78%, 97.3% 89%, 98.9% 100%, 89% 98.6%, 78% 98.1%, 67% 98.6%, 56% 98.1%, 44% 97.9%, 33% 98.6%, 22% 99.6%, 11% 98.6%, 0% 99.9%, 1.7% 89%, 2.3% 78%, 0.2% 67%, 0.8% 56%, 1.5% 44%, 3% 33%, 0.5% 22%, 1.1% 11%, 0.6% 0%)',
  'polygon(0% 0.6%, 11% 0.4%, 22% 1.2%, 33% 0.8%, 44% 1.1%, 56% 0.1%, 67% 0.1%, 78% 0.3%, 89% 1%, 100% 0.4%, 98% 11%, 98.8% 22%, 98.3% 33%, 99.2% 44%, 99.8% 56%, 96.6% 67%, 99.1% 78%, 97.1% 89%, 97.6% 100%, 89% 98.3%, 78% 99.6%, 67% 99.3%, 56% 98.9%, 44% 99.1%, 33% 98.6%, 22% 98.4%, 11% 98.4%, 0% 99.3%, 1.9% 89%, 0.7% 78%, 2.4% 67%, 1.1% 56%, 1.8% 44%, 2.5% 33%, 2.3% 22%, 1.4% 11%, 3% 0%)',
  'polygon(0% 1.2%, 11% 2.1%, 22% 0.8%, 33% 1.1%, 44% 1.7%, 56% 1.7%, 67% 0.3%, 78% 1.6%, 89% 0.2%, 100% 0.3%, 96.7% 11%, 97.2% 22%, 99% 33%, 97.7% 44%, 98.4% 56%, 97.4% 67%, 97.6% 78%, 98.9% 89%, 98.3% 100%, 89% 99%, 78% 99.3%, 67% 98.2%, 56% 97.8%, 44% 99.6%, 33% 97.9%, 22% 98.3%, 11% 98.1%, 0% 99.6%, 3% 89%, 2.8% 78%, 0.1% 67%, 1.1% 56%, 1.8% 44%, 0.1% 33%, 1.9% 22%, 2.7% 11%, 0.2% 0%)',
  'polygon(0% 1.6%, 11% 0.9%, 22% 0.8%, 33% 1.1%, 44% 0.6%, 56% 1.2%, 67% 0.2%, 78% 0.3%, 89% 0.7%, 100% 1.5%, 99.9% 11%, 99.9% 22%, 99.5% 33%, 99.3% 44%, 96.8% 56%, 98.6% 67%, 97.8% 78%, 99.6% 89%, 98.6% 100%, 89% 98.6%, 78% 99.7%, 67% 99.3%, 56% 99.2%, 44% 97.8%, 33% 97.8%, 22% 99.8%, 11% 98.2%, 0% 98.9%, 0.1% 89%, 1.3% 78%, 1.5% 67%, 0.6% 56%, 2.8% 44%, 1.6% 33%, 0.1% 22%, 1% 11%, 2.7% 0%)',
]

/**
 * 병 한 칸의 폭(레퍼런스 실측 약 130px). 진열장 안의 병과 진열장 밖의 라벨이 같은 열에
 * 서야 하므로 두 목록이 이 값을 함께 씁니다. 한쪽만 고치면 라벨이 병 아래에서 어긋납니다.
 */
// 벽감 안쪽 폭이 약 1020px 이다. 칸 118 + 간격 16 = 134px 이므로 7개가 온전히 선다.
// 130 + 24 였을 때는 6개만 서서 시안(7~8개)과 어긋났다.
const CELL = 'w-[118px] shrink-0'

/**
 * 두 목록이 공유하는 가로 배열. 칸 폭(CELL)과 이 간격이 같아야 라벨이 병 바로 아래에
 * 섭니다.
 *
 * **세로 정렬은 공유하지 않습니다.** 병은 벽감 바닥에 세워야 하므로 `items-end`,
 * 라벨은 `items-start` 입니다. 라벨까지 `items-end` 로 두면 향수명이 한 줄인 칸과
 * 두 줄인 칸의 높이가 달라, 위에 있는 선택 점의 y 가 칸마다 어긋납니다 —
 * 시안의 라벨은 점부터 한 줄로 맞춰 서 있습니다.
 */
const TRACK = 'flex gap-4'

/**
 * 진열장 프레임 두께 20px + 벽감 좌우 여백 24px = 44px.
 *
 * 라벨은 진열장 **밖**에 있으므로 그 44px 를 px-11 로 되살려야 안쪽 병과 같은 x 에서
 * 시작합니다. 이 셋 중 하나만 바꾸면 라벨 열이 병에서 밀립니다.
 */
const FRAME_PAD = 'p-5'
const NICHE_PAD = 'px-6'
const LABEL_PAD = 'px-11'

/**
 * 진열장 (와이어프레임 A13 · 재디자인 시안 "미술관 진열장")
 *
 * 두꺼운 나무 프레임 안이 움푹 파인 벽감(niche)입니다. 프레임이 밝고 벽감이 한 단
 * 진하며, 벽감 위쪽에서 아래로 그늘이 집니다. 병은 벽감 바닥에 한 줄로 서고 발치에
 * 아주 짧은 접지 그림자가 깔립니다. 진열장 **밖** 아래에 같은 열로 라벨이 붙습니다.
 *
 * 치수는 레퍼런스 실측을 그대로 옮겼습니다 — 진열장 390 / 프레임 20 / 병 250×130 / 간격 24.
 *
 * 병 이미지는 **배경이 투명한 PNG** 를 전제로 합니다. 그래서 병 자리에 배경이나 테두리를
 * 주지 않습니다 — 주면 투명 영역이 네모로 드러나 병이 상자에 든 것처럼 보입니다.
 * 이미지가 없으면 종이만 남기고 칸을 비웁니다(실루엣은 이 컴포넌트의 몫이 아닙니다).
 *
 * 병과 라벨은 각각 버튼이라 어느 쪽을 눌러도 같은 향수가 선택됩니다.
 */
export function DisplayCase({ items, selectedId, onSelect, className }: Props) {
  return (
    <div className={cn('flex flex-col gap-8', className)}>
      {/*
        진열장 프레임(바깥 나무 벽). 높이를 h-[390px] 로 고정하는 이유는 시안이
        "한 화면에 스크롤 없이" 들어가야 해서입니다 — 병 수가 늘어도 진열장은
        높아지지 않고, 넘치는 병은 옆으로 잘립니다.

        바깥 그림자는 진열장이 종이 위에 놓인 것처럼 보이게 하는 최소한입니다.
        토큰 shadow-raised(파랑기 도는 회색)를 쓰면 크림 바탕 위에서 회색 얼룩으로
        보여서, 같은 흙빛 계열 rgba 로 직접 깝니다.
      */}
      <div
        className={cn(
          'rounded-card h-[390px] bg-[#e5dcce]',
          'shadow-[0_18px_38px_-26px_rgba(90,75,58,0.55)]',
          FRAME_PAD,
        )}
      >
        {/*
          벽감. 프레임보다 한 단 진한 면 위에 inset 그림자 두 겹으로 깊이를 냅니다 —
          위에서 떨어지는 짙은 그늘과 바닥에서 올라오는 옅은 그늘입니다.

          이 그림자만 임의값인 이유: @theme 의 shadow-* 는 전부 "떠 있는 높이"를
          나타내는 바깥 그림자라 안으로 파는 값이 없습니다. 진열장 한 곳에만 필요해서
          토큰을 늘리지 않았습니다. 진열장이 두 번째로 생기면 --shadow-sunken 으로 올립니다.

          `overflow-x-hidden` 이 아니라 `overflow-x-clip` 인 이유: 한 축만 hidden 으로
          두면 반대 축이 visible 로 남지 못하고 auto 로 계산됩니다(CSS Overflow 3).
          그러면 세로로도 잘리는 스크롤 상자가 되어 포커스 링(ring 은 box-shadow 라
          스크롤 영역에 포함되지 않습니다)의 위아래가 잘려 나갑니다. clip 은 반대 축을
          visible 로 둔 채 가로만 자릅니다. 넘치는 병에 화살표를 달지 않는 이유는
          하단 페이저(CollectionFooterStrip)가 이미 그 역할을 하기 때문입니다.

          잘리는 경계는 padding box 라, 종이 조각이 칸 밖으로 나온 4px(-inset-1)는
          벽감의 좌우 여백 24px 안에 들어와 잘리지 않습니다.

          `rounded-[3px]` 는 rounded-card(6px)의 절반입니다. 벽감은 나무를 파낸 자리라
          모서리가 거의 각져야 하는데, 프레임과 같은 6px 을 주면 20px 여백 안쪽에 둥근
          상자가 하나 더 얹힌 것처럼 보여 "파인 자리"로 읽히지 않습니다. 0 으로 두면
          이번엔 모서리 계단이 드러나서, 그것만 지우는 최소값으로 3px 을 씁니다.
        */}
        <div
          className={cn(
            'relative flex h-full items-end overflow-x-clip rounded-[3px] bg-[#ddd2c2]',
            'shadow-[inset_0_28px_48px_-20px_rgba(90,75,58,0.30),inset_0_-10px_24px_-16px_rgba(90,75,58,0.16)]',
            NICHE_PAD,
          )}
        >
          {/*
            벽감 바닥면. 위 그늘과 반대로 아래쪽만 옅게 밝혀서 병이 허공이 아니라
            바닥에 닿아 보이게 합니다. 장식이라 aria-hidden 입니다.

            색이 임의값인 이유: 이건 아래 종이(#fdfbf7)에 반사돼 올라오는 빛이라 같은
            색의 40% 로 잡았습니다. `from-white/40` 으로 바꾸면 순백이라 크림 바탕
            위에서 푸르게 뜨고, 종이와 다른 색이 되어 반사광으로 읽히지 않습니다.
          */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-[rgba(253,251,247,0.40)] to-transparent"
          />

          <ul className={cn('relative w-full items-end', TRACK)}>
            {items.map((item, index) => {
              const selected = selectedId === item.shelfItemId

              return (
                <li key={item.shelfItemId} className={cn('relative', CELL)}>
                  <button
                    type="button"
                    aria-pressed={selected}
                    onClick={() => onSelect(item)}
                    title={`${item.name} · ${item.brand}`}
                    className={cn(
                      'relative block h-[250px] w-full',
                      'rounded-card focus-visible:ring-accent-deep outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
                      'transition-[opacity,transform] duration-200 ease-out',
                      selected
                        ? '-translate-y-1 opacity-100'
                        : 'opacity-75 hover:opacity-100',
                    )}
                  >
                    {/*
                      찢어진 종이 조각. -inset-1(4px)로 병에 바짝 붙입니다 — 여백이
                      넓으면 병 뒤에 깐 종이가 아니라 종이 위에 얹은 카드로 보입니다.

                      clip-path 를 클래스가 아니라 style 로 넣는 이유: 값이 배열에서
                      꺼내 쓰는 데이터라 클래스 문자열로는 표현할 수 없습니다.

                      #fdfbf7 은 벽감(#ddd2c2)보다 훨씬 밝은, 흰색에 가까운 종이색입니다.
                      병 버튼 안에 두어 선택 시 병과 같이 4px 떠오르게 합니다 —
                      병만 뜨고 종이가 남으면 종이에서 병이 뽑힌 것처럼 보입니다.
                    */}
                    <span
                      aria-hidden
                      style={{
                        clipPath:
                          TORN_PAPER_CLIPS[index % TORN_PAPER_CLIPS.length],
                      }}
                      className="pointer-events-none absolute -inset-1 bg-[#fdfbf7]"
                    />

                    {/*
                      relative 가 필요합니다. 종이가 absolute 라서, 이미지가 배치되지
                      않은 채로 있으면 종이가 병을 덮습니다.

                      칸 크기는 전부 같고, 병이 달라 보이는 것은 사진의 가로세로
                      비율 때문입니다(object-contain · object-bottom 으로 바닥 정렬).
                    */}
                    {item.thumbnailUrl && (
                      <img
                        src={item.thumbnailUrl}
                        alt=""
                        className="relative size-full object-contain object-bottom"
                      />
                    )}
                    <span className="sr-only">
                      {item.name} {item.brand}
                    </span>
                  </button>

                  {/*
                    접지 그림자. 병 버튼보다 **뒤 순서**에 두어 종이 위로 떨어지게
                    합니다 — 앞에 두면 종이(-inset-1)에 가려 보이지 않습니다.
                    골랐을 때 병이 4px 떠오르며 벌어지는 틈도 이 그림자가 메웁니다.

                    임의값 셋을 쓴 이유입니다.
                    · `rounded-[50%]` — rounded-full 은 9999px 이라 높이 8px 인 이
                      상자에서는 위아래가 잘린 알약이 됩니다. 접지 그림자는 타원이어야
                      하고, 두 축을 함께 따라가는 반지름은 % 뿐입니다.
                    · `bg-[rgba(90,75,58,0.18)]` — 프레임 바깥 그림자·벽감 안 그늘과
                      같은 흙빛입니다. 이 파일의 그림자를 한 색으로 묶으려고 맞췄습니다.
                    · `blur-[2px]` — 토큰의 가장 작은 blur-xs 가 4px 이라, 높이 8px
                      짜리 그림자가 병 발치 밖까지 번집니다.
                  */}
                  <span
                    aria-hidden
                    className="pointer-events-none absolute inset-x-4 bottom-0 h-2 rounded-[50%] bg-[rgba(90,75,58,0.18)] blur-[2px]"
                  />
                </li>
              )
            })}
          </ul>
        </div>
      </div>

      {/*
        라벨 줄. 진열장 바깥이라 안쪽 여백(프레임 20 + 벽감 24 = 44)을 px-11 로 되살려
        병과 열을 맞춥니다. 진열장이 병을 자르는 지점에서 라벨도 같이 잘려야 하므로
        여기도 overflow-x-clip 입니다.
      */}
      <ul className={cn('items-start overflow-x-clip', TRACK, LABEL_PAD)}>
        {items.map((item) => {
          const selected = selectedId === item.shelfItemId

          return (
            <li key={item.shelfItemId} className={CELL}>
              <button
                type="button"
                aria-pressed={selected}
                onClick={() => onSelect(item)}
                className="rounded-card focus-visible:ring-accent-deep flex w-full flex-col items-center gap-2 outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
              >
                {/*
                  선택 표시. 점만으로 뜻을 전하지 않도록 aria-pressed 가 함께 있습니다.

                  고르지 않은 점의 테두리 #b9ab95 는 바탕(#eee7dc) 위 1.83:1 로 연합니다.
                  글자가 아니고, 켜짐/꺼짐은 aria-pressed 와 채워진 점(11.57:1)이 이미
                  전하므로 이 원은 자리표시에 가깝습니다 — 여기서 더 진하게 하면 시안에
                  없던 점선 격자가 라벨 줄에 깔립니다.
                */}
                <span
                  aria-hidden
                  className={cn(
                    'size-2 rounded-full transition-colors duration-120 ease-out',
                    selected
                      ? 'bg-[#2f2a24]'
                      : 'border border-[#b9ab95] bg-transparent',
                  )}
                />
                {/* 브랜드명은 한 줄로 줄입니다. 줄 수가 들쭉날쭉하면 라벨 줄이 어긋납니다 */}
                <span className="text-caption w-full truncate text-center text-[#6b6252]">
                  {item.brand}
                </span>
                <span className="text-caption line-clamp-2 w-full text-center text-[#2f2a24]">
                  {item.name}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
