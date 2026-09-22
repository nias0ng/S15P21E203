import { useNavigate } from 'react-router'

import { ROUTES } from '@/shared/config/routes'
import { withReturnPath } from '@/shared/lib/returnPath'
import { Button } from '@/shared/ui/Button'
import { Modal } from '@/shared/ui/Modal'

type Props = {
  open: boolean
  onClose: () => void
  /** 로그인 후 돌아올 경로. 지정하지 않으면 로그인 화면 기본 동작을 따릅니다. */
  redirectTo?: string
  /**
   * 이 자리에서 로그인이 왜 필요한지 한 줄. 기본 문구는 향수를 보던 사람에게 하는
   * 말이라, 게시판 · 진열대에서는 그 자리에 맞는 말을 넘기세요.
   */
  description?: React.ReactNode
}

/**
 * 로그인 유도 모달 (C01 우측). 회원가입 진입을 함께 두는 이유: 계정이 없는 사람이
 * 취소밖에 누를 게 없으면 여기서 이탈합니다.
 */
export function LoginRequiredDialog({
  open,
  onClose,
  redirectTo,
  description = '추천 결과는 로그인 없이도 볼 수 있습니다.',
}: Props) {
  const navigate = useNavigate()

  /*
    주소를 직접 짜지 않고 `withReturnPath` 에 맡깁니다 — 쿼리 이름을 이 파일이 따로
    적고 로그인 화면은 `location.state.from` 을 읽어, 경로가 늘 버려졌습니다.
  */
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
      <p className="text-ink text-body">{description}</p>
    </Modal>
  )
}
