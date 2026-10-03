import { useTranslation } from 'react-i18next'

import { SEASONS, type SeasonStatistic } from '../types'

type Props = { seasons: SeasonStatistic[] }

export function SeasonRatingChart({ seasons }: Props) {
  const { t } = useTranslation('perfume')
  const bySeason = new Map(seasons.map((item) => [item.code, item.percentage]))

  return (
    <ul className="flex flex-wrap gap-6.25">
      {SEASONS.map((season) => (
        <li key={season.value} className="flex flex-col items-center gap-2.5">
          <SeasonDonut percentage={bySeason.get(season.value) ?? 0} />
          <span className="text-ink text-caption">
            {t(`season.${season.value}`)}
          </span>
        </li>
      ))}
    </ul>
  )
}

// NOTE: 화면 픽셀이 아니라 viewBox 안의 좌표입니다.
// 실제 지름은 바깥 상자의 `size-22.5`(=90/4)가 정하고 `--spacing` 을 타 화면 폭을 따라 줄어듭니다.
const SIZE = 90
const STROKE = 12
const RADIUS = (SIZE - STROKE) / 2
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

function SeasonDonut({ percentage }: { percentage: number }) {
  const clamped = Number(Math.min(100, Math.max(0, percentage)).toFixed(1))
  const filled = (clamped / 100) * CIRCUMFERENCE

  return (
    <div className="relative size-22.5">
      <svg
        aria-hidden
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className="size-full -rotate-90"
      >
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          strokeWidth={STROKE}
          className="stroke-line-soft"
        />
        {clamped > 0 && (
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            fill="none"
            strokeWidth={STROKE}
            strokeDasharray={`${filled} ${CIRCUMFERENCE - filled}`}
            strokeLinecap="round"
            className="stroke-ink"
          />
        )}
      </svg>

      <span className="text-ink text-caption absolute inset-0 flex items-center justify-center font-medium">
        {clamped}%
      </span>
    </div>
  )
}
