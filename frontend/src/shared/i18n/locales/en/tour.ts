import type { Messages } from '../../types'
import type { tour as ko } from '../ko/tour'

export const tour = {
  tip: {
    close: 'Close tip',
    stopAll: 'Stop showing tips',
    next: 'Next',
  },
  // the five steps that teach sailing — sea · keys · buoy · similar · search (tourStore header)
  sea: {
    intro: 'This sea lays out perfumes by scent family.',
    action: 'Select the sea to sail your boat there.',
  },
  // only on devices with arrow keys
  keys: 'Steer with the ← → ↑ keys — head wherever you like.',
  buoy: {
    intro: 'Each glowing buoy is a perfume.',
    action: 'Pick one to see the perfume.',
  },
  similar:
    'Nearby perfumes have risen. Lines join the ones that smell alike — pick one to compare.',
  // NOTE: the quoted name must match search.tag in the map bundle (the label left of the search box)
  search:
    "Select 'Mood · Moment' and write the mood or moment you have in mind.",
  searchExample: 'e.g. earthy smell after rain · something fresh',
  results: 'Select a card to see why it was picked.',
  // NOTE: the button names must match the engine card (landing/src/i18n.js card.detail · save · sail)
  card: {
    detail: { name: 'View details', desc: 'the full perfume page' },
    save: { name: 'Save to Shelf', desc: 'keep the ones you like (log in)' },
    sail: {
      name: 'Sail to its waters',
      desc: 'go where its scent family gathers',
    },
  },
  zone: 'You’re in the {{zone}}, where one scent family gathers. Click the sea to close this view.',
  // Three lines — what it is · what a press does · the bright parts and the % seen
  minimap: {
    intro: 'This is a map of scent families.',
    pointer: 'Click a name to sail to those waters.',
    touch: 'Tap a name twice to sail to those waters.',
    seen: 'Bright parts are sea you’ve crossed; the % seen is how much you’ve explored so far.',
  },
  log: {
    member: 'The waters you sail and perfumes you find are written here.',
    guest: 'Log in to keep the waters you sail and perfumes you find here.',
  },
  // Two lines — click the boat · what you find there
  boat: {
    intro: 'Click the boat to step into the cabin.',
    member: 'Your saved perfumes (the Shelf) are there.',
    guest: 'Log in to keep the perfumes you like on the Shelf.',
  },
  guide: {
    trigger: 'How to use',
    title: 'How to use',
    controlsTitle: 'Getting around',
    controls: {
      sea: 'Click the sea to sail there',
      buoy: 'Click a buoy to open its perfume card',
      keys: 'Steer the boat with ← → ↑',
      minimap: 'Click a name on the minimap to sail to those waters',
      minimapTouch: 'Tap a name on the minimap twice to sail to those waters',
    },
    termsTitle: 'Words we use',
    terms: {
      buoy: { term: 'Buoy', desc: 'One perfume floating on the sea' },
      zone: {
        term: 'Waters',
        desc: 'Where one scent family (floral, woody…) gathers',
      },
      explored: {
        term: '% seen',
        desc: 'The bright part of the minimap — how much sea your boat has crossed',
      },
      chart: {
        term: 'Chart',
        desc: 'The large map opened from the button at the minimap’s top right',
      },
      log: {
        term: 'Voyage Log',
        desc: 'A record of the waters you sailed and perfumes you found (log in)',
      },
      cabin: {
        term: 'Cabin · Shelf',
        desc: 'Click the boat to step inside — perfumes you save gather on the Shelf (log in)',
      },
    },
    restart: 'Show the tips again from the start',
  },
} satisfies Messages<typeof ko>
