import { Route, Routes } from 'react-router';
import { ThemeProvider } from '@clearline/design-tokens';
import { LoginPage } from './pages/LoginPage';
import { SignUpPage } from './pages/SignUpPage';
import { VerifyEmailPage } from './pages/VerifyEmailPage';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage';
import { ResetPasswordPage } from './pages/ResetPasswordPage';
import { DashboardPage } from './pages/DashboardPage';
import { ApprovalsPage } from './pages/ApprovalsPage';
import { NewPaymentPage } from './pages/payments/NewPaymentPage';
import { PaymentStatusPage } from './pages/payments/PaymentStatusPage';
import { PlaceholderPage } from './pages/PlaceholderPage';
import { BusinessInfoStepPage } from './pages/onboarding/BusinessInfoStepPage';
import { BeneficialOwnersStepPage } from './pages/onboarding/BeneficialOwnersStepPage';
import { DocumentUploadStepPage } from './pages/onboarding/DocumentUploadStepPage';
import { ReviewStepPage } from './pages/onboarding/ReviewStepPage';
import { OnboardingStatusPage } from './pages/onboarding/OnboardingStatusPage';
import { AppChrome } from './AppChrome';
import { RequireAuth } from './routes/RequireAuth';
import { RequirePermission } from './routes/RequirePermission';
import { SessionActivityBoundary } from './routes/SessionActivityBoundary';
import { OnboardingProgressBoundary } from './routes/OnboardingProgressBoundary';
import { RequireOnboarded } from './routes/RequireOnboarded';

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
            {/* RequireOnboarded gates the whole authenticated app: a user who hasn't finished
                onboarding is redirected to the wizard/status before any app chrome mounts, so the
                role-scoped nav and access-changed banner never flash for someone who doesn't belong
                in the app yet (US-CW-004 AC-09). */}
            <Route element={<RequireOnboarded />}>
              {/* AppChrome derives the role-scoped nav and access-changed banner from the live session
                  (US-CW-006 / US-CW-028); each gated section is additionally guarded server-side and by
                  RequirePermission below, so the client never is the security boundary. */}
              <Route element={<AppChrome />}>
                <Route path="/" element={<DashboardPage />} />
                <Route
                  path="/cards"
                  element={
                    <PlaceholderPage
                      title="My Cards"
                      icon="copy"
                      body="Your virtual and physical cards will live here."
                    />
                  }
                />
                <Route
                  element={
                    <RequirePermission permission="approvals:view" apiPath="/api/approvals" />
                  }
                >
                  <Route path="/approvals" element={<ApprovalsPage />} />
                </Route>
                <Route
                  element={
                    <RequirePermission
                      permission="payments:create"
                      apiPath="/api/payments/context"
                    />
                  }
                >
                  <Route path="/payments/new" element={<NewPaymentPage />} />
                  <Route path="/payments/:intentId" element={<PaymentStatusPage />} />
                </Route>
                <Route
                  element={
                    <RequirePermission
                      permission="reconciliation:view"
                      apiPath="/api/reconciliation"
                    />
                  }
                >
                  <Route
                    path="/reconciliation"
                    element={
                      <PlaceholderPage
                        title="Reconciliation"
                        icon="refresh"
                        body="Match transactions to expenses and close the books here."
                      />
                    }
                  />
                </Route>
                <Route
                  element={<RequirePermission permission="budget:view" apiPath="/api/budgets" />}
                >
                  <Route
                    path="/budget"
                    element={
                      <PlaceholderPage
                        title="Budget Management"
                        icon="bar-chart"
                        body="Track department budgets and thresholds here."
                      />
                    }
                  />
                </Route>
                <Route
                  element={<RequirePermission permission="audit:view" apiPath="/api/audit-log" />}
                >
                  <Route
                    path="/audit"
                    element={
                      <PlaceholderPage
                        title="Audit Log"
                        icon="clock"
                        body="The append-only record of privileged actions will appear here."
                      />
                    }
                  />
                </Route>
                <Route element={<RequirePermission permission="team:view" apiPath="/api/team" />}>
                  <Route
                    path="/team"
                    element={
                      <PlaceholderPage
                        title="Team"
                        icon="users"
                        body="Manage who belongs to this organization here."
                      />
                    }
                  />
                </Route>
              </Route>
            </Route>
          </Route>
        </Route>
      </Routes>
    </ThemeProvider>
  );
}
