export const recommend = {
  /** 서버 `PersonalizedRecommendationService.reasonOf` 의 세 틀과 같은 말입니다 */
  personalReason: {
    fit: '높게 평가한 향수와 {{keyword}} 어코드가 비슷해요.',
    recent: '최근 살펴본 향수에서 자주 만난 {{keyword}} 어코드를 담고 있어요.',
    taste: '취향 테스트에서 선택한 {{keyword}} 계열과 잘 맞아요.',
  },
  letter: {
    headline: {
      fit: '마음에 든 향과 닮은 향수를 찾았어요',
      recent: '요즘 자주 들여다본 결을 담은 향수예요',
      taste: '취향 테스트가 고른 향수가 도착했어요',
      unknown: '당신을 위한 향수가 도착했어요',
    },
    nextNote: {
      none: '지금은 새로 보낼 향수가 없어요',
      failed: '새 편지를 받지 못했어요. 다시 눌러 주세요',
    },
    fold: '편지 접기',
    salutation: '{{name}}님께',
    photoPending: '사진 준비 중',
    accords: '이 향수의 향 특성',
    viewDetails: '자세히 보기',
    previous: '앞 편지',
    next: '다음 편지',
    refreshing: '새 편지를 봉하는 중',
    another: '다른 향수 추천받기',
    sign: '향해 드림',
    envelope: {
      invitation:
        '맞춤 향수 편지 받는 법 보기 — 취향 테스트를 마치면 편지가 도착해요',
      unread: '새로 온 향수 편지 열기',
      read: '향수 편지 다시 열기',
    },
    sheet: '당신을 위한 향수 편지',
    invitation: {
      headline: '아직 당신의 취향을 몰라서 편지를 못 썼어요',
      body: '좋아하는 향 계열 몇 개만 고르면, 진열대에 매긴 적합도와 요즘 살펴본 향수까지 함께 읽어 맞춤 향수를 골라 보내 드려요.',
      action: '취향 테스트 하러 가기',
    },
  },
  nlr: {
    /** 영어 화면에만 씁니다 — AI 가 한국어 문장을 기준으로 읽습니다 */
    koreanHint: '한국어로 적으면 가장 잘 알아듣습니다',
    title: '추천 결과',
    asked: '입력한 말 · ',
    narrowedBefore: '',
    narrowedAfter: ' 조건으로 좁혔습니다.',
    relaxedWithoutScent:
      '향을 말씀하신 것으로 읽지 못해, 위 조건에 맞는 향수를 평가가 많은 순으로 골랐습니다. 냄새로 풀어서 한 줄 덧붙이면 향으로 골라 드릴 수 있습니다.',
    relaxed:
      '조건이 넓어 비슷한 향까지 함께 골랐습니다. 상황이나 계절을 덧붙이면 더 좁혀 드릴 수 있습니다.',
    empty: {
      noConditionTitle: '어떤 향인지 아직 못 알아들었습니다',
      noConditionDescription:
        '냄새로 풀어서 적어 보세요 — ‘비누 냄새 나는 향’, ‘비 온 뒤 흙냄새’ 처럼요.',
      noResultTitle: '말씀하신 향에 맞는 향수를 찾지 못했습니다',
      noResultDescription:
        '조건을 조금 줄이면 찾을 수 있습니다. 계절이나 상황 하나를 빼고 다시 적어 보세요.',
    },
    error: {
      rateLimitedTitle: '조금 쉬었다 찾아 주세요',
      rateLimitedDescription:
        '짧은 시간에 여러 번 찾으셨습니다. 잠시 뒤에 다시 됩니다.',
      unavailableTitle: '추천 서버가 지금 답하지 않습니다',
      unavailableDescription:
        '향수 찾기 · 진열대 같은 다른 기능은 그대로 쓰실 수 있습니다.',
      failedTitle: '추천을 불러오지 못했습니다',
      failedDescription: '잠시 후 다시 시도해 주세요.',
    },
    card: {
      rankLabel: '추천',
      reasonLabel: '{{name}} 추천 이유',
      viewDetails: '자세히 보기',
      reasonTitle: '추천 이유',
      strengthHint: ' · 괄호 안은 향 강도 0~100',
    },
    /** 추천 이유 한 문장의 토막들. 말의 차례가 달라 앞 · 뒤 토막을 따로 둡니다 */
    sentence: {
      conditionStart: '요청하신 ',
      conditionEnd: ' 조건에 맞는 향수입니다.',
      start: '이 향수는 ',
      joiner: ', ',
      phraseBefore: '‘{{phrase}}’{{particle}} 가리키는 ',
      phraseAfter: '',
      requestedBefore: '요청하신 ',
      requestedAfter: '',
      end: ' 향을 가지고 있습니다.',
    },
    /** AI 가 주는 향이 아닌 조건의 한국어(`nlr_engine.py` 의 표)와 같은 말입니다 */
    conditions: {
      masculine: '남성적인',
      feminine: '여성적인',
      unisex: '중성적인',
      spring: '봄에 어울리는',
      summer: '여름에 어울리는',
      fall: '가을에 어울리는',
      winter: '겨울에 어울리는',
      day: '낮에 어울리는',
      night: '밤에 어울리는',
    },
  },
  feedback: {
    title: '추천은 어떠셨나요',
    exitTitle: '추천에 대한 후기를 남기지 않고 나가시겠습니까?',
    exitDescription:
      '적던 한마디는 저장되지 않고, 이 추천에 대한 설문은 다시 뜨지 않습니다.',
    exit: '나가기',
    thanks: '고맙습니다. 남겨 주신 답은 추천을 넓히는 데만 씁니다.',
    close: '닫기',
    asked: '입력한 말 · ',
    satisfaction: '추천 만족도',
    options: {
      satisfied: '마음에 들어요',
      neutral: '보통이에요',
      dissatisfied: '아쉬워요',
    },
    comment: '한마디 (선택)',
    placeholder: '어떤 점이 좋았는지, 무엇이 아쉬웠는지 적어 주세요',
    tooLong: '{{max}}자까지 쓸 수 있습니다',
    skip: '건너뛰기',
    send: '보내기',
    error: {
      rateLimited: '짧은 시간에 여러 번 보내셨습니다. 잠시 뒤에 다시 됩니다.',
      gone: '이 추천의 기록이 남아 있지 않아 보내지 못했습니다.',
      failed: '답을 보내지 못했습니다. 잠시 후 다시 시도해 주세요.',
    },
  },
}
