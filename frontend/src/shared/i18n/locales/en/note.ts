import type { Messages } from '../../types'
import type { note as ko } from '../ko/note'

export const note = {
  sections: {
    emptyTitle: 'No notes found',
    emptyDescription: 'Try a different name.',
    count_one: '{{count}} note',
    count_other: '{{count}} notes',
    imageFallback: 'Image',
    uncategorized: 'Other',
  },
  list: {
    heading: 'Notes',
    searchLabel: 'Search by note name',
    searchPlaceholder: 'Search notes',
    familyLabel: 'Note families',
    reset: 'Reset',
  },
  detail: {
    notFoundTitle: 'Note not found',
    notFoundDescription: 'Check the link or pick one from the note list.',
    retry: 'Try again',
    list: 'Notes',
    imageFallback: 'Note image',
    perfumesHeading: 'Perfumes with this note',
    perfumeCount_one: '{{total}} perfume',
    perfumeCount_other: '{{total}} perfumes',
    loadErrorTitle: "Couldn't load perfumes",
    loadErrorDescription: 'Please try again later.',
    emptyTitle: 'No perfumes use this note',
    emptyDescription: 'Try another note.',
    pagination: 'Perfume pages for this note',
  },
} satisfies Messages<typeof ko>
