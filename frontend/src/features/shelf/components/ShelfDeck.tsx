import { Fragment, type ReactNode } from 'react'

import { cn } from '@/shared/lib/cn'

type Props = {
  /** 지금 보이는 무대의 순서 */
  index: number
  /** 무대 하나씩. 순서가 index 와 같아야 합니다 */
  children: ReactNode[]
  className?: string
}

/**
 * 진열대와 내 컬렉션이 위아래로 바뀌는 무대 (A13 재디자인)
 *
 * 화면이 고정된 한 장이라 페이지를 스크롤하지 않습니다. 하단 띠의 단추를 누르면 지금
 * 무대가 위로 빠지면서 다음 무대가 아래에서 올라옵니다. 페이지를 새로 그리지 않습니다.
 *
 * 예전에는 이 움직임이 진열대 분류(보유 중 · 시향해 봄 · 보유 희망)를 휠로 넘기는
 * 데 쓰였습니다. 분류는 이제 벽을 따라 옆으로 흐르고(ShelfWall), 위아래 움직임은
 * 진열대 ↔ 컬렉션처럼 성격이 다른 두 장을 바꿀 때만 씁니다. 휠은 받지 않습니다 —
 * 진열대 위의 휠은 벽을 흘리는 데 쓰입니다.
 *
 * 움직임을 줄이도록 설정한 사용자에게는 `shelf-display.css` 의 reduced-motion
 * 규칙이 전환을 끄고 즉시 바뀝니다.
 */
/**
 * 무대가 바뀌는 시간(ms). 이름표 바람(useTagSwing)이 떠날 때 이 시간에 맞춰 끝나서, 여기만 바꾸면
 * 둘이 함께 움직입니다. duration 클래스로 적지 않고 style 로 넣는 이유입니다.
 */
export const DECK_MS = 800

/** 진열대로 올라오는 시간(ms) — 내려갈 때보다 조금 빠릅니다. 아는 길을 되짚어 오르는 걸음입니다 */
const DECK_UP_MS = 650

/** 출발과 도착이 무른 곡선 — 층을 내려가는 몸이 처음에 망설이고 끝에 내려앉습니다 */
const DECK_EASE = 'cubic-bezier(0.65, 0, 0.35, 1)'

export function ShelfDeck({ index, children, className }: Props) {
  return (
    <div className={cn('relative overflow-clip', className)}>
      {/*
        무대 전체를 한 덩어리로 밀어 올립니다. 무대마다 따로 움직이면 둘 사이가
        벌어지거나 겹치는 순간이 생깁니다. translate 의 % 는 자기 높이(무대 한 장)
        기준이라 순서만 곱하면 됩니다.

        translate3d 로 쓰는 이유는 이 변환이 합성 단계에서만 처리되게 하려는 것입니다.
        병 이미지 스물다섯 장이 든 무대라, 매 프레임 레이아웃을 다시 재면 눈에 띄게 끊깁니다.
      */}
      {/*
        시안: 무대 사이에 바닥 들보(위층 바닥 = 아래층 천장)가 한 장 끼어 같은 판으로 움직입니다. 들보 맨 아래의
        천장판(--deck-board-h)은 아래 무대 윗머리에 걸칩니다 — 그래서 한 칸을 옮길 때 무대 한 장(100%)에
        들보 높이(--deck-beam-h)를 더하고 천장판만큼 덜 밉니다. 컬렉션 무대에 서면 들보의 까만 멍에가 헤더
        자리를 채우고 천장판은 헤더 바로 아래에 보입니다.
      */}
      <div
        className="h-full transition-transform"
        style={{
          transform: `translate3d(0, calc(${-index} * (100% + var(--deck-beam-h) - var(--deck-board-h))), 0)`,
          transitionDuration: `${index > 0 ? DECK_MS : DECK_UP_MS}ms`,
          transitionTimingFunction: DECK_EASE,
        }}
      >
        {children.map((stage, at) => (
          // 무대는 고정 두 장이고 순서가 바뀌지 않아서 순서를 key 로 씁니다
          <Fragment key={at}>
            {at > 0 && <div aria-hidden className="shelf-deck-beam" />}
            <div
              className="h-full"
              // 안 보이는 무대는 낭독기와 탭 이동에서 빼야 합니다
              aria-hidden={at !== index}
              inert={at !== index}
            >
              {stage}
            </div>
          </Fragment>
        ))}
      </div>
    </div>
  )
}
