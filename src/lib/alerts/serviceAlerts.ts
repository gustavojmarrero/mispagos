/**
 * Alertas relacionadas con líneas de servicio
 */

import type { ServiceLineBillingAnalysis } from '../dashboardMetrics';
import type { SmartAlert } from './types';

interface ServiceAlertsContext {
  serviceLineBillingAnalysis: ServiceLineBillingAnalysis[];
  today: Date;
}

/**
 * Genera alertas para líneas de servicio sin pago programado después del corte
 */
export function generateServiceLineNoPaymentAlerts(ctx: ServiceAlertsContext): SmartAlert[] {
  const alerts: SmartAlert[] = [];

  const serviceLinesNeedingPayment = ctx.serviceLineBillingAnalysis.filter(
    (analysis) =>
      analysis.currentPeriod.status === 'not_programmed' &&
      ctx.today > analysis.currentPeriod.cutoffDate
  );

  serviceLinesNeedingPayment.forEach((analysis) => {
    const daysAfterCutoff = analysis.currentPeriod.daysAfterCutoff;

    alerts.push({
      id: `service-line-no-payment-${analysis.serviceLine.id}`,
      type: 'service_line_no_payment',
      severity: 'critical',
      title: `${analysis.service.name} - ${analysis.serviceLine.name} sin pago`,
      description: `Cortó hace ${daysAfterCutoff} día${daysAfterCutoff !== 1 ? 's' : ''} y no tiene pago programado`,
      action: {
        label: 'Programar pago',
        route: '/payments',
        params: {
          serviceId: analysis.service.id,
          serviceLineId: analysis.serviceLine.id,
          from: 'dashboard'
        },
      },
      data: analysis,
      sortValue: daysAfterCutoff,
    });
  });

  return alerts;
}
