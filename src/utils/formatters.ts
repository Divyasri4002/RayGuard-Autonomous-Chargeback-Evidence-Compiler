import type { DisputeStatus } from '../shared/types';

export function formatInrFromPaise(paise: number): string {
  const inr = paise / 100;
  return `₹${inr.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

export function formatInr(amountInr: number): string {
  return `₹${Math.round(amountInr).toLocaleString('en-IN')}`;
}

export function formatPercent(prob: number, decimals = 1): string {
  return `${(prob * 100).toFixed(decimals)}%`;
}

export function formatLatency(ms: number): string {
  if (ms >= 1000) {
    return `${(ms / 1000).toFixed(2)}s`;
  }
  return `${Math.round(ms)}ms`;
}

export interface StatusMeta {
  label: string;
  textColor: string;
  borderColor: string;
  surfaceColor: string;
}

export function getStatusMeta(status: DisputeStatus): StatusMeta {
  switch (status) {
    case 'READY_TO_CONTEST':
      return {
        label: 'Ready to Contest',
        textColor: 'text-emerald-800',
        borderColor: 'border-emerald-300',
        surfaceColor: 'bg-emerald-50',
      };
    case 'SUBMITTED_TO_RAZORPAY':
      return {
        label: 'Submitted',
        textColor: 'text-[#C2410C]',
        borderColor: 'border-orange-300',
        surfaceColor: 'bg-orange-50',
      };
    case 'HUMAN_REVIEW':
      return {
        label: 'Human Review',
        textColor: 'text-amber-800',
        borderColor: 'border-amber-300',
        surfaceColor: 'bg-amber-50',
      };
    case 'AUTO_ACCEPT_LOSS':
      return {
        label: 'Micro-Blocked',
        textColor: 'text-rose-800',
        borderColor: 'border-rose-300',
        surfaceColor: 'bg-rose-50',
      };
    case 'RECOMMEND_ACCEPT':
      return {
        label: 'Fraud Blocked',
        textColor: 'text-rose-800',
        borderColor: 'border-rose-300',
        surfaceColor: 'bg-rose-50',
      };
    default:
      return {
        label: 'Processing',
        textColor: 'text-[#57534E]',
        borderColor: 'border-[#E2D8C8]',
        surfaceColor: 'bg-[#F3EDE2]',
      };
  }
}
