import type { VariantProps } from 'class-variance-authority'
import { useState } from 'react'
import { type LinkProps } from 'react-router'

import { useIsLoggedIn } from '@/shared/store/authStore'
import { Button } from '@/shared/ui/Button'
import { type buttonVariants } from '@/shared/ui/buttonVariants'
import { LinkButton } from '@/shared/ui/LinkButton'
import { LoginRequiredDialog } from '@/shared/ui/LoginRequiredDialog'

type Props = Pick<VariantProps<typeof buttonVariants>, 'size'> & {
  /** 로그인했을 때 갈 곳. 로그인한 뒤에도 이리로 돌아옵니다 */
  to: LinkProps['to']
  /** 로그인이 왜 필요한지 한 줄. `LoginRequiredDialog` 로 그대로 갑니다 */
  description?: React.ReactNode
  className?: string
  children: React.ReactNode
}

/**
 * 로그인해야 갈 수 있는 곳으로 보내는 단추 (C01). 로그인했으면 **그냥 링크**이고,
 * 아니면 **가지 않고** 모달을 띄웁니다. 비로그인일 때만 `<button>` 인 이유: 링크로
 * 두면 새 탭으로 열 때 모달 없이 그 화면이 열립니다.
 */
export function AuthLinkButton({
  to,
  description,
  size,
  className,
  children,
}: Props) {
  const isLoggedIn = useIsLoggedIn()
  const [loginOpen, setLoginOpen] = useState(false)

  if (isLoggedIn) {
    return (
      <LinkButton to={to} size={size} className={className}>
        {children}
      </LinkButton>
    )
  }

  return (
    <>
      <Button
        type="button"
        size={size}
        className={className}
        onClick={() => setLoginOpen(true)}
      >
        {children}
      </Button>

      <LoginRequiredDialog
        open={loginOpen}
        onClose={() => setLoginOpen(false)}
        redirectTo={typeof to === 'string' ? to : undefined}
        description={description}
      />
    </>
  )
}
