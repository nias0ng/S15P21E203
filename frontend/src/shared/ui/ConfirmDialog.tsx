import { Button } from '@/shared/ui/Button'
import { Modal } from '@/shared/ui/Modal'

type ConfirmDialogProps = {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  title?: string
  description?: string
  confirmLabel?: string
  isLoading?: boolean
  className?: string
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title = '삭제할까요?',
  description = '삭제하면 되돌릴 수 없습니다.',
  confirmLabel = '삭제',
  isLoading = false,
  className,
}: ConfirmDialogProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      className={className}
      notice
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            취소
          </Button>
          <Button variant="danger" isLoading={isLoading} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p className="text-ink text-heading text-center">{description}</p>
    </Modal>
  )
}
