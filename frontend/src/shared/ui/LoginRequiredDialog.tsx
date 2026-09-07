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
 * 와이어프레임 주석: "md에 문구 지정 없음 — 회원가입 진입을 함께 둘지 확인 필요".
 * 지금은 로그인 버튼만 두었습니다.
 */
export function LoginRequiredDialog({ open, onClose, redirectTo }: Props) {
  const navigate = useNavigate()

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="로그인이 필요합니다"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            취소
          </Button>
          <Button
            onClick={() =>
              navigate(
                redirectTo
                  ? `${ROUTES.LOGIN}?redirectTo=${encodeURIComponent(redirectTo)}`
                  : ROUTES.LOGIN,
              )
            }
          >
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
