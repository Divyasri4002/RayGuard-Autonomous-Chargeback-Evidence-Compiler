import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowUpRight, Plus, Search } from 'lucide-react';
import type { DisputeRecord } from '../shared/types';
import { ConsoleLayout } from '../components/ConsoleLayout';
import { DisputeIntakeModal } from '../components/DisputeIntakeModal';
import { RayLightButton } from '../components/RayLightButton';
import {
  formatInrFromPaise,
  formatLatency,
  formatPercent,
  getStatusMeta,
} from '../utils/formatters';

export function DisputesListPage() {
  const navigate = useNavigate();
  const [disputes, setDisputes] = useState<DisputeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [networkFilter, setNetworkFilter] = useState('ALL');
  const [intakeOpen, setIntakeOpen] = useState(false);

  const loadDisputes = () => {
    setLoading(true);
    fetch('/api/disputes')
      .then((res) => res.json())
      .then((data) => setDisputes(data.disputes ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadDisputes();
  }, []);

  const filtered = disputes.filter((d) => {
    const matchesNetwork = networkFilter === 'ALL' || d.network === networkFilter;
    const q = query.trim().toLowerCase();
    const matchesQuery =
      !q ||
      d.disputeId.toLowerCase().includes(q) ||
      d.paymentId.toLowerCase().includes(q) ||
      d.orderId.toLowerCase().includes(q) ||
      (d.order?.customerName.toLowerCase().includes(q) ?? false);
    return matchesNetwork && matchesQuery;
  });

  return (
    <ConsoleLayout
      breadcrumb="Disputes"
      primaryAction={
        <RayLightButton onClick={() => setIntakeOpen(true)} size="sm">
          <Plus className="h-3.5 w-3.5" />
          Ingest Dispute
        </RayLightButton>
      }
    >
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-2xl font-medium text-[#1C1917]">Dispute Queue</h1>

          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#78716C]" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search ID or customer..."
                aria-label="Search disputes"
                className="w-60 rounded-lg border border-[#E2D8C8] bg-[#FFFDF9] py-2 pl-9 pr-3 text-xs text-[#1C1917] placeholder:text-[#A8A29E] focus:border-[#EA580C] focus:outline-none"
              />
            </div>

            <div className="flex items-center gap-1 rounded-lg border border-[#E2D8C8] bg-[#F3EDE2] p-1">
              {['ALL', 'Visa', 'Mastercard', 'RuPay'].map((net) => (
                <button
                  key={net}
                  type="button"
                  onClick={() => setNetworkFilter(net)}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                    networkFilter === net
                      ? 'bg-[#EA580C] text-white font-semibold'
                      : 'text-[#57534E] hover:text-[#1C1917]'
                  }`}
                >
                  {net}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-[#E2D8C8] bg-[#FFFDF9] overflow-hidden shadow-[0_1px_2px_rgba(28,25,23,0.03)]">
          {loading ? (
            <div className="py-16 text-center text-xs text-[#57534E]">Loading disputes...</div>
          ) : filtered.length === 0 ? (
            <div className="px-6 py-16 text-center max-w-md mx-auto space-y-4">
              <h2 className="text-base font-medium text-[#1C1917]">
                {disputes.length === 0 ? 'Queue Empty' : 'No Matching Disputes'}
              </h2>
              <p className="font-serif text-sm text-[#57534E] leading-relaxed">
                {disputes.length === 0
                  ? 'Ingest a Razorpay dispute payload to compile telemetry, verification nodes, and rebuttal evidence.'
                  : 'Try clearing the search term or network filter.'}
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
                    <th className="px-6 py-3.5">Dispute / Order</th>
                    <th className="px-4 py-3.5">Cardholder</th>
                    <th className="px-4 py-3.5">Network</th>
                    <th className="px-4 py-3.5 text-right">Amount</th>
                    <th className="px-4 py-3.5 text-right">Win Prob</th>
                    <th className="px-4 py-3.5">Status</th>
                    <th className="px-4 py-3.5 text-right">MTTD</th>
                    <th className="px-6 py-3.5 text-right">Open</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2D8C8]">
                  {filtered.map((d) => {
                    const meta = getStatusMeta(d.status);
                    return (
                      <tr
                        key={d.disputeId}
                        onClick={() => navigate(`/disputes/${d.disputeId}`)}
                        className="hover:bg-[#F6F1E7] transition-colors cursor-pointer"
                      >
                        <td className="px-6 py-4 font-mono text-xs">
                          <div className="text-[#1C1917] font-medium">{d.disputeId}</div>
                          <div className="text-[11px] text-[#78716C]">{d.orderId}</div>
                        </td>
                        <td className="px-4 py-4 text-xs text-[#1C1917]">
                          <div>{d.order?.customerName ?? '—'}</div>
                          <div className="font-mono text-[11px] text-[#78716C]">
                            {d.order?.city ?? ''}
                          </div>
                        </td>
                        <td className="px-4 py-4 font-mono text-xs text-[#57534E]">
                          {d.network} · {d.reasonCode}
                        </td>
                        <td className="px-4 py-4 text-right font-mono text-xs font-medium text-[#1C1917] tabular-nums">
                          {formatInrFromPaise(d.amountPaise)}
                        </td>
                        <td className="px-4 py-4 text-right font-mono text-xs text-[#1C1917] tabular-nums">
                          {d.status === 'AUTO_ACCEPT_LOSS'
                            ? 'Gate Stop'
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
                          {formatLatency(d.mttdMs)}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <Link
                            to={`/disputes/${d.disputeId}`}
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center gap-1 text-xs font-medium text-[#C2410C] hover:text-[#1C1917]"
                          >
                            Inspect
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
        </div>
      </div>

      <DisputeIntakeModal
        open={intakeOpen}
        onClose={() => setIntakeOpen(false)}
        onSuccess={(created) => {
          loadDisputes();
          navigate(`/disputes/${created.disputeId}`);
        }}
      />
    </ConsoleLayout>
  );
}
