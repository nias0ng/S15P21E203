import type { Messages } from '../../types'
import type { tour as ko } from '../ko/tour'

export const tour = {
  tip: {
    close: 'Close tip',
    stopAll: 'Stop showing tips',
  },
  welcome:
    'This sea lays out perfumes by scent family. Describe a feeling, or pick a floating buoy.',
  // NOTE: the mode names must match search.mode in the map bundle
  search:
    "'Describe' finds perfumes from a sentence; 'Name' finds one you already know.",
  results: 'Select a card to see why it was picked.',
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
