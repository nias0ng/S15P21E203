import type { Messages } from '../../types'
import type { map as ko } from '../ko/map'

export const map = {
  scene: {
    title: 'Scent Map',
  },
  search: {
    fieldLabel: 'Get perfume picks by mood or moment',
    placeholder: 'e.g. fresh and zesty, grassy',
    tag: 'Mood · Moment',
    hint: 'Describe a mood or moment for perfume picks · works best in Korean',
    starters: {
      label: 'Try searching for',
      rain: 'earthy smell after rain',
      soap: 'soft soap scent for work',
      vanilla: 'sweet vanilla',
      floral: 'floral perfume',
      popular: 'See trending perfumes →',
    },
  },
  cabin: {
    label: 'Cabin',
    shelf: 'Shelf',
    collection: 'Collection',
    loginRequired: 'Log in to continue',
  },
  voyageLog: {
    title: 'Voyage Log',
    collapse: 'Collapse Voyage Log',
    expand: 'Expand Voyage Log',
    loading: 'Loading your log…',
    guest: "The waters you sail will be recorded here once you're logged in.",
    login: 'Log in',
    error: "Couldn't load your log",
    empty: "You haven't entered any waters yet",
    today: 'Today',
    regions: 'Waters sailed',
    perfumes: 'Perfumes found',
    moreRegions_one: 'Show {{count}} more',
    moreRegions_other: 'Show {{count}} more',
    morePerfumes_one: 'Show {{count}} more perfume',
    morePerfumes_other: 'Show {{count}} more perfumes',
  },
  quality: {
    startLow:
      'Your device uses integrated graphics, so we started with lighter graphics. You can change this with the gear icon at the top right.',
    down: 'The scene was stuttering, so graphics were lowered one step.',
    slow: "For smoother graphics, plug in your device or set your browser to 'High performance' in Windows graphics settings.",
  },
  home: {
    cannotSave: "This perfume can't be added to your shelf yet.",
    saved: 'Saved to your shelf.',
  },
} satisfies Messages<typeof ko>
