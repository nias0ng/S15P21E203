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
}

/**
 * 삭제 확인 모달 (와이어프레임 C01 — 7곳 공용)
 *
 * ⚠️ 대상 이름을 문구에 넣을지는 팀 확정 전입니다. prop 으로 열어두고 기본값만
 * 채웠으니, 정해지면 기본값을 바꾸거나 호출부에서 넘기면 됩니다.
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
}: ConfirmDialogProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
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
      <p className="text-ink text-body">{description}</p>
    </Modal>
  )
}
