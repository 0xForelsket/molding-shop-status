import { Calendar, Clock } from 'lucide-react';

interface Shift {
  id: number;
  name: string;
  startTime: string;
  endTime: string;
}

interface ShiftDaySelectorProps {
  shifts: Shift[];
  selectedDate: Date;
  selectedShiftId: number | null;
  timeFrom: string;
  timeTo: string;
  onDateChange: (date: Date) => void;
  onShiftChange: (shiftId: number) => void;
  onTimeChange: (from: string, to: string) => void;
}

export function ShiftDaySelector({
  shifts,
  selectedDate,
  selectedShiftId,
  timeFrom,
  timeTo,
  onDateChange,
  onShiftChange,
  onTimeChange,
}: ShiftDaySelectorProps) {
  const selectedShift = shifts.find((s) => s.id === selectedShiftId);

  const handleUseFullShift = () => {
    if (selectedShift) {
      onTimeChange(selectedShift.startTime, selectedShift.endTime);
    }
  };

  const formatDate = (date: Date) => {
    return date.toISOString().split('T')[0];
  };

  return (
    <div className="bg-white rounded-lg border border-slate-200 p-4 mb-4">
      <div className="grid grid-cols-2 gap-4">
        {/* Date Picker */}
        <div>
          <label
            htmlFor="shift-date"
            className="flex items-center gap-2 text-sm font-medium text-slate-700 mb-1"
          >
            <Calendar className="w-4 h-4" />
            Date
          </label>
          <input
            id="shift-date"
            type="date"
            value={formatDate(selectedDate)}
            onChange={(e) => onDateChange(new Date(e.target.value))}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-200 focus:border-indigo-500"
          />
        </div>

        {/* Shift Selector */}
        <div>
          <label
            htmlFor="shift-select"
            className="flex items-center gap-2 text-sm font-medium text-slate-700 mb-1"
          >
            <Clock className="w-4 h-4" />
            Shift
          </label>
          <select
            id="shift-select"
            value={selectedShiftId ?? ''}
            onChange={(e) => onShiftChange(Number(e.target.value))}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-200 focus:border-indigo-500"
          >
            <option value="">Select shift...</option>
            {shifts.map((shift) => (
              <option key={shift.id} value={shift.id}>
                {shift.name} ({shift.startTime} - {shift.endTime})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Time Range */}
      <div className="mt-4 pt-4 border-t border-slate-100">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-slate-700">Running Time</span>
          <button
            type="button"
            onClick={handleUseFullShift}
            disabled={!selectedShift}
            className="text-xs text-indigo-600 hover:text-indigo-700 font-medium disabled:opacity-50"
          >
            Use Full Shift
          </button>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="time"
            value={timeFrom}
            onChange={(e) => onTimeChange(e.target.value, timeTo)}
            className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-200 focus:border-indigo-500 text-sm"
          />
          <span className="text-slate-400">to</span>
          <input
            type="time"
            value={timeTo}
            onChange={(e) => onTimeChange(timeFrom, e.target.value)}
            className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-200 focus:border-indigo-500 text-sm"
          />
        </div>
      </div>
    </div>
  );
}
