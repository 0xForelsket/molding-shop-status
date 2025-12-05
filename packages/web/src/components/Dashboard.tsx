// packages/web/src/components/Dashboard.tsx

import { useState } from 'react';
import { useMachines, useSummary } from '../hooks/useMachines';
import { MachineCard } from './MachineCard';
import { SummaryBar } from './SummaryBar';

export function Dashboard() {
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const { data: machines = [], isLoading, error } = useMachines();
  const { data: summary } = useSummary();

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
        <h1 className="text-2xl font-semibold">Injection Molding - Machine Status</h1>

        <div className="flex gap-4 items-center">
          {summary && <SummaryBar summary={summary} />}
          <div className="flex bg-slate-800 rounded-lg p-1">
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              className={`px-3 py-1 rounded transition-colors ${viewMode === 'grid' ? 'bg-blue-600' : 'hover:bg-slate-700'}`}
            >
              Grid
            </button>
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`px-3 py-1 rounded transition-colors ${viewMode === 'table' ? 'bg-blue-600' : 'hover:bg-slate-700'}`}
            >
              Manage
            </button>
          </div>
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
      ) : (
        <div className="bg-slate-800 rounded-xl p-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-400 border-b border-slate-700">
                <th className="pb-3 px-2">Machine</th>
                <th className="pb-3 px-2">Status</th>
                <th className="pb-3 px-2">Order</th>
                <th className="pb-3 px-2">Part</th>
                <th className="pb-3 px-2">Cycles</th>
                <th className="pb-3 px-2">Mode</th>
              </tr>
            </thead>
            <tbody>
              {machines.map((m) => (
                <tr
                  key={m.machineId}
                  className="border-b border-slate-700/50 hover:bg-slate-700/30"
                >
                  <td className="py-3 px-2 font-medium">{m.machineName}</td>
                  <td className="py-3 px-2">
                    <span
                      className={`px-2 py-0.5 rounded text-xs font-bold uppercase ${
                        m.status === 'running'
                          ? 'bg-green-900/50 text-green-400'
                          : m.status === 'idle'
                            ? 'bg-yellow-900/50 text-yellow-400'
                            : m.status === 'fault'
                              ? 'bg-red-900/50 text-red-400'
                              : 'bg-slate-700 text-slate-400'
                      }`}
                    >
                      {m.status}
                    </span>
                  </td>
                  <td className="py-3 px-2 font-mono text-xs">{m.productionOrder || '-'}</td>
                  <td className="py-3 px-2 truncate max-w-[200px]">{m.partName || '-'}</td>
                  <td className="py-3 px-2 font-mono">{m.cycleCount?.toLocaleString() || '0'}</td>
                  <td className="py-3 px-2">
                    <span className={m.inputMode === 'manual' ? 'text-blue-400' : 'text-slate-500'}>
                      {m.inputMode}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Footer with total machines and last update */}
      <footer className="mt-6 text-center text-sm text-slate-500">
        {machines.length} machines connected • Auto-refreshing every 2 seconds
      </footer>
    </div>
  );
}
