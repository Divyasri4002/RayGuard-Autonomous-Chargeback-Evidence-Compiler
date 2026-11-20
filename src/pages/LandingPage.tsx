import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  Cpu,
  FileCheck2,
  GitBranch,
  Lock,
  Mic,
  Scale,
  ShieldCheck,
  Sparkles,
  Zap,
} from 'lucide-react';
import type { OverviewMetrics } from '../shared/types';
import { RayLightButton } from '../components/RayLightButton';
import { RayOfLightCanvas } from '../components/RayOfLightCanvas';
import { formatInr } from '../utils/formatters';

const PIPELINE_NODES = [
  {
    step: '01',
    title: 'Webhook HMAC Guard',
    badge: 'DETERMINISTIC',
    summary:
      'Validates X-Razorpay-Signature via timing-safe SHA-256 verification and blocks duplicate event replays.',
  },
  {
    step: '02',
    title: 'Cost-Benefit Break-Even Gate',
    badge: 'DETERMINISTIC',
    summary:
      'Evaluates dispute amount against gateway representment fees + ops cost, halting negative-EV cases before AI inference.',
  },
  {
    step: '03',
    title: 'Parallel Telemetry & SLA Fetch',
    badge: '3000ms SLA',
    summary:
      'Concurrently retrieves payment metadata, IP/device history, and courier delivery logs with automatic fallback on courier timeout.',
  },
  {
    step: '04',
    title: 'Multimodal POD & Chat Vision',
    badge: 'GEMINI VISION',
    summary:
      'Inspects delivery receipt PNGs and customer support transcripts to extract signature validity, address match score, and verbatim quotes.',
  },
  {
    step: '05',
    title: 'Calibrated Win Probability Scorer',
    badge: 'ML MODEL',
    summary:
      'Computes winnability across 9 behavioral and delivery signals, routing disputes into Contest, Human Review, or Fraud Block.',
  },
  {
    step: '06',
    title: 'Bank-Ready Dossier Compiler',
    badge: 'PDF OUTPUT',
    summary:
      'Generates 2-page PDF packets tailored to Visa, Mastercard, or RuPay rules with embedded proof and SHA-256 audit trace.',
  },
];

const ARCHITECTURE_LAYERS = [
  {
    index: '01',
    tag: 'INGESTION LAYER',
    title: 'Cryptographic Webhook Receiver',
    description:
      'Listens for payment.dispute.created events on POST /webhooks/razorpay, checks raw-body HMAC-SHA256 signatures, and enforces idempotency.',
    endpoint: 'POST /webhooks/razorpay',
    icon: Lock,
  },
  {
    index: '02',
    tag: 'INTELLIGENCE ENGINE',
    title: 'Hybrid Rule + Vision + ML Pipeline',
    description:
      'Pairs strict deterministic cost-benefit guardrails with multimodal delivery proof extraction and calibrated probability scoring.',
    endpoint: 'POST /api/disputes/ingest',
    icon: Cpu,
  },
  {
    index: '03',
    tag: 'RISK WORKSPACE',
    title: 'Inspector, Voice Analyst & Policies',
    description:
      '3-pane audit timeline, inline PDF dossier inspection, held-out threshold calibration lab, and live spoken analyst briefings.',
    endpoint: 'WS /api/live',
    icon: ShieldCheck,
  },
];

const NETWORK_PLAYBOOKS = [
  {
    network: 'Visa',
    rule: 'Compelling Evidence 3.0 · Code 10.4',
    proof: 'Binds 3DS2 ECI 05 liability shift, matching order/billing IP, known device tenure, and signed courier POD.',
  },
  {
    network: 'Mastercard',
    rule: 'Chargeback Guide · Code 4837',
    proof: 'Pairs authenticated session continuity with verbatim customer delivery confirmation from support transcripts.',
  },
  {
    network: 'RuPay',
    rule: 'NPCI Dispute Framework · Code 101',
    proof: 'Falls back to cryptographic 3DS2 + device telemetry certificates seamlessly when courier tracking APIs time out.',
  },
];

export function LandingPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [metrics, setMetrics] = useState<OverviewMetrics | null>(null);

  useEffect(() => {
    if (searchParams.get('autostart') === '1') {
      navigate('/console', { replace: true });
    }
  }, [searchParams, navigate]);

  useEffect(() => {
    fetch('/api/metrics/overview')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) setMetrics(data);
      })
      .catch(() => {});
  }, []);

  return (
    <div className="min-h-screen bg-[#FBF8F3] text-[#1C1917] flex flex-col">
      {/* SECTION 1: Radiant Orange Hero + Integrated Header */}
      <section className="relative flex min-h-[82vh] flex-col justify-between overflow-hidden border-b border-orange-600/30">
        <RayOfLightCanvas />

        {/* Transparent Floating Top Bar */}
        <header className="relative z-20">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-8 px-6 py-6">
            <Link
              to="/"
              aria-label="RayGuard Home"
              className="flex items-center gap-3 whitespace-nowrap shrink-0 group"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#1C1917] text-sm font-semibold text-[#FBF8F3] shadow-sm">
                R
              </span>
              <span className="text-base font-semibold tracking-tight text-white">RayGuard</span>
            </Link>

            <nav
              aria-label="Primary navigation"
              className="hidden md:flex items-center gap-8 text-sm font-medium text-white/95"
            >
              <a
                href="#architecture"
                className="hover:text-white transition-colors whitespace-nowrap shrink-0"
              >
                Capabilities
              </a>
              <a
                href="#pipeline"
                className="hover:text-white transition-colors whitespace-nowrap shrink-0"
              >
                Pipeline
              </a>
              <a
                href="#networks"
                className="hover:text-white transition-colors whitespace-nowrap shrink-0"
              >
                Networks
              </a>
              <Link
                to="/evaluation"
                className="hover:text-white transition-colors whitespace-nowrap shrink-0"
              >
                ML Lab
              </Link>
              <Link
                to="/policies"
                className="hover:text-white transition-colors whitespace-nowrap shrink-0"
              >
                Policies
              </Link>
            </nav>

            <Link
              to="/console"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-white hover:text-white/85 transition-colors whitespace-nowrap shrink-0"
            >
              <span>Open console</span>
              <ArrowUpRight className="h-4 w-4" />
            </Link>
          </div>
        </header>

        {/* Centered Editorial Hero Lockup */}
        <div className="relative z-10 mx-auto my-auto max-w-5xl px-6 py-20 sm:py-28 text-center">
          <div className="inline-flex items-center gap-2 font-mono text-[11px] font-semibold uppercase tracking-[0.22em] text-white/95">
            <Sparkles className="h-3.5 w-3.5" />
            <span>Autonomous Chargeback Defense</span>
          </div>

          <h1 className="mt-8 flex flex-col items-center justify-center text-white">
            <span className="relative inline-block font-serif text-5xl sm:text-7xl font-normal tracking-tight leading-none">
              RayGuard
              <svg
                aria-hidden="true"
                viewBox="0 0 260 14"
                fill="none"
                className="mx-auto mt-1.5 w-full max-w-[240px] text-white/90"
              >
                <path
                  d="M2 8C14 2 26 12 38 7C50 2 62 12 74 7C86 2 98 12 110 7C122 2 134 12 146 7C158 2 170 12 182 7C194 2 206 12 218 7C230 2 242 12 258 6"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                />
              </svg>
            </span>

            <span className="mt-4 flex flex-wrap items-baseline justify-center gap-4">
              <span className="font-serif italic text-3xl sm:text-5xl font-normal text-white/95">
                for
              </span>
              <span className="font-mono text-4xl sm:text-6xl font-bold uppercase tracking-[0.14em] text-white">
                DISPUTES
              </span>
            </span>
          </h1>

          <p className="mx-auto mt-8 max-w-xl text-base sm:text-lg leading-relaxed text-white/95 font-normal">
            Verify Razorpay webhooks cryptographically, stop unprofitable micro-disputes early, and
            compile bank-ready representment PDF dossiers automatically.
          </p>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <Link
              to="/console"
              className="inline-flex items-center gap-2 rounded-full bg-[#FFFDF9] px-7 py-3 text-sm font-semibold text-[#1C1917] shadow-lg hover:bg-[#F3EDE2] transition-colors whitespace-nowrap"
            >
              <span>Open console</span>
              <ArrowUpRight className="h-4 w-4" />
            </Link>

            <a
              href="#architecture"
              className="inline-flex items-center gap-2 rounded-full border border-white/40 bg-white/15 px-7 py-3 text-sm font-medium text-white backdrop-blur-sm hover:bg-white/25 transition-colors whitespace-nowrap"
            >
              <span>Explore architecture</span>
              <ArrowRight className="h-4 w-4" />
            </a>
          </div>
        </div>

        <div aria-hidden="true" className="h-6" />
      </section>

      <main className="flex-1">
        {/* SECTION 2: Live Operational Telemetry Bar (Strictly Live Store State) */}
        <section aria-label="Live telemetry" className="border-b border-[#E2D8C8] bg-[#FBF8F3]">
          <div className="mx-auto max-w-6xl px-6 py-16">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-lg border border-[#E2D8C8] bg-[#FFFDF9] p-6 shadow-[0_1px_2px_rgba(28,25,23,0.03)]">
                <div className="font-mono text-xs font-semibold text-[#57534E]">Net Recovered</div>
                <div className="mt-3 font-mono text-2xl xl:text-[28px] font-semibold text-[#1C1917] tabular-nums whitespace-nowrap">
                  {metrics ? formatInr(metrics.netRevenueRecoveredInr) : '—'}
                </div>
                <div className="mt-2 font-mono text-[11px] text-[#78716C]">
                  Live ledger net recovery
                </div>
              </div>

              <div className="rounded-lg border border-[#E2D8C8] bg-[#FFFDF9] p-6 shadow-[0_1px_2px_rgba(28,25,23,0.03)]">
                <div className="font-mono text-xs font-semibold text-[#57534E]">
                  Model Precision / Recall
                </div>
                <div className="mt-3 font-mono text-2xl xl:text-[28px] font-semibold text-[#C2410C] tabular-nums whitespace-nowrap">
                  {metrics ? `${metrics.heldOutPrecision}% / ${metrics.heldOutRecall}%` : '—'}
                </div>
                <div className="mt-2 font-mono text-[11px] text-[#78716C]">
                  60-case held-out validation
                </div>
              </div>

              <div className="rounded-lg border border-[#E2D8C8] bg-[#FFFDF9] p-6 shadow-[0_1px_2px_rgba(28,25,23,0.03)]">
                <div className="font-mono text-xs font-semibold text-[#57534E]">
                  Penalties Avoided
                </div>
                <div className="mt-3 font-mono text-2xl xl:text-[28px] font-semibold text-[#1C1917] tabular-nums whitespace-nowrap">
                  {metrics ? formatInr(metrics.falsePositivePenaltyAvoidedInr) : '—'}
                </div>
                <div className="mt-2 font-mono text-[11px] text-[#78716C]">
                  Blocked negative-EV fights
                </div>
              </div>

              <div className="rounded-lg border border-[#E2D8C8] bg-[#FFFDF9] p-6 shadow-[0_1px_2px_rgba(28,25,23,0.03)]">
                <div className="font-mono text-xs font-semibold text-[#57534E]">
                  Active Disputes
                </div>
                <div className="mt-3 font-mono text-2xl xl:text-[28px] font-semibold text-[#1C1917] tabular-nums whitespace-nowrap">
                  {metrics ? metrics.totalDisputes : '—'}
                </div>
                <div className="mt-2 font-mono text-[11px] text-[#78716C]">
                  {metrics && metrics.totalDisputes > 0
                    ? `MTTD ${metrics.meanTimeToDossierSec}s`
                    : 'Awaiting live ingestion'}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 3: Three-Layer System Architecture */}
        <section id="architecture" className="border-b border-[#E2D8C8] bg-[#FBF8F3]">
          <div className="mx-auto max-w-6xl px-6 py-24">
            <div className="max-w-2xl">
              <div className="font-mono text-xs font-semibold tracking-wider text-[#C2410C]">
                SYSTEM ARCHITECTURE
              </div>
              <h2 className="mt-4 text-3xl sm:text-4xl font-medium tracking-tight text-[#1C1917]">
                Three decoupled layers built for financial precision.
              </h2>
              <p className="mt-4 font-serif text-base text-[#57534E] leading-relaxed">
                Every dispute flows through deterministic cost gates, concurrent evidence
                collection, and calibrated representment compilation without wasted inference.
              </p>
            </div>

            <div className="mt-12 grid grid-cols-1 gap-6 lg:grid-cols-3">
              {ARCHITECTURE_LAYERS.map((layer) => {
                const Icon = layer.icon;
                return (
                  <div
                    key={layer.index}
                    className="rounded-lg border border-[#E2D8C8] bg-[#FFFDF9] p-7 flex flex-col justify-between shadow-[0_1px_2px_rgba(28,25,23,0.03)]"
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs font-semibold text-[#C2410C]">
                          {layer.index} · {layer.tag}
                        </span>
                        <Icon className="h-4 w-4 text-[#78716C]" />
                      </div>
                      <h3 className="mt-4 text-xl font-medium text-[#1C1917]">{layer.title}</h3>
                      <p className="mt-3 font-serif text-base text-[#57534E] leading-relaxed">
                        {layer.description}
                      </p>
                    </div>
                    <div className="mt-8 border-t border-[#E2D8C8] pt-4 font-mono text-xs text-[#1C1917]">
                      {layer.endpoint}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* SECTION 4: 6-Node Autonomous Investigation Pipeline */}
        <section id="pipeline" className="border-b border-[#E2D8C8] bg-[#F3EDE2]">
          <div className="mx-auto max-w-6xl px-6 py-24">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-2xl">
                <div className="font-mono text-xs font-semibold tracking-wider text-[#C2410C]">
                  BOUNDED DECISION DAG
                </div>
                <h2 className="mt-4 text-3xl sm:text-4xl font-medium tracking-tight text-[#1C1917]">
                  Six auditable steps from webhook to bank submission.
                </h2>
              </div>

              <div className="shrink-0">
                <RayLightButton to="/console" variant="surface" size="sm">
                  <GitBranch className="h-3.5 w-3.5 text-[#EA580C]" />
                  Open Inspector Console
                </RayLightButton>
              </div>
            </div>

            <div className="mt-12 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {PIPELINE_NODES.map((node) => (
                <div
                  key={node.step}
                  className="rounded-lg border border-[#E2D8C8] bg-[#FFFDF9] p-6 flex flex-col justify-between shadow-[0_1px_2px_rgba(28,25,23,0.03)]"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-xs font-bold text-[#C2410C]">
                        STEP {node.step}
                      </span>
                      <span className="rounded border border-[#E2D8C8] bg-[#F3EDE2] px-2 py-0.5 font-mono text-[10px] font-medium text-[#57534E]">
                        {node.badge}
                      </span>
                    </div>
                    <h3 className="mt-4 text-lg font-medium text-[#1C1917]">{node.title}</h3>
                    <p className="mt-2.5 font-serif text-sm text-[#57534E] leading-relaxed">
                      {node.summary}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* SECTION 5: Economics, Card Networks & Bounded Action Bands */}
        <section id="networks" className="border-b border-[#E2D8C8] bg-[#FBF8F3]">
          <div className="mx-auto max-w-6xl px-6 py-24 space-y-16">
            <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 items-start">
              <div className="lg:col-span-5 space-y-5">
                <div className="font-mono text-xs font-semibold tracking-wider text-[#C2410C]">
                  COST-BENEFIT &amp; ML ROUTING
                </div>
                <h2 className="text-3xl font-medium tracking-tight text-[#1C1917]">
                  Stop fighting disputes that cost more than they recover.
                </h2>
                <p className="font-serif text-base text-[#57534E] leading-relaxed">
                  Gateway representment fees and manual operations create a break-even floor.
                  RayGuard stops sub-threshold claims deterministically and scores higher-value
                  disputes before recommending action.
                </p>

                <div className="pt-2 space-y-3">
                  <div className="flex items-center justify-between rounded-lg border border-[#E2D8C8] bg-[#FFFDF9] px-4 py-3 font-mono text-xs">
                    <span className="font-semibold text-emerald-700">&ge; 75% Win Prob</span>
                    <span className="text-[#1C1917]">Ready to Contest (Dossier Built)</span>
                  </div>
                  <div className="flex items-center justify-between rounded-lg border border-[#E2D8C8] bg-[#FFFDF9] px-4 py-3 font-mono text-xs">
                    <span className="font-semibold text-amber-700">40% – 74% Win Prob</span>
                    <span className="text-[#1C1917]">Escalate for Human Review</span>
                  </div>
                  <div className="flex items-center justify-between rounded-lg border border-[#E2D8C8] bg-[#FFFDF9] px-4 py-3 font-mono text-xs">
                    <span className="font-semibold text-rose-700">&lt; 40% or Below Gate</span>
                    <span className="text-[#1C1917]">Block Contest &amp; Save Penalty</span>
                  </div>
                </div>
              </div>

              <div className="lg:col-span-7 grid grid-cols-1 gap-4">
                {NETWORK_PLAYBOOKS.map((item) => (
                  <div
                    key={item.network}
                    className="rounded-lg border border-[#E2D8C8] bg-[#FFFDF9] p-6 shadow-[0_1px_2px_rgba(28,25,23,0.03)]"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="text-lg font-medium text-[#1C1917]">{item.network}</h3>
                      <span className="font-mono text-xs font-medium text-[#C2410C]">{item.rule}</span>
                    </div>
                    <p className="mt-2.5 font-serif text-sm text-[#57534E] leading-relaxed">
                      {item.proof}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Operational Workspace Capabilities Strip */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3 pt-8 border-t border-[#E2D8C8]">
              <div className="rounded-lg border border-[#E2D8C8] bg-[#FFFDF9] p-6 space-y-2 shadow-[0_1px_2px_rgba(28,25,23,0.03)]">
                <div className="flex items-center gap-2 text-sm font-medium text-[#1C1917]">
                  <FileCheck2 className="h-4 w-4 text-[#EA580C]" />
                  <span>2-Page Bank PDF Dossier</span>
                </div>
                <p className="font-serif text-sm text-[#57534E] leading-relaxed">
                  Inline executive rebuttal &amp; evidence preview paired with instant PDF download.
                </p>
              </div>

              <div className="rounded-lg border border-[#E2D8C8] bg-[#FFFDF9] p-6 space-y-2 shadow-[0_1px_2px_rgba(28,25,23,0.03)]">
                <div className="flex items-center gap-2 text-sm font-medium text-[#1C1917]">
                  <Scale className="h-4 w-4 text-[#EA580C]" />
                  <span>Held-Out Calibration Lab</span>
                </div>
                <p className="font-serif text-sm text-[#57534E] leading-relaxed">
                  Sweep decision thresholds dynamically against confusion matrices and penalty impact.
                </p>
              </div>

              <div className="rounded-lg border border-[#E2D8C8] bg-[#FFFDF9] p-6 space-y-2 shadow-[0_1px_2px_rgba(28,25,23,0.03)]">
                <div className="flex items-center gap-2 text-sm font-medium text-[#1C1917]">
                  <Mic className="h-4 w-4 text-[#EA580C]" />
                  <span>Live Voice Risk Analyst</span>
                </div>
                <p className="font-serif text-sm text-[#57534E] leading-relaxed">
                  Real-time spoken briefings scoped directly to any active chargeback dossier.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 6: Radiant Orange Final CTA Band */}
        <section className="relative overflow-hidden border-b border-[#E2D8C8]">
          <RayOfLightCanvas />

          <div className="relative z-10 mx-auto max-w-4xl px-6 py-24 text-center">
            <div className="inline-flex items-center gap-2 font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-white/95">
              <Zap className="h-3.5 w-3.5" />
              <span>Ready for Production Webhooks</span>
            </div>

            <h2 className="mt-5 font-serif text-3xl sm:text-5xl font-normal tracking-tight text-white">
              Defend every winnable chargeback with auditable proof.
            </h2>

            <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
              <Link
                to="/console"
                className="inline-flex items-center gap-2 rounded-full bg-[#FFFDF9] px-7 py-3 text-sm font-semibold text-[#1C1917] shadow-lg hover:bg-[#F3EDE2] transition-colors whitespace-nowrap"
              >
                <span>Open Risk Console</span>
                <ArrowUpRight className="h-4 w-4" />
              </Link>

              <Link
                to="/policies"
                className="inline-flex items-center gap-2 rounded-full border border-white/40 bg-white/15 px-7 py-3 text-sm font-medium text-white backdrop-blur-sm hover:bg-white/25 transition-colors whitespace-nowrap"
              >
                <CheckCircle2 className="h-4 w-4" />
                <span>Configure Guardrail Policies</span>
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* Quiet Warm Beige Footer */}
      <footer className="bg-[#F3EDE2]">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-6 py-10 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2.5 text-sm text-[#57534E]">
            <ShieldCheck className="h-4 w-4 text-[#EA580C]" />
            <span>RayGuard · Autonomous Chargeback Defense</span>
          </div>
          <div className="flex items-center gap-6 text-xs font-mono text-[#57534E]">
            <Link to="/console" className="hover:text-[#1C1917] transition-colors">
              Overview
            </Link>
            <Link to="/disputes" className="hover:text-[#1C1917] transition-colors">
              Disputes
            </Link>
            <Link to="/evaluation" className="hover:text-[#1C1917] transition-colors">
              ML Lab
            </Link>
            <Link to="/policies" className="hover:text-[#1C1917] transition-colors">
              Policies
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
