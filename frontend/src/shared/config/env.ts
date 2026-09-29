function required(key: string, value: string | undefined): string {
  if (!value) {
    throw new Error(
      `환경변수 ${key} 가 설정되지 않았습니다. .env.example 을 참고해 .env.local 을 만들어주세요.`,
    )
  }
  return value
}

export const env = {
  apiBaseUrl: required('VITE_API_BASE_URL', import.meta.env.VITE_API_BASE_URL),
  // Google 로그인 버튼. `true` 일 때만 그립니다 — 목 모드 · 테스트 · 백엔드에 Google 설정이 없는 환경은 끕니다.
  googleLoginEnabled: import.meta.env.VITE_GOOGLE_LOGIN_ENABLED === 'true',
  isDev: import.meta.env.DEV,
} as const
