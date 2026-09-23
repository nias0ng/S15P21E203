/**
 * 인증 화면 세 곳(A28 로그인 · 회원가입, A31 비밀번호)이 같이 쓰는 바깥 틀. 아래
 * 숨이 위보다 50px 커 카드가 정가운데보다 25px 위에 섭니다 — 자로 잰 가운데는 눈에
 * 조금 낮게 읽힙니다.
 *
 * NOTE: 이 틀을 쓰는 화면은 라우트에 `night` 이 켜져 있어야 합니다(`app/router`).
 */
export const AUTH_PAGE =
  '-mt-15 -mb-15 flex min-h-[calc(100dvh-var(--header-h))] items-center justify-center pt-15 pb-27.5'

/**
 * 인증 화면의 주요 단추(로그인 · 가입하기 · 메일 받기). 기본 `bg-ink` 는 어두운
 * 방에서 상아색이라 판 위에서 덩어리로 튑니다 — 알파를 내리고 글자를 뒤집어야
 * 대비 기준(4.5:1)을 넘습니다(0.75 에서 10.4:1).
 *
 * NOTE: hover 의 흰색은 역할 토큰으로 낼 수 없어 Tailwind 의 `white` 를 씁니다.
 */
export const AUTH_SUBMIT = 'bg-ink/75 text-surface hover:bg-white'
