import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useSearchParams } from 'react-router'

import { isApiError } from '@/shared/api/http'
import { useToast } from '@/shared/hooks/useToast'
import { useAuthStore, useIsLoggedIn } from '@/shared/store/authStore'
import { Button } from '@/shared/ui/Button'
import { Input } from '@/shared/ui/Input'
import { Toast } from '@/shared/ui/Toast'

import { changeNickname, checkNicknameAvailability, toAuthUser } from '../api'
import { AUTH_SUBMIT } from '../frame'
import { useAvailabilityCheck } from '../hooks/useAvailabilityCheck'
import { GOOGLE_REAUTH_PARAM } from '../lib/googleErrors'
import { nicknameLengthError } from '../lib/nickname'
import { authKeys, meQuery } from '../queries'
import { NICKNAME_MIN_LENGTH } from '../types'

import { AuthCard } from './AuthCard'
import { PasswordChangeModal } from './PasswordChangeModal'
import { ProfileImageField } from './ProfileImageField'
import { WithdrawModal } from './WithdrawModal'

export function AccountForm() {
  const isLoggedIn = useIsLoggedIn()
  const { data: me } = useQuery({ ...meQuery(), enabled: isLoggedIn })
  const queryClient = useQueryClient()
  const { showToast, toastProps } = useToast()

  const [passwordOpen, setPasswordOpen] = useState(false)
  // Google 재확인을 마치고 돌아오면 주소에 결과가 붙어 옵니다. 그때는 탈퇴 창을 다시 열어 둡니다.
  const [searchParams, setSearchParams] = useSearchParams()
  const googleReauth = searchParams.get(GOOGLE_REAUTH_PARAM)
  const [withdrawOpen, setWithdrawOpen] = useState(googleReauth !== null)

  const [nicknameDraft, setNicknameDraft] = useState<string | null>(null)

  const nickname = nicknameDraft ?? me?.nickname ?? ''
  const trimmedNickname = nickname.trim()
  const nicknameError = nicknameLengthError(trimmedNickname)
  const nicknameInvalid =
    trimmedNickname.length < NICKNAME_MIN_LENGTH || nicknameError !== undefined

  const nicknameCheck = useAvailabilityCheck(
    checkNicknameAvailability,
    trimmedNickname,
  )
  const nicknameAvailable = nicknameCheck.available

  const save = useMutation({
    mutationFn: () => changeNickname(trimmedNickname),
    onSuccess: (user) => {
      queryClient.setQueryData(authKeys.me(), user)
      useAuthStore.getState().setUser(toAuthUser(user))

      setNicknameDraft(null)
      nicknameCheck.reset()
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
        <ProfileImageField
          value={me?.profileImageUrl ?? null}
          onChange={(next) => {
            queryClient.setQueryData(authKeys.me(), (old?: typeof me) =>
              old == null ? old : { ...old, profileImageUrl: next },
            )
            showToast(
              next === null
                ? '프로필 사진을 지웠습니다'
                : '프로필 사진을 바꿨습니다',
            )
          }}
        />

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
          <Input
            label="닉네임"
            value={nickname}
            onChange={(event) => {
              setNicknameDraft(event.target.value)
              nicknameCheck.reset()
            }}
            hint={
              nicknameAvailable === true
                ? '사용할 수 있는 닉네임입니다'
                : undefined
            }
            error={
              nicknameError ??
              (nicknameAvailable === false
                ? '이미 사용 중인 닉네임입니다'
                : undefined)
            }
          />
          <Button
            variant="outline"
            size="sm"
            type="button"
            disabled={nicknameInvalid || nicknameCheck.isPending}
            onClick={nicknameCheck.check}
          >
            중복 확인
          </Button>
        </form>

        <div className="flex gap-1.25">
          <Button
            type="submit"
            form="account-nickname-form"
            className={AUTH_SUBMIT}
            disabled={!nicknameChanged || nicknameInvalid || save.isPending}
          >
            저장
          </Button>
          <Button
            variant="outline"
            type="button"
            onClick={() => {
              setNicknameDraft(null)
              nicknameCheck.reset()
            }}
          >
            취소
          </Button>
        </div>

        <hr className="border-line" />

        <div className="space-y-2.5">
          <p className="text-ink-muted text-caption">계정</p>
          {me?.googleConnected === true && (
            <p className="text-ink text-caption">
              Google 계정으로 로그인합니다
            </p>
          )}
          <div className="flex gap-1.25">
            {/* Google 로 가입한 계정은 바꿀 비밀번호가 없습니다. */}
            {me?.hasPassword !== false && (
              <Button variant="outline" onClick={() => setPasswordOpen(true)}>
                비밀번호 변경
              </Button>
            )}
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
        googleReauth={googleReauth}
        onClose={() => {
          setWithdrawOpen(false)
          // 닫은 뒤 다시 열 때 지난 확인 결과를 보여 주지 않습니다.
          if (googleReauth !== null) {
            setSearchParams(
              (params) => {
                params.delete(GOOGLE_REAUTH_PARAM)
                return params
              },
              { replace: true },
            )
          }
        }}
      />
    </>
  )
}
