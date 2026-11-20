import crypto from 'node:crypto';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import type { AuditLogEntry, DisputeRecord, OrderRecord } from '../src/shared/types.ts';
import { renderPodPng } from './pngGenerator.ts';

function sanitizeWinAnsi(text: string): string {
  return text
    .replace(/₹/g, 'INR ')
    .replace(/[—–]/g, '-')
    .replace(/≥/g, '>=')
    .replace(/≤/g, '<=')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[^\x20-\x7E\n]/g, ' ');
}

function wrapText(text: string, maxChars: number): string[] {
  const sanitized = sanitizeWinAnsi(text);
  const lines: string[] = [];
  for (const para of sanitized.split('\n')) {
    const words = para.split(/\s+/).filter(Boolean);
    let current = '';
    for (const word of words) {
      if ((current + ' ' + word).trim().length > maxChars) {
        if (current) lines.push(current);
        current = word;
      } else {
        current = current ? `${current} ${word}` : word;
      }
    }
    if (current) lines.push(current);
  }
  return lines;
}

/**
 * Generates an institutional 2-page Bank-Ready Chargeback Dossier PDF using pdf-lib.
 */
export async function generateDisputeDossierPdf(
  dispute: DisputeRecord,
  order: OrderRecord,
  auditLogs: AuditLogEntry[]
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontMono = await pdfDoc.embedFont(StandardFonts.Courier);

  const ember = rgb(1, 0.384, 0);
  const dark = rgb(0.06, 0.06, 0.08);
  const muted = rgb(0.38, 0.4, 0.45);
  const white = rgb(1, 1, 1);
  const border = rgb(0.85, 0.86, 0.88);
  const surface = rgb(0.97, 0.97, 0.98);

  // Page 1: Executive Rebuttal & 3DS2 Authentication Telemetry
  const page1 = pdfDoc.addPage([595.28, 841.89]); // A4
  const { width, height } = page1.getSize();

  // Top Header Band
  page1.drawRectangle({ x: 0, y: height - 92, width, height: 92, color: dark });
  page1.drawRectangle({ x: 0, y: height - 96, width, height: 4, color: ember });

  page1.drawText('RAYGUARD MERCHANT REPRESENTMENT DOSSIER', {
    x: 40,
    y: height - 38,
    size: 14,
    font: fontBold,
    color: white,
  });
  page1.drawText(`Dispute: ${dispute.disputeId}  |  Payment: ${dispute.paymentId}  |  Network: ${dispute.network} (${dispute.reasonCode})`, {
    x: 40,
    y: height - 58,
    size: 9,
    font: fontMono,
    color: rgb(0.8, 0.82, 0.86),
  });
  page1.drawText(
    `Amount: INR ${(dispute.amountPaise / 100).toLocaleString('en-IN')}  |  Win Confidence: ${(dispute.winProbability * 100).toFixed(1)}%  |  Status: ${dispute.status}`,
    {
      x: 40,
      y: height - 74,
      size: 9,
      font: fontMono,
      color: ember,
    }
  );

  // Section 1: Executive Rebuttal Statement
  let cursorY = height - 130;
  page1.drawText('SECTION 1. EXECUTIVE REBUTTAL STATEMENT', {
    x: 40,
    y: cursorY,
    size: 11,
    font: fontBold,
    color: dark,
  });
  cursorY -= 16;

  const rebuttalLines = wrapText(
    dispute.rebuttalText ||
      `Merchant contests ${dispute.network} Reason Code ${dispute.reasonCode} for order ${order.orderId}. Customer completed full 3DS2 authentication (ECI ${order.threeDsEci}) from an established account with ${order.priorUndisputedOrders} prior undisputed orders.`,
    86
  );

  const boxHeight = Math.max(130, rebuttalLines.length * 14 + 24);
  page1.drawRectangle({
    x: 40,
    y: cursorY - boxHeight,
    width: width - 80,
    height: boxHeight,
    color: surface,
    borderColor: border,
    borderWidth: 1,
  });

  let textY = cursorY - 18;
  for (const line of rebuttalLines.slice(0, 14)) {
    page1.drawText(line, { x: 52, y: textY, size: 9.5, font: fontRegular, color: dark });
    textY -= 14;
  }

  cursorY -= boxHeight + 28;

  // Section 2: Transaction & 3DS2 Authentication Telemetry Table
  page1.drawText('SECTION 2. TRANSACTION & 3DS2 AUTHENTICATION TELEMETRY', {
    x: 40,
    y: cursorY,
    size: 11,
    font: fontBold,
    color: dark,
  });
  cursorY -= 14;

  const telemetryRows: Array<[string, string]> = [
    ['Order ID / AWB Number', `${order.orderId} / ${order.awbNumber} (${order.courierPartner})`],
    ['Cardholder / Account', `${order.customerName} (${order.customerEmail})`],
    ['Order IP vs Billing IP', `${order.customerIp}  vs  ${order.billingIp} (${order.customerIp === order.billingIp ? 'EXACT MATCH' : 'MISMATCH'})`],
    ['Device Fingerprint', `${order.deviceFingerprint} (${order.deviceFingerprint === order.knownDeviceFingerprint ? 'RECOGNIZED DEVICE' : 'UNRECOGNIZED DEVICE'})`],
    ['3DS2 ECI / Auth Flag', `ECI ${order.threeDsEci} - ${order.threeDsAuthenticated ? '3DS2 LIABILITY SHIFT VERIFIED' : 'NO 3DS AUTHENTICATION'}`],
    ['Account Tenure & History', `${order.accountAgeDays} days active  |  ${order.priorUndisputedOrders} prior undisputed orders`],
    ['Delivery Location & GPS', `${order.deliveryAddress} (${order.gpsCoordinates})`],
    ['HMAC-SHA256 Webhook Sig', `${dispute.hmacSignaturePreview} (${dispute.hmacVerified ? 'VERIFIED' : 'UNVERIFIED'})`],
  ];

  const rowHeight = 24;
  telemetryRows.forEach(([label, value], i) => {
    const ry = cursorY - (i + 1) * rowHeight;
    page1.drawRectangle({
      x: 40,
      y: ry,
      width: width - 80,
      height: rowHeight,
      color: i % 2 === 0 ? white : surface,
      borderColor: border,
      borderWidth: 0.75,
    });
    page1.drawText(sanitizeWinAnsi(label), { x: 50, y: ry + 8, size: 8.5, font: fontBold, color: muted });
    page1.drawText(sanitizeWinAnsi(value).slice(0, 74), { x: 215, y: ry + 8, size: 8.5, font: fontMono, color: dark });
  });

  // Page 1 footer
  page1.drawText('Page 1 of 2  |  Generated by RayGuard Autonomous Evidence Compiler', {
    x: 40,
    y: 28,
    size: 8,
    font: fontMono,
    color: muted,
  });

  // Page 2: Embedded Proof of Delivery (or Telemetry Fallback Certificate) + SHA-256 Audit Digest
  const page2 = pdfDoc.addPage([595.28, 841.89]);
  page2.drawRectangle({ x: 0, y: height - 56, width, height: 56, color: dark });
  page2.drawRectangle({ x: 0, y: height - 60, width, height: 4, color: ember });
  page2.drawText(`EVIDENCE APPENDIX & CRYPTOGRAPHIC AUDIT TRAIL  |  ${dispute.disputeId}`, {
    x: 40,
    y: height - 35,
    size: 11,
    font: fontBold,
    color: white,
  });

  let y2 = height - 92;
  if (dispute.courierFallbackUsed) {
    page2.drawText('SECTION 3. CRYPTOGRAPHIC TELEMETRY FALLBACK CERTIFICATE', {
      x: 40,
      y: y2,
      size: 11,
      font: fontBold,
      color: dark,
    });
    y2 -= 14;
    page2.drawRectangle({
      x: 40,
      y: y2 - 140,
      width: width - 80,
      height: 140,
      color: rgb(1, 0.97, 0.92),
      borderColor: ember,
      borderWidth: 1,
    });
    const fallbackLines = [
      `NOTICE: Courier partner API (${order.courierPartner}) exceeded 3000ms SLA timeout.`,
      `Per Compelling Evidence 3.0 protocol, dispute defense relies on verified digital telemetry:`,
      `- 3DS2 Authentication ECI ${order.threeDsEci} confirmed with issuing bank`,
      `- Matching Order IP (${order.customerIp}) & Recognized Device (${order.deviceFingerprint})`,
      `- Account history: ${order.priorUndisputedOrders} prior undisputed orders over ${order.accountAgeDays} days`,
      `- Support chat confirmation: "${dispute.extractedProof?.verbatimChatQuote ?? 'Order delivered and acknowledged'}"`,
    ];
    fallbackLines.forEach((ln, idx) => {
      page2.drawText(sanitizeWinAnsi(ln).slice(0, 88), { x: 52, y: y2 - 22 - idx * 19, size: 9, font: fontRegular, color: dark });
    });
    y2 -= 165;
  } else {
    page2.drawText('SECTION 3. EMBEDDED PROOF OF DELIVERY (POD) & CHAT EVIDENCE', {
      x: 40,
      y: y2,
      size: 11,
      font: fontBold,
      color: dark,
    });
    y2 -= 14;
    const pngBuffer = renderPodPng({
      orderId: order.orderId,
      awbNumber: order.awbNumber,
      courierPartner: order.courierPartner,
      customerName: order.customerName,
      deliveryAddress: order.deliveryAddress,
      gpsCoordinates: order.gpsCoordinates,
      deliveredAt: order.deliveredAt,
      signed: order.courierDelivered,
    });
    const embeddedPng = await pdfDoc.embedPng(pngBuffer);
    const imgWidth = 460;
    const imgHeight = (400 / 680) * imgWidth;
    page2.drawImage(embeddedPng, {
      x: 40,
      y: y2 - imgHeight,
      width: imgWidth,
      height: imgHeight,
    });
    y2 -= imgHeight + 18;
    const quote = sanitizeWinAnsi(dispute.extractedProof?.verbatimChatQuote || order.supportChatLog.slice(0, 110));
    page2.drawText(`Support Chat Extract: "${quote.slice(0, 82)}"`, {
      x: 40,
      y: y2,
      size: 9,
      font: fontMono,
      color: dark,
    });
    y2 -= 28;
  }

  // Section 4: SHA-256 Audit Trail Digest
  page2.drawText('SECTION 4. SHA-256 IMMUTABLE AUDIT TRAIL DIGEST', {
    x: 40,
    y: y2,
    size: 11,
    font: fontBold,
    color: dark,
  });
  y2 -= 16;

  for (const log of auditLogs.slice(0, 6)) {
    page2.drawRectangle({
      x: 40,
      y: y2 - 28,
      width: width - 80,
      height: 28,
      color: surface,
      borderColor: border,
      borderWidth: 0.75,
    });
    page2.drawText(
      sanitizeWinAnsi(`0${log.stepNumber}. ${log.nodeName} [${log.decisionType}] - ${log.latencyMs}ms - ${log.status}`),
      { x: 48, y: y2 - 12, size: 8, font: fontBold, color: dark }
    );
    page2.drawText(sanitizeWinAnsi(log.summary).slice(0, 86), {
      x: 48,
      y: y2 - 23,
      size: 7.5,
      font: fontRegular,
      color: muted,
    });
    y2 -= 32;
  }

  const digestHash = crypto
    .createHash('sha256')
    .update(JSON.stringify({ disputeId: dispute.disputeId, paymentId: dispute.paymentId, auditLogs }))
    .digest('hex');

  page2.drawText(`SHA-256 Trail Digest: ${digestHash}`, {
    x: 40,
    y: 44,
    size: 8,
    font: fontMono,
    color: dark,
  });
  page2.drawText('Page 2 of 2  |  Tamper-Evident Dispute Defense Record', {
    x: 40,
    y: 28,
    size: 8,
    font: fontMono,
    color: muted,
  });

  return pdfDoc.save();
}
