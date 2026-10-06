import type { Messages } from '../../types'
import type { common as ko } from '../ko/common'

export const common = {
  site: {
    name: 'Hyanghae',
    title: 'Hyanghae · Perfume Recommendations',
    description:
      'A perfume recommendation service to explore, discover and keep a record of scents',
  },
  language: {
    label: 'Language',
    ko: '한국어',
    en: 'English',
  },
  actions: {
    close: 'Close',
    cancel: 'Cancel',
    confirm: 'OK',
    save: 'Save',
    delete: 'Delete',
    edit: 'Edit',
    retry: 'Try again',
    search: 'Search',
    logIn: 'Log in',
    logOut: 'Log out',
    signUp: 'Sign up',
    goHome: 'Back to home',
  },
  status: {
    loading: 'Loading…',
  },
  time: {
    justNow: 'just now',
  },
  image: 'Image',
  withdrawnMember: 'Former member',
  scentFamily: {
    floral: 'Floral',
    green: 'Green',
    citrus: 'Citrus',
    fruity: 'Fruity',
    aquatic: 'Aquatic',
    musk: 'Musk',
    gourmand: 'Gourmand',
    woody: 'Woody',
    amber: 'Amber',
  },
  perfumeViewBack: {
    recommendation: 'Recommendations',
    scentMap: 'Scent Map',
    community: 'Community',
    perfumeList: 'Perfumes',
    shelf: 'Shelf',
    collection: 'Collection',
    previousPerfume: 'Previous perfume',
  },
} satisfies Messages<typeof ko>
