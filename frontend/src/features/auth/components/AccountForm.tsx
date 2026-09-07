import { useState } from 'react'

import { Button } from '@/shared/ui/Button'

import { PasswordChangeModal } from './PasswordChangeModal'
import { WithdrawModal } from './WithdrawModal'

/**
 * 정보 변경 (와이어프레임 A29 — COM-04 · 헤더 닉네임 ▾ [개인 정보 수정] 도착 화면)
 *
 * 마이페이지 화면은 없습니다. 계정 관련 동작은 이 화면 하나에 모입니다.
 *
 * TODO: 백엔드 회원 API 확정 후 연결
 * - 프로필 이미지 업로드 · 삭제 (형식 · 용량 제한은 별도 정책)
 * - 닉네임 중복 검사
 */
export function AccountForm() {
  const [passwordOpen, setPasswordOpen] = useState(false)
  const [withdrawOpen, setWithdrawOpen] = useState(false)

  return (
    <>
      <div className="border-line border bg-white">
        <div className="space-y-3.5 p-6">
          <h1 className="text-ink text-[17px] font-bold">정보 변경</h1>

          {/* 프로필 이미지 */}
          <div className="flex items-start gap-5">
            <div className="border-line bg-line-soft text-ink-muted flex size-25 items-center justify-center border text-[10.5px]">
              프로필
            </div>
            <div className="flex flex-col gap-1.5">
              <Button variant="outline" size="sm">
                이미지 변경
              </Button>
              <Button variant="outline" size="sm">
                이미지 삭제
              </Button>
            </div>
          </div>

          {/* 이메일 — 계정 식별자라 바꿀 수 없습니다 */}
          <div className="flex items-center gap-3">
            <span className="text-ink-muted w-20 shrink-0 text-[10.5px]">
              이메일
            </span>
            <span className="text-ink text-[10.5px]">user@example.com</span>
            <span className="text-ink-muted text-[10.5px]">
              (변경 불가 · 계정 식별자)
            </span>
          </div>

          {/* 닉네임 + 중복 확인 */}
          <form
            className="flex items-center gap-3"
            onSubmit={(event) => {
              event.preventDefault()
              // TODO: 닉네임 저장 API 연결
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
              defaultValue="유저닉네임"
              className="border-line text-ink focus-visible:ring-accent h-10 w-70 border px-3 text-xs outline-none focus-visible:ring-2"
            />
            <Button variant="outline" size="sm">
              중복 확인
            </Button>
          </form>

          <hr className="border-line" />

          <div className="flex gap-1.5">
            <Button type="submit">저장</Button>
            <Button variant="outline">취소</Button>
          </div>

          <hr className="border-line" />

          <p className="text-ink-muted text-[10.5px]">계정</p>
          <div className="flex gap-1.5">
            <Button variant="outline" onClick={() => setPasswordOpen(true)}>
              비밀번호 변경
            </Button>
            <Button variant="outline" onClick={() => setWithdrawOpen(true)}>
              회원 탈퇴
            </Button>
          </div>
        </div>

        {/* 와이어프레임의 점선 주석 영역 */}
        <div className="text-ink-muted space-y-0.5 border-t border-dashed border-[#d2d2d2] px-6 py-2.5 text-[10.5px] leading-relaxed">
          <p>비밀번호는 이 화면에 표시하지 않는다 — 변경은 별도 모달로만</p>
          <p>닉네임 중복 검사 · 이미지 형식 · 용량 제한은 별도 정책</p>
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
