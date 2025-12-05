// packages/web/src/components/ProtectedRoute.tsx
// Route wrapper that requires authentication

import type { ReactNode } from 'react';
import { useAuth } from '../lib/auth';
import { LoginPage } from './LoginPage';

interface ProtectedRouteProps {
  children: ReactNode;
  roles?: string[];
}

export function ProtectedRoute({ children, roles }: ProtectedRouteProps) {
  const { user, isLoading, hasRole } = useAuth();

  // Still loading auth state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500" />
      </div>
    );
  }

  // Not logged in
  if (!user) {
    return <LoginPage />;
  }

  // Check role if required
  if (roles && roles.length > 0 && !hasRole(...roles)) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-400 mb-2">Access Denied</h1>
          <p className="text-slate-400">You don't have permission to view this page.</p>
          <p className="text-sm text-slate-500 mt-2">Required role: {roles.join(' or ')}</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
