import { Badge } from '@/shared/ui/Badge'
import { Button } from '@/shared/ui/Button'
import { Thumbnail } from '@/shared/ui/Thumbnail'

import type { PerfumeDetail } from '../types'

type Props = {
  perfume: PerfumeDetail
  /**
   * 이 향수가 이미 내 진열대에 있는지. 단추가 [진열대 저장] ↔ [진열대 해제] 로 바뀝니다.
   *
   * 비로그인이면 알 길이 없으므로 늘 false 입니다 — 그때 누르면 로그인 유도가 뜹니다.
   */
  inShelf: boolean
  /**
   * 진열대에 있는지 **아직 모르는 동안**(내 진열대를 받는 중).
   *
   * 이때는 단추를 잠급니다. 모르는 채로 [저장] 이라고 적어 두면 이미 담은 향수인데
   * 담기 모달이 열리고, 분류까지 고른 뒤 409 로 튕겨 사용자가 한 일이 버려집니다.
   */
  shelfPending?: boolean
  /** 위 단추를 눌렀을 때. 담을지 뺄지는 화면이 정합니다 */
  onShelfAction: () => void
  /**
   * 사진 오른쪽, 이름 아래 남는 자리에 놓을 것.
   *
   * 사진이 400 인데 브랜드 · 이름 · 단추는 그 절반도 안 써서 오른쪽 아래가 크게
   * 비었습니다. 향조(DTL-02)가 짧은 구역이라 그 자리에 들어갑니다.
   *
   * 무엇이 올지는 화면이 정합니다 — 이 컴포넌트는 자리만 내어 줍니다.
   */
  aside?: React.ReactNode
}

/**
 * 향수 상세 ① 기본 정보 + 액션 (와이어프레임 A10 — DTL-01 · 02)
 *
 * 도메인 안이라 PerfumeDetail 타입을 그대로 받습니다. shared/ui 였다면 ESLint 가
 * 막았겠지만, 여기서는 도메인을 알아도 됩니다.
 *
 * **이 구역 자체는 유리판에 올리지 않습니다.** 판을 다섯 장 쌓으면 화면이 판으로만
 * 채워져 층이 안 읽힙니다. 사진과 이름은 어두운 방에 바로 놓여 제목 역할을 하고,
 * 판은 그 아래 내용 구역부터 시작합니다 — 다만 사진 오른쪽에 남는 자리에는
 * `aside` 로 판 하나가 들어옵니다.
 */
export function PerfumeOverview({
  perfume,
  inShelf,
  shelfPending = false,
  onShelfAction,
  aside,
}: Props) {
  /*
    영문 이름은 한국어 이름이 있을 때만 따로 적습니다. 없으면 아래 제목이 이미
    영문이라, 위에 또 적으면 같은 글자가 두 줄로 늘어섭니다.
  */
  const hasKoreanName = perfume.nameKo !== null

  return (
    <section className="flex flex-col gap-7.5 sm:flex-row">
      {/*
        상세 응답의 images 는 배열이고 대표 이미지는 첫 번째 원소입니다.

        `contain` 인 이유: 향수병 사진은 세로로 긴데 `cover` 는 상자를 꽉 채우려고
        넘치는 쪽을 잘라내서, 병의 뚜껑과 바닥이 날아갔습니다. `contain` 은 긴 쪽을
        상자에 맞추므로 병이 통째로 들어옵니다. 상자를 3:4 로 세워 두면 남는 여백도
        거의 없습니다.
      */}
      <Thumbnail
        src={perfume.images[0] ?? null}
        fallback="대표 이미지"
        fit="contain"
        /*
          ⚠️ **색 토큰이 아니라 `bg-white` 인 이유가 있습니다.** 향수병은 배경이
          투명한 PNG 라 상자 색이 그대로 병 뒤로 비칩니다. 그런데 이 화면의 색
          토큰은 어두운 방(`.scent-night`)에서 전부 어둡게 재정의됩니다 —
          `bg-surface-sunken` 은 아이보리로 남아 병 뒤가 누렇고,
          `bg-surface-card` 를 쓰면 `--night-soft`(#362f26) 로 뒤집혀 캄캄해집니다.
          제품 사진 뒤는 테마와 무관하게 늘 흰색이어야 해서 토큰을 타지 않습니다.
        */
        className="h-100 w-75 shrink-0 bg-white"
      />

      {/*
        오른쪽 칸. 이름 묶음은 제 높이만 쓰고, `aside` 가 `flex-1` 로 남은 높이를
        받아 사진 아래끝에 맞춰 섭니다 — 판 아래가 붕 뜨면 사진과 판이 서로 다른
        줄에 선 것처럼 보입니다.
      */}
      <div className="flex flex-1 flex-col gap-6.25">
        <div className="space-y-2.5">
          {/*
          브랜드명과 영문 향수명은 **바짝 붙입니다.** 바깥 간격(10px)을 그대로 두면
          두 줄이 따로 놓인 정보처럼 읽히는데, 둘은 "무엇의 무엇" 한 덩이입니다.
          카드의 이름 묶음(`TileCard`)과 같은 2px 입니다.
        */}
          <div className="space-y-0.5">
            {/* 검색은 brandName 문자열, 상세는 brand 객체입니다 */}
            <p className="text-ink-muted text-caption">{perfume.brand?.name}</p>

            {hasKoreanName && (
              <p className="text-ink-muted text-caption">{perfume.name}</p>
            )}
          </div>

          <h1 className="text-ink text-display font-serif font-semibold">
            {perfume.nameKo ?? perfume.name}
          </h1>

          {perfume.concentration && (
            <div className="flex flex-wrap gap-1.25">
              <Badge tone="outline">{perfume.concentration}</Badge>
            </div>
          )}

          {/*
            담긴 향수는 같은 자리에서 [진열대 해제] 가 됩니다. [빼기] 단추를 옆에
            따로 두지 않는 이유: 둘이 나란히 있으면 지금 담겨 있는지를 단추만 보고
            알 수 없고, 담은 적 없는 향수에도 뺄 수 없는 단추가 하나 붙습니다.

            해제는 되돌릴 수 없어(메모 · 적합도가 함께 지워집니다) `outline` 으로 한
            단 내립니다. 담기는 이 화면이 권하는 일이라 primary 그대로입니다.
          */}
          <Button
            variant={inShelf ? 'outline' : 'primary'}
            isLoading={shelfPending}
            onClick={onShelfAction}
          >
            {inShelf ? '진열대 해제' : '진열대 저장'}
          </Button>
        </div>

        {aside}
      </div>
    </section>
  )
}
