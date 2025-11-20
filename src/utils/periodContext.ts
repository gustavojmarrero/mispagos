import type { DateRangePreset } from '@/components/dashboard/DateRangeFilter';

export interface PeriodContext {
  // Labels para las tarjetas
  weekLabel: string;
  monthLabel: string;
  periodName: string;

  // Controles de visibilidad
  showAlerts: boolean;
  showTimeline: boolean;
  showCardPeriods: boolean; // Análisis de períodos de tarjetas

  // Tipo de período para cálculos
  isHistorical: boolean;
  isCurrent: boolean;

  // Para cálculos de promedio
  aggregationType: 'weekly' | 'monthly' | 'total';
}

export function getPeriodContext(
  preset: DateRangePreset,
  from: Date | null,
  to: Date | null
): PeriodContext {
  const now = new Date();

  switch (preset) {
    case 'current-month':
      return {
        weekLabel: 'Esta Semana',
        monthLabel: 'Este Mes',
        periodName: 'Mes Actual',
        showAlerts: true,
        showTimeline: true,
        showCardPeriods: true,
        isHistorical: false,
        isCurrent: true,
        aggregationType: 'total',
      };

    case 'last-month':
      return {
        weekLabel: 'Promedio Semanal',
        monthLabel: 'Mes Anterior',
        periodName: 'Mes Anterior',
        showAlerts: false,
        showTimeline: false,
        showCardPeriods: false,
        isHistorical: true,
        isCurrent: false,
        aggregationType: 'weekly',
      };

    case 'last-3-months':
      return {
        weekLabel: 'Promedio Mensual',
        monthLabel: 'Últimos 3 Meses',
        periodName: 'Últimos 3 Meses',
        showAlerts: false,
        showTimeline: false,
        showCardPeriods: false,
        isHistorical: true,
        isCurrent: false,
        aggregationType: 'monthly',
      };

    case 'last-6-months':
      return {
        weekLabel: 'Promedio Mensual',
        monthLabel: 'Últimos 6 Meses',
        periodName: 'Últimos 6 Meses',
        showAlerts: false,
        showTimeline: false,
        showCardPeriods: false,
        isHistorical: true,
        isCurrent: false,
        aggregationType: 'monthly',
      };

    case 'all':
      return {
        weekLabel: 'Promedio Mensual',
        monthLabel: 'Total Histórico',
        periodName: 'Todos los Datos',
        showAlerts: false,
        showTimeline: false,
        showCardPeriods: false,
        isHistorical: true,
        isCurrent: false,
        aggregationType: 'monthly',
      };

    case 'custom':
      // Para rangos personalizados, detectar si incluye el presente
      const includesNow = to ? to >= now : false;
      const isRecentPast = from && to ?
        (now.getTime() - to.getTime()) / (1000 * 60 * 60 * 24) <= 7 :
        false;

      return {
        weekLabel: includesNow ? 'Esta Semana' : 'Promedio del Período',
        monthLabel: 'Período Personalizado',
        periodName: 'Período Personalizado',
        showAlerts: includesNow,
        showTimeline: includesNow || isRecentPast,
        showCardPeriods: includesNow,
        isHistorical: !includesNow,
        isCurrent: includesNow,
        aggregationType: 'total',
      };

    default:
      return {
        weekLabel: 'Esta Semana',
        monthLabel: 'Este Mes',
        periodName: 'Mes Actual',
        showAlerts: true,
        showTimeline: true,
        showCardPeriods: true,
        isHistorical: false,
        isCurrent: true,
        aggregationType: 'total',
      };
  }
}

/**
 * Calcula el número de semanas en un rango de fechas
 */
export function getWeeksInPeriod(from: Date, to: Date): number {
  const diffTime = Math.abs(to.getTime() - from.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return Math.max(1, Math.ceil(diffDays / 7));
}

/**
 * Calcula el número de meses en un rango de fechas
 */
export function getMonthsInPeriod(from: Date, to: Date): number {
  const yearDiff = to.getFullYear() - from.getFullYear();
  const monthDiff = to.getMonth() - from.getMonth();
  return Math.max(1, yearDiff * 12 + monthDiff + 1);
}

/**
 * Formatea un rango de fechas para mostrar
 */
export function formatDateRange(from: Date | null, to: Date | null): string {
  if (!from || !to) return '';

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('es-MX', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  return `${formatDate(from)} - ${formatDate(to)}`;
}
