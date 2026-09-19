import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useNavigate } from 'react-router'

import { isApiError } from '@/shared/api/http'
import { ROUTES } from '@/shared/config/routes'
import { useAuthStore } from '@/shared/store/authStore'
import { Button } from '@/shared/ui/Button'
import { Input } from '@/shared/ui/Input'
import { Modal } from '@/shared/ui/Modal'

import { changePassword } from '../api'
import { PASSWORD_MIN_LENGTH } from '../types'

type Props = { open: boolean; onClose: () => void }

/**
 * 비밀번호 변경 모달 (A30 좌측 — A29 [비밀번호 변경] 도착)
 *
 * **새 비밀번호 확인란은 서버로 보내지 않습니다.** 현재 비밀번호가 틀리면 400
 * (`AUTH_CURRENT_PASSWORD_MISMATCH`) 입니다.
 *
 * **성공하면 로그아웃됩니다** — 서버가 그 사람의 모든 세션을 끊어(`revokeAll`)
 * 들고 있는 토큰도 죽습니다. 여기서 스스로 정리하고 로그인 화면으로 보냅니다.
 */
export function PasswordChangeModal({ open, onClose }: Props) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newPasswordConfirm, setNewPasswordConfirm] = useState('')

  const reset = () => {
    setCurrentPassword('')
    setNewPassword('')
    setNewPasswordConfirm('')
  }

  const mutation = useMutation({
    mutationFn: () => changePassword({ currentPassword, newPassword }),
    onSuccess: () => {
      reset()
      onClose()

      // 토큰을 먼저 버려야 남아 있는 쿼리가 죽은 토큰으로 다시 나가지 않습니다
      useAuthStore.getState().clear()
      queryClient.clear()
      navigate(ROUTES.LOGIN, {
        replace: true,
        state: { passwordChanged: true },
      })
    },
  })

  // 닫을 때 입력과 지난 오류를 함께 비웁니다 — 다시 열었을 때 남아 있으면 안 됩니다
  const close = () => {
    reset()
    mutation.reset()
    onClose()
  }

  const newPasswordError =
    newPassword.length > 0 && newPassword.length < PASSWORD_MIN_LENGTH
      ? `비밀번호는 ${PASSWORD_MIN_LENGTH}자 이상이어야 합니다`
      : undefined

  const confirmError =
    newPasswordConfirm.length > 0 && newPasswordConfirm !== newPassword
      ? '비밀번호가 서로 다릅니다'
      : undefined

  const canSubmit =
    currentPassword.length > 0 &&
    newPassword.length >= PASSWORD_MIN_LENGTH &&
    newPasswordConfirm === newPassword &&
    !mutation.isPending

  return (
    <Modal
      open={open}
      onClose={close}
      title="비밀번호 변경"
      footer={
        <>
          <Button variant="outline" onClick={close}>
            취소
          </Button>
          <Button
            type="submit"
            form="password-change-form"
            disabled={!canSubmit}
          >
            {mutation.isPending ? '변경 중' : '변경'}
          </Button>
        </>
      }
    >
      <form
        id="password-change-form"
        className="space-y-2.5"
        onSubmit={(event) => {
          event.preventDefault()
          mutation.mutate()
        }}
      >
        <Input
          label="현재 비밀번호"
          hideLabel
          type="password"
          autoComplete="current-password"
          placeholder="현재 비밀번호"
          required
          value={currentPassword}
          onChange={(event) => setCurrentPassword(event.target.value)}
        />
        <Input
          label="새 비밀번호"
          hideLabel
          type="password"
          autoComplete="new-password"
          placeholder="새 비밀번호"
          required
          value={newPassword}
          onChange={(event) => setNewPassword(event.target.value)}
          error={newPasswordError}
        />
        <Input
          label="새 비밀번호 확인"
          hideLabel
          type="password"
          autoComplete="new-password"
          placeholder="새 비밀번호 확인"
          required
          value={newPasswordConfirm}
          onChange={(event) => setNewPasswordConfirm(event.target.value)}
          error={confirmError}
        />

        {mutation.error !== null && (
          <p className="text-danger text-caption" role="alert">
            {isApiError(mutation.error)
              ? mutation.error.message
              : '비밀번호를 바꾸지 못했습니다. 잠시 후 다시 시도해주세요.'}
          </p>
        )}

        <p className="text-ink-muted text-caption">
          비밀번호는 {PASSWORD_MIN_LENGTH}자 이상이어야 합니다.
        </p>
      </form>
    </Modal>
  )
}
