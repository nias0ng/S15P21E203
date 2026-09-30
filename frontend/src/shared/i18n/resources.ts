// NOTE: 영역을 더할 때는 ko · en 두 폴더에 같은 이름의 파일을 만들고 아래 두 묶음에 함께 올립니다
import { auth as enAuth } from './locales/en/auth'
import { brand as enBrand } from './locales/en/brand'
import { collection as enCollection } from './locales/en/collection'
import { common as enCommon } from './locales/en/common'
import { community as enCommunity } from './locales/en/community'
import { layout as enLayout } from './locales/en/layout'
import { map as enMap } from './locales/en/map'
import { note as enNote } from './locales/en/note'
import { perfume as enPerfume } from './locales/en/perfume'
import { recommend as enRecommend } from './locales/en/recommend'
import { shelf as enShelf } from './locales/en/shelf'
import { taste as enTaste } from './locales/en/taste'
import { auth as koAuth } from './locales/ko/auth'
import { brand as koBrand } from './locales/ko/brand'
import { collection as koCollection } from './locales/ko/collection'
import { common as koCommon } from './locales/ko/common'
import { community as koCommunity } from './locales/ko/community'
import { layout as koLayout } from './locales/ko/layout'
import { map as koMap } from './locales/ko/map'
import { note as koNote } from './locales/ko/note'
import { perfume as koPerfume } from './locales/ko/perfume'
import { recommend as koRecommend } from './locales/ko/recommend'
import { shelf as koShelf } from './locales/ko/shelf'
import { taste as koTaste } from './locales/ko/taste'
import type { Messages } from './types'

/** 한국어 묶음 — 문구의 기준입니다. 이 모양이 곧 번역 키의 타입입니다(`i18next.d.ts`) */
export const ko = {
  common: koCommon,
  layout: koLayout,
  auth: koAuth,
  perfume: koPerfume,
  brand: koBrand,
  note: koNote,
  recommend: koRecommend,
  taste: koTaste,
  shelf: koShelf,
  collection: koCollection,
  map: koMap,
  community: koCommunity,
}

export const en = {
  common: enCommon,
  layout: enLayout,
  auth: enAuth,
  perfume: enPerfume,
  brand: enBrand,
  note: enNote,
  recommend: enRecommend,
  taste: enTaste,
  shelf: enShelf,
  collection: enCollection,
  map: enMap,
  community: enCommunity,
} satisfies Messages<typeof ko>

export type Namespace = keyof typeof ko

export const NAMESPACES = Object.keys(ko) as Namespace[]
