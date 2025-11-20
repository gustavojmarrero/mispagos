import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DollarSign, CreditCard, Store, Wallet } from 'lucide-react';
import type { MonthlyObligations } from '@/lib/reportsMetrics';

interface MonthlyObligationsCardProps {
  data: MonthlyObligations;
}

export function MonthlyObligationsCard({ data }: MonthlyObligationsCardProps) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
    }).format(amount);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DollarSign className="h-5 w-5 text-primary" />
          Obligaciones Mensuales
        </CardTitle>
        <CardDescription>
          Distribución de tus pagos pendientes por tipo
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Total Amount */}
        <div className="rounded-lg bg-primary/10 p-4 text-center">
          <p className="text-sm text-muted-foreground mb-1">Total Pendiente</p>
          <p className="text-3xl font-bold text-primary">{formatCurrency(data.total)}</p>
        </div>

        {/* Breakdown */}
        <div className="space-y-4">
          {/* Card Payments */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                <span className="font-medium">Pagos a Tarjetas</span>
              </div>
              <span className="font-semibold">{formatCurrency(data.cardPayments)}</span>
            </div>
            <div className="relative h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full bg-blue-600 transition-all"
                style={{ width: `${data.cardPercentage}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground text-right">
              {data.cardPercentage.toFixed(1)}% del total
            </p>
          </div>

          {/* Service Payments */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <Store className="h-4 w-4 text-green-600 dark:text-green-400" />
                <span className="font-medium">Pagos de Servicios</span>
              </div>
              <span className="font-semibold">{formatCurrency(data.servicePayments)}</span>
            </div>
            <div className="relative h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full bg-green-600 transition-all"
                style={{ width: `${data.servicePercentage}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground text-right">
              {data.servicePercentage.toFixed(1)}% del total
            </p>
          </div>

          {/* Other Payments */}
          {data.otherPayments > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <Wallet className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                  <span className="font-medium">Otros Pagos</span>
                </div>
                <span className="font-semibold">{formatCurrency(data.otherPayments)}</span>
              </div>
              <div className="relative h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full bg-purple-600 transition-all"
                  style={{ width: `${data.otherPercentage}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground text-right">
                {data.otherPercentage.toFixed(1)}% del total
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
