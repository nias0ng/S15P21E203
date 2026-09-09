import { cn } from '@/shared/lib/cn'

import type { ShelfItem } from '../types'

type Props = {
  items: ShelfItem[]
  selectedId: number | null
  onSelect: (item: ShelfItem) => void
  className?: string
}

/**
 * 병 뒤에 깔리는 종이 조각의 윤곽.
 *
 * 손으로 찢은 종이는 같은 모양이 두 번 나오지 않습니다. 하나만 쓰면 복사한 티가
 * 나서 네 벌을 두고 `index % 길이` 로 돌려 씁니다. 무작위로 만들지 않은 이유는
 * 렌더할 때마다 종이 모양이 바뀌면 목록이 다시 그려질 때 화면이 떨리기 때문입니다.
 *
 * 각 변에 점을 예닐곱 개씩 두고 1~4% 안에서만 흔듭니다. 더 크게 흔들면 찢긴 게
 * 아니라 오려낸 것처럼 보입니다.
 */
const TORN_PAPER_CLIPS = [
  'polygon(1% 3%, 14% 0%, 29% 4%, 45% 1%, 61% 4%, 76% 0%, 91% 3%, 100% 7%, 97% 21%, 100% 36%, 98% 51%, 100% 66%, 97% 81%, 100% 95%, 87% 98%, 72% 100%, 57% 97%, 42% 100%, 27% 97%, 12% 100%, 2% 96%, 0% 82%, 3% 67%, 0% 52%, 2% 37%, 0% 22%, 3% 10%)',
  'polygon(3% 0%, 17% 4%, 32% 1%, 48% 4%, 64% 0%, 79% 3%, 94% 0%, 100% 11%, 98% 26%, 100% 41%, 97% 56%, 100% 70%, 98% 85%, 100% 97%, 85% 100%, 70% 97%, 55% 100%, 40% 98%, 25% 100%, 10% 97%, 0% 93%, 3% 78%, 0% 63%, 2% 48%, 0% 33%, 3% 18%, 0% 6%)',
  'polygon(0% 4%, 15% 1%, 30% 5%, 46% 0%, 62% 3%, 77% 0%, 93% 4%, 100% 9%, 98% 24%, 100% 39%, 97% 54%, 100% 69%, 98% 84%, 100% 96%, 88% 100%, 73% 96%, 58% 100%, 43% 97%, 28% 100%, 13% 96%, 1% 99%, 0% 85%, 2% 70%, 0% 55%, 3% 40%, 0% 25%, 2% 12%)',
  'polygon(2% 2%, 18% 0%, 33% 3%, 49% 0%, 65% 4%, 80% 1%, 96% 3%, 100% 13%, 97% 28%, 100% 43%, 98% 58%, 100% 73%, 97% 88%, 100% 98%, 84% 96%, 69% 100%, 54% 96%, 39% 100%, 24% 97%, 9% 100%, 0% 95%, 2% 80%, 0% 65%, 3% 50%, 0% 35%, 2% 20%, 0% 8%)',
]

/**
 * 병 한 칸의 폭. 진열장 안의 병과 진열장 밖의 라벨이 같은 열에 서야 하므로
 * 두 목록이 이 값을 함께 씁니다. 한쪽만 고치면 라벨이 병 아래에서 어긋납니다.
 */
const CELL = 'w-24 shrink-0'

/**
 * 두 목록이 공유하는 가로 배열. gap 도 같은 곳에서 정합니다.
 *
 * `overflow-x-hidden` 이 아니라 `overflow-x-clip` 인 이유: 한 축만 hidden 으로 두면
 * 반대 축이 `visible` 로 남지 못하고 `auto` 로 계산됩니다(CSS Overflow 3). 그러면
 * 세로로도 잘리는 스크롤 상자가 되어 포커스 링(ring 은 box-shadow 라 스크롤 영역에
 * 포함되지 않습니다)의 위아래가 잘려 나갑니다 — 라벨 버튼의 링이 좌우 변만 남습니다.
 * `clip` 은 반대 축을 visible 로 둔 채 가로만 자릅니다. 스크롤바가 없는 것은 같습니다.
 */
const TRACK = 'flex gap-6 overflow-x-clip'

/** 진열장 안쪽 좌우 여백. 진열장 밖의 라벨 줄도 같은 값을 씁니다. */
const TRACK_PADDING_X = 'px-8'

/**
 * 진열장 (와이어프레임 A13 · 목업 "미술관 진열장")
 *
 * 움푹 파인 나무 상자 안에 병이 한 줄로 서 있고, 병마다 뒤에 찢어진 종이 조각이
 * 깔립니다. 상자 아래에는 병과 같은 열로 라벨이 붙습니다.
 *
 * 병 이미지는 **배경이 투명한 PNG** 를 전제로 합니다. 그래서 병 자리에 배경이나
 * 테두리를 주지 않습니다 — 주면 투명 영역이 네모로 드러나 병이 상자에 든 것처럼
 * 보입니다. 이미지가 없으면 칸을 비워 둡니다(실루엣은 이 컴포넌트의 몫이 아닙니다).
 *
 * 병과 라벨은 각각 버튼이라 어느 쪽을 눌러도 같은 향수가 선택됩니다.
 */
export function DisplayCase({ items, selectedId, onSelect, className }: Props) {
  return (
    <div className={cn('flex flex-col gap-3', className)}>
      {/*
        진열장 바깥 상자. inset 그림자 두 겹으로 안쪽을 파냅니다 — 위에서 떨어지는
        짙은 그늘과 바닥에서 올라오는 옅은 그늘입니다.

        이 그림자만 임의값인 이유: @theme 의 shadow-* 는 전부 "떠 있는 높이"를
        나타내는 바깥 그림자라 안으로 파는 값이 없습니다. 진열장 한 곳에만
        필요해서 토큰을 늘리지 않고 여기서 끝냅니다. 진열장이 두 번째로 생기면
        그때 --shadow-sunken 으로 올립니다.

        overflow-hidden 은 아래 안쪽 벽 선이 둥근 모서리 밖으로 삐져나오지 않게
        합니다.
      */}
      <div
        className={cn(
          'border-line bg-surface-sunken rounded-card overflow-hidden border',
          'shadow-[inset_0_18px_36px_-18px_rgba(47,47,50,0.30),inset_0_-8px_20px_-12px_rgba(47,47,50,0.14)]',
        )}
      >
        {/* 안쪽 벽 두께 — 바깥 테두리 바로 안에 밝은 선을 한 겹 더 둡니다 */}
        <div
          className={cn('border-line-soft border-t pt-8 pb-4', TRACK_PADDING_X)}
        >
          {/*
            flex 로 둔 이유는 배치가 아니라 마진 상쇄를 막기 위해서입니다.
            아래 목록이 음수 마진을 쓰는데, 보통의 블록 부모라면 그 마진이 부모와
            상쇄되면서 진열장 위아래 여백이 8px 씩 딸려 올라갑니다.
          */}
          <div className="relative flex flex-col">
            {/* 바닥 바로 위의 옅은 빛. 병이 바닥에 닿아 보이게 하는 장식입니다 */}
            <div
              aria-hidden
              className="from-surface-card/40 pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t to-transparent"
            />

            {/*
              -mx-2 px-2 는 여백을 바꾸지 않고 가로로 잘라내는 경계만 8px 넓히는
              장치입니다. 종이 조각이 칸 밖으로 8px 나가 있어서(-inset-x-2) 그냥 두면
              양 끝 종이가 잘립니다. 음수 마진이 자리를 되돌려주므로 병의 가로 위치는
              그대로입니다.

              세로는 건드리지 않습니다 — TRACK 이 clip 이라 세로는 잘리지 않고,
              선택된 병이 올라간 만큼(-translate-y-1)과 포커스 링은 위쪽 pt-8 안에 듭니다.

              넘치는 병을 스크롤로 보여주지 않는 이유: 진열장은 보이는 만큼만
              보여주고 넘치는 병은 라벨 줄에서 같이 잘립니다.
            */}
            <ul className={cn('relative -mx-2 min-h-40 items-end px-2', TRACK)}>
              {items.map((item, index) => {
                const selected = selectedId === item.shelfItemId

                return (
                  <li key={item.shelfItemId} className={cn('relative', CELL)}>
                    {/*
                      찢어진 종이 조각. 병보다 조금 크게 깔아 병이 종이 위에
                      서 있는 것처럼 보이게 합니다.

                      clip-path 를 클래스가 아니라 style 로 넣는 이유: 값이 배열에서
                      꺼내 쓰는 데이터라 클래스 문자열로는 표현할 수 없습니다.

                      shadow-raised 는 clip-path 에 함께 잘려 거의 드러나지 않습니다.
                      그래도 남긴 것은 clip-path 를 그리지 못하는 환경에서 종이가
                      맨 흰 사각형으로만 남지 않게 하려는 것입니다.
                    */}
                    <span
                      aria-hidden
                      style={{
                        clipPath:
                          TORN_PAPER_CLIPS[index % TORN_PAPER_CLIPS.length],
                      }}
                      className="bg-surface-card shadow-raised pointer-events-none absolute -inset-x-2 top-2 bottom-0"
                    />

                    {/*
                      relative 가 필요합니다. 종이 조각이 absolute 라서, 병 버튼이
                      배치되지 않은 채로 있으면 종이가 병 위에 그려집니다.
                    */}
                    <button
                      type="button"
                      aria-pressed={selected}
                      onClick={() => onSelect(item)}
                      title={`${item.name} · ${item.brand}`}
                      className={cn(
                        'relative block h-40 w-full',
                        'rounded-card focus-visible:ring-accent-deep outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
                        'transition-[opacity,transform] duration-200 ease-out',
                        selected
                          ? '-translate-y-1 opacity-100'
                          : 'opacity-70 hover:opacity-100',
                      )}
                    >
                      {/*
                        이미지가 없으면 아무것도 그리지 않고 칸만 남깁니다.
                        칸 크기는 전부 같고, 병이 달라 보이는 것은 사진의
                        가로세로 비율 때문입니다(object-contain).
                      */}
                      {item.thumbnailUrl && (
                        <img
                          src={item.thumbnailUrl}
                          alt=""
                          className="size-full object-contain object-bottom"
                        />
                      )}
                      <span className="sr-only">
                        {item.name} {item.brand}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>

          {/* 선반 바닥 — 병이 서는 선 */}
          <div aria-hidden className="border-line border-t" />
        </div>
      </div>

      {/*
        라벨 줄. 진열장 바깥이라 안쪽 여백(px-8)을 똑같이 주고, 진열장 테두리
        1px 만큼 투명 테두리를 더해 병과 라벨의 열을 정확히 맞춥니다.
      */}
      <ul className={cn('border-x border-transparent', TRACK, TRACK_PADDING_X)}>
        {items.map((item) => {
          const selected = selectedId === item.shelfItemId

          return (
            <li key={item.shelfItemId} className={CELL}>
              <button
                type="button"
                aria-pressed={selected}
                onClick={() => onSelect(item)}
                className="rounded-card focus-visible:ring-accent-deep flex w-full flex-col items-center gap-1 outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
              >
                {/* 선택 표시. 점만으로 뜻을 전하지 않도록 aria-pressed 가 함께 있습니다 */}
                <span
                  aria-hidden
                  className={cn(
                    'size-2 rounded-full transition-colors duration-120 ease-out',
                    selected ? 'bg-ink' : 'border-line border bg-transparent',
                  )}
                />
                {/* 브랜드명은 한 줄로 줄입니다. 줄 수가 들쭉날쭉하면 라벨 줄이 어긋납니다 */}
                <span className="text-ink-muted text-caption w-full truncate text-center">
                  {item.brand}
                </span>
                <span className="text-ink text-caption line-clamp-2 w-full text-center">
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
