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
 * 벽을 파낸 벽감에 향수병을 세워 둡니다. 벽감의 원근·그림자와 병 뒤 찢어진
 * 종이는 `../shelf-display.css` 가 그립니다 — clip-path 와 6겹 그림자를 유틸리티로
 * 옮기면 한 줄이 200자를 넘어 읽을 수 없어서 모양만 CSS 로 뺐습니다.
 * 배치·간격은 여기 Tailwind 입니다.
 *
 * 병 이미지는 배경이 투명한 PNG·WebP 입니다. 그래서 이미지 칸에 테두리나 배경을
 * 주지 않습니다 — 주면 투명 영역이 네모로 드러나 병이 상자에 든 것처럼 보입니다.
 *
 * 사진은 브랜드 저작물이라 커밋하지 않습니다(.gitignore). 그래서 **사진이 없는
 * 환경이 정상**입니다 — 갓 clone 한 팀원의 화면이 그렇습니다. 그때 아무것도 안 그리면
 * 진열장이 텅 빈 채로 보여서 화면이 고장 난 것처럼 읽히므로, 병 실루엣을 대신 세웁니다.
 *
 * **한 번에 일곱 병만 세웁니다.** 진열장은 실제 선반이라 칸 수가 정해져 있고, 담긴
 * 향수가 7개든 100개든 벽감 크기는 그대로여야 합니다. 넘치면 벽 가운데 화살표로
 * 세 칸씩 밉니다 — 어디까지 밀었는지는 화면(pages)의 상태가 들고 있습니다.
 * 진열장이 스스로 들면 하단 페이저로 선택을 옮길 때 둘이 서로 다른 자리를 가리킵니다.
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
   * 병을 일곱 개만 잘라 그리지 않고 **전부 그린 뒤 트랙을 옆으로 밉니다.**
   * 잘라 그리면 화살표를 눌렀을 때 내용만 갈리고 움직임이 없어서, 세 칸이 밀려난
   * 건지 다른 병으로 바뀐 건지 알 수 없습니다.
   *
   * 치수를 px 로 재지 않고 비율로 풉니다 — 창이 좁아져도 따라옵니다.
   *
   *   트랙 폭 = 창 폭 x (병 수 / 7)      → 칸 하나가 창 폭의 1/7
   *   미는 거리 = 트랙 폭 x (시작 / 병 수) → 칸 하나만큼씩
   *
   * transform 의 % 는 **자기 폭** 기준이라 두 식이 맞물립니다. 병이 일곱 개보다
   * 적으면 트랙이 창보다 좁아지고, 칸 크기는 그대로인 채 오른쪽이 빕니다 —
   * 선반에 빈 칸이 있는 게 맞는 모습입니다.
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
    // 칸 이름을 눈에 보이게 또 적지는 않습니다 — 칩이 이미 말하고 있어서 같은
    // 말이 두 번 보입니다. 대신 낭독기에는 어느 칸인지 알려야 합니다.
    <section
      className={cn('min-w-0', className)}
      aria-label={`${label} 진열장`}
    >
      {/*
        바깥 상자가 좌우 **벽면**을, 안쪽 벽감이 뒷벽과 바닥을 그립니다. 둘로 나눈
        이유는 벽감의 clip-path 가 자기 자식과 그림자까지 전부 잘라내기 때문입니다 —
        벽을 벽감 안에 두면 그리는 순간 같이 잘려 나갑니다.
        높이 329px 은 시안 실측값입니다.
      */}
      <div className="shelf-case relative h-[329px]">
        <div className="shelf-niche absolute inset-0 overflow-hidden">
          {items.length === 0 ? (
            <p className="shelf-muted text-caption absolute inset-0 flex items-center justify-center">
              조건에 맞는 향수가 없습니다
            </p>
          ) : (
            /*
              감싸는 층이 **창**이고 안쪽이 **트랙**입니다. 트랙의 폭을 %로 잡았으므로
              그 100% 가 무엇인지가 곧 칸 크기입니다 — 창이 이 자리(좌우 40px 안쪽)를
              잡아줘야 칸이 141px 이 됩니다. 트랙을 직접 absolute 로 두면 100% 가
              벽감 전체(1066px)가 되어 병이 한 단 커지고 오른쪽 벽을 넘어갑니다.
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

                    {/*
                    사진과 실루엣이 같은 높이·같은 움직임을 갖습니다. 실루엣만 크기가
                    다르면 사진이 있는 환경과 없는 환경의 레이아웃이 달라져서, 사진이
                    없는 팀원은 다른 화면을 보게 됩니다.
                  */}
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

        {/*
          넘김 화살표. 벽감이 아니라 **바깥 상자**의 자식입니다 — 벽감의 clip-path 는
          자식까지 잘라내서, 안에 두면 벽에 걸친 부분이 사라집니다.
          넘칠 때만 나타납니다. 일곱 칸이 전부면 누를 곳이 없는 단추가 남습니다.
        */}
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
        라벨은 벽감 밖 아래. 병과 **같은 트랙 값**을 써야 열이 맞고 함께 미끄러집니다.

        overflow-x-clip 입니다. hidden 으로 두면 CSS 규격상 세로가 auto 로 바뀌면서
        라벨 버튼의 포커스 링(box-shadow)이 위아래로 잘립니다.
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
                  {/*
                  line-clamp-2 로 두 줄에 못 박습니다. 세 줄짜리 이름이 하나만
                  있어도 칸 높이가 달라지는데, 세 칸이 미끄러져 오가는 화면이라
                  높이가 다르면 넘어가는 순간 아래가 덜컹 움직입니다.
                */}
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

/**
 * 사진이 없는 향수 자리.
 *
 * 목 · 어깨 · 몸통을 한 덩어리로 그립니다. 네모 자리표시자를 쓰지 않는 이유는
 * 이 자리에 들어올 것이 배경 투명 PNG 라서입니다 — 네모를 그려 두면 사진이 들어온
 * 뒤와 없을 때의 인상이 완전히 달라집니다.
 */
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
 * 공용 `Button` 을 쓰지 않습니다. 공용 버튼은 어떤 variant 든 불투명한 채움이나
 * 테두리가 생기는데, 이건 벽면 위에 얹혀 **뒤가 비쳐야** 합니다. 가려버리면
 * 벽의 그러데이션이 끊겨 진열장에 스티커를 붙인 것처럼 보입니다.
 *
 * 벽 폭이 24 · 31px 이라 단추가 벽 밖으로 조금 걸칩니다. 벽 안에 가두면 지름이
 * 24px 밖에 안 돼 누르기 어렵습니다(44px 권장). 대신 반투명이라 걸친 부분으로
 * 뒷벽이 비쳐서, 벽에 박힌 게 아니라 떠 있는 단추로 읽힙니다.
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
