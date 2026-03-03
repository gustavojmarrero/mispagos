import React, { createContext, useContext, useEffect, useState, useCallback, useMemo, useRef } from 'react';
import {
  collection,
  query,
  where,
  orderBy,
  getDocs,
  Timestamp,
  type DocumentData,
  type QueryConstraint,
  type QueryDocumentSnapshot,
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
  refetchCards: () => Promise<void>;
  refetchBanks: () => Promise<void>;
  refetchServices: () => Promise<void>;
  refetchServiceLines: () => Promise<void>;
  refetchScheduledPayments: () => Promise<void>;
  refetchPaymentInstances: () => Promise<void>;
  refetchAll: () => Promise<void>;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export function useData() {
  const context = useContext(DataContext);
  if (!context) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
}

// Mapeo base de documento Firestore a entidad con campos de metadata
function mapDoc<T>(doc: QueryDocumentSnapshot<DocumentData>): T {
  const d = doc.data();
  return {
    ...d,
    id: doc.id,
    createdAt: d.createdAt?.toDate() || new Date(),
    updatedAt: d.updatedAt?.toDate() || new Date(),
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

export function DataProvider({ children }: { children: React.ReactNode }) {
  const { currentUser } = useAuth();
  const householdId = currentUser?.householdId ?? null;

  const [cards, setCards] = useState<Card[]>([]);
  const [banks, setBanks] = useState<Bank[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [serviceLines, setServiceLines] = useState<ServiceLine[]>([]);
  const [scheduledPayments, setScheduledPayments] = useState<ScheduledPayment[]>([]);
  const [paymentInstances, setPaymentInstances] = useState<PaymentInstance[]>([]);
  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState<Record<DataErrorKey, string | null>>(INITIAL_ERRORS);

  // Helper generico para fetch de colecciones simples
  async function fetchCollection<T>(
    hId: string,
    collectionName: string,
    setter: (data: T[]) => void,
    errorKey: DataErrorKey,
    errorLabel: string,
    mapFn: (doc: QueryDocumentSnapshot<DocumentData>) => T = mapDoc,
    extraConstraints?: QueryConstraint[],
  ) {
    try {
      const constraints: QueryConstraint[] = [
        where('householdId', '==', hId),
        ...(extraConstraints ?? []),
      ];
      const q = query(collection(db, collectionName), ...constraints);
      const snapshot = await getDocs(q);
      setter(snapshot.docs.map(mapFn));
      setErrors(prev => prev[errorKey] === null ? prev : { ...prev, [errorKey]: null });
    } catch (err) {
      console.error(`Error fetching ${collectionName}:`, err);
      setErrors(prev => ({ ...prev, [errorKey]: `Error al cargar ${errorLabel}` }));
    }
  }

  const fetchCards = useCallback(async () => {
    if (!householdId) return;
    await fetchCollection<Card>(householdId, 'cards', setCards, 'cards', 'tarjetas', (doc) => {
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
    });
  }, [householdId]);

  const fetchBanks = useCallback(async () => {
    if (!householdId) return;
    await fetchCollection<Bank>(householdId, 'banks', setBanks, 'banks', 'bancos');
  }, [householdId]);

  const fetchServices = useCallback(async () => {
    if (!householdId) return;
    await fetchCollection<Service>(householdId, 'services', setServices, 'services', 'servicios');
  }, [householdId]);

  const fetchServiceLines = useCallback(async () => {
    if (!householdId) return;
    await fetchCollection<ServiceLine>(householdId, 'service_lines', setServiceLines, 'serviceLines', 'lineas de servicio');
  }, [householdId]);

  const fetchScheduledPayments = useCallback(async () => {
    if (!householdId) return;
    await fetchCollection<ScheduledPayment>(householdId, 'scheduled_payments', setScheduledPayments, 'scheduledPayments', 'pagos programados', (doc) => {
      const d = doc.data();
      return {
        ...d,
        id: doc.id,
        paymentDate: d.paymentDate?.toDate(),
        createdAt: d.createdAt?.toDate() || new Date(),
        updatedAt: d.updatedAt?.toDate() || new Date(),
      } as ScheduledPayment;
    });
  }, [householdId]);

  const fetchPaymentInstances = useCallback(async () => {
    if (!householdId) return;
    try {
      // Filtro de fecha: 3 meses atras -> fin del mes siguiente
      const now = new Date();
      const startDate = new Date(now.getFullYear(), now.getMonth() - 3, 1);
      const endDate = new Date(now.getFullYear(), now.getMonth() + 2, 0, 23, 59, 59, 999);

      const q = query(
        collection(db, 'payment_instances'),
        where('householdId', '==', householdId),
        where('dueDate', '>=', Timestamp.fromDate(startDate)),
        where('dueDate', '<=', Timestamp.fromDate(endDate)),
        orderBy('dueDate', 'asc'),
      );
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map((doc) => {
        const d = doc.data();
        return {
          ...d,
          id: doc.id,
          dueDate: d.dueDate?.toDate() || new Date(),
          paidDate: d.paidDate?.toDate(),
          createdAt: d.createdAt?.toDate() || new Date(),
          updatedAt: d.updatedAt?.toDate() || new Date(),
        } as PaymentInstance;
      });

      setPaymentInstances(data);
      setErrors(prev => prev.paymentInstances === null ? prev : { ...prev, paymentInstances: null });
    } catch (err) {
      console.error('Error fetching payment instances:', err);
      setErrors(prev => ({ ...prev, paymentInstances: 'Error al cargar instancias de pago' }));
    }
  }, [householdId]);

  const refetchAll = useCallback(async () => {
    if (!householdId) return;
    await Promise.allSettled([
      fetchCards(), fetchBanks(), fetchServices(),
      fetchServiceLines(), fetchScheduledPayments(), fetchPaymentInstances(),
    ]);
  }, [householdId, fetchCards, fetchBanks, fetchServices, fetchServiceLines, fetchScheduledPayments, fetchPaymentInstances]);

  // Ref para evitar listar los 6 callbacks en el dep-array del efecto.
  // householdId es la unica dependencia real; los callbacks son estables mientras no cambie.
  const refetchAllRef = useRef(refetchAll);
  refetchAllRef.current = refetchAll;

  useEffect(() => {
    if (!householdId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    refetchAllRef.current().finally(() => setLoading(false));
  }, [householdId]);

  const value: DataContextType = useMemo(() => ({
    cards, banks, services, serviceLines, scheduledPayments, paymentInstances,
    loading, errors,
    refetchCards: fetchCards,
    refetchBanks: fetchBanks,
    refetchServices: fetchServices,
    refetchServiceLines: fetchServiceLines,
    refetchScheduledPayments: fetchScheduledPayments,
    refetchPaymentInstances: fetchPaymentInstances,
    refetchAll,
  }), [
    cards, banks, services, serviceLines, scheduledPayments, paymentInstances,
    loading, errors,
    fetchCards, fetchBanks, fetchServices, fetchServiceLines, fetchScheduledPayments, fetchPaymentInstances, refetchAll,
  ]);

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}
