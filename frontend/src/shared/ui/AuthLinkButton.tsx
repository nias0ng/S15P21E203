import type { VariantProps } from 'class-variance-authority'
import { useState } from 'react'
import { type LinkProps } from 'react-router'

import { useIsLoggedIn } from '@/shared/store/authStore'
import { Button } from '@/shared/ui/Button'
import { type buttonVariants } from '@/shared/ui/buttonVariants'
import { LinkButton } from '@/shared/ui/LinkButton'
import { LoginRequiredDialog } from '@/shared/ui/LoginRequiredDialog'

type Props = Pick<VariantProps<typeof buttonVariants>, 'size'> & {
  to: LinkProps['to']
  description?: React.ReactNode
  className?: string
  children: React.ReactNode
}

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
