import { Button } from '@/shared/ui/Button'
import { Input } from '@/shared/ui/Input'
import { Modal } from '@/shared/ui/Modal'

type Props = { open: boolean; onClose: () => void }

/**
 * 비밀번호 변경 모달 (와이어프레임 A30 좌측 — A29 [비밀번호 변경] 도착)
 *
 * A29 주석: 비밀번호는 정보 변경 화면에 표시하지 않고 변경은 이 모달로만 합니다.
 * 비밀번호 정책 검증은 A28 회원가입과 같은 규칙입니다.
 */
export function PasswordChangeModal({ open, onClose }: Props) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="비밀번호 변경"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            취소
          </Button>
          <Button type="submit" form="password-change-form">
            변경
          </Button>
        </>
      }
    >
      <form
        id="password-change-form"
        className="space-y-2.5"
        onSubmit={(event) => {
          event.preventDefault()
          // TODO: 비밀번호 변경 API 연결
        }}
      >
        <Input
          label="현재 비밀번호"
          hideLabel
          type="password"
          autoComplete="current-password"
          placeholder="현재 비밀번호"
          required
        />
        <Input
          label="새 비밀번호"
          hideLabel
          type="password"
          autoComplete="new-password"
          placeholder="새 비밀번호"
          required
        />
        <Input
          label="새 비밀번호 확인"
          hideLabel
          type="password"
          autoComplete="new-password"
          placeholder="새 비밀번호 확인"
          required
        />
        <p className="text-ink-muted text-[10.5px]">
          비밀번호 정책 검증 — A28 회원가입과 같은 규칙
        </p>
      </form>
    </Modal>
  )
}
