// packages/web/src/components/Dashboard.tsx

import {
  ClipboardList,
  LayoutGrid,
  LogOut,
  MapPin,
  Package,
  Settings,
  Table,
  Upload,
} from 'lucide-react';
import { useState } from 'react';
import { useMachines, useSummary } from '../hooks/useMachines';
import { useAuth } from '../lib/auth';
import { EditableTable } from './EditableTable';
import { FloorLayoutDashboard } from './FloorLayoutDashboard';
import { MachineCard } from './MachineCard';
import { OrderImport } from './OrderImport';
import { SummaryBar } from './SummaryBar';
import { Button } from './ui/button';

type Page = 'dashboard' | 'parts' | 'orders' | 'machines';

export function Dashboard({ onNavigate }: { onNavigate: (page: Page) => void }) {
  const [viewMode, setViewMode] = useState<'grid' | 'table' | 'floor'>('grid');
  const [showImport, setShowImport] = useState(false);
  const { data: machines = [], isLoading, error, refetch } = useMachines();
  const { data: summary } = useSummary();
  const { user, logout, hasRole } = useAuth();

  if (error) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-400 mb-2">Connection Error</h1>
          <p className="text-slate-400">
            Unable to connect to the server. Make sure the API is running.
          </p>
          <p className="text-sm text-slate-500 mt-4 font-mono">{String(error)}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white p-6">
      <header className="flex justify-between items-center mb-6 pb-4 border-b border-slate-700">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-semibold">Injection Molding - Machine Status</h1>
          {user && (
            <span className="text-sm text-slate-400 bg-slate-800 px-2 py-1 rounded">
              {user.name} ({user.role})
            </span>
          )}
        </div>

        <div className="flex gap-2 items-center">
          {summary && <SummaryBar summary={summary} />}

          <div className="flex bg-slate-800 rounded-lg p-1">
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              className={`px-3 py-1.5 rounded transition-colors flex items-center gap-1.5 ${viewMode === 'grid' ? 'bg-blue-600' : 'hover:bg-slate-700'}`}
            >
              <LayoutGrid className="h-4 w-4" />
              Grid
            </button>
            <button
              type="button"
              onClick={() => setViewMode('floor')}
              className={`px-3 py-1.5 rounded transition-colors flex items-center gap-1.5 ${viewMode === 'floor' ? 'bg-blue-600' : 'hover:bg-slate-700'}`}
            >
              <MapPin className="h-4 w-4" />
              Floor
            </button>
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`px-3 py-1.5 rounded transition-colors flex items-center gap-1.5 ${viewMode === 'table' ? 'bg-blue-600' : 'hover:bg-slate-700'}`}
            >
              <Table className="h-4 w-4" />
              Manage
            </button>
          </div>

          {hasRole('admin', 'planner') && (
            <>
              <Button variant="outline" size="sm" onClick={() => onNavigate('parts')}>
                <Package className="h-4 w-4 mr-2" />
                Parts
              </Button>
              <Button variant="outline" size="sm" onClick={() => onNavigate('orders')}>
                <ClipboardList className="h-4 w-4 mr-2" />
                Orders
              </Button>
              <Button variant="outline" size="sm" onClick={() => setShowImport(true)}>
                <Upload className="h-4 w-4 mr-2" />
                Import
              </Button>
            </>
          )}

          {hasRole('admin') && (
            <Button variant="outline" size="sm" onClick={() => onNavigate('machines')}>
              <Settings className="h-4 w-4 mr-2" />
              Machines
            </Button>
          )}

          <Button variant="ghost" size="sm" onClick={logout}>
            <LogOut className="h-4 w-4 mr-2" />
            Logout
          </Button>
        </div>

        <time className="text-slate-400 text-lg tabular-nums">
          {new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
        </time>
      </header>

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500" />
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4">
          {machines.map((machine) => (
            <MachineCard key={machine.machineId} machine={machine} />
          ))}
        </div>
      ) : viewMode === 'floor' ? (
        <FloorLayoutDashboard />
      ) : (
        <EditableTable machines={machines} onRefresh={refetch} />
      )}

      <footer className="mt-6 text-center text-sm text-slate-500">
        {machines.length} machines connected • Auto-refreshing every 2 seconds
      </footer>

      {showImport && (
        <OrderImport onClose={() => setShowImport(false)} onSuccess={() => refetch()} />
      )}
    </div>
  );
}
