interface WinProbGaugeProps {
  probability: number; // 0..1
  autoContestThreshold?: number;
  humanReviewFloor?: number;
}

/**
 * Radial SVG Win-Probability Gauge with explicit <40% Accept, 40-75% Review, >=75% Contest bands.
 */
export function WinProbGauge({
  probability,
  autoContestThreshold = 0.75,
  humanReviewFloor = 0.4,
}: WinProbGaugeProps) {
  const pct = Math.max(0, Math.min(100, probability * 100));
  const radius = 58;
  const circumference = Math.PI * radius; // semi-circle arc
  const dashOffset = circumference - (pct / 100) * circumference;

  const band =
    probability >= autoContestThreshold
      ? { label: 'Auto-Contest Band', color: '#059669', textClass: 'text-emerald-700' }
      : probability >= humanReviewFloor
        ? { label: 'Human Review Band', color: '#D97706', textClass: 'text-amber-700' }
        : { label: 'Accept Loss / Block', color: '#DC2626', textClass: 'text-rose-700' };

  return (
    <div className="flex flex-col items-center">
      <svg
        viewBox="0 0 150 92"
        className="w-44 h-28 overflow-visible"
        role="img"
        aria-label={`Win probability ${pct.toFixed(1)} percent, ${band.label}`}
      >
        {/* Background track */}
        <path
          d="M 17 78 A 58 58 0 0 1 133 78"
          fill="none"
          stroke="#E2D8C8"
          strokeWidth="10"
          strokeLinecap="round"
        />
        {/* Active score arc */}
        <path
          d="M 17 78 A 58 58 0 0 1 133 78"
          fill="none"
          stroke={band.color}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          style={{ transition: 'stroke-dashoffset 450ms cubic-bezier(0.16, 1, 0.3, 1)' }}
        />
        <text
          x="75"
          y="62"
          textAnchor="middle"
          className="fill-[#1C1917] font-mono text-[22px] font-bold tabular-nums"
        >
          {pct.toFixed(1)}%
        </text>
        <text
          x="75"
          y="78"
          textAnchor="middle"
          className="fill-[#57534E] font-mono text-[9px] uppercase tracking-wider"
        >
          Win Probability
        </text>
      </svg>

      <div className="mt-1 flex items-center gap-2 text-xs font-mono">
        <span className={`font-semibold ${band.textClass}`}>{band.label}</span>
      </div>

      <div className="mt-3 grid w-full grid-cols-3 gap-1.5 border-t border-[#E2D8C8] pt-3 text-center font-mono text-[11px] tabular-nums">
        <div>
          <div className="text-rose-700">&lt;{(humanReviewFloor * 100).toFixed(0)}%</div>
          <div className="text-[#57534E]">Accept</div>
        </div>
        <div>
          <div className="text-amber-700">
            {(humanReviewFloor * 100).toFixed(0)}–{(autoContestThreshold * 100).toFixed(0)}%
          </div>
          <div className="text-[#57534E]">Review</div>
        </div>
        <div>
          <div className="text-emerald-700">&ge;{(autoContestThreshold * 100).toFixed(0)}%</div>
          <div className="text-[#57534E]">Contest</div>
        </div>
      </div>
    </div>
  );
}
