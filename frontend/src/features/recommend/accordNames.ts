import {
  SCENT_FAMILY_KEYS,
  SCENT_FAMILY_NAMES,
  toScentFamilyKey,
  type ScentFamilyKey,
} from '@/shared/config/scentFamilies'
import { i18n } from '@/shared/i18n'

/**
 * 향 특성(accord)의 영어 이름 → 화면에 쓸 한국어.
 *
 * 추천 이유의 `evidence` 는 `soapy` · `citrus` 같은 **영어**로 옵니다. 백엔드의
 * `AccordLabeler` 가 이 번역을 맡기로 돼 있지만 이름표가 아직 안 와서 영어를 그대로
 * 돌려주고 있고(그 클래스 주석이 "임시로 계약을 어기는 상태" 라고 적어 두었습니다),
 * 응답 DTO 는 이 칸의 예시를 `"비누 같은 · 산뜻한"` 으로 적고 있습니다.
 *
 * NOTE: 표의 출처는 `landing/data/accord_names_ko.csv` 입니다. 3D 향 지도의 향수 카드가
 * 이미 같은 표로 한국어를 보여주고 있어서, 그대로 두면 **같은 향 특성이 한 화면에서는
 * 한국어로 다른 화면에서는 영어로** 나갑니다. 근거는 서비스 어휘 24 · 일반 관례 29 ·
 * 추정 7 이고, 서비스 어휘 쪽은 향 계열 이름과 노트 목록에서 가져온 것입니다.
 *
 * NOTE: 백엔드가 나중에 `AccordLabeler` 를 채워 한국어를 보내기 시작해도 안전합니다 —
 * 모르는 값은 그대로 흘려보내므로, 이미 한국어인 값은 건드리지 않습니다.
 *
 * NOTE: 손으로 옮긴 표라 CSV 와 갈라지면 `accordNames.test.ts` 가 잡습니다. 그 테스트가
 * 읽으려고 내보냅니다 — 도메인 밖에서는 `accordLabel` 을 씁니다.
 */
export const ACCORD_NAMES_KO: Record<string, string> = {
  citrus: '시트러스', // 향 계열 이름 (shared/config/scentFamilies.ts)
  woody: '우디', // 향 계열 이름
  powdery: '파우더리',
  aromatic: '아로마틱',
  sweet: '스위트',
  musky: '머스키', // 계열 이름은 머스크 — 어코드는 형용사 쪽
  fruity: '프루티', // 향 계열 이름
  floral: '플로럴', // 향 계열 이름
  'fresh spicy': '프레시 스파이시', // 외래어 표기법 프레시 (흔히 프레쉬)
  'white floral': '화이트 플로럴',
  fresh: '프레시', // 외래어 표기법 프레시 (흔히 프레쉬)
  green: '그린', // 향 계열 이름
  rose: '로즈', // 노트 목록 (backend/db/seed/notes.csv)
  vanilla: '바닐라', // 노트 목록
  amber: '앰버', // 향 계열 이름 · 노트 목록
  'warm spicy': '웜 스파이시',
  earthy: '얼씨', // 흙내음 — 향 후기에서 흔히 얼씨
  aquatic: '아쿠아틱', // 향 계열 이름
  'soft spicy': '소프트 스파이시',
  animalic: '애니멀릭',
  ozonic: '오조닉',
  lavender: '라벤더', // 노트 목록
  herbal: '허벌',
  tropical: '트로피컬',
  lactonic: '락토닉',
  patchouli: '패츌리', // 노트 목록
  mossy: '모스', // 모시는 옷감과 헷갈린다 — 오크모스의 모스
  aldehydic: '알데하이드', // 노트 목록 (Aldehydes)
  iris: '아이리스', // 노트 목록
  violet: '바이올렛', // 노트 목록은 제비꽃
  'yellow floral': '옐로 플로럴',
  salty: '솔티',
  marine: '마린',
  balsamic: '발사믹',
  coconut: '코코넛', // 노트 목록
  leather: '레더', // 노트 목록은 가죽
  nutty: '너티',
  tuberose: '튜베로즈', // 노트 목록
  oud: '오드', // 국내 판매명 오드 우드 (Tom Ford Oud Wood) · 노트 목록은 침향나무 수액
  almond: '아몬드', // 노트 목록
  cherry: '체리', // 노트 목록
  soapy: '비누', // 소피는 뜻이 헷갈린다
  beeswax: '비즈왁스', // 노트 목록은 밀랍
  honey: '허니', // 노트 목록은 꿀
  caramel: '카라멜', // 노트 목록
  cinnamon: '시나몬', // 노트 목록
  camphor: '캠퍼', // 장뇌
  sour: '사워',
  conifer: '침엽수', // 코니퍼는 낯설다
  tobacco: '타바코', // 국내 판매명 타바코 바닐 (Tom Ford Tobacco Vanille) · 노트 목록은 담배
  metallic: '메탈릭',
  mineral: '미네랄',
  bitter: '비터', // 쌉싸름
  smoky: '스모키',
  cacao: '카카오', // 노트 목록
  coffee: '커피', // 노트 목록
  rum: '럼', // 노트 목록
  'coca-cola': '코카콜라',
  chocolate: '초콜릿', // 노트 목록
  anis: '아니스', // 노트 목록 (Anise)
}

/** `evidence` 는 여럿이면 이 구분자로 이어져 옵니다 (응답 DTO 계약) */
export const EVIDENCE_SEPARATOR = ' · '

/** 한국어 향 특성 이름 → 영어 이름. 이미 한국어로 온 값을 영어 화면에서 되돌립니다 */
const ACCORD_BY_KO = new Map(
  Object.entries(ACCORD_NAMES_KO).map(([accord, ko]) => [ko, accord]),
)

/**
 * 한국어 향 계열 이름 → 계열 키. 취향 테스트 틀은 향 계열을 한국어로 넣어 옵니다.
 *
 * NOTE: `SCENT_FAMILY_NAMES` 는 읽을 때의 화면 언어로 풀려서, 한국어 이름은 언어를 못 박아 읽습니다.
 */
const familyOfKorean = (name: string): ScentFamilyKey | undefined =>
  SCENT_FAMILY_KEYS.find(
    (key) =>
      i18n.t(
        `common:scentFamily.${key.toLowerCase() as Lowercase<ScentFamilyKey>}`,
        { lng: 'ko' },
      ) === name,
  )

/** 영어 화면의 향 특성 이름 — 원래 영어 이름에 첫 글자만 대문자로(`fresh spicy` → `Fresh spicy`) */
const englishAccord = (accord: string) =>
  accord.charAt(0).toUpperCase() + accord.slice(1)

type LabelOptions = {
  /**
   * 영어 문장 가운데에 넣을 꼴 — 소문자로 씁니다(`the soapy scent`). 칩 · 이름표처럼 따로 서는
   * 자리는 첫 글자 대문자 그대로입니다. 한국어에는 대소문자가 없어 영향이 없습니다
   */
  inSentence?: boolean
}

function koreanLabel(key: string): string | undefined {
  const lower = key.toLowerCase()
  if (Object.hasOwn(ACCORD_NAMES_KO, key)) return ACCORD_NAMES_KO[key]
  if (Object.hasOwn(ACCORD_NAMES_KO, lower)) return ACCORD_NAMES_KO[lower]
  const family = toScentFamilyKey(key.toUpperCase())
  return family ? SCENT_FAMILY_NAMES[family] : undefined
}

/*
  영어 화면은 영어 이름을 그대로 씁니다. 백엔드가 한국어를 보내기 시작해도 같은 말이 나오도록
  한국어 이름(향 특성 · 향 계열)도 거꾸로 찾아 영어로 되돌립니다.
*/
function englishLabel(key: string): string | undefined {
  const lower = key.toLowerCase()
  if (Object.hasOwn(ACCORD_NAMES_KO, lower)) return englishAccord(lower)
  const family = toScentFamilyKey(key.toUpperCase()) ?? familyOfKorean(key)
  if (family) return SCENT_FAMILY_NAMES[family]
  const accord = ACCORD_BY_KO.get(key)
  return accord === undefined ? undefined : englishAccord(accord)
}

/**
 * 추천 이유 한 칸을 화면에 쓸 말로 바꿉니다. 한국어 화면은 한국어로, 영어 화면은 영어 이름으로.
 *
 * 향 특성이 아닌 근거도 이 칸으로 옵니다(`가을 어울림 평가 71%`). 모르는 값은 **그대로**
 * 돌려주므로 그런 줄은 손대지 않습니다 — 백엔드 `AccordLabeler.label` 과 같은 계약입니다.
 *
 * NOTE: 언어는 **부를 때** 읽습니다. 결과를 모듈 상수나 오래 가는 memo 에 담으면 언어를 바꿔도
 * 그 자리는 앞 언어로 남습니다.
 *
 * @param evidence 추천 이유의 근거 칸. 여럿이면 `' · '` 로 이어져 있습니다
 * @param options `inSentence` 면 영어 이름을 문장 안의 꼴(소문자)로 씁니다
 * @returns 같은 자리에 같은 구분자로 다시 이은 말
 */
export function accordLabel(
  evidence: string,
  { inSentence = false }: LabelOptions = {},
): string {
  const english = i18n.language === 'en'
  const label = english ? englishLabel : koreanLabel
  return evidence
    .split(EVIDENCE_SEPARATOR)
    .map((part) => {
      const known = label(part.trim())
      if (known === undefined) return part
      // 모르는 값(그대로 흘려보내는 값)은 대소문자도 손대지 않습니다
      return english && inSentence ? known.toLowerCase() : known
    })
    .join(EVIDENCE_SEPARATOR)
}
