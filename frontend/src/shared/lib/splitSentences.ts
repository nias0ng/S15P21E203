/**
 * 글을 문장으로 자릅니다. 마침표 · 물음표 · 느낌표 **뒤에 공백이 올 때만** 자르므로
 * `4.5` 같은 소수와 `No.5` 같은 이름은 그대로 남습니다. 줄바꿈도 문장의 끝으로 봅니다.
 *
 * @returns 앞뒤 공백을 뗀 문장들. 빈 문장은 뺍니다
 */
export function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+|\n+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean)
}
