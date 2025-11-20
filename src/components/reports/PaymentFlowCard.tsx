import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar, AlertTriangle } from 'lucide-react';
import type { PaymentFlow } from '@/lib/reportsMetrics';

interface PaymentFlowCardProps {
  data: PaymentFlow;
}

export function PaymentFlowCard({ data }: PaymentFlowCardProps) {
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
          <Calendar className="h-5 w-5 text-primary" />
          Flujo de Pagos
        </CardTitle>
        <CardDescription>
          Distribución de pagos pendientes durante el mes
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Month Split */}
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-lg border border-border p-4">
              <p className="text-sm text-muted-foreground mb-1">Primera Quincena</p>
              <p className="text-xl font-bold">{formatCurrency(data.firstHalf)}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {data.firstHalfPercentage.toFixed(1)}% del total
              </p>
            </div>
            <div className="rounded-lg border border-border p-4">
              <p className="text-sm text-muted-foreground mb-1">Segunda Quincena</p>
              <p className="text-xl font-bold">{formatCurrency(data.secondHalf)}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {data.secondHalfPercentage.toFixed(1)}% del total
              </p>
            </div>
          </div>

          {/* Visual Bar */}
          <div className="relative h-4 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full bg-blue-600 transition-all"
              style={{ width: `${data.firstHalfPercentage}%` }}
            />
          </div>
        </div>

        {/* Critical Days */}
        {data.criticalDays.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              <h4 className="text-sm font-semibold">Días Críticos</h4>
            </div>
            <div className="space-y-2">
              {data.criticalDays.map((critical) => (
                <div
                  key={critical.day}
                  className="flex items-center justify-between rounded-lg border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/30 p-3"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-600 text-white font-bold text-sm">
                      {critical.day}
                    </div>
                    <div>
                      <p className="text-sm font-medium">Día {critical.day}</p>
                      <p className="text-xs text-muted-foreground">
                        {critical.count} {critical.count === 1 ? 'pago' : 'pagos'}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold">{formatCurrency(critical.amount)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
