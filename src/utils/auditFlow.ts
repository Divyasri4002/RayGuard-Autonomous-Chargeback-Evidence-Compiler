import type { AuditLogEntry, DecisionType } from '../shared/types';

export interface AuditFlowSummary {
  totalLatencyMs: number;
  passedCount: number;
  warningCount: number;
  blockedCount: number;
  slowestStepId: string | null;
}

export interface NodeVisualMeta {
  statusLabel: string;
  statusTextClass: string;
  statusBorderClass: string;
  statusSurfaceClass: string;
  markerBorderClass: string;
  markerBgClass: string;
  barColorClass: string;
  decisionLabel: string;
  decisionClass: string;
}

export function computeAuditFlowSummary(logs: AuditLogEntry[]): AuditFlowSummary {
  let totalLatencyMs = 0;
  let passedCount = 0;
  let warningCount = 0;
  let blockedCount = 0;
  let slowestStepId: string | null = null;
  let maxLatency = -1;

  for (const log of logs) {
    totalLatencyMs += log.latencyMs;
    if (log.status === 'PASSED') passedCount++;
    else if (log.status === 'WARNING') warningCount++;
    else blockedCount++;

    if (log.latencyMs > maxLatency) {
      maxLatency = log.latencyMs;
      slowestStepId = log.id;
    }
  }

  return {
    totalLatencyMs,
    passedCount,
    warningCount,
    blockedCount,
    slowestStepId,
  };
}

export function getLatencySharePercent(latencyMs: number, totalLatencyMs: number): number {
  if (totalLatencyMs <= 0) return 0;
  return Math.max(2, Math.min(100, Math.round((latencyMs / totalLatencyMs) * 100)));
}

export function getDecisionTypeMeta(decisionType: DecisionType): {
  label: string;
  colorClass: string;
} {
  switch (decisionType) {
    case 'DETERMINISTIC':
      return { label: 'DETERMINISTIC', colorClass: 'text-[#57534E] border-[#E2D8C8] bg-[#F3EDE2]' };
    case 'LLM_VISION':
      return { label: 'LLM VISION', colorClass: 'text-[#C2410C] border-orange-300 bg-orange-50' };
    case 'ML_MODEL':
      return { label: 'ML SCORER', colorClass: 'text-sky-800 border-sky-300 bg-sky-50' };
    case 'FALLBACK':
      return { label: 'FALLBACK', colorClass: 'text-amber-800 border-amber-300 bg-amber-50' };
  }
}

export function getAuditNodeVisualMeta(
  status: AuditLogEntry['status'],
  decisionType: DecisionType
): NodeVisualMeta {
  const decision = getDecisionTypeMeta(decisionType);
  if (status === 'PASSED') {
    return {
      statusLabel: 'PASSED',
      statusTextClass: 'text-emerald-800',
      statusBorderClass: 'border-emerald-300',
      statusSurfaceClass: 'bg-emerald-50',
      markerBorderClass: 'border-emerald-400',
      markerBgClass: 'bg-emerald-50 text-emerald-800',
      barColorClass: 'bg-emerald-600',
      decisionLabel: decision.label,
      decisionClass: decision.colorClass,
    };
  }
  if (status === 'WARNING') {
    return {
      statusLabel: 'WARNING',
      statusTextClass: 'text-amber-800',
      statusBorderClass: 'border-amber-300',
      statusSurfaceClass: 'bg-amber-50',
      markerBorderClass: 'border-amber-400',
      markerBgClass: 'bg-amber-50 text-amber-800',
      barColorClass: 'bg-amber-500',
      decisionLabel: decision.label,
      decisionClass: decision.colorClass,
    };
  }
  return {
    statusLabel: 'BLOCKED',
    statusTextClass: 'text-rose-800',
    statusBorderClass: 'border-rose-300',
    statusSurfaceClass: 'bg-rose-50',
    markerBorderClass: 'border-rose-400',
    markerBgClass: 'bg-rose-50 text-rose-800',
    barColorClass: 'bg-rose-600',
    decisionLabel: decision.label,
    decisionClass: decision.colorClass,
  };
}

export function formatPayloadJson(raw: string): string {
  try {
    return JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    return raw;
  }
}
