export const map = {
  scene: {
    title: '향 지도',
  },
  search: {
    group: '검색 방식',
    fieldLabel: {
      nl: '자연어로 향수 추천받기',
      normal: '향수 이름으로 찾기',
    },
    placeholder: {
      nl: '어떤 향을 찾고 계신가요?',
      normal: '향수 · 브랜드 이름으로 찾기',
    },
    mode: {
      nl: '자연어',
      normal: '이름',
    },
    hint: {
      nl: '느낌 · 상황을 말로 적으면 어울리는 향수를 추천해 드립니다',
      normal: '지도에 있는 향수 200개를 이름 · 브랜드로 찾습니다',
    },
    starters: {
      label: '이렇게 찾아 보세요',
      rain: '비 온 뒤 흙냄새',
      soap: '출근할 때 은은한 비누 향',
      vanilla: '달콤한 바닐라 향',
      floral: '꽃향기 나는 향수',
      chanel: '샤넬',
      joMalone: '조 말론',
      byredo: '바이레도',
      diptyque: '딥티크',
      popular: '요즘 인기 향수 보기 →',
    },
    switchTo: '{{mode}} 검색으로 바꾸기',
  },
  searchModal: {
    title: '지도에서 찾기',
    keyword: '찾는 말',
    count_one: '{{count}}개',
    count_other: '{{count}}개',
    countCapped_one: '{{count}}개 까지',
    countCapped_other: '{{count}}개 까지',
    rank: '지도 순위',
    loadError: {
      title: '지도 향수 목록을 불러오지 못했습니다',
      description: '잠시 후 다시 시도해 주세요.',
    },
    empty: {
      title: '지도에 그런 향수가 없습니다',
      description:
        '지도에는 향수 200개만 떠 있습니다. 브랜드 이름으로 다시 찾아보거나, 검색 방식을 자연어로 바꿔 보세요.',
    },
  },
  cabin: {
    label: '선실',
    shelf: '진열대',
    collection: '컬렉션',
    loginRequired: '로그인이 필요합니다',
  },
  voyageLog: {
    title: '향해 일지',
    collapse: '향해 일지 접기',
    expand: '향해 일지 펼치기',
    loading: '일지를 불러오는 중입니다',
    guest: '로그인하면 지나온 해역이 쌓입니다.',
    login: '로그인',
    error: '일지를 불러오지 못했습니다',
    empty: '아직 들어간 해역이 없습니다',
    today: '오늘',
    regions: '지나온 해역',
    perfumes: '발견한 향수',
    moreRegions_one: '해역 {{count}}곳 더 보기',
    moreRegions_other: '해역 {{count}}곳 더 보기',
    morePerfumes_one: '향수 {{count}}개 더 보기',
    morePerfumes_other: '향수 {{count}}개 더 보기',
  },
  quality: {
    startLow:
      '내장 그래픽이라 가벼운 화면으로 시작했습니다. 오른쪽 위 톱니바퀴에서 바꿀 수 있습니다',
    down: '화면이 끊겨 그래픽을 한 단계 낮췄습니다',
    slow: '전원을 연결하거나 Windows 그래픽 설정에서 브라우저를 고성능으로 두면 더 부드럽습니다',
  },
  home: {
    cannotSave: '이 향수는 아직 진열대에 담을 수 없습니다',
    saved: '진열대에 저장했습니다',
  },
}
