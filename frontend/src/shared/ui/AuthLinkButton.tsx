import type { VariantProps } from 'class-variance-authority'
import { useState } from 'react'
import { type LinkProps } from 'react-router'

import { useIsLoggedIn } from '@/shared/store/authStore'
import { Button } from '@/shared/ui/Button'
import { type buttonVariants } from '@/shared/ui/buttonVariants'
import { LinkButton } from '@/shared/ui/LinkButton'
import { LoginRequiredDialog } from '@/shared/ui/LoginRequiredDialog'

type Props = VariantProps<typeof buttonVariants> & {
  /** 로그인했을 때 갈 곳 */
  to: LinkProps['to']
  /** 이동할 때 함께 실어 보낼 값 */
  state?: LinkProps['state']
  /** 로그인 뒤 돌아올 경로. 없으면 `to` 를 씁니다 */
  redirectTo?: string
  /** 로그인이 왜 필요한지 한 줄. `LoginRequiredDialog` 로 그대로 갑니다 */
  description?: React.ReactNode
  className?: string
  children: React.ReactNode
}

/**
 * 로그인해야 갈 수 있는 곳으로 보내는 단추 (C01)
 *
 * 로그인했으면 **그냥 링크**입니다 — 새 탭으로 열기 · 링크 복사가 살아 있습니다.
 * 로그인하지 않았으면 **가지 않고** 로그인 모달을 띄웁니다.
 *
 * 왜 가서 막지 않고 여기서 막는가: 글쓰기 화면까지 갔다가 다 쓰고 [등록] 에서야
 * 막히면 쓴 것을 잃습니다. 빈 화면을 보여주고 나서 "로그인하세요" 라고 하는 것도
 * 한 걸음 늦습니다.
 *
 * 로그인하지 않았을 때만 단추(`<button>`)가 되는 이유: 갈 곳이 없는데 링크로 두면
 * 낭독기가 "링크" 라고 읽고, 새 탭으로 열면 모달 없이 그 화면이 그대로 열립니다.
 */
export function AuthLinkButton({
  to,
  state,
  redirectTo,
  description,
  variant,
  size,
  fullWidth,
  className,
  children,
}: Props) {
  const isLoggedIn = useIsLoggedIn()
  const [loginOpen, setLoginOpen] = useState(false)

  if (isLoggedIn) {
    return (
      <LinkButton
        to={to}
        state={state}
        variant={variant}
        size={size}
        fullWidth={fullWidth}
        className={className}
      >
        {children}
      </LinkButton>
    )
  }

  return (
    <>
      <Button
        type="button"
        variant={variant}
        size={size}
        fullWidth={fullWidth}
        className={className}
        onClick={() => setLoginOpen(true)}
      >
        {children}
      </Button>

      <LoginRequiredDialog
        open={loginOpen}
        onClose={() => setLoginOpen(false)}
        redirectTo={redirectTo ?? (typeof to === 'string' ? to : undefined)}
        description={description}
      />
    </>
  )
}
