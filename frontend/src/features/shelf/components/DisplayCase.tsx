import { cn } from '@/shared/lib/cn'

import { SHELF_PAGE_STEP, SHELF_SLOT_COUNT, type ShelfItem } from '../types'

type Props = {
  /** 이 진열장이 어느 칸인지 (보유 중 · 시향해 봄 · 보유 희망) */
  label: string
  items: ShelfItem[]
  selectedId: number | null
  onSelect: (item: ShelfItem) => void
  /** 진열장에 보이는 첫 병의 순서 */
  windowStart: number
  onPage: (direction: 1 | -1) => void
  canPagePrev: boolean
  canPageNext: boolean
  className?: string
}

/*
 * 병 이미지 높이. 전부 같은 높이면 상품 카탈로그처럼 보입니다.
 * ⚠️ 칸(버튼)은 전부 같은 크기이고, 달라지는 것은 병이 차지하는 높이뿐입니다.
 */
const BOTTLE_HEIGHTS = [219, 235, 210, 257, 252, 232, 224] as const

const bottleHeight = (shelfItemId: number) =>
  BOTTLE_HEIGHTS[shelfItemId % BOTTLE_HEIGHTS.length]

/** 사진과 실루엣이 공유하는 자리·크기 */
const BOTTLE = 'relative z-[2] max-w-[94%] object-contain object-bottom'

/** 고른 병은 살짝 앞으로 나옵니다. 아직 안 고른 병은 마우스를 올릴 때만 그렇습니다 */
const lift = (item: ShelfItem, selectedId: number | null) =>
  cn(
    'transition-transform duration-200 ease-out',
    item.shelfItemId === selectedId ? '-translate-y-1' : 'hover:-translate-y-1',
  )

/**
 * 진열장 (와이어프레임 A13 재디자인 시안)
 *
 * 모양(벽감 원근·그림자·찢어진 종이)은 `../shelf-display.css`, 배치는 여기입니다.
 * 병 이미지가 배경 투명 PNG 라 이미지 칸에 테두리·배경을 주지 않습니다.
 * 사진은 커밋하지 않으므로(.gitignore) **없는 환경이 정상**이고, 그때는 실루엣을 세웁니다.
 *
 * 한 번에 일곱 병만 세우고 넘치면 화살표로 세 칸씩 밉니다. 어디까지 밀었는지는
 * 화면(pages)이 들고 있습니다 — 진열장이 스스로 들면 하단 페이저와 어긋납니다.
 */
export function DisplayCase({
  label,
  items,
  selectedId,
  onSelect,
  windowStart,
  onPage,
  canPagePrev,
  canPageNext,
  className,
}: Props) {
  const overflowing = items.length > SHELF_SLOT_COUNT

  /*
   * 일곱 개만 잘라 그리지 않고 전부 그린 뒤 트랙을 밉니다 — 잘라 그리면 화살표를
   * 눌러도 움직임이 없어 밀린 건지 바뀐 건지 알 수 없습니다.
   *
   *   트랙 폭 = 창 폭 x (병 수 / 7)       칸 하나가 창 폭의 1/7
   *   미는 거리 = 트랙 폭 x (시작 / 병 수)  칸 하나만큼씩 (transform % 는 자기 폭 기준)
   */
  const track =
    items.length === 0
      ? undefined
      : {
          width: `${(items.length / SHELF_SLOT_COUNT) * 100}%`,
          transform: `translateX(${(-windowStart / items.length) * 100}%)`,
          gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))`,
        }

  /** 창 밖의 병. 탭으로 닿으면 창이 스크롤되어 트랙과 어긋납니다 */
  const offWindow = (at: number) =>
    at < windowStart || at >= windowStart + SHELF_SLOT_COUNT

  const TRACK_MOTION =
    'grid transition-transform duration-[400ms] ease-[cubic-bezier(0.22,0.61,0.36,1)]'

  return (
    // 칸 이름은 칩이 이미 보여주므로 낭독기에만 알립니다
    <section
      className={cn('min-w-0', className)}
      aria-label={`${label} 진열장`}
    >
      {/* 벽면(바깥)과 벽감(안)을 나눈 이유: 벽감의 clip-path 가 자식·그림자까지 잘라냅니다 */}
      <div className="shelf-case relative h-[329px]">
        <div className="shelf-niche absolute inset-0 overflow-hidden">
          {items.length === 0 ? (
            <p className="shelf-muted text-caption absolute inset-0 flex items-center justify-center">
              조건에 맞는 향수가 없습니다
            </p>
          ) : (
            /*
              바깥이 창, 안이 트랙입니다. 트랙 폭이 % 라 창이 자리를 잡아줘야 칸 크기가
              맞습니다 — 트랙을 직접 absolute 로 두면 벽감 전체가 기준이 되어 넘칩니다.
            */
            <div className="absolute inset-x-10 top-9 bottom-0 overflow-x-clip">
              <div
                style={track}
                className={cn('h-full items-end', TRACK_MOTION)}
              >
                {items.map((item, at) => (
                  <button
                    key={item.shelfItemId}
                    type="button"
                    aria-pressed={item.shelfItemId === selectedId}
                    onClick={() => onSelect(item)}
                    title={`${item.name} · ${item.brand}`}
                    inert={offWindow(at)}
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

                    {/* 사진과 실루엣이 같은 높이·움직임이어야 두 환경의 배치가 같습니다 */}
                    {item.thumbnailUrl ? (
                      <img
                        src={item.thumbnailUrl}
                        alt=""
                        style={{ height: bottleHeight(item.shelfItemId) }}
                        className={cn(
                          BOTTLE,
                          'shelf-bottle-img',
                          lift(item, selectedId),
                        )}
                      />
                    ) : (
                      <BottleSilhouette
                        style={{ height: bottleHeight(item.shelfItemId) }}
                        className={cn(BOTTLE, lift(item, selectedId))}
                      />
                    )}
                    <span className="sr-only">
                      {item.name} {item.brand}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 화살표가 벽감 밖에 있는 이유: 벽감의 clip-path 가 걸친 부분을 잘라냅니다 */}
        {overflowing && (
          <>
            <PageArrow
              direction={-1}
              onClick={() => onPage(-1)}
              disabled={!canPagePrev}
            />
            <PageArrow
              direction={1}
              onClick={() => onPage(1)}
              disabled={!canPageNext}
            />
          </>
        )}
      </div>

      {/*
        라벨은 병과 같은 트랙 값을 써야 열이 맞습니다.
        overflow-x-clip 인 이유: hidden 이면 세로가 auto 로 바뀌어 포커스 링이 잘립니다.
      */}
      <div className="overflow-x-clip px-10 pt-3">
        <ul style={track} className={TRACK_MOTION}>
          {items.map((item, at) => {
            const selected = item.shelfItemId === selectedId
            return (
              <li key={item.shelfItemId} className="min-w-0">
                <button
                  type="button"
                  onClick={() => onSelect(item)}
                  inert={offWindow(at)}
                  className={cn(
                    'w-full px-1 text-center',
                    'rounded-card outline-none focus-visible:ring-2 focus-visible:ring-[var(--shelf-ink)]',
                  )}
                >
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
                  {/* 두 줄에 못 박습니다 — 높이가 달라지면 칸이 넘어갈 때 덜컹입니다 */}
                  <small className="shelf-muted text-caption line-clamp-2 block h-9 font-serif">
                    {item.name}
                  </small>
                </button>
              </li>
            )
          })}
        </ul>
      </div>
    </section>
  )
}

/** 사진이 없는 향수 자리. 네모 자리표시자를 쓰면 투명 PNG 가 들어온 뒤와 너무 달라집니다 */
function BottleSilhouette({
  className,
  style,
}: {
  className?: string
  style?: React.CSSProperties
}) {
  return (
    <svg
      viewBox="0 0 32 64"
      preserveAspectRatio="xMidYMax meet"
      aria-hidden
      style={style}
      className={cn('text-[var(--niche-floor)]', className)}
    >
      <path
        fill="currentColor"
        d="M13 2h6v7c0 2 6 4 6 9v44a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V18c0-5 6-7 6-9V2Z"
      />
    </svg>
  )
}

/**
 * 벽 가운데 넘김 화살표.
 *
 * 공용 Button 을 안 쓰는 이유: 어떤 variant 든 불투명해져 벽 그러데이션이 끊깁니다.
 * 벽 폭보다 크게 두는 이유: 벽 안에 가두면 지름이 24px 이라 누르기 어렵습니다.
 */
function PageArrow({
  direction,
  onClick,
  disabled,
}: {
  direction: 1 | -1
  onClick: () => void
  disabled: boolean
}) {
  const next = direction === 1
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={`향수 ${SHELF_PAGE_STEP}개 ${next ? '다음' : '이전'}`}
      className={cn(
        'shelf-page-arrow absolute top-1/2 z-[3] flex size-9 -translate-y-1/2',
        'items-center justify-center rounded-full',
        'transition-opacity duration-120 ease-out',
        'outline-none focus-visible:ring-2 focus-visible:ring-[var(--shelf-ink)]',
        'disabled:pointer-events-none disabled:opacity-0',
        next ? 'right-1' : 'left-1',
      )}
    >
      <svg viewBox="0 0 16 16" aria-hidden className="size-4">
        <path
          d={next ? 'M6 3.5 10.5 8 6 12.5' : 'M10 3.5 5.5 8 10 12.5'}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  )
}
