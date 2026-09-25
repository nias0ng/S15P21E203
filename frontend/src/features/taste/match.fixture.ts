/**
 * `match.test.ts` 전용 향수 200개 고정값 — 화면은 `api.ts` 의 `GET /map/scent-vectors` 를 씁니다.
 * 출처는 `backend/db/seed` 이고, `perfumeId` 자리에 `fragrantica_id` 가 들어 있습니다.
 */
import type { ScentVector } from './types'

type FixtureRow = Omit<ScentVector, 'perfumeId'> & { fragranticaId: number }

const ROWS: readonly FixtureRow[] = [
  {
    fragranticaId: 65738,
    rank: 1,
    families: { MUSK: 0.2309 },
  },
  {
    fragranticaId: 83,
    rank: 2,
    families: { GREEN: 0.4425, CITRUS: 0.295 },
  },
  {
    fragranticaId: 74041,
    rank: 3,
    families: { GREEN: 0.2828, AQUATIC: 0.3678 },
  },
  {
    fragranticaId: 132132,
    rank: 4,
    families: { FLORAL: 0.3211 },
  },
  {
    fragranticaId: 988,
    rank: 5,
    families: { FLORAL: 0.5904 },
  },
  {
    fragranticaId: 10131,
    rank: 6,
    families: { MUSK: 0.4438, AMBER: 0.2722 },
  },
  {
    fragranticaId: 14214,
    rank: 7,
    families: { FLORAL: 0.4103 },
  },
  {
    fragranticaId: 32134,
    rank: 8,
    families: { GREEN: 0.3539, AMBER: 0.2516 },
  },
  {
    fragranticaId: 20542,
    rank: 9,
    families: { FLORAL: 0.56, MUSK: 0.44 },
  },
  {
    fragranticaId: 6686,
    rank: 10,
    families: { FLORAL: 0.5976, MUSK: 0.3181 },
  },
  {
    fragranticaId: 68905,
    rank: 11,
    families: { FLORAL: 0.3758, GOURMAND: 0.308 },
  },
  {
    fragranticaId: 78945,
    rank: 12,
    families: { FLORAL: 0.5897 },
  },
  {
    fragranticaId: 72040,
    rank: 13,
    families: { GREEN: 0.3145, GOURMAND: 0.2484, WOODY: 0.2736 },
  },
  {
    fragranticaId: 75979,
    rank: 14,
    families: { FLORAL: 0.5357, MUSK: 0.4091 },
  },
  {
    fragranticaId: 6188,
    rank: 15,
    families: { FLORAL: 0.2674, MUSK: 0.4186 },
  },
  {
    fragranticaId: 8441,
    rank: 16,
    families: { FLORAL: 0.3846, GREEN: 0.3769 },
  },
  {
    fragranticaId: 15134,
    rank: 17,
    families: { GREEN: 0.2236 },
  },
  {
    fragranticaId: 6458,
    rank: 18,
    families: { FLORAL: 0.2449, GREEN: 0.2629, WOODY: 0.3843 },
  },
  {
    fragranticaId: 68919,
    rank: 19,
    families: { MUSK: 0.245 },
  },
  {
    fragranticaId: 276,
    rank: 20,
    families: { GREEN: 0.2835, CITRUS: 0.3049 },
  },
  {
    fragranticaId: 1483,
    rank: 21,
    families: { CITRUS: 0.2412, WOODY: 0.3241 },
  },
  {
    fragranticaId: 56741,
    rank: 22,
    families: { GOURMAND: 0.7306 },
  },
  {
    fragranticaId: 1360,
    rank: 23,
    families: { FLORAL: 0.593 },
  },
  {
    fragranticaId: 131717,
    rank: 24,
    families: { FLORAL: 0.3521, MUSK: 0.467 },
  },
  {
    fragranticaId: 607,
    rank: 25,
    families: { CITRUS: 0.2632, GOURMAND: 0.2447 },
  },
  {
    fragranticaId: 39970,
    rank: 26,
    families: { GOURMAND: 0.5613 },
  },
  {
    fragranticaId: 31661,
    rank: 27,
    families: { GOURMAND: 0.361 },
  },
  {
    fragranticaId: 611,
    rank: 28,
    families: { CITRUS: 0.2732, WOODY: 0.3279 },
  },
  {
    fragranticaId: 30796,
    rank: 29,
    families: { CITRUS: 0.4049 },
  },
  {
    fragranticaId: 184,
    rank: 30,
    families: { FLORAL: 0.3342 },
  },
  {
    fragranticaId: 12192,
    rank: 31,
    families: { FLORAL: 0.2863, CITRUS: 0.3817 },
  },
  {
    fragranticaId: 48478,
    rank: 32,
    families: { FLORAL: 0.2422, MUSK: 0.2662 },
  },
  {
    fragranticaId: 18,
    rank: 33,
    families: { GREEN: 0.2657 },
  },
  {
    fragranticaId: 56077,
    rank: 34,
    families: { GREEN: 0.243 },
  },
  {
    fragranticaId: 46187,
    rank: 35,
    families: { WOODY: 0.6566 },
  },
  {
    fragranticaId: 68578,
    rank: 36,
    families: { FLORAL: 0.4459, GOURMAND: 0.2552 },
  },
  {
    fragranticaId: 27040,
    rank: 37,
    families: { FLORAL: 0.357, MUSK: 0.2769 },
  },
  {
    fragranticaId: 52359,
    rank: 38,
    families: { FLORAL: 0.3888 },
  },
  {
    fragranticaId: 29165,
    rank: 39,
    families: { FRUITY: 0.3378, GOURMAND: 0.2635 },
  },
  {
    fragranticaId: 12201,
    rank: 40,
    families: { WOODY: 0.4551 },
  },
  {
    fragranticaId: 9405,
    rank: 41,
    families: { FLORAL: 0.5493 },
  },
  {
    fragranticaId: 64167,
    rank: 42,
    families: { GREEN: 0.2749, WOODY: 0.3342 },
  },
  {
    fragranticaId: 131985,
    rank: 43,
    families: { FLORAL: 0.5102, MUSK: 0.277 },
  },
  {
    fragranticaId: 10314,
    rank: 44,
    families: { FLORAL: 0.3771 },
  },
  {
    fragranticaId: 653,
    rank: 45,
    families: { FLORAL: 0.3294, FRUITY: 0.41 },
  },
  {
    fragranticaId: 3779,
    rank: 46,
    families: { FLORAL: 0.2898, FRUITY: 0.3534 },
  },
  {
    fragranticaId: 536,
    rank: 47,
    families: { FLORAL: 0.6438 },
  },
  {
    fragranticaId: 68416,
    rank: 48,
    families: { FLORAL: 0.3957, MUSK: 0.2457 },
  },
  {
    fragranticaId: 632,
    rank: 49,
    families: { FLORAL: 0.4824 },
  },
  {
    fragranticaId: 44894,
    rank: 50,
    families: { FLORAL: 0.8224 },
  },
  {
    fragranticaId: 3575,
    rank: 51,
    families: { AMBER: 0.2909 },
  },
  {
    fragranticaId: 12310,
    rank: 52,
    families: { MUSK: 0.4144 },
  },
  {
    fragranticaId: 38914,
    rank: 53,
    families: { FRUITY: 0.3086, GOURMAND: 0.2438 },
  },
  {
    fragranticaId: 73661,
    rank: 54,
    families: { AQUATIC: 0.2684, MUSK: 0.2619 },
  },
  {
    fragranticaId: 50384,
    rank: 55,
    families: { GOURMAND: 0.8046 },
  },
  {
    fragranticaId: 17798,
    rank: 56,
    families: { FLORAL: 0.7606 },
  },
  {
    fragranticaId: 56076,
    rank: 57,
    families: { FLORAL: 0.4825 },
  },
  {
    fragranticaId: 5484,
    rank: 58,
    families: { FLORAL: 0.5019 },
  },
  {
    fragranticaId: 5585,
    rank: 59,
    families: { GREEN: 0.4108, CITRUS: 0.2703 },
  },
  {
    fragranticaId: 109563,
    rank: 60,
    families: { GREEN: 0.4442 },
  },
  {
    fragranticaId: 42944,
    rank: 61,
    families: { FLORAL: 0.3182, CITRUS: 0.303 },
  },
  {
    fragranticaId: 75642,
    rank: 62,
    families: { FLORAL: 0.6475 },
  },
  {
    fragranticaId: 11784,
    rank: 63,
    families: { GREEN: 0.2626 },
  },
  {
    fragranticaId: 25836,
    rank: 64,
    families: { FLORAL: 0.3753 },
  },
  {
    fragranticaId: 275,
    rank: 65,
    families: { GREEN: 0.4496 },
  },
  {
    fragranticaId: 108962,
    rank: 66,
    families: { GREEN: 0.2806, GOURMAND: 0.2966 },
  },
  {
    fragranticaId: 23032,
    rank: 67,
    families: { MUSK: 0.3107 },
  },
  {
    fragranticaId: 10464,
    rank: 68,
    families: { WOODY: 0.3049, AMBER: 0.4553 },
  },
  {
    fragranticaId: 18767,
    rank: 69,
    families: { FLORAL: 0.6443 },
  },
  {
    fragranticaId: 72062,
    rank: 70,
    families: { CITRUS: 0.3584, MUSK: 0.2616 },
  },
  {
    fragranticaId: 72606,
    rank: 71,
    families: { FLORAL: 0.5708 },
  },
  {
    fragranticaId: 31861,
    rank: 72,
    families: { GREEN: 0.2454, AMBER: 0.4151 },
  },
  {
    fragranticaId: 79437,
    rank: 73,
    families: { GREEN: 0.2427, AQUATIC: 0.2573 },
  },
  {
    fragranticaId: 52002,
    rank: 74,
    families: { WOODY: 0.2684, AMBER: 0.3033 },
  },
  {
    fragranticaId: 12426,
    rank: 75,
    families: { MUSK: 0.2718, GOURMAND: 0.483, AMBER: 0.2451 },
  },
  {
    fragranticaId: 2271,
    rank: 76,
    families: { FLORAL: 0.3239, CITRUS: 0.4049 },
  },
  {
    fragranticaId: 3865,
    rank: 77,
    families: { GREEN: 0.3067, GOURMAND: 0.3282 },
  },
  {
    fragranticaId: 5534,
    rank: 78,
    families: { CITRUS: 0.3086 },
  },
  {
    fragranticaId: 644,
    rank: 79,
    families: { CITRUS: 0.2967 },
  },
  {
    fragranticaId: 2186,
    rank: 80,
    families: { GOURMAND: 0.6387 },
  },
  {
    fragranticaId: 92647,
    rank: 81,
    families: { CITRUS: 0.5181 },
  },
  {
    fragranticaId: 65792,
    rank: 82,
    families: { GREEN: 0.2615, AMBER: 0.2996 },
  },
  {
    fragranticaId: 96192,
    rank: 83,
    families: { FLORAL: 0.3327, MUSK: 0.3143 },
  },
  {
    fragranticaId: 39181,
    rank: 84,
    families: { GOURMAND: 0.3207 },
  },
  {
    fragranticaId: 53671,
    rank: 85,
    families: { AQUATIC: 0.5215 },
  },
  {
    fragranticaId: 64022,
    rank: 86,
    families: { GREEN: 0.3164 },
  },
  {
    fragranticaId: 37603,
    rank: 87,
    families: { GOURMAND: 0.5122, AMBER: 0.2664 },
  },
  {
    fragranticaId: 74740,
    rank: 88,
    families: { FRUITY: 0.2594, AMBER: 0.3083 },
  },
  {
    fragranticaId: 45029,
    rank: 89,
    families: { GREEN: 0.3376, MUSK: 0.2464 },
  },
  {
    fragranticaId: 106298,
    rank: 90,
    families: { GREEN: 0.3508, CITRUS: 0.3279 },
  },
  {
    fragranticaId: 1923,
    rank: 91,
    families: { AQUATIC: 0.309 },
  },
  {
    fragranticaId: 93865,
    rank: 92,
    families: { FLORAL: 0.2756, MUSK: 0.5583 },
  },
  {
    fragranticaId: 95034,
    rank: 93,
    families: { FRUITY: 0.2179 },
  },
  {
    fragranticaId: 82586,
    rank: 94,
    families: { FRUITY: 0.2833 },
  },
  {
    fragranticaId: 116396,
    rank: 95,
    families: { FLORAL: 0.303, MUSK: 0.2767 },
  },
  {
    fragranticaId: 74107,
    rank: 96,
    families: { WOODY: 0.4689 },
  },
  {
    fragranticaId: 1929,
    rank: 97,
    families: { FLORAL: 0.356 },
  },
  {
    fragranticaId: 90739,
    rank: 98,
    families: { FLORAL: 0.241, CITRUS: 0.3012, GOURMAND: 0.247 },
  },
  {
    fragranticaId: 44174,
    rank: 99,
    families: { WOODY: 0.4723 },
  },
  {
    fragranticaId: 35456,
    rank: 100,
    families: { GREEN: 0.4875 },
  },
  {
    fragranticaId: 30567,
    rank: 101,
    families: { CITRUS: 0.3906 },
  },
  {
    fragranticaId: 8339,
    rank: 102,
    families: { CITRUS: 0.3663 },
  },
  {
    fragranticaId: 54976,
    rank: 103,
    families: { FLORAL: 0.2732, CITRUS: 0.2653 },
  },
  {
    fragranticaId: 104985,
    rank: 104,
    families: { CITRUS: 0.2667 },
  },
  {
    fragranticaId: 87956,
    rank: 105,
    families: { FLORAL: 0.6677 },
  },
  {
    fragranticaId: 95642,
    rank: 106,
    families: { AQUATIC: 0.4555, WOODY: 0.3475 },
  },
  {
    fragranticaId: 50790,
    rank: 107,
    families: { MUSK: 0.4838 },
  },
  {
    fragranticaId: 50786,
    rank: 108,
    families: { CITRUS: 0.2487, WOODY: 0.3316 },
  },
  {
    fragranticaId: 121230,
    rank: 109,
    families: { GREEN: 0.372, FRUITY: 0.2439 },
  },
  {
    fragranticaId: 3024,
    rank: 110,
    families: { CITRUS: 0.2695, AQUATIC: 0.2615 },
  },
  {
    fragranticaId: 73092,
    rank: 111,
    families: { WOODY: 0.2564 },
  },
  {
    fragranticaId: 106299,
    rank: 112,
    families: { GREEN: 0.2591, AMBER: 0.4585 },
  },
  {
    fragranticaId: 31436,
    rank: 113,
    families: { GREEN: 0.3688, CITRUS: 0.3322 },
  },
  {
    fragranticaId: 890,
    rank: 114,
    families: { GREEN: 0.306, WOODY: 0.4751 },
  },
  {
    fragranticaId: 72796,
    rank: 115,
    families: { MUSK: 0.2534, WOODY: 0.3475 },
  },
  {
    fragranticaId: 98468,
    rank: 116,
    families: { CITRUS: 0.3436, AMBER: 0.2577 },
  },
  {
    fragranticaId: 59392,
    rank: 117,
    families: { GOURMAND: 0.3203 },
  },
  {
    fragranticaId: 60320,
    rank: 118,
    families: { FLORAL: 0.3693 },
  },
  {
    fragranticaId: 54885,
    rank: 119,
    families: { MUSK: 0.2576, AMBER: 0.3225 },
  },
  {
    fragranticaId: 122211,
    rank: 120,
    families: { FLORAL: 0.4278, MUSK: 0.4305 },
  },
  {
    fragranticaId: 10728,
    rank: 121,
    families: { FLORAL: 0.2468 },
  },
  {
    fragranticaId: 76893,
    rank: 122,
    families: { FRUITY: 0.2484, AMBER: 0.4295 },
  },
  {
    fragranticaId: 94718,
    rank: 123,
    families: { GREEN: 0.2642, WOODY: 0.3774 },
  },
  {
    fragranticaId: 115749,
    rank: 124,
    families: { GREEN: 0.3045, AMBER: 0.5225 },
  },
  {
    fragranticaId: 109565,
    rank: 125,
    families: { FLORAL: 0.4, MUSK: 0.5429 },
  },
  {
    fragranticaId: 75731,
    rank: 126,
    families: { CITRUS: 0.3257, GOURMAND: 0.2476 },
  },
  {
    fragranticaId: 4849,
    rank: 127,
    families: { FLORAL: 0.4298, MUSK: 0.2829 },
  },
  {
    fragranticaId: 42782,
    rank: 128,
    families: { GOURMAND: 0.6245 },
  },
  {
    fragranticaId: 16657,
    rank: 129,
    families: { GREEN: 0.3646 },
  },
  {
    fragranticaId: 122669,
    rank: 130,
    families: { FLORAL: 0.276, GOURMAND: 0.3047 },
  },
  {
    fragranticaId: 76824,
    rank: 131,
    families: { GOURMAND: 0.7428 },
  },
  {
    fragranticaId: 42670,
    rank: 132,
    families: { CITRUS: 0.3425 },
  },
  {
    fragranticaId: 18042,
    rank: 133,
    families: { FLORAL: 0.4751 },
  },
  {
    fragranticaId: 99134,
    rank: 134,
    families: { AMBER: 0.2657 },
  },
  {
    fragranticaId: 74636,
    rank: 135,
    families: { AQUATIC: 0.3129 },
  },
  {
    fragranticaId: 1198,
    rank: 136,
    families: { GREEN: 0.3333, AQUATIC: 0.4413 },
  },
  {
    fragranticaId: 4023,
    rank: 137,
    families: { WOODY: 0.2994 },
  },
  {
    fragranticaId: 43531,
    rank: 138,
    families: { GREEN: 0.5358 },
  },
  {
    fragranticaId: 129391,
    rank: 139,
    families: { MUSK: 0.3112 },
  },
  {
    fragranticaId: 123059,
    rank: 140,
    families: { FLORAL: 0.2 },
  },
  {
    fragranticaId: 69742,
    rank: 141,
    families: { FLORAL: 0.2953 },
  },
  {
    fragranticaId: 50789,
    rank: 142,
    families: { FLORAL: 0.3292, CITRUS: 0.2475 },
  },
  {
    fragranticaId: 6420,
    rank: 143,
    families: { FLORAL: 0.457 },
  },
  {
    fragranticaId: 3172,
    rank: 144,
    families: { AMBER: 0.2496 },
  },
  {
    fragranticaId: 64015,
    rank: 145,
    families: { FLORAL: 0.3128, GOURMAND: 0.2933 },
  },
  {
    fragranticaId: 1924,
    rank: 146,
    families: { FLORAL: 0.3717 },
  },
  {
    fragranticaId: 16931,
    rank: 147,
    families: { FLORAL: 0.5438 },
  },
  {
    fragranticaId: 115747,
    rank: 148,
    families: { WOODY: 0.4566 },
  },
  {
    fragranticaId: 115746,
    rank: 149,
    families: { GREEN: 0.2732, CITRUS: 0.2568 },
  },
  {
    fragranticaId: 95035,
    rank: 150,
    families: { FRUITY: 0.3077, GOURMAND: 0.5385 },
  },
  {
    fragranticaId: 50225,
    rank: 151,
    families: { FLORAL: 0.3614 },
  },
  {
    fragranticaId: 37602,
    rank: 152,
    families: { FLORAL: 0.3632 },
  },
  {
    fragranticaId: 75969,
    rank: 153,
    families: { GOURMAND: 0.6027 },
  },
  {
    fragranticaId: 64093,
    rank: 154,
    families: { FLORAL: 0.3053, MUSK: 0.4081 },
  },
  {
    fragranticaId: 109564,
    rank: 155,
    families: { WOODY: 0.5351 },
  },
  {
    fragranticaId: 95156,
    rank: 156,
    families: { GOURMAND: 0.2964, WOODY: 0.2896 },
  },
  {
    fragranticaId: 31247,
    rank: 157,
    families: { WOODY: 0.3088, AMBER: 0.2898 },
  },
  {
    fragranticaId: 1000,
    rank: 158,
    families: { FLORAL: 0.3853 },
  },
  {
    fragranticaId: 103276,
    rank: 159,
    families: { FLORAL: 0.2844, WOODY: 0.2634 },
  },
  {
    fragranticaId: 111273,
    rank: 160,
    families: { FLORAL: 0.4228, GOURMAND: 0.3705 },
  },
  {
    fragranticaId: 57088,
    rank: 161,
    families: { GOURMAND: 0.3014, AMBER: 0.5631 },
  },
  {
    fragranticaId: 50787,
    rank: 162,
    families: { FLORAL: 0.379 },
  },
  {
    fragranticaId: 72,
    rank: 163,
    families: { FLORAL: 0.4201, MUSK: 0.2881 },
  },
  {
    fragranticaId: 50788,
    rank: 164,
    families: { GREEN: 0.4298, WOODY: 0.3582 },
  },
  {
    fragranticaId: 68367,
    rank: 165,
    families: { FRUITY: 0.2725 },
  },
  {
    fragranticaId: 815,
    rank: 166,
    families: { AQUATIC: 0.2738, MUSK: 0.251 },
  },
  {
    fragranticaId: 85144,
    rank: 167,
    families: { WOODY: 0.5176 },
  },
  {
    fragranticaId: 90834,
    rank: 168,
    families: { FLORAL: 0.4483 },
  },
  {
    fragranticaId: 57384,
    rank: 169,
    families: { GOURMAND: 0.3732, AMBER: 0.284 },
  },
  {
    fragranticaId: 46623,
    rank: 170,
    families: { GREEN: 0.2962, CITRUS: 0.3846 },
  },
  {
    fragranticaId: 108587,
    rank: 171,
    families: { FRUITY: 0.2693, AQUATIC: 0.3612, GOURMAND: 0.2777 },
  },
  {
    fragranticaId: 84224,
    rank: 172,
    families: { CITRUS: 0.2364 },
  },
  {
    fragranticaId: 39761,
    rank: 173,
    families: { GOURMAND: 0.592 },
  },
  {
    fragranticaId: 70985,
    rank: 174,
    families: { AQUATIC: 0.3743, WOODY: 0.3101 },
  },
  {
    fragranticaId: 52180,
    rank: 175,
    families: { CITRUS: 0.25 },
  },
  {
    fragranticaId: 72381,
    rank: 176,
    families: { FRUITY: 0.439 },
  },
  {
    fragranticaId: 485,
    rank: 177,
    families: { CITRUS: 0.3215 },
  },
  {
    fragranticaId: 116224,
    rank: 178,
    families: { FLORAL: 0.3447, MUSK: 0.3234, WOODY: 0.3319 },
  },
  {
    fragranticaId: 45711,
    rank: 179,
    families: { FLORAL: 0.6314 },
  },
  {
    fragranticaId: 103564,
    rank: 180,
    families: { CITRUS: 0.2632, WOODY: 0.2711, AMBER: 0.2553 },
  },
  {
    fragranticaId: 63829,
    rank: 181,
    families: { FLORAL: 0.4777 },
  },
  {
    fragranticaId: 69281,
    rank: 182,
    families: { GREEN: 0.2903, WOODY: 0.3101 },
  },
  {
    fragranticaId: 89712,
    rank: 183,
    families: { GOURMAND: 0.2642, AMBER: 0.2487 },
  },
  {
    fragranticaId: 54785,
    rank: 184,
    families: { AMBER: 0.3838 },
  },
  {
    fragranticaId: 47891,
    rank: 185,
    families: { AQUATIC: 0.4698 },
  },
  {
    fragranticaId: 48434,
    rank: 186,
    families: { WOODY: 0.4288 },
  },
  {
    fragranticaId: 64092,
    rank: 187,
    families: { GREEN: 0.4703, AMBER: 0.2755 },
  },
  {
    fragranticaId: 62372,
    rank: 188,
    families: { FLORAL: 0.3594 },
  },
  {
    fragranticaId: 74739,
    rank: 189,
    families: { FLORAL: 0.3578 },
  },
  {
    fragranticaId: 120743,
    rank: 190,
    families: { FLORAL: 0.2813, MUSK: 0.2871, WOODY: 0.4316 },
  },
  {
    fragranticaId: 32523,
    rank: 191,
    families: { WOODY: 0.4962 },
  },
  {
    fragranticaId: 49827,
    rank: 192,
    families: { FLORAL: 0.4316 },
  },
  {
    fragranticaId: 124051,
    rank: 193,
    families: { MUSK: 0.4791 },
  },
  {
    fragranticaId: 46300,
    rank: 194,
    families: { FRUITY: 0.2725, MUSK: 0.2861 },
  },
  {
    fragranticaId: 21547,
    rank: 195,
    families: { FLORAL: 0.3646 },
  },
  {
    fragranticaId: 104123,
    rank: 196,
    families: { MUSK: 0.2495 },
  },
  {
    fragranticaId: 132011,
    rank: 197,
    families: { GREEN: 0.2969, CITRUS: 0.3125 },
  },
  {
    fragranticaId: 114281,
    rank: 198,
    families: { MUSK: 0.2215 },
  },
  {
    fragranticaId: 114188,
    rank: 199,
    families: { CITRUS: 0.2217 },
  },
  {
    fragranticaId: 98469,
    rank: 200,
    families: { FLORAL: 0.3561, CITRUS: 0.273 },
  },
]

export const SCENT_VECTORS_FIXTURE: ScentVector[] = ROWS.map((row) => ({
  perfumeId: row.fragranticaId,
  rank: row.rank,
  families: row.families,
}))
