import { cn } from '@/shared/lib/cn'

import type { ShelfItem } from '../types'

type Props = {
  items: ShelfItem[]
  selectedId: number | null
  onSelect: (item: ShelfItem) => void
  className?: string
}

/**
 * 진열장에 한 번에 서는 병의 수. 시안 실측입니다.
 *
 * 늘리면 병이 좁아지고 줄이면 벽감이 비어 보입니다. 무엇보다 벽감 높이(329px)와
 * 병 폭이 이 수를 전제로 맞춰져 있어서, 바꾸려면 아래 치수들도 함께 봐야 합니다.
 */
const SLOTS = 7

/*
 * 병마다 이미지 높이가 다릅니다. 실제 향수병은 브랜드마다 비율이 달라서, 전부 같은
 * 높이로 세우면 상품 카탈로그처럼 보이고 진열장 느낌이 사라집니다.
 * 시안이 병별로 잡아 둔 값을 그대로 가져왔습니다.
 *
 * ⚠️ **칸(버튼)은 전부 같은 크기입니다.** 달라지는 것은 칸 안에서 병 이미지가 차지하는
 * 높이뿐이라, 칸이 들쭉날쭉해 보이던 이전 문제와는 다른 이야기입니다.
 *
 * 순서가 아니라 향수 id 로 고르는 이유: 순서로 고르면 어느 장을 넘겨도 일곱 병의
 * 실루엣이 똑같이 반복돼 장이 넘어간 것을 눈치채기 어렵습니다.
 */
const BOTTLE_HEIGHTS = [219, 235, 210, 257, 252, 232, 224] as const

/**
 * 진열장 (와이어프레임 A13 재디자인 시안)
 *
 * 벽을 파낸 벽감에 향수병을 세워 둡니다. 벽감의 원근·그림자와 병 뒤 찢어진
 * 종이는 `../shelf-display.css` 가 그립니다 — clip-path 와 6겹 그림자를 유틸리티로
 * 옮기면 한 줄이 200자를 넘어 읽을 수 없어서 모양만 CSS 로 뺐습니다.
 * 배치·간격은 여기 Tailwind 입니다.
 *
 * 병 이미지는 배경이 투명한 PNG·WebP 입니다. 그래서 이미지 칸에 테두리나 배경을
 * 주지 않습니다 — 주면 투명 영역이 네모로 드러나 병이 상자에 든 것처럼 보입니다.
 *
 * **한 번에 일곱 병만 세웁니다.** 진열장은 실제 선반이라 칸 수가 정해져 있고, 걸러진
 * 향수가 25개든 100개든 벽감 크기는 그대로여야 합니다. 넘치는 병은 화면(pages) 아래
 * 넘김 단추로 넘겨 봅니다 — 고른 병이 늘 보이도록 **선택이 들어 있는 일곱 칸**을
 * 잘라서 보여주는 방식이라, 선택이 여덟 번째로 넘어가는 순간 진열장도 다음 일곱 칸으로
 * 함께 넘어갑니다. 그래서 넘김 단추를 여기 따로 두지 않았습니다.
 */
export function DisplayCase({ items, selectedId, onSelect, className }: Props) {
  const selectedIndex = items.findIndex(
    (item) => item.shelfItemId === selectedId,
  )
  // 선택이 없으면(칩을 막 바꾼 직후) 첫 칸을 기준으로 봅니다.
  const anchor = selectedIndex >= 0 ? selectedIndex : 0
  const pageStart = Math.floor(anchor / SLOTS) * SLOTS
  const shown = items.slice(pageStart, pageStart + SLOTS)

  return (
    <section className={cn('min-w-0', className)} aria-label="향수 진열장">
      {/* 벽감. 높이는 시안 실측값(329px)입니다 */}
      <div className="shelf-niche relative h-[329px] overflow-hidden">
        {shown.length === 0 ? (
          <p className="shelf-muted text-caption absolute inset-0 flex items-center justify-center">
            조건에 맞는 향수가 없습니다
          </p>
        ) : (
          /*
            칸 수를 항상 7로 못 박습니다. 남은 병 수에 맞춰 칸을 늘리면 마지막 장에서
            병이 갑자기 커지면서, 같은 향수가 장을 넘길 때마다 다른 크기로 보입니다.
            모자란 칸은 빈 자리로 남습니다 — 선반에 빈 칸이 있는 게 맞는 모습입니다.
          */
          <div className="absolute inset-x-10 top-9 bottom-0 grid grid-cols-7 items-end">
            {shown.map((item) => (
              <button
                key={item.shelfItemId}
                type="button"
                aria-pressed={item.shelfItemId === selectedId}
                onClick={() => onSelect(item)}
                title={`${item.name} · ${item.brand}`}
                className={cn(
                  'relative flex h-[292px] min-w-0 items-end justify-center',
                  'rounded-card outline-none focus-visible:ring-2 focus-visible:ring-[var(--shelf-ink)]',
                )}
              >
                {/* 병 뒤 찢어진 종이. 모양은 CSS, 크기·위치는 여기서 */}
                <span
                  aria-hidden
                  className="shelf-torn pointer-events-none absolute bottom-0 h-[88%] w-[82%]"
                />
                {/* 병이 바닥에 닿는 자리. 이게 없으면 병이 떠 보입니다 */}
                <span
                  aria-hidden
                  className="shelf-ground pointer-events-none absolute -bottom-1 h-3.5 w-[82%] rounded-[50%]"
                />

                {item.thumbnailUrl && (
                  <img
                    src={item.thumbnailUrl}
                    alt=""
                    style={{
                      height:
                        BOTTLE_HEIGHTS[
                          item.shelfItemId % BOTTLE_HEIGHTS.length
                        ],
                    }}
                    className={cn(
                      'shelf-bottle-img relative z-[2] max-w-[94%] object-contain object-bottom',
                      'transition-transform duration-200 ease-out',
                      item.shelfItemId === selectedId
                        ? '-translate-y-1'
                        : 'hover:-translate-y-1',
                    )}
                  />
                )}
                <span className="sr-only">
                  {item.name} {item.brand}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 라벨은 벽감 밖 아래. 병과 같은 그리드를 써야 열이 맞습니다 */}
      <ul className="grid grid-cols-7 px-10 pt-3">
        {shown.map((item) => {
          const selected = item.shelfItemId === selectedId
          return (
            <li key={item.shelfItemId} className="min-w-0">
              <button
                type="button"
                onClick={() => onSelect(item)}
                className={cn(
                  'w-full px-1 text-center',
                  'rounded-card outline-none focus-visible:ring-2 focus-visible:ring-[var(--shelf-ink)]',
                )}
              >
                {/*
                  선택 표시. 켜짐 여부는 aria-pressed 를 단 위 병 버튼이 이미 전하므로
                  여기서는 장식으로만 둡니다 — 같은 사실을 두 번 읽어주지 않습니다.
                */}
                <i
                  aria-hidden
                  className={cn(
                    'mx-auto mb-2.5 block size-2.5 rounded-full border',
                    selected
                      ? 'border-transparent bg-[var(--shelf-ink)]'
                      : 'shelf-muted border-current bg-transparent',
                  )}
                />
                <span className="text-caption block truncate font-serif">
                  {item.brand}
                </span>
                <small className="shelf-muted text-caption block min-h-9 font-serif">
                  {item.name}
                </small>
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
