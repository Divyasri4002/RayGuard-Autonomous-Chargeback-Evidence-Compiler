import React, { useEffect, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Download,
  FileText,
  GitBranch,
  Lock,
  MessageSquarePlus,
  PackageCheck,
  Send,
  ShieldCheck,
} from 'lucide-react';
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  where,
} from 'firebase/firestore';
import type { DisputeRecord, PolicyConfig } from '../shared/types';
import { ConsoleLayout } from '../components/ConsoleLayout';
import { RayLightButton } from '../components/RayLightButton';
import {
  AuditPageView,
  DossierPageView,
  EvidencePageView,
  NotesPageView,
  TelemetryPageView,
  type AnalystNoteDoc,
} from '../components/inspector/DisputeSectionViews';
import { useAuth } from '../contexts/AuthContext';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { formatInrFromPaise, formatLatency, getStatusMeta } from '../utils/formatters';

type InspectionSectionId = 'telemetry' | 'evidence' | 'audit' | 'dossier' | 'notes';

const VALID_SECTIONS = new Set<string>(['telemetry', 'evidence', 'audit', 'dossier', 'notes']);

export function DisputeInspectorPage() {
  const { id, section } = useParams<{ id: string; section?: string }>();
  const { user, authReady, signingIn, signInWithGoogle } = useAuth();
  const [dispute, setDispute] = useState<DisputeRecord | null>(null);
  const [policy, setPolicy] = useState<PolicyConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState<string | null>(null);

  const [notes, setNotes] = useState<AnalystNoteDoc[]>([]);
  const [noteInput, setNoteInput] = useState('');
  const [overrideChoice, setOverrideChoice] = useState<'NONE' | 'CONTEST' | 'ACCEPT' | 'ESCALATE'>('NONE');
  const [savingNote, setSavingNote] = useState(false);
  const [fatalNoteError, setFatalNoteError] = useState<Error | null>(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setSubmitMessage(null);
    Promise.all([
      fetch(`/api/disputes/${id}`).then((r) => (r.ok ? r.json() : null)),
      fetch('/api/policies').then((r) => (r.ok ? r.json() : null)),
    ])
      .then(([dJson, pJson]) => {
        if (dJson?.dispute) setDispute(dJson.dispute);
        if (pJson?.policy) setPolicy(pJson.policy);
      })
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (!authReady || !user || !id) {
      setNotes([]);
      return;
    }

    const path = `users/${user.uid}/notes`;
    const q = query(collection(db, 'users', user.uid, 'notes'), where('uid', '==', user.uid));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const filtered = snapshot.docs
          .map((d) => ({
            id: d.id,
            ...(d.data() as Omit<AnalystNoteDoc, 'id'>),
          }))
          .filter((item) => item.disputeId === id);

        filtered.sort((a, b) => {
          const tA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0;
          const tB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 0;
          return tB - tA;
        });
        setNotes(filtered);
      },
      (err) => {
        try {
          handleFirestoreError(err, OperationType.LIST, path);
        } catch (wrapped) {
          setFatalNoteError(wrapped as Error);
        }
      }
    );

    return () => unsubscribe();
  }, [authReady, user, id]);

  if (fatalNoteError) {
    throw fatalNoteError;
  }

  if (section && !VALID_SECTIONS.has(section) && id) {
    return <Navigate to={`/disputes/${id}`} replace />;
  }

  const handleSaveNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !user.emailVerified || !dispute) return;
    const trimmed = noteInput.trim().slice(0, 2000);
    if (!trimmed) return;

    setSavingNote(true);
    const noteId = `note_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const safeDisputeId = dispute.disputeId.replace(/[^a-zA-Z0-9_\-]/g, '_').slice(0, 64);
    const path = `users/${user.uid}/notes/${noteId}`;

    try {
      await setDoc(doc(db, 'users', user.uid, 'notes', noteId), {
        uid: user.uid,
        disputeId: safeDisputeId,
        note: trimmed,
        decisionOverride: overrideChoice,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setNoteInput('');
      setOverrideChoice('NONE');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, path);
    } finally {
      setSavingNote(false);
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    if (!user) return;
    const path = `users/${user.uid}/notes/${noteId}`;
    try {
      await deleteDoc(doc(db, 'users', user.uid, 'notes', noteId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, path);
    }
  };

  const handleSubmitToRazorpay = async () => {
    if (!dispute) return;
    setSubmitting(true);
    setSubmitMessage(null);
    try {
      const res = await fetch(`/api/disputes/${dispute.disputeId}/submit`, { method: 'POST' });
      const data = await res.json();
      if (res.ok && data.dispute) {
        setDispute(data.dispute);
        setSubmitMessage(
          data.razorpaySync?.message || 'Submitted to Razorpay Disputes API.'
        );
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <ConsoleLayout breadcrumb={`Disputes / ${id ?? ''}`}>
        <div className="mx-auto max-w-4xl py-12">
          <div className="rounded-lg border border-[#E2D8C8] bg-[#FFFDF9] p-6 text-sm text-[#57534E]">
            Loading dispute record...
          </div>
        </div>
      </ConsoleLayout>
    );
  }

  if (!dispute || !dispute.order) {
    return (
      <ConsoleLayout breadcrumb="Not Found">
        <div className="mx-auto max-w-xl rounded-lg border border-[#E2D8C8] bg-[#FFFDF9] p-8 text-center">
          <h1 className="text-xl font-medium text-[#1C1917]">Dispute Not Found</h1>
          <p className="mt-2 font-serif text-sm text-[#57534E]">
            No matching record exists in the live dispute ledger.
          </p>
          <div className="mt-6">
            <RayLightButton to="/disputes" size="sm">
              Back to Dispute Queue
            </RayLightButton>
          </div>
        </div>
      </ConsoleLayout>
    );
  }

  const order = dispute.order;
  const meta = getStatusMeta(dispute.status);
  const ipMatch = order.customerIp === order.billingIp;
  const auditLogs = dispute.auditLogs ?? [];

  const directoryItems: Array<{
    id: InspectionSectionId;
    step: string;
    title: string;
    description: string;
    statusText: string;
    icon: React.ComponentType<{ className?: string }>;
  }> = [
    {
      id: 'telemetry',
      step: '01',
      title: 'Case Telemetry & Score',
      description: 'Win probability gauge, cost gate threshold, IP match, device fingerprint, and 3DS2 checks.',
      statusText:
        dispute.status === 'AUTO_ACCEPT_LOSS'
          ? `Cost Gate Stop · ${ipMatch ? 'IP Match' : 'IP Mismatch'}`
          : `${(dispute.winProbability * 100).toFixed(1)}% Win Prob · ${ipMatch ? 'IP Match' : 'IP Mismatch'}`,
      icon: ShieldCheck,
    },
    {
      id: 'evidence',
      step: '02',
      title: 'POD Receipt & Chat Evidence',
      description: 'Courier proof of delivery image, recipient signature match, and customer chat transcript.',
      statusText: dispute.courierFallbackUsed
        ? `Telemetry Fallback · ${order.courierPartner}`
        : `${dispute.extractedProof?.podSignatureValid ? 'Signed POD Verified' : 'POD Unverified'} · ${order.courierPartner}`,
      icon: PackageCheck,
    },
    {
      id: 'audit',
      step: '03',
      title: 'Execution Audit Flow',
      description: 'Step-by-step investigation DAG timeline with per-node latency and JSON payloads.',
      statusText: `${auditLogs.length} Steps · ${formatLatency(dispute.mttdMs)}`,
      icon: GitBranch,
    },
    {
      id: 'dossier',
      step: '04',
      title: 'Bank Rebuttal Dossier',
      description: 'Formal 2-page PDF representment document, PDF download, and Razorpay submission.',
      statusText: `${dispute.network} ${dispute.reasonCode} · PDF Ready`,
      icon: FileText,
    },
    {
      id: 'notes',
      step: '05',
      title: 'Analyst Notes',
      description: 'Record Firestore investigation observations and human decision overrides.',
      statusText: user
        ? `${notes.length} ${notes.length === 1 ? 'Note' : 'Notes'} Saved`
        : 'Sign in required',
      icon: MessageSquarePlus,
    },
  ];

  // Dedicated Single Item Sub-Page (/disputes/:id/:section)
  if (section) {
    const activeIndex = directoryItems.findIndex((item) => item.id === section);
    const activeItem = directoryItems[activeIndex];
    const prevItem = activeIndex > 0 ? directoryItems[activeIndex - 1] : null;
    const nextItem =
      activeIndex >= 0 && activeIndex < directoryItems.length - 1
        ? directoryItems[activeIndex + 1]
        : null;

    return (
      <ConsoleLayout
        breadcrumb={`Disputes / ${dispute.disputeId} / ${activeItem.title}`}
        voiceDisputeId={dispute.disputeId}
        primaryAction={
          <Link
            to={`/disputes/${dispute.disputeId}`}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-[#57534E] hover:text-[#1C1917] whitespace-nowrap shrink-0"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            All Inspection Items
          </Link>
        }
      >
        <div className="mx-auto max-w-5xl space-y-6">
          {/* Compact Case Context Strip */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#E2D8C8] bg-[#F3EDE2] px-5 py-3">
            <div className="flex flex-wrap items-center gap-3 font-mono text-xs text-[#57534E]">
              <Link
                to={`/disputes/${dispute.disputeId}`}
                className="font-sans font-semibold text-[#C2410C] hover:text-[#1C1917] inline-flex items-center gap-1 transition-colors"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Inspection Directory
              </Link>
              <span aria-hidden="true">·</span>
              <span className="font-semibold text-[#1C1917]">{dispute.disputeId}</span>
              <span aria-hidden="true">·</span>
              <span>{order.customerName}</span>
              <span aria-hidden="true">·</span>
              <span>
                {dispute.network} {dispute.reasonCode}
              </span>
            </div>

            <div className="flex items-center gap-3 font-mono text-xs tabular-nums">
              <span className="font-semibold text-[#1C1917]">
                {formatInrFromPaise(dispute.amountPaise)}
              </span>
              <span
                className={`rounded-md border px-2 py-0.5 text-[11px] font-medium whitespace-nowrap ${meta.textColor} ${meta.borderColor} ${meta.surfaceColor}`}
              >
                {meta.label}
              </span>
            </div>
          </div>

          {/* Dedicated Single-Page View */}
          {section === 'telemetry' && (
            <TelemetryPageView dispute={dispute} order={order} policy={policy} />
          )}

          {section === 'evidence' && (
            <EvidencePageView dispute={dispute} order={order} policy={policy} />
          )}

          {section === 'audit' && <AuditPageView dispute={dispute} />}

          {section === 'dossier' && (
            <DossierPageView
              dispute={dispute}
              order={order}
              submitting={submitting}
              submitMessage={submitMessage}
              onSubmitToRazorpay={handleSubmitToRazorpay}
            />
          )}

          {section === 'notes' && (
            <NotesPageView
              dispute={dispute}
              user={user}
              signingIn={signingIn}
              onSignIn={signInWithGoogle}
              notes={notes}
              noteInput={noteInput}
              onNoteInputChange={setNoteInput}
              overrideChoice={overrideChoice}
              onOverrideChoiceChange={setOverrideChoice}
              savingNote={savingNote}
              onSaveNote={handleSaveNote}
              onDeleteNote={handleDeleteNote}
            />
          )}

          {/* Clean Page Footer Navigation */}
          <nav
            aria-label="Inspection page pagination"
            className="flex flex-wrap items-center justify-between gap-4 border-t border-[#E2D8C8] pt-4 text-xs"
          >
            <div>
              {prevItem ? (
                <Link
                  to={`/disputes/${dispute.disputeId}/${prevItem.id}`}
                  className="inline-flex items-center gap-2 rounded-lg border border-[#E2D8C8] bg-[#FFFDF9] px-4 py-2 font-medium text-[#57534E] hover:border-[#EA580C] hover:text-[#1C1917] transition-colors whitespace-nowrap"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  <span>
                    {prevItem.step}. {prevItem.title}
                  </span>
                </Link>
              ) : (
                <span />
              )}
            </div>

            <Link
              to={`/disputes/${dispute.disputeId}`}
              className="font-mono text-xs text-[#57534E] hover:text-[#1C1917] transition-colors whitespace-nowrap"
            >
              All Inspection Items
            </Link>

            <div>
              {nextItem ? (
                <Link
                  to={`/disputes/${dispute.disputeId}/${nextItem.id}`}
                  className="inline-flex items-center gap-2 rounded-lg border border-[#E2D8C8] bg-[#FFFDF9] px-4 py-2 font-medium text-[#1C1917] hover:border-[#EA580C] hover:text-[#C2410C] transition-colors whitespace-nowrap"
                >
                  <span>
                    {nextItem.step}. {nextItem.title}
                  </span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              ) : (
                <span />
              )}
            </div>
          </nav>
        </div>
      </ConsoleLayout>
    );
  }

  // Hub Directory Page (/disputes/:id)
  return (
    <ConsoleLayout
      breadcrumb={`Disputes / ${dispute.disputeId}`}
      voiceDisputeId={dispute.disputeId}
      primaryAction={
        <Link
          to="/disputes"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-[#57534E] hover:text-[#1C1917] whitespace-nowrap shrink-0"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Dispute Queue
        </Link>
      }
    >
      <div className="mx-auto max-w-4xl space-y-6">
        {/* Case Summary Header */}
        <section
          aria-label="Dispute case header"
          className="rounded-lg border border-[#E2D8C8] bg-[#FFFDF9] p-6"
        >
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0 space-y-2">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="font-mono text-2xl font-semibold tracking-tight text-[#1C1917]">
                  {dispute.disputeId}
                </h1>
                <span
                  className={`rounded-md border px-2.5 py-0.5 font-mono text-xs font-medium whitespace-nowrap ${meta.textColor} ${meta.borderColor} ${meta.surfaceColor}`}
                >
                  {meta.label}
                </span>
                {dispute.courierFallbackUsed && (
                  <span className="inline-flex items-center gap-1 rounded-md border border-amber-300 bg-amber-50 px-2.5 py-0.5 font-mono text-xs text-amber-800 whitespace-nowrap">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    Telemetry Fallback
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-xs text-[#57534E]">
                <span>{order.customerName}</span>
                <span aria-hidden="true">·</span>
                <span>{dispute.paymentId}</span>
                <span aria-hidden="true">·</span>
                <span>{dispute.orderId}</span>
                <span aria-hidden="true">·</span>
                <span>
                  {dispute.network} {dispute.reasonCode}
                </span>
                <span aria-hidden="true">·</span>
                <span className="inline-flex items-center gap-1 text-emerald-700">
                  <Lock className="h-3 w-3 shrink-0" />
                  HMAC {dispute.hmacSignaturePreview}
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-8 border-t border-[#E2D8C8] pt-4 lg:border-t-0 lg:pt-0 font-mono tabular-nums shrink-0">
              <div>
                <div className="text-[11px] text-[#57534E]">Amount</div>
                <div className="mt-0.5 text-lg font-semibold text-[#1C1917]">
                  {formatInrFromPaise(dispute.amountPaise)}
                </div>
              </div>
              <div>
                <div className="text-[11px] text-[#57534E]">Expected Value</div>
                <div
                  className={`mt-0.5 text-lg font-semibold ${
                    dispute.netExpectedValuePaise >= 0 ? 'text-emerald-700' : 'text-rose-700'
                  }`}
                >
                  {formatInrFromPaise(dispute.netExpectedValuePaise)}
                </div>
              </div>
              <div>
                <div className="text-[11px] text-[#57534E]">MTTD</div>
                <div className="mt-0.5 text-lg font-semibold text-[#C2410C]">
                  {formatLatency(dispute.mttdMs)}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Clean Inspection Directory Listing */}
        <section
          aria-label="Inspection directory"
          className="rounded-lg border border-[#E2D8C8] bg-[#FFFDF9] overflow-hidden"
        >
          <div className="flex items-center justify-between border-b border-[#E2D8C8] bg-[#F3EDE2] px-6 py-3.5">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-[#1C1917]">
              Inspection Items
            </h2>
            <span className="font-mono text-[11px] text-[#57534E]">
              Touch an item to open its page
            </span>
          </div>

          <div className="divide-y divide-[#E2D8C8]">
            {directoryItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.id}
                  to={`/disputes/${dispute.disputeId}/${item.id}`}
                  className="group flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between px-6 py-5 hover:bg-[#F6F1E7] transition-colors"
                >
                  <div className="flex items-start gap-4 min-w-0">
                    <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#E2D8C8] bg-[#F3EDE2] text-[#C2410C] group-hover:border-[#EA580C] group-hover:bg-[#EA580C] group-hover:text-white transition-colors">
                      <Icon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-[#1C1917] group-hover:text-[#C2410C] transition-colors">
                        {item.step}. {item.title}
                      </div>
                      <p className="mt-0.5 text-xs text-[#57534E] leading-relaxed">
                        {item.description}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-4 pl-13 sm:pl-0 shrink-0">
                    <span className="font-mono text-xs text-[#57534E] tabular-nums whitespace-nowrap">
                      {item.statusText}
                    </span>
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#C2410C] group-hover:translate-x-0.5 transition-transform whitespace-nowrap">
                      Open
                      <ArrowRight className="h-3.5 w-3.5" />
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>

        {/* Direct Case Resolution Bar */}
        <section
          aria-label="Representment submission"
          className="rounded-lg border border-[#E2D8C8] bg-[#FFFDF9] px-6 py-4 flex flex-wrap items-center justify-between gap-4"
        >
          <div className="space-y-0.5">
            <div className="text-xs font-semibold text-[#1C1917]">Representment Package</div>
            <div className="font-mono text-xs text-[#57534E]">
              {submitMessage ??
                (dispute.status === 'SUBMITTED_TO_RAZORPAY'
                  ? 'Dispute evidence submitted to Razorpay Disputes API.'
                  : `${dispute.network} ${dispute.reasonCode} dossier compiled and ready.`)}
            </div>
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
              <RayLightButton onClick={handleSubmitToRazorpay} disabled={submitting} size="sm">
                <Send className="h-3.5 w-3.5" />
                {submitting ? 'Submitting...' : 'Submit to Razorpay'}
              </RayLightButton>
            )}
          </div>
        </section>
      </div>
    </ConsoleLayout>
  );
}
