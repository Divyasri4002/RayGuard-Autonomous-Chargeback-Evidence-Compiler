import { useState } from 'react';
import { CheckCircle2, FileCheck2, ShieldAlert } from 'lucide-react';
import type { DisputeRecord, OrderRecord } from '../shared/types';
import { formatInrFromPaise } from '../utils/formatters';

interface DossierPreviewProps {
  dispute: DisputeRecord;
  order: OrderRecord;
  expanded?: boolean;
}

export function DossierPreview({ dispute, order, expanded = false }: DossierPreviewProps) {
  const [page, setPage] = useState<1 | 2>(1);
  const ipMatch = order.customerIp === order.billingIp;
  const deviceMatch = order.deviceFingerprint === order.knownDeviceFingerprint;
  const logs = dispute.auditLogs ?? [];

  return (
    <div className="mt-4 flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div
          role="tablist"
          aria-label="Rebuttal dossier pages"
          className="inline-flex rounded-lg border border-[#E2D8C8] bg-[#F3EDE2] p-0.5 font-mono text-[11px]"
        >
          <button
            type="button"
            role="tab"
            aria-selected={page === 1}
            onClick={() => setPage(1)}
            className={`rounded-md px-2.5 py-1 transition-colors whitespace-nowrap cursor-pointer ${
              page === 1
                ? 'bg-[#EA580C] text-white font-semibold'
                : 'text-[#57534E] hover:text-[#1C1917]'
            }`}
          >
            Page 1: Rebuttal
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={page === 2}
            onClick={() => setPage(2)}
            className={`rounded-md px-2.5 py-1 transition-colors whitespace-nowrap cursor-pointer ${
              page === 2
                ? 'bg-[#EA580C] text-white font-semibold'
                : 'text-[#57534E] hover:text-[#1C1917]'
            }`}
          >
            Page 2: Evidence
          </button>
        </div>

        <span className="inline-flex items-center gap-1 font-mono text-[11px] text-emerald-700 whitespace-nowrap">
          <FileCheck2 className="h-3.5 w-3.5 shrink-0" />
          PDF Ready
        </span>
      </div>

      <div
        className={`${
          expanded ? 'min-h-[420px]' : 'h-[360px] overflow-y-auto'
        } rounded-lg border border-[#E2D8C8] bg-[#FFFDF9] text-[#1C1917] overflow-hidden`}
      >
        {page === 1 ? (
          <div>
            <div className="bg-[#F3EDE2] px-4 py-3 text-[#1C1917] border-b-2 border-[#EA580C]">
              <div className="text-[11px] font-bold tracking-wider uppercase">
                RayGuard Merchant Representment Dossier
              </div>
              <div className="mt-1 font-mono text-[10px] text-[#57534E]">
                {dispute.disputeId} · {dispute.paymentId} · {dispute.network} ({dispute.reasonCode})
              </div>
              <div className="mt-1 font-mono text-[10px] font-semibold text-[#C2410C] tabular-nums">
                {formatInrFromPaise(dispute.amountPaise)} · Win:{' '}
                {(dispute.winProbability * 100).toFixed(1)}% · {dispute.status}
              </div>
            </div>

            <div className="p-4 space-y-4">
              <div>
                <h3 className="text-[10px] font-bold tracking-wider uppercase text-[#1C1917]">
                  1. Rebuttal Statement
                </h3>
                <div className="mt-1.5 rounded border border-[#E2D8C8] bg-[#FBF8F3] p-3 text-[11px] leading-relaxed text-[#1C1917] whitespace-pre-wrap">
                  {dispute.rebuttalText}
                </div>
              </div>

              <div>
                <h3 className="text-[10px] font-bold tracking-wider uppercase text-[#1C1917]">
                  2. Transaction Telemetry
                </h3>
                <div className="mt-1.5 overflow-hidden rounded border border-[#E2D8C8] text-[10px]">
                  <div className="grid grid-cols-12 border-b border-[#E2D8C8] bg-[#F3EDE2]/60 px-2.5 py-1.5">
                    <span className="col-span-5 font-semibold text-[#57534E]">Order / AWB</span>
                    <span className="col-span-7 font-mono text-[#1C1917] truncate">
                      {order.orderId} / {order.awbNumber}
                    </span>
                  </div>
                  <div className="grid grid-cols-12 border-b border-[#E2D8C8] bg-[#FFFDF9] px-2.5 py-1.5">
                    <span className="col-span-5 font-semibold text-[#57534E]">Cardholder</span>
                    <span className="col-span-7 font-mono text-[#1C1917] truncate">
                      {order.customerName}
                    </span>
                  </div>
                  <div className="grid grid-cols-12 border-b border-[#E2D8C8] bg-[#F3EDE2]/60 px-2.5 py-1.5">
                    <span className="col-span-5 font-semibold text-[#57534E]">IP Match</span>
                    <span className="col-span-7 font-mono text-[#1C1917]">
                      {order.customerIp} ({ipMatch ? 'MATCH' : 'MISMATCH'})
                    </span>
                  </div>
                  <div className="grid grid-cols-12 border-b border-[#E2D8C8] bg-[#FFFDF9] px-2.5 py-1.5">
                    <span className="col-span-5 font-semibold text-[#57534E]">Device</span>
                    <span className="col-span-7 font-mono text-[#1C1917]">
                      {order.deviceFingerprint} ({deviceMatch ? 'KNOWN' : 'NEW'})
                    </span>
                  </div>
                  <div className="grid grid-cols-12 border-b border-[#E2D8C8] bg-[#F3EDE2]/60 px-2.5 py-1.5">
                    <span className="col-span-5 font-semibold text-[#57534E]">3DS2 ECI</span>
                    <span className="col-span-7 font-mono text-[#1C1917]">
                      {order.threeDsEci} · {order.threeDsAuthenticated ? 'LIABILITY SHIFT' : 'NONE'}
                    </span>
                  </div>
                  <div className="grid grid-cols-12 bg-[#FFFDF9] px-2.5 py-1.5">
                    <span className="col-span-5 font-semibold text-[#57534E]">HMAC Digest</span>
                    <span className="col-span-7 font-mono text-[#1C1917] truncate">
                      {dispute.hmacSignaturePreview}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div>
            <div className="bg-[#F3EDE2] px-4 py-2.5 text-[#1C1917] border-b-2 border-[#EA580C]">
              <div className="text-[11px] font-bold tracking-wider uppercase">
                Evidence &amp; Audit Trail · {dispute.disputeId}
              </div>
            </div>

            <div className="p-4 space-y-4">
              {dispute.courierFallbackUsed ? (
                <div className="rounded border border-amber-300 bg-amber-50 p-3 text-[11px] text-[#1C1917] space-y-1">
                  <div className="flex items-center gap-1.5 font-bold text-[#C2410C]">
                    <ShieldAlert className="h-3.5 w-3.5 shrink-0" />
                    Telemetry Fallback Certificate
                  </div>
                  <p className="text-[10px] leading-relaxed text-[#57534E]">
                    {order.courierPartner} SLA timeout. Fallback evidence binds 3DS2 ECI{' '}
                    {order.threeDsEci}, IP {order.customerIp}, and device {order.deviceFingerprint}.
                  </p>
                </div>
              ) : (
                <div>
                  <h3 className="text-[10px] font-bold tracking-wider uppercase text-[#1C1917]">
                    3. Embedded Proof of Delivery
                  </h3>
                  <div className="mt-1.5 overflow-hidden rounded border border-[#E2D8C8] bg-[#F3EDE2]">
                    <img
                      src={order.podImageUrl}
                      alt={`POD preview for ${order.orderId}`}
                      referrerPolicy="no-referrer"
                      className="w-full h-auto max-h-40 object-contain"
                    />
                  </div>
                </div>
              )}

              <div>
                <h3 className="text-[10px] font-bold tracking-wider uppercase text-[#1C1917]">
                  4. Audit Digest
                </h3>
                <div className="mt-1.5 space-y-1.5">
                  {logs.map((entry) => (
                    <div
                      key={entry.id}
                      className="rounded border border-[#E2D8C8] bg-[#FBF8F3] px-2.5 py-1.5"
                    >
                      <div className="flex items-center justify-between font-mono text-[10px] font-bold text-[#1C1917]">
                        <span>
                          0{entry.stepNumber}. {entry.nodeName}
                        </span>
                        <span className="inline-flex items-center gap-1 text-emerald-700">
                          <CheckCircle2 className="h-3 w-3" />
                          {entry.latencyMs}ms
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
