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
    cutoffDate: Date;
    dueDate: Date;
    daysUntilDue: number;
    daysAfterCutoff: number;
    hasAmount: boolean;
    amount: number;
    instanceId?: string;
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
    hasProgrammedPayment: boolean;  // ¿Tiene PaymentInstance?
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

// ─── Billing Period: lógica unificada para tarjetas y líneas de servicio ───

/** Tolerancia en días después del vencimiento para buscar instancias de pago */
const BILLING_TOLERANCE_MS = 5 * 24 * 60 * 60 * 1000;

/**
 * Calcula la fecha de vencimiento relativa a una fecha de corte.
 * Si dueDay <= cycleDay, el vencimiento cae en el mes siguiente al corte.
 */
function calculateDueDate(cycleDay: number, dueDay: number, cutoffDate: Date): Date {
  let dueMonth = cutoffDate.getMonth();
  let dueYear = cutoffDate.getFullYear();

  if (dueDay <= cycleDay) {
    dueMonth += 1;
    if (dueMonth > 11) {
      dueMonth = 0;
      dueYear += 1;
    }
  }

  const lastDayOfDueMonth = new Date(dueYear, dueMonth + 1, 0).getDate();
  const adjustedDueDay = Math.min(dueDay, lastDayOfDueMonth);

  const result = new Date(dueYear, dueMonth, adjustedDueDay);
  result.setHours(23, 59, 59, 999);
  return result;
}

/**
 * Calcula el período de facturación actual para una entidad con ciclo corte/vencimiento.
 * Aplica a tarjetas de crédito y líneas de servicio con billing_cycle.
 *
 * Si hoy es antes del día de corte, retorna el período anterior (el activo que requiere pago).
 */
export function calculateBillingPeriod(
  cycleDay: number,
  dueDay: number,
  referenceDate: Date
): { cutoffDate: Date; dueDate: Date; nextCutoffDate: Date } {
  const todayDay = referenceDate.getDate();
  let year = referenceDate.getFullYear();
  let month = referenceDate.getMonth();

  // Si hoy < día de corte, el período activo es el del mes anterior
  if (todayDay < cycleDay) {
    month -= 1;
    if (month < 0) {
      month = 11;
      year -= 1;
    }
  }

  // Ajustar día de corte si el mes no tiene suficientes días
  const lastDayOfMonth = new Date(year, month + 1, 0).getDate();
  const adjustedCycleDay = Math.min(cycleDay, lastDayOfMonth);

  const cutoffDate = new Date(year, month, adjustedCycleDay);
  cutoffDate.setHours(0, 0, 0, 0);

  // Fecha de vencimiento
  const dueDateResult = calculateDueDate(cycleDay, dueDay, cutoffDate);

  // Siguiente fecha de corte (límite superior del período)
  const nextCutoffDate = new Date(cutoffDate);
  nextCutoffDate.setMonth(nextCutoffDate.getMonth() + 1);
  const nextCutoffLastDay = new Date(
    nextCutoffDate.getFullYear(),
    nextCutoffDate.getMonth() + 1,
    0
  ).getDate();
  nextCutoffDate.setDate(Math.min(cycleDay, nextCutoffLastDay));
  nextCutoffDate.setHours(23, 59, 59, 999);

  return { cutoffDate, dueDate: dueDateResult, nextCutoffDate };
}

// ─── Cash Flow ───

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

// ─── Card Period Analysis ───

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
    const { cutoffDate, dueDate, nextCutoffDate } = calculateBillingPeriod(
      card.closingDay,
      card.dueDay,
      today
    );

    const daysUntilDue = Math.ceil(
      (dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
    );

    // Buscar desde día después del corte hasta el siguiente corte
    const searchStartDate = new Date(cutoffDate);
    searchStartDate.setDate(searchStartDate.getDate() + 1);

    const cardInstances = instances.filter(
      (instance) =>
        instance.cardId === card.id &&
        instance.paymentType === 'card_payment' &&
        instance.dueDate >= searchStartDate &&
        instance.dueDate <= nextCutoffDate
    );

    const cardScheduled = scheduled.filter(
      (s) =>
        s.cardId === card.id &&
        s.paymentType === 'card_payment' &&
        s.isActive === true &&
        s.paymentDate &&
        s.paymentDate >= searchStartDate &&
        s.paymentDate <= nextCutoffDate
    );

    const hasProgrammedPayment =
      cardInstances.some(
        (i) => i.status === 'pending' || i.status === 'paid'
      ) || cardScheduled.length > 0;

    // Usar instancias si existen, si no usar scheduled payments
    const programmedAmount = cardInstances.length > 0
      ? cardInstances.reduce((sum, i) => sum + getAmountToPay(i), 0)
      : cardScheduled.reduce((sum, s) => sum + s.amount, 0);

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
        closingDate: cutoffDate,
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

// ─── Service-Level Billing Analysis ───

/**
 * Analiza servicios billing_cycle a nivel de servicio (sin líneas).
 * Genera alertas de "sin monto" cuando el corte ya pasó pero no hay instancia con monto.
 * Solo aplica a servicios billing_cycle que tienen billingCycleDay/billingDueDay propios.
 */
export function analyzeServiceBillingCycles(
  services: Service[],
  instances: PaymentInstance[]
): ServiceBillingAnalysis[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const billingCycleServices = services.filter(
    s => s.serviceType === 'billing_cycle' && s.billingCycleDay && s.billingDueDay
  );

  return billingCycleServices.map(service => {
    const { cutoffDate, dueDate } = calculateBillingPeriod(
      service.billingCycleDay!,
      service.billingDueDay!,
      today
    );

    const daysUntilDue = Math.ceil(
      (dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
    );
    const daysAfterCutoff = Math.ceil(
      (today.getTime() - cutoffDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    const toleranceMs = BILLING_TOLERANCE_MS;
    const serviceInstance = instances.find(inst =>
      inst.serviceId === service.id &&
      inst.dueDate >= new Date(cutoffDate.getTime() - toleranceMs) &&
      inst.dueDate <= new Date(dueDate.getTime() + toleranceMs) &&
      (inst.status === 'pending' || inst.status === 'partial')
    );

    const hasAmount = serviceInstance ? serviceInstance.amount > 0 : false;
    const amount = serviceInstance?.amount || 0;

    let status: 'awaiting_amount' | 'ready' | 'overdue' | 'upcoming';
    if (daysUntilDue < 0) {
      status = 'overdue';
    } else if (daysAfterCutoff > 0 && !hasAmount) {
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

// ─── Service Line Billing Analysis ───

/**
 * Analiza líneas de servicio con ciclo de facturación.
 * Usa la misma lógica de período que tarjetas (calculateBillingPeriod).
 */
export function analyzeServiceLineBillingCycles(
  serviceLines: ServiceLine[],
  services: Service[],
  instances: PaymentInstance[]
): ServiceLineBillingAnalysis[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Lookup rápido de servicios para evitar N+1 en filter + map
  const serviceMap = new Map(services.map(s => [s.id, s]));

  // Solo líneas activas cuyo servicio padre es billing_cycle
  // Servicios fixed no tienen concepto de corte — son pagos fijos con fecha
  const activeLines = serviceLines.filter(line => {
    const service = serviceMap.get(line.serviceId);
    return line.isActive && service?.serviceType === 'billing_cycle';
  });

  return activeLines.map(line => {
    const service = serviceMap.get(line.serviceId)!;

    // Calcular período usando la función unificada
    let { cutoffDate, dueDate } = calculateBillingPeriod(
      line.billingCycleDay,
      line.billingDueDay,
      today
    );

    // Calcular límite superior una vez fuera del find
    let dueDateLimit = new Date(dueDate.getTime() + BILLING_TOLERANCE_MS);

    // Buscar instancia en el período actual
    let lineInstance = instances.find(inst =>
      inst.serviceLineId === line.id &&
      inst.dueDate >= cutoffDate &&
      inst.dueDate <= dueDateLimit &&
      (inst.status === 'pending' || inst.status === 'paid' || inst.status === 'partial')
    );

    // Avanzar al siguiente período si:
    // - El período actual está pagado y ya venció
    // - El vencimiento es anterior a la creación de la línea
    const lineCreatedAt = line.createdAt instanceof Date
      ? line.createdAt
      : (line.createdAt as any)?.toDate?.() || new Date(0);

    const shouldAdvancePeriod =
      (lineInstance?.status === 'paid' && dueDate < today) ||
      (dueDate < lineCreatedAt);

    if (shouldAdvancePeriod) {
      // Avanzar corte un mes y recalcular vencimiento
      cutoffDate = new Date(cutoffDate);
      cutoffDate.setMonth(cutoffDate.getMonth() + 1);
      const maxDay = new Date(cutoffDate.getFullYear(), cutoffDate.getMonth() + 1, 0).getDate();
      cutoffDate.setDate(Math.min(line.billingCycleDay, maxDay));

      dueDate = calculateDueDate(line.billingCycleDay, line.billingDueDay, cutoffDate);
      dueDateLimit = new Date(dueDate.getTime() + BILLING_TOLERANCE_MS);

      // Buscar instancia del nuevo período
      lineInstance = instances.find(inst =>
        inst.serviceLineId === line.id &&
        inst.dueDate >= cutoffDate &&
        inst.dueDate <= dueDateLimit &&
        (inst.status === 'pending' || inst.status === 'paid' || inst.status === 'partial')
      );
    }

    // Calcular días con fechas (posiblemente ajustadas)
    const daysUntilDue = Math.ceil(
      (dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
    );
    const daysAfterCutoff = Math.ceil(
      (today.getTime() - cutoffDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    const hasProgrammedPayment = !!lineInstance;
    const programmedAmount = lineInstance?.amount || 0;

    // Determinar status
    let status: 'covered' | 'not_programmed' | 'overdue' | 'partial' | 'programmed';
    if (daysUntilDue < 0 && !hasProgrammedPayment) {
      status = 'overdue';
    } else if (lineInstance?.status === 'paid') {
      status = 'covered';
    } else if (lineInstance?.status === 'partial') {
      status = 'partial';
    } else if (hasProgrammedPayment) {
      status = 'programmed';
    } else {
      status = 'not_programmed';
    }

    return {
      serviceLine: line,
      service,
      currentPeriod: {
        cutoffDate,
        dueDate,
        daysUntilDue,
        daysAfterCutoff,
        hasProgrammedPayment,
        programmedAmount,
        status,
      }
    };
  });
}

// ─── Timeline ───

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
