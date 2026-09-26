/** 자연어 추천 도메인 타입 (A06 — NLR-01 · NLR-06 · NLR-07) */

/**
 * 추천 이유 한 묶음 (NLR-07). 사용자가 쓴 표현 하나와 그 표현이 가리키는 향 특성들입니다.
 * 예: `{ phrase: '빨래', evidence: 'soapy · fresh', strengths: [100, 93] }`
 */
export interface RecommendReason {
  /** 사용자가 입력한 표현. 근거가 입력어와 무관하면 비워둡니다 */
  phrase: string | null
  /**
   * 향 특성 이름(`soapy` 같은 영어 — `accordLabel` 로 바꿉니다). 향 근거가 하나도 없는 향수는
   * 향이 아닌 조건의 한국어(`남성적인`)로 채워 옵니다. 여럿이면 ` · ` 로 이어져 있습니다.
   */
  evidence: string
  /**
   * `evidence` 를 ` · ` 로 자른 조각마다의 향 강도(0~100) — 같은 순서 · 같은 개수입니다.
   * 향이 아닌 조건으로 채운 이유는 자리마다 `null` 입니다.
   *
   * NOTE: 백분율이 아닙니다. 100 은 "이 향수에서 그 향이 가장 세게 잡혔다" 는 뜻이라 `%` 를
   * 붙이면 없는 뜻이 생깁니다.
   * NOTE: 빠질 수 있습니다 — 이 칸을 모르는 서버와 만나면 없고, 그때는 숫자 없이 문장만 그립니다.
   */
  strengths?: (number | null)[]
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
interface RecommendMatchedData {
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
 * 개인화 맞춤 추천 (REC-12 · REC-13, S15P21E203-243 · -419) — `GET /recommendations/personalized`
 * 한 번에 향수 **한 병**입니다.
 *
 * 서버가 사용자마다 점수 높은 후보 열 병을 모아 두고(취향 테스트 0.35 · 적합도 0.50 · 최근 본 향수
 * 0.15), 부를 때마다 그중 하나를 점수에 비례한 제비뽑기로 골라 줍니다. 그래서 **부를 때마다 다른 병이
 * 올 수 있고**, 화면이 실제로 보였다고 알린 병(`recordPersonalExposure`)은 사흘 동안 뽑기에서 빠집니다.
 *
 * NOTE: 브랜드 · 향 특성 · 점수는 오지 않습니다. 브랜드와 향 특성은 화면이 향수 상세로 채웁니다
 * (MyShelfPage). 근거는 **한 문장**이고 틀이 셋이라 화면이 틀을 읽어 갈래를 가립니다(personalReason).
 */
export interface PersonalRecommendation {
  /**
   * 이 추천의 손잡이(UUID). 화면에 실제로 보인 뒤 노출을 기록할 때 돌려보냅니다.
   * **받은 뒤 10분만 삽니다** — 그 뒤에 보내면 404 라 노출이 남지 않습니다.
   */
  recommendationToken: string
  perfumeId: number
  /** 한국어 이름이 없으면 영어입니다 */
  name: string
  /** 원본 사진을 먼저, 없으면 종이 질감 사진입니다. 둘 다 없으면 null */
  imageUrl: string | null
  /** 점수에 가장 크게 든 근거 한 문장 — 서버가 세 틀 중 하나로 짓습니다(readPersonalReason) */
  reason: string
}

/**
 * 개인화 추천을 부른 결과. 추천이 없는 두 경우는 **할 말이 달라서** 오류가 아니라 값으로 받습니다.
 *
 *   ready             추천 한 병
 *   needs-taste-test  취향 테스트를 안 해서 추천할 수 없음(400) — 테스트로 이끌 수 있습니다
 *   none              추천할 향수가 없음(404) · 다시 셈하다 실패해 모아 둔 후보도 없음(503)
 */
export type PersonalRecommendationResult =
  | { status: 'ready'; recommendation: PersonalRecommendation }
  | { status: 'needs-taste-test' }
  | { status: 'none' }
