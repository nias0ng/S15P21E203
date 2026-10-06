import type { Messages } from '../../types'
import type { brand as ko } from '../ko/brand'

export const brand = {
  sort: {
    PERFUME_COUNT: 'Most perfumes',
    NAME_EN: 'A–Z',
    NAME_KO: 'Korean name (ㄱ–ㅎ)',
  },
  grid: {
    emptyTitle: 'No brands found',
    emptyDescription: 'Check the brand name and try again.',
    logoFallback: 'Logo',
  },
  list: {
    heading: 'Brands',
    searchLabel: 'Search by brand name',
    searchPlaceholder: 'Search brands',
    sortLabel: 'Sort brands',
    searchHeading: "Results for '{{keyword}}'",
    allHeading: 'All brands',
    count_one: '{{count}} brand',
    count_other: '{{count}} brands',
    reset: 'Reset',
    pagination: 'Brand pages',
  },
  detail: {
    notFoundTitle: 'Brand not found',
    notFoundDescription: 'The link is wrong or the brand was removed.',
    backToList: 'Back to brands',
    back: 'Brands',
    perfumeCount_one: '{{count}} perfume',
    perfumeCount_other: '{{count}} perfumes',
    perfumesHeading: 'Perfumes by {{name}}',
    loadErrorTitle: "Couldn't load perfumes",
    loadErrorDescription: 'Please try again later.',
    emptyTitle: 'No perfumes yet',
    emptyDescription: "This brand's perfumes will appear here once added.",
    viewAll: 'View all perfumes',
  },
} satisfies Messages<typeof ko>
