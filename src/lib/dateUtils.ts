/**
 * Utilidades de fecha compartidas
 */

/**
 * Convierte cualquier tipo de fecha (Date, Firestore Timestamp, string) a Date
 */
export function toDate(date: unknown): Date {
  if (date instanceof Date) return date;
  if (date && typeof date === 'object' && 'toDate' in date && typeof (date as { toDate: () => Date }).toDate === 'function') {
    return (date as { toDate: () => Date }).toDate(); // Firestore Timestamp
  }
  return new Date(date as string | number);
}
