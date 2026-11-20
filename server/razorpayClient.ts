export interface RazorpayConfig {
  keyId: string;
  keySecret: string;
  webhookSecret: string;
  isConfigured: boolean;
  isTestMode: boolean;
  hasCustomWebhookSecret: boolean;
}

export interface RazorpayPaymentLookupResult {
  liveApiUsed: boolean;
  paymentStatus?: string;
  method?: string;
  network?: 'Visa' | 'Mastercard' | 'RuPay' | string;
  orderId?: string;
  amountPaise?: number;
  email?: string;
  contact?: string;
  customerName?: string;
  deliveryAddress?: string;
  notes?: Record<string, string>;
  reason?: string;
}

export interface RazorpayContestResult {
  syncedWithRazorpay: boolean;
  mode: 'RAZORPAY_TEST_API' | 'RAZORPAY_LIVE_API' | 'LOCAL_LEDGER' | 'LOCAL_FALLBACK';
  razorpayStatus?: string;
  statusCode?: number;
  message: string;
}

export type FetchLike = typeof fetch;

const DEFAULT_WEBHOOK_SECRET = 'rzp_test_whsec_rayguard_2026';

function isNonPlaceholder(val: string | undefined): val is string {
  if (!val) return false;
  const trimmed = val.trim();
  return trimmed.length > 0 && !trimmed.startsWith('MY_');
}

function normalizeNetworkName(raw: string | undefined): 'Visa' | 'Mastercard' | 'RuPay' | string | undefined {
  if (!raw) return undefined;
  const lower = raw.trim().toLowerCase();
  if (lower.includes('visa')) return 'Visa';
  if (lower.includes('master')) return 'Mastercard';
  if (lower.includes('rupay')) return 'RuPay';
  return raw;
}

export function getRazorpayConfig(
  env: Record<string, string | undefined> = process.env
): RazorpayConfig {
  const keyId = isNonPlaceholder(env.RAZORPAY_KEY_ID) ? env.RAZORPAY_KEY_ID.trim() : '';
  const keySecret = isNonPlaceholder(env.RAZORPAY_KEY_SECRET)
    ? env.RAZORPAY_KEY_SECRET.trim()
    : '';
  const customWebhook = isNonPlaceholder(env.RAZORPAY_WEBHOOK_SECRET)
    ? env.RAZORPAY_WEBHOOK_SECRET.trim()
    : '';

  const isConfigured = Boolean(keyId && keySecret);
  const isTestMode = keyId.startsWith('rzp_test_');

  return {
    keyId,
    keySecret,
    webhookSecret: customWebhook || DEFAULT_WEBHOOK_SECRET,
    isConfigured,
    isTestMode,
    hasCustomWebhookSecret: Boolean(customWebhook && customWebhook !== DEFAULT_WEBHOOK_SECRET),
  };
}

export function buildRazorpayBasicAuthHeader(keyId: string, keySecret: string): string {
  const token = Buffer.from(`${keyId}:${keySecret}`, 'utf8').toString('base64');
  return `Basic ${token}`;
}

function cleanOptionalText(val: unknown): string | undefined {
  if (typeof val !== 'string') return undefined;
  const trimmed = val.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

async function fetchLinkedRazorpayCustomerName(
  customerId: string,
  config: RazorpayConfig,
  fetchImpl: FetchLike
): Promise<string | undefined> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 2500);
  try {
    const res = await fetchImpl(
      `https://api.razorpay.com/v1/customers/${encodeURIComponent(customerId)}`,
      {
        method: 'GET',
        headers: {
          Authorization: buildRazorpayBasicAuthHeader(config.keyId, config.keySecret),
        },
        signal: controller.signal,
      }
    );
    if (!res.ok) return undefined;
    const customer = (await res.json()) as { name?: unknown };
    return cleanOptionalText(customer?.name);
  } catch {
    return undefined;
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchRazorpayPayment(
  paymentId: string,
  fetchImpl: FetchLike = fetch,
  env: Record<string, string | undefined> = process.env
): Promise<RazorpayPaymentLookupResult> {
  const config = getRazorpayConfig(env);
  if (!config.isConfigured) {
    return {
      liveApiUsed: false,
      reason: 'RAZORPAY_KEYS_NOT_CONFIGURED',
    };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 3000);

  try {
    const res = await fetchImpl(
      `https://api.razorpay.com/v1/payments/${encodeURIComponent(paymentId)}`,
      {
        method: 'GET',
        headers: {
          Authorization: buildRazorpayBasicAuthHeader(config.keyId, config.keySecret),
        },
        signal: controller.signal,
      }
    );

    if (!res.ok) {
      return {
        liveApiUsed: false,
        reason: `RAZORPAY_HTTP_${res.status}`,
      };
    }

    const data = (await res.json()) as {
      status?: string;
      method?: string;
      order_id?: string | null;
      amount?: number;
      email?: string;
      contact?: string;
      customer_id?: string | null;
      customer?: { name?: unknown } | null;
      card?: { network?: string };
      notes?: Record<string, unknown>;
    };

    const notes: Record<string, string> = {};
    if (data.notes && typeof data.notes === 'object' && !Array.isArray(data.notes)) {
      for (const [k, v] of Object.entries(data.notes)) {
        if (typeof v === 'string' || typeof v === 'number') {
          notes[k] = String(v);
        }
      }
    }

    let customerName =
      cleanOptionalText(notes.customer_name) ??
      cleanOptionalText(notes.name) ??
      cleanOptionalText(notes.full_name) ??
      cleanOptionalText(data.customer?.name);

    const linkedCustomerId = cleanOptionalText(data.customer_id);
    if (!customerName && linkedCustomerId) {
      customerName = await fetchLinkedRazorpayCustomerName(linkedCustomerId, config, fetchImpl);
    }

    const deliveryAddress =
      cleanOptionalText(notes.delivery_address) ??
      cleanOptionalText(notes.address) ??
      cleanOptionalText(notes.shipping_address);

    return {
      liveApiUsed: true,
      paymentStatus: data.status,
      method: data.method,
      network: normalizeNetworkName(data.card?.network),
      orderId: data.order_id ?? cleanOptionalText(notes.order_id),
      amountPaise: typeof data.amount === 'number' ? data.amount : undefined,
      email: data.email,
      contact: data.contact,
      customerName,
      deliveryAddress,
      notes,
    };
  } catch (err) {
    return {
      liveApiUsed: false,
      reason: err instanceof Error ? err.message : 'RAZORPAY_FETCH_ERROR',
    };
  } finally {
    clearTimeout(timer);
  }
}

export async function contestRazorpayDispute(
  params: {
    disputeId: string;
    summary: string;
    amountPaise: number;
  },
  fetchImpl: FetchLike = fetch,
  env: Record<string, string | undefined> = process.env
): Promise<RazorpayContestResult> {
  const config = getRazorpayConfig(env);
  if (!config.isConfigured) {
    return {
      syncedWithRazorpay: false,
      mode: 'LOCAL_LEDGER',
      message:
        'Dispute marked submitted locally. Add RAZORPAY_KEY_ID (rzp_test_...) and RAZORPAY_KEY_SECRET to sync with Razorpay Test API.',
    };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 3500);

  try {
    const res = await fetchImpl(
      `https://api.razorpay.com/v1/disputes/${encodeURIComponent(params.disputeId)}/contest`,
      {
        method: 'POST',
        headers: {
          Authorization: buildRazorpayBasicAuthHeader(config.keyId, config.keySecret),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'submit',
          amount: params.amountPaise,
          summary: params.summary.slice(0, 500),
        }),
        signal: controller.signal,
      }
    );

    if (!res.ok) {
      return {
        syncedWithRazorpay: false,
        mode: 'LOCAL_FALLBACK',
        statusCode: res.status,
        message: `Razorpay Test API returned HTTP ${res.status} (dispute ID may be synthetic); updated in local ledger.`,
      };
    }

    const data = (await res.json()) as { status?: string };
    return {
      syncedWithRazorpay: true,
      mode: config.isTestMode ? 'RAZORPAY_TEST_API' : 'RAZORPAY_LIVE_API',
      razorpayStatus: data.status ?? 'under_review',
      statusCode: res.status,
      message: `Submitted to Razorpay ${config.isTestMode ? 'Test Mode' : 'Live'} API (${data.status ?? 'under_review'}).`,
    };
  } catch (err) {
    return {
      syncedWithRazorpay: false,
      mode: 'LOCAL_FALLBACK',
      message: `Razorpay API unreachable (${err instanceof Error ? err.message : 'network error'}); updated in local ledger.`,
    };
  } finally {
    clearTimeout(timer);
  }
}
