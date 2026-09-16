import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useNavigate } from 'react-router'

import { isApiError } from '@/shared/api/http'
import { ROUTES } from '@/shared/config/routes'
import { useAuthStore } from '@/shared/store/authStore'
import { Button } from '@/shared/ui/Button'
import { Checkbox } from '@/shared/ui/Checkbox'
import { Input } from '@/shared/ui/Input'
import { Modal } from '@/shared/ui/Modal'

import { withdraw } from '../api'

type Props = { open: boolean; onClose: () => void }

/**
 * 회원 탈퇴 모달 (와이어프레임 A30 우측 — A29 [회원 탈퇴] 도착 · COM-06)
 *
 * 백엔드와 확정된 탈퇴 정책입니다.
 * - 회원은 물리 삭제한다 (보관 기간 없음)
 * - 사용자 개인 데이터(진열대 · 컬렉션 · 메모 등)는 함께 삭제한다
 * - 게시글 · 댓글 · 향수 후기는 작성자만 지우고 글은 남긴다 (익명화)
 * - 탈퇴 요청 시 현재 비밀번호를 한 번 더 받아 본인 여부를 확인한다
 *
 * 안내 문구가 실제 동작과 어긋나면 안 됩니다. 이전 문구는 후기까지 삭제된다고
 * 적고 있었는데 확정된 정책은 후기를 남기는 쪽이라, 문구를 정책에 맞춰 고쳤습니다.
 */
export function WithdrawModal({ open, onClose }: Props) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [confirmed, setConfirmed] = useState(false)
  const [password, setPassword] = useState('')

  const mutation = useMutation({
    mutationFn: () => withdraw(password),
    onSuccess: () => {
      useAuthStore.getState().clear()
      /*
       * 캐시도 비웁니다. 스토어만 지우면 진열대 · 컬렉션 같은 응답이 그대로 남아,
       * 같은 브라우저에서 다음에 로그인한 사람이 지워진 계정의 화면을 잠깐 봅니다.
       */
      queryClient.clear()
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
            // 안내 확인과 비밀번호 재확인을 모두 거쳐야 탈퇴할 수 있습니다
            disabled={!canWithdraw}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? '탈퇴 중' : '탈퇴'}
          </Button>
        </>
      }
    >
      <div className="space-y-2.5">
        <div className="border-line bg-line-soft text-ink space-y-1.25 border p-2.5 text-[11px] leading-relaxed">
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

        {/* 본인 확인 — 로그인한 채로 자리를 비운 경우를 막습니다 */}
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
            {isApiError(mutation.error)
              ? mutation.error.message
              : '탈퇴하지 못했습니다. 잠시 후 다시 시도해주세요.'}
          </p>
        )}
      </div>
    </Modal>
  )
}
