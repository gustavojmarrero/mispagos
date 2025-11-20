import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import type { WeeklyCashFlow } from '@/lib/dashboardMetrics';
import { formatCurrency } from '@/lib/utils';
import { Banknote, CreditCard, Calendar, AlertTriangle } from 'lucide-react';

interface WeeklyCashFlowCardProps {
  cashFlow: WeeklyCashFlow;
}

export function WeeklyCashFlowCard({ cashFlow }: WeeklyCashFlowCardProps) {
  const { thisWeek, thisMonth } = cashFlow;

  return (
    <div className="grid gap-4 sm:grid-cols-1 md:grid-cols-2">
      {/* Esta Semana */}
      <Card className="border-2 border-primary/20">
        <CardHeader>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary flex-shrink-0" />
              <CardTitle className="text-base sm:text-lg">Esta Semana</CardTitle>
            </div>
            {thisWeek.urgent > 0 && (
              <Badge variant="destructive" className="text-xs">
                <AlertTriangle className="h-3 w-3 mr-1" />
                {thisWeek.urgent} urgente{thisWeek.urgent !== 1 ? 's' : ''}
              </Badge>
            )}
          </div>
          <CardDescription>Pendientes hasta próximo lunes</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <div className="flex flex-col sm:flex-row items-start sm:items-baseline gap-1 sm:gap-2">
              <span className="text-2xl sm:text-3xl font-bold">
                {formatCurrency(thisWeek.totalPending)}
              </span>
              <span className="text-xs sm:text-sm text-muted-foreground">
                ({thisWeek.instancesCount} pago{thisWeek.instancesCount !== 1 ? 's' : ''})
              </span>
            </div>
          </div>

          {/* Desglose por método de pago */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-3 rounded-lg bg-green-50 border border-green-200">
              <div className="flex items-center gap-2 mb-1">
                <Banknote className="h-4 w-4 text-green-600 flex-shrink-0" />
                <span className="text-xs sm:text-sm font-medium text-green-900">Transferencia</span>
              </div>
              <p className="text-base sm:text-lg font-bold text-green-700">
                {formatCurrency(thisWeek.byTransfer)}
              </p>
            </div>
            <div className="p-3 rounded-lg bg-blue-50 border border-blue-200">
              <div className="flex items-center gap-2 mb-1">
                <CreditCard className="h-4 w-4 text-blue-600 flex-shrink-0" />
                <span className="text-xs sm:text-sm font-medium text-blue-900">Tarjeta</span>
              </div>
              <p className="text-base sm:text-lg font-bold text-blue-700">
                {formatCurrency(thisWeek.byCard)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Este Mes */}
      <Card className="border-2 border-muted">
        <CardHeader>
          <CardTitle className="text-base sm:text-lg">Este Mes</CardTitle>
          <CardDescription className="text-sm">Progreso mensual de pagos</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <div className="flex flex-col sm:flex-row items-start sm:items-baseline gap-1 sm:gap-2">
              <span className="text-2xl sm:text-3xl font-bold">
                {formatCurrency(thisMonth.totalPending)}
              </span>
              <span className="text-xs sm:text-sm text-muted-foreground">pendiente</span>
            </div>
          </div>

          {/* Barra de progreso */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Progreso</span>
              <span className="font-medium">
                {Math.round(thisMonth.percentagePaid)}% completado
              </span>
            </div>
            <Progress value={thisMonth.percentagePaid} className="h-2" />
          </div>

          {/* Resumen */}
          <div className="grid grid-cols-2 gap-3 sm:gap-2 text-sm">
            <div>
              <p className="text-muted-foreground text-xs sm:text-sm">Pagado</p>
              <p className="font-semibold text-base sm:text-sm text-green-600">
                {formatCurrency(thisMonth.totalPaid)}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs sm:text-sm">Restante</p>
              <p className="font-semibold text-base sm:text-sm text-orange-600">
                {formatCurrency(thisMonth.remaining)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
