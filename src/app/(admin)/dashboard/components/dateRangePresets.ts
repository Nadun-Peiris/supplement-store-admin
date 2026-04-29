import type { DateRangeValue } from "@/app/(admin)/dashboard/components/SingleCalendarRangePicker";

export type DashboardRangePreset =
  | "today"
  | "7d"
  | "30d"
  | "90d"
  | "12m"
  | "all"
  | "custom";

export const DASHBOARD_RANGE_PRESETS: Array<{
  key: DashboardRangePreset;
  label: string;
}> = [
  { key: "today", label: "Today" },
  { key: "7d", label: "7 Days" },
  { key: "30d", label: "30 Days" },
  { key: "90d", label: "90 Days" },
  { key: "12m", label: "12 Months" },
  { key: "all", label: "All Time" },
  { key: "custom", label: "Custom" },
];

function startOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function endOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(23, 59, 59, 999);
  return next;
}

function formatDateInput(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getPresetDateRange(
  preset: Exclude<DashboardRangePreset, "custom">
): DateRangeValue {
  if (preset === "all") {
    return { start: "", end: "" };
  }

  const now = new Date();
  const start = startOfDay(now);
  const end = endOfDay(now);

  if (preset === "today") {
    return {
      start: formatDateInput(start),
      end: formatDateInput(end),
    };
  }

  if (preset === "7d") {
    start.setDate(start.getDate() - 6);
  } else if (preset === "30d") {
    start.setDate(start.getDate() - 29);
  } else if (preset === "90d") {
    start.setDate(start.getDate() - 89);
  } else if (preset === "12m") {
    start.setMonth(start.getMonth() - 11);
  }

  return {
    start: formatDateInput(start),
    end: formatDateInput(end),
  };
}
