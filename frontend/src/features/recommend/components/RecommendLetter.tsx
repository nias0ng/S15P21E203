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
import { Link } from 'react-router'

import { perfumeViewState } from '@/shared/config/perfumeViewSource'
import { ROUTES, toPerfumeDetail } from '@/shared/config/routes'
import { cn } from '@/shared/lib/cn'
import { LinkButton } from '@/shared/ui/LinkButton'

import { recordPersonalExposure } from '../api'
import {
  readPersonalReason,
  type PersonalReason,
  type PersonalReasonSource,
} from '../personalReason'
import type {
  PersonalRecommendation,
  PersonalRecommendationResult,
} from '../types'

/**
 * 편지에 곁들이는 향수 정보. 추천 응답에는 이름 · 사진 · 근거 한 문장뿐이라, 화면이 향수 상세 ·
 * 향조로 채워 넘깁니다(추천 도메인은 향수 도메인을 모릅니다).
 */
export type LetterFacts = {
  perfumeId: number
  brand: string | null
  /** 영문 이름. 한국어 이름 위에 작게 답니다 — 이름이 영어뿐이면 null 로 넘기세요 */
  nameEn: string | null
  /** 두드러진 순서의 향 특성(한국어). 앞의 몇 개만 칩으로 적습니다 */
  accords: string[]
}

type Props = {
  /** 개인화 추천을 부른 결과(personalRecommendationQuery). 아직 없거나 추천이 없으면 아무것도 안 그립니다 */
  result: PersonalRecommendationResult | undefined
  /** 다른 향수를 받는 중 */
  isRefreshing: boolean
  /** 다른 향수를 추천받습니다 — 서버에 다시 묻습니다. 본 병은 사흘 동안 빠져 대개 다른 병이 옵니다 */
  onNext: () => void
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
const HEADLINE: Record<PersonalReasonSource | 'unknown', string> = {
  FIT: '마음에 든 향과 닮은 향수를 찾았어요',
  RECENT: '요즘 자주 들여다본 결을 담은 향수예요',
  TASTE: '취향 테스트가 고른 향수가 도착했어요',
  unknown: '당신을 위한 향수가 도착했어요',
}

const prefersReducedMotion = () =>
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false

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
 * ── 펼치기 (모핑) ─────────────────────────────────────────
 * 봉투와 편지는 **한 상자**입니다. 누르면 덮개가 젖혀지고, 상자가 봉투 자리에서 패널 자리까지 자라며
 * (위치 · 크기를 재어 Web Animations 로 잇습니다 — 처음 잰 자리에서 끝 자리로), 봉투 겉면이 걷히고
 * 편지 글이 떠오릅니다. 편지에는 봉투에 넣느라 세 번 접었던 **접힌 자국** 두 줄이 남아 있습니다.
 * 접을 때는 거꾸로 봉투 자리로 줄어듭니다. 편지 글은 처음부터 패널 크기로 짜 두고 상자가 그만큼
 * 드러내기만 해서, 자라는 동안 글줄이 다시 흐르지 않습니다.
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
  const sheetId = useId()
  const [open, setOpen] = useState(false)
  const openRef = useRef(false)
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
    openRef.current = next
    setOpen(next)
  }, [])

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
    root.animate(
      [
        {
          top: px(start.top),
          left: px(start.left),
          width: px(start.width),
          height: px(start.height),
        },
        {
          top: px(end.top),
          left: px(end.left),
          width: px(end.width),
          height: px(end.height),
        },
      ],
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
    ? readPersonalReason(letter.reason)
    : null
  const shownFacts =
    facts !== undefined && letter && facts.perfumeId === letter.perfumeId
      ? facts
      : null
  const detailHref = letter ? toPerfumeDetail(letter.perfumeId) : null

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
        aria-label={
          invitation
            ? '맞춤 향수 편지 받는 법 보기 — 취향 테스트를 마치면 편지가 도착해요'
            : unread
              ? '새로 온 향수 편지 열기'
              : '향수 편지 다시 열기'
        }
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
        aria-label="당신을 위한 향수 편지"
        className="rec-sheet"
        inert={!open}
      >
        {open && (
          <div className="rec-sheet-page">
            <div className="rec-sheet-head">
              <p className="rec-kicker" lang="en">
                For you
              </p>
              <button
                ref={closeRef}
                type="button"
                aria-label="편지 접기"
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
              <p className="rec-salutation font-serif">{recipient}님께</p>
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
                    {HEADLINE[reason.source ?? 'unknown']}
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
                        <span className="rec-bottle-empty">사진 준비 중</span>
                      )}
                    </span>
                    <span className="rec-perfume-name">
                      {shownFacts?.brand && (
                        <span className="rec-brand">{shownFacts.brand}</span>
                      )}
                      {shownFacts?.nameEn && (
                        <span aria-hidden className="rec-name-en" lang="en">
                          {shownFacts.nameEn}
                        </span>
                      )}
                      <span className="rec-name font-serif">{letter.name}</span>
                    </span>
                  </Link>

                  <ReasonLine reason={reason} />

                  {shownFacts && shownFacts.accords.length > 0 && (
                    <ul className="rec-accords" aria-label="이 향수의 향 특성">
                      {shownFacts.accords
                        .slice(0, ACCORD_CHIPS)
                        .map((accord) => (
                          <li
                            key={accord}
                            data-match={
                              accord === reason.keyword ? '' : undefined
                            }
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
                      자세히 보기
                    </LinkButton>
                    {renderSave?.(letter.perfumeId)}
                  </div>
                </div>
              )
            )}

            {!invitation && (
              <div className="rec-foot">
                {letters.length > 1 ? (
                  <div className="rec-pager">
                    <button
                      type="button"
                      aria-label="앞 편지"
                      disabled={at <= 0}
                      onClick={() => setAt(at - 1)}
                    >
                      ‹
                    </button>
                    <span className="tabular-nums">
                      {at + 1} / {letters.length}
                    </span>
                    <button
                      type="button"
                      aria-label="다음 편지"
                      disabled={at >= letters.length - 1}
                      onClick={() => setAt(at + 1)}
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
                  onClick={onNext}
                >
                  <span
                    aria-hidden
                    className={cn(
                      'rec-next-icon',
                      isRefreshing && 'animate-spin',
                    )}
                  >
                    ↻
                  </span>
                  {isRefreshing ? '새 편지를 봉하는 중' : '다른 향수 추천받기'}
                </button>
              </div>
            )}

            <p aria-hidden className="rec-sign font-serif">
              향해 드림
            </p>
          </div>
        )}
      </section>
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
  return (
    <div className="rec-body">
      <h3 className="rec-headline font-serif">
        아직 당신의 취향을 몰라서 편지를 못 썼어요
      </h3>
      <p className="rec-reason">
        좋아하는 향 계열 몇 개만 고르면, 진열대에 매긴 적합도와 요즘 살펴본
        향수까지 함께 읽어 맞춤 향수를 골라 보내 드려요.
      </p>
      <div className="rec-actions">
        <LinkButton to={ROUTES.TASTE_TEST} size="sm" className="rec-action">
          취향 테스트 하러 가기
        </LinkButton>
      </div>
    </div>
  )
}
