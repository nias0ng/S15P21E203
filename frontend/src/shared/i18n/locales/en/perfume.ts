import type { Messages } from '../../types'
import type { perfume as ko } from '../ko/perfume'

export const perfume = {
  season: {
    SPRING: 'Spring',
    SUMMER: 'Summer',
    AUTUMN: 'Fall',
    WINTER: 'Winter',
  },
  filters: {
    rankingLabel: 'Most-saved filter',
    genderLabel: 'Scent gender',
    ranking: {
      OWNED: 'Owned',
      WISH: 'Wishlist',
      VIEWED: 'Viewed',
    },
    gender: {
      FEMALE: 'Feminine',
      MALE: 'Masculine',
      UNISEX: 'Unisex',
    },
  },
  grid: {
    emptyTitle: 'No perfumes match',
    emptyDescription: 'Try another search or clear the filters.',
  },
  notes: {
    title: 'Notes',
    loading: 'Loading notes…',
    empty: 'No notes listed yet.',
    other: 'Other',
  },
  overview: {
    imageFallback: 'Perfume image',
    shelfSave: 'Save to Shelf',
    shelfRemove: 'Remove from Shelf',
    discontinued: 'Discontinued',
    gender: {
      FEMALE: 'Feminine',
      MALE: 'Masculine',
      UNISEX: 'Unisex',
    },
  },
  related: {
    title: 'Similar perfumes',
  },
  seasonRatings: {
    title: 'Ratings by season',
  },
  summary: {
    title: 'AI review summary',
    loading: 'Loading summary…',
    source_one: 'Summarized from {{count}} review.',
    source_other: 'Summarized from {{count}} reviews.',
    empty: "We'll show a summary once there are enough reviews.",
  },
  keywords: {
    caption: 'Words that come up often in scent reviews',
  },
  reviewList: {
    title: 'Reviews',
    count_one: '{{count}} review',
    count_other: '{{count}} reviews',
    loginDescription: 'Log in to write a review.',
    write: 'Write a review',
    editMine: 'Edit my review',
    emptyTitle: 'No reviews yet',
    emptyDescription: 'Tried this perfume? Leave the first review.',
    pagination: 'Review pages',
    mine: 'My review',
  },
  reviewDetail: {
    backToBoard: 'Reviews',
    edit: 'Edit',
    delete: 'Delete',
    likeLabel: 'Like {{count}}',
    toPerfume: 'View perfume →',
    stats: '{{likes}} likes · {{views}} views',
    deleteFailed: "Couldn't delete. Please try again later.",
    likeFailed: "Couldn't like this review. Please try again later.",
    likeLoginDescription:
      'Log in to like reviews. You can read reviews without logging in.',
  },
  list: {
    heading: 'Perfumes',
    searchLabel: 'Search by perfume or brand',
    searchPlaceholder: 'Search perfumes or brands',
    reset: 'Reset',
    pageEmptyTitle: 'No results on this page',
    pageEmptyDescription: 'Go back to an earlier page.',
    searchEmptyTitle: 'No results',
    searchEmptyDescription: "No perfumes match '{{keyword}}'.",
    headingSearch: 'Search results',
    headingFiltered: 'Matching perfumes',
    headingPopular: 'Featured on the scent map',
    count_one: '{{count}} perfume',
    count_other: '{{count}} perfumes',
    loadErrorTitle: "Couldn't load perfumes",
    loadErrorDescription: 'Please try again.',
    pagination: 'Search result pages',
  },
  detail: {
    loadErrorTitle: "Couldn't load this perfume",
    loadErrorDescription: 'Please try again.',
    shelfSaved: 'Saved to your shelf',
    removeTitle: "Remove '{{name}}' from your shelf?",
    removeDescription:
      "Your note and match rating will be deleted too. This can't be undone.",
    removeConfirm: 'Remove',
    removed: 'Removed from your shelf',
    removeFailed: "Couldn't remove it from your shelf",
  },
  errors: {
    notFound: 'Perfume not found',
  },
} satisfies Messages<typeof ko>
