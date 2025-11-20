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

export function Dashboard() {
  const { currentUser } = useAuth();
  const { services } = useServices();
  const [cards, setCards] = useState<CardType[]>([]);
  const [paymentInstances, setPaymentInstances] = useState<PaymentInstance[]>([]);
  const [scheduledPayments, setScheduledPayments] = useState<ScheduledPayment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentUser) return;

    const fetchData = async () => {
      try {
        // Fetch cards
        const cardsQuery = query(
          collection(db, 'cards'),
          where('userId', '==', currentUser.id)
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
          where('userId', '==', currentUser.id)
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
          where('userId', '==', currentUser.id)
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

  // Calcular métricas usando las nuevas funciones
  const cashFlow = useMemo(
    () => calculateWeeklyCashFlow(paymentInstances, services),
    [paymentInstances, services]
  );

  const cardPeriods = useMemo(
    () => analyzeCardPeriods(cards, paymentInstances, scheduledPayments),
    [cards, paymentInstances, scheduledPayments]
  );

  const smartAlerts = useMemo(
    () =>
      generateSmartAlerts(
        cards,
        paymentInstances,
        scheduledPayments,
        cardPeriods,
        cashFlow
      ),
    [cards, paymentInstances, scheduledPayments, cardPeriods, cashFlow]
  );

  const timeline = useMemo(
    () => getNext7DaysTimeline(paymentInstances),
    [paymentInstances]
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
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
        <p className="text-muted-foreground">
          Resumen inteligente de tus finanzas
        </p>
      </div>

      {/* Alertas Inteligentes */}
      <SmartAlertsList alerts={smartAlerts} />

      {/* Flujo de Efectivo Semanal y Mensual */}
      <WeeklyCashFlowCard cashFlow={cashFlow} />

      {/* Análisis de Tarjetas por Período */}
      <CardPeriodAnalysisCard analyses={cardPeriods} />

      {/* Timeline de Próximos 7 Días */}
      <WeeklyTimeline timeline={timeline} />
    </div>
  );
}
