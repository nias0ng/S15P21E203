/**
 * 환경변수는 이 파일에서만 읽습니다 — 흩어 두면 오타 · 누락이 앱을 켠 뒤에야 드러납니다.
 *
 * @param key 환경변수 이름 (오류 문구에 씁니다)
 * @param value `import.meta.env` 에서 읽은 값
 * @returns 비어 있지 않은 값. 비었으면 던집니다
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
} as const
