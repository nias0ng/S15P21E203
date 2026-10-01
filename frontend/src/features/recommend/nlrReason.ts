import { i18n } from '@/shared/i18n'

import { accordLabel, EVIDENCE_SEPARATOR } from './accordNames'
import type { RecommendReason } from './types'

/**
 * 추천 이유 문장의 한 토막. `tone` 이 있는 토막만 화면이 칠을 달리합니다 —
 * 향 이름 · 조건(`term`)과 괄호 안 강도(`strength`).
 */
export type ReasonPart = {
  text: string
  tone?: 'term' | 'strength'
}

export type ReasonSentence = {
  /** 차례로 이어 붙이면 문장 하나가 됩니다 */
  parts: ReasonPart[]
  /** 괄호 안 강도를 하나라도 적었는가 — 머리글에 그 숫자의 뜻을 적을지 가립니다 */
  showsStrength: boolean
}

type Term = { name: string; strength: number | null }

type SentenceKey =
  | 'conditionStart'
  | 'conditionEnd'
  | 'start'
  | 'joiner'
  | 'phraseBefore'
  | 'phraseAfter'
  | 'requestedBefore'
  | 'requestedAfter'
  | 'end'

type ConditionKey =
  | 'masculine'
  | 'feminine'
  | 'unisex'
  | 'spring'
  | 'summer'
  | 'fall'
  | 'winter'
  | 'day'
  | 'night'

/** AI 가 향이 아닌 조건에 붙이는 한국어(`ai/nlr_engine.py` 의 표) → 번역 키 */
const CONDITION_KEYS: Record<string, ConditionKey> = {
  남성적인: 'masculine',
  여성적인: 'feminine',
  중성적인: 'unisex',
  '봄에 어울리는': 'spring',
  '여름에 어울리는': 'summer',
  '가을에 어울리는': 'fall',
  '겨울에 어울리는': 'winter',
  '낮에 어울리는': 'day',
  '밤에 어울리는': 'night',
}

/**
 * 향이 아닌 조건(성별 · 계절 · 낮밤)의 이름을 화면 언어로 바꿉니다. 조건 이름은 AI 가 한국어로
 * 주는데, 아홉 개로 정해져 있어 영어 화면에서 영어로 바꿀 수 있습니다.
 *
 * NOTE: 노트 이름(`장미`)은 표에 없어 그대로 나갑니다 — 영어 이름이 응답에 오지 않습니다.
 */
export function conditionLabel(label: string): string {
  const key = Object.hasOwn(CONDITION_KEYS, label)
    ? CONDITION_KEYS[label]
    : undefined
  return key === undefined ? label : i18n.t(`recommend:nlr.conditions.${key}`)
}

/** 향수마다가 아니라 응답 전체에 한 번 오는 값들 */
export type ReasonContext = {
  /** 사용자가 쓴 문장 — 표현이 정말 그 안에 있는지 봅니다 */
  query: string
  /** 응답의 같은 칸. 강도가 오지 않을 때 향이 아닌 조건으로 고른 이유인지 가립니다 */
  pickedWithoutScentCondition: boolean
}

/**
 * 향수 한 병의 추천 이유를 한 문장으로 짓습니다 (NLR-07).
 *
 *   표현이 있을 때     이 향수는 ‘빨래’가 가리키는 비누(100) · 프레시(93) 향을 가지고 있습니다.
 *   표현이 없을 때     이 향수는 요청하신 우디(100) 향을 가지고 있습니다.
 *   향 조건이 없을 때  요청하신 남성적인 · 가을에 어울리는 조건에 맞는 향수입니다.
 *
 * 표현이 여럿이면 표현마다 제 향을 붙여 쉼표로 잇습니다. 표현을 앞에 다 늘어놓고 향을 뒤로 몰면
 * 어느 말이 어느 향을 가리켰는지가 사라집니다.
 *
 * NOTE: "가지고 있습니다" 라는 사실만 적고 순위를 강도 탓으로 돌리지 않습니다. 강도 동점이 흔하고
 * (citrus 단독 조건은 100 동점이 3,060개) 그때 순서를 정한 것은 평가자 수입니다.
 *
 * @param reasons 향수 한 병의 `reasons`
 * @param context 응답 전체의 문장 · `pickedWithoutScentCondition`
 * @returns 지을 이유가 하나도 없으면 null
 */
export function nlrReasonSentence(
  reasons: RecommendReason[],
  { query, pickedWithoutScentCondition }: ReasonContext,
): ReasonSentence | null {
  const groups = reasons
    .map((reason) => ({
      phrase: usersPhrase(reason.phrase, query),
      terms: termsOf(reason),
      byCondition: isConditionReason(reason, pickedWithoutScentCondition),
    }))
    .filter((group) => group.terms.length > 0)
  if (groups.length === 0) return null

  const parts: ReasonPart[] = []
  const say = (text: string) => parts.push({ text })
  const list = (terms: Term[]) =>
    terms.forEach((term, index) => {
      if (index > 0) say(EVIDENCE_SEPARATOR)
      parts.push({ text: term.name, tone: 'term' })
      if (term.strength !== null) {
        parts.push({ text: `(${term.strength})`, tone: 'strength' })
      }
    })

  /*
    향이 아닌 조건은 표현을 붙이지 않습니다. 성별 · 계절 · 낮밤은 표현이 늘 비어 있고, 노트는
    표현과 이름이 같은 말이라(`‘미모사’가 가리키는 미모사`) 붙이면 한 말을 두 번 합니다.
  */
  /*
    문장 틀은 화면 언어를 따릅니다. 말의 차례가 달라(‘빨래’가 가리키는 비누 ↔ the Soapy scent
    ‘laundry’ suggests) 향 이름 앞 · 뒤 토막을 따로 받아 그 사이에 향을 끼웁니다.
  */
  const sayKey = (key: SentenceKey, values?: Record<string, string>) => {
    const text = i18n.t(`recommend:nlr.sentence.${key}`, values)
    if (text !== '') say(text)
  }

  if (groups.every((group) => group.byCondition)) {
    sayKey('conditionStart')
    list(groups.flatMap((group) => group.terms))
    sayKey('conditionEnd')
  } else {
    sayKey('start')
    groups.forEach((group, index) => {
      if (index > 0) sayKey('joiner')
      const phrase = group.phrase
      const values = phrase
        ? { phrase, particle: subjectParticle(phrase) }
        : undefined
      sayKey(phrase ? 'phraseBefore' : 'requestedBefore', values)
      list(group.terms)
      sayKey(phrase ? 'phraseAfter' : 'requestedAfter', values)
    })
    sayKey('end')
  }

  return {
    parts,
    showsStrength: parts.some((part) => part.tone === 'strength'),
  }
}

/**
 * 사용자가 실제로 쓴 표현만 돌려줍니다. 띄어쓰기 · 대소문자는 보지 않습니다.
 *
 * NOTE: AI 의 LLM 단계가 말을 풀어 쓰면 사용자가 쓰지 않은 말이 표현으로 옵니다 —
 * `가을에 쓸 남성적인 우드향 추천해줘.` 에 `phrase: "woody"` (실측). 그 말을 따옴표로 감싸
 * "‘woody’가 가리키는" 이라 적으면 하지 않은 말을 한 것으로 만들어, 표현이 없는 이유로 적습니다.
 *
 * @returns 문장 안에 없거나 비어 있으면 null
 */
function usersPhrase(phrase: string | null, query: string): string | null {
  const trimmed = phrase?.trim()
  if (!trimmed) return null
  const flat = (text: string) =>
    text.normalize('NFC').toLowerCase().replace(/\s+/g, '')
  return flat(query).includes(flat(trimmed)) ? trimmed : null
}

/**
 * 근거 칸을 조각으로 잘라 조각마다 화면 언어의 이름과 강도를 붙입니다.
 *
 * NOTE: 강도는 **개수가 맞을 때만** 짝짓습니다. 두 목록은 순서로만 이어져 있어 하나라도 어긋나면
 * 엉뚱한 향에 엉뚱한 숫자가 붙습니다 — 틀린 숫자보다 없는 쪽이 낫습니다.
 */
function termsOf(reason: RecommendReason): Term[] {
  const names = reason.evidence.split(EVIDENCE_SEPARATOR)
  const strengths =
    reason.strengths?.length === names.length ? reason.strengths : []

  return names
    .map((name, index) => ({
      name: conditionLabel(accordLabel(name.trim())),
      strength: readStrength(strengths[index]),
    }))
    .filter((term) => term.name !== '')
}

/** 0~100 의 수만 적습니다. 범위를 벗어난 값은 뜻을 알 수 없어 그 자리는 이름만 둡니다 */
function readStrength(value: unknown): number | null {
  return typeof value === 'number' && value >= 0 && value <= 100
    ? Math.round(value)
    : null
}

/**
 * 향이 아닌 조건(성별 · 계절 · 낮밤 · 노트)으로 채운 이유인가.
 *
 * 백엔드는 향 근거가 하나도 없는 향수에만 이 조건으로 이유를 채우고, 그 자리의 강도는 전부 `null`
 * 로 둡니다. 강도 칸을 모르는 서버와 만나면 응답 전체의 `pickedWithoutScentCondition` 으로 가립니다
 * — 그마저 안 보면 `남성적인 · 가을에 어울리는` 이 향 이름처럼 "… 향을 가지고 있습니다" 로 나갑니다.
 */
function isConditionReason(
  reason: RecommendReason,
  pickedWithoutScentCondition: boolean,
): boolean {
  if (!reason.strengths?.length) return pickedWithoutScentCondition
  return reason.strengths.every((strength) => strength === null)
}

/**
 * 주격 조사 — ‘상큼한’이 · ‘빨래’가. 끝 글자의 받침으로 고르고, 한글이 아니면 받침이 없는 것으로
 * 봅니다.
 *
 * 한글 음절은 '가'(U+AC00)부터 초성 · 중성 · 종성 순으로 놓이고 종성 자리가 28칸(받침 없음 포함)
 * 이라, '가' 에서 떨어진 거리를 28 로 나눈 나머지가 0 이면 받침이 없습니다.
 */
function subjectParticle(word: string): '이' | '가' {
  const code = word.charCodeAt(word.length - 1)
  const isSyllable = code >= 0xac00 && code <= 0xd7a3
  return isSyllable && (code - 0xac00) % 28 !== 0 ? '이' : '가'
}
