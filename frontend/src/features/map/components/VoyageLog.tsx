import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'

import { perfumeViewState } from '@/shared/config/perfumeViewSource'
import { ROUTES, toPerfumeDetail } from '@/shared/config/routes'
import { cn } from '@/shared/lib/cn'

import { SCENT_FAMILIES, VOYAGE_LOG_SIZE, type VoyageLogEntry } from '../types'

/** 일지를 불러온 상태 — 화면(HomePage)이 쿼리 결과로 정합니다 */
export type VoyageLogStatus = 'loading' | 'ready' | 'guest' | 'error'

type Props = {
  entries: VoyageLogEntry[]
  status: VoyageLogStatus
}

/*
 * 판 위 글자의 진하기 — 판(dusk 60%) 뒤로 살구색 하늘이 비쳐 옅게 두면 흐립니다.
 * 2026-09-16 실측 (1920×1080 · 판 자리의 하늘을 엔진 렌더에서 읽어 계산) : 상아색 100% 최저 5.1:1 ·
 * 95% 4.8:1 · 90% 4.5:1 · 70% 3.4:1. 그래서 향수 · 안내는 95%, 날짜는 90% 까지만 내립니다.
 */
/** 판 안의 한 줄 안내 (불러오는 중 · 비로그인 · 오류 · 빈 일지) */
const NOTE = 'text-caption text-surface/95 leading-relaxed'

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
const SCROLL_CURVE = 'ease-[cubic-bezier(0.45,0,0.2,1)]'
const UNROLL = `duration-700 ${SCROLL_CURVE}`
const ROLL_UP = `duration-450 ${SCROLL_CURVE}`

/** 내용 높이를 잴 수 있는 환경인지 — 못 재면(테스트의 jsdom 등) 움직임 없이 내용 높이로 엽니다 */
const CAN_MEASURE = typeof ResizeObserver !== 'undefined'

const familyLabel = (code: string) =>
  SCENT_FAMILIES.find((family) => family.code === code)?.label ?? code

/**
 * 향해 일지 (와이어프레임 A01 · A02 · A03 — MAP-24)
 *
 * 와이어프레임 주석:
 * - 취향 변화가 아니라 배가 지나온 자리를 적는다 — 다른 해역으로 들어갈 때마다
 *   '○○ 해역 진입' 한 줄이 쌓인다
 * - 일지 전체도 접힌다
 * - 지도 위에 계속 떠 있다 — 포인트를 열면 해당 해역 줄에 향수가 한 줄 쌓인다
 *
 * ⭐ 2026-09-16 사용자 결정 : 들른 향수는 **항상 펼쳐 둡니다** (와이어프레임의 줄마다 접기를 뺐습니다) ·
 *   줄은 **최근 다섯**까지 (VOYAGE_LOG_SIZE) · '구역' 이 아니라 '해역' 진입 · 줄 앞 표시는 작은 아래 세모 ·
 *   머리말은 한글 '향해 일지' 한 줄 (영문 제목 · 진입 수를 뺐습니다) · 글꼴은 3D 검색창과 같은 Noto Serif KR.
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

function useNarrow() {
  const [narrow, setNarrow] = useState(
    () => window.matchMedia(NARROW_QUERY).matches,
  )
  useEffect(() => {
    const mq = window.matchMedia(NARROW_QUERY)
    const onChange = (e: MediaQueryListEvent) => setNarrow(e.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return narrow
}

export function VoyageLog({ entries, status }: Props) {
  const narrow = useNarrow()
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
  const bodyRef = useRef<HTMLDivElement>(null)
  const [bodyHeight, setBodyHeight] = useState(0)
  useEffect(() => {
    const body = bodyRef.current
    if (!body || !CAN_MEASURE) return
    const observer = new ResizeObserver(() =>
      setBodyHeight(Math.ceil(body.getBoundingClientRect().height)),
    )
    observer.observe(body)
    return () => observer.disconnect()
  }, [])

  return (
    <section
      aria-label="향해 일지"
      className="border-surface/15 bg-dusk/60 rounded-glass shadow-glass w-60 border px-3.75 pt-2.5 pb-2.5 font-serif backdrop-blur-[6px]"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-body text-surface font-semibold">향해 일지</h2>
        <button
          type="button"
          onClick={() => setChoice({ narrow, open: !open })}
          aria-expanded={open}
          aria-label={open ? '향해 일지 접기' : '향해 일지 펼치기'}
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
        style={{ height: expanded ? (CAN_MEASURE ? bodyHeight : 'auto') : 0 }}
        inert={!expanded}
      >
        {/* 위 여백을 margin 이 아니라 padding 으로 — 잰 높이에 들어가야 판 끝이 글자 끝과 맞습니다 */}
        <div ref={bodyRef} className="pt-2.5">
          <div className="border-surface/15 border-t pt-2.5 pb-1.25">
            <VoyageLogBody entries={entries} status={status} />
          </div>
        </div>
      </div>
    </section>
  )
}

/**
 * 판 안의 내용. 글자는 움직이지 않습니다 — 판 아래끝이 지나가며 제자리에서 드러납니다(위 족자 주석).
 */
function VoyageLogBody({ entries, status }: Props) {
  if (status === 'loading') {
    return (
      <p>
        <span className={NOTE}>일지를 불러오는 중입니다</span>
      </p>
    )
  }
  if (status === 'guest') {
    return (
      <p>
        <span className={NOTE}>
          로그인하면 지나온 해역이 쌓입니다.{' '}
          <Link
            to={ROUTES.LOGIN}
            className="text-dusk-gold underline underline-offset-2"
          >
            로그인
          </Link>
        </span>
      </p>
    )
  }
  if (status === 'error') {
    return (
      <p>
        <span className={NOTE}>일지를 불러오지 못했습니다</span>
      </p>
    )
  }

  const shown = entries.slice(0, VOYAGE_LOG_SIZE)
  if (shown.length === 0) {
    return (
      <p>
        <span className={NOTE}>아직 들어간 해역이 없습니다</span>
      </p>
    )
  }

  return (
    <ul className="max-h-120 space-y-2.5 overflow-y-auto">
      {shown.map((entry) => {
        return (
          <li key={entry.entryId}>
            <p className="flex items-center gap-2.5 px-1.25">
              {/* 줄 앞 표시 — 작은 아래 세모 (들른 향수가 늘 펼쳐져 있다는 뜻) */}
              <span aria-hidden className="flex w-2.5 justify-center">
                <svg viewBox="0 0 6 4" className="fill-dusk-gold h-1 w-1.5">
                  <path d="M0 0h6L3 4z" />
                </svg>
              </span>
              <span className="text-surface/90 text-[11px] tracking-[0.08em] tabular-nums">
                {entry.enteredAt.slice(5, 10).replace('-', '.')}
              </span>
              {/*
                1536 에서 이 줄은 **1px 차이로 넘칩니다** — 판 192 안에서 줄이 쓸 수 있는 폭이
                158 인데, 가장 긴 해역 이름(시트러스 · 아쿠아틱 · 오리엔탈)이면 158.9 입니다
                (세모 8 + 틈 8x2 + 날짜 31.9 + 글자 103, 실측). 판은 `--spacing` 을 타 줄어드는데
                날짜(11px) · 이름(13px)은 안 줄어서 생기는 차이라, 짧은 이름은 그대로 한 줄입니다.
                접힐 때 낱글자가 아니라 띄어쓰기에서 끊게 해 둡니다. 1920 에서는 198 대 164.9 로
                넉넉해 아무 일도 하지 않습니다.
              */}
              <span className="text-body text-surface font-semibold break-keep">
                {familyLabel(entry.region)} 해역 진입
              </span>
            </p>

            {entry.visited.length > 0 && (
              <ul className="mt-1.25 ml-6.25 space-y-0.5">
                {entry.visited.map((perfume) => {
                  return (
                    <li key={perfume.perfumeId}>
                      <Link
                        to={toPerfumeDetail(perfume.perfumeId)}
                        state={perfumeViewState('SCENT_MAP')}
                        className="text-caption text-surface/95 hover:text-surface block truncate transition-colors duration-120 ease-out"
                      >
                        {perfume.name}
                      </Link>
                    </li>
                  )
                })}
              </ul>
            )}
          </li>
        )
      })}
    </ul>
  )
}
