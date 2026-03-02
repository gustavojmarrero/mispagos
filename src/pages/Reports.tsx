import { useEffect, useState } from 'react';
import { useData } from '@/contexts/DataContext';
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
  const {
    cards,
    services,
    scheduledPayments,
    paymentInstances: instances,
    loading,
  } = useData();

  // Date range state
  const [dateRange, setDateRange] = useState<DateRange>(() => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    return { from: startOfMonth, to: endOfMonth, preset: 'current-month' };
  });

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
