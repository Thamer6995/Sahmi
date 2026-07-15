import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './hooks/useAuth';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AppShell } from './components/AppShell';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Explorer from './pages/Explorer';
import StockDetail from './pages/StockDetail';
import Watchlist from './pages/Watchlist';
import DividendCalendar from './pages/DividendCalendar';
import Settings from './pages/Settings';
import DevTest from './pages/DevTest';

const isDevMode = import.meta.env.VITE_DEV_MODE === 'true';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <AppShell>
                  <Dashboard />
                </AppShell>
              </ProtectedRoute>
            }
          />
          <Route
            path="/explorer"
            element={
              <ProtectedRoute>
                <AppShell>
                  <Explorer />
                </AppShell>
              </ProtectedRoute>
            }
          />
          <Route
            path="/stocks/:symbol"
            element={
              <ProtectedRoute>
                <AppShell>
                  <StockDetail />
                </AppShell>
              </ProtectedRoute>
            }
          />
          <Route
            path="/watchlist"
            element={
              <ProtectedRoute>
                <AppShell>
                  <Watchlist />
                </AppShell>
              </ProtectedRoute>
            }
          />
          <Route
            path="/dividends"
            element={
              <ProtectedRoute>
                <AppShell>
                  <DividendCalendar />
                </AppShell>
              </ProtectedRoute>
            }
          />
          <Route
            path="/settings"
            element={
              <ProtectedRoute>
                <AppShell>
                  <Settings />
                </AppShell>
              </ProtectedRoute>
            }
          />
          {isDevMode && (
            <Route
              path="/dev-test"
              element={
                <ProtectedRoute>
                  <DevTest />
                </ProtectedRoute>
              }
            />
          )}
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
