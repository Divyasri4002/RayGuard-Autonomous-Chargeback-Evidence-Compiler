import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowUpRight, Clock, Plus } from 'lucide-react';
import { Line, LineChart, ResponsiveContainer, Tooltip, YAxis } from 'recharts';
import type { DisputeRecord, OverviewMetrics } from '../shared/types';
import { ConsoleLayout } from '../components/ConsoleLayout';
import { DisputeIntakeModal } from '../components/DisputeIntakeModal';
import { RayLightButton } from '../components/RayLightButton';
import {
  formatInr,
  formatInrFromPaise,
  formatLatency,
  formatPercent,
  getStatusMeta,
} from '../utils/formatters';

export function OverviewPage() {
  const navigate = useNavigate();
  const [metrics, setMetrics] = useState<OverviewMetrics | null>(null);
  const [disputes, setDisputes] = useState<DisputeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [intakeOpen, setIntakeOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  const fetchData = async () => {
    try {
      const [mRes, dRes] = await Promise.all([
        fetch('/api/metrics/overview'),
        fetch('/api/disputes'),
      ]);
      if (mRes.ok) {
        setMetrics(await mRes.json());
      }
      if (dRes.ok) {
        const dJson = await dRes.json();
        setDisputes(dJson.disputes ?? []);
      }
    } catch {
      // handled gracefully
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const filteredDisputes = disputes.filter((d) => {
    if (statusFilter === 'ALL') return true;
    return d.status === statusFilter;
  });

  const handleIngested = async (created: DisputeRecord) => {
    await fetchData();
    if (created?.disputeId) {
      navigate(`/disputes/${created.disputeId}`);
    }
  };

  const hasTrends = (metrics?.totalDisputes ?? 0) > 1;

  return (
    <ConsoleLayout
      breadcrumb="Overview"
      primaryAction={
        <RayLightButton onClick={() => setIntakeOpen(true)} size="sm">
          <Plus className="h-3.5 w-3.5" />
          Ingest Dispute
        </RayLightButton>
      }
    >
      <div className="mx-auto max-w-6xl space-y-8">
        {/* Top KPI Ribbon */}
        <section aria-label="Key metrics">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-lg border border-[#E2D8C8] bg-[#FFFDF9] p-6 shadow-[0_1px_2px_rgba(28,25,23,0.03)]">
              <div className="font-mono text-xs font-semibold text-[#57534E]">Net Recovered</div>
              <div className="mt-2 font-mono text-2xl font-semibold text-[#1C1917] tabular-nums">
                {metrics ? formatInr(metrics.netRevenueRecoveredInr) : '—'}
              </div>
              {hasTrends && metrics && metrics.sparklines.recovery.length > 1 && (
                <div className="mt-4 h-10 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={metrics.sparklines.recovery}>
                      <YAxis hide domain={['auto', 'auto']} />
                      <Tooltip
                        contentStyle={{
                          background: '#FFFDF9',
                          border: '1px solid #E2D8C8',
                          color: '#1C1917',
                          fontSize: '11px',
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey="value"
                        stroke="#059669"
                        strokeWidth={2}
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            <div className="rounded-lg border border-[#E2D8C8] bg-[#FFFDF9] p-6 shadow-[0_1px_2px_rgba(28,25,23,0.03)]">
              <div className="flex items-center justify-between gap-2 font-mono text-xs font-semibold text-[#57534E]">
                <span>Precision / Recall</span>
                <span className="text-[#C2410C]">N=60</span>
              </div>
              <div className="mt-2 font-mono text-2xl font-semibold text-[#1C1917] tabular-nums">
                {metrics ? `${metrics.heldOutPrecision}% / ${metrics.heldOutRecall}%` : '—'}
              </div>
              {hasTrends && metrics && metrics.sparklines.precision.length > 1 && (
                <div className="mt-4 h-10 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={metrics.sparklines.precision}>
                      <YAxis hide domain={[60, 102]} />
                      <Tooltip
                        contentStyle={{
                          background: '#FFFDF9',
                          border: '1px solid #E2D8C8',
                          color: '#1C1917',
                          fontSize: '11px',
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey="value"
                        stroke="#EA580C"
                        strokeWidth={2}
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            <div className="rounded-lg border border-[#E2D8C8] bg-[#FFFDF9] p-6 shadow-[0_1px_2px_rgba(28,25,23,0.03)]">
              <div className="font-mono text-xs font-semibold text-[#57534E]">Penalties Avoided</div>
              <div className="mt-2 font-mono text-2xl font-semibold text-[#1C1917] tabular-nums">
                {metrics ? formatInr(metrics.falsePositivePenaltyAvoidedInr) : '—'}
              </div>
              {hasTrends && metrics && metrics.sparklines.avoided.length > 1 && (
                <div className="mt-4 h-10 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={metrics.sparklines.avoided}>
                      <YAxis hide domain={['auto', 'auto']} />
                      <Tooltip
                        contentStyle={{
                          background: '#FFFDF9',
                          border: '1px solid #E2D8C8',
                          color: '#1C1917',
                          fontSize: '11px',
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey="value"
                        stroke="#D97706"
                        strokeWidth={2}
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            <div className="rounded-lg border border-[#E2D8C8] bg-[#FFFDF9] p-6 shadow-[0_1px_2px_rgba(28,25,23,0.03)]">
              <div className="font-mono text-xs font-semibold text-[#57534E]">Mean Dossier Time</div>
              <div className="mt-2 font-mono text-2xl font-semibold text-[#1C1917] tabular-nums">
                {metrics && metrics.totalDisputes > 0
                  ? `${metrics.meanTimeToDossierSec}s`
                  : '—'}
              </div>
              {hasTrends && metrics && metrics.sparklines.mttd.length > 1 && (
                <div className="mt-4 h-10 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={metrics.sparklines.mttd}>
                      <YAxis hide domain={['auto', 'auto']} />
                      <Tooltip
                        contentStyle={{
                          background: '#FFFDF9',
                          border: '1px solid #E2D8C8',
                          color: '#1C1917',
                          fontSize: '11px',
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey="value"
                        stroke="#EA580C"
                        strokeWidth={2}
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Live Disputes Queue */}
        <section className="rounded-lg border border-[#E2D8C8] bg-[#FFFDF9] shadow-[0_1px_2px_rgba(28,25,23,0.03)]">
          <div className="flex flex-col gap-4 border-b border-[#E2D8C8] p-6 sm:flex-row sm:items-center sm:justify-between">
            <h1 className="text-lg font-medium text-[#1C1917]">Active Disputes</h1>

            <div className="flex flex-wrap items-center gap-1 rounded-lg bg-[#F3EDE2] border border-[#E2D8C8] p-1">
              {[
                { key: 'ALL', label: 'All' },
                { key: 'READY_TO_CONTEST', label: 'Contest' },
                { key: 'HUMAN_REVIEW', label: 'Review' },
                { key: 'AUTO_ACCEPT_LOSS', label: 'Micro-Blocked' },
                { key: 'RECOMMEND_ACCEPT', label: 'Fraud Blocked' },
              ].map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setStatusFilter(tab.key)}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    statusFilter === tab.key
                      ? 'bg-[#EA580C] text-white font-semibold'
                      : 'text-[#57534E] hover:text-[#1C1917]'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="p-14 text-center text-xs text-[#57534E]">
              Loading live dispute ledger...
            </div>
          ) : filteredDisputes.length === 0 ? (
            <div className="px-6 py-16 text-center max-w-md mx-auto space-y-4">
              <h2 className="text-base font-medium text-[#1C1917]">
                {disputes.length === 0 ? 'No Disputes Ingested Yet' : 'No Matching Disputes'}
              </h2>
              <p className="font-serif text-sm text-[#57534E] leading-relaxed">
                {disputes.length === 0
                  ? 'Send signed events to POST /webhooks/razorpay or ingest a dispute case manually to run the defense pipeline.'
                  : 'Adjust the status filter above to view processed disputes.'}
              </p>
              {disputes.length === 0 && (
                <div className="pt-2">
                  <RayLightButton onClick={() => setIntakeOpen(true)} size="sm">
                    <Plus className="h-3.5 w-3.5" />
                    Ingest Dispute
                  </RayLightButton>
                </div>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-[#E2D8C8] bg-[#F3EDE2] font-mono text-[11px] uppercase tracking-wider text-[#57534E]">
                    <th className="px-6 py-3.5">Dispute ID</th>
                    <th className="px-4 py-3.5">Network</th>
                    <th className="px-4 py-3.5 text-right">Amount</th>
                    <th className="px-4 py-3.5 text-right">Win Prob</th>
                    <th className="px-4 py-3.5">Decision</th>
                    <th className="px-4 py-3.5 text-right">MTTD</th>
                    <th className="px-6 py-3.5 text-right">Inspect</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2D8C8]">
                  {filteredDisputes.map((d) => {
                    const meta = getStatusMeta(d.status);
                    return (
                      <tr
                        key={d.disputeId}
                        onClick={() => navigate(`/disputes/${d.disputeId}`)}
                        className="hover:bg-[#F6F1E7] transition-colors cursor-pointer"
                      >
                        <td className="px-6 py-4 font-mono text-xs text-[#1C1917]">
                          <div className="font-medium">{d.disputeId}</div>
                          <div className="text-[11px] text-[#78716C]">{d.paymentId}</div>
                        </td>
                        <td className="px-4 py-4 font-mono text-xs text-[#57534E]">
                          {d.network} · {d.reasonCode}
                        </td>
                        <td className="px-4 py-4 text-right font-mono text-xs font-medium text-[#1C1917] tabular-nums">
                          {formatInrFromPaise(d.amountPaise)}
                        </td>
                        <td className="px-4 py-4 text-right font-mono text-xs text-[#1C1917] tabular-nums">
                          {d.status === 'AUTO_ACCEPT_LOSS'
                            ? 'Skipped'
                            : formatPercent(d.winProbability)}
                        </td>
                        <td className="px-4 py-4">
                          <span
                            className={`inline-block rounded-md border px-2 py-0.5 font-mono text-[11px] font-medium ${meta.textColor} ${meta.borderColor} ${meta.surfaceColor}`}
                          >
                            {meta.label}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-right font-mono text-xs text-[#57534E] tabular-nums">
                          <span className="inline-flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatLatency(d.mttdMs)}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <Link
                            to={`/disputes/${d.disputeId}`}
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center gap-1 text-xs font-medium text-[#C2410C] hover:text-[#1C1917] transition-colors"
                          >
                            Open
                            <ArrowUpRight className="h-3.5 w-3.5" />
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      <DisputeIntakeModal
        open={intakeOpen}
        onClose={() => setIntakeOpen(false)}
        onSuccess={handleIngested}
      />
    </ConsoleLayout>
  );
}
