import { SEASONS, type SeasonStatistic } from '../types'

type Props = { seasons: SeasonStatistic[] }

/**
 * 계절별 평가 (와이어프레임 A10 ③ — DTL-14)
 *
 * 파이가 아니라 도넛 네 개인 이유: 계절을 여러 개 고를 수 있어 합이 100이 아닙니다.
 * 부분-전체가 아니라 서로 독립인 비율 네 개라 단일값 미터가 맞습니다.
 *
 * 넷 다 같은 색인 이유: 어느 계절인지는 아래 라벨이 이미 알려줍니다.
 *
 * 응답에 네 계절이 항상 들어 있지만 화면은 SEASONS 순서로 그립니다 — 응답 순서에
 * 기대면 정렬이 바뀌는 날 봄 · 여름 · 가을 · 겨울 자리가 뒤섞입니다.
 */
export function SeasonRatingChart({ seasons }: Props) {
  const bySeason = new Map(seasons.map((item) => [item.code, item.percentage]))

  return (
    <ul className="flex flex-wrap gap-6.25">
      {SEASONS.map((season) => (
        <li key={season.value} className="flex flex-col items-center gap-2.5">
          <SeasonDonut percentage={bySeason.get(season.value) ?? 0} />
          <span className="text-ink text-caption">{season.label}</span>
        </li>
      ))}
    </ul>
  )
}

/* 도넛 하나. 와이어프레임은 지름 88 · 링 12 인데, 치수 끝자리 0/5 규칙에 맞춰 지름만 90 으로 올렸습니다. */
const SIZE = 90
const STROKE = 12
const RADIUS = (SIZE - STROKE) / 2
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

function SeasonDonut({ percentage }: { percentage: number }) {
  // 소수점 한 자리까지 옵니다. 40.0 은 "40%" 로, 33.3 은 그대로 보여줍니다.
  const clamped = Number(Math.min(100, Math.max(0, percentage)).toFixed(1))
  const filled = (clamped / 100) * CIRCUMFERENCE

  return (
    <div className="relative" style={{ width: SIZE, height: SIZE }}>
      {/* 수치는 아래 글자로 읽히므로 그림은 보조입니다 */}
      <svg
        aria-hidden
        width={SIZE}
        height={SIZE}
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        // 12시 방향에서 시계방향으로 채우도록 90도 돌립니다
        className="-rotate-90"
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
            // 데이터가 끝나는 지점을 둥글게 — 채운 값이 아주 작을 때도 보입니다
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
