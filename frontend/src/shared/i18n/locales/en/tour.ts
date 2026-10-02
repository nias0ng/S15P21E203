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
  buoy: 'Each glowing buoy is a perfume. Pick one.',
  buoyMove: 'Select the sea to sail there.',
  // only on devices with arrow keys
  buoyKeys: 'You can also steer with ← → ↑.',
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
  minimap: {
    pointer:
      'A map of scent families. Click a name to sail there. Bright parts are sea you’ve crossed — that’s the % seen.',
    touch:
      'A map of scent families. Tap a name twice to sail there. Bright parts are sea you’ve crossed — that’s the % seen.',
  },
  boat: {
    member:
      'Click the boat to step into the cabin — your saved perfumes are on the Shelf.',
    guest:
      'Click the boat to step into the cabin. Log in to keep the perfumes you like on the Shelf.',
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
