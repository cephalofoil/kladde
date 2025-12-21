import { safeParseDate } from "@/lib/dates/parse";

export type DateInput = Date | string | number | undefined | null;

export function formatDate(
  input: DateInput,
  options: Intl.DateTimeFormatOptions = {
    year: "numeric",
    month: "short",
    day: "numeric",
  },
  locale?: string | string[],
): string {
  const date = safeParseDate(input);
  try {
    return new Intl.DateTimeFormat(locale, options).format(date);
  } catch {
    return date.toLocaleDateString();
  }
}

export function formatDateISO(input: DateInput): string {
  const d = safeParseDate(input);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
