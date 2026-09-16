import { useMutation, useQuery } from '@tanstack/react-query'
import { useState } from 'react'

import { useIsLoggedIn } from '@/shared/store/authStore'
import { Button } from '@/shared/ui/Button'

import { checkNicknameAvailability } from '../api'
import { meQuery } from '../queries'
import { NICKNAME_MIN_LENGTH } from '../types'

import { PasswordChangeModal } from './PasswordChangeModal'
import { WithdrawModal } from './WithdrawModal'

/**
 * 정보 변경 (와이어프레임 A29 — COM-04 · 헤더 닉네임 ▾ [개인 정보 수정] 도착 화면)
 *
 * 마이페이지 화면은 없습니다. 계정 관련 동작은 이 화면 하나에 모입니다.
 *
 * 백엔드와 확정된 정책입니다.
 * - 이메일은 계정 식별자라 중복 불가 · 변경 불가
 * - 닉네임은 중복 불가. 별도의 중복 확인 API 로 입력 중에 확인한다
 * - 프로필 이미지는 JPG · JPEG · PNG · WEBP, 한 장당 최대 5MB
 *
 * TODO: 닉네임 저장 API 연결 — **엔드포인트가 아직 없습니다.** `PATCH /users/me`
 *       같은 수정 경로가 없어서 중복 확인만 붙어 있고 [저장] 은 아직 비어 있습니다.
 * TODO: 프로필 이미지 업로드 · 삭제. 업로드 경로도 아직 없습니다
 */
export function AccountForm() {
  const isLoggedIn = useIsLoggedIn()
  const { data: me } = useQuery({ ...meQuery(), enabled: isLoggedIn })

  const [passwordOpen, setPasswordOpen] = useState(false)
  const [withdrawOpen, setWithdrawOpen] = useState(false)

  /**
   * 고쳐 쓰는 중인 닉네임. 아직 안 건드렸으면 `null` 이라 서버 값이 그대로 보입니다.
   * 이렇게 두면 응답이 늦게 와도 입력칸을 되돌리는 동기화 코드가 필요 없습니다.
   */
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

  return (
    <>
      <div className="border-line bg-surface-card border">
        <div className="space-y-3.75 p-6.25">
          <h1 className="text-ink text-[17px] font-bold">정보 변경</h1>

          {/* 프로필 이미지 */}
          <div className="flex items-start gap-5">
            <div className="border-line bg-line-soft text-ink-muted flex size-25 items-center justify-center border text-[10.5px]">
              프로필
            </div>
            <div className="flex flex-col gap-1.25">
              <Button variant="outline" size="sm">
                이미지 변경
              </Button>
              <Button variant="outline" size="sm">
                이미지 삭제
              </Button>
              <p className="text-ink-muted text-[10.5px] leading-relaxed">
                JPG · JPEG · PNG · WEBP
                <br />한 장당 최대 5MB
              </p>
            </div>
          </div>

          {/* 이메일 — 계정 식별자라 바꿀 수 없습니다 */}
          <div className="flex items-center gap-2.5">
            <span className="text-ink-muted w-20 shrink-0 text-[10.5px]">
              이메일
            </span>
            <span className="text-ink text-[10.5px]">{me?.email ?? '—'}</span>
            <span className="text-ink-muted text-[10.5px]">
              (변경 불가 · 계정 식별자)
            </span>
          </div>

          {/* 닉네임 + 중복 확인 */}
          <form
            id="account-nickname-form"
            className="flex items-center gap-2.5"
            onSubmit={(event) => {
              event.preventDefault()
              // TODO: 닉네임 저장 API 연결 (수정 엔드포인트가 생기면)
            }}
          >
            <label
              htmlFor="account-nickname"
              className="text-ink-muted w-20 shrink-0 text-[10.5px]"
            >
              닉네임
            </label>
            <input
              id="account-nickname"
              value={nickname}
              onChange={(event) => {
                setNicknameDraft(event.target.value)
                setNicknameAvailable(null)
              }}
              className="border-line text-ink focus-visible:ring-accent-deep h-10 w-70 border px-2.5 text-xs outline-none focus-visible:ring-2"
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
            {nicknameAvailable !== null && (
              <span
                className={
                  nicknameAvailable
                    ? 'text-ink-muted text-[10.5px]'
                    : 'text-danger text-[10.5px]'
                }
              >
                {nicknameAvailable
                  ? '사용할 수 있는 닉네임입니다'
                  : '이미 사용 중인 닉네임입니다'}
              </span>
            )}
          </form>

          <hr className="border-line" />

          <div className="flex gap-1.25">
            <Button type="submit" form="account-nickname-form">
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

          <p className="text-ink-muted text-[10.5px]">계정</p>
          <div className="flex gap-1.25">
            <Button variant="outline" onClick={() => setPasswordOpen(true)}>
              비밀번호 변경
            </Button>
            <Button variant="outline" onClick={() => setWithdrawOpen(true)}>
              회원 탈퇴
            </Button>
          </div>
        </div>

        {/* 와이어프레임의 점선 주석 영역 */}
        <div className="text-ink-muted space-y-0.5 border-t border-dashed border-[#d2d2d2] px-6.25 py-2.5 text-[10.5px] leading-relaxed">
          <p>비밀번호는 이 화면에 표시하지 않는다 — 변경은 별도 모달로만</p>
          <p>닉네임은 다른 사용자와 겹칠 수 없습니다</p>
        </div>
      </div>

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
