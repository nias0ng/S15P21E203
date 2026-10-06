import type { Messages } from '../../types'
import type { collection as ko } from '../ko/collection'

export const collection = {
  actions: {
    cancel: 'Cancel',
    retry: 'Try again',
  },
  perfumeCount_one: '{{count}} perfume',
  perfumeCount_other: '{{count}} perfumes',
  loadError: {
    title: "Couldn't load your collections",
    description: 'Please try again in a moment.',
  },
  add: {
    title: 'Add perfumes',
    submit: 'Add',
    empty: 'No more perfumes to add',
  },
  form: {
    createTitle: 'New collection',
    editTitle: 'Edit collection',
    create: 'Create',
    save: 'Save',
    name: 'Name',
    namePlaceholder: 'e.g. For work',
    description: 'Description (optional)',
    descriptionPlaceholder: 'When do you reach for these scents?',
    editHint:
      'Only the name and description change here. Add or remove perfumes on the collection page.',
    pickHeading: 'Perfumes to add',
    pickEmpty: 'No perfumes on your shelf yet',
    visibility:
      'Others only see a collection when you share it on the Discussion board. You can add more perfumes later.',
  },
  pick: {
    searchLabel: 'Search by perfume or brand',
    searchPlaceholder: 'Search perfume or brand',
    noCandidatesDescription:
      'Only perfumes on your shelf can go into a collection.',
    noMatchTitle: 'No matching perfumes',
    noMatchDescription: 'Try a different perfume or brand name.',
    selected_one: '{{count}} selected',
    selected_other: '{{count}} selected',
    notOnShelf: "· Perfumes not on your shelf can't be added.",
  },
  strip: {
    createFirst: 'Create your first collection',
    createNew: 'New collection',
    createMeta: 'Group perfumes from your shelf into one case',
    empty: 'No perfumes yet',
  },
  grid: {
    remove: 'Remove {{name}} from collection',
    addFirst: 'Add your first perfume',
    addMore: 'Add more perfumes',
  },
  detail: {
    back: 'My Collections',
    notFoundTitle: 'Collection not found',
    notFoundDescription: 'It may have been deleted or moved.',
    backToList: 'Back to My Collections',
    noDescription:
      'No description yet. Use [Edit] to note when you reach for these scents.',
    edit: 'Edit',
    delete: 'Delete',
    perfumesRegion: 'Perfumes in this collection',
    removeConfirm: {
      title: "Remove '{{name}}' from this collection?",
      titleUnnamed: 'Remove this perfume from this collection?',
      description: 'It stays on your shelf.',
      confirm: 'Remove',
    },
    deleteConfirm: {
      title: "Delete the collection '{{title}}'?",
      description: "This can't be undone. The perfumes stay on your shelf.",
      confirm: 'Delete',
    },
  },
  toast: {
    created: 'Collection created',
    createFailed: "Couldn't create the collection",
    updated: 'Collection updated',
    updateFailed: "Couldn't update the collection",
    deleteFailed: "Couldn't delete the collection",
    added: 'Perfumes added',
    addPartial_one: "Couldn't add {{count}} perfume",
    addPartial_other: "Couldn't add {{count}} perfumes",
    addFailed: "Couldn't add perfumes",
    removed: 'Removed from collection',
    removeFailed: "Couldn't remove from collection",
  },
} satisfies Messages<typeof ko>
