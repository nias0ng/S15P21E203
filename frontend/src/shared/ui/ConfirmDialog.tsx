import { Button } from '@/shared/ui/Button'
import { Modal } from '@/shared/ui/Modal'

type ConfirmDialogProps = {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  /** 기본값은 와이어프레임 C01 문구입니다. 대상 이름을 넣으려면 넘겨주세요. */
  title?: string
  description?: string
  confirmLabel?: string
  /** 되돌릴 수 없는 동작이면 true (기본). false 면 확인 버튼이 primary 로 바뀝니다. */
  destructive?: boolean
  isLoading?: boolean
  /**
   * 판의 겉모습. 3D 향 지도 위에서 뜨는 확인은 `scent-map-panel` 을 넘겨 어두운 유리로
   * 맞춥니다 — 기본 상아색 종이로 두면 남색 판 위에 흰 종이가 한 장 끼어듭니다.
   */
  className?: string
}

/**
 * 삭제 확인 모달 (C01 — 7곳 공용). 대상 이름을 문구에 넣을지는 팀 확정 전이라
 * prop 으로 열어 두었습니다.
 */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title = '삭제할까요?',
  description = '삭제하면 되돌릴 수 없습니다.',
  confirmLabel = '삭제',
  destructive = true,
  isLoading = false,
  className,
}: ConfirmDialogProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      className={className}
      /* 안내 모양(가운데 정렬)이되 단추는 다른 모달과 같은 오른쪽 아래입니다 */
      notice
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            취소
          </Button>
          <Button
            variant={destructive ? 'danger' : 'primary'}
            isLoading={isLoading}
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      {/* 무엇을 되돌릴 수 없는지 말하는 유일한 자리라 한 단 키웁니다(`heading`) */}
      <p className="text-ink text-heading text-center">{description}</p>
    </Modal>
  )
}
