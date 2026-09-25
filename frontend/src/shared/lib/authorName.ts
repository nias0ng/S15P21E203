/** 작성자가 지워진 글 · 댓글 · 후기에 적는 이름 */
const WITHDRAWN_AUTHOR = '탈퇴한 회원'

/**
 * 글쓴이 이름을 화면에 적을 문자열로 옮깁니다. 탈퇴한 회원의 글은 글만 남고 작성자가
 * 지워져 닉네임이 비어 옵니다.
 *
 * @param nickname 서버가 준 닉네임
 * @returns 닉네임. 비어 왔으면 '탈퇴한 회원'
 */
export function authorName(nickname: string | null | undefined): string {
  return nickname ?? WITHDRAWN_AUTHOR
}
