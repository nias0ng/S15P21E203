import { ROUTES } from '@/shared/config/routes'
import { cn } from '@/shared/lib/cn'
import { withReturnPath } from '@/shared/lib/returnPath'
import { Button } from '@/shared/ui/Button'
import { LinkButton } from '@/shared/ui/LinkButton'
import { Modal } from '@/shared/ui/Modal'

type Props = {
  open: boolean
  onClose: () => void
  redirectTo?: string
  description?: React.ReactNode
  /** 3D 향 지도 위(메인의 부표 카드) — 엔진 카드와 같은 저녁 유리판에 좁고 작게 섭니다 */
  scene?: boolean
}

export function LoginRequiredDialog({
  open,
  onClose,
  redirectTo,
  description = '추천 결과는 로그인 없이도 볼 수 있습니다.',
  scene = false,
}: Props) {
  const withRedirect = (path: string) => withReturnPath(path, redirectTo)

  const actions = (
    <>
      <Button variant="ghost" onClick={onClose}>
        취소
      </Button>
      <LinkButton variant="outline" to={withRedirect(ROUTES.SIGNUP)}>
        회원가입
      </LinkButton>
      <LinkButton
        variant={scene ? 'navy' : 'primary'}
        to={withRedirect(ROUTES.LOGIN)}
      >
        로그인
      </LinkButton>
    </>
  )

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="로그인이 필요합니다"
      className={scene ? 'scent-map-panel rounded-glass w-95' : undefined}
      initialFocus={scene ? 'panel' : 'first'}
      titleSize={scene ? 'heading' : 'title'}
      footer={scene ? undefined : actions}
    >
      <p className={cn('text-body', scene ? 'text-ink-muted' : 'text-ink')}>
        {description}
      </p>
      {scene && (
        <div className="mt-3.75 flex justify-end gap-2.5">{actions}</div>
      )}
    </Modal>
  )
}
