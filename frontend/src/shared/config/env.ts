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
  isDev: import.meta.env.DEV,
} as const
