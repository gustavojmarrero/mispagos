import React, { createContext, useContext, useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import type {
  Card,
  Bank,
  Service,
  ServiceLine,
  ScheduledPayment,
  PaymentInstance,
} from '@/lib/types';

type DataErrorKey = 'cards' | 'banks' | 'services' | 'serviceLines' | 'scheduledPayments' | 'paymentInstances';

interface DataContextType {
  cards: Card[];
  banks: Bank[];
  services: Service[];
  serviceLines: ServiceLine[];
  scheduledPayments: ScheduledPayment[];
  paymentInstances: PaymentInstance[];
  loading: boolean;
  errors: Record<DataErrorKey, string | null>;
  isInstancesGenerated: () => boolean;
  markInstancesGenerated: () => void;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export function useData() {
  const context = useContext(DataContext);
  if (!context) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
}

// Mapeo base: convierte doc de Firestore a entidad con id + timestamps
function mapDoc<T>(doc: { id: string; data: () => Record<string, unknown> }): T {
  const d = doc.data();
  return {
    ...d,
    id: doc.id,
    createdAt: (d.createdAt as { toDate?: () => Date })?.toDate?.() || new Date(),
    updatedAt: (d.updatedAt as { toDate?: () => Date })?.toDate?.() || new Date(),
  } as T;
}

const INITIAL_ERRORS: Record<DataErrorKey, string | null> = {
  cards: null,
  banks: null,
  services: null,
  serviceLines: null,
  scheduledPayments: null,
  paymentInstances: null,
};

const DASHBOARD_CACHE_TTL_MS = 5 * 60 * 1000;

interface StartupDataCache {
  cachedAt: number;
  windowStart: string;
  windowEnd: string;
  cards: Card[];
  banks: Bank[];
  services: Service[];
  serviceLines: ServiceLine[];
  scheduledPayments: ScheduledPayment[];
  paymentInstances: PaymentInstance[];
}

function getCurrentMonthKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function getDateCacheKey(date: Date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

function getPaymentInstancesWindow(now = new Date()) {
  return {
    startDate: new Date(now.getFullYear(), now.getMonth() - 1, 1),
    endDate: new Date(now.getFullYear(), now.getMonth() + 2, 0, 23, 59, 59, 999),
  };
}

function getStartupCacheKey(householdId: string, startDate: Date, endDate: Date) {
  return [
    'mispagos:startup-data',
    householdId,
    getDateCacheKey(startDate),
    getDateCacheKey(endDate),
  ].join(':');
}

function toCachedDate(value: unknown): Date | undefined {
  if (!value) return undefined;
  const date = new Date(value as string);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function hydrateStartupCache(cache: StartupDataCache): StartupDataCache {
  return {
    ...cache,
    cards: cache.cards.map(card => ({
      ...card,
      createdAt: toCachedDate(card.createdAt) || new Date(),
      updatedAt: toCachedDate(card.updatedAt) || new Date(),
    })),
    banks: cache.banks.map(bank => ({
      ...bank,
      createdAt: toCachedDate(bank.createdAt) || new Date(),
      updatedAt: toCachedDate(bank.updatedAt) || new Date(),
    })),
    services: cache.services.map(service => ({
      ...service,
      createdAt: toCachedDate(service.createdAt) || new Date(),
      updatedAt: toCachedDate(service.updatedAt) || new Date(),
    })),
    serviceLines: cache.serviceLines.map(serviceLine => ({
      ...serviceLine,
      createdAt: toCachedDate(serviceLine.createdAt) || new Date(),
      updatedAt: toCachedDate(serviceLine.updatedAt) || new Date(),
    })),
    scheduledPayments: cache.scheduledPayments.map(payment => ({
      ...payment,
      paymentDate: toCachedDate(payment.paymentDate),
      createdAt: toCachedDate(payment.createdAt) || new Date(),
      updatedAt: toCachedDate(payment.updatedAt) || new Date(),
    })),
    paymentInstances: cache.paymentInstances.map(instance => ({
      ...instance,
      dueDate: toCachedDate(instance.dueDate) || new Date(),
      paidDate: toCachedDate(instance.paidDate),
      createdAt: toCachedDate(instance.createdAt) || new Date(),
      updatedAt: toCachedDate(instance.updatedAt) || new Date(),
    })),
  };
}

function readStartupCache(householdId: string, startDate: Date, endDate: Date): StartupDataCache | null {
  try {
    const windowStart = getDateCacheKey(startDate);
    const windowEnd = getDateCacheKey(endDate);
    const raw = localStorage.getItem(getStartupCacheKey(householdId, startDate, endDate));
    if (!raw) return null;

    const parsed = JSON.parse(raw) as StartupDataCache;
    if (
      Date.now() - parsed.cachedAt > DASHBOARD_CACHE_TTL_MS ||
      parsed.windowStart !== windowStart ||
      parsed.windowEnd !== windowEnd
    ) {
      return null;
    }

    return hydrateStartupCache(parsed);
  } catch {
    return null;
  }
}

function writeStartupCache(
  householdId: string,
  startDate: Date,
  endDate: Date,
  data: Omit<StartupDataCache, 'cachedAt' | 'windowStart' | 'windowEnd'>
) {
  try {
    const payload: StartupDataCache = {
      ...data,
      cachedAt: Date.now(),
      windowStart: getDateCacheKey(startDate),
      windowEnd: getDateCacheKey(endDate),
    };
    localStorage.setItem(getStartupCacheKey(householdId, startDate, endDate), JSON.stringify(payload));
  } catch {
    // Si el cache local se llena o no está disponible, la app sigue usando Firestore.
  }
}

export function DataProvider({ children }: { children: React.ReactNode }) {
  const { currentUser } = useAuth();
  const { pathname } = useLocation();
  const householdId = currentUser?.householdId ?? null;

  const [cards, setCards] = useState<Card[]>([]);
  const [banks, setBanks] = useState<Bank[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [serviceLines, setServiceLines] = useState<ServiceLine[]>([]);
  const [scheduledPayments, setScheduledPayments] = useState<ScheduledPayment[]>([]);
  const [paymentInstances, setPaymentInstances] = useState<PaymentInstance[]>([]);
  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState<Record<DataErrorKey, string | null>>(INITIAL_ERRORS);

  // Track instances generation by month key (e.g. "2026-03")
  // Se reinicia automáticamente al cambiar de mes, permitiendo regenerar instancias
  const instancesGeneratedForMonthRef = useRef<string | null>(null);

  useEffect(() => {
    if (!householdId) {
      setCards([]);
      setBanks([]);
      setServices([]);
      setServiceLines([]);
      setScheduledPayments([]);
      setPaymentInstances([]);
      setLoading(false);
      setErrors(INITIAL_ERRORS);
      instancesGeneratedForMonthRef.current = null;
      return;
    }

    setLoading(true);
    instancesGeneratedForMonthRef.current = null;

    const { startDate, endDate } = getPaymentInstancesWindow();
    const cachedStartupData = pathname === '/'
      ? readStartupCache(householdId, startDate, endDate)
      : null;

    if (cachedStartupData) {
      setCards(cachedStartupData.cards);
      setBanks(cachedStartupData.banks);
      setServices(cachedStartupData.services);
      setServiceLines(cachedStartupData.serviceLines);
      setScheduledPayments(cachedStartupData.scheduledPayments);
      setPaymentInstances(cachedStartupData.paymentInstances);
      setErrors(INITIAL_ERRORS);
      setLoading(false);
      instancesGeneratedForMonthRef.current = getCurrentMonthKey();
      return;
    }

    const loaded = new Set<string>();
    const TOTAL = 6;

    function markLoaded(key: string) {
      loaded.add(key);
      if (loaded.size === TOTAL) setLoading(false);
    }

    const unsubs: (() => void)[] = [];

    // Cards
    unsubs.push(onSnapshot(
      query(collection(db, 'cards'), where('householdId', '==', householdId)),
      (snap) => {
        setCards(snap.docs.map(doc => {
          const d = doc.data();
          return {
            ...d,
            id: doc.id,
            createdAt: d.createdAt?.toDate() || new Date(),
            updatedAt: d.updatedAt?.toDate() || new Date(),
            cardType: d.cardType || 'Departamental',
            owner: d.owner || 'Gustavo',
            bankId: d.bankId || '',
            availableCredit: d.availableCredit || 0,
          } as Card;
        }));
        setErrors(prev => prev.cards === null ? prev : { ...prev, cards: null });
        markLoaded('cards');
      },
      (err) => {
        console.error('Error in cards listener:', err);
        setErrors(prev => ({ ...prev, cards: 'Error al cargar tarjetas' }));
        markLoaded('cards');
      }
    ));

    // Banks
    unsubs.push(onSnapshot(
      query(collection(db, 'banks'), where('householdId', '==', householdId)),
      (snap) => {
        setBanks(snap.docs.map(doc => mapDoc<Bank>(doc)));
        setErrors(prev => prev.banks === null ? prev : { ...prev, banks: null });
        markLoaded('banks');
      },
      (err) => {
        console.error('Error in banks listener:', err);
        setErrors(prev => ({ ...prev, banks: 'Error al cargar bancos' }));
        markLoaded('banks');
      }
    ));

    // Services
    unsubs.push(onSnapshot(
      query(collection(db, 'services'), where('householdId', '==', householdId)),
      (snap) => {
        setServices(snap.docs.map(doc => mapDoc<Service>(doc)));
        setErrors(prev => prev.services === null ? prev : { ...prev, services: null });
        markLoaded('services');
      },
      (err) => {
        console.error('Error in services listener:', err);
        setErrors(prev => ({ ...prev, services: 'Error al cargar servicios' }));
        markLoaded('services');
      }
    ));

    // Service Lines
    unsubs.push(onSnapshot(
      query(collection(db, 'service_lines'), where('householdId', '==', householdId)),
      (snap) => {
        setServiceLines(snap.docs.map(doc => mapDoc<ServiceLine>(doc)));
        setErrors(prev => prev.serviceLines === null ? prev : { ...prev, serviceLines: null });
        markLoaded('serviceLines');
      },
      (err) => {
        console.error('Error in service_lines listener:', err);
        setErrors(prev => ({ ...prev, serviceLines: 'Error al cargar líneas de servicio' }));
        markLoaded('serviceLines');
      }
    ));

    // Scheduled Payments
    unsubs.push(onSnapshot(
      query(collection(db, 'scheduled_payments'), where('householdId', '==', householdId)),
      (snap) => {
        setScheduledPayments(snap.docs.map(doc => {
          const d = doc.data();
          return {
            ...d,
            id: doc.id,
            paymentDate: d.paymentDate?.toDate(),
            createdAt: d.createdAt?.toDate() || new Date(),
            updatedAt: d.updatedAt?.toDate() || new Date(),
          } as ScheduledPayment;
        }));
        setErrors(prev => prev.scheduledPayments === null ? prev : { ...prev, scheduledPayments: null });
        markLoaded('scheduledPayments');
      },
      (err) => {
        console.error('Error in scheduled_payments listener:', err);
        setErrors(prev => ({ ...prev, scheduledPayments: 'Error al cargar pagos programados' }));
        markLoaded('scheduledPayments');
      }
    ));

    // Payment Instances (recent operational window)
    unsubs.push(onSnapshot(
      query(
        collection(db, 'payment_instances'),
        where('householdId', '==', householdId),
        where('dueDate', '>=', Timestamp.fromDate(startDate)),
        where('dueDate', '<=', Timestamp.fromDate(endDate)),
        orderBy('dueDate', 'asc'),
      ),
      (snap) => {
        setPaymentInstances(snap.docs.map(doc => {
          const d = doc.data();
          return {
            ...d,
            id: doc.id,
            dueDate: d.dueDate?.toDate() || new Date(),
            paidDate: d.paidDate?.toDate(),
            createdAt: d.createdAt?.toDate() || new Date(),
            updatedAt: d.updatedAt?.toDate() || new Date(),
          } as PaymentInstance;
        }));
        setErrors(prev => prev.paymentInstances === null ? prev : { ...prev, paymentInstances: null });
        markLoaded('paymentInstances');
      },
      (err) => {
        console.error('Error in payment_instances listener:', err);
        setErrors(prev => ({ ...prev, paymentInstances: 'Error al cargar instancias de pago' }));
        markLoaded('paymentInstances');
      }
    ));

    return () => unsubs.forEach(unsub => unsub());
  }, [householdId, pathname]);

  const isInstancesGenerated = useCallback(() => {
    const now = new Date();
    const currentMonth = getCurrentMonthKey(now);
    return instancesGeneratedForMonthRef.current === currentMonth;
  }, []);
  const markInstancesGenerated = useCallback(() => {
    const now = new Date();
    instancesGeneratedForMonthRef.current = getCurrentMonthKey(now);
  }, []);

  useEffect(() => {
    if (!householdId || loading) return;

    const { startDate, endDate } = getPaymentInstancesWindow();
    writeStartupCache(householdId, startDate, endDate, {
      cards,
      banks,
      services,
      serviceLines,
      scheduledPayments,
      paymentInstances,
    });
  }, [householdId, loading, cards, banks, services, serviceLines, scheduledPayments, paymentInstances]);

  const value: DataContextType = useMemo(() => ({
    cards, banks, services, serviceLines, scheduledPayments, paymentInstances,
    loading, errors,
    isInstancesGenerated,
    markInstancesGenerated,
  }), [
    cards, banks, services, serviceLines, scheduledPayments, paymentInstances,
    loading, errors, isInstancesGenerated, markInstancesGenerated,
  ]);

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}
