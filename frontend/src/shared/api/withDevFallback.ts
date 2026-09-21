import { env } from '@/shared/config/env'

import { isApiError } from './http'

/**
 * 개발 중 백엔드가 안 떠 있을 때만 대체값으로 넘어갑니다.
 *
 * **요청이 백엔드에 닿지도 못했을 때만**(status 0 · 502~504) 끼어듭니다. 400 · 401 ·
 * 404 처럼 백엔드가 대답한 오류는 그대로 올려보냅니다 — 그것까지 삼키면 진짜 버그가
 * 자리표시자에 가려집니다. 운영에서는 끼어들지 않습니다.
 *
 * @param domain 경고에 붙는 꼬리표. 화면 여러 개가 같이 비었을 때 원인을 가릅니다
 * @param request 진짜 요청
 * @param fallback 닿지 못했을 때 쓸 개발용 값
 * @returns 요청 결과, 또는 개발 환경에서 닿지 못했을 때의 대체값
 */
export async function withDevFallback<T>(
  domain: string,
  request: () => Promise<T>,
  fallback: () => T,
): Promise<T> {
  try {
    return await request()
  } catch (error) {
    const unreachable =
      isApiError(error) &&
      (error.status === 0 || (error.status >= 502 && error.status <= 504))

    if (!env.isDev || !unreachable) throw error

    console.warn(
      `[${domain}] 백엔드에 닿지 못해 개발용 대체 데이터를 씁니다. 실제 값이 아닙니다.`,
    )
    return fallback()
  }
}
