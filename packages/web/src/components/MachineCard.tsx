// packages/web/src/components/MachineCard.tsx
// Industrial Precision Style - Light mode machine status card

import type { Machine } from '../lib/api';

// Status badge styles - solid colors with left border
const statusBadgeStyles: Record<Machine['status'], string> = {
  running: 'bg-emerald-600 text-white',
  idle: 'bg-amber-500 text-white',
  fault: 'bg-red-600 text-white status-fault-pulse',
  offline: 'bg-slate-400 text-white',
};

// Card border accent by status
const statusBorderStyles: Record<Machine['status'], string> = {
  running: 'border-t-4 border-t-emerald-500',
  idle: 'border-t-4 border-t-amber-500',
  fault: 'border-t-4 border-t-red-500',
  offline: 'border-t-4 border-t-slate-400',
};

function formatLastSeen(seconds: number | null): string {
  if (seconds === null) return 'Never';
  if (seconds < 10) return 'Just now';
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  return `${Math.floor(seconds / 3600)}h ago`;
}

function formatCycleTime(machine: Machine): string {
  if (machine.targetCycleTime) {
    return machine.targetCycleTime.toFixed(1);
  }
  return '--';
}

function calculateOEE(machine: Machine): number {
  if (machine.status === 'offline' || machine.status === 'fault') return 0;
  if (machine.status === 'idle') return 25;

  if (machine.targetCycleTime) {
    const actualCycleTime = machine.targetCycleTime;
    if (!Number.isNaN(actualCycleTime)) {
      const performance = Math.min(machine.targetCycleTime / actualCycleTime, 1);
      return Math.round(0.95 * performance * 0.99 * 100);
    }
  }
  return 85;
}

function getOEEColor(oee: number): string {
  if (oee >= 85) return 'text-emerald-700 font-bold';
  if (oee >= 65) return 'text-amber-600';
  if (oee >= 40) return 'text-orange-600';
  return 'text-red-600';
}

export function MachineCard({ machine }: { machine: Machine }) {
  const oee = calculateOEE(machine);
  const cycleTime = formatCycleTime(machine);

  return (
    <div
      data-testid="machine-card"
      className={`card-industrial ${statusBorderStyles[machine.status]} hover:shadow-md transition-shadow`}
    >
      {/* Header: Machine ID + Brand + Status */}
      <div className="flex justify-between items-start p-4 pb-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900">{machine.machineName}</h2>
          <p className="text-xs text-slate-500 uppercase tracking-wide">
            {machine.brand} {machine.tonnage}T
          </p>
        </div>
        <span
          className={`px-2 py-0.5 text-xs font-semibold uppercase rounded ${statusBadgeStyles[machine.status]}`}
        >
          {machine.status}
        </span>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-2 px-4 pb-4 text-sm">
        {/* Part */}
        <div>
          <div className="text-xs text-slate-500 uppercase tracking-wide">Part</div>
          <div
            className="font-medium text-slate-800 truncate"
            title={machine.partName || undefined}
          >
            {machine.partNumber || '-'}
          </div>
          {machine.partName && (
            <div className="text-xs text-slate-500 truncate">({machine.partName})</div>
          )}
        </div>

        {/* Order */}
        <div>
          <div className="text-xs text-slate-500 uppercase tracking-wide">Order</div>
          <div className="font-medium text-slate-800">{machine.productionOrder || '-'}</div>
        </div>

        {/* Cycle Time */}
        <div>
          <div className="text-xs text-slate-500 uppercase tracking-wide">Cycle Time</div>
          <div className="font-bold text-slate-900 tabular-nums">{cycleTime}s</div>
        </div>

        {/* OEE */}
        <div>
          <div className="text-xs text-slate-500 uppercase tracking-wide">OEE</div>
          <div className={`font-bold tabular-nums ${getOEEColor(oee)}`}>{oee}%</div>
        </div>
      </div>

      {/* Footer: Last seen + Mode */}
      <div className="flex justify-between items-center px-4 py-2 bg-slate-50 border-t border-slate-100 text-xs text-slate-500">
        <span>{formatLastSeen(machine.secondsSinceSeen)}</span>
        {machine.inputMode === 'manual' && (
          <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded font-medium">
            Manual
          </span>
        )}
        {machine.is2K && (
          <span className="px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded font-medium">
            2K
          </span>
        )}
      </div>
    </div>
  );
}
