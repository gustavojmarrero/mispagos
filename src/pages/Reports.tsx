import { useEffect, useState, useMemo } from 'react';
import { collection, query, where, orderBy, getDocs, Timestamp, type QueryConstraint } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { useData } from '@/contexts/DataContext';
import type { PaymentInstance } from '@/lib/types';
import {
  calculateServicesAnalysis,
  calculateCashProjection,
  calculateCreditSummary,
  type ServicesAnalysis,
  type CashProjection,
  type CreditSummary,
} from '@/lib/reportsMetrics';
import { ServicesAnalysisCard } from '@/components/reports/ServicesAnalysisCard';
import { CashProjectionCard } from '@/components/reports/CashProjectionCard';
import { CreditSummaryCard } from '@/components/reports/CreditSummaryCard';
import { DateRangeFilter } from '@/components/dashboard/DateRangeFilter';
import type { DateRange } from '@/components/dashboard/DateRangeFilter';

export function Reports() {
  const { currentUser } = useAuth();
  const {
    cards,
    services,
    scheduledPayments,
    paymentInstances: contextInstances,
    loading,
  } = useData();

  // Instancias locales para rangos que exceden la ventana del contexto (3 meses)
  const [localInstances, setLocalInstances] = useState<PaymentInstance[]>([]);

  // Date range state
  const [dateRange, setDateRange] = useState<DateRange>(() => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    return { from: startOfMonth, to: endOfMonth, preset: 'current-month' };
  });

  // Determinar si el rango de fecha excede la ventana del contexto (3 meses atras)
  const needsExtendedFetch = useMemo(() => {
    if (dateRange.preset === 'all' || dateRange.preset === 'last-6-months') return true;
    if (!dateRange.from) return true;
    const contextStart = new Date();
    contextStart.setMonth(contextStart.getMonth() - 3, 1);
    contextStart.setHours(0, 0, 0, 0);
    return dateRange.from < contextStart;
  }, [dateRange]);

  // Fetch extendido cuando el rango excede la ventana del contexto
  useEffect(() => {
    if (!needsExtendedFetch || !currentUser) {
      setLocalInstances([]);
      return;
    }
    const fetchExtended = async () => {
      try {
        // Acotar query con filtro de fecha según el preset
        const constraints: QueryConstraint[] = [
          where('householdId', '==', currentUser.householdId),
        ];

        if (dateRange.preset === 'last-6-months') {
          const sixMonthsAgo = new Date();
          sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6, 1);
          sixMonthsAgo.setHours(0, 0, 0, 0);
          constraints.push(
            where('dueDate', '>=', Timestamp.fromDate(sixMonthsAgo)),
            orderBy('dueDate', 'asc')
          );
        } else if (dateRange.from) {
          // Para 'all' u otros rangos custom con fecha de inicio
          constraints.push(
            where('dueDate', '>=', Timestamp.fromDate(dateRange.from)),
            orderBy('dueDate', 'asc')
          );
        }

        if (dateRange.to) {
          constraints.push(
            where('dueDate', '<=', Timestamp.fromDate(dateRange.to))
          );
        }

        const q = query(
          collection(db, 'payment_instances'),
          ...constraints,
        );
        const snapshot = await getDocs(q);
        setLocalInstances(snapshot.docs.map((doc) => {
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
      } catch (err) {
        console.error('Error fetching extended instances:', err);
      }
    };
    fetchExtended();
  }, [needsExtendedFetch, currentUser?.householdId, dateRange]);

  const instances = needsExtendedFetch ? localInstances : contextInstances;

  // Metrics state
  const [servicesAnalysis, setServicesAnalysis] = useState<ServicesAnalysis | null>(null);
  const [cashProjection, setCashProjection] = useState<CashProjection | null>(null);
  const [creditSummary, setCreditSummary] = useState<CreditSummary | null>(null);

  useEffect(() => {
    if (!loading) {
      calculateMetrics();
    }
  }, [dateRange, loading, cards, services, scheduledPayments, instances]);

  const calculateMetrics = () => {
    // Use date range, or default to "all time" if null
    const startDate = dateRange.from || new Date(2000, 0, 1);
    const endDate = dateRange.to || new Date(2099, 11, 31);

    // Services Analysis
    const servicesData = calculateServicesAnalysis(
      instances,
      scheduledPayments,
      services,
      startDate,
      endDate
    );
    setServicesAnalysis(servicesData);

    // Cash Projection (always next 30 days, independent of date range)
    const projectionData = calculateCashProjection(
      instances,
      scheduledPayments
    );
    setCashProjection(projectionData);

    // Credit Summary (independent of date range)
    const creditData = calculateCreditSummary(cards);
    setCreditSummary(creditData);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">Reportes y Análisis</h2>
          <p className="text-sm sm:text-base text-muted-foreground">
            Análisis detallado de tus pagos y obligaciones financieras
          </p>
        </div>
      </div>

      {/* Date Range Filter */}
      <DateRangeFilter value={dateRange} onChange={setDateRange} />

      {/* Metrics Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* Credit Summary */}
        {creditSummary && <CreditSummaryCard data={creditSummary} />}

        {/* Cash Projection */}
        {cashProjection && <CashProjectionCard data={cashProjection} />}

        {/* Services Analysis */}
        {servicesAnalysis && <ServicesAnalysisCard data={servicesAnalysis} />}
      </div>
    </div>
  );
}
