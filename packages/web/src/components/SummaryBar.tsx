// packages/web/src/components/SummaryBar.tsx

interface Summary {
  running: number;
  idle: number;
  fault: number;
  offline: number;
  totalCycles?: number;
}

export function SummaryBar({ summary }: { summary: Summary }) {
  return (
    <div className="flex gap-4 text-lg">
      <div className="px-4 py-2 rounded-lg bg-slate-800 border-l-4 border-green-500">
        <span className="font-bold">{summary.running}</span> Running
      </div>
      <div className="px-4 py-2 rounded-lg bg-slate-800 border-l-4 border-yellow-500">
        <span className="font-bold">{summary.idle}</span> Idle
      </div>
      <div className="px-4 py-2 rounded-lg bg-slate-800 border-l-4 border-red-500">
        <span className="font-bold">{summary.fault}</span> Fault
      </div>
      <div className="px-4 py-2 rounded-lg bg-slate-800 border-l-4 border-slate-500">
        <span className="font-bold">{summary.offline}</span> Offline
      </div>
    </div>
  );
}
