// packages/web/src/components/MachineCard.tsx
// Industrial Precision Style - Light mode machine status card

import type { Machine } from '../lib/api';

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

function formatDowntimeDuration(lastSeen: string | null, status: string): string | null {
  if (status !== 'idle' && status !== 'fault' && status !== 'offline') return null;
  if (!lastSeen) return null;

  const now = new Date();
  const lastSeenDate = new Date(lastSeen);
  const diffMs = now.getTime() - lastSeenDate.getTime();

  if (diffMs < 60000) return 'Just now';

  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 60) return `${minutes}m`;

  const hours = Math.floor(minutes / 60);
  const remainingMins = minutes % 60;
  if (hours < 24) return `${hours}h ${remainingMins}m`;

  const days = Math.floor(hours / 24);
  return `${days}d ${hours % 24}h`;
}

export function MachineCard({ machine, onClick }: { machine: Machine; onClick?: () => void }) {
  const oee = calculateOEE(machine);
  const cycleTime = formatCycleTime(machine);

  // Status Colors & Styles
  const statusColors = {
    running: 'border-t-emerald-500',
    idle: 'border-t-amber-500',
    fault: 'border-t-red-500',
    offline: 'border-t-slate-400',
  };

  const statusTextColors = {
    running: 'text-emerald-700',
    idle: 'text-amber-700',
    fault: 'text-red-700',
    offline: 'text-slate-500',
  };

  return (
    <button
      type="button"
      data-testid="machine-card"
      onClick={onClick}
      className={`bg-white rounded-lg shadow-sm border border-slate-200 border-t-4 ${statusColors[machine.status]} hover:shadow-md transition-shadow overflow-hidden cursor-pointer text-left w-full`}
    >
      {/* Header */}
      <div className="p-4 pb-2">
        <div className="flex justify-between items-start mb-2">
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-slate-900">{machine.machineName}</h2>
            <span className="px-2 py-0.5 text-xs font-medium bg-slate-100 text-slate-600 rounded-full uppercase">
              {machine.brand} {machine.tonnage}T
            </span>
          </div>
        </div>

        {/* Status Indicator */}
        <div className="flex items-center gap-2 mb-4">
          <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Status</div>
          <div
            className={`text-sm font-bold uppercase flex items-center gap-2 ${statusTextColors[machine.status]}`}
          >
            {machine.status === 'running' && (
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
              </span>
            )}
            {machine.status}
          </div>
          {/* Downtime Duration */}
          {formatDowntimeDuration(machine.lastSeen, machine.status) && (
            <span className="text-xs text-slate-400 ml-auto">
              {formatDowntimeDuration(machine.lastSeen, machine.status)}
            </span>
          )}
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-2 gap-y-4 gap-x-4">
          {/* Part Info */}
          <div className="col-span-2">
            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-0.5">
              Part
            </div>
            <div className="font-semibold text-slate-900">{machine.partNumber || '-'}</div>
            {machine.partName && (
              <div className="text-sm text-slate-600 truncate">{machine.partName}</div>
            )}
          </div>

          {/* Cycle Time */}
          <div>
            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-0.5">
              Cycle Time
            </div>
            <div className="font-bold text-slate-900 text-lg leading-tight">{cycleTime}s</div>
            {machine.targetCycleTime && (
              <div className="text-xs text-slate-500">(Target {machine.targetCycleTime}s)</div>
            )}
          </div>

          {/* OEE */}
          <div>
            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-0.5">
              OEE
            </div>
            <div className={`font-bold text-lg leading-tight ${getOEEColor(oee)}`}>{oee}%</div>
          </div>

          {/* Production Order */}
          <div className="col-span-2 pt-2 border-t border-slate-100">
            <div className="flex justify-between items-end">
              <div>
                <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-0.5">
                  Order
                </div>
                {machine.productionOrder ? (
                  <>
                    <div className="font-bold text-slate-900">{machine.productionOrder}</div>
                    <div className="text-sm font-medium text-slate-600">
                      <span className="text-slate-800">
                        {machine.quantityCompleted?.toLocaleString() ?? 0}
                      </span>
                      <span className="text-slate-400 mx-1">/</span>
                      <span>{machine.quantityRequired?.toLocaleString() ?? '-'}</span>
                    </div>
                  </>
                ) : (
                  <span className="text-slate-400 italic">No Order</span>
                )}
              </div>
              {machine.productionOrder && machine.quantityRequired && (
                <div className="text-xs font-bold text-slate-400">
                  {Math.round(((machine.quantityCompleted ?? 0) / machine.quantityRequired) * 100)}%
                </div>
              )}
            </div>
            {/* Progress Bar */}
            {machine.productionOrder && machine.quantityRequired && (
              <div className="w-full bg-slate-100 rounded-full h-1.5 mt-2 overflow-hidden">
                <div
                  className="bg-blue-500 h-1.5 rounded-full"
                  style={{
                    width: `${Math.min(((machine.quantityCompleted ?? 0) / machine.quantityRequired) * 100, 100)}%`,
                  }}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </button>
  );
}
