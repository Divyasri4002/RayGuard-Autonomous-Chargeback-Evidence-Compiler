import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowDown,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Copy,
  GitBranch,
  ShieldAlert,
} from 'lucide-react';
import type { AuditLogEntry } from '../shared/types';
import {
  computeAuditFlowSummary,
  formatPayloadJson,
  getAuditNodeVisualMeta,
  getLatencySharePercent,
} from '../utils/auditFlow';
import { formatLatency } from '../utils/formatters';

interface AuditFlowTimelineProps {
  logs: AuditLogEntry[];
}

type StatusFilter = 'ALL' | 'ATTENTION' | 'PASSED';

export function AuditFlowTimeline({ logs }: AuditFlowTimelineProps) {
  const summary = useMemo(() => computeAuditFlowSummary(logs), [logs]);

  const [selectedId, setSelectedId] = useState<string | null>(() => {
    const firstAttention = logs.find((l) => l.status !== 'PASSED');
    return firstAttention?.id ?? logs[0]?.id ?? null;
  });

  const [expandedMap, setExpandedMap] = useState<Record<string, boolean>>(() => {
    const firstAttention = logs.find((l) => l.status !== 'PASSED');
    const initialId = firstAttention?.id ?? logs[0]?.id;
    return initialId ? { [initialId]: true } : {};
  });

  const [filter, setFilter] = useState<StatusFilter>('ALL');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const filteredLogs = useMemo(() => {
    if (filter === 'ALL') return logs;
    if (filter === 'ATTENTION') return logs.filter((l) => l.status !== 'PASSED');
    return logs.filter((l) => l.status === 'PASSED');
  }, [logs, filter]);

  const allExpanded =
    filteredLogs.length > 0 && filteredLogs.every((l) => Boolean(expandedMap[l.id]));

  const toggleNode = (nodeId: string) => {
    setSelectedId(nodeId);
    setExpandedMap((prev) => ({ ...prev, [nodeId]: !prev[nodeId] }));
  };

  const handleSelectMiniNode = (nodeId: string) => {
    setFilter('ALL');
    setSelectedId(nodeId);
    setExpandedMap((prev) => ({ ...prev, [nodeId]: true }));
  };

  const handleToggleAll = () => {
    if (allExpanded) {
      setExpandedMap({});
    } else {
      const next: Record<string, boolean> = {};
      for (const item of filteredLogs) {
        next[item.id] = true;
      }
      setExpandedMap(next);
    }
  };

  const handleCopyJson = async (nodeId: string, payloadJson: string) => {
    try {
      await navigator.clipboard.writeText(formatPayloadJson(payloadJson));
      setCopiedId(nodeId);
      setTimeout(() => setCopiedId((prev) => (prev === nodeId ? null : prev)), 1500);
    } catch {
      // Clipboard unavailable
    }
  };

  if (logs.length === 0) {
    return (
      <section
        aria-label="Execution DAG and Audit Trail"
        className="rounded-lg border border-[#E2D8C8] bg-[#FFFDF9] p-6"
      >
        <div className="flex items-center justify-between border-b border-[#E2D8C8] pb-3">
          <h2 className="text-sm font-semibold text-[#1C1917] flex items-center gap-2">
            <GitBranch className="h-4 w-4 text-[#EA580C]" />
            Execution Flow
          </h2>
        </div>
        <div className="py-10 text-center text-xs text-[#57534E]">
          No audit nodes recorded.
        </div>
      </section>
    );
  }

  return (
    <section
      aria-label="Execution DAG and Audit Trail"
      className="rounded-lg border border-[#E2D8C8] bg-[#FFFDF9] p-6 flex flex-col"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E2D8C8] pb-3.5">
        <h2 className="text-sm font-semibold text-[#1C1917] flex items-center gap-2">
          <GitBranch className="h-4 w-4 text-[#EA580C]" />
          Execution Flow
        </h2>
        <div className="flex items-center gap-3 font-mono text-xs tabular-nums">
          <span className="text-[#57534E]">{logs.length} Nodes</span>
          <span className="text-[#C2410C] font-semibold">
            {formatLatency(summary.totalLatencyMs)}
          </span>
        </div>
      </div>

      {/* Node Minimap */}
      <div className="mt-4 rounded-lg border border-[#E2D8C8] bg-[#F3EDE2] p-3">
        <div
          className="grid grid-cols-3 gap-1.5"
          role="list"
          aria-label="Pipeline nodes graphical strip"
        >
          {logs.map((log, idx) => {
            const visual = getAuditNodeVisualMeta(log.status, log.decisionType);
            const isSelected = selectedId === log.id;
            return (
              <div key={log.id} className="flex items-center gap-1 min-w-0" role="listitem">
                <button
                  type="button"
                  onClick={() => handleSelectMiniNode(log.id)}
                  title={`Step 0${log.stepNumber}: ${log.nodeName} (${formatLatency(log.latencyMs)})`}
                  aria-label={`Jump to step ${log.stepNumber}: ${log.nodeName}`}
                  className={`flex flex-1 min-w-0 items-center justify-between gap-1 rounded-md border px-2 py-1 font-mono text-[11px] transition-all cursor-pointer ${
                    isSelected
                      ? 'border-[#EA580C] bg-orange-100 text-[#1C1917]'
                      : `${visual.statusBorderClass} ${visual.statusSurfaceClass} ${visual.statusTextClass} hover:border-[#C2410C]`
                  }`}
                >
                  <span className="font-semibold shrink-0">0{log.stepNumber}</span>
                  <span className="tabular-nums text-[10px] opacity-85 truncate">
                    {formatLatency(log.latencyMs)}
                  </span>
                </button>
                {idx % 3 !== 2 && idx < logs.length - 1 && (
                  <ArrowRight className="h-3 w-3 text-[#A8A29E] shrink-0" aria-hidden="true" />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Filter & Expand Controls */}
      <div className="mt-3.5 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1 rounded-lg bg-[#F3EDE2] border border-[#E2D8C8] p-0.5">
          {[
            { key: 'ALL' as const, label: `All (${logs.length})` },
            {
              key: 'ATTENTION' as const,
              label: `Alerts (${summary.warningCount + summary.blockedCount})`,
            },
            { key: 'PASSED' as const, label: `Passed (${summary.passedCount})` },
          ].map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setFilter(tab.key)}
              className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors cursor-pointer whitespace-nowrap ${
                filter === tab.key
                  ? 'bg-[#EA580C] text-white font-semibold'
                  : 'text-[#57534E] hover:text-[#1C1917]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={handleToggleAll}
          className="font-mono text-[11px] text-[#57534E] hover:text-[#1C1917] transition-colors cursor-pointer whitespace-nowrap"
        >
          {allExpanded ? 'Collapse All' : 'Expand All'}
        </button>
      </div>

      {/* Vertical Step Timeline */}
      <div className="mt-4 space-y-0">
        {filteredLogs.length === 0 ? (
          <div className="rounded-lg border border-[#E2D8C8] bg-[#F3EDE2] p-6 text-center text-xs text-[#57534E]">
            No nodes match the filter.
          </div>
        ) : (
          filteredLogs.map((log, index) => {
            const isExpanded = Boolean(expandedMap[log.id]);
            const isSelected = selectedId === log.id;
            const visual = getAuditNodeVisualMeta(log.status, log.decisionType);
            const latencyShare = getLatencySharePercent(log.latencyMs, summary.totalLatencyMs);
            const isLast = index === filteredLogs.length - 1;

            const StatusIcon =
              log.status === 'PASSED'
                ? CheckCircle2
                : log.status === 'WARNING'
                  ? AlertTriangle
                  : ShieldAlert;

            return (
              <div key={log.id} className="relative flex gap-3">
                <div className="flex flex-col items-center pt-3">
                  <div
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md border font-mono text-xs font-semibold tabular-nums transition-colors ${
                      isSelected
                        ? 'border-[#EA580C] bg-orange-50 text-[#C2410C]'
                        : `${visual.markerBorderClass} ${visual.markerBgClass}`
                    }`}
                  >
                    0{log.stepNumber}
                  </div>
                  {!isLast && (
                    <div className="my-1 flex flex-1 flex-col items-center">
                      <div className="w-px flex-1 bg-[#E2D8C8]" />
                      <ArrowDown className="h-3 w-3 text-[#A8A29E] shrink-0" aria-hidden="true" />
                    </div>
                  )}
                </div>

                <div className={`min-w-0 flex-1 ${isLast ? '' : 'pb-3.5'}`}>
                  <div
                    className={`rounded-lg border transition-colors ${
                      isSelected
                        ? 'border-[#EA580C] bg-[#FBF8F3]'
                        : 'border-[#E2D8C8] bg-[#FBF8F3]'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => toggleNode(log.id)}
                      aria-expanded={isExpanded}
                      className="flex w-full items-start justify-between gap-2 p-3.5 text-left cursor-pointer"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs font-semibold text-[#1C1917]">{log.nodeName}</span>
                          <span
                            className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 font-mono text-[10px] font-semibold ${visual.statusTextClass} ${visual.statusBorderClass} ${visual.statusSurfaceClass}`}
                          >
                            <StatusIcon className="h-3 w-3 shrink-0" />
                            {visual.statusLabel}
                          </span>
                        </div>

                        <div className="mt-2 flex flex-wrap items-center gap-2 font-mono text-[10px]">
                          <span className={`rounded border px-1.5 py-0.5 font-medium ${visual.decisionClass}`}>
                            {visual.decisionLabel}
                          </span>
                          <span className="inline-flex items-center gap-1 rounded border border-[#E2D8C8] bg-[#FFFDF9] px-1.5 py-0.5 text-[#1C1917] tabular-nums">
                            <Clock className="h-3 w-3 text-[#EA580C]" />
                            {formatLatency(log.latencyMs)}
                            <span className="text-[#78716C]">({latencyShare}%)</span>
                          </span>
                        </div>

                        <div
                          className="mt-2 h-1 w-full overflow-hidden rounded-full bg-[#E2D8C8]"
                          aria-hidden="true"
                        >
                          <div
                            className={`h-full rounded-full ${visual.barColorClass}`}
                            style={{ width: `${latencyShare}%` }}
                          />
                        </div>
                      </div>

                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4 shrink-0 text-[#57534E] mt-0.5" />
                      ) : (
                        <ChevronRight className="h-4 w-4 shrink-0 text-[#57534E] mt-0.5" />
                      )}
                    </button>

                    <div className="px-3.5 pb-3 text-xs text-[#57534E] leading-relaxed">
                      {log.summary}
                    </div>

                    {isExpanded && (
                      <div className="border-t border-[#E2D8C8] bg-[#F3EDE2] p-3 rounded-b-lg">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="font-mono text-[10px] uppercase tracking-wider text-[#57534E]">
                            Payload JSON
                          </span>
                          <button
                            type="button"
                            onClick={() => handleCopyJson(log.id, log.payloadJson)}
                            className="inline-flex items-center gap-1 font-mono text-[10px] text-[#57534E] hover:text-[#1C1917] transition-colors cursor-pointer"
                          >
                            {copiedId === log.id ? (
                              <>
                                <Check className="h-3 w-3 text-emerald-700" />
                                <span className="text-emerald-700">Copied</span>
                              </>
                            ) : (
                              <>
                                <Copy className="h-3 w-3" />
                                <span>Copy</span>
                              </>
                            )}
                          </button>
                        </div>
                        <pre className="overflow-x-auto font-mono text-[11px] text-[#1C1917] whitespace-pre-wrap break-words leading-relaxed">
                          {formatPayloadJson(log.payloadJson)}
                        </pre>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}
