import { env } from '@/shared/config/env'

import { isApiError, isUnreachable } from './http'

export async function withDevFallback<T>(
  domain: string,
  request: () => Promise<T>,
  fallback: () => T,
): Promise<T> {
  try {
    return await request()
  } catch (error) {
    const unreachable = isApiError(error) && isUnreachable(error.status)

    if (!env.isDev || !unreachable) throw error

    console.warn(
      `[${domain}] 백엔드에 닿지 못해 개발용 대체 데이터를 씁니다. 실제 값이 아닙니다.`,
    )
    return fallback()
  }
}
