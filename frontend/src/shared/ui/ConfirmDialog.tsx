import { useTranslation } from 'react-i18next'

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
  title,
  description,
  confirmLabel,
  isLoading = false,
  className,
}: ConfirmDialogProps) {
  const { t } = useTranslation(['layout', 'common'])

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title ?? t('confirmDialog.title')}
      className={className}
      notice
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            {t('common:actions.cancel')}
          </Button>
          <Button variant="danger" isLoading={isLoading} onClick={onConfirm}>
            {confirmLabel ?? t('common:actions.delete')}
          </Button>
        </>
      }
    >
      <p className="text-ink text-heading text-center">
        {description ?? t('confirmDialog.description')}
      </p>
    </Modal>
  )
}
