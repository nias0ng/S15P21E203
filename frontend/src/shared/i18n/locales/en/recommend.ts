import type { Messages } from '../../types'
import type { recommend as ko } from '../ko/recommend'

export const recommend = {
  personalReason: {
    fit: 'Its {{keyword}} accord is close to the perfumes you rated highly.',
    recent:
      "It carries the {{keyword}} accord you've often met in perfumes you viewed recently.",
    taste:
      'It suits the {{keyword}} scent family you picked in the Taste Test.',
  },
  letter: {
    headline: {
      fit: 'We found a perfume like the ones you loved',
      recent: 'A perfume in the style you’ve been exploring',
      taste: 'Your Taste Test picked a perfume for you',
      unknown: 'A perfume has arrived for you',
    },
    nextNote: {
      none: 'No new perfume to send right now',
      failed: 'Couldn’t get a new letter. Try again',
    },
    fold: 'Fold letter',
    salutation: 'Dear {{name}},',
    photoPending: 'Photo coming soon',
    accords: 'Accords of this perfume',
    viewDetails: 'View details',
    previous: 'Previous letter',
    next: 'Next letter',
    refreshing: 'Sealing a new letter',
    another: 'Recommend another',
    sign: 'From Hyanghae',
    envelope: {
      invitation:
        'How to get a scent letter — finish the Taste Test and one will arrive',
      unread: 'Open new scent letter',
      read: 'Reopen scent letter',
    },
    sheet: 'A scent letter for you',
    invitation: {
      headline: 'We can’t write your letter until we know your taste',
      body: 'Pick a few scent families you like. We’ll read them with your match ratings on your shelf and the perfumes you’ve viewed lately, then send you a perfume picked for you.',
      action: 'Take the Taste Test',
    },
  },
  nlr: {
    koreanHint: 'Works best when you type in Korean',
    title: 'Recommendations',
    asked: 'You asked · ',
    narrowedBefore: 'Narrowed down by ',
    narrowedAfter: '.',
    relaxedWithoutScent:
      'We couldn’t read a scent in your words, so we picked perfumes that fit the conditions above, most reviewed first. Describe the smell in one more line and we can pick by scent.',
    relaxed:
      'Your request was broad, so we included similar scents too. Add a season or occasion to narrow it down.',
    empty: {
      noConditionTitle: 'We couldn’t tell what scent you meant',
      noConditionDescription:
        'Try describing the smell — like ‘smells like soap’ or ‘earth after rain’.',
      noResultTitle: 'No perfume matches that scent',
      noResultDescription:
        'Try fewer conditions. Drop a season or occasion and ask again.',
    },
    error: {
      rateLimitedTitle: 'Take a short break',
      rateLimitedDescription:
        'You searched many times in a short while. Try again in a moment.',
      unavailableTitle: 'The recommendation server isn’t responding',
      unavailableDescription:
        'Other features like perfume search and the Shelf still work.',
      failedTitle: 'Couldn’t load recommendations',
      failedDescription: 'Please try again in a moment.',
    },
    card: {
      rankLabel: 'Recommended',
      reasonLabel: 'Why we recommend {{name}}',
      viewDetails: 'View details',
      reasonTitle: 'Why this perfume',
      strengthHint: ' · Numbers show scent strength (0–100)',
    },
    sentence: {
      conditionStart: 'Fits what you asked for: ',
      conditionEnd: '.',
      start: 'This perfume has ',
      joiner: ', ',
      phraseBefore: 'the ',
      phraseAfter: ' scent ‘{{phrase}}’ suggests',
      requestedBefore: 'the ',
      requestedAfter: ' scent you asked for',
      end: '.',
    },
    conditions: {
      masculine: 'Masculine',
      feminine: 'Feminine',
      unisex: 'Unisex',
      spring: 'Spring',
      summer: 'Summer',
      fall: 'Fall',
      winter: 'Winter',
      day: 'Daytime',
      night: 'Night',
    },
  },
  feedback: {
    title: 'How were these picks?',
    thanks: 'Thank you. We only use your answer to improve recommendations.',
    satisfaction: 'Satisfaction',
    options: {
      satisfied: 'I like them',
      neutral: 'They’re okay',
      dissatisfied: 'Not quite',
    },
    comment: 'Comment (optional)',
    placeholder: 'Tell us what you liked or what fell short',
    tooLong: 'Up to {{max}} characters',
    send: 'Send',
    error: {
      rateLimited: 'You sent many times in a short while. Try again shortly.',
      gone: 'This recommendation is no longer on record, so we couldn’t send it.',
      failed: 'Couldn’t send your answer. Please try again in a moment.',
    },
  },
} satisfies Messages<typeof ko>
