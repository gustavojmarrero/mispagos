/**
 * Alertas relacionadas con pagos (vencidos, urgentes, semana pesada)
 */

import type { PaymentInstance } from '../types';
import type { WeeklyCashFlow } from '../dashboardMetrics';
import type { SmartAlert } from './types';
import { toDate } from '../dateUtils';
import { getAmountToPay } from '../paymentUtils';

interface PaymentAlertsContext {
  instances: PaymentInstance[];
  cashFlow: WeeklyCashFlow;
  today: Date;
}

/**
 * Genera alerta para pagos vencidos (fecha de vencimiento anterior a hoy)
 */
export function generateOverdueAlerts(ctx: PaymentAlertsContext): SmartAlert[] {
  const alerts: SmartAlert[] = [];

  const overdueInstances = ctx.instances.filter((instance) => {
    if (instance.status !== 'pending' && instance.status !== 'partial') return false;
    const dueDate = toDate(instance.dueDate);
    dueDate.setHours(0, 0, 0, 0);
    return dueDate < ctx.today;
  });

  if (overdueInstances.length > 0) {
    const overdueTotal = overdueInstances.reduce(
      (sum, instance) => sum + getAmountToPay(instance),
      0
    );
    alerts.push({
      id: 'overdue-payments',
      type: 'overdue',
      severity: 'critical',
      title: 'Pagos vencidos',
      description: `Tienes ${overdueInstances.length} pago${overdueInstances.length !== 1 ? 's' : ''} vencido${overdueInstances.length !== 1 ? 's' : ''} por $${overdueTotal.toFixed(2)}`,
      action: {
        label: 'Ver pagos',
        route: '/calendar',
      },
      data: overdueInstances,
    });
  }

  return alerts;
}

/**
 * Genera alerta para pagos urgentes (próximos 1-2 días, incluyendo hoy)
 */
export function generateUrgentPaymentAlerts(ctx: PaymentAlertsContext): SmartAlert[] {
  const alerts: SmartAlert[] = [];

  const twoDaysFromNow = new Date(ctx.today);
  twoDaysFromNow.setDate(twoDaysFromNow.getDate() + 2);
  twoDaysFromNow.setHours(23, 59, 59, 999);

  const urgentInstances = ctx.instances.filter((instance) => {
    if (instance.status !== 'pending' && instance.status !== 'partial') return false;
    const dueDate = toDate(instance.dueDate);
    dueDate.setHours(0, 0, 0, 0);
    return dueDate >= ctx.today && dueDate <= twoDaysFromNow;
  });

  if (urgentInstances.length > 0) {
    const urgentTotal = urgentInstances.reduce(
      (sum, instance) => sum + getAmountToPay(instance),
      0
    );
    alerts.push({
      id: 'upcoming-payments',
      type: 'upcoming',
      severity: 'warning',
      title: 'Pagos próximos',
      description: `${urgentInstances.length} pago${urgentInstances.length !== 1 ? 's' : ''} vence${urgentInstances.length === 1 ? '' : 'n'} en los próximos 2 días por $${urgentTotal.toFixed(2)}`,
      action: {
        label: 'Ver calendario',
        route: '/calendar',
      },
      data: urgentInstances,
    });
  }

  return alerts;
}

/**
 * Genera alerta para semana pesada (>40% más que promedio mensual)
 */
export function generateHighWeekAlerts(ctx: PaymentAlertsContext): SmartAlert[] {
  const alerts: SmartAlert[] = [];

  const avgWeekly = ctx.cashFlow.thisMonth.totalPending / 4; // Aproximado
  if (ctx.cashFlow.thisWeek.totalPending > avgWeekly * 1.4) {
    const percentage = Math.round(
      ((ctx.cashFlow.thisWeek.totalPending - avgWeekly) / avgWeekly) * 100
    );
    alerts.push({
      id: 'high-week',
      type: 'high_week',
      severity: 'info',
      title: 'Semana con gastos altos',
      description: `Esta semana pagarás ${percentage}% más que el promedio mensual`,
      action: {
        label: 'Ver detalles',
        route: '/calendar',
      },
      data: { weekly: ctx.cashFlow.thisWeek.totalPending, average: avgWeekly },
    });
  }

  return alerts;
}
