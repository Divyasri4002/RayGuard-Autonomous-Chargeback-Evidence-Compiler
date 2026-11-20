export type CardNetwork = 'Visa' | 'Mastercard' | 'RuPay';

export type DisputeStatus =
  | 'PROCESSING'
  | 'AUTO_ACCEPT_LOSS'
  | 'READY_TO_CONTEST'
  | 'HUMAN_REVIEW'
  | 'RECOMMEND_ACCEPT'
  | 'SUBMITTED_TO_RAZORPAY';

export type DecisionType = 'DETERMINISTIC' | 'ML_MODEL' | 'LLM_VISION' | 'FALLBACK';

export interface DisputeIngestPayload {
  disputeId: string;
  paymentId: string;
  orderId: string;
  amountInr: number;
  network: CardNetwork;
  reasonCode: string;
  customerName: string;
  customerEmail?: string;
  customerIp: string;
  billingIp: string;
  city?: string;
  deliveryAddress: string;
  gpsCoordinates?: string;
  deviceFingerprint: string;
  knownDeviceFingerprint: string;
  threeDsEci: '05' | '06' | '07';
  accountAgeDays: number;
  priorUndisputedOrders: number;
  awbNumber: string;
  courierPartner: string;
  courierDelivered: boolean;
  simulateCourierTimeout?: boolean;
  supportChatLog?: string;
}

export interface OrderRecord {
  orderId: string;
  paymentId: string;
  amountPaise: number;
  customerName: string;
  customerEmail: string;
  customerIp: string;
  billingIp: string;
  city: string;
  deliveryAddress: string;
  gpsCoordinates: string;
  deliveredAt: string;
  deviceFingerprint: string;
  knownDeviceFingerprint: string;
  threeDsEci: '05' | '06' | '07';
  threeDsAuthenticated: boolean;
  accountAgeDays: number;
  priorUndisputedOrders: number;
  awbNumber: string;
  courierPartner: string;
  courierDelivered: boolean;
  podImageUrl: string;
  supportChatLog: string;
}

export interface ExtractedProof {
  podSignatureValid: boolean;
  deliveryAddressMatched: boolean;
  addressMatchScore: number;
  chatReceiptConfirmed: boolean;
  verbatimChatQuote: string;
  extractionSource: 'GEMINI_VISION' | 'TELEMETRY_FALLBACK' | 'SKIPPED';
  notes: string;
}

export interface AuditLogEntry {
  id: string;
  disputeId: string;
  stepNumber: number;
  nodeName: string;
  decisionType: DecisionType;
  status: 'PASSED' | 'WARNING' | 'BLOCKED';
  summary: string;
  payloadJson: string;
  latencyMs: number;
  timestamp: string;
}

export interface DisputeRecord {
  disputeId: string;
  paymentId: string;
  orderId: string;
  amountPaise: number;
  reasonCode: string;
  network: CardNetwork;
  status: DisputeStatus;
  winProbability: number;
  courierFallbackUsed: boolean;
  netExpectedValuePaise: number;
  falsePositiveSavedPaise: number;
  hmacVerified: boolean;
  hmacSignaturePreview: string;
  mttdMs: number;
  dossierPdfUrl: string;
  rebuttalText: string;
  extractedProof: ExtractedProof | null;
  createdAt: string;
  submittedAt?: string;
  order?: OrderRecord;
  auditLogs?: AuditLogEntry[];
}

export interface PolicyConfig {
  gatewayDisputeFeeInr: number;
  internalOpsCostInr: number;
  autoContestThreshold: number;
  humanReviewFloor: number;
  courierTimeoutMs: number;
  networkTemplates: {
    Visa: string;
    Mastercard: string;
    RuPay: string;
  };
}

export interface HeldOutRow {
  id: string;
  archetype: 'friendly_fraud' | 'true_fraud' | 'micro_dispute' | 'ambiguous';
  amountInr: number;
  ipMatch: boolean;
  deviceMatch: boolean;
  threeDsAuthenticated: boolean;
  accountAgeDays: number;
  priorUndisputedOrders: number;
  podSignatureValid: boolean;
  deliveryAddressMatched: boolean;
  chatReceiptConfirmed: boolean;
  groundTruthWinnable: 0 | 1;
}

export interface HeldOutEvaluationResult {
  threshold: number;
  totalCases: number;
  blockedByCostGate: number;
  precision: number;
  recall: number;
  f1Score: number;
  truePositives: number;
  falsePositives: number;
  trueNegatives: number;
  falseNegatives: number;
  falsePositivePenaltyPerCaseInr: number;
  falsePositiveCostInr: number;
  grossRecoveredInr: number;
  netRecoveredInr: number;
  curve: Array<{
    threshold: number;
    precision: number;
    recall: number;
    falsePositiveCostInr: number;
    netRecoveredInr: number;
  }>;
}

export interface OverviewMetrics {
  netRevenueRecoveredInr: number;
  grossWonVolumeInr: number;
  falsePositivePenaltyAvoidedInr: number;
  meanTimeToDossierSec: number;
  totalDisputes: number;
  contestedCount: number;
  blockedLossCount: number;
  humanReviewCount: number;
  heldOutPrecision: number;
  heldOutRecall: number;
  sparklines: {
    recovery: Array<{ label: string; value: number }>;
    precision: Array<{ label: string; value: number }>;
    avoided: Array<{ label: string; value: number }>;
    mttd: Array<{ label: string; value: number }>;
  };
}
