import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Store, CreditCard, Banknote } from 'lucide-react';
import type { ServicesAnalysis } from '@/lib/reportsMetrics';

interface ServicesAnalysisCardProps {
  data: ServicesAnalysis;
}

export function ServicesAnalysisCard({ data }: ServicesAnalysisCardProps) {
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
          <Store className="h-5 w-5 text-primary" />
          Análisis de Servicios
        </CardTitle>
        <CardDescription>
          Resumen de pagos de servicios pendientes por método
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Total */}
        <div className="rounded-lg bg-primary/10 p-4 text-center">
          <p className="text-sm text-muted-foreground mb-1">Total en Servicios</p>
          <p className="text-3xl font-bold text-primary">{formatCurrency(data.total)}</p>
        </div>

        {/* Payment Methods */}
        <div className="space-y-4">
          {/* Transfer */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <Banknote className="h-4 w-4 text-green-600 dark:text-green-400" />
                <span className="font-medium">Por Transferencia</span>
              </div>
              <span className="font-semibold">{formatCurrency(data.byTransfer)}</span>
            </div>
            <div className="relative h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full bg-green-600 transition-all"
                style={{ width: `${data.transferPercentage}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground text-right">
              {data.transferPercentage.toFixed(1)}% del total
            </p>
          </div>

          {/* Card */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                <span className="font-medium">Con Tarjeta</span>
              </div>
              <span className="font-semibold">{formatCurrency(data.byCard)}</span>
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
        </div>

        {/* Top Services */}
        {data.topServices.length > 0 && (
          <div className="space-y-3">
            <h4 className="text-sm font-semibold">Principales Servicios</h4>
            <div className="space-y-2">
              {data.topServices.map((service, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between rounded-lg border border-border p-3 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{service.name}</p>
                    <p className="text-xs text-muted-foreground">{service.method}</p>
                  </div>
                  <div className="text-right ml-4">
                    <p className="text-sm font-bold">{formatCurrency(service.amount)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {data.total === 0 && (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Store className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No hay pagos de servicios pendientes</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
