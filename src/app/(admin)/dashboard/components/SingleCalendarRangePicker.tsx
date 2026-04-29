"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { createPortal } from "react-dom";

export type DateRangeValue = {
  start: string;
  end: string;
};

type CalendarDay = {
  date: Date;
  inCurrentMonth: boolean;
};

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function parseDateValue(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day, 12);
}

function formatDateValue(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDateLabel(value: string) {
  return parseDateValue(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function isSameDay(left: Date, right: Date) {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

function buildCalendarDays(month: Date) {
  const firstDayOfMonth = new Date(month.getFullYear(), month.getMonth(), 1, 12);
  const calendarStart = new Date(firstDayOfMonth);
  calendarStart.setDate(firstDayOfMonth.getDate() - firstDayOfMonth.getDay());

  const days: CalendarDay[] = [];

  for (let index = 0; index < 42; index += 1) {
    const current = new Date(calendarStart);
    current.setDate(calendarStart.getDate() + index);
    days.push({
      date: current,
      inCurrentMonth: current.getMonth() === month.getMonth(),
    });
  }

  return days;
}

export function SingleCalendarRangePicker({
  value,
  onChange,
  placeholder = "Select date range",
  ariaLabel = "Filter by date range",
}: {
  value: DateRangeValue;
  onChange: (nextValue: DateRangeValue) => void;
  placeholder?: string;
  ariaLabel?: string;
}) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const initialMonth = value.end || value.start ? parseDateValue(value.end || value.start) : new Date();
  const [isOpen, setIsOpen] = useState(false);
  const [visibleMonth, setVisibleMonth] = useState(
    new Date(initialMonth.getFullYear(), initialMonth.getMonth(), 1, 12)
  );
  const [panelPosition, setPanelPosition] = useState({ top: 0, left: 0, width: 320 });

  const startDate = value.start ? parseDateValue(value.start) : null;
  const endDate = value.end ? parseDateValue(value.end) : null;

  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        rootRef.current &&
        !rootRef.current.contains(target) &&
        panelRef.current &&
        !panelRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const updatePanelPosition = () => {
      if (!rootRef.current) return;

      const rect = rootRef.current.getBoundingClientRect();
      const viewportPadding = 16;
      const panelWidth = Math.min(320, window.innerWidth - viewportPadding * 2);
      const left = Math.min(
        Math.max(viewportPadding, rect.right - panelWidth),
        window.innerWidth - panelWidth - viewportPadding
      );

      setPanelPosition({
        top: rect.bottom + 8,
        left,
        width: panelWidth,
      });
    };

    updatePanelPosition();

    window.addEventListener("resize", updatePanelPosition);
    window.addEventListener("scroll", updatePanelPosition, true);

    return () => {
      window.removeEventListener("resize", updatePanelPosition);
      window.removeEventListener("scroll", updatePanelPosition, true);
    };
  }, [isOpen]);

  const days = useMemo(() => buildCalendarDays(visibleMonth), [visibleMonth]);

  const label = value.start
    ? value.end
      ? `${formatDateLabel(value.start)} - ${formatDateLabel(value.end)}`
      : `${formatDateLabel(value.start)} - Select end date`
    : placeholder;

  const handleDaySelect = (day: Date) => {
    const nextValue = formatDateValue(day);

    if (!value.start || value.end) {
      onChange({ start: nextValue, end: "" });
      return;
    }

    const currentStart = parseDateValue(value.start);

    if (day < currentStart) {
      onChange({ start: nextValue, end: value.start });
    } else {
      onChange({ start: value.start, end: nextValue });
    }
  };

  const calendarPanel =
    isOpen && typeof document !== "undefined"
      ? createPortal(
          <div
            ref={panelRef}
            className="fixed z-[9999] rounded-[24px] border border-[#cfeef7] bg-white p-4 shadow-[0_20px_50px_rgba(3,199,254,0.12)]"
            style={{
              top: panelPosition.top,
              left: panelPosition.left,
              width: panelPosition.width,
            }}
          >
            <div className="mb-4 flex items-center justify-between">
              <button
                type="button"
                onClick={() =>
                  setVisibleMonth(
                    new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() - 1, 1, 12)
                  )
                }
                className="rounded-xl p-2 text-[#888] transition-colors hover:bg-[#f2fbff] hover:text-[#111]"
                aria-label="Previous month"
              >
                <ChevronLeft size={18} />
              </button>
              <span className="text-sm font-black text-[#111]">
                {visibleMonth.toLocaleDateString(undefined, {
                  month: "long",
                  year: "numeric",
                })}
              </span>
              <button
                type="button"
                onClick={() =>
                  setVisibleMonth(
                    new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 1, 12)
                  )
                }
                className="rounded-xl p-2 text-[#888] transition-colors hover:bg-[#f2fbff] hover:text-[#111]"
                aria-label="Next month"
              >
                <ChevronRight size={18} />
              </button>
            </div>

            <div className="mb-2 grid grid-cols-7 gap-1">
              {WEEKDAY_LABELS.map((labelText) => (
                <div
                  key={labelText}
                  className="py-1 text-center text-[10px] font-black uppercase tracking-widest text-[#aaa]"
                >
                  {labelText}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1">
              {days.map(({ date, inCurrentMonth }) => {
                const isoDate = formatDateValue(date);
                const isSelectedStart = Boolean(startDate && isSameDay(date, startDate));
                const isSelectedEnd = Boolean(endDate && isSameDay(date, endDate));
                const isInRange = Boolean(startDate && endDate && date >= startDate && date <= endDate);
                const isEdge = isSelectedStart || isSelectedEnd;

                return (
                  <button
                    key={isoDate}
                    type="button"
                    onClick={() => handleDaySelect(date)}
                    className={`h-10 rounded-xl text-sm font-black transition-colors ${
                      isEdge
                        ? "bg-[#03c7fe] text-white shadow-[0_6px_16px_rgba(3,199,254,0.25)]"
                        : isInRange
                        ? "bg-[#e0f4fb] text-[#111]"
                        : inCurrentMonth
                        ? "text-[#555] hover:bg-[#f2fbff]"
                        : "text-[#ccc] hover:bg-[#fbfdff]"
                    }`}
                    aria-label={`Select ${formatDateLabel(isoDate)}`}
                  >
                    {date.getDate()}
                  </button>
                );
              })}
            </div>

            <div className="mt-4 flex items-center justify-between gap-3 border-t border-[#e0f4fb] pt-3">
              <p className="text-xs font-bold text-[#888]">
                {value.start && !value.end
                  ? "Select an end date to finish the range."
                  : "Pick a start and end date."}
              </p>
              {(value.start || value.end) && (
                <button
                  type="button"
                  onClick={() => onChange({ start: "", end: "" })}
                  className="rounded-xl border border-[#cfeef7] bg-white px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-[#111] transition-colors hover:border-[#03c7fe] hover:text-[#03c7fe]"
                >
                  Clear
                </button>
              )}
            </div>
          </div>,
          document.body
        )
      : null;

  return (
    <div ref={rootRef} className="relative w-full sm:w-auto">
      <button
        type="button"
        onClick={() => {
          const nextAnchor = value.end || value.start;
          if (!isOpen && nextAnchor) {
            const nextMonth = parseDateValue(nextAnchor);
            setVisibleMonth(new Date(nextMonth.getFullYear(), nextMonth.getMonth(), 1, 12));
          }
          setIsOpen((current) => !current);
        }}
        className="flex w-full items-center justify-between gap-3 rounded-2xl border border-[#cfeef7] bg-white px-4 py-3 text-left text-xs font-bold text-[#111] outline-none transition-colors hover:border-[#03c7fe] focus:border-[#03c7fe] focus:ring-2 focus:ring-[#03c7fe]/20 sm:min-w-72"
        aria-label={ariaLabel}
        aria-expanded={isOpen}
      >
        <span className="inline-flex min-w-0 items-center gap-2">
          <CalendarDays size={16} className="shrink-0 text-[#03c7fe]" />
          <span className="truncate">{label}</span>
        </span>
        {(value.start || value.end) && (
          <span className="rounded-full bg-[#e0f4fb] px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-[#03c7fe]">
            Active
          </span>
        )}
      </button>
      {calendarPanel}
    </div>
  );
}
