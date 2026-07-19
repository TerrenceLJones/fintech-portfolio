import { Route, Routes, useNavigate } from 'react-router';
import { ThemeProvider } from '@clearline/design-tokens';
import { DemoBeaconProvider } from '@clearline/demo-beacon';
import { NavigationGuardProvider } from './hooks/navigation-guard';
import { LoginPage } from './pages/LoginPage';
import { SignUpPage } from './pages/SignUpPage';
import { VerifyEmailPage } from './pages/VerifyEmailPage';
import { EmailChangeConfirmPage } from './pages/EmailChangeConfirmPage';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage';
import { ResetPasswordPage } from './pages/ResetPasswordPage';
import { ApprovalsPage } from './pages/ApprovalsPage';
import { MyExpensesPage } from './pages/expenses/MyExpensesPage';
import { NewExpensePage } from './pages/expenses/NewExpensePage';
import { NewPaymentPage } from './pages/payments/NewPaymentPage';
import { PaymentStatusPage } from './pages/payments/PaymentStatusPage';
import { CardWalletPage } from './pages/cards/CardWalletPage';
import { IssueCardPage } from './pages/cards/IssueCardPage';
import { CardDetailPage } from './pages/cards/CardDetailPage';
import { DashboardPage } from './pages/dashboard/DashboardPage';
import { ReconciliationPage } from './pages/reconciliation/ReconciliationPage';
import { AuditLogPage } from './pages/audit/AuditLogPage';
import { BudgetOverviewPage } from './pages/budget/BudgetOverviewPage';
import { NewBudgetPage } from './pages/budget/NewBudgetPage';
import { BudgetHistoryPage } from './pages/budget/BudgetHistoryPage';
import { settingsRoutes } from './pages/settings/settings-routes';
import { InviteAcceptPage } from './pages/invite/InviteAcceptPage';
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
import { HomeRedirect } from './routes/HomeRedirect';
import { demoModeEnabled } from './dev/demo-mode';
import { BEACON_THEME } from './dev/beacon/theme';
import { globalBeacon } from './dev/beacon/global.beacon';

export function App() {
  const navigate = useNavigate();
  return (
    <ThemeProvider>
      {/*
        Page-aware demo Beacon for testers/viewers. `enabled` gates it to dev or a mocks-enabled demo
        deploy; when disabled the store still mounts (so pages' useDemoBeacon calls are harmless
        no-ops) but the launcher/panel UI chunk never loads, so a real production build pays nothing.
        Pages self-register their config via useDemoBeacon; the store owns which one is active.
      */}
      <DemoBeaconProvider
        appName="Clearline"
        enabled={demoModeEnabled()}
        onNavigate={(path) => navigate(path)}
        fallback={globalBeacon}
        theme={BEACON_THEME}
      >
        <NavigationGuardProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/signup" element={<SignUpPage />} />
            <Route path="/verify" element={<VerifyEmailPage />} />
            {/* Public email-change confirmation (US-CW-034 AC-03/04): the link is opened from an email
              and may arrive with no session, so it sits outside RequireAuth like /verify. */}
            <Route path="/email-change/confirm" element={<EmailChangeConfirmPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            {/* Public invite acceptance (US-CW-031 AC-02): the invitee has no session yet, so this sits
              outside RequireAuth. Setting a password logs them in and drops them on their role home. */}
            <Route path="/invite" element={<InviteAcceptPage />} />
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
                    <Route path="/" element={<HomeRedirect />} />
                    {/* Spend analytics dashboard (US-CW-015). Finance Managers and Controllers hold
                    analytics:view; the read is re-checked server-side on every /api/analytics/* call. */}
                    <Route
                      element={
                        <RequirePermission
                          permission="analytics:view"
                          apiPath="/api/analytics/summary"
                        />
                      }
                    >
                      <Route path="/dashboard" element={<DashboardPage />} />
                    </Route>
                    <Route
                      element={
                        <RequirePermission permission="expenses:view" apiPath="/api/expenses" />
                      }
                    >
                      <Route path="/expenses" element={<MyExpensesPage />} />
                      <Route path="/expenses/new" element={<NewExpensePage />} />
                    </Route>
                    {/* Card management (US-CW-014). The wallet + detail feed are viewable by any role
                    with cards:view; issuance is Controller-only (cards:manage), re-checked server-side. */}
                    <Route
                      element={<RequirePermission permission="cards:view" apiPath="/api/cards" />}
                    >
                      <Route path="/cards" element={<CardWalletPage />} />
                      <Route path="/cards/:cardId" element={<CardDetailPage />} />
                    </Route>
                    <Route
                      element={
                        <RequirePermission permission="cards:manage" apiPath="/api/cards/context" />
                      }
                    >
                      <Route path="/cards/new" element={<IssueCardPage />} />
                    </Route>
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
                          apiPath="/api/reconciliation/summary"
                        />
                      }
                    >
                      <Route path="/reconciliation" element={<ReconciliationPage />} />
                    </Route>
                    {/* Budget management (US-CW-019). Controller-only (budget:view), re-checked
                    server-side on every /api/budgets call; the overview, set-budget form and
                    per-department history all sit under the one guard. */}
                    <Route
                      element={
                        <RequirePermission permission="budget:view" apiPath="/api/budgets" />
                      }
                    >
                      <Route path="/budgets" element={<BudgetOverviewPage />} />
                      <Route path="/budgets/new" element={<NewBudgetPage />} />
                      <Route path="/budgets/:department/history" element={<BudgetHistoryPage />} />
                    </Route>
                    <Route
                      element={
                        <RequirePermission permission="audit:view" apiPath="/api/audit-log" />
                      }
                    >
                      <Route path="/audit" element={<AuditLogPage />} />
                    </Route>
                    {/* Settings surface (US-CW-033) — the role-scoped /settings route tree, factored into
                    settings-routes.tsx so the app and its routing tests mount the same structure. Team &
                    Members lives here now (/settings/team); there is no longer a top-level /team route. */}
                    {settingsRoutes()}
                  </Route>
                </Route>
              </Route>
            </Route>
          </Routes>
        </NavigationGuardProvider>
      </DemoBeaconProvider>
    </ThemeProvider>
  );
}
