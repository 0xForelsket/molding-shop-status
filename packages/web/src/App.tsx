// packages/web/src/App.tsx

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { AppLayout } from './components/AppLayout';
import { Dashboard } from './components/Dashboard';
import { MachinesPage } from './components/MachinesPage';
import { MasterDataPage } from './components/MasterDataPage';
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
  return (
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <Routes>
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <Dashboard />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/production"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <ShiftProductionPage />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/parts"
              element={
                <ProtectedRoute roles={['admin', 'planner']}>
                  <AppLayout>
                    <PartsPage />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/orders"
              element={
                <ProtectedRoute roles={['admin', 'planner']}>
                  <AppLayout>
                    <OrdersPage />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/machines"
              element={
                <ProtectedRoute roles={['admin']}>
                  <AppLayout>
                    <MachinesPage />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/master-data"
              element={
                <ProtectedRoute roles={['admin', 'line_leader']}>
                  <AppLayout>
                    <MasterDataPage />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
          </Routes>
        </AuthProvider>
      </QueryClientProvider>
    </BrowserRouter>
  );
}
