// packages/web/src/components/Dashboard.tsx
// Industrial Precision UI - Light Mode Dashboard with Sidebar

import { ClipboardList, Cog, LayoutGrid, LogOut, Menu, Package, X } from 'lucide-react';
import { useState } from 'react';
import { useMachines, useSummary } from '../hooks/useMachines';
import { useAuth } from '../lib/auth';
import { EditableTable } from './EditableTable';
import { FloorLayoutDashboard } from './FloorLayoutDashboard';
import { MachineCard } from './MachineCard';

type Page = 'dashboard' | 'parts' | 'orders' | 'machines';

interface NavItem {
  id: Page;
  label: string;
  icon: React.ReactNode;
  roles?: ('admin' | 'planner' | 'viewer')[];
}

export function Dashboard({ onNavigate }: { onNavigate: (page: Page) => void }) {
  const [viewMode, setViewMode] = useState<'grid' | 'table' | 'floor'>('grid');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const { data: machines = [], isLoading, error, refetch } = useMachines();
  const { data: summary } = useSummary();
  const { user, logout, hasRole } = useAuth();

  const navItems: NavItem[] = [
    { id: 'dashboard', label: 'Dashboard', icon: <LayoutGrid className="w-5 h-5" /> },
    {
      id: 'orders',
      label: 'Production Orders',
      icon: <ClipboardList className="w-5 h-5" />,
      roles: ['admin', 'planner'],
    },
    {
      id: 'parts',
      label: 'Parts Catalog',
      icon: <Package className="w-5 h-5" />,
      roles: ['admin', 'planner'],
    },
    { id: 'machines', label: 'Machine Admin', icon: <Cog className="w-5 h-5" />, roles: ['admin'] },
  ];

  const visibleNavItems = navItems.filter(
    (item) => !item.roles || item.roles.some((role) => hasRole(role))
  );

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-2">Connection Error</h1>
          <p className="text-slate-500">
            Unable to connect to the server. Make sure the API is running.
          </p>
          <p className="text-sm text-slate-400 mt-4 font-mono">{String(error)}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside
        className={`${sidebarOpen ? 'w-56' : 'w-16'} bg-white border-r border-slate-200 flex flex-col transition-all duration-200`}
      >
        {/* Sidebar Header */}
        <div className="h-14 flex items-center px-4 border-b border-slate-200">
          <button
            type="button"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-1.5 hover:bg-slate-100 rounded"
          >
            {sidebarOpen ? (
              <X className="w-5 h-5 text-slate-600" />
            ) : (
              <Menu className="w-5 h-5 text-slate-600" />
            )}
          </button>
          {sidebarOpen && <span className="ml-3 font-semibold text-slate-800">Molding Shop</span>}
        </div>

        {/* Nav Items */}
        <nav className="flex-1 p-2 space-y-1">
          {visibleNavItems.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => (item.id === 'dashboard' ? null : onNavigate(item.id))}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded text-left transition-colors ${
                item.id === 'dashboard'
                  ? 'bg-emerald-50 text-emerald-700 font-medium'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              {item.icon}
              {sidebarOpen && <span>{item.label}</span>}
            </button>
          ))}
        </nav>

        {/* User Section */}
        <div className="p-4 border-t border-slate-200">
          {user && sidebarOpen && (
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 bg-slate-200 rounded-full flex items-center justify-center text-sm font-medium">
                {user.name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-slate-800 truncate">{user.name}</div>
                <div className="text-xs text-slate-500 capitalize">{user.role}</div>
              </div>
            </div>
          )}
          <button
            type="button"
            onClick={logout}
            className="w-full flex items-center gap-3 px-3 py-2 text-slate-600 hover:bg-slate-50 rounded"
          >
            <LogOut className="w-5 h-5" />
            {sidebarOpen && <span>Logout</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Top Bar */}
        <header className="h-14 bg-white border-b border-slate-200 flex items-center justify-between px-6">
          <h1 className="text-lg font-semibold text-slate-800">Shop Floor Overview</h1>

          <div className="flex items-center gap-4">
            {/* View Toggle */}
            <div className="flex bg-slate-100 rounded p-0.5">
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className={`px-3 py-1 text-sm rounded transition-colors ${
                  viewMode === 'grid'
                    ? 'bg-white shadow-sm text-slate-800'
                    : 'text-slate-600 hover:text-slate-800'
                }`}
              >
                Grid
              </button>
              <button
                type="button"
                onClick={() => setViewMode('floor')}
                className={`px-3 py-1 text-sm rounded transition-colors ${
                  viewMode === 'floor'
                    ? 'bg-white shadow-sm text-slate-800'
                    : 'text-slate-600 hover:text-slate-800'
                }`}
              >
                Floor
              </button>
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`px-3 py-1 text-sm rounded transition-colors ${
                  viewMode === 'table'
                    ? 'bg-white shadow-sm text-slate-800'
                    : 'text-slate-600 hover:text-slate-800'
                }`}
              >
                Table
              </button>
            </div>

            {/* Time */}
            <time className="text-slate-500 text-sm tabular-nums">
              {new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
            </time>
          </div>
        </header>

        {/* Summary Stats Bar */}
        {summary && (
          <div className="bg-white border-b border-slate-200 px-6 py-3">
            <div className="flex gap-4">
              <div className="flex items-center gap-2 px-4 py-2 bg-slate-100 rounded">
                <span className="text-2xl font-bold text-slate-800">{summary.total}</span>
                <span className="text-sm text-slate-500">Total Machines</span>
              </div>
              <div className="flex items-center gap-2 px-4 py-2 bg-emerald-50 rounded border-l-4 border-emerald-500">
                <span className="text-2xl font-bold text-emerald-700">{summary.running}</span>
                <span className="text-sm text-emerald-600">Running</span>
              </div>
              <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 rounded border-l-4 border-amber-500">
                <span className="text-2xl font-bold text-amber-700">{summary.idle}</span>
                <span className="text-sm text-amber-600">Idle</span>
              </div>
              <div className="flex items-center gap-2 px-4 py-2 bg-red-50 rounded border-l-4 border-red-500">
                <span className="text-2xl font-bold text-red-700">{summary.fault}</span>
                <span className="text-sm text-red-600">Fault</span>
              </div>
              <div className="flex items-center gap-2 px-4 py-2 bg-slate-100 rounded border-l-4 border-slate-400">
                <span className="text-2xl font-bold text-slate-600">{summary.offline}</span>
                <span className="text-sm text-slate-500">Offline</span>
              </div>
            </div>
          </div>
        )}

        {/* Content Area */}
        <div className="flex-1 p-6 overflow-auto">
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-10 w-10 border-2 border-slate-300 border-t-emerald-600" />
            </div>
          ) : viewMode === 'grid' ? (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-4">
              {machines.map((machine) => (
                <MachineCard key={machine.machineId} machine={machine} />
              ))}
            </div>
          ) : viewMode === 'floor' ? (
            <FloorLayoutDashboard />
          ) : (
            <EditableTable machines={machines} onRefresh={refetch} />
          )}
        </div>

        {/* Footer */}
        <footer className="h-10 bg-white border-t border-slate-200 flex items-center justify-center text-xs text-slate-400">
          {machines.length} machines connected • Auto-refresh every 2s
        </footer>
      </main>
    </div>
  );
}
