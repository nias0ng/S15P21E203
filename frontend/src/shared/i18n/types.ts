/**
 * 한국어 묶음과 같은 모양의 번역 묶음. 영어 파일을 `satisfies Messages<typeof ko>` 로 적으면
 * 문구를 빠뜨리거나 한국어에 없는 문구를 더했을 때 타입 검사에서 걸립니다.
 *
 * NOTE: 개수에 따라 달라지는 문구는 한국어에도 `_one` · `_other` 를 둘 다 둡니다. 영어만 두면
 * 모양이 달라 여기서 걸립니다(한국어는 두 값이 같아도 됩니다).
 */
export type Messages<T> = {
  [K in keyof T]: T[K] extends string ? string : Messages<T[K]>
}
