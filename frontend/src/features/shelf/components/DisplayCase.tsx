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
 * 병이 차지하는 칸 높이. **전부 같은 값입니다.**
 *
 * 예전에는 id 로 일곱 가지 높이를 돌려썼습니다. 자리표시자가 똑같은 실루엣이라
 * 높이라도 흔들어야 진열장처럼 보였기 때문입니다. 지금은 진짜 사진이 들어와서
 * 병마다 비율이 이미 다릅니다 — 넓은 플라콘(미스 디올·끌로에)은 object-contain 이
 * 폭에 맞추느라 저절로 낮아지고, 길쭉한 병(상탈 33·에르메스)은 높이를 다 씁니다.
 * 여기서 높이까지 흔들면 그 위에 가짜 편차가 한 겹 더 얹힙니다.
 */
const BOTTLE_HEIGHT = 280

/** 사진과 실루엣이 공유하는 자리·크기 */
const BOTTLE = 'relative z-[2] max-w-full object-contain object-bottom'

/** 고른 병은 살짝 앞으로 나옵니다. 아직 안 고른 병은 마우스를 올릴 때만 그렇습니다 */
const lift = (item: ShelfItem, selectedId: number | null) =>
  cn(
    'transition-transform duration-200 ease-out',
    item.shelfItemId === selectedId ? '-translate-y-1' : 'hover:-translate-y-1',
  )

/**
 * 진열장 (와이어프레임 A13 재디자인 시안)
 *
 * 벽을 파낸 벽감에 향수병을 세워 둡니다. 벽감의 원근·그림자는
 * `../shelf-display.css` 가 그립니다 — clip-path 와 6겹 그림자를 유틸리티로
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

  /*
   * 조명에서 얼마나 멀리 있는 칸인지 (0 = 광원 쪽 왼쪽 끝, 1 = 오른쪽 끝).
   *
   * 광원이 벽감 **왼쪽 아래에 하나** 있다고 보면 오른쪽으로 갈수록 어두워지고
   * 그림자가 길어집니다. 일곱 칸이 전부 같은 밝기·같은 그림자면 조명이 아니라
   * 칸마다 스티커를 붙인 것으로 읽힙니다. 이 값을 CSS 변수로 넘기고 밝기와
   * 그림자 길이를 calc() 로 풉니다.
   *
   * 기준은 절대 순서가 아니라 **창 안에서의 자리**입니다. 조명은 벽감에 붙어
   * 있으니 트랙이 밀려도 왼쪽 칸이 늘 밝아야 합니다.
   */
  const litRatio = (at: number) => {
    const inWindow = (at - windowStart) / (SHELF_SLOT_COUNT - 1)
    return Math.min(1, Math.max(0, inWindow))
  }

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
        {/*
          벽감 — 뒷벽·바닥·좌우 접힘선을 그립니다. clip-path 가 **자식까지 잘라내므로**
          여기에는 비어 있을 때의 안내문만 둡니다. 병 트랙은 바깥 상자(.shelf-case)의
          자식입니다 — 벽감 안에 두면 양 끝 병이 벽 두께만큼 잘립니다. 넘김 화살표를
          바깥에 둔 것과 같은 이유입니다.
        */}
        <div className="shelf-niche absolute inset-0 overflow-hidden">
          {items.length === 0 && (
            <p className="shelf-muted text-caption absolute inset-0 flex items-center justify-center">
              조건에 맞는 향수가 없습니다
            </p>
          )}
        </div>

        {items.length > 0 && (
          /*
            감싸는 층이 **창**이고 안쪽이 **트랙**입니다. 트랙 폭을 %로 잡았으므로
            창 폭의 1/7 이 곧 칸 크기입니다.

            창이 **상자 전체 폭**이고 벽감 **밖**에 있습니다. 그래서 양 끝 병이 벽
            그러데이션 위까지 그려지고 아무것도 잘리지 않습니다. 안쪽으로 물리면
            칸이 좁아지고(40px 물렸을 때 103px, 지금 112px), 벽감 안에 두면 벽
            두께만큼 잘립니다.

            ⚠️ 아래 라벨 트랙도 **같은 좌우 기준**이어야 열이 맞습니다.
            한쪽만 px-10 을 두면 병과 이름이 어긋납니다.

            창 밖 병은 `shelf-window`(CSS) 의 마스크와 각 병의 opacity 가 함께
            감춥니다. overflow:clip 은 쓰지 않습니다 — 경계에서 픽셀이 뚝 끊겨
            세로줄로 보입니다.
          */
          <div className="shelf-window absolute inset-x-0 top-9 bottom-0">
            <div style={track} className={cn('h-full items-end', TRACK_MOTION)}>
              {items.map((item, at) => (
                <button
                  key={item.shelfItemId}
                  type="button"
                  aria-pressed={item.shelfItemId === selectedId}
                  onClick={() => onSelect(item)}
                  title={`${item.name} · ${item.brand}`}
                  inert={offWindow(at)}
                  className={cn(
                    // @container: 그림자를 칸 폭 기준(cqw)으로 재게 합니다.
                    // 칸은 %로 줄어드는데 그림자만 고정 px 이면, 창이 좁아질수록
                    // 병 대비 그림자가 커져서 창 경계에 잘린 줄이 보입니다.
                    '@container relative flex h-[292px] min-w-0 items-end justify-center',
                    'rounded-card outline-none focus-visible:ring-2 focus-visible:ring-[var(--shelf-ink)]',
                    // 창 밖 병은 **투명하게** 지웁니다. 잘라내면 창 경계에
                    // 걸친 그림자까지 같이 잘려 세로줄이 생깁니다. 투명으로
                    // 지우면 그림자는 벽까지 번지고, 넘김(400ms)에 맞춰
                    // 사라지고 나타납니다.
                    'transition-opacity duration-[400ms] ease-[cubic-bezier(0.22,0.61,0.36,1)]',
                    offWindow(at) && 'opacity-0',
                  )}
                >
                  {/*
                    사진과 실루엣이 같은 높이·같은 움직임을 갖습니다. 실루엣만 크기가
                    다르면 사진이 있는 환경과 없는 환경의 레이아웃이 달라져서, 사진이
                    없는 팀원은 다른 화면을 보게 됩니다.
                  */}
                  {item.thumbnailUrl ? (
                    /*
                        빛을 종이 위에 덮으려면 겹칠 층이 이미지와 **똑같은 상자**를
                        가져야 합니다. object-contain 은 이미지를 상자 안에 레터박스로
                        앉히므로, 상자가 어긋나면 mask-size:contain 도 어긋납니다.
                        그래서 감싸는 span 을 둡니다 — 이 span 이 곧 이미지 상자이고,
                        빛 층은 inset-0 으로 그 상자를 그대로 물려받습니다.
                      */
                    <span
                      style={{ height: BOTTLE_HEIGHT }}
                      className={cn(
                        'relative z-[2] max-w-full',
                        lift(item, selectedId),
                      )}
                    >
                      {/*
                          벽에 지는 그림자. drop-shadow 가 아니라 **같은 실루엣을
                          옆으로 민 그러데이션 층**입니다 — drop-shadow 는 색이 하나라
                          그림자가 끝까지 같은 농도로 깔려 판자처럼 보입니다.
                        */}
                      <span
                        aria-hidden
                        className="shelf-bottle-cast"
                        style={
                          {
                            '--bottle': `url("${item.thumbnailUrl}")`,
                            '--lit': String(litRatio(at)),
                          } as React.CSSProperties
                        }
                      />
                      <img
                        src={item.thumbnailUrl}
                        alt=""
                        style={
                          {
                            '--lit': String(litRatio(at)),
                          } as React.CSSProperties
                        }
                        className="shelf-bottle-img relative z-[1] h-full max-w-full object-contain object-bottom"
                      />
                      {/*
                          종이 표면에 앉는 빛. 이미지 자신을 마스크로 써서 실루엣
                          밖으로 새지 않습니다 — 이게 없으면 종이가 균일한 흰색이라
                          아무리 바깥에 그림자를 깔아도 빛을 받는 물체로 안 읽힙니다.
                        */}
                      <span
                        aria-hidden
                        className="shelf-bottle-lit"
                        style={
                          {
                            '--bottle': `url("${item.thumbnailUrl}")`,
                            '--lit': String(litRatio(at)),
                          } as React.CSSProperties
                        }
                      />
                    </span>
                  ) : (
                    <BottleSilhouette
                      style={{ height: BOTTLE_HEIGHT }}
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
      <div className="overflow-x-clip pt-3">
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
                    // 병과 같은 규칙. 글씨는 특히 반쯤 잘리면 읽으려다 마는
                    // 꼴이 되므로, 창 밖이면 아예 지웁니다.
                    'transition-opacity duration-[400ms] ease-[cubic-bezier(0.22,0.61,0.36,1)]',
                    offWindow(at) && 'opacity-0',
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
