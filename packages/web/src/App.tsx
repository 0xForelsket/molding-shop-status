// packages/web/src/App.tsx

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { AppLayout, type Page } from './components/AppLayout';
import { Dashboard } from './components/Dashboard';
import { MachinesPage } from './components/MachinesPage';
import { OrdersPage } from './components/OrdersPage';
import { PartsPage } from './components/PartsPage';
import { ProtectedRoute } from './components/ProtectedRoute';
import { ShiftProductionPage } from './components/ShiftProductionPage';
import { AuthProvider } from './lib/auth';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: true,
    },
  },
});

export default function App() {
  const [page, setPage] = useState<Page>('dashboard');

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ProtectedRoute>
          <AppLayout currentPage={page} onNavigate={setPage}>
            {page === 'dashboard' && <Dashboard />}
            {page === 'production' && <ShiftProductionPage />}
            {page === 'parts' && <PartsPage />}
            {page === 'orders' && <OrdersPage />}
            {page === 'machines' && <MachinesPage />}
          </AppLayout>
        </ProtectedRoute>
      </AuthProvider>
    </QueryClientProvider>
  );
}
