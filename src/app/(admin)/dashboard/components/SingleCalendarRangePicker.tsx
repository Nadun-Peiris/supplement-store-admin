"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";

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
  const initialMonth = value.end || value.start ? parseDateValue(value.end || value.start) : new Date();
  const [isOpen, setIsOpen] = useState(false);
  const [visibleMonth, setVisibleMonth] = useState(
    new Date(initialMonth.getFullYear(), initialMonth.getMonth(), 1, 12)
  );

  const startDate = value.start ? parseDateValue(value.start) : null;
  const endDate = value.end ? parseDateValue(value.end) : null;

  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
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
        className="flex w-full items-center justify-between gap-3 rounded-lg border border-gray-300 bg-white px-3 py-2 text-left text-sm text-gray-900 outline-none transition-colors hover:bg-gray-50 focus:border-[#01C7FE] focus:ring-1 focus:ring-[#01C7FE] sm:min-w-72"
        aria-label={ariaLabel}
        aria-expanded={isOpen}
      >
        <span className="inline-flex min-w-0 items-center gap-2">
          <CalendarDays size={16} className="shrink-0 text-gray-500" />
          <span className="truncate">{label}</span>
        </span>
        {(value.start || value.end) && (
          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">
            Active
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full z-30 mt-2 w-[20rem] rounded-xl border border-gray-200 bg-white p-4 shadow-xl">
          <div className="mb-4 flex items-center justify-between">
            <button
              type="button"
              onClick={() =>
                setVisibleMonth(
                  new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() - 1, 1, 12)
                )
              }
              className="rounded-lg p-2 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900"
              aria-label="Previous month"
            >
              <ChevronLeft size={18} />
            </button>
            <span className="text-sm font-semibold text-gray-900">
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
              className="rounded-lg p-2 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900"
              aria-label="Next month"
            >
              <ChevronRight size={18} />
            </button>
          </div>

          <div className="mb-2 grid grid-cols-7 gap-1">
            {WEEKDAY_LABELS.map((labelText) => (
              <div
                key={labelText}
                className="py-1 text-center text-xs font-semibold uppercase tracking-wide text-gray-400"
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
                  className={`h-10 rounded-lg text-sm font-medium transition-colors ${
                    isEdge
                      ? "bg-[#01C7FE] text-white"
                      : isInRange
                      ? "bg-sky-100 text-sky-900"
                      : inCurrentMonth
                      ? "text-gray-700 hover:bg-gray-100"
                      : "text-gray-300 hover:bg-gray-50"
                  }`}
                  aria-label={`Select ${formatDateLabel(isoDate)}`}
                >
                  {date.getDate()}
                </button>
              );
            })}
          </div>

          <div className="mt-4 flex items-center justify-between gap-3 border-t border-gray-100 pt-3">
            <p className="text-xs text-gray-500">
              {value.start && !value.end ? "Select an end date to finish the range." : "Pick a start and end date."}
            </p>
            {(value.start || value.end) && (
              <button
                type="button"
                onClick={() => onChange({ start: "", end: "" })}
                className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 transition-colors hover:bg-gray-100"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
