import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildRazorpayBasicAuthHeader,
  contestRazorpayDispute,
  fetchRazorpayPayment,
  getRazorpayConfig,
  type FetchLike,
} from './razorpayClient';

test('getRazorpayConfig treats empty and placeholder MY_* values as unconfigured', () => {
  const cfg = getRazorpayConfig({
    RAZORPAY_KEY_ID: 'MY_RAZORPAY_TEST_KEY_ID',
    RAZORPAY_KEY_SECRET: 'MY_RAZORPAY_TEST_KEY_SECRET',
    RAZORPAY_WEBHOOK_SECRET: '',
  });
  assert.equal(cfg.isConfigured, false);
  assert.equal(cfg.isTestMode, false);
  assert.equal(cfg.webhookSecret, 'rzp_test_whsec_rayguard_2026');
});

test('getRazorpayConfig detects Razorpay Test Mode credentials cleanly', () => {
  const cfg = getRazorpayConfig({
    RAZORPAY_KEY_ID: 'rzp_test_1234567890abcd',
    RAZORPAY_KEY_SECRET: 'secret_xyz_123',
    RAZORPAY_WEBHOOK_SECRET: 'whsec_custom_99',
  });
  assert.equal(cfg.isConfigured, true);
  assert.equal(cfg.isTestMode, true);
  assert.equal(cfg.hasCustomWebhookSecret, true);
  assert.equal(cfg.webhookSecret, 'whsec_custom_99');
});

test('fetchRazorpayPayment sends Basic Auth to Razorpay Payments API in Test Mode', async () => {
  let calledUrl = '';
  let authHeader = '';

  const mockFetch: FetchLike = async (input, init) => {
    calledUrl = String(input);
    authHeader = (init?.headers as Record<string, string>)?.Authorization ?? '';
    return new Response(
      JSON.stringify({
        id: 'pay_test_001',
        order_id: 'order_real_999',
        amount: 485000,
        status: 'captured',
        method: 'card',
        email: 'divya.sri@example.com',
        card: { network: 'MasterCard' },
        notes: { delivery_address: '42 Indiranagar, Bengaluru' },
      }),
      { status: 200 }
    );
  };

  const result = await fetchRazorpayPayment('pay_test_001', mockFetch, {
    RAZORPAY_KEY_ID: 'rzp_test_abc',
    RAZORPAY_KEY_SECRET: 'sec_123',
  });

  assert.equal(calledUrl, 'https://api.razorpay.com/v1/payments/pay_test_001');
  assert.equal(authHeader, buildRazorpayBasicAuthHeader('rzp_test_abc', 'sec_123'));
  assert.equal(result.liveApiUsed, true);
  assert.equal(result.paymentStatus, 'captured');
  assert.equal(result.network, 'Mastercard');
  assert.equal(result.orderId, 'order_real_999');
  assert.equal(result.amountPaise, 485000);
  assert.equal(result.email, 'divya.sri@example.com');
  assert.equal(result.customerName, undefined);
  assert.equal(result.deliveryAddress, '42 Indiranagar, Bengaluru');
});

test('fetchRazorpayPayment uses explicit customer name from trusted payment notes or linked customer info', async () => {
  const notesFetch: FetchLike = async () =>
    new Response(
      JSON.stringify({
        id: 'pay_notes_001',
        order_id: 'order_notes_001',
        amount: 250000,
        status: 'captured',
        method: 'card',
        email: 'dhivyasri2124@gmail.com',
        card: { network: 'Visa' },
        notes: { customer_name: '  Dhivya Sri  ', delivery_address: '12 Anna Nagar, Chennai' },
      }),
      { status: 200 }
    );

  const fromNotes = await fetchRazorpayPayment('pay_notes_001', notesFetch, {
    RAZORPAY_KEY_ID: 'rzp_test_abc',
    RAZORPAY_KEY_SECRET: 'sec_123',
  });
  assert.equal(fromNotes.liveApiUsed, true);
  assert.equal(fromNotes.customerName, 'Dhivya Sri');
  assert.equal(fromNotes.orderId, 'order_notes_001');
  assert.equal(fromNotes.amountPaise, 250000);
  assert.equal(fromNotes.network, 'Visa');

  const calledUrls: string[] = [];
  const linkedCustomerFetch: FetchLike = async (input) => {
    const url = String(input);
    calledUrls.push(url);
    if (url.endsWith('/v1/payments/pay_cust_001')) {
      return new Response(
        JSON.stringify({
          id: 'pay_cust_001',
          order_id: 'order_cust_001',
          amount: 199900,
          status: 'captured',
          method: 'card',
          email: 'dhivyasri2124@gmail.com',
          customer_id: 'cust_Linked123',
          card: { network: 'RuPay' },
          notes: {},
        }),
        { status: 200 }
      );
    }
    if (url.endsWith('/v1/customers/cust_Linked123')) {
      return new Response(
        JSON.stringify({
          id: 'cust_Linked123',
          name: 'Dhivya Sri',
          email: 'dhivyasri2124@gmail.com',
        }),
        { status: 200 }
      );
    }
    return new Response('{}', { status: 404 });
  };

  const fromLinkedCustomer = await fetchRazorpayPayment('pay_cust_001', linkedCustomerFetch, {
    RAZORPAY_KEY_ID: 'rzp_test_abc',
    RAZORPAY_KEY_SECRET: 'sec_123',
  });
  assert.deepEqual(calledUrls, [
    'https://api.razorpay.com/v1/payments/pay_cust_001',
    'https://api.razorpay.com/v1/customers/cust_Linked123',
  ]);
  assert.equal(fromLinkedCustomer.liveApiUsed, true);
  assert.equal(fromLinkedCustomer.customerName, 'Dhivya Sri');
  assert.equal(fromLinkedCustomer.network, 'RuPay');
  assert.equal(fromLinkedCustomer.orderId, 'order_cust_001');
  assert.equal(fromLinkedCustomer.amountPaise, 199900);
});

test('fetchRazorpayPayment never derives customer name from email when actual name is unavailable', async () => {
  const emailOnlyFetch: FetchLike = async (input) => {
    const url = String(input);
    if (url.includes('/v1/customers/')) {
      return new Response(JSON.stringify({ id: 'cust_NoName', name: '   ' }), { status: 200 });
    }
    return new Response(
      JSON.stringify({
        id: 'pay_email_only',
        order_id: 'order_email_only',
        amount: 320000,
        status: 'captured',
        method: 'upi',
        email: 'dhivyasri2124@gmail.com',
        customer_id: 'cust_NoName',
        notes: { customer_name: '   ' },
      }),
      { status: 200 }
    );
  };

  const result = await fetchRazorpayPayment('pay_email_only', emailOnlyFetch, {
    RAZORPAY_KEY_ID: 'rzp_test_abc',
    RAZORPAY_KEY_SECRET: 'sec_123',
  });
  assert.equal(result.liveApiUsed, true);
  assert.equal(result.email, 'dhivyasri2124@gmail.com');
  assert.equal(result.customerName, undefined);
  assert.equal(result.orderId, 'order_email_only');
  assert.equal(result.amountPaise, 320000);
});

test('fetchRazorpayPayment leaves customer name undefined when both name and email are unavailable', async () => {
  const minimalFetch: FetchLike = async () =>
    new Response(
      JSON.stringify({
        id: 'pay_minimal_001',
        order_id: 'order_minimal_001',
        amount: 150000,
        status: 'captured',
        method: 'card',
        card: { network: 'Visa' },
        notes: [],
      }),
      { status: 200 }
    );

  const result = await fetchRazorpayPayment('pay_minimal_001', minimalFetch, {
    RAZORPAY_KEY_ID: 'rzp_test_abc',
    RAZORPAY_KEY_SECRET: 'sec_123',
  });
  assert.equal(result.liveApiUsed, true);
  assert.equal(result.email, undefined);
  assert.equal(result.customerName, undefined);
  assert.equal(result.orderId, 'order_minimal_001');
  assert.equal(result.amountPaise, 150000);
  assert.equal(result.network, 'Visa');
});

test('contestRazorpayDispute posts to /contest endpoint and handles 404 synthetic IDs gracefully', async () => {
  const mockSuccessFetch: FetchLike = async () =>
    new Response(JSON.stringify({ id: 'disp_live_1', status: 'under_review' }), { status: 200 });

  const okResult = await contestRazorpayDispute(
    { disputeId: 'disp_live_1', summary: 'Compelling Evidence 3.0', amountPaise: 485000 },
    mockSuccessFetch,
    { RAZORPAY_KEY_ID: 'rzp_test_abc', RAZORPAY_KEY_SECRET: 'sec_123' }
  );
  assert.equal(okResult.syncedWithRazorpay, true);
  assert.equal(okResult.mode, 'RAZORPAY_TEST_API');

  const mockNotFoundFetch: FetchLike = async () =>
    new Response(JSON.stringify({ error: { description: 'Not found' } }), { status: 404 });

  const fallbackResult = await contestRazorpayDispute(
    { disputeId: 'disp_synth_1', summary: 'Synthetic case', amountPaise: 485000 },
    mockNotFoundFetch,
    { RAZORPAY_KEY_ID: 'rzp_test_abc', RAZORPAY_KEY_SECRET: 'sec_123' }
  );
  assert.equal(fallbackResult.syncedWithRazorpay, false);
  assert.equal(fallbackResult.mode, 'LOCAL_FALLBACK');
  assert.equal(fallbackResult.statusCode, 404);
});
