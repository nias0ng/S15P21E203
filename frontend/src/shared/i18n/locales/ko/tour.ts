export const tour = {
  tip: {
    close: '안내 닫기',
    stopAll: '안내 그만 보기',
  },
  welcome:
    '향수를 향 계열별로 펼친 바다예요. 원하는 느낌을 적거나, 떠 있는 부표를 눌러 보세요.',
  // NOTE: 방식 이름은 map 묶음의 search.mode 와 같아야 합니다
  search: "'자연어'는 느낌을 문장으로, '이름'은 아는 향수를 찾아요.",
  results: '카드를 누르면 왜 골랐는지 아래에 펼쳐져요.',
  guide: {
    trigger: '이용 안내',
    title: '이용 안내',
    controlsTitle: '이렇게 움직여요',
    controls: {
      sea: '바다를 누르면 배가 그쪽으로 가요',
      buoy: '부표를 누르면 그 향수 카드가 열려요',
      keys: '← → ↑ 로 배를 직접 몰 수 있어요',
      minimap: '미니맵의 이름을 누르면 그 해역으로 가요',
      minimapTouch: '미니맵의 이름을 두 번 누르면 그 해역으로 가요',
    },
    termsTitle: '이런 말을 써요',
    terms: {
      buoy: { term: '부표', desc: '바다에 떠 있는 향수 하나' },
      zone: {
        term: '해역',
        desc: '같은 향 계열(플로럴 · 우디 …)이 모인 바다',
      },
      explored: {
        term: '탐색 %',
        desc: '미니맵에서 밝게 트인 곳 — 배가 지나온 바다의 몫',
      },
      chart: { term: '해도', desc: '미니맵 오른쪽 위 단추로 크게 펼치는 지도' },
      log: {
        term: '향해 일지',
        desc: '지나온 해역과 발견한 향수의 기록 (로그인)',
      },
      cabin: {
        term: '선실 · 진열대',
        desc: '배를 누르면 들어가는 곳 — 저장한 향수가 진열대에 모여요 (로그인)',
      },
    },
    restart: '안내 처음부터 다시 보기',
  },
}
