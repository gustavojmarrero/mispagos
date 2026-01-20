/**
 * Sistema de alertas inteligentes - Orquestador principal
 *
 * Este módulo consolida la generación de todas las alertas del dashboard,
 * dividiendo la lógica en generadores especializados por tipo.
 */

import type { Card, PaymentInstance, ScheduledPayment } from '../types';
import type {
  CardPeriodAnalysis,
  WeeklyCashFlow,
  ServiceBillingAnalysis,
  ServiceLineBillingAnalysis,
} from '../dashboardMetrics';
import type { SmartAlert } from './types';
import { sortAlerts } from './types';
import { generateCardNoPaymentAlerts, generateLowCreditAlerts } from './cardAlerts';
import {
  generateServiceAwaitingAmountAlerts,
  generateServiceLineNoPaymentAlerts,
} from './serviceAlerts';
import {
  generateOverdueAlerts,
  generateUrgentPaymentAlerts,
  generateHighWeekAlerts,
} from './paymentAlerts';

// Re-export types for consumers
export type { SmartAlert, AlertSeverity, AlertType } from './types';

interface GenerateSmartAlertsParams {
  cards: Card[];
  instances: PaymentInstance[];
  scheduled: ScheduledPayment[];
  cardPeriods: CardPeriodAnalysis[];
  cashFlow: WeeklyCashFlow;
  banks?: { id: string; name: string }[];
  serviceBillingAnalysis?: ServiceBillingAnalysis[];
  serviceLineBillingAnalysis?: ServiceLineBillingAnalysis[];
}

/**
 * Genera todas las alertas inteligentes del dashboard
 *
 * Consolida alertas de:
 * - Tarjetas sin pago después del corte
 * - Servicios sin monto después del corte
 * - Líneas de servicio sin pago programado
 * - Pagos vencidos
 * - Pagos urgentes (próximos 2 días)
 * - Semana con gastos altos
 * - Crédito disponible bajo
 *
 * Soporta dos firmas por compatibilidad:
 * - Objeto con parámetros nombrados (recomendado)
 * - Parámetros posicionales (legacy)
 */
export function generateSmartAlerts(
  cardsOrParams: Card[] | GenerateSmartAlertsParams,
  instances?: PaymentInstance[],
  _scheduled?: ScheduledPayment[],
  cardPeriods?: CardPeriodAnalysis[],
  cashFlow?: WeeklyCashFlow,
  banks: { id: string; name: string }[] = [],
  serviceBillingAnalysis: ServiceBillingAnalysis[] = [],
  serviceLineBillingAnalysis: ServiceLineBillingAnalysis[] = []
): SmartAlert[] {
  // Detectar si es la firma de objeto o posicional
  let cards: Card[];
  let finalInstances: PaymentInstance[];
  let finalCardPeriods: CardPeriodAnalysis[];
  let finalCashFlow: WeeklyCashFlow;
  let finalBanks: { id: string; name: string }[];
  let finalServiceBillingAnalysis: ServiceBillingAnalysis[];
  let finalServiceLineBillingAnalysis: ServiceLineBillingAnalysis[];

  if (Array.isArray(cardsOrParams)) {
    // Firma posicional (legacy)
    cards = cardsOrParams;
    finalInstances = instances!;
    finalCardPeriods = cardPeriods!;
    finalCashFlow = cashFlow!;
    finalBanks = banks;
    finalServiceBillingAnalysis = serviceBillingAnalysis;
    finalServiceLineBillingAnalysis = serviceLineBillingAnalysis;
  } else {
    // Firma de objeto (recomendada)
    cards = cardsOrParams.cards;
    finalInstances = cardsOrParams.instances;
    finalCardPeriods = cardsOrParams.cardPeriods;
    finalCashFlow = cardsOrParams.cashFlow;
    finalBanks = cardsOrParams.banks || [];
    finalServiceBillingAnalysis = cardsOrParams.serviceBillingAnalysis || [];
    finalServiceLineBillingAnalysis = cardsOrParams.serviceLineBillingAnalysis || [];
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const alerts: SmartAlert[] = [];

  // Contexto para alertas de tarjetas
  const cardContext = {
    cards,
    cardPeriods: finalCardPeriods,
    banks: finalBanks,
    today
  };
  alerts.push(...generateCardNoPaymentAlerts(cardContext));
  alerts.push(...generateLowCreditAlerts(cardContext));

  // Contexto para alertas de servicios
  const serviceContext = {
    serviceBillingAnalysis: finalServiceBillingAnalysis,
    serviceLineBillingAnalysis: finalServiceLineBillingAnalysis,
    today
  };
  alerts.push(...generateServiceAwaitingAmountAlerts(serviceContext));
  alerts.push(...generateServiceLineNoPaymentAlerts(serviceContext));

  // Contexto para alertas de pagos
  const paymentContext = {
    instances: finalInstances,
    cashFlow: finalCashFlow,
    today
  };
  alerts.push(...generateOverdueAlerts(paymentContext));
  alerts.push(...generateUrgentPaymentAlerts(paymentContext));
  alerts.push(...generateHighWeekAlerts(paymentContext));

  return sortAlerts(alerts);
}
