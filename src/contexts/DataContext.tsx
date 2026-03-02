import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import {
  collection,
  query,
  where,
  getDocs,
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

interface DataContextType {
  cards: Card[];
  banks: Bank[];
  services: Service[];
  serviceLines: ServiceLine[];
  scheduledPayments: ScheduledPayment[];
  paymentInstances: PaymentInstance[];
  loading: boolean;
  errors: Record<string, string | null>;
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
  const [errors, setErrors] = useState<Record<string, string | null>>({});

  const setError = useCallback((key: string, error: string | null) => {
    setErrors(prev => ({ ...prev, [key]: error }));
  }, []);

  const fetchCards = useCallback(async () => {
    if (!householdId) return;
    try {
      const q = query(collection(db, 'cards'), where('householdId', '==', householdId));
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map((doc) => ({
        ...doc.data(),
        id: doc.id,
        createdAt: doc.data().createdAt?.toDate() || new Date(),
        updatedAt: doc.data().updatedAt?.toDate() || new Date(),
        cardType: doc.data().cardType || 'Departamental',
        owner: doc.data().owner || 'Gustavo',
        bankId: doc.data().bankId || '',
        availableCredit: doc.data().availableCredit || 0,
      })) as Card[];
      setCards(data);
      setError('cards', null);
    } catch (err) {
      console.error('Error fetching cards:', err);
      setError('cards', 'Error al cargar tarjetas');
    }
  }, [householdId, setError]);

  const fetchBanks = useCallback(async () => {
    if (!householdId) return;
    try {
      const q = query(collection(db, 'banks'), where('householdId', '==', householdId));
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map((doc) => ({
        ...doc.data(),
        id: doc.id,
        createdAt: doc.data().createdAt?.toDate() || new Date(),
        updatedAt: doc.data().updatedAt?.toDate() || new Date(),
      })) as Bank[];
      setBanks(data);
      setError('banks', null);
    } catch (err) {
      console.error('Error fetching banks:', err);
      setError('banks', 'Error al cargar bancos');
    }
  }, [householdId, setError]);

  const fetchServices = useCallback(async () => {
    if (!householdId) return;
    try {
      const q = query(collection(db, 'services'), where('householdId', '==', householdId));
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map((doc) => ({
        ...doc.data(),
        id: doc.id,
        createdAt: doc.data().createdAt?.toDate() || new Date(),
        updatedAt: doc.data().updatedAt?.toDate() || new Date(),
      })) as Service[];
      setServices(data);
      setError('services', null);
    } catch (err) {
      console.error('Error fetching services:', err);
      setError('services', 'Error al cargar servicios');
    }
  }, [householdId, setError]);

  const fetchServiceLines = useCallback(async () => {
    if (!householdId) return;
    try {
      const q = query(collection(db, 'service_lines'), where('householdId', '==', householdId));
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map((doc) => ({
        ...doc.data(),
        id: doc.id,
        createdAt: doc.data().createdAt?.toDate() || new Date(),
        updatedAt: doc.data().updatedAt?.toDate() || new Date(),
      })) as ServiceLine[];
      setServiceLines(data);
      setError('serviceLines', null);
    } catch (err) {
      console.error('Error fetching service lines:', err);
      setError('serviceLines', 'Error al cargar lineas de servicio');
    }
  }, [householdId, setError]);

  const fetchScheduledPayments = useCallback(async () => {
    if (!householdId) return;
    try {
      const q = query(collection(db, 'scheduled_payments'), where('householdId', '==', householdId));
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map((doc) => ({
        ...doc.data(),
        id: doc.id,
        paymentDate: doc.data().paymentDate?.toDate(),
        createdAt: doc.data().createdAt?.toDate() || new Date(),
        updatedAt: doc.data().updatedAt?.toDate() || new Date(),
      })) as ScheduledPayment[];
      setScheduledPayments(data);
      setError('scheduledPayments', null);
    } catch (err) {
      console.error('Error fetching scheduled payments:', err);
      setError('scheduledPayments', 'Error al cargar pagos programados');
    }
  }, [householdId, setError]);

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
      );
      const snapshot = await getDocs(q);
      let data = snapshot.docs.map((doc) => ({
        ...doc.data(),
        id: doc.id,
        dueDate: doc.data().dueDate?.toDate() || new Date(),
        paidDate: doc.data().paidDate?.toDate(),
        createdAt: doc.data().createdAt?.toDate() || new Date(),
        updatedAt: doc.data().updatedAt?.toDate() || new Date(),
      })) as PaymentInstance[];

      // Filtrar rango superior en cliente
      data = data.filter(instance => instance.dueDate <= endDate);

      setPaymentInstances(data);
      setError('paymentInstances', null);
    } catch (err) {
      console.error('Error fetching payment instances:', err);
      setError('paymentInstances', 'Error al cargar instancias de pago');
    }
  }, [householdId, setError]);

  const refetchAll = useCallback(async () => {
    if (!householdId) return;
    await Promise.allSettled([
      fetchCards(),
      fetchBanks(),
      fetchServices(),
      fetchServiceLines(),
      fetchScheduledPayments(),
      fetchPaymentInstances(),
    ]);
  }, [householdId, fetchCards, fetchBanks, fetchServices, fetchServiceLines, fetchScheduledPayments, fetchPaymentInstances]);

  // Fetch inicial cuando householdId esta disponible
  useEffect(() => {
    if (!householdId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    Promise.allSettled([
      fetchCards(),
      fetchBanks(),
      fetchServices(),
      fetchServiceLines(),
      fetchScheduledPayments(),
      fetchPaymentInstances(),
    ]).finally(() => setLoading(false));
  }, [householdId, fetchCards, fetchBanks, fetchServices, fetchServiceLines, fetchScheduledPayments, fetchPaymentInstances]);

  const value: DataContextType = useMemo(() => ({
    cards,
    banks,
    services,
    serviceLines,
    scheduledPayments,
    paymentInstances,
    loading,
    errors,
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
