import type { Messages } from '../../types'
import type { taste as ko } from '../ko/taste'

export const taste = {
  families: {
    floral: 'Radiant',
    green: 'Verdant',
    citrus: 'Zesty',
    fruity: 'Playful',
    aquatic: 'Cool',
    musk: 'Cozy',
    gourmand: 'Sweet',
    woody: 'Calm',
    amber: 'Warm',
  },
  picker: {
    label: 'Pick scent families',
    rank: '#{{order}}',
  },
  step: {
    kicker: 'Taste Test',
    title: 'Which scents draw you in?',
    lead: 'Pick up to two scents you like. Your Scent Map starts from the perfume closest to them.',
    loadFailedTitle: 'Couldn’t load Scent Map data',
    loadFailedDescription: 'Please try again.',
    picked: 'Scents picked ',
    submit: 'Find my start',
    saveFailed: 'Couldn’t save your result. Please try again.',
  },
  result: {
    headline: {
      rare: 'That’s a rare combination',
      noOverlap: 'We set your start by your #1 pick',
      normal: 'We found your starting point',
    },
    lead: {
      rare: 'Only one perfume on the Scent Map has both scents. That bottle stands for your taste right now.',
      noOverlap:
        'We set your starting point by your #1 pick, the {{first}} scent. Your #2 pick, the {{second}} scent, isn’t reflected this time.',
      two: 'We found a perfume where your #1 pick, the {{first}} scent, comes through stronger.',
      one: 'We found a perfume where the {{first}} scent you picked comes through strongest.',
    },
    closing: 'See your starting point on the Scent Map.',
    retry: 'Retake',
    confirm: 'Go to Scent Map',
    retrySave: 'Try again',
  },
} satisfies Messages<typeof ko>
