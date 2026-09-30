import type { Messages } from '../../types'
import type { layout as ko } from '../ko/layout'

export const layout = {
  header: {
    primaryNav: 'Main menu',
    account: 'My account',
    profilePhoto: 'My profile photo',
    editProfile: 'Edit profile',
    community: {
      reviews: 'Reviews',
      free: 'Free board',
    },
  },
  graphics: {
    trigger: 'Graphics settings',
    title: 'Graphics quality',
    recommended: '(recommended)',
    tier: {
      high: 'High',
      mid: 'Medium',
      low: 'Low',
    },
    mode: {
      auto: { label: 'Auto', hint: 'Adjusts to your device' },
      high: { label: 'High', hint: 'Sharpest · glow · boat reflections' },
      mid: { label: 'Medium', hint: 'A little softer and smoother' },
      low: { label: 'Low', hint: 'Lightest · saves battery' },
    },
    live: 'Now {{tier}}',
    liveIntegrated: 'Now {{tier}} · integrated graphics',
    integratedTip:
      'On a laptop with a dedicated GPU, set your browser to ‘High performance’ in Windows Settings › System › Display › Graphics for smoother motion',
  },
  feedback: {
    link: 'Send feedback (new tab)',
    greeting: 'Tap the button to send us feedback!',
  },
  errorPage: {
    title: 'Something went wrong',
    unknown: 'An unknown error occurred.',
  },
  notFound: {
    description: "This page doesn't exist.",
  },
  confirmDialog: {
    title: 'Delete this?',
    description: "This can't be undone.",
  },
  loginRequired: {
    title: 'Please log in',
    description: 'You can still see recommendations without logging in.',
  },
  pagination: {
    label: 'Pages',
    previous: 'Prev',
    previousPage: 'Previous page',
    next: 'Next',
    nextPage: 'Next page',
    page: 'Page {{page}}',
  },
  perfumeCard: {
    rank: 'No. {{rank}} most popular',
  },
  perfumePicker: {
    searchLabel: 'Search by perfume or brand',
    placeholder: 'Search perfumes · brands',
    notFoundTitle: 'No perfumes found',
    notFoundDescription: 'Try a different search.',
    emptyTitle: 'Search for a perfume',
    emptyDescription:
      'Enter a perfume or brand name to see perfumes you can pick.',
  },
  starRating: {
    unrated: 'Not rated yet',
    score: '{{score}} out of {{max}}',
  },
} satisfies Messages<typeof ko>
