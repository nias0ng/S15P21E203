import { useIsRising } from '@/shared/store/diveStore'

/**
 * 진열대 종이 — 시안의 종이 바탕과 질감. 진열대(MyShelfPage)와 컬렉션 상세가 같이 깔아서, 진열함을
 * 눌러 상세로 넘어가도 같은 종이 위에 섭니다. `.shelf-scope` 안에 둡니다(팔레트가 거기 있습니다).
 *
 * fixed 로 뷰포트를 통째로 덮습니다 — 본문 div 에만 배경을 깔면 좌우 여백과 화면 아래쪽이 body 의
 * ivory 로 남아 종이 한 장 느낌이 끊깁니다. -z-10 이라 본문 뒤, 헤더(bg-surface · z-20) 아래에
 * 깔립니다.
 *
 * 질감(shelf-grain)을 본문이 아니라 이 레이어에 얹는 이유: 노이즈는 mix-blend-mode 로 밑을
 * 곱하는데, 본문 위에 두면 새 쌓임 맥락이 생겨 Toast(fixed)와 모달이 그 아래로 밀립니다.
 */
export function ShelfPaper() {
  // 메인으로 떠오르는 중인가(헤더 로고). useIsDiving 은 들어올 때도 참이라 쓰지 않습니다
  const rising = useIsRising()

  return (
    <div
      aria-hidden
      className="shelf-paper shelf-grain fixed inset-0 -z-10"
      data-rising={rising ? '' : undefined}
    >
      {/*
        떠오르기 시작하면 **모래에서 멀어집니다** — 사이의 물이 두꺼워져 바닥이 한 단 가라앉습니다.
        커튼이 위에서 덮기 전 0.3초 동안 화면에서 움직이는 것이 이것 하나입니다 (나가는 길에서
        카메라가 먼저 고개를 숙이는 것과 같은 자리).
      */}
      <i className="shelf-deepen" />
      {/*
        수면 물결이 모래에 드리우는 빛 — 잠수해서 들어온 이 화면이 "얕은 물에 비치는 모래" 로
        읽히게 하는 겹입니다. 종이 위 · 결 아래 · 내용 뒤(-z-10)이고, 움직이는 것은 transform
        하나뿐입니다. 값과 까닭은 shelf-display.css 의 .shelf-caustic 에 있습니다.
      */}
      <i className="shelf-caustic" />
    </div>
  )
}
