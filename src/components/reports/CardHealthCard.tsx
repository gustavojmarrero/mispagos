import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CreditCard, TrendingUp, TrendingDown, Minus, AlertTriangle, CheckCircle2 } from 'lucide-react';
import type { CardHealth } from '@/lib/reportsMetrics';

interface CardHealthCardProps {
  data: CardHealth[];
}

export function CardHealthCard({ data }: CardHealthCardProps) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
    }).format(amount);
  };

  const getUtilizationColor = (utilization: number) => {
    if (utilization >= 80) return 'text-red-600 dark:text-red-400';
    if (utilization >= 50) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-green-600 dark:text-green-400';
  };

  const getUtilizationBgColor = (utilization: number) => {
    if (utilization >= 80) return 'bg-red-600';
    if (utilization >= 50) return 'bg-yellow-600';
    return 'bg-green-600';
  };

  const getTrendIcon = (trend: 'up' | 'down' | 'stable') => {
    switch (trend) {
      case 'up':
        return <TrendingUp className="h-4 w-4 text-red-600 dark:text-red-400" />;
      case 'down':
        return <TrendingDown className="h-4 w-4 text-green-600 dark:text-green-400" />;
      default:
        return <Minus className="h-4 w-4 text-muted-foreground" />;
    }
  };

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-primary" />
            Salud de Tarjetas
          </CardTitle>
          <CardDescription>
            Monitoreo de utilización y cumplimiento por tarjeta
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <CreditCard className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No hay tarjetas registradas</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="h-5 w-5 text-primary" />
          Salud de Tarjetas
        </CardTitle>
        <CardDescription>
          Monitoreo de utilización y cumplimiento por tarjeta
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {data.map((card) => (
          <div
            key={card.cardId}
            className="rounded-lg border border-border p-4 space-y-3 hover:bg-muted/50 transition-colors"
          >
            {/* Card Name and Trend */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-primary" />
                <h4 className="font-semibold">{card.cardName}</h4>
              </div>
              {getTrendIcon(card.trend)}
            </div>

            {/* Utilization */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Utilización</span>
                <span className={`font-bold ${getUtilizationColor(card.utilization)}`}>
                  {card.utilization.toFixed(1)}%
                </span>
              </div>
              <div className="relative h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className={`h-full transition-all ${getUtilizationBgColor(card.utilization)}`}
                  style={{ width: `${Math.min(card.utilization, 100)}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{formatCurrency(card.currentBalance)}</span>
                <span>{formatCurrency(card.creditLimit)}</span>
              </div>
            </div>

            {/* Payment Compliance */}
            <div className="flex items-center justify-between pt-2 border-t border-border">
              <div className="flex items-center gap-2 text-sm">
                {card.complianceRate >= 90 ? (
                  <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                ) : (
                  <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                )}
                <span className="text-muted-foreground">Cumplimiento</span>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold">{card.complianceRate.toFixed(0)}%</p>
                <p className="text-xs text-muted-foreground">
                  {card.paymentsOnTime}/{card.totalPayments} a tiempo
                </p>
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
