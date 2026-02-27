import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  updateDoc,
  doc,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import type {
  ScheduledPayment,
  PaymentInstance,
  DayOfWeek,
  Service,
  ServiceLine,
} from './types';

// Tipo helper para configuración de ciclo de facturación
interface BillingCycleConfig {
  billingCycleDay: number;
  billingDueDay: number;
}

/**
 * Obtiene la configuración de ciclo de facturación
 * Prioriza ServiceLine sobre Service para soportar múltiples líneas
 */
function getBillingCycleConfig(
  service?: Service,
  serviceLine?: ServiceLine
): BillingCycleConfig | null {
  // Prioridad 1: ServiceLine
  if (serviceLine?.billingCycleDay && serviceLine?.billingDueDay) {
    return {
      billingCycleDay: serviceLine.billingCycleDay,
      billingDueDay: serviceLine.billingDueDay,
    };
  }

  // Prioridad 2: Service (fallback para datos legacy)
  if (service?.billingCycleDay && service?.billingDueDay) {
    return {
      billingCycleDay: service.billingCycleDay,
      billingDueDay: service.billingDueDay,
    };
  }

  return null;
}

/**
 * Obtiene el primer y último día del mes actual
 */
export function getCurrentMonthRange(): { start: Date; end: Date } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1); // Desde el día 1 del mes
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0); // Último día del mes
  return { start, end };
}

/**
 * Obtiene el primer y último día del mes siguiente
 */
export function getNextMonthRange(): { start: Date; end: Date } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() + 1, 1); // Primer día del próximo mes
  const end = new Date(now.getFullYear(), now.getMonth() + 2, 0); // Último día del próximo mes
  return { start, end };
}

/**
 * Calcula la próxima fecha de ocurrencia de un pago programado
 * Para servicios con billing_cycle, usar generateBillingCycleInstances en su lugar
 */
export function getNextOccurrenceDate(
  scheduledPayment: ScheduledPayment,
  fromDate: Date
): Date | null {
  // Para pagos a tarjetas con fecha específica
  if (scheduledPayment.paymentType === 'card_payment' && scheduledPayment.paymentDate) {
    return scheduledPayment.paymentDate >= fromDate ? scheduledPayment.paymentDate : null;
  }

  // Para servicios
  if (scheduledPayment.paymentType === 'service_payment') {
    // Para servicios con billing_cycle, NO usar esta función
    // (se maneja por generateBillingCycleInstances con el servicio completo)
    if (scheduledPayment.frequency === 'billing_cycle') {
      return null;
    }

    if (scheduledPayment.frequency === 'weekly' && scheduledPayment.dayOfWeek !== undefined) {
      return getNextWeekday(fromDate, scheduledPayment.dayOfWeek);
    }

    if (
      (scheduledPayment.frequency === 'monthly' || scheduledPayment.frequency === 'once') &&
      scheduledPayment.dueDay !== undefined
    ) {
      return getNextMonthDay(fromDate, scheduledPayment.dueDay);
    }
  }

  return null;
}

/**
 * Obtiene la próxima fecha para un día de la semana específico
 */
function getNextWeekday(fromDate: Date, targetDay: DayOfWeek): Date {
  const result = new Date(fromDate);
  const currentDay = result.getDay();
  const daysUntilTarget = (targetDay - currentDay + 7) % 7;

  // Si es 0, significa que es hoy, incluir hoy como primera ocurrencia
  const daysToAdd = daysUntilTarget;
  result.setDate(result.getDate() + daysToAdd);

  return result;
}

/**
 * Obtiene la próxima fecha para un día del mes específico
 */
function getNextMonthDay(fromDate: Date, targetDay: number): Date {
  const result = new Date(fromDate);
  result.setHours(0, 0, 0, 0); // Normalizar la hora
  const currentDay = result.getDate();

  // Si ya pasó el día este mes, ir al próximo mes
  // Nota: usamos > (no >=) para incluir el día actual como válido
  if (currentDay > targetDay) {
    result.setMonth(result.getMonth() + 1);
  }

  // Ajustar al día objetivo
  result.setDate(Math.min(targetDay, getLastDayOfMonth(result)));

  return result;
}

/**
 * Obtiene el último día del mes para una fecha dada
 */
function getLastDayOfMonth(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
}

/**
 * Calcula la fecha de vencimiento para un ciclo de facturación usando la configuración
 * (función interna)
 */
function _getBillingCycleDueDateFromConfig(
  config: BillingCycleConfig,
  referenceDate: Date = new Date()
): Date {
  const { billingCycleDay, billingDueDay } = config;
  const today = new Date(referenceDate);
  today.setHours(0, 0, 0, 0);

  const currentDay = today.getDate();
  let dueDateMonth = today.getMonth();
  let dueDateYear = today.getFullYear();

  // Lógica similar a tarjetas:
  // - Si el día de corte es ANTES del día de vencimiento (ej: corte 15, vence 5)
  //   significa que el corte y el vencimiento son en meses diferentes
  // - Si el día de corte es DESPUÉS del día de vencimiento (ej: corte 5, vence 15)
  //   significa que el corte y el vencimiento son en el mismo mes

  if (billingCycleDay > billingDueDay) {
    // Corte y vencimiento en meses diferentes (ej: corte 15, vence 5 del siguiente)
    if (currentDay <= billingCycleDay) {
      // Estamos antes del corte: vencimiento es este mes o el siguiente
      if (currentDay > billingDueDay) {
        // Ya pasó el vencimiento de este mes, el siguiente es el próximo mes
        dueDateMonth += 1;
      }
    } else {
      // Ya pasó el corte: vencimiento es el siguiente mes
      dueDateMonth += 1;
    }
  } else {
    // Corte y vencimiento en el mismo mes (ej: corte 5, vence 15)
    if (currentDay > billingDueDay) {
      // Ya pasó el vencimiento, el siguiente es el próximo mes
      dueDateMonth += 1;
    }
  }

  // Ajustar año si el mes se desbordó
  if (dueDateMonth > 11) {
    dueDateMonth = dueDateMonth - 12;
    dueDateYear += 1;
  }

  // Ajustar el día si el mes no tiene suficientes días
  const lastDay = new Date(dueDateYear, dueDateMonth + 1, 0).getDate();
  const adjustedDueDay = Math.min(billingDueDay, lastDay);

  return new Date(dueDateYear, dueDateMonth, adjustedDueDay);
}

/**
 * Calcula la fecha de vencimiento para un servicio con ciclo de facturación
 * Similar a la lógica de tarjetas de crédito
 * Ahora soporta ServiceLine para múltiples líneas por servicio
 */
export function getBillingCycleDueDate(
  service: Service,
  referenceDate: Date = new Date(),
  serviceLine?: ServiceLine
): Date | null {
  // Obtener configuración priorizando ServiceLine
  const config = getBillingCycleConfig(service, serviceLine);

  if (!config || service.serviceType !== 'billing_cycle') {
    return null;
  }

  return _getBillingCycleDueDateFromConfig(config, referenceDate);
}

/**
 * Calcula la fecha de corte para un servicio con ciclo de facturación
 */
export function getBillingCycleCutoffDate(
  service: Service,
  referenceDate: Date = new Date()
): Date | null {
  if (service.serviceType !== 'billing_cycle' || !service.billingCycleDay) {
    return null;
  }

  const { billingCycleDay, billingDueDay } = service;
  const today = new Date(referenceDate);
  today.setHours(0, 0, 0, 0);

  const currentDay = today.getDate();
  let cutoffMonth = today.getMonth();
  let cutoffYear = today.getFullYear();

  // Determinar si el corte ya pasó este mes
  if (billingCycleDay && billingDueDay && billingCycleDay > billingDueDay) {
    // Corte y vencimiento en meses diferentes
    if (currentDay > billingCycleDay) {
      // Ya pasó el corte, el siguiente es el próximo mes
      cutoffMonth += 1;
    }
  } else {
    // Corte y vencimiento en el mismo mes
    if (currentDay > billingCycleDay) {
      cutoffMonth += 1;
    }
  }

  // Ajustar año si el mes se desbordó
  if (cutoffMonth > 11) {
    cutoffMonth = cutoffMonth - 12;
    cutoffYear += 1;
  }

  // Ajustar el día si el mes no tiene suficientes días
  const lastDay = new Date(cutoffYear, cutoffMonth + 1, 0).getDate();
  const adjustedCutoffDay = Math.min(billingCycleDay, lastDay);

  return new Date(cutoffYear, cutoffMonth, adjustedCutoffDay);
}

/**
 * Genera instancias para servicios con ciclo de facturación
 * Ahora soporta ServiceLine para múltiples líneas por servicio
 */
export function generateBillingCycleInstances(
  scheduledPayment: ScheduledPayment,
  _service: Service | undefined,
  startDate: Date,
  endDate: Date,
  _serviceLine?: ServiceLine
): Omit<PaymentInstance, 'id' | 'createdAt' | 'updatedAt'>[] {
  const instances: Omit<PaymentInstance, 'id' | 'createdAt' | 'updatedAt'>[] = [];

  // IMPORTANTE: Los pagos billing_cycle NO generan instancias automáticamente.
  // Solo se generan instancias cuando el usuario programa explícitamente el pago
  // usando paymentDate (después de que el corte ya pasó y conoce el monto).

  // Si tiene paymentDate específico, generar instancia con esa fecha
  if (scheduledPayment.paymentDate) {
    const dueDate = scheduledPayment.paymentDate;
    if (dueDate >= startDate && dueDate <= endDate) {
      instances.push({
        userId: scheduledPayment.userId,
        householdId: scheduledPayment.householdId,
        scheduledPaymentId: scheduledPayment.id,
        paymentType: scheduledPayment.paymentType,
        dueDate,
        amount: scheduledPayment.amount || 0,
        description: scheduledPayment.description,
        status: 'pending',
        cardId: scheduledPayment.cardId,
        serviceId: scheduledPayment.serviceId,
        serviceLineId: scheduledPayment.serviceLineId,
        createdBy: scheduledPayment.createdBy,
        createdByName: scheduledPayment.createdByName,
        updatedBy: scheduledPayment.updatedBy,
        updatedByName: scheduledPayment.updatedByName,
      });
    }
  }
  // Si no tiene paymentDate, NO generar instancias automáticamente para billing_cycle.
  // El dashboard mostrará una alerta solicitando que se programe después del corte.

  return instances;
}

/**
 * Genera todas las instancias de un pago programado en un rango de fechas
 */
export function generateInstancesForDateRange(
  scheduledPayment: ScheduledPayment,
  startDate: Date,
  endDate: Date
): Omit<PaymentInstance, 'id' | 'createdAt' | 'updatedAt'>[] {
  const instances: Omit<PaymentInstance, 'id' | 'createdAt' | 'updatedAt'>[] = [];

  // Para pagos a tarjetas (fecha específica única)
  if (scheduledPayment.paymentType === 'card_payment' && scheduledPayment.paymentDate) {
    const dueDate = scheduledPayment.paymentDate;

    if (dueDate >= startDate && dueDate <= endDate) {
      instances.push({
        userId: scheduledPayment.userId, // Mantener por compatibilidad
        householdId: scheduledPayment.householdId,
        scheduledPaymentId: scheduledPayment.id,
        paymentType: scheduledPayment.paymentType,
        dueDate,
        amount: scheduledPayment.amount,
        description: scheduledPayment.description,
        status: 'pending',
        cardId: scheduledPayment.cardId,
        serviceId: scheduledPayment.serviceId,
        createdBy: scheduledPayment.createdBy,
        createdByName: scheduledPayment.createdByName,
        updatedBy: scheduledPayment.updatedBy,
        updatedByName: scheduledPayment.updatedByName,
      });
    }
    return instances;
  }

  // Para pagos de servicio con billing_cycle y paymentDate específico
  if (scheduledPayment.paymentType === 'service_payment' &&
      scheduledPayment.frequency === 'billing_cycle' &&
      scheduledPayment.paymentDate) {
    const dueDate = scheduledPayment.paymentDate;

    if (dueDate >= startDate && dueDate <= endDate) {
      instances.push({
        userId: scheduledPayment.userId,
        householdId: scheduledPayment.householdId,
        scheduledPaymentId: scheduledPayment.id,
        paymentType: scheduledPayment.paymentType,
        dueDate,
        amount: scheduledPayment.amount,
        description: scheduledPayment.description,
        status: 'pending',
        cardId: scheduledPayment.cardId,
        serviceId: scheduledPayment.serviceId,
        serviceLineId: scheduledPayment.serviceLineId,
        createdBy: scheduledPayment.createdBy,
        createdByName: scheduledPayment.createdByName,
        updatedBy: scheduledPayment.updatedBy,
        updatedByName: scheduledPayment.updatedByName,
      });
    }
    return instances;
  }

  // Para servicios con frecuencia (monthly, weekly, once)
  if (scheduledPayment.paymentType === 'service_payment') {
    let currentDate = new Date(startDate);

    while (currentDate <= endDate) {
      const nextOccurrence = getNextOccurrenceDate(scheduledPayment, currentDate);

      if (!nextOccurrence || nextOccurrence > endDate) break;

      instances.push({
        userId: scheduledPayment.userId, // Mantener por compatibilidad
        householdId: scheduledPayment.householdId,
        scheduledPaymentId: scheduledPayment.id,
        paymentType: scheduledPayment.paymentType,
        dueDate: nextOccurrence,
        amount: scheduledPayment.amount,
        description: scheduledPayment.description,
        status: 'pending',
        cardId: scheduledPayment.cardId,
        serviceId: scheduledPayment.serviceId,
        createdBy: scheduledPayment.createdBy,
        createdByName: scheduledPayment.createdByName,
        updatedBy: scheduledPayment.updatedBy,
        updatedByName: scheduledPayment.updatedByName,
      });

      // Avanzar al día siguiente para buscar la próxima ocurrencia
      currentDate = new Date(nextOccurrence);
      currentDate.setDate(currentDate.getDate() + 1);

      // Para pagos únicos, solo generar una instancia
      if (scheduledPayment.frequency === 'once') break;
    }
  }

  return instances;
}

/**
 * Genera instancias para el mes actual y el próximo mes
 * @param scheduledPayment El pago programado
 * @param service El servicio asociado (requerido para billing_cycle)
 * @param serviceLine La línea de servicio asociada (opcional, para billing_cycle con múltiples líneas)
 */
export async function generateCurrentAndNextMonthInstances(
  scheduledPayment: ScheduledPayment,
  service?: Service,
  serviceLine?: ServiceLine
): Promise<void> {
  if (!scheduledPayment.isActive) return;

  const currentMonth = getCurrentMonthRange();
  const nextMonth = getNextMonthRange();

  let allInstances: Omit<PaymentInstance, 'id' | 'createdAt' | 'updatedAt'>[] = [];

  // Para servicios con billing_cycle, usar la lógica específica
  // También considerar si tiene serviceLineId con ciclo de facturación
  const hasBillingCycleConfig = (
    (scheduledPayment.frequency === 'billing_cycle' && service?.serviceType === 'billing_cycle') ||
    (scheduledPayment.frequency === 'billing_cycle' && serviceLine?.billingCycleDay !== undefined && serviceLine?.billingDueDay !== undefined)
  );

  if (hasBillingCycleConfig) {
    const currentMonthInstances = generateBillingCycleInstances(
      scheduledPayment,
      service,
      currentMonth.start,
      currentMonth.end,
      serviceLine
    );

    const nextMonthInstances = generateBillingCycleInstances(
      scheduledPayment,
      service,
      nextMonth.start,
      nextMonth.end,
      serviceLine
    );

    allInstances = [...currentMonthInstances, ...nextMonthInstances];
  } else {
    // Lógica existente para otros tipos de pagos
    const currentMonthInstances = generateInstancesForDateRange(
      scheduledPayment,
      currentMonth.start,
      currentMonth.end
    );

    const nextMonthInstances = generateInstancesForDateRange(
      scheduledPayment,
      nextMonth.start,
      nextMonth.end
    );

    allInstances = [...currentMonthInstances, ...nextMonthInstances];
  }

  // Verificar cuáles ya existen
  const existingInstances = await getExistingInstances(
    scheduledPayment.householdId,
    scheduledPayment.id
  );

  // Filtrar las que no existen
  const instancesToCreate = allInstances.filter(
    (instance) =>
      !existingInstances.some(
        (existing) =>
          existing.dueDate.getTime() === instance.dueDate.getTime() &&
          existing.scheduledPaymentId === instance.scheduledPaymentId
      )
  );

  // Guardar en Firestore
  for (const instance of instancesToCreate) {
    try {
      const dataToSave = {
        ...instance,
        dueDate: Timestamp.fromDate(instance.dueDate),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      await addDoc(collection(db, 'payment_instances'), dataToSave);
    } catch (error) {
      console.error('[PaymentInstances] ❌ Error guardando instancia:', error);
      console.error('[PaymentInstances] Datos que causaron el error:', instance);
      throw error;
    }
  }
}

/**
 * Obtiene las instancias existentes de un pago programado
 */
async function getExistingInstances(
  householdId: string,
  scheduledPaymentId: string
): Promise<PaymentInstance[]> {
  const q = query(
    collection(db, 'payment_instances'),
    where('householdId', '==', householdId),
    where('scheduledPaymentId', '==', scheduledPaymentId)
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({
    ...doc.data(),
    id: doc.id,
    dueDate: doc.data().dueDate?.toDate() || new Date(),
    paidDate: doc.data().paidDate?.toDate(),
    createdAt: doc.data().createdAt?.toDate() || new Date(),
    updatedAt: doc.data().updatedAt?.toDate() || new Date(),
  })) as PaymentInstance[];
}

/**
 * Verifica si es necesario generar instancias para el próximo mes
 * y las genera si es necesario
 * @param householdId ID del hogar
 * @param scheduledPayments Lista de pagos programados
 * @param services Lista de servicios (necesario para billing_cycle)
 * @param serviceLines Lista de líneas de servicio (necesario para billing_cycle con múltiples líneas)
 */
export async function ensureMonthlyInstances(
  householdId: string,
  scheduledPayments: ScheduledPayment[],
  services?: Service[],
  serviceLines?: ServiceLine[]
): Promise<void> {
  const currentMonth = getCurrentMonthRange();
  const nextMonth = getNextMonthRange();

  for (const scheduledPayment of scheduledPayments) {
    if (!scheduledPayment.isActive) continue;

    // IMPORTANTE: Los pagos billing_cycle NO generan instancias automáticamente.
    // Solo se procesan si tienen un paymentDate específico (programados manualmente).
    if (scheduledPayment.frequency === 'billing_cycle' && !scheduledPayment.paymentDate) {
      continue;
    }

    // Verificar si ya existen instancias para el mes actual
    const currentMonthQuery = query(
      collection(db, 'payment_instances'),
      where('householdId', '==', householdId),
      where('scheduledPaymentId', '==', scheduledPayment.id),
      where('dueDate', '>=', Timestamp.fromDate(currentMonth.start)),
      where('dueDate', '<=', Timestamp.fromDate(currentMonth.end))
    );

    // Verificar si ya existen instancias para el próximo mes
    const nextMonthQuery = query(
      collection(db, 'payment_instances'),
      where('householdId', '==', householdId),
      where('scheduledPaymentId', '==', scheduledPayment.id),
      where('dueDate', '>=', Timestamp.fromDate(nextMonth.start)),
      where('dueDate', '<=', Timestamp.fromDate(nextMonth.end))
    );

    const [currentSnapshot, nextSnapshot] = await Promise.all([
      getDocs(currentMonthQuery),
      getDocs(nextMonthQuery)
    ]);

    // Si faltan instancias en cualquiera de los dos meses, regenerar
    if (currentSnapshot.empty || nextSnapshot.empty) {
      // Buscar el servicio asociado si es billing_cycle
      const service = scheduledPayment.frequency === 'billing_cycle' && scheduledPayment.serviceId
        ? services?.find(s => s.id === scheduledPayment.serviceId)
        : undefined;

      // Buscar la línea de servicio asociada si existe
      const serviceLine = scheduledPayment.serviceLineId
        ? serviceLines?.find(sl => sl.id === scheduledPayment.serviceLineId)
        : undefined;

      await generateCurrentAndNextMonthInstances(scheduledPayment, service, serviceLine);
    }
  }
}

/**
 * Actualiza las instancias existentes cuando se edita un pago programado
 * Preserva los pagos parciales y recalcula el monto restante
 * @param scheduledPayment El pago programado actualizado
 * @param updatedBy Usuario que realiza la actualización
 * @param updatedByName Nombre del usuario que realiza la actualización
 * @param service El servicio asociado (opcional, para billing_cycle)
 */
export async function updateExistingInstances(
  scheduledPayment: ScheduledPayment,
  updatedBy: string,
  updatedByName: string,
  service?: Service
): Promise<void> {
  // Obtener todas las instancias existentes del pago programado
  const existingInstances = await getExistingInstances(
    scheduledPayment.householdId,
    scheduledPayment.id
  );

  // Generar las fechas esperadas para el pago programado
  const currentMonth = getCurrentMonthRange();
  const nextMonth = getNextMonthRange();

  let expectedInstances: Omit<PaymentInstance, 'id' | 'createdAt' | 'updatedAt'>[] = [];

  if (scheduledPayment.frequency === 'billing_cycle' && service?.serviceType === 'billing_cycle') {
    const currentMonthInstances = generateBillingCycleInstances(
      scheduledPayment,
      service,
      currentMonth.start,
      currentMonth.end
    );
    const nextMonthInstances = generateBillingCycleInstances(
      scheduledPayment,
      service,
      nextMonth.start,
      nextMonth.end
    );
    expectedInstances = [...currentMonthInstances, ...nextMonthInstances];
  } else {
    const currentMonthInstances = generateInstancesForDateRange(
      scheduledPayment,
      currentMonth.start,
      currentMonth.end
    );
    const nextMonthInstances = generateInstancesForDateRange(
      scheduledPayment,
      nextMonth.start,
      nextMonth.end
    );
    expectedInstances = [...currentMonthInstances, ...nextMonthInstances];
  }

  // Actualizar instancias existentes que estén pending o partial
  for (const existingInstance of existingInstances) {
    // Solo actualizar instancias que no estén pagadas o canceladas
    if (existingInstance.status === 'paid' || existingInstance.status === 'cancelled') {
      continue;
    }

    // Buscar la fecha esperada correspondiente a esta instancia
    // Intentamos encontrar una instancia esperada que coincida con la fecha actual o que sea cercana
    const expectedInstance = expectedInstances.find(exp => {
      const timeDiff = Math.abs(exp.dueDate.getTime() - existingInstance.dueDate.getTime());
      // Permitir hasta 5 días de diferencia para considerar que es la misma instancia
      return timeDiff <= 5 * 24 * 60 * 60 * 1000;
    });

    if (!expectedInstance) {
      continue;
    }

    // Calcular suma de pagos parciales si existen
    const partialPaymentsSum = existingInstance.partialPayments?.reduce(
      (sum, payment) => sum + payment.amount,
      0
    ) || 0;

    // Calcular nuevo remainingAmount
    const newRemainingAmount = scheduledPayment.amount - partialPaymentsSum;

    // Preparar actualización
    const updates: any = {
      amount: scheduledPayment.amount,
      description: scheduledPayment.description,
      serviceLineId: scheduledPayment.serviceLineId || null,
      updatedAt: serverTimestamp(),
      updatedBy,
      updatedByName,
    };

    // Actualizar dueDate si cambió
    if (expectedInstance.dueDate.getTime() !== existingInstance.dueDate.getTime()) {
      updates.dueDate = Timestamp.fromDate(expectedInstance.dueDate);
    }

    // Actualizar remainingAmount si hay pagos parciales
    if (existingInstance.status === 'partial' && partialPaymentsSum > 0) {
      updates.remainingAmount = newRemainingAmount;

      // Si el nuevo remainingAmount es <= 0, marcar como pagado
      if (newRemainingAmount <= 0) {
        updates.status = 'paid';
        updates.paidAmount = scheduledPayment.amount;
        updates.paidDate = serverTimestamp();
      }
    }

    try {
      await updateDoc(doc(db, 'payment_instances', existingInstance.id), updates);
    } catch (error) {
      console.error(`[PaymentInstances] ❌ Error actualizando instancia ${existingInstance.id}:`, error);
      throw error;
    }
  }

}
