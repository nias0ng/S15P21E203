import type { Messages } from '../../types'
import type { shelf as ko } from '../ko/shelf'

export const shelf = {
  category: {
    OWNED: 'Owned',
    TRIED: 'Tried',
    WISH: 'Wishlist',
  },
  part: {
    category: 'category',
    rating: 'match rating',
    memo: 'memo',
  },
  actions: {
    cancel: 'Cancel',
    next: 'Next',
    change: 'Change',
  },
  fields: {
    categoryLabel: 'Shelf category',
    categoryRequired: 'Choose a shelf category',
    required: 'Required',
    rating: 'My match rating',
    clearRating: 'Clear',
    memo: 'Memo',
  },
  editModal: {
    title: 'Edit',
    save: 'Save',
    hint: 'Memo and match rating can be left empty.',
  },
  registerModal: {
    title: 'Add perfume',
    submit: 'Add to Shelf',
    alreadyInShelf: 'Already on your shelf',
  },
  registerError: {
    partial: "Added to your shelf, but couldn't save {{parts}}",
    fallback: "Couldn't save to your shelf.",
  },
  footer: {
    collection: 'My Collections',
    backToShelf: 'Back to Shelf',
  },
  pager: {
    position: 'Perfume {{index}} of {{total}}',
    prev: 'Previous perfume',
    next: 'Next perfume',
  },
  plaque: {
    menu: 'Shelf categories',
    countBefore: ', ',
    countAfter_one: ' perfume',
    countAfter_other: ' perfumes',
  },
  toolbar: {
    search: 'Search perfumes',
    placeholder: 'Search by perfume, brand or note',
  },
  wall: {
    region: 'Shelf',
    plaqueHint: "Shows this category's perfumes on the wall",
    prev: 'Show previous perfumes',
    next: 'Show next perfumes',
  },
  detail: {
    region: 'Selected perfume',
    placeholder: 'Select a perfume on your shelf to see its details here',
    rating: 'My match rating',
    remove: 'Remove',
    edit: 'Edit',
    notesEmpty: 'No notes listed yet',
    notesMore: '+{{n}} more',
    notesOther: 'Other',
    memoPlaceholder: 'Jot down where and when you smelled it.',
  },
  page: {
    title: 'My Shelf',
    collectionTitle: 'My Collections',
    collectionCount_one: '{{count}} collection',
    collectionCount_other: '{{count}} collections',
    register: '+ Add perfume',
    categoryEmptyPanel:
      'Add perfumes to this category to see their details here',
    empty: {
      OWNED: {
        title: 'No owned perfumes yet',
        description: "Add the perfumes you own and they'll stand here.",
      },
      TRIED: {
        title: 'No tried perfumes yet',
        description:
          "Log perfumes you've tried in stores and they'll gather here.",
      },
      WISH: {
        title: 'Your Wishlist is empty',
        description: "Add perfumes you have your eye on and they'll wait here.",
      },
    },
    searchEmpty: {
      title: "No perfumes matching '{{keyword}}' in this category",
      description:
        'Check the counts on the menu for other categories, or try another search.',
      clear: 'Clear search',
    },
    loginRequired: {
      title: 'Log in to see your shelf',
      description: 'Your perfumes and memos are saved to your account.',
      action: 'Log in',
    },
    loadError: {
      title: "Couldn't load your shelf",
      description: 'Please try again in a moment.',
    },
    removeConfirm: {
      title: "Remove '{{name}}' from your shelf?",
      titleUnnamed: 'Remove this perfume from your shelf?',
      description:
        "Its memo and match rating will be deleted too. This can't be undone.",
      confirm: 'Remove',
    },
    letter: {
      inShelf: 'On your shelf',
      addWish: 'Add to Wishlist',
    },
  },
  toast: {
    registered: 'Added to your shelf',
    registerPartial: "Added to your shelf, but couldn't save {{parts}}",
    registerFailed: "Couldn't add to your shelf",
    edited: 'Changes saved',
    editPartial: "Couldn't change {{parts}}",
    editFailed: "Couldn't save changes",
    removed: 'Removed from your shelf',
    removeFailed: "Couldn't remove from your shelf",
    ratingFailed: "Couldn't save match rating",
    wishAdded: 'Added to Wishlist',
    wishFailed: "Couldn't add to your shelf",
  },
} satisfies Messages<typeof ko>
