import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import type {
  ScheduledPayment,
  PaymentInstance,
  DayOfWeek,
} from './types';

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
  const currentDay = result.getDate();

  // Si ya pasó el día este mes, ir al próximo mes
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
    console.log('[PaymentInstances] 🔍 Procesando pago de tarjeta:', {
      description: scheduledPayment.description,
      paymentDate: scheduledPayment.paymentDate,
      paymentDateType: typeof scheduledPayment.paymentDate,
      paymentDateConstructor: scheduledPayment.paymentDate?.constructor?.name,
      isDate: scheduledPayment.paymentDate instanceof Date,
      startDate,
      endDate,
    });

    const dueDate = scheduledPayment.paymentDate;

    console.log('[PaymentInstances] 📅 Comparación de fechas:', {
      dueDate,
      dueDateString: dueDate.toString?.(),
      startDateString: startDate.toString(),
      endDateString: endDate.toString(),
      isAfterStart: dueDate >= startDate,
      isBeforeEnd: dueDate <= endDate,
      willGenerate: dueDate >= startDate && dueDate <= endDate,
    });

    if (dueDate >= startDate && dueDate <= endDate) {
      console.log('[PaymentInstances] ✅ Generando instancia para:', scheduledPayment.description);
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
    } else {
      console.log('[PaymentInstances] ⚠️ Fecha fuera del rango, NO se genera instancia');
    }
    return instances;
  }

  // Para servicios con frecuencia
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

  console.log(`[PaymentInstances] Generadas ${instances.length} instancias para "${scheduledPayment.description}"`);
  console.log(`[PaymentInstances] Rango: ${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`);
  if (instances.length > 0) {
    console.log(`[PaymentInstances] Primera: ${instances[0].dueDate.toLocaleDateString()}`);
    console.log(`[PaymentInstances] Última: ${instances[instances.length - 1].dueDate.toLocaleDateString()}`);
  }

  return instances;
}

/**
 * Genera instancias para el mes actual y el próximo mes
 */
export async function generateCurrentAndNextMonthInstances(
  scheduledPayment: ScheduledPayment
): Promise<void> {
  if (!scheduledPayment.isActive) return;

  const currentMonth = getCurrentMonthRange();
  const nextMonth = getNextMonthRange();

  // Generar instancias para ambos rangos
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

  const allInstances = [...currentMonthInstances, ...nextMonthInstances];

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
  console.log(`[PaymentInstances] 💾 Intentando guardar ${instancesToCreate.length} instancias nuevas`);

  for (const instance of instancesToCreate) {
    try {
      const dataToSave = {
        ...instance,
        dueDate: Timestamp.fromDate(instance.dueDate),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      console.log('[PaymentInstances] 📝 Guardando instancia:', {
        description: instance.description,
        dueDate: instance.dueDate,
        amount: instance.amount,
        scheduledPaymentId: instance.scheduledPaymentId,
        cardId: instance.cardId,
        serviceId: instance.serviceId,
      });

      await addDoc(collection(db, 'payment_instances'), dataToSave);
      console.log('[PaymentInstances] ✅ Instancia guardada exitosamente');
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
 */
export async function ensureMonthlyInstances(
  householdId: string,
  scheduledPayments: ScheduledPayment[]
): Promise<void> {
  const nextMonth = getNextMonthRange();

  for (const scheduledPayment of scheduledPayments) {
    if (!scheduledPayment.isActive) continue;

    // Verificar si ya existen instancias para el próximo mes
    const q = query(
      collection(db, 'payment_instances'),
      where('householdId', '==', householdId),
      where('scheduledPaymentId', '==', scheduledPayment.id),
      where('dueDate', '>=', Timestamp.fromDate(nextMonth.start)),
      where('dueDate', '<=', Timestamp.fromDate(nextMonth.end))
    );

    const snapshot = await getDocs(q);

    // Si no existen, generar
    if (snapshot.empty) {
      await generateCurrentAndNextMonthInstances(scheduledPayment);
    }
  }
}
