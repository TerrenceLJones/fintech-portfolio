import { Route, Routes } from 'react-router';
import { ThemeProvider } from '@clearline/design-tokens';
import { AppShell, type NavigationShellItem } from '@clearline/ui';
import { LoginPage } from './pages/LoginPage';
import { SignUpPage } from './pages/SignUpPage';
import { VerifyEmailPage } from './pages/VerifyEmailPage';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage';
import { ResetPasswordPage } from './pages/ResetPasswordPage';
import { DashboardPage } from './pages/DashboardPage';
import { BusinessInfoStepPage } from './pages/onboarding/BusinessInfoStepPage';
import { BeneficialOwnersStepPage } from './pages/onboarding/BeneficialOwnersStepPage';
import { DocumentUploadStepPage } from './pages/onboarding/DocumentUploadStepPage';
import { ReviewStepPage } from './pages/onboarding/ReviewStepPage';
import { OnboardingStatusPage } from './pages/onboarding/OnboardingStatusPage';
import { RequireAuth } from './routes/RequireAuth';
import { SessionActivityBoundary } from './routes/SessionActivityBoundary';
import { OnboardingProgressBoundary } from './routes/OnboardingProgressBoundary';
import { RequireOnboarded } from './routes/RequireOnboarded';

// Static stand-in for the Employee item set until US-CW-006 wires up real role/session state
// and server-enforced authorization — AppShell/NavigationShell just render whatever list they're given.
const EMPLOYEE_NAV_ITEMS: NavigationShellItem[] = [
  { id: 'expenses', icon: 'file-text', label: 'My Expenses' },
  { id: 'cards', icon: 'copy', label: 'My Cards' },
];

export function App() {
  return (
    <ThemeProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignUpPage />} />
        <Route path="/verify" element={<VerifyEmailPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route element={<RequireAuth />}>
          <Route element={<SessionActivityBoundary />}>
            <Route path="/onboarding/status" element={<OnboardingStatusPage />} />
            <Route element={<OnboardingProgressBoundary />}>
              <Route path="/onboarding/business" element={<BusinessInfoStepPage />} />
              <Route path="/onboarding/owners" element={<BeneficialOwnersStepPage />} />
              <Route path="/onboarding/documents" element={<DocumentUploadStepPage />} />
              <Route path="/onboarding/review" element={<ReviewStepPage />} />
            </Route>
            <Route element={<RequireOnboarded />}>
              <Route
                element={
                  <AppShell
                    navItems={EMPLOYEE_NAV_ITEMS}
                    activeNavId="expenses"
                    title="Spend Dashboard"
                  />
                }
              >
                <Route path="/" element={<DashboardPage />} />
              </Route>
            </Route>
          </Route>
        </Route>
      </Routes>
    </ThemeProvider>
  );
}
