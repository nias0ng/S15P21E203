/**
 * 주소에 실린 번호(`/perfumes/:perfumeId` · `?perfumeId=`)를 읽습니다.
 *
 * 서버의 번호는 1부터 올라가는 정수라 **양의 안전한 정수만** 받습니다. `1.5` · `0` · `-3` 을
 * 그대로 보내면 400 · 404 가 돌아올 요청을 괜히 한 번 더 보냅니다.
 *
 * @param raw `useParams` · `searchParams.get` 이 준 값
 * @returns 번호. 없거나 번호가 될 수 없으면 null
 */
export function parseId(raw: string | null | undefined): number | null {
  if (raw == null || raw.trim() === '') return null
  const id = Number(raw)
  return Number.isSafeInteger(id) && id > 0 ? id : null
}
