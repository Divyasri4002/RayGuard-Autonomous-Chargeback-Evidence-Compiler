import React, { useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import {
  Activity,
  ChevronRight,
  FileSearch,
  FlaskConical,
  LogIn,
  LogOut,
  Menu,
  Mic,
  ShieldCheck,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { RayLightButton } from './RayLightButton';
import { VoiceCopilotDrawer } from './VoiceCopilotDrawer';

interface ConsoleLayoutProps {
  breadcrumb: string;
  children: React.ReactNode;
  primaryAction?: React.ReactNode;
  voiceDisputeId?: string;
}

const NAV_ITEMS = [
  { to: '/console', label: 'Overview', icon: Activity },
  { to: '/disputes', label: 'Disputes', icon: FileSearch },
  { to: '/evaluation', label: 'ML Lab', icon: FlaskConical },
  { to: '/policies', label: 'Policies', icon: SlidersHorizontal },
];

export function ConsoleLayout({
  breadcrumb,
  children,
  primaryAction,
  voiceDisputeId,
}: ConsoleLayoutProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [voiceOpen, setVoiceOpen] = useState(false);
  const { user, profile, signingIn, authError, signInWithGoogle, signOutUser } = useAuth();

  const navContent = (
    <nav className="flex flex-col gap-1.5 px-3 py-5" aria-label="Console navigation">
      {NAV_ITEMS.map((item) => {
        const Icon = item.icon;
        return (
          <NavLink
            key={item.to}
            to={item.to}
            onClick={() => setMobileOpen(false)}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-lg px-3.5 py-2.5 text-sm font-medium transition-colors whitespace-nowrap ${
                isActive
                  ? 'bg-[#FFFDF9] text-[#1C1917] border border-[#EA580C]/45 shadow-[0_1px_2px_rgba(28,25,23,0.04)]'
                  : 'text-[#57534E] hover:bg-[#EAE2D3]/70 hover:text-[#1C1917] border border-transparent'
              }`
            }
          >
            <Icon className="h-4 w-4 shrink-0 text-[#EA580C]" />
            <span>{item.label}</span>
          </NavLink>
        );
      })}
    </nav>
  );

  const authFooterCard = (
    <div className="border-t border-[#E2D8C8] p-4 space-y-3">
      {user ? (
        <div className="rounded-lg border border-[#E2D8C8] bg-[#FFFDF9] p-3.5 space-y-3">
          <div className="flex items-center gap-2.5">
            {profile?.photoUrl || user.photoURL ? (
              <img
                src={profile?.photoUrl || user.photoURL || ''}
                alt={profile?.displayName || 'Analyst'}
                referrerPolicy="no-referrer"
                className="h-8 w-8 rounded-lg border border-[#E2D8C8] object-cover shrink-0"
              />
            ) : (
              <div className="h-8 w-8 rounded-lg border border-[#EA580C]/40 bg-[#F3EDE2] flex items-center justify-center font-mono text-xs text-[#1C1917] shrink-0">
                {(profile?.displayName || 'RA').slice(0, 2).toUpperCase()}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="text-xs font-medium text-[#1C1917] truncate">
                {profile?.displayName || user.displayName || 'Risk Analyst'}
              </div>
              <div className="font-mono text-[10px] text-emerald-700 truncate">
                Workspace Synced
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={signOutUser}
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-[#E2D8C8] bg-[#F3EDE2] px-2.5 py-1.5 text-xs font-medium text-[#57534E] hover:text-[#1C1917] transition-colors cursor-pointer"
          >
            <LogOut className="h-3 w-3" />
            Sign Out
          </button>
        </div>
      ) : (
        <div className="rounded-lg border border-[#E2D8C8] bg-[#FFFDF9] p-3.5 space-y-2.5">
          <div className="text-xs font-medium text-[#1C1917]">Analyst Workspace</div>
          <button
            type="button"
            onClick={signInWithGoogle}
            disabled={signingIn}
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-[#EA580C] px-3 py-2 text-xs font-semibold text-white hover:bg-[#C2410C] disabled:opacity-50 transition-colors cursor-pointer"
          >
            <LogIn className="h-3.5 w-3.5" />
            {signingIn ? 'Connecting...' : 'Sign in with Google'}
          </button>
          {authError && (
            <div className="text-[11px] text-rose-700 leading-snug">{authError}</div>
          )}
        </div>
      )}

      <div className="rounded-lg border border-[#E2D8C8] bg-[#FFFDF9] px-3.5 py-3">
        <div className="font-mono text-[11px] text-[#57534E]">Webhook Endpoint</div>
        <div className="mt-1 font-mono text-xs text-[#1C1917] truncate">POST /webhooks/razorpay</div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#FBF8F3] text-[#1C1917] flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:sticky lg:top-0 lg:h-screen w-64 shrink-0 flex-col border-r border-[#E2D8C8] bg-[#F3EDE2]">
        <div className="flex h-16 shrink-0 items-center border-b border-[#E2D8C8] px-5">
          <Link
            to="/"
            className="flex items-center gap-2.5 text-base font-semibold tracking-tight text-[#1C1917] whitespace-nowrap shrink-0"
          >
            <ShieldCheck className="h-5 w-5 text-[#EA580C]" />
            <span>RayGuard</span>
          </Link>
        </div>

        <div className="flex-1 overflow-y-auto">{navContent}</div>

        {authFooterCard}
      </aside>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div
            className="fixed inset-0 bg-[#1C1917]/40 backdrop-blur-xs"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />
          <aside className="relative z-10 flex w-64 flex-col border-r border-[#E2D8C8] bg-[#F3EDE2]">
            <div className="flex h-16 items-center justify-between border-b border-[#E2D8C8] px-5">
              <Link to="/" className="flex items-center gap-2 text-base font-semibold text-[#1C1917]">
                <ShieldCheck className="h-5 w-5 text-[#EA580C]" />
                <span>RayGuard</span>
              </Link>
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                aria-label="Close navigation menu"
                className="rounded-lg p-1.5 text-[#57534E] hover:bg-[#EAE2D3] hover:text-[#1C1917]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">{navContent}</div>
            {authFooterCard}
          </aside>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-4 border-b border-[#E2D8C8] bg-[#FBF8F3]/95 px-6 backdrop-blur-md">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              aria-label="Open navigation menu"
              className="lg:hidden rounded-lg border border-[#E2D8C8] bg-[#FFFDF9] p-2 text-[#57534E] hover:bg-[#F3EDE2]"
            >
              <Menu className="h-4 w-4" />
            </button>
            <div className="flex items-center gap-2 text-sm text-[#57534E] truncate">
              <Link to="/console" className="hover:text-[#1C1917] transition-colors whitespace-nowrap">
                Console
              </Link>
              <ChevronRight className="h-3.5 w-3.5 shrink-0 text-[#A8A29E]" />
              <span className="font-medium text-[#1C1917] truncate">{breadcrumb}</span>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => setVoiceOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#E2D8C8] bg-[#FFFDF9] px-3.5 py-1.5 text-xs font-medium text-[#1C1917] hover:border-[#EA580C] hover:bg-[#F3EDE2] transition-colors whitespace-nowrap cursor-pointer"
            >
              <Mic className="h-3.5 w-3.5 text-[#EA580C]" />
              <span>Voice Analyst</span>
            </button>

            {primaryAction ?? (
              <RayLightButton to="/" variant="ghost" size="sm">
                Overview
              </RayLightButton>
            )}
          </div>
        </header>

        <main className="flex-1 px-6 py-8 lg:px-10">{children}</main>
      </div>

      <VoiceCopilotDrawer
        open={voiceOpen}
        onClose={() => setVoiceOpen(false)}
        disputeId={voiceDisputeId}
      />
    </div>
  );
}
