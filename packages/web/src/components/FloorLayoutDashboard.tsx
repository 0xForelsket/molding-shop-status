// packages/web/src/components/FloorLayoutDashboard.tsx
// Floor layout view matching the physical shop floor

import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { cn } from '../lib/utils';

interface Machine {
  machineId: number;
  machineName: string;
  status: string;
  brand: string | null;
  model: string | null;
  tonnage: number | null;
  is2K: boolean | null;
  floorRow: string | null;
  floorPosition: number | null;
  productionOrder: string | null;
  partNumber: string | null;
  partName: string | null;
  cycleCount: number | null;
}

async function fetchMachines(): Promise<Machine[]> {
  const res = await fetch('/api/machines');
  if (!res.ok) throw new Error('Failed to fetch machines');
  return res.json();
}

const statusColors: Record<string, { bg: string; ring: string; text: string }> = {
  running: { bg: 'bg-green-500/20', ring: 'ring-green-500', text: 'text-green-400' },
  idle: { bg: 'bg-yellow-500/20', ring: 'ring-yellow-500', text: 'text-yellow-400' },
  fault: { bg: 'bg-red-500/20', ring: 'ring-red-500', text: 'text-red-400' },
  offline: { bg: 'bg-slate-600/20', ring: 'ring-slate-600', text: 'text-slate-400' },
};

function MachineCard({ machine }: { machine: Machine }) {
  const colors = statusColors[machine.status] || statusColors.offline;

  return (
    <div
      className={cn(
        'relative p-3 rounded-lg ring-2 transition-all hover:scale-105 cursor-pointer min-w-[100px]',
        colors.bg,
        colors.ring
      )}
    >
      {/* 2K Badge */}
      {machine.is2K && (
        <div className="absolute -top-2 -right-2 bg-purple-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
          2K
        </div>
      )}

      {/* Machine Name */}
      <div className="text-lg font-bold text-white">{machine.machineName}</div>

      {/* Tonnage */}
      <div className="text-xs text-slate-400">{machine.tonnage}T</div>

      {/* Status indicator */}
      <div className={cn('text-xs font-medium mt-1', colors.text)}>
        {machine.status.charAt(0).toUpperCase() + machine.status.slice(1)}
      </div>

      {/* Order info */}
      {machine.productionOrder && (
        <div className="text-[10px] text-slate-400 truncate mt-1">#{machine.productionOrder}</div>
      )}
    </div>
  );
}

function ConveyorLine({ label }: { label?: string }) {
  return (
    <div className="relative flex items-center my-4">
      <div className="flex-1 h-3 bg-gradient-to-r from-blue-900 via-blue-700 to-blue-900 rounded-full shadow-inner">
        <div className="h-full flex items-center justify-center">
          <div className="w-[90%] h-1.5 bg-blue-500/50 rounded-full" />
        </div>
      </div>
      {label && (
        <div className="absolute -top-5 left-1/2 -translate-x-1/2 text-xs text-slate-500 font-medium">
          {label}
        </div>
      )}
    </div>
  );
}

export function FloorLayoutDashboard() {
  const { data: machines = [], isLoading } = useQuery({
    queryKey: ['machines'],
    queryFn: fetchMachines,
    refetchInterval: 5000,
  });

  // Group machines by row
  const { topRow, middleRow, bottomRow } = useMemo(() => {
    const top = machines
      .filter((m) => m.floorRow === 'top')
      .sort((a, b) => (a.floorPosition || 0) - (b.floorPosition || 0));
    const middle = machines
      .filter((m) => m.floorRow === 'middle')
      .sort((a, b) => (a.floorPosition || 0) - (b.floorPosition || 0));
    const bottom = machines
      .filter((m) => m.floorRow === 'bottom')
      .sort((a, b) => (a.floorPosition || 0) - (b.floorPosition || 0));

    return { topRow: top, middleRow: middle, bottomRow: bottom };
  }, [machines]);

  // Summary stats
  const summary = useMemo(() => {
    const total = machines.length;
    const running = machines.filter((m) => m.status === 'running').length;
    const idle = machines.filter((m) => m.status === 'idle').length;
    const fault = machines.filter((m) => m.status === 'fault').length;
    const offline = machines.filter((m) => m.status === 'offline').length;
    return { total, running, idle, fault, offline };
  }, [machines]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-blue-500" />
      </div>
    );
  }

  return (
    <div className="p-6 bg-slate-900 min-h-screen">
      {/* Summary Bar */}
      <div className="flex gap-4 mb-8 justify-center">
        <div className="flex items-center gap-2 px-4 py-2 bg-slate-800 rounded-lg">
          <div className="w-3 h-3 rounded-full bg-green-500" />
          <span className="text-green-400 font-mono">{summary.running}</span>
          <span className="text-slate-400 text-sm">Running</span>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 bg-slate-800 rounded-lg">
          <div className="w-3 h-3 rounded-full bg-yellow-500" />
          <span className="text-yellow-400 font-mono">{summary.idle}</span>
          <span className="text-slate-400 text-sm">Idle</span>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 bg-slate-800 rounded-lg">
          <div className="w-3 h-3 rounded-full bg-red-500" />
          <span className="text-red-400 font-mono">{summary.fault}</span>
          <span className="text-slate-400 text-sm">Fault</span>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 bg-slate-800 rounded-lg">
          <div className="w-3 h-3 rounded-full bg-slate-600" />
          <span className="text-slate-400 font-mono">{summary.offline}</span>
          <span className="text-slate-400 text-sm">Offline</span>
        </div>
      </div>

      {/* Floor Layout */}
      <div className="max-w-6xl mx-auto space-y-2">
        {/* TOP ROW */}
        <div className="text-xs text-slate-500 pl-2 mb-1">Top Row (Main Conveyor)</div>
        <div className="flex gap-3 flex-wrap justify-start bg-slate-800/30 p-4 rounded-xl">
          {topRow.map((machine) => (
            <MachineCard key={machine.machineId} machine={machine} />
          ))}
        </div>

        {/* Main Conveyor Line */}
        <ConveyorLine label="Main Conveyor 30m" />

        {/* MIDDLE ROW */}
        <div className="text-xs text-slate-500 pl-2 mb-1">Middle Row (2K Machines)</div>
        <div className="flex gap-3 flex-wrap justify-start bg-slate-800/30 p-4 rounded-xl">
          {middleRow.map((machine) => (
            <MachineCard key={machine.machineId} machine={machine} />
          ))}
        </div>

        {/* Secondary Conveyor Line */}
        <ConveyorLine label="Secondary Conveyor 800mm" />

        {/* BOTTOM ROW */}
        <div className="text-xs text-slate-500 pl-2 mb-1">Bottom Row (60T Machines)</div>
        <div className="flex gap-3 flex-wrap justify-start bg-slate-800/30 p-4 rounded-xl">
          {bottomRow.map((machine) => (
            <MachineCard key={machine.machineId} machine={machine} />
          ))}
        </div>

        {/* Walkway */}
        <div className="mt-6 h-8 bg-gradient-to-r from-amber-900/30 via-amber-800/40 to-amber-900/30 rounded-lg flex items-center justify-center">
          <span className="text-amber-600/60 text-sm font-medium tracking-wider">WALKWAY</span>
        </div>
      </div>

      {/* Legend */}
      <div className="mt-8 flex flex-wrap gap-4 justify-center text-xs text-slate-500">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-purple-600 rounded text-white text-[10px] flex items-center justify-center font-bold">
            2K
          </div>
          <span>Multi-shot Machine</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="px-2 py-0.5 bg-slate-700 rounded text-slate-300 text-[10px]">160T</div>
          <span>Clamping Tonnage</span>
        </div>
      </div>
    </div>
  );
}
