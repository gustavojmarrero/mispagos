import type { Card, PaymentInstance, ScheduledPayment, Service, ServiceLine } from './types';
import { getAmountToPay } from './paymentUtils';

/**
 * Interfaces para métricas del Dashboard
 */

export interface WeeklyCashFlow {
  thisWeek: {
    totalPending: number;
    byTransfer: number;
    byCard: number;
    instancesCount: number;
    urgent: number; // Vencidos o vencen hoy
  };
  thisMonth: {
    totalPending: number;
    totalPaid: number;
    remaining: number;
    percentagePaid: number;
  };
}

export interface CardPeriodAnalysis {
  card: Card;
  currentPeriod: {
    closingDate: Date;
    dueDate: Date;
    daysUntilDue: number;
    totalCharges: number; // Saldo actual de la tarjeta
    hasProgrammedPayment: boolean;
    programmedAmount: number;
    status: 'covered' | 'not_programmed' | 'overdue';
  };
}

export interface ServiceBillingAnalysis {
  service: Service;
  currentPeriod: {
    cutoffDate: Date;       // Fecha de corte
    dueDate: Date;          // Fecha de vencimiento
    daysUntilDue: number;
    daysAfterCutoff: number;
    hasAmount: boolean;     // Si ya se ingresó el monto
    amount: number;         // Monto de la instancia
    instanceId?: string;    // ID de la instancia si existe
    status: 'awaiting_amount' | 'ready' | 'overdue' | 'upcoming';
  };
}

export interface ServiceLineBillingAnalysis {
  serviceLine: ServiceLine;
  service: Service;
  currentPeriod: {
    cutoffDate: Date;           // Fecha de corte
    dueDate: Date;              // Fecha de vencimiento
    daysUntilDue: number;
    daysAfterCutoff: number;
    hasProgrammedPayment: boolean;  // ¿Tiene ScheduledPayment o PaymentInstance?
    programmedAmount: number;
    status: 'covered' | 'not_programmed' | 'overdue' | 'partial' | 'programmed';
  };
}

// Re-export del módulo de alertas para compatibilidad hacia atrás
export { generateSmartAlerts } from './alerts';
export type { SmartAlert, AlertSeverity, AlertType } from './alerts';

export interface DayTimeline {
  date: Date;
  dayName: string;
  totalAmount: number;
  instances: PaymentInstance[];
  isToday: boolean;
}

/**
 * Calcula el flujo de efectivo semanal y mensual
 */
export function calculateWeeklyCashFlow(
  instances: PaymentInstance[],
  services: Service[],
  isHistorical: boolean = false
): WeeklyCashFlow {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Para períodos históricos, calcular totales de todas las instancias filtradas
  if (isHistorical) {
    const allPendingInstances = instances.filter(
      (instance) => instance.status === 'pending' || instance.status === 'partial'
    );

    const allPaidAndPartialInstances = instances.filter(
      (instance) => instance.status === 'paid' || instance.status === 'partial'
    );

    // Calcular totales
    let totalPending = 0;
    let byTransfer = 0;
    let byCard = 0;

    allPendingInstances.forEach((instance) => {
      const amountToPay = getAmountToPay(instance);

      totalPending += amountToPay;

      if (instance.paymentType === 'card_payment') {
        byTransfer += amountToPay;
      } else if (instance.serviceId) {
        const service = services.find((s) => s.id === instance.serviceId);
        if (service?.paymentMethod === 'card') {
          byCard += amountToPay;
        } else {
          byTransfer += amountToPay;
        }
      }
    });

    const totalPaid = allPaidAndPartialInstances.reduce((sum, instance) => {
      if (instance.status === 'paid') {
        return sum + instance.amount;
      } else if (instance.status === 'partial' && instance.paidAmount !== undefined) {
        return sum + instance.paidAmount;
      }
      return sum;
    }, 0);

    const grandTotal = totalPending + totalPaid;
    const percentagePaid = grandTotal > 0 ? (totalPaid / grandTotal) * 100 : 0;

    return {
      thisWeek: {
        totalPending,
        byTransfer,
        byCard,
        instancesCount: allPendingInstances.length,
        urgent: 0, // No relevante para períodos históricos
      },
      thisMonth: {
        totalPending,
        totalPaid,
        remaining: totalPending,
        percentagePaid,
      },
    };
  }

  // Calcular próximo lunes
  const nextMonday = new Date(today);
  const currentDay = today.getDay();
  const daysUntilMonday =
    currentDay === 0 ? 1 : currentDay === 1 ? 7 : 8 - currentDay;
  nextMonday.setDate(nextMonday.getDate() + daysUntilMonday);
  nextMonday.setHours(23, 59, 59, 999);

  // Primer día del mes actual
  const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  firstDayOfMonth.setHours(0, 0, 0, 0);

  // Último día del mes actual
  const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  lastDayOfMonth.setHours(23, 59, 59, 999);

  // Filtrar instancias de esta semana (pendientes y parciales)
  const thisWeekInstances = instances.filter(
    (instance) =>
      (instance.status === 'pending' || instance.status === 'partial') &&
      instance.dueDate >= today &&
      instance.dueDate <= nextMonday
  );

  // Filtrar instancias del mes (pendientes y parciales)
  const thisMonthPending = instances.filter(
    (instance) =>
      (instance.status === 'pending' || instance.status === 'partial') &&
      instance.dueDate >= firstDayOfMonth &&
      instance.dueDate <= lastDayOfMonth
  );

  // Filtrar instancias del mes (pagadas y parciales)
  const thisMonthPaidAndPartial = instances.filter(
    (instance) =>
      (instance.status === 'paid' || instance.status === 'partial') &&
      instance.dueDate >= firstDayOfMonth &&
      instance.dueDate <= lastDayOfMonth
  );

  // Calcular totales semanales
  let totalPending = 0;
  let byTransfer = 0;
  let byCard = 0;
  let urgent = 0;

  thisWeekInstances.forEach((instance) => {
    const amountToPay = getAmountToPay(instance);

    totalPending += amountToPay;

    // Determinar método de pago
    if (instance.paymentType === 'card_payment') {
      // Pago de tarjeta siempre es transferencia
      byTransfer += amountToPay;
    } else if (instance.serviceId) {
      // Buscar el servicio para ver su método de pago
      const service = services.find((s) => s.id === instance.serviceId);
      if (service?.paymentMethod === 'card') {
        byCard += amountToPay;
      } else {
        byTransfer += amountToPay;
      }
    }

    // Contar urgentes (vencidos o vencen hoy)
    if (instance.dueDate <= today) {
      urgent++;
    }
  });

  // Calcular totales mensuales
  const monthlyPending = thisMonthPending.reduce(
    (sum, instance) => sum + getAmountToPay(instance),
    0
  );
  const monthlyPaid = thisMonthPaidAndPartial.reduce(
    (sum, instance) => {
      // Para pagos completos, usar amount; para parciales, usar paidAmount
      if (instance.status === 'paid') {
        return sum + instance.amount;
      } else if (instance.status === 'partial' && instance.paidAmount !== undefined) {
        return sum + instance.paidAmount;
      }
      return sum;
    },
    0
  );
  const monthlyTotal = monthlyPending + monthlyPaid;
  const percentagePaid = monthlyTotal > 0 ? (monthlyPaid / monthlyTotal) * 100 : 0;

  return {
    thisWeek: {
      totalPending,
      byTransfer,
      byCard,
      instancesCount: thisWeekInstances.length,
      urgent,
    },
    thisMonth: {
      totalPending: monthlyPending,
      totalPaid: monthlyPaid,
      remaining: monthlyPending,
      percentagePaid,
    },
  };
}

/**
 * Tolerancia en días para considerar un pago como válido para una tarjeta.
 * Permite pagos programados hasta X días antes/después de la fecha de vencimiento.
 */

/**
 * Calcula la fecha de corte para una tarjeta.
 * Si el día actual es menor que el día de corte, retorna el corte del mes anterior
 * (ya que ese es el período "activo" que requiere pago).
 */
function getClosingDate(card: Card, referenceDate: Date): Date {
  const todayDay = referenceDate.getDate();
  let year = referenceDate.getFullYear();
  let month = referenceDate.getMonth();

  // Si el día actual es menor que el día de corte,
  // el corte relevante es del mes anterior
  if (todayDay < card.closingDay) {
    month = month - 1;
    if (month < 0) {
      month = 11;
      year = year - 1;
    }
  }

  // Ajustar día si el mes no tiene suficientes días (ej: 31 en meses de 30 días)
  const lastDayOfMonth = new Date(year, month + 1, 0).getDate();
  const adjustedClosingDay = Math.min(card.closingDay, lastDayOfMonth);

  const closingDate = new Date(year, month, adjustedClosingDay);
  closingDate.setHours(0, 0, 0, 0);

  return closingDate;
}

/**
 * Calcula la fecha de pago esperada para una tarjeta basado en su corte
 */
function getExpectedDueDate(card: Card, closingDate: Date): Date {
  const year = closingDate.getFullYear();
  const month = closingDate.getMonth();

  let dueMonth = month;
  let dueYear = year;

  if (card.dueDay <= card.closingDay) {
    dueMonth = month + 1;
    if (dueMonth > 11) {
      dueMonth = 0;
      dueYear = year + 1;
    }
  }

  // Ajustar día si el mes no tiene suficientes días (ej: 31 en meses de 30 días)
  const lastDayOfDueMonth = new Date(dueYear, dueMonth + 1, 0).getDate();
  const adjustedDueDay = Math.min(card.dueDay, lastDayOfDueMonth);

  const dueDate = new Date(dueYear, dueMonth, adjustedDueDay);
  dueDate.setHours(23, 59, 59, 999);

  return dueDate;
}

/**
 * Analiza el período actual de cada tarjeta
 */
export function analyzeCardPeriods(
  cards: Card[],
  instances: PaymentInstance[],
  scheduled: ScheduledPayment[]
): CardPeriodAnalysis[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return cards.map((card) => {
    // Calcular fecha de corte del mes actual
    const closingDate = getClosingDate(card, today);

    // Calcular fecha de pago esperada
    const dueDate = getExpectedDueDate(card, closingDate);

    // Calcular días hasta vencimiento
    const daysUntilDue = Math.ceil(
      (dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
    );

    // Calcular el límite superior: siguiente fecha de corte
    // Un pago pertenece a este ciclo si cae entre el corte actual y el siguiente
    const nextClosingDate = new Date(closingDate);
    nextClosingDate.setMonth(nextClosingDate.getMonth() + 1);
    const nextClosingLastDay = new Date(nextClosingDate.getFullYear(), nextClosingDate.getMonth() + 1, 0).getDate();
    nextClosingDate.setDate(Math.min(card.closingDay, nextClosingLastDay));
    nextClosingDate.setHours(23, 59, 59, 999);

    // Calcular el límite inferior para búsqueda de instancias
    // Cuando closingDay = dueDay, el día del corte es también el vencimiento del período anterior
    // Por eso usamos el día DESPUÉS del corte como límite inferior
    const searchStartDate = new Date(closingDate);
    searchStartDate.setDate(searchStartDate.getDate() + 1);

    // Buscar pagos programados para esta tarjeta en el período
    // Rango: desde día después del corte hasta el siguiente corte
    const cardInstances = instances.filter(
      (instance) =>
        instance.cardId === card.id &&
        instance.paymentType === 'card_payment' &&
        instance.dueDate >= searchStartDate &&
        instance.dueDate <= nextClosingDate
    );

    const cardScheduled = scheduled.filter(
      (s) =>
        s.cardId === card.id &&
        s.paymentType === 'card_payment' &&
        s.isActive === true &&
        s.paymentDate &&
        s.paymentDate >= searchStartDate &&
        s.paymentDate <= nextClosingDate
    );

    const hasProgrammedPayment =
      cardInstances.some(
        (i) => i.status === 'pending' || i.status === 'paid'
      ) || cardScheduled.length > 0;

    // Usar instancias si existen, si no usar scheduled payments
    // Evitar duplicación ya que las instancias se generan de los scheduled
    const programmedAmount = cardInstances.length > 0
      ? cardInstances.reduce((sum, i) => sum + getAmountToPay(i), 0)
      : cardScheduled.reduce((sum, s) => sum + s.amount, 0);

    // Determinar status
    let status: 'covered' | 'not_programmed' | 'overdue';
    if (daysUntilDue < 0) {
      status = 'overdue';
    } else if (hasProgrammedPayment) {
      status = 'covered';
    } else {
      status = 'not_programmed';
    }

    return {
      card,
      currentPeriod: {
        closingDate,
        dueDate,
        daysUntilDue,
        totalCharges: card.currentBalance,
        hasProgrammedPayment,
        programmedAmount,
        status,
      },
    };
  });
}

/**
 * Calcula la fecha de corte para un servicio con billing_cycle
 */
function getServiceCutoffDate(service: Service, referenceDate: Date): Date {
  if (!service.billingCycleDay) return new Date();

  const year = referenceDate.getFullYear();
  const month = referenceDate.getMonth();
  const cutoffDate = new Date(year, month, service.billingCycleDay);
  cutoffDate.setHours(0, 0, 0, 0);

  return cutoffDate;
}

/**
 * Calcula la fecha de vencimiento para un servicio con billing_cycle
 */
function getServiceDueDate(service: Service, cutoffDate: Date): Date {
  if (!service.billingDueDay || !service.billingCycleDay) return new Date();

  const year = cutoffDate.getFullYear();
  const month = cutoffDate.getMonth();

  let dueMonth = month;
  let dueYear = year;

  // Si el día de vencimiento es menor que el día de corte, es el mes siguiente
  if (service.billingDueDay <= service.billingCycleDay) {
    dueMonth = month + 1;
    if (dueMonth > 11) {
      dueMonth = 0;
      dueYear = year + 1;
    }
  }

  const dueDate = new Date(dueYear, dueMonth, service.billingDueDay);
  dueDate.setHours(23, 59, 59, 999);

  return dueDate;
}

/**
 * Analiza servicios con ciclo de facturación
 */
export function analyzeServiceBillingCycles(
  services: Service[],
  instances: PaymentInstance[]
): ServiceBillingAnalysis[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Filtrar solo servicios con billing_cycle
  const billingCycleServices = services.filter(
    (s) => s.serviceType === 'billing_cycle' && s.billingCycleDay && s.billingDueDay
  );

  return billingCycleServices.map((service) => {
    // Calcular fecha de corte del mes actual
    const cutoffDate = getServiceCutoffDate(service, today);

    // Calcular fecha de vencimiento
    const dueDate = getServiceDueDate(service, cutoffDate);

    // Calcular días
    const daysUntilDue = Math.ceil(
      (dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
    );
    const daysAfterCutoff = Math.ceil(
      (today.getTime() - cutoffDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    // Buscar instancia de pago para este servicio en el período actual
    const toleranceMs = 5 * 24 * 60 * 60 * 1000; // 5 días de tolerancia
    const serviceInstance = instances.find(
      (instance) =>
        instance.serviceId === service.id &&
        instance.dueDate >= new Date(cutoffDate.getTime() - toleranceMs) &&
        instance.dueDate <= new Date(dueDate.getTime() + toleranceMs) &&
        (instance.status === 'pending' || instance.status === 'partial')
    );

    const hasAmount = serviceInstance ? serviceInstance.amount > 0 : false;
    const amount = serviceInstance?.amount || 0;

    // Determinar status
    let status: 'awaiting_amount' | 'ready' | 'overdue' | 'upcoming';
    if (daysUntilDue < 0) {
      status = 'overdue';
    } else if (daysAfterCutoff > 0 && !hasAmount) {
      // Ya pasó el corte pero no tiene monto
      status = 'awaiting_amount';
    } else if (hasAmount) {
      status = 'ready';
    } else {
      status = 'upcoming';
    }

    return {
      service,
      currentPeriod: {
        cutoffDate,
        dueDate,
        daysUntilDue,
        daysAfterCutoff,
        hasAmount,
        amount,
        instanceId: serviceInstance?.id,
        status,
      },
    };
  });
}

/**
 * Calcula la fecha de corte para una línea de servicio.
 * Si el día actual es menor que el día de corte, retorna el corte del mes anterior
 * (ya que ese es el período "activo" que requiere pago).
 */
function getServiceLineCutoffDate(line: ServiceLine, referenceDate: Date): Date {
  const todayDay = referenceDate.getDate();
  let year = referenceDate.getFullYear();
  let month = referenceDate.getMonth();

  // Si el día actual es menor que el día de corte,
  // el corte relevante es del mes anterior
  if (todayDay < line.billingCycleDay) {
    month = month - 1;
    if (month < 0) {
      month = 11;
      year = year - 1;
    }
  }

  // Ajustar día si el mes no tiene suficientes días (ej: 31 en meses de 30 días)
  const lastDayOfMonth = new Date(year, month + 1, 0).getDate();
  const adjustedCycleDay = Math.min(line.billingCycleDay, lastDayOfMonth);

  const cutoffDate = new Date(year, month, adjustedCycleDay);
  cutoffDate.setHours(0, 0, 0, 0);
  return cutoffDate;
}

/**
 * Calcula la fecha de vencimiento para una línea de servicio
 */
function getServiceLineDueDate(line: ServiceLine, cutoffDate: Date): Date {
  let dueMonth = cutoffDate.getMonth();
  let dueYear = cutoffDate.getFullYear();

  // Si dueDay <= cutoffDay, vencimiento es mes siguiente
  if (line.billingDueDay <= line.billingCycleDay) {
    dueMonth += 1;
    if (dueMonth > 11) {
      dueMonth = 0;
      dueYear += 1;
    }
  }

  const dueDate = new Date(dueYear, dueMonth, line.billingDueDay);
  dueDate.setHours(23, 59, 59, 999);
  return dueDate;
}

/**
 * Analiza líneas de servicio con ciclo de facturación (similar a tarjetas)
 */
export function analyzeServiceLineBillingCycles(
  serviceLines: ServiceLine[],
  services: Service[],
  _scheduledPayments: ScheduledPayment[],  // No usado: el estado se determina por PaymentInstance
  instances: PaymentInstance[]
): ServiceLineBillingAnalysis[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Solo líneas activas de servicios con ciclo de facturación
  const activeLines = serviceLines.filter(line => {
    const service = services.find(s => s.id === line.serviceId);
    return line.isActive && service?.serviceType === 'billing_cycle';
  });

  return activeLines.map(line => {
    const service = services.find(s => s.id === line.serviceId);

    // Calcular fechas usando billingCycleDay y billingDueDay de la línea
    const cutoffDate = getServiceLineCutoffDate(line, today);
    const dueDate = getServiceLineDueDate(line, cutoffDate);

    // Buscar pago programado para esta línea (similar a tarjetas)
    const toleranceMs = 5 * 24 * 60 * 60 * 1000;

    // Buscar en PaymentInstances
    let lineInstance = instances.find(inst =>
      inst.serviceLineId === line.id &&
      inst.dueDate >= new Date(cutoffDate.getTime() - toleranceMs) &&
      inst.dueDate <= new Date(dueDate.getTime() + toleranceMs) &&
      (inst.status === 'pending' || inst.status === 'paid' || inst.status === 'partial')
    );

    // Si el período está pagado Y ya pasó la fecha de vencimiento,
    // O si el vencimiento es anterior a la creación de la línea (no existía),
    // avanzar al siguiente período
    let adjustedCutoffDate = cutoffDate;
    let adjustedDueDate = dueDate;

    // Convertir createdAt a Date (puede ser Firestore Timestamp)
    const lineCreatedAt = line.createdAt instanceof Date
      ? line.createdAt
      : (line.createdAt as any)?.toDate?.() || new Date(0);

    // Avanzar si: período pagado y vencido, O vencimiento anterior a creación de la línea
    const shouldAdvancePeriod =
      (lineInstance?.status === 'paid' && dueDate < today) ||
      (dueDate < lineCreatedAt);

    if (shouldAdvancePeriod) {
      // Avanzar al siguiente período
      adjustedCutoffDate = new Date(cutoffDate);
      adjustedCutoffDate.setMonth(adjustedCutoffDate.getMonth() + 1);

      adjustedDueDate = getServiceLineDueDate(line, adjustedCutoffDate);

      // Buscar instancia del nuevo período
      lineInstance = instances.find(inst =>
        inst.serviceLineId === line.id &&
        inst.dueDate >= new Date(adjustedCutoffDate.getTime() - toleranceMs) &&
        inst.dueDate <= new Date(adjustedDueDate.getTime() + toleranceMs) &&
        (inst.status === 'pending' || inst.status === 'paid' || inst.status === 'partial')
      );
    }

    // Recalcular días con fechas ajustadas
    const adjustedDaysUntilDue = Math.ceil(
      (adjustedDueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
    );
    const adjustedDaysAfterCutoff = Math.ceil(
      (today.getTime() - adjustedCutoffDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    // Para líneas de servicio con ciclo de facturación, el estado se determina
    // solo por la existencia de una PaymentInstance, no por el ScheduledPayment
    // (el ScheduledPayment es solo la plantilla de recurrencia)
    const hasProgrammedPayment = !!lineInstance;
    const programmedAmount = lineInstance?.amount || 0;
    const isPaid = lineInstance?.status === 'paid';
    const isPartial = lineInstance?.status === 'partial';

    // Determinar status - distinguir entre pagado y programado
    let status: 'covered' | 'not_programmed' | 'overdue' | 'partial' | 'programmed';
    if (adjustedDaysUntilDue < 0 && !hasProgrammedPayment) {
      status = 'overdue';
    } else if (isPaid) {
      status = 'covered';  // Solo si realmente está pagado
    } else if (isPartial) {
      status = 'partial';
    } else if (hasProgrammedPayment) {
      status = 'programmed';  // Programado pero no pagado
    } else {
      status = 'not_programmed';
    }

    return {
      serviceLine: line,
      service: service!,
      currentPeriod: {
        cutoffDate: adjustedCutoffDate,
        dueDate: adjustedDueDate,
        daysUntilDue: adjustedDaysUntilDue,
        daysAfterCutoff: adjustedDaysAfterCutoff,
        hasProgrammedPayment,
        programmedAmount,
        status,
      }
    };
  }).filter(analysis => analysis.service); // Filtrar líneas sin servicio asociado
}

/**
 * Genera timeline de próximos 7 días
 */
export function getNext7DaysTimeline(
  instances: PaymentInstance[]
): DayTimeline[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const timeline: DayTimeline[] = [];
  const dayNames = [
    'Domingo',
    'Lunes',
    'Martes',
    'Miércoles',
    'Jueves',
    'Viernes',
    'Sábado',
  ];

  for (let i = 0; i < 7; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() + i);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    // Filtrar instancias pendientes y parciales de este día
    const dayInstances = instances.filter(
      (instance) =>
        (instance.status === 'pending' || instance.status === 'partial') &&
        instance.dueDate >= date &&
        instance.dueDate <= endOfDay
    );

    const totalAmount = dayInstances.reduce(
      (sum, instance) => sum + getAmountToPay(instance),
      0
    );

    timeline.push({
      date,
      dayName: dayNames[date.getDay()],
      totalAmount,
      instances: dayInstances,
      isToday: i === 0,
    });
  }

  return timeline;
}
