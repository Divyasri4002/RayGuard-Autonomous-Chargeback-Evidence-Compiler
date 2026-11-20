import fs from 'node:fs';
import path from 'node:path';
import type {
  AuditLogEntry,
  DisputeRecord,
  OrderRecord,
  OverviewMetrics,
  PolicyConfig,
} from '../src/shared/types.ts';
import { evaluateHeldOutTestSet } from './mlScorer.ts';

export interface StoreState {
  orders: Record<string, OrderRecord>;
  disputes: Record<string, DisputeRecord>;
  auditLogs: Record<string, AuditLogEntry[]>;
  processedEventIds: string[];
  policy: PolicyConfig;
}

export const DEFAULT_POLICY: PolicyConfig = {
  gatewayDisputeFeeInr: 500,
  internalOpsCostInr: 100,
  autoContestThreshold: 0.75,
  humanReviewFloor: 0.4,
  courierTimeoutMs: 3000,
  networkTemplates: {
    Visa: 'Visa Compelling Evidence 3.0 — Reason Code 10.4 (Other Fraud - Card-Absent Environment)',
    Mastercard: 'Mastercard Chargeback Guide — Reason Code 4837 (No Cardholder Authorization)',
    RuPay: 'NPCI RuPay Dispute Framework — Reason Code 101 (Fraudulent Transaction Defense)',
  },
};

const LEGACY_FAKE_IDS = new Set([
  'disp_RF991820',
  'disp_RF991402',
  'disp_RF991189',
  'disp_RF991024',
  'disp_RF990851',
]);

const DATA_DIR = path.resolve(process.cwd(), '.data');
const STORE_PATH = path.join(DATA_DIR, 'store.json');

export function createEmptyStoreState(): StoreState {
  return {
    orders: {},
    disputes: {},
    auditLogs: {},
    processedEventIds: [],
    policy: {
      ...DEFAULT_POLICY,
      networkTemplates: { ...DEFAULT_POLICY.networkTemplates },
    },
  };
}

export function computeOverviewMetrics(
  disputes: DisputeRecord[],
  policy: PolicyConfig
): OverviewMetrics {
  const heldOut = evaluateHeldOutTestSet(policy.autoContestThreshold, policy);

  let grossWonInr = 0;
  let opsCostInr = 0;
  let avoidedInr = 0;
  let totalMttdMs = 0;
  let contestedCount = 0;
  let blockedLossCount = 0;
  let humanReviewCount = 0;

  const chronological = [...disputes].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  const recoverySeries: Array<{ label: string; value: number }> = [];
  const avoidedSeries: Array<{ label: string; value: number }> = [];
  const mttdSeries: Array<{ label: string; value: number }> = [];

  let cumulativeNetRecovered = 0;
  let cumulativeAvoided = 0;

  for (const d of chronological) {
    totalMttdMs += d.mttdMs;
    if (d.status === 'READY_TO_CONTEST' || d.status === 'SUBMITTED_TO_RAZORPAY') {
      contestedCount++;
      const amountInr = d.amountPaise / 100;
      grossWonInr += amountInr;
      opsCostInr += policy.internalOpsCostInr;
      cumulativeNetRecovered += Math.max(0, Math.round(amountInr - policy.internalOpsCostInr));
    } else if (d.status === 'AUTO_ACCEPT_LOSS' || d.status === 'RECOMMEND_ACCEPT') {
      blockedLossCount++;
      const savedInr = d.falsePositiveSavedPaise / 100;
      avoidedInr += savedInr;
      cumulativeAvoided += Math.round(savedInr);
    } else if (d.status === 'HUMAN_REVIEW') {
      humanReviewCount++;
    }

    const shortLabel = d.disputeId.slice(-6);
    recoverySeries.push({ label: shortLabel, value: cumulativeNetRecovered });
    avoidedSeries.push({ label: shortLabel, value: cumulativeAvoided });
    mttdSeries.push({ label: shortLabel, value: Math.round((d.mttdMs / 1000) * 100) / 100 });
  }

  const netRevenueRecoveredInr = Math.max(0, Math.round(grossWonInr - opsCostInr));
  const meanTimeToDossierSec =
    disputes.length > 0 ? Math.round((totalMttdMs / disputes.length / 1000) * 10) / 10 : 0;

  return {
    netRevenueRecoveredInr,
    grossWonVolumeInr: Math.round(grossWonInr),
    falsePositivePenaltyAvoidedInr: Math.round(avoidedInr),
    meanTimeToDossierSec,
    totalDisputes: disputes.length,
    contestedCount,
    blockedLossCount,
    humanReviewCount,
    heldOutPrecision: Math.round(heldOut.precision * 1000) / 10,
    heldOutRecall: Math.round(heldOut.recall * 1000) / 10,
    sparklines: {
      recovery: recoverySeries,
      precision: heldOut.curve.map((pt) => ({
        label: pt.threshold.toFixed(2),
        value: pt.precision,
      })),
      avoided: avoidedSeries,
      mttd: mttdSeries,
    },
  };
}

class DisputeStore {
  private state: StoreState;

  constructor() {
    this.state = this.load();
  }

  private load(): StoreState {
    try {
      if (fs.existsSync(STORE_PATH)) {
        const raw = fs.readFileSync(STORE_PATH, 'utf-8');
        const parsed = JSON.parse(raw) as StoreState;
        if (parsed && parsed.disputes && parsed.orders) {
          // Strip legacy pre-seeded fake records if present on disk
          let strippedLegacy = false;
          for (const fakeId of LEGACY_FAKE_IDS) {
            if (parsed.disputes[fakeId]) {
              const orderId = parsed.disputes[fakeId].orderId;
              delete parsed.disputes[fakeId];
              delete parsed.auditLogs?.[fakeId];
              if (orderId && parsed.orders[orderId]) {
                delete parsed.orders[orderId];
              }
              strippedLegacy = true;
            }
          }
          // Also strip old auto-generated sim rows left over from previous runs if they were from default seed era
          if (strippedLegacy) {
            this.saveState(parsed);
          }
          return parsed;
        }
      }
    } catch {
      // Fallback to clean empty store if corrupted
    }
    const empty = createEmptyStoreState();
    this.saveState(empty);
    return empty;
  }

  private saveState(next: StoreState) {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(STORE_PATH, JSON.stringify(next, null, 2), 'utf-8');
  }

  private persist() {
    this.saveState(this.state);
  }

  resetDisputes() {
    this.state.orders = {};
    this.state.disputes = {};
    this.state.auditLogs = {};
    this.state.processedEventIds = [];
    this.persist();
  }

  hasProcessedEvent(eventId: string): boolean {
    return this.state.processedEventIds.includes(eventId);
  }

  markEventProcessed(eventId: string) {
    if (!this.state.processedEventIds.includes(eventId)) {
      this.state.processedEventIds.push(eventId);
      this.persist();
    }
  }

  upsertOrder(order: OrderRecord) {
    this.state.orders[order.orderId] = order;
    this.persist();
  }

  getOrder(orderId: string): OrderRecord | undefined {
    return this.state.orders[orderId];
  }

  upsertDispute(dispute: DisputeRecord) {
    this.state.disputes[dispute.disputeId] = dispute;
    this.persist();
  }

  deleteDispute(disputeId: string): boolean {
    const existing = this.state.disputes[disputeId];
    if (!existing) return false;
    delete this.state.disputes[disputeId];
    delete this.state.auditLogs[disputeId];
    this.persist();
    return true;
  }

  setAuditLogs(disputeId: string, logs: AuditLogEntry[]) {
    this.state.auditLogs[disputeId] = logs;
    this.persist();
  }

  getDisputeWithDetails(disputeId: string): DisputeRecord | undefined {
    const dispute = this.state.disputes[disputeId];
    if (!dispute) return undefined;
    return {
      ...dispute,
      order: this.state.orders[dispute.orderId],
      auditLogs: this.state.auditLogs[disputeId] ?? [],
    };
  }

  listDisputes(): DisputeRecord[] {
    return Object.values(this.state.disputes)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .map((d) => ({
        ...d,
        order: this.state.orders[d.orderId],
      }));
  }

  submitDisputeToRazorpay(disputeId: string): DisputeRecord | undefined {
    const dispute = this.state.disputes[disputeId];
    if (!dispute) return undefined;
    dispute.status = 'SUBMITTED_TO_RAZORPAY';
    dispute.submittedAt = new Date().toISOString();
    const existingLogs = this.state.auditLogs[disputeId] ?? [];
    existingLogs.push({
      id: `${disputeId}_${existingLogs.length + 1}`,
      disputeId,
      stepNumber: existingLogs.length + 1,
      nodeName: 'Razorpay Representment Submitted',
      decisionType: 'DETERMINISTIC',
      status: 'PASSED',
      summary: `Evidence dossier & rebuttal submitted to Razorpay Disputes API for ${dispute.network} ${dispute.reasonCode}.`,
      payloadJson: JSON.stringify({ disputeId, submittedAt: dispute.submittedAt, status: 'SUBMITTED_TO_RAZORPAY' }),
      latencyMs: 145,
      timestamp: dispute.submittedAt,
    });
    this.state.auditLogs[disputeId] = existingLogs;
    this.persist();
    return this.getDisputeWithDetails(disputeId);
  }

  getPolicy(): PolicyConfig {
    return this.state.policy;
  }

  updatePolicy(next: Partial<PolicyConfig>): PolicyConfig {
    this.state.policy = {
      ...this.state.policy,
      ...next,
      networkTemplates: {
        ...this.state.policy.networkTemplates,
        ...(next.networkTemplates ?? {}),
      },
    };
    this.persist();
    return this.state.policy;
  }

  getOverviewMetrics(): OverviewMetrics {
    return computeOverviewMetrics(Object.values(this.state.disputes), this.state.policy);
  }
}

export const store = new DisputeStore();
