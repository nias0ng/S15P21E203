import type { ScentFamilyKey } from '@/shared/config/scentFamilies'

import type { VoyageLogEntry } from '../types'

/** 향해 일지의 하루 — 그날 들어간 해역과 들른 향수를 **따로** 모읍니다 */
export interface VoyageLogDay {
  /** 보는 사람의 시간대로 읽은 날짜 `YYYY-MM-DD` — 날을 구분하는 데 씁니다 */
  key: string
  /** 머리말. 오늘이면 '오늘', 아니면 `MM.DD` */
  label: string
  /** 그날 들어간 해역 — 최근 순 · 같은 해역은 한 번 */
  regions: ScentFamilyKey[]
  /** 그날 들른 향수 — 최근 순 · 같은 향수는 한 번 */
  perfumes: VoyageLogEntry['visited']
}

const pad = (value: number) => String(value).padStart(2, '0')

function localDay(at: Date) {
  const month = pad(at.getMonth() + 1)
  const date = pad(at.getDate())
  return {
    key: `${at.getFullYear()}-${month}-${date}`,
    label: `${month}.${date}`,
  }
}

/*
 * 날짜는 문자열을 자르지 않고 **보는 사람의 시간대로** 읽습니다. 서버는 진입 시각을 UTC(Z)로
 * 주어서, 날짜 칸을 그대로 자르면 한국 시각 00~09시의 진입이 전날로 갑니다.
 */
function dayOf(iso: string) {
  const at = new Date(iso)
  // 못 읽는 값은 문자열의 날짜 칸을 그대로 씁니다 — 줄을 버리지 않으려고
  if (Number.isNaN(at.getTime())) {
    return { key: iso.slice(0, 10), label: iso.slice(5, 10).replace('-', '.') }
  }
  return localDay(at)
}

/**
 * 해역 진입 줄을 **날마다** 묶습니다.
 *
 * 한 줄에 해역 하나와 그 안에서 들른 향수가 딸려 오지만, 일지는 날짜 아래에 해역과 향수를
 * 나눠 보여 줍니다. 그래서 같은 날의 줄을 모아 해역은 해역끼리, 향수는 향수끼리 합칩니다.
 * 향수에는 제 시각이 없어 **그 향수가 딸린 진입의 날짜**로 묶습니다.
 *
 * @param entries 백엔드가 준 순서(최근 진입부터) 그대로의 일지 줄
 * @param now '오늘' 을 가르는 기준 시각. 시험에서 고정할 때 넘깁니다
 * @returns 최근 날부터 하루씩. 같은 날 다시 들어간 해역 · 다시 본 향수는 가장 최근 것 하나만 남습니다
 */
export function groupVoyageLogByDay(
  entries: readonly VoyageLogEntry[],
  now: Date = new Date(),
): VoyageLogDay[] {
  const today = localDay(now).key
  const days = new Map<string, VoyageLogDay>()

  for (const entry of entries) {
    const { key, label } = dayOf(entry.enteredAt)
    let day = days.get(key)
    if (!day) {
      day = {
        key,
        label: key === today ? '오늘' : label,
        regions: [],
        perfumes: [],
      }
      days.set(key, day)
    }

    if (!day.regions.includes(entry.region)) day.regions.push(entry.region)

    // 한 줄 안의 향수는 처음 들른 순서로 옵니다 — 뒤집어야 날 전체가 최근 순이 됩니다
    for (const perfume of [...entry.visited].reverse()) {
      if (!day.perfumes.some((seen) => seen.perfumeId === perfume.perfumeId)) {
        day.perfumes.push(perfume)
      }
    }
  }

  return [...days.values()]
}
