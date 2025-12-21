export function safeParseDate(
  date: string | number | Date | null | undefined,
): Date {
  if (!date) return new Date();
  const parsed = new Date(date);
  return isNaN(parsed.getTime()) ? new Date() : parsed;
}
