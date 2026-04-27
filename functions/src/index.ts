import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

// La app maneja vencimientos como fechas locales. Mantener el runtime en la
// misma zona evita que los Timestamps creados en servidor caigan el día previo.
process.env.TZ = 'America/Merida';

// Inicializar Firebase Admin
admin.initializeApp();

const db = admin.firestore();

type PaymentType = 'card_payment' | 'service_payment';
type PaymentFrequency = 'monthly' | 'weekly' | 'once' | 'billing_cycle';
type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6;

// Tipos
interface PhysicalCard {
  id: string;
  number: string;
  digitalNumber?: string;
  label: string;
}

interface Card {
  id: string;
  name: string;
  cardType: string;
  physicalCardNumber?: string;
  digitalCardNumber?: string;
  physicalCards?: PhysicalCard[];
  availableCredit: number;
  creditLimit: number;
  bankId: string;
  owner: string;
  householdId: string;
}

interface Bank {
  id: string;
  name: string;
}

interface ScheduledPayment {
  id: string;
  userId: string;
  householdId: string;
  paymentType: PaymentType;
  frequency?: PaymentFrequency;
  description: string;
  amount: number;
  paymentDate?: Date;
  dueDay?: number;
  dayOfWeek?: DayOfWeek;
  cardId?: string;
  serviceId?: string;
  serviceLineId?: string;
  isActive: boolean;
  createdBy: string;
  createdByName: string;
  updatedBy: string;
  updatedByName: string;
}

interface Service {
  id: string;
  serviceType: 'fixed' | 'billing_cycle';
  billingCycleDay?: number;
  billingDueDay?: number;
}

interface ServiceLine {
  id: string;
  billingCycleDay?: number;
  billingDueDay?: number;
}

interface PaymentInstanceInput {
  userId: string;
  householdId: string;
  scheduledPaymentId: string;
  paymentType: PaymentType;
  dueDate: Date;
  amount: number;
  description: string;
  status: 'pending';
  cardId?: string;
  serviceId?: string;
  serviceLineId?: string;
  createdBy: string;
  createdByName: string;
  updatedBy: string;
  updatedByName: string;
}

interface EnsurePaymentInstancesData {
  force?: boolean;
}

interface PhysicalCardResponse {
  label: string;
  lastDigitsPhysical: string | null;
  lastDigitsDigital: string | null;
}

interface CardResponse {
  id: string;
  name: string;
  bankName: string;
  owner: string;
  lastDigitsPhysical: string | null;
  lastDigitsDigital: string | null;
  physicalCards: PhysicalCardResponse[];
  availableCredit: number;
  creditLimit: number;
  cardType: string;
}

function toDate(value: unknown): Date | undefined {
  if (!value) return undefined;
  if (value instanceof Date) return value;
  if (value instanceof admin.firestore.Timestamp) return value.toDate();
  if (typeof value === 'object' && 'toDate' in value && typeof value.toDate === 'function') {
    return value.toDate();
  }
  return undefined;
}

function getDateKey(date: Date): string {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

function getPaymentInstanceDocId(scheduledPaymentId: string, dueDate: Date): string {
  return `${scheduledPaymentId}_${getDateKey(dueDate)}`;
}

function getPaymentGenerationKey(referenceDate = new Date()): string {
  const currentMonth = getCurrentMonthRange(referenceDate);
  const nextMonth = getNextMonthRange(referenceDate);
  return `${getDateKey(currentMonth.start)}_${getDateKey(nextMonth.end)}`;
}

function getCurrentMonthRange(referenceDate = new Date()): { start: Date; end: Date } {
  return {
    start: new Date(referenceDate.getFullYear(), referenceDate.getMonth(), 1),
    end: new Date(referenceDate.getFullYear(), referenceDate.getMonth() + 1, 0, 23, 59, 59, 999),
  };
}

function getNextMonthRange(referenceDate = new Date()): { start: Date; end: Date } {
  return {
    start: new Date(referenceDate.getFullYear(), referenceDate.getMonth() + 1, 1),
    end: new Date(referenceDate.getFullYear(), referenceDate.getMonth() + 2, 0, 23, 59, 59, 999),
  };
}

function getLastDayOfMonth(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
}

function getNextWeekday(fromDate: Date, targetDay: DayOfWeek): Date {
  const result = new Date(fromDate);
  result.setHours(0, 0, 0, 0);
  const currentDay = result.getDay();
  const daysUntilTarget = (targetDay - currentDay + 7) % 7;
  result.setDate(result.getDate() + daysUntilTarget);
  return result;
}

function getNextMonthDay(fromDate: Date, targetDay: number): Date {
  const result = new Date(fromDate);
  result.setHours(0, 0, 0, 0);
  if (result.getDate() > targetDay) {
    result.setMonth(result.getMonth() + 1);
  }
  result.setDate(Math.min(targetDay, getLastDayOfMonth(result)));
  return result;
}

function getNextOccurrenceDate(scheduledPayment: ScheduledPayment, fromDate: Date): Date | null {
  if (scheduledPayment.paymentType === 'card_payment' && scheduledPayment.paymentDate) {
    return scheduledPayment.paymentDate >= fromDate ? scheduledPayment.paymentDate : null;
  }

  if (scheduledPayment.paymentType !== 'service_payment') {
    return null;
  }

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

  return null;
}

function hasBillingCycleConfig(
  scheduledPayment: ScheduledPayment,
  service?: Service,
  serviceLine?: ServiceLine
): boolean {
  return (
    (scheduledPayment.frequency === 'billing_cycle' && service?.serviceType === 'billing_cycle') ||
    (
      scheduledPayment.frequency === 'billing_cycle' &&
      serviceLine?.billingCycleDay !== undefined &&
      serviceLine?.billingDueDay !== undefined
    )
  );
}

function createInstanceInput(
  scheduledPayment: ScheduledPayment,
  dueDate: Date
): PaymentInstanceInput {
  const instance: PaymentInstanceInput = {
    userId: scheduledPayment.userId,
    householdId: scheduledPayment.householdId,
    scheduledPaymentId: scheduledPayment.id,
    paymentType: scheduledPayment.paymentType,
    dueDate,
    amount: scheduledPayment.amount,
    description: scheduledPayment.description,
    status: 'pending',
    createdBy: scheduledPayment.createdBy,
    createdByName: scheduledPayment.createdByName,
    updatedBy: scheduledPayment.updatedBy,
    updatedByName: scheduledPayment.updatedByName,
  };

  if (scheduledPayment.cardId) {
    instance.cardId = scheduledPayment.cardId;
  }
  if (scheduledPayment.serviceId) {
    instance.serviceId = scheduledPayment.serviceId;
  }
  if (scheduledPayment.serviceLineId) {
    instance.serviceLineId = scheduledPayment.serviceLineId;
  }

  return instance;
}

function generateBillingCycleInstances(
  scheduledPayment: ScheduledPayment,
  startDate: Date,
  endDate: Date
): PaymentInstanceInput[] {
  if (!scheduledPayment.paymentDate) {
    return [];
  }

  return scheduledPayment.paymentDate >= startDate && scheduledPayment.paymentDate <= endDate
    ? [createInstanceInput(scheduledPayment, scheduledPayment.paymentDate)]
    : [];
}

function generateInstancesForDateRange(
  scheduledPayment: ScheduledPayment,
  startDate: Date,
  endDate: Date
): PaymentInstanceInput[] {
  if (
    scheduledPayment.paymentType === 'card_payment' ||
    (scheduledPayment.paymentType === 'service_payment' && scheduledPayment.frequency === 'billing_cycle')
  ) {
    if (!scheduledPayment.paymentDate) return [];
    return scheduledPayment.paymentDate >= startDate && scheduledPayment.paymentDate <= endDate
      ? [createInstanceInput(scheduledPayment, scheduledPayment.paymentDate)]
      : [];
  }

  const instances: PaymentInstanceInput[] = [];
  let currentDate = new Date(startDate);

  while (currentDate <= endDate) {
    const nextOccurrence = getNextOccurrenceDate(scheduledPayment, currentDate);
    if (!nextOccurrence || nextOccurrence > endDate) break;

    instances.push(createInstanceInput(scheduledPayment, nextOccurrence));
    currentDate = new Date(nextOccurrence);
    currentDate.setDate(currentDate.getDate() + 1);

    if (scheduledPayment.frequency === 'once') break;
  }

  return instances;
}

function generateCurrentAndNextMonthInstances(
  scheduledPayment: ScheduledPayment,
  service?: Service,
  serviceLine?: ServiceLine
): PaymentInstanceInput[] {
  const currentMonth = getCurrentMonthRange();
  const nextMonth = getNextMonthRange();

  if (hasBillingCycleConfig(scheduledPayment, service, serviceLine)) {
    return [
      ...generateBillingCycleInstances(scheduledPayment, currentMonth.start, currentMonth.end),
      ...generateBillingCycleInstances(scheduledPayment, nextMonth.start, nextMonth.end),
    ];
  }

  return [
    ...generateInstancesForDateRange(scheduledPayment, currentMonth.start, currentMonth.end),
    ...generateInstancesForDateRange(scheduledPayment, nextMonth.start, nextMonth.end),
  ];
}

function mapScheduledPayment(
  doc: admin.firestore.QueryDocumentSnapshot<admin.firestore.DocumentData>
): ScheduledPayment {
  const data = doc.data();
  return {
    ...data,
    id: doc.id,
    paymentDate: toDate(data.paymentDate),
  } as ScheduledPayment;
}

function mapService(
  doc: admin.firestore.QueryDocumentSnapshot<admin.firestore.DocumentData>
): Service {
  return { id: doc.id, ...doc.data() } as Service;
}

function mapServiceLine(
  doc: admin.firestore.QueryDocumentSnapshot<admin.firestore.DocumentData>
): ServiceLine {
  return { id: doc.id, ...doc.data() } as ServiceLine;
}

function isAlreadyExistsError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 6
  );
}

export const ensurePaymentInstances = functions.https.onCall(async (data: EnsurePaymentInstancesData | undefined, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Authentication required');
  }

  const householdId = context.auth.token.householdId as string | undefined;
  if (!householdId) {
    throw new functions.https.HttpsError('failed-precondition', 'Missing householdId claim');
  }

  const force = data?.force === true;
  const generationKey = getPaymentGenerationKey();
  const generationStateRef = db.collection('payment_instance_generation_state').doc(householdId);
  const generationState = await generationStateRef.get();

  if (!force && generationState.exists) {
    const state = generationState.data();
    if (state?.generationKey === generationKey && state?.version === 1) {
      return {
        success: true,
        skipped: true,
        checkedCount: 0,
        createdCount: 0,
        existingCount: 0,
      };
    }
  }

  const [scheduledSnapshot, servicesSnapshot, serviceLinesSnapshot] = await Promise.all([
    db.collection('scheduled_payments').where('householdId', '==', householdId).get(),
    db.collection('services').where('householdId', '==', householdId).get(),
    db.collection('service_lines').where('householdId', '==', householdId).get(),
  ]);

  const scheduledPayments = scheduledSnapshot.docs
    .map(mapScheduledPayment)
    .filter(payment => payment.isActive);
  const services = new Map(servicesSnapshot.docs.map(doc => {
    const service = mapService(doc);
    return [service.id, service];
  }));
  const serviceLines = new Map(serviceLinesSnapshot.docs.map(doc => {
    const serviceLine = mapServiceLine(doc);
    return [serviceLine.id, serviceLine];
  }));

  const expectedInstances = scheduledPayments.flatMap(payment => {
    if (payment.frequency === 'billing_cycle' && !payment.paymentDate) {
      return [];
    }

    return generateCurrentAndNextMonthInstances(
      payment,
      payment.serviceId ? services.get(payment.serviceId) : undefined,
      payment.serviceLineId ? serviceLines.get(payment.serviceLineId) : undefined
    );
  });
  const currentMonth = getCurrentMonthRange();
  const nextMonth = getNextMonthRange();
  const existingSnapshot = await db
    .collection('payment_instances')
    .where('householdId', '==', householdId)
    .where('dueDate', '>=', admin.firestore.Timestamp.fromDate(currentMonth.start))
    .where('dueDate', '<=', admin.firestore.Timestamp.fromDate(nextMonth.end))
    .orderBy('dueDate', 'asc')
    .get();

  const existingKeys = new Set<string>();
  existingSnapshot.docs.forEach(doc => {
    const data = doc.data();
    const dueDate = toDate(data.dueDate);
    if (typeof data.scheduledPaymentId === 'string' && dueDate) {
      existingKeys.add(getPaymentInstanceDocId(data.scheduledPaymentId, dueDate));
    }
  });
  const missingInstances = expectedInstances.filter(
    instance => !existingKeys.has(getPaymentInstanceDocId(instance.scheduledPaymentId, instance.dueDate))
  );

  let createdCount = 0;
  let existingCount = expectedInstances.length - missingInstances.length;

  await Promise.all(missingInstances.map(async instance => {
    const docRef = db
      .collection('payment_instances')
      .doc(getPaymentInstanceDocId(instance.scheduledPaymentId, instance.dueDate));

    try {
      await docRef.create({
        ...instance,
        dueDate: admin.firestore.Timestamp.fromDate(instance.dueDate),
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      createdCount += 1;
    } catch (error) {
      if (isAlreadyExistsError(error)) {
        existingCount += 1;
        return;
      }
      throw error;
    }
  }));

  await generationStateRef.set({
    householdId,
    generationKey,
    version: 1,
    checkedCount: expectedInstances.length,
    createdCount,
    existingCount,
    force,
    completedAt: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });

  return {
    success: true,
    skipped: false,
    checkedCount: expectedInstances.length,
    createdCount,
    existingCount,
  };
});

// Middleware de autenticación por token
const validateApiToken = (req: functions.https.Request): boolean => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return false;
  }

  const token = authHeader.split('Bearer ')[1];
  const apiSecret = process.env.API_SECRET || functions.config().api?.secret;

  if (!apiSecret) {
    console.error('API_SECRET not configured');
    return false;
  }

  return token === apiSecret;
};

// Helper para obtener últimos 4 dígitos
const getLast4Digits = (cardNumber?: string): string | null => {
  if (!cardNumber) return null;
  const cleaned = cardNumber.replace(/\s/g, '');
  return cleaned.length >= 4 ? cleaned.slice(-4) : null;
};

// GET /api/cards/credit - Obtener crédito disponible de tarjetas bancarias
export const getCardsCredit = functions.https.onRequest(async (req, res) => {
  // CORS headers
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Authorization, Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  if (req.method !== 'GET') {
    res.status(405).json({ success: false, error: 'Method not allowed' });
    return;
  }

  // Validar token
  if (!validateApiToken(req)) {
    res.status(401).json({ success: false, error: 'Unauthorized' });
    return;
  }

  try {
    const householdId = req.query.householdId as string | undefined;

    // Obtener tarjetas bancarias (excluir Departamental)
    let cardsQuery = db.collection('cards')
      .where('cardType', 'in', ['Visa', 'Mastercard', 'Amex']);

    if (householdId) {
      cardsQuery = db.collection('cards')
        .where('householdId', '==', householdId)
        .where('cardType', 'in', ['Visa', 'Mastercard', 'Amex']);
    }

    const cardsSnapshot = await cardsQuery.get();

    if (cardsSnapshot.empty) {
      res.json({ success: true, cards: [] });
      return;
    }

    // Obtener todos los bancos para hacer lookup
    const banksSnapshot = await db.collection('banks').get();
    const banksMap = new Map<string, string>();
    banksSnapshot.docs.forEach(doc => {
      const bank = doc.data() as Bank;
      banksMap.set(doc.id, bank.name);
    });

    // Mapear tarjetas a response
    const cards: CardResponse[] = cardsSnapshot.docs.map(doc => {
      const card = { id: doc.id, ...doc.data() } as Card;

      // Construir array de tarjetas físicas
      let physicalCards: PhysicalCardResponse[];
      if (card.physicalCards && card.physicalCards.length > 0) {
        physicalCards = card.physicalCards.map(pc => ({
          label: pc.label,
          lastDigitsPhysical: getLast4Digits(pc.number),
          lastDigitsDigital: getLast4Digits(pc.digitalNumber) || getLast4Digits(card.digitalCardNumber),
        }));
      } else {
        // Fallback a campos legacy
        physicalCards = [{
          label: card.owner,
          lastDigitsPhysical: getLast4Digits(card.physicalCardNumber),
          lastDigitsDigital: getLast4Digits(card.digitalCardNumber),
        }];
      }

      return {
        id: card.id,
        name: card.name,
        bankName: banksMap.get(card.bankId) || 'Desconocido',
        owner: card.owner,
        lastDigitsPhysical: physicalCards[0].lastDigitsPhysical,
        lastDigitsDigital: physicalCards[0].lastDigitsDigital,
        physicalCards,
        availableCredit: card.availableCredit,
        creditLimit: card.creditLimit,
        cardType: card.cardType,
      };
    });

    // Ordenar por banco y nombre
    cards.sort((a, b) => {
      if (a.bankName !== b.bankName) return a.bankName.localeCompare(b.bankName);
      return a.name.localeCompare(b.name);
    });

    res.json({
      success: true,
      count: cards.length,
      cards,
    });

  } catch (error) {
    console.error('Error fetching cards:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// PATCH /api/cards/:cardId/credit - Actualizar crédito disponible
export const updateCardCredit = functions.https.onRequest(async (req, res) => {
  // CORS headers
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'PATCH, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Authorization, Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  if (req.method !== 'PATCH') {
    res.status(405).json({ success: false, error: 'Method not allowed' });
    return;
  }

  // Validar token
  if (!validateApiToken(req)) {
    res.status(401).json({ success: false, error: 'Unauthorized' });
    return;
  }

  try {
    // Obtener cardId de la URL (formato: /api/cards/{cardId}/credit)
    const pathParts = req.path.split('/').filter(p => p);
    const cardIdIndex = pathParts.indexOf('cards') + 1;
    const cardId = pathParts[cardIdIndex];

    if (!cardId) {
      res.status(400).json({ success: false, error: 'Card ID is required' });
      return;
    }

    const { availableCredit } = req.body;

    if (typeof availableCredit !== 'number' || availableCredit < 0) {
      res.status(400).json({
        success: false,
        error: 'availableCredit must be a positive number'
      });
      return;
    }

    // Obtener tarjeta actual
    const cardRef = db.collection('cards').doc(cardId);
    const cardDoc = await cardRef.get();

    if (!cardDoc.exists) {
      res.status(404).json({ success: false, error: 'Card not found' });
      return;
    }

    const cardData = cardDoc.data() as Card;
    const previousCredit = cardData.availableCredit;

    // Actualizar crédito disponible
    await cardRef.update({
      availableCredit,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedBy: 'api',
      updatedByName: 'API External',
    });

    res.json({
      success: true,
      card: {
        id: cardId,
        name: cardData.name,
        previousCredit,
        newCredit: availableCredit,
        updatedAt: new Date().toISOString(),
      },
    });

  } catch (error) {
    console.error('Error updating card credit:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});
