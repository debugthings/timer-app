import { useState, useEffect, useCallback } from 'react';
import { BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AdminProvider, useAdmin } from './contexts/AdminContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { GlobalAlarmProvider } from './hooks/useGlobalAlarm';
import { getSettings, verifyPin } from './services/api';
import { PinModal } from './components/Admin/PinModal';
import { AlarmBanner } from './components/AlarmBanner';
import { FirstTimeSetup } from './pages/FirstTimeSetup';
import { Dashboard } from './pages/Dashboard';
import { TimerDetail } from './pages/TimerDetail';
import { AdminPanel } from './pages/AdminPanel';
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

function AppContent() {
  const { isAdmin, setAdminPin } = useAdmin();
  const navigate = useNavigate();
  const [showPinModal, setShowPinModal] = useState(false);
  const [hasPinConfigured, setHasPinConfigured] = useState<boolean | null>(null);
  const [pendingAdminAction, setPendingAdminAction] = useState<(() => void) | null>(null);

  useEffect(() => {
    getSettings().then((settings) => {
      setHasPinConfigured(settings.hasPinConfigured);
    });
  }, []);

  // Don't auto-request notification permission on load
  // iOS/PWA requires user interaction first
  // Users will be prompted when they need notifications (timer start, etc.)

  const handlePinSubmit = async (pin: string) => {
    const result = await verifyPin({ pin });
    if (result.valid) {
      setAdminPin(pin);
      setShowPinModal(false);
      if (pendingAdminAction) {
        pendingAdminAction();
        setPendingAdminAction(null);
      }
    } else {
      throw new Error('Invalid PIN');
    }
  };

  const requireAdmin = useCallback((action: () => void) => {
    if (isAdmin) {
      action();
    } else {
      setPendingAdminAction(() => action);
      setShowPinModal(true);
    }
  }, [isAdmin]);

  if (hasPinConfigured === null) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-xl">Loading...</div>
      </div>
    );
  }

  if (!hasPinConfigured) {
    return <FirstTimeSetup onPinSet={() => setHasPinConfigured(true)} />;
  }

  return (
    <>
      <AlarmBanner />
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/timer/:id" element={<TimerDetail />} />
        <Route
          path="/admin"
          element={
            <AdminGuard requireAdmin={requireAdmin}>
              <AdminPanel />
            </AdminGuard>
          }
        />
      </Routes>

      <PinModal
        isOpen={showPinModal}
        onClose={() => {
          setShowPinModal(false);
          setPendingAdminAction(null);
        }}
        onCancel={() => navigate('/')}
        onSubmit={handlePinSubmit}
        title="Enter Admin PIN"
      />
    </>
  );
}

interface AdminGuardProps {
  children: React.ReactNode;
  requireAdmin: (action: () => void) => void;
}

function AdminGuard({ children, requireAdmin }: AdminGuardProps) {
  const { isAdmin } = useAdmin();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (!isAdmin && !checked) {
      requireAdmin(() => setChecked(true));
    } else if (isAdmin) {
      setChecked(true);
    }
  }, [isAdmin, checked, requireAdmin]);

  if (!checked) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-xl">Checking permissions...</div>
      </div>
    );
  }

  return <>{children}</>;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AdminProvider>
          <GlobalAlarmProvider>
            <BrowserRouter>
              <AppContent />
            </BrowserRouter>
          </GlobalAlarmProvider>
        </AdminProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
