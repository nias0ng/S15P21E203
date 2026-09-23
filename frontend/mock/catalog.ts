/**
 * 목데이터 모드의 향수 — 서버에 사진(일반 · 종이 질감)이 올라간 156개입니다.
 *
 * 한 번 뽑아 둔 값입니다 (2026-09-17).
 *   - 이름 · 브랜드 · 한글 표기 · 계열 · 성별: `landing/src/perfumes-data.js` (3D 지도 데이터)
 *   - 사진이 있는 향수 · 순위: `backend/db/seed/perfume_images.csv`
 *
 * **perfumeId 는 fragrantica_id 입니다.** 실제 DB 의 perfume_id 와 다릅니다 — 목데이터
 * 안에서만 맞으면 되고, 3D 엔진 데이터의 `id` 와 같은 번호라 찾기 쉽습니다.
 *
 * 한 줄에 한 향수를 ` | ` 로 나눕니다:
 *   perfumeId | 순위 | 계열 | 성별 | 브랜드 | 이름 | 브랜드(한글) | 이름(한글)
 * 객체 배열로 두면 Prettier 가 한 향수를 열 줄로 펼쳐 1,500줄이 됩니다.
 */

export type MockFamily =
  | 'CITRUS'
  | 'FRUITY'
  | 'FLORAL'
  | 'GREEN'
  | 'AQUATIC'
  | 'WOODY'
  | 'AMBER'
  | 'GOURMAND'
  | 'MUSK'

export interface MockPerfume {
  perfumeId: number
  /** 한국 선정 순위 — 로컬 사진 파일 이름의 앞 번호(`001_…`)와 같습니다 */
  rank: number
  family: MockFamily
  gender: 'female' | 'male' | 'unisex'
  brand: string
  name: string
  brandKo: string | null
  nameKo: string | null
}

const TABLE = `
65738 | 1 | MUSK | unisex | Diptyque | Orphéon Eau de Parfum | 딥티크 | 오르페옹 오 드 퍼퓸
83 | 2 | GREEN | female | Elizabeth Arden | Green Tea | 엘리자베스 아덴 | 그린티
74041 | 3 | AQUATIC | unisex | Jo Malone London | Wood Sage & Sea Salt Cologne | 조 말론 런던 | 우드 세이지 앤 씨 솔트 코롱
988 | 5 | FLORAL | female | Lanvin | Eclat d’Arpège | 랑방 | 에클라 드 아르페쥬
10131 | 6 | MUSK | unisex | Le Labo | Another 13 | 르 라보 | 어나더 13
14214 | 7 | FLORAL | female | Diptyque | Eau Rose | 딥티크 | 오 로즈
32134 | 8 | GREEN | unisex | Aesop | Tacit | 이솝 | 테싯
20542 | 9 | FLORAL | unisex | Maison Martin Margiela | Lazy Sunday Morning | 메종 마르지엘라 | 레이지 선데이 모닝
6686 | 10 | FLORAL | female | Byredo | Blanche | 바이레도 | 블랑쉬
68905 | 11 | FLORAL | female | Dior | Miss Dior Eau de Parfum (2021) | 디올 | 미스 디올 오 드 퍼퓸 (2021)
78945 | 12 | FLORAL | female | Dior | Miss Dior Blooming Bouquet (2023) | 디올 | 미스 디올 블루밍 부케 (2023)
72040 | 13 | GREEN | unisex | Diptyque | Philosykos Eau de Toilette | 딥티크 | 필로시코스 오 드 뚜왈렛
6188 | 15 | MUSK | unisex | Kiehl's | Original Musk | 키엘 | 오리지널 머스크
8441 | 16 | FLORAL | female | Byredo | La Tulipe | 바이레도 | 라 튤립
15134 | 17 | GREEN | female | Jo Malone London | Blackberry & Bay | 조 말론 런던 | 블랙베리 앤 베이
6458 | 18 | WOODY | unisex | Byredo | Bal d'Afrique | 바이레도 | 발 다프리크
276 | 20 | CITRUS | unisex | Calvin Klein | CK One | 캘빈 클라인 | CK 원
1483 | 21 | WOODY | female | Chanel | Chance Eau Fraiche | 샤넬 | 샹스 오 후레쉬
56741 | 22 | GOURMAND | female | Ariana Grande | Thank U, Next | 아리아나 그란데 | 땡큐, 넥스트
1360 | 23 | FLORAL | female | Chanel | Chanel N°5 Eau Premiere | 샤넬 | 오 프르미에르
131717 | 24 | MUSK | unisex | Diptyque | Fleur de Peau | 딥티크 | 플레르 드 뽀
607 | 25 | CITRUS | male | Chanel | Allure Homme Sport | 샤넬 | 알뤼르 옴므 스포츠
39970 | 26 | GOURMAND | female | Ariana Grande | Sweet Like Candy | 아리아나 그란데 | 스위트 라이크 캔디
31661 | 27 | GOURMAND | female | Ariana Grande | Ari | 아리아나 그란데 | 아리
611 | 28 | WOODY | female | Chanel | Coco Mademoiselle | 샤넬 | 코코 마드모아젤
30796 | 29 | CITRUS | female | Chanel | Chance Eau Vive | 샤넬 | 샹스 오 비브
184 | 30 | FLORAL | female | Lancôme | Miracle | 랑콤 | 미라클
12192 | 31 | CITRUS | unisex | Tom Ford | Neroli Portofino | 톰 포드 | 네롤리 포르토피노
48478 | 32 | MUSK | female | Lanvin | Modern Princess Eau Sensuelle | 랑방 | 모던 프린세스 오 센슈얼
18 | 33 | GREEN | unisex | Hermès | Un Jardin Sur Le Nil | 에르메스 | 나일의 정원
56077 | 34 | GREEN | female | Yves Saint Laurent | Libre | 입생로랑 | 리브르
46187 | 35 | WOODY | unisex | Jo Malone London | English Oak & Hazelnut | 조 말론 런던 | 잉글리쉬 오크 앤 헤이즐넛
68578 | 36 | FLORAL | female | Gucci | Flora Gorgeous Gardenia | 구찌 | 플로라 고저스 가드니아
27040 | 37 | FLORAL | unisex | Byredo | Mojave Ghost | 바이레도 | 모하비 고스트
52359 | 38 | FLORAL | female | Chanel | Chance Eau Tendre Eau de Parfum | 샤넬 | 샹스 오 땅드르 오 드 빠르펭
29165 | 39 | FRUITY | female | Jimmy Choo | Jimmy Choo Blossom | 지미 추 | 지미 추 블러썸
12201 | 40 | WOODY | unisex | Le Labo | Santal 33 | 르 라보 | 상탈 33
9405 | 41 | FLORAL | female | Lanvin | Marry Me | 랑방 | 메리 미
64167 | 42 | WOODY | unisex | Aesop | Rozu | 이솝 | 로즈
10314 | 44 | FLORAL | female | Jo Malone London | English Pear & Freesia | 조 말론 런던 | 잉글리쉬 페어 앤 프리지아
653 | 45 | FRUITY | female | Salvatore Ferragamo | Incanto Charms | 살바토레 페라가모 | 인칸토 참
3779 | 46 | FRUITY | female | Lanvin | Jeanne Lanvin | 랑방 | 잔느 랑방
536 | 47 | FLORAL | female | Estée Lauder | Pleasures | 에스티 로더 | 플레져
68416 | 48 | FLORAL | unisex | Clean | Pure Soap | 클린 | 퓨어 솝
632 | 49 | FLORAL | female | Versace | Bright Crystal | 베르사체 | 브라이트 크리스탈
44894 | 50 | FLORAL | female | Gucci | Gucci Bloom | 구찌 | 구찌 블룸
3575 | 51 | AMBER | unisex | Byredo | Gypsy Water | 바이레도 | 집시 워터
12310 | 52 | MUSK | female | Jo Malone London | Wild Bluebell | 조 말론 런던 | 와일드 블루벨
38914 | 53 | FRUITY | female | Yves Saint Laurent | Mon Paris | 입생로랑 | 몽 파리
73661 | 54 | AQUATIC | unisex | Santa Maria Novella | Angeli di Firenze | 산타 마리아 노벨라 | 안젤리 디 피렌체
50384 | 55 | GOURMAND | female | Ariana Grande | Cloud | 아리아나 그란데 | 클라우드
17798 | 56 | FLORAL | female | Byredo | Inflorescence | 바이레도 | 인플로레센스
56076 | 57 | FLORAL | female | Chanel | Gabrielle Essence | 샤넬 | 가브리엘 샤넬 에쌍스
5484 | 58 | FLORAL | female | Jo Malone London | Red Roses | 조 말론 런던 | 레드 로즈
5585 | 59 | GREEN | unisex | Jo Malone London | Lime Basil & Mandarin | 조 말론 런던 | 라임 바질 앤 만다린
42944 | 61 | FLORAL | unisex | Calvin Klein | CK All | 캘빈 클라인 | CK 올
75642 | 62 | FLORAL | female | Dior | J'adore Parfum d'Eau | 디올 | 쟈도르 빠르펭 도
11784 | 63 | GREEN | male | Montblanc | Legend | 몽블랑 | 레전드
25836 | 64 | FLORAL | female | Burberry | My Burberry | 버버리 | 마이 버버리
275 | 65 | GREEN | unisex | Calvin Klein | CK be | 캘빈 클라인 | CK 비
23032 | 67 | MUSK | unisex | Clean | Cool Cotton | 클린 | 쿨 코튼
10464 | 68 | AMBER | female | Frederic Malle | Portrait of a Lady | 프레데릭 말 | 포트레이트 오브 어 레이디
18767 | 69 | FLORAL | female | Jo Malone London | Peony & Blush Suede | 조 말론 런던 | 피오니 앤 블러쉬 스웨이드
72062 | 70 | CITRUS | male | Dior | Dior Homme Cologne 2022 | 디올 | 디올 옴므 코롱 2022
72606 | 71 | FLORAL | female | Yves Saint Laurent | Mon Paris Lumière | 입생로랑 | 몽 파리 뤼미에르
31861 | 72 | AMBER | male | Dior | Sauvage | 디올 | 소바쥬
79437 | 73 | AQUATIC | unisex | Jo Malone London | Earl Grey & Cucumber | 조 말론 런던 | 얼 그레이 앤 큐컴버
52002 | 74 | AMBER | male | Montblanc | Explorer | 몽블랑 | 익스플로러
12426 | 75 | GOURMAND | female | Prada | Prada Candy | 프라다 | 프라다 캔디
2271 | 76 | CITRUS | female | Lanvin | Rumeur 2 Rose | 랑방 | 루머 2 로즈
3865 | 77 | GOURMAND | unisex | Diptyque | Philosykos Eau de Parfum | 딥티크 | 필로시코스 오 드 퍼퓸
5534 | 78 | CITRUS | male | John Varvatos | Artisan | 존 바바토스 | 아티산
644 | 79 | CITRUS | male | Versace | Versace Man Eau Fraiche | 베르사체 | 베르사체 맨 오 프레쉬
2186 | 80 | GOURMAND | unisex | Montale | Chocolate Greedy | 몽탈 | 초콜릿 그리디
65792 | 82 | AMBER | male | Jaguar | Jaguar Classic Electric Sky | 재규어 | 재규어 클래식 일렉트릭 스카이
39181 | 84 | GOURMAND | unisex | Mancera | Aoud Lemon Mint | 만세라 | 아우드 레몬 민트
53671 | 85 | AQUATIC | unisex | Parfums Berdoues | Azur Riviera | 베르두 | 아주르 리비에라
64022 | 86 | GREEN | unisex | Banana Republic | Metal Rain | 바나나 리퍼블릭 | 메탈 레인
37603 | 87 | GOURMAND | unisex | Nishane | Fan Your Flames | 니샤네 | 팬 유어 플레임스
74740 | 88 | AMBER | unisex | Banana Republic | Midnight Hour | 바나나 리퍼블릭 | 미드나잇 아워
45029 | 89 | GREEN | unisex | Banana Republic | 90 Pure White | 바나나 리퍼블릭 | 90 퓨어 화이트
1923 | 91 | AQUATIC | male | Rance 1795 | Le Vainqueur | 랑스 1795 | 르 뱅쾨르
82586 | 94 | FRUITY | unisex | Clean | Apple Blossom | 클린 | 애플 블러썸
74107 | 96 | WOODY | unisex | Mancera | Jasmin Exclusif | 만세라 | 자스민 익스클루시프
1929 | 97 | FLORAL | female | Rance 1795 | Josephine | 랑스 1795 | 조세핀
90739 | 98 | CITRUS | unisex | Montale | Bubble Forever | 몽탈 | 버블 포에버
44174 | 99 | WOODY | unisex | Nishane | Hacivat | 니샤네 | 하시바트
35456 | 100 | GREEN | male | John Varvatos | Artisan Blu | 존 바바토스 | 아티산 블루
30567 | 101 | CITRUS | unisex | Nishane | Wulóng Chá | 니샤네 | 우롱 차
8339 | 102 | CITRUS | male | John Varvatos | Artisan Black | 존 바바토스 | 아티산 블랙
54976 | 103 | FLORAL | female | Rance 1795 | Désirée | 랑스 1795 | 데지레
104985 | 104 | CITRUS | female | Dolce&Gabbana | Light Blue Eau de Toilette | 돌체앤가바나 | 라이트 블루 오 드 뚜왈렛
87956 | 105 | FLORAL | female | Rance 1795 | Mathilde | 랑스 1795 | 마틸드
50790 | 107 | MUSK | unisex | Essential Parfums | The Musc | 에센셜 퍼퓸 | 더 머스크
50786 | 108 | WOODY | unisex | Essential Parfums | Orange X Santal | 에센셜 퍼퓸 | 오렌지 X 상탈
3024 | 110 | CITRUS | female | Clean | Clean Warm Cotton | 클린 | 클린 웜 코튼
73092 | 111 | WOODY | unisex | Essential Parfums | Fig Infusion | 에센셜 퍼퓸 | 피그 인퓨전
31436 | 113 | GREEN | unisex | Parfums Berdoues | Assam of India | 베르두 | 아쌈 오브 인디아
890 | 114 | WOODY | male | Ralph Lauren | Polo | 랄프 로렌 | 폴로
72796 | 115 | WOODY | male | Mancera | Intense Cedrat Boise | 만세라 | 인텐스 세드라 부아제
59392 | 117 | GOURMAND | unisex | Banana Republic | Dark Cherry & Amber | 바나나 리퍼블릭 | 다크 체리 앤 앰버
60320 | 118 | FLORAL | female | Replay | Signature Lovers for Woman | 리플레이 | 시그니처 러버스 포 우먼
54885 | 119 | AMBER | unisex | Mancera | Instant Crush | 만세라 | 인스턴트 크러쉬
10728 | 121 | FLORAL | female | Rance 1795 | Helene | 랑스 1795 | 엘렌
76893 | 122 | AMBER | unisex | Mancera | Tonka Cola | 만세라 | 통카 콜라
75731 | 126 | CITRUS | unisex | Mancera | Fabulous Yuzu | 만세라 | 패뷸러스 유자
4849 | 127 | FLORAL | female | Philosophy | Amazing Grace | 필로소피 | 어메이징 그레이스
42782 | 128 | GOURMAND | female | Mancera | Coco Vanille | 만세라 | 코코 바닐
16657 | 129 | GREEN | male | Versace | Eros | 베르사체 | 에로스
76824 | 131 | GOURMAND | female | Sabrina Carpenter | Sweet Tooth | 사브리나 카펜터 | 스위트 투스
42670 | 132 | CITRUS | unisex | Mancera | Sicily | 만세라 | 시실리
18042 | 133 | FLORAL | unisex | Mancera | Roses Greedy | 만세라 | 로즈 그리디
74636 | 135 | AQUATIC | unisex | Mancera | French Riviera | 만세라 | 프렌치 리비에라
1198 | 136 | AQUATIC | male | Ralph Lauren | Polo Blue | 랄프 로렌 | 폴로 블루
4023 | 137 | WOODY | male | Montblanc | Starwalker | 몽블랑 | 스타워커
43531 | 138 | GREEN | unisex | Etat Libre d'Orange | You Or Someone Like You | 에따 리브르 도랑쥬 | 유 오어 섬원 라이크 유
69742 | 141 | FLORAL | female | Lanvin | Sunny Magnolia | 랑방 | 써니 매그놀리아
50789 | 142 | FLORAL | unisex | Essential Parfums | Nice Bergamote | 에센셜 퍼퓸 | 니스 베르가모트
3172 | 144 | AMBER | male | Rance 1795 | Francois Charles | 랑스 1795 | 프랑수아 샤를
64015 | 145 | FLORAL | female | Jimmy Choo | I Want Choo | 지미 추 | 아이 원트 추
1924 | 146 | FLORAL | female | Rance 1795 | Eugenie | 랑스 1795 | 외제니
16931 | 147 | FLORAL | female | Lalique | L'Amour | 랄리크 | 라무르
50225 | 151 | FLORAL | unisex | Banana Republic | Neroli Woods | 바나나 리퍼블릭 | 네롤리 우즈
37602 | 152 | FLORAL | unisex | Nishane | Hundred Silent Ways | 니샤네 | 헌드레드 사일런트 웨이즈
75969 | 153 | GOURMAND | female | Jimmy Choo | I Want Choo Forever | 지미 추 | 아이 원트 추 포에버
64093 | 154 | MUSK | unisex | Nishane | Nanshe | 니샤네 | 난셰
31247 | 157 | WOODY | male | Narciso Rodriguez | Narciso Rodriguez for Him Bleu Noir | 나르시소 로드리게즈 | 포 힘 블루 누아
1000 | 158 | FLORAL | female | Burberry | Weekend for Women | 버버리 | 위켄드 포 우먼
57088 | 161 | AMBER | unisex | Essential Parfums | Divine Vanille | 에센셜 퍼퓸 | 디바인 바닐
50787 | 162 | FLORAL | unisex | Essential Parfums | Rose Magnetic | 에센셜 퍼퓸 | 로즈 마그네틱
72 | 163 | FLORAL | female | Kenzo | Flower by Kenzo | 겐조 | 플라워 바이 겐조
50788 | 164 | GREEN | unisex | Essential Parfums | Mon Vetiver | 에센셜 퍼퓸 | 몽 베티버
68367 | 165 | FRUITY | female | Ariana Grande | Thank U Next 2.0 | 아리아나 그란데 | 땡큐 넥스트 2.0
815 | 166 | AQUATIC | male | Burberry | Touch for Men | 버버리 | 터치 포 맨
85144 | 167 | WOODY | unisex | Essential Parfums | Patchouli Mania | 에센셜 퍼퓸 | 파출리 매니아
57384 | 169 | GOURMAND | unisex | Montale | Arabians Tonka | 몽탈 | 아라비안 통카
46623 | 170 | CITRUS | male | John Varvatos | Artisan Pure | 존 바바토스 | 아티산 퓨어
84224 | 172 | CITRUS | unisex | Ex Nihilo | Blue Talisman | 엑스 니힐로 | 블루 탈리스만
70985 | 174 | AQUATIC | female | Maison Martin Margiela | When the Rain Stops | 메종 마르지엘라 | 웬 더 레인 스탑스
52180 | 175 | CITRUS | male | Versace | Eros Flame | 베르사체 | 에로스 플레임
72381 | 176 | FRUITY | unisex | Stéphane Humbert Lucas 777 | God of Fire | 스테판 험버트 루카스 777 | 갓 오브 파이어
485 | 177 | CITRUS | female | Dolce&Gabbana | Light Blue | 돌체앤가바나 | 라이트 블루
45711 | 179 | FLORAL | female | Philosophy | Amazing Grace Ballet Rose | 필로소피 | 어메이징 그레이스 발레 로즈
63829 | 181 | FLORAL | unisex | Banana Republic | Peony & Peppercorn | 바나나 리퍼블릭 | 피오니 앤 페퍼콘
69281 | 182 | WOODY | male | Bentley | Momentum Unbreakable Eau de Parfum | 벤틀리 | 모멘텀 언브레이커블 오 드 퍼퓸
89712 | 183 | GOURMAND | male | Jaguar | Jaguar Era Reloaded | 재규어 | 재규어 에라 리로디드
54785 | 184 | AMBER | unisex | Nishane | Ani | 니샤네 | 아니
47891 | 185 | AQUATIC | unisex | Maison Martin Margiela | Sailing Day | 메종 마르지엘라 | 세일링 데이
48434 | 186 | WOODY | female | Chloé | Nomade | 끌로에 | 노마드
64092 | 187 | GREEN | unisex | Nishane | EGE / ΑΙΓΑΙΟ | 니샤네 | 에게
62372 | 188 | FLORAL | female | Chloé | Chloé Rose Tangerine | 끌로에 | 끌로에 로즈 탠저린
74739 | 189 | FLORAL | unisex | Banana Republic | Velvet Pomegranate | 바나나 리퍼블릭 | 벨벳 포머그래닛
32523 | 191 | WOODY | male | Mercedes-Benz | Mercedes Benz Man | 메르세데스 벤츠 | 메르세데스 벤츠 맨
49827 | 192 | FLORAL | female | Replay | Replay Signature Secret | 리플레이 | 리플레이 시그니처 시크릿
46300 | 194 | MUSK | female | Mancera | Musky Garden | 만세라 | 머스키 가든
21547 | 195 | FLORAL | female | Versace | Bright Crystal Absolu | 베르사체 | 브라이트 크리스탈 앱솔루
`

export const MOCK_PERFUMES: readonly MockPerfume[] = TABLE.trim()
  .split('\n')
  .map((line) => {
    const [perfumeId, rank, family, gender, brand, name, brandKo, nameKo] =
      line.split(' | ')
    return {
      perfumeId: Number(perfumeId),
      rank: Number(rank),
      family: family as MockFamily,
      gender: gender as MockPerfume['gender'],
      brand: brand ?? '',
      name: name ?? '',
      brandKo: brandKo || null,
      nameKo: nameKo || null,
    }
  })
