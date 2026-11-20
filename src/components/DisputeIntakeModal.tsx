import React, { useRef, useState } from 'react';
import { Loader2, X } from 'lucide-react';
import type { CardNetwork, DisputeRecord } from '../shared/types';
import { RayLightButton } from './RayLightButton';

interface DisputeIntakeModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: (dispute: DisputeRecord) => void;
}

const EMPTY_FORM = {
  disputeId: '',
  paymentId: '',
  orderId: '',
  amountInr: '',
  network: 'Visa' as CardNetwork,
  reasonCode: '',
  customerName: '',
  customerEmail: '',
  customerIp: '',
  billingIp: '',
  deliveryAddress: '',
  deviceFingerprint: '',
  knownDeviceFingerprint: '',
  threeDsEci: '05' as '05' | '06' | '07',
  accountAgeDays: '',
  priorUndisputedOrders: '',
  courierPartner: 'Delhivery',
  awbNumber: '',
  courierDelivered: true,
  simulateCourierTimeout: false,
  supportChatLog: '',
};

export function DisputeIntakeModal({ open, onClose, onSuccess }: DisputeIntakeModalProps) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [fetchingPayment, setFetchingPayment] = useState(false);
  const [lookupMessage, setLookupMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const customerNameAutoFilledRef = useRef(false);

  if (!open) return null;

  const handleFetchFromRazorpay = async () => {
    const payId = form.paymentId.trim();
    if (!payId) {
      setError('Enter a Razorpay Payment ID (pay_...) first.');
      return;
    }
    setError(null);
    setLookupMessage(null);
    setFetchingPayment(true);
    try {
      const res = await fetch(`/api/integrations/razorpay/payment/${encodeURIComponent(payId)}`);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Could not fetch payment from Razorpay');
      }
      const p = data.payment;
      const fetchedCustomerName =
        typeof p.customerName === 'string' ? p.customerName.trim() : '';
      const wasAutoFilled = customerNameAutoFilledRef.current;
      customerNameAutoFilledRef.current = Boolean(fetchedCustomerName);

      setForm((prev) => ({
        ...prev,
        orderId: p.orderId || prev.orderId,
        amountInr: p.amountInr !== undefined ? String(p.amountInr) : prev.amountInr,
        network:
          p.network === 'Visa' || p.network === 'Mastercard' || p.network === 'RuPay'
            ? p.network
            : prev.network,
        customerName: fetchedCustomerName
          ? fetchedCustomerName
          : wasAutoFilled
            ? ''
            : prev.customerName,
        customerEmail: p.customerEmail || prev.customerEmail,
        deliveryAddress: p.deliveryAddress || prev.deliveryAddress,
      }));
      setLookupMessage(
        fetchedCustomerName
          ? `Loaded live Razorpay payment (${p.status ?? 'fetched'}${p.network ? ` · ${p.network}` : ''}).`
          : `Loaded live Razorpay payment (${p.status ?? 'fetched'}${p.network ? ` · ${p.network}` : ''}) · Enter customer name manually.`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Razorpay lookup failed');
    } finally {
      setFetchingPayment(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const amountInr = Number(form.amountInr);
    if (!Number.isFinite(amountInr) || amountInr <= 0) {
      setError('Enter a valid dispute amount in INR.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/disputes/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          amountInr,
          accountAgeDays: Number(form.accountAgeDays || 0),
          priorUndisputedOrders: Number(form.priorUndisputedOrders || 0),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to ingest dispute webhook');
      }
      customerNameAutoFilledRef.current = false;
      setForm(EMPTY_FORM);
      onSuccess(data.dispute);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Submission error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#1C1917]/45 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="intake-modal-title"
    >
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-lg border border-[#E2D8C8] bg-[#FBF8F3] p-6 text-[#1C1917] shadow-xl">
        <div className="flex items-center justify-between border-b border-[#E2D8C8] pb-4">
          <div>
            <h2 id="intake-modal-title" className="text-lg font-medium text-[#1C1917]">
              Ingest Dispute Case
            </h2>
            <p className="mt-1 font-mono text-xs text-[#57534E]">
              Signs payload via HMAC-SHA256 and routes to /webhooks/razorpay
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close intake modal"
            className="rounded-lg border border-[#E2D8C8] bg-[#FFFDF9] p-2 text-[#57534E] hover:text-[#1C1917] hover:bg-[#F3EDE2] cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-5">
          {error && (
            <div className="rounded-lg border border-rose-300 bg-rose-50 px-4 py-2.5 text-xs text-rose-800">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label htmlFor="in-disp-id" className="block font-mono text-xs text-[#57534E] mb-1.5">
                Dispute ID *
              </label>
              <input
                id="in-disp-id"
                required
                value={form.disputeId}
                onChange={(e) => setForm({ ...form, disputeId: e.target.value })}
                placeholder="disp_..."
                className="w-full rounded-lg border border-[#E2D8C8] bg-[#FFFDF9] px-3 py-2 font-mono text-xs text-[#1C1917] placeholder:text-[#A8A29E] focus:border-[#EA580C] focus:outline-none"
              />
            </div>

            <div>
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <label htmlFor="in-pay-id" className="block font-mono text-xs text-[#57534E]">
                  Payment ID *
                </label>
                <button
                  type="button"
                  onClick={handleFetchFromRazorpay}
                  disabled={fetchingPayment || !form.paymentId.trim()}
                  aria-label="Fetch payment from Razorpay"
                  className="font-mono text-[11px] font-semibold text-[#C2410C] hover:text-[#1C1917] disabled:opacity-40 cursor-pointer whitespace-nowrap"
                >
                  {fetchingPayment ? 'Fetching...' : 'Fetch'}
                </button>
              </div>
              <input
                id="in-pay-id"
                required
                value={form.paymentId}
                onChange={(e) => {
                  setLookupMessage(null);
                  setForm({ ...form, paymentId: e.target.value });
                }}
                placeholder="pay_..."
                className="w-full rounded-lg border border-[#E2D8C8] bg-[#FFFDF9] px-3 py-2 font-mono text-xs text-[#1C1917] placeholder:text-[#A8A29E] focus:border-[#EA580C] focus:outline-none"
              />
              {lookupMessage && (
                <p className="mt-1 font-mono text-[10px] text-emerald-700">{lookupMessage}</p>
              )}
            </div>

            <div>
              <label htmlFor="in-order-id" className="block font-mono text-xs text-[#57534E] mb-1.5">
                Order ID *
              </label>
              <input
                id="in-order-id"
                required
                value={form.orderId}
                onChange={(e) => setForm({ ...form, orderId: e.target.value })}
                placeholder="ord_..."
                className="w-full rounded-lg border border-[#E2D8C8] bg-[#FFFDF9] px-3 py-2 font-mono text-xs text-[#1C1917] placeholder:text-[#A8A29E] focus:border-[#EA580C] focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label htmlFor="in-amount" className="block font-mono text-xs text-[#57534E] mb-1.5">
                Amount (INR) *
              </label>
              <input
                id="in-amount"
                type="number"
                min={1}
                step="any"
                required
                value={form.amountInr}
                onChange={(e) => setForm({ ...form, amountInr: e.target.value })}
                placeholder="4800"
                className="w-full rounded-lg border border-[#E2D8C8] bg-[#FFFDF9] px-3 py-2 font-mono text-xs text-[#1C1917] placeholder:text-[#A8A29E] focus:border-[#EA580C] focus:outline-none tabular-nums"
              />
            </div>

            <div>
              <label htmlFor="in-network" className="block font-mono text-xs text-[#57534E] mb-1.5">
                Network *
              </label>
              <select
                id="in-network"
                value={form.network}
                onChange={(e) => setForm({ ...form, network: e.target.value as CardNetwork })}
                className="w-full rounded-lg border border-[#E2D8C8] bg-[#FFFDF9] px-3 py-2 font-mono text-xs text-[#1C1917] focus:border-[#EA580C] focus:outline-none"
              >
                <option value="Visa">Visa</option>
                <option value="Mastercard">Mastercard</option>
                <option value="RuPay">RuPay</option>
              </select>
            </div>

            <div>
              <label htmlFor="in-reason" className="block font-mono text-xs text-[#57534E] mb-1.5">
                Reason Code *
              </label>
              <input
                id="in-reason"
                required
                value={form.reasonCode}
                onChange={(e) => setForm({ ...form, reasonCode: e.target.value })}
                placeholder="10.4"
                className="w-full rounded-lg border border-[#E2D8C8] bg-[#FFFDF9] px-3 py-2 font-mono text-xs text-[#1C1917] placeholder:text-[#A8A29E] focus:border-[#EA580C] focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="in-cust-name" className="block font-mono text-xs text-[#57534E] mb-1.5">
                Customer Name *
              </label>
              <input
                id="in-cust-name"
                required
                value={form.customerName}
                onChange={(e) => {
                  customerNameAutoFilledRef.current = false;
                  setForm({ ...form, customerName: e.target.value });
                }}
                placeholder="Full name"
                className="w-full rounded-lg border border-[#E2D8C8] bg-[#FFFDF9] px-3 py-2 text-xs text-[#1C1917] placeholder:text-[#A8A29E] focus:border-[#EA580C] focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="in-address" className="block font-mono text-xs text-[#57534E] mb-1.5">
                Delivery Address *
              </label>
              <input
                id="in-address"
                required
                value={form.deliveryAddress}
                onChange={(e) => setForm({ ...form, deliveryAddress: e.target.value })}
                placeholder="Street, City, PIN"
                className="w-full rounded-lg border border-[#E2D8C8] bg-[#FFFDF9] px-3 py-2 text-xs text-[#1C1917] placeholder:text-[#A8A29E] focus:border-[#EA580C] focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="in-cust-ip" className="block font-mono text-xs text-[#57534E] mb-1.5">
                Order IP *
              </label>
              <input
                id="in-cust-ip"
                required
                value={form.customerIp}
                onChange={(e) => setForm({ ...form, customerIp: e.target.value })}
                placeholder="49.36.x.x"
                className="w-full rounded-lg border border-[#E2D8C8] bg-[#FFFDF9] px-3 py-2 font-mono text-xs text-[#1C1917] placeholder:text-[#A8A29E] focus:border-[#EA580C] focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="in-bill-ip" className="block font-mono text-xs text-[#57534E] mb-1.5">
                Billing IP *
              </label>
              <input
                id="in-bill-ip"
                required
                value={form.billingIp}
                onChange={(e) => setForm({ ...form, billingIp: e.target.value })}
                placeholder="49.36.x.x"
                className="w-full rounded-lg border border-[#E2D8C8] bg-[#FFFDF9] px-3 py-2 font-mono text-xs text-[#1C1917] placeholder:text-[#A8A29E] focus:border-[#EA580C] focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label htmlFor="in-dfp" className="block font-mono text-xs text-[#57534E] mb-1.5">
                Session Device ID *
              </label>
              <input
                id="in-dfp"
                required
                value={form.deviceFingerprint}
                onChange={(e) => setForm({ ...form, deviceFingerprint: e.target.value })}
                placeholder="dfp_..."
                className="w-full rounded-lg border border-[#E2D8C8] bg-[#FFFDF9] px-3 py-2 font-mono text-xs text-[#1C1917] placeholder:text-[#A8A29E] focus:border-[#EA580C] focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="in-kdfp" className="block font-mono text-xs text-[#57534E] mb-1.5">
                Known Device ID *
              </label>
              <input
                id="in-kdfp"
                required
                value={form.knownDeviceFingerprint}
                onChange={(e) => setForm({ ...form, knownDeviceFingerprint: e.target.value })}
                placeholder="dfp_..."
                className="w-full rounded-lg border border-[#E2D8C8] bg-[#FFFDF9] px-3 py-2 font-mono text-xs text-[#1C1917] placeholder:text-[#A8A29E] focus:border-[#EA580C] focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="in-eci" className="block font-mono text-xs text-[#57534E] mb-1.5">
                3DS2 ECI *
              </label>
              <select
                id="in-eci"
                value={form.threeDsEci}
                onChange={(e) => setForm({ ...form, threeDsEci: e.target.value as '05' | '06' | '07' })}
                className="w-full rounded-lg border border-[#E2D8C8] bg-[#FFFDF9] px-3 py-2 font-mono text-xs text-[#1C1917] focus:border-[#EA580C] focus:outline-none"
              >
                <option value="05">05 (Authenticated)</option>
                <option value="06">06 (Attempted)</option>
                <option value="07">07 (Unauthenticated)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
            <div>
              <label htmlFor="in-age" className="block font-mono text-xs text-[#57534E] mb-1.5">
                Account Days
              </label>
              <input
                id="in-age"
                type="number"
                min={0}
                value={form.accountAgeDays}
                onChange={(e) => setForm({ ...form, accountAgeDays: e.target.value })}
                placeholder="180"
                className="w-full rounded-lg border border-[#E2D8C8] bg-[#FFFDF9] px-3 py-2 font-mono text-xs text-[#1C1917] placeholder:text-[#A8A29E] focus:border-[#EA580C] focus:outline-none tabular-nums"
              />
            </div>

            <div>
              <label htmlFor="in-prior" className="block font-mono text-xs text-[#57534E] mb-1.5">
                Prior Orders
              </label>
              <input
                id="in-prior"
                type="number"
                min={0}
                value={form.priorUndisputedOrders}
                onChange={(e) => setForm({ ...form, priorUndisputedOrders: e.target.value })}
                placeholder="3"
                className="w-full rounded-lg border border-[#E2D8C8] bg-[#FFFDF9] px-3 py-2 font-mono text-xs text-[#1C1917] placeholder:text-[#A8A29E] focus:border-[#EA580C] focus:outline-none tabular-nums"
              />
            </div>

            <div>
              <label htmlFor="in-courier" className="block font-mono text-xs text-[#57534E] mb-1.5">
                Courier *
              </label>
              <input
                id="in-courier"
                required
                value={form.courierPartner}
                onChange={(e) => setForm({ ...form, courierPartner: e.target.value })}
                className="w-full rounded-lg border border-[#E2D8C8] bg-[#FFFDF9] px-3 py-2 font-mono text-xs text-[#1C1917] focus:border-[#EA580C] focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="in-awb" className="block font-mono text-xs text-[#57534E] mb-1.5">
                AWB Number *
              </label>
              <input
                id="in-awb"
                required
                value={form.awbNumber}
                onChange={(e) => setForm({ ...form, awbNumber: e.target.value })}
                placeholder="DLV..."
                className="w-full rounded-lg border border-[#E2D8C8] bg-[#FFFDF9] px-3 py-2 font-mono text-xs text-[#1C1917] placeholder:text-[#A8A29E] focus:border-[#EA580C] focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label htmlFor="in-chat" className="block font-mono text-xs text-[#57534E] mb-1.5">
              Support Chat Transcript
            </label>
            <textarea
              id="in-chat"
              rows={2}
              value={form.supportChatLog}
              onChange={(e) => setForm({ ...form, supportChatLog: e.target.value })}
              placeholder="Paste customer support transcript excerpt..."
              className="w-full rounded-lg border border-[#E2D8C8] bg-[#FFFDF9] px-3 py-2 text-xs text-[#1C1917] placeholder:text-[#A8A29E] focus:border-[#EA580C] focus:outline-none"
            />
          </div>

          <div className="flex flex-wrap items-center gap-6 text-xs text-[#57534E]">
            <label className="inline-flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.courierDelivered}
                onChange={(e) => setForm({ ...form, courierDelivered: e.target.checked })}
                className="accent-[#EA580C]"
              />
              <span>Signed POD Available</span>
            </label>

            <label className="inline-flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.simulateCourierTimeout}
                onChange={(e) => setForm({ ...form, simulateCourierTimeout: e.target.checked })}
                className="accent-[#EA580C]"
              />
              <span>Test Courier SLA Timeout Fallback</span>
            </label>
          </div>

          <div className="flex items-center justify-end gap-3 border-t border-[#E2D8C8] pt-4">
            <RayLightButton variant="ghost" size="sm" onClick={onClose}>
              Cancel
            </RayLightButton>
            <RayLightButton type="submit" size="sm" disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Executing Pipeline...
                </>
              ) : (
                'Sign & Run Investigation'
              )}
            </RayLightButton>
          </div>
        </form>
      </div>
    </div>
  );
}
