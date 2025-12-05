// packages/web/src/components/Dashboard.tsx
// Dashboard page content (sidebar handled by AppLayout)

import { useState } from 'react';
import { useMachines, useSummary } from '../hooks/useMachines';
import { EditableTable } from './EditableTable';
import { FloorLayoutDashboard } from './FloorLayoutDashboard';
import { MachineCard } from './MachineCard';

export function Dashboard() {
  const [viewMode, setViewMode] = useState<'grid' | 'table' | 'floor'>('grid');
  const { data: machines = [], isLoading, error, refetch } = useMachines();
  const { data: summary } = useSummary();

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center">
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
    <>
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
    </>
  );
}
