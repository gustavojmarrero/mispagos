import { useEffect, useState, useMemo } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { useServices } from '@/hooks/useServices';
import type { Card as CardType, PaymentInstance, ScheduledPayment } from '@/lib/types';
import {
  calculateWeeklyCashFlow,
  analyzeCardPeriods,
  generateSmartAlerts,
  getNext7DaysTimeline,
} from '@/lib/dashboardMetrics';
import { WeeklyCashFlowCard } from '@/components/WeeklyCashFlowCard';
import { CardPeriodAnalysisCard } from '@/components/CardPeriodAnalysisCard';
import { SmartAlertsList } from '@/components/SmartAlertsList';
import { WeeklyTimeline } from '@/components/WeeklyTimeline';
import { DateRangeFilter, type DateRange } from '@/components/dashboard/DateRangeFilter';
import { motion } from 'framer-motion';
import { staggerContainer, staggerItem } from '@/utils/animations';
import { getPeriodContext } from '@/utils/periodContext';

export function Dashboard() {
  const { currentUser } = useAuth();
  const { services } = useServices();
  const [cards, setCards] = useState<CardType[]>([]);
  const [paymentInstances, setPaymentInstances] = useState<PaymentInstance[]>([]);
  const [scheduledPayments, setScheduledPayments] = useState<ScheduledPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<DateRange>({
    from: null,
    to: null,
    preset: 'current-month'
  });

  useEffect(() => {
    if (!currentUser) return;

    const fetchData = async () => {
      try {
        // Fetch cards
        const cardsQuery = query(
          collection(db, 'cards'),
          where('householdId', '==', currentUser.householdId)
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
          where('householdId', '==', currentUser.householdId)
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
          where('householdId', '==', currentUser.householdId)
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
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [currentUser]);

  // Inicializar el rango de fechas al cargar
  useEffect(() => {
    if (dateRange.preset === 'current-month' && !dateRange.from) {
      const now = new Date();
      const from = new Date(now.getFullYear(), now.getMonth(), 1);
      const to = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
      setDateRange({ from, to, preset: 'current-month' });
    }
  }, []);

  // Obtener contexto del período para cálculos
  const periodContext = useMemo(
    () => getPeriodContext(dateRange.preset, dateRange.from, dateRange.to),
    [dateRange]
  );

  // Filtrar payment instances por rango de fechas
  const filteredPaymentInstances = useMemo(() => {
    if (!dateRange.from || !dateRange.to) {
      return paymentInstances;
    }

    return paymentInstances.filter((instance) => {
      const dueDate = instance.dueDate instanceof Date ? instance.dueDate : new Date(instance.dueDate);
      return dueDate >= dateRange.from! && dueDate <= dateRange.to!;
    });
  }, [paymentInstances, dateRange]);

  // Calcular métricas usando los datos filtrados
  const cashFlow = useMemo(
    () => calculateWeeklyCashFlow(filteredPaymentInstances, services, periodContext.isHistorical),
    [filteredPaymentInstances, services, periodContext.isHistorical]
  );

  const cardPeriods = useMemo(
    () => analyzeCardPeriods(cards, filteredPaymentInstances, scheduledPayments),
    [cards, filteredPaymentInstances, scheduledPayments]
  );

  const smartAlerts = useMemo(
    () =>
      generateSmartAlerts(
        cards,
        filteredPaymentInstances,
        scheduledPayments,
        cardPeriods,
        cashFlow
      ),
    [cards, filteredPaymentInstances, scheduledPayments, cardPeriods, cashFlow]
  );

  const timeline = useMemo(
    () => getNext7DaysTimeline(filteredPaymentInstances),
    [filteredPaymentInstances]
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
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
        {/* Filtro de rango de fechas */}
        <motion.div variants={staggerItem}>
          <DateRangeFilter value={dateRange} onChange={setDateRange} />
        </motion.div>

        {/* Alertas Inteligentes */}
        {periodContext.showAlerts && (
          <motion.div variants={staggerItem}>
            <SmartAlertsList alerts={smartAlerts} />
          </motion.div>
        )}

        {/* Flujo de Efectivo Semanal y Mensual */}
        <motion.div variants={staggerItem}>
          <WeeklyCashFlowCard cashFlow={cashFlow} dateRange={dateRange} />
        </motion.div>

        {/* Análisis de Tarjetas por Período */}
        {periodContext.showCardPeriods && (
          <motion.div variants={staggerItem}>
            <CardPeriodAnalysisCard analyses={cardPeriods} />
          </motion.div>
        )}

        {/* Timeline de Próximos 7 Días */}
        {periodContext.showTimeline && (
          <motion.div variants={staggerItem}>
            <WeeklyTimeline timeline={timeline} />
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}
