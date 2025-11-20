import type { Card, PaymentInstance, ScheduledPayment } from './types';

export interface CardAlert {
  card: Card;
  closingDate: Date;
  daysAfterClosing: number;
  expectedDueDate: Date;
}

/**
 * Calcula la fecha de corte para una tarjeta en un mes específico
 */
function getClosingDate(card: Card, referenceDate: Date): Date {
  const year = referenceDate.getFullYear();
  const month = referenceDate.getMonth();

  // Crear fecha de corte del mes actual
  const closingDate = new Date(year, month, card.closingDay);
  closingDate.setHours(0, 0, 0, 0);

  return closingDate;
}

/**
 * Calcula la fecha de pago esperada para una tarjeta basado en su corte
 */
function getExpectedDueDate(card: Card, closingDate: Date): Date {
  const year = closingDate.getFullYear();
  const month = closingDate.getMonth();

  // La fecha de pago puede estar en el mismo mes o el siguiente
  // Si dueDay > closingDay, está en el mismo mes
  // Si dueDay <= closingDay, está en el mes siguiente
  let dueMonth = month;
  let dueYear = year;

  if (card.dueDay <= card.closingDay) {
    // El pago es en el mes siguiente
    dueMonth = month + 1;
    if (dueMonth > 11) {
      dueMonth = 0;
      dueYear = year + 1;
    }
  }

  const dueDate = new Date(dueYear, dueMonth, card.dueDay);
  dueDate.setHours(23, 59, 59, 999);

  return dueDate;
}

/**
 * Verifica si existe un pago válido para una tarjeta en el período actual
 * Revisa tanto payment instances como scheduled payments
 */
function hasValidPayment(
  card: Card,
  paymentInstances: PaymentInstance[],
  scheduledPayments: ScheduledPayment[],
  closingDate: Date,
  expectedDueDate: Date
): boolean {
  // 1. Buscar instancias de pago para esta tarjeta
  const cardPaymentInstances = (paymentInstances || []).filter(
    (instance) =>
      instance.cardId === card.id &&
      instance.paymentType === 'card_payment'
  );

  // Verificar si alguna instancia de pago cumple las condiciones
  const hasValidInstance = cardPaymentInstances.some((payment) => {
    // El pago debe estar en el rango entre closingDate y expectedDueDate
    const paymentInRange =
      payment.dueDate >= closingDate && payment.dueDate <= expectedDueDate;

    if (!paymentInRange) return false;

    // Si el pago ya está marcado como pagado, cuenta como válido
    if (payment.status === 'paid') return true;

    // Si el pago está pendiente y aún no venció, también cuenta
    if (payment.status === 'pending') return true;

    return false;
  });

  if (hasValidInstance) return true;

  // 2. Buscar scheduled payments activos para esta tarjeta
  const cardScheduledPayments = (scheduledPayments || []).filter(
    (scheduled) =>
      scheduled.cardId === card.id &&
      scheduled.paymentType === 'card_payment' &&
      scheduled.isActive === true
  );

  // Verificar si algún scheduled payment cumple las condiciones
  const hasValidScheduled = cardScheduledPayments.some((scheduled) => {
    // Para scheduled payments con fecha específica
    // Puede usar specificDate o paymentDate según la implementación
    const scheduledDate = scheduled.specificDate || scheduled.paymentDate;

    if (scheduledDate) {
      const paymentInRange =
        scheduledDate >= closingDate && scheduledDate <= expectedDueDate;
      return paymentInRange;
    }

    // Si no tiene fecha específica, no se considera válido
    return false;
  });

  return hasValidScheduled;
}

/**
 * Obtiene la lista de tarjetas que necesitan un pago después de su fecha de corte
 *
 * @param cards - Lista de todas las tarjetas del usuario
 * @param paymentInstances - Lista de todas las instancias de pago
 * @param scheduledPayments - Lista de todos los pagos programados
 * @param today - Fecha actual (para testing)
 * @returns Lista de tarjetas que requieren atención
 */
export function getCardsWithoutPayment(
  cards: Card[],
  paymentInstances: PaymentInstance[],
  scheduledPayments: ScheduledPayment[],
  today: Date = new Date()
): CardAlert[] {
  const alerts: CardAlert[] = [];

  // Normalizar la fecha actual
  const currentDate = new Date(today);
  currentDate.setHours(0, 0, 0, 0);

  for (const card of cards) {
    // Calcular la fecha de corte del mes actual
    const closingDate = getClosingDate(card, currentDate);

    // Solo procesar si ya pasó la fecha de corte
    if (currentDate <= closingDate) {
      continue;
    }

    // Calcular cuántos días han pasado desde el corte
    const daysAfterClosing = Math.floor(
      (currentDate.getTime() - closingDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    // Calcular la fecha de pago esperada
    const expectedDueDate = getExpectedDueDate(card, closingDate);

    // Verificar si existe un pago válido para este período
    const hasPayment = hasValidPayment(
      card,
      paymentInstances,
      scheduledPayments,
      closingDate,
      expectedDueDate
    );

    // Si no tiene pago válido, agregar a la lista de alertas
    if (!hasPayment) {
      alerts.push({
        card,
        closingDate,
        daysAfterClosing,
        expectedDueDate,
      });
    }
  }

  // Ordenar por días después del corte (las más urgentes primero)
  return alerts.sort((a, b) => b.daysAfterClosing - a.daysAfterClosing);
}
