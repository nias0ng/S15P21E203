import type { ScentFamilyKey } from './types'

/**
 * 고른 향 계열마다 배를 처음 내릴 향수입니다. 값은 향수 번호가 아니라 **국내 선정 순위**(`rank`)입니다.
 *
 * 유사도만으로 고르면 1순위 계열 구역 밖에 내리는 조합이 81가지 중 32가지였습니다 — 머스크만 고르면
 * 국내 1위 병이 우디 구역 안에 있어 머스크 이름표에서 0.97(지도 폭이 1) 떨어진 곳에 내렸습니다.
 * 그래서 아래 규칙으로 한 번 채워 두고 표를 그대로 씁니다.
 *
 * - 1순위 계열 구역 가운데 **이름표가 있는 조각 안에 그려진 병**만 후보입니다.
 * - 후보 가운데 두 계열을 다 가진 병이 있으면 그중 유사도가 가장 높은 병입니다.
 *   없으면 1순위만 고른 결과와 같은 병이고, 2순위는 반영되지 않습니다(결과 모달이 그렇게 알립니다).
 * - 유사도가 같으면 1순위 이름표에 가까운 병입니다.
 *
 * NOTE: 향수 번호(`perfumeId`)로 적지 않습니다. 번호는 DB 가 적재 순서로 매겨, 로컬과 운영이 200병 모두
 * 다릅니다. 순위 · 좌표 · 향 구성은 같습니다.
 *
 * NOTE: 구역은 서버가 실어 주는 `labelRegion`(그려진 자리의 계열)입니다. `GET /map` 의 향수 `scentRegionId` 는
 * 가장 센 계열이라 47병이 그려진 구역과 다릅니다. 향 지도(`backend/db/seed/load_scent_map.sql`)를 다시 만들면 이 표도
 * 다시 채웁니다 — 표의 병이 지도에서 빠지거나 1순위 계열 구역 밖으로 옮겨지면 `matchStartingPoint` 가 구역 안에서
 * 유사도로 고릅니다. 구역 밖의 병은 어느 경우에도 고르지 않습니다.
 */
export const STARTING_RANKS: Readonly<Record<string, number>> = {
  FLORAL: 62, // 자도르 퍼퓸 도
  GREEN: 138, // 유 오어 썸원 라이크 유
  CITRUS: 81, // 에로스 에너지
  FRUITY: 165, // 땡큐 넥스트 2.0
  AQUATIC: 185, // 세일링 데이
  MUSK: 107, // 더 머스크
  GOURMAND: 153, // 아이 원트 츄 포에버
  WOODY: 35, // 잉글리쉬 오크 & 헤이즐넛
  AMBER: 51, // 집시 워터

  'FLORAL>GREEN': 16, // 라 튤립
  'FLORAL>CITRUS': 62, // 자도르 퍼퓸 도 · 2순위 미반영
  'FLORAL>FRUITY': 62, // 자도르 퍼퓸 도 · 2순위 미반영
  'FLORAL>AQUATIC': 62, // 자도르 퍼퓸 도 · 2순위 미반영
  'FLORAL>MUSK': 163, // 플라워 바이 겐조
  'FLORAL>GOURMAND': 11, // 미스 디올 오 드 퍼퓸 (2021)
  'FLORAL>WOODY': 62, // 자도르 퍼퓸 도 · 2순위 미반영
  'FLORAL>AMBER': 62, // 자도르 퍼퓸 도 · 2순위 미반영

  'GREEN>FLORAL': 138, // 유 오어 썸원 라이크 유 · 2순위 미반영
  'GREEN>CITRUS': 2, // 그린 티
  'GREEN>FRUITY': 138, // 유 오어 썸원 라이크 유 · 2순위 미반영
  'GREEN>AQUATIC': 73, // 얼 그레이 & 큐컴버
  'GREEN>MUSK': 89, // 90 퓨어 화이트
  'GREEN>GOURMAND': 138, // 유 오어 썸원 라이크 유 · 2순위 미반영
  'GREEN>WOODY': 164, // 몽 베티버
  'GREEN>AMBER': 8, // 타싯

  'CITRUS>FLORAL': 31, // 네롤리 포르토피노
  'CITRUS>GREEN': 170, // 아티잔 퓨어
  'CITRUS>FRUITY': 81, // 에로스 에너지 · 2순위 미반영
  'CITRUS>AQUATIC': 81, // 에로스 에너지 · 2순위 미반영
  'CITRUS>MUSK': 70, // 디올 옴므 콜로뉴 2022
  'CITRUS>GOURMAND': 126, // 파뷸러스 유자
  'CITRUS>WOODY': 28, // 코코 마드모아젤
  'CITRUS>AMBER': 116, // 스파크 업

  'FRUITY>FLORAL': 45, // 인칸토 참스
  'FRUITY>GREEN': 165, // 땡큐 넥스트 2.0 · 2순위 미반영
  'FRUITY>CITRUS': 165, // 땡큐 넥스트 2.0 · 2순위 미반영
  'FRUITY>AQUATIC': 171, // 인스파이어
  'FRUITY>MUSK': 194, // 무스키 가든
  'FRUITY>GOURMAND': 39, // 지미 추 블라썸
  'FRUITY>WOODY': 165, // 땡큐 넥스트 2.0 · 2순위 미반영
  'FRUITY>AMBER': 165, // 땡큐 넥스트 2.0 · 2순위 미반영

  'AQUATIC>FLORAL': 185, // 세일링 데이 · 2순위 미반영
  'AQUATIC>GREEN': 136, // 폴로 블루
  'AQUATIC>CITRUS': 110, // 클린 웜 코튼
  'AQUATIC>FRUITY': 185, // 세일링 데이 · 2순위 미반영
  'AQUATIC>MUSK': 166, // 터치 포 맨
  'AQUATIC>GOURMAND': 185, // 세일링 데이 · 2순위 미반영
  'AQUATIC>WOODY': 106, // 르 셀 디쎄이
  'AQUATIC>AMBER': 185, // 세일링 데이 · 2순위 미반영

  'MUSK>FLORAL': 125, // 소프 클린 소프
  'MUSK>GREEN': 107, // 더 머스크 · 2순위 미반영
  'MUSK>CITRUS': 107, // 더 머스크 · 2순위 미반영
  'MUSK>FRUITY': 107, // 더 머스크 · 2순위 미반영
  'MUSK>AQUATIC': 107, // 더 머스크 · 2순위 미반영
  'MUSK>GOURMAND': 107, // 더 머스크 · 2순위 미반영
  'MUSK>WOODY': 190, // 업 앳 던
  'MUSK>AMBER': 6, // 어나더 13

  'GOURMAND>FLORAL': 153, // 아이 원트 츄 포에버 · 2순위 미반영
  'GOURMAND>GREEN': 153, // 아이 원트 츄 포에버 · 2순위 미반영
  'GOURMAND>CITRUS': 153, // 아이 원트 츄 포에버 · 2순위 미반영
  'GOURMAND>FRUITY': 150, // 베리 섹시
  'GOURMAND>AQUATIC': 153, // 아이 원트 츄 포에버 · 2순위 미반영
  'GOURMAND>MUSK': 75, // 프라다 캔디
  'GOURMAND>WOODY': 153, // 아이 원트 츄 포에버 · 2순위 미반영
  'GOURMAND>AMBER': 75, // 프라다 캔디

  'WOODY>FLORAL': 159, // 벨벳 아이리스
  'WOODY>GREEN': 123, // 맨카인드 라이즈
  'WOODY>CITRUS': 108, // 오렌지 X 상탈
  'WOODY>FRUITY': 35, // 잉글리쉬 오크 & 헤이즐넛 · 2순위 미반영
  'WOODY>AQUATIC': 35, // 잉글리쉬 오크 & 헤이즐넛 · 2순위 미반영
  'WOODY>MUSK': 115, // 인텐스 세드라 부아제
  'WOODY>GOURMAND': 35, // 잉글리쉬 오크 & 헤이즐넛 · 2순위 미반영
  'WOODY>AMBER': 157, // 나르시소 로드리게즈 포 힘 블루 누아르

  'AMBER>FLORAL': 51, // 집시 워터 · 2순위 미반영
  'AMBER>GREEN': 72, // 쏘바쥬
  'AMBER>CITRUS': 51, // 집시 워터 · 2순위 미반영
  'AMBER>FRUITY': 122, // 통카 콜라
  'AMBER>AQUATIC': 51, // 집시 워터 · 2순위 미반영
  'AMBER>MUSK': 119, // 인스턴트 크러쉬
  'AMBER>GOURMAND': 161, // 디빈 바닐
  'AMBER>WOODY': 68, // 포트레이트 오브 어 레이디
}

/** 표의 열쇠입니다. 고른 순서대로 `>` 로 잇습니다(`MUSK`, `MUSK>WOODY`). */
export function startingKey(picks: readonly ScentFamilyKey[]): string {
  return picks.join('>')
}
