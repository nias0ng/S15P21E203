import { Button } from '@/shared/ui/Button'
import { Modal } from '@/shared/ui/Modal'

import { familyAdjective } from '../families'
import type { TasteMatch } from '../types'

type TasteResultModalProps = {
  open: boolean
  match: TasteMatch | null
  /** 다시 하기 · Esc · 배경 클릭 — 모달만 닫고 계열 선택 화면에 머무릅니다 */
  onRetry: () => void
  /** 확인 — 결과를 저장하고 향 지도로 이동합니다 */
  onConfirm: () => void
  /** 저장하는 동안 확인 단추를 잠급니다 */
  saving?: boolean
  /** 저장이 실패했을 때 할 말. 확인을 다시 누르면 다시 보냅니다 */
  saveError?: string | null
}

const CLOSING = '내 취향을 향 지도에서 확인하러 가볼까요?'

/** 모드별 제목. 모달 제목 자리에 들어갑니다. */
function headlineOf(match: TasteMatch): string {
  switch (match.mode) {
    case 'RARE':
      return '흔치 않은 조합을 고르셨네요'
    case 'NO_OVERLAP':
      return '두 향을 함께 담은 향수가 아직 없어요'
    default:
      return '가장 가까운 향수예요'
  }
}

/** 모드별 설명 한 문단. 고른 계열의 형용사를 그대로 문장에 씁니다. */
function leadOf(match: TasteMatch): string {
  const [first, second] = match.picks

  if (match.mode === 'RARE') {
    return '두 향을 함께 담은 향수는 지도에 하나뿐이에요. 그 향수가 지금 취향을 대표합니다.'
  }

  if (match.mode === 'NO_OVERLAP' && first && second) {
    return (
      `1순위로 고르신 ${familyAdjective(first)} 향에 맞춰 출발점을 잡았어요. ` +
      `2순위로 고르신 ${familyAdjective(second)} 향은 이번 결과에 반영되지 않았습니다.`
    )
  }

  if (!first) return ''

  return second
    ? `1순위로 고르신 ${familyAdjective(first)} 향이 더 진하게 살아 있는 향수를 찾았어요.`
    : `고르신 ${familyAdjective(first)} 향이 가장 진하게 살아 있는 향수를 찾았어요.`
}

/**
 * 취향 테스트 결과 모달 (TST-03)
 *
 * 지도 위가 아니라 **계열 선택 화면 위**에 뜹니다. 확인을 눌러야 향 지도로 넘어갑니다.
 * 향수 이름 · 지도 미리보기는 넣지 않습니다 — 실제 향수와 출발점은 지도에서 봅니다.
 *
 * `shared/ui/Modal` 이 네이티브 `<dialog>` 라 포커스 가두기 · Esc · 배경 스크롤 잠금은
 * 브라우저가 처리합니다. 닫기(×)와 Esc 는 "다시 하기" 와 같은 동작입니다.
 */
export function TasteResultModal({
  open,
  match,
  onRetry,
  onConfirm,
  saving = false,
  saveError = null,
}: TasteResultModalProps) {
  if (!match) return null

  return (
    <Modal
      open={open}
      onClose={onRetry}
      title={headlineOf(match)}
      footer={
        <>
          <Button variant="outline" onClick={onRetry} disabled={saving}>
            다시 하기
          </Button>
          <Button onClick={onConfirm} isLoading={saving}>
            {saveError === null ? '확인' : '다시 시도'}
          </Button>
        </>
      }
    >
      <p className="text-ink">{leadOf(match)}</p>
      <p className="text-ink-muted mt-4">{CLOSING}</p>
      {/*
        저장이 실패해도 결과 문구는 그대로 둡니다 — 고른 것과 뽑힌 향수는 화면에서
        이미 정해졌고, 못 한 것은 그것을 서버에 남기는 일뿐입니다.
      */}
      {saveError !== null && (
        <p role="alert" className="text-danger mt-4">
          {saveError}
        </p>
      )}
    </Modal>
  )
}
