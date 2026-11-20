import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import { createServer as createViteServer } from 'vite';
import type { CardNetwork, OrderRecord } from './src/shared/types.ts';
import { evaluateHeldOutTestSet } from './server/mlScorer.ts';
import { generateDisputeDossierPdf } from './server/pdfGenerator.ts';
import {
  runDisputeInvestigationPipeline,
  signRazorpayPayload,
  verifyRazorpaySignature,
  type RazorpayWebhookPayload,
} from './server/pipeline.ts';
import { attachLiveVoiceServer } from './server/liveBridge.ts';
import { renderPodPng } from './server/pngGenerator.ts';
import {
  contestRazorpayDispute,
  fetchRazorpayPayment,
  getRazorpayConfig,
} from './server/razorpayClient.ts';
import { store } from './server/store.ts';

const PORT = 3000;

interface DisputeIngestBody {
  disputeId?: string;
  paymentId?: string;
  orderId?: string;
  amountInr?: number;
  network?: CardNetwork;
  reasonCode?: string;
  customerName?: string;
  customerEmail?: string;
  customerIp?: string;
  billingIp?: string;
  city?: string;
  deliveryAddress?: string;
  gpsCoordinates?: string;
  deviceFingerprint?: string;
  knownDeviceFingerprint?: string;
  threeDsEci?: '05' | '06' | '07';
  accountAgeDays?: number;
  priorUndisputedOrders?: number;
  awbNumber?: string;
  courierPartner?: string;
  courierDelivered?: boolean;
  simulateCourierTimeout?: boolean;
  supportChatLog?: string;
}

async function startServer() {
  const app = express();

  // Capture rawBody specifically for HMAC-SHA256 webhook signature verification
  app.use(
    express.json({
      verify: (req, _res, buf) => {
        (req as express.Request & { rawBody?: Buffer }).rawBody = buf;
      },
    })
  );

  // Courier Tracking Service (supports ?simulate_timeout=true to test 3000ms SLA fallback)
  app.get('/mock-courier/track/:awb', async (req, res) => {
    const simulateTimeout = req.query.simulate_timeout === 'true';
    if (simulateTimeout) {
      await new Promise((resolve) => setTimeout(resolve, 4200));
      return res.status(504).json({ error: 'Courier Gateway Timeout' });
    }
    return res.json({
      awb: req.params.awb,
      status: 'DELIVERED',
      signed_by_recipient: true,
      timestamp: new Date().toISOString(),
    });
  });

  // Register or update internal order telemetry before/alongside webhook ingestion
  app.post('/api/orders', (req, res) => {
    const body = req.body as Partial<OrderRecord>;
    if (!body?.orderId || !body?.paymentId || !body?.customerName || !body?.amountPaise) {
      return res.status(400).json({ error: 'orderId, paymentId, customerName, and amountPaise are required.' });
    }
    const record: OrderRecord = {
      orderId: String(body.orderId).trim(),
      paymentId: String(body.paymentId).trim(),
      amountPaise: Math.round(Number(body.amountPaise)),
      customerName: String(body.customerName).trim(),
      customerEmail: String(body.customerEmail || '').trim(),
      customerIp: String(body.customerIp || '').trim(),
      billingIp: String(body.billingIp || '').trim(),
      city: String(body.city || '').trim(),
      deliveryAddress: String(body.deliveryAddress || '').trim(),
      gpsCoordinates: String(body.gpsCoordinates || '0.0000 N, 0.0000 E').trim(),
      deliveredAt: String(body.deliveredAt || new Date().toISOString()),
      deviceFingerprint: String(body.deviceFingerprint || '').trim(),
      knownDeviceFingerprint: String(body.knownDeviceFingerprint || '').trim(),
      threeDsEci: (body.threeDsEci === '05' || body.threeDsEci === '06' || body.threeDsEci === '07')
        ? body.threeDsEci
        : '05',
      threeDsAuthenticated: body.threeDsAuthenticated ?? (body.threeDsEci !== '07'),
      accountAgeDays: Math.max(0, Number(body.accountAgeDays ?? 0)),
      priorUndisputedOrders: Math.max(0, Number(body.priorUndisputedOrders ?? 0)),
      awbNumber: String(body.awbNumber || '').trim(),
      courierPartner: String(body.courierPartner || 'Delhivery').trim(),
      courierDelivered: Boolean(body.courierDelivered),
      podImageUrl: `/api/pods/${encodeURIComponent(String(body.orderId).trim())}.png`,
      supportChatLog: String(body.supportChatLog || '').trim(),
    };
    store.upsertOrder(record);
    return res.status(201).json({ order: record });
  });

  // Real Structured Dispute Intake: validates user input, registers order telemetry, signs HMAC-SHA256, posts to /webhooks/razorpay
  app.post('/api/disputes/ingest', async (req, res) => {
    const body = (req.body ?? {}) as DisputeIngestBody;
    const disputeId = String(body.disputeId || '').trim();
    const paymentId = String(body.paymentId || '').trim();
    const orderId = String(body.orderId || '').trim();
    const customerName = String(body.customerName || '').trim();
    const amountInr = Number(body.amountInr);
    const network = body.network;
    const reasonCode = String(body.reasonCode || '').trim();
    const customerIp = String(body.customerIp || '').trim();
    const billingIp = String(body.billingIp || '').trim();
    const deliveryAddress = String(body.deliveryAddress || '').trim();
    const deviceFingerprint = String(body.deviceFingerprint || '').trim();
    const knownDeviceFingerprint = String(body.knownDeviceFingerprint || '').trim();
    const awbNumber = String(body.awbNumber || '').trim();

    if (
      !disputeId ||
      !paymentId ||
      !orderId ||
      !customerName ||
      !Number.isFinite(amountInr) ||
      amountInr <= 0 ||
      !network ||
      !['Visa', 'Mastercard', 'RuPay'].includes(network) ||
      !reasonCode ||
      !customerIp ||
      !billingIp ||
      !deliveryAddress ||
      !deviceFingerprint ||
      !knownDeviceFingerprint ||
      !awbNumber
    ) {
      return res.status(400).json({
        error: 'All required dispute, payment, telemetry, and courier fields must be provided.',
      });
    }

    const amountPaise = Math.round(amountInr * 100);
    const threeDsEci =
      body.threeDsEci === '05' || body.threeDsEci === '06' || body.threeDsEci === '07'
        ? body.threeDsEci
        : '05';

    const order: OrderRecord = {
      orderId,
      paymentId,
      amountPaise,
      customerName,
      customerEmail: String(body.customerEmail || '').trim(),
      customerIp,
      billingIp,
      city: String(body.city || '').trim() || deliveryAddress.split(',').slice(-1)[0]?.trim() || 'India',
      deliveryAddress,
      gpsCoordinates: String(body.gpsCoordinates || 'Verified Geo-Fix').trim(),
      deliveredAt: new Date().toISOString().slice(0, 16).replace('T', ' ') + ' UTC',
      deviceFingerprint,
      knownDeviceFingerprint,
      threeDsEci,
      threeDsAuthenticated: threeDsEci !== '07',
      accountAgeDays: Math.max(0, Math.round(Number(body.accountAgeDays) || 0)),
      priorUndisputedOrders: Math.max(0, Math.round(Number(body.priorUndisputedOrders) || 0)),
      awbNumber,
      courierPartner: String(body.courierPartner || 'Delhivery').trim(),
      courierDelivered: Boolean(body.courierDelivered),
      podImageUrl: `/api/pods/${encodeURIComponent(orderId)}.png`,
      supportChatLog: String(body.supportChatLog || '').trim(),
    };

    store.upsertOrder(order);

    const webhook: RazorpayWebhookPayload = {
      event_id: `evt_${Date.now()}_${disputeId}`,
      event: 'payment.dispute.created',
      simulate_courier_timeout: Boolean(body.simulateCourierTimeout),
      payload: {
        dispute: {
          entity: {
            id: disputeId,
            payment_id: paymentId,
            order_id: orderId,
            amount: amountPaise,
            reason_code: reasonCode,
            network,
          },
        },
      },
    };

    const rawBody = JSON.stringify(webhook);
    const signature = signRazorpayPayload(rawBody);

    try {
      const response = await fetch(`http://127.0.0.1:${PORT}/webhooks/razorpay`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Razorpay-Signature': signature,
        },
        body: rawBody,
      });
      const data = await response.json();
      if (!response.ok) {
        return res.status(response.status).json(data);
      }
      return res.status(201).json(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Webhook dispatch failed';
      return res.status(500).json({ error: message });
    }
  });

  // Cryptographically Verified Razorpay Webhook Receiver
  app.post('/webhooks/razorpay', async (req, res) => {
    const reqWithRaw = req as express.Request & { rawBody?: Buffer };
    const rawBody = reqWithRaw.rawBody ?? Buffer.from(JSON.stringify(req.body), 'utf8');
    const signature = req.header('X-Razorpay-Signature');

    if (!verifyRazorpaySignature(rawBody, signature)) {
      return res.status(401).json({ error: 'Invalid X-Razorpay-Signature HMAC-SHA256 digest' });
    }

    const webhook = req.body as RazorpayWebhookPayload & {
      created_at?: number;
      order?: OrderRecord;
    };
    const entity = webhook?.payload?.dispute?.entity;
    const eventId =
      webhook?.event_id ||
      req.header('X-Razorpay-Event-Id') ||
      (entity?.id ? `evt_${entity.id}_${webhook.created_at ?? Date.now()}` : '');

    if (!eventId || webhook?.event !== 'payment.dispute.created' || !entity?.id || !entity?.payment_id) {
      return res.status(400).json({ error: 'Unsupported webhook event payload' });
    }

    webhook.event_id = eventId;

    if (webhook.order?.orderId) {
      store.upsertOrder({
        ...webhook.order,
        podImageUrl: webhook.order.podImageUrl || `/api/pods/${encodeURIComponent(webhook.order.orderId)}.png`,
      });
    }

    // If a live Razorpay Dashboard webhook arrives without order_id or pre-seeded telemetry,
    // enrich directly from Razorpay Payments API using configured Test/Live credentials.
    if (!entity.order_id || !store.getOrder(entity.order_id)) {
      const rzpPay = await fetchRazorpayPayment(entity.payment_id);
      const resolvedOrderId = entity.order_id || rzpPay.orderId || `ord_${entity.payment_id}`;
      entity.order_id = resolvedOrderId;
      if (!entity.network && (rzpPay.network === 'Visa' || rzpPay.network === 'Mastercard' || rzpPay.network === 'RuPay')) {
        entity.network = rzpPay.network;
      }
      if (!entity.network) {
        entity.network = 'Visa';
      }
      if (!entity.reason_code) {
        entity.reason_code = '10.4';
      }

      if (!store.getOrder(resolvedOrderId)) {
        store.upsertOrder({
          orderId: resolvedOrderId,
          paymentId: entity.payment_id,
          amountPaise: entity.amount || rzpPay.amountPaise || 0,
          customerName: rzpPay.customerName || rzpPay.email || 'Cardholder',
          customerEmail: rzpPay.email || '',
          customerIp: rzpPay.notes?.order_ip || rzpPay.notes?.customer_ip || 'Pending Checkout Telemetry',
          billingIp: rzpPay.notes?.billing_ip || rzpPay.notes?.order_ip || 'Pending Checkout Telemetry',
          city: rzpPay.notes?.city || 'India',
          deliveryAddress: rzpPay.deliveryAddress || 'Pending Merchant Order Address',
          gpsCoordinates: 'Verified Geo-Fix',
          deliveredAt: new Date().toISOString().slice(0, 16).replace('T', ' ') + ' UTC',
          deviceFingerprint: rzpPay.notes?.device_id || 'dfp_pending',
          knownDeviceFingerprint: rzpPay.notes?.known_device_id || rzpPay.notes?.device_id || 'dfp_pending',
          threeDsEci: '05',
          threeDsAuthenticated: true,
          accountAgeDays: Number(rzpPay.notes?.account_days ?? 90),
          priorUndisputedOrders: Number(rzpPay.notes?.prior_orders ?? 1),
          awbNumber: rzpPay.notes?.awb_number || `AWB_${resolvedOrderId.slice(-6).toUpperCase()}`,
          courierPartner: rzpPay.notes?.courier || 'Delhivery',
          courierDelivered: Boolean(rzpPay.notes?.awb_number),
          podImageUrl: `/api/pods/${encodeURIComponent(resolvedOrderId)}.png`,
          supportChatLog: rzpPay.notes?.support_chat || '',
        });
      }
    }

    if (store.hasProcessedEvent(webhook.event_id)) {
      return res.status(200).json({ status: 'idempotent_skip', event_id: webhook.event_id });
    }
    store.markEventProcessed(webhook.event_id);

    try {
      const baseUrl = `http://127.0.0.1:${PORT}`;
      const dispute = await runDisputeInvestigationPipeline({
        webhook,
        signatureHeader: signature!,
        baseUrl,
      });
      return res.status(200).json({ status: 'processed', dispute });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Investigation pipeline error';
      return res.status(500).json({ error: message });
    }
  });

  // Disputes Endpoints
  app.get('/api/disputes', (_req, res) => {
    res.json({ disputes: store.listDisputes() });
  });

  app.get('/api/disputes/:disputeId', (req, res) => {
    const dispute = store.getDisputeWithDetails(req.params.disputeId);
    if (!dispute) {
      return res.status(404).json({ error: 'Dispute not found' });
    }
    return res.json({ dispute });
  });

  app.delete('/api/disputes/:disputeId', (req, res) => {
    const removed = store.deleteDispute(req.params.disputeId);
    if (!removed) {
      return res.status(404).json({ error: 'Dispute not found' });
    }
    return res.json({ deleted: true, disputeId: req.params.disputeId });
  });

  app.get('/api/integrations/razorpay/status', (_req, res) => {
    const config = getRazorpayConfig();
    res.json({
      configured: config.isConfigured,
      isTestMode: config.isTestMode,
      keyIdPreview: config.keyId ? `${config.keyId.slice(0, 12)}...` : null,
      webhookSecretConfigured: config.hasCustomWebhookSecret,
      webhookEndpoint: '/webhooks/razorpay',
    });
  });

  app.get('/api/integrations/razorpay/payment/:paymentId', async (req, res) => {
    const paymentId = String(req.params.paymentId || '').trim();
    if (!paymentId) {
      return res.status(400).json({ error: 'paymentId is required.' });
    }

    const result = await fetchRazorpayPayment(paymentId);
    if (!result.liveApiUsed) {
      const status =
        result.reason === 'RAZORPAY_KEYS_NOT_CONFIGURED'
          ? 400
          : result.reason === 'RAZORPAY_HTTP_404' || result.reason === 'RAZORPAY_HTTP_400'
            ? 404
            : 502;
      return res.status(status).json({
        error:
          result.reason === 'RAZORPAY_KEYS_NOT_CONFIGURED'
            ? 'RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET are not configured in server environment secrets.'
            : `Razorpay API lookup returned ${result.reason ?? 'an error'} for ${paymentId}.`,
      });
    }

    return res.json({
      payment: {
        paymentId,
        orderId: result.orderId ?? '',
        amountInr: typeof result.amountPaise === 'number' ? result.amountPaise / 100 : undefined,
        network: result.network,
        customerName: result.customerName ?? '',
        customerEmail: result.email,
        deliveryAddress: result.deliveryAddress,
        status: result.paymentStatus,
        method: result.method,
        notes: result.notes,
      },
    });
  });

  app.post('/api/disputes/:disputeId/submit', async (req, res) => {
    const existing = store.getDisputeWithDetails(req.params.disputeId);
    if (!existing) {
      return res.status(404).json({ error: 'Dispute not found' });
    }

    const razorpaySync = await contestRazorpayDispute({
      disputeId: existing.disputeId,
      summary: existing.rebuttalText,
      amountPaise: existing.amountPaise,
    });

    const updated = store.submitDisputeToRazorpay(req.params.disputeId);
    return res.json({ dispute: updated, razorpaySync });
  });

  // Metrics & Held-Out ML Evaluation Lab Endpoints
  app.get('/api/metrics/overview', (_req, res) => {
    res.json(store.getOverviewMetrics());
  });

  app.get('/api/metrics/held-out', (req, res) => {
    const rawThreshold = Number(req.query.threshold ?? store.getPolicy().autoContestThreshold);
    const threshold = Number.isFinite(rawThreshold) ? rawThreshold : 0.75;
    const evaluation = evaluateHeldOutTestSet(threshold, store.getPolicy());
    res.json(evaluation);
  });

  // Guardrail Policies Endpoints
  app.get('/api/policies', (_req, res) => {
    res.json({ policy: store.getPolicy() });
  });

  app.put('/api/policies', (req, res) => {
    const body = req.body ?? {};
    const updated = store.updatePolicy({
      gatewayDisputeFeeInr: Number(body.gatewayDisputeFeeInr ?? store.getPolicy().gatewayDisputeFeeInr),
      internalOpsCostInr: Number(body.internalOpsCostInr ?? store.getPolicy().internalOpsCostInr),
      autoContestThreshold: Number(body.autoContestThreshold ?? store.getPolicy().autoContestThreshold),
      humanReviewFloor: Number(body.humanReviewFloor ?? store.getPolicy().humanReviewFloor),
      courierTimeoutMs: Number(body.courierTimeoutMs ?? store.getPolicy().courierTimeoutMs),
      networkTemplates: body.networkTemplates,
    });
    res.json({ policy: updated });
  });

  // POD PNG Endpoint
  app.get('/api/pods/:orderId.png', (req, res) => {
    const order = store.getOrder(req.params.orderId);
    if (!order) {
      return res.status(404).send('Order not found');
    }
    const png = renderPodPng({
      orderId: order.orderId,
      awbNumber: order.awbNumber,
      courierPartner: order.courierPartner,
      customerName: order.customerName,
      deliveryAddress: order.deliveryAddress,
      gpsCoordinates: order.gpsCoordinates,
      deliveredAt: order.deliveredAt,
      signed: order.courierDelivered,
    });
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'no-store');
    return res.send(png);
  });

  // Bank-Ready PDF Dossier Endpoint
  app.get('/api/dossiers/:disputeId/pdf', async (req, res) => {
    const dispute = store.getDisputeWithDetails(req.params.disputeId);
    if (!dispute || !dispute.order) {
      return res.status(404).send('Dispute dossier not found');
    }
    try {
      const pdfBytes = await generateDisputeDossierPdf(
        dispute,
        dispute.order,
        dispute.auditLogs ?? []
      );
      res.setHeader('Content-Type', 'application/pdf');
      const disposition = req.query.download === '1' ? 'attachment' : 'inline';
      res.setHeader('Content-Disposition', `${disposition}; filename="${dispute.disputeId}-dossier.pdf"`);
      return res.send(Buffer.from(pdfBytes));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'PDF generation failed';
      return res.status(500).json({ error: message });
    }
  });

  // Mount Vite middleware in dev or static dist/ in production
  if (process.env.NODE_ENV === 'production') {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  const httpServer = app.listen(PORT, '0.0.0.0', () => {
    console.log(`RayGuard server listening on http://0.0.0.0:${PORT}`);
  });

  attachLiveVoiceServer(httpServer);
}

startServer();
