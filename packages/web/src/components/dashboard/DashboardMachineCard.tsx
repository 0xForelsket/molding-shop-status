// packages/web/src/components/dashboard/DashboardMachineCard.tsx
import { AlertTriangle, Clock, Power, Settings } from 'lucide-react';
import { ProgressRing } from '../ui/ProgressRing';

interface Machine {
  machineId: number;
  machineName: string;
  status: 'running' | 'idle' | 'fault' | 'offline';
  productionOrder: string | null;
  partName?: string | null;
  partNumber?: string | null;
  imageUrl?: string | null;
  quantityCompleted: number | null;
  quantityRequired: number | null;
  cycleTime?: number | null;
  targetCycleTime?: number | null;
  efficiency?: number | null;
}

interface DashboardMachineCardProps {
  machine: Machine;
  onClick?: () => void;
}

const statusConfig = {
  running: {
    color: 'emerald',
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
    text: 'text-emerald-700',
    icon: Settings,
    label: 'Running',
  },
  idle: {
    color: 'amber',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    text: 'text-amber-700',
    icon: Clock,
    label: 'Idle',
  },
  fault: {
    color: 'red',
    bg: 'bg-red-50',
    border: 'border-red-200',
    text: 'text-red-700',
    icon: AlertTriangle,
    label: 'Fault',
  },
  offline: {
    color: 'slate',
    bg: 'bg-slate-50',
    border: 'border-slate-200',
    text: 'text-slate-500',
    icon: Power,
    label: 'Offline',
  },
} as const;

export function DashboardMachineCard({ machine, onClick }: DashboardMachineCardProps) {
  const config = statusConfig[machine.status];
  const StatusIcon = config.icon;

  const progress =
    machine.quantityRequired && machine.quantityCompleted
      ? (machine.quantityCompleted / machine.quantityRequired) * 100
      : 0;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left relative bg-white rounded-xl border transition-all hover:shadow-md cursor-pointer overflow-hidden group outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${
        machine.status === 'running' ? 'border-emerald-200' : 'border-slate-200'
      }`}
    >
      {/* Background Image (Optional) */}
      {machine.imageUrl && (
        <div className="absolute inset-0 z-0 opacity-10 group-hover:opacity-20 transition-opacity">
          <img
            src={machine.imageUrl}
            alt={machine.partName || 'Part'}
            className="w-full h-full object-cover"
          />
        </div>
      )}

      {/* Status Header Strip */}
      <div
        className={`relative z-10 h-1.5 w-full ${config.bg.replace('bg-', 'bg-').replace('50', '500')}`}
      />

      <div className="relative z-10 p-5">
        {/* Header */}
        <div className="flex justify-between items-start mb-4">
          <div>
            <h3 className="text-lg font-bold text-slate-800 group-hover:text-blue-600 transition-colors">
              {machine.machineName}
            </h3>
            <div
              className={`flex items-center gap-1.5 mt-1 text-xs font-bold uppercase tracking-wider ${config.text}`}
            >
              <StatusIcon className="w-3.5 h-3.5" />
              {config.label}
            </div>
          </div>

          {/* Progress Ring */}
          {machine.productionOrder && (
            <div className="flex-shrink-0">
              <ProgressRing
                progress={progress}
                size={56}
                strokeWidth={5}
                color={config.color}
                showPercentage={true}
              />
            </div>
          )}
        </div>

        {/* Order Info */}
        {machine.productionOrder ? (
          <div className="mb-4">
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-1">
              Active Part
            </div>
            <div className="font-bold text-slate-900 text-lg truncate leading-tight">
              {machine.partNumber}
            </div>
            <div className="text-sm text-slate-600 truncate font-medium mb-1.5">
              {machine.partName || 'Unknown Part'}
            </div>
            <div className="flex items-center gap-1.5 text-xs text-slate-400 bg-slate-50 px-2 py-1 rounded border border-slate-100 w-fit">
              <span className="font-semibold">WO:</span> {machine.productionOrder}
            </div>
          </div>
        ) : (
          <div className="mb-4 h-[58px] flex items-center justify-center bg-slate-50 rounded-lg border border-dashed border-slate-200">
            <span className="text-xs font-medium text-slate-400 italic">No Active Order</span>
          </div>
        )}

        {/* Metrics Grid */}
        <div className="grid grid-cols-2 gap-2 pt-4 border-t border-slate-100">
          <div>
            <div className="text-[10px] font-bold text-slate-400 uppercase">Cycle Time</div>
            <div className="text-sm font-bold text-slate-700">
              {machine.cycleTime ? `${machine.cycleTime}s` : '--'}
              {machine.targetCycleTime && (
                <span className="text-xs text-slate-400 font-normal ml-1">
                  / {machine.targetCycleTime}s
                </span>
              )}
            </div>
          </div>
          <div>
            <div className="text-[10px] font-bold text-slate-400 uppercase">Efficiency</div>
            <div
              className={`text-sm font-bold ${
                (machine.efficiency || 0) >= 90
                  ? 'text-emerald-600'
                  : (machine.efficiency || 0) >= 75
                    ? 'text-amber-600'
                    : 'text-red-600'
              }`}
            >
              {machine.efficiency ? `${machine.efficiency}%` : '--'}
            </div>
          </div>
        </div>
      </div>
    </button>
  );
}
