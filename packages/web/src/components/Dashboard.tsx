// packages/web/src/components/Dashboard.tsx
// Dashboard page content (sidebar handled by AppLayout)

import { useEffect, useState } from 'react';
import { useMachines, useSummary } from '../hooks/useMachines';
import type { Machine } from '../lib/api';
import { EditableTable } from './EditableTable';
import { FloorLayoutDashboard } from './FloorLayoutDashboard';
import { MachineCard } from './MachineCard';
import { MachineDetailDialog } from './MachineDetailDialog';

type StatusFilter = 'all' | 'running' | 'idle' | 'fault' | 'offline';

// Shift configuration (customize as needed)
const SHIFTS = [
  { name: 'Day Shift', start: 6, end: 14 },
  { name: 'Swing Shift', start: 14, end: 22 },
  { name: 'Night Shift', start: 22, end: 6 },
];

function getCurrentShift() {
  const now = new Date();
  const currentHour = now.getHours();

  for (const shift of SHIFTS) {
    if (shift.start < shift.end) {
      // Normal shift (e.g., 6-14)
      if (currentHour >= shift.start && currentHour < shift.end) {
        const endTime = new Date(now);
        endTime.setHours(shift.end, 0, 0, 0);
        const remaining = endTime.getTime() - now.getTime();
        return { name: shift.name, remaining };
      }
    } else {
      // Overnight shift (e.g., 22-6)
      if (currentHour >= shift.start || currentHour < shift.end) {
        const endTime = new Date(now);
        if (currentHour >= shift.start) {
          endTime.setDate(endTime.getDate() + 1);
        }
        endTime.setHours(shift.end, 0, 0, 0);
        const remaining = endTime.getTime() - now.getTime();
        return { name: shift.name, remaining };
      }
    }
  }
  return { name: 'Unknown', remaining: 0 };
}

function formatTimeRemaining(ms: number): string {
  const hours = Math.floor(ms / (1000 * 60 * 60));
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
  return `${hours}h ${minutes}m remaining`;
}

function calculateMachineOEE(machine: Machine): number {
  if (machine.status === 'offline' || machine.status === 'fault') return 0;
  if (machine.status === 'idle') return 25;
  if (machine.targetCycleTime) {
    return Math.round(0.95 * 1 * 0.99 * 100); // Simplified OEE calculation
  }
  return 85;
}

export function Dashboard() {
  const [viewMode, setViewMode] = useState<'grid' | 'table' | 'floor'>('grid');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [selectedMachine, setSelectedMachine] = useState<Machine | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const { data: machines = [], isLoading, error, refetch } = useMachines();
  const { data: summary } = useSummary();

  // Live clock update
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const shift = getCurrentShift();

  // Filter machines based on status
  const filteredMachines =
    statusFilter === 'all' ? machines : machines.filter((m) => m.status === statusFilter);

  // Calculate overall OEE (average of running machines)
  const runningMachines = machines.filter((m) => m.status === 'running');
  const averageOEE =
    runningMachines.length > 0
      ? Math.round(
          runningMachines.reduce((sum, m) => sum + calculateMachineOEE(m), 0) /
            runningMachines.length
        )
      : 0;

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
        <div className="flex items-center gap-4">
          <h1 className="text-lg font-semibold text-slate-800">Shop Floor Overview</h1>

          {/* Shift Information */}
          <div className="flex items-center gap-2 px-3 py-1 bg-indigo-50 rounded-full border border-indigo-200">
            <span className="text-sm font-medium text-indigo-700">{shift.name}</span>
            <span className="text-xs text-indigo-500">{formatTimeRemaining(shift.remaining)}</span>
          </div>
        </div>

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

          {/* Live Time */}
          <time className="text-slate-500 text-sm tabular-nums font-medium">
            {currentTime.toLocaleTimeString('en-US', {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            })}
          </time>
        </div>
      </header>

      {/* Summary Stats Bar - Now Clickable as Filters */}
      {summary && (
        <div className="bg-white border-b border-slate-200 px-6 py-3">
          <div className="flex gap-4">
            <button
              type="button"
              onClick={() => setStatusFilter('all')}
              className={`flex items-center gap-2 px-4 py-2 rounded transition-all ${
                statusFilter === 'all'
                  ? 'bg-slate-200 ring-2 ring-slate-400'
                  : 'bg-slate-100 hover:bg-slate-150'
              }`}
            >
              <span className="text-2xl font-bold text-slate-800">{summary.total}</span>
              <span className="text-sm text-slate-500">Total</span>
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('running')}
              className={`flex items-center gap-2 px-4 py-2 rounded border-l-4 border-emerald-500 transition-all ${
                statusFilter === 'running'
                  ? 'bg-emerald-100 ring-2 ring-emerald-400'
                  : 'bg-emerald-50 hover:bg-emerald-100'
              }`}
            >
              <span className="text-2xl font-bold text-emerald-700">{summary.running}</span>
              <span className="text-sm text-emerald-600">Running</span>
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('idle')}
              className={`flex items-center gap-2 px-4 py-2 rounded border-l-4 border-amber-500 transition-all ${
                statusFilter === 'idle'
                  ? 'bg-amber-100 ring-2 ring-amber-400'
                  : 'bg-amber-50 hover:bg-amber-100'
              }`}
            >
              <span className="text-2xl font-bold text-amber-700">{summary.idle}</span>
              <span className="text-sm text-amber-600">Idle</span>
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('fault')}
              className={`flex items-center gap-2 px-4 py-2 rounded border-l-4 border-red-500 transition-all ${
                statusFilter === 'fault'
                  ? 'bg-red-100 ring-2 ring-red-400'
                  : 'bg-red-50 hover:bg-red-100'
              }`}
            >
              <span className="text-2xl font-bold text-red-700">{summary.fault}</span>
              <span className="text-sm text-red-600">Fault</span>
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('offline')}
              className={`flex items-center gap-2 px-4 py-2 rounded border-l-4 border-slate-400 transition-all ${
                statusFilter === 'offline'
                  ? 'bg-slate-200 ring-2 ring-slate-400'
                  : 'bg-slate-100 hover:bg-slate-150'
              }`}
            >
              <span className="text-2xl font-bold text-slate-600">{summary.offline}</span>
              <span className="text-sm text-slate-500">Offline</span>
            </button>

            {/* Overall OEE */}
            <div className="flex items-center gap-2 px-4 py-2 bg-purple-50 rounded border-l-4 border-purple-500 ml-auto">
              <span
                className={`text-2xl font-bold ${averageOEE >= 85 ? 'text-emerald-700' : averageOEE >= 65 ? 'text-amber-600' : 'text-red-600'}`}
              >
                {averageOEE}%
              </span>
              <span className="text-sm text-purple-600">Avg OEE</span>
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
          <>
            {statusFilter !== 'all' && (
              <div className="mb-4 flex items-center gap-2">
                <span className="text-sm text-slate-500">
                  Showing {filteredMachines.length} {statusFilter} machine
                  {filteredMachines.length !== 1 ? 's' : ''}
                </span>
                <button
                  type="button"
                  onClick={() => setStatusFilter('all')}
                  className="text-sm text-blue-600 hover:text-blue-800 underline"
                >
                  Clear filter
                </button>
              </div>
            )}
            <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-4">
              {filteredMachines.map((machine) => (
                <MachineCard
                  key={machine.machineId}
                  machine={machine}
                  onClick={() => setSelectedMachine(machine)}
                />
              ))}
            </div>
          </>
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

      <MachineDetailDialog
        machine={selectedMachine}
        isOpen={!!selectedMachine}
        onClose={() => setSelectedMachine(null)}
      />
    </>
  );
}
