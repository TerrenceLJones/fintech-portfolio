import { Route, Routes } from 'react-router';
import { ThemeProvider } from '@fintech-portfolio/design-tokens';
import { AppShell, type NavigationShellItem } from '@fintech-portfolio/ui';
import { LoginPage } from './pages/LoginPage';
import { SignUpPage } from './pages/SignUpPage';
import { VerifyEmailPage } from './pages/VerifyEmailPage';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage';
import { ResetPasswordPage } from './pages/ResetPasswordPage';
import { DashboardPage } from './pages/DashboardPage';
import { RequireAuth } from './routes/RequireAuth';

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
      </Routes>
    </ThemeProvider>
  );
}
