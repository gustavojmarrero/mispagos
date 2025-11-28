import type { PaymentInstance, ScheduledPayment, Card as CardType, Service } from './types';

// ============================================
// 1. CUMPLIMIENTO DE PAGOS
// ============================================

export interface PaymentCompliance {
  completedOnTime: number;
  pending: number;
  overdue: number;
  total: number;
  complianceRate: number;
}

export function calculatePaymentCompliance(
  instances: PaymentInstance[],
  startDate: Date,
  endDate: Date
): PaymentCompliance {
  const now = new Date();

  // Helper para convertir cualquier fecha a Date
  const toDate = (date: any): Date => {
    if (date instanceof Date) return date;
    if (date?.toDate) return date.toDate(); // Firestore Timestamp
    return new Date(date);
  };

  const periodInstances = instances.filter(instance => {
    const dueDate = toDate(instance.dueDate);
    return dueDate >= startDate && dueDate <= endDate;
  });

  // Pagos completados a tiempo (status paid y fecha de pago <= fecha de vencimiento)
  const completedOnTime = periodInstances.filter(i => {
    if (i.status !== 'paid' || !i.paidDate) return false;
    const paidDate = toDate(i.paidDate);
    const dueDate = toDate(i.dueDate);
    return paidDate <= dueDate;
  }).length;

  // También contar pagos completados (aunque sea tarde) para el cálculo general
  const allCompleted = periodInstances.filter(i => i.status === 'paid').length;

  const overdue = periodInstances.filter(i => {
    const dueDate = toDate(i.dueDate);
    return (i.status === 'pending' || i.status === 'partial') && dueDate < now;
  }).length;

  const pending = periodInstances.filter(i => {
    const dueDate = toDate(i.dueDate);
    return (i.status === 'pending' || i.status === 'partial') && dueDate >= now;
  }).length;

  const total = periodInstances.length;
  // Calcular compliance basado en pagos completados (a tiempo o no) vs total
  const complianceRate = total > 0 ? (allCompleted / total) * 100 : 0;

  return {
    completedOnTime,
    pending,
    overdue,
    total,
    complianceRate,
  };
}

// ============================================
// 2. OBLIGACIONES MENSUALES
// ============================================

export interface MonthlyObligations {
  total: number;
  cardPayments: number;
  servicePayments: number;
  otherPayments: number;
  cardPercentage: number;
  servicePercentage: number;
  otherPercentage: number;
}

export function calculateMonthlyObligations(
  instances: PaymentInstance[],
  scheduledPayments: ScheduledPayment[],
  startDate: Date,
  endDate: Date
): MonthlyObligations {
  const periodInstances = instances.filter(instance => {
    const dueDate = instance.dueDate instanceof Date ? instance.dueDate : new Date(instance.dueDate);
    return dueDate >= startDate && dueDate <= endDate && instance.status === 'pending';
  });

  let cardPayments = 0;
  let servicePayments = 0;
  let otherPayments = 0;

  periodInstances.forEach(instance => {
    const scheduled = scheduledPayments.find(s => s.id === instance.scheduledPaymentId);

    if (scheduled?.paymentType === 'card_payment') {
      cardPayments += instance.amount;
    } else if (scheduled?.paymentType === 'service_payment') {
      servicePayments += instance.amount;
    } else {
      otherPayments += instance.amount;
    }
  });

  const total = cardPayments + servicePayments + otherPayments;

  return {
    total,
    cardPayments,
    servicePayments,
    otherPayments,
    cardPercentage: total > 0 ? (cardPayments / total) * 100 : 0,
    servicePercentage: total > 0 ? (servicePayments / total) * 100 : 0,
    otherPercentage: total > 0 ? (otherPayments / total) * 100 : 0,
  };
}

// ============================================
// 3. FLUJO DE PAGOS
// ============================================

export interface PaymentFlow {
  firstHalf: number;
  secondHalf: number;
  firstHalfPercentage: number;
  secondHalfPercentage: number;
  criticalDays: { day: number; amount: number; count: number }[];
}

export function calculatePaymentFlow(
  instances: PaymentInstance[],
  startDate: Date,
  endDate: Date
): PaymentFlow {
  const periodInstances = instances.filter(instance => {
    const dueDate = instance.dueDate instanceof Date ? instance.dueDate : new Date(instance.dueDate);
    return dueDate >= startDate && dueDate <= endDate && instance.status === 'pending';
  });

  let firstHalf = 0;
  let secondHalf = 0;
  const dayTotals: Record<number, { amount: number; count: number }> = {};

  periodInstances.forEach(instance => {
    const dueDate = instance.dueDate instanceof Date ? instance.dueDate : new Date(instance.dueDate);
    const day = dueDate.getDate();

    if (day <= 15) {
      firstHalf += instance.amount;
    } else {
      secondHalf += instance.amount;
    }

    if (!dayTotals[day]) {
      dayTotals[day] = { amount: 0, count: 0 };
    }
    dayTotals[day].amount += instance.amount;
    dayTotals[day].count += 1;
  });

  const total = firstHalf + secondHalf;

  // Encontrar días críticos (top 5)
  const criticalDays = Object.entries(dayTotals)
    .map(([day, data]) => ({ day: Number(day), ...data }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5);

  return {
    firstHalf,
    secondHalf,
    firstHalfPercentage: total > 0 ? (firstHalf / total) * 100 : 0,
    secondHalfPercentage: total > 0 ? (secondHalf / total) * 100 : 0,
    criticalDays,
  };
}

// ============================================
// 4. SALUD DE TARJETAS
// ============================================

export interface CardHealth {
  cardId: string;
  cardName: string;
  utilization: number;
  currentBalance: number;
  creditLimit: number;
  trend: 'up' | 'down' | 'stable';
  paymentsOnTime: number;
  totalPayments: number;
  complianceRate: number;
}

export function calculateCardHealth(
  cards: CardType[],
  instances: PaymentInstance[],
  scheduledPayments: ScheduledPayment[]
): CardHealth[] {
  return cards.map(card => {
    // Calcular utilización
    const utilization = card.creditLimit > 0
      ? (card.currentBalance / card.creditLimit) * 100
      : 0;

    // Encontrar pagos a esta tarjeta en los últimos 6 meses
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const cardScheduledPayments = scheduledPayments.filter(
      sp => sp.paymentType === 'card_payment' && sp.cardId === card.id
    );

    const cardInstances = instances.filter(instance => {
      const dueDate = instance.dueDate instanceof Date ? instance.dueDate : new Date(instance.dueDate);
      return cardScheduledPayments.some(sp => sp.id === instance.scheduledPaymentId) &&
             dueDate >= sixMonthsAgo;
    });

    const totalPayments = cardInstances.length;
    const paymentsOnTime = cardInstances.filter(i =>
      i.status === 'paid' && i.paidDate && i.paidDate <= i.dueDate
    ).length;

    const complianceRate = totalPayments > 0 ? (paymentsOnTime / totalPayments) * 100 : 100;

    // Calcular tendencia (comparar balance actual con hace 3 meses)
    // Por ahora usamos availableCredit como proxy
    let trend: 'up' | 'down' | 'stable' = 'stable';
    if (utilization > 70) trend = 'up';
    else if (utilization < 30) trend = 'down';

    return {
      cardId: card.id,
      cardName: card.name,
      utilization,
      currentBalance: card.currentBalance,
      creditLimit: card.creditLimit,
      trend,
      paymentsOnTime,
      totalPayments,
      complianceRate,
    };
  });
}

// ============================================
// 5. ANÁLISIS DE SERVICIOS
// ============================================

export interface ServicesAnalysis {
  total: number;
  byTransfer: number;
  byCard: number;
  transferPercentage: number;
  cardPercentage: number;
  topServices: { name: string; amount: number; method: string }[];
}

export function calculateServicesAnalysis(
  instances: PaymentInstance[],
  scheduledPayments: ScheduledPayment[],
  services: Service[],
  startDate: Date,
  endDate: Date
): ServicesAnalysis {
  const periodInstances = instances.filter(instance => {
    const dueDate = instance.dueDate instanceof Date ? instance.dueDate : new Date(instance.dueDate);
    return dueDate >= startDate && dueDate <= endDate && instance.status === 'pending';
  });

  const serviceInstances = periodInstances.filter(instance => {
    const scheduled = scheduledPayments.find(s => s.id === instance.scheduledPaymentId);
    return scheduled?.paymentType === 'service_payment';
  });

  let byTransfer = 0;
  let byCard = 0;
  const serviceAmounts: Record<string, { amount: number; method: string; name: string }> = {};

  serviceInstances.forEach(instance => {
    const scheduled = scheduledPayments.find(s => s.id === instance.scheduledPaymentId);
    if (!scheduled?.serviceId) return;

    const service = services.find(s => s.id === scheduled.serviceId);
    if (!service) return;

    if (service.paymentMethod === 'transfer') {
      byTransfer += instance.amount;
    } else {
      byCard += instance.amount;
    }

    if (!serviceAmounts[service.id]) {
      serviceAmounts[service.id] = {
        amount: 0,
        method: service.paymentMethod === 'card' ? 'Tarjeta' : 'Transferencia',
        name: service.name,
      };
    }
    serviceAmounts[service.id].amount += instance.amount;
  });

  const total = byTransfer + byCard;

  const topServices = Object.values(serviceAmounts)
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5);

  return {
    total,
    byTransfer,
    byCard,
    transferPercentage: total > 0 ? (byTransfer / total) * 100 : 0,
    cardPercentage: total > 0 ? (byCard / total) * 100 : 0,
    topServices,
  };
}

// ============================================
// 6. PROYECCIÓN DE EFECTIVO
// ============================================

export interface WeeklyProjection {
  weekNumber: number;
  startDate: Date;
  endDate: Date;
  amount: number;
  payments: { description: string; amount: number; dueDate: Date }[];
}

export interface CashProjection {
  next30Days: number;
  weeks: WeeklyProjection[];
}

export function calculateCashProjection(
  instances: PaymentInstance[],
  scheduledPayments: ScheduledPayment[]
): CashProjection {
  const now = new Date();
  now.setHours(0, 0, 0, 0);  // Normalizar a medianoche
  const next30Days = new Date(now);
  next30Days.setDate(now.getDate() + 30);

  const upcomingInstances = instances.filter(instance => {
    const dueDate = instance.dueDate instanceof Date ? instance.dueDate : new Date(instance.dueDate);
    const isNotPaid = instance.status === 'pending' || instance.status === 'partial' || instance.status === 'overdue';
    return dueDate <= next30Days && isNotPaid;
  });

  const total = upcomingInstances.reduce((sum, instance) => sum + instance.amount, 0);

  // Dividir en semanas (martes a lunes)
  const weeks: WeeklyProjection[] = [];

  // Calcular el martes de la semana actual
  const dayOfWeek = now.getDay(); // 0=dom, 1=lun, 2=mar, 3=mié, 4=jue, 5=vie, 6=sáb
  const daysFromTuesday = (dayOfWeek - 2 + 7) % 7; // Días transcurridos desde el martes

  const baseWeekStart = new Date(now);
  baseWeekStart.setDate(now.getDate() - daysFromTuesday);
  baseWeekStart.setHours(0, 0, 0, 0);

  for (let i = 0; i < 4; i++) {
    const weekStart = new Date(baseWeekStart);
    weekStart.setDate(baseWeekStart.getDate() + (i * 7));
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);

    const weekInstances = upcomingInstances.filter(instance => {
      const dueDate = instance.dueDate instanceof Date ? instance.dueDate : new Date(instance.dueDate);
      if (i === 0) {
        // Semana 1: incluir vencidos (dueDate < weekStart) + esta semana
        return dueDate <= weekEnd;
      }
      return dueDate >= weekStart && dueDate <= weekEnd;
    });

    const weekAmount = weekInstances.reduce((sum, instance) => sum + instance.amount, 0);

    const payments = weekInstances.map(instance => {
      const scheduled = scheduledPayments.find(s => s.id === instance.scheduledPaymentId);
      return {
        description: scheduled?.description || 'Pago',
        amount: instance.amount,
        dueDate: instance.dueDate instanceof Date ? instance.dueDate : new Date(instance.dueDate),
      };
    });

    weeks.push({
      weekNumber: i + 1,
      startDate: weekStart,
      endDate: weekEnd,
      amount: weekAmount,
      payments,
    });
  }

  return {
    next30Days: total,
    weeks,
  };
}

// ============================================
// 7. RESUMEN DE CRÉDITO
// ============================================

export interface CreditByType {
  type: 'Visa' | 'Mastercard' | 'Amex' | 'Departamental';
  creditLimit: number;
  availableCredit: number;
  usedCredit: number;
  usagePercent: number;
  cardCount: number;
}

export interface CreditSummary {
  totalCreditLimit: number;
  totalAvailableCredit: number;
  totalUsedCredit: number;
  totalUsagePercent: number;
  byType: CreditByType[];
  brandCards: {
    creditLimit: number;
    availableCredit: number;
    usedCredit: number;
    usagePercent: number;
    cardCount: number;
  };
  departamentalCards: {
    creditLimit: number;
    availableCredit: number;
    usedCredit: number;
    usagePercent: number;
    cardCount: number;
  };
}

export function calculateCreditSummary(cards: CardType[]): CreditSummary {
  const typeGroups: Record<string, CreditByType> = {
    Visa: { type: 'Visa', creditLimit: 0, availableCredit: 0, usedCredit: 0, usagePercent: 0, cardCount: 0 },
    Mastercard: { type: 'Mastercard', creditLimit: 0, availableCredit: 0, usedCredit: 0, usagePercent: 0, cardCount: 0 },
    Amex: { type: 'Amex', creditLimit: 0, availableCredit: 0, usedCredit: 0, usagePercent: 0, cardCount: 0 },
    Departamental: { type: 'Departamental', creditLimit: 0, availableCredit: 0, usedCredit: 0, usagePercent: 0, cardCount: 0 },
  };

  let totalCreditLimit = 0;
  let totalAvailableCredit = 0;

  cards.forEach(card => {
    const cardType = card.cardType || 'Departamental';
    const type = typeGroups[cardType] ? cardType : 'Departamental';

    typeGroups[type].creditLimit += card.creditLimit;
    typeGroups[type].availableCredit += card.availableCredit;
    typeGroups[type].usedCredit += card.currentBalance;
    typeGroups[type].cardCount += 1;

    totalCreditLimit += card.creditLimit;
    totalAvailableCredit += card.availableCredit;
  });

  // Calcular porcentajes por tipo
  Object.values(typeGroups).forEach(group => {
    group.usagePercent = group.creditLimit > 0
      ? (group.usedCredit / group.creditLimit) * 100
      : 0;
  });

  const totalUsedCredit = totalCreditLimit - totalAvailableCredit;
  const totalUsagePercent = totalCreditLimit > 0
    ? (totalUsedCredit / totalCreditLimit) * 100
    : 0;

  // Agrupar tarjetas de marca (Visa, Mastercard, Amex) vs Departamentales
  const brandTypes = ['Visa', 'Mastercard', 'Amex'];
  const brandCards = {
    creditLimit: brandTypes.reduce((sum, t) => sum + typeGroups[t].creditLimit, 0),
    availableCredit: brandTypes.reduce((sum, t) => sum + typeGroups[t].availableCredit, 0),
    usedCredit: brandTypes.reduce((sum, t) => sum + typeGroups[t].usedCredit, 0),
    usagePercent: 0,
    cardCount: brandTypes.reduce((sum, t) => sum + typeGroups[t].cardCount, 0),
  };
  brandCards.usagePercent = brandCards.creditLimit > 0
    ? (brandCards.usedCredit / brandCards.creditLimit) * 100
    : 0;

  const departamentalCards = {
    creditLimit: typeGroups.Departamental.creditLimit,
    availableCredit: typeGroups.Departamental.availableCredit,
    usedCredit: typeGroups.Departamental.usedCredit,
    usagePercent: typeGroups.Departamental.usagePercent,
    cardCount: typeGroups.Departamental.cardCount,
  };

  return {
    totalCreditLimit,
    totalAvailableCredit,
    totalUsedCredit,
    totalUsagePercent,
    byType: Object.values(typeGroups).filter(g => g.cardCount > 0),
    brandCards,
    departamentalCards,
  };
}
