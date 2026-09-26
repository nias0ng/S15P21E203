import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { useNavigate } from 'react-router'

import { apiErrorMessage } from '@/shared/api/http'
import { ROUTES } from '@/shared/config/routes'
import { useEndSession } from '@/shared/hooks/useEndSession'
import { Button } from '@/shared/ui/Button'
import { Checkbox } from '@/shared/ui/Checkbox'
import { Input } from '@/shared/ui/Input'
import { Modal } from '@/shared/ui/Modal'

import { withdraw } from '../api'

type Props = { open: boolean; onClose: () => void }

export function WithdrawModal({ open, onClose }: Props) {
  const navigate = useNavigate()
  const endSession = useEndSession()

  const [confirmed, setConfirmed] = useState(false)
  const [password, setPassword] = useState('')

  const mutation = useMutation({
    mutationFn: () => withdraw(password),
    onSuccess: () => {
      endSession()
      navigate(ROUTES.HOME, { replace: true })
    },
  })

  const close = () => {
    setConfirmed(false)
    setPassword('')
    mutation.reset()
    onClose()
  }

  const canWithdraw = confirmed && password.length > 0 && !mutation.isPending

  return (
    <Modal
      open={open}
      onClose={close}
      title="회원 탈퇴"
      footer={
        <>
          <Button variant="outline" onClick={close}>
            취소
          </Button>
          <Button
            variant="danger"
            disabled={!canWithdraw}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? '탈퇴 중' : '탈퇴'}
          </Button>
        </>
      }
    >
      <div className="space-y-2.5">
        <div className="border-line bg-line-soft text-ink text-caption space-y-1.25 border p-2.5 leading-relaxed">
          <p>진열대 · 컬렉션 · 메모가 함께 삭제됩니다.</p>
          <p>
            작성한 게시글 · 댓글 · 후기는{' '}
            <b>작성자 표시만 지워지고 남습니다.</b>
          </p>
          <p>계정은 바로 삭제되며 되돌릴 수 없습니다.</p>
        </div>

        <label className="flex cursor-pointer items-center gap-2.5">
          <Checkbox
            checked={confirmed}
            onChange={(event) => setConfirmed(event.target.checked)}
          />
          <span className="text-ink text-xs">위 내용을 확인했습니다</span>
        </label>

        <Input
          label="현재 비밀번호"
          type="password"
          autoComplete="current-password"
          placeholder="현재 비밀번호"
          hint="본인 확인을 위해 한 번 더 입력해주세요."
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />

        {mutation.error !== null && (
          <p className="text-danger text-caption" role="alert">
            {apiErrorMessage(
              mutation.error,
              '탈퇴하지 못했습니다. 잠시 후 다시 시도해주세요.',
            )}
          </p>
        )}
      </div>
    </Modal>
  )
}
