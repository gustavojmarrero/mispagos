/**
 * Tipos para el sistema de alertas inteligentes
 */

export type AlertSeverity = 'critical' | 'warning' | 'info';

export type AlertType =
  | 'card_no_payment'
  | 'service_awaiting_amount'
  | 'service_line_no_payment'
  | 'overdue'
  | 'upcoming'
  | 'high_week'
  | 'low_credit';

export interface SmartAlert {
  id: string;
  type: AlertType;
  severity: AlertSeverity;
  title: string;
  description: string;
  action: {
    label: string;
    route: string;
    params?: Record<string, unknown>;
  };
  data: unknown;
  sortValue?: number;
}

/**
 * Ordena las alertas por severidad y valor de ordenamiento
 */
export function sortAlerts(alerts: SmartAlert[]): SmartAlert[] {
  const severityOrder: Record<AlertSeverity, number> = { critical: 0, warning: 1, info: 2 };

  return alerts.sort((a, b) => {
    const severityDiff = severityOrder[a.severity] - severityOrder[b.severity];
    if (severityDiff !== 0) return severityDiff;

    if (a.sortValue !== undefined && b.sortValue !== undefined) {
      return b.sortValue - a.sortValue;
    }
    return 0;
  });
}
