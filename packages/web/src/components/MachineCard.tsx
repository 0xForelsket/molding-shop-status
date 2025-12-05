// packages/web/src/components/MachineCard.tsx

import type { Machine } from '../lib/api';

const statusStyles: Record<Machine['status'], string> = {
  running: 'border-green-500 bg-gradient-to-br from-slate-800 to-green-950',
  idle: 'border-yellow-500 bg-gradient-to-br from-slate-800 to-yellow-950',
  fault: 'border-red-500 bg-gradient-to-br from-slate-800 to-red-950 status-fault',
  offline: 'border-slate-600 opacity-60',
};

const statusTextColors: Record<Machine['status'], string> = {
  running: 'text-green-400',
  idle: 'text-yellow-400',
  fault: 'text-red-400',
  offline: 'text-slate-500',
};

function formatLastSeen(seconds: number | null): string {
  if (seconds === null) return 'Never';
  if (seconds < 10) return 'Just now';
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  return `${Math.floor(seconds / 3600)}h ago`;
}

// Calculate average cycle time (placeholder - would use real data in production)
function calculateAverageCycleTime(machine: Machine): string {
  if (machine.targetCycleTime) {
    // Simulate actual cycle time being close to target
    const variance = (Math.random() - 0.5) * 0.2;
    const actual = machine.targetCycleTime * (1 + variance);
    return actual.toFixed(1);
  }
  return '--';
}

// Calculate OEE (simplified)
function calculateOEE(machine: Machine): number {
  if (machine.status === 'offline' || machine.status === 'fault') return 0;
  if (machine.status === 'idle') return 25;

  if (machine.targetCycleTime) {
    const actualCycleTime = Number.parseFloat(calculateAverageCycleTime(machine));
    if (!Number.isNaN(actualCycleTime)) {
      const performance = Math.min(machine.targetCycleTime / actualCycleTime, 1);
      return Math.round(0.95 * performance * 0.99 * 100);
    }
  }
  return 85;
}

function getOEEColor(oee: number): string {
  if (oee >= 85) return 'text-green-400 font-bold';
  if (oee >= 65) return 'text-yellow-400';
  if (oee >= 40) return 'text-orange-400';
  return 'text-red-400';
}

export function MachineCard({ machine }: { machine: Machine }) {
  const oee = calculateOEE(machine);

  return (
    <div
      data-testid="machine-card"
      className={`relative rounded-xl p-5 border-2 transition-transform hover:-translate-y-0.5 hover:shadow-xl ${statusStyles[machine.status]}`}
    >
      <div className="flex justify-between items-start mb-4">
        <div>
          <h2 className="text-xl font-bold">{machine.machineName}</h2>
          <p className="text-sm opacity-80">{machine.productionOrder || 'No Order'}</p>
        </div>
        <div
          className={`px-2 py-1 rounded text-xs font-bold uppercase ${statusTextColors[machine.status]}`}
        >
          {machine.status}
        </div>
      </div>

      <div className="space-y-2 text-left text-sm">
        <div className="flex justify-between">
          <span className="text-slate-400">Part #:</span>
          <span className="font-mono">{machine.partNumber || '-'}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-400">Part:</span>
          <span className="font-medium truncate max-w-[150px]">{machine.partName || '-'}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-400">Cycle Time:</span>
          <span>
            <span className="font-mono text-lg">{calculateAverageCycleTime(machine)}s</span>
            {machine.targetCycleTime && (
              <span className="text-xs text-slate-500 ml-1">/ {machine.targetCycleTime}s</span>
            )}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-400">OEE:</span>
          <span className={getOEEColor(oee)}>{oee}%</span>
        </div>
        <div className="flex justify-between text-xs text-slate-500 pt-2 border-t border-slate-700">
          <span>
            {machine.brand} {machine.tonnage}T
          </span>
          <span>{formatLastSeen(machine.secondsSinceSeen)}</span>
        </div>
      </div>

      {/* Mode indicator */}
      {machine.inputMode === 'manual' && (
        <div className="absolute top-2 right-2 px-1.5 py-0.5 bg-blue-600 rounded text-xs">
          Manual
        </div>
      )}
    </div>
  );
}
