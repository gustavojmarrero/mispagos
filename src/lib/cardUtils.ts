/**
 * Utilidades para tarjetas de crédito
 */

export interface UsageBadge {
  text: string;
  color: string;
}

/**
 * Obtiene el color de la barra de utilización basado en el porcentaje
 */
export function getUsageColor(percent: number): string {
  if (percent < 50) return 'bg-green-500';
  if (percent < 80) return 'bg-yellow-500';
  return 'bg-red-500';
}

/**
 * Obtiene el badge de utilización con texto y color
 * @param short - Si true, usa texto corto (OK, Med, Alto). Si false, usa texto largo.
 */
export function getUsageBadge(percent: number, short: boolean = true): UsageBadge {
  if (percent < 50) {
    return { text: 'OK', color: 'bg-green-100 text-green-700' };
  }
  if (percent < 80) {
    return {
      text: short ? 'Med' : 'Precaución',
      color: 'bg-yellow-100 text-yellow-700'
    };
  }
  return {
    text: short ? 'Alto' : 'Crítico',
    color: 'bg-red-100 text-red-700'
  };
}

/**
 * Calcula el porcentaje de utilización de una tarjeta
 */
export function calculateUsagePercent(currentBalance: number, creditLimit: number): number {
  if (creditLimit <= 0) return 0;
  return (currentBalance / creditLimit) * 100;
}
