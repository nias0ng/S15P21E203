import { ROUTES } from '@/shared/config/routes'
import { withReturnPath } from '@/shared/lib/returnPath'
import { Button } from '@/shared/ui/Button'
import { LinkButton } from '@/shared/ui/LinkButton'
import { Modal } from '@/shared/ui/Modal'

type Props = {
  open: boolean
  onClose: () => void
  redirectTo?: string
  description?: React.ReactNode
}

export function LoginRequiredDialog({
  open,
  onClose,
  redirectTo,
  description = '추천 결과는 로그인 없이도 볼 수 있습니다.',
}: Props) {
  const withRedirect = (path: string) => withReturnPath(path, redirectTo)

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="로그인이 필요합니다"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            취소
          </Button>
          <LinkButton variant="outline" to={withRedirect(ROUTES.SIGNUP)}>
            회원가입
          </LinkButton>
          <LinkButton to={withRedirect(ROUTES.LOGIN)}>로그인</LinkButton>
        </>
      }
    >
      <p className="text-ink text-body">{description}</p>
    </Modal>
  )
}
