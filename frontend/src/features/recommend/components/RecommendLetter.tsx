import { useMutation } from '@tanstack/react-query'
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'

import { perfumeViewState } from '@/shared/config/perfumeViewSource'
import { ROUTES, toPerfumeDetail } from '@/shared/config/routes'
import { localizedName } from '@/shared/i18n/locale'
import { cn } from '@/shared/lib/cn'
import { prefersReducedMotion } from '@/shared/lib/prefersReducedMotion'
import { useLocale } from '@/shared/store/localeStore'
import { LinkButton } from '@/shared/ui/LinkButton'

import { recordPersonalExposure } from '../api'
import { readPersonalReason, type PersonalReason } from '../personalReason'
import type {
  PersonalReasonSource,
  PersonalRecommendation,
  PersonalRecommendationResult,
} from '../types'

/**
 * 편지에 곁들이는 향수 정보. 추천 응답에는 이름 · 사진 · 근거뿐이라, 화면이 향수 상세 · 향조로 채워
 * 넘깁니다(추천 도메인은 향수 도메인을 모릅니다).
 */
export type LetterFacts = {
  perfumeId: number
  brand: string | null
  /** 두드러진 순서의 향 특성(한국어). 앞의 몇 개만 칩으로 적습니다 */
  accords: string[]
}

type Props = {
  /** 개인화 추천을 부른 결과(personalRecommendationQuery). 아직 없거나 추천이 없으면 아무것도 안 그립니다 */
  result: PersonalRecommendationResult | undefined
  /** 다른 향수를 받는 중 */
  isRefreshing: boolean
  /**
   * 다른 향수를 추천받습니다 — 서버에 다시 묻고 **새로 받은 결과**를 돌려주세요(묻다 실패하면 undefined).
   * 본 병은 사흘 동안 빠져 대개 다른 병이 옵니다. 새 편지가 오지 않으면 편지 아래에 한 줄로 알립니다.
   */
  onNext: () => Promise<PersonalRecommendationResult | undefined>
  /** 편지 속 향수가 바뀔 때 — 화면이 그 번호로 `facts` 를 채웁니다 */
  onShow?: (perfumeId: number) => void
  facts?: LetterFacts
  /** 편지 속 향수를 진열대에 담는 단추. 진열대 도메인의 일이라 화면이 만들어 넘깁니다 */
  renderSave?: (perfumeId: number) => ReactNode
  /** 받는 사람 — 편지 머리의 "○○님께" */
  recipient?: string | null
  /** 이 값이 바뀌면 펼친 편지를 접습니다 — 벽에서 다른 병을 골라 상세를 보려 할 때 */
  closeKey?: unknown
  /** 봉투가 꽂히는 자리 — 패널 윗변 오른쪽(벽 위에 얹힌 패널) · 왼쪽(쌓는 배치, 오른쪽에 페이저가 섭니다) */
  placement?: 'right' | 'left'
}

/** 칩으로 적는 향 특성 수. 편지 폭(1920 에서 안쪽 315)에 한 줄로 드는 만큼입니다 */
const ACCORD_CHIPS = 4

/**
 * 근거의 갈래마다 편지 머리말. 근거 문장이 "왜" 를 말하므로 머리말은 **어떤 편지인지**만 말합니다.
 * 모르는 틀(null)이면 갈래 없이 인사만 합니다.
 */
const HEADLINE = {
  FIT: 'fit',
  RECENT: 'recent',
  TASTE_TEST: 'taste',
  unknown: 'unknown',
} as const satisfies Record<PersonalReasonSource | 'unknown', string>

/**
 * "다른 향수 추천받기" 가 새 편지를 못 받았을 때 편지 아래에 적는 한 줄. 누르고도 아무 일이 없으면 버튼이
 * 고장 난 것처럼 보입니다 — 서버가 줄 향수가 없다고 답했는지(404 · 503), 묻다 실패했는지를 가립니다.
 */
type NextNote = 'none' | 'failed'

/**
 * 한 칸씩 펼치기의 시간(ms, 아래 RecommendLetter 의 "펼치기"). 봉투에서 나온 편지가 윗칸만 보이는
 * 띠로 패널 윗자리까지 오고(strip), 가운데 칸 · 아랫칸이 접힌 자국을 축으로 하나씩 내려옵니다(swing
 * — 아랫칸은 stagger 뒤에 따라붙습니다). 덮개가 먼저 젖혀지도록 delay 만큼 늦게 출발합니다.
 */
const UNFOLD = { delay: 110, strip: 440, swing: 400, stagger: 300 } as const

/**
 * 칸 하나가 내려오는 모양. 뒤로 접혀 있던 칸이 접힌 자국을 축으로 떨어지듯 내려와 한 번 지나쳤다가
 * 앉습니다. 옆으로 선(-90°) 칸은 보이지 않아, 뒤에 숨어 있던 반바퀴는 건너뜁니다.
 */
const SWING: Keyframe[] = [
  {
    transform: 'perspective(900px) rotateX(-90deg)',
    easing: 'cubic-bezier(0.55, 0, 0.8, 0.45)',
  },
  {
    transform: 'perspective(900px) rotateX(5deg)',
    offset: 0.72,
    easing: 'cubic-bezier(0.3, 0.7, 0.4, 1)',
  },
  { transform: 'perspective(900px) rotateX(0deg)' },
]

/** 내려오는 칸의 그늘 — 기운 동안 접힌 자국 쪽이 그늘지고, 다 내려오면 걷힙니다 */
const SHADE: Keyframe[] = [
  { opacity: 1 },
  { opacity: 0, offset: 0.72 },
  { opacity: 0 },
]

/** 요소의 상자 — 위치 기준 상자(부모) 안에서 잰 값입니다. 흐르는 중이면 흐르는 그 자리입니다 */
function boxIn(element: HTMLElement) {
  const own = element.getBoundingClientRect()
  const parent = (
    element.offsetParent ?? element.parentElement
  )?.getBoundingClientRect()
  return {
    top: own.top - (parent?.top ?? 0),
    left: own.left - (parent?.left ?? 0),
    width: own.width,
    height: own.height,
  }
}

type Box = ReturnType<typeof boxIn>

const px = (value: number) => `${Math.round(value * 100) / 100}px`

/** 상자를 Web Animations 의 한 장면으로 — 위치 기준 상자 안의 위치 · 크기 */
const edges = (box: Box) => ({
  top: px(box.top),
  left: px(box.left),
  width: px(box.width),
  height: px(box.height),
})

/**
 * 개인화 맞춤 향수 편지 (REC-12 · REC-13, S15P21E203-431).
 *
 * 진열대 상세 패널 윗변에 **봉투 한 통**으로 꽂혀 있다가, 누르면 봉투가 그 패널 크기로 펼쳐지며
 * (모핑) 편지가 됩니다. 예전 카드는 화면 오른쪽 끝에 붙은 세로 띠라 "알림" 으로도 "편지" 로도
 * 안 읽혔습니다.
 *
 * ── 봉투 ─────────────────────────────────────────────
 * 밀랍 봉인 · 알림 점(숨 쉬듯 번지는 고리) · 아주 느린 들썩임으로 "새 편지가 와 있다" 를 알립니다.
 * 마우스를 올리면 덮개가 살짝 들리고 속지가 고개를 내밉니다 — 누르면 열린다는 것이 모양으로 보입니다.
 * 한 번 읽은 편지는 봉인이 떨어지고 알림 점이 꺼진 채 꽂혀 있습니다(다시 펼칠 수 있습니다).
 * 취향 테스트를 안 한 사람(400)에게는 **봉하지 않은 봉투**가 꽂혀, 펼치면 테스트로 이끄는 짧은 편지가
 * 나옵니다. 추천할 것이 없으면(404 · 503) 봉투를 꽂지 않습니다 — 빈 편지는 아무 말도 안 합니다.
 *
 * ── 펼치기 — 한 칸씩 ─────────────────────────────────────
 * 봉투와 편지는 **한 상자**입니다. 누르면 덮개가 젖혀지고, 편지는 봉투에 넣느라 세 번 접은 그대로
 * (윗칸만 보이는 띠) 패널 윗자리로 옮겨 간 뒤, 가운데 칸 · 아랫칸이 **접힌 자국을 축으로 하나씩
 * 내려와** 펼쳐집니다. 예전에는 봉투가 한 번에 패널 크기로 자라서, 상세가 편지로 바뀐 것이 안
 * 읽혔습니다 — 칸이 하나씩 상세를 덮어 가야 "편지가 펼쳐졌다" 가 보입니다.
 *
 * 상자는 위치 · 크기를 재어 Web Animations 로 잇습니다(봉투 자리 → 띠 → 다 펴지면 패널 자리). 편지
 * 글은 처음부터 패널 크기로 짜 두어 옮겨 가는 동안 글줄이 다시 흐르지 않습니다. 내려오는 두 칸은 같은
 * 편지를 그린 **사본**이고(.rec-fold — 낭독기 · 탭 순서에서 빠집니다), 그동안 진짜 편지는 윗칸만 남기고
 * 잘라 둡니다. 다 펴진 사본은 진짜 편지와 같은 자리 · 같은 그림이라, 사본을 걷는 순간이 안 보입니다.
 * 접을 때는 칸을 접지 않고 봉투 자리로 곧장 줄어듭니다 — 닫는 것은 빨라야 합니다.
 *
 * ── 편지 ─────────────────────────────────────────────
 * 받는 사람 · 머리말(근거의 갈래) · 병 · 브랜드와 이름 · 근거 문장(근거가 된 향 특성에 형광펜) ·
 * 향 특성 칩(근거와 같은 것은 채움) · 자세히 보기 / 진열대에 담기 · 다른 향수 추천받기.
 * 다른 향수를 받아도 앞 편지로 돌아갈 수 있게 이 화면에 있는 동안 받은 편지를 모읍니다.
 *
 * ── 노출 기록 ──────────────────────────────────────────
 * 편지를 **펼쳤을 때** 그 편지의 손잡이로 노출을 한 번 남깁니다(recordPersonalExposure). 봉투만 보인
 * 것은 향수를 본 것이 아니라 남기지 않습니다. 남긴 병은 사흘 동안 서버의 뽑기에서 빠집니다.
 *
 * 움직임을 줄인 사용자에게는 자라지 않고 곧바로 바뀝니다. Esc · 접기 단추 · 벽에서 다른 병 고르기
 * (`closeKey`)로 접습니다. 접으면 포커스가 봉투로 돌아갑니다.
 */
export function RecommendLetter({
  result,
  isRefreshing,
  onNext,
  onShow,
  facts,
  renderSave,
  recipient,
  closeKey,
  placement = 'right',
}: Props) {
  const rootRef = useRef<HTMLDivElement>(null)
  const envelopeRef = useRef<HTMLButtonElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const middleRef = useRef<HTMLDivElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const sheetId = useId()
  const { t } = useTranslation('recommend')
  const locale = useLocale()
  const [open, setOpen] = useState(false)
  const openRef = useRef(false)
  /** 한 칸씩 펼치는 중 — 아래 두 칸의 사본이 서 있고 진짜 편지는 윗칸만 보입니다 */
  const [folding, setFolding] = useState(false)
  /** 펼치기에 건 움직임들. 펼치는 도중에 접으면 여기서 멈춥니다 */
  const unfolding = useRef<Animation[]>([])
  /** 펼치거나 접기 직전의 상자. 레이아웃 효과가 여기서 새 자리까지 잇습니다 */
  const from = useRef<Box | null>(null)
  /** 편지 글을 짜 두는 크기 — 펼친 상자(= 패널 자리)의 크기입니다 */
  const [frame, setFrame] = useState({ width: 0, height: 0 })

  /*
   * 받은 편지들. 새 편지(새 손잡이)가 오면 쌓고 그 편지를 펼쳐 보입니다. 렌더 중에 곧바로 정합니다 —
   * 효과에서 쌓으면 한 장 동안 앞 편지가 보였다 바뀝니다.
   */
  const [letters, setLetters] = useState<PersonalRecommendation[]>([])
  const [at, setAt] = useState(0)
  /*
   * "다른 향수 추천받기" 가 새 편지를 못 받았을 때의 한 줄(NEXT_NOTE). 새 편지가 오거나, 앞 · 뒤 편지로
   * 넘기거나, 편지를 펼치고 접으면 지웁니다.
   */
  // 문구가 아니라 갈래를 들고 있습니다 — 문구를 담아 두면 언어를 바꿔도 앞 언어로 남습니다
  const [nextNote, setNextNote] = useState<NextNote | null>(null)
  const latest = result?.status === 'ready' ? result.recommendation : null
  if (
    latest !== null &&
    !letters.some(
      (letter) => letter.recommendationToken === latest.recommendationToken,
    )
  ) {
    const next = [...letters, latest]
    setLetters(next)
    setAt(next.length - 1)
    setNextNote(null)
  }
  const letter = letters[at] ?? latest
  const invitation = result?.status === 'needs-taste-test'

  const toggle = useCallback((next: boolean) => {
    const root = rootRef.current
    if (root) {
      // 흐르던 중이면 흐르던 그 자리에서 되돌립니다
      from.current = boxIn(root)
      for (const animation of root.getAnimations?.() ?? []) animation.cancel()
    }
    for (const animation of unfolding.current) animation.cancel()
    unfolding.current = []
    openRef.current = next
    setOpen(next)
    setNextNote(null)
    // Web Animations 가 없으면(오래된 브라우저 · 테스트 환경) 칸을 나누지 않고 곧바로 펼칩니다
    setFolding(next && !!root?.animate && !prefersReducedMotion())
  }, [])

  /*
   * 다른 향수를 추천받습니다. 새 손잡이의 편지가 오면 위에서 쌓여 펼쳐지고, 오지 않으면 까닭을 한 줄로
   * 적습니다 — 서버가 줄 향수가 없다고 답했는지, 묻다 실패했는지(화면이 undefined 로 돌려줌).
   */
  const askNext = async () => {
    setNextNote(null)
    const before = latest?.recommendationToken
    const next = await onNext()
    if (
      next?.status === 'ready' &&
      next.recommendation.recommendationToken !== before
    ) {
      return
    }
    setNextNote(next === undefined ? 'failed' : 'none')
  }

  /*
   * 봉투 자리 → 패널 자리(또는 거꾸로). 새 상태가 칠해지기 전에 새 자리를 재어, 처음 자리에서 새 자리로
   * 위치 · 크기를 잇습니다. 펼칠 때는 덮개가 먼저 젖혀지도록 조금 늦게 출발합니다.
   */
  useLayoutEffect(() => {
    const root = rootRef.current
    const start = from.current
    from.current = null
    // Web Animations 가 없으면(오래된 브라우저 · 테스트 환경) 자라지 않고 곧바로 바뀝니다
    if (!root?.animate || !start || prefersReducedMotion()) return
    const end = boxIn(root)
    const middle = middleRef.current
    const bottom = bottomRef.current

    /*
     * 한 칸씩 펼치기 — 상자는 봉투 자리에서 **윗칸만 한 띠**로 옮겨 가 칸이 다 내려올 때까지 그 띠로
     * 머뭅니다. 움직임이 끝나면 상자가 제 자리(패널 자리)로 돌아오고, 같은 순간에 사본을 걷습니다.
     */
    if (open && middle && bottom) {
      root.style.setProperty('--fold-h', px(end.height))
      const strip = { ...end, height: end.height / 3 }
      const landed = UNFOLD.strip + UNFOLD.stagger + UNFOLD.swing
      const move = root.animate(
        [
          { ...edges(start), easing: 'cubic-bezier(0.22, 0.9, 0.24, 1)' },
          { ...edges(strip), offset: UNFOLD.strip / landed },
          edges(strip),
        ],
        { duration: landed, delay: UNFOLD.delay, fill: 'backwards' },
      )
      move.onfinish = () => setFolding(false)
      unfolding.current = [
        move,
        ...[middle, bottom].flatMap((panel, index) => {
          const timing: KeyframeAnimationOptions = {
            duration: UNFOLD.swing,
            delay: UNFOLD.delay + UNFOLD.strip + UNFOLD.stagger * index,
            fill: 'both',
          }
          const shade = panel.querySelector('.rec-fold-shade')
          return [
            panel.animate(SWING, timing),
            ...(shade ? [shade.animate(SHADE, timing)] : []),
          ]
        }),
      ]
      return
    }

    root.animate(
      [edges(start), edges(end)],
      open
        ? {
            duration: 560,
            delay: 110,
            easing: 'cubic-bezier(0.22, 0.9, 0.24, 1)',
            fill: 'backwards',
          }
        : {
            duration: 420,
            delay: 70,
            easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
            fill: 'backwards',
          },
    )
  }, [open])

  // 편지 글을 짤 크기 — 패널 자리의 크기를 따라갑니다(창 크기가 바뀌어도 펼친 편지가 맞게)
  useLayoutEffect(() => {
    const parent = rootRef.current?.parentElement
    if (!parent || typeof ResizeObserver === 'undefined') return
    const measure = () =>
      setFrame((prev) =>
        prev.width === parent.clientWidth && prev.height === parent.clientHeight
          ? prev
          : { width: parent.clientWidth, height: parent.clientHeight },
      )
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(parent)
    return () => observer.disconnect()
  }, [letter, invitation])

  // 펼치면 접기 단추로, 접으면 봉투로 포커스를 옮깁니다 — 키보드로 연 사람이 이어서 움직일 수 있게
  const moved = useRef(false)
  useEffect(() => {
    if (!moved.current) {
      moved.current = true
      return
    }
    if (open) closeRef.current?.focus({ preventScroll: true })
    else envelopeRef.current?.focus({ preventScroll: true })
  }, [open])

  // 펼친 동안만 Esc 를 듣습니다 — 접혀 있을 때도 들으면 다른 Esc(모달 닫기)와 겹칩니다
  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !event.defaultPrevented) toggle(false)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open, toggle])

  // 벽에서 다른 병을 고르면 접습니다 — 그 병의 상세가 이 편지 밑에 있습니다
  const seenCloseKey = useRef(closeKey)
  useEffect(() => {
    if (Object.is(seenCloseKey.current, closeKey)) return
    seenCloseKey.current = closeKey
    if (openRef.current) toggle(false)
  }, [closeKey, toggle])

  // 편지 속 향수가 바뀌면 화면에 알립니다 — 브랜드 · 향 특성을 채워 줍니다
  const shownId = letter?.perfumeId
  useEffect(() => {
    if (shownId !== undefined) onShow?.(shownId)
  }, [onShow, shownId])

  /*
   * 노출 기록 — 펼쳐서 **그 편지가 보였을 때** 한 번. 같은 손잡이로 두 번 보내도 서버가 한 번만 세지만,
   * 요청 자체를 아끼려고 보낸 손잡이를 기억합니다. 실패(10분이 지난 손잡이 404 등)는 조용히 넘깁니다 —
   * 기록이 한 번 빠질 뿐 편지는 그대로입니다.
   */
  const { mutate: recordExposure } = useMutation({
    mutationFn: recordPersonalExposure,
  })
  const sent = useRef(new Set<string>())
  const token = letter?.recommendationToken
  useEffect(() => {
    if (!open || token === undefined || sent.current.has(token)) return
    sent.current.add(token)
    recordExposure(token)
  }, [open, recordExposure, token])

  /*
   * 펼쳐 읽은 편지들(손잡이). 봉투 모양을 여기에 맞춥니다 — 읽은 편지의 봉투는 봉인이 떨어지고 알림
   * 점이 꺼집니다. 읽었는데도 봉인 · 알림 점이 남아 있으면 늘 "새 편지" 로 읽혀 알림이 알림 노릇을
   * 못 합니다. 새 편지가 오면 다시 봉해집니다. 펼친 채 새 편지가 와도 그 자리에서 읽은 것이라, 렌더
   * 중에 곧바로 적습니다.
   */
  const [read, setRead] = useState<ReadonlySet<string>>(() => new Set())
  if (open && token !== undefined && !read.has(token)) {
    setRead(new Set(read).add(token))
  }
  const unread = token !== undefined && !read.has(token)

  if (!letter && !invitation) return null

  const reason: PersonalReason | null = letter
    ? readPersonalReason(letter)
    : null
  const shownFacts =
    facts !== undefined && letter && facts.perfumeId === letter.perfumeId
      ? facts
      : null
  const detailHref = letter ? toPerfumeDetail(letter.perfumeId) : null
  /*
    영어 화면은 원래(영어) 이름을 이름 자리에 씁니다. 한국어 화면은 한국어 이름 위에 원래 이름을 작게
    답니다 — 한국어 이름이 없어 큰 이름이 이미 원래 이름이면 되풀이라 뺍니다.
  */
  const originalName = letter ? (letter.originalName ?? letter.name) : null
  const shownName =
    letter && originalName !== null
      ? localizedName(locale, originalName, letter.nameKo)
      : null
  const smallName =
    locale === 'ko' && shownName !== originalName ? originalName : null

  /**
   * 편지 글 한 벌. 진짜 편지와, 한 칸씩 펼치는 동안 내려오는 두 칸의 사본이 같은 글을 그립니다
   * — 사본(copy)에는 포커스 손잡이를 달지 않습니다.
   */
  const page = (copy: boolean) => (
    <div className="rec-sheet-page">
      <div className="rec-sheet-head">
        <p className="rec-kicker" lang="en">
          For you
        </p>
        <button
          ref={copy ? undefined : closeRef}
          type="button"
          aria-label={t('letter.fold')}
          className="rec-close"
          onClick={() => toggle(false)}
        >
          <svg
            aria-hidden
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
            className="size-4"
          >
            <path d="m4 4 8 8M12 4l-8 8" />
          </svg>
        </button>
      </div>

      {recipient && (
        <p className="rec-salutation font-serif">
          {t('letter.salutation', { name: recipient })}
        </p>
      )}

      {invitation ? (
        <TasteTestInvitation />
      ) : (
        letter &&
        reason &&
        detailHref && (
          /*
            편지마다 key 를 달아 새로 그립니다 — 다른 향수를 받으면 글이 한 번 떠오르며 바뀝니다.
          */
          <div key={letter.recommendationToken} className="rec-body">
            <h3 className="rec-headline font-serif">
              {t(`letter.headline.${HEADLINE[reason.source ?? 'unknown']}`)}
            </h3>

            <Link
              to={detailHref}
              state={perfumeViewState('PERSONALIZED_RECOMMENDATION')}
              className="rec-perfume"
            >
              {/* 향수병은 배경이 투명한 사진이라 상자를 그리지 않습니다 — 테두리 · 바탕 둘 다 */}
              <span className="rec-bottle">
                {letter.imageUrl ? (
                  <img src={letter.imageUrl} alt="" />
                ) : (
                  <span className="rec-bottle-empty">
                    {t('letter.photoPending')}
                  </span>
                )}
              </span>
              <span className="rec-perfume-name">
                {shownFacts?.brand && (
                  <span className="rec-brand">{shownFacts.brand}</span>
                )}
                {smallName && (
                  <span aria-hidden className="rec-name-en" lang="en">
                    {smallName}
                  </span>
                )}
                <span className="rec-name font-serif">{shownName}</span>
              </span>
            </Link>

            <ReasonLine reason={reason} />

            {shownFacts && shownFacts.accords.length > 0 && (
              <ul className="rec-accords" aria-label={t('letter.accords')}>
                {shownFacts.accords.slice(0, ACCORD_CHIPS).map((accord) => (
                  <li
                    key={accord}
                    data-match={accord === reason.keyword ? '' : undefined}
                  >
                    {accord}
                  </li>
                ))}
              </ul>
            )}

            <div className="rec-actions">
              <LinkButton
                to={detailHref}
                state={perfumeViewState('PERSONALIZED_RECOMMENDATION')}
                variant="outline"
                size="sm"
                className="rec-action"
              >
                {t('letter.viewDetails')}
              </LinkButton>
              {renderSave?.(letter.perfumeId)}
            </div>
          </div>
        )
      )}

      {!invitation && (
        <>
          <div className="rec-foot">
            {letters.length > 1 ? (
              <div className="rec-pager">
                <button
                  type="button"
                  aria-label={t('letter.previous')}
                  disabled={at <= 0}
                  onClick={() => {
                    setAt(at - 1)
                    setNextNote(null)
                  }}
                >
                  ‹
                </button>
                <span className="tabular-nums">
                  {at + 1} / {letters.length}
                </span>
                <button
                  type="button"
                  aria-label={t('letter.next')}
                  disabled={at >= letters.length - 1}
                  onClick={() => {
                    setAt(at + 1)
                    setNextNote(null)
                  }}
                >
                  ›
                </button>
              </div>
            ) : (
              <span />
            )}
            <button
              type="button"
              className="rec-next"
              disabled={isRefreshing}
              onClick={() => void askNext()}
            >
              <span
                aria-hidden
                className={cn('rec-next-icon', isRefreshing && 'animate-spin')}
              >
                ↻
              </span>
              {isRefreshing ? t('letter.refreshing') : t('letter.another')}
            </button>
          </div>
          {/*
            새 편지를 못 받았을 때의 한 줄. 알림 자리(status)는 늘 두고 글만 바꿉니다 — 자리와 글이 함께
            생기면 낭독기가 알리지 않습니다. 비어 있으면 높이가 없습니다.
          */}
          <p role="status" className="rec-note">
            {nextNote && (
              <span key={nextNote}>{t(`letter.nextNote.${nextNote}`)}</span>
            )}
          </p>
        </>
      )}

      <p aria-hidden className="rec-sign font-serif">
        {t('letter.sign')}
      </p>
    </div>
  )

  return (
    <div
      ref={rootRef}
      className="rec-letter"
      data-open={open ? '' : undefined}
      data-placement={placement}
      // 봉인 — 아직 안 읽은 편지만. 취향 테스트 전 봉투와 읽은 편지는 덮개가 조금 들린 채입니다
      data-sealed={unread ? '' : undefined}
      style={
        {
          '--letter-w': `${frame.width}px`,
          '--letter-h': `${frame.height}px`,
        } as CSSProperties
      }
    >
      {/*
        봉투 겉면. 펼친 동안에는 걷혀(투명) 누를 수 없고 탭 순서 · 낭독기에서도 빠집니다.
      */}
      <button
        ref={envelopeRef}
        type="button"
        className="rec-envelope"
        aria-expanded={open}
        aria-controls={sheetId}
        aria-label={t(
          invitation
            ? 'letter.envelope.invitation'
            : unread
              ? 'letter.envelope.unread'
              : 'letter.envelope.read',
        )}
        inert={open}
        onClick={() => toggle(true)}
      >
        <span aria-hidden className="rec-envelope-tilt">
          <span className="rec-envelope-body" />
          <span className="rec-envelope-note" />
          <span className="rec-envelope-pocket" />
          <span className="rec-envelope-flap" />
          {/* 봉인은 늘 그려 두고 CSS 가 떼어 냅니다(data-sealed) — 읽는 순간 떨어지는 움직임이 이어집니다 */}
          {!invitation && (
            <span className="rec-seal">
              <span className="rec-seal-mark font-serif">향</span>
            </span>
          )}
          <span className="rec-envelope-caption" lang="en">
            For you
          </span>
          {unread && <span className="rec-badge" />}
        </span>
      </button>

      {/*
        편지. 종이(접힌 자국)는 늘 깔아 두고, 글은 **펼친 동안만** 그립니다 — 봉투 속 글이 낭독기 ·
        탭 순서에 남지 않고, 편지 글이 떠오르는 것(0.33초 뒤)보다 먼저 그려져 있어 늦지도 않습니다.
      */}
      <section
        id={sheetId}
        aria-label={t('letter.sheet')}
        className="rec-sheet"
        data-folded={folding ? '' : undefined}
        inert={!open}
      >
        {open && page(false)}
      </section>

      {/*
        한 칸씩 펼치는 동안만 서는 가운데 칸 · 아랫칸 — 같은 편지를 그린 사본이 접힌 자국을 축으로
        내려옵니다(위 "펼치기"). 낭독기에서 빠지고 사본은 누를 수 없습니다. 칸 상자는 inert 가 아니라
        아직 안 내려온 자리를 누른 것이 편지 밑 상세로 새지 않습니다.
      */}
      {folding && (
        <div aria-hidden className="rec-fold">
          <div ref={middleRef} className="rec-fold-panel" data-panel="middle">
            <div inert className="rec-sheet">
              {page(true)}
            </div>
            <span className="rec-fold-shade" />
          </div>
          <div ref={bottomRef} className="rec-fold-panel" data-panel="bottom">
            <div inert className="rec-sheet">
              {page(true)}
            </div>
            <span className="rec-fold-shade" />
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * 근거 문장 — 근거가 된 향 특성 · 향 계열 말에 형광펜을 긋습니다. 모르는 틀이면 문장만 적습니다.
 */
function ReasonLine({ reason }: { reason: PersonalReason }) {
  const { keyword, sentence } = reason
  const at = keyword ? sentence.indexOf(keyword) : -1
  return (
    <p className="rec-reason">
      {keyword && at >= 0 ? (
        <>
          {sentence.slice(0, at)}
          <mark>{keyword}</mark>
          {sentence.slice(at + keyword.length)}
        </>
      ) : (
        sentence
      )}
    </p>
  )
}

/**
 * 취향 테스트를 안 한 사람의 편지. 서버가 테스트 없이는 추천하지 않아서(400), 비어 있는 편지 대신
 * 편지를 받는 법을 적습니다 — 진열대가 비어 있어도 테스트만으로 편지가 옵니다.
 */
function TasteTestInvitation() {
  const { t } = useTranslation('recommend')
  return (
    <div className="rec-body">
      <h3 className="rec-headline font-serif">
        {t('letter.invitation.headline')}
      </h3>
      <p className="rec-reason">{t('letter.invitation.body')}</p>
      <div className="rec-actions">
        <LinkButton to={ROUTES.TASTE_TEST} size="sm" className="rec-action">
          {t('letter.invitation.action')}
        </LinkButton>
      </div>
    </div>
  )
}
