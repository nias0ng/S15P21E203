import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { useNavigate } from 'react-router'

import { apiErrorMessage } from '@/shared/api/http'
import { ROUTES } from '@/shared/config/routes'
import { useEndSession } from '@/shared/hooks/useEndSession'
import { Button } from '@/shared/ui/Button'
import { Input } from '@/shared/ui/Input'
import { Modal } from '@/shared/ui/Modal'

import { changePassword } from '../api'
import { useNewPassword } from '../hooks/useNewPassword'
import { PASSWORD_MIN_LENGTH } from '../types'

import { NewPasswordFields } from './NewPasswordFields'

type Props = { open: boolean; onClose: () => void }

/**
 * 비밀번호 변경 모달 (A30 좌측). 성공하면 로그아웃됩니다 — 서버가 그 사람의 모든
 * 세션을 끊어(`revokeAll`) 들고 있는 토큰도 죽습니다.
 */
export function PasswordChangeModal({ open, onClose }: Props) {
  const navigate = useNavigate()
  const endSession = useEndSession()

  const [currentPassword, setCurrentPassword] = useState('')
  const newPassword = useNewPassword()

  const reset = () => {
    setCurrentPassword('')
    newPassword.reset()
  }

  const mutation = useMutation({
    mutationFn: () =>
      changePassword({ currentPassword, newPassword: newPassword.password }),
    onSuccess: () => {
      reset()
      onClose()
      endSession()
      navigate(ROUTES.LOGIN, {
        replace: true,
        state: { passwordChanged: true },
      })
    },
  })

  const close = () => {
    reset()
    mutation.reset()
    onClose()
  }

  const canSubmit =
    currentPassword.length > 0 && newPassword.valid && !mutation.isPending

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
        <NewPasswordFields label="새 비밀번호" password={newPassword} />

        {mutation.error !== null && (
          <p className="text-danger text-caption" role="alert">
            {apiErrorMessage(
              mutation.error,
              '비밀번호를 바꾸지 못했습니다. 잠시 후 다시 시도해주세요.',
            )}
          </p>
        )}

        <p className="text-ink-muted text-caption">
          비밀번호는 {PASSWORD_MIN_LENGTH}자 이상이어야 합니다.
        </p>
      </form>
    </Modal>
  )
}
