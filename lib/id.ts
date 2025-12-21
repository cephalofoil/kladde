export function generateId(prefix: string): string {
  const random = Math.random().toString(36).slice(2, 11); // 9 chars
  return `${prefix}-${Date.now()}-${random}`;
}
