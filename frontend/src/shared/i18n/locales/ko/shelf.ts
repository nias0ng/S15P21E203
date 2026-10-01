export const shelf = {
  category: {
    OWNED: '보유 중',
    TRIED: '시향해 봄',
    WISH: '보유 희망',
  },
  // 절반만 끝난 저장에서 빠진 칸의 이름
  part: {
    category: '분류',
    rating: '적합도',
    memo: '메모',
  },
  actions: {
    cancel: '취소',
    next: '다음',
    change: '변경',
  },
  fields: {
    categoryLabel: '진열대 분류',
    categoryRequired: '진열대 분류를 골라 주세요',
    required: '필수',
    rating: '내 취향 적합도',
    clearRating: '해제',
    memo: '메모',
  },
  editModal: {
    title: '변경하기',
    save: '변경',
    hint: '메모와 적합도는 비울 수 있습니다.',
  },
  registerModal: {
    title: '향수 등록',
    submit: '진열대에 담기',
    alreadyInShelf: '이미 진열대에 담은 향수입니다',
  },
  registerError: {
    partial: '진열대에 담았지만 {{parts}}은(는) 저장하지 못했습니다',
    fallback: '진열대에 저장하지 못했습니다.',
  },
  footer: {
    collection: '내 컬렉션',
    backToShelf: '진열대로',
  },
  pager: {
    position: '{{total}}개 중 {{index}}번째 향수',
    prev: '이전 향수',
    next: '다음 향수',
  },
  plaque: {
    menu: '진열대 분류',
    countBefore: ', 향수 ',
    countAfter_one: '개',
    countAfter_other: '개',
  },
  toolbar: {
    search: '향수 검색',
    placeholder: '향수 이름, 브랜드, 노트를 검색해보세요.',
  },
  wall: {
    region: '진열대',
    plaqueHint: '누르면 이 분류의 향수가 벽에 섭니다',
    prev: '이전 향수 보기',
    next: '다음 향수 보기',
  },
  detail: {
    region: '선택한 향수 정보',
    placeholder: '진열대에서 향수를 선택하면 여기에 정보가 표시됩니다',
    rating: '내 취향 적합도',
    remove: '저장 해제',
    edit: '변경하기',
    notesEmpty: '향조 정보가 아직 등록되지 않았어요',
    notesMore: '외 {{n}}',
    notesOther: '기타',
    memoPlaceholder: '이 향을 어디서 언제 맡았는지 적어두세요.',
  },
  page: {
    title: '나의 진열대',
    collectionTitle: '내 컬렉션',
    collectionCount_one: '{{count}}개',
    collectionCount_other: '{{count}}개',
    register: '+ 향수 등록',
    categoryEmptyPanel: '이 칸에 향수를 담으면 여기에서 자세히 볼 수 있어요',
    empty: {
      OWNED: {
        title: '아직 보유 중인 향수가 없어요',
        description: '가지고 있는 향수를 올려 두면 이 벽감에 섭니다.',
      },
      TRIED: {
        title: '아직 시향해 본 향수가 없어요',
        description: '매장에서 맡아 본 향수를 적어 두면 이 벽감에 모입니다.',
      },
      WISH: {
        title: '아직 갖고 싶은 향수가 없어요',
        description: '마음에 둔 향수를 담아 두면 이 벽감에서 기다립니다.',
      },
    },
    searchEmpty: {
      title: "'{{keyword}}' 에 맞는 향수가 이 칸에는 없어요",
      description: '메뉴판의 숫자로 다른 칸을 보거나 검색어를 바꿔 보세요.',
      clear: '검색어 지우기',
    },
    loginRequired: {
      title: '로그인하면 진열대를 볼 수 있습니다',
      description: '담아 둔 향수와 메모는 계정에 저장됩니다.',
      action: '로그인하러 가기',
    },
    loadError: {
      title: '진열대를 불러오지 못했습니다',
      description: '잠시 후 다시 시도해주세요.',
    },
    removeConfirm: {
      title: "'{{name}}' 를 진열대에서 뺄까요?",
      fallbackName: '향수',
      description: '적어둔 메모와 적합도도 함께 사라지고, 되돌릴 수 없습니다.',
      confirm: '저장 해제',
    },
    letter: {
      inShelf: '진열대에 있어요',
      addWish: '보유 희망에 담기',
    },
  },
  toast: {
    registered: '진열대에 등록했습니다',
    registerPartial: '진열대에 등록했지만 {{parts}}은(는) 저장하지 못했습니다',
    registerFailed: '진열대에 등록하지 못했습니다',
    edited: '변경했습니다',
    editPartial: '{{parts}}은(는) 바꾸지 못했습니다',
    editFailed: '변경하지 못했습니다',
    removed: '진열대에서 뺐습니다',
    removeFailed: '진열대에서 빼지 못했습니다',
    ratingFailed: '적합도를 저장하지 못했습니다',
    wishAdded: '보유 희망에 담았습니다',
    wishFailed: '진열대에 담지 못했습니다',
  },
}
