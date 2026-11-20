import React, { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
  quotaExceeded: boolean;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = {
    hasError: false,
    message: '',
    quotaExceeded: false,
  };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    const raw = error?.message || 'Unexpected application error';
    let formatted = raw;
    let quotaExceeded = raw.includes('Quota exceeded');

    try {
      const parsed = JSON.parse(raw) as { error?: string; operationType?: string; path?: string };
      if (parsed?.error) {
        quotaExceeded = quotaExceeded || parsed.error.includes('Quota exceeded');
        formatted = `Firestore ${parsed.operationType ?? 'operation'} error on ${parsed.path ?? 'collection'}: ${parsed.error}`;
      }
    } catch {
      // Plain error message
    }

    return {
      hasError: true,
      message: formatted,
      quotaExceeded,
    };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('RayGuard ErrorBoundary caught error:', error, info.componentStack);
  }

  handleReset = () => {
    this.setState({ hasError: false, message: '', quotaExceeded: false });
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div className="min-h-screen bg-[#FBF8F3] text-[#1C1917] flex items-center justify-center p-6">
        <div className="max-w-lg w-full rounded-lg border border-rose-300 bg-[#FFFDF9] p-6 space-y-4 shadow-sm">
          <div className="flex items-center gap-3 text-rose-700">
            <AlertTriangle className="h-5 w-5 shrink-0" />
            <h1 className="text-base font-semibold text-[#1C1917]">Application Error Detected</h1>
          </div>
          <p className="text-xs font-mono text-[#57534E] leading-relaxed break-words">
            {this.state.message}
          </p>
          {this.state.quotaExceeded && (
            <p className="text-xs text-amber-800 leading-relaxed">
              Firestore daily free-tier quota was reached. Quota resets tomorrow, or you can upgrade
              your Firebase database plan in the Firebase Console.
            </p>
          )}
          <div className="pt-2 flex items-center gap-3">
            <button
              type="button"
              onClick={this.handleReset}
              className="inline-flex items-center gap-2 rounded-lg border border-[#EA580C] bg-[#EA580C] px-4 py-2 text-xs font-medium text-white hover:bg-[#C2410C] transition-colors cursor-pointer"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Retry Workspace
            </button>
          </div>
        </div>
      </div>
    );
  }
}
