import React, { useEffect, useRef, useState } from 'react';
import {
  BookmarkCheck,
  Mic,
  MicOff,
  PhoneOff,
  Radio,
  Send,
  Trash2,
  Volume2,
  X,
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
import { useAuth } from '../contexts/AuthContext';
import { db, handleFirestoreError, OperationType } from '../firebase';
import {
  base64Int16ToFloat32,
  computeRmsLevel,
  float32ToInt16Base64,
} from '../utils/liveAudio';

interface TranscriptTurn {
  id: string;
  speaker: 'user' | 'assistant' | 'system';
  text: string;
}

interface SavedVoiceSession {
  id: string;
  uid: string;
  disputeId: string;
  summary: string;
  transcriptText: string;
  turnCount: number;
  createdAt?: { toDate?: () => Date } | null;
}

interface VoiceCopilotDrawerProps {
  open: boolean;
  onClose: () => void;
  disputeId?: string;
}

export function VoiceCopilotDrawer({ open, onClose, disputeId }: VoiceCopilotDrawerProps) {
  const { user, authReady } = useAuth();
  const [status, setStatus] = useState<'idle' | 'connecting' | 'connected' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);
  const [micActive, setMicActive] = useState(false);
  const [micLevel, setMicLevel] = useState(0);
  const [turns, setTurns] = useState<TranscriptTurn[]>([]);
  const [textDraft, setTextDraft] = useState('');
  const [savingSession, setSavingSession] = useState(false);
  const [savedBanner, setSavedBanner] = useState<string | null>(null);
  const [savedSessions, setSavedSessions] = useState<SavedVoiceSession[]>([]);
  const [fatalFirestoreError, setFatalFirestoreError] = useState<Error | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const mutedRef = useRef(false);
  const inputCtxRef = useRef<AudioContext | null>(null);
  const outputCtxRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const activeSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());

  mutedRef.current = muted;

  useEffect(() => {
    if (!authReady || !user || !open) {
      return;
    }

    const path = `users/${user.uid}/voiceSessions`;
    const q = query(collection(db, 'users', user.uid, 'voiceSessions'), where('uid', '==', user.uid));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const items: SavedVoiceSession[] = snapshot.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<SavedVoiceSession, 'id'>),
        }));
        items.sort((a, b) => {
          const tA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0;
          const tB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 0;
          return tB - tA;
        });
        setSavedSessions(items.slice(0, 8));
      },
      (err) => {
        try {
          handleFirestoreError(err, OperationType.LIST, path);
        } catch (wrapped) {
          setFatalFirestoreError(wrapped as Error);
        }
      }
    );

    return () => unsubscribe();
  }, [authReady, user, open]);

  if (fatalFirestoreError) {
    throw fatalFirestoreError;
  }

  const stopAllPlayback = () => {
    for (const src of activeSourcesRef.current) {
      try {
        src.stop();
      } catch {
        // Ignore already-stopped nodes
      }
    }
    activeSourcesRef.current.clear();
    nextStartTimeRef.current = 0;
  };

  const cleanupSession = () => {
    stopAllPlayback();

    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) {
        track.stop();
      }
      streamRef.current = null;
    }
    if (inputCtxRef.current) {
      void inputCtxRef.current.close().catch(() => {});
      inputCtxRef.current = null;
    }
    if (outputCtxRef.current) {
      void outputCtxRef.current.close().catch(() => {});
      outputCtxRef.current = null;
    }
    if (wsRef.current) {
      try {
        wsRef.current.close();
      } catch {
        // Ignore close error
      }
      wsRef.current = null;
    }

    setMicActive(false);
    setMicLevel(0);
    setStatus('idle');
  };

  useEffect(() => {
    return () => {
      cleanupSession();
    };
  }, []);

  const appendTurnText = (speaker: 'user' | 'assistant' | 'system', chunk: string) => {
    const clean = chunk;
    if (!clean) return;
    setTurns((prev) => {
      const last = prev[prev.length - 1];
      if (last && last.speaker === speaker && speaker !== 'system') {
        return [
          ...prev.slice(0, -1),
          { ...last, text: `${last.text}${clean}` },
        ];
      }
      return [...prev, { id: `${Date.now()}_${Math.random()}`, speaker, text: clean }];
    });
  };

  const playPcm24k = (base64Pcm: string) => {
    const ctx = outputCtxRef.current;
    if (!ctx) return;

    const samples = base64Int16ToFloat32(base64Pcm);
    if (samples.length === 0) return;

    const audioBuffer = ctx.createBuffer(1, samples.length, 24000);
    audioBuffer.getChannelData(0).set(samples);

    const source = ctx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(ctx.destination);

    const startAt = Math.max(ctx.currentTime, nextStartTimeRef.current);
    source.start(startAt);
    nextStartTimeRef.current = startAt + audioBuffer.duration;

    activeSourcesRef.current.add(source);
    source.onended = () => {
      activeSourcesRef.current.delete(source);
    };
  };

  const startVoiceSession = async () => {
    cleanupSession();
    setErrorMsg(null);
    setSavedBanner(null);
    setStatus('connecting');
    setTurns([
      {
        id: `sys_${Date.now()}`,
        speaker: 'system',
        text: disputeId
          ? `Connecting gemini-3.8-live session scoped to ${disputeId}...`
          : 'Connecting gemini-3.8-live portfolio risk analyst session...',
      },
    ]);

    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const outputCtx = new AudioCtx({ sampleRate: 24000 });
      if (outputCtx.state === 'suspended') {
        await outputCtx.resume();
      }
      outputCtxRef.current = outputCtx;

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const queryStr = disputeId ? `?disputeId=${encodeURIComponent(disputeId)}` : '';
      const ws = new WebSocket(`${protocol}//${window.location.host}/api/live${queryStr}`);
      wsRef.current = ws;

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data as string) as {
            type?: string;
            data?: string;
            text?: string;
            message?: string;
          };

          if (msg.type === 'ready') {
            setStatus('connected');
            setTurns((prev) => [
              ...prev,
              {
                id: `ready_${Date.now()}`,
                speaker: 'system',
                text: 'Voice channel active. Speak naturally or send a question below.',
              },
            ]);
          } else if (msg.type === 'audio' && msg.data) {
            playPcm24k(msg.data);
          } else if (msg.type === 'interrupted') {
            stopAllPlayback();
          } else if (msg.type === 'input_transcript' && msg.text) {
            appendTurnText('user', msg.text);
          } else if (msg.type === 'output_transcript' && msg.text) {
            appendTurnText('assistant', msg.text);
          } else if (msg.type === 'error') {
            setErrorMsg(msg.message || 'Live voice session encountered an error.');
            setStatus('error');
          } else if (msg.type === 'closed') {
            setStatus('idle');
          }
        } catch {
          // Ignore malformed WS message
        }
      };

      ws.onerror = () => {
        setErrorMsg('WebSocket connection to /api/live failed.');
        setStatus('error');
      };

      ws.onclose = () => {
        setMicActive(false);
        setMicLevel(0);
        setStatus((prev) => (prev === 'error' ? 'error' : 'idle'));
      };

      // Initialize microphone 16kHz PCM stream if browser permissions/hardware permit
      if (navigator.mediaDevices?.getUserMedia) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            audio: {
              channelCount: 1,
              sampleRate: 16000,
              echoCancellation: true,
              noiseSuppression: true,
            },
          });
          streamRef.current = stream;
          const inputCtx = new AudioCtx({ sampleRate: 16000 });
          if (inputCtx.state === 'suspended') {
            await inputCtx.resume();
          }
          inputCtxRef.current = inputCtx;

          const source = inputCtx.createMediaStreamSource(stream);
          const processor = inputCtx.createScriptProcessor(4096, 1, 1);
          processorRef.current = processor;

          processor.onaudioprocess = (e) => {
            if (mutedRef.current) {
              setMicLevel(0);
              return;
            }
            const channel = e.inputBuffer.getChannelData(0);
            setMicLevel(computeRmsLevel(channel));
            if (wsRef.current?.readyState === WebSocket.OPEN) {
              const base64 = float32ToInt16Base64(channel);
              wsRef.current.send(JSON.stringify({ type: 'audio', data: base64 }));
            }
          };

          source.connect(processor);
          processor.connect(inputCtx.destination);
          setMicActive(true);
        } catch {
          setTurns((prev) => [
            ...prev,
            {
              id: `nomic_${Date.now()}`,
              speaker: 'system',
              text: 'Microphone unavailable — audio speaker output & typed voice prompts remain active.',
            },
          ]);
        }
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to start voice session');
      setStatus('error');
    }
  };

  const handleSendTextTurn = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = textDraft.trim();
    if (!clean || wsRef.current?.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify({ type: 'text', text: clean }));
    setTurns((prev) => [...prev, { id: `txt_${Date.now()}`, speaker: 'user', text: clean }]);
    setTextDraft('');
  };

  const handleSaveSessionToFirestore = async () => {
    if (!user || !user.emailVerified) return;
    const dialogTurns = turns.filter((t) => t.speaker !== 'system');
    if (dialogTurns.length === 0) return;

    setSavingSession(true);
    setSavedBanner(null);
    const sessionId = `vs_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const safeDisputeId = (disputeId || 'GENERAL').replace(/[^a-zA-Z0-9_\-]/g, '_').slice(0, 64);
    const transcriptText = dialogTurns
      .map((t) => `${t.speaker === 'user' ? 'Analyst' : 'RayGuard'}: ${t.text}`)
      .join('\n')
      .slice(0, 12000);
    const summarySource = dialogTurns.find((t) => t.speaker === 'assistant')?.text || dialogTurns[0].text;
    const summary = summarySource.trim().slice(0, 480) || 'Voice risk briefing';
    const path = `users/${user.uid}/voiceSessions/${sessionId}`;

    try {
      await setDoc(doc(db, 'users', user.uid, 'voiceSessions', sessionId), {
        uid: user.uid,
        disputeId: safeDisputeId,
        summary,
        transcriptText,
        turnCount: Math.max(1, Math.min(200, dialogTurns.length)),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setSavedBanner('Voice briefing saved to Firestore.');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, path);
    } finally {
      setSavingSession(false);
    }
  };

  const handleDeleteSession = async (sessionId: string) => {
    if (!user) return;
    const path = `users/${user.uid}/voiceSessions/${sessionId}`;
    try {
      await deleteDoc(doc(db, 'users', user.uid, 'voiceSessions', sessionId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, path);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label="Voice Risk Analyst">
      <div className="fixed inset-0 bg-[#1C1917]/40 backdrop-blur-xs" onClick={onClose} aria-hidden="true" />

      <aside className="relative z-10 flex h-full w-full max-w-md flex-col border-l border-[#E2D8C8] bg-[#FBF8F3] text-[#1C1917] shadow-2xl">
        {/* Drawer Header */}
        <div className="flex items-center justify-between border-b border-[#E2D8C8] bg-[#F3EDE2] px-5 py-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Radio className="h-4 w-4 text-[#EA580C] shrink-0" />
              <h2 className="text-sm font-semibold text-[#1C1917] truncate">Voice Analyst</h2>
            </div>
            <div className="mt-0.5 font-mono text-[11px] text-[#57534E] truncate">
              gemini-3.8-live · {disputeId ?? 'Portfolio'}
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close Voice Risk Analyst"
            className="rounded-lg border border-[#E2D8C8] bg-[#FFFDF9] p-1.5 text-[#57534E] hover:bg-[#EAE2D3] hover:text-[#1C1917] transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Controls Bar */}
        <div className="border-b border-[#E2D8C8] bg-[#FFFDF9] px-5 py-3.5 space-y-3">
          <div className="flex items-center justify-between gap-2">
            {status === 'connected' || status === 'connecting' ? (
              <div className="flex items-center gap-2 w-full">
                <button
                  type="button"
                  onClick={() => setMuted((m) => !m)}
                  disabled={!micActive}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg border border-[#E2D8C8] bg-[#F3EDE2] px-3 py-2 text-xs font-medium text-[#1C1917] hover:bg-[#EAE2D3] disabled:opacity-40 cursor-pointer"
                >
                  {muted ? <MicOff className="h-3.5 w-3.5 text-amber-700" /> : <Mic className="h-3.5 w-3.5 text-emerald-700" />}
                  {!micActive ? 'No Mic Detected' : muted ? 'Mic Muted' : 'Mute Mic'}
                </button>
                <button
                  type="button"
                  onClick={cleanupSession}
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-rose-300 bg-rose-50 px-3.5 py-2 text-xs font-medium text-rose-800 hover:bg-rose-100 cursor-pointer"
                >
                  <PhoneOff className="h-3.5 w-3.5" />
                  End Call
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={startVoiceSession}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#EA580C] px-4 py-2.5 text-xs font-semibold text-white hover:bg-[#C2410C] transition-colors cursor-pointer"
              >
                <Volume2 className="h-4 w-4" />
                Start Voice Session
              </button>
            )}
          </div>

          {status === 'connected' && (
            <div className="space-y-1">
              <div className="flex items-center justify-between font-mono text-[10px] text-[#57534E]">
                <span>16kHz Mic Input / 24kHz PCM Output</span>
                <span className="text-emerald-700 font-semibold">Live Connected</span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#E2D8C8]">
                <div
                  className="h-full bg-[#EA580C] transition-all duration-75"
                  style={{ width: `${Math.round(micLevel * 100)}%` }}
                />
              </div>
            </div>
          )}

          {errorMsg && (
            <div className="rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-xs text-rose-800">
              {errorMsg}
            </div>
          )}

          {savedBanner && (
            <div className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
              {savedBanner}
            </div>
          )}
        </div>

        {/* Live Transcript Feed */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          {turns.length === 0 ? (
            <div className="rounded-lg border border-[#E2D8C8] bg-[#FFFDF9] p-4 font-serif text-xs text-[#57534E] leading-relaxed">
              Speak or type below to review probabilities, cost gates, and network rebuttal strategies.
            </div>
          ) : (
            turns.map((turn) => (
              <div
                key={turn.id}
                className={`rounded-lg border px-3.5 py-2.5 text-xs leading-relaxed ${
                  turn.speaker === 'user'
                    ? 'ml-6 border-[#E2D8C8] bg-[#FFFDF9] text-[#1C1917]'
                    : turn.speaker === 'assistant'
                      ? 'mr-6 border-orange-300 bg-orange-50 text-[#1C1917]'
                      : 'border-[#E2D8C8] bg-[#F3EDE2] font-mono text-[11px] text-[#57534E]'
                }`}
              >
                {turn.speaker !== 'system' && (
                  <div className="mb-1 font-mono text-[10px] uppercase tracking-wider text-[#57534E]">
                    {turn.speaker === 'user' ? 'You' : 'RayGuard Analyst'}
                  </div>
                )}
                <p className="whitespace-pre-wrap">{turn.text}</p>
              </div>
            ))
          )}

          {/* Saved Firestore Voice Logs */}
          {user && savedSessions.length > 0 && (
            <div className="pt-4 border-t border-[#E2D8C8] space-y-2.5">
              <div className="font-mono text-[11px] uppercase tracking-wider text-[#57534E]">
                Saved Briefings
              </div>
              {savedSessions.map((sess) => (
                <div
                  key={sess.id}
                  className="rounded-lg border border-[#E2D8C8] bg-[#FFFDF9] p-3 text-xs space-y-1.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-[11px] text-[#C2410C] truncate">
                      {sess.disputeId} · {sess.turnCount} turns
                    </span>
                    <button
                      type="button"
                      onClick={() => handleDeleteSession(sess.id)}
                      aria-label={`Delete saved voice session ${sess.id}`}
                      className="text-[#78716C] hover:text-rose-700 transition-colors cursor-pointer"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <p className="text-[#57534E] line-clamp-2">{sess.summary}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer Text Fallback + Save to Firestore */}
        <div className="border-t border-[#E2D8C8] bg-[#F3EDE2] px-5 py-3.5 space-y-2.5">
          {status === 'connected' && (
            <form onSubmit={handleSendTextTurn} className="flex items-center gap-2">
              <input
                type="text"
                value={textDraft}
                onChange={(e) => setTextDraft(e.target.value)}
                placeholder="Ask a question..."
                className="flex-1 rounded-lg border border-[#E2D8C8] bg-[#FFFDF9] px-3 py-2 text-xs text-[#1C1917] placeholder:text-[#A8A29E] focus:border-[#EA580C] focus:outline-none"
              />
              <button
                type="submit"
                disabled={!textDraft.trim()}
                aria-label="Send prompt to live analyst"
                className="rounded-lg bg-[#EA580C] p-2 text-white hover:bg-[#C2410C] disabled:opacity-40 cursor-pointer"
              >
                <Send className="h-3.5 w-3.5" />
              </button>
            </form>
          )}

          {turns.some((t) => t.speaker !== 'system') && (
            <button
              type="button"
              onClick={handleSaveSessionToFirestore}
              disabled={!user || savingSession}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-[#E2D8C8] bg-[#FFFDF9] px-3 py-2 text-xs font-medium text-[#1C1917] hover:bg-[#EAE2D3] disabled:opacity-50 cursor-pointer"
            >
              <BookmarkCheck className="h-3.5 w-3.5 text-[#EA580C]" />
              {!user
                ? 'Sign in to Save Briefing'
                : savingSession
                  ? 'Saving...'
                  : 'Save Voice Briefing'}
            </button>
          )}
        </div>
      </aside>
    </div>
  );
}
