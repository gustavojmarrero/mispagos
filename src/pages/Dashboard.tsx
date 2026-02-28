import { useEffect, useState, useMemo, useRef } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { useServices } from '@/hooks/useServices';
import { useBanks } from '@/hooks/useBanks';
import { useServiceLines } from '@/hooks/useServiceLines';
import type { Card as CardType, PaymentInstance, ScheduledPayment } from '@/lib/types';
import {
  calculateWeeklyCashFlow,
  analyzeCardPeriods,
  analyzeServiceBillingCycles,
  analyzeServiceLineBillingCycles,
  generateSmartAlerts,
  getNext7DaysTimeline,
} from '@/lib/dashboardMetrics';
import { ensureMonthlyInstances } from '@/lib/paymentInstances';
import { WeeklyCashFlowCard } from '@/components/WeeklyCashFlowCard';
import { SmartAlertsList } from '@/components/SmartAlertsList';
import { WeeklyTimeline } from '@/components/WeeklyTimeline';
import { DashboardSkeleton } from '@/components/DashboardSkeleton';
import { motion } from 'framer-motion';
import { staggerContainer, staggerItem } from '@/utils/animations';

export function Dashboard() {
  const { currentUser } = useAuth();
  const householdId = currentUser?.householdId ?? null;
  const { services } = useServices();
  const { banks } = useBanks();
  const { serviceLines } = useServiceLines({ activeOnly: true });
  const [cards, setCards] = useState<CardType[]>([]);
  const [paymentInstances, setPaymentInstances] = useState<PaymentInstance[]>([]);
  const [scheduledPayments, setScheduledPayments] = useState<ScheduledPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [dataLoaded, setDataLoaded] = useState(false);
  const instancesGeneratedRef = useRef(false);
  const isGeneratingRef = useRef(false);

  // Refs para datos auxiliares que no deben ser dependencias del efecto de generación
  const servicesRef = useRef(services);
  servicesRef.current = services;
  const serviceLinesRef = useRef(serviceLines);
  serviceLinesRef.current = serviceLines;
  const paymentInstancesRef = useRef(paymentInstances);
  paymentInstancesRef.current = paymentInstances;

  useEffect(() => {
    if (!householdId) return;

    const fetchData = async () => {
      try {
        // Fetch cards
        const cardsQuery = query(
          collection(db, 'cards'),
          where('householdId', '==', householdId)
        );
        const cardsSnapshot = await getDocs(cardsQuery);
        const cardsData = cardsSnapshot.docs.map((doc) => ({
          ...doc.data(),
          id: doc.id,
          createdAt: doc.data().createdAt?.toDate() || new Date(),
          updatedAt: doc.data().updatedAt?.toDate() || new Date(),
        })) as CardType[];

        // Fetch payment instances
        const instancesQuery = query(
          collection(db, 'payment_instances'),
          where('householdId', '==', householdId)
        );
        const instancesSnapshot = await getDocs(instancesQuery);
        const instancesData = instancesSnapshot.docs.map((doc) => ({
          ...doc.data(),
          id: doc.id,
          dueDate: doc.data().dueDate?.toDate() || new Date(),
          paidDate: doc.data().paidDate?.toDate(),
          createdAt: doc.data().createdAt?.toDate() || new Date(),
          updatedAt: doc.data().updatedAt?.toDate() || new Date(),
        })) as PaymentInstance[];

        // Fetch scheduled payments
        const scheduledQuery = query(
          collection(db, 'scheduled_payments'),
          where('householdId', '==', householdId)
        );
        const scheduledSnapshot = await getDocs(scheduledQuery);
        const scheduledData = scheduledSnapshot.docs.map((doc) => ({
          ...doc.data(),
          id: doc.id,
          paymentDate: doc.data().paymentDate?.toDate(),
          createdAt: doc.data().createdAt?.toDate() || new Date(),
          updatedAt: doc.data().updatedAt?.toDate() || new Date(),
        })) as ScheduledPayment[];

        setCards(cardsData);
        setPaymentInstances(instancesData);
        setScheduledPayments(scheduledData);
        setDataLoaded(true);
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [householdId]);

  // Trigger: generar instancias faltantes del mes actual y siguiente
  useEffect(() => {
    if (!householdId || loading || !dataLoaded || instancesGeneratedRef.current || isGeneratingRef.current) return;
    if (scheduledPayments.length === 0) return;

    const generateMissingInstances = async () => {
      isGeneratingRef.current = true;
      try {
        await ensureMonthlyInstances(
          householdId,
          scheduledPayments,
          servicesRef.current,
          serviceLinesRef.current,
          paymentInstancesRef.current
        );
        instancesGeneratedRef.current = true;
      } catch (error: unknown) {
        const firebaseError = error as { message?: string; code?: string };
        console.error('[Dashboard] Error generando instancias:', firebaseError.code, firebaseError.message);
      } finally {
        isGeneratingRef.current = false;
      }
    };

    generateMissingInstances();
  }, [householdId, loading, dataLoaded, scheduledPayments]);

  // Rango de fechas fijo: mes actual
  const dateRange = useMemo(() => {
    const now = new Date();
    const from = new Date(now.getFullYear(), now.getMonth(), 1);
    const to = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    return { from, to, preset: 'current-month' as const };
  }, []);

  // Filtrar payment instances por mes actual
  const filteredPaymentInstances = useMemo(() => {
    return paymentInstances.filter((instance) => {
      const dueDate = instance.dueDate instanceof Date ? instance.dueDate : new Date(instance.dueDate);
      return dueDate >= dateRange.from && dueDate <= dateRange.to;
    });
  }, [paymentInstances, dateRange]);

  // Calcular métricas usando los datos filtrados
  const cashFlow = useMemo(
    () => calculateWeeklyCashFlow(filteredPaymentInstances, services, false),
    [filteredPaymentInstances, services]
  );

  const cardPeriods = useMemo(
    () => analyzeCardPeriods(cards, paymentInstances, scheduledPayments),
    [cards, paymentInstances, scheduledPayments]
  );

  // Analizar servicios con ciclo de facturación
  const serviceBillingAnalysis = useMemo(
    () => analyzeServiceBillingCycles(services, paymentInstances),
    [services, paymentInstances]
  );

  // Analizar líneas de servicio con ciclo de facturación (similar a tarjetas)
  const serviceLineBillingAnalysis = useMemo(
    () => analyzeServiceLineBillingCycles(serviceLines, services, scheduledPayments, paymentInstances),
    [serviceLines, services, scheduledPayments, paymentInstances]
  );

  const smartAlerts = useMemo(
    () =>
      generateSmartAlerts(
        cards,
        filteredPaymentInstances,
        scheduledPayments,
        cardPeriods,
        cashFlow,
        banks,
        serviceBillingAnalysis,
        serviceLineBillingAnalysis
      ),
    [cards, filteredPaymentInstances, scheduledPayments, cardPeriods, cashFlow, banks, serviceBillingAnalysis, serviceLineBillingAnalysis]
  );

  // Timeline usa todas las instancias sin filtrar por mes,
  // ya que getNext7DaysTimeline filtra por los próximos 7 días
  const timeline = useMemo(
    () => getNext7DaysTimeline(paymentInstances),
    [paymentInstances]
  );

  if (loading) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">Dashboard</h2>
        <p className="text-sm sm:text-base text-muted-foreground">
          Resumen inteligente de tus finanzas
        </p>
      </motion.div>

      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
        className="space-y-6"
      >
        {/* Alertas Inteligentes */}
        <motion.div variants={staggerItem}>
          <SmartAlertsList alerts={smartAlerts} />
        </motion.div>

        {/* Flujo de Efectivo Semanal y Mensual */}
        <motion.div variants={staggerItem}>
          <WeeklyCashFlowCard cashFlow={cashFlow} dateRange={dateRange} />
        </motion.div>

        {/* Timeline de Próximos 7 Días */}
        <motion.div variants={staggerItem}>
          <WeeklyTimeline timeline={timeline} />
        </motion.div>
      </motion.div>
    </div>
  );
}
