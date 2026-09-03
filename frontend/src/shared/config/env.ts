/**
 * 환경변수는 여기서만 읽습니다.
 * import.meta.env 를 코드 전역에 흩뿌리지 않으면 오타/누락을 앱 시작 시점에 잡을 수 있습니다.
 */
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
  isProd: import.meta.env.PROD,
} as const
