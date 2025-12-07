// packages/web/src/components/Dashboard.tsx
// Dashboard page content (sidebar handled by AppLayout)

import { LayoutGrid, Map as MapIcon, Table } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useSummary, useWorkCenters } from '../hooks/useWorkCenters';
import type { WorkCenter } from '../lib/api';
import { EditableTable } from './EditableTable';
import { FloorLayoutDashboard } from './FloorLayoutDashboard';
import { MachineDetailDialog } from './MachineDetailDialog';
import { DashboardMachineCard } from './dashboard/DashboardMachineCard';

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

function calculateMachineOEE(machine: WorkCenter): number {
  if (machine.status === 'offline' || machine.status === 'fault') return 0;
  if (machine.status === 'idle') return 25;
  if (machine.currentOrder?.cycleTime) {
    return Math.round(0.95 * 1 * 0.99 * 100); // Simplified OEE calculation
  }
  return 85;
}

export function Dashboard() {
  const [viewMode, setViewMode] = useState<'grid' | 'table' | 'floor'>('grid');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [selectedMachine, setSelectedMachine] = useState<WorkCenter | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const { data: workCenters = [], isLoading, error, refetch } = useWorkCenters();
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
  const filteredWorkCenters =
    statusFilter === 'all' ? workCenters : workCenters.filter((m) => m.status === statusFilter);

  // Calculate overall OEE (average of running machines)
  const runningWorkCenters = workCenters.filter((m) => m.status === 'running');
  const averageOEE =
    runningWorkCenters.length > 0
      ? Math.round(
          runningWorkCenters.reduce((sum, m) => sum + calculateMachineOEE(m), 0) /
            runningWorkCenters.length
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
      <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 shadow-sm z-10">
        <div className="flex items-center gap-6">
          <h1 className="text-xl font-bold text-slate-800">Shop Floor Overview</h1>

          {/* Shift Information */}
          <div className="flex items-center gap-3 px-4 py-1.5 bg-indigo-50 rounded-full border border-indigo-100">
            <span className="text-sm font-bold text-indigo-700">{shift.name}</span>
            <span className="text-xs font-medium text-indigo-500 border-l border-indigo-200 pl-3">
              {formatTimeRemaining(shift.remaining)}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-6">
          {/* View Toggle */}
          <div className="flex bg-slate-100 rounded-lg p-1 border border-slate-200">
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded-md transition-all ${
                viewMode === 'grid'
                  ? 'bg-white shadow-sm text-indigo-600'
                  : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
              }`}
              title="Grid View"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('floor')}
              className={`p-2 rounded-md transition-all ${
                viewMode === 'floor'
                  ? 'bg-white shadow-sm text-indigo-600'
                  : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
              }`}
              title="Floor View"
            >
              <MapIcon className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`p-2 rounded-md transition-all ${
                viewMode === 'table'
                  ? 'bg-white shadow-sm text-indigo-600'
                  : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
              }`}
              title="Table View"
            >
              <Table className="w-4 h-4" />
            </button>
          </div>

          {/* Live Time */}
          <time className="text-slate-400 text-sm tabular-nums font-semibold tracking-wide">
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
        <div className="bg-white border-b border-slate-200 px-6 py-4">
          <div className="flex flex-wrap gap-4">
            <button
              type="button"
              onClick={() => setStatusFilter('all')}
              className={`flex items-center gap-3 px-5 py-3 rounded-xl border transition-all shadow-sm ${
                statusFilter === 'all'
                  ? 'bg-slate-800 border-slate-800 text-white ring-2 ring-slate-200 ring-offset-1'
                  : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'
              }`}
            >
              <span
                className={`text-2xl font-bold ${statusFilter === 'all' ? 'text-white' : 'text-slate-800'}`}
              >
                {summary.total}
              </span>
              <span
                className={`text-sm font-medium ${statusFilter === 'all' ? 'text-slate-300' : 'text-slate-500'}`}
              >
                Total
              </span>
            </button>

            <button
              type="button"
              onClick={() => setStatusFilter('running')}
              className={`flex items-center gap-3 px-5 py-3 rounded-xl border transition-all shadow-sm ${
                statusFilter === 'running'
                  ? 'bg-emerald-50 border-emerald-200 ring-2 ring-emerald-100 ring-offset-1'
                  : 'bg-white border-slate-200 hover:border-emerald-200 hover:bg-emerald-50/30'
              }`}
            >
              <div
                className={`w-2 h-8 rounded-full ${statusFilter === 'running' ? 'bg-emerald-500' : 'bg-emerald-400'}`}
              />
              <div>
                <div className="text-2xl font-bold text-slate-800 leading-none">
                  {summary.running}
                </div>
                <div className="text-xs font-bold text-emerald-600 uppercase tracking-wider mt-1">
                  Running
                </div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setStatusFilter('idle')}
              className={`flex items-center gap-3 px-5 py-3 rounded-xl border transition-all shadow-sm ${
                statusFilter === 'idle'
                  ? 'bg-amber-50 border-amber-200 ring-2 ring-amber-100 ring-offset-1'
                  : 'bg-white border-slate-200 hover:border-amber-200 hover:bg-amber-50/30'
              }`}
            >
              <div
                className={`w-2 h-8 rounded-full ${statusFilter === 'idle' ? 'bg-amber-500' : 'bg-amber-400'}`}
              />
              <div>
                <div className="text-2xl font-bold text-slate-800 leading-none">{summary.idle}</div>
                <div className="text-xs font-bold text-amber-600 uppercase tracking-wider mt-1">
                  Idle
                </div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setStatusFilter('fault')}
              className={`flex items-center gap-3 px-5 py-3 rounded-xl border transition-all shadow-sm ${
                statusFilter === 'fault'
                  ? 'bg-red-50 border-red-200 ring-2 ring-red-100 ring-offset-1'
                  : 'bg-white border-slate-200 hover:border-red-200 hover:bg-red-50/30'
              }`}
            >
              <div
                className={`w-2 h-8 rounded-full ${statusFilter === 'fault' ? 'bg-red-500' : 'bg-red-400'}`}
              />
              <div>
                <div className="text-2xl font-bold text-slate-800 leading-none">
                  {summary.fault}
                </div>
                <div className="text-xs font-bold text-red-600 uppercase tracking-wider mt-1">
                  Fault
                </div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setStatusFilter('offline')}
              className={`flex items-center gap-3 px-5 py-3 rounded-xl border transition-all shadow-sm ${
                statusFilter === 'offline'
                  ? 'bg-slate-100 border-slate-300 ring-2 ring-slate-200 ring-offset-1'
                  : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50'
              }`}
            >
              <div
                className={`w-2 h-8 rounded-full ${statusFilter === 'offline' ? 'bg-slate-500' : 'bg-slate-300'}`}
              />
              <div>
                <div className="text-2xl font-bold text-slate-800 leading-none">
                  {summary.offline}
                </div>
                <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mt-1">
                  Offline
                </div>
              </div>
            </button>

            {/* Overall OEE */}
            <div className="flex items-center gap-4 px-6 py-3 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl text-white ml-auto shadow-md shadow-indigo-200">
              <div>
                <div className="text-3xl font-bold leading-none">{averageOEE}%</div>
                <div className="text-xs font-medium text-indigo-100 uppercase tracking-wider mt-1">
                  Avg OEE
                </div>
              </div>
              <div className="h-10 w-10 rounded-full border-4 border-white/20 flex items-center justify-center">
                <div
                  className="h-full w-full rounded-full border-4 border-white border-t-transparent animate-spin-slow"
                  style={{ animationDuration: '3s' }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Content Area */}
      <div className="flex-1 p-6 overflow-auto bg-slate-50/50">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-10 w-10 border-2 border-slate-300 border-t-indigo-600" />
          </div>
        ) : viewMode === 'grid' ? (
          <>
            {statusFilter !== 'all' && (
              <div className="mb-6 flex items-center justify-between">
                <span className="text-sm font-medium text-slate-500">
                  Showing{' '}
                  <span className="font-bold text-slate-800">{filteredWorkCenters.length}</span>{' '}
                  {statusFilter} work center
                  {filteredWorkCenters.length !== 1 ? 's' : ''}
                </span>
                <button
                  type="button"
                  onClick={() => setStatusFilter('all')}
                  className="text-sm font-bold text-indigo-600 hover:text-indigo-800 hover:underline"
                >
                  Clear filter
                </button>
              </div>
            )}
            <div className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-6">
              {filteredWorkCenters.map((machine) => (
                <DashboardMachineCard
                  key={machine.id}
                  machine={machine}
                  onClick={() => setSelectedMachine(machine)}
                />
              ))}
            </div>
          </>
        ) : viewMode === 'floor' ? (
          <FloorLayoutDashboard />
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <EditableTable machines={workCenters} onRefresh={refetch} />
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="h-10 bg-white border-t border-slate-200 flex items-center justify-center text-xs font-medium text-slate-400">
        {workCenters.length} work centers connected • Auto-refresh every 2s
      </footer>

      <MachineDetailDialog
        machine={selectedMachine}
        isOpen={!!selectedMachine}
        onClose={() => setSelectedMachine(null)}
      />
    </>
  );
}
