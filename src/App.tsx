import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AuthProvider } from './contexts/AuthContext';
import { DisputeInspectorPage } from './pages/DisputeInspectorPage';
import { DisputesListPage } from './pages/DisputesListPage';
import { EvaluationLabPage } from './pages/EvaluationLabPage';
import { LandingPage } from './pages/LandingPage';
import { OverviewPage } from './pages/OverviewPage';
import { PoliciesPage } from './pages/PoliciesPage';

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/console" element={<OverviewPage />} />
            <Route path="/disputes" element={<DisputesListPage />} />
            <Route path="/disputes/:id" element={<DisputeInspectorPage />} />
            <Route path="/disputes/:id/:section" element={<DisputeInspectorPage />} />
            <Route path="/evaluation" element={<EvaluationLabPage />} />
            <Route path="/policies" element={<PoliciesPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ErrorBoundary>
  );
}
