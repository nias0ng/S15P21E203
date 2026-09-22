import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'

import { isApiError } from '@/shared/api/http'
import { useToast } from '@/shared/hooks/useToast'
import { useAuthStore, useIsLoggedIn } from '@/shared/store/authStore'
import { Button } from '@/shared/ui/Button'
import { Input } from '@/shared/ui/Input'
import { Toast } from '@/shared/ui/Toast'

import { changeNickname, checkNicknameAvailability, toAuthUser } from '../api'
import { AUTH_SUBMIT } from '../frame'
import { authKeys, meQuery } from '../queries'
import { NICKNAME_MIN_LENGTH } from '../types'

import { AuthCard } from './AuthCard'
import { PasswordChangeModal } from './PasswordChangeModal'
import { WithdrawModal } from './WithdrawModal'

/** 정보 변경 (A29 — COM-04). 마이페이지 화면이 없어 계정 동작이 여기 모입니다 */
export function AccountForm() {
  const isLoggedIn = useIsLoggedIn()
  const { data: me } = useQuery({ ...meQuery(), enabled: isLoggedIn })
  const queryClient = useQueryClient()
  const { showToast, toastProps } = useToast()

  const [passwordOpen, setPasswordOpen] = useState(false)
  const [withdrawOpen, setWithdrawOpen] = useState(false)

  /** `null` 이면 서버 값이 그대로 보입니다 — 입력칸을 되돌리는 동기화가 필요 없습니다 */
  const [nicknameDraft, setNicknameDraft] = useState<string | null>(null)
  const [nicknameAvailable, setNicknameAvailable] = useState<boolean | null>(
    null,
  )

  const nickname = nicknameDraft ?? me?.nickname ?? ''
  const trimmedNickname = nickname.trim()

  const nicknameCheck = useMutation({
    mutationFn: () => checkNicknameAvailability(trimmedNickname),
    onSuccess: (available) => setNicknameAvailable(available),
  })

  /**
   * 캐시와 스토어 둘 다 맞춥니다 — 화면은 쿼리를, 헤더는 로그인 스토어를 봐서
   * 하나만 고치면 헤더에 옛 이름이 남습니다.
   */
  const save = useMutation({
    mutationFn: () => changeNickname(trimmedNickname),
    onSuccess: (user) => {
      queryClient.setQueryData(authKeys.me(), user)
      useAuthStore.getState().setUser(toAuthUser(user))

      setNicknameDraft(null)
      setNicknameAvailable(null)
      showToast('닉네임을 바꿨습니다')
    },
    onError: (error) =>
      showToast(
        isApiError(error) && error.status === 409
          ? '이미 사용 중인 닉네임입니다'
          : '닉네임을 바꾸지 못했습니다',
      ),
  })

  const nicknameChanged = me != null && trimmedNickname !== me.nickname

  return (
    <>
      <Toast {...toastProps} />

      <AuthCard title="정보 변경">
        {/* TODO: 프로필 이미지 업로드 · 삭제 붙이기 — POST · DELETE /users/me/profile-image (multipart, 필드 file) (S15P21E203-404) */}
        {/* NOTE: 백엔드 제한은 JPG · PNG · GIF · WEBP · 1MB 로 아래 안내와 다릅니다 */}
        <div className="flex items-start gap-5">
          {/* 어두운 방이 `bg-line-soft` 를 흰 12% 로 뒤집어, 사진이 없을 때 어둠 위에 아이보리 사각형이 남지 않습니다 */}
          <div className="border-line bg-line-soft text-ink-muted rounded-card text-caption flex size-25 shrink-0 items-center justify-center border">
            프로필
          </div>
          <div className="flex flex-col gap-1.25">
            <Button variant="outline" size="sm">
              이미지 변경
            </Button>
            <Button variant="outline" size="sm">
              이미지 삭제
            </Button>
            <p className="text-ink-muted text-caption leading-relaxed">
              JPG · JPEG · PNG · WEBP
              <br />한 장당 최대 5MB
            </p>
          </div>
        </div>

        {/* 못 고치는 값이라 칸 없이 글자로 둡니다 — 입력칸이 있으면 눌러 보게 됩니다 */}
        <div className="space-y-2.5">
          <p className="text-caption font-medium">이메일</p>
          <p className="text-ink text-body">{me?.email ?? '—'}</p>
          <p className="text-ink-muted text-caption">
            변경할 수 없습니다 — 계정을 가리키는 이름입니다
          </p>
        </div>

        <form
          id="account-nickname-form"
          className="space-y-2.5"
          onSubmit={(event) => {
            event.preventDefault()
            if (nicknameChanged) save.mutate()
          }}
        >
          {/* 확인 결과를 `Input` 의 hint · error 로 넘깁니다 — 옆에 따로 놓으면 읽어주기가 입력칸과 잇지 못합니다 */}
          <Input
            label="닉네임"
            value={nickname}
            onChange={(event) => {
              setNicknameDraft(event.target.value)
              setNicknameAvailable(null)
            }}
            hint={
              nicknameAvailable === true
                ? '사용할 수 있는 닉네임입니다'
                : undefined
            }
            error={
              nicknameAvailable === false
                ? '이미 사용 중인 닉네임입니다'
                : undefined
            }
          />
          <Button
            variant="outline"
            size="sm"
            type="button"
            disabled={
              trimmedNickname.length < NICKNAME_MIN_LENGTH ||
              nicknameCheck.isPending
            }
            onClick={() => nicknameCheck.mutate()}
          >
            중복 확인
          </Button>
        </form>

        <div className="flex gap-1.25">
          <Button
            type="submit"
            form="account-nickname-form"
            className={AUTH_SUBMIT}
            disabled={
              !nicknameChanged ||
              trimmedNickname.length < NICKNAME_MIN_LENGTH ||
              save.isPending
            }
          >
            저장
          </Button>
          <Button
            variant="outline"
            type="button"
            onClick={() => {
              setNicknameDraft(null)
              setNicknameAvailable(null)
            }}
          >
            취소
          </Button>
        </div>

        <hr className="border-line" />

        <div className="space-y-2.5">
          <p className="text-ink-muted text-caption">계정</p>
          <div className="flex gap-1.25">
            <Button variant="outline" onClick={() => setPasswordOpen(true)}>
              비밀번호 변경
            </Button>
            <Button variant="outline" onClick={() => setWithdrawOpen(true)}>
              회원 탈퇴
            </Button>
          </div>
        </div>
      </AuthCard>

      <PasswordChangeModal
        open={passwordOpen}
        onClose={() => setPasswordOpen(false)}
      />
      <WithdrawModal
        open={withdrawOpen}
        onClose={() => setWithdrawOpen(false)}
      />
    </>
  )
}
