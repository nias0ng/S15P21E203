const WITHDRAWN_AUTHOR = '탈퇴한 회원'

export function authorName(nickname: string | null | undefined): string {
  return nickname ?? WITHDRAWN_AUTHOR
}
