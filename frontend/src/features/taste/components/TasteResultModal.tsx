import { Button } from '@/shared/ui/Button'
import { Modal } from '@/shared/ui/Modal'

import { familyAdjective } from '../families'
import type { TasteMatch } from '../types'

type TasteResultModalProps = {
  /** `null` 이면 닫혀 있습니다 */
  match: TasteMatch | null
  /** 다시 하기 · Esc · 배경 클릭 — 모달만 닫고 계열 선택 화면에 머무릅니다 */
  onRetry: () => void
  onConfirm: () => void
  saving: boolean
  /** 확인을 다시 누르면 저장을 다시 보냅니다 */
  saveError: string | null
}

const CLOSING = '향 지도에서 내 출발점을 확인해 보세요.'

function headlineOf(match: TasteMatch): string {
  switch (match.mode) {
    case 'RARE':
      return '흔치 않은 조합을 고르셨네요'
    case 'NO_OVERLAP':
      return '1순위 향으로 출발점을 잡았어요'
    default:
      return '출발점을 찾았어요'
  }
}

function leadOf(match: TasteMatch): string {
  const [first, second] = match.picks

  if (match.mode === 'RARE') {
    return '두 향을 함께 담은 향수는 향 지도에 하나뿐이에요. 그 한 병이 지금 취향을 대표해요.'
  }

  if (match.mode === 'NO_OVERLAP' && first && second) {
    return (
      `1순위로 고르신 ${familyAdjective(first)} 향에 맞춰 출발점을 잡았어요. ` +
      `2순위로 고르신 ${familyAdjective(second)} 향은 이번 결과에는 반영되지 않았어요.`
    )
  }

  if (!first) return ''

  return second
    ? `1순위로 고르신 ${familyAdjective(first)} 향이 더 진하게 살아 있는 향수를 찾았어요.`
    : `고르신 ${familyAdjective(first)} 향이 가장 진하게 살아 있는 향수를 찾았어요.`
}

/**
 * 취향 테스트 결과 모달 (TST-03). 향수 이름 · 지도 미리보기는 넣지 않습니다 — 그건 지도에서 봅니다.
 */
export function TasteResultModal({
  match,
  onRetry,
  onConfirm,
  saving,
  saveError,
}: TasteResultModalProps) {
  if (!match) return null

  return (
    <Modal
      open
      onClose={onRetry}
      title={headlineOf(match)}
      footer={
        <>
          <Button variant="outline" onClick={onRetry} disabled={saving}>
            다시 하기
          </Button>
          <Button onClick={onConfirm} isLoading={saving}>
            {saveError === null ? '향 지도로 가기' : '다시 시도'}
          </Button>
        </>
      }
    >
      <p className="text-ink">{leadOf(match)}</p>
      <p className="text-ink-muted mt-4">{CLOSING}</p>
      {/* 저장이 실패해도 결과 문구는 그대로 둡니다 — 뽑힌 향수는 화면에서 이미 정해졌습니다 */}
      {saveError !== null && (
        <p role="alert" className="text-danger mt-4">
          {saveError}
        </p>
      )}
    </Modal>
  )
}
