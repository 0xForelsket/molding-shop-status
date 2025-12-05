// packages/web/src/components/FloorLayoutDashboard.tsx
// Industrial Precision Style - Light mode floor layout view

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

// Status colors - Industrial Precision palette
const statusColors: Record<string, { bg: string; border: string; text: string }> = {
  running: { bg: 'bg-emerald-50', border: 'border-emerald-500', text: 'text-emerald-700' },
  idle: { bg: 'bg-amber-50', border: 'border-amber-500', text: 'text-amber-700' },
  fault: { bg: 'bg-red-50', border: 'border-red-500', text: 'text-red-700' },
  offline: { bg: 'bg-slate-100', border: 'border-slate-400', text: 'text-slate-500' },
};

function FloorMachineCard({ machine }: { machine: Machine }) {
  const colors = statusColors[machine.status] || statusColors.offline;

  return (
    <div
      className={cn(
        'relative p-3 rounded border-l-4 bg-white shadow-sm hover:shadow-md transition-shadow cursor-pointer min-w-[100px]',
        colors.bg,
        colors.border
      )}
    >
      {/* 2K Badge */}
      {machine.is2K && (
        <div className="absolute -top-2 -right-2 bg-purple-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
          2K
        </div>
      )}

      {/* Machine Name */}
      <div className="text-base font-bold text-slate-900">{machine.machineName}</div>

      {/* Tonnage */}
      <div className="text-xs text-slate-500">{machine.tonnage}T</div>

      {/* Status indicator */}
      <div className={cn('text-xs font-semibold mt-1 uppercase', colors.text)}>
        {machine.status}
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
      <div className="flex-1 h-2 bg-slate-200 rounded-full">
        <div className="h-full flex items-center justify-center">
          <div className="w-[95%] h-1 bg-slate-300 rounded-full" />
        </div>
      </div>
      {label && (
        <div className="absolute -top-5 left-1/2 -translate-x-1/2 text-xs text-slate-400 font-medium">
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-slate-300 border-t-emerald-600" />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* TOP ROW */}
      <div className="text-xs text-slate-500 uppercase tracking-wide pl-2 mb-1">
        Top Row (Main Conveyor)
      </div>
      <div className="flex gap-3 flex-wrap justify-start bg-white border border-slate-200 p-4 rounded">
        {topRow.map((machine) => (
          <FloorMachineCard key={machine.machineId} machine={machine} />
        ))}
      </div>

      {/* Main Conveyor Line */}
      <ConveyorLine label="Main Conveyor 30m" />

      {/* MIDDLE ROW */}
      <div className="text-xs text-slate-500 uppercase tracking-wide pl-2 mb-1">
        Middle Row (2K Machines)
      </div>
      <div className="flex gap-3 flex-wrap justify-start bg-white border border-slate-200 p-4 rounded">
        {middleRow.map((machine) => (
          <FloorMachineCard key={machine.machineId} machine={machine} />
        ))}
      </div>

      {/* Secondary Conveyor Line */}
      <ConveyorLine label="Secondary Conveyor 800mm" />

      {/* BOTTOM ROW */}
      <div className="text-xs text-slate-500 uppercase tracking-wide pl-2 mb-1">
        Bottom Row (60T Machines)
      </div>
      <div className="flex gap-3 flex-wrap justify-start bg-white border border-slate-200 p-4 rounded">
        {bottomRow.map((machine) => (
          <FloorMachineCard key={machine.machineId} machine={machine} />
        ))}
      </div>

      {/* Walkway */}
      <div className="mt-6 h-8 bg-amber-50 border border-amber-200 rounded flex items-center justify-center">
        <span className="text-amber-600 text-sm font-medium tracking-wider">WALKWAY</span>
      </div>

      {/* Legend */}
      <div className="mt-4 flex flex-wrap gap-4 justify-center text-xs text-slate-500">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-purple-600 rounded text-white text-[10px] flex items-center justify-center font-bold">
            2K
          </div>
          <span>Multi-shot Machine</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="px-2 py-0.5 bg-slate-200 rounded text-slate-600 text-[10px]">160T</div>
          <span>Clamping Tonnage</span>
        </div>
      </div>
    </div>
  );
}
