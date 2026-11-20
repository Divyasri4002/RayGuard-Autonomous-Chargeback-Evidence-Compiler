import React, { useEffect, useState } from 'react';
import { CheckCircle2, Cloud, Save } from 'lucide-react';
import { doc, getDoc, onSnapshot, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import type { PolicyConfig } from '../shared/types';
import { ConsoleLayout } from '../components/ConsoleLayout';
import { RayLightButton } from '../components/RayLightButton';
import { useAuth } from '../contexts/AuthContext';
import { db, handleFirestoreError, OperationType } from '../firebase';

export function PoliciesPage() {
  const { user, authReady } = useAuth();
  const [policy, setPolicy] = useState<PolicyConfig | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedBanner, setSavedBanner] = useState<string | null>(null);
  const [cloudSynced, setCloudSynced] = useState(false);
  const [fatalError, setFatalError] = useState<Error | null>(null);

  useEffect(() => {
    fetch('/api/policies')
      .then((r) => r.json())
      .then((data) => {
        if (data.policy) setPolicy(data.policy);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!authReady || !user) {
      setCloudSynced(false);
      return;
    }

    const path = `users/${user.uid}/policies/default`;
    const unsubscribe = onSnapshot(
      doc(db, 'users', user.uid, 'policies', 'default'),
      (snap) => {
        if (!snap.exists()) return;
        const cloud = snap.data();
        setCloudSynced(true);
        setPolicy((prev) => ({
          gatewayDisputeFeeInr: Number(cloud.gatewayDisputeFeeInr ?? prev?.gatewayDisputeFeeInr ?? 500),
          internalOpsCostInr: Number(cloud.internalOpsCostInr ?? prev?.internalOpsCostInr ?? 100),
          autoContestThreshold: Number(cloud.autoContestThreshold ?? prev?.autoContestThreshold ?? 0.75),
          humanReviewFloor: Number(cloud.humanReviewFloor ?? prev?.humanReviewFloor ?? 0.4),
          courierTimeoutMs: Number(cloud.courierTimeoutMs ?? prev?.courierTimeoutMs ?? 3000),
          networkTemplates: {
            Visa: String(cloud.visaTemplate ?? prev?.networkTemplates.Visa ?? ''),
            Mastercard: String(cloud.mastercardTemplate ?? prev?.networkTemplates.Mastercard ?? ''),
            RuPay: String(cloud.rupayTemplate ?? prev?.networkTemplates.RuPay ?? ''),
          },
        }));
      },
      (err) => {
        try {
          handleFirestoreError(err, OperationType.GET, path);
        } catch (wrapped) {
          setFatalError(wrapped as Error);
        }
      }
    );

    return () => unsubscribe();
  }, [authReady, user]);

  if (fatalError) {
    throw fatalError;
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!policy) return;
    setSaving(true);
    setSavedBanner(null);

    const boundedPolicy: PolicyConfig = {
      gatewayDisputeFeeInr: Math.max(0, Math.min(5000, Number(policy.gatewayDisputeFeeInr) || 0)),
      internalOpsCostInr: Math.max(0, Math.min(2000, Number(policy.internalOpsCostInr) || 0)),
      autoContestThreshold: Math.max(0.5, Math.min(0.95, Number(policy.autoContestThreshold) || 0.75)),
      humanReviewFloor: Math.max(0.1, Math.min(0.65, Number(policy.humanReviewFloor) || 0.4)),
      courierTimeoutMs: Math.round(Math.max(500, Math.min(10000, Number(policy.courierTimeoutMs) || 3000))),
      networkTemplates: {
        Visa: (policy.networkTemplates.Visa.trim() || 'Visa Compelling Evidence 3.0').slice(0, 500),
        Mastercard: (policy.networkTemplates.Mastercard.trim() || 'Mastercard 4837').slice(0, 500),
        RuPay: (policy.networkTemplates.RuPay.trim() || 'NPCI RuPay 101').slice(0, 500),
      },
    };

    if (boundedPolicy.humanReviewFloor >= boundedPolicy.autoContestThreshold) {
      boundedPolicy.humanReviewFloor = Math.max(0.1, Number((boundedPolicy.autoContestThreshold - 0.1).toFixed(2)));
    }

    try {
      const res = await fetch('/api/policies', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(boundedPolicy),
      });
      const data = await res.json();
      if (res.ok && data.policy) {
        setPolicy(data.policy);
      }

      if (user && user.emailVerified) {
        const path = `users/${user.uid}/policies/default`;
        const policyRef = doc(db, 'users', user.uid, 'policies', 'default');
        const mutableFields = {
          gatewayDisputeFeeInr: boundedPolicy.gatewayDisputeFeeInr,
          internalOpsCostInr: boundedPolicy.internalOpsCostInr,
          autoContestThreshold: boundedPolicy.autoContestThreshold,
          humanReviewFloor: boundedPolicy.humanReviewFloor,
          courierTimeoutMs: boundedPolicy.courierTimeoutMs,
          visaTemplate: boundedPolicy.networkTemplates.Visa,
          mastercardTemplate: boundedPolicy.networkTemplates.Mastercard,
          rupayTemplate: boundedPolicy.networkTemplates.RuPay,
          updatedAt: serverTimestamp(),
        };

        try {
          const existingSnap = await getDoc(policyRef);
          if (existingSnap.exists()) {
            await updateDoc(policyRef, mutableFields);
          } else {
            await setDoc(policyRef, {
              uid: user.uid,
              ...mutableFields,
              createdAt: serverTimestamp(),
            });
          }
          setSavedBanner('Policies saved and synced to Firestore.');
        } catch (err) {
          handleFirestoreError(err, OperationType.WRITE, path);
        }
      } else {
        setSavedBanner('Policies saved.');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <ConsoleLayout
      breadcrumb="Policies"
      primaryAction={
        <RayLightButton to="/console" variant="surface" size="sm">
          Overview
        </RayLightButton>
      }
    >
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-2xl font-medium text-[#1C1917]">Guardrail Policies</h1>
          {user && (
            <div className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1.5 font-mono text-xs text-emerald-800">
              <Cloud className="h-3.5 w-3.5" />
              <span>{cloudSynced ? 'Firestore Synced' : 'Connected'}</span>
            </div>
          )}
        </div>

        {savedBanner && (
          <div className="flex items-center gap-2 rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>{savedBanner}</span>
          </div>
        )}

        {!policy ? (
          <div className="rounded-lg border border-[#E2D8C8] bg-[#FFFDF9] p-10 text-center text-sm text-[#57534E]">
            Loading policies...
          </div>
        ) : (
          <form onSubmit={handleSave} className="space-y-6">
            <section className="rounded-lg border border-[#E2D8C8] bg-[#FFFDF9] p-6 space-y-5 shadow-[0_1px_2px_rgba(28,25,23,0.03)]">
              <div className="border-b border-[#E2D8C8] pb-3.5">
                <h2 className="text-base font-medium text-[#1C1917]">Economics &amp; Thresholds</h2>
              </div>

              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <div>
                  <label htmlFor="gateway-fee" className="block font-mono text-xs text-[#57534E] mb-1.5">
                    Gateway Fee (₹)
                  </label>
                  <input
                    id="gateway-fee"
                    type="number"
                    min={0}
                    max={5000}
                    value={policy.gatewayDisputeFeeInr}
                    onChange={(e) =>
                      setPolicy({ ...policy, gatewayDisputeFeeInr: Number(e.target.value) })
                    }
                    className="w-full rounded-lg border border-[#E2D8C8] bg-[#FBF8F3] px-3.5 py-2 font-mono text-sm text-[#1C1917] focus:border-[#EA580C] focus:outline-none tabular-nums"
                  />
                </div>

                <div>
                  <label htmlFor="ops-cost" className="block font-mono text-xs text-[#57534E] mb-1.5">
                    Internal Ops Cost (₹)
                  </label>
                  <input
                    id="ops-cost"
                    type="number"
                    min={0}
                    max={2000}
                    value={policy.internalOpsCostInr}
                    onChange={(e) =>
                      setPolicy({ ...policy, internalOpsCostInr: Number(e.target.value) })
                    }
                    className="w-full rounded-lg border border-[#E2D8C8] bg-[#FBF8F3] px-3.5 py-2 font-mono text-sm text-[#1C1917] focus:border-[#EA580C] focus:outline-none tabular-nums"
                  />
                </div>

                <div>
                  <label htmlFor="auto-contest" className="block font-mono text-xs text-[#57534E] mb-1.5">
                    Auto-Contest Threshold
                  </label>
                  <input
                    id="auto-contest"
                    type="number"
                    step={0.01}
                    min={0.5}
                    max={0.95}
                    value={policy.autoContestThreshold}
                    onChange={(e) =>
                      setPolicy({ ...policy, autoContestThreshold: Number(e.target.value) })
                    }
                    className="w-full rounded-lg border border-[#E2D8C8] bg-[#FBF8F3] px-3.5 py-2 font-mono text-sm text-[#1C1917] focus:border-[#EA580C] focus:outline-none tabular-nums"
                  />
                </div>

                <div>
                  <label htmlFor="review-floor" className="block font-mono text-xs text-[#57534E] mb-1.5">
                    Human Review Floor
                  </label>
                  <input
                    id="review-floor"
                    type="number"
                    step={0.01}
                    min={0.1}
                    max={0.65}
                    value={policy.humanReviewFloor}
                    onChange={(e) =>
                      setPolicy({ ...policy, humanReviewFloor: Number(e.target.value) })
                    }
                    className="w-full rounded-lg border border-[#E2D8C8] bg-[#FBF8F3] px-3.5 py-2 font-mono text-sm text-[#1C1917] focus:border-[#EA580C] focus:outline-none tabular-nums"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label htmlFor="courier-timeout" className="block font-mono text-xs text-[#57534E] mb-1.5">
                    Courier SLA Timeout (ms)
                  </label>
                  <input
                    id="courier-timeout"
                    type="number"
                    min={500}
                    max={10000}
                    step={100}
                    value={policy.courierTimeoutMs}
                    onChange={(e) =>
                      setPolicy({ ...policy, courierTimeoutMs: Number(e.target.value) })
                    }
                    className="w-full rounded-lg border border-[#E2D8C8] bg-[#FBF8F3] px-3.5 py-2 font-mono text-sm text-[#1C1917] focus:border-[#EA580C] focus:outline-none tabular-nums"
                  />
                </div>
              </div>
            </section>

            <section className="rounded-lg border border-[#E2D8C8] bg-[#FFFDF9] p-6 space-y-4 shadow-[0_1px_2px_rgba(28,25,23,0.03)]">
              <div className="border-b border-[#E2D8C8] pb-3.5">
                <h2 className="text-base font-medium text-[#1C1917]">Network Templates</h2>
              </div>

              <div>
                <label htmlFor="tpl-visa" className="block font-mono text-xs text-[#57534E] mb-1.5">
                  Visa
                </label>
                <input
                  id="tpl-visa"
                  type="text"
                  maxLength={500}
                  value={policy.networkTemplates.Visa}
                  onChange={(e) =>
                    setPolicy({
                      ...policy,
                      networkTemplates: { ...policy.networkTemplates, Visa: e.target.value },
                    })
                  }
                  className="w-full rounded-lg border border-[#E2D8C8] bg-[#FBF8F3] px-3.5 py-2 text-sm text-[#1C1917] focus:border-[#EA580C] focus:outline-none"
                />
              </div>

              <div>
                <label htmlFor="tpl-mc" className="block font-mono text-xs text-[#57534E] mb-1.5">
                  Mastercard
                </label>
                <input
                  id="tpl-mc"
                  type="text"
                  maxLength={500}
                  value={policy.networkTemplates.Mastercard}
                  onChange={(e) =>
                    setPolicy({
                      ...policy,
                      networkTemplates: { ...policy.networkTemplates, Mastercard: e.target.value },
                    })
                  }
                  className="w-full rounded-lg border border-[#E2D8C8] bg-[#FBF8F3] px-3.5 py-2 text-sm text-[#1C1917] focus:border-[#EA580C] focus:outline-none"
                />
              </div>

              <div>
                <label htmlFor="tpl-rupay" className="block font-mono text-xs text-[#57534E] mb-1.5">
                  RuPay
                </label>
                <input
                  id="tpl-rupay"
                  type="text"
                  maxLength={500}
                  value={policy.networkTemplates.RuPay}
                  onChange={(e) =>
                    setPolicy({
                      ...policy,
                      networkTemplates: { ...policy.networkTemplates, RuPay: e.target.value },
                    })
                  }
                  className="w-full rounded-lg border border-[#E2D8C8] bg-[#FBF8F3] px-3.5 py-2 text-sm text-[#1C1917] focus:border-[#EA580C] focus:outline-none"
                />
              </div>
            </section>

            <div className="flex justify-end">
              <RayLightButton type="submit" disabled={saving}>
                <Save className="h-4 w-4" />
                {saving ? 'Saving...' : 'Save Policies'}
              </RayLightButton>
            </div>
          </form>
        )}
      </div>
    </ConsoleLayout>
  );
}
