export const layout = {
  header: {
    primaryNav: '주요 메뉴',
    account: '내 계정',
    profilePhoto: '내 프로필 사진',
    editProfile: '개인 정보 수정',
    community: {
      reviews: '후기',
      free: '자유',
    },
  },
  graphics: {
    trigger: '그래픽 설정',
    title: '그래픽 품질',
    recommended: '(권장)',
    tier: {
      high: '높음',
      mid: '보통',
      low: '낮음',
    },
    mode: {
      auto: { label: '자동', hint: '기기에 맞춰 알아서 맞춥니다' },
      high: { label: '높음', hint: '가장 선명하게 · 빛 번짐 · 배 반사' },
      mid: { label: '보통', hint: '조금 덜 선명하게, 더 부드럽게' },
      low: { label: '낮음', hint: '가장 가볍게 · 배터리를 아낍니다' },
    },
    live: '지금 {{tier}}',
    liveIntegrated: '지금 {{tier}} · 내장 그래픽',
    integratedTip:
      '외장 그래픽이 있는 노트북이라면 Windows 설정 › 시스템 › 디스플레이 › 그래픽에서 브라우저를 ‘고성능’으로 두면 더 부드럽습니다',
  },
  feedback: {
    link: '피드백 보내기 (새 탭)',
    greeting: '버튼을 눌러 피드백을 전해보세요!',
  },
  errorPage: {
    title: '문제가 발생했어요',
    unknown: '알 수 없는 오류가 발생했습니다.',
  },
  notFound: {
    description: '존재하지 않는 페이지입니다.',
  },
  confirmDialog: {
    title: '삭제할까요?',
    description: '삭제하면 되돌릴 수 없습니다.',
  },
  loginRequired: {
    title: '로그인이 필요합니다',
    description: '추천 결과는 로그인 없이도 볼 수 있습니다.',
  },
  pagination: {
    label: '페이지',
    previous: '이전',
    previousPage: '이전 페이지',
    next: '다음',
    nextPage: '다음 페이지',
    page: '{{page}}쪽',
  },
  perfumeCard: {
    popular: '인기',
    rank: '{{label}} {{rank}}위',
  },
  perfumePicker: {
    searchLabel: '향수명 또는 브랜드명으로 검색',
    placeholder: '향수명 · 브랜드 검색',
    notFoundTitle: '향수를 찾지 못했습니다',
    notFoundDescription: '검색어를 바꿔 보세요.',
    emptyTitle: '향수를 검색해 주세요',
    emptyDescription:
      '향수명이나 브랜드명을 입력하면 고를 수 있는 향수가 나옵니다.',
  },
  starRating: {
    unrated: '아직 매기지 않음',
    score: '{{max}}점 중 {{score}}점',
  },
}
