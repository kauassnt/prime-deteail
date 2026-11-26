import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface MonthCalendarCardProps {
  /** Currently selected date in YYYY-MM-DD */
  selectedDate: string;
  /** Callback when a day cell is clicked */
  onSelectDate: (isoDate: string) => void;
  /** Currently displayed month (first day or any date inside that month in YYYY-MM-DD) */
  viewMonthDate: string;
  /** Callback when user navigates prev/next month */
  onChangeMonth: (deltaMonths: number) => void;
  /** Map of YYYY-MM-DD -> count of appointments on that day (renders indicator dots) */
  appointmentCounts?: Record<string, number>;
  /** Optional minimum selectable ISO date (e.g. today for customer booking) */
  minDate?: string;
}

const WEEKDAYS = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];

const toIsoDate = (date: Date): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

export const MonthCalendarCard: React.FC<MonthCalendarCardProps> = ({
  selectedDate,
  onSelectDate,
  viewMonthDate,
  onChangeMonth,
  appointmentCounts = {},
  minDate,
}) => {
  const todayIso = toIsoDate(new Date());

  const base = new Date(`${viewMonthDate.slice(0, 7)}-01T00:00:00`);
  const year = base.getFullYear();
  const month = base.getMonth();

  const monthTitle = base.toLocaleDateString('pt-BR', {
    month: 'long',
    year: 'numeric',
  });
  const formattedMonthTitle = monthTitle.charAt(0).toUpperCase() + monthTitle.slice(1);

  const firstDayOfWeek = new Date(year, month, 1).getDay(); // 0 = Sun
  const startGridDate = new Date(year, month, 1 - firstDayOfWeek);

  // Build full 42-cell (6 weeks x 7 days) calendar matrix so all dates around month edges are visible
  const cells = Array.from({ length: 42 }, (_, idx) => {
    const cellDate = new Date(startGridDate);
    cellDate.setDate(startGridDate.getDate() + idx);
    const iso = toIsoDate(cellDate);
    const inCurrentMonth = cellDate.getMonth() === month;
    const isSelected = iso === selectedDate;
    const isToday = iso === todayIso;
    const isDisabled = Boolean(minDate && iso < minDate);
    const count = appointmentCounts[iso] || 0;

    return {
      iso,
      dayNumber: cellDate.getDate(),
      inCurrentMonth,
      isSelected,
      isToday,
      isDisabled,
      count,
    };
  });

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-3 sm:p-4 min-w-0">
      {/* Month Header */}
      <div className="flex items-center justify-between gap-2 pb-2.5 mb-2 border-b border-slate-100">
        <button
          type="button"
          onClick={() => onChangeMonth(-1)}
          aria-label="Mês anterior"
          className="min-w-[36px] min-h-[36px] rounded-full bg-slate-50 border border-slate-200/80 hover:bg-slate-100 text-slate-600 flex items-center justify-center transition shrink-0"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        <h2 className="text-sm sm:text-base font-extrabold text-slate-900 tracking-tight text-center truncate">
          {formattedMonthTitle}
        </h2>

        <button
          type="button"
          onClick={() => onChangeMonth(1)}
          aria-label="Próximo mês"
          className="min-w-[36px] min-h-[36px] rounded-full bg-slate-50 border border-slate-200/80 hover:bg-slate-100 text-slate-600 flex items-center justify-center transition shrink-0"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Weekday Labels */}
      <div className="grid grid-cols-7 gap-0.5 sm:gap-1 mb-1">
        {WEEKDAYS.map(day => (
          <div
            key={day}
            className="text-center text-[10px] sm:text-[11px] font-bold text-slate-400 uppercase tracking-wider py-1"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Days Matrix */}
      <div className="grid grid-cols-7 gap-0.5 sm:gap-1">
        {cells.map(cell => {
          return (
            <button
              key={cell.iso}
              type="button"
              disabled={cell.isDisabled}
              onClick={() => onSelectDate(cell.iso)}
              aria-label={`Selecionar data ${cell.iso}`}
              aria-pressed={cell.isSelected}
              className={`min-h-[38px] sm:min-h-[42px] rounded-xl flex flex-col items-center justify-center relative transition text-xs sm:text-sm tabular-nums ${
                cell.isSelected
                  ? 'bg-[#EA580C] text-white font-black shadow-sm shadow-orange-500/30'
                  : cell.isDisabled
                    ? 'text-slate-300/70 cursor-not-allowed'
                    : cell.inCurrentMonth
                      ? cell.isToday
                        ? 'bg-[#FFEDD5] text-[#9A3412] font-extrabold ring-1 ring-[#EA580C] hover:bg-[#FDE68A]'
                        : 'text-slate-800 font-semibold hover:bg-slate-100'
                      : 'text-slate-300 font-medium hover:bg-slate-50'
              }`}
            >
              <span className="leading-none">{cell.dayNumber}</span>
              {cell.count > 0 && (
                <span
                  className={`mt-0.5 w-1.5 h-1.5 rounded-full ${
                    cell.isSelected ? 'bg-slate-900' : 'bg-[#EA580C]'
                  }`}
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};
