import { useNavigate } from 'react-router'

import { ROUTES } from '@/shared/config/routes'
import { Button } from '@/shared/ui/Button'
import { Modal } from '@/shared/ui/Modal'

type Props = {
  open: boolean
  onClose: () => void
  /** 로그인 후 돌아올 경로. 지정하지 않으면 로그인 화면 기본 동작을 따릅니다. */
  redirectTo?: string
}

/**
 * 로그인 유도 모달 (와이어프레임 C01 우측)
 *
 * 비로그인 사용자가 저장 · 작성 · 등록을 시도할 때 띄웁니다.
 * 추천 결과 자체는 로그인 없이도 볼 수 있다는 안내를 함께 보여줍니다(MAP-16).
 *
 * 회원가입 진입을 함께 두기로 **확정**되었습니다. 계정이 없는 사용자가 취소밖에
 * 누를 것이 없으면 여기서 이탈합니다.
 */
export function LoginRequiredDialog({ open, onClose, redirectTo }: Props) {
  const navigate = useNavigate()

  // 로그인 후 원래 하려던 자리로 돌아오게 합니다. 회원가입도 같은 값을 들고 갑니다.
  const withRedirect = (path: string) =>
    redirectTo ? `${path}?redirectTo=${encodeURIComponent(redirectTo)}` : path

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
          <Button
            variant="outline"
            onClick={() => navigate(withRedirect(ROUTES.SIGNUP))}
          >
            회원가입
          </Button>
          <Button onClick={() => navigate(withRedirect(ROUTES.LOGIN))}>
            로그인
          </Button>
        </>
      }
    >
      <p className="text-ink text-xs">
        추천 결과는 로그인 없이도 볼 수 있습니다.
      </p>
    </Modal>
  )
}
