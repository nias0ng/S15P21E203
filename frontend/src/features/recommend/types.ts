/** 자연어 추천 도메인 타입 (A06 — NLR-01 · NLR-06 · NLR-07) */

/** 추천 이유 한 줄 (NLR-07). 예: "'차분한' → 시더 · 베티버", "가을 어울림 평가 71%". */
interface RecommendReason {
  /** 사용자가 입력한 표현. 근거가 입력어와 무관하면 비워둡니다 */
  phrase: string | null
  evidence: string
}

export interface RecommendedPerfume {
  perfumeId: number
  /** 한국어 이름이 없으면 영어입니다 */
  name: string
  brand: string | null
  thumbnailUrl: string | null
  /** 1~3개입니다 */
  reasons: RecommendReason[]
}

/**
 * 결과의 종류. 0개인 경우가 둘(`NO_CONDITION` 조건을 못 뽑음 · `NO_RESULT` 향수가 없음)이고
 * 할 말이 다릅니다. NOTE: 0개일 때 인기 향수를 대신 보여주면 근거가 없어 NLR-07 을 어깁니다.
 */
type RecommendStatus = 'OK' | 'OK_RELAXED' | 'NO_CONDITION' | 'NO_RESULT'

/** 향수는 0~5개입니다. `OK` · `OK_RELAXED` 면 비어 있지 않습니다 */
/**
 * 향이 아닌 추천 근거 하나 (NLR-07). 성별 · 계절 · 낮밤 · 노트로 후보를 좁혔을 때만 옵니다.
 * 추천 다섯 개에 똑같이 걸린 조건이라 향수마다가 아니라 목록 위 한 줄로 씁니다.
 */
export interface RecommendMatchedData {
  field: 'gender' | 'season' | 'daypart' | 'note'
  /** 화면에 그대로 쓸 한국어입니다 — AI 가 한국어로 주므로 우리가 번역하지 않습니다 */
  label: string
}

export interface RecommendResult {
  /**
   * 이 추천의 손잡이 (NLR-08). 클릭 · 만족도를 보낼 때 그대로 돌려보냅니다.
   * 번호가 아니라 추측할 수 없는 값입니다 — 비회원도 추천을 받아 신원으로는 못 막고,
   * 순차 번호를 내보내면 1부터 세기만 해도 남의 추천에 만족도를 남길 수 있습니다.
   *
   * NOTE: **`null` 일 수 있습니다** — 서버가 기록에 실패한 경우입니다. 추천 자체는 정상이고,
   * 그때는 보낼 곳이 없으니 설문을 묻지 않습니다.
   */
  recommendationToken: string | null
  status: RecommendStatus
  query: string
  /**
   * 향으로 고른 것이 아닙니다. 성별 · 계절 · 낮밤 · 노트로만 후보를 좁혔고 순서를 정한 것은
   * **평가자 수**입니다.
   *
   * NOTE: `status` 로는 못 가립니다 — 이때도 `OK_RELAXED` 라 조건을 넓힌 경우와 값이 같습니다.
   * 화면이 향을 보고 고른 것처럼 쓰면 거짓말이 됩니다.
   */
  pickedWithoutScentCondition: boolean
  /**
   * 향이 아닌 근거들. 조건을 안 걸었으면 빈 배열입니다.
   *
   * NOTE: **비어 있지 않으면 반드시 그립니다.** 노트를 말한 문장은 AI 가 그 말을 accord 로
   * 풀어 보내면서 어느 글자에서 왔는지를 안 채워, `perfumes[].reasons` 의 `phrase` 가 비고
   * 사용자가 쓴 말은 여기에만 남습니다(노트 별칭 196개 중 183개). 안 그리면 "미모사랑 장미
   * 들어간 향수" 를 찾은 사람의 화면에 미모사도 장미도 없습니다.
   */
  matchedData: RecommendMatchedData[]
  perfumes: RecommendedPerfume[]
}

/**
 * 추천 만족도 (NLR-08). **점수가 아니라 세 분류입니다.**
 *
 * NOTE: 1~5점 설문으로 만들 수 없습니다 — 백엔드가 이 세 값만 받습니다. 점수로 받으면
 * 평균을 내게 되는데 "3.4점" 이 무엇을 뜻하는지 설명할 수 없어서 "만족이 몇 건" 으로만
 * 읽히는 세 분류로 정해져 있습니다(`NlrFeedbackRequest` 주석). 화면에 보일 한국어 문구는
 * 이쪽이 정합니다 — 저장 값과 표기를 떼어 둔 것이라 문구를 바꿔도 쌓인 데이터는 그대로입니다.
 */
export type Satisfaction = 'SATISFIED' | 'NEUTRAL' | 'DISSATISFIED'

/** 만족도와 함께 쓰는 한마디의 길이 상한. 넘기면 서버가 400 입니다 */
export const FEEDBACK_COMMENT_MAX = 500

/**
 * 개인화 맞춤 추천 (REC-12 · REC-13) — 진열대의 추천 카드 한 건. 묻지 않았는데 오는 것이라
 * 이유가 없으면 광고로 읽힙니다. 입력한 표현이 없어 `phrase` 는 늘 null 입니다.
 */
export interface PersonalRecommendation {
  perfumeId: number
  name: string
  brand: string
  thumbnailUrl: string | null
  headline: string
  reasons: RecommendReason[]
}

/** 추천 카드가 나타나는 진열대 향수 수. NOTE: 임시값이고 추천 엔진이 붙으면 다시 정합니다. */
export const RECOMMEND_MIN_SHELF_ITEMS = 3
