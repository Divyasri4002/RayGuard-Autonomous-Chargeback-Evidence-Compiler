import type { Server as HttpServer } from 'node:http';
import { GoogleGenAI, Modality, type LiveServerMessage, type Session } from '@google/genai';
import { WebSocket, WebSocketServer } from 'ws';
import { store } from './store.ts';

function buildRiskAnalystInstruction(disputeId?: string): string {
  const metrics = store.getOverviewMetrics();
  const policy = store.getPolicy();
  const dispute = disputeId ? store.getDisputeWithDetails(disputeId) : undefined;

  const base =
    `You are RayGuard Voice Risk Analyst, a concise spoken FinTech chargeback and fraud advisor embedded in Razorpay dispute defense operations. ` +
    `Speak naturally and concisely in crisp spoken sentences without markdown bullets or symbols. ` +
    `Current portfolio stats: ${metrics.totalDisputes} total disputes, INR ${metrics.netRevenueRecoveredInr} net recovered, ` +
    `INR ${metrics.falsePositivePenaltyAvoidedInr} false-positive penalties avoided, ` +
    `${metrics.heldOutPrecision}% held-out precision, ${metrics.heldOutRecall}% recall, mean time to dossier ${metrics.meanTimeToDossierSec} seconds. ` +
    `Active thresholds: break-even contest cost INR ${policy.gatewayDisputeFeeInr + policy.internalOpsCostInr} ` +
    `(gateway INR ${policy.gatewayDisputeFeeInr} + ops INR ${policy.internalOpsCostInr}), auto-contest threshold ${(policy.autoContestThreshold * 100).toFixed(0)}%, ` +
    `human review floor ${(policy.humanReviewFloor * 100).toFixed(0)}%, courier SLA ${policy.courierTimeoutMs}ms.`;

  if (!dispute) {
    const recentIds = store
      .listDisputes()
      .slice(0, 5)
      .map((d) => `${d.disputeId} (${d.network}, INR ${(d.amountPaise / 100).toFixed(0)}, ${d.status})`)
      .join('; ');
    return `${base} Active disputes in queue: ${recentIds}.`;
  }

  const order = dispute.order;
  return (
    `${base} You are currently focused on dispute ${dispute.disputeId}: ` +
    `Network ${dispute.network} Reason Code ${dispute.reasonCode}, Amount INR ${(dispute.amountPaise / 100).toFixed(0)}, ` +
    `Status ${dispute.status}, Win Probability ${(dispute.winProbability * 100).toFixed(1)}%, ` +
    `Expected Value INR ${(dispute.netExpectedValuePaise / 100).toFixed(0)}, ` +
    `Courier Fallback Used: ${dispute.courierFallbackUsed ? 'Yes' : 'No'}. ` +
    (order
      ? `Customer ${order.customerName} in ${order.city}, IP match ${order.customerIp === order.billingIp}, ` +
        `3DS2 ECI ${order.threeDsEci} authenticated=${order.threeDsAuthenticated}, ` +
        `account tenure ${order.accountAgeDays} days with ${order.priorUndisputedOrders} prior undisputed orders. `
      : '') +
    `Rebuttal summary: ${dispute.rebuttalText}`
  );
}

function sendJson(ws: WebSocket, payload: Record<string, unknown>) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(payload));
  }
}

export function attachLiveVoiceServer(httpServer: HttpServer) {
  const wss = new WebSocketServer({ server: httpServer, path: '/api/live' });

  wss.on('connection', async (clientWs, req) => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
      sendJson(clientWs, {
        type: 'error',
        message: 'GEMINI_API_KEY is not configured in Secrets for Live Voice conversations.',
      });
      clientWs.close();
      return;
    }

    const requestUrl = new URL(req.url ?? '/api/live', 'http://localhost');
    const disputeId = requestUrl.searchParams.get('disputeId') || undefined;

    const ai = new GoogleGenAI({
      apiKey,
      apiVersion: 'v1beta',
      httpOptions: {
        apiVersion: 'v1beta',
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    let liveSession: Session | null = null;
    let closedByClient = false;

    try {
      liveSession = await ai.live.connect({
        model: 'gemini-3.8-live',
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: 'Zephyr' },
            },
          },
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          systemInstruction: buildRiskAnalystInstruction(disputeId),
        },
        callbacks: {
          onopen: () => {
            if (!closedByClient) {
              sendJson(clientWs, { type: 'ready', disputeId: disputeId ?? null });
            }
          },
          onmessage: (message: LiveServerMessage) => {
            if (closedByClient || clientWs.readyState !== WebSocket.OPEN) return;

            const sc = message.serverContent;
            if (sc?.interrupted) {
              sendJson(clientWs, { type: 'interrupted' });
            }
            if (sc?.inputTranscription?.text) {
              sendJson(clientWs, { type: 'input_transcript', text: sc.inputTranscription.text });
            }
            if (sc?.outputTranscription?.text) {
              sendJson(clientWs, { type: 'output_transcript', text: sc.outputTranscription.text });
            }
            if (sc?.turnComplete) {
              sendJson(clientWs, { type: 'turn_complete' });
            }
            const parts = sc?.modelTurn?.parts ?? [];
            for (const part of parts) {
              if (part.inlineData?.data) {
                sendJson(clientWs, { type: 'audio', data: part.inlineData.data });
              }
            }
          },
          onerror: (err: unknown) => {
            const eventLike = err as { error?: { message?: string }; message?: string };
            const msg =
              err instanceof Error
                ? err.message
                : eventLike?.error?.message || eventLike?.message || 'Gemini Live stream error';
            console.error('Gemini Live error:', msg);
            sendJson(clientWs, { type: 'error', message: msg });
          },
          onclose: (event: unknown) => {
            const closeLike = event as { code?: number; reason?: string };
            if (!closedByClient && clientWs.readyState === WebSocket.OPEN) {
              if (closeLike?.reason) {
                sendJson(clientWs, { type: 'error', message: `Live session closed (${closeLike.code ?? ''}): ${closeLike.reason}` });
              }
              sendJson(clientWs, { type: 'closed' });
              clientWs.close();
            }
          },
        },
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to connect to gemini-3.8-live';
      sendJson(clientWs, { type: 'error', message: msg });
      clientWs.close();
      return;
    }

    clientWs.on('message', (rawData) => {
      if (!liveSession || closedByClient) return;
      try {
        const parsed = JSON.parse(rawData.toString('utf8')) as {
          type?: string;
          data?: string;
          text?: string;
        };

        if (parsed.type === 'audio' && typeof parsed.data === 'string' && parsed.data.length > 0) {
          liveSession.sendRealtimeInput({
            audio: {
              data: parsed.data,
              mimeType: 'audio/pcm;rate=16000',
            },
          });
        } else if (parsed.type === 'text' && typeof parsed.text === 'string' && parsed.text.trim()) {
          liveSession.sendClientContent({
            turns: [{ role: 'user', parts: [{ text: parsed.text.trim() }] }],
            turnComplete: true,
          });
        }
      } catch {
        // Ignore malformed JSON frames
      }
    });

    clientWs.on('close', () => {
      closedByClient = true;
      try {
        liveSession?.close();
      } catch {
        // Ignore already-closed session
      }
    });
  });

  return wss;
}
