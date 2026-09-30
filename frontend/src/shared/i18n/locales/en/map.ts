import type { Messages } from '../../types'
import type { map as ko } from '../ko/map'

export const map = {
  scene: {
    title: 'Scent Map',
  },
  search: {
    group: 'Search mode',
    fieldLabel: {
      nl: 'Get perfume picks in your own words',
      normal: 'Search by perfume name',
    },
    placeholder: {
      nl: 'What scent are you looking for?',
      normal: 'Search perfumes or brands',
    },
    mode: {
      nl: 'Describe',
      normal: 'Name',
    },
    hint: {
      nl: 'Describe a mood or moment for perfume picks · works best in Korean',
      normal: 'Search the 200 perfumes on the map by name or brand',
    },
    switchTo: 'Switch to {{mode}} search',
  },
  searchModal: {
    title: 'Search the map',
    keyword: 'Searching for',
    count_one: '{{count}} result',
    count_other: '{{count}} results',
    countCapped_one: 'Top {{count}} result',
    countCapped_other: 'Top {{count}} results',
    rank: 'Map rank',
    loadError: {
      title: 'Couldn’t load the perfumes on the map',
      description: 'Please try again in a moment.',
    },
    empty: {
      title: 'No matching perfume on the map',
      description:
        'The map shows only 200 perfumes. Try a brand name, or switch to Describe search.',
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
    guest: 'Log in to keep a record of the waters you sail.',
    login: 'Log in',
    error: 'Couldn’t load your log',
    empty: 'You haven’t entered any waters yet',
    today: 'Today',
    regions: 'Waters sailed',
    perfumes: 'Perfumes found',
    moreRegions_one: 'Show {{count}} more waters',
    moreRegions_other: 'Show {{count}} more waters',
    morePerfumes_one: 'Show {{count}} more perfume',
    morePerfumes_other: 'Show {{count}} more perfumes',
  },
  quality: {
    startLow:
      'Started in light mode for integrated graphics. You can change this with the gear icon at the top right.',
    down: 'The scene was stuttering, so graphics were lowered one step.',
    slow: 'For smoother graphics, plug in your device or set your browser to high performance in Windows graphics settings.',
  },
  home: {
    cannotSave: 'This perfume can’t be added to your shelf yet.',
    saved: 'Saved to your shelf.',
  },
} satisfies Messages<typeof ko>
