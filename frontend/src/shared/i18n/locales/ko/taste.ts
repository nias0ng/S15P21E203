export const taste = {
  /** 타일의 형용사. 키는 `SCENT_FAMILY_KEYS` 를 소문자로 — 계열 이름은 common 의 scentFamily 입니다 */
  families: {
    floral: '화사한',
    green: '싱그러운',
    citrus: '상큼한',
    fruity: '발랄한',
    aquatic: '시원한',
    musk: '포근한',
    gourmand: '달콤한',
    woody: '차분한',
    amber: '따뜻한',
  },
  picker: {
    label: '향 계열 고르기',
    rank: '{{order}}순위',
  },
  step: {
    kicker: '취향 테스트',
    title: '어떤 향에 마음이 가세요?',
    lead: '끌리는 향을 최대 두 개까지 골라주세요. 고른 향에 가장 가까운 향수에서 향 지도를 시작해요.',
    loadFailedTitle: '향 지도 데이터를 불러오지 못했습니다',
    loadFailedDescription: '다시 시도해주세요.',
    picked: '고른 향 ',
    submit: '출발점 찾기',
    saveFailed: '결과를 저장하지 못했습니다. 다시 시도해주세요.',
    noStart:
      '고르신 1순위 향의 구역에서 출발점을 찾지 못했어요. 잠시 뒤 다시 시도해주세요.',
  },
  result: {
    headline: {
      rare: '흔치 않은 조합을 고르셨네요',
      primaryOnly: '1순위 향으로 출발점을 잡았어요',
      normal: '출발점을 찾았어요',
    },
    lead: {
      rare: '두 향을 함께 담은 향수는 향 지도에 하나뿐이에요. 그 한 병이 지금 취향을 대표해요.',
      primaryOnly:
        '1순위로 고르신 {{first}} 향에 맞춰 출발점을 잡았어요. 2순위로 고르신 {{second}} 향은 이번 결과에는 반영되지 않았어요.',
      two: '1순위로 고르신 {{first}} 향이 더 진하게 살아 있는 향수를 찾았어요.',
      one: '고르신 {{first}} 향이 가장 진하게 살아 있는 향수를 찾았어요.',
    },
    closing: '향 지도에서 내 출발점을 확인해 보세요.',
    retry: '다시 하기',
    confirm: '향 지도로 가기',
    retrySave: '다시 시도',
  },
}
