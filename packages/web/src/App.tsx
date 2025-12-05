// packages/web/src/App.tsx

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { Dashboard } from './components/Dashboard';
import { OrdersPage } from './components/OrdersPage';
import { PartsPage } from './components/PartsPage';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AuthProvider } from './lib/auth';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: true,
    },
  },
});

type Page = 'dashboard' | 'parts' | 'orders';

export default function App() {
  const [page, setPage] = useState<Page>('dashboard');

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ProtectedRoute>
          {page === 'dashboard' && <Dashboard onNavigate={setPage} />}
          {page === 'parts' && <PartsPage onBack={() => setPage('dashboard')} />}
          {page === 'orders' && <OrdersPage onBack={() => setPage('dashboard')} />}
        </ProtectedRoute>
      </AuthProvider>
    </QueryClientProvider>
  );
}
