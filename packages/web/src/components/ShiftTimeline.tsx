// packages/web/src/components/ShiftTimeline.tsx
// 4-day shift timeline with production log indicators

import { useMemo } from 'react';

interface Shift {
  id: number;
  name: string;
  startTime: string;
  endTime: string;
}

interface ProductionLog {
  shiftId: number;
  shiftDate: string;
  quantityProduced: number;
}

interface ShiftTimelineProps {
  shifts: Shift[];
  logs: ProductionLog[];
  selectedDate: Date;
  selectedShiftId: number | null;
  onSelect: (date: Date, shiftId: number) => void;
}

export function ShiftTimeline({
  shifts,
  logs,
  selectedDate,
  selectedShiftId,
  onSelect,
}: ShiftTimelineProps) {
  // Generate last 4 days
  const days = useMemo(() => {
    const result = [];
    const today = new Date();
    for (let i = 3; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      result.push(date);
    }
    return result;
  }, []);

  const formatDayLabel = (date: Date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const compareDate = new Date(date);
    compareDate.setHours(0, 0, 0, 0);

    if (compareDate.getTime() === today.getTime()) {
      return 'Today';
    }
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  const getLogsForShift = (date: Date, shiftId: number) => {
    const dateStr = date.toISOString().split('T')[0];
    return logs.filter((log) => log.shiftDate.startsWith(dateStr) && log.shiftId === shiftId);
  };

  const isSelected = (date: Date, shiftId: number) => {
    const dateStr = date.toISOString().split('T')[0];
    const selectedStr = selectedDate.toISOString().split('T')[0];
    return dateStr === selectedStr && shiftId === selectedShiftId;
  };

  const isCurrentShift = (date: Date, shift: Shift) => {
    const now = new Date();
    const dateStr = date.toISOString().split('T')[0];
    const todayStr = now.toISOString().split('T')[0];
    if (dateStr !== todayStr) return false;

    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    const start = shift.startTime;
    const end = shift.endTime;

    if (start > end) {
      return currentTime >= start || currentTime < end;
    }
    return currentTime >= start && currentTime < end;
  };

  return (
    <div className="bg-white rounded-lg border border-slate-200 p-4 mb-4">
      <div className="flex justify-between gap-2">
        {days.map((date) => (
          <div key={date.toISOString()} className="flex-1">
            <div className="text-xs font-medium text-slate-500 text-center mb-2">
              {formatDayLabel(date)}
            </div>
            <div className="flex gap-1">
              {shifts.map((shift) => {
                const shiftLogs = getLogsForShift(date, shift.id);
                const hasLogs = shiftLogs.length > 0;
                const totalProduced = shiftLogs.reduce(
                  (sum, l) => sum + (l.quantityProduced || 0),
                  0
                );
                const selected = isSelected(date, shift.id);
                const isCurrent = isCurrentShift(date, shift);

                return (
                  <button
                    key={shift.id}
                    type="button"
                    onClick={() => onSelect(date, shift.id)}
                    className={`flex-1 p-2 rounded text-center transition-all relative ${
                      selected
                        ? 'bg-indigo-100 ring-2 ring-indigo-400'
                        : isCurrent
                          ? 'bg-emerald-50 border-2 border-emerald-300'
                          : 'bg-slate-50 hover:bg-slate-100'
                    }`}
                  >
                    <div className="text-xs font-medium text-slate-700">
                      {shift.name.split(' ')[0]}
                    </div>
                    {hasLogs ? (
                      <div className="mt-1 flex justify-center gap-0.5">
                        {shiftLogs.slice(0, 3).map((log, i) => (
                          <span
                            key={`dot-${i}-${log.quantityProduced}`}
                            className="w-1.5 h-1.5 rounded-full bg-emerald-500"
                          />
                        ))}
                        {shiftLogs.length > 3 && <span className="text-xs text-slate-400">+</span>}
                      </div>
                    ) : (
                      <div className="mt-1 h-2 text-xs text-slate-300">—</div>
                    )}
                    {hasLogs && (
                      <div className="text-xs text-slate-500 mt-1">
                        {totalProduced.toLocaleString()}
                      </div>
                    )}
                    {isCurrent && (
                      <div className="absolute -top-1 -right-1 w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
