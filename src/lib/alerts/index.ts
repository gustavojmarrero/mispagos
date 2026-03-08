/**
 * Sistema de alertas inteligentes - Orquestador principal
 */

import type { Card, PaymentInstance, ScheduledPayment } from '../types';
import type {
  CardPeriodAnalysis,
  WeeklyCashFlow,
  ServiceLineBillingAnalysis,
} from '../dashboardMetrics';
import type { SmartAlert } from './types';
import { sortAlerts } from './types';
import { generateCardNoPaymentAlerts, generateLowCreditAlerts } from './cardAlerts';
import { generateServiceLineNoPaymentAlerts } from './serviceAlerts';
import {
  generateOverdueAlerts,
  generateUrgentPaymentAlerts,
  generateHighWeekAlerts,
} from './paymentAlerts';

// Re-export types for consumers
export type { SmartAlert, AlertSeverity, AlertType } from './types';

/**
 * Genera todas las alertas inteligentes del dashboard
 */
export function generateSmartAlerts(
  cards: Card[],
  instances: PaymentInstance[],
  _scheduled: ScheduledPayment[],
  cardPeriods: CardPeriodAnalysis[],
  cashFlow: WeeklyCashFlow,
  banks: { id: string; name: string }[] = [],
  serviceLineBillingAnalysis: ServiceLineBillingAnalysis[] = []
): SmartAlert[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const alerts: SmartAlert[] = [];

  // Alertas de tarjetas
  const cardContext = {
    cards,
    cardPeriods,
    banks,
    today
  };
  alerts.push(...generateCardNoPaymentAlerts(cardContext));
  alerts.push(...generateLowCreditAlerts(cardContext));

  // Alertas de líneas de servicio
  const serviceContext = {
    serviceLineBillingAnalysis,
    today
  };
  alerts.push(...generateServiceLineNoPaymentAlerts(serviceContext));

  // Alertas de pagos
  const paymentContext = {
    instances,
    cashFlow,
    today
  };
  alerts.push(...generateOverdueAlerts(paymentContext));
  alerts.push(...generateUrgentPaymentAlerts(paymentContext));
  alerts.push(...generateHighWeekAlerts(paymentContext));

  return sortAlerts(alerts);
}
