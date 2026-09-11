import { SEASONS, type SeasonRating } from '../types'

type Props = { ratings: SeasonRating[] }

/**
 * 계절별 평가 (와이어프레임 A10 ③ — DTL-14)
 *
 * 와이어프레임 지시: "계절마다 도넛 하나, 막대 아님".
 *
 * 폼 선택 근거 — 계절은 여러 개 고를 수 있어(DTL-16 · DTL-24) 네 값의 합이 100이
 * 아닐 수 있습니다. 즉 부분-전체가 아니라 서로 독립인 비율 네 개라서, 누적 막대나
 * 파이가 아니라 단일값 미터 네 개가 맞습니다.
 *
 * 색 선택 근거 — 어느 계절인지는 도넛 아래 라벨이 이미 알려줍니다. 색으로 계절을
 * 구분하면 라벨과 중복이고, 팔레트의 "PEARL 5~10% MAX" 규칙에도 어긋납니다.
 * 그래서 네 개 모두 같은 ink 색을 쓰고 트랙만 연하게 둡니다. 색으로 구분하는 쌍이
 * 없으니 색약 대비를 따질 대상 자체가 없습니다.
 *
 * 수치가 링 안에 글자로 찍혀 있으므로 호버 툴팁을 붙이지 않았습니다.
 */
export function SeasonRatingChart({ ratings }: Props) {
  const bySeason = new Map(
    ratings.map((item) => [item.season, item.percentage]),
  )

  return (
    <ul className="flex flex-wrap gap-6.25">
      {SEASONS.map((season) => (
        <li key={season.value} className="flex flex-col items-center gap-2.5">
          <SeasonDonut percentage={bySeason.get(season.value) ?? 0} />
          <span className="text-ink text-xs">{season.label}</span>
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
  const clamped = Math.min(100, Math.max(0, percentage))
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

      <span className="text-ink absolute inset-0 flex items-center justify-center text-xs font-bold">
        {clamped}%
      </span>
    </div>
  )
}
