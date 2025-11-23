import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Formatea un número como moneda
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
  }).format(amount);
}

/**
 * Formatea un número como moneda para input (sin símbolo)
 */
export function formatCurrencyInput(value: string): string {
  // Remover todo excepto números y punto
  const cleaned = value.replace(/[^\d.]/g, '');

  // Si está vacío, retornar 0.00
  if (!cleaned || cleaned === '0') return '0.00';

  // Convertir a número
  const numValue = parseFloat(cleaned);

  // Formatear con comas y siempre 2 decimales
  return numValue.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Quita el formato de moneda para obtener número
 */
export function parseCurrencyInput(value: string): number {
  const cleaned = value.replace(/[^\d.]/g, '');
  return parseFloat(cleaned) || 0;
}

/**
 * Formatea una fecha
 */
export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('es-MX', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(date);
}

/**
 * Formatea una fecha corta
 */
export function formatShortDate(date: Date): string {
  return new Intl.DateTimeFormat('es-MX', {
    month: 'short',
    day: 'numeric',
  }).format(date);
}

/**
 * Obtiene el próximo lunes desde una fecha dada
 */
export function getNextMonday(fromDate: Date = new Date()): Date {
  const date = new Date(fromDate);
  const dayOfWeek = date.getDay();

  // Si es lunes (1), el próximo lunes es en 7 días
  // Si es martes (2), el próximo lunes es en 6 días
  // etc.
  const daysUntilMonday = dayOfWeek === 0 ? 1 : (8 - dayOfWeek);

  date.setDate(date.getDate() + daysUntilMonday);
  date.setHours(0, 0, 0, 0);

  return date;
}

/**
 * Verifica si una fecha está en el rango de la semana actual
 * (desde hoy hasta el próximo lunes inclusive)
 */
export function isInCurrentWeek(date: Date): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const nextMonday = getNextMonday(today);

  return date >= today && date <= nextMonday;
}

/**
 * Obtiene la fecha de vencimiento basada en el día del mes
 */
export function getDueDateForDay(dueDay: number, referenceDate: Date = new Date()): Date {
  const date = new Date(referenceDate);
  date.setDate(dueDay);
  date.setHours(0, 0, 0, 0);

  // Si la fecha ya pasó este mes, usar el próximo mes
  if (date < referenceDate) {
    date.setMonth(date.getMonth() + 1);
  }

  return date;
}

/**
 * Obtiene el estado de una fecha de pago (overdue, upcoming, distant)
 */
export function getPaymentStatus(dueDate: Date): 'overdue' | 'upcoming' | 'distant' {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const diffTime = dueDate.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return 'overdue';
  if (diffDays <= 7) return 'upcoming';
  return 'distant';
}

/**
 * Detecta el tipo de tarjeta basándose en el número
 */
export function detectCardType(cardNumber: string): 'Visa' | 'Mastercard' | 'Amex' | 'Departamental' {
  const cleaned = cardNumber.replace(/\s/g, '');

  // Visa: empieza con 4
  if (/^4/.test(cleaned)) return "Visa";

  // Mastercard: 51-55 o 2221-2720
  if (/^5[1-5]/.test(cleaned) || /^2[2-7]/.test(cleaned)) return "Mastercard";

  // American Express: 34 o 37
  if (/^3[47]/.test(cleaned)) return "Amex";

  return "Departamental";
}

/**
 * Formatea un número de tarjeta con espacios cada 4 dígitos
 */
export function formatCardNumber(cardNumber: string): string {
  // Solo permitir números y espacios
  const cleaned = cardNumber.replace(/[^\d]/g, '');
  const match = cleaned.match(/.{1,4}/g);
  return match ? match.join(' ') : cleaned;
}

/**
 * Quita el formato de un número de tarjeta (elimina espacios)
 */
export function unformatCardNumber(cardNumber: string): string {
  return cardNumber.replace(/\s/g, '');
}

/**
 * Formatea una cuenta CLABE con espacios cada 3 dígitos
 */
export function formatCLABE(clabe: string): string {
  // Solo permitir números
  const cleaned = clabe.replace(/[^\d]/g, '');
  const match = cleaned.match(/.{1,3}/g);
  return match ? match.join(' ') : cleaned;
}

/**
 * Quita el formato de una cuenta CLABE (elimina espacios)
 */
export function unformatCLABE(clabe: string): string {
  return clabe.replace(/\s/g, '');
}

/**
 * Valida que una cuenta CLABE tenga 18 dígitos
 */
export function isValidCLABE(clabe: string): boolean {
  const cleaned = clabe.replace(/\s/g, '');
  return /^\d{18}$/.test(cleaned);
}

/**
 * Obtiene la ruta del icono SVG según el tipo de tarjeta
 */
export function getCardIcon(cardType: 'Visa' | 'Mastercard' | 'Amex' | 'Departamental' | 'Unknown'): string {
  const icons: Record<string, string> = {
    Visa: '/card-icons/visa.svg',
    Mastercard: '/card-icons/mastercard.svg',
    Amex: '/card-icons/amex.svg',
    Departamental: '/card-icons/unknown.svg',
    Unknown: '/card-icons/unknown.svg', // Compatibilidad con datos existentes
  };
  return icons[cardType] || icons.Departamental;
}
