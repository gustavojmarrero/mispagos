/**
 * Alertas relacionadas con servicios y líneas de servicio
 */

import type { ServiceBillingAnalysis, ServiceLineBillingAnalysis } from '../dashboardMetrics';
import type { SmartAlert } from './types';

interface ServiceAlertsContext {
  serviceBillingAnalysis: ServiceBillingAnalysis[];
  serviceLineBillingAnalysis: ServiceLineBillingAnalysis[];
  today: Date;
}

/**
 * Genera alertas para servicios billing_cycle sin monto después del corte.
 * Excluye servicios que tienen líneas (esas alertas van a nivel línea).
 */
export function generateServiceAwaitingAmountAlerts(ctx: ServiceAlertsContext): SmartAlert[] {
  const alerts: SmartAlert[] = [];

  // Servicios que ya tienen alertas a nivel línea
  const servicesWithLines = new Set(
    ctx.serviceLineBillingAnalysis.map(a => a.service.id)
  );

  const servicesNeedingAmount = ctx.serviceBillingAnalysis.filter(
    a => a.currentPeriod.status === 'awaiting_amount' && !servicesWithLines.has(a.service.id)
  );

  servicesNeedingAmount.forEach(analysis => {
    const daysAfterCutoff = analysis.currentPeriod.daysAfterCutoff;

    alerts.push({
      id: `service-awaiting-amount-${analysis.service.id}`,
      type: 'service_awaiting_amount',
      severity: 'critical',
      title: `${analysis.service.name} sin monto`,
      description: `Cortó hace ${daysAfterCutoff} día${daysAfterCutoff !== 1 ? 's' : ''}, ingresa el monto del recibo`,
      action: {
        label: 'Actualizar monto',
        route: '/services',
        params: { viewService: analysis.service.id },
      },
      data: analysis,
      sortValue: daysAfterCutoff,
    });
  });

  return alerts;
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
