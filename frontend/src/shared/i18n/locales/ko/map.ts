export const map = {
  scene: {
    title: '향 지도',
  },
  search: {
    fieldLabel: '느낌으로 향수 추천받기',
    // 물음 대신 예시입니다 — 시작 문장은 눌러야 펼쳐집니다(지인 피드백 F1 · F19, SceneSearchBar 머리말)
    placeholder: '예) 상큼한 향, 풀향',
    // 입력칸 왼쪽의 이름표 — 무엇을 적는 칸인가를 말합니다. '자연어' 는 만든 사람의 말이었습니다(지인 피드백 F1)
    tag: '느낌으로',
    hint: '느낌 · 상황을 말로 적으면 어울리는 향수를 추천해 드립니다',
    starters: {
      label: '이렇게 찾아 보세요',
      rain: '비 온 뒤 흙냄새',
      soap: '출근할 때 은은한 비누 향',
      vanilla: '달콤한 바닐라 향',
      floral: '꽃향기 나는 향수',
      popular: '요즘 인기 향수 보기 →',
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
