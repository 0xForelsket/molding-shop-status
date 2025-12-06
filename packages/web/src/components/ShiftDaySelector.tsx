import { Calendar, Clock, Timer } from 'lucide-react';

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
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 mb-8">
      <div className="flex flex-wrap items-end gap-6">
        {/* Date Picker */}
        <div className="flex-1 min-w-[180px]">
          <label
            htmlFor="shift-date"
            className="flex items-center gap-2 text-sm font-bold text-slate-700 mb-2 uppercase tracking-wide"
          >
            <Calendar className="w-4 h-4 text-slate-400" />
            Date
          </label>
          <input
            id="shift-date"
            type="date"
            value={formatDate(selectedDate)}
            onChange={(e) => onDateChange(new Date(e.target.value))}
            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-100 focus:border-blue-500 focus:bg-white transition-colors font-medium text-slate-700"
          />
        </div>

        {/* Shift Selector */}
        <div className="flex-1 min-w-[220px]">
          <label
            htmlFor="shift-select"
            className="flex items-center gap-2 text-sm font-bold text-slate-700 mb-2 uppercase tracking-wide"
          >
            <Clock className="w-4 h-4 text-slate-400" />
            Shift
          </label>
          <select
            id="shift-select"
            value={selectedShiftId ?? ''}
            onChange={(e) => onShiftChange(Number(e.target.value))}
            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-100 focus:border-blue-500 focus:bg-white transition-colors font-medium text-slate-700 appearance-none cursor-pointer"
          >
            <option value="">Select shift...</option>
            {shifts.map((shift) => (
              <option key={shift.id} value={shift.id}>
                {shift.name} ({shift.startTime} - {shift.endTime})
              </option>
            ))}
          </select>
        </div>

        {/* Divider */}
        <div className="hidden md:block w-px h-12 bg-slate-200" />

        {/* Time Range */}
        <div className="flex-1 min-w-[280px]">
          <div className="flex items-center justify-between mb-2">
            <span className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-wide">
              <Timer className="w-3.5 h-3.5" />
              Running Time
            </span>
            <button
              type="button"
              onClick={handleUseFullShift}
              disabled={!selectedShift}
              className="text-[10px] text-blue-600 hover:text-blue-700 font-bold disabled:opacity-40 disabled:cursor-not-allowed transition-colors uppercase tracking-wide"
            >
              Use Full Shift
            </button>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="time"
              value={timeFrom}
              onChange={(e) => onTimeChange(e.target.value, timeTo)}
              className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-100 focus:border-blue-500 focus:bg-white transition-colors text-xs font-medium text-slate-600"
            />
            <span className="text-slate-300 font-medium text-xs">to</span>
            <input
              type="time"
              value={timeTo}
              onChange={(e) => onTimeChange(timeFrom, e.target.value)}
              className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-100 focus:border-blue-500 focus:bg-white transition-colors text-xs font-medium text-slate-600"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
