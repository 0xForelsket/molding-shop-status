// packages/web/src/components/ShiftTimeline.tsx
// Redesigned with a cleaner 7-day view and industrial aesthetic

import { ChevronRight } from 'lucide-react';
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
  // Generate last 7 days
  const days = useMemo(() => {
    const result = [];
    const today = new Date();
    for (let i = 6; i >= 0; i--) {
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

  const isToday = (date: Date) => {
    const today = new Date();
    return date.toISOString().split('T')[0] === today.toISOString().split('T')[0];
  };

  return (
    <div className="mb-6 overflow-x-auto pb-2">
      <div className="flex items-center gap-2 min-w-max">
        {days.map((date, dayIndex) => (
          <div key={date.toISOString()} className="flex items-center">
            <div
              className={`rounded-lg overflow-hidden border transition-all ${
                isToday(date)
                  ? 'bg-white border-blue-400 shadow-md shadow-blue-100'
                  : 'bg-white border-slate-200'
              }`}
            >
              {/* Day Header */}
              <div
                className={`px-3 py-1.5 text-center border-b ${
                  isToday(date) ? 'bg-blue-50 border-blue-100' : 'bg-slate-50 border-slate-100'
                }`}
              >
                <div
                  className={`text-[10px] font-bold uppercase tracking-wider ${
                    isToday(date) ? 'text-blue-700' : 'text-slate-500'
                  }`}
                >
                  {formatDayLabel(date)}
                </div>
              </div>

              {/* Shifts */}
              <div className="flex divide-x divide-slate-100">
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
                      className={`
                        relative px-3 py-2 min-w-[70px] transition-all hover:bg-slate-50
                        ${selected ? 'bg-blue-50 ring-inset ring-2 ring-blue-500 z-10' : ''}
                      `}
                    >
                      <div className="text-[10px] font-bold text-slate-700 mb-1">
                        {shift.name.split(' ')[0]}
                      </div>

                      {hasLogs ? (
                        <>
                          <div className="flex justify-center gap-0.5 mb-0.5">
                            {shiftLogs.slice(0, 3).map((_, i) => (
                              <span
                                key={`dot-${shift.id}-${i}`}
                                className="w-1 h-1 rounded-full bg-emerald-500"
                              />
                            ))}
                            {shiftLogs.length > 3 && (
                              <span className="text-[8px] text-slate-400">+</span>
                            )}
                          </div>
                          <div className="text-[10px] font-medium text-slate-600">
                            {totalProduced.toLocaleString()}
                          </div>
                        </>
                      ) : (
                        <div className="text-[10px] text-slate-300 py-1">—</div>
                      )}

                      {isCurrent && (
                        <div className="absolute top-1 right-1 w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Arrow between days */}
            {dayIndex < days.length - 1 && (
              <ChevronRight className="w-3 h-3 text-slate-300 mx-1 flex-shrink-0" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
