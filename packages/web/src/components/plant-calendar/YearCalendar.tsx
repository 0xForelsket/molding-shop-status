import { type ClassValue, clsx } from 'clsx';
import {
  eachDayOfInterval,
  eachWeekOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  getISOWeek,
  isSameMonth,
  isWeekend,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export interface CalendarDay {
  date: string;
  dayType: string;
  weekNum: number | null;
  name: string | null;
}

interface YearCalendarProps {
  year: number;
  onYearChange: (year: number) => void;
  data: Map<string, CalendarDay>;
  selectedDates: Set<string>;
  onToggleDate: (date: string) => void;
}

export function YearCalendar({
  year,
  onYearChange,
  data,
  selectedDates,
  onToggleDate,
}: YearCalendarProps) {
  const months = Array.from({ length: 12 }, (_, i) => new Date(year, i, 1));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => onYearChange(year - 1)}
            className="p-2 hover:bg-slate-100 rounded-full transition-colors"
          >
            <ChevronLeft className="w-5 h-5 text-slate-600" />
          </button>
          <h2 className="text-2xl font-bold text-slate-800">{year}</h2>
          <button
            type="button"
            onClick={() => onYearChange(year + 1)}
            className="p-2 hover:bg-slate-100 rounded-full transition-colors"
          >
            <ChevronRight className="w-5 h-5 text-slate-600" />
          </button>
        </div>

        {/* Legend - Compact */}
        <div className="flex gap-4 text-xs">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm bg-emerald-400 border border-emerald-500" />
            <span className="text-slate-600">Working</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm bg-amber-300 border border-amber-400" />
            <span className="text-slate-600">Weekend</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm bg-rose-400 border border-rose-500" />
            <span className="text-slate-600">Holiday</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm bg-orange-400 border border-orange-500" />
            <span className="text-slate-600">Shutdown</span>
          </div>
        </div>
      </div>

      {/* Months Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-6">
        {months.map((month) => (
          <MonthCalendar
            key={month.toISOString()}
            month={month}
            data={data}
            selectedDates={selectedDates}
            onToggleDate={onToggleDate}
          />
        ))}
      </div>
    </div>
  );
}

function MonthCalendar({
  month,
  data,
  selectedDates,
  onToggleDate,
}: {
  month: Date;
  data: Map<string, CalendarDay>;
  selectedDates: Set<string>;
  onToggleDate: (date: string) => void;
}) {
  const monthStart = startOfMonth(month);
  const monthEnd = endOfMonth(month);
  const startDate = startOfWeek(monthStart, { weekStartsOn: 1 }); // Monday start
  const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });

  const weeks = eachWeekOfInterval({ start: startDate, end: endDate }, { weekStartsOn: 1 });

  return (
    <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden flex flex-col h-full">
      {/* Month Header */}
      <div className="bg-slate-50 px-4 py-2 border-b border-slate-200 flex justify-between items-center">
        <h3 className="font-bold text-slate-700">{format(month, 'MMMM')}</h3>
        <span className="text-xs text-slate-400 font-mono">{format(month, 'yyyy')}</span>
      </div>

      {/* Days Header */}
      <div className="grid grid-cols-[2rem_repeat(7,1fr)] bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500">
        <div className="py-1 text-center border-r border-slate-200 bg-slate-100">W</div>
        {[
          { key: 'mon', label: 'M' },
          { key: 'tue', label: 'T' },
          { key: 'wed', label: 'W' },
          { key: 'thu', label: 'T' },
          { key: 'fri', label: 'F' },
          { key: 'sat', label: 'S' },
          { key: 'sun', label: 'S' },
        ].map((d, i) => (
          <div key={d.key} className={cn('py-1 text-center', i >= 5 && 'text-amber-600')}>
            {d.label}
          </div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className="flex-1">
        {weeks.map((weekStart) => {
          const weekNum = getISOWeek(weekStart);
          const days = eachDayOfInterval({
            start: weekStart,
            end: endOfWeek(weekStart, { weekStartsOn: 1 }),
          });

          return (
            <div
              key={weekStart.toISOString()}
              className="grid grid-cols-[2rem_repeat(7,1fr)] border-b border-slate-100 last:border-0"
            >
              {/* Week Number */}
              <div className="flex items-center justify-center text-[10px] font-medium text-slate-400 bg-slate-50 border-r border-slate-100">
                {weekNum}
              </div>

              {/* Days */}
              {days.map((day) => {
                const dateStr = format(day, 'yyyy-MM-dd');
                const isCurrentMonth = isSameMonth(day, month);
                const dayData = data.get(dateStr);
                const isSelected = selectedDates.has(dateStr);

                // Determine style based on type
                let type = dayData?.dayType;
                if (!type) {
                  type = isWeekend(day) ? 'weekend' : 'working';
                }

                const baseStyles =
                  'h-8 text-xs flex items-center justify-center relative transition-all cursor-pointer select-none w-full font-medium';
                const selectedStyles = isSelected
                  ? 'ring-2 ring-indigo-600 ring-offset-1 z-10'
                  : '';
                const opacityStyles = isCurrentMonth ? '' : 'opacity-30 grayscale';

                let bgStyles = 'bg-slate-100 hover:bg-slate-200 text-slate-700';
                if (type === 'working')
                  bgStyles = 'bg-emerald-400 hover:bg-emerald-500 text-emerald-950';
                if (type === 'weekend') bgStyles = 'bg-amber-300 hover:bg-amber-400 text-amber-900';
                if (type === 'holiday') bgStyles = 'bg-rose-400 hover:bg-rose-500 text-white';
                if (type === 'shutdown')
                  bgStyles = 'bg-orange-400 hover:bg-orange-500 text-orange-950';
                if (type === 'special') bgStyles = 'bg-purple-400 hover:bg-purple-500 text-white';

                return (
                  <button
                    type="button"
                    key={dateStr}
                    onClick={() => onToggleDate(dateStr)}
                    className={cn(baseStyles, bgStyles, selectedStyles, opacityStyles)}
                    title={`${dateStr}${dayData?.name ? `: ${dayData.name}` : ''}`}
                  >
                    {format(day, 'd')}
                    {dayData?.name && (
                      <div className="absolute bottom-0.5 right-0.5 w-1 h-1 rounded-full bg-current opacity-50" />
                    )}
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
