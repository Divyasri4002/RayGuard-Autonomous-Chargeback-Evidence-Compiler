import { useEffect, useState } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { HeldOutEvaluationResult } from '../shared/types';
import { ConsoleLayout } from '../components/ConsoleLayout';
import { RayLightButton } from '../components/RayLightButton';
import { formatInr } from '../utils/formatters';

export function EvaluationLabPage() {
  const [threshold, setThreshold] = useState(0.75);
  const [evaluation, setEvaluation] = useState<HeldOutEvaluationResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/metrics/held-out?threshold=${threshold.toFixed(2)}`)
      .then((res) => res.json())
      .then((data: HeldOutEvaluationResult) => {
        if (!cancelled) {
          setEvaluation(data);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [threshold]);

  return (
    <ConsoleLayout
      breadcrumb="ML Lab"
      primaryAction={
        <RayLightButton to="/policies" variant="surface" size="sm">
          Policies
        </RayLightButton>
      }
    >
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <h1 className="text-2xl font-medium text-[#1C1917]">Held-Out Model Calibration</h1>
          <div className="font-mono text-xs text-[#57534E]">
            Test Split: <span className="text-[#1C1917] font-semibold">60 Disputes</span> · Cost Gate Stopped:{' '}
            <span className="text-[#1C1917] font-semibold">{evaluation?.blockedByCostGate ?? '—'}</span>
          </div>
        </div>

        {/* Threshold Control */}
        <section className="rounded-lg border border-[#E2D8C8] bg-[#FFFDF9] p-6 shadow-[0_1px_2px_rgba(28,25,23,0.03)]">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <label htmlFor="threshold-slider" className="text-sm font-medium text-[#1C1917] block">
                Decision Threshold
              </label>
              <p className="mt-1 font-serif text-xs text-[#57534E]">
                Adjust confidence cutoff across 0.50–0.95 to balance recall against ₹500 loss fees.
              </p>
            </div>

            <div className="flex items-center gap-4">
              <input
                id="threshold-slider"
                type="range"
                min={0.5}
                max={0.95}
                step={0.01}
                value={threshold}
                onChange={(e) => setThreshold(Number(e.target.value))}
                className="w-56 accent-[#EA580C] cursor-pointer"
              />
              <span className="w-20 rounded-lg border border-[#EA580C]/60 bg-[#F3EDE2] px-3 py-1.5 text-center font-mono text-base font-bold text-[#C2410C] tabular-nums">
                {threshold.toFixed(2)}
              </span>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            <div className="rounded-lg border border-[#E2D8C8] bg-[#F3EDE2] p-4">
              <div className="font-mono text-[11px] text-[#57534E]">Precision</div>
              <div className="mt-1 font-mono text-2xl font-semibold text-emerald-700 tabular-nums">
                {evaluation ? `${(evaluation.precision * 100).toFixed(1)}%` : '—'}
              </div>
            </div>
            <div className="rounded-lg border border-[#E2D8C8] bg-[#F3EDE2] p-4">
              <div className="font-mono text-[11px] text-[#57534E]">Recall</div>
              <div className="mt-1 font-mono text-2xl font-semibold text-[#1C1917] tabular-nums">
                {evaluation ? `${(evaluation.recall * 100).toFixed(1)}%` : '—'}
              </div>
            </div>
            <div className="rounded-lg border border-[#E2D8C8] bg-[#F3EDE2] p-4">
              <div className="font-mono text-[11px] text-[#57534E]">F1 Score</div>
              <div className="mt-1 font-mono text-2xl font-semibold text-[#1C1917] tabular-nums">
                {evaluation ? `${(evaluation.f1Score * 100).toFixed(1)}%` : '—'}
              </div>
            </div>
            <div className="rounded-lg border border-[#E2D8C8] bg-[#F3EDE2] p-4">
              <div className="font-mono text-[11px] text-[#57534E]">FP Cost</div>
              <div className="mt-1 font-mono text-2xl font-semibold text-rose-700 tabular-nums">
                {evaluation ? formatInr(evaluation.falsePositiveCostInr) : '—'}
              </div>
            </div>
            <div className="rounded-lg border border-[#E2D8C8] bg-[#F3EDE2] p-4">
              <div className="font-mono text-[11px] text-[#57534E]">Net Recovered</div>
              <div className="mt-1 font-mono text-2xl font-semibold text-[#C2410C] tabular-nums">
                {evaluation ? formatInr(evaluation.netRecoveredInr) : '—'}
              </div>
            </div>
          </div>
        </section>

        {/* Confusion Matrix + Curve */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <section className="lg:col-span-5 rounded-lg border border-[#E2D8C8] bg-[#FFFDF9] p-6">
            <div className="border-b border-[#E2D8C8] pb-3.5">
              <h2 className="text-base font-medium text-[#1C1917]">
                Confusion Matrix (N = {evaluation?.totalCases ?? 60})
              </h2>
            </div>

            {loading || !evaluation ? (
              <div className="py-16 text-center text-xs text-[#57534E]">Evaluating split...</div>
            ) : (
              <div className="mt-5 grid grid-cols-2 gap-3">
                <div className="rounded-lg border border-emerald-300 bg-emerald-50/70 p-5">
                  <div className="font-mono text-[11px] font-semibold text-emerald-800">True Positive</div>
                  <div className="mt-2 font-mono text-3xl font-bold text-[#1C1917] tabular-nums">
                    {evaluation.truePositives}
                  </div>
                </div>

                <div className="rounded-lg border border-rose-300 bg-rose-50/70 p-5">
                  <div className="font-mono text-[11px] font-semibold text-rose-800">False Positive</div>
                  <div className="mt-2 font-mono text-3xl font-bold text-[#1C1917] tabular-nums">
                    {evaluation.falsePositives}
                  </div>
                </div>

                <div className="rounded-lg border border-amber-300 bg-amber-50/70 p-5">
                  <div className="font-mono text-[11px] font-semibold text-amber-800">False Negative</div>
                  <div className="mt-2 font-mono text-3xl font-bold text-[#1C1917] tabular-nums">
                    {evaluation.falseNegatives}
                  </div>
                </div>

                <div className="rounded-lg border border-[#E2D8C8] bg-[#F3EDE2] p-5">
                  <div className="font-mono text-[11px] font-semibold text-[#57534E]">True Negative</div>
                  <div className="mt-2 font-mono text-3xl font-bold text-[#1C1917] tabular-nums">
                    {evaluation.trueNegatives}
                  </div>
                </div>
              </div>
            )}
          </section>

          <section className="lg:col-span-7 rounded-lg border border-[#E2D8C8] bg-[#FFFDF9] p-6 flex flex-col">
            <div className="border-b border-[#E2D8C8] pb-3.5 flex items-center justify-between">
              <h2 className="text-base font-medium text-[#1C1917]">Precision / Recall Sweep</h2>
              <div className="flex items-center gap-4 font-mono text-xs font-semibold">
                <span className="text-emerald-700">Precision %</span>
                <span className="text-[#EA580C]">Recall %</span>
              </div>
            </div>

            <div className="mt-5 h-64 w-full">
              {evaluation && (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={evaluation.curve}>
                    <CartesianGrid stroke="#E2D8C8" strokeDasharray="3 3" />
                    <XAxis
                      dataKey="threshold"
                      stroke="#78716C"
                      tick={{ fill: '#57534E', fontSize: 11 }}
                    />
                    <YAxis
                      domain={[50, 100]}
                      stroke="#78716C"
                      tick={{ fill: '#57534E', fontSize: 11 }}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#FFFDF9',
                        borderColor: '#E2D8C8',
                        color: '#1C1917',
                        fontSize: '12px',
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="precision"
                      name="Precision (%)"
                      stroke="#059669"
                      strokeWidth={2.5}
                      dot={{ r: 3 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="recall"
                      name="Recall (%)"
                      stroke="#EA580C"
                      strokeWidth={2.5}
                      dot={{ r: 3 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </section>
        </div>
      </div>
    </ConsoleLayout>
  );
}
