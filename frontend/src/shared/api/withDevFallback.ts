import { env } from '@/shared/config/env'

import { isApiError } from './http'

/**
 * 개발 중 백엔드가 안 떠 있을 때만 대체값으로 넘어갑니다.
 *
 * **요청이 백엔드에 닿지도 못했을 때만**(status 0 · 502~504) 끼어듭니다.
 * 400 · 401 · 404 처럼 백엔드가 대답한 오류는 그대로 올려보냅니다 — 그것까지
 * 삼키면 진짜 버그가 자리표시자에 가려집니다. 운영에서는 끼어들지 않습니다.
 *
 * ── 여기 있는 이유 ────────────────────────────────────────
 * 같은 함수가 `features/perfume` · `features/recommend` · `features/map` 에 한 벌씩
 * 복사돼 있었습니다. 도메인끼리는 서로 import 할 수 없어(ESLint 레이어 규칙) 복사가
 * 유일한 방법이었는데, 세 벌이 되면서 "닿지 못함" 의 기준(502~504)을 한 곳만 고치면
 * 나머지 둘이 조용히 달라집니다. perfume 쪽 주석도 "두 번째 사용처라 shared/api 로
 * 올릴 후보" 라고 적어 두고 있었습니다.
 *
 * `domain` 은 경고에 붙는 꼬리표입니다. 개발 콘솔에서 어느 도메인이 대체값으로
 * 넘어갔는지 보이지 않으면, 화면 여러 개가 동시에 비어 있을 때 원인을 못 가립니다.
 *
 * ⚠️ 백엔드가 다 붙으면 이 함수와 각 도메인의 `placeholder` 를 함께 지웁니다.
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
