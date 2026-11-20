import React, { useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  LogIn,
  PackageCheck,
  Send,
  Trash2,
} from 'lucide-react';
import type { User } from 'firebase/auth';
import type { DisputeRecord, OrderRecord, PolicyConfig } from '../../shared/types';
import { AuditFlowTimeline } from '../AuditFlowTimeline';
import { DossierPreview } from '../DossierPreview';
import { RayLightButton } from '../RayLightButton';
import { WinProbGauge } from '../WinProbGauge';
import { formatInrFromPaise } from '../../utils/formatters';

export interface AnalystNoteDoc {
  id: string;
  uid: string;
  disputeId: string;
  note: string;
  decisionOverride: 'NONE' | 'CONTEST' | 'ACCEPT' | 'ESCALATE';
  createdAt?: { toDate?: () => Date } | null;
}

interface TelemetryPageViewProps {
  dispute: DisputeRecord;
  order: OrderRecord;
  policy: PolicyConfig | null;
}

export function TelemetryPageView({ dispute, order, policy }: TelemetryPageViewProps) {
  const ipMatch = order.customerIp === order.billingIp;
  const deviceMatch = order.deviceFingerprint === order.knownDeviceFingerprint;
  const autoContestThreshold = policy?.autoContestThreshold ?? 0.75;
  const humanReviewFloor = policy?.humanReviewFloor ?? 0.4;

  const verdictDescription =
    dispute.status === 'AUTO_ACCEPT_LOSS'
      ? `Blocked at deterministic cost gate because dispute value (${formatInrFromPaise(dispute.amountPaise)}) does not clear gateway and ops fees.`
      : dispute.winProbability >= autoContestThreshold
        ? `Exceeds ${(autoContestThreshold * 100).toFixed(0)}% auto-contest confidence threshold. Dossier cleared for bank representment.`
        : dispute.winProbability >= humanReviewFloor
          ? `Falls within ${(humanReviewFloor * 100).toFixed(0)}–${(autoContestThreshold * 100).toFixed(0)}% analyst review band prior to submission.`
          : `Below ${(humanReviewFloor * 100).toFixed(0)}% floor; representment is withheld to avoid false-positive penalty losses.`;

  const formattedAddress =
    order.city && !order.deliveryAddress.includes(order.city)
      ? `${order.deliveryAddress}, ${order.city}`
      : order.deliveryAddress;

  return (
    <div className="space-y-6">
      <section
        aria-label="Win Probability and Decision Rationale"
        className="rounded-lg border border-[#E2D8C8] bg-[#FFFDF9] p-6"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E2D8C8] pb-4">
          <div>
            <h1 className="text-lg font-semibold text-[#1C1917]">01. Case Telemetry &amp; Score</h1>
            <p className="mt-0.5 text-xs text-[#57534E]">
              Calibrated win probability, threshold band routing, and cardholder identity continuity.
            </p>
          </div>
          <span className="font-mono text-xs text-[#57534E]">{order.customerName}</span>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-8 md:grid-cols-12 items-center">
          <div className="md:col-span-5">
            <WinProbGauge
              probability={dispute.winProbability}
              autoContestThreshold={autoContestThreshold}
              humanReviewFloor={humanReviewFloor}
            />
          </div>

          <div className="md:col-span-7 space-y-5">
            <div>
              <div className="font-mono text-[11px] uppercase tracking-wider text-[#C2410C]">
                Decision Rationale
              </div>
              <p className="mt-1.5 font-serif text-sm text-[#1C1917] leading-relaxed">
                {verdictDescription}
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 border-t border-[#E2D8C8] pt-4 font-mono text-xs tabular-nums">
              <div>
                <div className="text-[11px] text-[#57534E]">Dispute Amount</div>
                <div className="mt-0.5 font-semibold text-[#1C1917]">
                  {formatInrFromPaise(dispute.amountPaise)}
                </div>
              </div>
              <div>
                <div className="text-[11px] text-[#57534E]">Contest Cost Floor</div>
                <div className="mt-0.5 font-semibold text-[#1C1917]">
                  {formatInrFromPaise(
                    ((policy?.gatewayDisputeFeeInr ?? 500) +
                      (policy?.internalOpsCostInr ?? 100)) *
                      100
                  )}
                </div>
              </div>
              <div>
                <div className="text-[11px] text-[#57534E]">Network Rulebook</div>
                <div className="mt-0.5 font-semibold text-[#1C1917]">
                  {dispute.network} · {dispute.reasonCode}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section
        aria-label="Transaction and Identity Matrix"
        className="rounded-lg border border-[#E2D8C8] bg-[#FFFDF9] p-6"
      >
        <div className="border-b border-[#E2D8C8] pb-3.5">
          <h2 className="text-sm font-semibold text-[#1C1917]">Transaction &amp; Identity Matrix</h2>
        </div>

        <dl className="mt-2 divide-y divide-[#E2D8C8] text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2 py-3.5">
            <dt className="text-[#57534E]">Cardholder</dt>
            <dd className="font-mono text-xs font-medium text-[#1C1917]">{order.customerName}</dd>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 py-3.5">
            <dt className="text-[#57534E]">Delivery Address</dt>
            <dd className="font-mono text-xs text-[#1C1917] text-right">{formattedAddress}</dd>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 py-3.5">
            <dt className="text-[#57534E]">Order / Billing IP</dt>
            <dd className="font-mono text-xs text-right">
              <span className="text-[#1C1917]">{order.customerIp}</span>
              <span className="mx-1.5 text-[#A8A29E]">/</span>
              <span className={ipMatch ? 'text-emerald-700 font-semibold' : 'text-rose-700 font-semibold'}>
                {ipMatch ? 'Match' : `Mismatch (${order.billingIp})`}
              </span>
            </dd>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 py-3.5">
            <dt className="text-[#57534E]">Device Fingerprint</dt>
            <dd
              className={`font-mono text-xs font-semibold ${
                deviceMatch ? 'text-emerald-700' : 'text-rose-700'
              }`}
            >
              {order.deviceFingerprint} · {deviceMatch ? 'Known Device' : 'Unrecognized Device'}
            </dd>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 py-3.5">
            <dt className="text-[#57534E]">3DS2 ECI</dt>
            <dd
              className={`font-mono text-xs font-semibold ${
                order.threeDsAuthenticated ? 'text-emerald-700' : 'text-rose-700'
              }`}
            >
              ECI {order.threeDsEci} ·{' '}
              {order.threeDsAuthenticated ? 'Authenticated (Liability Shift)' : 'Unauthenticated'}
            </dd>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 py-3.5">
            <dt className="text-[#57534E]">Account Tenure</dt>
            <dd className="font-mono text-xs text-[#1C1917] tabular-nums">
              {order.accountAgeDays} days · {order.priorUndisputedOrders} prior undisputed orders
            </dd>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 py-3.5">
            <dt className="text-[#57534E]">Courier &amp; AWB</dt>
            <dd className="font-mono text-xs text-[#1C1917]">
              {order.courierPartner} · {order.awbNumber}
            </dd>
          </div>
        </dl>
      </section>
    </div>
  );
}

interface EvidencePageViewProps {
  dispute: DisputeRecord;
  order: OrderRecord;
  policy: PolicyConfig | null;
}

export function EvidencePageView({ dispute, order, policy }: EvidencePageViewProps) {
  const [podImageFailed, setPodImageFailed] = useState(false);

  return (
    <section
      aria-label="Proof of Delivery and Chat Evidence"
      className="rounded-lg border border-[#E2D8C8] bg-[#FFFDF9] p-6 space-y-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E2D8C8] pb-4">
        <div>
          <h1 className="text-lg font-semibold text-[#1C1917]">02. POD Receipt &amp; Chat Evidence</h1>
          <p className="mt-0.5 text-xs text-[#57534E]">
            Courier proof of delivery scan, address verification, and customer support transcript.
          </p>
        </div>
        <span className="font-mono text-xs font-medium text-[#C2410C]">
          {dispute.extractedProof?.extractionSource ?? 'GATE_STOP'}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-8 md:grid-cols-12 items-start">
        <div className="md:col-span-6">
          {dispute.courierFallbackUsed ? (
            <div className="rounded-lg border border-amber-300 bg-amber-50 p-6 text-xs text-amber-900 leading-relaxed space-y-2">
              <div className="flex items-center gap-2 font-semibold text-amber-900">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                Courier SLA Timeout Fallback
              </div>
              <p>
                {order.courierPartner} tracking timed out beyond {policy?.courierTimeoutMs ?? 3000}ms SLA.
                Dossier binds 3DS2 ECI {order.threeDsEci} and device fingerprint{' '}
                <span className="font-mono">{order.deviceFingerprint}</span>.
              </p>
            </div>
          ) : podImageFailed ? (
            <div className="rounded-lg border border-[#E2D8C8] bg-[#F3EDE2] p-8 text-center space-y-2">
              <PackageCheck className="mx-auto h-6 w-6 text-[#C2410C]" />
              <div className="text-xs font-semibold text-[#1C1917]">Proof of Delivery Receipt</div>
              <div className="font-mono text-[11px] text-[#57534E]">
                {order.courierPartner} · AWB {order.awbNumber}
              </div>
            </div>
          ) : (
            <div className="overflow-hidden rounded-lg border border-[#E2D8C8] bg-[#F3EDE2]">
              <img
                src={order.podImageUrl}
                alt={`Proof of delivery for ${order.orderId}`}
                referrerPolicy="no-referrer"
                onError={() => setPodImageFailed(true)}
                className="w-full h-auto object-contain"
              />
            </div>
          )}
        </div>

        <div className="md:col-span-6 space-y-6">
          {dispute.extractedProof ? (
            <dl className="divide-y divide-[#E2D8C8] text-sm">
              <div className="flex items-center justify-between py-3">
                <dt className="text-[#57534E]">Recipient Signature</dt>
                <dd
                  className={`font-mono text-xs font-semibold ${
                    dispute.extractedProof.podSignatureValid ? 'text-emerald-700' : 'text-amber-700'
                  }`}
                >
                  {dispute.extractedProof.podSignatureValid ? 'Valid' : 'Missing'}
                </dd>
              </div>
              <div className="flex items-center justify-between py-3">
                <dt className="text-[#57534E]">Address Match Score</dt>
                <dd className="font-mono text-xs font-semibold text-[#1C1917] tabular-nums">
                  {dispute.extractedProof.addressMatchScore}%
                </dd>
              </div>
              <div className="flex items-center justify-between py-3">
                <dt className="text-[#57534E]">Support Chat Confirmation</dt>
                <dd
                  className={`font-mono text-xs font-semibold ${
                    dispute.extractedProof.chatReceiptConfirmed ? 'text-emerald-700' : 'text-rose-700'
                  }`}
                >
                  {dispute.extractedProof.chatReceiptConfirmed ? 'Confirmed' : 'Unconfirmed'}
                </dd>
              </div>
              <div className="flex items-center justify-between py-3">
                <dt className="text-[#57534E]">Courier &amp; AWB</dt>
                <dd className="font-mono text-xs text-[#1C1917]">
                  {order.courierPartner} · {order.awbNumber}
                </dd>
              </div>
            </dl>
          ) : (
            <div className="rounded-lg border border-[#E2D8C8] bg-[#F3EDE2] p-4 text-xs text-[#57534E]">
              Multimodal POD extraction was skipped because the cost gate stopped the pipeline early.
            </div>
          )}

          <div className="rounded-lg border border-[#E2D8C8] bg-[#F3EDE2] p-4">
            <div className="font-mono text-[10px] uppercase tracking-wider text-[#57534E]">
              Support Chat Excerpt
            </div>
            <p className="mt-2 font-serif text-sm italic text-[#1C1917] leading-relaxed">
              &ldquo;
              {dispute.extractedProof?.verbatimChatQuote ||
                order.supportChatLog ||
                'No customer support transcript was provided with this order.'}
              &rdquo;
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

export function AuditPageView({ dispute }: { dispute: DisputeRecord }) {
  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-[#E2D8C8] bg-[#FFFDF9] px-6 py-4">
        <h1 className="text-lg font-semibold text-[#1C1917]">03. Execution Audit Flow</h1>
        <p className="mt-0.5 text-xs text-[#57534E]">
          Step-by-step investigation DAG trace, latency share, and raw cryptographic node payloads.
        </p>
      </div>
      <AuditFlowTimeline logs={dispute.auditLogs ?? []} />
    </div>
  );
}

interface DossierPageViewProps {
  dispute: DisputeRecord;
  order: OrderRecord;
  submitting: boolean;
  submitMessage: string | null;
  onSubmitToRazorpay: () => void;
}

export function DossierPageView({
  dispute,
  order,
  submitting,
  submitMessage,
  onSubmitToRazorpay,
}: DossierPageViewProps) {
  return (
    <section
      aria-label="Bank Rebuttal Dossier"
      className="rounded-lg border border-[#E2D8C8] bg-[#FFFDF9] p-6 space-y-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#E2D8C8] pb-4">
        <div>
          <h1 className="text-lg font-semibold text-[#1C1917]">04. Bank Rebuttal Dossier</h1>
          <p className="mt-0.5 text-xs text-[#57534E]">
            Network-formatted 2-page PDF representment package ready for submission.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <a
            href={`${dispute.dossierPdfUrl}?download=1`}
            download={`${dispute.disputeId}-dossier.pdf`}
            className="inline-flex items-center gap-2 rounded-lg border border-[#E2D8C8] bg-[#F3EDE2] px-4 py-2 text-xs font-medium text-[#1C1917] hover:border-[#EA580C] transition-colors whitespace-nowrap"
          >
            <Download className="h-3.5 w-3.5" />
            Download Dossier (.PDF)
          </a>

          {dispute.status === 'SUBMITTED_TO_RAZORPAY' ? (
            <div className="inline-flex items-center gap-2 rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-2 text-xs font-semibold text-emerald-800 whitespace-nowrap">
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
              Submitted to Razorpay
            </div>
          ) : dispute.status === 'AUTO_ACCEPT_LOSS' ? (
            <div className="inline-flex items-center gap-2 rounded-lg border border-rose-300 bg-rose-50 px-4 py-2 text-xs font-semibold text-rose-800 whitespace-nowrap">
              Auto-Accepted at Cost Gate
            </div>
          ) : (
            <RayLightButton onClick={onSubmitToRazorpay} disabled={submitting} size="sm">
              <Send className="h-3.5 w-3.5" />
              {submitting ? 'Submitting...' : 'Submit to Razorpay'}
            </RayLightButton>
          )}
        </div>
      </div>

      {submitMessage && (
        <div className="rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-2.5 text-xs text-emerald-800">
          {submitMessage}
        </div>
      )}

      <DossierPreview dispute={dispute} order={order} expanded />
    </section>
  );
}

interface NotesPageViewProps {
  dispute: DisputeRecord;
  user: User | null;
  signingIn: boolean;
  onSignIn: () => void;
  notes: AnalystNoteDoc[];
  noteInput: string;
  onNoteInputChange: (val: string) => void;
  overrideChoice: 'NONE' | 'CONTEST' | 'ACCEPT' | 'ESCALATE';
  onOverrideChoiceChange: (val: 'NONE' | 'CONTEST' | 'ACCEPT' | 'ESCALATE') => void;
  savingNote: boolean;
  onSaveNote: (e: React.FormEvent) => void;
  onDeleteNote: (noteId: string) => void;
}

export function NotesPageView({
  dispute,
  user,
  signingIn,
  onSignIn,
  notes,
  noteInput,
  onNoteInputChange,
  overrideChoice,
  onOverrideChoiceChange,
  savingNote,
  onSaveNote,
  onDeleteNote,
}: NotesPageViewProps) {
  return (
    <section
      aria-label="Analyst Investigation Notes"
      className="rounded-lg border border-[#E2D8C8] bg-[#FFFDF9] p-6 space-y-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E2D8C8] pb-4">
        <div>
          <h1 className="text-lg font-semibold text-[#1C1917]">05. Analyst Notes</h1>
          <p className="mt-0.5 text-xs text-[#57534E]">
            Record investigation observations and decision overrides in Firestore.
          </p>
        </div>
        <span className="font-mono text-xs text-[#57534E]">
          {user ? user.displayName || user.email : 'Sign in required'}
        </span>
      </div>

      {!user ? (
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-lg border border-[#E2D8C8] bg-[#F3EDE2] p-6">
          <p className="font-serif text-sm text-[#57534E]">
            Sign in with Google to record investigation notes and override decisions.
          </p>
          <button
            type="button"
            onClick={onSignIn}
            disabled={signingIn}
            className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-[#EA580C] px-4 py-2 text-xs font-semibold text-white hover:bg-[#C2410C] disabled:opacity-50 transition-colors cursor-pointer whitespace-nowrap"
          >
            <LogIn className="h-3.5 w-3.5" />
            {signingIn ? 'Signing In...' : 'Sign in with Google'}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <form onSubmit={onSaveNote} className="lg:col-span-5 space-y-3">
            <label htmlFor="analyst-note" className="sr-only">
              Investigation note
            </label>
            <textarea
              id="analyst-note"
              rows={4}
              maxLength={2000}
              value={noteInput}
              onChange={(e) => onNoteInputChange(e.target.value)}
              placeholder="Record investigation observations or representment rationale..."
              className="w-full rounded-lg border border-[#E2D8C8] bg-[#FBF8F3] px-3 py-2.5 text-xs text-[#1C1917] placeholder:text-[#A8A29E] focus:border-[#EA580C] focus:outline-none"
            />
            <div className="flex flex-wrap items-center gap-3">
              <select
                aria-label="Decision override"
                value={overrideChoice}
                onChange={(e) =>
                  onOverrideChoiceChange(
                    e.target.value as 'NONE' | 'CONTEST' | 'ACCEPT' | 'ESCALATE'
                  )
                }
                className="rounded-lg border border-[#E2D8C8] bg-[#FBF8F3] px-3 py-2 font-mono text-xs text-[#1C1917] focus:border-[#EA580C] focus:outline-none"
              >
                <option value="NONE">No Override</option>
                <option value="CONTEST">Contest</option>
                <option value="ACCEPT">Accept Loss</option>
                <option value="ESCALATE">Escalate</option>
              </select>

              <RayLightButton type="submit" size="sm" disabled={savingNote || !noteInput.trim()}>
                {savingNote ? 'Saving...' : 'Save Note'}
              </RayLightButton>
            </div>
          </form>

          <div className="lg:col-span-7 space-y-3">
            {notes.length === 0 ? (
              <div className="rounded-lg border border-[#E2D8C8] bg-[#F3EDE2] p-5 text-xs text-[#57534E]">
                No notes recorded for {dispute.disputeId}.
              </div>
            ) : (
              notes.map((item) => (
                <div
                  key={item.id}
                  className="rounded-lg border border-[#E2D8C8] bg-[#FBF8F3] p-4 space-y-1.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-[11px] font-medium text-[#C2410C]">
                      Override: {item.decisionOverride}
                    </span>
                    <button
                      type="button"
                      onClick={() => onDeleteNote(item.id)}
                      aria-label={`Delete note ${item.id}`}
                      className="text-[#78716C] hover:text-rose-700 transition-colors cursor-pointer"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <p className="text-xs text-[#1C1917] leading-relaxed whitespace-pre-wrap">
                    {item.note}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </section>
  );
}
