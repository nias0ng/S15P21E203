import { cn } from '@/shared/lib/cn'

type Props = {
  href?: string
  onClick?: () => void
  disabled?: boolean
  children: React.ReactNode
}

/**
 * Google 로그인 버튼입니다. 눌리면 Google 로그인 화면으로 **페이지가 넘어갑니다**.
 *
 * NOTE: 흰 바탕 · 색 G 로고 · "Google 계정으로 …" 문구는 Google 브랜드 가이드입니다. 로고 색이나
 * 모양을 바꾸면 안 됩니다. 판 위 다른 버튼과 톤을 맞추려고 바탕을 바꾸지 마세요.
 */
export function GoogleLoginButton({
  href,
  onClick,
  disabled,
  children,
}: Props) {
  const className = cn(
    'text-body flex h-10 w-full items-center justify-center gap-2.5 rounded-md border border-[#747775] bg-white font-medium text-[#1f1f1f] transition-colors hover:bg-[#f2f2f2]',
    disabled && 'pointer-events-none opacity-60',
  )

  if (href !== undefined) {
    return (
      <a href={href} className={className} aria-disabled={disabled}>
        <GoogleLogo />
        {children}
      </a>
    )
  }
  return (
    <button
      type="button"
      className={className}
      onClick={onClick}
      disabled={disabled}
    >
      <GoogleLogo />
      {children}
    </button>
  )
}

function GoogleLogo() {
  return (
    <svg aria-hidden viewBox="0 0 48 48" className="size-4.5 shrink-0">
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  )
}
