import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Wallet, Calendar } from 'lucide-react';
import type { CashProjection } from '@/lib/reportsMetrics';

interface CashProjectionCardProps {
  data: CashProjection;
}

export function CashProjectionCard({ data }: CashProjectionCardProps) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
    }).format(amount);
  };

  const formatDateRange = (start: Date, end: Date) => {
    const options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' };
    const startStr = start.toLocaleDateString('es-MX', options);
    const endStr = end.toLocaleDateString('es-MX', options);
    return `${startStr} - ${endStr}`;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wallet className="h-5 w-5 text-primary" />
          Proyección de Efectivo
        </CardTitle>
        <CardDescription>
          Necesidades de liquidez para los próximos 30 días
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Total */}
        <div className="rounded-lg bg-primary/10 p-4 text-center">
          <p className="text-sm text-muted-foreground mb-1">Total Próximos 30 Días</p>
          <p className="text-3xl font-bold text-primary">{formatCurrency(data.next30Days)}</p>
        </div>

        {/* Weekly Breakdown */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <h4 className="text-sm font-semibold">Desglose Semanal</h4>
          </div>

          {data.weeks.map((week) => (
            <div
              key={week.weekNumber}
              className="rounded-lg border border-border p-4 space-y-3 hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold">Semana {week.weekNumber}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDateRange(week.startDate, week.endDate)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold">{formatCurrency(week.amount)}</p>
                  <p className="text-xs text-muted-foreground">
                    {week.payments.length} {week.payments.length === 1 ? 'pago' : 'pagos'}
                  </p>
                </div>
              </div>

              {/* Week Progress Bar */}
              <div className="relative h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full bg-primary transition-all"
                  style={{
                    width: `${data.next30Days > 0 ? (week.amount / data.next30Days) * 100 : 0}%`,
                  }}
                />
              </div>

              {/* Payment Details */}
              {week.payments.length > 0 && (
                <div className="space-y-1 pt-2 border-t border-border">
                  {week.payments.slice(0, 3).map((payment, idx) => (
                    <div key={idx} className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground truncate flex-1">
                        {payment.description}
                      </span>
                      <span className="font-medium ml-2">{formatCurrency(payment.amount)}</span>
                    </div>
                  ))}
                  {week.payments.length > 3 && (
                    <p className="text-xs text-muted-foreground italic">
                      +{week.payments.length - 3} pagos más
                    </p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        {data.next30Days === 0 && (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Wallet className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No hay pagos pendientes próximos</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
