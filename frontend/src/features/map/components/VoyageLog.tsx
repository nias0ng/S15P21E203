import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'

import { perfumeViewState } from '@/shared/config/perfumeViewSource'
import { ROUTES, toPerfumeDetail } from '@/shared/config/routes'
import {
  scentFamilyName,
  type ScentFamilyKey,
} from '@/shared/config/scentFamilies'
import {
  CAN_MEASURE,
  useMeasuredHeight,
} from '@/shared/hooks/useMeasuredHeight'
import { useMediaQuery } from '@/shared/hooks/useMediaQuery'
import { UNROLL, UNROLL_CURVE } from '@/shared/hooks/useUnroll'
import { localizedName } from '@/shared/i18n/locale'
import { cn } from '@/shared/lib/cn'
import { useLocale } from '@/shared/store/localeStore'
import { BottleSilhouette } from '@/shared/ui/BottleSilhouette'

import { groupVoyageLogByDay, type VoyageLogDay } from '../lib/voyageLogDays'
import {
  VOYAGE_DAY_SHOWN,
  VOYAGE_LOG_DAYS,
  type VoyageLogEntry,
} from '../types'

import { VoyageLogMore } from './VoyageLogMore'

/** 일지를 불러온 상태 — 화면(HomePage)이 쿼리 결과로 정합니다 */
export type VoyageLogStatus = 'loading' | 'ready' | 'guest' | 'error'

type Props = {
  entries: VoyageLogEntry[]
  status: VoyageLogStatus
}

/*
 * 판 위 글자의 진하기 — 판(dusk 60%) 뒤로 살구색 하늘이 비쳐 옅게 두면 흐립니다.
 * 2026-09-16 실측 (1920×1080 · 판 자리의 하늘을 엔진 렌더에서 읽어 계산) : 상아색 100% 최저 5.1:1 ·
 * 95% 4.8:1 · 90% 4.5:1 · 70% 3.4:1. 그래서 해역 · 향수 · 안내는 95%, 이름표는 90% 까지만 내립니다.
 */
/** 판 안의 한 줄 안내 (불러오는 중 · 비로그인 · 오류 · 빈 일지) */
const NOTE = 'text-caption text-surface/95 leading-relaxed'
/** 그날 기록의 이름표 (지나온 해역 · 발견한 향수) — 내용보다 한 단 옅게 */
const LABEL = 'text-caption text-surface/90'
/** 해역 뱃지 — 유리판 위의 옅은 알약. 해역 '…' 도 같은 알약으로 섭니다 */
const CHIP =
  'border-surface/15 bg-surface/5 text-caption text-surface/95 flex items-center rounded-full border px-1.75'

/*
 * 계열 색 — 3D 부표 · 미니맵과 같은 색입니다 (`@theme` 의 `--color-family-*`). 점 · 아이콘에만 씁니다.
 * Tailwind 가 소스에서 이름을 읽어 가도록 클래스를 통째로 적습니다.
 */
const FAMILY_DOT: Record<ScentFamilyKey, string> = {
  CITRUS: 'bg-family-citrus',
  FRUITY: 'bg-family-fruity',
  FLORAL: 'bg-family-floral',
  GREEN: 'bg-family-green',
  AQUATIC: 'bg-family-aquatic',
  WOODY: 'bg-family-woody',
  AMBER: 'bg-family-amber',
  GOURMAND: 'bg-family-gourmand',
  MUSK: 'bg-family-musk',
}
const FAMILY_ICON: Record<ScentFamilyKey, string> = {
  CITRUS: 'text-family-citrus',
  FRUITY: 'text-family-fruity',
  FLORAL: 'text-family-floral',
  GREEN: 'text-family-green',
  AQUATIC: 'text-family-aquatic',
  WOODY: 'text-family-woody',
  AMBER: 'text-family-amber',
  GOURMAND: 'text-family-gourmand',
  MUSK: 'text-family-musk',
}

/*
 * 열고 닫는 움직임 — **족자** (2026-09-17 사용자 : "지도 · 종이를 열듯 두루마리가 열리는 모션 · 위→아래 족자").
 *
 * - 머리줄(향해 일지)이 족자의 위 축이고, 그 아래 종이가 위에서부터 풀려 내려옵니다. 접으면 머리줄 밑으로 말려 올라갑니다
 * - ⚠ 판은 **내용 높이를 재서 px 로** 늘립니다(ResizeObserver). 예전 grid-template-rows 0fr → 1fr 는 판(바깥)이
 *   글자가 보이는 칸보다 앞서 내려갔습니다 — 자동 높이 격자에서 1 보다 작은 fr 이 두 번 곱해져, 280ms 에
 *   판 219px · 글자 116px 로 판 아래 100px 가 빈 채 내려왔습니다(09-17 실측). 줄마다 떠오르던 효과가 그걸 가렸습니다
 * - 글자는 **제자리에서** 판 아래끝이 지나가며 드러납니다. 예전(09-16)처럼 줄마다 떠오르지 않습니다 —
 *   종이에 적힌 글자는 움직이지 않고, 말아 올릴 때도 글자가 먼저 사라지지 않습니다
 * - 풀 때는 천천히 떼어 끝에서 조용히 멈춥니다(튀지 않음 — 09-16 "튀어나오면 안 됨"). 말아 올릴 때는 조금 빠르게
 * - 판 아래끝의 말린 축 · 그늘 그림은 넣었다가 뺐습니다 (09-17 사용자 : "하단 두루마리 디자인 빼고") — 움직임만 족자입니다
 * - 움직임 줄이기 설정이면 움직이지 않습니다
 */
const ROLL_UP = `duration-450 ${UNROLL_CURVE}`
/** 날 하나를 접거나 편 움직임이 끝나는 때 — 위 두 시간 가운데 긴 것(700ms)에 조금 더 */
const FOLD_SETTLE_MS = 750

/**
 * 향해 일지 (와이어프레임 A01 · A02 · A03 — MAP-24)
 *
 * 와이어프레임 주석:
 * - 취향 변화가 아니라 배가 지나온 자리를 적는다 — 다른 해역으로 들어갈 때마다
 *   '○○ 해역 진입' 한 줄이 쌓인다
 * - 일지 전체도 접힌다
 * - 지도 위에 계속 떠 있다 — 포인트를 열면 해당 해역 줄에 향수가 한 줄 쌓인다
 *
 * 사용자가 정한 것 :
 * - **날마다 묶습니다.** 머리말은 오늘이면 '오늘', 지난날은 `MM.DD` 이고 날짜를 줄마다 되풀이하지
 *   않습니다 — 해역을 여러 번 옮긴 날 같은 날짜가 같은 크기로 줄줄이 서면 어느 날의 기록인지 안 읽힙니다
 * - 그날의 **해역과 향수를 따로** 적습니다. 향수를 해역 줄 밑에 딸리지 않습니다 (`lib/voyageLogDays`)
 * - 날은 **최근 나흘**까지 (VOYAGE_LOG_DAYS). 가장 최근 날만 펼친 채 시작하고, 날 머리말을 누르면
 *   **그날만** 접히고 펴집니다
 * - 해역 · 향수는 그날 **최근 넷**까지 (VOYAGE_DAY_SHOWN). 나머지는 '…' 뒤로 가리고, '…' 에 마우스를
 *   올리면 나머지를 판 옆 카드로 띄웁니다 (`VoyageLogMore`)
 * - **게임의 항해 기록처럼** 적습니다 — 날마다 항로선, 해역은 뱃지 · 향수는 병 아이콘 줄로 내용마다
 *   모양을 달리합니다 (아래 `VoyageDay`). 날 머리말에는 날짜만 둡니다(기호 · 숫자 없이)
 * - 향수 이름은 **한글**이고 3D 부표 위의 짧은 이름을 씁니다. 줄이지 않은 이름은 올리면 보입니다
 *   (`lib/mapPerfumeLookup`)
 * - '구역' 이 아니라 '해역' · 날 앞 표시는 작은 아래 세모 · 머리말은 한글 '향해 일지' 한 줄
 * - 글꼴 : 머리말 '향해 일지' 만 3D 검색창과 같은 Noto Serif KR 이고, 판 안의 글자는 전부
 *   Noto Sans KR 입니다 (body 의 `font-sans` 를 그대로 받습니다)
 *
 * ── 모양 ──────────────────────────────────────────────────
 * 오른쪽 아래 엔진 미니맵(SCENT MAP)과 같은 저녁 유리 판입니다 (dusk 60% · 흐림 6px · 상아색 15% 테두리 ·
 * 반경 9px · 그림자). 미니맵은 엔진(iframe)이 그리고 이 판은 앱이 3D 위에 얹으므로, 엔진의 값을
 * 토큰(dusk · dusk-gold · radius-glass · shadow-glass)으로 옮겨 맞췄습니다.
 * 판이 작고 어두운 유리 위라 공용 Skeleton · EmptyState 대신 한 줄 안내를 씁니다.
 */
/**
 * 좁은 창에서는 접은 채로 시작합니다 (2026-09-16).
 *
 * 이 판은 앱 DOM 이라 `left 30 · w 240`(오른끝 270)으로 **고정**인데, 엔진 검색창은 iframe 안에서
 * **가운데 정렬**이라 창이 좁아지면 왼끝이 왼쪽으로 내려옵니다. 둘은 서로를 모릅니다 —
 * 엔진의 `PB.layout()` 은 iframe 안만 보고, 호스트가 넘기는 것은 `hostTop`(헤더 높이) 하나뿐입니다.
 * 실측 : 폭 **940** 아래부터 가로로 물리고, 펼친 판(아래끝 385)은 검색창 띠를 통째로 덮습니다.
 * 경위 · 수치는 `landing/docs/분할/C-연출UI.md`.
 *
 * ⚠ 1024 는 엔진(`landing/index.html` 의 `@media (max-width:1024px)`)과 앱(`--gutter` 단계)이
 *   이미 함께 쓰는 문턱이라 새 숫자를 만들지 않았습니다. 940 보다 넉넉한 쪽입니다.
 */
const NARROW_QUERY = '(max-width: 1024px)'

export function VoyageLog({ entries, status }: Props) {
  const { t } = useTranslation('map')
  const narrow = useMediaQuery(NARROW_QUERY)
  // 기본값은 폭이 정하고(좁으면 접힘), 사용자가 누르면 **누른 단계와 함께** 기억합니다.
  // 문턱을 넘으면 기억해 둔 단계가 안 맞으므로 저절로 기본값으로 돌아갑니다 —
  // 한 단계 안에서 접거나 편 것은 리사이즈 중에도 그대로 남습니다.
  // ⚠ effect 로 state 를 맞추지 않습니다 (`react-hooks/set-state-in-effect` — 연쇄 렌더).
  const [choice, setChoice] = useState<{
    narrow: boolean
    open: boolean
  } | null>(null)
  const open = choice?.narrow === narrow ? choice.open : !narrow
  // 처음 뜰 때도 위에서부터 열리게 — 닫힌 모양을 한 번 칠한 뒤(두 프레임 뒤) 엽니다
  const [painted, setPainted] = useState(false)
  useEffect(() => {
    let inner = 0
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() => setPainted(true))
    })
    return () => {
      cancelAnimationFrame(outer)
      cancelAnimationFrame(inner)
    }
  }, [])
  const expanded = open && painted

  // 풀릴 종이의 높이. 일지가 늦게 오거나 줄이 늘면 다시 재서, 펼친 판도 그 길이만큼 이어서 풀립니다
  const { ref: bodyRef, height: bodyHeight } = useMeasuredHeight()

  /*
   * 날 하나를 접고 펴는 동안에는 판이 잰 높이 대신 **내용을 그대로 따라갑니다**(`auto`).
   * 잰 높이로 두면 판도 제 전환으로 한 번 더 뒤따라가, 접을 때는 판 아래가 빈 채로 늦게 올라오고
   * 펼 때는 아래 날이 잠깐 잘립니다. 움직임이 끝나면 잰 높이로 돌아갑니다 — 그때는 두 값이 같습니다.
   * 마지막으로 접은 때부터 세야 해서 몇 번 접었는지를 셉니다.
   */
  const [folds, setFolds] = useState(0)
  const [settledFolds, setSettledFolds] = useState(0)
  const followingFold = folds !== settledFolds
  useEffect(() => {
    if (folds === 0) return
    const timer = window.setTimeout(
      () => setSettledFolds(folds),
      FOLD_SETTLE_MS,
    )
    return () => window.clearTimeout(timer)
  }, [folds])
  const onDayFold = useCallback(() => setFolds((count) => count + 1), [])

  return (
    <section
      aria-label={t('voyageLog.title')}
      /*
        NOTE: `relative` 는 '…' 카드(`VoyageLogMore`)의 기준입니다. 판과 카드 사이의 칸(접기 · 목록)에
        position 을 주면 카드의 기준이 그 칸으로 내려가 넘침에 잘립니다.
      */
      className="border-surface/15 bg-dusk/60 rounded-glass shadow-glass relative w-60 border px-3.75 pt-2.5 pb-2.5 backdrop-blur-[6px]"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-body text-surface font-serif font-semibold">
          {t('voyageLog.title')}
        </h2>
        <button
          type="button"
          onClick={() => setChoice({ narrow, open: !open })}
          aria-expanded={open}
          aria-label={t(open ? 'voyageLog.collapse' : 'voyageLog.expand')}
          className={cn(
            'border-surface/15 text-dusk-gold rounded-card flex size-5 items-center justify-center border text-[10px]',
            'hover:bg-surface/10 transition-colors duration-120 ease-out',
            'focus-visible:ring-dusk-gold outline-none focus-visible:ring-1',
          )}
        >
          {/* 접기 표시 — 닫히면 옆을 봅니다. 족자와 같은 시간 · 곡선으로 돕니다 */}
          <span
            aria-hidden
            className={cn(
              'transition-transform motion-reduce:transition-none',
              expanded ? UNROLL : ROLL_UP,
              !expanded && '-rotate-90',
            )}
          >
            ▾
          </span>
        </button>
      </div>

      <div
        className={cn(
          'overflow-hidden transition-[height] motion-reduce:transition-none',
          expanded ? UNROLL : ROLL_UP,
        )}
        style={{
          height: expanded
            ? CAN_MEASURE && !followingFold
              ? bodyHeight
              : 'auto'
            : 0,
        }}
        inert={!expanded}
      >
        {/* 위 여백을 margin 이 아니라 padding 으로 — 잰 높이에 들어가야 판 끝이 글자 끝과 맞습니다 */}
        <div ref={bodyRef} className="pt-2.5">
          <div className="border-surface/15 border-t pt-2.5 pb-1.25">
            <VoyageLogBody
              entries={entries}
              status={status}
              onDayFold={onDayFold}
            />
          </div>
        </div>
      </div>
    </section>
  )
}

/**
 * 판 안의 내용. 글자는 움직이지 않습니다 — 판 아래끝이 지나가며 제자리에서 드러납니다(위 족자 주석).
 */
function VoyageLogBody({
  entries,
  status,
  onDayFold,
}: Props & { onDayFold: () => void }) {
  // 날 머리말의 '오늘' 도 화면 언어를 따르므로, 언어가 바뀌면 여기서 다시 묶습니다
  const { t } = useTranslation('map')
  if (status === 'loading') {
    return (
      <p>
        <span className={NOTE}>{t('voyageLog.loading')}</span>
      </p>
    )
  }
  if (status === 'guest') {
    return (
      <p>
        <span className={NOTE}>
          {t('voyageLog.guest')}{' '}
          <Link
            to={ROUTES.LOGIN}
            className="text-dusk-gold underline underline-offset-2"
          >
            {t('voyageLog.login')}
          </Link>
        </span>
      </p>
    )
  }
  if (status === 'error') {
    return (
      <p>
        <span className={NOTE}>{t('voyageLog.error')}</span>
      </p>
    )
  }

  const days = groupVoyageLogByDay(entries).slice(0, VOYAGE_LOG_DAYS)
  if (days.length === 0) {
    return (
      <p>
        <span className={NOTE}>{t('voyageLog.empty')}</span>
      </p>
    )
  }

  return (
    /*
      넘치면 굴립니다. 브라우저 기본 스크롤바는 유리판 위에서 흰 막대로 튀어서 가늘고 옅게 둡니다.
      지난날은 접힌 채 시작해 대개는 넘치지 않습니다 (아래 VoyageDay).
    */
    <ul className="max-h-120 [scrollbar-width:thin] [scrollbar-color:color-mix(in_oklab,var(--color-surface)_25%,transparent)_transparent] space-y-3.75 overflow-y-auto">
      {days.map((day, index) => (
        <VoyageDay
          key={day.key}
          day={day}
          defaultOpen={index === 0}
          onFold={onDayFold}
        />
      ))}
    </ul>
  )
}

/**
 * 하루 — 게임의 항해 기록처럼 적습니다.
 *
 * - 머리말 : 날짜 하나 — 기호 · 숫자를 붙이지 않습니다. 누르면 그날의 기록만 접혀 머리말 한 줄로
 *   좁아집니다. 판 전체와 같은 족자 움직임으로 말아 올리고 풉니다(위 족자 주석). 잰 높이로 움직이는
 *   까닭도 판과 같습니다
 * - 항로선 : 날 앞 세모에서 그날의 기록을 따라 가는 가는 선 — 배가 지나온 길입니다
 * - 기록은 **내용마다 모양이 다릅니다.** 지나온 해역은 계열 색 점을 단 뱃지를 옆으로 늘어놓고,
 *   발견한 향수는 계열 색 병을 단 한 줄씩 세웁니다. 색은 3D 부표 · 미니맵과 같습니다
 *
 * @param defaultOpen 펼친 채 시작하는가. **가장 최근 날만** 펼치고 지난날은 머리말 한 줄로 접어 둡니다 —
 *   게임의 기록처럼 지난 항해는 한 줄로 쌓이고, 판이 넘치지 않습니다
 * @param onFold 접거나 펼 때 부릅니다. 그동안 판이 이 날의 움직임을 그대로 따라갑니다 (`VoyageLog`)
 */
function VoyageDay({
  day,
  defaultOpen,
  onFold,
}: {
  day: VoyageLogDay
  defaultOpen: boolean
  onFold: () => void
}) {
  const { t } = useTranslation('map')
  const [open, setOpen] = useState(defaultOpen)
  // 재기 전(null)에는 내용 높이 그대로 둡니다 — 처음 뜰 때 날마다 따로 풀리지 않게
  const { ref: bodyRef, height: bodyHeight } = useMeasuredHeight(null)

  const regions = day.regions.slice(0, VOYAGE_DAY_SHOWN)
  const moreRegions = day.regions.slice(VOYAGE_DAY_SHOWN)
  const perfumes = day.perfumes.slice(0, VOYAGE_DAY_SHOWN)
  const morePerfumes = day.perfumes.slice(VOYAGE_DAY_SHOWN)

  return (
    <li>
      <h3>
        <button
          type="button"
          onClick={() => {
            onFold()
            setOpen(!open)
          }}
          aria-expanded={open}
          className={cn(
            // 고딕은 400 · 500 · 700 만 받습니다(index.html) — 600 을 주면 700 으로 굵어져 제목보다 무거워집니다
            'text-body text-surface rounded-card flex w-full items-center gap-2.5 px-1.25 text-left font-medium tabular-nums',
            'hover:bg-surface/10 transition-colors duration-120 ease-out',
            'focus-visible:ring-dusk-gold outline-none focus-visible:ring-1',
          )}
        >
          {/* 날 앞 표시 — 작은 아래 세모. 접으면 판 머리의 접기 표시처럼 옆을 봅니다 */}
          <span
            aria-hidden
            className={cn(
              'flex w-2.5 justify-center transition-transform motion-reduce:transition-none',
              open ? UNROLL : ROLL_UP,
              !open && '-rotate-90',
            )}
          >
            <svg viewBox="0 0 6 4" className="fill-dusk-gold h-1 w-1.5">
              <path d="M0 0h6L3 4z" />
            </svg>
          </span>
          {day.label}
        </button>
      </h3>

      <div
        className={cn(
          'overflow-hidden transition-[height] motion-reduce:transition-none',
          open ? UNROLL : ROLL_UP,
        )}
        style={{ height: open ? (bodyHeight ?? 'auto') : 0 }}
        inert={!open}
      >
        {/* 위 여백을 padding 으로 — 잰 높이에 들어가야 접힌 끝이 글자 끝과 맞습니다 */}
        <div ref={bodyRef} className="pt-1.25">
          {/*
            항로선은 날 앞 세모의 한가운데(판 안쪽 여백 5 + 세모 칸 10 의 절반)에서 내려옵니다.
            기록은 선 오른쪽에서 머리말 날짜 글자와 같은 자리에 섭니다.
          */}
          <dl className="border-surface/15 ml-2.5 space-y-2.5 border-l pl-3.5">
            <div>
              <dt className={LABEL}>{t('voyageLog.regions')}</dt>
              <dd className="mt-1.25">
                <VoyageLogMore
                  label={t('voyageLog.moreRegions', {
                    count: moreRegions.length,
                  })}
                  more={
                    moreRegions.length > 0 && (
                      <RegionChips codes={moreRegions} />
                    )
                  }
                  triggerClassName={CHIP}
                >
                  {(trigger) => <RegionChips codes={regions} tail={trigger} />}
                </VoyageLogMore>
              </dd>
            </div>

            {perfumes.length > 0 && (
              <div>
                <dt className={LABEL}>{t('voyageLog.perfumes')}</dt>
                <dd className="mt-1.25">
                  <VoyageLogMore
                    label={t('voyageLog.morePerfumes', {
                      count: morePerfumes.length,
                    })}
                    more={
                      morePerfumes.length > 0 && (
                        <PerfumeItems perfumes={morePerfumes} />
                      )
                    }
                  >
                    {(trigger) => (
                      <>
                        <PerfumeItems perfumes={perfumes} />
                        {/* '…' 을 향수 이름과 같은 줄에 세웁니다 — 병 아이콘 7 + 틈 7 에서 '…' 의 안쪽 여백 4 를 뺀 자리 */}
                        {trigger && (
                          <div className="text-caption mt-0.5 pl-2.5">
                            {trigger}
                          </div>
                        )}
                      </>
                    )}
                  </VoyageLogMore>
                </dd>
              </div>
            )}
          </dl>
        </div>
      </div>
    </li>
  )
}

/**
 * 지나온 해역 — 계열 색 점을 단 뱃지를 옆으로 늘어놓습니다. 끝에 붙일 것(`tail` — '…')도
 * 같은 줄의 뱃지 하나로 섭니다.
 */
function RegionChips({
  codes,
  tail,
}: {
  codes: VoyageLogDay['regions']
  tail?: ReactNode
}) {
  return (
    <ul className="flex flex-wrap gap-1">
      {codes.map((code) => (
        <li key={code} className={cn(CHIP, 'gap-1')}>
          <span
            aria-hidden
            className={cn('size-1.25 shrink-0 rounded-full', FAMILY_DOT[code])}
          />
          {scentFamilyName(code) ?? code}
        </li>
      ))}
      {tail && <li className="flex">{tail}</li>}
    </ul>
  )
}

/**
 * 발견한 향수 — 계열 색 병을 단 한 줄씩 세웁니다. 이름은 3D 부표 위의 짧은 이름이고, 올리면
 * 줄이지 않은 이름과 브랜드가 보입니다.
 */
function PerfumeItems({ perfumes }: { perfumes: VoyageLogDay['perfumes'] }) {
  const locale = useLocale()
  return (
    <ul className="space-y-0.5">
      {perfumes.map((perfume) => {
        /*
         * 영어 화면은 원명을 씁니다. 원명은 줄인 것이 없어 이름과 전체 이름이 같습니다.
         * 지도에서 못 찾은 향수는 원명이 비어 있고, 그 이름이 API 의 DB 원명(대개 영문)이라 그대로 둡니다.
         */
        const name = perfume.nameEn
          ? localizedName(locale, perfume.nameEn, perfume.name)
          : perfume.name
        const fullName = perfume.nameEn
          ? localizedName(locale, perfume.nameEn, perfume.fullName)
          : perfume.fullName
        const brand = perfume.brandEn
          ? localizedName(locale, perfume.brandEn, perfume.brand)
          : perfume.brand
        return (
          <li key={perfume.perfumeId}>
            <Link
              to={toPerfumeDetail(perfume.perfumeId)}
              state={perfumeViewState('SCENT_MAP')}
              title={[fullName ?? name, brand].filter(Boolean).join(' · ')}
              className="text-caption text-surface/95 hover:text-surface flex items-center gap-1.75 transition-colors duration-120 ease-out"
            >
              <BottleSilhouette
                className={cn(
                  'h-3.5 w-1.75',
                  perfume.family
                    ? FAMILY_ICON[perfume.family]
                    : 'text-surface/60',
                )}
              />
              <span className="min-w-0 truncate">{name}</span>
            </Link>
          </li>
        )
      })}
    </ul>
  )
}
